// Time step: HA restarts, failure detection, many-to-many re-protection, graceful removal,
// metadata ring detach / Zookeeper re-election, disk balancing and data localization.
//
// Re-protection is "many-to-many": every surviving node is both a source and a target,
// so total rebuild bandwidth grows with the number of survivors (contrast with a RAID
// rebuild that funnels into one spare drive).
import { makeRng } from './rng';
import type { ClusterState, DataItem, Member, SimNode } from './cluster';
import { clone, TIMING, reassignZk } from './failures';
import { pickTarget, diskUsageMap, memberLive, nodeFill, storageLive, acceptsData, pickDiskPublic } from './placement';
import { itemLiveCount } from './status';

const PLANNED = new Set(['maintenance', 'cvm-restart']);

/** Can the down node's offline copies be written off and rebuilt yet? */
function rebuildEligible(s: ClusterState, n: SimNode): boolean {
  if (storageLive(n) || n.state === 'removed' || PLANNED.has(n.state)) return false;
  return n.downSince !== null && s.time - n.downSince >= TIMING.rebuildDelayS;
}

/** Whether HA can guarantee restarts for one host failure at the configured VM load. */
export function haReserveAllowed(s: Pick<ClusterState, 'cfg' | 'nodes' | 'vms'>): { ok: boolean; reason?: string } {
  const compute = s.nodes.filter((n) => n.state !== 'removed' && !n.storageOnly);
  const hostMem = s.cfg.nodeMemGB - s.cfg.cvmMemGB;
  const demand = s.vms.reduce((a, v) => a + v.memGB, 0);
  const capacityAfterOneLoss = (compute.length - 1) * hostMem;
  if (compute.length < 2) return { ok: false, reason: 'HA needs at least two hosts that can run VMs.' };
  if (demand > capacityAfterOneLoss) {
    return {
      ok: false,
      reason: `VMs need ${demand} GB but only ${capacityAfterOneLoss} GB would remain after losing one host. Lower VM memory load or add a node.`,
    };
  }
  return { ok: true };
}

function freeMem(s: ClusterState, nodeId: number) {
  const used = s.vms.reduce((a, v) => a + (v.node === nodeId && v.state === 'running' ? v.memGB : 0), 0);
  return s.cfg.nodeMemGB - s.cfg.cvmMemGB - used;
}

function missingRole(it: DataItem, live: Member[]): Member['role'] {
  if (it.kind === 'rf') return 'replica';
  const data = live.filter((m) => m.role === 'data').length;
  return data < it.need ? 'data' : 'parity';
}

export function tick(state: ClusterState, dt: number): ClusterState {
  const s = clone(state);
  s.time += dt;
  s.tick += 1;
  const rng = makeRng((s.cfg.seed * 2654435761 + s.tick * 40503) >>> 0);

  // ── 1. HA: restart VMs whose host was lost ──
  const restartable = s.nodes.filter((n) => n.state === 'up' && !n.storageOnly);
  for (const vm of s.vms) {
    if (vm.state !== 'restarting' || vm.restartAt === null || s.time < vm.restartAt) continue;
    const ranked = restartable.map((n) => ({ n, free: freeMem(s, n.id) })).sort((a, b) => b.free - a.free);
    const target = ranked.find((r) => r.free >= vm.memGB);
    if (target) {
      const from = s.nodes[vm.node].name;
      vm.node = target.n.id;
      vm.state = 'running';
      vm.restartAt = null;
      vm.movedAt = s.time;
      vm.note = undefined;
      s.events.push({ t: s.time, kind: 'ha', text: `HA restarted ${vm.name} (was on ${from}) on ${target.n.name}.` });
    } else {
      vm.state = 'failed';
      vm.restartAt = null;
      vm.note = 'No host had enough free memory';
      s.events.push({
        t: s.time,
        kind: 'warn',
        text: `${vm.name} could not restart: no surviving host has ${vm.memGB} GB free.${s.cfg.haReserve ? '' : ' (HA memory reservation is off, so restarts are best effort.)'}`,
      });
    }
  }

  // ── 2. Metadata ring detach + Zookeeper re-election after prolonged outages ──
  for (const n of s.nodes) {
    if (n.state === 'removed' || storageLive(n) || PLANNED.has(n.state) || n.detached || n.downSince === null) continue;
    if (s.time - n.downSince >= TIMING.detachS) {
      n.detached = true;
      s.events.push({ t: s.time, kind: 'info', text: `${n.name} detached from the metadata ring; its metadata share is re-replicated on survivors.` });
      if (n.zk) {
        const before = s.nodes.filter((x) => x.zk).map((x) => x.id);
        reassignZk(s);
        const after = s.nodes.filter((x) => x.zk).map((x) => x.id);
        if (before.join() !== after.join()) {
          s.zkMigrations++;
          s.events.push({ t: s.time, kind: 'info', text: 'Zookeeper role moved to a healthy node.' });
        }
      }
    }
  }

  // ── 3. Re-protection ──
  const usage = diskUsageMap(s);
  const survivors = s.nodes.filter((n) => n.state === 'up');
  const work: DataItem[] = [];
  for (const it of s.items) {
    const live = it.members.filter((m) => memberLive(s, m));
    if (live.length >= it.target) continue;
    const offline = it.members.filter((m) => !memberLive(s, m));
    const dueToEligible = it.members.length < it.target || offline.some((m) => rebuildEligible(s, s.nodes[m.node]));
    if (dueToEligible && live.length >= it.need) work.push(it);
  }
  const evac = s.items.filter((it) => it.members.some((m) => s.nodes[m.node].state === 'removing'));

  if (work.length || evac.length) {
    if (work.length && s.rebuild.startedAt === null) {
      s.rebuild.startedAt = s.time;
      s.rebuild.doneGB = 0;
      s.events.push({
        t: s.time,
        kind: 'rebuild',
        text: `Re-protection started: ${survivors.length} surviving nodes copy missing data in parallel.`,
      });
    }
    s.rebuild.budgetGB += (survivors.length * s.cfg.rebuildTBph * 1000 * dt) / 3600;
    // Fewest live copies first: the most exposed data is protected first.
    work.sort((a, b) => itemLiveCount(s, a) - itemLiveCount(s, b) || a.id - b.id);
    let blocked: string | null = null;
    let attempted = false;
    let misses = 0;
    let domainWarned = s.events.some((e) => e.kind === 'warn' && e.text.startsWith('Not enough'));
    for (const it of [...work, ...evac]) {
      const evacuating = !work.includes(it);
      const live = it.members.filter((m) => memberLive(s, m) && s.nodes[m.node].state !== 'removing');
      const cost = it.memberGB * (it.kind === 'ec' ? it.need : 1);
      if (s.rebuild.budgetGB < cost) break;
      attempted = true;
      const res = pickTarget(s, it, rng, usage, {
        existing: live,
        role: missingRole(it, live),
        exclude: s.nodes.filter((n) => n.state === 'removing').map((n) => n.id),
      });
      if (!res) {
        blocked = whyBlocked(s, it, usage);
        if (++misses >= 4) break; // placement is failing cluster-wide this tick
        continue;
      }
      if (!res.domainOk && !domainWarned) {
        domainWarned = true;
        s.events.push({
          t: s.time,
          kind: 'warn',
          text: `Not enough ${s.domain}s left to keep copies in separate ${s.domain}s; copies are placed on separate nodes instead.`,
        });
      }
      const source = live[Math.floor(rng() * live.length)] ?? it.members[0];
      // Drop the stale copy this one replaces (offline node or the node being removed).
      const staleIdx = it.members.findIndex(
        (m) => (!memberLive(s, m) && (rebuildEligible(s, s.nodes[m.node]) || !s.disks.find((d) => d.id === m.disk))) || (evacuating && s.nodes[m.node].state === 'removing'),
      );
      if (staleIdx >= 0) it.members.splice(staleIdx, 1);
      it.members.push(res.member);
      usage.set(res.member.disk, (usage.get(res.member.disk) || 0) + it.memberGB);
      s.rebuild.budgetGB -= cost;
      s.rebuild.doneGB += cost;
      s.transfers.push({ from: source.node, to: res.member.node, t: s.time, kind: evacuating ? 'evacuate' : 'rebuild' });
    }
    if (attempted) {
      if (blocked && s.rebuild.blocked !== blocked) {
        s.events.push({ t: s.time, kind: 'warn', text: `Cannot fully self-heal: ${blocked}` });
      }
      s.rebuild.blocked = blocked;
    }
    // Unused bandwidth does not bank up indefinitely: cap at one minute of throughput
    // plus the largest single copy, so even big items always fit eventually.
    const maxCost = s.items.reduce((m, it) => Math.max(m, it.memberGB * (it.kind === 'ec' ? it.need : 1)), 0);
    s.rebuild.budgetGB = Math.min(s.rebuild.budgetGB, (survivors.length * s.cfg.rebuildTBph * 1000 * 60) / 3600 + maxCost);
  } else {
    s.rebuild.budgetGB = 0;
    s.rebuild.blocked = null;
    const anyUnder = s.items.some((it) => itemLiveCount(s, it) < it.target);
    if (s.rebuild.startedAt !== null && !anyUnder) {
      const mins = Math.round((s.time - s.rebuild.startedAt) / 60);
      s.events.push({
        t: s.time,
        kind: 'ok',
        text: `Re-protection complete in about ${mins} min (illustrative). Every item has its full set of copies again.`,
      });
      s.rebuild.startedAt = null;
    }
  }

  // ── 4. Finish graceful removals ──
  for (const n of s.nodes) {
    if (n.state !== 'removing') continue;
    if (!s.items.some((it) => it.members.some((m) => m.node === n.id))) {
      n.state = 'removed';
      s.cfg = { ...s.cfg, nodes: s.cfg.nodes - 1 };
      s.events.push({ t: s.time, kind: 'ok', text: `${n.name} removed. All of its data was re-protected before it left.` });
      if (n.zk) reassignZk(s);
    }
  }

  // ── 5. Background work when nothing is being rebuilt: localization and disk balancing ──
  if (!work.length && !evac.length) {
    localize(s, rng, usage, dt);
    balance(s, rng, usage, dt);
  }

  s.transfers = s.transfers.filter((t) => s.time - t.t < 120).slice(-80);
  return s;
}

function whyBlocked(s: ClusterState, it: DataItem, usage: Map<string, number>): string {
  const holders = new Set(it.members.map((m) => m.node));
  const candidates = s.nodes.filter((n) => acceptsData(n) && !holders.has(n.id));
  if (!candidates.length) {
    const up = s.nodes.filter((n) => n.state === 'up').length;
    return `only ${up} healthy node${up === 1 ? '' : 's'} remain, so there is nowhere to place another copy. Fix: bring the failed node back or add a node.`;
  }
  const allFull = candidates.every((n) => nodeFill(s, usage, n.id) > 0.94);
  if (allFull) return 'surviving nodes are out of free capacity. Fix: free capacity or add a node.';
  return 'no node with free space satisfies the placement rules. Fix: add a node or free capacity.';
}

/** After a VM moves, hot data it reads is copied to its new node (and a remote copy dropped). */
function localize(s: ClusterState, rng: () => number, usage: Map<string, number>, dt: number) {
  if (!s.cfg.locality) return;
  const perVmPerMin = 3; // illustrative localization rate (items/minute for the sample)
  for (const vm of s.vms) {
    if (vm.movedAt === null || vm.state !== 'running') continue;
    const node = s.nodes[vm.node];
    if (!acceptsData(node)) continue;
    const pending = s.items.filter((it) => it.vm === vm.id && it.kind === 'rf' && it.hot && !it.members.some((m) => m.node === vm.node));
    if (!pending.length) {
      vm.movedAt = null;
      continue;
    }
    let quota = Math.max(1, Math.floor((perVmPerMin * dt) / 60 + rng()));
    for (const it of pending) {
      if (quota-- <= 0) break;
      const disk = pickDiskPublic(s, vm.node, it, usage);
      if (!disk) break;
      // Drop the copy that leaves the remaining set most spread out (never the last live one).
      const live = it.members.filter((m) => memberLive(s, m));
      if (live.length < it.target) continue;
      const dropIdx = it.members.findIndex((m) => memberLive(s, m) && m.node !== vm.node);
      const dropped = it.members[dropIdx];
      const remaining = it.members.filter((_, i) => i !== dropIdx);
      const dom = (id: number) => (s.domain === 'rack' ? s.nodes[id].rack : s.domain === 'block' ? s.nodes[id].block : id);
      if (remaining.some((m) => dom(m.node) === dom(vm.node))) continue; // would break domain separation
      it.members = [...remaining, { node: vm.node, disk: disk.id, role: 'replica' }];
      usage.set(disk.id, (usage.get(disk.id) || 0) + it.memberGB);
      usage.set(dropped.disk, (usage.get(dropped.disk) || 0) - it.memberGB);
      s.transfers.push({ from: dropped.node, to: vm.node, t: s.time, kind: 'localize' });
    }
  }
}

/** Disk balancing: move data from the fullest node toward the emptiest. */
function balance(s: ClusterState, rng: () => number, usage: Map<string, number>, dt: number) {
  const up = s.nodes.filter((n) => n.state === 'up');
  if (up.length < 2) return;
  const fills = up.map((n) => ({ n, f: nodeFill(s, usage, n.id) }));
  const mean = fills.reduce((a, b) => a + b.f, 0) / fills.length;
  fills.sort((a, b) => b.f - a.f);
  const hi = fills[0];
  const lo = fills[fills.length - 1];
  if (hi.f - lo.f < 0.06) return;
  const moves = Math.max(1, Math.round((dt / 60) * 4 + rng()));
  for (let k = 0; k < moves; k++) {
    const it = s.items.find(
      (x) => x.members.some((m) => m.node === hi.n.id) && !x.members.some((m) => m.node === lo.n.id) && x.members.every((m) => memberLive(s, m)),
    );
    if (!it) return;
    const idx = it.members.findIndex((m) => m.node === hi.n.id);
    const others = it.members.filter((_, i) => i !== idx);
    const dom = (id: number) => (s.domain === 'rack' ? s.nodes[id].rack : s.domain === 'block' ? s.nodes[id].block : id);
    if (others.some((m) => dom(m.node) === dom(lo.n.id))) return;
    // Keep the VM-local copy local: balancing moves remote copies first.
    if (it.kind === 'rf' && s.vms[it.vm]?.node === hi.n.id) return;
    const disk = pickDiskPublic(s, lo.n.id, it, usage);
    if (!disk) return;
    const old = it.members[idx];
    it.members[idx] = { ...old, node: lo.n.id, disk: disk.id };
    usage.set(old.disk, (usage.get(old.disk) || 0) - it.memberGB);
    usage.set(disk.id, (usage.get(disk.id) || 0) + it.memberGB);
    s.transfers.push({ from: hi.n.id, to: lo.n.id, t: s.time, kind: 'balance' });
    if (nodeFill(s, usage, hi.n.id) - mean < 0.02) return;
  }
}

/** Advance in fixed steps (deterministic regardless of frame rate). */
export function advance(state: ClusterState, seconds: number, step = 10): ClusterState {
  let s = state;
  const n = Math.max(0, Math.floor(seconds / step));
  for (let i = 0; i < n; i++) s = tick(s, step);
  return s;
}

export type TimedAction = { t: number; apply: (s: ClusterState) => ClusterState };

/** Replay a list of timed actions from an initial state up to time `until`. */
export function replay(initial: ClusterState, actions: TimedAction[], until: number, step = 10): ClusterState {
  let s = initial;
  const sorted = actions.slice().sort((a, b) => a.t - b.t);
  let i = 0;
  while (s.time + step <= until + 1e-9) {
    while (i < sorted.length && sorted[i].t <= s.time + 1e-9) s = sorted[i++].apply(s);
    s = tick(s, step);
  }
  while (i < sorted.length && sorted[i].t <= until + 1e-9) s = sorted[i++].apply(s);
  return s;
}

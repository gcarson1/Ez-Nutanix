// LCM rolling-upgrade orchestrator. Pure and deterministic: simulateLcm(cfg) builds the whole
// timeline (pre-checks, batches, one node at a time, VM moves, failures), and lcmStateAt(sim, t)
// derives what an admin would see at any instant. The UI only renders these results.
//
// Sources: docs/research/C-lcm-networking.md (LCM Guide 3.4, AHV Admin Guide 11.2, PE 7.6).
// Engine order: pre-checks -> batch by dependency -> per node (pre-update, update, post-update)
// -> next node only when Data Resiliency is back to Normal. Only one node is down at a time.
// Durations are illustrative inputs, not measurements.

export type CompId = 'foundation' | 'aos' | 'ahv' | 'bmc' | 'bios' | 'hba' | 'disks' | 'ncc';
export type Scope = 'cluster' | 'cvm' | 'host';
export type BatchId = 'foundation' | 'aos' | 'ahv' | 'fw' | 'ncc';

export interface CompDef {
  id: CompId;
  label: string;
  kind: 'software' | 'firmware';
  scope: Scope;
  batch: BatchId;
  /** Installed and available version labels. `placeholder` marks labels that are not real versions. */
  from: string;
  to: string;
  placeholder: boolean;
  /** Reboots into the Phoenix environment module on NX platforms (LCM 3.4 Redfish flow). */
  reboots?: number;
  tip: string;
}

export const COMPONENTS: CompDef[] = [
  { id: 'foundation', label: 'Foundation', kind: 'software', scope: 'cluster', batch: 'foundation', from: 'installed', to: 'newer', placeholder: true, tip: 'Imaging and cluster-expansion tooling. Updating it takes no node out of service.' },
  { id: 'aos', label: 'AOS', kind: 'software', scope: 'cvm', batch: 'aos', from: '7.5.2', to: '7.6', placeholder: false, tip: 'The storage and cluster software in every Controller VM (CVM). It rolls one CVM at a time; the host and its VMs stay put.' },
  { id: 'ahv', label: 'AHV', kind: 'software', scope: 'host', batch: 'ahv', from: '11.0.1', to: '11.2', placeholder: false, tip: 'The hypervisor. Since AOS 7.5 it is a separate LCM update. Each host is emptied of VMs, upgraded and rebooted in turn.' },
  { id: 'bmc', label: 'BMC firmware', kind: 'firmware', scope: 'host', batch: 'fw', from: 'installed', to: 'newer', placeholder: true, reboots: 2, tip: 'Baseboard management controller. On NX nodes LCM boots into the Phoenix environment to flash it (2 reboots).' },
  { id: 'bios', label: 'BIOS firmware', kind: 'firmware', scope: 'host', batch: 'fw', from: 'installed', to: 'newer', placeholder: true, reboots: 3, tip: 'Server BIOS (UEFI on some vendors). On NX nodes it takes 3 reboots: into the Phoenix environment, one intermediate, and back.' },
  { id: 'hba', label: 'HBA firmware', kind: 'firmware', scope: 'host', batch: 'fw', from: 'installed', to: 'newer', placeholder: true, tip: 'Storage controller that connects the drives. Selecting it also selects drive firmware.' },
  { id: 'disks', label: 'Drive firmware', kind: 'firmware', scope: 'host', batch: 'fw', from: 'installed', to: 'newer', placeholder: true, tip: 'Firmware on the data drives.' },
  { id: 'ncc', label: 'NCC', kind: 'software', scope: 'cluster', batch: 'ncc', from: 'installed', to: 'newer', placeholder: true, tip: 'Nutanix Cluster Check, the health-check framework. Updating it takes no node out of service.' },
];

export const COMP: Record<CompId, CompDef> = Object.fromEntries(COMPONENTS.map((c) => [c.id, c])) as Record<CompId, CompDef>;
export const ALL_COMPS: CompId[] = COMPONENTS.map((c) => c.id);

/** Dependencies LCM adds automatically while you choose updates. */
export const AUTO_ADD: { when: CompId; add: CompId; why: string }[] = [
  { when: 'hba', add: 'disks', why: 'LCM adds drive firmware automatically when HBA firmware is selected.' },
];

export interface Selection {
  selected: CompId[];
  added: { id: CompId; why: string }[];
  dropped: { id: CompId; why: string }[];
}

export const FW_SINGLE_NODE = 'LCM does not upgrade firmware on single-node clusters; it is done manually.';

/** Apply LCM's automatic dependencies and small-cluster limits to a user selection. */
export function resolveSelection(sel: CompId[], nodes: number): Selection {
  const set = new Set(sel.filter((s) => s in COMP));
  const added: Selection['added'] = [];
  for (const r of AUTO_ADD) {
    if (set.has(r.when) && !set.has(r.add)) {
      set.add(r.add);
      added.push({ id: r.add, why: r.why });
    }
  }
  const dropped: Selection['dropped'] = [];
  if (nodes === 1) {
    for (const id of [...set]) {
      if (COMP[id].kind === 'firmware') {
        set.delete(id);
        dropped.push({ id, why: FW_SINGLE_NODE });
      }
    }
  }
  return { selected: ALL_COMPS.filter((c) => set.has(c)), added, dropped };
}

export interface Batch {
  id: BatchId;
  label: string;
  scope: Scope;
  comps: CompId[];
  why: string;
}

const BATCH_ORDER: { id: BatchId; label: string; scope: Scope; why: string }[] = [
  { id: 'foundation', label: 'Foundation', scope: 'cluster', why: 'Tooling first, as in Nutanix’s recommended order.' },
  { id: 'aos', label: 'AOS', scope: 'cvm', why: 'AOS before the hypervisor: the recommended order is Foundation, AOS, then AHV.' },
  { id: 'ahv', label: 'AHV', scope: 'host', why: 'Hypervisor after AOS. Since AOS 7.5, AHV is its own LCM update.' },
  { id: 'fw', label: 'Firmware', scope: 'host', why: 'Firmware after software (do not update firmware first). Within a node LCM orders it by dependency, BMC before BIOS.' },
  { id: 'ncc', label: 'NCC', scope: 'cluster', why: 'NCC last, then run the health checks again.' },
];

/** Batches in the order this simulation runs them (Nutanix’s recommended order plus LCM’s dependency ordering). */
export function planBatches(selected: CompId[]): Batch[] {
  const out: Batch[] = [];
  for (const b of BATCH_ORDER) {
    const comps = ALL_COMPS.filter((c) => selected.includes(c) && COMP[c].batch === b.id);
    if (comps.length) out.push({ ...b, comps });
  }
  return out;
}

export interface LcmConfig {
  nodes: number;
  rf: 2 | 3;
  vms: number;
  /** VM memory demand as % of host memory available to VMs (scenario setting). */
  memLoadPct: number;
  selected: CompId[];
  /** Illustrative per-node minutes. */
  minutes: { aos: number; ahv: number; fw: number; resync: number };
  degraded: boolean;
  witness: boolean; // 2-node clusters
  vmsShutDown: boolean; // 1-node clusters
  fail: { at: number; node: number } | null; // seconds
  repairAt: number | null; // seconds
}

export const DEFAULT_MINUTES = { aos: 15, ahv: 25, fw: 45, resync: 3 };

export interface PreCheck {
  id: string;
  name: string;
  label: string;
  ok: boolean;
  detail: string;
  simulated?: boolean;
}

/** True when any selected update takes hosts into maintenance mode (VMs must move). */
function hasHostBatch(selected: CompId[]) {
  return selected.some((c) => COMP[c].scope === 'host');
}

export function preChecks(cfg: LcmConfig): PreCheck[] {
  const sel = resolveSelection(cfg.selected, cfg.nodes).selected;
  const n = cfg.nodes;
  const checks: PreCheck[] = [
    {
      id: 'resiliency',
      name: 'Data Resiliency (legacy check test_under_replication)',
      label: 'Data resiliency is OK',
      ok: !cfg.degraded,
      detail: cfg.degraded
        ? 'A drive failed and its data is still being re-protected, so resiliency is not OK. LCM will not start until it is.'
        : 'Every piece of data has its full set of copies, so one node can be taken out safely.',
    },
    {
      id: 'ncc',
      name: 'test_ncc_checks',
      label: 'No critical NCC health-check failures',
      ok: !cfg.degraded,
      detail: cfg.degraded ? 'NCC reports the failed drive as a critical issue.' : 'Critical Nutanix Cluster Check (NCC) health checks pass.',
    },
    {
      id: 'mm',
      name: 'test_hosts_in_maintenance_mode',
      label: 'No host is already in maintenance mode',
      ok: true,
      detail: 'Only one node may be out at a time, so none can already be in maintenance.',
    },
    {
      id: 'space',
      name: 'test_nutanix_partition_space (legacy name)',
      label: 'Enough free space on every CVM',
      ok: true,
      detail: 'The upgrade bundle is staged on each Controller VM, so each needs free space in /home/nutanix.',
    },
    {
      id: 'url',
      name: 'test_check_url_connectivity',
      label: 'Update source reachable',
      ok: true,
      detail: 'Connected sites reach the Nutanix download servers. Dark sites use a local web server, direct upload or the Dark Site Upgrade Orchestrator.',
    },
  ];
  if (hasHostBatch(sel) && n >= 2) {
    checks.push({
      id: 'pinned',
      name: 'test_ahv_entering_mm_pinned_vms',
      label: 'Non-migratable VMs handled',
      ok: true,
      detail: 'Pinned, RF1 and agent VMs cannot live-migrate. On AHV, LCM shuts them down and restarts them afterward. This scenario has none.',
    });
    const need = (cfg.memLoadPct * n) / (n - 1);
    checks.push({
      id: 'room',
      name: 'Room for one node’s VMs',
      label: 'Other hosts can absorb one node’s VMs',
      ok: need <= 100,
      simulated: true,
      detail:
        need <= 100
          ? `With one node out, VM memory demand on the others rises to about ${Math.round(need)}% of what they can hold.`
          : `With one node out, the other hosts would need about ${Math.round(need)}% of their memory for VMs, so VMs cannot be evacuated. Lower the VM load or add a node.`,
    });
  }
  if (n === 2) {
    checks.push({
      id: 'witness',
      name: 'Witness registered',
      label: 'A Witness VM is registered',
      ok: cfg.witness,
      detail: cfg.witness
        ? 'Two-node clusters need a registered Witness for any node-maintenance workflow, including LCM.'
        : 'No Witness is registered. On a two-node cluster LCM and every node-maintenance workflow require one.',
    });
  }
  if (n === 1) {
    checks.push({
      id: 'vmsoff',
      name: 'Guest VMs shut down',
      label: 'All guest VMs are shut down',
      ok: cfg.vmsShutDown,
      detail: cfg.vmsShutDown
        ? 'On a single-node cluster the only CVM and host go down, so storage is unavailable during the upgrade. You shut the VMs down first.'
        : 'On a single-node cluster you must shut all guest VMs down manually before an AOS or AHV upgrade.',
    });
  }
  return checks;
}

export function canStart(cfg: LcmConfig): { ok: boolean; reasons: string[] } {
  const sel = resolveSelection(cfg.selected, cfg.nodes).selected;
  const reasons: string[] = [];
  if (!sel.length) reasons.push('Select at least one update.');
  for (const c of preChecks(cfg)) if (!c.ok) reasons.push(c.detail);
  return { ok: reasons.length === 0, reasons };
}

// ── timeline ──

export type NodePhase =
  | 'evacuate' // VMs live-migrate off
  | 'enter-mm' // host then CVM enter maintenance mode, CVM shuts down (holds the shutdown token)
  | 'update' // packages or firmware applied, reboots
  | 'exit-mm' // CVM powers on, exits maintenance mode, host exits maintenance mode
  | 'return-vms' // VMs migrate back, token released
  | 'cvm-down' // AOS: CVM takes the token, I/O redirected to remote Stargates
  | 'cvm-reboot' // AOS: CVM reboots into the new partition
  | 'cvm-up' // AOS: services start, local I/O fails back
  | 'resync'; // wait for data resync / resiliency Normal

export interface Seg {
  node: number;
  batch: BatchId;
  phase: NodePhase;
  start: number;
  end: number;
  /** Node out of service (storage) during this phase. */
  out: boolean;
  label: string;
  /** Evacuation stopped before the node went out (another node failed). */
  aborted?: boolean;
}

export interface ClusterSeg {
  kind: 'precheck' | 'stage' | 'cluster-update' | 'wait';
  batch?: BatchId;
  start: number;
  end: number;
  label: string;
}

export interface Move {
  vm: number;
  from: number;
  to: number;
  t0: number;
  t1: number;
  kind: 'migrate' | 'restart';
}

export type EvKind = 'info' | 'ok' | 'warn' | 'bad' | 'flow';
export interface LcmEvent {
  t: number;
  kind: EvKind;
  text: string;
}

export interface LcmSim {
  cfg: LcmConfig;
  selection: Selection;
  batches: Batch[];
  checks: PreCheck[];
  blocked: boolean;
  blockReasons: string[];
  segs: Seg[];
  csegs: ClusterSeg[];
  moves: Move[];
  events: LcmEvent[];
  /** Intervals where some data may be unavailable. */
  unavailable: [number, number][];
  /** Node visits in order: batch, node, first start, last end (incl. resync). */
  visits: { batch: BatchId; node: number; start: number; outStart: number; end: number }[];
  /** Unhealthy window caused by an unplanned failure: [fail, healthy-again). healthy-again may be Infinity. */
  unhealthy: [number, number] | null;
  failNode: number | null;
  /** Effective repair time of the failed node (null = not repaired). */
  repairAt: number | null;
  /** Set when LCM stopped and is waiting forever (failure not repaired within the timeline). */
  pausedAt: number | null;
  doneAt: number | null;
  end: number;
  homes: number[];
}

const MIN = 60;
export const HA_RESTART_SEC = 3 * MIN; // illustrative VM restart time after an unplanned node failure
const PRECHECK_SEC = 3 * MIN;
const CLUSTER_UPDATE_SEC = 5 * MIN;
const STAGE_SEC = 8 * MIN;
const PAUSE_TAIL_SEC = 30 * MIN;

/** Fault tolerance in nodes: 1-node 0, 2-node 1, otherwise RF-1. */
export function nodeTolerance(nodes: number, rf: 2 | 3): number {
  if (nodes <= 1) return 0;
  if (nodes === 2) return 1;
  return rf === 3 && nodes >= 5 ? 2 : 1;
}

function resyncSec(cfg: LcmConfig): number {
  // Two-node clusters resync between single-node and two-node state, which takes longer (illustrative x3).
  return cfg.minutes.resync * MIN * (cfg.nodes === 2 ? 3 : 1);
}

export function simulateLcm(cfg: LcmConfig): LcmSim {
  const n = Math.max(1, Math.round(cfg.nodes));
  cfg = { ...cfg, nodes: n };
  const selection = resolveSelection(cfg.selected, n);
  const batches = planBatches(selection.selected);
  const checks = preChecks(cfg);
  const start = canStart(cfg);
  const homes = Array.from({ length: Math.max(0, cfg.vms) }, (_, i) => i % n);
  const sim: LcmSim = {
    cfg,
    selection,
    batches,
    checks,
    blocked: !start.ok,
    blockReasons: start.reasons,
    segs: [],
    csegs: [],
    moves: [],
    events: [],
    unavailable: [],
    visits: [],
    unhealthy: null,
    failNode: null,
    repairAt: null,
    pausedAt: null,
    doneAt: null,
    end: 0,
    homes,
  };
  const ev = (t: number, kind: EvKind, text: string) => sim.events.push({ t, kind, text });

  if (sim.blocked) {
    sim.csegs.push({ kind: 'precheck', start: 0, end: PRECHECK_SEC, label: 'Pre-checks' });
    ev(0, 'info', 'Pre-checks started.');
    ev(PRECHECK_SEC, 'bad', `Pre-checks failed: ${start.reasons[0] ?? ''} LCM did not start.`);
    sim.end = PRECHECK_SEC;
    return sim;
  }

  // Unplanned failure of another node (ignored on 1-node clusters or with a bad node id).
  const fail = cfg.fail && n >= 2 && cfg.fail.node >= 0 && cfg.fail.node < n && cfg.fail.at >= 0 ? cfg.fail : null;
  const repairAt = fail && cfg.repairAt !== null && cfg.repairAt > fail.at ? cfg.repairAt : null;
  const healthyAt = fail ? (repairAt !== null ? repairAt + resyncSec(cfg) : Infinity) : -1;
  if (fail) {
    sim.unhealthy = [fail.at, healthyAt];
    sim.failNode = fail.node;
    sim.repairAt = repairAt;
  }
  const inUnhealthy = (t: number) => !!fail && t >= fail.at && t < healthyAt;

  let t = 0;
  sim.csegs.push({ kind: 'precheck', start: 0, end: PRECHECK_SEC, label: 'Pre-checks' });
  ev(0, 'info', `Pre-checks started (${checks.length} checks).`);
  ev(PRECHECK_SEC, 'ok', `All ${checks.length} pre-checks passed. Updates batched in dependency order: ${batches.map((b) => b.label).join(' → ')}.`);
  t = PRECHECK_SEC;

  /** Before taking anything out of service, wait until resiliency is Normal. Returns false if it never is. */
  const waitHealthy = (label: string): boolean => {
    if (!inUnhealthy(t)) return true;
    if (healthyAt === Infinity) {
      sim.pausedAt = t;
      sim.csegs.push({ kind: 'wait', start: t, end: Infinity, label: 'Paused: waiting for data resiliency' });
      ev(t, 'warn', `LCM paused before ${label}: data resiliency is not Normal. It waits for the problem to be fixed and takes no other node down.`);
      return false;
    }
    sim.csegs.push({ kind: 'wait', start: t, end: healthyAt, label: 'Paused: waiting for data resiliency' });
    ev(t, 'warn', `LCM paused before ${label}: data resiliency is not Normal.`);
    ev(healthyAt, 'ok', `Data resiliency is Normal again. LCM resumes with ${label}.`);
    t = healthyAt;
    return true;
  };

  const tolerance = nodeTolerance(n, cfg.rf);
  let stopped = false;

  outer: for (const b of batches) {
    if (b.scope === 'cluster') {
      if (!waitHealthy(b.label)) {
        stopped = true;
        break;
      }
      sim.csegs.push({ kind: 'cluster-update', batch: b.id, start: t, end: t + CLUSTER_UPDATE_SEC, label: `${b.label} update (cluster-wide)` });
      ev(t, 'info', `${b.label}: updated cluster-wide. No node goes out of service.`);
      t += CLUSTER_UPDATE_SEC;
      continue;
    }
    if (b.id === 'aos') {
      sim.csegs.push({ kind: 'stage', batch: 'aos', start: t, end: t + STAGE_SEC, label: 'AOS: stage binaries on every CVM' });
      ev(t, 'info', 'AOS: binaries uploaded to two CVMs, then every CVM stages them on its passive partition in parallel.');
      t += STAGE_SEC;
    }
    for (let node = 0; node < n; node++) {
      const name = `N${node + 1}`;
      if (!waitHealthy(`${b.label} on ${name}`)) {
        stopped = true;
        break outer;
      }
      // A failed node that is still down can't be upgraded; that case is covered by waitHealthy.
      const visitStart = t;
      const phases: { phase: NodePhase; dur: number; out: boolean; label: string }[] = [];
      if (b.scope === 'cvm') {
        const M = cfg.minutes.aos * MIN;
        if (n === 1) {
          phases.push({ phase: 'cvm-down', dur: 0.1 * M, out: true, label: 'CVM stops. Storage is offline (guest VMs were shut down first).' });
        } else {
          phases.push({ phase: 'cvm-down', dur: 0.1 * M, out: true, label: 'CVM takes the upgrade token. The host’s iSCSI redirector sends its VMs’ I/O to Stargate on other CVMs.' });
        }
        phases.push({ phase: 'cvm-reboot', dur: 0.6 * M, out: true, label: 'CVM marks the new partition active and reboots into AOS ' + COMP.aos.to + '.' });
        phases.push({ phase: 'cvm-up', dur: 0.3 * M, out: true, label: n === 1 ? 'Services start. Storage is back.' : 'Services start and local I/O fails back to this CVM.' });
      } else {
        const M = (b.id === 'ahv' ? cfg.minutes.ahv : cfg.minutes.fw) * MIN;
        if (n === 1) {
          phases.push({ phase: 'enter-mm', dur: 0.1 * M, out: true, label: 'CVM shuts down. Storage is offline (guest VMs were shut down first).' });
          phases.push({ phase: 'update', dur: 0.7 * M, out: true, label: 'AHV packages upgraded, host reboots.' });
          phases.push({ phase: 'exit-mm', dur: 0.2 * M, out: true, label: 'Host and CVM back, services start.' });
        } else {
          phases.push({ phase: 'evacuate', dur: 0.15 * M, out: false, label: 'Host enters maintenance mode: VMs live-migrate to other hosts.' });
          phases.push({ phase: 'enter-mm', dur: 0.08 * M, out: true, label: 'Host in maintenance mode. CVM enters maintenance mode and shuts down, holding the shutdown token.' });
          if (b.id === 'ahv') {
            phases.push({ phase: 'update', dur: 0.52 * M, out: true, label: `AHV ${COMP.ahv.to} packages applied, host reboots.` });
          } else {
            const fws = b.comps;
            const each = (0.52 * M) / fws.length;
            for (const c of fws) {
              const d = COMP[c];
              const rb = d.reboots;
              phases.push({
                phase: 'update',
                dur: each,
                out: true,
                label: rb
                  ? `${d.label}: node boots into the Phoenix environment, flashes, and returns (${rb} reboots on NX).`
                  : `${d.label}: flashed from the Phoenix environment (reboot count depends on platform).`,
              });
            }
          }
          phases.push({ phase: 'exit-mm', dur: 0.1 * M, out: true, label: 'CVM powers on and exits maintenance mode, then the host exits maintenance mode.' });
          phases.push({ phase: 'return-vms', dur: 0.15 * M, out: false, label: 'VMs migrate back for data locality. Shutdown token released.' });
        }
      }
      if (n > 1) phases.push({ phase: 'resync', dur: resyncSec(cfg), out: false, label: n === 2 ? 'Back to two-node mode: data written meanwhile resyncs (slower on two nodes).' : 'Data written while the node was out resyncs. Waiting for data resiliency OK.' });

      // A failure before this node goes out of service: LCM stops short of taking it out,
      // the node keeps serving, and the visit restarts once resiliency is Normal again.
      let pre = 0;
      for (const p of phases) {
        if (p.out) break;
        pre += p.dur;
      }
      if (fail && fail.node !== node && fail.at >= t && fail.at < t + pre) {
        sim.segs.push({ node, batch: b.id, phase: 'evacuate', start: t, end: fail.at, out: false, aborted: true, label: `Stopped before maintenance mode: N${fail.node + 1} failed. ${name} stays in service.` });
        ev(t, 'flow', `${b.label} on ${name}: ${phases[0].label}`);
        ev(fail.at, 'warn', `LCM does not take ${name} out of service: another node failed.`);
        t = fail.at;
        node--;
        continue;
      }
      let outStart = -1;
      let outEnd = -1;
      for (const p of phases) {
        const s: Seg = { node, batch: b.id, phase: p.phase, start: t, end: t + p.dur, out: p.out, label: p.label };
        sim.segs.push(s);
        if (p.out && outStart < 0) outStart = t;
        if (p.out) outEnd = t + p.dur;
        t += p.dur;
      }
      sim.visits.push({ batch: b.id, node, start: visitStart, outStart, end: t });
      ev(visitStart, 'flow', `${b.label} on ${name}: ${phases[0].label}`);
      ev(outEnd, 'ok', `${name} back in service with ${b.label} updated.`);

      // Overlap with an unplanned failure: more nodes out than the cluster tolerates?
      if (fail && fail.node !== node) {
        const fEnd = repairAt ?? Infinity;
        const a = Math.max(outStart, fail.at);
        const z = Math.min(outEnd, fEnd);
        if (z > a && 2 > tolerance) {
          const until = n === 2 ? fEnd : z; // two-node: survivor’s copy was the only current one
          sim.unavailable.push([a, until]);
        }
      }
      if (n > 1) ev(t, 'ok', inUnhealthy(t) ? `${name} resynced, but data resiliency is still not Normal.` : `Data resiliency OK on ${name}.`);
    }
  }

  if (!stopped) {
    sim.doneAt = t;
    ev(t, 'ok', 'All selected updates complete.');
  }

  // Failure events and its own unavailability (two-node or one-node clusters with the other node out are handled above).
  if (fail) {
    const fname = `N${fail.node + 1}`;
    ev(fail.at, 'bad', `${fname} failed (unplanned). VMs on it are restarted by HA on other hosts.`);
    if (repairAt !== null) {
      ev(repairAt, 'info', `${fname} repaired and rejoins. Its data resyncs.`);
    }
    // A failure during a cluster-wide step or between nodes on a 2-node cluster with nothing out is tolerated.
  }

  const lastT = Math.max(t, fail ? fail.at : 0, repairAt ?? 0, healthyAt !== Infinity && healthyAt > 0 ? healthyAt : 0);
  sim.end = stopped ? Math.max(lastT, (sim.pausedAt ?? t) + PAUSE_TAIL_SEC) : lastT;
  if (stopped) sim.csegs.forEach((c) => c.end === Infinity && (c.end = sim.end));
  sim.unavailable = sim.unavailable.map(([x, y]) => [x, Math.min(y, sim.end)] as [number, number]);

  buildMoves(sim, fail, repairAt);
  sim.events.sort((a, b) => a.t - b.t);
  return sim;
}

/** Second pass: VM locations over time (live migrations for maintenance, HA restarts after a failure). */
function buildMoves(sim: LcmSim, fail: { at: number; node: number } | null, repairAt: number | null) {
  const n = sim.cfg.nodes;
  if (n < 2) return;
  const loc = [...sim.homes];
  type E = { t: number; kind: 'evac' | 'back' | 'fail'; node: number; end: number };
  const es: E[] = [];
  for (const s of sim.segs) {
    if (s.phase === 'evacuate' && !s.aborted) es.push({ t: s.start, kind: 'evac', node: s.node, end: s.end });
    if (s.phase === 'return-vms') es.push({ t: s.start, kind: 'back', node: s.node, end: s.end });
  }
  if (fail) es.push({ t: fail.at, kind: 'fail', node: fail.node, end: fail.at });
  es.sort((a, b) => a.t - b.t || (a.kind === 'fail' ? -1 : 1));
  const failedAt = (t: number) => (fail && t >= fail.at && (repairAt === null || t < repairAt) ? fail.node : -1);
  const outAt = (t: number) => sim.segs.filter((s) => s.out && s.start <= t && t < s.end).map((s) => s.node);

  for (const e of es) {
    if (e.kind === 'evac') {
      const f = failedAt(e.t);
      const vms = loc.map((l, i) => (l === e.node ? i : -1)).filter((i) => i >= 0);
      const targets = Array.from({ length: n }, (_, i) => i).filter((i) => i !== e.node && i !== f);
      if (!targets.length) continue;
      const d = (e.end - e.t) / Math.max(1, vms.length);
      vms.forEach((vm, k) => {
        const to = targets[(k + e.node) % targets.length];
        sim.moves.push({ vm, from: e.node, to, t0: e.t + k * d, t1: e.t + (k + 1) * d, kind: 'migrate' });
        loc[vm] = to;
      });
    } else if (e.kind === 'back') {
      const f = failedAt(e.t);
      const vms = loc.map((l, i) => (sim.homes[i] === e.node && l !== e.node && l !== f ? i : -1)).filter((i) => i >= 0);
      const d = (e.end - e.t) / Math.max(1, vms.length);
      vms.forEach((vm, k) => {
        sim.moves.push({ vm, from: loc[vm], to: e.node, t0: e.t + k * d, t1: e.t + (k + 1) * d, kind: 'migrate' });
        loc[vm] = e.node;
      });
    } else {
      // Unplanned failure: VMs on (or heading to) the failed node restart elsewhere.
      for (const m of sim.moves) {
        if (m.to === e.node && m.t0 < e.t && m.t1 > e.t) m.t1 = e.t; // in flight: lands, then restarts
        if (m.to === e.node && m.t0 >= e.t) {
          // not started yet: retarget to another live node
          const alt = Array.from({ length: n }, (_, i) => i).find((i) => i !== e.node && i !== m.from);
          if (alt !== undefined) m.to = alt;
        }
      }
      // recompute loc at e.t from the moves so far
      const at = [...sim.homes];
      for (const m of [...sim.moves].sort((a, b) => a.t0 - b.t0)) if (m.t0 <= e.t) at[m.vm] = m.to;
      const out = outAt(e.t);
      const live = Array.from({ length: n }, (_, i) => i).filter((i) => i !== e.node && !out.includes(i));
      // When no node is left to run them, VMs wait for the data to become available again.
      const unavailEnd = sim.unavailable.length ? Math.max(...sim.unavailable.map((u) => u[1])) : e.t;
      at.forEach((l, vm) => {
        if (l !== e.node) return;
        if (live.length) {
          const to = live[vm % live.length];
          sim.moves.push({ vm, from: e.node, to, t0: e.t, t1: e.t + HA_RESTART_SEC, kind: 'restart' });
          loc[vm] = to;
        } else {
          const other = Array.from({ length: n }, (_, i) => i).find((i) => i !== e.node) ?? 0;
          const t1 = (Number.isFinite(unavailEnd) ? unavailEnd : sim.end) + HA_RESTART_SEC;
          sim.moves.push({ vm, from: e.node, to: other, t0: e.t, t1: Math.min(t1, sim.end), kind: 'restart' });
          loc[vm] = other;
        }
      });
      // Later evacuations/returns read `loc`; keep it in step with the restarts.
    }
  }
  sim.moves.sort((a, b) => a.t0 - b.t0);
}

// ── derived state at a time ──

export type Resil = 'ok' | 'reduced' | 'resync' | 'unavailable' | 'degraded' | 'offline';

export interface NodeView {
  id: number;
  name: string;
  phase: NodePhase | 'idle';
  out: boolean;
  failed: boolean;
  batch: BatchId | null;
  label: string;
  /** Batches finished on this node (cluster-wide batches count for every node). */
  done: BatchId[];
}

export interface VmView {
  id: number;
  home: number;
  node: number;
  /** In flight between nodes (0..1) or restarting. */
  moving: { from: number; to: number; p: number; kind: 'migrate' | 'restart' } | null;
  state: 'running' | 'off' | 'restarting';
}

export interface LcmView {
  t: number;
  nodes: NodeView[];
  vms: VmView[];
  cluster: ClusterSeg | null;
  current: Seg | null;
  resiliency: { state: Resil; tolerable: number; text: string };
  paused: boolean;
  done: boolean;
  impact: { vmDownMin: number; unavailMin: number; migrations: number };
  events: LcmEvent[];
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

export function lcmStateAt(sim: LcmSim, tIn: number): LcmView {
  const t = Math.max(0, Math.min(sim.end, tIn));
  const { cfg } = sim;
  const n = cfg.nodes;
  const fail = sim.failNode;
  const failedNow = fail !== null && sim.unhealthy !== null && t >= sim.unhealthy[0] && (sim.repairAt === null || t < sim.repairAt);
  const cur = sim.segs.find((s) => s.start <= t && t < s.end) ?? null;
  const cseg = sim.csegs.find((c) => c.start <= t && t < c.end) ?? null;

  const nodes: NodeView[] = Array.from({ length: n }, (_, i) => {
    const done: BatchId[] = [];
    for (const b of sim.batches) {
      if (b.scope === 'cluster') {
        const c = sim.csegs.find((x) => x.kind === 'cluster-update' && x.batch === b.id);
        if (c && t >= c.end) done.push(b.id);
      } else {
        const outSegs = sim.segs.filter((s) => s.node === i && s.batch === b.id && s.out);
        const last = outSegs[outSegs.length - 1];
        if (last && t >= last.end) done.push(b.id);
      }
    }
    const s = cur && cur.node === i ? cur : null;
    return {
      id: i,
      name: `N${i + 1}`,
      phase: s ? s.phase : 'idle',
      out: !!s?.out,
      failed: failedNow && fail === i,
      batch: s ? s.batch : null,
      label: s ? s.label : '',
      done,
    };
  });

  // VMs
  const oneNode = n === 1;
  const lcmRunning = !sim.blocked && t >= sim.csegs[0].end && (sim.doneAt === null || t < sim.doneAt);
  const vms: VmView[] = sim.homes.map((home, id) => {
    let node = home;
    let moving: VmView['moving'] = null;
    for (const m of sim.moves) {
      if (m.vm !== id || m.t0 > t) continue;
      if (t < m.t1) {
        moving = { from: m.from, to: m.to, p: (t - m.t0) / Math.max(1e-9, m.t1 - m.t0), kind: m.kind };
        node = m.to;
      } else {
        node = m.to;
        moving = null;
      }
    }
    const state: VmView['state'] = oneNode && lcmRunning ? 'off' : moving?.kind === 'restart' ? 'restarting' : 'running';
    return { id, home, node, moving, state };
  });

  // Resiliency
  const tol = nodeTolerance(n, cfg.rf);
  const outCount = nodes.filter((x) => x.out).length + (failedNow ? 1 : 0);
  const resyncing = !!cur && cur.phase === 'resync';
  const failResync = sim.unhealthy !== null && sim.repairAt !== null && t >= sim.repairAt && t < sim.unhealthy[1];
  const unavailableNow = sim.unavailable.some(([a, b]) => t >= a && t < b);
  let resiliency: LcmView['resiliency'];
  if (sim.blocked) {
    resiliency = cfg.degraded
      ? { state: 'degraded', tolerable: 0, text: 'Not OK: a drive failed and its data is still being re-protected.' }
      : { state: 'ok', tolerable: tol, text: 'OK. The upgrade is blocked for another reason.' };
  } else if (oneNode && outCount > 0) {
    resiliency = { state: 'offline', tolerable: 0, text: 'Planned outage: the only node is down for the upgrade, storage is offline and VMs are shut down.' };
  } else if (unavailableNow || outCount > tol) {
    resiliency = {
      state: 'unavailable',
      tolerable: 0,
      text: n === 2 ? 'Both nodes are out of service. The cluster cannot serve data until a node returns.' : `${outCount} nodes are out, more than ${n >= 5 && cfg.rf === 3 ? 'RF3' : 'RF2'} tolerates. Some data may be unavailable until a node returns.`,
    };
  } else if (outCount > 0) {
    const left = tol - outCount;
    const who = [...nodes.filter((x) => x.out).map((x) => `${x.name} (upgrade)`), ...(failedNow && fail !== null ? [`N${fail + 1} (failed)`] : [])].join(' and ');
    resiliency = {
      state: 'reduced',
      tolerable: left,
      text: `${who} out of service. The cluster can tolerate ${left} more node failure${left === 1 ? '' : 's'} right now.`,
    };
  } else if (resyncing || failResync) {
    resiliency = { state: 'resync', tolerable: 0, text: 'Resyncing data written while a node was out. Resiliency returns to OK when it finishes.' };
  } else {
    resiliency = { state: 'ok', tolerable: tol, text: oneNode ? 'OK. A single node has no node-level redundancy.' : `OK. The cluster can tolerate ${tol} node failure${tol === 1 ? '' : 's'}.` };
  }

  // Impact (cumulative to t)
  let vmDownSec = 0;
  if (oneNode && !sim.blocked) {
    const a = sim.csegs[0].end;
    const z = sim.doneAt ?? sim.end;
    vmDownSec += Math.max(0, Math.min(t, z) - a) * sim.homes.length;
  }
  let migrations = 0;
  for (const m of sim.moves) {
    if (m.kind === 'restart') vmDownSec += overlap(m.t0, m.t1, 0, t);
    else if (m.t1 <= t) migrations++;
  }
  let unavailSec = 0;
  for (const [a, b] of sim.unavailable) unavailSec += overlap(a, b, 0, t);

  const paused = sim.csegs.some((c) => c.kind === 'wait' && c.start <= t && (t < c.end || c.end >= sim.end));
  return {
    t,
    nodes,
    vms,
    cluster: cur ? null : cseg,
    current: cur,
    resiliency,
    paused,
    done: sim.doneAt !== null && t >= sim.doneAt,
    impact: { vmDownMin: vmDownSec / 60, unavailMin: unavailSec / 60, migrations },
    events: sim.events.filter((e) => e.t <= t),
  };
}

/** Number of nodes LCM has out of service at time t (planned only). */
export function lcmOutCount(sim: LcmSim, t: number): number {
  return new Set(sim.segs.filter((s) => s.out && s.start <= t && t < s.end).map((s) => s.node)).size;
}

/** Times worth sampling for invariant checks: every segment boundary and midpoint. */
export function sampleTimes(sim: LcmSim): number[] {
  const ts = new Set<number>();
  for (const s of sim.segs) {
    ts.add(s.start);
    ts.add((s.start + s.end) / 2);
    ts.add(Math.max(0, s.end - 1e-6));
  }
  for (const c of sim.csegs) ts.add(c.start);
  return [...ts].sort((a, b) => a - b);
}

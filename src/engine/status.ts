// Admin-facing status derived from engine state, in the terms Prism uses:
// cluster health, data resiliency (failures tolerable now), rebuild capacity available,
// and per-item state (healthy / under-replicated / unavailable).
import type { ClusterState, DataItem, SimNode } from './cluster';
import { rawGB } from './cluster';
import { domainKey, memberLive, storageLive, diskUsageMap, MAX_FILL } from './placement';
import { METADATA_COPIES, MIN_NODES, type Domain } from './rules';

export type ItemState = 'healthy' | 'under' | 'unavailable';
export type Health = 'OK' | 'Warning' | 'Critical';

export interface ComponentTolerance {
  name: string;
  tolerable: number; // -1 = already lost
  note?: string;
}

export interface ClusterStatus {
  health: Health;
  resiliency: 'OK' | 'Critical' | 'Data unavailable' | 'Cluster down';
  tolerable: number; // failures of the effective domain the cluster can absorb right now
  domain: Domain;
  components: ComponentTolerance[];
  rebuildCapacity: boolean;
  rebuildCapacityReason?: string;
  items: { healthy: number; under: number; unavailable: number; total: number };
  capacity: { rawTB: number; usedTB: number; liveRawTB: number; freeTB: number; usedPct: number };
  selfHeal: { state: 'idle' | 'waiting' | 'rebuilding' | 'blocked' | 'complete'; reason?: string; progress: number; remainingGB: number };
  liveNodes: number;
  zk: { total: number; alive: number; quorum: boolean };
  cvmsUp: number;
}

export function itemLiveCount(state: ClusterState, it: DataItem): number {
  let n = 0;
  for (const m of it.members) if (memberLive(state, m)) n++;
  return n;
}

export function itemState(state: ClusterState, it: DataItem): ItemState {
  const live = itemLiveCount(state, it);
  if (live < it.need) return 'unavailable';
  if (live < it.target) return 'under';
  return 'healthy';
}

/**
 * Worst-case number of whole-domain failures an item survives right now: remove the
 * domains holding the most live members first until it can no longer be read.
 */
export function itemTolerance(state: ClusterState, it: DataItem, domain: Domain): number {
  const counts = new Map<number, number>();
  let live = 0;
  for (const m of it.members) {
    if (!memberLive(state, m)) continue;
    live++;
    const k = domainKey(state.nodes[m.node], domain);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  if (live < it.need) return -1;
  const sorted = [...counts.values()].sort((a, b) => b - a);
  let tol = 0;
  for (const c of sorted) {
    if (live - c >= it.need) {
      live -= c;
      tol++;
    } else break;
  }
  return tol;
}

function nodeAlive(n: SimNode) {
  return storageLive(n);
}

export function deriveStatus(state: ClusterState): ClusterStatus {
  const { cfg } = state;
  const present = state.nodes.filter((n) => n.state !== 'removed');
  const alive = present.filter(nodeAlive);
  const downUndetached = present.filter((n) => !nodeAlive(n) && !n.detached).length;

  // Zookeeper quorum
  const zkNodes = present.filter((n) => n.zk);
  const zkAlive = zkNodes.filter(nodeAlive).length;
  const zkQuorumNeeded = Math.floor(zkNodes.length / 2) + 1;
  const zkQuorum = zkAlive >= zkQuorumNeeded;
  const zkTol = zkAlive - zkQuorumNeeded;

  // Metadata ring: copies follow the cluster redundancy factor.
  const copies = METADATA_COPIES[cfg.ft];
  // Quorum-based: c copies tolerate floor((c-1)/2) losses. Down nodes still in the ring
  // count against that until they are detached and the ring re-replicates.
  const nominal = cfg.ft - 1;
  const effCopies = Math.min(copies, alive.length);
  const metaTol = Math.min(nominal - downUndetached, Math.floor((effCopies - 1) / 2));

  // Data items
  let healthy = 0;
  let under = 0;
  let unavailable = 0;
  let dataTol = Infinity;
  for (const it of state.items) {
    const s = itemState(state, it);
    if (s === 'healthy') healthy++;
    else if (s === 'under') under++;
    else unavailable++;
    dataTol = Math.min(dataTol, itemTolerance(state, it, state.domain));
  }
  if (!state.items.length) dataTol = nominal;

  const components: ComponentTolerance[] = [
    { name: 'Data (extent groups)', tolerable: Math.max(-1, dataTol === Infinity ? nominal : dataTol) },
    { name: 'Metadata', tolerable: Math.max(-1, metaTol) },
    { name: 'Zookeeper (config)', tolerable: zkQuorum ? Math.max(0, zkTol) : -1 },
  ];
  const tolerable = Math.max(0, Math.min(...components.map((c) => c.tolerable)));

  // Capacity
  const usage = diskUsageMap(state);
  let usedGB = 0;
  let liveCapGB = 0;
  let liveUsedGB = 0;
  for (const d of state.disks) {
    const node = state.nodes[d.node];
    if (node.state === 'removed') continue;
    const u = usage.get(d.id) || 0;
    usedGB += u;
    if (d.state === 'ok' && node.state === 'up') {
      liveCapGB += d.capGB;
      liveUsedGB += u;
    }
  }
  const raw = present.length * cfg.drivesPerNode * cfg.driveTB * 1000 || rawGB(cfg);

  // Rebuild capacity: after losing the largest domain, can survivors hold everything?
  const rc = rebuildCapacity(state, usage);

  // Self-heal state
  const remainingGB = state.items.reduce((s, it) => {
    const live = itemLiveCount(state, it);
    return s + Math.max(0, it.target - live) * it.memberGB * (it.kind === 'ec' ? it.need : 1);
  }, 0);
  let selfHeal: ClusterStatus['selfHeal'];
  if (under === 0 && unavailable === 0) {
    selfHeal = { state: state.rebuild.startedAt !== null ? 'complete' : 'idle', progress: 1, remainingGB: 0 };
  } else if (state.rebuild.blocked) {
    selfHeal = { state: 'blocked', reason: state.rebuild.blocked, progress: progressOf(state, remainingGB), remainingGB };
  } else if (state.rebuild.startedAt === null) {
    selfHeal = { state: 'waiting', progress: 0, remainingGB };
  } else {
    selfHeal = { state: 'rebuilding', progress: progressOf(state, remainingGB), remainingGB };
  }

  let resiliency: ClusterStatus['resiliency'] = 'OK';
  if (!zkQuorum) resiliency = 'Cluster down';
  else if (unavailable > 0) resiliency = 'Data unavailable';
  else if (tolerable < nominal || under > 0 || downUndetached > 0) resiliency = 'Critical';

  let health: Health = 'OK';
  if (resiliency !== 'OK') health = 'Critical';
  else if (!rc.ok || present.some((n) => n.state !== 'up')) health = 'Warning';

  return {
    health,
    resiliency,
    tolerable: resiliency === 'Cluster down' || resiliency === 'Data unavailable' ? 0 : tolerable,
    domain: state.domain,
    components,
    rebuildCapacity: rc.ok,
    rebuildCapacityReason: rc.reason,
    items: { healthy, under, unavailable, total: state.items.length },
    capacity: {
      rawTB: raw / 1000,
      usedTB: usedGB / 1000,
      liveRawTB: liveCapGB / 1000,
      freeTB: Math.max(0, liveCapGB - liveUsedGB) / 1000,
      usedPct: liveCapGB ? (liveUsedGB / liveCapGB) * 100 : 100,
    },
    selfHeal,
    liveNodes: alive.length,
    zk: { total: zkNodes.length, alive: zkAlive, quorum: zkQuorum },
    cvmsUp: alive.length,
  };
}

function progressOf(state: ClusterState, remainingGB: number) {
  const done = state.rebuild.doneGB;
  return done + remainingGB > 0 ? done / (done + remainingGB) : 0;
}

/**
 * Whether the cluster could fully re-protect after losing its largest failure domain.
 * Needs enough remaining domains for every item and enough free space on survivors.
 */
export function rebuildCapacity(state: ClusterState, usage = diskUsageMap(state)): { ok: boolean; reason?: string } {
  const { cfg } = state;
  const up = state.nodes.filter((n) => n.state === 'up');
  const domains = new Map<number, { cap: number; used: number }>();
  for (const d of state.disks) {
    const n = state.nodes[d.node];
    if (n.state !== 'up' || d.state !== 'ok') continue;
    const k = domainKey(n, state.domain);
    const e = domains.get(k) || { cap: 0, used: 0 };
    e.cap += d.capGB;
    e.used += usage.get(d.id) || 0;
    domains.set(k, e);
  }
  const maxTarget = state.items.reduce<number>((m, it) => Math.max(m, it.target), cfg.rf);
  const minNodes = MIN_NODES[cfg.ft];
  if (up.length - 1 < Math.min(minNodes, 2) || domains.size - 1 < cfg.rf) {
    return {
      ok: false,
      reason: `After losing one ${state.domain}, fewer than ${cfg.rf} ${state.domain}s would remain to hold ${cfg.rf} copies.`,
    };
  }
  let totalCap = 0;
  let totalUsed = 0;
  let largest = { cap: 0, used: 0 };
  for (const e of domains.values()) {
    totalCap += e.cap;
    totalUsed += e.used;
    if (e.cap > largest.cap) largest = e;
  }
  const survivorsCap = (totalCap - largest.cap) * MAX_FILL;
  if (totalUsed > survivorsCap) {
    return {
      ok: false,
      reason: `Survivors would need ${(totalUsed / 1000).toFixed(1)} TB but hold only ${(survivorsCap / 1000).toFixed(1)} TB usable after losing the largest ${state.domain}.`,
    };
  }
  if (maxTarget > domains.size - 1 && state.items.some((i) => i.kind === 'ec')) {
    return { ok: true, reason: 'EC-X strips would be rebuilt with a narrower layout after a failure.' };
  }
  return { ok: true };
}

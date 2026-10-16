// NKP fleet: a Kubernetes version upgrade rolled across clusters at the edge, in the data
// center and in the cloud. Pure and deterministic: build a plan once, then ask for the state at
// any sim time (so play, scrub and loop are all just "state at t").
//
// Modeled (in the spirit of Cluster API rolling updates):
// - The rollout goes in waves: one small canary cluster first, then the other edge sites, then
//   the data center, then the cloud. Clusters in the same wave upgrade side by side, and a
//   health check after each cluster gates the next wave.
// - Inside a cluster, nodes are replaced one at a time: a new node at the target version joins
//   and is checked, then one old node is drained (pods move) and removed. Control-plane nodes go
//   first, then workers.
// - If the canary's first new node fails its health check, the rollout stops there: the failed
//   node is removed, the old nodes never left, so the canary is back where it started and no
//   other cluster is touched.

export type Site = 'edge' | 'dc' | 'cloud';
export type Infra = 'ahv' | 'vsphere' | 'aws';

export interface FleetCluster {
  id: string;
  name: string;
  site: Site;
  infra: Infra;
  /** Control-plane nodes. */
  cp: number;
  workers: number;
}

export const FLEET: FleetCluster[] = [
  { id: 'e1', name: 'store-01', site: 'edge', infra: 'ahv', cp: 1, workers: 2 },
  { id: 'e2', name: 'store-02', site: 'edge', infra: 'ahv', cp: 1, workers: 2 },
  { id: 'e3', name: 'store-03', site: 'edge', infra: 'ahv', cp: 1, workers: 2 },
  { id: 'd1', name: 'dc-prod', site: 'dc', infra: 'ahv', cp: 3, workers: 4 },
  { id: 'd2', name: 'dc-vsphere', site: 'dc', infra: 'vsphere', cp: 3, workers: 3 },
  { id: 'c1', name: 'aws-prod', site: 'cloud', infra: 'aws', cp: 3, workers: 3 },
];

/** Sim seconds. Illustrative; real times depend on node size, workloads and pod disruption rules. */
export const TIMING = { node: 360, check: 240 } as const;
/** Share of a node's slot spent on each step: the new node joins, then the old one drains, then leaves. */
const JOIN = 0.4;
const DRAIN = 0.8;

export interface ClusterPlan {
  id: string;
  /** Rollout wave (0 = canary). */
  wave: number;
  start: number;
  /** Last node replaced. Infinity when the cluster is never started. */
  nodesEnd: number;
  /** Health check finished. */
  end: number;
  nodes: number;
  /** The first new node fails its health check and the cluster is rolled back. */
  fails: boolean;
}

export interface Plan {
  clusters: ClusterPlan[];
  /** Start time of each wave (the last entry is when the rollout finishes or stops). */
  waves: number[];
  /** Time the rollout finishes, or the failed canary is fully rolled back. */
  end: number;
  /** Time the rollout stopped (the canary's new node failed its check), when it did. */
  haltAt: number | null;
}

/** Rollout order: a canary edge site first, then the other edge sites, the data center, the cloud. */
export function waveGroups(fleet: FleetCluster[] = FLEET): FleetCluster[][] {
  const order: Site[] = ['edge', 'dc', 'cloud'];
  const sorted = fleet.slice().sort((a, b) => order.indexOf(a.site) - order.indexOf(b.site));
  const [canary, ...rest] = sorted;
  const groups: FleetCluster[][] = canary ? [[canary]] : [];
  for (const s of order) {
    const g = rest.filter((c) => c.site === s);
    if (g.length) groups.push(g);
  }
  return groups;
}

export function planRollout({ canaryFails, fleet = FLEET }: { canaryFails: boolean; fleet?: FleetCluster[] }): Plan {
  const plans = new Map<string, ClusterPlan>();
  const waves: number[] = [];
  let t = 0;
  let haltAt: number | null = null;
  waveGroups(fleet).forEach((g, w) => {
    const halted = haltAt !== null;
    if (!halted) waves.push(t);
    let waveEnd = t;
    for (const c of g) {
      const nodes = c.cp + c.workers;
      if (halted) {
        plans.set(c.id, { id: c.id, wave: w, start: Infinity, nodesEnd: Infinity, end: Infinity, nodes, fails: false });
        continue;
      }
      const fails = canaryFails && w === 0;
      // A failing canary spends one node slot: the new node joins, fails its check and is removed.
      const nodesEnd = t + (fails ? 1 : nodes) * TIMING.node;
      const end = fails ? nodesEnd : nodesEnd + TIMING.check;
      plans.set(c.id, { id: c.id, wave: w, start: t, nodesEnd, end, nodes, fails });
      if (fails) haltAt = t + JOIN * TIMING.node;
      waveEnd = Math.max(waveEnd, end);
    }
    t = waveEnd;
  });
  waves.push(t);
  return { clusters: fleet.map((c) => plans.get(c.id)!), waves, end: t, haltAt };
}

export type ClusterStatus = 'waiting' | 'upgrading' | 'checking' | 'done' | 'failed' | 'rolledBack' | 'halted';
/** join: a new node joins · drain: an old node drains · remove: it leaves · fail: the new node failed its check · back: the failed node is removed. */
export type NodePhase = 'join' | 'drain' | 'remove' | 'fail' | 'back';

export interface ClusterState {
  id: string;
  status: ClusterStatus;
  /** Nodes already running the new version (replacements complete). */
  replaced: number;
  /** Node being replaced right now, with 0..1 progress through its current phase. */
  current?: { index: number; role: 'cp' | 'worker'; phase: NodePhase; p: number };
  /** Nodes in the cluster right now (one extra while a new node has joined and the old one has not left). */
  liveNodes: number;
  /** Nodes out of service right now (draining or leaving). */
  unavailable: number;
}

const span = (t: number, a: number, b: number) => Math.max(0, Math.min(1, (t - a) / (b - a)));

export function clusterState(c: FleetCluster, p: ClusterPlan, t: number, plan: Plan): ClusterState {
  const base = { id: c.id, replaced: 0, liveNodes: p.nodes, unavailable: 0 };
  if (!Number.isFinite(p.start)) return { ...base, status: plan.haltAt !== null && t >= plan.haltAt ? 'halted' : 'waiting' };
  if (t < p.start) return { ...base, status: 'waiting' };
  const role = (i: number) => (i < c.cp ? ('cp' as const) : ('worker' as const));
  const N = TIMING.node;
  if (p.fails) {
    if (t >= p.end) return { ...base, status: 'rolledBack' };
    const el = t - p.start;
    const [phase, p0, p1]: [NodePhase, number, number] = el < JOIN * N ? ['join', 0, JOIN] : el < DRAIN * N ? ['fail', JOIN, DRAIN] : ['back', DRAIN, 1];
    return { ...base, status: phase === 'join' ? 'upgrading' : 'failed', current: { index: 0, role: role(0), phase, p: span(el, p0 * N, p1 * N) }, liveNodes: p.nodes + 1 };
  }
  if (t >= p.nodesEnd) return { ...base, replaced: p.nodes, status: t < p.end ? 'checking' : 'done' };
  const el = t - p.start;
  const index = Math.floor(el / N);
  const f = el / N - index;
  const [phase, p0, p1]: [NodePhase, number, number] = f < JOIN ? ['join', 0, JOIN] : f < DRAIN ? ['drain', JOIN, DRAIN] : ['remove', DRAIN, 1];
  return {
    ...base,
    status: 'upgrading',
    replaced: index,
    current: { index, role: role(index), phase, p: span(f, p0, p1) },
    // Surge of one: the new node joins first, then the old one drains and leaves.
    liveNodes: p.nodes + 1,
    unavailable: phase === 'join' ? 0 : 1,
  };
}

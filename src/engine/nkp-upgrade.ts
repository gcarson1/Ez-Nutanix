// NKP fleet: a Kubernetes version upgrade rolled across clusters in the data center, at the
// edge and in the cloud. Pure and deterministic: build a plan once, then ask for the state at
// any sim time (so play, step, scrub and reset are all just "state at t").
//
// Modeled (in the spirit of Cluster API rolling updates):
// - Inside a cluster, nodes are replaced one at a time: a new node at the target version joins,
//   one old node is drained (pods move) and removed. Control-plane nodes go first, then workers.
// - After each cluster, a health check gates the next step. If the canary fails its check,
//   the rollout stops and later clusters are never touched.
// - Clusters only join the rollout if the edition covers their infrastructure.
// - Attached clusters (a cloud provider's managed Kubernetes) keep their provider's upgrade
//   process, so the rollout never changes their version.

export type Site = 'dc' | 'edge' | 'cloud';
export type Infra = 'nci' | 'vsphere' | 'aws' | 'eks';
export type Edition = 'starter' | 'pro' | 'ultimate';
export type Strategy = 'serial' | 'waves';

export interface FleetCluster {
  id: string;
  name: string;
  site: Site;
  infra: Infra;
  /** Control-plane nodes (0 for an attached cluster whose control plane the provider runs). */
  cp: number;
  workers: number;
  attached?: boolean;
}

export const FLEET: FleetCluster[] = [
  { id: 'e1', name: 'store-01', site: 'edge', infra: 'nci', cp: 1, workers: 2 },
  { id: 'e2', name: 'store-02', site: 'edge', infra: 'nci', cp: 1, workers: 2 },
  { id: 'e3', name: 'store-03', site: 'edge', infra: 'nci', cp: 1, workers: 2 },
  { id: 'd1', name: 'dc-prod', site: 'dc', infra: 'nci', cp: 3, workers: 6 },
  { id: 'd2', name: 'dc-vsphere', site: 'dc', infra: 'vsphere', cp: 3, workers: 4 },
  { id: 'c1', name: 'aws-nkp', site: 'cloud', infra: 'aws', cp: 3, workers: 3 },
  { id: 'c2', name: 'eks-attached', site: 'cloud', infra: 'eks', cp: 0, workers: 3, attached: true },
];

/** Lowest edition whose deployment targets include this infrastructure (research note 3b). */
export function editionNeeded(c: FleetCluster): Edition {
  if (c.attached) return 'ultimate'; // attaching EKS/AKS is part of fleet management
  if (c.infra === 'nci') return 'starter';
  return 'pro';
}

const RANK: Record<Edition, number> = { starter: 0, pro: 1, ultimate: 2 };
export function covered(c: FleetCluster, e: Edition): boolean {
  return RANK[e] >= RANK[editionNeeded(c)];
}

/** Sim seconds. Illustrative; real times depend on node size, workloads and pod disruption rules. */
export const TIMING = { node: 360, check: 240 } as const;

export interface ClusterPlan {
  id: string;
  /** Rollout wave index (0 = canary). -1 = not in the rollout. */
  wave: number;
  /** Why it is not in the rollout, when wave is -1. */
  skip?: 'edition' | 'attached';
  start: number;
  /** Last node replaced. */
  nodesEnd: number;
  /** Health check finished. */
  end: number;
  nodes: number;
  fails: boolean;
}

export interface Plan {
  clusters: ClusterPlan[];
  /** Time the rollout finishes or halts. */
  end: number;
  halted: boolean;
}

export interface PlanInput {
  edition: Edition;
  strategy: Strategy;
  canaryFails: boolean;
  fleet?: FleetCluster[];
}

/** Rollout order: a canary edge site first, then the other edge sites, the data center, the cloud. */
function waveGroups(list: FleetCluster[], strategy: Strategy): FleetCluster[][] {
  const order = (s: Site) => (s === 'edge' ? 0 : s === 'dc' ? 1 : 2);
  const sorted = list.slice().sort((a, b) => order(a.site) - order(b.site));
  if (strategy === 'serial') return sorted.map((c) => [c]);
  const [canary, ...rest] = sorted;
  const groups: FleetCluster[][] = canary ? [[canary]] : [];
  for (const s of ['edge', 'dc', 'cloud'] as Site[]) {
    const g = rest.filter((c) => c.site === s);
    if (g.length) groups.push(g);
  }
  return groups;
}

export function planRollout({ edition, strategy, canaryFails, fleet = FLEET }: PlanInput): Plan {
  const inRollout = fleet.filter((c) => covered(c, edition) && !c.attached);
  const groups = waveGroups(inRollout, strategy);
  const plans = new Map<string, ClusterPlan>();
  let t = 0;
  let halted = false;
  groups.forEach((g, w) => {
    if (halted) {
      for (const c of g) plans.set(c.id, { id: c.id, wave: w, start: Infinity, nodesEnd: Infinity, end: Infinity, nodes: c.cp + c.workers, fails: false });
      return;
    }
    let waveEnd = t;
    for (const c of g) {
      const nodes = c.cp + c.workers;
      const nodesEnd = t + nodes * TIMING.node;
      const end = nodesEnd + TIMING.check;
      const fails = canaryFails && w === 0;
      plans.set(c.id, { id: c.id, wave: w, start: t, nodesEnd, end, nodes, fails });
      waveEnd = Math.max(waveEnd, end);
    }
    t = waveEnd;
    if (canaryFails && w === 0) halted = true;
  });
  const clusters = fleet.map(
    (c) =>
      plans.get(c.id) ?? {
        id: c.id,
        wave: -1,
        skip: c.attached && covered(c, edition) ? ('attached' as const) : ('edition' as const),
        start: Infinity,
        nodesEnd: Infinity,
        end: Infinity,
        nodes: c.cp + c.workers,
        fails: false,
      },
  );
  return { clusters, end: t, halted };
}

export type ClusterStatus = 'waiting' | 'upgrading' | 'checking' | 'done' | 'failed' | 'halted' | 'skipped';
export type NodePhase = 'join' | 'drain' | 'remove';

export interface ClusterState {
  id: string;
  status: ClusterStatus;
  /** Nodes already running the new version (replacements complete). */
  replaced: number;
  /** Node being replaced right now. */
  current?: { index: number; role: 'cp' | 'worker'; phase: NodePhase };
  /** Nodes in the cluster right now (one extra while a replacement has joined but the old one is not yet removed). */
  liveNodes: number;
  /** Nodes unavailable for scheduling right now (cordoned/draining). */
  unavailable: number;
}

export function clusterState(c: FleetCluster, p: ClusterPlan, t: number, plan: Plan): ClusterState {
  const base = { id: c.id, replaced: 0, liveNodes: p.nodes, unavailable: 0 };
  if (p.wave < 0) return { ...base, status: 'skipped' };
  if (!Number.isFinite(p.start)) return { ...base, status: plan.halted && t >= plan.end ? 'halted' : 'waiting' };
  if (t < p.start) return { ...base, status: 'waiting' };
  if (t >= p.nodesEnd) {
    const status: ClusterStatus = t < p.end ? 'checking' : p.fails ? 'failed' : 'done';
    return { ...base, replaced: p.nodes, status };
  }
  const el = t - p.start;
  const index = Math.floor(el / TIMING.node);
  const f = (el - index * TIMING.node) / TIMING.node;
  const phase: NodePhase = f < 0.4 ? 'join' : f < 0.8 ? 'drain' : 'remove';
  return {
    ...base,
    status: 'upgrading',
    replaced: index,
    current: { index, role: index < c.cp ? 'cp' : 'worker', phase },
    // Surge of one: the new node joins first, then the old one drains and leaves.
    liveNodes: p.nodes + 1,
    unavailable: phase === 'join' ? 0 : 1,
  };
}

export interface FleetEvent {
  t: number;
  tone: 'ok' | 'warn' | 'bad' | 'flow' | 'neutral';
  text: string;
}

export function events(plan: Plan, fleet: FleetCluster[], t: number, from = '1.34', to = '1.35'): FleetEvent[] {
  const out: FleetEvent[] = [];
  const byId = new Map(fleet.map((c) => [c.id, c]));
  out.push({ t: 0, tone: 'neutral', text: `Rollout planned: Kubernetes ${from} to ${to}.` });
  for (const p of plan.clusters) {
    const c = byId.get(p.id)!;
    if (!Number.isFinite(p.start)) continue;
    out.push({ t: p.start, tone: 'flow', text: `${c.name}: upgrade started${p.wave === 0 ? ' (canary)' : ''}. Control plane first.` });
    if (c.cp && c.workers) out.push({ t: p.start + c.cp * TIMING.node, tone: 'flow', text: `${c.name}: control plane on ${to}. Worker nodes next.` });
    out.push({ t: p.nodesEnd, tone: 'neutral', text: `${c.name}: all nodes replaced. Running health checks.` });
    out.push(
      p.fails
        ? { t: p.end, tone: 'bad', text: `${c.name}: health check failed. Rollout stopped; no other cluster was touched.` }
        : { t: p.end, tone: 'ok', text: `${c.name}: healthy on ${to}.` },
    );
  }
  if (!plan.halted && plan.clusters.some((p) => Number.isFinite(p.start))) out.push({ t: plan.end, tone: 'ok', text: 'Rollout complete.' });
  return out.filter((e) => e.t <= t).sort((a, b) => a.t - b.t);
}

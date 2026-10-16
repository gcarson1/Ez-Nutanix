// Fleet model for Nutanix Central / multi-Prism-Central federation.
// Pure and deterministic: clusters (Prism Element) register to a Prism Central domain,
// Prism Central domains are federated under Nutanix Central. Role-based visibility,
// alert roll-up and a staggered (wave-based) fleet upgrade plan with pre-check gating.

export type Health = 'ok' | 'warn' | 'critical';
export type Severity = 'critical' | 'warning' | 'info';

export interface FleetCluster {
  id: string;
  name: string;
  site: string;
  kind: 'dc' | 'edge';
  domain: string; // Prism Central domain id
  nodes: number;
  capTB: number;
  usedTB: number;
  health: Health;
  version: string;
}

export interface PcDomain {
  id: string;
  name: string;
  region: string;
}

export interface Alert {
  id: string;
  cluster: string;
  severity: Severity;
  text: string;
}

export const DOMAINS: PcDomain[] = [
  { id: 'pc-am', name: 'Prism Central · Americas', region: 'Americas' },
  { id: 'pc-eu', name: 'Prism Central · EMEA', region: 'EMEA' },
];

export const CLUSTERS: FleetCluster[] = [
  { id: 'nyc', name: 'NYC-PROD', site: 'New York data center', kind: 'dc', domain: 'pc-am', nodes: 8, capTB: 120, usedTB: 78, health: 'ok', version: 'current-1' },
  { id: 'dal', name: 'DAL-DR', site: 'Dallas data center', kind: 'dc', domain: 'pc-am', nodes: 6, capTB: 90, usedTB: 41, health: 'ok', version: 'current-1' },
  { id: 'tor', name: 'TOR-STORE-12', site: 'Toronto retail store', kind: 'edge', domain: 'pc-am', nodes: 3, capTB: 12, usedTB: 9.9, health: 'warn', version: 'current-1' },
  { id: 'fra', name: 'FRA-PROD', site: 'Frankfurt data center', kind: 'dc', domain: 'pc-eu', nodes: 8, capTB: 140, usedTB: 66, health: 'ok', version: 'current-1' },
  { id: 'lon', name: 'LON-DEV', site: 'London office', kind: 'dc', domain: 'pc-eu', nodes: 4, capTB: 40, usedTB: 17, health: 'ok', version: 'current-1' },
];

export const ALERTS: Alert[] = [
  { id: 'a1', cluster: 'tor', severity: 'warning', text: 'Storage pool above 80% used' },
  { id: 'a2', cluster: 'nyc', severity: 'info', text: 'New firmware available for drives' },
  { id: 'a3', cluster: 'fra', severity: 'warning', text: 'One node’s NIC link flapped twice in 24 h' },
  { id: 'a4', cluster: 'lon', severity: 'info', text: 'Snapshot schedule missed one run' },
  { id: 'a5', cluster: 'dal', severity: 'info', text: 'Replication backlog cleared' },
];

// ── identity and roles ──
export type Role = 'fleet' | 'emea' | 'app' | 'audit';
export type Action = 'upgrade' | 'ack' | 'vm' | 'view';

export interface RoleDef {
  id: Role;
  label: string;
  who: string;
  scope: 'all' | { domain: string } | { clusters: string[] };
  actions: Action[];
}

export const ROLES: RoleDef[] = [
  { id: 'fleet', label: 'Fleet admin', who: 'Central IT platform team', scope: 'all', actions: ['upgrade', 'ack', 'vm', 'view'] },
  { id: 'emea', label: 'Regional operator', who: 'EMEA operations team', scope: { domain: 'pc-eu' }, actions: ['upgrade', 'ack', 'view'] },
  { id: 'app', label: 'Project member', who: 'App team in project “web-shop”', scope: { clusters: ['nyc', 'fra'] }, actions: ['vm', 'view'] },
  { id: 'audit', label: 'Auditor', who: 'Compliance, read-only', scope: 'all', actions: ['view'] },
];

export function roleDef(r: Role): RoleDef {
  return ROLES.find((x) => x.id === r)!;
}

export function canSee(role: Role, c: FleetCluster): boolean {
  const s = roleDef(role).scope;
  if (s === 'all') return true;
  if ('domain' in s) return c.domain === s.domain;
  return s.clusters.includes(c.id);
}

export function can(role: Role, a: Action): boolean {
  return roleDef(role).actions.includes(a);
}

export function visibleClusters(role: Role, registered: string[], clusters = CLUSTERS): FleetCluster[] {
  return clusters.filter((c) => registered.includes(c.id) && canSee(role, c));
}

/** Alerts roll up from every registered, visible cluster; most severe first. */
export function rollupAlerts(role: Role, registered: string[], alerts = ALERTS, clusters = CLUSTERS): Alert[] {
  const vis = new Set(visibleClusters(role, registered, clusters).map((c) => c.id));
  const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  return alerts.filter((a) => vis.has(a.cluster)).sort((a, b) => rank[a.severity] - rank[b.severity] || a.id.localeCompare(b.id));
}

export interface FleetTotals {
  clusters: number;
  nodes: number;
  capTB: number;
  usedTB: number;
  worst: Health;
}

export function totals(list: FleetCluster[]): FleetTotals {
  const order: Health[] = ['ok', 'warn', 'critical'];
  let worst: Health = 'ok';
  for (const c of list) if (order.indexOf(c.health) > order.indexOf(worst)) worst = c.health;
  return {
    clusters: list.length,
    nodes: list.reduce((s, c) => s + c.nodes, 0),
    capTB: list.reduce((s, c) => s + c.capTB, 0),
    usedTB: list.reduce((s, c) => s + c.usedTB, 0),
    worst,
  };
}

// ── staggered fleet upgrade ──
export interface PlanOpts {
  /** Clusters per wave after the canary. */
  waveSize: number;
  /** Run one low-risk cluster first, alone. */
  canary: boolean;
  /** Minutes per node (illustrative). */
  perNodeMin: number;
  /** Soak time between waves, minutes. */
  soakMin: number;
}

export interface PlanEntry {
  cluster: string;
  wave: number;
  start: number; // minutes from plan start (if all earlier waves succeed)
  end: number;
  blocked: string | null; // pre-check failure reason
}

export interface Plan {
  entries: PlanEntry[];
  waves: number;
  total: number;
}

/** Pre-check: LCM refuses to start on a cluster whose health or resiliency is not OK. */
export function precheck(c: FleetCluster): string | null {
  if (c.health === 'critical') return 'Data resiliency is not OK';
  if (c.health === 'warn') return 'Health check warning must be cleared first';
  return null;
}

/** Order: canary = smallest edge/dev cluster; then non-production before production. */
export function planUpgrade(list: FleetCluster[], o: PlanOpts): Plan {
  const prodRank = (c: FleetCluster) => (/PROD/.test(c.name) ? 2 : c.kind === 'edge' ? 0 : 1);
  const sorted = [...list].sort((a, b) => prodRank(a) - prodRank(b) || a.nodes - b.nodes || a.id.localeCompare(b.id));
  const waves: FleetCluster[][] = [];
  let rest = sorted;
  if (o.canary && rest.length) {
    // the canary must be a cluster that can pass pre-checks
    const idx = rest.findIndex((c) => !precheck(c));
    const pick = idx >= 0 ? idx : 0;
    waves.push([rest[pick]]);
    rest = rest.filter((_, i) => i !== pick);
  }
  const size = Math.max(1, o.waveSize);
  for (let i = 0; i < rest.length; i += size) waves.push(rest.slice(i, i + size));
  const entries: PlanEntry[] = [];
  let t = 0;
  waves.forEach((w, wi) => {
    let waveEnd = t;
    for (const c of w) {
      const blocked = precheck(c);
      const dur = blocked ? 0 : c.nodes * o.perNodeMin; // nodes strictly one at a time inside a cluster
      entries.push({ cluster: c.id, wave: wi, start: t, end: t + dur, blocked });
      waveEnd = Math.max(waveEnd, t + dur);
    }
    t = waveEnd + (wi < waves.length - 1 ? o.soakMin : 0);
  });
  return { entries, waves: waves.length, total: t };
}

export type RunState = 'queued' | 'running' | 'done' | 'blocked' | 'paused' | 'held';

export interface RunEntry extends PlanEntry {
  state: RunState;
  nodesDone: number;
  nodes: number;
}

export interface Fault {
  cluster: string;
  at: number;
}

/**
 * State of the fleet upgrade at minute t. A fault (a failure inside a cluster mid-upgrade)
 * pauses that cluster; no later wave starts while any cluster is paused or blocked.
 */
export function runAt(plan: Plan, list: FleetCluster[], t: number, fault: Fault | null): { entries: RunEntry[]; haltedAtWave: number | null } {
  const byId = new Map(list.map((c) => [c.id, c]));
  // first wave that contains a blocked or faulted cluster halts all later waves
  let halt: number | null = null;
  for (const e of plan.entries) {
    const faulted = fault && fault.cluster === e.cluster && fault.at >= e.start && fault.at < e.end && t >= fault.at;
    if (e.blocked || faulted) {
      const waveDone = plan.entries.filter((x) => x.wave === e.wave).reduce((m, x) => Math.max(m, x.end), 0);
      if (e.blocked && t < waveDone) continue; // not yet decided: the wave is still running
      halt = halt === null ? e.wave : Math.min(halt, e.wave);
    }
  }
  const entries = plan.entries.map((e): RunEntry => {
    const nodes = byId.get(e.cluster)?.nodes ?? 0;
    const per = nodes ? (e.end - e.start) / nodes : 0;
    const base = { ...e, nodes };
    if (e.blocked) return { ...base, state: t >= e.start ? 'blocked' : 'queued', nodesDone: 0 };
    if (halt !== null && e.wave > halt) return { ...base, state: 'held', nodesDone: 0 };
    if (fault && fault.cluster === e.cluster && fault.at >= e.start && fault.at < e.end && t >= fault.at) {
      return { ...base, state: 'paused', nodesDone: per ? Math.floor((fault.at - e.start) / per) : 0 };
    }
    if (t <= e.start) return { ...base, state: 'queued', nodesDone: 0 };
    if (t >= e.end) return { ...base, state: 'done', nodesDone: nodes };
    return { ...base, state: 'running', nodesDone: per ? Math.floor((t - e.start) / per) : 0 };
  });
  return { entries, haltedAtWave: halt };
}

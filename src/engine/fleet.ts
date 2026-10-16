// Fleet model for Nutanix Central and Prism Central federation.
// Pure and deterministic: every cluster runs its own Prism Element, clusters register to one
// Prism Central (a "domain"), and Nutanix Central federates many Prism Central domains.
// The question this answers: from a given console, which clusters can you see?

export type Health = 'ok' | 'warn';

export interface FleetCluster {
  id: string;
  name: string;
  site: string;
  domain: string; // Prism Central domain id
  nodes: number;
  health: Health;
  /** What is wrong, when health is not ok. */
  issue?: string;
}

export interface PcDomain {
  id: string;
  name: string;
  region: string;
}

export const DOMAINS: PcDomain[] = [
  { id: 'pc-am', name: 'Prism Central · Americas', region: 'Americas' },
  { id: 'pc-eu', name: 'Prism Central · EMEA', region: 'EMEA' },
];

export const CLUSTERS: FleetCluster[] = [
  { id: 'nyc', name: 'NYC-PROD', site: 'New York data center', domain: 'pc-am', nodes: 8, health: 'ok' },
  { id: 'dal', name: 'DAL-DR', site: 'Dallas data center', domain: 'pc-am', nodes: 6, health: 'ok' },
  { id: 'tor', name: 'TOR-STORE-12', site: 'Toronto retail store', domain: 'pc-am', nodes: 3, health: 'warn', issue: 'Storage over 80% full' },
  { id: 'fra', name: 'FRA-PROD', site: 'Frankfurt data center', domain: 'pc-eu', nodes: 8, health: 'ok' },
  { id: 'lon', name: 'LON-DEV', site: 'London office', domain: 'pc-eu', nodes: 4, health: 'ok' },
];

/** The console you look through: one cluster's Prism Element, one Prism Central, or Nutanix Central. */
export type Console = 'pe' | 'pc' | 'nc';

/**
 * Clusters a console can see. Prism Element sees only its own cluster (`focus`), Prism Central
 * the clusters registered to it (the focus cluster's domain), Nutanix Central every cluster in
 * every federated domain.
 */
export function inView(console: Console, focus: string, list: FleetCluster[] = CLUSTERS): FleetCluster[] {
  const f = list.find((c) => c.id === focus) ?? list[0];
  if (!f) return [];
  if (console === 'pe') return [f];
  if (console === 'pc') return list.filter((c) => c.domain === f.domain);
  return list.slice();
}

/** How many consoles of this kind someone has to open to see every cluster. */
export function consolesToSeeAll(console: Console, list: FleetCluster[] = CLUSTERS): number {
  if (!list.length) return 0;
  if (console === 'pe') return list.length;
  if (console === 'pc') return new Set(list.map((c) => c.domain)).size;
  return 1;
}

export interface FleetTotals {
  clusters: number;
  nodes: number;
  warnings: number;
}

export function totals(list: FleetCluster[]): FleetTotals {
  return {
    clusters: list.length,
    nodes: list.reduce((s, c) => s + c.nodes, 0),
    warnings: list.filter((c) => c.health !== 'ok').length,
  };
}

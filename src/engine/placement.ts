// Replica / strip-member placement honoring failure domains.
// Rules: never two members of an item on the same node; with block or rack awareness,
// never two in the same block or rack when enough domains exist. Among valid nodes,
// prefer the least-utilized (AOS picks replica targets dynamically across the cluster).
import type { Rng } from './rng';
import type { ClusterState, DataItem, Member, SimNode, SimDisk } from './cluster';
import type { Domain } from './rules';

/** Fraction of a drive the sim will fill before treating it as full. */
export const MAX_FILL = 0.95;

export function domainKey(node: SimNode, domain: Domain): number {
  return domain === 'rack' ? node.rack : domain === 'block' ? node.block : node.id;
}

/** Can this node's drives serve I/O right now? */
export function storageLive(node: SimNode): boolean {
  return node.state === 'up' || node.state === 'removing';
}

/** Can this node accept new data? */
export function acceptsData(node: SimNode): boolean {
  return node.state === 'up';
}

export function diskUsageMap(state: ClusterState): Map<string, number> {
  const m = new Map<string, number>();
  for (const d of state.disks) m.set(d.id, 0);
  for (const it of state.items) for (const mem of it.members) m.set(mem.disk, (m.get(mem.disk) || 0) + it.memberGB);
  return m;
}

export function nodeFill(state: ClusterState, usage: Map<string, number>, nodeId: number): number {
  let used = 0;
  let cap = 0;
  for (const d of state.disks) {
    if (d.node !== nodeId || d.state !== 'ok') continue;
    used += usage.get(d.id) || 0;
    cap += d.capGB;
  }
  return cap ? used / cap : 1;
}

export function memberLive(state: ClusterState, m: Member): boolean {
  const node = state.nodes[m.node];
  const disk = diskById(state, m.disk);
  return !!node && storageLive(node) && !!disk && disk.state === 'ok';
}

const diskIndex = new WeakMap<SimDisk[], Map<string, SimDisk>>();
export function diskById(state: ClusterState, id: string): SimDisk | undefined {
  let idx = diskIndex.get(state.disks);
  if (!idx) {
    idx = new Map(state.disks.map((d) => [d.id, d]));
    diskIndex.set(state.disks, idx);
  }
  return idx.get(id);
}

function pickDisk(state: ClusterState, nodeId: number, item: DataItem, usage: Map<string, number>): SimDisk | null {
  const disks = state.disks.filter((d) => d.node === nodeId && d.state === 'ok');
  const fits = (d: SimDisk) => (usage.get(d.id) || 0) + item.memberGB <= d.capGB * MAX_FILL;
  const hybrid = state.cfg.media === 'hybrid';
  const preferred = hybrid ? disks.filter((d) => (item.hot ? d.tier === 'ssd' : d.tier === 'hdd')) : disks;
  const pool = preferred.filter(fits).length ? preferred.filter(fits) : disks.filter(fits);
  if (!pool.length) return null;
  let best = pool[0];
  for (const d of pool) if ((usage.get(d.id) || 0) / d.capGB < (usage.get(best.id) || 0) / best.capGB) best = d;
  return best;
}

export interface PickOptions {
  /** Nodes that must not receive the member (e.g. the node being evacuated). */
  exclude?: number[];
  /** Members already counted toward the item (defaults to item.members filtered to live). */
  existing?: Member[];
  role?: Member['role'];
}

/**
 * Pick a node + disk for one more member of `item`. Prefers a new failure domain; if no
 * new domain is available, falls back to any node that doesn't already hold a member and
 * reports `domainOk: false` so the caller can surface degraded awareness.
 */
export function pickTarget(
  state: ClusterState,
  item: DataItem,
  rng: Rng,
  usage: Map<string, number>,
  opts: PickOptions = {},
): { member: Member; domainOk: boolean } | null {
  const existing = opts.existing ?? item.members.filter((m) => memberLive(state, m));
  // Single-node cluster: there is no second node, so copies go to different drives of the
  // one node (drive-level protection only).
  const present = state.nodes.filter((n) => n.state !== 'removed');
  // Same for a two-node cluster running on one survivor (single-node mode).
  const survivors = present.filter(acceptsData);
  const singleMode = present.length === 1 || (present.length === 2 && state.cfg.nodes === 2 && survivors.length === 1);
  if (singleMode) {
    const only = survivors[0] ?? present[0];
    if (!acceptsData(only)) return null;
    const usedDisks = new Set(item.members.map((m) => m.disk));
    const pool = state.disks.filter(
      (d) => d.node === only.id && d.state === 'ok' && !usedDisks.has(d.id) && (usage.get(d.id) || 0) + item.memberGB <= d.capGB * MAX_FILL,
    );
    if (!pool.length) return null;
    let best = pool[0];
    for (const d of pool) if ((usage.get(d.id) || 0) / d.capGB < (usage.get(best.id) || 0) / best.capGB) best = d;
    const role = opts.role ?? (item.kind === 'rf' ? 'replica' : 'data');
    return { member: { node: only.id, disk: best.id, role }, domainOk: true };
  }
  const usedNodes = new Set(item.members.map((m) => m.node)); // incl. offline copies: never co-locate
  const usedDomains = new Set(existing.map((m) => domainKey(state.nodes[m.node], state.domain)));
  const exclude = new Set(opts.exclude || []);
  const candidates = state.nodes.filter((n) => acceptsData(n) && !usedNodes.has(n.id) && !exclude.has(n.id));
  const score = (n: SimNode) => nodeFill(state, usage, n.id) + rng() * 0.04;
  const tryPool = (pool: SimNode[]) => {
    const ranked = pool.map((n) => ({ n, s: score(n) })).sort((a, b) => a.s - b.s);
    for (const { n } of ranked) {
      const disk = pickDisk(state, n.id, item, usage);
      if (disk) return { node: n, disk };
    }
    return null;
  };
  const inNewDomain = candidates.filter((n) => !usedDomains.has(domainKey(n, state.domain)));
  let found = tryPool(inNewDomain);
  let domainOk = true;
  if (!found && state.domain !== 'node') {
    found = tryPool(candidates);
    domainOk = false;
  }
  if (!found) return null;
  const role = opts.role ?? (item.kind === 'rf' ? 'replica' : 'data');
  return { member: { node: found.node.id, disk: found.disk.id, role }, domainOk };
}

/** Initial placement for a freshly written item. First copy is local to the owning VM's node. */
export function placeItem(
  state: ClusterState,
  item: DataItem,
  owner: number,
  rng: Rng,
  usage: Map<string, number>,
): Member[] {
  const members: Member[] = [];
  const add = (m: Member) => {
    members.push(m);
    usage.set(m.disk, (usage.get(m.disk) || 0) + item.memberGB);
  };
  const roleAt = (i: number): Member['role'] => (item.kind === 'rf' ? 'replica' : i < item.need ? 'data' : 'parity');
  const ownerNode = state.nodes[owner];
  // Writes always land one copy on the local node (data locality). EC strips are built
  // later by Curator from cold data, so their members are spread without a local bias.
  if (item.kind === 'rf' && state.cfg.locality && ownerNode && acceptsData(ownerNode)) {
    const tmp = { ...item, members };
    const disk = pickDiskPublic(state, owner, tmp, usage);
    if (disk) add({ node: owner, disk: disk.id, role: 'replica' });
  }
  while (members.length < item.target) {
    const tmp = { ...item, members };
    const res = pickTarget(state, tmp, rng, usage, { existing: members, role: roleAt(members.length) });
    if (!res) break;
    add(res.member);
  }
  return members;
}

export function pickDiskPublic(state: ClusterState, nodeId: number, item: DataItem, usage: Map<string, number>) {
  return pickDisk(state, nodeId, item, usage);
}

// Platform rules the simulation enforces. Every value here traces to docs/facts.md.
// Change a rule here and the UI's "why is this disabled" text updates with it.

export type RF = 2 | 3;

/** Minimum nodes for a standard cluster at each redundancy factor (facts: RF-1). */
export const MIN_NODES: Record<RF, number> = { 2: 3, 3: 5 };

/** Copies of cluster metadata (Cassandra) and configuration (Zookeeper) per redundancy factor (facts: RF-2). */
export const METADATA_COPIES: Record<RF, number> = { 2: 3, 3: 5 };
export const ZK_NODES: Record<RF, number> = { 2: 3, 3: 5 };

/** Minimum nodes for erasure coding (facts: EC-1). */
export const EC_MIN_NODES: Record<RF, number> = { 2: 4, 3: 6 };

/** Minimum blocks / racks for block / rack fault tolerance (facts: FD-1, FD-2). */
export const MIN_BLOCKS: Record<RF, number> = { 2: 3, 3: 5 };
export const MIN_RACKS: Record<RF, number> = { 2: 3, 3: 5 };

/**
 * EC-X strip (data/parity) by node count (facts: EC-2).
 * RF2-based: 4 nodes 2/1, 5 nodes 3/1, 6+ nodes 4/1.
 * RF3-based: 6 nodes 2/2, 7 nodes 3/2, 8+ nodes 4/2.
 */
export function ecStrip(nodes: number, rf: RF): { data: number; parity: number } | null {
  if (rf === 2) {
    if (nodes < 4) return null;
    return { data: Math.min(4, nodes - 2), parity: 1 };
  }
  if (nodes < 6) return null;
  return { data: Math.min(4, nodes - 4), parity: 2 };
}

/** Storage overhead multiplier for an EC strip, e.g. 4/1 -> 1.25. */
export function ecOverhead(strip: { data: number; parity: number }): number {
  return (strip.data + strip.parity) / strip.data;
}

export type Domain = 'node' | 'block' | 'rack';

export interface Explained<T> {
  value: T;
  ok: boolean;
  reason?: string;
}

/** Why a redundancy factor can or cannot be chosen for a node count. */
export function rfAllowed(rf: RF, nodes: number): Explained<RF> {
  if (nodes >= MIN_NODES[rf]) return { value: rf, ok: true };
  return { value: rf, ok: false, reason: `RF${rf} needs at least ${MIN_NODES[rf]} nodes (this cluster has ${nodes}).` };
}

export function ecAllowed(rf: RF, nodes: number): Explained<boolean> {
  if (nodes >= EC_MIN_NODES[rf]) return { value: true, ok: true };
  return {
    value: false,
    ok: false,
    reason: `Erasure coding with RF${rf} needs at least ${EC_MIN_NODES[rf]} nodes (this cluster has ${nodes}).`,
  };
}

export function blockAwareAllowed(rf: RF, blocks: number): Explained<boolean> {
  if (blocks >= MIN_BLOCKS[rf]) return { value: true, ok: true };
  return {
    value: false,
    ok: false,
    reason: `Block awareness with RF${rf} needs at least ${MIN_BLOCKS[rf]} blocks (this layout has ${blocks}).`,
  };
}

export function rackAwareAllowed(rf: RF, racks: number): Explained<boolean> {
  if (racks >= MIN_RACKS[rf]) return { value: true, ok: true };
  return {
    value: false,
    ok: false,
    reason: `Rack awareness with RF${rf} needs at least ${MIN_RACKS[rf]} racks (this layout has ${racks}).`,
  };
}

/**
 * Small-cluster advisories (facts: EDGE-1..3). These are shown, not enforced:
 * the lab lets you build 1- and 2-node clusters to explain how they differ.
 */
export function edgeAdvisory(nodes: number): string | null {
  if (nodes === 1) return 'Single-node cluster: no node-level redundancy. Data is protected across the node’s drives, and a node outage means downtime. Typically used at small edge sites with backup or replication elsewhere.';
  if (nodes === 2) return 'Two-node cluster: requires a Witness at a separate site to arbitrate if the nodes lose contact. After one node fails, the survivor keeps running workloads with a single data copy until the pair is healthy again.';
  return null;
}

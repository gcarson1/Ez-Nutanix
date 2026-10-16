// Block and rack awareness for the Protection & Capacity animation. Nodes sit in groups
// (blocks of 2 or racks of 4). With awareness on, the two copies of every piece go to
// different groups, so a whole group can fail without losing access to any piece. With
// node-only placement, copies only have to be on different nodes, so a piece can end up with
// both copies in one group; here one piece of eight does (close to the 1-in-7 odds of random
// placement on 8 nodes in 4 blocks). Pure and deterministic (unit tested).

export type Awareness = 'node' | 'block' | 'rack';

export interface DomainPlan {
  awareness: Awareness;
  groupKind: 'block' | 'rack';
  nodes: number;
  /** Group index of each node. */
  groupOf: number[];
  groups: number;
  pieces: number;
  /** Copies of each piece, in write order. */
  copies: { piece: number; node: number; slot: number }[];
  failedGroup: number;
  failedNodes: number[];
  /** Pieces with no copy left online after the failure (unavailable until the group returns). */
  unavailable: number[];
  /** Copies re-created after the failure. */
  rebuild: { piece: number; from: number; to: number; slot: number }[];
}

export const DOMAIN_PIECES = 8;

export function layoutFor(awareness: Awareness): { groupKind: 'block' | 'rack'; nodes: number; perGroup: number } {
  return awareness === 'rack' ? { groupKind: 'rack', nodes: 12, perGroup: 4 } : { groupKind: 'block', nodes: 8, perGroup: 2 };
}

export function planDomains(awareness: Awareness, pieces = DOMAIN_PIECES): DomainPlan {
  const { groupKind, nodes, perGroup } = layoutFor(awareness);
  const groupOf = Array.from({ length: nodes }, (_, n) => Math.floor(n / perGroup));
  const groups = Math.ceil(nodes / perGroup);
  const load = Array.from({ length: nodes }, () => 0);
  const members = (g: number) => groupOf.map((x, n) => (x === g ? n : -1)).filter((n) => n >= 0);
  const leastLoaded = (cands: number[]) => cands.slice().sort((a, b) => load[a] - load[b] || a - b)[0];

  // Every piece gets two copies in two different groups (ring order over groups, least-loaded node).
  const holders: number[][] = [];
  for (let p = 0; p < pieces; p++) {
    const g1 = p % groups;
    const g2 = (p + 1) % groups;
    const a = leastLoaded(members(g1));
    load[a]++;
    const b = leastLoaded(members(g2));
    load[b]++;
    holders.push([a, b]);
  }

  // Node-only placement: identical, except one piece's second copy landed in its first copy's block.
  const failedGroup = 1;
  if (awareness === 'node') {
    const p = holders.findIndex((h) => groupOf[h[0]] === failedGroup);
    const [a, b] = holders[p];
    const mate = members(failedGroup).find((n) => n !== a)!;
    load[b]--;
    load[mate]++;
    holders[p] = [a, mate];
  }

  const slots = Array.from({ length: nodes }, () => 0);
  const copies = holders.flatMap((h, piece) => h.map((node) => ({ piece, node, slot: slots[node]++ })));

  const failedNodes = members(failedGroup);
  const down = new Set(failedNodes);
  const unavailable: number[] = [];
  const rebuild: DomainPlan['rebuild'] = [];
  const after = slots.slice();
  holders.forEach((h, piece) => {
    const alive = h.filter((n) => !down.has(n));
    if (!alive.length) {
      unavailable.push(piece);
      return;
    }
    if (alive.length === h.length) return;
    // Re-create the lost copy on a healthy node; with awareness, in a group that doesn't hold the piece.
    const usedGroups = new Set(alive.map((n) => groupOf[n]));
    const cands = Array.from({ length: nodes }, (_, n) => n).filter(
      (n) => !down.has(n) && !alive.includes(n) && (awareness === 'node' || !usedGroups.has(groupOf[n])),
    );
    const to = leastLoaded(cands);
    load[to]++;
    rebuild.push({ piece, from: alive[0], to, slot: after[to]++ });
  });

  return { awareness, groupKind, nodes, groupOf, groups, pieces, copies, failedGroup, failedNodes, unavailable, rebuild };
}

// How copies of data spread across a cluster, for the Protection & Capacity animation.
// Each piece of data gets RF copies on different nodes; when nodes fail, the missing copies
// are re-created on healthy nodes that do not already hold that piece, filling the
// emptiest nodes first. Pure and deterministic, so it can be unit tested.
import type { RF } from './rules';

export interface SpreadCopy {
  piece: number;
  node: number;
  /** Position of this copy in its node's list (arrival order). */
  slot: number;
  kind: 'write' | 'rebuild';
  /** For a rebuilt copy: the surviving copy it was read from. */
  from?: { node: number; slot: number };
}

export interface SpreadPlan {
  nodes: number;
  rf: RF;
  pieces: number;
  failed: number[];
  copies: SpreadCopy[];
  /** Copies held per node after the rebuild (failed nodes hold none). */
  perNode: number[];
}

/** Number of pieces of data to draw: four (three on 3 nodes), so each copy and rebuild is easy to follow. */
export function piecesFor(nodes: number): number {
  return nodes <= 3 ? 3 : 4;
}

/**
 * First node of a piece's run of copies. Pieces go in pairs that overlap by one node, and the
 * pairs are spread around the cluster, so the node that fails (N2) holds two pieces whose other
 * copies sit on different nodes: two different sources rebuild them at once.
 */
function startFor(piece: number, pieces: number, nodes: number): number {
  const pairs = Math.ceil(pieces / 2);
  return Math.round((Math.floor(piece / 2) * nodes) / pairs) + (piece % 2);
}

/** Which nodes fail in the animation: one for RF2, two at once for RF3. */
export function failedFor(nodes: number, rf: RF): number[] {
  if (nodes < 2) return [];
  if (rf === 2) return [1];
  const second = Math.min(nodes - 1, Math.floor(nodes / 2) + 1);
  return second === 1 ? [1] : [1, second];
}

export function planSpread(nodes: number, rf: RF, pieces = piecesFor(nodes), failed = failedFor(nodes, rf)): SpreadPlan {
  const copies: SpreadCopy[] = [];
  const count = Array.from({ length: nodes }, () => 0);
  const holders: number[][] = [];
  for (let p = 0; p < pieces; p++) {
    const on: number[] = [];
    for (let k = 0; k < rf && k < nodes; k++) {
      const node = (startFor(p, pieces, nodes) + k) % nodes; // neighbors on a ring: distinct
      on.push(node);
      copies.push({ piece: p, node, slot: count[node]++, kind: 'write' });
    }
    holders.push(on);
  }

  const down = new Set(failed);
  const healthy = Array.from({ length: nodes }, (_, i) => i).filter((i) => !down.has(i));
  const reads = Array.from({ length: nodes }, () => 0); // spread the rebuild reads over sources
  for (let p = 0; p < pieces; p++) {
    const alive = holders[p].filter((n) => !down.has(n));
    if (!alive.length) continue; // every copy lost: cannot be rebuilt
    let missing = Math.min(rf, healthy.length) - alive.length;
    const have = new Set(alive);
    while (missing > 0) {
      const target = healthy.filter((n) => !have.has(n)).sort((a, b) => count[a] - count[b] || a - b)[0];
      if (target === undefined) break;
      const src = [...alive].sort((a, b) => reads[a] - reads[b] || a - b)[0];
      reads[src]++;
      const srcSlot = copies.find((c) => c.piece === p && c.node === src)!.slot;
      copies.push({ piece: p, node: target, slot: count[target]++, kind: 'rebuild', from: { node: src, slot: srcSlot } });
      have.add(target);
      missing--;
    }
  }

  const perNode = Array.from({ length: nodes }, (_, n) => (down.has(n) ? 0 : copies.filter((c) => c.node === n).length));
  return { nodes, rf, pieces, failed, copies, perNode };
}

/** Share of raw capacity that holds your data, extra copies and the rebuild reserve. */
export function capacityShares(nodes: number, rf: RF): { data: number; copies: number; reserve: number; reserveNodes: number } {
  const reserveNodes = rf === 3 ? 2 : 1;
  const reserve = Math.min(1, reserveNodes / nodes);
  const left = 1 - reserve;
  return { data: left / rf, copies: (left * (rf - 1)) / rf, reserve, reserveNodes };
}

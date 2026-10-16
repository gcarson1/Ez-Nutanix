// Erasure coding (EC-X) for the Protection & Capacity animation. Pieces are first written as
// RF copies. Write-cold pieces are then encoded in the background into one strip: each data
// piece keeps one copy, parity pieces are added on other nodes, and the extra copies are
// deleted. When nodes fail, a lost strip piece is recomputed by reading the rest of its strip;
// lost copies of hot pieces are simply copied again. Pure and deterministic (unit tested).
import { ecStrip, ecOverhead, type RF } from './rules';

export interface StripMember {
  /** Data piece number, or -1, -2 for parity pieces. */
  id: number;
  role: 'data' | 'parity';
  node: number;
}

export interface StripPlan {
  nodes: number;
  rf: RF;
  strip: { data: number; parity: number };
  /** Write-cold pieces (they become the strip's data pieces). */
  cold: { piece: number; copies: number[] }[];
  /** Hot pieces: they keep RF copies throughout. */
  hot: { piece: number; copies: number[] }[];
  /** The strip after encoding. */
  members: StripMember[];
  /** Copies deleted by encoding (one per extra copy of each cold piece). */
  freed: { piece: number; node: number }[];
  failed: number[];
  /** Strip pieces recomputed after the failure: read from every surviving strip member. */
  recompute: { id: number; role: StripMember['role']; reads: number[]; to: number }[];
  /** Hot copies re-created after the failure. */
  recopy: { piece: number; from: number; to: number }[];
  overhead: { copies: number; strip: number };
}

/** Pieces drawn in the animation: one strip's worth of cold data plus three hot pieces. */
export const HOT_PIECES = 3;

/** Nodes that fail: one at RF2, two at once at RF3 (as many as the strip has parity). */
export function stripFailures(rf: RF): number[] {
  return rf === 2 ? [0] : [0, 2];
}

export function planStrip(rf: RF, nodes = 8): StripPlan {
  const strip = ecStrip(nodes, rf);
  if (!strip) throw new Error(`EC-X needs more than ${nodes} nodes at RF${rf}`);
  const width = strip.data + strip.parity;
  if (nodes < width + rf - 1) throw new Error('Not enough nodes to rebuild a full-width strip after the failure');
  const ring = (n: number) => ((n % nodes) + nodes) % nodes;

  // Cold pieces 0..d-1: copies on ring neighbors starting at their own node.
  const cold = Array.from({ length: strip.data }, (_, p) => ({ piece: p, copies: Array.from({ length: rf }, (_, k) => ring(p + k)) }));
  // Hot pieces follow, starting on the nodes after the strip's parity.
  const hot = Array.from({ length: HOT_PIECES }, (_, h) => {
    const piece = strip.data + h;
    const start = ring(width + h);
    return { piece, copies: Array.from({ length: rf }, (_, k) => ring(start + k)) };
  });

  // Encoding keeps each cold piece's first copy (on node p) and adds parity on the next nodes.
  const members: StripMember[] = [
    ...cold.map((c) => ({ id: c.piece, role: 'data' as const, node: c.copies[0] })),
    ...Array.from({ length: strip.parity }, (_, k) => ({ id: -(k + 1), role: 'parity' as const, node: ring(strip.data + k) })),
  ];
  const freed = cold.flatMap((c) => c.copies.slice(1).map((node) => ({ piece: c.piece, node })));

  const failed = stripFailures(rf);
  const down = new Set(failed);
  const load = Array.from({ length: nodes }, () => 0);
  for (const m of members) load[m.node]++;
  for (const h of hot) for (const n of h.copies) load[n]++;
  const healthy = Array.from({ length: nodes }, (_, n) => n).filter((n) => !down.has(n));
  const pick = (exclude: Set<number>) => {
    const choice = healthy.filter((n) => !exclude.has(n)).sort((a, b) => load[a] - load[b] || a - b)[0];
    if (choice === undefined) throw new Error('No healthy node available');
    load[choice]++;
    return choice;
  };

  // Recompute lost strip pieces on nodes that hold no other piece of the strip.
  const survivors = members.filter((m) => !down.has(m.node));
  const stripNodes = new Set(survivors.map((m) => m.node));
  const recompute = members
    .filter((m) => down.has(m.node))
    .map((m) => {
      const to = pick(stripNodes);
      stripNodes.add(to);
      return { id: m.id, role: m.role, reads: survivors.map((s) => s.node), to };
    });

  // Copy lost hot copies again from a surviving copy, onto a node without that piece.
  const recopy: StripPlan['recopy'] = [];
  for (const h of hot) {
    const alive = h.copies.filter((n) => !down.has(n));
    const have = new Set(alive);
    for (const n of h.copies) {
      if (!down.has(n)) continue;
      const to = pick(have);
      have.add(to);
      recopy.push({ piece: h.piece, from: alive[0], to });
    }
  }

  return { nodes, rf, strip, cold, hot, members, freed, failed, recompute, recopy, overhead: { copies: rf, strip: ecOverhead(strip) } };
}

/** Space used per unit of data when a share of it is write-cold and erasure coded (illustrative blend). */
export function blendedOverhead(rf: RF, stripOverhead: number, coldShare: number): number {
  const c = Math.min(1, Math.max(0, coldShare));
  return c * stripOverhead + (1 - c) * rf;
}

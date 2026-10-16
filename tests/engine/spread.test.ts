import { describe, expect, it } from 'vitest';
import { capacityShares, failedFor, planSpread } from '../../src/engine/spread';
import type { RF } from '../../src/engine/rules';

const CASES: [number, RF][] = [
  [3, 2],
  [4, 2],
  [5, 2],
  [6, 2],
  [8, 2],
  [12, 2],
  [5, 3],
  [6, 3],
  [8, 3],
  [12, 3],
];

describe('planSpread', () => {
  it.each(CASES)('%i nodes RF%i: every piece starts with RF copies on different nodes', (n, rf) => {
    const p = planSpread(n, rf);
    for (let piece = 0; piece < p.pieces; piece++) {
      const on = p.copies.filter((c) => c.piece === piece && c.kind === 'write').map((c) => c.node);
      expect(on).toHaveLength(rf);
      expect(new Set(on).size).toBe(rf);
    }
  });

  it.each(CASES)('%i nodes RF%i: after the rebuild every piece is back to RF copies on healthy nodes', (n, rf) => {
    const p = planSpread(n, rf);
    const down = new Set(p.failed);
    expect(p.failed.length).toBe(rf - 1);
    for (let piece = 0; piece < p.pieces; piece++) {
      const on = p.copies.filter((c) => c.piece === piece && !down.has(c.node)).map((c) => c.node);
      expect(new Set(on).size).toBe(on.length);
      expect(on).toHaveLength(rf);
    }
  });

  it.each(CASES)('%i nodes RF%i: rebuilt copies are read from a surviving copy', (n, rf) => {
    const p = planSpread(n, rf);
    for (const c of p.copies.filter((x) => x.kind === 'rebuild')) {
      expect(p.failed).not.toContain(c.from!.node);
      expect(p.copies.some((x) => x.piece === c.piece && x.node === c.from!.node && x.slot === c.from!.slot)).toBe(true);
    }
  });

  it.each(CASES)('%i nodes RF%i: copies stay balanced across nodes', (n, rf) => {
    const p = planSpread(n, rf);
    const healthy = p.perNode.filter((_, i) => !p.failed.includes(i));
    expect(Math.max(...healthy) - Math.min(...healthy)).toBeLessThanOrEqual(2);
  });

  it('slots on a node are numbered in arrival order without gaps', () => {
    const p = planSpread(8, 2);
    for (let n = 0; n < 8; n++) {
      const slots = p.copies.filter((c) => c.node === n).map((c) => c.slot);
      expect(slots).toEqual(slots.map((_, i) => i));
    }
  });

  it('fails one node for RF2 and two for RF3', () => {
    expect(failedFor(8, 2)).toEqual([1]);
    expect(failedFor(5, 3)).toHaveLength(2);
  });
});

describe('capacityShares', () => {
  it('adds up to all of raw', () => {
    for (const [n, rf] of CASES) {
      const s = capacityShares(n, rf);
      expect(s.data + s.copies + s.reserve).toBeCloseTo(1, 9);
    }
  });

  it('8 nodes RF2 keeps one node free and stores data at about 44% of raw', () => {
    const s = capacityShares(8, 2);
    expect(s.reserveNodes).toBe(1);
    expect(s.data).toBeCloseTo(7 / 16, 9);
  });

  it('RF3 keeps two nodes free and a third of the rest is data', () => {
    const s = capacityShares(6, 3);
    expect(s.reserveNodes).toBe(2);
    expect(s.data).toBeCloseTo(4 / 6 / 3, 9);
  });
});

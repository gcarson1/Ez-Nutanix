import { describe, it, expect } from 'vitest';
import { planDomains, layoutFor } from '../../src/engine/domainspread';
import { MIN_BLOCKS, MIN_RACKS } from '../../src/engine/rules';

const holders = (p: ReturnType<typeof planDomains>, piece: number) => p.copies.filter((c) => c.piece === piece).map((c) => c.node);

describe('block and rack awareness animation model', () => {
  it('layouts meet the RF2 minimums: 4 blocks of 2 nodes, 3 racks of 4 nodes', () => {
    const b = planDomains('block');
    expect(b.groups).toBe(4);
    expect(b.groups).toBeGreaterThanOrEqual(MIN_BLOCKS[2]);
    const r = planDomains('rack');
    expect(r.groups).toBe(3);
    expect(r.groups).toBeGreaterThanOrEqual(MIN_RACKS[2]);
    expect(layoutFor('node')).toEqual(layoutFor('block'));
  });

  for (const aw of ['block', 'rack'] as const) {
    it(`${aw} awareness: two copies per piece, always in different ${aw}s, and a whole ${aw} can fail`, () => {
      const p = planDomains(aw);
      for (let piece = 0; piece < p.pieces; piece++) {
        const h = holders(p, piece);
        expect(h.length).toBe(2);
        expect(new Set(h.map((n) => p.groupOf[n])).size).toBe(2);
      }
      expect(p.unavailable).toEqual([]);
      // Every piece that lost a copy gets one back, in a group that doesn't already hold it.
      for (let piece = 0; piece < p.pieces; piece++) {
        const alive = holders(p, piece).filter((n) => !p.failedNodes.includes(n));
        const added = p.rebuild.filter((r) => r.piece === piece).map((r) => r.to);
        const final = [...alive, ...added];
        expect(final.length).toBe(2);
        expect(new Set(final.map((n) => p.groupOf[n])).size).toBe(2);
        expect(final.some((n) => p.failedNodes.includes(n))).toBe(false);
      }
      expect(p.failedNodes.every((n) => p.groupOf[n] === p.failedGroup)).toBe(true);
    });
  }

  it('node-only placement: one piece of eight has both copies in the failed block and becomes unavailable', () => {
    const p = planDomains('node');
    const shared = Array.from({ length: p.pieces }, (_, i) => i).filter((i) => new Set(holders(p, i).map((n) => p.groupOf[n])).size === 1);
    expect(shared.length).toBe(1);
    expect(p.groupOf[holders(p, shared[0])[0]]).toBe(p.failedGroup);
    expect(p.unavailable).toEqual(shared);
    for (let piece = 0; piece < p.pieces; piece++) expect(new Set(holders(p, piece)).size).toBe(2);
    // Nothing is rebuilt for the unavailable piece; the others get their copy back.
    expect(p.rebuild.some((r) => r.piece === shared[0])).toBe(false);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(planDomains('rack'))).toBe(JSON.stringify(planDomains('rack')));
  });
});

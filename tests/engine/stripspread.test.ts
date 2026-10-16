import { describe, it, expect } from 'vitest';
import { planStrip, blendedOverhead, stripFailures } from '../../src/engine/stripspread';
import { ecStrip } from '../../src/engine/rules';

describe('EC-X strip animation model', () => {
  for (const rf of [2, 3] as const) {
    it(`RF${rf}: the strip follows the strip table and every piece is on a different node`, () => {
      const p = planStrip(rf);
      expect(p.strip).toEqual(ecStrip(8, rf));
      expect(p.members.length).toBe(p.strip.data + p.strip.parity);
      expect(new Set(p.members.map((m) => m.node)).size).toBe(p.members.length);
      expect(p.members.filter((m) => m.role === 'parity').length).toBe(p.strip.parity);
    });

    it(`RF${rf}: encoding keeps one copy of each cold piece and frees the rest`, () => {
      const p = planStrip(rf);
      for (const c of p.cold) {
        expect(c.copies.length).toBe(rf);
        expect(new Set(c.copies).size).toBe(rf);
        const kept = p.members.filter((m) => m.id === c.piece);
        expect(kept.length).toBe(1);
        expect(c.copies).toContain(kept[0].node);
        expect(p.freed.filter((f) => f.piece === c.piece).length).toBe(rf - 1);
      }
      for (const h of p.hot) expect(new Set(h.copies).size).toBe(rf);
    });

    it(`RF${rf}: the failure is survivable and the strip is rebuilt from the rest of the strip`, () => {
      const p = planStrip(rf);
      expect(p.failed).toEqual(stripFailures(rf));
      const lost = p.members.filter((m) => p.failed.includes(m.node));
      expect(lost.length).toBeGreaterThan(0);
      expect(lost.length).toBeLessThanOrEqual(p.strip.parity);
      expect(p.recompute.length).toBe(lost.length);
      const survivors = p.members.filter((m) => !p.failed.includes(m.node)).map((m) => m.node);
      for (const r of p.recompute) {
        expect(r.reads.slice().sort()).toEqual(survivors.slice().sort());
        expect(r.reads.length).toBeGreaterThanOrEqual(p.strip.data);
        expect(p.failed).not.toContain(r.to);
      }
      // After the rebuild the strip is full width again, on distinct healthy nodes.
      const after = [...survivors, ...p.recompute.map((r) => r.to)];
      expect(after.length).toBe(p.strip.data + p.strip.parity);
      expect(new Set(after).size).toBe(after.length);
      // Hot pieces are back to RF copies on distinct healthy nodes.
      for (const h of p.hot) {
        const alive = h.copies.filter((n) => !p.failed.includes(n));
        const added = p.recopy.filter((x) => x.piece === h.piece).map((x) => x.to);
        const final = [...alive, ...added];
        expect(final.length).toBe(rf);
        expect(new Set(final).size).toBe(rf);
        expect(final.some((n) => p.failed.includes(n))).toBe(false);
      }
    });
  }

  it('overheads match the strip table and blend honestly with the cold share', () => {
    expect(planStrip(2).overhead).toEqual({ copies: 2, strip: 1.25 });
    expect(planStrip(3).overhead).toEqual({ copies: 3, strip: 1.5 });
    expect(blendedOverhead(2, 1.25, 0)).toBe(2);
    expect(blendedOverhead(2, 1.25, 1)).toBe(1.25);
    expect(blendedOverhead(2, 1.25, 0.5)).toBeCloseTo(1.625);
    expect(blendedOverhead(3, 1.5, 0.5)).toBeCloseTo(2.25);
  });

  it('refuses a cluster too small for the strip', () => {
    expect(() => planStrip(3, 5)).toThrow();
  });
});

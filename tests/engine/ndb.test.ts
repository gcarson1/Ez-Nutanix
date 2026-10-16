import { describe, it, expect } from 'vitest';
import { planRecovery, snapshots, lastCaptured, cloneCapacity, type TmPolicy } from '../../src/engine/ndb';

const p: TmPolicy = { windowMin: 7 * 1440, snapEveryMin: 1440, snapOffsetMin: 60, logEveryMin: 30 };
const now = 7 * 1440 - 10;

describe('Time Machine', () => {
  it('base snapshot is at or before the target, logs cover the gap', () => {
    for (const target of [100, 2000, 5000, 9000]) {
      const r = planRecovery(p, now, target);
      expect(r.ok).toBe(true);
      expect(r.snapshot!).toBeLessThanOrEqual(target);
      expect(r.snapshot! + r.logMin).toBe(target);
      expect(target - r.snapshot!).toBeLessThan(p.snapEveryMin);
    }
  });
  it('cannot recover past the last log catch-up', () => {
    const last = lastCaptured(p, now);
    const r = planRecovery(p, now, now);
    expect(r.ok).toBe(false);
    expect(r.effective).toBe(last);
    expect(now - last).toBeLessThan(p.logEveryMin);
  });
  it('cannot recover before the first snapshot', () => {
    expect(planRecovery(p, now, 10).ok).toBe(false);
  });
  it('snapshots are within the window', () => {
    expect(snapshots(p, now).every((s) => s <= now)).toBe(true);
  });
});

describe('thin clones', () => {
  it('thin clones use less than full copies unless every block changes', () => {
    const c = cloneCapacity(2, 5, 10);
    expect(c.thinTB).toBeCloseTo(2 + 5 * 0.2);
    expect(c.fullCopiesTB).toBe(12);
    expect(cloneCapacity(2, 5, 100).savedTB).toBeCloseTo(0);
  });
});

import { describe, it, expect } from 'vitest';
import { planMove, naiveDowntime, phaseAt, type MoveInput } from '../../src/engine/move';

const base: MoveInput = { vmGB: 500, mbps: 200, changeGBPerHour: 5, syncEveryMin: 60, cutoverAt: null, bootMin: 5 };

describe('Move timeline', () => {
  it('seed time is size / rate', () => {
    const p = planMove(base, 2000);
    expect(p.seedEnd).toBeCloseTo((500 * 1024) / (200 * 60));
  });
  it('no downtime until cutover is requested', () => {
    const p = planMove(base, 2000);
    expect(p.downtimeMin).toBeNull();
    expect(p.phases.some((x) => x.kind === 'sync')).toBe(true);
  });
  it('cutover after incremental syncs is far shorter than a cold copy', () => {
    const p = planMove({ ...base, cutoverAt: 400 }, 2000);
    expect(p.downtimeMin!).toBeLessThan(naiveDowntime(base));
    expect(p.downtimeMin!).toBeGreaterThanOrEqual(base.bootMin);
  });
  it('cutover requested during the seed waits until the seed ends', () => {
    const p = planMove({ ...base, cutoverAt: 1 }, 2000);
    expect(p.cutoverStart!).toBeGreaterThanOrEqual(p.seedEnd);
  });
  it('phases are contiguous and ordered', () => {
    const p = planMove({ ...base, cutoverAt: 300 }, 2000);
    for (let i = 1; i < p.phases.length; i++) expect(p.phases[i].start).toBeCloseTo(p.phases[i - 1].end);
    expect(phaseAt(p, 0).kind).toBe('seed');
  });
  it('reports non-convergence when change rate exceeds bandwidth', () => {
    expect(planMove({ ...base, changeGBPerHour: 1000, mbps: 100 }, 100).converges).toBe(false);
  });
});

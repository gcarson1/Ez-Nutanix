import { describe, expect, it } from 'vitest';
import { GPU_JOBS, SCALE, SLOTS, UPGRADE, gpuOwners, scaleState, upgradePods } from '../../src/engine/nkp-scenes';

const times = (end: number) => Array.from({ length: Math.round(end / 0.05) + 1 }, (_, k) => k * 0.05);

describe('NKP scene arithmetic', () => {
  it('scaling: no worker is over its slots, nothing is negative, and worker 4 only holds pods while it exists', () => {
    for (const t of times(22)) {
      const s = scaleState(t);
      for (const n of s.pods) expect(n, `t=${t}`).toBeGreaterThanOrEqual(0);
      for (const n of s.pods) expect(n, `t=${t}`).toBeLessThanOrEqual(SLOTS);
      expect(s.waiting, `t=${t}`).toBeGreaterThanOrEqual(0);
      if (!s.has4) expect(s.pods[3], `t=${t}`).toBe(0);
    }
  });

  it('scaling: nine pods, then two wait, then all fourteen run on four workers, then eight on three', () => {
    expect(scaleState(0).total).toBe(9);
    expect(scaleState(SCALE.add - 0.1)).toMatchObject({ total: 12, waiting: 2, has4: false });
    expect(scaleState(SCALE.land[1])).toMatchObject({ total: 14, waiting: 0, has4: true });
    expect(scaleState(SCALE.gone)).toMatchObject({ total: 8, waiting: 0, has4: false });
  });

  it('upgrade: six pods the whole time, never more than a worker holds, and a worker is empty before it is replaced', () => {
    for (const t of times(28)) {
      const p = upgradePods(t);
      expect(p.reduce((a, b) => a + b, 0), `t=${t}`).toBe(6);
      for (const n of p) expect(n, `t=${t}`).toBeLessThanOrEqual(SLOTS);
    }
    for (const i of [0, 1, 2]) expect(upgradePods(UPGRADE.drained(i))[i]).toBe(0);
  });

  it('AI platform: the training job gets four GPUs at once or none, and never shares one', () => {
    for (const t of times(28)) {
      const training = gpuOwners(t).filter((o) => o === 'Training').length;
      expect([0, 4], `t=${t}`).toContain(training);
    }
    expect(gpuOwners(GPU_JOBS.pipe).filter(Boolean)).toHaveLength(6);
    expect(gpuOwners(GPU_JOBS.pipeDone).filter(Boolean)).toHaveLength(4);
    expect(gpuOwners(GPU_JOBS.train).filter(Boolean)).toHaveLength(8);
  });
});

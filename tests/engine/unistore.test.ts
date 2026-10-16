import { describe, it, expect } from 'vitest';
import { makeFiles, ownership, loadPerFsvm, filesAvailable, iscsiTargets, tierSplit } from '../../src/engine/unistore';

describe('Files FSVM failover', () => {
  it('every directory is served when all FSVMs are up, spread evenly', () => {
    const s = makeFiles(3);
    expect(filesAvailable(s)).toBe(true);
    const l = loadPerFsvm(s);
    expect(Math.max(...l) - Math.min(...l)).toBeLessThanOrEqual(1);
  });
  it('a failed FSVM is taken over by a survivor; nothing becomes unavailable', () => {
    const s = { ...makeFiles(3), down: [1] };
    const o = ownership(s);
    expect(o.every((x) => x.servedBy !== null && x.servedBy !== 1)).toBe(true);
    expect(o.filter((x) => x.moved).every((x) => x.home === 1)).toBe(true);
  });
  it('recovery: the original FSVM serves its directories again', () => {
    const s = makeFiles(4);
    expect(ownership({ ...s, down: [] }).every((x) => x.servedBy === x.home)).toBe(true);
  });
  it('a single FSVM has no HA', () => {
    expect(filesAvailable({ ...makeFiles(1), down: [0] })).toBe(false);
  });
  it('total load is conserved under failure', () => {
    const s = { ...makeFiles(5), down: [0, 3] };
    expect(loadPerFsvm(s).reduce((a, b) => a + b, 0)).toBe(s.dirs.length);
    expect(loadPerFsvm(s)[0]).toBe(0);
  });
});

describe('Volumes redirection', () => {
  it('no client is served by a down CVM', () => {
    const t = iscsiTargets(6, 4, [2]);
    expect(t.every((x) => x !== null && x !== 2)).toBe(true);
  });
});

describe('Objects tiering', () => {
  it('local + remote equals total and a shorter rule tiers more', () => {
    const a = tierSplit(100, 30, 365);
    const b = tierSplit(100, 180, 365);
    expect(a.localTB + a.remoteTB).toBeCloseTo(100);
    expect(a.remoteTB).toBeGreaterThan(b.remoteTB);
    expect(tierSplit(100, null, 365).remoteTB).toBe(0);
  });
});

describe('Volumes balancing', () => {
  it('redirected sessions go to the least-loaded healthy CVM', () => {
    expect(iscsiTargets(2, 4, [0])).toEqual([2, 1]);
    expect(iscsiTargets(3, 3, [0, 1, 2])).toEqual([null, null, null]);
  });
});

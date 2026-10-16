import { describe, it, expect } from 'vitest';
import { scaleModel, JOIN_STEPS } from '../../src/engine/scaleout';

describe('scale-out model', () => {
  it('adds one controller and one node’s drives per node', () => {
    for (let n = 3; n <= 32; n++) {
      const a = scaleModel({ nodes: n, drivesPerNode: 6, driveTB: 3.84, cvmShare: 0 });
      const b = scaleModel({ nodes: n + 1, drivesPerNode: 6, driveTB: 3.84, cvmShare: 0 });
      expect(b.hci.controllers - a.hci.controllers).toBe(1);
      expect(b.hci.rawTB - a.hci.rawTB).toBeCloseTo(6 * 3.84, 9);
      expect(a.hci.hostsPerController).toBe(1);
    }
  });

  it('a single dual-controller array keeps two controllers as hosts grow', () => {
    const r = scaleModel({ nodes: 12, drivesPerNode: 6, driveTB: 3.84, cvmShare: 0 });
    expect(r.tier3.controllers).toBe(2);
    expect(r.tier3.hostsPerController).toBe(6);
    expect(scaleModel({ nodes: 12, drivesPerNode: 6, driveTB: 3.84, cvmShare: 0, arrays: 2 }).tier3.controllers).toBe(4);
  });

  it('CVM overhead is a constant share, so VM capacity still grows linearly', () => {
    const s = 0.1;
    const a = scaleModel({ nodes: 4, drivesPerNode: 6, driveTB: 3.84, cvmShare: s });
    const b = scaleModel({ nodes: 8, drivesPerNode: 6, driveTB: 3.84, cvmShare: s });
    expect(b.hci.vmNodeEquivalents).toBeCloseTo(2 * a.hci.vmNodeEquivalents, 9);
    expect(a.hci.vmNodeEquivalents + a.hci.controllerNodeEquivalents).toBeCloseTo(4, 9);
  });

  it('a joining node counts only once its CVM has joined', () => {
    const joinIdx = JOIN_STEPS.findIndex((x) => x.joined);
    expect(joinIdx).toBeGreaterThan(0);
    expect(JOIN_STEPS.slice(joinIdx).every((x) => x.joined)).toBe(true);
  });
});

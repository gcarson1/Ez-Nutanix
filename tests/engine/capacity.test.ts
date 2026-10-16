// Invariant 7: capacity math matches the formulas in MASTER_PROMPT 7.4 over a grid of inputs.
import { describe, it, expect } from 'vitest';
import { computeCapacity, recommendedReserve, survivalMatrix, type CapacityInput, type ReservePolicy } from '../../src/engine/capacity';
import { ecStrip, ecOverhead, minBlocks, type RF } from '../../src/engine/rules';
import { rf3ConversionGate, ecxEnableGate, physicalLimitTB } from '../../src/engine/capgate';

const base: CapacityInput = {
  nodes: 8,
  drivesPerNode: 6,
  driveTB: 3.84,
  rf: 2,
  ecx: false,
  coldPct: 60,
  reserve: 'none',
  nodesPerBlock: 1,
  blockAware: false,
  dataReduction: 1,
  systemOverheadPct: 0,
};

const close = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(1e-6 * Math.max(1, Math.abs(b)));

function* grid() {
  for (const nodes of [3, 4, 5, 6, 7, 8, 12, 16, 24, 32])
    for (const rf of [2, 3] as RF[])
      for (const ecx of [false, true])
        for (const coldPct of [0, 30, 60, 100])
          for (const reserve of ['none', 'auto', 'n1', 'n2', 'block'] as ReservePolicy[])
            for (const systemOverheadPct of [0, 8])
              for (const [drivesPerNode, driveTB] of [
                [4, 1.92],
                [6, 3.84],
                [10, 7.68],
              ])
                yield { ...base, nodes, rf, ecx, coldPct, reserve, systemOverheadPct, drivesPerNode, driveTB, nodesPerBlock: 2, blockAware: nodes >= 6 } as CapacityInput;
}

describe('capacity formulas (7.4) over a grid', () => {
  it('raw is the sum of all drives', () => {
    for (const i of grid()) close(computeCapacity(i).rawTB, i.nodes * i.drivesPerNode * i.driveTB);
  });

  it('without EC-X, usable is (raw - system) / RF and after-reserve subtracts the reserve first', () => {
    for (const i of grid()) {
      if (i.ecx) continue;
      const c = computeCapacity(i);
      const sys = (c.rawTB * i.systemOverheadPct) / 100;
      close(c.blendedOverhead, i.rf);
      close(c.usableTB, (c.rawTB - sys) / i.rf);
      close(c.reserveTB, c.reserveNodes * i.drivesPerNode * i.driveTB * (1 - i.systemOverheadPct / 100));
      close(c.usableAfterReserveTB, (c.rawTB - sys - c.reserveTB) / i.rf);
      expect(c.usableAfterReserveTB).toBeLessThanOrEqual(c.usableTB + 1e-9);
    }
  });

  it('RF2 usable is about raw / 2 and RF3 about raw / 3 with no other deductions', () => {
    for (const nodes of [5, 8, 16]) {
      close(computeCapacity({ ...base, nodes, rf: 2 }).usableTB, computeCapacity({ ...base, nodes, rf: 2 }).rawTB / 2);
      close(computeCapacity({ ...base, nodes, rf: 3 }).usableTB, computeCapacity({ ...base, nodes, rf: 3 }).rawTB / 3);
    }
  });

  it('EC-X overhead is (data + parity) / data and blends only over the write-cold share', () => {
    for (const i of grid()) {
      if (!i.ecx) continue;
      const c = computeCapacity(i);
      const strip = ecStrip(i.nodes, i.rf);
      if (!strip) {
        expect(c.strip).toBeNull();
        close(c.blendedOverhead, i.rf);
        continue;
      }
      const ov = (strip.data + strip.parity) / strip.data;
      close(c.ecOverhead!, ov);
      close(c.blendedOverhead, (i.coldPct / 100) * ov + (1 - i.coldPct / 100) * i.rf);
      expect(c.blendedOverhead).toBeLessThanOrEqual(i.rf + 1e-9);
      if (i.coldPct === 0) close(c.blendedOverhead, i.rf);
    }
  });

  it('documented strip examples: 4/1 is 1.25x and 4/2 is 1.5x', () => {
    expect(ecOverhead({ data: 4, parity: 1 })).toBe(1.25);
    expect(ecOverhead({ data: 4, parity: 2 })).toBe(1.5);
    expect(ecStrip(4, 2)).toEqual({ data: 2, parity: 1 });
    expect(ecStrip(5, 2)).toEqual({ data: 3, parity: 1 });
    expect(ecStrip(6, 2)).toEqual({ data: 4, parity: 1 });
    expect(ecStrip(32, 2)).toEqual({ data: 4, parity: 1 });
    expect(ecStrip(3, 2)).toBeNull();
  });

  it('more write-cold data never reduces usable capacity with EC-X on', () => {
    for (const nodes of [4, 6, 8, 12])
      for (const rf of [2, 3] as RF[]) {
        let prev = -1;
        for (let cold = 0; cold <= 100; cold += 10) {
          const u = computeCapacity({ ...base, nodes, rf, ecx: true, coldPct: cold }).usableTB;
          expect(u).toBeGreaterThanOrEqual(prev - 1e-9);
          prev = u;
        }
      }
  });

  it('the labeled steps add up: raw minus each deduction equals usable after reserve', () => {
    for (const i of grid()) {
      const c = computeCapacity(i);
      const usable = c.steps.find((s) => s.key === 'usable')!.tb;
      const deductions = c.steps.filter((s) => s.tb < 0).reduce((a, s) => a + s.tb, 0);
      close(c.rawTB + deductions, usable);
      close(usable, c.usableAfterReserveTB);
    }
  });

  it('data reduction multiplies usable after reserve and defaults to none', () => {
    for (const dr of [1, 1.5, 2, 3]) {
      const c = computeCapacity({ ...base, dataReduction: dr, reserve: 'auto' });
      close(c.effectiveTB, c.usableAfterReserveTB * dr);
    }
    const c = computeCapacity({ ...base, dataReduction: 1 });
    close(c.effectiveTB, c.usableAfterReserveTB);
    expect(c.steps.some((s) => s.key === 'effective')).toBe(false);
  });

  it('never reserves the whole cluster', () => {
    for (const i of grid()) expect(computeCapacity(i).reserveNodes).toBeLessThan(i.nodes);
  });
});

describe('rebuild reserve and survival rules', () => {
  it('recommends N+1 for RF2, N+2 for RF3 and large RF2, and a block for block-aware layouts', () => {
    expect(recommendedReserve({ nodes: 8, rf: 2, nodesPerBlock: 1, blockAware: false }).nodes).toBe(1);
    expect(recommendedReserve({ nodes: 8, rf: 3, nodesPerBlock: 1, blockAware: false }).nodes).toBe(2);
    expect(recommendedReserve({ nodes: 28, rf: 2, nodesPerBlock: 1, blockAware: false }).nodes).toBe(2);
    expect(recommendedReserve({ nodes: 16, rf: 2, nodesPerBlock: 4, blockAware: true }).nodes).toBe(4);
  });

  it('drive and node tolerance follow RF; block tolerance needs awareness', () => {
    for (const rf of [2, 3] as RF[]) {
      const m = survivalMatrix({ rf, nodes: 12, nodesPerBlock: 2, blockAware: false, racks: 1, rackAware: false });
      expect(m.find((r) => r.domain === 'Drive')!.survives).toBe(rf - 1);
      expect(m.find((r) => r.domain === 'Node')!.survives).toBe(rf - 1);
      expect(m.find((r) => r.domain === 'Block')!.survives).toBe(0);
      expect(m.find((r) => r.domain === 'Rack')!.survives).toBe(0);
      const aware = survivalMatrix({ rf, nodes: 12, nodesPerBlock: 2, blockAware: true, racks: 1, rackAware: false });
      expect(aware.find((r) => r.domain === 'Block')!.survives).toBe(rf - 1);
    }
  });
});

describe('capacity-check gates', () => {
  it('blocks RF2 to RF3 below 5 nodes', () => {
    const g = rf3ConversionGate({ ...base, nodes: 4, fillPct: 10 });
    expect(g.ok).toBe(false);
    expect(g.reasons.join(' ')).toMatch(/5 nodes/);
  });

  it('RF3 conversion needs 1.5x the physical space of RF2 for the same data', () => {
    for (const fill of [10, 20, 30, 40, 50]) {
      const g = rf3ConversionGate({ ...base, nodes: 8, fillPct: fill, reserve: 'auto' });
      close(g.usedAfterTB, g.usedNowTB * 1.5);
      expect(g.ok).toBe(g.usedAfterTB <= g.limitTB + 1e-9);
      close(g.limitTB, physicalLimitTB({ ...base, nodes: 8, rf: 3, reserve: 'auto' }));
    }
    expect(rf3ConversionGate({ ...base, nodes: 8, fillPct: 20, reserve: 'auto' }).ok).toBe(true);
    expect(rf3ConversionGate({ ...base, nodes: 8, fillPct: 60, reserve: 'auto' }).ok).toBe(false);
  });

  it('EC-X gate blocks below the node minimum and when the cluster is past its reserve', () => {
    expect(ecxEnableGate({ ...base, nodes: 3, fillPct: 20 }).ok).toBe(false);
    const ok = ecxEnableGate({ ...base, nodes: 8, fillPct: 40, reserve: 'auto' });
    expect(ok.ok).toBe(true);
    expect(ok.usedAfterTB).toBeLessThan(ok.usedNowTB);
    expect(ecxEnableGate({ ...base, nodes: 8, fillPct: 95, reserve: 'auto' }).ok).toBe(false);
  });
});

describe('failure-domain minimums with EC-X', () => {
  it('needs 4 blocks at RF2 and 6 at RF3 with EC-X, 3 and 5 without', () => {
    expect(minBlocks(2)).toBe(3);
    expect(minBlocks(3)).toBe(5);
    expect(minBlocks(2, true)).toBe(4);
    expect(minBlocks(3, true)).toBe(6);
  });

  it('the block row is not protected with EC-X on and too few blocks', () => {
    const o = { rf: 2 as RF, nodes: 6, nodesPerBlock: 2, blockAware: true, racks: 1, rackAware: false };
    expect(survivalMatrix(o).find((r) => r.domain === 'Block')!.survives).toBe(1);
    expect(survivalMatrix({ ...o, ecx: true }).find((r) => r.domain === 'Block')!.survives).toBe(0);
    expect(survivalMatrix({ ...o, nodes: 8, ecx: true }).find((r) => r.domain === 'Block')!.survives).toBe(1);
  });
});

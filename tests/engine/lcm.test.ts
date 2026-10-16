import { describe, it, expect } from 'vitest';
import {
  simulateLcm,
  lcmStateAt,
  lcmOutCount,
  sampleTimes,
  canStart,
  resolveSelection,
  planBatches,
  preChecks,
  DEFAULT_MINUTES,
  type LcmConfig,
  type LcmSim,
} from '../../src/engine/lcm';

const base = (p: Partial<LcmConfig> = {}): LcmConfig => ({
  nodes: 4,
  rf: 2,
  vms: 16,
  memLoadPct: 55,
  selected: ['aos', 'ahv', 'bmc', 'bios'],
  minutes: { ...DEFAULT_MINUTES },
  degraded: false,
  witness: true,
  vmsShutDown: false,
  fail: null,
  repairAt: null,
  ...p,
});

/** Invariant 6: never more than one node out for LCM, and a new node is only taken out when the previous one is back and resiliency is Normal. */
function checkOneAtATime(sim: LcmSim) {
  for (const t of sampleTimes(sim)) expect(lcmOutCount(sim, t)).toBeLessThanOrEqual(1);
  const visits = sim.visits;
  for (let i = 1; i < visits.length; i++) {
    expect(visits[i].start).toBeGreaterThanOrEqual(visits[i - 1].end - 1e-6);
  }
  if (sim.unhealthy) {
    const [a, z] = sim.unhealthy;
    for (const v of visits) {
      // no node is taken out of service while resiliency is not Normal
      if (v.outStart >= 0) expect(v.outStart < a || v.outStart >= z).toBe(true);
    }
  }
  // when LCM begins a node, every other node is in service and not failed, and the previous resync is finished
  for (const v of visits) {
    const st = lcmStateAt(sim, v.start);
    for (const n of st.nodes) if (n.id !== v.node) expect(n.out || n.failed).toBe(false);
    if (sim.unhealthy) expect(v.start < sim.unhealthy[0] || v.start >= sim.unhealthy[1]).toBe(true);
  }
}

describe('LCM pre-checks (invariant 6, part 1)', () => {
  it('refuses to start when the cluster is degraded', () => {
    const cfg = base({ degraded: true });
    expect(canStart(cfg).ok).toBe(false);
    const sim = simulateLcm(cfg);
    expect(sim.blocked).toBe(true);
    expect(sim.segs.length).toBe(0);
    expect(sim.doneAt).toBeNull();
    expect(preChecks(cfg).find((c) => c.id === 'resiliency')!.ok).toBe(false);
    expect(lcmStateAt(sim, sim.end).resiliency.state).toBe('degraded');
  });

  it('starts on a healthy cluster and finishes every node', () => {
    const sim = simulateLcm(base());
    expect(sim.blocked).toBe(false);
    expect(sim.doneAt).not.toBeNull();
    const view = lcmStateAt(sim, sim.end);
    expect(view.done).toBe(true);
    for (const n of view.nodes) expect(n.done).toEqual(['aos', 'ahv', 'fw']);
  });

  it('blocks when the other hosts cannot absorb one node’s VMs', () => {
    expect(canStart(base({ nodes: 3, memLoadPct: 80 })).ok).toBe(false);
    expect(canStart(base({ nodes: 3, memLoadPct: 60 })).ok).toBe(true);
  });

  it('refuses to start with nothing selected', () => {
    expect(canStart(base({ selected: [] })).ok).toBe(false);
  });
});

describe('ordering and dependencies', () => {
  it('auto-adds drive firmware with HBA firmware', () => {
    const r = resolveSelection(['hba'], 4);
    expect(r.selected).toContain('disks');
    expect(r.added.map((a) => a.id)).toEqual(['disks']);
  });

  it('orders Foundation, AOS, AHV, firmware (BMC before BIOS), NCC', () => {
    const b = planBatches(resolveSelection(['ncc', 'bios', 'bmc', 'ahv', 'aos', 'foundation'], 4).selected);
    expect(b.map((x) => x.id)).toEqual(['foundation', 'aos', 'ahv', 'fw', 'ncc']);
    expect(b.find((x) => x.id === 'fw')!.comps).toEqual(['bmc', 'bios']);
  });
});

describe('rolling upgrade, one node at a time (invariant 6, part 2)', () => {
  for (const nodes of [3, 4, 8, 16]) {
    it(`never has two nodes out on ${nodes} nodes`, () => {
      const sim = simulateLcm(base({ nodes, vms: nodes * 4 }));
      checkOneAtATime(sim);
      expect(sim.visits.length).toBe(nodes * 3);
    });
  }

  it('a planned upgrade on 3+ nodes causes no VM downtime and no data unavailability', () => {
    const sim = simulateLcm(base({ nodes: 6, vms: 24 }));
    const v = lcmStateAt(sim, sim.end);
    expect(v.impact.vmDownMin).toBe(0);
    expect(v.impact.unavailMin).toBe(0);
    expect(v.impact.migrations).toBeGreaterThan(0);
    // every VM ends on its home node
    for (const vm of v.vms) expect(vm.node).toBe(vm.home);
  });

  it('VMs leave a node before it goes out of service', () => {
    const sim = simulateLcm(base({ nodes: 4, selected: ['ahv'] }));
    for (const v of sim.visits) {
      const st = lcmStateAt(sim, v.outStart + 1);
      expect(st.vms.filter((x) => x.node === v.node && !x.moving).length).toBe(0);
    }
  });

  it('AOS upgrades keep VMs on their host', () => {
    const sim = simulateLcm(base({ selected: ['aos'] }));
    expect(sim.moves.length).toBe(0);
    checkOneAtATime(sim);
  });
});

describe('failure mid-upgrade: LCM pauses instead of compounding', () => {
  const firstOut = (sim: LcmSim) => sim.visits[0];

  it('pauses with no repair and takes no further node out', () => {
    const clean = simulateLcm(base({ nodes: 5, selected: ['ahv'] }));
    const v0 = firstOut(clean);
    const failAt = v0.outStart + 60; // N1 is out for its upgrade
    const sim = simulateLcm(base({ nodes: 5, selected: ['ahv'], fail: { at: failAt, node: 3 } }));
    checkOneAtATime(sim);
    expect(sim.doneAt).toBeNull();
    expect(sim.pausedAt).not.toBeNull();
    // only the in-flight node was visited; no new node taken out after the failure
    for (const v of sim.visits) if (v.outStart >= 0) expect(v.outStart).toBeLessThan(failAt);
    expect(lcmStateAt(sim, sim.end).paused).toBe(true);
  });

  it('on RF2 the overlap is shown honestly as possible data unavailability', () => {
    const clean = simulateLcm(base({ nodes: 5, selected: ['ahv'] }));
    const failAt = firstOut(clean).outStart + 60;
    const sim = simulateLcm(base({ nodes: 5, selected: ['ahv'], fail: { at: failAt, node: 3 } }));
    expect(sim.unavailable.length).toBe(1);
    const mid = lcmStateAt(sim, failAt + 30);
    expect(mid.resiliency.state).toBe('unavailable');
    expect(lcmStateAt(sim, sim.end).impact.unavailMin).toBeGreaterThan(0);
  });

  it('on RF3 the same overlap is tolerated but LCM still pauses', () => {
    const clean = simulateLcm(base({ nodes: 5, rf: 3, selected: ['ahv'] }));
    const failAt = firstOut(clean).outStart + 60;
    const sim = simulateLcm(base({ nodes: 5, rf: 3, selected: ['ahv'], fail: { at: failAt, node: 3 } }));
    expect(sim.unavailable.length).toBe(0);
    expect(lcmStateAt(sim, failAt + 30).resiliency.state).toBe('reduced');
    expect(sim.pausedAt).not.toBeNull();
  });

  it('resumes after repair and resync, and still never overlaps', () => {
    const clean = simulateLcm(base({ nodes: 5, selected: ['ahv', 'bios'] }));
    const failAt = clean.visits[2].outStart + 30;
    const repairAt = failAt + 40 * 60;
    const sim = simulateLcm(base({ nodes: 5, selected: ['ahv', 'bios'], fail: { at: failAt, node: 4 }, repairAt }));
    checkOneAtATime(sim);
    expect(sim.doneAt).not.toBeNull();
    const [, healthy] = sim.unhealthy!;
    expect(healthy).toBeGreaterThan(repairAt);
    const after = sim.visits.filter((v) => v.start >= failAt);
    expect(after.length).toBeGreaterThan(0);
    for (const v of after) expect(v.outStart).toBeGreaterThanOrEqual(healthy);
    expect(lcmStateAt(sim, sim.end).nodes.every((n) => n.done.includes('ahv') && n.done.includes('fw'))).toBe(true);
  });

  it('a failure while a node is evacuating stops LCM before that node goes out', () => {
    const clean = simulateLcm(base({ nodes: 4, selected: ['ahv'] }));
    const v1 = clean.visits[1];
    const failAt = v1.start + 1; // during evacuation of N2
    const sim = simulateLcm(base({ nodes: 4, selected: ['ahv'], fail: { at: failAt, node: 3 } }));
    checkOneAtATime(sim);
    expect(sim.segs.some((s) => s.aborted)).toBe(true);
    for (const t of sampleTimes(sim)) if (t > failAt) expect(lcmOutCount(sim, t)).toBe(0);
    expect(sim.unavailable.length).toBe(0);
  });

  it('VMs on the failed node are restarted by HA (counted as impact)', () => {
    const sim = simulateLcm(base({ nodes: 4, selected: ['ahv'], fail: { at: 10 * 60, node: 2 }, repairAt: 40 * 60 }));
    const v = lcmStateAt(sim, sim.end);
    expect(v.impact.vmDownMin).toBeGreaterThan(0);
  });
});

describe('small clusters', () => {
  it('1-node: firmware is dropped, and guest VMs must be shut down first', () => {
    const r = resolveSelection(['aos', 'ahv', 'bios'], 1);
    expect(r.selected).toEqual(['aos', 'ahv']);
    expect(r.dropped.map((d) => d.id)).toEqual(['bios']);
    expect(canStart(base({ nodes: 1, selected: ['aos'] })).ok).toBe(false);
    const sim = simulateLcm(base({ nodes: 1, vms: 4, selected: ['aos', 'ahv'], vmsShutDown: true }));
    expect(sim.blocked).toBe(false);
    const mid = lcmStateAt(sim, sim.visits[0].outStart + 10);
    expect(mid.resiliency.state).toBe('offline');
    expect(mid.vms.every((v) => v.state === 'off')).toBe(true);
    expect(lcmStateAt(sim, sim.end).impact.vmDownMin).toBeGreaterThan(0);
  });

  it('2-node: requires a Witness and resyncs longer', () => {
    expect(canStart(base({ nodes: 2, witness: false, memLoadPct: 40 })).ok).toBe(false);
    const two = simulateLcm(base({ nodes: 2, memLoadPct: 40, selected: ['ahv'] }));
    const three = simulateLcm(base({ nodes: 3, memLoadPct: 40, selected: ['ahv'] }));
    const r2 = two.segs.find((s) => s.phase === 'resync')!;
    const r3 = three.segs.find((s) => s.phase === 'resync')!;
    expect(r2.end - r2.start).toBeGreaterThan(r3.end - r3.start);
    checkOneAtATime(two);
  });

  it('2-node: losing the other node while one is out leaves the cluster unable to serve data', () => {
    const clean = simulateLcm(base({ nodes: 2, memLoadPct: 40, selected: ['ahv'] }));
    const failAt = clean.visits[0].outStart + 30;
    const sim = simulateLcm(base({ nodes: 2, memLoadPct: 40, selected: ['ahv'], fail: { at: failAt, node: 1 } }));
    expect(sim.unavailable.length).toBe(1);
    expect(lcmStateAt(sim, failAt + 10).resiliency.state).toBe('unavailable');
  });
});

describe('determinism', () => {
  it('same inputs give identical timelines', () => {
    const cfg = base({ nodes: 6, fail: { at: 3000, node: 4 }, repairAt: 6000 });
    expect(JSON.stringify(simulateLcm(cfg))).toBe(JSON.stringify(simulateLcm(cfg)));
  });
});

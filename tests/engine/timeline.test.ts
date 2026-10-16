import { describe, it, expect } from 'vitest';
import { createCluster } from '../../src/engine/cluster';
import { applyFailure, recoverNode } from '../../src/engine/failures';
import { advance, replay, haReserveAllowed, haReserveHosts } from '../../src/engine/rebuild';
import { blockAwareAllowed, rackAwareAllowed, edgeAdvisory } from '../../src/engine/rules';
import { survivalMatrix, recommendedReserve, computeCapacity } from '../../src/engine/capacity';
import { deriveStatus } from '../../src/engine/status';
import {
  Timeline,
  decodeActs,
  encodeActs,
  toTimed,
  scriptActs,
  gameActs,
  scoreRun,
  insights,
  victims,
  describeAct,
  type Act,
} from '../../src/engine/timeline';

const same = (a: unknown, b: unknown) => expect(JSON.stringify(a)).toBe(JSON.stringify(b));

describe('timeline replay', () => {
  const s0 = createCluster({ nodes: 6, seed: 4 });
  const acts: Act[] = [
    { t: 60, k: 'fail', f: { kind: 'node', node: 5 } },
    { t: 900, k: 'fail', f: { kind: 'disk', disk: '2.1' } },
    { t: 1500, k: 'migrate', vm: 3, to: 1 },
  ];

  it('matches replay() at any time, scrubbing forward and backward', () => {
    const tl = new Timeline(s0, acts);
    for (const t of [0, 55, 60, 65, 900, 3000, 1200, 30, 7200, 4000]) same(tl.at(t), replay(s0, toTimed(acts), t));
  });

  it('reuses checkpoints when an action is added later, and still matches replay()', () => {
    const tl = new Timeline(s0, acts);
    tl.extend(6 * 3600);
    const more: Act[] = [...acts, { t: 4000, k: 'recover', node: 5 }];
    const tl2 = new Timeline(s0, more, tl);
    expect(tl2.computedUntil).toBeGreaterThan(3000);
    expect(tl2.computedUntil).toBeLessThanOrEqual(4000);
    for (const t of [100, 3990, 4000, 4010, 9000]) same(tl2.at(t), replay(s0, toTimed(more), t));
    // removing an action invalidates from its time
    const fewer = acts.slice(0, 1);
    const tl3 = new Timeline(s0, fewer, tl2);
    expect(tl3.computedUntil).toBeLessThanOrEqual(900);
    same(tl3.at(5000), replay(s0, toTimed(fewer), 5000));
  });

  it('settles after self-healing completes, and samples record the dip and recovery', () => {
    const tl = new Timeline(s0, acts.slice(0, 1));
    tl.extend(10 * 3600);
    const settled = tl.settledAt();
    expect(settled).not.toBeNull();
    expect(tl.samples.some((x) => x.health === 'Critical')).toBe(true);
    const end = tl.samples[tl.samples.length - 1];
    expect(end.resiliency).toBe('OK');
    expect(tl.samples.find((x) => x.t === settled)!.resiliency).toBe('OK');
  });

  it('is fast enough to scrub a 32-node cluster', () => {
    const big = createCluster({ nodes: 32, vms: 128, seed: 3 });
    const tl = new Timeline(big, [{ t: 60, k: 'fail', f: { kind: 'node', node: 7 } }]);
    tl.extend(4 * 3600);
    const t0 = performance.now();
    const seeks = 60;
    for (let k = 0; k < seeks; k++) tl.at(((k * 7919) % 144) * 100);
    const per = (performance.now() - t0) / seeks;
    // one checkpoint interval (30 ticks) at most per seek; generous bound for slow CI
    expect(per).toBeLessThan(40);
  });
});

describe('action encoding', () => {
  it('round-trips every action kind and skips junk', () => {
    const acts: Act[] = [
      { t: 60, k: 'fail', f: { kind: 'node', node: 3 } },
      { t: 70, k: 'fail', f: { kind: 'cvm', node: 0 } },
      { t: 80, k: 'fail', f: { kind: 'partition', node: 2 } },
      { t: 90, k: 'fail', f: { kind: 'disk', disk: '4.2' } },
      { t: 100, k: 'fail', f: { kind: 'block', block: 1 } },
      { t: 110, k: 'fail', f: { kind: 'rack', rack: 0 } },
      { t: 120, k: 'recover', node: 3 },
      { t: 130, k: 'add' },
      { t: 140, k: 'remove', node: 6 },
      { t: 150, k: 'migrate', vm: 12, to: 4 },
      { t: 160, k: 'replace', disk: '4.2' },
    ];
    const str = encodeActs(acts);
    expect(str).toMatch(/^[0-9a-z.~-]+$/);
    same(decodeActs(str), acts);
    expect(decodeActs('junk~60n~x~60n2')).toEqual([{ t: 60, k: 'fail', f: { kind: 'node', node: 2 } }]);
    for (const a of acts) expect(describeAct(a).length).toBeGreaterThan(5);
  });
});

describe('engine additions', () => {
  it('logs detection after a failure and a loss event when data goes unavailable', () => {
    let s = createCluster({ nodes: 5, fillPct: 50, seed: 21 });
    s = applyFailure(s, { kind: 'node', node: 3 });
    s = advance(s, 20);
    expect(s.events.some((e) => e.kind === 'detect' && /N4/.test(e.text))).toBe(true);
    s = applyFailure(s, { kind: 'node', node: 4 });
    expect(s.events.some((e) => e.kind === 'loss')).toBe(true);
  });

  it('records the HA restart queue in order', () => {
    let s = createCluster({ nodes: 4, seed: 3, vmMemLoadPct: 40 });
    const on = s.vms.filter((v) => v.node === 2).length;
    s = applyFailure(s, { kind: 'node', node: 2 });
    s = advance(s, 600);
    expect(s.ha!.length).toBe(on);
    expect(s.ha!.map((r) => r.order)).toEqual(Array.from({ length: on }, (_, i) => i + 1));
    expect(s.ha!.every((r) => r.restartedAt !== null && r.to !== null && r.to !== 2)).toBe(true);
    const times = s.ha!.map((r) => r.restartedAt!);
    expect(times.slice().sort((a, b) => a - b)).toEqual(times);
  });

  it('HA memory reservation guarantees restarts that best effort cannot', () => {
    const base = { nodes: 8, seed: 5, vmMemLoadPct: 86, vms: 16 };
    let off = createCluster({ ...base, haReserve: false });
    off = advance(applyFailure(off, { kind: 'node', node: 7 }), 900);
    let on = createCluster({ ...base, haReserve: true });
    on = advance(applyFailure(on, { kind: 'node', node: 7 }), 900);
    expect(off.vms.some((v) => v.state === 'failed')).toBe(true);
    expect(on.vms.every((v) => v.state === 'running')).toBe(true);
  });

  it('VMs that could not restart get another try when capacity returns', () => {
    let s = createCluster({ nodes: 4, seed: 5, vmMemLoadPct: 95, vms: 8 });
    s = advance(applyFailure(s, { kind: 'node', node: 3 }), 600);
    expect(s.vms.some((v) => v.state === 'failed')).toBe(true);
    s = advance(recoverNode(s, 3), 300);
    expect(s.vms.every((v) => v.state === 'running')).toBe(true);
  });

  it('single-node cluster protects data across drives and heals a drive failure', () => {
    let s = createCluster({ nodes: 1, vms: 4, fillPct: 30, seed: 2 });
    expect(s.items.every((it) => it.members.length === 2 && it.members[0].disk !== it.members[1].disk)).toBe(true);
    expect(deriveStatus(s).resiliency).toBe('OK');
    s = applyFailure(s, { kind: 'disk', disk: '0.1' });
    expect(deriveStatus(s).items.under).toBeGreaterThan(0);
    s = advance(s, 6 * 3600);
    const st = deriveStatus(s);
    expect(st.items.under).toBe(0);
    expect(st.resiliency).toBe('OK');
  });

  it('two-node cluster: survivor goes to single-node mode, re-protects across drives, resyncs after 15 min', () => {
    let s = createCluster({ nodes: 2, nodesPerBlock: 1, vms: 6, seed: 2, vmMemLoadPct: 40, fillPct: 30, rebuildTBph: 4 });
    const st0 = deriveStatus(s);
    expect(st0.resiliency).toBe('OK');
    expect(st0.health).toBe('OK');
    s = applyFailure(s, { kind: 'node', node: 1 });
    s = advance(s, 30);
    expect(s.rebuild.startedAt).toBeNull(); // switch to single-node mode takes 30-60 s
    s = advance(s, 6 * 3600);
    const st = deriveStatus(s);
    expect(s.events.some((e) => /single-node mode/.test(e.text))).toBe(true);
    expect(st.zk.quorum).toBe(true);
    expect(st.items.unavailable).toBe(0);
    expect(st.items.under).toBe(0);
    expect(st.resiliency).toBe('Critical');
    expect(st.protectionLimit).toMatch(/single-node mode/);
    // two copies, on different drives of the survivor
    for (const it of s.items) {
      const live = it.members.filter((m) => m.node === 0);
      expect(live.length).toBe(2);
      expect(live[0].disk).not.toBe(live[1].disk);
    }
    expect(s.vms.every((v) => v.state === 'running' && v.node === 0)).toBe(true);
    // the peer returns: nothing moves for 15 minutes, then copies go back across both nodes
    s = recoverNode(s, 1);
    s = advance(s, 14 * 60);
    expect(s.items.every((it) => it.members.every((m) => m.node === 0))).toBe(true);
    s = advance(s, 8 * 3600);
    expect(s.items.every((it) => new Set(it.members.map((m) => m.node)).size === 2)).toBe(true);
    expect(deriveStatus(s).resiliency).toBe('OK');
    expect(s.events.some((e) => /Two-node mode restored/.test(e.text))).toBe(true);
  });

  it('3-node cluster after a node loss: data re-protected but cannot absorb another failure, with the reason', () => {
    let s = createCluster({ nodes: 3, nodesPerBlock: 1, fillPct: 30, seed: 4 });
    s = advance(applyFailure(s, { kind: 'node', node: 2 }), 12 * 3600);
    const st = deriveStatus(s);
    expect(st.items.under).toBe(0);
    expect(st.tolerable).toBe(0);
    expect(st.resiliency).toBe('Critical');
    expect(st.protectionLimit).toMatch(/at least 3/);
  });

  it('HA restarts begin about 60 s after a host failure and finish by about 120 s', () => {
    let s = createCluster({ nodes: 4, seed: 3, vmMemLoadPct: 40, vms: 40 });
    s = applyFailure(s, { kind: 'node', node: 1 });
    const t0 = s.time;
    s = advance(s, 50);
    expect(s.vms.filter((v) => v.state === 'restarting').length).toBeGreaterThan(5);
    s = advance(s, 80);
    const done = s.ha!.map((r) => r.restartedAt! - t0);
    expect(Math.min(...done)).toBeGreaterThanOrEqual(60);
    expect(Math.max(...done)).toBeLessThanOrEqual(120);
  });

  it('HA reservation holds two hosts of memory at RF3', () => {
    const rf2 = createCluster({ nodes: 6, vmMemLoadPct: 75, seed: 2 });
    const rf3 = createCluster({ nodes: 6, rf: 3, ft: 3, vmMemLoadPct: 75, seed: 2 });
    expect(haReserveHosts(rf2.cfg)).toBe(1);
    expect(haReserveHosts(rf3.cfg)).toBe(2);
    expect(haReserveAllowed(rf2).ok).toBe(true); // 75% fits on 5 of 6 hosts
    const r3 = haReserveAllowed(rf3); // but not on 4 of 6
    expect(r3.ok).toBe(false);
    expect(r3.reason).toMatch(/two hosts/);
  });

  it('locality is rebuilt after a CVM returns', () => {
    let s = createCluster({ nodes: 5, seed: 8, coldPct: 0, fillPct: 30 });
    s = applyFailure(s, { kind: 'cvm', node: 4 });
    s = advance(s, 4 * 3600);
    const before = insights(s).localityPct;
    expect(before).toBeLessThan(100);
    s = advance(recoverNode(s, 4), 3 * 3600);
    expect(insights(s).localityPct).toBeGreaterThan(before);
  });
});

describe('gauntlet scripts', () => {
  it('victims avoid Zookeeper nodes when possible', () => {
    const s = createCluster({ nodes: 8, seed: 7 });
    const v = victims(s);
    expect(s.nodes[v[0]].zk).toBe(false);
    expect(s.nodes[v[1]].zk).toBe(false);
  });

  it('second failure during rebuild: RF2 loses access to some data, RF3 does not', () => {
    const run = (rf: 2 | 3) => {
      const s0 = createCluster({ nodes: 8, rf, ft: rf, seed: 7, fillPct: 50 });
      const tl = new Timeline(s0, scriptActs('second', s0));
      return deriveStatus(tl.at(3 * 3600));
    };
    expect(run(2).items.unavailable).toBeGreaterThan(0);
    const r3 = run(3);
    expect(r3.items.unavailable).toBe(0);
  });

  it('nearly full cluster reports it cannot self-heal, with the reason', () => {
    const s0 = createCluster({ nodes: 4, fillPct: 85, seed: 13 });
    const tl = new Timeline(s0, scriptActs('full', s0));
    const st = deriveStatus(tl.at(12 * 3600));
    expect(st.selfHeal.state).toBe('blocked');
    expect(st.selfHeal.reason).toMatch(/capacity/);
  });

  it('game rounds are reproducible and scoring is bounded', () => {
    const s0 = createCluster({ nodes: 8, seed: 7 });
    same(gameActs(s0, 5), gameActs(s0, 5));
    expect(JSON.stringify(gameActs(s0, 5))).not.toBe(JSON.stringify(gameActs(s0, 6)));
    const tl = new Timeline(s0, gameActs(s0, 5));
    tl.extend(6 * 3600);
    const sc = scoreRun(tl.samples, 6 * 3600);
    expect(sc.points).toBeGreaterThanOrEqual(0);
    expect(sc.points).toBeLessThanOrEqual(100);
    expect(scoreRun(new Timeline(s0, []).samples, 0).points).toBe(100);
  });
});

describe('fact-check rule updates', () => {
  it('block and rack awareness need one more domain with EC-X (4 at RF2, 6 at RF3)', () => {
    expect(blockAwareAllowed(2, 3).ok).toBe(true);
    expect(blockAwareAllowed(2, 3, true).ok).toBe(false);
    expect(blockAwareAllowed(2, 4, true).ok).toBe(true);
    expect(blockAwareAllowed(3, 5, true).ok).toBe(false);
    expect(blockAwareAllowed(3, 6, true).ok).toBe(true);
    expect(rackAwareAllowed(2, 3, true).reason).toMatch(/at least 4 racks/);
    expect(rackAwareAllowed(3, 6, true).ok).toBe(true);
    // effective domain falls back to node when EC-X raises the minimum
    expect(createCluster({ nodes: 6, nodesPerBlock: 2, blockAware: true }).domain).toBe('block');
    expect(createCluster({ nodes: 6, nodesPerBlock: 2, blockAware: true, ecx: true }).domain).toBe('node');
    const m = survivalMatrix({ rf: 2, nodes: 6, nodesPerBlock: 2, blockAware: true, racks: 1, rackAware: false, ecx: true });
    expect(m.find((r) => r.domain === 'Block')!.survives).toBe(0);
    expect(recommendedReserve({ nodes: 6, rf: 2, nodesPerBlock: 2, blockAware: true, ecx: true }).nodes).toBe(1);
    expect(recommendedReserve({ nodes: 6, rf: 2, nodesPerBlock: 2, blockAware: true }).nodes).toBe(2);
  });

  it('EC-X strips under block awareness fit one member per block with a spare block', () => {
    const s = createCluster({ nodes: 8, nodesPerBlock: 2, blockAware: true, ecx: true, coldPct: 100, seed: 3 });
    expect(s.domain).toBe('block');
    const ec = s.items.filter((i) => i.kind === 'ec');
    expect(ec.length).toBeGreaterThan(0);
    for (const it of ec) {
      expect(it.target).toBe(3); // 4 blocks -> 2/1
      expect(new Set(it.members.map((m) => s.nodes[m.node].block)).size).toBe(it.members.length);
    }
  });

  it('manual block reserve holds one block per tolerated failure, like the automatic one', () => {
    const base = { nodes: 12, drivesPerNode: 6, driveTB: 3.84, ecx: false, coldPct: 60, nodesPerBlock: 2, blockAware: true, dataReduction: 1, systemOverheadPct: 0 };
    expect(computeCapacity({ ...base, rf: 2, reserve: 'block' }).reserveNodes).toBe(2);
    expect(computeCapacity({ ...base, rf: 3, reserve: 'block' }).reserveNodes).toBe(4);
    expect(computeCapacity({ ...base, rf: 3, reserve: 'block' }).reserveNodes).toBe(computeCapacity({ ...base, rf: 3, reserve: 'auto' }).reserveNodes);
  });

  it('edge advisories match the documented behavior', () => {
    expect(edgeAdvisory(2)).toMatch(/single-node mode/);
    expect(edgeAdvisory(2)).not.toMatch(/single data copy/);
    expect(edgeAdvisory(1)).toMatch(/different drives/);
  });
});

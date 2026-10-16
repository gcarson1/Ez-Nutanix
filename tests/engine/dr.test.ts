import { describe, it, expect } from 'vitest';
import {
  RPO_STOPS,
  buildSequence,
  classifyRpo,
  effectiveTier,
  exposureAt,
  keepsUp,
  recoveryOptions,
  replicatedPoints,
  stateAt,
  syncGate,
  transferTime,
  worstExposure,
  type FailoverOpts,
  type Link,
} from '../../src/engine/dr';

describe('RPO classification', () => {
  it('maps RPO to the documented tiers', () => {
    expect(classifyRpo(0)).toBe('sync');
    expect(classifyRpo(60)).toBe('nearsync');
    expect(classifyRpo(900)).toBe('nearsync');
    expect(classifyRpo(3600)).toBe('async');
    expect(classifyRpo(86400)).toBe('async');
  });
  it('treats values between tiers as no tier', () => {
    expect(classifyRpo(30)).toBe('none');
    expect(classifyRpo(1800)).toBe('none');
  });
  it('every slider stop is a valid tier', () => {
    for (const s of RPO_STOPS) expect(classifyRpo(s)).not.toBe('none');
  });
});

describe('sync latency gate', () => {
  it('allows sync under 5 ms round trip and blocks at or above it, with a reason', () => {
    expect(syncGate(4.9).allowed).toBe(true);
    expect(syncGate(5).allowed).toBe(false);
    expect(syncGate(12).reason).toMatch(/5 ms/);
    expect(effectiveTier(0, 8).blocked).toBe(true);
    expect(effectiveTier(0, 2).tier).toBe('sync');
  });
  it('does not gate async or NearSync on latency', () => {
    expect(effectiveTier(300, 80).tier).toBe('nearsync');
    expect(effectiveTier(3600, 80).tier).toBe('async');
  });
});

describe('exposure', () => {
  const link: Link = { rpoS: 3600, changeMBps: 1, bwMBps: 10 };
  it('is zero for synchronous', () => {
    expect(exposureAt({ ...link, rpoS: 0 }, 5000)).toBe(0);
    expect(worstExposure({ ...link, rpoS: 0 })).toBe(0);
  });
  it('is a sawtooth that never exceeds RPO plus transfer time when the link keeps up', () => {
    const worst = worstExposure(link);
    expect(worst).toBe(3600 + 360);
    for (let t = 0; t < 5 * 3600; t += 37) expect(exposureAt(link, t)).toBeLessThanOrEqual(worst + 1e-9);
    // Just before the second point lands the exposure is at its peak; just after, it drops.
    const land = replicatedPoints(link, 7200)[1].landed;
    expect(exposureAt(link, land - 1)).toBeGreaterThan(exposureAt(link, land));
  });
  it('grows without bound when bandwidth cannot keep up with the change rate', () => {
    const slow: Link = { rpoS: 600, changeMBps: 5, bwMBps: 2 };
    expect(keepsUp(slow)).toBe(false);
    expect(worstExposure(slow)).toBe(Infinity);
    expect(transferTime(slow)).toBeGreaterThan(600);
    expect(exposureAt(slow, 20 * 600)).toBeGreaterThan(exposureAt(slow, 5 * 600));
  });
});

const base: FailoverOpts = {
  kind: 'planned',
  tier: 'async',
  lagS: 1800,
  witness: false,
  stageDelayS: 30,
  stages: [
    { name: 'Database', vms: ['db1'] },
    { name: 'App', vms: ['app1'] },
    { name: 'Web', vms: ['web1', 'web2'] },
  ],
  netMap: true,
  scripts: true,
};

describe('failover state machine', () => {
  it('planned failover loses no data', () => {
    expect(buildSequence(base).dataLossS).toBe(0);
  });
  it('unplanned failover loses exactly the replication lag', () => {
    const s = buildSequence({ ...base, kind: 'unplanned', lagS: 1234 });
    expect(s.dataLossS).toBe(1234);
    expect(s.manualDecision).toBe(true);
  });
  it('unplanned synchronous failover with a Witness is automatic and loses nothing', () => {
    const s = buildSequence({ ...base, kind: 'unplanned', tier: 'sync', witness: true, lagS: 999 });
    expect(s.dataLossS).toBe(0);
    expect(s.manualDecision).toBe(false);
    const noW = buildSequence({ ...base, kind: 'unplanned', tier: 'sync', witness: false });
    expect(noW.manualDecision).toBe(true);
    expect(noW.duration).toBeGreaterThan(s.duration);
  });
  it('powers stages on in boot order, never out of order', () => {
    const s = buildSequence(base);
    let last = -1;
    for (const st of s.steps) {
      if (st.stage !== undefined) {
        expect(st.stage).toBe(last + 1);
        last = st.stage;
      }
    }
    expect(last).toBe(2);
    const delays = s.steps.filter((x) => x.id.startsWith('delay'));
    expect(delays.length).toBe(2);
  });
  it('test failover never stops production', () => {
    const s = buildSequence({ ...base, kind: 'test' });
    for (let t = 0; t <= s.duration; t += 10) expect(stateAt(s, t).primary).toBe('running');
    expect(s.dataLossS).toBe(0);
    expect(stateAt(s, s.duration).recovery).toBe('off');
  });
  it('state progresses: primary shuts down before the recovery site runs (planned)', () => {
    const s = buildSequence(base);
    expect(stateAt(s, 0).primary).toBe('running');
    const firstStage = s.steps.find((x) => x.stage === 0)!;
    expect(stateAt(s, firstStage.end).primary).toBe('off');
    expect(stateAt(s, firstStage.end).recovery).toBe('running');
    expect(stateAt(s, s.duration).done).toBe(true);
  });
  it('without network mapping the recovered VMs are not reachable', () => {
    expect(buildSequence({ ...base, netMap: false }).reachable).toBe(false);
    expect(buildSequence(base).reachable).toBe(true);
  });
  it('failback replicates changes back before shutting down', () => {
    const s = buildSequence({ ...base, kind: 'failback' });
    const ids = s.steps.map((x) => x.id);
    expect(ids.indexOf('resync')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('resync')).toBeLessThan(ids.indexOf('shutdown'));
    expect(s.dataLossS).toBe(0);
  });
});

describe('multi-site recovery', () => {
  const sites = [
    { id: 'B', name: 'Site B', rpoS: 0, rttMs: 2 },
    { id: 'C', name: 'Site C', rpoS: 60, rttMs: 15 },
    { id: 'D', name: 'Site D', rpoS: 3600, rttMs: 40 },
  ];
  const lag = (s: { rpoS: number }) => s.rpoS;
  it('prefers the synchronous partner when it survives', () => {
    expect(recoveryOptions(sites, [], lag)[0].site.id).toBe('B');
    expect(recoveryOptions(sites, [], lag)[0].lossS).toBe(0);
  });
  it('losing A and B together falls back to NearSync C with its lag as data loss', () => {
    const o = recoveryOptions(sites, ['B'], lag);
    expect(o[0].site.id).toBe('C');
    expect(o[0].lossS).toBe(60);
    expect(o.map((x) => x.site.id)).toEqual(['C', 'D']);
  });
  it('returns nothing when every target is lost', () => {
    expect(recoveryOptions(sites, ['B', 'C', 'D'], lag)).toEqual([]);
  });
});

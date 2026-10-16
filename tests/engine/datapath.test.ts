import { describe, it, expect } from 'vitest';
import { writeSequence, readSequence, replicaTargets, cacheAccess, localitySequence, localitySummary, LATENCY_LADDER, DP_NODES, type CacheState } from '../../src/engine/datapath';
import type { RF } from '../../src/engine/rules';

const RFS: RF[] = [2, 3];
const KINDS = ['random', 'sequential'] as const;

describe('write path', () => {
  it('acknowledges only after all RF copies exist', () => {
    for (const rf of RFS)
      for (const kind of KINDS)
        for (let seed = 0; seed < 20; seed++) {
          const steps = writeSequence({ rf, kind, seed });
          const firstAck = steps.findIndex((s) => s.acked);
          expect(firstAck).toBeGreaterThan(0);
          for (const s of steps.slice(0, firstAck)) expect(s.acked).toBe(false);
          for (const s of steps.slice(firstAck)) {
            const copies = new Set([...s.oplogCopies, ...s.extentCopies]);
            expect(copies.size).toBeGreaterThanOrEqual(rf);
          }
          // the step before the ack already holds all copies
          const prev = steps[firstAck - 1];
          expect(new Set([...prev.oplogCopies, ...prev.extentCopies]).size).toBe(rf);
          // and no step before that one is acked with fewer copies
          for (const s of steps) {
            if (s.acked) expect(new Set([...s.oplogCopies, ...s.extentCopies]).size).toBe(rf);
          }
        }
  });

  it('RF2 replicates to 1 remote CVM and RF3 to 2, never the local node', () => {
    for (let seed = 0; seed < 50; seed++) {
      const t2 = replicaTargets(2, seed);
      const t3 = replicaTargets(3, seed);
      expect(t2).toHaveLength(1);
      expect(t3).toHaveLength(2);
      expect(new Set(t3).size).toBe(2);
      expect([...t2, ...t3]).not.toContain(0);
      for (const n of [...t2, ...t3]) expect(n).toBeLessThan(DP_NODES);
      const rep = writeSequence({ rf: 3, kind: 'random', seed }).find((s) => s.id === 'replicate')!;
      expect(rep.hops.filter((h) => h.kind === 'replicate')).toHaveLength(2);
    }
  });

  it('keeps one copy local on both paths', () => {
    for (const rf of RFS)
      for (const kind of KINDS) {
        const ack = writeSequence({ rf, kind }).find((s) => s.id === 'ack')!;
        expect([...ack.oplogCopies, ...ack.extentCopies]).toContain(0);
      }
  });

  it('sequential writes bypass the OpLog but still honor RF', () => {
    for (const rf of RFS) {
      const steps = writeSequence({ rf, kind: 'sequential', seed: 4 });
      for (const s of steps) {
        expect(s.oplogCopies).toHaveLength(0);
        expect(s.active.some((p) => p.at === 'oplog')).toBe(false);
        expect(s.hops.some((h) => h.to.at === 'oplog' || h.from.at === 'oplog')).toBe(false);
      }
      expect(steps.find((s) => s.id === 'ack')!.extentCopies).toHaveLength(rf);
    }
  });

  it('random writes go through the OpLog and drain to the extent store after the ack', () => {
    const steps = writeSequence({ rf: 2, kind: 'random', seed: 2 });
    const ack = steps.findIndex((s) => s.id === 'ack');
    const drain = steps.findIndex((s) => s.id === 'drain');
    expect(steps[ack].oplogCopies).toHaveLength(2);
    expect(steps[ack].extentCopies).toHaveLength(0);
    expect(drain).toBeGreaterThan(ack);
    expect(steps[drain].extentCopies).toHaveLength(2);
  });

  it('is deterministic for a seed', () => {
    expect(writeSequence({ rf: 3, kind: 'random', seed: 9 })).toEqual(writeSequence({ rf: 3, kind: 'random', seed: 9 }));
  });
});

describe('read path', () => {
  it('checks places in order and stops at the source', () => {
    const order = ['cache', 'oplog', 'local', 'remote'] as const;
    order.forEach((src, i) => {
      const steps = readSequence({ source: src });
      const last = steps[steps.length - 1];
      expect(last.servedFrom).toBe(src);
      expect(last.misses).toEqual(order.slice(0, i));
      const network = steps.some((s) => s.hops.some((h) => h.kind === 'network-read'));
      expect(network).toBe(src === 'remote');
    });
  });

  it('latency ladder is ordered from fastest to slowest', () => {
    for (let i = 1; i < LATENCY_LADDER.length; i++) expect(LATENCY_LADDER[i].units).toBeGreaterThan(LATENCY_LADDER[i - 1].units);
  });
});

describe('content cache', () => {
  it('promotes a second touch from single-touch to multi-touch', () => {
    let s: CacheState = { single: [], multi: [] };
    let r = cacheAccess(s, 'a');
    expect(r.hit).toBeNull();
    expect(r.state.single).toContain('a');
    r = cacheAccess(r.state, 'a');
    expect(r.hit).toBe('single');
    expect(r.state.multi).toContain('a');
    expect(r.state.single).not.toContain('a');
    r = cacheAccess(r.state, 'a');
    expect(r.hit).toBe('multi');
    s = r.state;
    for (const k of ['b', 'c', 'd', 'e', 'f']) s = cacheAccess(s, k).state;
    expect(s.single).toHaveLength(4);
    expect(s.multi).toContain('a'); // one-off reads do not push out multi-touch data
  });
});

describe('data locality after live migration', () => {
  it('reads remotely after the move, then localizes', () => {
    const frames = localitySequence({ extents: 8, seed: 5 });
    const mig = frames.findIndex((f) => f.phase === 'migrate');
    expect(frames.slice(0, mig).every((f) => !f.readRemote && f.networkMB === 0)).toBe(true);
    const first = frames[mig + 1];
    expect(first.readRemote).toBe(true);
    expect(first.localized).toBe(first.read);
    const last = frames[frames.length - 1];
    expect(last.local.every(Boolean)).toBe(true);
    expect(last.readRemote).toBe(false);
    // each extent is fetched remotely at most once
    const s = localitySummary(frames);
    expect(s.remoteReads).toBe(8);
    expect(s.networkMB).toBe(8);
    expect(s.settledLatency).toBe(s.beforeLatency);
    expect(s.afterMoveLatency).toBeGreaterThan(s.beforeLatency);
  });

  it('network traffic stops growing once everything is local', () => {
    const frames = localitySequence({ extents: 6, seed: 1 });
    const allLocal = frames.findIndex((f) => f.phase === 'after' && f.local.every(Boolean));
    for (const f of frames.slice(allLocal + 1)) expect(f.networkMB).toBe(frames[allLocal].networkMB);
  });
});

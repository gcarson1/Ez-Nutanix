import { describe, it, expect } from 'vitest';
import { FAIL_AT, STAGES, buildScene, type DrEvent, type Tier } from '../../src/engine/dr';

const TIERS: Tier[] = ['async', 'nearsync', 'sync'];
const EVENTS: DrEvent[] = ['planned', 'unplanned'];

describe('replication before the event', () => {
  it('the app stops writing before the failover starts', () => {
    for (const tier of TIERS) for (const ev of EVENTS) {
      const s = buildScene(tier, ev);
      expect(s.writes.length).toBeGreaterThan(10);
      for (const w of s.writes) expect(w.t).toBeLessThan(s.fail);
    }
  });
  it('synchronous writes reach Site B before the next write, with no recovery points', () => {
    const s = buildScene('sync', 'unplanned');
    expect(s.ships).toEqual([]);
    for (const w of s.writes) {
      expect(w.atB).toBeGreaterThan(w.t);
      expect(w.atB).toBeLessThan(w.t + 0.4);
    }
  });
  it('async and NearSync ship each write once, in a recovery point taken after it was written', () => {
    for (const tier of ['async', 'nearsync'] as Tier[]) {
      const s = buildScene(tier, 'planned');
      const seen = new Set<number>();
      s.ships.forEach((p, k) => {
        expect(p.land).toBeGreaterThan(p.t);
        for (const i of p.writes) {
          expect(seen.has(i)).toBe(false);
          seen.add(i);
          expect(s.writes[i].t).toBeLessThanOrEqual(p.t + 1e-9);
          expect(s.writes[i].ship).toBe(k);
        }
      });
      expect(seen.size).toBe(s.writes.length);
    }
  });
  it('NearSync takes recovery points more often than async', () => {
    const a = buildScene('async', 'unplanned').ships.filter((p) => p.t < FAIL_AT).length;
    const n = buildScene('nearsync', 'unplanned').ships.filter((p) => p.t < FAIL_AT).length;
    expect(n).toBeGreaterThan(a);
  });
});

describe('planned failover', () => {
  it('loses nothing in any tier: every write is at Site B before the apps start there', () => {
    for (const tier of TIERS) {
      const s = buildScene(tier, 'planned');
      expect(s.lost).toBe(0);
      expect(s.decision).toBe('scheduled');
      for (const w of s.writes) expect(w.atB).toBeLessThanOrEqual(s.go);
    }
  });
  it('ends with a final copy after the apps shut down (async and NearSync)', () => {
    for (const tier of ['async', 'nearsync'] as Tier[]) {
      const s = buildScene(tier, 'planned');
      const last = s.ships[s.ships.length - 1];
      expect(last.final).toBe(true);
      expect(last.t).toBeGreaterThan(s.fail);
    }
  });
});

describe('unplanned failover', () => {
  it('loses exactly the writes that had not reached Site B when Site A was lost', () => {
    for (const tier of TIERS) {
      const s = buildScene(tier, 'unplanned');
      for (const w of s.writes) expect(w.lost).toBe(!(w.atB <= s.fail));
      expect(s.lost).toBe(s.writes.filter((w) => w.lost).length);
    }
  });
  it('sync loses nothing, NearSync a little, async the most', () => {
    const lost = (t: Tier) => buildScene(t, 'unplanned').lost;
    expect(lost('sync')).toBe(0);
    expect(lost('nearsync')).toBeGreaterThan(0);
    expect(lost('async')).toBeGreaterThan(lost('nearsync'));
  });
  it('sync fails over on its own (Witness); the others wait for a person, which takes longer', () => {
    const s = buildScene('sync', 'unplanned');
    const a = buildScene('async', 'unplanned');
    expect(s.decision).toBe('witness');
    expect(a.decision).toBe('person');
    expect(a.go - a.fail).toBeGreaterThan(s.go - s.fail);
  });
});

describe('recovery at Site B', () => {
  it('starts the app tiers in boot order, only after the failover begins', () => {
    for (const tier of TIERS) for (const ev of EVENTS) {
      const s = buildScene(tier, ev);
      expect(s.boot).toHaveLength(STAGES.length);
      expect(s.boot[0]).toBeGreaterThanOrEqual(s.go);
      for (let i = 1; i < s.boot.length; i++) expect(s.boot[i]).toBeGreaterThan(s.boot[i - 1]);
      expect(s.done).toBeGreaterThan(s.boot[s.boot.length - 1]);
      expect(s.end).toBeGreaterThan(s.done);
      const ts = s.phases.map((p) => p.t);
      expect([...ts].sort((x, y) => x - y)).toEqual(ts);
    }
  });
});

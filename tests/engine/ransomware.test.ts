import { describe, it, expect } from 'vitest';
import { FILES, SIM, attackState, timeline, type Response } from '../../src/engine/ransomware';

const BOTH: Response[] = ['alert', 'block'];

describe('Data Lens ransomware scenario', () => {
  it('files are hit only until the attack stops, then only restored', () => {
    for (const r of BOTH) {
      const tl = timeline(r);
      let lastHit = 0;
      let lastRestored = 0;
      for (let t = 0; t <= tl.end; t += 0.05) {
        const s = attackState(tl, t);
        expect(s.hit).toBeGreaterThanOrEqual(lastHit);
        expect(s.restored).toBeGreaterThanOrEqual(lastRestored);
        lastHit = s.hit;
        lastRestored = s.restored;
        if (t >= tl.stopAt) expect(s.hit).toBe(tl.hit);
        expect(s.files.filter((f) => f === 'encrypted')).toHaveLength(s.encrypted);
        expect(s.files.filter((f) => f === 'restored')).toHaveLength(s.restored);
      }
    }
  });

  it('the alert comes before the block, and the PC is blocked when the attack stops', () => {
    for (const r of BOTH) {
      const tl = timeline(r);
      expect(tl.detectAt).toBeGreaterThan(SIM.attackStart);
      expect(tl.blockAt).toBeGreaterThan(tl.detectAt);
      expect(attackState(tl, tl.stopAt).blocked).toBe(true);
      expect(attackState(tl, tl.detectAt - 0.01).alert).toBe(false);
    }
  });

  it('auto-block hits far fewer files than waiting for an admin', () => {
    const auto = timeline('block');
    const manual = timeline('alert');
    expect(auto.hit).toBeGreaterThan(0);
    expect(auto.hit).toBeLessThan(manual.hit / 2);
    expect(manual.hit).toBeLessThanOrEqual(FILES);
  });

  it('recovery restores every hit file', () => {
    for (const r of BOTH) {
      const tl = timeline(r);
      expect(attackState(tl, tl.recoverAt - 0.01).restored).toBe(0);
      const end = attackState(tl, tl.recoveredAt);
      expect(end.phase).toBe('recovered');
      expect(end.encrypted).toBe(0);
      expect(end.restored).toBe(tl.hit);
    }
  });

  it('is deterministic for a seed', () => {
    expect(attackState(timeline('alert', 3), 12)).toEqual(attackState(timeline('alert', 3), 12));
  });
});

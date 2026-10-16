import { describe, it, expect } from 'vitest';
import { FILES, SIM, attackEvents, attackState, timeline, type AttackInput } from '../../src/engine/ransomware';

const ALL: AttackInput[] = [];
for (const tier of ['starter', 'pro'] as const)
  for (const variant of ['known', 'new'] as const)
    for (const autoBlock of [true, false])
      for (const rate of ['slow', 'fast'] as const) ALL.push({ tier, variant, autoBlock, rate });

describe('Data Lens ransomware scenario', () => {
  it('encryption only grows until the attack stops, then holds still', () => {
    for (const i of ALL) {
      const tl = timeline(i);
      let last = 0;
      for (let t = 0; t <= SIM.duration; t += 0.5) {
        const s = attackState(i, tl, t);
        expect(s.encrypted).toBeGreaterThanOrEqual(last);
        last = s.encrypted;
        if (t >= tl.stopAt) expect(s.encrypted).toBe(tl.encryptedTotal);
      }
    }
  });

  it('a new variant on Starter raises no alert and encrypts the whole share', () => {
    for (const i of ALL.filter((x) => x.tier === 'starter' && x.variant === 'new')) {
      const tl = timeline(i);
      expect(tl.detectAt).toBeNull();
      expect(tl.encryptedTotal).toBe(FILES);
      expect(attackState(i, tl, SIM.duration).alert).toBe(false);
    }
  });

  it('detection with automatic blocking limits damage more than an admin acting by hand', () => {
    for (const tier of ['starter', 'pro'] as const)
      for (const variant of ['known', 'new'] as const) {
        if (tier === 'starter' && variant === 'new') continue;
        const auto = timeline({ tier, variant, autoBlock: true, rate: 'fast' });
        const manual = timeline({ tier, variant, autoBlock: false, rate: 'fast' });
        expect(auto.encryptedTotal).toBeLessThan(manual.encryptedTotal);
        expect(auto.encryptedTotal).toBeLessThan(FILES);
      }
  });

  it('recovery cannot start before the attack stops, and restores every encrypted file', () => {
    const i: AttackInput = { tier: 'pro', variant: 'new', autoBlock: true, rate: 'fast' };
    const tl = timeline(i);
    const early = { ...i, recoverAt: tl.stopAt - 1 };
    expect(attackState(early, timeline(early), SIM.duration).restored).toBe(0);
    const ok = { ...i, recoverAt: tl.stopAt + 5 };
    const end = attackState(ok, timeline(ok), SIM.duration);
    expect(end.phase).toBe('recovered');
    expect(end.encrypted).toBe(0);
    expect(end.restored).toBe(tl.encryptedTotal);
    const lostExpected = tl.order.slice(0, tl.encryptedTotal).filter((f) => tl.edited.has(f)).length;
    expect(end.lostEdits).toBe(lostExpected);
    expect(attackEvents(ok, timeline(ok), SIM.duration).slice(-1)[0]?.text).toMatch(/Recovery complete/);
  });

  it('is deterministic for a seed', () => {
    const i: AttackInput = { tier: 'pro', variant: 'known', autoBlock: false, rate: 'slow', seed: 3 };
    expect(attackState(i, timeline(i), 100)).toEqual(attackState(i, timeline(i), 100));
  });
});

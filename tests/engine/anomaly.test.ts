import { describe, expect, it } from 'vitest';
import { RULE, USERS, alerts, flag, workday } from '../../src/engine/anomaly';

const ben = USERS.find((u) => u.id === 'ben')!;
const spike = ben.v.indexOf(600);

describe('Data Lens anomaly scene', () => {
  it('the fixed rule alone raises many alerts and misses the mass delete', () => {
    expect(alerts({ uba: false, exclude: false })).toBe(11);
    expect(ben.v[spike]).toBeLessThan(RULE);
    expect(flag(ben, spike, { uba: false, exclude: false })).toBeNull();
  });

  it('UBA flags the mass delete and clears busy hours; excluding the backup account leaves two alerts', () => {
    expect(workday(spike)).toBe(true);
    expect(flag(ben, spike, { uba: true, exclude: false })).toBe('uba');
    expect(alerts({ uba: true, exclude: false })).toBe(5);
    expect(alerts({ uba: true, exclude: true })).toBe(2);
  });

  it('every user has one value per hour', () => {
    for (const u of USERS) expect(u.v).toHaveLength(24);
  });
});

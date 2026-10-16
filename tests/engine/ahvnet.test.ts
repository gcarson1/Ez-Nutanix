import { describe, it, expect } from 'vitest';
import { uplinkFor, uplinkRole, limits, linkUp, BOND_ORDER, type LinkFail } from '../../src/engine/ahvnet';

const FAILS: LinkFail[] = ['none', 'one'];

describe('AHV bond behavior', () => {
  it('never sends traffic on a down link, in any mode', () => {
    for (const mode of BOND_ORDER)
      for (const fail of FAILS)
        for (let src = 0; src < 6; src++)
          for (let flow = 0; flow < 2; flow++) expect(linkUp(uplinkFor(mode, src, flow, fail), fail)).toBe(true);
  });

  it('active-backup uses one link and keeps the other on standby', () => {
    expect(new Set([0, 1, 2, 3].map((s) => uplinkFor('ab', s, 0, 'none')))).toEqual(new Set([0]));
    expect(uplinkRole('ab', 0, 'none', 4)).toBe('active');
    expect(uplinkRole('ab', 1, 'none', 4)).toBe('standby');
    // failover to the backup
    expect(uplinkFor('ab', 0, 0, 'one')).toBe(1);
    expect(uplinkRole('ab', 0, 'one', 4)).toBe('down');
    expect(uplinkRole('ab', 1, 'one', 4)).toBe('active');
  });

  it('MAC pinning keeps each source on one link, spread across both', () => {
    const used = new Set([0, 1, 2, 3].map((s) => uplinkFor('slb', s, 0, 'none')));
    expect(used).toEqual(new Set([0, 1]));
    for (let s = 0; s < 4; s++) expect(uplinkFor('slb', s, 0, 'none')).toBe(uplinkFor('slb', s, 1, 'none'));
    expect(uplinkRole('slb', 0, 'none', 4)).toBe('carrying');
    expect(uplinkRole('slb', 1, 'none', 4)).toBe('carrying');
  });

  it('LACP spreads one source’s connections across both links', () => {
    expect(new Set([0, 1].map((f) => uplinkFor('lacp', 0, f, 'none')))).toEqual(new Set([0, 1]));
  });

  it('after a link failure every source uses the surviving link', () => {
    for (const mode of BOND_ORDER) for (let s = 0; s < 4; s++) for (let f = 0; f < 2; f++) expect(uplinkFor(mode, s, f, 'one')).toBe(1);
  });

  it('throughput limits follow the bond type and drop to one link on failure', () => {
    expect(limits('ab', 'none')).toEqual({ host: 10, vm: 10, flow: 10 });
    expect(limits('slb', 'none')).toEqual({ host: 20, vm: 10, flow: 10 });
    expect(limits('lacp', 'none')).toEqual({ host: 20, vm: 20, flow: 10 });
    for (const m of BOND_ORDER) expect(limits(m, 'one')).toEqual({ host: 10, vm: 10, flow: 10 });
  });
});

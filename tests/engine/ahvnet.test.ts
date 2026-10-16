import { describe, it, expect } from 'vitest';
import { uplinkFor, uplinkRole, limits, linkUp, nextVlan, BOND_ORDER, type LinkFail } from '../../src/engine/ahvnet';

const FAILS: LinkFail[] = ['none', 'nic', 'switch'];

describe('AHV bond behavior', () => {
  it('never sends traffic on a down uplink, in any mode', () => {
    for (const mode of BOND_ORDER)
      for (const fail of FAILS)
        for (let host = 0; host < 3; host++)
          for (let vm = 0; vm < 6; vm++)
            for (let flow = 0; flow < 2; flow++) {
              const u = uplinkFor(mode, host, vm, flow, fail);
              expect(u).not.toBeNull();
              expect(linkUp(host, u!, fail)).toBe(true);
            }
  });

  it('active-backup uses one uplink and keeps the other on standby', () => {
    expect(new Set([0, 1, 2, 3].map((v) => uplinkFor('ab', 1, v, 0, 'none')))).toEqual(new Set([0]));
    expect(uplinkRole('ab', 1, 0, 'none', 3)).toBe('active');
    expect(uplinkRole('ab', 1, 1, 'none', 3)).toBe('standby');
    // failover to the backup
    expect(uplinkFor('ab', 0, 0, 0, 'nic')).toBe(1);
    expect(uplinkRole('ab', 0, 1, 'nic', 3)).toBe('active');
  });

  it('MAC pinning keeps each VM on one uplink, spread across both', () => {
    const used = new Set([0, 1, 2, 3].map((v) => uplinkFor('slb', 1, v, 0, 'none')));
    expect(used).toEqual(new Set([0, 1]));
    for (let v = 0; v < 4; v++) expect(uplinkFor('slb', 1, v, 0, 'none')).toBe(uplinkFor('slb', 1, v, 1, 'none'));
  });

  it('LACP spreads one VM’s flows across both uplinks', () => {
    expect(new Set([0, 1].map((f) => uplinkFor('lacp', 1, 0, f, 'none')))).toEqual(new Set([0, 1]));
  });

  it('throughput limits follow the bond type and drop to one link on failure', () => {
    expect(limits('ab', 1, 'none')).toEqual({ host: 10, vm: 10, flow: 10 });
    expect(limits('slb', 1, 'none')).toEqual({ host: 20, vm: 10, flow: 10 });
    expect(limits('lacp', 1, 'none')).toEqual({ host: 20, vm: 20, flow: 10 });
    for (const m of BOND_ORDER) expect(limits(m, 0, 'nic').host).toBe(10);
    // a NIC failure on host 1 does not affect host 2
    expect(limits('lacp', 1, 'nic').host).toBe(20);
    // a switch failure affects every host
    expect(limits('lacp', 2, 'switch').host).toBe(10);
  });
});

describe('VLANs', () => {
  it('picks an unused VLAN ID', () => {
    expect(nextVlan([])).toBe(10);
    expect(nextVlan([10, 20])).toBe(30);
    expect(nextVlan([10, 30])).toBe(20);
  });
});

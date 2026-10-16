// AHV networking model for one host with a two-link bond (NIC A cabled to switch A, NIC B to
// switch B): which link each packet from a VM or the CVM leaves on for each bond type, what
// changes when NIC A's link fails, and the throughput limits that follow. Pure and deterministic.
// Source: docs/research/C-lcm-networking.md (AHV Admin Guide 11.2, BP-2071 v4.9). Hash placement is
// illustrative: real OVS hashes by MAC address or by flow and rebalances by load.

export type BondMode = 'ab' | 'slb' | 'lacp';
/** 'one': NIC A loses its link. */
export type LinkFail = 'none' | 'one';
/** 0 = NIC A (to switch A), 1 = NIC B (to switch B). */
export type Uplink = 0 | 1;

export interface BondDef {
  /** Short name used on the choice buttons. */
  short: string;
  /** Prism "Bond Type" name. */
  prism: string;
  /** What the top-of-rack switches need, in two or three words. */
  switchSetup: string;
}

export const BONDS: Record<BondMode, BondDef> = {
  ab: { short: 'Active-backup', prism: 'Active-Backup (default, recommended)', switchSetup: 'None' },
  slb: { short: 'Balance-SLB', prism: 'Active-Active with MAC pinning (balance-slb)', switchSetup: 'None' },
  lacp: { short: 'LACP', prism: 'Active-Active (balance-tcp with LACP)', switchSetup: 'LACP + LAG' },
};

export const BOND_ORDER: BondMode[] = ['ab', 'slb', 'lacp'];

export function linkUp(nic: Uplink, fail: LinkFail): boolean {
  return !(fail === 'one' && nic === 0);
}

/**
 * The link a packet leaves on. `source` is the VM or CVM, `flow` which of its connections.
 * Active-backup: the active link (NIC A here; chosen when the host boots in reality). MAC pinning:
 * by source (its MAC address). LACP: by connection. A down link never carries traffic.
 */
export function uplinkFor(mode: BondMode, source: number, flow: number, fail: LinkFail): Uplink {
  const want: Uplink = mode === 'ab' ? 0 : mode === 'slb' ? ((source % 2) as Uplink) : (((source + flow) % 2) as Uplink);
  return linkUp(want, fail) ? want : want === 0 ? 1 : 0;
}

export type UplinkRole = 'active' | 'standby' | 'carrying' | 'idle' | 'down';

/** What a link is doing, for a host with `sources` VMs and CVM sending two connections each. */
export function uplinkRole(mode: BondMode, nic: Uplink, fail: LinkFail, sources: number): UplinkRole {
  if (!linkUp(nic, fail)) return 'down';
  if (mode === 'ab') return uplinkFor('ab', 0, 0, fail) === nic ? 'active' : 'standby';
  for (let s = 0; s < sources; s++) for (let f = 0; f < 2; f++) if (uplinkFor(mode, s, f, fail) === nic) return 'carrying';
  return 'idle';
}

/** Throughput limits in Gb/s for a host with two links of `linkG` each. */
export function limits(mode: BondMode, fail: LinkFail, linkG = 10): { host: number; vm: number; flow: number } {
  const ups = ([0, 1] as Uplink[]).filter((n) => linkUp(n, fail)).length;
  if (mode === 'ab') return { host: linkG, vm: linkG, flow: linkG };
  if (mode === 'slb') return { host: ups * linkG, vm: linkG, flow: linkG };
  return { host: ups * linkG, vm: ups * linkG, flow: linkG };
}

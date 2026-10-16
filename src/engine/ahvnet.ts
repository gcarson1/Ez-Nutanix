// AHV networking model: which uplink of a host's bond (br0-up) carries each VM's traffic for
// each bond type, what happens on a link failure, and the throughput limits that follow.
// Pure and deterministic. Source: docs/research/C-lcm-networking.md (AHV Admin Guide 11.2,
// BP-2071 v4.9). Hash placement is illustrative: real OVS hashes by MAC or by flow and rebalances.

export type BondMode = 'ab' | 'slb' | 'lacp';
export type LinkFail = 'none' | 'nic' | 'switch';

export interface BondDef {
  id: BondMode;
  /** Prism "Bond Type" name. */
  prism: string;
  /** Underlying OVS bond mode. */
  ovs: string;
  short: string;
  recommended: boolean;
  switchConfig: string;
  spread: string;
  onFailure: string;
  note: string;
}

export const BONDS: Record<BondMode, BondDef> = {
  ab: {
    id: 'ab',
    prism: 'Active-Backup',
    ovs: 'active-backup',
    short: 'Active-Backup',
    recommended: true,
    switchConfig: 'None. Works across two switches.',
    spread: 'One uplink carries everything; the others wait. The active one is chosen when the host boots and can be pinned per host.',
    onFailure: 'A backup uplink takes over all traffic.',
    note: 'The default and Nutanix’s recommendation. Throughput is limited to one link.',
  },
  slb: {
    id: 'slb',
    prism: 'Active-Active with MAC pinning',
    ovs: 'balance-slb',
    short: 'MAC pinning',
    recommended: false,
    switchConfig: 'None (do not combine with LACP on the switch).',
    spread: 'Each VM NIC uses one uplink at a time, chosen by its MAC address. OVS rebalances by load (the OVS default interval is 10 s).',
    onFailure: 'OVS moves the failed uplink’s VMs to the surviving uplink.',
    note: 'Nutanix’s 2026 networking best-practice guide no longer recommends it: inbound multicast arrives on one uplink only, which clashes with IGMP snooping.',
  },
  lacp: {
    id: 'lacp',
    prism: 'Active-Active',
    ovs: 'balance-tcp with LACP',
    short: 'LACP',
    recommended: false,
    switchConfig: 'Dynamic LACP and a LAG, MLAG or vPC on the top-of-rack switches (static EtherChannel is not supported).',
    spread: 'Each flow is hashed by IP addresses and ports, so one VM with several flows can use both uplinks. A single flow stays on one link.',
    onFailure: 'LACP notices the link is gone after 3 missed LACP messages (about 3 s with the fast rate Prism sets) and moves its flows to the surviving link.',
    note: 'Prism sets LACP fast (1 s) and fallback to active-backup on every host; neither can be changed. Switching to it triggers a rolling reboot of the hosts.',
  },
};

export const BOND_ORDER: BondMode[] = ['ab', 'slb', 'lacp'];

/** Is uplink `nic` (0 = NIC A to switch A, 1 = NIC B to switch B) of `host` up? */
export function linkUp(host: number, nic: number, fail: LinkFail): boolean {
  if (fail === 'switch') return nic !== 0;
  if (fail === 'nic') return !(host === 0 && nic === 0);
  return true;
}

/**
 * The uplink a VM flow leaves on. Active-Backup: the active uplink (NIC A here; chosen at boot in
 * reality). MAC pinning: by VM (its MAC). LACP: by flow. A down uplink never carries traffic.
 */
export function uplinkFor(mode: BondMode, host: number, vm: number, flow: number, fail: LinkFail): 0 | 1 | null {
  const up0 = linkUp(host, 0, fail);
  const up1 = linkUp(host, 1, fail);
  if (!up0 && !up1) return null;
  let want: 0 | 1;
  if (mode === 'ab') want = 0;
  else if (mode === 'slb') want = (vm % 2) as 0 | 1;
  else want = ((vm + flow) % 2) as 0 | 1;
  if (want === 0 && !up0) return 1;
  if (want === 1 && !up1) return 0;
  return want;
}

export type UplinkRole = 'active' | 'standby' | 'carrying' | 'idle' | 'down';

export function uplinkRole(mode: BondMode, host: number, nic: 0 | 1, fail: LinkFail, vmsOnHost: number): UplinkRole {
  if (!linkUp(host, nic, fail)) return 'down';
  if (mode === 'ab') return uplinkFor('ab', host, 0, 0, fail) === nic ? 'active' : 'standby';
  for (let v = 0; v < vmsOnHost; v++) for (let f = 0; f < 2; f++) if (uplinkFor(mode, host, v, f, fail) === nic) return 'carrying';
  return 'idle';
}

/** Throughput limits in Gb/s for a host with two uplinks of `linkG` each. */
export function limits(mode: BondMode, host: number, fail: LinkFail, linkG = 10): { host: number; vm: number; flow: number } {
  const ups = [0, 1].filter((n) => linkUp(host, n, fail)).length;
  if (ups === 0) return { host: 0, vm: 0, flow: 0 };
  if (mode === 'ab') return { host: linkG, vm: linkG, flow: linkG };
  if (mode === 'slb') return { host: ups * linkG, vm: linkG, flow: linkG };
  return { host: ups * linkG, vm: ups * linkG, flow: linkG };
}

/** Next VLAN ID for a new network: multiples of 10 not already used, within 2..4094. */
export function nextVlan(existing: number[]): number | null {
  for (let v = 10; v <= 4090; v += 10) if (!existing.includes(v)) return v;
  return null;
}

/** VLAN ID rules: 0 means untagged (switch-port native VLAN); 1..4094 are tags. */
export function vlanLabel(id: number): string {
  return id === 0 ? 'untagged (native VLAN)' : `802.1Q tag ${id}`;
}

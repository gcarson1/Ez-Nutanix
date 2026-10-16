import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/network',
  title: 'AHV Networking',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Each AHV host runs Open vSwitch, and Prism manages them all as one virtual switch. See how VMs, the CVM and the host reach the physical network through a bonded pair of uplinks, VLAN by VLAN.',
  priority: 'P0',
  talk: [
    'Every host has its own Open vSwitch, but you don’t manage them one by one: Prism treats them as one virtual switch, vs0, and rolls changes out host by host.',
    'Inside each host: bridge br0, its uplink bond br0-up with the physical NICs, and a private Linux bridge, virbr0, that links the CVM to its own host.',
    'Add a network and assign a VM: the VM sends normal untagged frames, and OVS adds the VLAN tag on the way out. The switch ports just need to be trunks carrying those VLANs.',
    'Bond types: Active-Backup is the default and needs nothing on the switch. LACP uses both links but needs a LAG on the switches. Fail a link and traffic moves to the survivor.',
    'Management stays simple: CVM and host default to untagged on the native VLAN. You can tag them, or move backplane traffic onto its own VLAN with network segmentation.',
    'Flow sits on top: overlay VPCs and microsegmentation without new physical VLANs.',
  ],
  numbers: [
    { k: 'Default virtual switch', v: 'vs0 (br0 + bond br0-up on every node)' },
    { k: 'Default bond type', v: 'Active-Backup (recommended)' },
    { k: 'LACP failure detection', v: '3 missed LACP messages, about 3 s at the fast rate Prism sets' },
    { k: 'Host / CVM internal addresses', v: '192.168.5.1 / 192.168.5.254 on virbr0' },
    { k: 'CVM MTU', v: '1500 (jumbo 9000 allowed on host NICs and guests end to end)' },
    { k: 'Current release checked', v: 'AHV 11.2, AOS 7.6' },
  ],
  qa: [
    {
      q: 'Do we have to reconfigure our switches?',
      a: 'For Active-Backup, only trunk ports carrying the VLANs you use, with the management VLAN as native. Nothing else. LACP needs dynamic LACP and a LAG, MLAG or vPC on the switches, plus LACP fallback. Each new VLAN-backed network needs that VLAN on the trunks; overlay networks with Flow avoid that.',
    },
    {
      q: 'Why not use both links all the time?',
      a: 'You can, with LACP: a single VM with several flows can then use both links, though each flow stays on one. It needs switch configuration and changing to it reboots the hosts one by one. MAC pinning (balance-slb) also uses both links without switch config, but Nutanix’s current guidance no longer recommends it because of multicast problems.',
    },
    {
      q: 'Can we separate storage and management traffic?',
      a: 'Yes, with network segmentation. Backplane traffic between CVMs moves to its own interface (eth2) on a separate VLAN or a separate set of uplinks; RDMA, Volumes and DR traffic can be isolated too. It is not supported on two-node clusters.',
    },
  ],
  next: ['Flow (overlay VPCs and microsegmentation)', 'LCM Rolling Upgrade (avoid virtual-switch changes during upgrades)', 'Edge & ROBO'],
  honest: [
    'Active-Backup, the default, limits each host to one link’s bandwidth; using both links means LACP and switch-side configuration.',
    'MAC pinning (balance-slb) needs no switch config but has a multicast caveat, and Nutanix no longer recommends it.',
    'Every VLAN-backed network needs its VLAN trunked to every host. Overlay networking removes that step but adds encapsulation and gateway sizing.',
    'Virtual-switch changes on one- and two-node clusters require powering off user VMs, and the Quick change method can interrupt traffic.',
    'CVM interfaces stay at 1500 MTU even when you enable jumbo frames elsewhere.',
  ],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/network',
  title: 'AHV Networking',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Each AHV host sends traffic from its VMs and its CVM through a virtual switch and a bond of two links to the top-of-rack switches. See how each bond type uses the links, and what happens when one fails.',
  priority: 'P0',
  talk: [
    'Every host runs its own Open vSwitch, but you don’t manage them one by one: Prism treats them as one virtual switch, vs0, and rolls changes out host by host.',
    'Inside each host, the VMs and the CVM connect to bridge br0, and br0 reaches the physical network through a bond, br0-up, of the host’s uplinks. Cable each host to two switches.',
    'Active-Backup is the default and Nutanix’s recommendation: one link carries everything, the other waits, and the switches need nothing special. The cost is one link’s bandwidth per host.',
    'LACP (Active-Active) spreads connections over both links, so even one VM can use both, but the switches need dynamic LACP and a LAG, and switching to it reboots the hosts one by one. Balance-SLB uses both links without switch setup but is no longer recommended.',
    'When a link fails, the bond moves its traffic to the surviving link. VMs keep their addresses and networks; nothing changes inside the guest.',
    'VLANs work the same way under every bond type: a VM sends ordinary frames, OVS adds the VLAN tag on the way out, and the switch ports are trunks carrying those VLANs. Flow adds overlay VPCs without new physical VLANs.',
  ],
  numbers: [
    { k: 'Default virtual switch', v: 'vs0 (br0 + bond br0-up on every node)' },
    { k: 'Default bond type', v: 'Active-Backup (recommended)' },
    { k: 'Bandwidth with two 10 Gb/s links', v: 'Active-Backup: 10 Gb/s per host · Balance-SLB: 20 per host, 10 per VM · LACP: 20 per host and per VM, 10 per connection' },
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
  next: [
    'Start on Active-backup with no failure: everything leaves on NIC A while NIC B waits as the backup.',
    'Switch to Balance-SLB and point out that each VM keeps to one link, then to LACP to show one VM’s connections on both links and the LAG on the switches.',
    'Choose “One link fails” with Active-backup, then with LACP: traffic moves to NIC B either way, and the bandwidth numbers show what is lost.',
    'Then show Flow for overlay VPCs and microsegmentation on top of these same hosts.',
  ],
  honest: [
    'Active-Backup, the default, limits each host to one link’s bandwidth; using both links means LACP and switch-side configuration.',
    'MAC pinning (balance-slb) needs no switch config but has a multicast caveat, and Nutanix no longer recommends it.',
    'Every VLAN-backed network needs its VLAN trunked to every host. Overlay networking removes that step but adds encapsulation and gateway sizing.',
    'Virtual-switch changes on one- and two-node clusters require powering off user VMs, and the Quick change method can interrupt traffic.',
    'CVM interfaces stay at 1500 MTU even when you enable jumbo frames elsewhere.',
  ],
};

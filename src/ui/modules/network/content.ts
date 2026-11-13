import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/network',
  title: 'AHV Networking',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'A link can fail without VMs losing their network: AHV hosts send VM and Controller VM (CVM) traffic through a virtual switch and a two-link bond to the top-of-rack switches.',
  priority: 'P0',
  facts: {
    release: { v: 'AHV 11.2', sub: 'with AOS 7.6 (Jul 2026)' },
    license: { v: 'NCI', sub: 'AHV bonds and virtual switches: any edition', tip: 'AHV networking comes with AHV. Flow Virtual Networking has its own page.' },
  },
  talk: [
    'Every host runs its own Open vSwitch (OVS), but you do not manage them one by one: Prism treats them as one virtual switch, vs0, and rolls changes out host by host.',
    'Inside each host, the VMs and the CVM connect to bridge br0, and br0 reaches the physical network through a bond, br0-up, of the host’s network interface cards (NICs). Cable each host to two switches.',
    'Active-Backup is the default and Nutanix’s recommendation: one link carries everything, the other waits, and the switches need nothing special. Balance-SLB needs no switch setup either but is no longer recommended.',
    'LACP (Link Aggregation Control Protocol, Active-Active) spreads connections over both links, so even one VM can use both. The switches need dynamic LACP and a link aggregation group (LAG); in current releases, switching to it reboots hosts one by one.',
    'When a link fails, the bond moves its traffic to the surviving link. VMs keep their addresses and networks; nothing changes inside the guest.',
    'VLANs work the same under every bond type: the VM sends ordinary frames, OVS tags them on the way out and the switch ports are trunks. Flow Virtual Networking adds overlay virtual private clouds (VPCs) with no new physical VLANs.',
  ],
  numbers: [
    { k: 'Default virtual switch', v: 'vs0 (br0 + bond br0-up on every node)' },
    { k: 'Default bond type', v: 'Active-Backup (recommended)' },
    { k: 'Bandwidth with two 10 Gb/s links', v: 'Active-Backup: 10 Gb/s per host · Balance-SLB: 20 Gb/s per host, 10 Gb/s per VM · LACP: 20 Gb/s per host and per VM, 10 Gb/s per connection' },
    { k: 'LACP failure detection', v: '3 missed LACP messages, about 3 s at the fast rate Prism sets' },
    { k: 'Host / CVM internal addresses (default)', v: '192.168.5.1 / 192.168.5.254 on virbr0, inside each host only' },
    { k: 'CVM MTU', v: '1500 (jumbo 9000 allowed on host NICs and guests end to end)' },
    { k: 'Current release', v: 'AHV 11.2 · AOS 7.6 (Jul 2026)' },
  ],
  qa: [
    {
      q: 'Do we have to reconfigure our switches?',
      a: 'For Active-Backup, only trunk ports carrying the VLANs you use, with the management VLAN as native. Nothing else. LACP needs dynamic LACP and a LAG, MLAG (multi-chassis LAG) or vPC (virtual PortChannel) on the switches, plus LACP fallback. Each new VLAN-backed network needs that VLAN on the trunks; overlay networks with Flow avoid that.',
    },
    {
      q: 'Why not use both links all the time?',
      a: 'You can, with LACP: a single VM with several flows can then use both links, though each flow stays on one. It needs switch configuration and changing to it reboots the hosts one by one. MAC pinning (Balance-SLB) also uses both links without switch config, but Nutanix’s current guidance no longer recommends it because of multicast problems.',
    },
    {
      q: 'Can we separate storage and management traffic?',
      a: 'Yes, with network segmentation. Backplane traffic between CVMs moves to its own interface (eth2) on a separate VLAN or a separate set of uplinks; RDMA, Volumes and DR traffic can be isolated too. It is not supported on two-node clusters.',
    },
  ],
  next: [
    'Start with “Bond type” on “Active-Backup” and “Link failure” on “None”: everything leaves on NIC A while NIC B waits as the backup.',
    'Switch to “Balance-SLB” and point out that each VM keeps to one link, then to “LACP” to show one VM’s connections on both links and the link group on the switches.',
    'Choose “One link fails” with “Active-Backup”, then with “LACP”: traffic moves to NIC B either way, and the bandwidth numbers show what is lost.',
    'Then open Flow: Network Security & Virtual Networking for overlay VPCs and microsegmentation on top of these same hosts.',
  ],
  then: ['nci/flow'],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/lcm',
  title: 'LCM Rolling Upgrade',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Life Cycle Manager (LCM) updates AOS, AHV, firmware and tools one node at a time, checking that data is fully protected before each step, while workloads keep running.',
  priority: 'P0',
  talk: [
    'One tool for software and firmware: LCM inventories what is installed, shows what is available, and adds dependencies for you, such as drive firmware when you pick HBA firmware.',
    'Nothing runs until the pre-checks pass. Turn on “degraded cluster” to show LCM refusing to start while data resiliency is not OK.',
    'Then it goes strictly one node at a time: VMs live-migrate off, the host and CVM enter maintenance mode, the update runs (firmware reboots two or three times), the node comes back, data resyncs, and only then does LCM move on.',
    'AOS upgrades are lighter: only the CVM reboots. The host’s iSCSI redirector sends its VMs’ storage I/O to other CVMs, and the VMs never move.',
    'Press “Fail another node now” mid-upgrade: LCM brings the current node back and waits instead of taking a second node down. On RF2, be honest that an overlap like this can make some data unavailable until a node returns.',
    'Point at the impact meter: for a planned upgrade on three or more nodes it stays flat. Total time grows with node count because the work is sequential.',
  ],
  numbers: [
    { k: 'Nodes out at once during LCM', v: '1' },
    { k: 'Current releases (Oct 2026)', v: 'LCM 3.4 · AOS 7.6 · AHV 11.2 · pc.7.6' },
    { k: 'Firmware reboots on NX', v: 'BMC 2 · BIOS and CPLD 3' },
    { k: 'Illustrative per-node time', v: 'AOS ~15 min · AHV ~25 min · firmware 30–60 min (older estimates, not official)' },
    { k: '2-node clusters', v: 'Witness required for LCM' },
  ],
  qa: [
    {
      q: 'What happens if something else fails during the upgrade?',
      a: 'LCM stops moving forward. It finishes bringing back the node it is working on, then waits and takes no other node down until data resiliency is Normal. On an RF2 cluster, one node out for the upgrade plus an unplanned failure is two nodes down, more than RF2 tolerates, so some data can be unavailable until a node returns. RF3 tolerates that overlap. There is no automatic rollback.',
    },
    {
      q: 'Do our VMs go down?',
      a: 'Not on a cluster of three or more nodes: VMs live-migrate off each host before it goes into maintenance. VMs that cannot migrate (pinned, RF1 or agent VMs) are shut down by LCM and restarted afterward. On a single-node cluster you shut VMs down first, because there is nowhere to move them.',
    },
    {
      q: 'How long will it take for our cluster?',
      a: 'It scales with node count because nodes go one at a time. Nutanix does not publish current official per-node figures; older Nutanix-employee estimates are about 15 minutes per node for AOS and 25 or more for AHV, and firmware with several reboots takes longer. Run the pre-checks and view the upgrade plan to see the expected steps for your cluster.',
    },
  ],
  next: ['Failure Gauntlet (what an unplanned failure does on its own)', 'Edge & ROBO (1- and 2-node behavior)', 'Nutanix Central (fleet upgrades from Prism Central)'],
  honest: [
    'Upgrade time grows with node count, because LCM works on one node at a time and waits for resiliency between nodes.',
    'Every node must be able to leave safely: you need resiliency OK and enough spare CPU and memory on the other hosts to absorb one node’s VMs.',
    'On RF2 there is no spare fault tolerance while a node is out. A second failure during that window can make some data unavailable until a node returns; RF3 removes that window.',
    'Firmware coverage depends on the server vendor and LCM release, and LCM does not upgrade firmware on single-node clusters.',
    'LCM updates are not reversible. “Stop update” waits for the next safe point.',
  ],
};

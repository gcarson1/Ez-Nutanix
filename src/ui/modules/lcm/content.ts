import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/lcm',
  title: 'LCM Rolling Upgrade',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Life Cycle Manager (LCM) updates AOS, AHV, firmware and tools one node at a time, checking that data is fully protected before each step, while workloads keep running.',
  priority: 'P0',
  talk: [
    'One tool for software and firmware: LCM finds what is installed, shows what is available, and orders the updates for you.',
    'Nothing runs until the pre-checks pass: health, data protection, free room for VMs and connectivity. If the cluster is already degraded, LCM does not start.',
    'Then it goes strictly one node at a time: VMs move off live, the node updates and comes back, data catches up, and only then does LCM move on.',
    'AOS updates are lighter: only the controller VM restarts. Its host’s storage traffic goes to the other controllers for a moment, and the VMs never move.',
    'Pick “A node fails mid-upgrade” and let it play: nothing hints at the failure beforehand. When the node drops, HA restarts its VMs and the cluster starts rebuilding copies. LCM finishes the node it was on, then holds instead of taking a second node down, and resumes once the node is repaired and its data has caught up.',
    'Point at VM downtime: for a planned upgrade on three or more nodes it stays at none. Total time grows with node count because the work is one node at a time. The times on the timeline are illustrative, not official.',
  ],
  numbers: [
    { k: 'Nodes out at once during LCM', v: '1' },
    { k: 'Current release lines (Oct 2026)', v: 'LCM 3.4 · AOS 7.6 · AHV 11.2 · pc.7.6 (patch levels vary; check the portal)' },
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
  next: ['Healthy cluster: let one loop play and point at one node out at a time and VM downtime staying at none.', 'A node fails mid-upgrade: the failure comes without warning, LCM holds, then resumes after the repair.', 'Then Failure Gauntlet for what an unplanned failure does on its own.'],
};

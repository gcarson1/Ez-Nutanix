import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/lcm',
  title: 'LCM Rolling Upgrade',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Life Cycle Manager (LCM) updates AOS, AHV, firmware and tools one node at a time while workloads keep running, checking that data is fully protected before each step. Kubernetes clusters on NKP get the same one-node-at-a-time treatment.',
  priority: 'P0',
  facts: {
    release: { v: 'LCM 3.4', sub: 'with AOS 7.6 (Jul 2026) · AHV 11.2 · pc.7.6' },
    license: { v: 'NCI Starter, Pro or Ultimate', sub: 'LCM is listed as part of NCI', tip: 'Nutanix lists LCM among NCI’s management features. The Kubernetes (NKP) tab shows its own license.' },
  },
  talk: [
    'One tool for software and firmware: LCM finds what is installed, shows what is available and orders the updates for you.',
    'Nothing runs until the pre-checks pass: health, data protection, free room for VMs and connectivity. If the cluster is already degraded, LCM does not start.',
    'Then it goes strictly one node at a time: VMs move off live, the node updates and comes back, data catches up and only then does LCM move on.',
    'AOS updates are lighter: only the Controller VM (CVM) restarts. Its host’s storage traffic goes to the other CVMs for a moment, and the VMs never move.',
    'Pick “A node fails mid-upgrade”: nothing warns you first. HA restarts the failed node’s VMs and copies rebuild at once. LCM finishes its current node, then holds until the repaired node’s data has caught up.',
    'Point at VM downtime: on three or more nodes a planned upgrade keeps it at none. Total time grows with node count because nodes go one at a time. Timeline times are illustrative, not official.',
    'Kubernetes (NKP) tab: NKP rolls a Kubernetes upgrade across the fleet, a canary first, and inside each cluster a new node joins before an old one drains and leaves. With NKP Metal (early access), LCM itself also patches the OS and firmware of bare-metal Kubernetes nodes.',
  ],
  numbers: [
    { k: 'Nodes out at once during LCM', v: '1' },
    { k: 'Current release', v: 'LCM 3.4 · AOS 7.6 (Jul 2026) · AHV 11.2 · Prism Central pc.7.6 (patch levels vary, check the portal)' },
    { k: 'Firmware reboots on NX', v: 'BMC (baseboard management controller) 2 · BIOS and CPLD (complex programmable logic device) 3' },
    { k: 'Illustrative per-node time', v: 'AOS about 15 min · AHV about 25 min · firmware 30 to 60 min (older estimates, not official)' },
    { k: '2-node clusters', v: 'Witness required for LCM' },
  ],
  qa: [
    {
      q: 'What happens if something else fails during the upgrade?',
      a: 'LCM stops moving forward. It finishes bringing back the node it is working on, then waits and takes no other node down until data resiliency is Normal. On an RF2 cluster, one node out for the upgrade plus an unplanned failure is two nodes down, more than RF2 tolerates, so some data can be unavailable until a node returns. RF3 tolerates that overlap. There is no automatic rollback.',
    },
    {
      q: 'Do our VMs go down?',
      a: 'Not on a cluster of three or more nodes: VMs live-migrate off each host before it goes into maintenance. Pinned and RF1 VMs are powered off during maintenance mode, and passthrough or other non-migratable VMs may need power-off or separate handling. On a single-node cluster you shut VMs down first, because there is nowhere to move them.',
    },
    {
      q: 'How long will it take for our cluster?',
      a: 'It scales with node count because nodes go one at a time. Nutanix does not publish current official per-node figures; older Nutanix-employee estimates are about 15 minutes per node for AOS and 25 or more for AHV, and firmware with several reboots takes longer. Run the pre-checks and view the upgrade plan to see the expected steps for your cluster.',
    },
  ],
  next: [
    'Under “What happens”, let “Healthy cluster” play and point at one node out at a time and VM downtime staying at None.',
    'Pick “A node fails mid-upgrade”: the failure comes without warning, LCM holds, then resumes after the repair.',
    'On the Kubernetes (NKP) tab, let Healthy rollout loop once and point at a new node joining before an old one leaves; then pick Canary fails: the rollout stops at the first cluster.',
    'Then open Failure Gauntlet to show what an unplanned failure does on its own.',
  ],
  then: ['nci/failures'],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/hci',
  title: 'Legacy vs Nutanix HCI',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Nutanix folds a three-tier design of servers, a storage area network (SAN) and a storage array into one node, then joins nodes into a cluster with one storage pool and one Prism.',
  priority: 'P0',
  talk: [
    'This is the “why HCI” story. Start with the design most customers run today: servers, a Fibre Channel SAN with two switches, and a dual-controller array, each with its own console and skills.',
    'Pause on “Adding a host”: one change touches all three tiers. Cable the HBAs, zone them on both fabrics, mask the LUNs on the array, rescan the host.',
    'Then the fold: the array’s controllers become the CVM, software on every node; the drive shelves become local NVMe or SSD drives; no SAN is needed for storage. Three consoles become Prism.',
    'One node is the building block. Three make the smallest standard cluster: the CVMs pool every node’s drives into one storage pool and keep each write on two nodes.',
    'Growing means adding a node from Prism: compute, drives and a controller arrive together, and the pool grows. No LUNs to mask, no fabric to zone.',
    'Be fair: nodes still connect to standard Ethernet switches, and each node reserves CPU and memory for its CVM (see Scale-Out vs 3-Tier).',
  ],
  numbers: [
    { k: 'Smallest standard cluster', v: '3 nodes (RF2); 1- and 2-node clusters exist for edge sites' }, // HCI-8 (RF-1, EDGE-1, EDGE-2)
    { k: 'In every node', v: 'x86 server, local NVMe or SSD drives, AHV and one CVM' }, // HCI-6
    { k: 'Storage pool', v: 'One per cluster in most configurations, across every node’s drives' }, // HCI-9
    { k: 'Copies of each write', v: 'RF2: 2 nodes · RF3: 3 nodes (needs at least 5)' }, // RF-1, DP-2
    { k: 'Network', v: 'Standard Ethernet, 10 Gbps or faster for CVM traffic; no SAN fabric' }, // HCI-7
    { k: 'Management', v: 'Prism Element built into every cluster; Prism Central for many clusters' }, // HCI-10
    { k: 'Adding nodes', v: 'Expand Cluster in Prism, one or several nodes at a time' }, // HCI-11
  ],
  qa: [
    {
      q: 'If the storage is inside the servers, what happens when a node fails?',
      a: 'Every write is kept on two nodes (three with RF3) before it is confirmed, so the data is still there. The other nodes keep serving it, HA restarts the failed node’s VMs on them, and the missing copies are rebuilt at once onto the remaining nodes. That is why a standard cluster starts at three nodes. The Failure Gauntlet shows it step by step.',
    },
    {
      q: 'Our SAN runs iSCSI over Ethernet, not Fibre Channel. Does this still apply?',
      a: 'Yes. The cable type changes, but the three tiers are the same: hosts on a storage network, an array with its controllers, and LUNs to create and map to each host. HCI removes the array and the separate storage path, not just Fibre Channel.',
    },
    {
      q: 'Do we still need network switches?',
      a: 'Yes. Nodes connect to standard Ethernet top-of-rack switches; Nutanix recommends redundant switches and 10 Gbps or faster links for CVM traffic. What goes away is the separate storage fabric: Fibre Channel switches, HBAs and zoning.',
    },
  ],
  next: [
    'Let it play from the top: three tiers, a console each, and “Adding a host” touching all three.',
    'Pause on “Inside a node” (Shift+Right jumps a step) to show where each tier went.',
    'Then open Scale-Out vs 3-Tier for how controllers grow with the cluster, or Cluster & DSF Lab for how data is placed.',
  ],
  then: ['nci/scale', 'nci/cluster'],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/hci',
  title: 'Legacy vs Nutanix HCI',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Nutanix folds a three-tier design of servers, a storage area network (SAN) and a storage array into one node, then grows a cluster node by node: each adds compute, drives and its own storage controller, with one storage pool and one Prism.',
  priority: 'P0',
  talk: [
    'Start with the design most customers run today: servers, a Fibre Channel SAN with two switches and a dual-controller array, each with its own console and skills. Adding a host touches all three tiers.',
    'Then the fold: the array’s controllers become the CVM, software on every node, the drive shelves become local NVMe or SSD drives and three consoles become Prism. Nodes connect to standard top-of-rack Ethernet switches, with no SAN.',
    'Three nodes make the smallest standard cluster; their CVMs pool every node’s drives and keep each write on two nodes. Grow by adding a node from Prism, and disk balancing spreads data onto it in the background, with no migration project.',
    'Controllers grow with the cluster: 5 nodes, 5 CVMs. A 3-tier array keeps its pair however many hosts it serves; growing past it means a bigger pair or another array to manage.',
    'Nodes come in different configurations, so each addition can lean toward drives or toward CPU and memory; storage-only nodes add capacity without running VMs.', // HCI-14
    'Be upfront about the cost: each node reserves CPU and memory for its CVM, depending on the features you enable and the node size. Take the figure from Nutanix sizing.',
  ],
  numbers: [
    { k: 'Smallest standard cluster', v: '3 nodes (RF2); 1- and 2-node clusters exist for edge sites' }, // HCI-8 (RF-1, EDGE-1, EDGE-2)
    { k: 'In every node', v: 'x86 server, local NVMe or SSD drives, AHV and one CVM' }, // HCI-6
    { k: 'Storage controllers', v: 'One CVM per node; a 3-tier array keeps its pair' }, // HCI-3, HCI-6
    { k: 'Storage pool', v: 'One per cluster in most configurations, across every node’s drives' }, // HCI-9
    { k: 'Capacity per node added', v: 'That node’s drives (raw); usable depends on RF and data reduction' }, // HCI-9, RF-1
    { k: 'Network', v: 'Redundant top-of-rack Ethernet switches, 10 Gbps or faster for CVM traffic; no SAN fabric' }, // HCI-7
    { k: 'Adding nodes', v: 'Expand Cluster in Prism, one or several at a time; disk balancing evens out how full nodes are' }, // HCI-11, HCI-13
    { k: 'CVM reservation', v: 'Depends on enabled features and node size; use Nutanix sizing' }, // CVM-1
  ],
  qa: [
    {
      q: 'If the storage is inside the servers, what happens when a node fails?',
      a: 'Every write is kept on two nodes (three with RF3) before it is confirmed, so the data is still there. The other nodes keep serving it, HA restarts the failed node’s VMs on them, and the missing copies are rebuilt at once onto the remaining nodes. That is why a standard cluster starts at three nodes.',
    },
    {
      q: 'How much of each node does the CVM take?',
      a: 'It depends on the features you enable, such as deduplication, RF3 and replication, and on the node’s size, so we size it for your configuration rather than quote one number. The reservation grows with the cluster, along with the controller capacity it provides.',
    },
    {
      q: 'Does performance really scale linearly?',
      a: 'The cluster scales by adding distributed controllers and capacity: each node brings its own CVM and drives, and with data locality each VM’s I/O is served mostly by its own node’s CVM. That describes the architecture, not a benchmark; real performance depends on the workload and the network, so size for the actual workload.',
    },
  ],
  next: [
    'Let it play from the top: three tiers, a console each, and “Adding a host” touching all three.',
    'Pause on “Inside a node” (Shift+Right jumps a step) to show where each tier went, then on “Data rebalances” as node 4’s drives fill.',
    'End on “Controllers grow with it”: the cluster’s controller count rises with each node while the array stays at 2.',
    'Then open Protection & Capacity for usable capacity, Data Path for why locality matters or Cluster & DSF Lab for how data is placed.',
  ],
  then: ['nci/capacity', 'nci/datapath', 'nci/cluster', 'partial'],
};

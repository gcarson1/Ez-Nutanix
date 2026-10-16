import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/scale',
  title: 'Scale-out vs 3-tier',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Grow a node at a time: each node adds compute, drives and its own storage controller (the CVM). Compare that with hosts sharing an array’s controller pair, including the honest cost of the CVM.',
  priority: 'P1',
  talk: [
    'Start small and add a node when you need it: rack it, add it from Prism with Expand Cluster, and the VMs keep running.',
    'Every node runs a Controller VM, so controllers grow with the cluster: 4 nodes, 4 controllers; 16 nodes, 16.',
    'In a 3-tier design every host’s storage I/O goes through the array’s controllers; growing past them means a bigger controller pair or another array to manage. Neither is wrong, it is a different scaling unit.',
    'After a node joins, disk balancing spreads data onto it in the background, so the new drives are used without a migration project.',
    'Be upfront about the cost: each node reserves CPU and memory for its CVM. How much depends on features and node size, so take it from sizing.',
  ],
  numbers: [
    { k: 'Storage controllers', v: 'One CVM per node' },
    { k: 'Capacity per node added', v: 'That node’s drives (raw); usable depends on RF and data reduction' },
    { k: 'CVM reservation', v: 'Depends on enabled features and node size; use Nutanix sizing' },
  ],
  qa: [
    {
      q: 'How much of each node does the CVM take?',
      a: 'It depends on the features you enable, such as deduplication, RF3 and replication, and on the node’s size, so we size it for your configuration rather than quote a single number. Whatever the figure, every node reserves a similar share, so the overhead grows with the cluster along with the controller capacity it provides.',
    },
    {
      q: 'Does performance really scale linearly?',
      a: 'Controller count and raw capacity grow one node at a time, and with data locality each VM’s I/O is served mostly by its own node’s CVM. Real results still depend on the workload, the network and how data is spread, so treat “linear” as the architecture’s scaling unit, not a benchmark promise.',
    },
    {
      q: 'What if we need storage but not compute, or the reverse?',
      a: 'Nodes come in different configurations, so each addition can be weighted toward drives or toward CPU and memory. Storage-only nodes add capacity without running VMs. Mixing node types needs some planning so that failures and rebuilds still fit.',
    },
  ],
  next: ['Cluster & DSF Lab (add a node and watch data rebalance)', 'Protection & Capacity (usable capacity)', 'Data Path (why locality matters)'],
  honest: [
    'Each node reserves CPU and memory for its CVM. That overhead is real and belongs in every sizing; it depends on features and node size.',
    'Compute and storage grow together by default. If one grows much faster than the other, choose node configurations carefully or use storage-only nodes.',
    '“Linear” describes the scaling unit, not a guaranteed benchmark: workload, network and data placement still matter.',
    'The 3-tier side here is a generic, simplified model. Many arrays scale in other ways, for example by adding controllers or arrays.',
  ],
};

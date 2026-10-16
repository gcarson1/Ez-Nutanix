import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci',
  title: 'Nutanix Cloud Infrastructure',
  tag: 'Infrastructure',
  summary: 'Standard servers become one cluster: the AHV hypervisor, a storage controller on every node, software-defined networking and security, and built-in disaster recovery.',
  priority: 'P0',
  talk: [
    'Start at the bottom: ordinary servers with local drives, no separate storage array or SAN.',
    'Every node runs a Controller VM. Together the CVMs are the storage controller, so performance and capacity grow a node at a time.',
    'The Distributed Storage Fabric keeps two or three copies of every piece of data on different nodes, and heals itself after failures.',
    'Flow and DR sit on top: security that follows VMs, and replication you choose by RPO.',
    'Pick a sub-module that matches the customer’s biggest question: resilience, upgrades, capacity or DR.',
  ],
  numbers: [
    { k: 'Minimum nodes, RF2', v: '3 (1- and 2-node edge options exist)' },
    { k: 'Minimum nodes, RF3', v: '5' },
    { k: 'Data copies', v: 'RF2: 2 · RF3: 3' },
  ],
  qa: [
    { q: 'Do we still need a storage array?', a: 'No. Storage comes from the drives inside each node, pooled by the CVMs. External arrays are not part of the design.' },
    { q: 'What does the CVM cost us in resources?', a: 'Each node reserves CPU and memory for its CVM. That is the price of having the storage controller distributed; size for it from the start (see Scale-out vs 3-tier).' },
    { q: 'Can we keep VMware?', a: 'Yes, Nutanix clusters also run ESXi. AHV is included with the platform and some features, such as Flow, require it.' },
  ],
  next: ['Cluster & DSF Lab', 'Failure Gauntlet', 'LCM Rolling Upgrade'],
};

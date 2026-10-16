import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/cluster',
  title: 'Cluster & DSF Lab',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Build a cluster and watch every node’s drives pool into one Distributed Storage Fabric (DSF). Then add a node, remove one, move a VM or break something, and scrub the timeline back and forth.',
  priority: 'P0',
  talk: [
    'Each node is a server running the hypervisor, the user VMs and one Controller VM (CVM). The CVMs together are the storage controller, so there is no separate array to size.',
    'Every piece of data is kept as two copies (RF2) or three (RF3) on different nodes, one of them on the node where the VM runs. Follow a VM to show its copies spread across the cluster.',
    'Add a node: capacity and CVM count grow together, and disk balancing moves data onto the new drives in the background. Remove one: its data is re-protected elsewhere before it leaves.',
    'Live-migrate a VM: it keeps running, the first reads cross the network, and hot data is copied to the new node as it is read (data locality).',
    'Break something and read the right-hand rail the way an admin reads Prism: health, how many more failures it can take right now, rebuild capacity, and self-heal progress.',
  ],
  numbers: [
    { k: 'Copies of data', v: 'RF2: 2 on different nodes · RF3: 3' },
    { k: 'Minimum nodes', v: 'RF2: 3 · RF3: 5 (1- and 2-node clusters are special edge cases)' },
    { k: 'Metadata and configuration copies', v: '3 at redundancy factor 2 · 5 at redundancy factor 3' },
    { k: 'Erasure coding minimum', v: '4 nodes at RF2 · 6 at RF3' },
    { k: 'Block or rack awareness minimum', v: '3 blocks/racks at RF2 · 5 at RF3 (4 and 6 with EC-X)' },
    { k: 'CVMs', v: 'One per node: controller capacity grows with the cluster' },
  ],
  qa: [
    {
      q: 'Does every node have to be identical?',
      a: 'No. Clusters can mix node models and sizes within the supported combinations, and storage-only nodes can add capacity without running VMs. Placement takes free space into account. This lab draws identical nodes to keep the picture simple.',
    },
    {
      q: 'What does the CVM cost me?',
      a: 'Each CVM reserves CPU and memory on its host, and the reservation grows when features such as deduplication are turned on. That is the honest overhead of putting the storage controller on every node. In exchange, controller capacity grows with each node instead of being a fixed box you outgrow.',
    },
    {
      q: 'If a VM moves, is its performance worse until data catches up?',
      a: 'Reads of data that has not been localized yet go over the network to the node that holds a copy, which adds some latency. Hot data is copied to the new node as it is read, and every new write puts one copy locally straight away, so this fades quickly for most workloads.',
    },
  ],
  next: [
    'Follow a VM, then live-migrate it from the VM panel and watch localization (purple dotted lines).',
    'Add a node and watch disk balancing spread data onto it.',
    'Power off a node: watch detection, HA restarts and the many-to-many rebuild, then scrub back.',
    'Open the Failure Gauntlet for scripted failures and the RF2 vs RF3 comparison.',
    'Open Protection & Capacity to turn this layout into usable capacity numbers.',
  ],
};

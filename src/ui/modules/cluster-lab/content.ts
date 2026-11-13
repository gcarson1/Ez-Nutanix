import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/cluster',
  title: 'Cluster & DSF Lab',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'The Distributed Storage Fabric (DSF) keeps VMs running and data protected through six everyday events on one 4-node cluster.',
  priority: 'P0',
  facts: {
    release: { v: 'AOS 7.6', sub: 'Jul 2026 · AHV 11.2' },
    license: { v: 'NCI Starter or higher', sub: 'RF3 and block or rack awareness need Pro or Ultimate' },
  },
  talk: [
    'Start with Data placement. Each node is a server running the hypervisor, the user VMs and one Controller VM (CVM). The CVMs pool every drive into one storage fabric, so there is no separate array.',
    'Every write is saved twice before it is confirmed: one copy on the VM’s own node, one on another node. That is RF2 (replication factor 2), the default.',
    'Live migration: the VM keeps running on its new node, its first reads cross the network, and the data it reads is copied to the new node (data locality).',
    'Planned shutdown: VMs move off live, the node is serviced, and data stays available from its other copy. This is what LCM does for each node during an upgrade.',
    'CVM failure: the host and its VMs keep running. On AHV, iSCSI redirection sends the host’s I/O to another CVM until its own CVM is back.',
    'VM failover and drive failure: high availability (HA) restarts VMs on the other nodes, as far as the HA settings and free memory allow, and every surviving node re-creates the missing copies at once. Nobody has to step in.',
  ],
  numbers: [
    { k: 'Copies of data', v: 'RF2: 2 copies on different nodes (default) · RF3: 3 copies' },
    { k: 'Minimum nodes', v: 'RF2: 3 · RF3: 5' },
    { k: 'HA restart', v: 'Automatic, once the host is declared failed (about 60 s), if the other hosts have free memory; after that it is each guest OS booting' },
    { k: 'Re-protection', v: 'Starts as soon as a failure is detected; every surviving node takes part' },
    { k: 'Maintenance', v: 'LCM updates one node at a time and waits for full protection before the next' },
    { k: 'CVMs', v: 'One per node: storage controller capacity grows with the cluster' },
  ],
  qa: [
    {
      q: 'Are we exposed while a node is in maintenance?',
      a: 'With two copies, data that had a copy on that node has only one copy online until the node is back. That is why LCM takes one node down at a time and waits for full protection before moving on. RF3 keeps three copies if you want headroom during that window. During AHV node maintenance, VMs that can be migrated are live migrated; pinned and RF1 VMs are powered off, and passthrough or other non-migratable VMs may need power-off or separate handling.',
    },
    {
      q: 'Is a VM slower right after it moves?',
      a: 'Reads of data that has not been copied over yet go across the network, which adds a little latency. Data is copied to the new node as it is read, and new writes put one copy there straight away, so this fades quickly for most workloads. VMs that mostly read data written elsewhere benefit less from locality.',
    },
    {
      q: 'What if the cluster is nearly full when something fails?',
      a: 'Re-creating copies needs free space on the surviving nodes. A cluster run close to full cannot fully re-protect itself, so common guidance is to keep the largest node’s worth of space free at RF2, and the two largest at RF3. The Failure Gauntlet shows the nearly-full case.',
    },
  ],
  next: [
    'Data placement: point out the two copies of VM1’s write and the shared storage pool.',
    'Live migration: VM2 keeps running while its data follows it to Node 2.',
    'Planned shutdown: VMs move live, then Node 3 catches up when it returns.',
    'VM failover: HA restarts Node 2’s VMs while every node re-creates the missing copies.',
    'Drive failure: the rebuild is shared by every node, not funneled into one spare.',
    'CVM failure: Node 2’s VMs keep running while Node 3’s CVM answers their I/O.',
    'Then open Failure Gauntlet for RF3, block and nearly-full cases.',
  ],
  then: ['nci/failures'],
};

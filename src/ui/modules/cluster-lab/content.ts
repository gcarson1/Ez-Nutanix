import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/cluster',
  title: 'Cluster & DSF Lab',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'One 4-node cluster, five everyday events. Pick one above the picture to see how the Distributed Storage Fabric (DSF) keeps VMs running and data protected.',
  priority: 'P0',
  talk: [
    'Start with Data placement. Each node is a server running the hypervisor, the user VMs and one Controller VM (CVM). The CVMs pool every drive into one storage fabric, so there is no separate array.',
    'Every write is saved twice before it is confirmed: one copy on the VM’s own node, one on another node. That is RF2, the default.',
    'Live migration: the VM keeps running on its new node, its first reads cross the network, and the data it reads is copied to the new node (data locality).',
    'Planned shutdown: VMs move off live, the node is serviced, and data stays available from its other copy. This is what LCM does for each node during an upgrade.',
    'VM failover and drive failure: HA restarts VMs on the other nodes, as far as the HA settings and free memory allow, and every surviving node re-creates the missing copies at once. Nobody has to step in.',
  ],
  numbers: [
    { k: 'Copies of data', v: 'RF2: 2 copies on different nodes (default) · RF3: 3 copies' },
    { k: 'Minimum nodes', v: 'RF2: 3 · RF3: 5' },
    { k: 'HA restart timing (typical)', v: 'Restarts begin about 60 s after a host fails; all VMs should be restarted within about 2 min if the other hosts have free memory' },
    { k: 'Re-protection', v: 'Starts as soon as a failure is detected; every surviving node takes part' },
    { k: 'Maintenance', v: 'LCM updates one node at a time and waits for full protection before the next' },
    { k: 'CVMs', v: 'One per node: storage controller capacity grows with the cluster' },
  ],
  qa: [
    {
      q: 'Are we exposed while a node is in maintenance?',
      a: 'With two copies, data that had a copy on that node has only one copy online until the node is back. That is why LCM takes one node down at a time and waits for full protection before moving on. RF3 keeps three copies if you want headroom during that window. VMs pinned to a host, or stored on single-copy (RF1) storage, are shut down instead of moved.',
    },
    {
      q: 'Are HA restarts guaranteed?',
      a: 'By default HA restarts VMs on a best-effort basis, as long as the other hosts have free memory. Turning on HA reservation sets aside one host’s worth of memory (two if any container is RF3) so every VM can restart. Restarted VMs boot again, so their applications see a short outage.',
    },
    {
      q: 'Is a VM slower right after it moves?',
      a: 'Reads of data that has not been copied over yet go across the network, which adds a little latency. Data is copied to the new node as it is read, and new writes put one copy there straight away, so this fades quickly for most workloads. VMs that mostly read data written elsewhere benefit less from locality.',
    },
    {
      q: 'What does the CVM cost me?',
      a: 'Each CVM reserves CPU and memory on its host, and the reservation grows when features such as deduplication are turned on. That is the overhead of putting the storage controller on every node. In exchange, controller capacity grows with each node instead of being a fixed box you outgrow.',
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
    'Open the Failure Gauntlet for RF3, block and nearly-full cases.',
  ],
};

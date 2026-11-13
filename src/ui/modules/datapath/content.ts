import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/datapath',
  title: 'Data Path',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Every acknowledged write already has all its copies on different nodes, and most reads are answered on the VM’s own server. One write and one read are followed step by step through the cluster.',
  priority: 'P0',
  facts: {
    release: { v: 'AOS 7.6', sub: 'Jul 2026 · AHV 11.2' },
    license: { v: 'NCI Starter or higher', sub: 'RF3 needs NCI Pro or Ultimate' },
  },
  talk: [
    'Every node runs a Controller VM (CVM). The VM’s I/O goes to the CVM on its own node first, so the first hop never crosses the network.',
    'A write is acknowledged only after all copies exist: 2 copies on 2 nodes with replication factor 2 (RF2), 3 copies on 3 nodes with RF3. That is why a node failure does not lose acknowledged data.',
    'Small random writes land in the OpLog, a buffer on the fastest drives, and drain to the extent store later in larger sequential chunks. Large sequential streams skip the OpLog but keep the same protection.',
    'Reads of recent writes come from the OpLog until they drain; other reads come from the content cache in CVM memory or the local drives. Reads prefer local data but may use a remote copy, for example after a VM moves.',
    'After a live migration the first reads go remote, then hot data is copied to the new node, so latency returns to normal without anyone doing anything.',
    'Under all of this, a distributed metadata store on every CVM records where each piece of data lives. It keeps 3 copies under redundancy factor 2 and 5 under redundancy factor 3.',
  ],
  numbers: [
    { k: 'Copies before a write is acknowledged', v: 'RF2: 2 · RF3: 3' },
    { k: 'Remote CVMs per write', v: 'RF2: 1 · RF3: 2' },
    { k: 'Metadata and configuration copies', v: 'RF2: 3 · RF3: 5' },
    { k: 'Sequential-write threshold', v: 'About 1.5 MB outstanding per vDisk (current docs; tunable)' },
  ],
  qa: [
    {
      q: 'Does waiting for remote copies make every write slow?',
      a: 'It adds one network round trip to a peer CVM, which is the cost of not losing acknowledged data when a node fails. The OpLog sits on the fastest media to keep that cost small. RF3 waits for two peers, so it has somewhat more write overhead than RF2.',
    },
    {
      q: 'What happens to performance right after a VM moves?',
      a: 'Reads of data not yet on the new node are served from a remote copy over the network, so latency rises for a while. AOS copies the hot data to the new node as it is read, and new writes are local from the start. How long that takes depends on the working set and load.',
    },
    {
      q: 'Is data locality a guarantee?',
      a: 'No. It is the normal case for reads, not a promise. Storage-only nodes, deduplicated data shared by many VMs, and workloads that move often are served partly from remote copies. The cluster still works the same way, with a network hop added.',
    },
  ],
  next: [
    'Under What happens, keep Small write selected with Copies on RF2 · 2 copies, and point at the acknowledgement arriving only after the second copy exists.',
    'Switch Copies to RF3 · 3 copies to show the third copy.',
    'Pick Large sequential write: the OpLog is skipped while protection stays the same.',
    'Pick Read: it is served from the local node, with no network hop.',
    'Pick Read after a VM moves: the first reads go remote, then the data follows the VM and latency drops back.',
    'Then open Cluster & DSF Lab to see the same two copies across a whole cluster.',
  ],
  then: ['nci/cluster'],
};

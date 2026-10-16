import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/datapath',
  title: 'Data Path',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Follow one write and one read through the cluster: where data lands, when the application gets its acknowledgement, and why most reads never leave the server.',
  priority: 'P0',
  talk: [
    'Every node runs a Controller VM (CVM). The VM’s I/O goes to the CVM on its own node first, so the first hop never crosses the network.',
    'A write is acknowledged only after all copies exist: 2 copies on 2 nodes with RF2, 3 copies on 3 nodes with RF3. That is why a node failure does not lose acknowledged data.',
    'Small random writes land in the OpLog, a buffer on the fastest drives, and drain to the extent store later in larger sequential chunks. Large sequential streams skip the OpLog but keep the same protection.',
    'Reads check the memory cache first, then the OpLog, then the local drives. Only if there is no local copy does the read go over the network.',
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
      q: 'Doesn’t waiting for remote copies make every write slow?',
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
    'Small write with RF2: point at the acknowledgement arriving only after the second copy exists, then switch to RF3 for the third.',
    'Large sequential write: the OpLog is skipped while protection stays the same.',
    'Read: served from the local node, with no network hop.',
    'Read after a VM moves: the first reads go remote, then the data follows the VM and latency drops back.',
  ],
};

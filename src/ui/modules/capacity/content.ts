import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/capacity',
  title: 'Protection & Capacity',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'How data is protected and what it costs: copies (RF2, RF3), erasure coding on cold data, and keeping copies in different blocks or racks. Each tab shows a failure and the cluster healing itself.',
  priority: 'P0',
  talk: [
    'Each shape is a piece of data. RF2 writes two copies of it, each on a different node; RF3 writes three. No node ever holds two copies of the same piece.',
    'When a node fails, every piece still has a copy on a healthy node, so nothing is lost and VMs keep running.',
    'Then healthy nodes copy each missing piece from a surviving copy onto another node. In a real cluster every node takes part at once, many nodes to many nodes, so it heals quickly and can take another failure.',
    'That protection costs capacity: usable is about half of raw with RF2 and about a third with RF3, before keeping free space so a rebuild has room: the largest node’s worth with RF2, the two largest with RF3.',
    'Moving from RF2 to RF3 can be done on a running cluster of at least 5 nodes: first the cluster’s redundancy factor, then each container, as long as there is free space for the third copy.',
    'Erasure coding tab: data that has not been overwritten for a while is encoded in the background into a strip of data and parity pieces, each on a different node, and its extra copies are deleted. A lost piece is recomputed from the rest of its strip.',
    'Be precise about the saving: a 4/1 strip uses 1.25 times the space instead of 2 times, but only for write-cold data, so the blended saving depends on how much of the data stays cold.',
    'Blocks and racks tab: start with Node only to show the risk, a piece whose two copies share a chassis, then switch to Block and Rack to show a whole block or rack failing with nothing unavailable.',
    'Present the numbers on this page as sizing guidance, not guarantees: RF overhead, EC-X savings and the rebuild reserve depend on the design, and the node, block and rack minimums can change with the AOS version, so confirm them for a real design.',
  ],
  numbers: [
    { k: 'RF2', v: '2 copies · at least 3 nodes · tolerates 1 failure' },
    { k: 'RF3', v: '3 copies · at least 5 nodes · tolerates 2 failures' },
    { k: 'Metadata and configuration copies', v: '3 (RF2) · 5 (RF3)' },
    { k: 'EC-X overhead examples', v: '4/1 = 1.25x (vs 2x) · 4/2 = 1.5x (vs 3x)' },
    { k: 'EC-X minimum nodes', v: '4 with RF2 · 6 with RF3' },
    { k: 'Block or rack awareness minimum', v: '3 (RF2) · 5 (RF3) · with EC-X: 4 · 6' },
    { k: 'Rebuild reserve (sizing guidance)', v: 'RF2: the largest node (N+1) · RF3: the two largest (N+2) · with block awareness, a whole block per failure tolerated' },
    { k: 'Resilient capacity (Prism)', v: 'Total capacity minus the space a rebuild needs; Prism warns at 75% of it by default' },
  ],
  qa: [
    {
      q: 'Can I just count on the EC-X savings when I size?',
      a: 'Be careful. EC-X only encodes write-cold data, after it has stayed cold for a while, so the theoretical strip saving is rarely reached. Size on replication-factor capacity and treat EC-X as a bonus until you have measured how much of your data is cold.',
    },
    {
      q: 'Why reserve a whole node of free space?',
      a: 'After a node failure, the cluster re-creates the missing copies on the remaining nodes. That needs free space equal to what the failed node held, so size for the largest node (the two largest with RF3). Without it, data stays available but runs with fewer copies until you add capacity, Prism raises an alert, and upgrade pre-checks can hold back an upgrade. Prism shows the safe limit as resilient capacity, and an optional Reserve Rebuild Capacity setting keeps that space from being filled.',
    },
    {
      q: 'Does erasure coding slow anything down?',
      a: 'Encoding runs in the background on data that has gone cold, so new writes are not affected. Rebuilding an encoded piece reads the rest of its strip, which is more work than copying a replica; that is one reason standard clusters top out at 4/1 and 4/2 strips. Inline erasure coding also exists, for example for Nutanix Objects.',
    },
    {
      q: 'Is block awareness automatic?',
      a: 'Placement keeps copies in different blocks once the cluster has enough blocks: at least 3 with RF2 and 5 with RF3, plus one more of each with erasure coding. Below that, copies are kept on different nodes only. Rack awareness needs the administrator to tell the cluster which rack each block is in.',
    },
    {
      q: 'Do I need RF3?',
      a: 'RF3 tolerates two simultaneous failures, at the cost of a third copy and more write work. It is common for large clusters and data where the risk window during a rebuild matters. Many clusters run RF2 with block awareness and a rebuild reserve. It is a risk decision, not a default.',
    },
  ],
  next: [
    'RF2 with 8 nodes: let one loop play and point out that no node ever holds two copies of the same shape.',
    'Watch the node fail: every shape still has a copy somewhere, then the healthy nodes re-create the missing copies together.',
    'Switch to RF3: three copies of each shape, and two nodes can fail at once.',
    'Change the node count and read the capacity bar: your data, the extra copies, and the space kept free for a rebuild.',
    'Erasure coding tab: watch the cold pieces become a strip and their extra copies disappear, then the lost piece rebuilt from the rest of its strip. Read the usable-share bars.',
    'Blocks and racks tab: Node only first (one piece unavailable), then Block and Rack (nothing unavailable).',
    'Then open the Failure Gauntlet for other failures.',
  ],
};

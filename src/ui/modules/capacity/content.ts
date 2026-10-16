import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/capacity',
  title: 'Protection & Capacity',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'RF2 keeps two copies of every piece of data on different nodes, RF3 keeps three. Watch copies spread across the cluster, a failure, and the copies being re-created, plus what it costs in capacity.',
  priority: 'P0',
  talk: [
    'Each shape is a piece of data. RF2 writes two copies of it, each on a different node; RF3 writes three. No node ever holds two copies of the same piece.',
    'When a node fails, every piece still has a copy on a healthy node, so nothing is lost and VMs keep running.',
    'Then the healthy nodes re-create the missing copies together, many nodes to many nodes, so the cluster heals itself quickly and can take another failure.',
    'That protection costs capacity: usable is about half of raw with RF2 and about a third with RF3, before keeping a node’s worth of space free so the rebuild has room.',
    'Moving from RF2 to RF3 is done online. Erasure coding (EC-X), and block and rack awareness, cut the cost or widen the failure domain further; the Cluster & DSF Lab shows those.',
  ],
  numbers: [
    { k: 'RF2', v: '2 copies · at least 3 nodes · tolerates 1 failure' },
    { k: 'RF3', v: '3 copies · at least 5 nodes · tolerates 2 failures' },
    { k: 'Metadata and configuration copies', v: '3 (RF2) · 5 (RF3)' },
    { k: 'EC-X overhead examples', v: '4/1 = 1.25x (vs 2x) · 4/2 = 1.5x (vs 3x)' },
    { k: 'EC-X minimum nodes', v: '4 with RF2 · 6 with RF3' },
    { k: 'Block or rack awareness minimum', v: '3 (RF2) · 5 (RF3) · with EC-X: 4 · 6' },
    { k: 'Rebuild reserve (common sizing guidance)', v: 'N+1 for RF2 · N+2 for RF3 or above 24 nodes · a block’s worth with block awareness' },
  ],
  qa: [
    {
      q: 'Can I just count on the EC-X savings when I size?',
      a: 'Be careful. EC-X only encodes write-cold data, after it has stayed cold for a while, so the theoretical strip saving is rarely reached. Size on replication-factor capacity and treat EC-X as a bonus until you have measured how much of your data is cold.',
    },
    {
      q: 'Why reserve a whole node of free space?',
      a: 'After a node failure, the cluster re-creates the missing copies on the remaining nodes. That needs free space equal to what the failed node held. Without it, data stays available but runs with fewer copies until you add capacity.',
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
    'Then open the Failure Gauntlet for other failures, or the Cluster & DSF Lab for EC-X, blocks and racks.',
  ],
  honest: [
    'EC-X only applies to write-cold data and is applied in the background, so the full theoretical saving is rarely reached. Larger strips save more but make rebuilds more expensive.',
    'A rebuild reserve is capacity you pay for and do not fill. Skipping it means a failure leaves data with fewer copies until capacity is added.',
    'RF3 gives about two thirds of the usable capacity RF2 would give from the same drives, and adds write overhead. Block and rack awareness need enough blocks and racks to work.',
    'This view models EC-X as post-process encoding of write-cold data, the default behavior. Inline erasure coding also exists (for example for Objects, and as an option in newer releases) and is not modeled here.',
    'Compression and deduplication ratios vary widely by workload. This calculator uses 1.0:1 unless you enter a measured figure.',
    'This calculator is for discussion. Use the official sizing tool for quotes; it accounts for per-version system overheads that are not modeled here.',
  ],
};

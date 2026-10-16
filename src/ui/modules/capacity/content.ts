import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/capacity',
  title: 'Protection & Capacity',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'How much you can store, what it costs to protect it, and which failures it survives: RF2, RF3, erasure coding and failure domains in one calculator.',
  priority: 'P0',
  talk: [
    'Start from raw: the sum of every drive. Protection is the biggest deduction. RF2 keeps 2 copies, so usable is about half of raw; RF3 keeps 3, so about a third.',
    'Erasure coding (EC-X) stores write-cold data as data plus parity, for example 4 data and 1 parity at 1.25x instead of 2x. It only applies to data that is not being overwritten, so the real saving depends on how much of your data is cold.',
    'Keep a rebuild reserve. If a node fails, its data is re-protected onto the free space of the other nodes. A cluster with no free space can survive the failure but cannot heal.',
    'Copies go to different nodes by default. Block and rack awareness spread them across chassis and racks too, so a whole chassis or rack can fail.',
    'Container replication factor and cluster redundancy factor are separate. A redundancy factor 3 cluster can hold both RF2 and RF3 containers.',
    'Moving from RF2 to RF3, or turning on EC-X, is done online. Because it re-lays out data in the background, check capacity first: RF3 needs 50% more physical space for the same data.',
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
    'Start with the 8-node preset and read the bar from raw down to usable after reserve.',
    'Turn on EC-X and move the write-cold slider to show how the saving depends on workload.',
    'Set 2 nodes per block, turn block awareness on, and show the Block row change in the survival matrix.',
    'Raise space used today to 60% and show the RF3 conversion being blocked by the capacity check.',
    'Open the Failure Gauntlet to watch a node fail and the reserve being used.',
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

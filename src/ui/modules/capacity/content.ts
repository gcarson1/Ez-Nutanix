import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/capacity',
  title: 'Protection & Capacity',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Data stays available through a node failure, and through a block or rack failure with awareness on, while the cluster heals itself. Replication factor (RF2, RF3), erasure coding (EC-X) and block or rack awareness set the capacity cost.',
  priority: 'P0',
  talk: [
    'Each shape is a piece of data. RF2 writes two copies of it, each on a different node; RF3 writes three. No node ever holds two copies of the same piece.',
    'When a node fails, every piece still has a copy on a healthy node, so nothing is lost and VMs keep running.',
    'Then healthy nodes copy each missing piece from a surviving copy onto another node. In a real cluster every node takes part at once, so it heals quickly and can take another failure.',
    'That protection costs capacity. As sizing guidance, usable is about half of raw with RF2 and about a third with RF3, less the free space a rebuild needs: the largest node with RF2, the two largest with RF3.',
    'Erasure coding (EC-X) encodes write-cold data in the background into a strip of data and parity pieces on different nodes, then deletes the extra copies. A 4/1 strip uses 1.25× the space instead of 2×, for cold data only.',
    'Blocks and racks tab: start with Node only to show the risk, a piece whose two copies share a chassis, then switch to Block and Rack to show a whole block or rack failing with nothing unavailable.',
  ],
  numbers: [
    { k: 'RF2', v: '2 copies · at least 3 nodes · tolerates 1 failure' },
    { k: 'RF3', v: '3 copies · at least 5 nodes · tolerates 2 failures' },
    { k: 'Metadata and configuration copies', v: '3 (RF2) · 5 (RF3)' },
    { k: 'EC-X overhead examples', v: '4/1 = 1.25× (vs 2×) · 4/2 = 1.5× (vs 3×)' },
    { k: 'EC-X minimum nodes', v: '4 with RF2 · 6 with RF3' },
    { k: 'Block or rack awareness minimum', v: '3 (RF2) · 5 (RF3) · with EC-X: 4 · 6 · below that, copies are kept on different nodes only' },
    { k: 'Moving from RF2 to RF3', v: 'On a running cluster of at least 5 nodes: the cluster’s redundancy factor first, then each container, with free space for the third copy' },
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
      a: 'After a node failure, the cluster re-creates the missing copies on the remaining nodes. That needs free space equal to what the failed node held, so size for the largest node (the two largest with RF3). Without it, data stays available but runs with fewer copies until you add capacity. Prism raises an alert and upgrade pre-checks can hold back an upgrade. Prism shows the safe limit as resilient capacity, and an optional Reserve Rebuild Capacity setting keeps that space from being filled.',
    },
    {
      q: 'Does erasure coding slow anything down?',
      a: 'Encoding runs in the background on data that has gone cold, so new writes are not affected. Rebuilding an encoded piece reads the rest of its strip, which is more work than copying a replica; that is one reason standard clusters top out at 4/1 and 4/2 strips. Inline erasure coding also exists, for example for Nutanix Objects.',
    },
  ],
  next: [
    'On the Copies (RF2, RF3) tab, RF2 · 2 copies opens on 3 nodes, the smallest standard cluster. Point out that no node ever holds two copies of the same shape.',
    'Watch the node fail: every shape still has a copy somewhere, then the healthy nodes re-create the missing copies together.',
    'Switch Copies to RF3 · 3 copies, which moves to 5 nodes with three copies of each shape, then pick 8 under Nodes and read the capacity bar.',
    'Open the Erasure coding (EC-X) tab and watch cold pieces become a strip and their extra copies disappear. Read the usable-share bars.',
    'Open the Blocks and racks tab and pick Node only (one piece unavailable), then Block and Rack (nothing unavailable).',
    'Then open Failure Gauntlet to see other failures.',
  ],
  then: ['nci/failures'],
};

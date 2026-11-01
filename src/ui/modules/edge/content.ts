import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/edge',
  title: 'Edge & ROBO',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Remote and branch offices (ROBO) and edge sites run on one, two or three nodes, all managed from one Prism Central. Each size survives different failures.',
  priority: 'P1',
  talk: [
    'Start with the trade-off: fewer nodes cost less and fit in a closet, but each size survives different things.',
    'One node: the cheapest option, with lowered resiliency. A drive failure can be rebuilt inside the node, but a node outage is site downtime, so plan backup or replication.',
    'Two nodes plus a small Witness VM at another site survive a node failure. The survivor switches to single-node mode and keeps two copies of data on its own drives, if it has room. Getting back to two-node mode takes a while.',
    'Three nodes: the standard cluster, with two copies of data (RF2). It self-heals after a node failure if there is free capacity, and upgrades roll with no VM downtime.',
    'Every site runs on its own, even if the wide area network (WAN) drops. Prism Central in the data center manages them all as a fleet, including LCM upgrades.',
    'Growing a site is where small clusters differ: from AOS 7.6 a two-node AHV cluster can add a third node, one way. A single node cannot be expanded; the path is a new cluster.',
  ],
  numbers: [
    { k: 'Two-node switch to single-node mode', v: 'Typically 30 to 60 s with the Witness reachable (guest disk timeout of at least 60 s recommended)' },
    { k: 'Two-node return to two-node mode', v: 'Typically 15 min of steady heartbeat, then a resync that can take hours' },
    { k: 'Two-node sizing', v: 'Run on one node: disk and memory at about 40% or less' },
    { k: 'Two-node copies', v: 'Data 2 copies (one per node), metadata 4 copies' },
    { k: 'Single-node async DR', v: 'Recovery point objective (RPO) of 6 hours only, per Nutanix guidance (check your release)' },
    { k: 'Adding a node', v: '1 node: not supported · 2 nodes: to three from AOS 7.6 on AHV · 3 nodes: Expand Cluster' },
  ],
  qa: [
    {
      q: 'Is a two-node cluster as resilient as three nodes?',
      a: 'It survives a single node failure, which is the main point. The differences: it relies on a Witness at another site for automatic failover, the return to two-node mode after a repair can take hours of resync, it must be sized so one node can carry the site, and some features (such as network segmentation) are not supported.',
    },
    {
      q: 'What happens if the WAN goes down?',
      a: 'The site keeps running its VMs and can be managed locally through Prism Element on the cluster. Central monitoring and fleet operations wait for the link. For two-node sites the Witness is usually on the other side of that link, so plan the WAN and Witness placement together, and do not schedule maintenance while it is unreachable.',
    },
    {
      q: 'When should we choose a single node?',
      a: 'When the site can tolerate downtime from a node outage and the data is protected elsewhere by backup or replication (Nutanix guidance limits async from a single node to a 6-hour RPO; check your release). Upgrades also mean shutting down the guest VMs. If the site cannot accept that, use two or three nodes.',
    },
  ],
  next: [
    'Start on “2 nodes + Witness” with “Node fails”: the survivor switches to single-node mode and HA restarts the VMs on it.',
    'Keep “Node fails” and switch Site size to “1 node” (the site goes down), then “3 nodes” (it re-protects itself).',
    'Pick “Nodes lose contact”: on two nodes the Witness picks one node to carry on; on three, the two connected nodes carry on and restart the cut-off node’s VMs.',
    'Pick “Link to the data center drops” to show the site keeps running on its own.',
    'Pick “Add a node” on “1 node”, then “2 nodes”: one cannot grow, the other becomes a three-node cluster. Then point at “What each size survives” to compare every size.',
    'Then open LCM Rolling Upgrade for upgrades, Nutanix Central & Prism Federation for fleet management, or Disaster Recovery to protect the site elsewhere.',
  ],
  then: ['nci/lcm', 'central', 'nci/dr'],
};

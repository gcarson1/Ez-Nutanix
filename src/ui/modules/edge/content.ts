import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/edge',
  title: 'Edge & ROBO Clusters',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Remote and branch offices (ROBO) and edge sites can run one, two or three nodes. See what each size survives, and how every site is managed from one Prism Central.',
  priority: 'P1',
  talk: [
    'Start with the trade-off: fewer nodes cost less and fit in a closet, but each size survives different things.',
    'One node: the cheapest option, with lowered resiliency. A drive failure can be rebuilt inside the node, but a node outage is site downtime, so plan backup or replication.',
    'Two nodes plus a small Witness VM at another site: survives a node failure. The survivor switches to single-node mode and keeps two copies of data on its own drives. Getting back to two-node mode takes a while, so be honest about that.',
    'Three nodes: the standard RF2 cluster. It self-heals after a node failure if there is free capacity, and upgrades roll with no VM downtime.',
    'Every site runs on its own, even if the WAN drops. Prism Central in the data center manages them all as a fleet, including LCM upgrades.',
  ],
  numbers: [
    { k: 'Two-node switch to single-node mode', v: 'About 30–60 s (guest disk timeout of at least 60 s recommended)' },
    { k: 'Two-node return to two-node mode', v: '15 min of steady heartbeat, then a resync that can take hours' },
    { k: 'Two-node sizing', v: 'Run on one node: disk and memory at about 40% or less' },
    { k: 'Two-node copies', v: 'Data 2 copies (one per node), metadata 4 copies' },
    { k: 'Single-node async DR', v: '6-hour RPO only' },
  ],
  qa: [
    {
      q: 'Is a two-node cluster as resilient as three nodes?',
      a: 'It survives a single node failure, which is the main point. The differences: it relies on a Witness at another site for automatic failover, the return to two-node mode after a repair can take hours of resync, it must be sized so one node can carry the site, and some features (such as network segmentation) are not supported.',
    },
    {
      q: 'What happens if the WAN goes down?',
      a: 'The site keeps running its VMs and can be managed locally through Prism Element on the cluster. Central monitoring and fleet operations wait for the link. For two-node sites the Witness is usually on the other side of that link, so plan the WAN and Witness placement together, and don’t schedule maintenance while it is unreachable.',
    },
    {
      q: 'When should we choose a single node?',
      a: 'When the site can tolerate downtime from a node outage and the data is protected elsewhere by backup or replication (async from a single node is limited to a 6-hour RPO). Upgrades also mean shutting down the guest VMs. If the site cannot accept that, use two or three nodes.',
    },
  ],
  next: ['LCM Rolling Upgrade (try 1 and 2 nodes)', 'Nutanix Central (fleet management)', 'Disaster Recovery (protect the site elsewhere)'],
  honest: [
    'A single-node cluster has no node-level redundancy: a node outage takes the site down, and an SSD failure can make it read-only.',
    'Two-node clusters depend on a Witness in a separate failure domain, and on WAN reachability to it for automatic failover and maintenance.',
    'After a two-node failure is repaired, the cluster stays in a degraded state until a resync that can take hours finishes.',
    'Small clusters must be sized so the survivors can carry the whole site, which leaves less usable capacity per node.',
  ],
};

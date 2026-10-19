import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/dr',
  title: 'Disaster Recovery',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Pick how much data you can afford to lose (the RPO), and the protection policy chooses the replication tier. Recovery plans then bring applications up at another site, in order, with one click.',
  priority: 'P0',
  talk: [
    'Protection is policy-based: you set a recovery point objective (RPO), assign VMs to the policy with categories, and the platform picks the replication tier.',
    'Three tiers, each with an RPO target: asynchronous at 1 hour or more, NearSync at 1 to 15 minutes, and synchronous at RPO 0 for sites under 5 ms round trip.',
    'The honest picture: between copies, recent writes exist only at the primary site. An unplanned failover loses whatever had not reached the other site yet.',
    'Recovery plans are the runbook: boot order in stages, delays, network mapping and scripts. Test failover runs the same plan on clones in an isolated network, so you can prove it works without touching production.',
    'For zero data loss with automatic failover, synchronous replication plus a Witness in a separate fault domain lets the surviving site take over on its own, in a setup Nutanix supports for your hypervisor and release.',
    'Sites can be combined: a nearby synchronous partner plus a distant NearSync or async copy, or a cloud site on Nutanix Cloud Clusters (NC2).',
  ],
  numbers: [
    { k: 'Asynchronous', v: 'RPO target of 1 hour or more (up to 24 hours)' },
    { k: 'NearSync', v: 'RPO target of 1 to 15 minutes' },
    { k: 'Synchronous', v: 'RPO 0, needs under 5 ms round-trip time' },
    { k: 'Automatic failover', v: 'Synchronous (Metro) + Witness in a separate fault domain, in supported setups' },
    { k: 'NC2 clouds', v: 'AWS, Microsoft Azure, Google Cloud, OVHcloud' },
  ],
  qa: [
    {
      q: 'Why not run everything synchronous and never lose data?',
      a: 'Synchronous replication makes every write wait for the remote site, so it adds roughly one round trip of latency to each write and needs sites under 5 ms apart. Nearby sites can share a regional outage, so it is often paired with a farther asynchronous or NearSync copy.',
    },
    {
      q: 'Will we really meet a 15-minute RPO?',
      a: 'Only if the link can ship each recovery point before the next one is due. RPO depends on change rate and bandwidth; if the link falls behind, exposure grows past the target. Size bandwidth for peak change rate, and watch for policy alerts.',
    },
    {
      q: 'How do we know failover will work when we need it?',
      a: 'Run test failovers regularly. They start the recovery plan on clones in an isolated network, so production keeps running. That is also where you catch missing network mappings or boot-order mistakes.',
    },
  ],
  next: [
    'Async, unplanned: pause just before Site A is lost and point at the writes that exist only at Site A.',
    'Switch to NearSync, then Sync: the data that could be lost shrinks from hours to minutes to none.',
    'Planned failover: nothing is lost with any tier, because the last changes are copied before the switch.',
    'Then open Hybrid & Public Cloud to use a cloud as the recovery site.',
  ],
};

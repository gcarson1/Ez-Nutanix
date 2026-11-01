import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/dr',
  title: 'Disaster Recovery',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Protection policies decide how much data a failover can lose, from hours with asynchronous replication to none with Metro Availability, and recovery plans start the apps at another site in order.',
  priority: 'P0',
  talk: [
    'Protection is policy-based: you set a recovery point objective (RPO), assign VMs to the policy with categories, and the platform picks the replication tier.',
    'Three choices on screen: Async (RPO target of 1 hour or more), NearSync / Sync (1 to 15 minutes, or RPO 0 for sites under 5 ms round trip) and Metro Availability (RPO 0 with automatic failover).',
    'The honest picture: between copies, recent writes exist only at the primary site. An unplanned failover loses whatever had not reached the other site yet.',
    'Recovery plans are the runbook: boot order in stages, delays, network mapping and scripts. Test failover runs the same plan on clones in an isolated network, so you can prove it works without touching production.',
    'Metro Availability is zero data loss with automatic failover: synchronous replication between sites under 5 ms round trip, plus a Witness in a third location that gives the surviving site the lock so its VMs restart on their own.',
    'Sites can be combined: a nearby synchronous partner plus a distant NearSync or async copy, or a cloud site on Nutanix Cloud Clusters (NC2).',
  ],
  numbers: [
    { k: 'Asynchronous', v: 'RPO target of 1 hour or more (up to 24 hours)' },
    { k: 'NearSync', v: 'RPO target of 1 to 15 minutes' },
    { k: 'Synchronous', v: 'RPO 0, needs under 5 ms round-trip time; failover is started by a person' },
    { k: 'Metro Availability', v: 'Synchronous + a Witness in a third location: automatic failover restarts the VMs at the surviving site (minutes); a planned move can live-migrate them instead' },
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
      q: 'What if only the link between the sites breaks?',
      a: 'With Metro Availability the Witness settles it: the site that gets its lock keeps running the VMs, and replication pauses instead of failing over, so the VMs never run in both places. On AHV an administrator resumes replication once the link is back. If a site loses both the other site and the Witness, it stops its VMs so the other site can take over safely.',
    },
  ],
  next: [
    'Start on “Async” and “Unplanned (site lost)”: pause just before Site A is lost and point at the writes that exist only at Site A.',
    'Switch Replication to “NearSync / Sync”, then “Metro Availability”: the data that could be lost shrinks from hours to minutes to none, and with Metro the Witness starts the failover on its own.',
    'Choose “Planned failover”: nothing is lost with any choice, because the last changes are copied first; with Metro Availability the apps live-migrate and never stop.',
    'Then open Hybrid & Public Cloud to use a cloud as the recovery site.',
  ],
  then: ['cloud'],
};

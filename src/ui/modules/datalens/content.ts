import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'datalens',
  title: 'Data Lens',
  tag: 'Nutanix Central',
  summary: 'Data Lens spots ransomware and unusual access on Nutanix Files and Objects and can block the offending user or client. On Files it also restores affected files from a clean snapshot, and it tracks access patterns to tier cold data to cheaper storage automatically.',
  priority: 'P2',
  talk: [
    'Unstructured data is where ransomware hurts most: shared drives that many users can write to. Data Lens reads the file activity on the share. Known strains match its signature list; Pro adds behavior analytics that flag a strain nobody has seen before.',
    'User behavior analytics (UBA) compares each user with their own past activity, so one user changing files at an abnormal rate stands out.',
    'Unusual activity tab: a fixed anomaly rule (more than so many operations in an interval) alerts on users who are simply busy and misses a mass delete that stays under the number. UBA learns each user’s normal over a 30-day warmup, per operation type and per share, and flags a meaningful deviation from it; you tune the deviation percentage and a minimum count, exclude users or shares, and schedule when each method watches.',
    'Watch the alert fire and the client get blocked automatically, seconds after the attack starts, so only a slice of the share is hit.',
    'Recovery comes from snapshots the client cannot touch: one action restores the affected files to the last clean version. Be clear about the recovery point: edits made after that snapshot are lost.',
    'Data age & tiering tab: from each file’s access pattern Data Lens sorts it hot, warm or cold, levels you define. When the data is old enough and the file server passes its capacity threshold, Smart Tiering moves cold data to Nutanix Objects, AWS S3, Azure Blob or Wasabi in its time window; a stub stays so users read the file inline at the same path.',
    'It runs as SaaS or fully on-premises, including air-gapped sites, since Data Lens 2.0. On-Prem 2.1 added Nutanix Objects, UBA and finer role-based access control.',
  ],
  numbers: [
    { k: 'Known ransomware signatures', v: 'Over 65,000' },
    { k: 'Data Lens 2.0 on-premises', v: 'GA Apr 2026, air-gapped capable' },
    { k: 'On-Prem 2.1', v: 'Aug 2026: adds Objects (5.4 or later), UBA (Pro) and granular RBAC' },
    { k: 'Covers', v: 'Nutanix Files and Objects; Amazon S3 on SaaS Pro' },
    { k: 'Starter vs Pro', v: 'Starter: signatures and blocking. Pro: behavior-based detection, UBA, permission reports' },
    { k: 'Files only', v: 'Behavior analytics (UBA) and automated recovery' },
    { k: 'UBA anomaly detection', v: '30-day warmup per user, operation type and share; announced for SaaS May 2026, On-Prem Pro in 2.1' },
    { k: 'Smart Tiering targets', v: 'Nutanix Objects, AWS S3, Azure Blob, Wasabi; metadata and a stub stay in the share' },
  ],
  qa: [
    {
      q: 'Does it classify personal or sensitive data (PII)?',
      a: 'No, that is not what Data Lens is sold for. Its privacy side is audit trails, permission mapping and access-risk reporting (Pro), with the metadata kept on-premises if you choose. On-premises, granular RBAC since 2.1 can scope each admin role to specific file servers.',
    },
    {
      q: 'Can it run without sending anything to the cloud?',
      a: 'Yes. Since Data Lens 2.0 (GA April 2026) it runs fully on-premises, including air-gapped sites. It needs Prism Central pc.7.5 or later and replaces the older File Analytics.',
    },
    {
      q: 'Will it stop every attack?',
      a: 'No tool can promise that. Detection reduces how much gets encrypted; snapshots are what make recovery possible. Behavior-based detection is a Pro feature, and UBA and automated recovery are listed for Files, not Objects. Keep snapshot schedules and backups that match the recovery point you need.',
    },
  ],
  next: [
    'Let one loop play: the PC is blocked seconds after Attack starts.',
    'Pause on PC blocked and point to Files hit.',
    'Pause on Files recovered: edits made after the snapshot are lost.',
    'On Unusual activity, pause on Ben’s deletes flagged: under the fixed rule they were missed.',
    'Then open Snapshots & Clones for the recovery points behind the restore.',
  ],
  then: ['nci/snapshots'],
};

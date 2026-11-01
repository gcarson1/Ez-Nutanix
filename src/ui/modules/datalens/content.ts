import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'datalens',
  title: 'Data Lens',
  tag: 'Nutanix Central',
  summary: 'Data Lens spots ransomware and unusual access on Nutanix Files and Objects and can block the offending user or client. On Files it also restores affected files from a clean snapshot.',
  priority: 'P2',
  talk: [
    'Unstructured data is where ransomware hurts most: shared drives that many users can write to.',
    'Data Lens reads the file activity on the share. Known strains match its signature list; Pro adds behavior analytics that flag a strain nobody has seen before.',
    'User behavior analytics (UBA) compares each user with their own past activity, so one user changing files at an abnormal rate stands out.',
    'Watch the alert fire and the client get blocked automatically, seconds after the attack starts, so only a slice of the share is hit.',
    'Recovery comes from snapshots the client cannot touch: one action restores the affected files to the last clean version. Be clear about the recovery point: edits made after that snapshot are lost.',
    'It runs as SaaS or fully on-premises, including air-gapped sites, since Data Lens 2.0. On-Prem 2.1 added Nutanix Objects, UBA and finer role-based access control.',
  ],
  numbers: [
    { k: 'Known ransomware signatures', v: 'Over 65,000' },
    { k: 'Data Lens 2.0 on-premises', v: 'GA Apr 2026, air-gapped capable' },
    { k: 'On-Prem 2.1', v: 'Aug 2026: adds Objects (5.4 or later), UBA (Pro) and granular RBAC' },
    { k: 'Covers', v: 'Nutanix Files and Objects; Amazon S3 on SaaS Pro' },
    { k: 'Starter vs Pro', v: 'Starter: signatures and blocking. Pro: behavior-based detection, UBA, permission reports' },
    { k: 'Files only', v: 'Behavior analytics (UBA) and automated recovery' },
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
    'Then open Snapshots & Clones for the recovery points behind the restore.',
  ],
  then: ['nci/snapshots'],
};

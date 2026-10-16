import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'datalens',
  title: 'Data Lens',
  tag: 'Nutanix Central',
  summary: 'Data Lens watches activity on Nutanix Files and Objects, spots ransomware and unusual access, blocks the offending client, and restores affected files from a clean snapshot.',
  priority: 'P2',
  talk: [
    'Unstructured data is where ransomware hurts most: shared drives that many users can write to.',
    'Data Lens reads the file activity on the share. Known strains match its signature list. Pro adds behavior analytics that flags a user changing files at an abnormal rate, even for a strain nobody has seen before.',
    'Pick Auto-block: the alert fires, the client is blocked, and only a slice of the share is hit. Then Alert only: the same alert fires, but the client keeps encrypting until someone acts.',
    'Recovery comes from snapshots. The client cannot touch them, so one action restores the affected files to the last clean version.',
    'Be clear about the recovery point: edits made after that snapshot are lost on the files that were encrypted.',
    'It runs as SaaS or fully on-premises, including air-gapped sites, since Data Lens 2.0.',
  ],
  numbers: [
    { k: 'Known ransomware signatures', v: 'over 65,000' },
    { k: 'Data Lens 2.0 on-prem', v: 'GA April 2026, air-gapped capable' },
    { k: 'On-Prem 2.1', v: 'August 2026: adds Nutanix Objects' },
    { k: 'Covers', v: 'Files, Objects; Amazon S3 on SaaS Pro' },
  ],
  qa: [
    {
      q: 'Does it classify personal or sensitive data (PII)?',
      a: 'No, that is not what Data Lens is sold for. Its privacy side is audit trails, permission mapping and access-risk reporting, with the metadata kept on-premises if you choose.',
    },
    {
      q: 'Can it run without sending anything to the cloud?',
      a: 'Yes. Since Data Lens 2.0 (GA April 2026) it runs fully on-premises, including air-gapped sites. It needs Prism Central 7.5 or later and replaces the older File Analytics.',
    },
    {
      q: 'Will it stop every attack?',
      a: 'No tool can promise that. Detection reduces how much gets encrypted; snapshots are what make recovery possible. Keep snapshot schedules and backups that match the recovery point you need.',
    },
  ],
  next: ['Files, Objects', 'Snapshots & Clones', 'Flow'],
  honest: [
    'Recovery is only as recent as the last clean snapshot; edits after it on the affected files are lost. Frequent snapshots narrow that gap but use capacity.',
    'Behavior-based detection is a Pro feature, and automated recovery applies to Nutanix Files. Check the tier and storage type you plan to use.',
    'Detection needs some activity before it is confident, so a few files are typically hit before the client is blocked.',
  ],
};

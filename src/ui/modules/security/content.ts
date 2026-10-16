import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/security',
  title: 'Data Security',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Encryption for data at rest, and what it does and does not protect: choose whether data is encrypted and where its keys live, then see whether a stolen drive or a stolen node can be read.',
  priority: 'P1',
  talk: [
    'Start with the threat. Encryption at rest protects drives and nodes that leave your control: stolen, sent back for repair or thrown away. It does nothing against an attacker inside a running VM.',
    'Two ways to encrypt: software encryption in AOS on ordinary drives, which Nutanix positions for most cases, or self-encrypting drives (SEDs) when policy requires hardware encryption. They can be layered (dual encryption).',
    'Apps see no change: data is encrypted before it reaches a drive and decrypted for any authorized reader.',
    'Keys can be managed natively by the cluster, with no extra server, or by your existing external key manager, so keys and data never sit in the same place. That is what protects you if a whole node walks out.',
    'Beyond encryption, hardening is built in: in current releases a security profile (Standard, Elevated or Strict) is applied from Prism Central and checked every 2 hours, putting drifted settings back where it can.',
  ],
  numbers: [
    { k: 'Encryption options', v: 'Software (AOS), self-encrypting drives, or both' },
    { k: 'Key management', v: 'Native (on the cluster) or external key manager' },
    { k: 'Software encryption module', v: 'FIPS 140-2 Level 1 validated (per Nutanix)' },
    { k: 'Security profiles', v: 'Standard, Elevated, Strict (AOS 7.6, PC 7.6, AHV 11.2)' },
    { k: 'Drift check', v: 'Every 2 hours' },
  ],
  qa: [
    {
      q: 'Do we need self-encrypting drives?',
      a: 'Usually not. Software encryption works on standard drives and is what Nutanix positions for most use cases. SEDs make sense when a policy or regulation specifically requires hardware-based encryption.',
    },
    {
      q: 'Does encryption protect us from ransomware?',
      a: 'No. Ransomware writes through the VM like any application, so its output is simply stored, encrypted at rest like everything else. Defend with microsegmentation (Flow), detection on file shares (Data Lens) and good recovery points (snapshots and DR).',
    },
    {
      q: 'Will this pass our compliance audit?',
      a: 'It helps, but no product makes you compliant on its own. Nutanix publishes a STIG for AOS developed with DISA and a hardening guide, and security profiles keep settings in line; some items (syslog, network segmentation, LDAP) are still configured by you. Feature availability depends on version and license.',
    },
  ],
  next: [
    'Start with encryption Off and “A drive is stolen”: the drive is readable. Switch to the built-in key manager: the same drive is unreadable.',
    'Choose “A whole node is stolen” and compare the built-in key manager with an external key manager: only the external one keeps the keys away from the stolen node.',
    'Point out the cost of the external key manager: another server to run, back up and keep reachable.',
    'Then show Flow for traffic between VMs, and snapshots and DR for recovery, the threats encryption does not cover.',
  ],
};

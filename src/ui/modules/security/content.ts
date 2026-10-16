import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/security',
  title: 'Data Security',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Encryption for data at rest, a hardened configuration that puts itself back when it drifts, and microsegmentation for traffic between VMs: separate layers for separate threats.',
  priority: 'P1',
  talk: [
    'Start with the threat. Encryption at rest protects drives and nodes that leave your control; it does nothing against an attacker inside a running VM.',
    'Two ways to encrypt: software encryption in AOS on ordinary drives, or self-encrypting drives (SEDs) when policy requires hardware encryption. They can be layered (dual encryption).',
    'Keys can be managed natively by the cluster, with no extra server, or by your existing external key manager, so keys and data never sit in the same place.',
    'Hardening is built in: in current releases a security profile (Standard, Elevated or Strict) is applied from Prism Central and checked every 2 hours, putting drifted settings back where it can.',
    'Flow covers the traffic between VMs, Data Lens watches file shares for ransomware patterns, and snapshots and DR are the way back when something gets through.',
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
    'Set encryption to None and threat to "a drive is pulled": readable. Switch to Software: protected.',
    'Pick "a whole node is stolen" and compare the native key manager with an external KMS.',
    'Pick "ransomware inside a VM" to show what encryption does not cover.',
    'Play the drift timeline at the Strict profile.',
    'Open Flow from the layers row to show microsegmentation and quarantine.',
  ],
  honest: [
    'Encryption at rest only protects media. Data is decrypted for any authorized reader, including a compromised VM or a stolen admin account.',
    'An external key manager is another critical system to run, back up and keep highly available: if the cluster cannot reach its keys, it cannot read its data.',
    'Security profiles do not cover every setting; some remain manual, and changes that need a reboot raise an alert rather than applying themselves.',
    'Which encryption levels, profiles and integrations are available depends on hypervisor, software version and license. Check the Security Guide for your release.',
  ],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/security',
  title: 'Data Security',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Encryption at rest keeps a stolen drive unreadable, with keys held by the cluster or by your own key server. It does not protect against an attacker inside a running VM.',
  priority: 'P1',
  facts: {
    release: { v: 'AOS 7.6', sub: 'Jul 2026 · AHV 11.2' },
    license: { v: 'NCI Pro or Ultimate', sub: 'For encryption at rest (Pro since NCI 7.3)', tip: 'Data-at-rest encryption and the native key manager are in NCI Pro from NCI 7.3 and in Ultimate. Nutanix’s pages do not state a license for security profiles, drive-level encryption or external key managers.' },
  },
  talk: [
    'Start with the threat. Encryption at rest protects drives and nodes that leave your control: stolen, sent back for repair or thrown away. It does nothing against an attacker inside a running VM.',
    'Two ways to encrypt: software encryption in AOS on ordinary drives, which Nutanix positions for most cases, or self-encrypting drives (SEDs) when policy requires hardware encryption. They can be layered (dual encryption).',
    'Apps see no change: data is encrypted before it reaches a drive and decrypted for any authorized reader.',
    'Keys can be held by the cluster itself in the built-in key manager, with no extra server, or by your existing external key manager, which keeps keys and data in different places. So a drive that leaves without access to your key server stays unreadable.',
    'Hardening is built in too. On AOS 7.6, Prism Central pc.7.6 and AHV 11.2, a security profile (Standard, Elevated or Strict) is checked every 2 hours; drift is fixed where possible, and changes needing a host reboot raise an alert.',
  ],
  numbers: [
    { k: 'Encryption options', v: 'Software (AOS), self-encrypting drives or both' },
    { k: 'Key management', v: 'Built-in key manager (native, on the cluster) or external key manager; options vary by release and configuration' },
    { k: 'Software encryption module', v: 'FIPS 140-2 Level 1 (per Nutanix); check the current certificate for your release' },
    { k: 'Security profiles', v: 'Standard, Elevated, Strict (AOS 7.6, pc.7.6, AHV 11.2; AOS layer only on other hypervisors)' },
    { k: 'Drift check', v: 'Every 2 hours; fixed automatically where possible, otherwise an alert' },
  ],
  qa: [
    {
      q: 'Do we need self-encrypting drives?',
      a: 'Usually not. Software encryption works on standard drives and is what Nutanix positions for most use cases. SEDs make sense when a policy or regulation specifically requires hardware-based encryption.',
    },
    {
      q: 'Does encryption protect us from ransomware?',
      a: 'No. Ransomware writes through the VM like any application, so its output is simply stored, encrypted at rest like everything else. Defend with microsegmentation (Flow Network Security), detection on file shares (Data Lens) and good recovery points (snapshots and disaster recovery).',
    },
    {
      q: 'Will this pass our compliance audit?',
      a: 'It helps, but no product makes you compliant on its own. Nutanix and the Defense Information Systems Agency (DISA) developed a Security Technical Implementation Guide (STIG) for AOS, published for AOS 5.20 (check your release), and Nutanix offers a hardening guide. Security profiles keep settings in line; some items (syslog, network segmentation, LDAP) are still configured by you. Feature availability depends on version and license.',
    },
  ],
  next: [
    'Let one loop play: the same drive is stolen three times. With encryption off it is readable; with the built-in key manager it is not.',
    'On the third act, the external key manager: the drive is just as unreadable, and the keys live on your own key server, apart from the data.',
    'Point at “Extra server to run” for the cost of the external key manager: another server to run, back up and keep reachable.',
    'Then open Flow: Network Security & Virtual Networking for traffic between VMs, or Snapshots & Clones and Disaster Recovery for recovery, which encryption at rest does not cover.',
  ],
  then: ['nci/flow', 'nci/snapshots', 'nci/dr'],
};

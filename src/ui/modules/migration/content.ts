import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/move',
  title: 'Migration with Nutanix Move',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Nutanix Move brings VMs from VMware, Hyper-V, AWS and Azure onto Nutanix, on-premises or in NC2. It copies while the VM keeps running, keeps the copy in sync, and cuts over in a short window you choose.',
  priority: 'P1',
  talk: [
    'Move is free for Nutanix customers and has been around for about ten years, so it is a well-trodden path.',
    'Three phases: a seed copy while users keep working, incremental syncs that carry only changes, then a cutover.',
    'Downtime is only the cutover: a final small sync plus the power-on. Compare it with shutting down and copying everything.',
    'Push the change rate up until syncs cannot keep up: that is the honest limit, and the fix is bandwidth or a quieter time.',
    'Sources: vSphere/ESXi, Hyper-V, AWS EC2, Azure, VMware Cloud (VMC, AVS), AHV and file shares. Targets: AHV on-premises and NC2 on AWS, Azure, Google Cloud and OVHcloud.',
  ],
  numbers: [
    { k: 'Cost', v: 'Free for Nutanix customers' },
    { k: 'Current release', v: 'Move 6.3.3 (Oct 2026)' },
    { k: 'Targets', v: 'AHV on-prem; NC2 on AWS, Azure, Google Cloud, OVHcloud' },
    { k: 'File shares', v: 'SMB v2+, NFS v3 sources' },
  ],
  qa: [
    {
      q: 'How much downtime should we plan per VM?',
      a: 'Typically minutes: the final sync of changes since the last incremental, plus the time to power on and check the VM. It depends on change rate, bandwidth and boot time, so measure it during a pilot wave.',
    },
    {
      q: 'Can we migrate without copying the data at all?',
      a: 'For ESXi to AHV with supported external arrays (Dell PowerStore, Pure Storage), Move 6.3 added zero-copy migration. Otherwise Move copies the data, using the seed and incremental approach shown here.',
    },
    {
      q: 'Do we need to change IP addresses?',
      a: 'Not necessarily. Many migrations keep IP addresses by extending or recreating the same networks on the target. That is a network design decision to make before the first wave.',
    },
  ],
  next: ['Hybrid & Public Cloud', 'AHV Networking', 'Cluster & DSF Lab'],
  honest: [
    'Move handles the copy and cutover; dependencies, networks and testing are still a project to plan, usually app by app.',
    'Very high change rates or thin links can stop incremental syncs from converging; fix bandwidth or timing first.',
    'Support depends on the exact source, target, guest OS and Move version; check the support matrix before each wave.',
    'Applications that need a tighter cutover than a short downtime window may need application-level replication instead.',
  ],
};

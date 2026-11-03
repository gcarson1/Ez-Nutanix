import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/move',
  title: 'Migration with Nutanix Move',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Nutanix Move brings VMs from VMware, Hyper-V, AWS and Azure to Nutanix, on-premises or in Nutanix Cloud Clusters (NC2), copying while the VM runs so downtime is only a short cutover.',
  priority: 'P1',
  talk: [
    'Move is included at no extra cost for Nutanix customers and has been around for about ten years, so it is a well-trodden path.',
    'Three phases: a seed copy while users keep working, incremental syncs that carry only changes, then a cutover.',
    'Downtime is only the cutover: a final small sync plus the power-on, so its length depends on change rate, bandwidth and boot time. Compare it with shutting down and copying everything.',
    'Before the cutover, Move can prepare the guest OS for AHV, for example by installing drivers, automatically or manually depending on the OS and the access you give it.',
    'The honest limit: if a VM changes data faster than the link can copy it, syncs never catch up. The fix is more bandwidth or a quieter time.',
    'Sources include vSphere/ESXi, Hyper-V, AWS EC2, Azure, VMware Cloud on AWS, Azure VMware Solution, AHV and file shares; targets are AHV on-premises and NC2. Supported pairs change by Move release, so check the support matrix.',
  ],
  numbers: [
    { k: 'Cost', v: 'No extra cost for Nutanix customers' },
    { k: 'Current release', v: 'Move 6.3.3 (Oct 2026; for new Move deployments, not upgrades)' },
    { k: 'Targets', v: 'AHV on-premises; NC2 on AWS, Azure, Google Cloud, OVHcloud' },
    { k: 'File shares', v: 'SMB v2+, NFS v3 sources' },
  ],
  qa: [
    {
      q: 'How much downtime should we plan per VM?',
      a: 'Typically minutes: the final sync of changes since the last incremental, plus the time to power on and check the VM. It depends on change rate, bandwidth and boot time, so measure it during a pilot wave.',
    },
    {
      q: 'Can we migrate without copying the data at all?',
      a: 'For ESXi to AHV, Move 6.3 added zero-copy migration when the VM disks already sit on a supported external array, such as Everpure FlashArray, that the AHV cluster also uses. Otherwise Move copies the data, using the seed and incremental approach shown here.',
    },
    {
      q: 'Do we need to change IP addresses?',
      a: 'Not necessarily. Many migrations keep IP addresses by extending or recreating the same networks on the target. That is a network design decision to make before the first wave.',
    },
  ],
  next: [
    'Point at the seed copy while users keep working on the source. The four source platforms named above the picture all follow this same pattern.',
    'Pause while it is in sync to show that only changed blocks travel.',
    'Let it reach the cutover and compare the downtime with “Shut down, then copy all”.',
    'Then open Hybrid & Public Cloud for NC2 targets and keeping IP addresses.',
  ],
  then: ['cloud'],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'cloud',
  title: 'Hybrid & Public Cloud',
  tag: 'Infrastructure',
  summary:
    'Nutanix Cloud Clusters (NC2) runs the same Nutanix stack in AWS, Azure or Google Cloud, as a disaster-recovery site, for burst capacity or to leave a data center, all managed from Prism Central.',
  priority: 'P1',
  facts: {
    release: { v: 'NC2 is GA', sub: 'AWS, Azure, Google Cloud (Dec 2025) and OVHcloud' },
    license: { v: 'NCI license', sub: 'Portable term license or pay as you go', tip: 'Cloud bare-metal instance and service costs are paid directly to the cloud provider. Confirm pay as you go with Nutanix before quoting it.' },
  },
  talk: [
    'NC2 is the same AOS and AHV you run on-premises, on bare-metal instances in your cloud account, managed in the same Prism Central.',
    'It is generally available on AWS, Azure, Google Cloud (since December 2025) and OVHcloud. Regions, bare-metal types and some features differ by cloud and release.',
    'Common reasons: a disaster recovery (DR) site without a second building, burst capacity without buying hardware and leaving a data center on your own schedule. Moving VMs is a lift and shift with no refactoring (see Migration with Nutanix Move).',
    'In every use case the operating model for VMs does not change, only where they run.',
    'For containerized apps there is a cloud-native path instead: NKP manages the Kubernetes fleet, and Cloud Native AOS brings AOS storage into Kubernetes. Today Cloud Native AOS is GA on Amazon EKS only.',
  ],
  numbers: [
    { k: 'NC2 clouds (GA)', v: 'AWS, Azure, Google Cloud, OVHcloud' },
    { k: 'NC2 on Google Cloud', v: 'GA Dec 2025 · Z3 and C4 bare metal · 17 regions at GA' },
    { k: 'GC2 (Government Cloud Clusters) on AWS GovCloud (US)', v: 'Available' },
    { k: 'GC2 on AWS European Sovereign Cloud', v: 'GA Jul 2026, starting with Germany' },
    { k: 'Cloud Native AOS', v: 'GA on Amazon EKS (1.0, Jul 2025)' },
    { k: 'Also supported on NC2', v: 'Nutanix Move and Nutanix Database Service (NDB), on AWS, Azure and Google Cloud' },
  ],
  qa: [
    {
      q: 'Is NC2 on Google Cloud real, or still a preview?',
      a: 'It became generally available on December 9, 2025, on Z3 and C4 bare-metal instances in 17 regions at launch, expanding over time. One card on the NC2 product page still says preview; the GA announcement and the NC2 FAQ are the current statements.',
    },
    {
      q: 'Do we have to change our applications to run them on NC2?',
      a: 'No. VMs run on the same AHV hypervisor, so they move as they are; with the right network design they can keep their IP and MAC addresses. Modernizing to native cloud services can come later, app by app.',
    },
    {
      q: 'Can we use Cloud Native AOS on AKS or GKE?',
      a: 'Not confirmed today. Cloud Native AOS 1.0 is generally available on Amazon EKS. Bare-metal support is tied to NKP Metal, which is in early access with GA targeted for the second half of 2026. Check current status before planning.',
    },
  ],
  next: [
    'Under Use case, start with Disaster recovery on AWS: replication, the site going down and the VMs powering on in the cloud.',
    'Pick Burst capacity to show cloud nodes added for a peak and released afterwards.',
    'Pick Data-center exit to show workloads moving in waves and the building being retired.',
    'Change Cloud to Azure or Google Cloud: the picture stays the same, which is the point.',
    'Then open Disaster Recovery for the policies, Migration with Nutanix Move for the move itself or Cloud Native AOS for containers.',
  ],
  then: ['nci/dr', 'nci/move', 'cnaos'],
};

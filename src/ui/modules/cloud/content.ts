import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'cloud',
  title: 'Hybrid & Public Cloud',
  tag: 'Infrastructure',
  summary:
    'Run the same Nutanix stack in AWS, Azure or Google Cloud with Nutanix Cloud Clusters (NC2), for DR, burst capacity, migration or a data-center exit. For containerized apps, the cloud-native path runs Nutanix software on the provider’s Kubernetes.',
  priority: 'P1',
  talk: [
    'NC2 is the same AOS and AHV you run on-premises, on bare-metal instances in your cloud account, managed in the same Prism Central.',
    'It is generally available on AWS, Azure and Google Cloud (GA December 2025), and also on OVHcloud.',
    'Four reasons customers use it: a DR site without a second building, burst capacity without buying hardware, migration without refactoring, and leaving a data center on their own schedule.',
    'Press Play on each use case: the operating model does not change, only where the VMs run.',
    'For containerized apps there is a cloud-native path: NKP manages the Kubernetes fleet, and Cloud Native AOS brings AOS storage into Kubernetes. Today Cloud Native AOS is GA on Amazon EKS only.',
  ],
  numbers: [
    { k: 'NC2 clouds (GA)', v: 'AWS, Azure, Google Cloud, OVHcloud' },
    { k: 'NC2 on Google Cloud', v: 'GA Dec 9, 2025 · Z3 and C4 bare metal · 17 regions' },
    { k: 'GC2 on AWS GovCloud (US)', v: 'Available' },
    { k: 'AWS European Sovereign Cloud', v: 'Announced, “later in 2026”' },
    { k: 'Cloud Native AOS', v: 'GA on Amazon EKS (1.0, Jul 2025)' },
  ],
  qa: [
    {
      q: 'Is NC2 on Google Cloud real, or still a preview?',
      a: 'It became generally available on December 9, 2025, on Z3 and C4 bare-metal instances in 17 regions. One card on the NC2 product page still says preview; the GA announcement and the NC2 FAQ are the current statements.',
    },
    {
      q: 'Do we have to change our applications to run them on NC2?',
      a: 'No. VMs run on the same AHV hypervisor, so they move as they are; with the right network design they can keep their IP and MAC addresses. Modernizing to native cloud services can come later, app by app.',
    },
    {
      q: 'Can we use Cloud Native AOS on AKS or GKE?',
      a: 'Not confirmed today. Cloud Native AOS 1.0 is generally available on Amazon EKS. Bare-metal support is tied to NKP Metal, which was in early access with a 2H 2026 target. Check current status before planning.',
    },
  ],
  next: ['Disaster Recovery', 'Migration with Nutanix Move', 'Cloud Native AOS'],
  honest: [
    'Bare-metal cloud instances are billed while they run, whether or not they are busy; size a DR cluster for steady state and plan how it grows on failover.',
    'Instance types, regions and features differ between clouds and change often; confirm for your target region.',
    'Network design (connectivity to on-premises, IP ranges, egress costs) is usually the long pole of an NC2 project.',
    'The cloud-native path has narrower availability today: Cloud Native AOS is GA on EKS only.',
  ],
};

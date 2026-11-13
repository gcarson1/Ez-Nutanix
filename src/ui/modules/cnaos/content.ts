import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'cnaos',
  title: 'Cloud Native AOS',
  tag: 'Platform services',
  summary: 'Stateful Kubernetes apps get Nutanix storage and whole-app protection with no hypervisor, using Cloud Native AOS and Nutanix Data Services for Kubernetes (NDK). It is generally available on Amazon EKS; bare metal is early access.',
  priority: 'P2',
  facts: {
    release: { v: '1.0.0', sub: 'Jul 2025 · Amazon EKS only' },
    license: { v: 'Cloud Native AOS license', sub: 'AWS only in the first version' },
  },
  talk: [
    'The one message: stateful Kubernetes apps get the same Nutanix storage and data protection on Amazon EKS that they get on-premises, with no hypervisor, and they can be protected and replicated as whole apps.',
    'Step 1: AOS, the storage engine under every Nutanix cluster, runs as a pod on each EKS worker and pools the workers’ EBS gp3 volumes. There is no Controller VM (CVM) and no hypervisor to run.',
    'Steps 2 and 3: a database pod writes, and every block lands on two workers (replication factor 2, RF2). When a worker fails, the second copies are still there and Kubernetes restarts the database on another worker with its data.',
    'Steps 4 and 5: Nutanix Data Services for Kubernetes (NDK) snapshots the whole app, resources and data together, and replicates it to another AWS region or zone. Apps on NKP in your data center can fail over to EKS.',
    'Why customers care: a cloud provider’s database service only runs in that cloud and is managed apart from the app. With Cloud Native AOS the database stays in Kubernetes, on storage the team knows, protected together with the app.',
    'Be precise on availability: release 1.0.0 (July 2025) is Amazon EKS only, with limits that belong to that release. Bare metal comes through NKP Metal, in early access, with GA targeted for the second half of 2026.',
  ],
  numbers: [
    { k: 'Announced', v: 'May 2025 (.NEXT 2025)' },
    { k: 'Release 1.0.0', v: 'Jul 2025, Amazon EKS only' },
    { k: '1.0 limits', v: 'Up to 15 worker nodes, RF2, up to 64 volumes per node' },
    { k: '1.0 storage', v: 'EBS gp3 volumes on i3en, i4i, m6id or m5d workers' },
    { k: 'DR in 1.0', v: 'Through NDK, target RPO 1 hour or more; across AWS regions and zones, and from NKP on Nutanix (AHV) to EKS' },
  ],
  qa: [
    {
      q: 'Why not just use EBS or the cloud’s own database service?',
      a: 'A cloud database service runs only in that provider’s cloud and is managed separately from the Kubernetes app, as Nutanix puts it. Cloud Native AOS keeps the database in Kubernetes with Nutanix snapshots, compression and two copies of every write, and NDK protects and replicates the app and its data as one unit.',
    },
    {
      q: 'Can we run it on AKS or GKE?',
      a: 'Not confirmed. Release 1.0 supports Amazon EKS, and Nutanix says the first version is licensed for AWS only. Azure and Google Cloud were mentioned as intentions in 2025 press coverage, so do not plan on them yet.',
    },
    {
      q: 'Can we run it on our own bare-metal servers today?',
      a: 'Not as a generally available product. NKP Metal, announced as early access in April 2026 with GA targeted for the second half of 2026, offers Cloud Native AOS as a storage option. NKP 2.19 (October 2026) introduces NKP Metal, but its release notes do not say it has left early access. NKP Pro and Ultimate can already run Kubernetes on pre-provisioned bare metal, with Nutanix storage through a CSI driver.',
    },
  ],
  next: [
    'Under Kubernetes runs on, keep Amazon EKS and let the loop play: AOS lands as a pod on each worker and the database writes two copies of every block.',
    'Watch a worker fail and the database restart on another, then NDK snapshot and replicate the whole app.',
    'Switch Kubernetes runs on to Bare metal (NKP Metal) to show the same storage on your own servers, and say it is early access.',
    'Then open Kubernetes Platform for the clusters this runs on, or Project Beacon for the story behind it.',
  ],
  then: ['nkp', 'beacon'],
};

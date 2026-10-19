import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'cnaos',
  title: 'Cloud Native AOS',
  tag: 'Platform services',
  summary: 'Nutanix storage and data protection for Kubernetes apps, with no hypervisor underneath. AOS runs as pods on the Kubernetes workers, keeps two copies of every write, and with NDK protects and replicates whole apps. Generally available on Amazon EKS; bare metal is early access through NKP Metal.',
  priority: 'P2',
  talk: [
    'The one message: stateful Kubernetes apps get the same Nutanix storage and data protection on Amazon EKS that they get on premises, with no hypervisor, and they can be protected and moved as whole apps.',
    'Step 1: AOS, the storage engine under every Nutanix cluster, runs as a pod on each EKS worker and pools the workers’ EBS gp3 volumes. There is no Controller VM and no hypervisor to run.',
    'Steps 2 and 3: a database pod writes, and every block lands on two workers (RF2). When a worker fails, the second copies are still there and Kubernetes restarts the database on another worker with its data.',
    'Steps 4 and 5: Nutanix Data Services for Kubernetes (NDK) snapshots the whole app, its Kubernetes resources and its data together, and replicates it to another AWS region or zone. Apps on NKP on Nutanix in your data center can fail over to EKS the same way.',
    'Why customers care: a cloud provider’s database service only runs in that provider’s cloud and is managed apart from the app. With Cloud Native AOS the database stays inside Kubernetes, on storage the team already knows, so the app and its data move together.',
    'Be precise on availability: release 1.0.0 (July 2025) is for Amazon EKS, up to 15 workers, RF2, with a DR target RPO of 1 hour or more. These limits belong to release 1.0, so check the current release notes. Bare metal comes through NKP Metal, early access with GA targeted for the second half of 2026; moving apps to and from bare metal is listed as future development.',
  ],
  numbers: [
    { k: 'Announced', v: 'May 2025 (.NEXT 2025)' },
    { k: 'Release 1.0.0', v: 'July 2025, Amazon EKS only' },
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
      a: 'Not as a generally available product. NKP Metal, announced as early access in April 2026 with GA targeted for the second half of 2026, offers Cloud Native AOS as its storage option. NKP Pro and Ultimate can already run Kubernetes on pre-provisioned bare metal, with Nutanix storage through a CSI driver.',
    },
    {
      q: 'Is this the same as Project Beacon?',
      a: 'Related. Project Beacon was the 2023 vision of data services that run anywhere. Cloud Native AOS, together with NDK, is the first concrete product from that direction.',
    },
  ],
  next: [
    'Start on Amazon EKS and let the loop run: AOS lands as a pod on each worker, the database writes two copies, a worker fails, and NDK snapshots and replicates the app.',
    'Switch to Bare metal (NKP Metal) to show the same storage on your own servers, and say it is early access.',
    'Then open Kubernetes Platform, Project Beacon or Disaster Recovery.',
  ],
};

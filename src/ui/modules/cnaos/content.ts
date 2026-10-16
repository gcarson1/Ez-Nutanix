import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'cnaos',
  title: 'Cloud Native AOS',
  tag: 'Platform services',
  summary: 'The same AOS storage and data services, delivered as microservices inside Kubernetes, with no hypervisor and no Controller VM. Generally available on Amazon EKS; bare metal is coming through NKP Metal.',
  priority: 'P2',
  talk: [
    'Start with what the customer already trusts: AOS, the storage engine under every Nutanix cluster.',
    'Pick "On a hypervisor": the stack builds from the servers up, with a hypervisor on every node, a Controller VM (CVM) running AOS, and VMs on top.',
    'Pick Amazon EKS: the data services layer stays the same. The packaging changes: AOS runs as pods on the Kubernetes workers, uses their local NVMe, and is driven through the Kubernetes API.',
    'App-level snapshots, replication and DR come from Nutanix Data Services for Kubernetes (NDK). Cloud Native AOS extends NDK to clusters with no hypervisor underneath.',
    'Be precise on availability: release 1.0.0 (July 2025) is for Amazon EKS. Bare metal arrives through NKP Metal, which was early access in 2026 with GA targeted for the second half of the year.',
  ],
  numbers: [
    { k: 'Announced', v: 'May 2025 (.NEXT 2025)' },
    { k: 'Release 1.0.0', v: 'July 2025, Amazon EKS only' },
    { k: '1.0 limits', v: 'Up to 15 worker nodes, RF2' },
    { k: '1.0 instance types', v: 'i3en, i4i, m6id, m5d' },
    { k: 'DR in 1.0', v: 'Through NDK, RPO 1 hour or more' },
  ],
  qa: [
    {
      q: 'Can we run it on AKS or GKE?',
      a: 'Not confirmed. Release 1.0 supports Amazon EKS. Azure and Google Cloud were mentioned as intentions in 2025 press coverage, but Nutanix has not confirmed support, so do not plan on them yet.',
    },
    {
      q: 'Can we run it on our own bare-metal servers today?',
      a: 'Not as a generally available product. Bare metal comes through NKP Metal, announced as early access in April 2026 with GA targeted for the second half of 2026. NKP Pro and Ultimate can already run Kubernetes on pre-provisioned bare metal, with storage through a CSI driver.',
    },
    {
      q: 'Is this the same as Project Beacon?',
      a: 'Related. Project Beacon was the 2023 vision of data services that run anywhere. Cloud Native AOS, together with NDK, is the first concrete product from that direction.',
    },
  ],
  next: [
    'Start on "On a hypervisor" and let the stack build, then switch to Amazon EKS and point at the one layer that stays the same.',
    'Switch to Bare metal to show where NKP Metal fits, and say it is early access.',
    'Then open Kubernetes Platform, Project Beacon or Disaster Recovery.',
  ],
};

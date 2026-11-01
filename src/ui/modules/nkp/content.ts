import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nkp',
  title: 'Kubernetes Platform',
  tag: 'Nutanix Central',
  summary: 'Nutanix Kubernetes Platform (NKP) runs and manages Kubernetes clusters in the data center, at the edge and in the cloud, with upgrades, policy and security handled from one place.',
  priority: 'P2',
  talk: [
    'NKP builds and runs Kubernetes clusters for you. It grew out of the D2iQ Kubernetes Platform, which Nutanix acquired in late 2023.',
    'Lifecycle runs through Cluster API (the upstream Kubernetes project for managing clusters declaratively), with GitOps in Ultimate. An upgrade replaces nodes one at a time instead of patching them in place.',
    'Healthy rollout: a small canary cluster goes first, then the other edge sites, the data center and the cloud. Inside each cluster a new node joins, then one old node drains and leaves, control plane first and then workers.',
    'Only one node per cluster is out at a time, so apps keep running through the upgrade.',
    'Canary fails: the canary’s new node fails its health check, so the rollout stops. The failed node is removed, the canary stays on the old version and the rest of the fleet is never touched.',
    'Fleet management, in the Ultimate edition, is what lets you see and roll out across many clusters, including attached EKS and AKS clusters.',
  ],
  numbers: [
    { k: 'Current release', v: 'NKP 2.19 (Oct 2026) · Kubernetes 1.36 by default, 1.35 supported' },
    { k: 'Editions', v: 'Starter · Pro · Ultimate' },
    { k: 'Starter', v: 'NCI (AHV) only; included with NCI Pro and Ultimate' },
    { k: 'Fleet management', v: 'Ultimate; EKS and AKS through a separate NKP Cloud Kubernetes SKU' },
  ],
  qa: [
    {
      q: 'Can NKP manage the EKS or AKS clusters we already have?',
      a: 'Yes, with fleet management in NKP Ultimate you can attach them and manage apps and policy centrally; managing EKS or AKS uses a separate NKP Cloud Kubernetes SKU. Their Kubernetes version still follows the cloud provider’s own upgrade process.',
    },
    {
      q: 'Do we have to run it on Nutanix infrastructure?',
      a: 'No. Starter is for NCI (AHV). Pro and Ultimate also deploy on vSphere, on pre-provisioned bare metal where you manage the OS, and in public cloud.',
    },
    {
      q: 'Is the NKP Metal bare-metal offering shipping?',
      a: 'It was announced in April 2026 as early access for NKP Pro and Ultimate, with general availability planned for the second half of 2026. NKP 2.19 (October 2026) introduces NKP Metal, but the release notes we checked do not say it has left early access, so confirm its status with your Nutanix team.',
    },
  ],
  next: [
    'Keep What happens on Healthy rollout and let it loop once, then scrub back to the canary and point at a new node joining before an old one leaves.',
    'Pick Canary fails: the rollout stops at the first cluster, with the other five still on the old version.',
    'Then open Cloud Native AOS or Enterprise AI to show what runs on these clusters.',
  ],
  then: ['cnaos', 'ai'],
};

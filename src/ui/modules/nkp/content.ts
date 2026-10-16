import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nkp',
  title: 'Kubernetes Platform',
  tag: 'Nutanix Central',
  summary: 'Nutanix Kubernetes Platform (NKP) runs and manages Kubernetes clusters in the data center, at the edge and in the cloud, with upgrades, policy and security handled from one place.',
  priority: 'P2',
  talk: [
    'NKP builds and runs Kubernetes clusters for you. It grew out of the D2iQ Kubernetes Platform, which Nutanix acquired in late 2023.',
    'Lifecycle runs through Cluster API (the upstream Kubernetes project for managing clusters declaratively) and GitOps. An upgrade replaces nodes one at a time instead of patching them in place.',
    'Press Play: inside each cluster a new node joins, one old node drains, then leaves. Control plane first, then workers. Apps keep running because only one node is ever out.',
    'Fleet management, in the Ultimate edition, is what lets you see and roll out across many clusters, including attached EKS and AKS clusters.',
    'Turn on the failed canary: the rollout stops after the first cluster, and the rest of the fleet stays on the old version, untouched.',
  ],
  numbers: [
    { k: 'Latest posted release', v: 'NKP 2.18 (Jul 2026), Kubernetes 1.35' },
    { k: 'Editions', v: 'Starter · Pro · Ultimate' },
    { k: 'Starter', v: 'NCI (AHV) only; included with NCI Pro and Ultimate' },
    { k: 'Fleet management', v: 'Ultimate; can attach EKS and AKS' },
  ],
  qa: [
    {
      q: 'Can NKP manage the EKS or AKS clusters we already have?',
      a: 'Yes, with fleet management in NKP Ultimate you can attach them and manage apps and policy centrally. Their Kubernetes version still follows the cloud provider’s own upgrade process.',
    },
    {
      q: 'Do we have to run it on Nutanix infrastructure?',
      a: 'No. Starter is for NCI (AHV). Pro and Ultimate also deploy on vSphere, on pre-provisioned bare metal where you manage the OS, and in public cloud.',
    },
    {
      q: 'Is the NKP Metal bare-metal offering shipping?',
      a: 'It was announced in April 2026 as early access, with general availability targeted for the second half of 2026. As of this build we have not seen a GA announcement, so treat it as upcoming.',
    },
  ],
  next: ['Cloud Native AOS', 'Enterprise AI', 'Flow'],
  honest: [
    'Kubernetes moves fast: plan for regular minor-version upgrades on every cluster, and test your apps against each new version before rolling it out.',
    'Fleet-wide management is an Ultimate feature; lower editions manage clusters without the fleet view.',
    'Node-replacement upgrades need room for one extra node per cluster while each step runs, so leave headroom on the underlying infrastructure.',
  ],
};

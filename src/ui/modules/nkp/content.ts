import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nkp',
  title: 'Kubernetes Platform',
  tag: 'Nutanix Central',
  summary: 'Nutanix Kubernetes Platform (NKP) turns Kubernetes clusters that are each run their own way into one operating model, wherever they run: lifecycle, security, observability, GitOps, data protection and fleet management from one place.',
  priority: 'P2',
  talk: [
    'Kubernetes is the orchestration layer; NKP is the operating platform around it. It grew out of the D2iQ Kubernetes Platform, which Nutanix acquired in late 2023.',
    'Start with the islands: on Nutanix, VMware and each public cloud, every cluster tends to get its own upgrade process, monitoring, security and ticket queue. The same work repeats everywhere, so every cluster becomes its own project.',
    'NKP is not a fork and does not add a wrapper API: it is built from upstream CNCF projects that Nutanix integrates and validates as one production stack, so automation written for it works on any CNCF-conformant Kubernetes.',
    'One fleet: clusters on Nutanix, vSphere, bare metal and public cloud share one view and one policy, and existing EKS and AKS clusters can be attached. Attached clusters still take their Kubernetes upgrades from their cloud.',
    'Platform teams govern the road, developers use the road: the platform team sees fleet health, compliance and upgrades; developers get namespaces on approved clusters with storage, networking, observability and policy attached.',
    'On Nutanix it connects to the rest of the platform: AHV, Unified Storage, Data Services for Kubernetes and Database Service. The Kubernetes upgrade rollout itself is on the LCM module’s Kubernetes tab.',
  ],
  numbers: [
    { k: 'Current release', v: 'NKP 2.19 (Oct 2026) · Kubernetes 1.36 by default, 1.35 supported' },
    { k: 'Editions', v: 'Starter · Pro · Ultimate' },
    { k: 'Starter', v: 'NCI (AHV) only; included with NCI Pro and Ultimate' },
    { k: 'Pro adds', v: 'Observability, backup and restore, GPU support, deployment beyond AHV' },
    { k: 'Ultimate adds', v: 'Fleet management, GitOps, cost management, multitenancy' },
    { k: 'EKS and AKS', v: 'Attach and manage with fleet management (Ultimate) and a separate NKP Cloud Kubernetes SKU' },
  ],
  qa: [
    {
      q: 'Is this just Kubernetes with a Nutanix interface?',
      a: 'No. NKP is built from upstream CNCF projects with no forked Kubernetes and no wrapper API; what Nutanix adds is the selection, integration and validation of the stack around it, plus lifecycle, Day-2 operations and fleet management across environments.',
    },
    {
      q: 'Can NKP manage the EKS or AKS clusters we already have?',
      a: 'Yes, with fleet management in NKP Ultimate you can attach them and manage apps and policy centrally; managing EKS or AKS uses a separate NKP Cloud Kubernetes SKU. Their Kubernetes version still follows the cloud provider’s own upgrade process.',
    },
    {
      q: 'Do we have to run it on Nutanix infrastructure?',
      a: 'No. Starter is for NCI (AHV). Pro and Ultimate also deploy on vSphere, on bare metal and in public cloud. NKP Metal, for bare-metal servers deployed by Foundation and updated by LCM, is in early access.',
    },
  ],
  next: [
    'Let the first two scenes play: four islands, each with its own tools, then the same seven jobs repeated behind every one.',
    'Pause on NKP arrives: the layer sits above the clusters and connects to each, without replacing them.',
    'On One fleet, point at the policy reaching all four clusters and the upgrade reaching only the three NKP clusters, while AKS keeps Azure’s upgrades.',
    'On Two teams, one road, follow the developer’s request through the guardrails to the Nutanix cluster.',
    'Then open LCM Rolling Upgrade’s Kubernetes tab for the upgrade rollout, or Cloud Native AOS for storage.',
  ],
  then: ['nci/lcm', 'cnaos'],
};

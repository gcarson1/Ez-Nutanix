import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nkp',
  title: 'Kubernetes Platform',
  tag: 'Nutanix Central',
  summary: 'Nutanix Kubernetes Platform (NKP) turns Kubernetes clusters that are each run their own way into one operating model, wherever they run: lifecycle, security, observability, GitOps, data protection and fleet management from one place.',
  priority: 'P2',
  facts: {
    release: { v: 'NKP 2.19', sub: 'Oct 2026 · Kubernetes 1.36 by default' },
    license: { v: 'NKP Starter, Pro or Ultimate', sub: 'Fleet, GitOps and cost need NKP Ultimate; observability and backup need NKP Pro', tip: 'Starter is for AHV only. Priced per physical core on bare metal and per vCPU on VMs.' },
  },
  talk: [
    'Kubernetes is the orchestration layer; NKP is the operating platform around it. It grew out of the D2iQ Kubernetes Platform, which Nutanix acquired in late 2023.',
    'Start with the islands: on Nutanix, VMware and each public cloud, every cluster tends to get its own upgrade process, monitoring, security and ticket queue. The same work repeats everywhere, so every cluster becomes its own project.',
    'Open Kubernetes, no lock-in: NKP is not a fork and adds no wrapper API. It is built from upstream CNCF projects that Nutanix integrates and validates as one production stack, so apps and automation written for it work on any CNCF-compliant Kubernetes distribution. Contrast that with EKS and AKS, each tied to one cloud, and OpenShift, tied to RHEL and the Red Hat ecosystem.',
    'One fleet: clusters on Nutanix, vSphere, bare metal and public cloud share one view and one policy, and existing EKS and AKS clusters can be attached. Attached clusters still take their Kubernetes upgrades from their cloud.',
    'Platform teams govern the road, developers use the road: the platform team sees fleet health, compliance and upgrades; developers get namespaces on approved clusters with storage, networking, observability and policy attached.',
    'Cluster lifecycle tab: a cluster is declared, not scripted. Cluster API builds it, the autoscaler adds and removes workers, an upgrade runs preflight checks and then replaces workers one at a time, a failed worker is replaced, and an air-gapped site is fed from a bundle and a local registry.',
    'Dual-native tab: one management plane runs Kubernetes workers as AHV VMs and on bare metal with NKP Metal, and manages AHV VMs themselves through Kubernetes APIs with VM Operator. Both are new in NKP 2.19.',
    'Apps and data tab: a request passes the load balancer, Traefik ingress and network policy to reach its pods, which get block or shared storage through Nutanix CSI. Velero backs applications up on a schedule, and NDK replicates a whole application to a second site.',
    'Fleet and tenants tab: workspaces group clusters by team behind one sign-in, projects carry quotas and cost, an existing EKS or AKS cluster can be attached without migrating anything, GitOps makes a change a commit, and one observability view covers every cluster with NKP Insights and AI Navigator.',
    'AI platform tab: teams share GPUs fairly. Jobs queue against each team\u2019s quota with Kueue, KAI Scheduler places them using Dynamic Resource Allocation on NVIDIA and AMD GPUs, and a job that needs four GPUs waits until it can have all four.',
    'On Nutanix it connects to the rest of the platform: AHV, Unified Storage, Data Services for Kubernetes and Database Service. The Kubernetes upgrade rollout itself is on LCM Rolling Upgrade, under its Kubernetes (NKP) tab.',
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
      q: 'How is that different from EKS, AKS or OpenShift?',
      a: 'EKS and AKS are managed services that each run in one cloud, so operating them ties you to that cloud’s tools. In Nutanix’s comparison, OpenShift carries a strong RHEL and Red Hat ecosystem tie-in. NKP is upstream Kubernetes with open-source APIs, runs on Nutanix, vSphere, bare metal and public cloud, and can attach the EKS and AKS clusters you already have, so you keep the option to move.',
    },
    {
      q: 'Do we have to run it on Nutanix infrastructure?',
      a: 'No. Starter is for NCI (AHV). Pro and Ultimate also deploy on vSphere, on bare metal and in public cloud. NKP Metal, for bare-metal servers deployed by Foundation and updated by LCM, is in early access, and its nodes can be deployed with Fibre Channel storage.',
    },
  ],
  next: [
    'Let the first two scenes play: four islands, each with its own tools, then the same seven jobs repeated behind every one.',
    'Pause on NKP arrives: the layer sits above the clusters and connects to each, without replacing them.',
    'On One fleet, point at the policy reaching all four clusters and the upgrade reaching only the three NKP clusters, while AKS keeps Azure’s upgrades.',
    'On Two teams, one road, follow the developer’s request through the guardrails to the Nutanix cluster.',
    'Open Cluster lifecycle: Create, Scale, Upgrade, Self-heal and Air-gapped each show one stage of a cluster\u2019s life.',
    'Open Dual-native for VMs, bare metal and containers under one management plane, then Apps and data for Traffic and storage and Backup and recovery.',
    'Open Fleet and tenants for Workspaces, Attach a cluster, GitOps and Observability, then AI platform for shared GPUs.',
    'Then open LCM Rolling Upgrade and pick its Kubernetes (NKP) tab for the upgrade rollout, or open Cloud Native AOS for storage.',
  ],
  then: ['nci/lcm', 'cnaos'],
};

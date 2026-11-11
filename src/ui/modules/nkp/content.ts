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
    'Open Kubernetes, no lock-in: NKP is not a fork and adds no wrapper API. It is built from upstream CNCF projects that Nutanix integrates and validates as one production stack, so apps and automation written for it work on any CNCF-compliant Kubernetes distribution. Contrast that with EKS and AKS, each tied to one cloud, and OpenShift, tied to RHEL and the Red Hat ecosystem.',
    'One fleet: clusters on Nutanix, vSphere, bare metal and public cloud share one view and one policy, and existing EKS and AKS clusters can be attached. Attached clusters still take their Kubernetes upgrades from their cloud.',
    'Platform teams govern the road, developers use the road: the platform team sees fleet health, compliance and upgrades; developers get namespaces on approved clusters with storage, networking, observability and policy attached.',
    'Cluster lifecycle tab: a cluster is declared, not scripted. Cluster API on the management cluster builds it, the built-in autoscaler adds and removes workers with demand, and a failed worker is replaced so the cluster matches its definition again.',
    'Fleet tab: workspaces group clusters by team behind one sign-in, an existing EKS or AKS cluster can be attached without migrating anything, and with GitOps a change is a commit that every cluster follows, with manual drift put back.',
    'Day-2 services tab: Prometheus, Thanos and Grafana give one view of every cluster, NKP Insights flags anomalies and AI Navigator helps with the fix. Velero backs applications up on a schedule, and NDK replicates a whole application to a second site.',
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
    'Open Cluster lifecycle: Create shows a definition becoming a cluster, Scale shows the autoscaler, Self-heal shows a failed worker replaced.',
    'Open Fleet for Workspaces, Attach a cluster and GitOps, then Day-2 services for Observability and Backup and recovery.',
    'Then open LCM Rolling Upgrade and pick its Kubernetes (NKP) tab for the upgrade rollout, or open Cloud Native AOS for storage.',
  ],
  then: ['nci/lcm', 'cnaos'],
};

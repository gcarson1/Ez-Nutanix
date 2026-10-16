import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'central',
  title: 'Nutanix Central & Prism Federation',
  tag: 'Nutanix Central',
  summary:
    'One console above every cluster and site. Prism Element runs each cluster, Prism Central manages a group of clusters, and Nutanix Central federates many Prism Centrals: fleet health, alerts, upgrades and access in one place.',
  priority: 'P1',
  talk: [
    'Three levels: Prism Element is built into every cluster, Prism Central manages the clusters registered to it, and Nutanix Central sits above many Prism Central domains.',
    '“Prism Federation” on the slide is our label for that multi-Prism-Central federation: one API surface, alerts rolled up, lifecycle management and identity across domains.',
    'Register a cluster and it shows up in the fleet view with its health and capacity. Unregistered clusters still run; they just are not managed centrally.',
    'Plan upgrades for the fleet: a canary first, then waves. Inside each cluster LCM still goes one node at a time, and a failed pre-check or a mid-upgrade failure stops the rollout instead of spreading it.',
    'Role-based access decides who sees what: a regional team sees only its region, an app team only its project, an auditor can look but not act. The same rules apply to the API.',
    'Nutanix Central is available as SaaS or on-premises, and in 2026 it is the host for Cloud Manager 2.x.',
  ],
  numbers: [
    { k: 'Prism Central domains (Nutanix Central on-prem)', v: 'Up to 25' },
    { k: 'Prism Central deployment', v: '1 VM or 3-VM scale-out' },
    { k: 'Prism Central per cluster', v: 'A cluster registers to one Prism Central' },
    { k: 'Nutanix Central SaaS GA', v: 'May 2024' },
    { k: 'Nutanix Central on-prem GA', v: 'Dec 2025' },
  ],
  qa: [
    {
      q: 'Do we need Nutanix Central, or is Prism Central enough?',
      a: 'If all your clusters fit under one Prism Central, Prism Central already gives you multi-cluster management. Nutanix Central adds value when you run several Prism Central domains (regions, business units, sovereignty boundaries) and want one view and shared identity across them. It is also required to host Cloud Manager 2.x.',
    },
    {
      q: 'Is Nutanix Central only a SaaS service? We have air-gapped sites.',
      a: 'No. It started as SaaS (GA in May 2024) and an on-premises deployment went GA in December 2025, supporting up to 25 Prism Central domains. Check current requirements for fully dark sites with your Nutanix team.',
    },
    {
      q: 'Can one click upgrade every cluster at once?',
      a: 'You can plan and launch upgrades across many clusters centrally, but it is wise to stage them, and inside each cluster LCM is still one node at a time with health and resiliency checks. The waves in this demo are an illustration of a good practice, not a fixed product schedule.',
    },
  ],
  next: ['Cloud Manager', 'LCM Rolling Upgrade', 'Kubernetes Platform'],
  honest: [
    '“Prism Federation” is not a product name; the capabilities shown come from Prism Central and Nutanix Central.',
    'Prism Central is an extra appliance to size, protect and upgrade; plan where it runs and how it is backed up.',
    'Central management adds a dependency: clusters keep running if Prism Central or Nutanix Central is unreachable, but multi-cluster features and central views are unavailable until it is back.',
    'Fleet upgrades still take time proportional to node count inside each cluster, because nodes are upgraded one at a time.',
  ],
};

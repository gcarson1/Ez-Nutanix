import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'central',
  title: 'Nutanix Central & Prism Federation',
  tag: 'Nutanix Central',
  summary:
    'One console shows the health and alerts of every cluster in every region. Prism Element runs each cluster, Prism Central manages a group of clusters, and Nutanix Central federates many Prism Centrals.',
  priority: 'P1',
  facts: {
    release: { v: 'On-premises GA', sub: 'Dec 2025 · SaaS since May 2024; no version number' },
    license: { v: 'Nutanix Central: not published', sub: 'No license terms on Nutanix’s Central pages', tip: 'NCM 2.x requires the on-premises version of Nutanix Central.' },
  },
  talk: [
    'Three levels: Prism Element is built into every cluster, Prism Central manages the clusters registered to it, and Nutanix Central sits above many Prism Central domains.',
    'Through Prism Element you see one cluster. A warning in a store in Toronto is invisible from the New York cluster, so checking five clusters means five logins.',
    'Register clusters to a Prism Central and their health, capacity and alerts flow up to it. A cluster registers to one Prism Central, often one per region.',
    '“Prism Federation” on the slide is our label for federating many Prism Centrals under Nutanix Central: one view, one API surface, alerts rolled up, lifecycle management and identity across domains.',
    'Role-based access decides who sees what: a regional team sees only its region, an app team only its project, an auditor can look but not act. The same rules apply to the API.',
    'Nutanix Central is available as SaaS or on-premises. NCM 2.x (from 2.0 in April 2026) runs inside the on-premises version; see Cloud Manager. Each cluster’s rolling upgrades are in LCM Rolling Upgrade.',
  ],
  numbers: [
    { k: 'Prism Central domains (Nutanix Central on-premises)', v: 'Up to 25 at the Dec 2025 GA' },
    { k: 'Prism Central deployment', v: '1 VM or 3-VM scale-out' },
    { k: 'Prism Central per cluster', v: 'A cluster registers to one Prism Central' },
    { k: 'Nutanix Central SaaS GA', v: 'May 2024' },
    { k: 'Nutanix Central on-premises GA', v: 'Dec 2025' },
  ],
  qa: [
    {
      q: 'Do we need Nutanix Central, or is Prism Central enough?',
      a: 'If all your clusters fit under one Prism Central, Prism Central already gives you multi-cluster management. Nutanix Central adds value when you run several Prism Central domains (regions, business units, sovereignty boundaries) and want one view and shared identity across them. It is also required for NCM 2.x, which runs inside Nutanix Central on-premises.',
    },
    {
      q: 'Is Nutanix Central only a SaaS service? We have air-gapped sites.',
      a: 'No. It started as SaaS (GA in May 2024) and an on-premises deployment went GA in December 2025, supporting up to 25 Prism Central domains at that release. Check current requirements for fully dark sites with your Nutanix team.',
    },
    {
      q: 'Can one click upgrade every cluster at once?',
      a: 'You can plan and launch upgrades across many clusters centrally, but it is wise to stage them, and inside each cluster LCM is still one node at a time with health and resiliency checks. Staging waves is a good practice, not a fixed product schedule.',
    },
  ],
  next: [
    'View from opens on Nutanix Central · every region: both regions report to one place, so the Toronto store’s warning is seen from the top.',
    'Pick Prism Element · one cluster: each cluster runs itself, and the Toronto store’s warning is missed from New York.',
    'Pick Prism Central · one region: the Americas clusters report up and the warning is seen, but EMEA is a second console.',
    'Then open Cloud Manager to see the operations that run inside Nutanix Central.',
  ],
  then: ['ncm', 'nci/lcm'],
};

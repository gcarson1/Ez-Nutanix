import type { ModuleContent } from '../../../content/types';
import { NKP_METAL } from '../../../content/status';

export const content: ModuleContent = {
  path: 'beacon',
  title: 'Project Beacon',
  tag: 'Platform services',
  summary: 'Project Beacon is a direction, not a product: build an app once, run it anywhere with the same data services. Its first outcome is Cloud Native AOS with Nutanix Data Services for Kubernetes (NDK).',
  priority: 'P2',
  facts: {
    release: { v: 'No release', sub: 'A direction; its pieces ship on their own' },
    license: { v: 'No Beacon license', sub: 'Not a product; each piece is licensed on its own' },
  },
  talk: [
    'Say it plainly up front: Project Beacon is a vision Nutanix announced in 2023, not something you can buy.',
    'The idea: developers build an app once and run it anywhere, and the data services (storage, databases, protection) come along with it.',
    'Let the timeline run, and say its dates are history and announced plans, not commitments. 2023: the idea, with databases as a service first. 2024: cloud-native storage for Kubernetes added.',
    `2025: Cloud Native AOS, the first concrete product. 2026: bare metal through NKP Metal, ${NKP_METAL.intro}; ${NKP_METAL.confirm}.`,
    'Read the cards as they appear: the green ones ship today, the amber one needs its status confirmed, and the band across the top is still only a direction.',
    'Use it to explain why Cloud Native AOS, NDK and NKP fit together, not as a roadmap promise.',
  ],
  numbers: [
    { k: 'Announced', v: 'May 2023 (.NEXT Chicago)' },
    { k: 'Expanded', v: 'May 2024: cloud-native block and file storage' },
    { k: 'NDK', v: 'GA Mar 2024; NDK 2.3 in Aug 2026' },
    { k: 'First product', v: 'Cloud Native AOS, May 2025 (1.0 on EKS, Jul 2025)' },
    { k: 'NKP Metal', v: 'Announced as early access Apr 2026; introduced with NKP 2.19 in Oct 2026' },
  ],
  qa: [
    {
      q: 'Can we buy Project Beacon?',
      a: 'No. It is a vision, not a product or license. What you can buy are the products it points to, such as Cloud Native AOS, NDK, NKP and Nutanix Database Service (NDB).',
    },
    {
      q: 'How does it relate to Cloud Native AOS?',
      a: 'Cloud Native AOS, together with NDK, is the first concrete product of the Beacon direction. Some press even described Cloud Native AOS as “previously known as Project Beacon”, but Nutanix presented Beacon as the broader vision.',
    },
    {
      q: 'Is there a roadmap date for the full vision?',
      a: 'No. It was described as multi-year, and Nutanix still presents it as a vision rather than a product. Judge it by the pieces that ship and their own dates.',
    },
  ],
  next: [
    'Let the timeline run once while you say up front that Beacon is a direction, not a product.',
    'Pause on 2025 (Shift+Right jumps a step) to point at Cloud Native AOS as the first concrete product.',
    'Then open Cloud Native AOS, Kubernetes Platform or Database Service for the pieces that ship.',
  ],
  then: ['cnaos', 'nkp', 'ndb'],
};

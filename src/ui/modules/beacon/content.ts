import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'beacon',
  title: 'Project Beacon',
  tag: 'Platform services',
  summary: 'A direction, not a product: the 2023 vision of building an app once and running it anywhere with the same data services. Its first concrete outcome is Cloud Native AOS with NDK.',
  priority: 'P2',
  talk: [
    'Say it plainly up front: Project Beacon is a vision Nutanix announced in 2023, not something you can buy.',
    'The idea: developers build an app once and run it anywhere, and the data services (storage, databases, protection) come along with it.',
    'Let the timeline run through the years, and say the dates are history and announced plans, not commitments. 2023: the idea, with databases as a managed service first. 2024: broadened to cloud-native storage for Kubernetes. 2025: Cloud Native AOS, the first concrete product. 2026: bare metal through NKP Metal, in early access.',
    'Read the cards as they appear: the green ones ship today, the amber one is early access, and the band across the top is still only a direction.',
    'Use it to explain why Cloud Native AOS, NDK and NKP fit together, not as a roadmap promise.',
  ],
  numbers: [
    { k: 'Announced', v: 'May 2023 (.NEXT Chicago)' },
    { k: 'Expanded', v: 'May 2024: cloud-native block and file storage' },
    { k: 'NDK', v: 'GA March 2024; NDK 2.3 in August 2026' },
    { k: 'First product', v: 'Cloud Native AOS, May 2025 (1.0 on EKS, July 2025)' },
    { k: 'NKP Metal', v: 'Early access April 2026; GA targeted 2H 2026 (a plan, not a commitment)' },
  ],
  qa: [
    {
      q: 'Can we buy Project Beacon?',
      a: 'No. It is a vision, not a product or license. What you can buy are the products that came from it, such as Cloud Native AOS, NDK, NKP and NDB.',
    },
    {
      q: 'How does it relate to Cloud Native AOS?',
      a: 'Cloud Native AOS, together with NDK, is the first concrete product of the Beacon direction. Some press even described Cloud Native AOS as "previously known as Project Beacon", but Nutanix presented Beacon as the broader vision.',
    },
    {
      q: 'Is there a roadmap date for the full vision?',
      a: 'No. It was described as multi-year, and Nutanix no longer markets it as a product. Judge it by the pieces that ship and their own dates.',
    },
  ],
  next: [
    'Let the timeline run once while you say up front that Beacon is a direction, not a product.',
    'Stop on 2025 to point at Cloud Native AOS as the first concrete product, then open the Cloud Native AOS module.',
    'Open the Kubernetes Platform and Database Service modules for the other pieces.',
  ],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'metal',
  title: 'Kubernetes on Bare Metal',
  tag: 'Nutanix Kubernetes Platform',
  summary: 'NKP Metal runs Kubernetes straight on bare-metal servers, with no hypervisor: Foundation deploys the nodes and LCM keeps their firmware and operating system current. Cisco, Lenovo and Supermicro are its named hardware partners. It is in early access.',
  priority: 'P2',
  talk: [
    'The hardware first: at launch in April 2026 Nutanix named Cisco (including the Cisco Unified Edge platform, managed with Intersight), Lenovo ThinkSystem servers and Supermicro as NKP Metal hardware partners, with Intel Xeon processors and Ubuntu from Canonical.',
    'Nutanix Foundation discovers the servers and deploys them as nodes, the same tool that builds Nutanix clusters.',
    'NKP then runs Kubernetes on them like any other NKP cluster, and Cloud Native AOS can be the storage.',
    'Life Cycle Manager (LCM) patches the operating system and updates firmware on the bare-metal nodes, so they are run the same way as the virtualized estate.',
    'Be precise on status: NKP Metal is early access for NKP Pro and Ultimate, with general availability targeted for the second half of 2026. Pre-provisioned bare metal, where you install and patch the OS and firmware yourself, has been supported for much longer.',
  ],
  numbers: [
    { k: 'Hardware partners named at launch', v: 'Cisco (incl. Unified Edge, Intersight) · Lenovo ThinkSystem · Supermicro' },
    { k: 'Processor and OS named at launch', v: 'Intel Xeon · Ubuntu (Canonical)' },
    { k: 'Status', v: 'Early access for NKP Pro and Ultimate (Apr 2026); GA targeted for the second half of 2026' },
    { k: 'Lifecycle', v: 'Foundation deploys the nodes; LCM handles OS and firmware' },
  ],
  qa: [
    {
      q: 'Is there a full hardware compatibility list for NKP Metal?',
      a: 'Not that we found publicly. The launch named Cisco, Lenovo and Supermicro as partners; models and firmware levels will be on the Nutanix compatibility lists, so confirm the exact servers with your Nutanix team, especially for other vendors.',
    },
    {
      q: 'Can we use the servers we already have?',
      a: 'With pre-provisioned bare metal, yes: NKP Pro and Ultimate run on servers you prepare, and you install and patch the operating system and firmware yourself. NKP Metal adds the automated deployment and LCM updates, on its supported hardware.',
    },
    {
      q: 'Is NKP Metal generally available?',
      a: 'Not as of this build. It was announced as early access in April 2026 with GA targeted for the second half of 2026; NKP 2.19 introduces it, but we have not seen it leave early access. Confirm its status with your Nutanix team.',
    },
  ],
  next: [
    'Point at the three vendors above the picture: the hardware partners named for NKP Metal.',
    'Pause on Foundation deploys the nodes, then on LCM keeps them current: the same tools that run Nutanix clusters.',
    'Let it reach Or bring your own servers for pre-provisioned bare metal.',
    'Then open Cloud Native AOS for the storage on these servers, or Kubernetes Platform for the fleet they join.',
  ],
  then: ['cnaos', 'nkp'],
};

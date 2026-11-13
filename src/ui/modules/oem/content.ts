import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'oem',
  title: 'OEM of Your Choice',
  tag: 'Hardware platforms',
  summary: 'Nutanix is software, so you choose the hardware: Nutanix NX nodes, or OEM platforms from Dell, HPE, Lenovo, Cisco, Fujitsu and Supermicro, servers through resellers, hardware you already own, or a public cloud. The platform runs the same way on every one.',
  priority: 'P1',
  facts: {
    release: { v: 'AOS 7.6', sub: 'Jul 2026 · check each vendor’s compatibility list' },
    license: { v: 'NCI license', sub: 'Nutanix software on any platform; confirm with the OEM', tip: 'Buying models include HPE GreenLake, Lenovo TruScale and Fujitsu uSCALE.' },
  },
  talk: [
    'Lead with freedom of choice: Nutanix Cloud Platform is software. AOS, AHV, Prism, Flow and DR are the same whichever server they run on.',
    'The OEM platforms: Dell XC, HPE DX, Lenovo ThinkAgile HX, Cisco Compute Hyperconverged, Fujitsu PRIMEFLEX XF and Supermicro Hyperconverged Optimized, besides Nutanix’s own NX nodes. Customers can keep the vendor they already buy from, including its buying models such as HPE GreenLake, Lenovo TruScale or Fujitsu uSCALE.',
    'One estate, many vendors: each cluster sits on one vendor’s hardware, and different clusters can be on different vendors, all run from the same Prism Central.',
    'Reuse what you own: vSAN ReadyNodes can move to Nutanix, and resellers offer Nutanix software on Cisco, HPE, Klas, KTNF and Curtiss-Wright PacStar servers. Exact models are on each vendor’s hardware compatibility list.',
    'Or no hardware at all: Nutanix Cloud Clusters (NC2) run the same software on bare-metal instances in AWS, Azure, Google Cloud and OVHcloud. Changing vendor later is a hardware decision, not a platform migration.',
  ],
  numbers: [
    { k: 'OEM platforms', v: 'Dell XC · HPE DX · Lenovo ThinkAgile HX · Cisco Compute Hyperconverged · Fujitsu PRIMEFLEX XF · Supermicro Hyperconverged Optimized' },
    { k: 'Nutanix hardware', v: 'NX nodes' },
    { k: 'Through resellers', v: 'Cisco, HPE, Klas, KTNF and Curtiss-Wright PacStar servers' },
    { k: 'Hardware you own', v: 'vSAN ReadyNodes can move to Nutanix (check the compatibility list)' },
    { k: 'Public cloud (NC2)', v: 'AWS, Azure, Google Cloud, OVHcloud' },
  ],
  qa: [
    {
      q: 'Can one cluster mix servers from different vendors?',
      a: 'Plan each cluster on one vendor’s platform; mixing vendors inside a cluster is not the supported design we found. Different clusters on different vendors are fine, and Prism Central manages them all. Check the compatibility lists for your exact models.',
    },
    {
      q: 'Can we reuse the servers we already have?',
      a: 'Often, yes. Nutanix says vSAN ReadyNodes can be moved to Nutanix, and its software is available through resellers on several third-party servers. Whether your exact models qualify is on the hardware compatibility lists, so check those before you plan.',
    },
    {
      q: 'What about Kubernetes straight on bare metal?',
      a: 'That is NKP Metal, introduced with NKP 2.19 in October 2026; confirm its support status with Nutanix. Its named hardware partners at launch are Cisco, Lenovo and Supermicro; see Cloud Native AOS and Kubernetes Platform.',
    },
  ],
  next: [
    'Point at the vendor list above the picture, then let the platform land on each one: the same software every time.',
    'Pause on One estate, many vendors: different clusters on different vendors, one Prism Central.',
    'Let it reach Reuse what you own and Or no hardware at all.',
    'Then open Nutanix Cloud Infrastructure for what the software does, or Hybrid & Public Cloud for NC2.',
  ],
  then: ['nci', 'cloud'],
};

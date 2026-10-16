import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/flow',
  title: 'Flow: Security & Virtual Networking',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Firewall rules that follow each VM by its labels, enforced on every host, and private networks created in software without touching the physical network.',
  priority: 'P0',
  talk: [
    'Flow Network Security is a stateful, distributed firewall built into AHV. Rules are written against categories (labels such as AppTier: Web), not IP addresses, and enforced at each VM’s network interface.',
    'Start in Monitoring: everything still flows, and the rule-hit log shows exactly what a policy would block. Switch to Enforced once the log is clean.',
    'Application policies allow only the listed flows into an app; everything else is denied by default. Isolation policies wall off environments such as Production and Dev. Quarantine removes a VM from the network in one click.',
    'Because enforcement is in the hypervisor and keyed to categories, the policy moves with a VM when it live-migrates. No rule or address list changes.',
    'Flow Virtual Networking adds VPCs: overlay networks with their own subnets, routing, NAT and floating IPs. Traffic between hosts is wrapped in Geneve, so the physical network only needs host-to-host reachability.',
    'For the network team, a new project on VPCs needs no new VLAN, trunk, gateway or unique IP range.',
  ],
  numbers: [
    { k: 'Policy types', v: 'Application, Isolation, Quarantine (Strict or Forensic), Shared Services, VDI' },
    { k: 'Policy states', v: 'Saved, Monitoring, Enforced' },
    { k: 'Overlay encapsulation', v: 'Geneve between AHV hosts (VTEP gateways use VXLAN)' },
    { k: 'Geneve overhead', v: '58 bytes; guest MTU 1442 if the network cannot carry jumbo frames' },
    { k: 'External networks', v: 'NAT (source NAT + floating IPs) or routed (no NAT)' },
  ],
  qa: [
    {
      q: 'Do we need agents in the VMs?',
      a: 'No. Flow Network Security is agentless: it runs in the AHV virtual switch. That also means it protects VMs on AHV; workloads elsewhere need their own controls.',
    },
    {
      q: 'Will turning on microsegmentation break our applications?',
      a: 'It can if you enforce rules you have not validated. That is why policies start in Monitoring: traffic keeps flowing while the log shows what would be blocked. Fix the rules, then enforce.',
    },
    {
      q: 'Do overlay networks replace VLANs?',
      a: 'Not necessarily. Both can run on the same cluster. VPCs suit self-service projects, overlapping ranges and multi-tenant setups; VLAN-backed subnets still fit workloads that must sit on an existing physical segment. VPCs need Prism Central with the Network Controller and an external VLAN for traffic in and out.',
    },
  ],
  next: [
    'Network Security with Policy Off: app traffic flows and every unwanted try gets through. Switch to Monitor: the same tries are flagged in the log but still get through. Then Enforce: each one is stopped at the VM.',
    'Turn on Quarantine Web-2: nothing gets in or out of Web-2, even with the policy Off, while Web-1 keeps the app running.',
    'Virtual Networking, Inside a VPC: two VPCs use the very same addresses, and each packet crosses between hosts in an envelope tagged with its VPC.',
    'Out to the internet, then In from the internet: source NAT gives a whole VPC one public address, and a floating IP lets outsiders reach one VM.',
    'Open Data Security to see where Flow fits with encryption and hardening.',
  ],
  honest: [
    'Microsegmentation is only as good as its categories and rules. If VMs are mislabeled or rules go stale, protection quietly weakens; keep tagging part of provisioning.',
    'Monitoring logs but does not block. It is the recommended way to start, but a policy left in Monitoring protects nothing.',
    'An attacker who exploits a port the application genuinely needs can still move along that allowed path. Policy limits the blast radius; detection and quarantine still matter.',
    'Overlay networking adds an encapsulation layer (58 bytes per packet), a dependency on Prism Central’s Network Controller, and gateway sizing to plan: source NAT for a VPC runs on one host, and troubleshooting spans overlay and underlay.',
  ],
};

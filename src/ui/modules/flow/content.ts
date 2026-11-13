import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'nci/flow',
  title: 'Flow: Network Security & Virtual Networking',
  tag: 'Nutanix Cloud Infrastructure',
  summary:
    'Flow Network Security keeps firewall rules with each VM by its labels on every host, and Flow Virtual Networking builds virtual private clouds (VPCs) in software without touching the physical network.',
  priority: 'P0',
  facts: {
    release: { v: 'Next-Gen 7.6', sub: 'Flow Network Security · Jul 2026 · with AOS 7.6 and pc.7.6' },
    license: { v: 'Confirm with Nutanix', sub: 'Flow Network Security: microsegmentation is listed under NCI Ultimate', tip: 'Nutanix lists microsegmentation under NCI Ultimate and names a Security add-on license. Next-Gen 7.6 installs with AOS 7.6 and Prism Central pc.7.6, but Nutanix’s pages do not state its license, so confirm it. Virtual Networking has its own line on its tab.' },
  },
  talk: [
    'Flow Network Security is a stateful, distributed firewall in AHV. Rules name categories such as AppTier: Web, not IP addresses. Next-Gen, the current generation, comes with AOS 7.6 and Prism Central pc.7.6; legacy clusters need a planned upgrade and a separate policy migration.',
    'Start in Monitor: everything still flows, and the rule-hit log shows exactly what a policy would block. Switch to Enforce once the log is clean.',
    'Application policies allow only the listed flows into an app; everything else is denied by default. Isolation policies wall off environments such as Production and Dev. Quarantine removes a VM from the network in one click.',
    'Enforcement happens at each VM’s network interface in the hypervisor and is keyed to categories, so the policy moves with a VM when it live-migrates. No rule or address list changes.',
    'Flow Virtual Networking adds VPCs: overlay networks with their own subnets, routing, network address translation (NAT) and floating IPs. Traffic between hosts is wrapped in Geneve, so the physical network only needs host-to-host reachability.',
    'For the network team, a new project on VPCs needs no new VLAN, trunk, gateway or unique IP range.',
  ],
  numbers: [
    { k: 'Policy types', v: 'Application, Isolation, Quarantine (Strict or Forensic), Shared Services, VDI (virtual desktop infrastructure; by release)' },
    { k: 'Current release', v: 'Flow Network Security Next-Gen 7.6 (Jul 2026), bundled with AOS 7.6 and Prism Central pc.7.6; adds rule-centric policies and policies by fully qualified domain name (FQDN)' },
    { k: 'Policy states (Prism)', v: 'Saved, Monitoring, Enforced' },
    { k: 'Overlay encapsulation', v: 'Geneve between AHV hosts; VTEP (virtual tunnel endpoint) gateways use VXLAN (Virtual Extensible LAN)' },
    { k: 'Geneve overhead', v: '58 bytes per packet; Dynamic Host Configuration Protocol (DHCP) gives guests a maximum transmission unit (MTU) of 1442 (1500 less 58); the physical network needs at least 1558, ideally 9000' },
    { k: 'External networks', v: 'NAT (source NAT and floating IPs) or routed (no NAT); with NAT each gateway host has its own source NAT address, two active by default' },
  ],
  qa: [
    {
      q: 'Do we need agents in the VMs?',
      a: 'No. Flow Network Security is agentless: it runs in the AHV virtual switch. That also means it protects VMs on AHV; workloads elsewhere need their own controls.',
    },
    {
      q: 'Will turning on microsegmentation break our applications?',
      a: 'It can if you enforce rules you have not validated. That is why policies start in Monitor: traffic keeps flowing while the log shows what would be blocked. Fix the rules, then enforce.',
    },
    {
      q: 'Do overlay networks replace VLANs?',
      a: 'Not necessarily. Both can run on the same cluster. VPCs suit self-service projects, overlapping ranges and multi-tenant setups; VLAN-backed subnets still fit workloads that must sit on an existing physical segment. VPCs need Prism Central with the Network Controller and an external VLAN for traffic in and out.',
    },
  ],
  next: [
    'On the Network Security tab, “Policy” opens on “Enforce”: each unwanted try is stopped at the VM. Switch to “Monitor” and the same tries are flagged in the log but still get through, then “Off” and nothing stops them.',
    'Set “Quarantine Web-2” to “On”: nothing gets in or out of Web-2, even with “Policy” on “Off”, while Web-1 keeps the app running.',
    'Open the Virtual Networking tab and keep “Inside a VPC” under “Follow a packet”: two VPCs use the very same addresses, and each packet crosses between hosts in an envelope tagged with its VPC.',
    'Pick “Out to the internet”, then “In from the internet”: source NAT lets a whole VPC share a public address, and a floating IP lets outsiders reach one VM.',
    'Then open Data Security to see where Flow fits with encryption and hardening.',
  ],
  then: ['nci/security'],
};

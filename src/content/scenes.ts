// Every option a module offers through a tab or a choice, so the search box can open the exact view
// ("balance tcp" opens AHV Networking with the LACP bond). `group` and `label` are the control's
// label and the option's text as shown on the page; a smoke test checks they still match, and that
// every tab and choice on every page is listed here.
//
// `params` are the URL params that select the option, left out for a module's default view.
// `hint` is the option's tooltip, shown in results; `words` are extra terms people may type
// (acronyms, older product names, what the option is about), never shown.

export interface Scene {
  path: string;
  params?: Record<string, string>;
  group: string;
  label: string;
  hint?: string;
  words?: string;
}

export const SCENES: Scene[] = [
  // ── Enterprise AI ──
  { path: 'ai', group: 'Enterprise AI topics', label: 'Model endpoint', words: 'nai inference llm model serving endpoint gpu' },
  { path: 'ai', params: { tab: 'gw' }, group: 'Enterprise AI topics', label: 'Agent Gateway', words: 'mcp model context protocol agents tools fallback rate limit api keys' },
  { path: 'ai', group: 'Where it runs', label: 'Your data center', words: 'on premises on prem' },
  { path: 'ai', params: { w: 'cloud' }, group: 'Where it runs', label: 'Public cloud', words: 'aws azure eks aks' },
  { path: 'ai', params: { w: 'airgap' }, group: 'Where it runs', label: 'Air-gapped site', words: 'airgap dark site disconnected offline' },
  { path: 'ai', params: { r: '1' }, group: 'Model replicas', label: '1', words: 'replica scale' },
  { path: 'ai', group: 'Model replicas', label: '2', words: 'replicas scale' },
  { path: 'ai', params: { r: '4' }, group: 'Model replicas', label: '4', words: 'replicas scale out' },

  // ── Protection & Capacity ──
  { path: 'nci/capacity', group: 'Protection topics', label: 'Copies (RF2, RF3)', words: 'replication factor redundancy factor usable capacity' },
  { path: 'nci/capacity', params: { tab: 'ec' }, group: 'Protection topics', label: 'Erasure coding (EC-X)', words: 'ecx parity strip space savings' },
  { path: 'nci/capacity', params: { tab: 'domains' }, group: 'Protection topics', label: 'Blocks and racks', words: 'block awareness rack awareness fault domains' },
  { path: 'nci/capacity', group: 'Copies', label: 'RF2 · 2 copies', words: 'replication factor 2 fault tolerance ft1' },
  { path: 'nci/capacity', params: { ft: '3', nodes: '5', rf: '3' }, group: 'Copies', label: 'RF3 · 3 copies', words: 'replication factor 3 fault tolerance ft2' },
  { path: 'nci/capacity', params: { nodes: '3' }, group: 'Nodes', label: '3', words: 'nodes cluster size' },
  { path: 'nci/capacity', params: { nodes: '4' }, group: 'Nodes', label: '4', words: 'nodes cluster size' },
  { path: 'nci/capacity', params: { nodes: '5' }, group: 'Nodes', label: '5', words: 'nodes cluster size' },
  { path: 'nci/capacity', params: { nodes: '6' }, group: 'Nodes', label: '6', words: 'nodes cluster size' },
  { path: 'nci/capacity', params: { nodes: '8' }, group: 'Nodes', label: '8', words: 'nodes cluster size' },
  { path: 'nci/capacity', params: { nodes: '12' }, group: 'Nodes', label: '12', words: 'nodes cluster size' },
  { path: 'nci/capacity', params: { tab: 'ec' }, group: 'Copies', label: 'RF2 · 4/1 strip', words: 'erasure coding ecx parity' },
  { path: 'nci/capacity', params: { ft: '3', rf: '3', tab: 'ec' }, group: 'Copies', label: 'RF3 · 4/2 strip', words: 'erasure coding ecx parity' },
  { path: 'nci/capacity', params: { aw: 'node', tab: 'domains' }, group: 'Keep copies apart by', label: 'Node only', words: 'node awareness fault domain' },
  { path: 'nci/capacity', params: { tab: 'domains' }, group: 'Keep copies apart by', label: 'Block', words: 'block awareness fault domain chassis' },
  { path: 'nci/capacity', params: { aw: 'rack', tab: 'domains' }, group: 'Keep copies apart by', label: 'Rack', words: 'rack awareness fault domain' },

  // ── Nutanix Central & Prism Federation ──
  { path: 'central', params: { tab: 'pe' }, group: 'View from', label: 'Prism Element · one cluster', words: 'pe prism element cluster ui' },
  { path: 'central', params: { tab: 'pc' }, group: 'View from', label: 'Prism Central · one region', words: 'pc prism central multi cluster' },
  { path: 'central', group: 'View from', label: 'Nutanix Central · every region', words: 'federation global multi region' },

  // ── Hybrid & Public Cloud ──
  { path: 'cloud', group: 'Cloud', label: 'AWS', words: 'nc2 amazon bare metal' },
  { path: 'cloud', params: { c: 'azure' }, group: 'Cloud', label: 'Azure', words: 'nc2 microsoft' },
  { path: 'cloud', params: { c: 'gcp' }, group: 'Cloud', label: 'Google Cloud', words: 'nc2 gcp' },
  { path: 'cloud', group: 'Use case', label: 'Disaster recovery', words: 'dr failover cloud dr' },
  { path: 'cloud', params: { u: 'burst' }, group: 'Use case', label: 'Burst capacity', words: 'bursting peak scale out' },
  { path: 'cloud', params: { u: 'exit' }, group: 'Use case', label: 'Data-center exit', words: 'datacenter migration lift and shift' },

  // ── Cluster & DSF Lab ──
  { path: 'nci/cluster', group: 'What happens', label: 'Data placement', words: 'dsf distributed storage fabric write copies' },
  { path: 'nci/cluster', params: { sc: 'migrate' }, group: 'What happens', label: 'Live migration', words: 'vmotion live migrate move vm' },
  { path: 'nci/cluster', params: { sc: 'maint' }, group: 'What happens', label: 'Planned shutdown', words: 'maintenance mode host down' },
  { path: 'nci/cluster', params: { sc: 'failover' }, group: 'What happens', label: 'VM failover', words: 'ha high availability restart node failure' },
  { path: 'nci/cluster', params: { sc: 'drive' }, group: 'What happens', label: 'Drive failure', words: 'disk failure rebuild' },

  // ── Cloud Native AOS ──
  { path: 'cnaos', group: 'Kubernetes runs on', label: 'Amazon EKS', words: 'aws kubernetes' },
  { path: 'cnaos', params: { on: 'metal' }, group: 'Kubernetes runs on', label: 'Bare metal (NKP Metal)', words: 'baremetal nkp' },

  // ── Data Path ──
  { path: 'nci/datapath', group: 'What happens', label: 'Small write', words: 'random write oplog io path' },
  { path: 'nci/datapath', params: { m: 'ws' }, group: 'What happens', label: 'Large sequential write', words: 'extent store bypass oplog' },
  { path: 'nci/datapath', params: { m: 'rd' }, group: 'What happens', label: 'Read', words: 'read path cache' },
  { path: 'nci/datapath', params: { m: 'loc' }, group: 'What happens', label: 'Read after a VM moves', words: 'data locality migration remote read' },
  { path: 'nci/datapath', group: 'Copies', label: 'RF2 · 2 copies', words: 'replication factor 2' },
  { path: 'nci/datapath', params: { drf: '3' }, group: 'Copies', label: 'RF3 · 3 copies', words: 'replication factor 3' },

  // ── Disaster Recovery ──
  { path: 'nci/dr', group: 'Replication', label: 'Async', words: 'asynchronous replication rpo hour' },
  { path: 'nci/dr', params: { rep: 'nearsync' }, group: 'Replication', label: 'NearSync / Sync', words: 'near sync synchronous rpo minutes zero' },
  { path: 'nci/dr', params: { rep: 'metro' }, group: 'Replication', label: 'Metro Availability', words: 'stretched cluster synchronous rpo zero witness' },
  { path: 'nci/dr', params: { ev: 'planned' }, group: 'What happens', label: 'Planned failover', words: 'test failover migrate recovery plan' },
  { path: 'nci/dr', group: 'What happens', label: 'Unplanned (site lost)', words: 'unplanned failover outage disaster site down' },

  // ── Edge & ROBO ──
  { path: 'nci/edge', params: { sz: '1' }, group: 'Site size', label: '1 node', words: 'single node robo' },
  { path: 'nci/edge', group: 'Site size', label: '2 nodes + Witness', words: 'two node witness robo' },
  { path: 'nci/edge', params: { sz: '3' }, group: 'Site size', label: '3 nodes', words: 'three node robo' },
  { path: 'nci/edge', params: { ev: 'drive' }, group: 'What happens', label: 'Drive fails', hint: 'One drive in a node stops working.', words: 'disk failure' },
  { path: 'nci/edge', group: 'What happens', label: 'Node fails', hint: 'A whole node goes down: power, motherboard or similar.', words: 'node failure' },
  { path: 'nci/edge', params: { ev: 'peer' }, group: 'What happens', label: 'Nodes lose contact', hint: 'The network between the nodes breaks while every node keeps running.', words: 'split brain partition' },
  { path: 'nci/edge', params: { ev: 'wan' }, group: 'What happens', label: 'Link to the data center drops', hint: 'The site loses its connection to the data center where Prism Central (and, for two nodes, the Witness) runs.', words: 'wan outage disconnected' },
  { path: 'nci/edge', params: { ev: 'upgrade' }, group: 'What happens', label: 'Planned upgrade', hint: 'LCM upgrades AOS and AHV at the site.', words: 'lcm upgrade' },
  { path: 'nci/edge', params: { ev: 'expand' }, group: 'What happens', label: 'Add a node', hint: 'The site needs more room, so one more node arrives.', words: 'expand cluster scale out' },

  // ── Failure Gauntlet ──
  { path: 'nci/failures', params: { sc: 'disk' }, group: 'What fails', label: 'Drive', words: 'disk failure rebuild' },
  { path: 'nci/failures', params: { sc: 'cvm' }, group: 'What fails', label: 'Controller VM', words: 'cvm failure autopath' },
  { path: 'nci/failures', group: 'What fails', label: 'Node', words: 'node failure ha' },
  { path: 'nci/failures', params: { sc: 'block' }, group: 'What fails', label: 'Block', words: 'block failure chassis' },
  { path: 'nci/failures', params: { sc: 'double' }, group: 'What fails', label: 'Two nodes', words: 'double failure two node' },
  { path: 'nci/failures', params: { sc: 'full' }, group: 'What fails', label: 'Nearly full', words: 'capacity full no room rebuild' },
  { path: 'nci/failures', params: { sc: 'double' }, group: 'Copies', label: 'RF2 · 2 copies', words: 'replication factor 2' },
  { path: 'nci/failures', params: { cp: '3', sc: 'double' }, group: 'Copies', label: 'RF3 · 3 copies', words: 'replication factor 3' },

  // ── Flow ──
  { path: 'nci/flow', group: 'Flow', label: 'Network Security', words: 'microsegmentation firewall policy fns' },
  { path: 'nci/flow', params: { tab: 'net' }, group: 'Flow', label: 'Virtual Networking', words: 'vpc overlay sdn fvn' },
  { path: 'nci/flow', params: { pm: 'off' }, group: 'Policy', label: 'Off', words: 'no policy microsegmentation' },
  { path: 'nci/flow', params: { pm: 'monitor' }, group: 'Policy', label: 'Monitor', words: 'monitor mode visualize traffic microsegmentation' },
  { path: 'nci/flow', group: 'Policy', label: 'Enforce', words: 'enforce mode block traffic microsegmentation' },
  { path: 'nci/flow', group: 'Quarantine Web-2', label: 'Off', words: 'quarantine isolate' },
  { path: 'nci/flow', params: { q: '1' }, group: 'Quarantine Web-2', label: 'On', words: 'quarantine isolate infected vm' },
  { path: 'nci/flow', params: { tab: 'net' }, group: 'Follow a packet', label: 'Inside a VPC', words: 'vpc east west overlay' },
  { path: 'nci/flow', params: { tab: 'net', vp: 'nat' }, group: 'Follow a packet', label: 'Out to the internet', words: 'snat nat egress' },
  { path: 'nci/flow', params: { tab: 'net', vp: 'fip' }, group: 'Follow a packet', label: 'In from the internet', words: 'floating ip fip ingress' },

  // ── LCM Rolling Upgrade ──
  { path: 'nci/lcm', group: 'What happens', label: 'Healthy cluster', words: 'rolling upgrade one click' },
  { path: 'nci/lcm', params: { sc: 'fail' }, group: 'What happens', label: 'A node fails mid-upgrade', words: 'upgrade failure pause' },

  // ── Migration with Nutanix Move ──
  { path: 'nci/move', group: 'Source platform', label: 'VMware ESXi', words: 'vmware vsphere vcenter migrate' },
  { path: 'nci/move', params: { src: 'hyperv' }, group: 'Source platform', label: 'Hyper-V', words: 'hyperv microsoft migrate' },
  { path: 'nci/move', params: { src: 'ec2' }, group: 'Source platform', label: 'AWS EC2', words: 'amazon migrate' },
  { path: 'nci/move', params: { src: 'azure' }, group: 'Source platform', label: 'Azure', words: 'microsoft migrate' },

  // ── Cloud Manager ──
  { path: 'ncm', group: 'Cloud Manager areas', label: 'AIOps', words: 'intelligent operations anomaly forecasting right sizing' },
  { path: 'ncm', params: { tab: 'ss' }, group: 'Cloud Manager areas', label: 'Self-Service', words: 'calm catalog blueprint' },
  { path: 'ncm', params: { tab: 'cost' }, group: 'Cloud Manager areas', label: 'Cost', words: 'cost governance beam chargeback showback' },
  { path: 'ncm', params: { tab: 'sec' }, group: 'Cloud Manager areas', label: 'Security', words: 'security compliance security central baseline' },
  { path: 'ncm', params: { rq: 'vm', tab: 'ss' }, group: 'Request', label: 'Linux VM', words: 'self service request' },
  { path: 'ncm', params: { tab: 'ss' }, group: 'Request', label: '3-tier web app', words: 'blueprint self service' },
  { path: 'ncm', params: { rq: 'over', tab: 'ss' }, group: 'Request', label: 'App over quota', words: 'quota approval denied' },
  { path: 'ncm', params: { tab: 'sec' }, group: 'Baseline', label: 'Platform hardening', words: 'hardening compliance baseline' },
  { path: 'ncm', params: { bl: 'reg', tab: 'sec' }, group: 'Baseline', label: 'Card data (PCI)', words: 'pci dss compliance regulation' },

  // ── Database Service ──
  { path: 'ndb', group: 'Database Service', label: 'Time Machine', words: 'ndb point in time recovery pitr' },
  { path: 'ndb', params: { tab: 'prov' }, group: 'Database Service', label: 'Provisioning', words: 'ndb provision new database' },
  { path: 'ndb', params: { tab: 'patch' }, group: 'Database Service', label: 'Patching', words: 'ndb patch upgrade database' },
  { path: 'ndb', group: 'Recover as', label: 'Clone beside production', words: 'clone copy dev test' },
  { path: 'ndb', params: { rm: 'restore' }, group: 'Recover as', label: 'Restore in place', words: 'restore rollback recover' },
  { path: 'ndb', params: { tab: 'prov' }, group: 'Topology', label: 'Single instance', words: 'standalone' },
  { path: 'ndb', params: { tab: 'prov', tp: 'ha' }, group: 'Topology', label: 'High availability', words: 'ha cluster' },

  // ── AHV Networking ──
  { path: 'nci/network', group: 'Bond type', label: 'Active-Backup', hint: 'Prism: Active-Backup (default, recommended)', words: 'nic teaming bond uplink failover' },
  { path: 'nci/network', params: { bond: 'slb' }, group: 'Bond type', label: 'Balance-SLB', hint: 'Prism: Active-Active with MAC pinning (Balance-SLB)', words: 'nic teaming bond uplink mac pinning' },
  { path: 'nci/network', params: { bond: 'lacp' }, group: 'Bond type', label: 'LACP', hint: 'Prism: Active-Active (balance-tcp with LACP)', words: 'nic teaming bond uplink link aggregation lag port channel 802.3ad' },
  { path: 'nci/network', group: 'Link failure', label: 'None', words: 'uplink' },
  { path: 'nci/network', params: { lf: 'one' }, group: 'Link failure', label: 'One link fails', words: 'uplink down cable nic failure' },

  // ── Kubernetes Platform ──
  { path: 'nkp', group: 'What happens', label: 'Healthy rollout', words: 'kubernetes upgrade fleet canary' },
  { path: 'nkp', params: { ro: 'fail' }, group: 'What happens', label: 'Canary fails', words: 'kubernetes upgrade health check rollback' },

  // ── Don’t want the full stack? ──
  { path: 'partial', group: 'Ways to start', label: 'Nutanix with external storage', words: 'external array san everpure pure storage flasharray dell powerstore powerflex netapp ontap compute only' },
  { path: 'partial', params: { tab: 'esxi' }, group: 'Ways to start', label: 'ESXi on Nutanix', words: 'vmware vsphere' },
  { path: 'partial', params: { tab: 'esxi' }, group: 'Path', label: 'Stay on ESXi', words: 'vmware vsphere' },
  { path: 'partial', params: { go: 'conv', tab: 'esxi' }, group: 'Path', label: 'Convert to AHV later', words: 'conversion vmware' },

  // ── Data Security ──
  { path: 'nci/security', params: { enc: 'off' }, group: 'Encryption', label: 'Off', words: 'unencrypted' },
  { path: 'nci/security', group: 'Encryption', label: 'On · built-in key manager', words: 'encryption at rest native kms local key manager' },
  { path: 'nci/security', params: { enc: 'ext' }, group: 'Encryption', label: 'On · external key manager', words: 'encryption at rest ekm kms kmip' },
  { path: 'nci/security', group: 'What happens', label: 'A drive is stolen', words: 'theft disk' },
  { path: 'nci/security', params: { th: 'node' }, group: 'What happens', label: 'A whole node is stolen', words: 'theft server' },

  // ── Unified Storage ──
  { path: 'storage', group: 'Storage services', label: 'Files · SMB / NFS', words: 'nutanix files file server nas share' },
  { path: 'storage', params: { tab: 'vol' }, group: 'Storage services', label: 'Volumes · iSCSI block', words: 'nutanix volumes block storage lun' },
  { path: 'storage', params: { tab: 'obj' }, group: 'Storage services', label: 'Objects · S3', words: 'nutanix objects object storage bucket' },
  { path: 'storage', group: 'File server', label: '3 FSVMs', words: 'file server vm' },
  { path: 'storage', params: { fv: '1' }, group: 'File server', label: '1 FSVM', words: 'file server vm single' },
];

/** Extra terms for whole modules, never shown: other names people use for what a module covers. */
export const MODULE_WORDS: Record<string, string> = {
  nci: 'nci aos ahv hci hyperconverged',
  'nci/hci': 'hyperconverged hyper converged three tier 3 tier legacy san fibre channel storage array',
  'nci/cluster': 'dsf distributed storage fabric',
  'nci/datapath': 'io path write read oplog',
  'nci/capacity': 'usable capacity sizing',
  'nci/snapshots': 'backup restore point copy',
  'nci/failures': 'resiliency self healing',
  'nci/lcm': 'upgrade firmware patch',
  'nci/network': 'nic bond virtual switch ovs open vswitch vlan',
  'nci/security': 'encryption at rest kms',
  'nci/dr': 'business continuity bcdr failover rpo rto',
  'nci/move': 'migrate migration vmware exit',
  'nci/edge': 'robo remote office branch office',
  central: 'multi cluster management prism',
  ncm: 'ncm nutanix cloud manager',
  nkp: 'kubernetes k8s containers',
  datalens: 'ransomware data governance audit',
  storage: 'nas file share unified storage',
  cnaos: 'ndk kubernetes storage containers',
  ndb: 'database dbaas sql server oracle postgres mysql mongodb',
  ai: 'nai llm genai generative ai gpu',
  cloud: 'nc2 nutanix cloud clusters aws azure gcp',
  partial: 'external storage esxi vmware',
};

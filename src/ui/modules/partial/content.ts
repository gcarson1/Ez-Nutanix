import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'partial',
  title: 'Don’t want the full stack?',
  tag: 'Infrastructure',
  summary: 'Two ways to start with part of Nutanix: run AHV and Prism on compute-only nodes with the storage array you already own, or keep VMware ESXi as the hypervisor on Nutanix nodes and storage.',
  priority: 'P1',
  facts: {
    release: { v: 'AOS 7.6', sub: 'Jul 2026 · FlashArray needs AOS 7.5 and AHV 11 or later' },
    license: { v: 'NCI-C', sub: 'NCI Compute, priced per core', tip: 'NCI Compute: AHV, Prism and DR automation, priced per core. Snapshots and clones are left to the storage array.' },
  },
  talk: [
    'Not every customer wants to replace hypervisor, storage and management at once. This page shows the two partial starting points, and why each one appeals.',
    'External storage: keep the array. AHV compute-only nodes reach Everpure FlashArray or Dell PowerStore over NVMe/TCP, Dell PowerFlex through Dell’s own client, and NetApp ONTAP, which is only announced, over NFS.',
    'The value is reuse and independent scaling: leave vSphere without a storage refresh, add compute without buying storage and keep Prism, Flow Network Security and DR orchestration on top. Licensing is per core, as Nutanix Cloud Infrastructure (NCI) Compute.',
    'ESXi on Nutanix: keep vSphere. vCenter, vMotion, HA and DRS keep working, while a Controller VM (CVM) on every host owns the drives and pools them into one datastore. No SAN to run, and existing VMware licenses stay.',
    'It is also a stepping stone. Switch to “Convert to AHV later”: hosts change hypervisor one at a time in place (Nutanix Move’s In-Place Cluster Conversion), or teams move VMs to a new AHV cluster with Nutanix Move or a DR failover. Conversion has requirements that depend on your versions, so validate them first. Cross-hypervisor disaster recovery already works between ESXi and AHV clusters, within its requirements.',
    'Be precise on availability: NetApp ONTAP was announced in April 2026 and is not generally available yet, FlashArray needs a new Nutanix cluster, and Flow and Nutanix Cloud Clusters (NC2) need AHV.',
  ],
  numbers: [
    { k: 'Arrays generally available', v: 'Dell PowerFlex (Apr 2025), Everpure FlashArray (Dec 2025), Dell PowerStore (AOS 7.6, Jul 2026)' },
    { k: 'Announced, not yet generally available', v: 'NetApp ONTAP (AFF A-series, select FAS) over NFS, planned for an upcoming Nutanix Cloud Infrastructure release' },
    { k: 'Array protocol', v: 'NVMe/TCP on Ethernet; PowerFlex uses Dell’s client (SDC); NetApp uses NFS' },
    { k: 'Volumes', v: 'One array volume per VM disk, with the array’s own snapshots and clones, on the generally available arrays' },
    { k: 'FlashArray cluster', v: '3 to 32 nodes, one FlashArray, new cluster only' },
    { k: 'External storage license', v: 'NCI Compute (NCI-C), priced per core' },
    { k: 'ESXi cluster size', v: 'Up to 48 hosts (vSphere 7.0, AOS 6.8)' },
    { k: 'vSphere 8 end of general support', v: 'Oct 2027, as Nutanix states it' },
  ],
  qa: [
    {
      q: 'Can we use our NetApp array?',
      a: 'Not yet. Nutanix and NetApp announced ONTAP support over NFS in April 2026, for AFF A-series and some FAS systems, and in mid-October 2026 it was still planned for this fall with an upcoming Nutanix Cloud Infrastructure (NCI) release (NetApp’s own blog names NCI 7.6.0.10). The page lists it with the other arrays, marked as announced. Today the generally available arrays are Everpure FlashArray, Dell PowerStore and Dell PowerFlex.',
    },
    {
      q: 'Can we attach our existing Nutanix cluster to the array?',
      a: 'Not with FlashArray: Everpure documents it as a new (greenfield) Nutanix cluster only, though the array itself can be one you already own. For PowerStore and PowerFlex we have not found a published answer, so check before planning on it.',
    },
    {
      q: 'Is ESXi on Nutanix still supported after Broadcom’s changes?',
      a: 'Yes. Nutanix still lists ESXi as a supported hypervisor and says you can keep running vSphere on-premises with your existing VMware licenses; Broadcom now sells vSphere as VMware vSphere Foundation (VVF) or VMware Cloud Foundation (VCF) subscriptions. Features built for AHV, such as Flow Network Security, Flow Virtual Networking and NC2 in the public cloud, need AHV. Check the compatibility matrix for the qualified ESXi versions.',
    },
  ],
  next: [
    'Start on the “Nutanix with external storage” tab and let the loop run: the array stays, compute nodes connect and each VM disk becomes its own volume.',
    'Point at Works with: three arrays are generally available and NetApp ONTAP is announced.',
    'Open the “ESXi on Nutanix” tab, play Stay on ESXi, then set Path to Convert to AHV later.',
    'Then open Migration with Nutanix Move for how VMs get across, Legacy vs Nutanix HCI for how the full stack scales or Disaster Recovery for failover to a full Nutanix cluster.',
  ],
  then: ['nci/move', 'nci/hci', 'nci/dr'],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'partial',
  title: 'Don’t want the full stack?',
  tag: 'Nutanix Cloud Infrastructure',
  summary: 'Two ways to start with part of Nutanix: run AHV and Prism on compute-only nodes with the storage array you already own, or keep VMware ESXi as the hypervisor on Nutanix nodes and storage.',
  priority: 'P1',
  talk: [
    'Not every customer wants to replace hypervisor, storage and management at once. This page shows the two partial starting points, and why each one appeals.',
    'External storage: keep the array. AHV runs on compute-only nodes that reach Everpure FlashArray or Dell PowerStore over NVMe/TCP, or Dell PowerFlex through Dell’s own client. Each VM disk is its own volume on the array, and Nutanix uses the array’s snapshots and clones.',
    'The value is reuse and independent scaling: leave vSphere without a storage refresh, add compute nodes without buying storage, and keep Prism, Flow and DR orchestration on top. It is licensed per core as NCI Compute.',
    'ESXi on Nutanix: keep vSphere. vCenter, vMotion, HA and DRS keep working; a Controller VM on every host owns the drives and pools them into one datastore. There is no SAN to run, and the customer uses their existing VMware licenses.',
    'It is also a stepping stone. Switch to "Convert to AHV later": the hosts change hypervisor one at a time in place, or teams move with Nutanix Move or a DR failover. Replication already works between ESXi and AHV clusters.',
    'Be precise on availability: NetApp ONTAP was announced in April 2026 and isn’t generally available yet, FlashArray needs a new Nutanix cluster, and Flow and NC2 need AHV.',
  ],
  numbers: [
    { k: 'Arrays generally available', v: 'Dell PowerFlex (Apr 2025), Everpure FlashArray (Dec 2025), Dell PowerStore (NCI 7.6, Jul 2026)' },
    { k: 'Array protocol', v: 'NVMe/TCP on Ethernet; PowerFlex uses Dell SDC' },
    { k: 'FlashArray cluster', v: '3 to 32 nodes, one FlashArray, new cluster only' },
    { k: 'External storage license', v: 'NCI Compute (NCI-C), priced per core' },
    { k: 'ESXi cluster size', v: 'Up to 48 hosts (vSphere 7.0, AOS 6.8)' },
    { k: 'vSphere 8 end of general support', v: 'October 2027, as Nutanix states it' },
  ],
  qa: [
    {
      q: 'Can we use our NetApp array?',
      a: 'Not yet. Nutanix and NetApp announced ONTAP support over NFS in April 2026, for AFF A-series and some FAS systems, and in mid-October 2026 it was still planned for this fall with an upcoming NCI release. Today the generally available arrays are Everpure FlashArray, Dell PowerStore and Dell PowerFlex.',
    },
    {
      q: 'Can we attach our existing Nutanix cluster to the array?',
      a: 'Not with FlashArray: Everpure documents it as a new (greenfield) Nutanix cluster only, though the array itself can be one you already own. For PowerStore and PowerFlex we haven’t found a published answer, so check before planning on it.',
    },
    {
      q: 'Is ESXi on Nutanix still supported after Broadcom’s changes?',
      a: 'Yes. Nutanix still lists ESXi as a supported hypervisor and says you can keep running vSphere on premises with your existing VMware licenses; Broadcom now sells vSphere as VVF or VCF subscriptions. Features built for AHV, such as Flow and NC2 in the public cloud, need AHV. Check the compatibility matrix for the qualified ESXi versions.',
    },
  ],
  next: [
    'Start on "Nutanix with external storage" and let the loop run: the array stays, compute nodes connect, and each VM disk becomes its own volume.',
    'Switch arrays to show the protocol and dates change, then open "ESXi on Nutanix" and play "Stay on ESXi" and "Convert to AHV later".',
    'Then open Migration with Nutanix Move, Scale-out vs 3-tier or Disaster Recovery.',
  ],
};

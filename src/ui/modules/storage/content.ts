import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'storage',
  title: 'Unified Storage: Files, Volumes, Objects',
  tag: 'Platform services',
  summary:
    'Nutanix Unified Storage (NUS) is fast, exabyte-scale unstructured storage: Files (SMB, NFS and parallel NFS for HPC), Volumes (iSCSI) and Objects (S3) from the Distributed Storage Fabric (DSF) that runs your VMs, so one platform is protected, sized and upgraded the same way.',
  priority: 'P1',
  facts: {
    release: { v: 'NUS 5.4', sub: 'Files 5.4 · Objects 5.4 · release notes Aug 2026' },
    license: { v: 'NUS Starter or Pro', sub: 'Per usable TiB. Starter is for hybrid, backup and archive' },
  },
  talk: [
    'One fabric, three access methods: Files for shares, Volumes for block, Objects for S3. All three inherit the DSF’s copies, self-healing and data efficiency.',
    'Position it as fast, exabyte-scale storage for unstructured data. Files: a set of file server VMs (FSVMs) presents one namespace. Scale out with more FSVMs or up with bigger ones; clients keep the same path. For HPC, parallel NFS (pNFS) lets clients read and write across many FSVMs at once.',
    'Fail an FSVM: a survivor takes over its volume group and IP address, folders stay reachable and the original takes them back when it returns.',
    'Volumes: hosts log in to one Data Services IP and are redirected to a healthy Controller VM (CVM), so path failover does not depend on client multipathing.',
    'Objects: S3-compatible buckets on at least three worker VMs, with WORM and Object Lock for immutable backups. Lifecycle rules tier old objects to another object store or an S3-compatible endpoint, on-premises or in a public cloud; validate your release and the endpoint first.',
  ],
  numbers: [
    { k: 'Current release', v: 'NUS 5.4, with Files 5.4 and Objects 5.4 (release notes Aug 2026)' },
    { k: 'Files HA minimum', v: '3 FSVMs; a single FSVM has no HA' },
    { k: 'Files protocols', v: 'SMB 2/3, NFS v3/v4, parallel NFS (pNFS) for HPC; encrypted NFS in 5.4' },
    { k: 'Scale', v: 'Exabyte-scale unstructured data' },
    { k: 'Objects minimum', v: '3 worker VMs; since 5.4 no load balancer VMs on supported AHV setups' },
    { k: 'Objects API', v: 'S3 (v4 signatures)' },
    { k: 'Licensing', v: 'NUS per usable TiB: Starter (hybrid, backup and archive) or Pro' },
    { k: 'Volumes for outside hosts', v: 'Not with NCI Starter, which serves in-cluster VMs only' },
  ],
  qa: [
    {
      q: 'Do we need separate hardware for file and object storage?',
      a: 'No. NUS can run on the same clusters as your VMs (NCI mode) or on dedicated clusters (dedicated mode). Large file or backup estates often get dedicated clusters so they can be sized independently.',
    },
    {
      q: 'What happens to users when a file server VM fails?',
      a: 'Another FSVM takes over the failed FSVM’s volume group and IP address. SMB clients may see a brief pause or reconnect; the path does not change. With a single-FSVM file server there is no takeover.',
    },
    {
      q: 'Can Objects be our immutable backup target?',
      a: 'Yes, that is a common use: WORM buckets and S3 Object Lock prevent changes or deletion until retention expires. Check that your backup software supports Object Lock and test restore times.',
    },
  ],
  next: [
    'On the Files · SMB / NFS tab, play File server 3 FSVMs and pause on A survivor takes over.',
    'Switch File server to 1 FSVM to show that the only FSVM fails with nothing to take over.',
    'On the Volumes · iSCSI block tab, pause on Host redirected.',
    'On the Objects · S3 tab, pause on Old objects move, then After one year.',
    'Then open Data Lens to spot ransomware on Files and Objects.',
  ],
  then: ['datalens'],
};

import type { ModuleContent } from '../../../content/types';

export const content: ModuleContent = {
  path: 'storage',
  title: 'Unified Storage: Files, Volumes, Objects',
  tag: 'Platform services',
  summary:
    'Nutanix Unified Storage (NUS) serves files (SMB and NFS), block (iSCSI) and objects (S3) from the same Distributed Storage Fabric that runs your VMs, so one platform is protected, sized and upgraded the same way.',
  priority: 'P1',
  talk: [
    'One fabric, three access methods: Files for shares, Volumes for block, Objects for S3. All three inherit the DSF’s copies, self-healing and data efficiency.',
    'Files: a set of file server VMs presents one namespace. Scale out with more FSVMs or up with bigger ones; clients keep the same path.',
    'Kill an FSVM: a survivor takes over its volume group and IP address, folders stay reachable, and the original takes them back when it returns.',
    'Volumes: hosts log in to one Data Services IP and are redirected to a healthy CVM, so path failover does not depend on client multipathing.',
    'Objects: S3-compatible buckets on at least three worker VMs, with WORM and Object Lock for immutable backups. Lifecycle rules tier old objects to any S3-compatible store, on premises or in a public cloud.',
  ],
  numbers: [
    { k: 'Current release', v: 'NUS 5.4 (Jul 2026): Files 5.4, Objects 5.4' },
    { k: 'Files HA minimum', v: '3 FSVMs (1 FSVM = no HA)' },
    { k: 'Files protocols', v: 'SMB 2/3, NFS v3/v4; encrypted NFS in 5.4' },
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
  next: ['Data Lens', 'Cluster & DSF Lab', 'Database Service'],
};

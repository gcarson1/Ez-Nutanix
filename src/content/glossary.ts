// Glossary drawer entries. Plain-English first; written for this explorer (not copied from docs).
export interface GlossaryEntry {
  term: string;
  full?: string;
  def: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: 'AHV', full: 'Nutanix AHV hypervisor', def: 'Nutanix’s own hypervisor, built on Linux KVM. It runs the virtual machines on each node and is managed through Prism.' },
  { term: 'AOS', full: 'Acropolis Operating System', def: 'The Nutanix software that turns a group of servers into one cluster: storage, data protection, management services and APIs.' },
  { term: 'Autopathing / iSCSI redirector', def: 'If the storage controller (CVM) on a host stops, that host’s VMs keep running and their storage I/O is redirected over the network to CVMs on other nodes. On ESXi and Hyper-V this is called autopathing; on AHV the iSCSI redirector does it.' },
  { term: 'Block', def: 'A physical chassis that holds one to four nodes. Block awareness keeps copies of data in different blocks so a whole-chassis failure loses nothing.' },
  { term: 'Category', def: 'A key/value tag (for example AppTier: Web) attached to VMs. Flow security policies and DR protection policies target categories instead of IP addresses or VM names.' },
  { term: 'Cluster', def: 'A group of nodes managed as one system. Storage from every node is pooled and protected across the whole cluster.' },
  { term: 'Curator', def: 'The AOS background service that scans metadata and runs cluster-wide jobs: re-protecting data after failures, disk balancing, tiering, erasure coding and cleanup.' },
  { term: 'CVM', full: 'Controller VM', def: 'A virtual machine on every node that runs the AOS services. Together the CVMs form the distributed storage controller, so storage performance and capacity grow with each node.' },
  { term: 'Data locality', def: 'A VM’s data is kept on the node where the VM runs, so reads are served locally without crossing the network. After a VM moves, data it reads is gradually copied to its new node.' },
  { term: 'DSF', full: 'Distributed Storage Fabric', def: 'The storage layer of AOS. It pools the local drives in every node into one storage pool and keeps multiple copies (or parity) of every piece of data on different nodes.' },
  { term: 'EC-X', full: 'Erasure coding', def: 'Saves capacity on write-cold data by replacing full copies with parity spread across nodes. A 4/1 strip needs 1.25x the space instead of 2x for two full copies.' },
  { term: 'Extent / extent group', def: 'The units AOS uses to store and track data. Placement and protection are managed per extent group, which is why recovery can target exactly the data that lost a copy.' },
  { term: 'Flow', def: 'Nutanix software-defined networking and security: microsegmentation (Flow Network Security) and overlay virtual networks / VPCs (Flow Virtual Networking).' },
  { term: 'HA', full: 'High availability', def: 'If a host fails, its VMs are restarted on the surviving hosts. With memory reservation enabled, enough capacity is held back to guarantee those restarts.' },
  { term: 'ILM', full: 'Information lifecycle management', def: 'Moves data between storage tiers based on how often it is used: hot data on the fastest media, cold data on capacity media.' },
  { term: 'LCM', full: 'Life Cycle Manager', def: 'The upgrade tool in Prism. It inventories software and firmware, picks a safe order, runs pre-checks and upgrades one node at a time while workloads keep running.' },
  { term: 'Metro Availability', def: 'Synchronous replication between two sites close enough (low round-trip latency) that every write is committed at both before it is acknowledged, for zero data loss.' },
  { term: 'NC2', full: 'Nutanix Cloud Clusters', def: 'The same Nutanix stack (AOS and AHV) running on bare-metal instances in a public cloud, managed with the same tools as on-premises clusters.' },
  { term: 'NCM', full: 'Nutanix Cloud Manager', def: 'Operations, automation, cost governance and security compliance on top of the platform. Feature availability depends on license tier.' },
  { term: 'NDB', full: 'Nutanix Database Service', def: 'Database provisioning, patching, cloning and point-in-time recovery as a service, built on AOS snapshots and log capture.' },
  { term: 'NKP', full: 'Nutanix Kubernetes Platform', def: 'Nutanix’s platform for deploying and managing fleets of Kubernetes clusters across data center, edge and cloud.' },
  { term: 'Node', def: 'One server: CPU, memory, drives and network, running a hypervisor plus a CVM.' },
  { term: 'OpLog', def: 'A fast write buffer on each CVM for bursty random writes. Writes land there, are copied to other nodes, are acknowledged, and are later drained to the extent store in large sequential chunks.' },
  { term: 'Prism Central', def: 'The management console for many clusters. It runs as one VM or a small scale-out set of VMs and hosts multi-cluster features.' },
  { term: 'Prism Element', def: 'The management interface built into every cluster. It manages that one cluster.' },
  { term: 'Rack awareness', def: 'Keeps copies of data in different racks so losing a whole rack (power or top-of-rack switch) does not lose data.' },
  { term: 'RF', full: 'Replication factor', def: 'How many full copies of data the cluster keeps. RF2 keeps two copies on different nodes and survives one failure; RF3 keeps three and survives two.' },
  { term: 'RPO', full: 'Recovery point objective', def: 'The most data you can afford to lose, measured in time. An RPO of 1 hour means a recovery may lose up to the last hour of changes.' },
  { term: 'RTO', full: 'Recovery time objective', def: 'How long it may take to get an application running again after a disaster.' },
  { term: 'Stargate', def: 'The AOS service that handles all storage I/O for its node: it receives VM reads and writes, manages caches and replicates writes to other CVMs.' },
  { term: 'vDisk', def: 'A virtual disk as AOS sees it: any file over a small size that a VM or service reads and writes, such as a VM’s disk.' },
  { term: 'Witness', def: 'A small VM at a third location that arbitrates when two sites (or a two-node cluster’s nodes) lose contact, so the right side keeps running automatically.' },
  { term: 'Zookeeper', def: 'Stores the cluster’s configuration. It runs on 3 nodes (5 at redundancy factor 3) and needs a majority of them up to operate.' },
];

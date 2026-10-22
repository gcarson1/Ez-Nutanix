# Facts register

This is the register required by MASTER_PROMPT Section 11. Each rule the engine enforces (`src/engine/rules.ts`, `capacity.ts`, `failures.ts`) cites an ID from this file.

**Date checked:** 2026-10-16 for every row.

**Decisions:**
- **keep**: the app's current value or wording is supported by the sources.
- **changed**: the sources contradict the app, and the correct value is listed in "Changes needed in the app" at the end.
- **leave out**: no source supports the claim, so it should not ship.
- **unverified**: the claim is plausible but has only weak or dated support. It may ship only with an "Unverified" tag in the dev build.

**Source limits:** the portal.nutanix.com documentation pages couldn't be read from this session. They are a JavaScript app, and the fetch tool gets back only an empty shell. Direct HTTPS was refused by the proxy. So the primary sources here are:
- the Nutanix Bible (nutanixbible.com, now "based on AOS 7.5 / PC 7.5"),
- nutanix.com blogs and solution briefs,
- next.nutanix.com posts by Nutanix employees.

Where a portal page exists for a topic, its URL is listed so someone can confirm it in a browser. Third-party sources are named as such and never used alone to support a "keep". The earlier notes C and E did read portal pages, so their findings are linked rather than repeated.

---

## 1. Rules the engine encodes

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| RF-1 | `MIN_NODES`: RF2 needs at least 3 nodes and RF3 at least 5. | The Bible's awareness table gives the node minimums as 3 for FT1 (RF2) and 5 for FT2 (RF3) without EC. It explains the RF3 minimum: "a minimum of 5 nodes is required since metadata will be RF5". A Nutanix employee's post gives the same 3 and 5. The minimum is set by the cluster redundancy factor (FT). Container RF is a separate setting, and an FT2 cluster can hold both RF2 and RF3 containers. | [Bible: Data resilience][b-res]; [Redundancy vs replication factor (Nutanix employee, 2020)][n-rfrf] | 2026-10-16 | keep |
| RF-2 | `METADATA_COPIES` and `ZK_NODES`: 3 under RF2 and 5 under RF3. | FT1 means metadata RF3 and FT2 means metadata RF5 (Bible). The employee post says an RF2 cluster "keeps 3 copies of metadata (Cassandra) and Zookeeper", and RF3 keeps 5 copies of metadata and Zookeeper. The Bible's example shows 3 Zookeeper nodes on an FT1 cluster. **Exception the code should reflect:** a **2-node cluster keeps metadata at RF4** on SSDs across both nodes, while data stays RF2. | [Bible: Data resilience][b-res]; [Redundancy vs replication factor][n-rfrf]; [Two-node clusters (Nutanix employee, 2021)][n-2node] | 2026-10-16 | keep (3/5). Add the 2-node RF4 note |
| RF-3 | Container RF and cluster redundancy factor are different settings (spec 7.4). | Confirmed. Redundancy factor is cluster-wide, replication factor is per container, and an FT2 cluster can host RF2 and RF3 containers. AOS 6.6 also added per-VM RF through storage policies. | [Redundancy vs replication factor][n-rfrf]; [AOS 6.6 blog][aos66] | 2026-10-16 | keep |
| EC-1 | `EC_MIN_NODES`: EC-X needs at least 4 nodes on RF2 and 6 on RF3. | The Bible's awareness table gives 4 nodes for FT1 with EC and 6 for FT2 with EC. Its strip table starts FT2 strips at 6 nodes and shows N/A at 4 and 5. A Nutanix employee post (2020) also says "at least four nodes". | [Bible: Data resilience][b-res]; [Bible: Data efficiency][b-eff]; [Erasure Coding (Nutanix employee, 2020)][n-ec] | 2026-10-16 | keep |
| EC-2 | `ecStrip()`. RF2: 4 nodes 2/1, 5 nodes 3/1, 6+ nodes 4/1. RF3: 6 nodes 2/2, 7 nodes 3/2, 8+ nodes 4/2. | This matches the Bible's table exactly. The overheads are 1.5x, 1.33x and 1.25x for FT1, and 2x, 1.6x and 1.5x for FT2. The Bible also advises having at least one more node (or block) than the strip width so a strip can rebuild after a failure. For example, 4/1 wants 6 nodes. The code's `nodes < data+parity+1` advisory matches this. The employee post says to "avoid strips greater than (4, 1)" because the savings shrink and rebuilds cost more. | [Bible: Data efficiency][b-eff]; [Erasure Coding][n-ec] | 2026-10-16 | keep |
| EC-3 | EC-X encodes only write-cold data, after the fact (code and spec). | Confirmed as the default behavior. The AOS 6.6 blog says "historically only data that has been detected as 'write-cold' would be erasure coded". Exceptions: **inline EC** exists for Nutanix Objects (AOS 6.6), and there is an "Inline Erasure Coding" option documented in Prism 6.10. | [AOS 6.6 blog][aos66]; [Prism 6.10: Inline EC (portal, not readable here)][p-inline-ec] | 2026-10-16 | keep. Add an honest-fit line that inline EC exists for Objects and as an option |
| EC-4 | Write-cold window default (Section 11 item 2). | The Bible doesn't give a number. It says data qualifies when it hasn't "been written to for awhile", controlled by the Gflag `curator_erasure_code_threshold_seconds`. A Nutanix employee post (2020) gives the default: "the erasure coding window, which by default is 7 days". There's no current portal confirmation. | [Bible: Data efficiency][b-eff]; [Data resiliency efficiently: EC (Nutanix employee)][n-ec2]; [Erasure Coding][n-ec] | 2026-10-16 | unverified. Say "about a week by default (tunable)" with the tag, or say "data not overwritten recently" |
| EC-5 | "Flexible strip sizes and newer encoding behavior exist in current releases" (spec 10). | The only current, specific statement found is in the Bible: from AOS 7.3, **dedicated Nutanix Unified Storage clusters can use strips up to 12/2**. For standard clusters, the table still tops out at 4/1 and 4/2. The Bible also says placement follows read temperature: cold strips spread a vDisk's blocks across nodes, and hot strips are recomputed and localized. No source names a "flexible strip" feature. | [Bible: Data efficiency][b-eff] | 2026-10-16 | changed. Drop "flexible strip" and, if needed, say "dedicated storage clusters (AOS 7.3+) can use wider strips, up to 12/2" |
| FD-1 | `MIN_BLOCKS`: block awareness needs 3 blocks under RF2 and 5 under RF3. | Correct **without EC-X**. The Bible says "a minimum of 3 blocks must be utilized for block awareness to be activated, otherwise node awareness will be used". Its awareness table gives block minimums of **3 for FT1, 4 for FT1 with EC, 5 for FT2 and 6 for FT2 with EC**. EC block awareness needs (k+n)+1 blocks for the strip. The code ignores EC when checking block minimums. | [Bible: Data resilience][b-res]; [Bible: Data efficiency][b-eff] | 2026-10-16 | changed (EC case) |
| FD-2 | `MIN_RACKS`: rack awareness needs 3 racks under RF2 and 5 under RF3. | The Bible's block/rack table gives the same minimums for racks (3, 4 with EC, 5, 6 with EC). Racks must be defined by the administrator ("Rack awareness requires the administrator to define racks"). A Nutanix employee post: rack fault tolerance "has to be configured manually", and VMs keep running through the loss of one rack (RF2) or two (RF3). Which hypervisors and AOS versions support rack awareness wasn't confirmed: the portal pages are unreadable. | [Bible: Data resilience][b-res]; [Fault domains and rack awareness (Nutanix employee, 2020)][n-rack] | 2026-10-16 | keep (3/5). Changed for EC (4/6). Hypervisor scope unverified |
| FD-3 | (Not in code yet.) Metadata block awareness has extra sizing rules. | With FT1, besides having 3 or more blocks, "the remaining blocks should have at least 2X nodes", where X is the node count of the largest block. With FT2 it is 5 or more blocks and 4X. Uneven layouts, such as a partly filled last block, can fail this even when the block count is enough. | [Bible: Data resilience][b-res] | 2026-10-16 | keep (add as an advisory if the layout allows uneven blocks) |
| CAP-1 | EC overhead = (data+parity)/data. Blended overhead = cold% × EC + (1−cold%) × RF. | The formula matches the Bible's overhead column (4/1 = 1.25x, 4/2 = 1.5x). The blended model is the app's own simplification, honest because EC only touches write-cold data (EC-3). | [Bible: Data efficiency][b-eff] | 2026-10-16 | keep (label the blend illustrative) |
| CAP-2 | "Assume only 50–80% of the theoretical EC saving" (spec 10). | No Nutanix source found for that range. The employee post only says gains shrink and depend on how often data is overwritten. | [Erasure Coding][n-ec] | 2026-10-16 | leave out the 50–80% figure. The cold-% slider already covers the point |
| CAP-3 | `recommendedReserve()`: <br>- RF2: N+1. <br>- RF2 above 24 nodes: N+2. <br>- RF3: N+2. <br>- Block aware: one block's nodes × (RF−1). | Josh Odgers (then at Nutanix; his blog, not official docs) says: <br>- "If you're using RF2, size for N+1 as a minimum". <br>- "For cluster sizes above 24, I recommend N+2 even if RF2 is used". <br>- "If you're using RF3, size for N+2 as a minimum". <br>- With block awareness, an RF2 block loss needs up to a block's worth of nodes (N+4 at 4 nodes per block). RF3 needs "N+4 when using two nodes per block, and N+8 when using four nodes per block". <br>- RF3 needs **7 nodes** to self-heal from a double node failure (6 for one). <br>The code's `nodesPerBlock × (rf−1)` gives exactly N+4 and N+8. Prism's own "rebuild capacity available" indicator is the in-product check. | [Odgers: Sizing for resiliency][odgers-size]; [Bible: Data resilience][b-res] | 2026-10-16 | keep, worded as "common sizing guidance", not a product rule. Optionally add the 6/7-node RF3 self-heal note |
| EDGE-1 | 1-node cluster (`edgeAdvisory(1)`): <br>- no node-level redundancy <br>- "data is protected across the node's drives" <br>- an outage means downtime <br>- used at small edge sites with backup or replication elsewhere | A Nutanix employee post (2021) positions single-node for ROBO and low cost, "accept lowered resiliency". It recommends backups for node failure. Its limits: <br>- async DR at a **6-hour RPO only** <br>- no firmware via LCM <br>- all user VMs powered off for upgrades <br>- an SSD failure makes the cluster read-only <br>- an HDD failure is rebuilt like a normal cluster if there is capacity, which implies copies sit on separate drives. <br>No source found states "RF2 across drives" in so many words. Note C has the LCM side. | [Conditions for single node cluster (Nutanix employee, 2021)][n-1node]; [note C][C] | 2026-10-16 | keep the advisory, but replace "Data is protected across the node's drives" with "Data copies are kept on different drives in the node, so a drive failure can be rebuilt (an SSD failure can make it read-only)", or tag it unverified |
| EDGE-2 | 2-node cluster "requires a Witness at a separate site to arbitrate". | A Witness VM in a separate failure domain gives the 2-node cluster automatic failover. Nutanix employee posts call it "highly recommended". Per note C (portal, LCM 3.4 and Prism 7.6), **every maintenance workflow, LCM included, requires a registered Witness**. Data is RF2 across the two nodes, and metadata is RF4. Witness latency must be ≤500 ms (third-party summary of the Prism guide, not confirmed on the portal here). | [Two-node clusters][n-2node]; [Monitoring a two-node cluster (Nutanix employee, 2020)][n-2node-mon]; [note C][C]; [Cloud Whales (third party)][cw-2node]; [Prism 6.10: two-node failure and recovery (portal, unreadable)][p-2node] | 2026-10-16 | keep (wording: "uses a Witness... required for upgrades and maintenance") |
| EDGE-3 | 2-node after one node fails (`edgeAdvisory(2)`): "the survivor keeps running workloads **with a single data copy** until the pair is healthy again". | **Contradicted.** After a failure, the surviving node goes to single-node (stand-alone) mode, "the failed node is detached from the metadata ring, and auto rebuild begins" (Nutanix employee). A third-party summary of the guide says data is made RF2 again **across the surviving node's disks** ("RF2 is still retained at the disk level"). The switch takes 30–60 s (note C). When the peer returns, the cluster waits for 15 minutes of continuous heartbeat before it starts resyncing back to two-node mode, which can take hours. | [Monitoring a two-node cluster][n-2node-mon]; [Two-node clusters][n-2node]; [Cloud Whales (third party)][cw-2node]; [note C][C] | 2026-10-16 | changed |

## 2. Section 11 items 1–6 and 15

| ID | Claim | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| DP-1 (item 1) | Sequential writes skip the OpLog above about 1.5 MB of outstanding write I/O per vDisk. | The current Bible (AOS 7.5 era) still says: "Write IO is deemed as sequential when there is more than 1.5MB of outstanding write IO to a vDisk". The Gflag is `vdisk_distributed_oplog_skip_min_outstanding_write_bytes`, so it is tunable. Bypassing the OpLog does not lower RF. | [Bible: Data I/O path][b-io] | 2026-10-16 | keep ("about 1.5 MB, tunable; per Nutanix Bible") |
| DP-2 | OpLog writes are copied synchronously to 1 (RF2) or 2 (RF3) remote CVMs before the ack. | The Bible's resilience chapter says writes are "synchronously replicated to another one or two Nutanix CVM's OpLog (dependent on RF)" before they are acknowledged. | [Bible: Data resilience][b-res]; [Bible: Data I/O path][b-io] | 2026-10-16 | keep |
| EC-2/EC-4/EC-5 (item 2) | RF3 EC table, flexible strips, write-cold window. | See EC-2 (RF3 table confirmed: 6 nodes 2/2, 7 nodes 3/2, 8+ nodes 4/2), EC-4 (7 days, unverified) and EC-5 (flexible strip: changed). | as above | 2026-10-16 | see rows |
| FD-1/FD-2/FD-3 (item 3) | Block and rack minimums, with EC-X. | See FD rows. **With EC-X: 4 blocks/racks (RF2) and 6 (RF3).** | as above | 2026-10-16 | changed (EC) |
| RF-2 (item 4) | Metadata and Zookeeper copies, 3 vs 5. | See RF-2. Confirmed, plus RF4 metadata on 2-node clusters. | as above | 2026-10-16 | keep |
| HA-3 (item 5) | "CVM failure: autopathing redirects I/O to remote CVMs" (spec 7.5 and 10). | **The term depends on the hypervisor.** "ESXi and Hyper-V handle this via a process called CVM Autopathing" (HA.py reroutes traffic to a remote CVM). **AHV** uses iSCSI multipathing through an **iSCSI redirector** on each host. The local CVM is the primary path, with remote Stargates as backups. When the local Stargate stops answering NOPs, the redirector sends the next login to a healthy remote Stargate. When the local one recovers, sessions move back. Either way the VMs keep running with no restart, and I/O goes remote with some extra latency. Note C finds the same thing. | [Bible: Data resilience][b-res]; [Bible: AHV how it works][b-ahv]; [note C][C] | 2026-10-16 | changed (wording) |
| HA-1 (item 6) | AHV HA is best effort by default. | Confirmed. The default mode "requires no configuration and is included by default", and VMs restart if resources allow. Nutanix lab material calls it "best effort basis". | [Bible: AHV how it works][b-ahv]; [Nutanix bootcamp lab][lab-ha] | 2026-10-16 | keep |
| HA-2 (item 6) | Turning on HA reservation guarantees restarts, with a configurable number of host failures. The code `haReserveAllowed` checks **one** host failure. | The Bible's "Guarantee" mode "reserves space throughout the AHV hosts in the cluster to guarantee that all failed VMs can restart". It is segment-based since AOS 5.0. **The amount depends on RF:** "One host worth of resources" if all containers are RF2, and **"Two hosts worth of resources" if any container is RF3**. It sizes by the largest host's memory. The UI shows how many host failures can be tolerated. The exact current Prism 7.6 label ("Enable HA Reservation" or similar) wasn't confirmed because the portal is unreadable. | [Bible: AHV how it works][b-ahv]; [Nutanix bootcamp lab][lab-ha] | 2026-10-16 | changed (RF3 should reserve two hosts). Label text unverified |
| CVM-1 (item 15) | CVM default footprint. The code uses `cvmMemGB: 32`. | No current official default could be read (portal pages "Prism 7.6: CVM Memory Configuration" and "Foundation 5.x: CVM vCPU and vRAM Allocation" exist but are unreadable here). Older Nutanix-employee posts: <br>- the installer sets CVM vCPUs equal to the cores of one socket <br>- the memory floor was about 24 GB from AOS 5.0 <br>- "32GB is a pretty solid recommendation" (2017–18) <br>- the Unified Cache is sized from CVM memory as (CVM memory − 12 GB) × 0.45 (Bible) <br>- memory grows with features (dedupe, RF3, DR). <br>The Nutanix Sizer wiki lists 20–32 GB by profile plus add-ons, capped at 32 GB (undated). | [Bible: Data I/O path][b-io]; [CVM resources allocation (Nutanix employee, 2017–18)][n-cvm]; [Sizer wiki][sizer]; [Prism 7.6 CVM memory (portal, unreadable)][p-cvm]; [Foundation 5.0 CVM allocation (portal, unreadable)][p-found] | 2026-10-16 | unverified. Keep 32 GB only as an adjustable example ("typical starting point; grows with features"), never as "the default" |

## 3. Timing values in `src/engine/failures.ts` (`TIMING`)

| ID | Code value | Documented value | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| TIM-1 | `haDetectS: 40`: heartbeat loss before AHV HA restarts VMs. | The Bible gives a timeline. The Acropolis leader polls each host's libvirtd every second. After a host becomes unreachable, at about T+20 s the leader "starts a 40-second timeout", and "VMs should be restarted within 120 seconds" (all VMs restarted at T+120). So restarts begin about **60 s** after the failure (20 + 40), and the target is all restarted by about **120 s**. With a network partition, VMs on the isolated host fail 45 s after their first I/O failure. | [Bible: AHV how it works][b-ahv] | 2026-10-16 | changed: about 60 s before restarts start. Restarts should finish by about 120 s |
| TIM-2 | `rebuildDelayS: 60`: how long a node/CVM must be unreachable before re-protection starts. | For unplanned failures the Bible says the rebuild begins "**immediately**", and that a disk failure triggers a Curator scan "immediately". A Nutanix employee answered a question about a "60 seconds" figure directly: "No that's not true about the 60 seconds things... it will start immediately". | [Bible: Data resilience][b-res]; [Node failure question (Nutanix employee, 2021)][n-nodefail] | 2026-10-16 | changed: start at once (keep only a few seconds for detection, labeled illustrative) |
| TIM-3 | `detachS: 1800` (30 min): CVM removed from the metadata ring. | Matches the Bible: if the node "remains down for a prolonged period of time (30 minutes)", the CVM is removed from the metadata ring. It rejoins once "up and stable for a duration of time", with no number given. | [Bible: Data resilience][b-res] | 2026-10-16 | keep |
| TIM-4 | `resyncS: 120`, `vmBootS: 45`, `haStaggerS: 6` | Nutanix documents none of these, and they depend on the workload. For 2-node clusters, the return path waits for 15 minutes of continuous heartbeat before resync, and the resync can take hours (see EDGE-3). | [Monitoring a two-node cluster][n-2node-mon] | 2026-10-16 | keep, labeled "illustrative" (already done in the code comment) |
| TIM-5 | Disk marked offline. | Not in the code, but useful: Stargate marks a disk offline on I/O errors or a response timeout. A disk taken offline 3 times in an hour stays offline. | [Bible: Data resilience][b-res] | 2026-10-16 | keep (optional detail) |

## 4. DR and Flow (items 8 and 9, brief)

| ID | Claim | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| DR-1 | Async RPO of 60 min or more. | The Nutanix DR blog (Sept 2024) says "intervals of 1 hour and above". The BC/DR solution brief says async "supports RPOs ranging from 1 hour to 24 hours". Single-node clusters support only a 6-hour async RPO. | [Nutanix blog: resilient mission-critical apps (2024)][blog-dr]; [BC/DR solution brief][sb-dr]; [Single node conditions][n-1node] | 2026-10-16 | keep (optionally "1 to 24 hours") |
| DR-2 | NearSync RPO from 1 to 15 min. | Confirmed: "intervals ranging from 1 to 15 minutes" (blog) and "1-15 minute RPO" (brief). The Bible says NearSync applies when the snapshot frequency is ≤15 min. Community posts say NearSync needs SSDs of 1.2 TB or more. | [blog][blog-dr]; [brief][sb-dr]; [Bible: Backup and DR][b-dr] | 2026-10-16 | keep |
| DR-3 | Sync/Metro: RPO 0, needs round-trip latency under 5 ms. | Confirmed. Synchronous replication is "designed to operate between sites with latency under 5 ms". Sync gives "0 second RPO". Metro Availability adds automated failover on top of sync. | [blog][blog-dr]; [brief][sb-dr] | 2026-10-16 | keep |
| DR-4 | A Witness enables automatic failover for synchronous setups. | Confirmed. The Witness Service runs in a separate fault domain (blog). It has been available since AOS 5.0 for Metro (Bible). Without a Witness, failover is manual. AHV Metro with the Witness Service needs Prism Central pc.2024.3+ and AOS 7.0+ on the cluster that hosts the Witness VM (DR guide text quoted in a community thread). Metro on ESXi/Hyper-V is the protection-domain (PE) flavor. AHV Metro is the Prism Central DR flavor. | [blog][blog-dr]; [Bible: Backup and DR][b-dr]; [Community thread quoting DR guide (2026)][n-metro-ahv]; [PD-based DR 7.6 Metro (ESXi/Hyper-V) (portal)][p-pd-metro]; [AHV Metro (portal)][p-ahv-metro] | 2026-10-16 | keep. Hypervisor and version detail unverified on the portal |
| DR-5 | Topologies: A–B sync, A–C near-sync (~20 s RPO), A–D async (~30 min RPO); vStore 20 s on ESXi. | Nutanix supports many-to-many, mesh and multi-site designs (Bible). The 2024 blog's worked example is sync A–B at 0 RPO plus async to a fourth site at 1 h. **No source found for the ~20 s near-sync or ~30 min async figures**, and 20 s is below the documented 1-minute NearSync floor. DR also works between ESXi and AHV clusters (brief). | [Bible: Backup and DR][b-dr]; [blog][blog-dr]; [brief][sb-dr] | 2026-10-16 | keep the topology. **Leave out** the 20 s and 30 min numbers and the vStore 20 s claim |
| FLOW-1 | Flow Network Security policy types: application, isolation, quarantine. Modes: monitor and enforce. | The Bible (PC/AOS 7.5) lists five types: **Application, Isolation, Quarantine** (Strict or Forensic), **Shared Services** and **VDI** (based on AD groups). Its modes are **Saved, Monitoring and Enforced**: Monitoring allows everything and logs what would be blocked. Policies use categories (key:value) plus entity, address and service groups. It describes itself as "an agentless, stateful, distributed firewall" in the hypervisor (AHV). It can secure VPCs. | [Bible: Flow Network Security][b-fns] | 2026-10-16 | keep, and add Shared Services, VDI and the Saved state if types or modes are listed |
| FLOW-2 | Overlay encapsulation. | Overlay subnets use **Geneve**. VTEP gateways use **VXLAN** to stretch layer 2 to external sites. | [Bible: Flow Virtual Networking][b-fvn] | 2026-10-16 | keep (Geneve) |
| FLOW-3 | Control plane is separate from forwarding (Flow controller vs AHV hosts and gateways). | The **Network Controller** in Prism Central (OVN-based, integrated by default, or a standalone Flow controller) runs the control plane. Each AHV host forwards traffic, with the VPC router implemented as an OVS logical router on every node. | [Bible: Flow Virtual Networking][b-fvn] | 2026-10-16 | keep |
| FLOW-4 | Gateways, routing, VPN. | Stateful services run in **Network Gateway VMs**: <br>- a **VPN Gateway** (IPsec, policy-based or route-based) <br>- a **VTEP Gateway** (VyOS-based, VXLAN) <br>- a **BGP Gateway** (control plane only, so forwarding stays on hosts). <br>External networks are **NAT** (SNAT and floating IPs) or **routed NoNAT**. Routes are static per VPC or learned through BGP. | [Bible: Flow Virtual Networking][b-fvn] | 2026-10-16 | keep |

## 5. Items covered by earlier research notes (7, 10–14)

Not redone here. Summary only. The full rows and sources are in the linked notes.

- **Item 7, LCM** ([C-lcm-networking.md][C]): current versions are LCM 3.4, AOS 7.6, AHV 11.2 and pc.7.6. Since 7.5, AHV is a separate LCM update. The order is framework update, then pre-checks, then dependency ordering, then one node at a time, moving to the next node only when Data Resiliency is Normal. There is no automatic rollback. Pre-check names were updated: for example, test_nutanix_partition_space and test_check_url_connectivity. **1-node:** AOS and AHV upgrades need all guest VMs shut down, and LCM does no firmware. **2-node:** a registered Witness is required, and upgrades take longer. Firmware reboots 2–3 times in the Phoenix environment. Inspur is dropped from the vendor list, and NKE is incompatible with pc.7.5+. On AHV, AOS-upgrade I/O redirection is the iSCSI redirector, not "autopathing". Per-node durations are unofficial (about 15 min AOS, 25+ min AHV). AHV networking fixes are also there: balance-slb is no longer recommended, LACP fallback is not a bond mode, and the OVS rebalance default is 10 s.
- **Item 10, NC2** ([E-platform-services.md][E]): GA on AWS, Azure, **Google Cloud (GA Dec 9, 2025)** and OVHcloud. GC2 (Government Cloud Clusters) is GA on AWS GovCloud (US) and, since Jul 28, 2026, on the AWS European Sovereign Cloud, starting with Germany ([GC2 on AWS ESC][gc2-esc]). Region presence does not guarantee every bare-metal type or feature.
- **Item 11, NDB:** NDB 2.11 (July 2026). Add EDB Postgres to the engine list.
- **Item 12, Cloud Native AOS:** GA only on Amazon EKS (1.0.0, July 2025). Bare metal is future work, tied to NKP Metal. Project Beacon was a 2023 vision whose outcome is CN-AOS plus NDK, not a product.
- **Item 13, Data Lens and AI:** Data Lens 2.0 on-prem (including air-gapped) GA in Apr 2026, and On-Prem 2.1 added Objects. NAI is at 2.8. "Nutanix Agentic AI" is a full-stack solution targeted for 2H 2026. GPT-in-a-Box is a legacy name.
- **Item 14, Fleet, NCM, Federation:** "Prism Federation" is not a Nutanix product name. The capability is Nutanix Central (SaaS and on-prem; up to 25 Prism domains at the Dec 2025 on-prem GA). NCM 2.0 (GA Apr 2026) runs on Nutanix Central On-Prem, which "is now required for all NCM 2.x Deployments"; NCM 2.1 (GA Aug 13, 2026) adds a 3-node Small form factor for about 2,500 VMs, next to the Medium form factor for about 10,000 ([NCM 2.1][ncm21]; [NCM 2.x][ncm2x]). Self-Service and Cost Governance start at Pro, and Security Compliance is Ultimate only.


## 6. NCM Cost: how overspend is caught and prevented

The Cost tab shows dev-test running hot and NCM bringing it back under budget. Each mechanism it names is checked here. Rates, usage, the budget, the alert threshold and the savings are made-up examples and are labeled illustrative in the app.

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| COST-1 | Cost Governance keeps a budget per team or project and sends its owner an automated overspend alert. | The datasheet: "Establish precise cost center budgets with automated overspend alerts to proactively identify and control excess spending". The Bible: budgets "define expected or approved spend for a cost center" and "track actual cost against the configured budget", and its workflow includes "Create budgets and alerts". Budgets attach to cost centers, which can map to a team or project. | [Cost Governance datasheet][ds-cg]; [Bible: Cost Governance][b-cg] | 2026-10-16 | keep |
| COST-2 | The alert fires when spend passes 50% of the budget. | No documented default threshold found. The sources say only "automated overspend alerts" and "Create budgets and alerts". | [ds-cg]; [b-cg] | 2026-10-16 | unverified. Shown as this example's threshold, inside the illustrative note |
| COST-3 | Cost Governance lists idle and oversized VMs, and the owner stops or right-sizes them. | The datasheet: "Savings recommendations for idle and underutilized resources" and "identifying candidates for rightsizing or termination based on configurable cost policies". The Bible's recommendation types include "Idle virtual machines", "Oversized virtual machines" and "Unused or underutilized resources". The app has the owner act on them; it does not claim they are applied automatically. | [ds-cg]; [b-cg]; [Cost Governance test drive blog][blog-cg] | 2026-10-16 | keep |
| COST-4 | Use is metered daily at the rates you set, and Cost Governance runs on-premises in NCM 2.0. | The Bible's User Defined Metering lets admins "define their own unit-based rates for resources such as CPU, memory, and storage". The product page: "Define unit rates for metering customer infrastructure" and "Cost Governance now operates exclusively within your existing on-premises data center infrastructure". The daily cadence is the animation's step, not a documented interval. | [b-cg]; [Cost Governance page][pg-cg]; [note E][E] row 2c | 2026-10-16 | keep (rates, on-prem). Daily step is illustrative |
| COST-5 | A Self-Service project quota caps the CPU, memory and storage a project can deploy. | The Projects blog: "Set customizable limits on resources like CPU, memory, and storage per" project, "to manage and cap consumption within defined boundaries", and "help avoid overconsumption". The Bible: projects define "quotas" and get "Policies and quotas via the NCM Self-Service Policy Engine". Neither says in so many words what happens to a request over quota. The Prism quota policy pages on the portal couldn't be read. | [Projects blog][blog-proj]; [Bible: Self-Service][b-ss] | 2026-10-16 | keep (the cap). The Self-Service tab's "sent back with the reason" wording stays unverified on the portal |
| COST-6 | Approval policies hold large requests for sign-off, scheduler policies stop dev-test apps at set times, and both need NCM Ultimate. | The Bible: "Approval policies allow administrators to require approval before certain actions are performed" and "Scheduler policies allow administrators to define when certain actions should occur", for example "an application may be scheduled to start or stop at specific times". Ultimate adds "governance (approvals and scheduler)" ([note E][E] row 2b). Nights and weekends are this example's schedule. | [b-ss]; [E] | 2026-10-16 | keep |
| COST-7 | A budget by itself doesn't switch resources off (presenter Q&A). | Neither the datasheet nor the Bible describes a budget action that stops or blocks resources. The datasheet's "schedule-based automated actions" and Playbooks aren't tied to budgets there. This rests on absence of evidence, so the Q&A says "as far as the published material says". | [ds-cg]; [b-cg] | 2026-10-16 | unverified (worded as such) |

## 7. Nutanix with external storage

The "Don’t want the full stack?" module’s first tab (`src/ui/modules/partial/ext.tsx`). Node, VM and volume counts are an example and carry the illustrative note. Pure Storage renamed itself Everpure in February 2026, and Nutanix pages now say "Everpure FlashArray".

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| EXT-1 | Generally available arrays: Dell PowerFlex (April 2025), Everpure FlashArray (December 2025) and Dell PowerStore (NCI 7.6, July 2026). | PowerFlex: "The first supported solution at launch is the Nutanix Cloud Platform with Dell PowerFlex" (Apr 30, 2025). FlashArray: "We’re pleased to announce the general availability" (Dec 10, 2025). PowerStore: "With NCI 7.6, general support for Dell PowerStore is now available", "Generations 1, 2 and 3" (Jul 28, 2026). | [ext-launch]; [ext-fa-ga]; [ext-ps-76] | 2026-10-16 | keep |
| EXT-2 | NetApp ONTAP isn’t generally available yet (presenter Q&A). | The April 2026 press release: "will be available later this year", over NFS, for AFF A-series and select FAS systems. The Sep 29, 2026 blog still says "Planned for availability this Fall with an upcoming Nutanix Cloud Infrastructure release". A search found no GA announcement since. | [ext-netapp-pr]; [ext-netapp-blog] | 2026-10-16 | keep, as not GA. Recheck before each customer session |
| EXT-3 | FlashArray and PowerStore connect over NVMe/TCP on standard Ethernet; PowerFlex uses Dell’s own client (SDC), which runs in the CVM. | The Bible: Everpure and PowerStore "both use NVMe/TCP protocol"; PowerFlex "uses a proprietary Dell protocol that uses Dell Storage Data Client (SDC) in CVM". The tech blog: "NVMe/TCP over standard Ethernet". PC 7.6: "Add Dell PowerStore support for external storage over NVMe/TCP". | [b-ext]; [ext-tech]; [pc76] | 2026-10-16 | keep |
| EXT-4 | Compute-only nodes run AHV, with a boot drive and no data drives, and a CVM on each node handles every I/O. | The Bible: "Foundation installs AHV and AOS on the boot device", and Stargate runs as "a user-space NVMe initiator in the CVM". Cisco’s compute-only datasheet: "Nutanix Acropolis Hypervisor (AHV) only". Dell installs AHV and AOS on BOSS boot cards. "No data drives" is my reading of "compute-only" plus the boot device; no page says it in those words. | [b-ext]; Cisco C220 M8 compute-only datasheet; Dell PowerFlex with NCP manual | 2026-10-16 | keep |
| EXT-5 | Each VM disk is its own volume on the array, with no shared datastore. | The Bible: "There is a direct 1:1 mapping between a VM vdisk and volume on external storage". The FlashArray GA blog: "Each Nutanix VM is hosted by a FlashArray volume, providing per-VM granularity". | [b-ext]; [ext-fa-ga] | 2026-10-16 | keep |
| EXT-6 | Nutanix takes snapshots and clones through the array’s own APIs, per disk, and drives replication for DR. | The Bible: Nutanix "uses the external storage vendor’s snapshot and clone APIs to take on-disk storage snapshots and clones", and "the entire orchestration and replication is driven by the Nutanix control plane". The NCI-C datasheet: "delegating snapshot and clone operations to storage partners". The FlashArray blog: "apply array services like snapshots and QoS at the virtual disk level". | [b-ext]; [ds-ncic]; [ext-fa-ga] | 2026-10-16 | keep |
| EXT-7 | Add a compute node without changing the array, and grow the array on its own schedule. | The tech blog: "independent scaling of compute and storage resources". The FlashArray solution brief: it "does not require synchronized compute and storage purchases or tightly coupled refresh cycles". | [ext-tech]; [sb-fa] | 2026-10-16 | keep |
| EXT-8 | Keep the array you already own and move VMs off vSphere onto AHV, instead of a forklift upgrade (value card). | The migration guide: "modernize your compute layer while preserving your existing storage investments" and "Avoid forklift upgrades", with Nutanix Move for the VMs. The Sep 2026 blog: NCI "can help separate the virtualization layer from the underlying storage infrastructure". These are Nutanix’s own positioning, so the app presents them as why customers choose it. | [ext-mig]; [ext-netapp-blog] | 2026-10-16 | keep |
| EXT-9 | No Fibre Channel fabric to run. | NVMe/TCP runs over Ethernet ([ext-tech]). Nutanix also says "Ethernet NICs, switches, and optics are broadly cheaper and more flexible than FC HBAs and directors", and warns that NVMe/TCP "requires careful Ethernet design". The tech blog recommends 25 GbE and an MTU of 9,000. The app doesn’t claim a cost saving. | [ext-tech]; [ext-fc] | 2026-10-16 | keep |
| EXT-10 | Prism Central runs VMs, networks, Flow security and DR orchestration, including failover to a full Nutanix cluster; from NCI 7.6 it manages the array’s storage too. | The 2025 press release: customers keep "Flow micro-segmentation and disaster recovery orchestration". The Bible: DR runs between a compute cluster on external storage and an HCI cluster. AOS 7.6: "Manage external storage directly from Prism Central, eliminating the need to switch to Prism Element". With FlashArray, DR to NC2 is not supported (EXT-12). | [ext-pure-pr]; [b-ext]; [aos76] | 2026-10-16 | keep |
| EXT-11 | Licensed per core as NCI Compute (NCI-C). | The datasheet: "NCI-C is priced on a per-core basis", with Starter, Pro and Ultimate editions. Cisco lists a "2000 cores minimum"; no Nutanix page confirms it, so the app doesn’t show it. | [ds-ncic] | 2026-10-16 | keep. Core minimum left out |
| EXT-12 | FlashArray needs a new Nutanix cluster of 3 to 32 nodes on one FlashArray, though the array can be one you already own; AOS 7.5 and AHV 11 or later. | Everpure’s support page: "Greenfield only, Brownfield is not supported"; "Cluster minimum: 3 nodes"; "Maximum Nodes per Cluster: 32"; "a Nutanix Cluster can only connect to a single FA"; AOS "7.5.0 or later", AHV "11.0 or later". Not supported: NDB, NUS, DR to NC2, Storage Policies, MST and VDI. | [ev-fa] | 2026-10-16 | keep |
| EXT-13 | Whether PowerStore and PowerFlex also need a new cluster, their limits, and whether HCI and external-storage nodes can share a cluster. | No Nutanix or Dell page found that answers these. | — | 2026-10-16 | unverified. The app doesn’t claim them; the Q&A says to check |
| EXT-14 | Cost figures (Omdia’s 171% ROI and about 40% lower TCO; Dell’s 6:1 data reduction guarantee). | The Omdia study was commissioned by Nutanix and models a hypothetical 100-node company. Dell’s guarantee is the array vendor’s, with conditions. | Omdia report (Apr 2026); Dell PowerStore marketing | 2026-10-16 | leave out |

## 8. ESXi on Nutanix

The module’s second tab (`src/ui/modules/partial/esxi.tsx`). Host and VM counts and the conversion timing are an example and carry the illustrative note. The Nutanix compatibility matrix needs JavaScript and couldn’t be read, so the app names no ESXi versions.

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| ESX-1 | ESXi is a supported hypervisor on Nutanix, and customers can keep running vSphere. | The Bible: "Each node runs an industry-standard hypervisor (ESXi, AHV, and Hyper-V) and the Nutanix Controller VM (CVM)". The migration guide (Nov 2025): "Continue to run ESXi or use Nutanix Move to migrate to AHV" and "You can continue to run vSphere in all on-premises deployments". Nutanix also says "most are shifting to AHV". | [b-basics]; [mig-guide]; [nx-vs-vmw] | 2026-10-16 | keep |
| ESX-2 | The customer uses their own, existing VMware licenses, which come from Broadcom. | The transition page: "or leverage our platform with existing VMware licenses". No page says "bring your own license" in those words, and whether any OEM still ships VMware licenses wasn’t found. Broadcom sells vSphere as VVF or VCF subscriptions. | [nx-transition]; [vmw-eoa] | 2026-10-16 | keep (wording follows the source) |
| ESX-3 | vCenter still manages the VMs, and vMotion, HA and DRS keep working. | Nutanix’s infographic: "supports key virtualization capabilities, including vMotion, DRS, and HA" and "integrates seamlessly into your existing VMware vCenter management stack". The Bible: vCenter is registered with the Nutanix cluster. | [inf-vmw]; [b-vs-admin] | 2026-10-16 | keep |
| ESX-4 | Each host runs one CVM, and the host’s drive controller is passed straight through to it (VMDirectPath I/O). | The Bible: "In ESXi deployments, the Controller VM (CVM) runs as a VM and disks are presented using VMDirectPath I/O", with the whole PCI controller passed to the CVM. | [b-vs-arch] | 2026-10-16 | keep |
| ESX-5 | The CVMs pool every host’s drives into one datastore that ESXi mounts over NFS. | The Bible lists Stargate as "the main interface from the hypervisor (via NFS, iSCSI, or SMB)" and supports the NAS VAAI primitives ("full file clone", "fast file clone", "reserve space"), which are NFS primitives on vSphere. No page I could read says "NFS datastore" outright. | [b-vs-how] | 2026-10-16 | keep (implied by two Nutanix statements) |
| ESX-6 | There is no SAN or vSAN to run, and AOS storage comes with the Nutanix license. | The migration guide: "AOS Storage functionality is included as part of NCI and NC2. It does not have to be licensed separately." Note that VVF and VCF bundle a vSAN entitlement, which may go unused ("risk of shelfware", Nutanix blog, Dec 2023), so the app says no vSAN to *run*, not to license. | [mig-guide]; [blog-shelf] | 2026-10-16 | keep |
| ESX-7 | Prism upgrades one host at a time: VMs move off, the host and its CVM go into maintenance, and the other CVMs keep serving the data. | Nutanix (Jul 2021, staff): LCM "automates the migration of VMs, putting the host and CVM in Maintenance mode, performing the upgrade", one node at a time, and "hypervisors for other vendors have to be manually uploaded". The Bible: "hypervisor upgrades can be fully automated in a rolling manner via Prism", and when a CVM is down its host’s I/O is rerouted to other CVMs (autopathing). | [n-upg]; [b-prism]; [b-vs-how] | 2026-10-16 | keep |
| ESX-8 | The Nutanix storage stack can be upgraded on its own, without touching ESXi. | nutanix.dev: "the ability to upgrade the Nutanix storage stack without upgrading the hypervisor". | [dev-choice] | 2026-10-16 | keep |
| ESX-9 | In-place conversion to AHV runs host by host, and vCenter has to run outside the cluster. | nutanix.dev: "This is done in a host-by-host rolling fashion until the entire cluster is converted." Nutanix staff (Oct 2025): "vCenter needs to be hosted outside of the cluster due to the orchestration of the ESXi hosts that is required." How VMs move between hypervisors and the AOS 7.x prerequisites weren’t found, so the app doesn’t show either. | [dev-choice]; [n-conv] | 2026-10-16 | keep |
| ESX-10 | The storage layer stays during conversion: same CVMs, same data on the same drives. | nutanix.dev: "the distributed AOS storage stack runs independently of the compute hypervisor", and the conversion is in place. No page says "no data is copied" in those words; this is an inference from the two. | [dev-choice] | 2026-10-16 | keep (inferred) |
| ESX-11 | In-place conversion has strict prerequisites, and many teams use Move or a DR failover to a new AHV cluster instead. | Nutanix staff (Oct 2025) lists a new AHV cluster with "cross hypervisor failover" or Move as "the cleanest options". A community member: "In-place conversion is tricky and need to follow strict prerequisites." | [n-conv] | 2026-10-16 | keep |
| ESX-12 | AHV comes at no extra cost; features that need AHV, such as Flow, become available; NC2 is AHV only. | "AHV … at no additional cost" ([nx-vs-vmw]). The Flow page: "Nutanix Flow is designed specifically for the AHV hypervisor", covering Flow Virtual Networking and Flow Network Security. The migration guide: "NC2 environments can only run the AHV hypervisor." | [nx-vs-vmw]; [pg-flow]; [mig-guide] | 2026-10-16 | keep |
| ESX-13 | Replication works between ESXi and AHV clusters, so DR sites can run AHV. | nutanix.dev: "the Nutanix built-in replication works between ESXi and AHV clusters", so customers "avoid paying the ESXi hypervisor licensing and management costs for the DR clusters". | [dev-choice] | 2026-10-16 | keep |
| ESX-14 | Up to 48 hosts per cluster (vSphere 7.0, AOS 6.8). | The Bible: "Maximum cluster size: 48", noted as of vSphere 7.0 and AOS 6.8. Dated, so shown with its versions. | [b-vs-arch] | 2026-10-16 | keep |
| ESX-15 | vSphere 8 reaches end of general support in October 2027, as Nutanix states it. | The transition page: "VMware by Broadcom has announced that vSphere 8 will reach end of General Support in October 2027". No Broadcom document was found. | [nx-transition] | 2026-10-16 | keep, attributed to Nutanix |
| ESX-16 | ROI figures (IDC’s 391% three-year ROI) and the 92% AHV share of cores. | The IDC figures cover Nutanix Cloud Platform in general, not ESXi on Nutanix. The AHV share is from an investor summary. | [mig-guide]; Nutanix Q4 FY26 summary | 2026-10-16 | leave out |

## 9. Objects lifecycle tiering targets

The Unified Storage module's Objects tab (`src/ui/modules/storage/index.tsx`). The 30-day rule, the volumes and the year are an example.

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| TIER-1 | A lifecycle rule has Objects move old objects to a cheaper S3-compatible store, in your data center or a public cloud. | Nutanix: "Customers can use any S3-compatible target as a tier to Nutanix Objects" (press release, Dec 2020, and the Objects VP's 3.0 post, Oct 2020); "Tiering can be enabled on a per-bucket level as a lifecycle policy". Wasabi's setup guide (Oct 2026) adds the target as endpoint type "Other S3 Compatible", then a lifecycle rule picks "Tiering" and that endpoint. A 2021 practitioner blog says endpoints can be "any S3 compatible public cloud or on-prem solution". | [pr-obj-tier]; [n-obj30]; [wasabi-obj]; scalcia.com blog (Feb 2021, third party) | 2026-10-18 | keep |
| TIER-2 | AWS S3, Azure Blob and other S3 clouds are optional targets. | Objects 3.3 added Azure, which "builds on our tiering ability to Amazon S3 storage"; Wasabi and Impossible Cloud document Objects tiering to their clouds. | [blog-obj33]; [wasabi-obj] | 2026-10-18 | keep |
| TIER-3 | The bucket keeps the metadata of tiered objects. | The press release: "metadata is retained on-premises for easier search and retrieval". | [pr-obj-tier] | 2026-10-18 | keep |
| TIER-4 | A second Nutanix Objects store can be the tiering target. | Objects is S3-compatible, so it should qualify as an "Other S3 Compatible" endpoint, but no Nutanix page I found names Objects-to-Objects tiering. (Files Smart Tiering does list "Nutanix Objects Storage" as a target.) | [blog-mobility] | 2026-10-18 | unverified. The app says "S3-compatible store in your data center" and doesn't name Objects |
| TIER-5 | On hybrid nodes, AOS also moves object data between flash and HDD. | The Bible: "Data is moved between tiers by Intelligent Lifecycle Management (ILM) based on access patterns"; on flash plus HDD, flash is Tier 0 and HDD Tier 1. Nutanix's Sizer notes (2019) add that objects over 1.5 MiB are written straight to HDD and smaller ones to flash; that detail is dated, so the app doesn't show it. | [b-io]; [sizer-obj] | 2026-10-18 | keep (ILM). Size threshold left out |
| TIER-6 | Reading a tiered object back is slower, and from a public cloud it may cost egress. | Tiered data is served from the remote endpoint (practitioner blog above), so it crosses the network; egress charges are public-cloud pricing, not a Nutanix fee. This is my inference, not a quoted Nutanix statement. | — | 2026-10-18 | keep (inferred, worded as "may") |

## 10. Cloud Native AOS: the one message

The Cloud Native AOS module (`src/ui/modules/cnaos/`). The message: stateful Kubernetes apps get Nutanix storage and data protection on Amazon EKS with no hypervisor, and whole apps are protected and replicated for DR. The three workers, the pods and the three blocks are an example.

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| CNA-1 | AOS runs as a pod on every Kubernetes worker, with no hypervisor and no Controller VM. | Release notes: "Built to run as Kubernetes pods". Blog: it "delivers Nutanix AOS Storage as a set of microservices running inside of Kubernetes", "without the need for a hypervisor". Datasheet: "eliminating the need for a hypervisor". | [rn-cnaos10]; [blog-cnaos]; [ds-cnaos] | 2026-10-18 | keep |
| CNA-2 | On EKS, AOS pools the workers' EBS gp3 volumes; workers are i3en, i4i, m6id or m5d. | Datasheet, "Cloud Storage": "EBS GP3 with EC2 native instances". Release notes: "i3en, i4i, m6id, and m5d instance families" and "(e.g., i3en.6xlarge → 3725 GiB EBS)". | [ds-cnaos]; [rn-cnaos10] | 2026-10-18 | fix. The old widget said "EC2 instances with local NVMe" |
| CNA-3 | Every block is kept on two workers (RF2); release 1.0 runs up to 15 workers. | Release notes: "Built-in data protection with RF2 replication", "Max worker nodes per cluster: 15", "Max PVCs per node: 64". Datasheet: "Tunable Redundancy Factor: 2", "Availability Domains: Node, Rack". | [rn-cnaos10]; [ds-cnaos] | 2026-10-18 | keep |
| CNA-4 | When a worker fails, the second copies keep the volume available and Kubernetes restarts the database pod on another worker with its data. | Product page: "Mature, scale-out enterprise storage protects data from hardware failure." Restarting the pod elsewhere is ordinary Kubernetes scheduling. That the volume is served from the surviving copy is my inference from RF2; no Cloud Native AOS page walks through a worker failure. | [pg-cnaos] | 2026-10-18 | keep (inferred, marked illustrative) |
| CNA-5 | Stateful apps get Nutanix volumes, snapshots and compression in AWS. | Release notes: "Supports thin provisioning, compression, app-level snapshots, replication, and DR". | [rn-cnaos10] | 2026-10-18 | keep |
| CNA-6 | NDK snapshots the app as one unit: its Kubernetes resources and its volume data. | Product page: "replicating the full-stack application as a single entity, including the data persistence layer"; "so your Kubernetes apps can be managed as a single entity". Datasheet lists "Application Consistent Snapshots", with DR "included with Nutanix Data Services for Kubernetes". | [pg-cnaos]; [ds-cnaos] | 2026-10-18 | keep |
| CNA-7 | NDK replicates the app to another AWS region or zone, with an RPO of 1 hour or more in release 1.0. | Datasheet: "Async Replication (RPO = 1 hr or greater)"; "Multiple Site DR: 1 to 1, Across AWS regions and availability zones". Release notes: DR at "RPO ≥ 1 hour" through NDK. | [ds-cnaos]; [rn-cnaos10] | 2026-10-18 | keep |
| CNA-8 | Apps on NKP on Nutanix (AHV) in your data center can fail over to EKS. | Datasheet, "Public Cloud DR": "NKP on NCI (AHV) to AWS EKS". The press release describes DR "between availability zones, clouds and on-premises". The widget shows only the direction the datasheet names. | [ds-cnaos]; [pr-cnaos] | 2026-10-18 | keep |
| CNA-9 | A cloud database service ties the app to one cloud and is managed apart from it. | Blog: "Applications built using a PaaS data service typically can only be deployed on that vendor's public cloud", and it "needs to be managed separately to the Kubernetes application". | [blog-cnaos] | 2026-10-18 | keep (Nutanix's framing, in the presenter Q&A) |
| CNA-10 | Generally available on Amazon EKS since release 1.0.0 (July 2025); AKS and GKE aren't confirmed. | Release notes: 1.0.0 "brings the power of AOS to Amazon EKS". Datasheet: "Cloud Native AOS licenses run on AWS only for the first version." I found no AKS or GKE release. | [rn-cnaos10]; [ds-cnaos] | 2026-10-18 | keep |
| CNA-11 | Bare metal is early access through NKP Metal, with GA targeted for the second half of 2026. | NKP Metal press release (Apr 2026): customers can "use Cloud Native AOS as a purpose-built storage option for true bare-metal Kubernetes deployments"; early access for NKP Pro and Ultimate; "it will go to general availability in the second half of 2026". I found no GA announcement by 2026-10-18. | [pr-nkpm] | 2026-10-18 | keep |
| CNA-12 | Moving apps between bare metal, on-premises clusters and public clouds is planned. | Product page: "Move workloads seamlessly between on-prem, public clouds and bare metal servers*", with the footnote "*future development". | [pg-cnaos] | 2026-10-18 | keep, shown as planned |
| CNA-13 | On bare metal, AOS pools the servers' local drives and keeps two copies. | Nutanix hasn't published NKP Metal storage details. Local drives follow from bare-metal servers; the two copies follow release 1.0 on EKS. | [pr-nkpm]; [rn-cnaos10] | 2026-10-18 | keep (inferred; the caption says "as release 1.0 does on Amazon EKS") |

## 11. Documentation review pass (October 2026)

An internal documentation review asked for release and configuration caveats across the modules. These rows cover the values that changed or were added in the presenter numbers and on screen. Wording-only caveats ("target", "typical", "by release") are not listed.

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| REV-1 | NUS 5.4 (Jul 2026): Files 5.4 adds encrypted NFS; Objects 5.4 drops load balancer VMs on supported AHV setups. | "new enhancements to Nutanix Unified Storage (NUS) 5.4"; Files 5.4 adds encrypted NFS shares; Objects 5.4 is "removing load balancer VMs from supported AHV deployments". | [nus54]; [files54]; [obj54] | 2026-10-19 | keep |
| REV-2 | NUS Starter is for hybrid, backup and archive; with NCI Starter, Volumes serve in-cluster VMs only. | Software options page: NUS is "licensed per usable TiB"; "For NCI-Starter licenses, Volume Group access is only supported for VMs running within the cluster". | [sw-opt] | 2026-10-19 | keep |
| REV-3 | Data Lens On-Prem 2.1 (Aug 2026) adds Objects (5.4 or later), UBA (Pro) and granular RBAC; Starter has signatures and blocking; UBA and automated recovery are for Files. | "On-Prem now fully supports Nutanix Objects (Objects 5.4+)"; "custom roles using 28 granular operations"; Starter has "Basic ransomware signatures and file blocking". The software options page marks Behaviour Analytics and Automated Ransomware Recovery "Available for Nutanix Files only". | [dl21]; [sw-opt] | 2026-10-19 | keep. "SaaS 2026.2" not found in any Nutanix source, so not shown |
| REV-4 | NDB recovers to the second within retention, up to the last captured log; details vary by engine. | "restores to any precise second within the retention window"; sharded MongoDB restores are "forward-only". NDB 2.11 notes list engine-specific PITR, DR and TDE support. | [ndb-mongo]; [ndb211] | 2026-10-19 | keep |
| REV-5 | NAI runs on NKP or other CNCF Kubernetes (tested on EKS, AKS and GKE), is licensed by GPU memory (or vCPUs), licenses Agent Gateway separately, and serves across several nodes only in tech preview. | FAQ: "CNCF-certified … Kubernetes runtime", "tested to support" GKE, EKS and AKS. Software options: "metered by either aggregate GPU RAM … or vCPUs". NAI 2.8 notes: "License Agent Gateway capabilities separately"; multi-GPU-node serving is "a new tech preview". | [nai-faq]; [sw-opt]; [nai28] | 2026-10-19 | keep |
| REV-6 | NKP 2.18 is the newest posted release; 2.19 was announced in August 2026 and not yet posted. EKS and AKS management needs a separate NKP Cloud Kubernetes SKU. | Press release (Aug 26, 2026): "NKP 2.19 will be available soon." No 2.19 post on product-updates by 2026-10-19. Software options: "A separate 'NKP Cloud Kubernetes' SKU is available for managing Amazon EKS or Azure AKS clusters". | [pr-nai28]; [sw-opt] | 2026-10-19 | keep 2.18. The reviewer's "update to 2.19" is early |
| REV-7 | Flow Network Security Next-Gen 7.6 comes with AOS 7.6 and pc.7.6 and adds rule-centric and FQDN-based policies. | "Install automatically with AOS 7.6 and Prism Central pc.7.6"; "new rule-centric policy model"; "Define policies with fully qualified domain names (FQDNs)". Legacy clusters need a planned upgrade; policy migration is a separate statement of work. | [fns76]; [fns-sd] | 2026-10-19 | keep |
| REV-8 | Security profiles need AOS 7.6, Prism Central 7.6 and AHV 11.2, are checked every 2 hours, and fix drift where possible (otherwise an alert). The FIPS line reads "FIPS 140-2 Level 1 (per Nutanix)". | TME post: "you will need to be running AOS 7.6, Prism Central 7.6, and AHV 11.2", "a built-in 2 hour security cron job", drift fixed "wherever possible", reboot-only changes raise an "NCC alert". NIST certificate #4584 (140-2 Level 1) is now "Historical". | [sec76]; [nist4584] | 2026-10-19 | fix. "validated" removed |
| REV-9 | NCM 2.1 (GA Aug 2026) adds a 3-node Small form factor for about 2,500 VMs; Medium is about 10,000; NCM 2.x requires Nutanix Central on-prem. | See item 14 in section 5. | [ncm21]; [ncm2x] | 2026-10-19 | keep |
| REV-10 | Move zero-copy applies when the VM disks already sit on a supported external array, such as Everpure FlashArray, that the AHV cluster also uses. Move 6.3.3 is for new deployments only. | Move 6.3: "zero-copy migration with supported external storage"; the Sep 29, 2026 blog names only FlashArray. "Move 6.3.3 supports new deployments only". | [move63]; [move-zc]; [move633] | 2026-10-19 | fix. Dell PowerStore removed from the zero-copy claim |
| REV-11 | NetApp ONTAP support was still planned for this fall in mid-October 2026. | Oct 15, 2026 coverage: "Planned for availability this autumn with an upcoming NCI release", over NFS. | Intelligent CIO (Oct 15, 2026) | 2026-10-19 | keep (presenter Q&A) |

## 12. Replication factor and rebuild space recheck (October 2026)

The owner asked for the replication factor requirements and the free space needed to rebuild to be double-checked. Node minimums, failures tolerated, metadata copies and the block, rack and EC-X minimums all match the sources in RF-1, RF-2, EC-1 and FD-1. The changes are about the rebuild reserve and the RF2-to-RF3 line.

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| RB-1 | RF2 needs 3 nodes and RF3 needs 5; size RF2 for N+1 and RF3 for N+2. | Nutanix's sizing workshop: "RF2 clusters require a minimum of 3 nodes" and "should be sized to account for N+1"; "RF3 clusters require a minimum of 5 nodes" and "should ideally be sized to account for N+2", "at a minimum" N+1. | [sizing-ws]; [Bible: Data resilience][b-res] | 2026-10-19 | keep |
| RB-2 | The rebuild reserve is the largest node's worth (the two largest with RF3), not an average node. | A Nutanix blog on storage resiliency: the reserve setting means "the cluster reserves the capacity of the largest node". A Nutanix employee: Prism's checks are "based on the largest single-node (or two-node) storage capacity in the cluster". | [nx-resil]; [nx-n1] | 2026-10-19 | changed: "the largest node" in Protection & Capacity, the Cluster & DSF Lab and the Gauntlet |
| RB-3 | Prism shows resilient capacity and warns at 75% of it by default; an optional setting reserves the rebuild space. | The Bible: "Resilient Capacity = Total Cluster Capacity - Capacity needed to rebuild from FT failure(s)", and, for the warning threshold, "By default that is set to 75%". The Nutanix blog names the "Reserve Rebuild Capacity" setting and says it "can be left disabled". | [Bible: Data resilience][b-res]; [nx-resil] | 2026-10-19 | added to Protection & Capacity numbers and Q&A |
| RB-4 | Without rebuild space, Prism alerts and upgrade pre-checks can hold back an upgrade. | A Nutanix employee: "Not having rebuild capacity will result in alerts", and the "same check is also part of upgrade pre-checks, so automated upgrades requiring restarts would be blocked". | [nx-n1] | 2026-10-19 | added to the Protection & Capacity Q&A |
| RB-5 | N+2 for RF2 clusters above 24 nodes (was in the Protection & Capacity numbers). | This is one architect's own advice (CAP-3, Josh Odgers' blog), not Nutanix guidance or a Prism rule. The sizing workshop and Prism size RF2 for one node. | [odgers-size]; [sizing-ws] | 2026-10-19 | removed from the page; `recommendedReserve()` still suggests it but no page uses that function |
| RB-6 | Moving from RF2 to RF3 "is done online". | A Nutanix employee: RF3 "can be enabled at the time of cluster creation or after creation too", and it needs at least five nodes. Odgers (then at Nutanix) shows the conversion "on the fly": the cluster's redundancy factor first, then each container, with free space for the third copy. No source says "online" in those words. | [nx-rf3]; [odgers-rf3] | 2026-10-19 | reworded: "can be done on a running cluster of at least 5 nodes", in that order, with free space |

## 13. v1.1 changes: LCM, DR, Edge and NetApp (October 2026)

A coworker review asked for a live failure in LCM, one NearSync/Sync choice plus Metro Availability in DR, a working "Nodes lose contact" and node expansion in Edge, and a NetApp check. portal.nutanix.com and the Nutanix Bible's HTML pages would not load through the proxy here, so these rows rest on Nutanix blogs, release posts, employee community answers and labeled third parties.

| ID | Claim (as the app states it) | What I found | Source(s) | Checked | Decision |
|---|---|---|---|---|---|
| LCM-1 | A node that fails mid-upgrade: HA restarts its VMs, the cluster starts rebuilding the lost copies at once, LCM finishes the node it was on and holds, then resumes once the node is repaired and data has caught up. | Rebuild starts "immediately" (TIM-2). LCM takes the next node out only when data resiliency is Normal (note C, LCM Guide 3.4). The engine already modeled the hold; only the picture changed. | [b-res]; [n-nodefail]; [note C][C] | 2026-10-22 | keep. The failure is no longer drawn on the timeline before it happens |
| DR-6 | Metro Availability is synchronous replication (RPO 0) between sites under 5 ms round trip, plus a Witness in a third location for automatic failover. | Nutanix blog (2024): "designed to operate between sites with latency under 5 ms", and Metro "enhances the Synchronous replication… The automatic failover is facilitated by the Witness Service hosted in a separate fault domain". nutanix.dev (2022): "less than 5 ms network round trip time". No bandwidth figure is published. | [blog-dr]; [ndev-dr] | 2026-10-22 | added as its own choice |
| DR-7 | After a site is lost, the Witness gives the other site the lock and the VMs restart there automatically, in the recovery plan's order; it is a restart (minutes), not live continuity. | AOS 7.5.1 blog (Nutanix PM, May 2026): the Witness "grants 'Ownership Lock' to Site B, and VMs automatically restart… Zero RPO, near-zero RTO". OVHcloud (third party) measured about 4 minutes. AHV Metro is a Prism Central sync policy with automatic failure detection plus a recovery plan. | [sync751]; [ovh-metro] | 2026-10-22 | keep |
| DR-8 | A planned Metro move can live-migrate the VMs, so they never stop. | Cross-cluster live migration exists "since AOS 5.19"; on-demand cross-cluster live migration came in AOS 6.7. | [ahv67] | 2026-10-22 | keep, shown for planned failover with Metro only |
| DR-9 | If only the link between sites breaks, the site holding the Witness lock keeps running and replication pauses; on AHV an admin resumes it. A site cut off from both the other site and the Witness stops its VMs. | Files Episode 5.2 (Nutanix employees, 2025): "Synchronous replication will be paused on Cluster 1… the administrator can manually resume", and a cut-off primary will "pre-emptively revoke storage access". NC2 design blog (2025): "automatic pause is done on source". The older Bible text says replication resumes on its own; the current AHV sources say an admin resumes it. | [files-sync]; [nc2-metro]; [b-dr] | 2026-10-22 | presenter Q&A only |
| DR-10 | AHV Metro runs across two clusters with per-VM protection from Prism Central; ESXi Metro stretches a storage container inside one vSphere cluster and vSphere HA restarts the VMs. | NC2 design blog: two clusters, per-VM, no stretched datastore. Bible: containers are "stretched" and Metro "expands the VM HA domain". | [nc2-metro]; [b-dr] | 2026-10-22 | presenter Q&A and the Illustrative note |
| DR-11 | NearSync (1 to 15 min) and Sync (RPO 0, under 5 ms, a person fails over without a Witness) share one choice; the picture shows NearSync and the captions say what Sync changes. | DR-2 and DR-3. "Manual means you have to start the failover from the recovery plan yourself" (community volunteer, not staff). The NCI 7.5 blog says "Near-Sync (20s-15min RPO)"; 20 s was historically ESXi only, so the app keeps 1 to 15 minutes. | [blog-dr]; [ndev-dr]; [n-sync-manual] | 2026-10-22 | keep |
| EDGE-4 | Three nodes, one cut off: the two connected nodes keep the cluster running, block the cut-off node's storage I/O so its VMs stop, HA restarts them on the other two (about 2 minutes in), copies are rebuilt at once, and the node rejoins on its own once stable. | Bible (AHV): "the side with quorum will remain up". Its network-partition example: I/O from the host blocked at T60, "All VMs restart" at T120, and VMs on the partitioned host "terminate 45 seconds after the first failed I/O request", so "a cluster never has more than one copy of a VM running". Rebuild "immediately" (TIM-2); the node "will be joined back into the ring after it has been up and stable". "2 of 3 is a majority" is my reading of the quorum quotes. Not confirmed: whether VMs move back to the returning node. | [b-ahv]; [b-res]; [n-nodefail] | 2026-10-22 | added |
| EDGE-5 | Two nodes lose contact: both ask the Witness for the leadership lock, the winner carries on in single-node mode, the other shuts down its services and waits, and HA restarts its VMs on the winner. When the link returns it recovers like a node failure. | Cloud Whales (third party, matching the Prism two-node recovery doc): "both nodes send a leadership request to the Witness VM", "Whichever node gets the leadership lock stays active and goes into single-node mode", "All operations and services on the other node are shut down", then "the same recovery process as in the node failure scenario". A Nutanix patent says the first request received tends to win. "HA restarts its VMs on the winner" is my reading of the other node's services shutting down. | [cw-2node]; [p-2node]; [n-2node-tm] | 2026-10-22 | changed: the losing node now waits and its VMs move |
| EDGE-6 | Adding a node: two-node AHV clusters can grow to three from AOS 7.6 (one way); single-node clusters can't be expanded; three-node clusters use the normal Expand Cluster. | AOS 7.6 post: "Expand two-node AHV clusters to three nodes with a simple node addition." Hands-on walkthrough (Sep 2026, translated): image the node first, "For a 2-node cluster, the only option is adding the node as an HCI Node", and "a 3-node cluster cannot be reduced back to 2 nodes". Nutanix employee (2021, citing KB-5943): "a single-node or two-node cluster cannot be expanded later on"; an AOS error reads "Cluster expansion from less than 2 nodes not supported" (2025); community advice is a new cluster, replicate, then add the old node. Not confirmed: VM impact during the 2-to-3 expansion and whether KB-5943 still applies to single nodes on AOS 7.x. | [aos76]; [tomo-2to3]; [n-1node-exp]; [jt-expand]; [n-1node-rebuild] | 2026-10-22 | added, with the walkthrough and the single-node answer tagged |
| EXT-15 | NetApp ONTAP is still not generally available (Oct 22, 2026); the page shows it as "coming". | Oct 15, 2026 coverage: "Planned for availability this fall with an upcoming NCI release", AFF and FAS over NFS. NetApp's own blog (Sep 29, 2026) names "Nutanix Cloud Infrastructure (NCI) 7.6.0.10 later this year". The newest 7.6 patch found is 7.6.0.8 (Oct 5, third-party list). The April 2026 blogs targeted Q3 2026, which has passed. | [zawya-netapp]; [netapp-blog]; [ext-netapp-pr] | 2026-10-22 | added as a disabled "coming" option; recheck before each customer session |

[ndev-dr]: https://www.nutanix.dev/2022/09/08/nutanix-benefit-5-enterprise-grade-replication-and-disaster-recovery/
[sync751]: https://next.nutanix.com/community-blog-154/unlocking-synchronous-replication-with-aos-7-5-1-and-external-storage-45597
[ovh-metro]: https://docs.ovhcloud.com/en/guides/hosted-private-cloud/nutanix-on-ovhcloud/metro-availability
[ahv67]: https://nutanix.com/blog/highlighting-key-new-capabilities-for-major-ahv-update-in-aos-6-7
[files-sync]: https://next.nutanix.com/community-blog-154/nutanix-files-storage-episode-5-2-synchronous-replication-the-rise-of-ahv-metro-44702
[nc2-metro]: https://www.nutanix.com/blog/design-overview-ahv-metro-on-nutanix-cloud-clusters-nc2-on-aws
[n-sync-manual]: https://next.nutanix.com/nutanix-disaster-recovery-29/synchronous-replication-with-pc-based-dr-44240
[n-2node-tm]: https://next.nutanix.com/how-it-works-22/two-node-clusters-33840
[tomo-2to3]: https://tomomartin.hateblo.jp/entry/2026/09/11/113020
[n-1node-exp]: https://next.nutanix.com/installation-configuration-23/expand-1-node-cluster-39989
[jt-expand]: https://www.jeroentielen.nl/nutanix-cluster-expansion/
[n-1node-rebuild]: https://next.nutanix.com/installation-configuration-23/best-way-to-rebuild-single-node-cluster-to-5-node-cluster-with-all-the-vms-intact-43659
[zawya-netapp]: https://www.zawya.com/en/press-release/companies-news/nutanix-and-netapp-let-enterprises-modernize-virtualization-on-existing-storage-1674758
[netapp-blog]: https://www.netapp.com/blog/simplify-virtualization-migration-modernization/

---

## Changes needed in the app

Each item lists the file, what it says now, what it should say, and the source.

1. **`src/engine/rules.ts` `edgeAdvisory(2)` (EDGE-3)**
   - **Now:** "After one node fails, the survivor keeps running workloads with a single data copy until the pair is healthy again."
   - **Should say:** The survivor goes into single-node mode (in about 30–60 s), the failed node is detached from the metadata ring, and data is re-protected as two copies on different drives of the surviving node. When the peer returns and has been stable for 15 minutes, the cluster resyncs back to two-node mode, which can take hours.
   - **Sources:** [Monitoring a two-node cluster][n-2node-mon]; [Cloud Whales][cw-2node]; [note C][C].
2. **`src/engine/rules.ts` `MIN_BLOCKS`, `MIN_RACKS`, `blockAwareAllowed()`, `rackAwareAllowed()`, plus `src/engine/capacity.ts` `survivalMatrix()` and `recommendedReserve()` (FD-1, FD-2)**
   - **Now:** the minimums are 3 blocks/racks for RF2 and 5 for RF3, whether or not EC-X is on.
   - **Should say:** with EC-X enabled, the minimums are **4 blocks/racks for RF2 and 6 for RF3**. Without EC-X they stay 3 and 5. EC block awareness needs (k+n)+1 blocks for the strip in use. The functions need an `ecx` input.
   - **Source:** [Bible: Data resilience][b-res] awareness table; [Bible: Data efficiency][b-eff].
3. **`src/engine/capacity.ts` `survivalMatrix()`**
   - **Now:** the rack check uses `MIN_BLOCKS[o.rf]`, and the "why" text says "at least ${MIN_BLOCKS} racks".
   - **Should say:** use `MIN_RACKS` (same values today, but it is the wrong constant). This is a code fix, not a fact change.
4. **`src/engine/rebuild.ts` `haReserveAllowed()` (HA-2)**
   - **Now:** it checks capacity after losing **one** host whatever the RF. The function comment says "one host failure".
   - **Should say:** reserve **two hosts' worth** of memory when the cluster is FT2 or any container is RF3, and one host otherwise. Size by the largest host's memory.
   - **Source:** [Bible: AHV how it works][b-ahv].
5. **`src/engine/failures.ts` `TIMING.haDetectS` (TIM-1)**
   - **Now:** 40 s.
   - **Should say:** about **60 s** before restarts begin (the leader notices at about 20 s, then a 40 s timeout), with all VMs restarted by about 120 s. Keep it labeled illustrative.
   - **Source:** [Bible: AHV how it works][b-ahv].
6. **`src/engine/failures.ts` `TIMING.rebuildDelayS` (TIM-2)**
   - **Now:** 60 s before re-protection starts.
   - **Should say:** re-protection starts **immediately** after the failure is detected. Use a few seconds at most, and drop the "must be unreachable for 60 s" wording from the comment and any UI text.
   - **Sources:** [Bible: Data resilience][b-res]; [Node failure question (Nutanix employee)][n-nodefail].
7. **`docs/MASTER_PROMPT.md` §7.5 "CVM only" and §10 "Failure behavior" (HA-3)**
   - **Now:** "I/O is redirected to other CVMs over the network (autopathing)".
   - **Should say:** on AHV, the host's iSCSI redirector sends the vDisk sessions to a healthy remote Stargate (iSCSI multipathing). "CVM Autopathing" is the ESXi/Hyper-V name. Any UI text for this failure should use the AHV wording, or say "(called autopathing on ESXi)".
   - **Sources:** [Bible: Data resilience][b-res]; [Bible: AHV how it works][b-ahv]; [note C][C].
8. **`docs/MASTER_PROMPT.md` §10 EC-X ("Flexible strip sizes and newer encoding behavior exist") and §7.4 ("verify... current flexible-strip behavior") (EC-5)**
   - **Now:** a generic flexible-strip claim.
   - **Should say:** no "flexible strip" feature was found. Standard clusters top out at 4/1 and 4/2. Dedicated Unified Storage clusters (AOS 7.3+) can go up to 12/2. Placement adapts to read temperature.
   - **Source:** [Bible: Data efficiency][b-eff].
9. **`docs/MASTER_PROMPT.md` §10 EC-X ("assume ... 50 to 80 percent of the theoretical saving") (CAP-2)**
   - **Now:** a 50–80% range.
   - **Should say:** leave it out. There is no Nutanix source, and the write-cold slider already covers it.
10. **`docs/MASTER_PROMPT.md` §10 DR ("A-C near-sync with about 20 s RPO, A-D async with about 30 min RPO"; "Older 'vStore' 20-second replication applies to ESXi") (DR-5)**
    - **Now:** 20 s and 30 min figures.
    - **Should say:** leave out both numbers. The documented NearSync range is 1–15 min, and async starts at 1 h. Use Nutanix's own example instead: A–B sync at 0 RPO and async at 1 h to a third or fourth site.
    - **Sources:** [blog][blog-dr]; [brief][sb-dr].
11. **`src/engine/rules.ts` `METADATA_COPIES` / `src/engine/status.ts` (RF-2)**
    - **Now:** metadata copies follow FT only (3 or 5), including for 2-node clusters.
    - **Should say:** 2-node clusters keep **metadata at RF4** (data RF2). This only matters if the UI shows a copy count for 2-node clusters.
    - **Source:** [Two-node clusters (Nutanix employee)][n-2node].
12. **`src/engine/rules.ts` `edgeAdvisory(1)` (EDGE-1)**
    - **Now:** "Data is protected across the node's drives."
    - **Should say:** the claim is unverified as worded. Either tag it Unverified, or say "copies are kept on different drives, so a drive failure can be rebuilt; an SSD failure can make the cluster read-only; async DR is limited to a 6-hour RPO".
    - **Source:** [Single node conditions (Nutanix employee)][n-1node].
13. **`src/engine/cluster.ts` `cvmMemGB: 32` and any UI text that calls it "the default" (CVM-1)**
    - **Now:** 32 GB presented as the setting.
    - **Should say:** keep 32 GB as an adjustable example labeled "typical starting point; grows with dedupe, RF3 and DR". Do not call it the official default, which could not be verified.
    - **Sources:** [CVM resources (Nutanix employee)][n-cvm]; [Sizer wiki][sizer].
14. **`docs/MASTER_PROMPT.md` §10 Flow ("Policy modes (monitor/enforce) and types (application, isolation, quarantine) are [K]") (FLOW-1)**
    - **Now:** three types and two modes, tagged [K].
    - **Should say:** this is now verified. The types are Application, Isolation, Quarantine (Strict or Forensic), Shared Services and VDI. The states are Saved, Monitoring and Enforced. Overlay is Geneve, and VTEP uses VXLAN.
    - **Source:** [Bible: Flow Network Security][b-fns]; [Bible: Flow Virtual Networking][b-fvn].

No contradictions were found for:
- RF-1 (3 and 5 nodes)
- EC-1 (4 and 6 nodes)
- EC-2 (the full strip table, RF2 and RF3)
- the EC "strip+1" advisory
- CAP-3 reserve values (N+1, N+2, more than 24 nodes, N+4 and N+8 for blocks)
- DP-1 (1.5 MB)
- DP-2
- TIM-3 (30 min ring detach)
- DR-1 to DR-3 (60 min+, 1–15 min, 0 RPO under 5 ms).

<!-- Reference links -->
[C]: research/C-lcm-networking.md
[E]: research/E-platform-services.md
[b-res]: https://www.nutanixbible.com/4i-book-of-aos-data-resilience-and-ha.html
[b-eff]: https://www.nutanixbible.com/4h-book-of-aos-data-efficiency.html
[b-io]: https://www.nutanixbible.com/4g-book-of-aos-data-io-path.html
[b-ahv]: https://www.nutanixbible.com/5b-book-of-ahv-how-it-works.html
[b-dr]: https://www.nutanixbible.com/pdf/4e-book-of-aos-backup-dr.pdf
[b-fns]: https://www.nutanixbible.com/12a-book-of-network-services-flow-network-security.html
[b-fvn]: https://www.nutanixbible.com/pdf/12c-book-of-network-services-flow-virtual-networking.pdf
[aos66]: https://www.nutanix.com/blog/introducing-aos-6-6
[blog-dr]: https://www.nutanix.com/blog/ensuring-resilient-mission-critical-applications
[sb-dr]: https://www.nutanix.com/library/solution-briefs/nutanix-business-continuity-and-disaster
[n-rfrf]: https://next.nutanix.com/how-it-works-22/redundancy-factor-vs-replication-factor-37486
[n-ec]: https://next.nutanix.com/how-it-works-22/erasure-coding-37298
[n-ec2]: https://next.nutanix.com/how-it-works-22/data-resiliency-efficiently-erasure-coding-33393
[n-rack]: https://next.nutanix.com/how-it-works-22/understanding-fault-domains-and-rack-awareness-38151
[n-2node]: https://next.nutanix.com/how-it-works-22/two-node-clusters-39244
[n-2node-mon]: https://next.nutanix.com/how-it-works-22/monitoring-a-two-node-cluster-during-failover-and-upgrade-38932
[n-1node]: https://next.nutanix.com/how-it-works-22/conditions-for-single-node-cluster-39321
[n-nodefail]: https://next.nutanix.com/how-it-works-22/node-failure-questoin-39081
[n-cvm]: https://next.nutanix.com/ahv-virtualization-27/cvm-resources-allocation-17651
[n-metro-ahv]: https://next.nutanix.com/ahv-virtualization-27/metro-availability-with-witness-vm-for-ahv-clusters-supported-45255
[odgers-size]: https://www.joshodgers.com/2018/06/22/nutanix-sizing-for-resiliency-w-design-brews/
[lab-ha]: https://calm-bootcamp.readthedocs.io/en/latest/vdi_ahv/lab9.html
[cw-2node]: https://www.cloudwhales.co.uk/2022/03/16/power-your-remote-branch-and-edge-sites-with-nutanix-two-node-clusters/
[sizer]: https://sizerwiki.prod.saas.nutanix.com/?p=149
[p-inline-ec]: https://portal.nutanix.com/page/documents/details?targetId=Web-Console-Guide-Prism-v6_10%3Awc-inline-erasure-coding-overview-wc-c.html
[p-2node]: https://portal.nutanix.com/page/documents/details?targetId=Web-Console-Guide-Prism-v6_10%3Awc-cluster-two-node-recovery-procedures-r.html
[p-cvm]: https://portal.nutanix.com/page/documents/details?targetId=Web-Console-Guide-Prism%3Awc-cvm-memory-configuration-c.html
[p-found]: https://portal.nutanix.com/page/documents/details?targetId=Field-Installation-Guide-v5_0%3Afie-cvm-cpu-allocation.html
[p-pd-metro]: https://portal.nutanix.com/page/documents/details?targetId=Prism-Element-Data-Protection-Guide%3Awc-protection-domain-configuration-ma-wc-c.html
[p-ahv-metro]: https://portal.nutanix.com/page/documents/details?targetId=Disaster-Recovery-DRaaS-Guide-vpc_2024_3%3Aecd-ecdr-metroavailability-pc-c.html
[ds-cg]: https://www.nutanix.com/library/datasheets/nutanix-cloud-manager-cost-governance
[b-cg]: https://www.nutanixbible.com/14b-book-of-cloud-management-cost-governance.html
[b-ss]: https://www.nutanixbible.com/14c-book-of-cloud-management-self-service.html
[blog-cg]: https://www.nutanix.com/blog/new-ncm-cost-governance-test-drive
[pg-cg]: https://www.nutanix.com/en_gb/products/cloud-manager/cost-governance
[blog-proj]: https://www.nutanix.com/tech-center/blog/nutanix-projects-key-capabilities-and-benefits
[b-ext]: https://www.nutanixbible.com/8c-book-of-external-storage-architecture.html
[ext-launch]: https://www.nutanix.com/blog/nutanix-cloud-infrastructure-for-external-storage
[ext-fa-ga]: https://www.nutanix.com/blog/nutanix-with-flasharray-now-generally-available
[ext-ps-76]: https://www.nutanix.com/blog/multi-tenant-ai-workloads-on-a-modern-enterprise-ready-virtualization-platform
[ext-netapp-pr]: https://www.nutanix.com/press-releases/2026/nutanix-and-netapp-form-strategic-alliance
[ext-netapp-blog]: https://www.nutanix.com/blog/reclaiming-control-delivering-virtualization-freedom
[ext-tech]: https://www.nutanix.com/tech-center/blog/nutanix-cloud-platform-with-external-storage
[ext-mig]: https://www.nutanix.com/blog/guide-to-migrating-to-nutanix-with-external-storage
[ext-fc]: https://www.nutanix.com/blog/fibre-channel-or-nvme-over-tcp
[ext-pure-pr]: https://www.nutanix.com/press-releases/2025/nutanix-and-pure-storage-partner-to-deliver-greater-customer-choice
[sb-fa]: https://www.nutanix.com/library/solution-briefs/pure-storage-with-nutanix
[ds-ncic]: https://www.nutanix.com/library/datasheets/nci-c
[pc76]: https://next.nutanix.com/product-updates/prism-central-pc-7-6-45766
[aos76]: https://next.nutanix.com/product-updates/aos-7-6-45767
[ev-fa]: https://support.everpuredata.com/r/sBeMzUjO3yBw_YX4GJdY1g/ilNX46vaKlVZyRNIuJTctg
[b-basics]: https://www.nutanixbible.com/pdf/2c-book-of-basics-hyperconverged-platform.pdf
[b-vs-arch]: https://www.nutanixbible.com/6a-book-of-vsphere-architecture.html
[b-vs-how]: https://www.nutanixbible.com/6b-book-of-vsphere-how-it-works.html
[b-vs-admin]: https://www.nutanixbible.com/6c-book-of-vsphere-administration.html
[b-prism]: https://www.nutanixbible.com/pdf/3c-book-of-prism-features-and-usage.pdf
[mig-guide]: https://www.nutanix.com/content/dam/nutanix/resources/gated/others/vmware-to-nutanix-migration-guide.pdf
[nx-vs-vmw]: https://www.nutanix.com/info/nutanix-vs-vmware
[nx-transition]: https://www.nutanix.com/vmware-alternative/transition
[inf-vmw]: https://www.nutanix.com/content/dam/nutanix/resources/infographics/inf-reasons-to-run-vmware-on-ntnx.pdf
[vmw-eoa]: https://blogs.vmware.com/cloud-foundation/2024/01/22/vmware-end-of-availability-of-perpetual-licensing-and-saas-services/
[blog-shelf]: https://www.nutanix.com/blog/vmware-customers-prepare-to-bundle-up
[n-upg]: https://next.nutanix.com/how-it-works-22/your-guide-to-the-upgrades-39876
[n-conv]: https://next.nutanix.com/installation-configuration-23/cluster-conversion-esxi-to-ahv-in-place-or-failover-failback-44949
[dev-choice]: https://www.nutanix.dev/2022/09/15/nutanix-benefit-6-hypervisor-choice/
[pg-flow]: https://www.nutanix.com/products/flow
[pr-obj-tier]: https://www.nutanix.com/press-releases/2020/nutanix-extends-storage-services-to-its-hybrid-cloud-platform
[n-obj30]: https://next.nutanix.com/community-blog-154/realizing-secure-hybrid-cloud-infrastructure-with-nutanix-objects-3-0-38648
[wasabi-obj]: https://docs.wasabi.com/docs/how-do-i-use-nutanix-objects-with-wasabi.md
[blog-obj33]: https://www.nutanix.com/blog/objects-33-improved-efficiency-and-time-to-value
[blog-mobility]: https://www.nutanix.com/blog/storage-mobility-to-meet-the-challenges-of-hybrid-multicloud
[b-io]: https://www.nutanixbible.com/4g-book-of-aos-data-io-path.html
[sizer-obj]: https://sizerwiki.prod.saas.nutanix.com/?p=472
[pr-cnaos]: https://www.nutanix.com/press-releases/2025/nutanix-announces-cloud-native-aos
[rn-cnaos10]: https://next.nutanix.com/product-updates/nutanix-cloud-native-aos-1-0-0-44652
[blog-cnaos]: https://www.nutanix.com/blog/nutanix-cloud-native-aos-brings-enterprise-storage-to-diverse-kubernetes-environments
[pg-cnaos]: https://www.nutanix.com/products/kubernetes-management-platform/cloud-native-aos
[ds-cnaos]: https://www.nutanix.com/library/datasheets/aos
[pr-nkpm]: https://www.nutanix.com/press-releases/2026/nutanix-introduces-nkp-metal-bringing-bare-metal-kubernetes-to-its-platform
[gc2-esc]: https://www.nutanix.com/blog/nutanix-government-cloud-clusters-is-available-in-aws-european-sovereign-cloud
[ncm21]: https://www.nutanix.com/blog/introducing-nutanix-cloud-manager-2-1
[ncm2x]: https://next.nutanix.com/community-blog-154/sovereign-ready-unified-insight-driven-nutanix-cloud-manager-2-x-45618
[nus54]: https://www.nutanix.com/blog/unleashing-modern-workloads
[files54]: https://next.nutanix.com/product-updates/nutanix-files-5-4-45836
[obj54]: https://next.nutanix.com/product-updates/nutanix-objects-5-4-45798
[sw-opt]: https://www.nutanix.com/products/cloud-platform/software-options
[dl21]: https://next.nutanix.com/data-lens-239/nutanix-data-lens-update-aligning-features-and-licensing-across-on-prem-and-saas-45838
[ndb-mongo]: https://nutanix.com/blog/mongodb-sharded-cluster-database-data-protection
[ndb211]: https://www.nutanix.com/blog/announcing-nutanix-database-service-2-11
[nai-faq]: https://www.nutanix.com/products/nutanix-enterprise-ai/faq
[nai28]: https://next.nutanix.com/product-updates/nutanix-enterprise-ai-2-8-45849
[pr-nai28]: https://www.nutanix.com/press-releases/2026/nutanix-gives-enterprises-the-freedom-to-run-production-agentic-ai-their-way
[fns76]: https://next.nutanix.com/product-updates/flow-network-security-next-gen-release-7-6-45769
[fns-sd]: https://www.nutanix.com/content/dam/nutanix/en/resources/service-descriptions/sd-nutanix-flow-network-security-next-gen-readiness.pdf
[sec76]: https://next.nutanix.com/community-blog-154/nutanix-cloud-infrastructure-nci-episode-7-6-a-nutanix-aos-software-and-ahv-hypervisor-security-story-45746
[nist4584]: https://csrc.nist.gov/projects/cryptographic-module-validation-program/certificate/4584
[move63]: https://next.nutanix.com/product-updates/nutanix-move-6-3-45782
[move-zc]: https://www.nutanix.com/blog/accelerating-workload-mobility-using-nutanix-move
[move633]: https://next.nutanix.com/product-updates/nutanix-move-6-3-3-45958
[sizing-ws]: https://sizing-workshop.readthedocs.io/en/latest/discovery/ntnx/ntnx.html
[nx-resil]: https://next.nutanix.com/community-blog-154/managing-storage-resiliency-is-now-simpler-than-ever-39809
[nx-n1]: https://next.nutanix.com/installation-configuration-23/capacity-for-rf2-and-n-1-37235
[nx-rf3]: https://next.nutanix.com/how-it-works-22/rf2-rf3-requirements-37206
[odgers-rf3]: https://joshodgers.com/tag/resiliency-factor

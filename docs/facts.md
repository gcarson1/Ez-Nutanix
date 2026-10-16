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
- **Item 10, NC2** ([E-platform-services.md][E]): GA on AWS, Azure, **Google Cloud (GA Dec 9, 2025)** and OVHcloud. The AWS European Sovereign Cloud offering is branded GC2 and is "coming soon", not GA.
- **Item 11, NDB:** NDB 2.11 (July 2026). Add EDB Postgres to the engine list.
- **Item 12, Cloud Native AOS:** GA only on Amazon EKS (1.0.0, July 2025). Bare metal is future work, tied to NKP Metal. Project Beacon was a 2023 vision whose outcome is CN-AOS plus NDK, not a product.
- **Item 13, Data Lens and AI:** Data Lens 2.0 on-prem (including air-gapped) GA in Apr 2026, and On-Prem 2.1 added Objects. NAI is at 2.8. "Nutanix Agentic AI" is a full-stack solution targeted for 2H 2026. GPT-in-a-Box is a legacy name.
- **Item 14, Fleet, NCM, Federation:** "Prism Federation" is not a Nutanix product name. The capability is Nutanix Central (SaaS and on-prem, up to 25 Prism domains). NCM 2.0 runs on Nutanix Central On-Prem. Self-Service and Cost Governance start at Pro, and Security Compliance is Ultimate only.


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

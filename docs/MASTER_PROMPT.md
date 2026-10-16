# Nutanix Architecture Explorer: Master Build Prompt

> Paste this whole file into Claude Code at the root of the repo (or save it as `docs/MASTER_PROMPT.md` and tell Claude Code to read it first). Save the screenshot of the "One Platform For All Apps, Data & AI Anywhere" slide as `docs/reference/platform-reference.png` before starting.

---

## 0. How to work on this

You are building an interactive, shareable HTML experience that a Nutanix sales engineer will use live in front of customers and then send to them afterward. Read this entire document before writing code.

1. **Plan first.** Post a short build plan (phases, file layout, risks) and at most five clarifying questions. If I don't answer, make the reasonable choice and note it in `docs/decisions.md`.
2. **Verify facts before encoding them.** Section 10 is a research summary and Section 11 is a register of claims that must be checked. Use web search against nutanixbible.com, portal.nutanix.com documentation and nutanix.com product pages before building each module. Write what you confirmed, with URLs, into `docs/facts.md`. If a source contradicts this document, the source wins. Tell me what changed.
3. **Separate the simulation from the UI.** All cluster, failure, upgrade, replication and capacity logic lives in a pure, deterministic, unit-tested engine. The UI only renders engine state.
4. **Build in phases (Section 12), demo-able after each one.** Commit after each phase.
5. **Use parallel subagents** for independent modules once the shell and engine interfaces exist.

---

## 1. Mission and audience

**Product:** "Nutanix Architecture Explorer," a single self-contained HTML file with a landing page styled like the reference slide. Every pane on that page opens an interactive module that explains how that part of the platform works.

**Primary user:** a sales/systems engineer presenting live, screen-sharing, answering questions on the fly. They need to change scenarios in seconds, show failures and upgrades happening, and explain *why* things behave as they do.

**Secondary user:** the customer, opening the file later on their own. It must be self-explanatory without the presenter.

**Audience mix:** infrastructure admins, architects, CIOs and security leads. Layer the content: a simple visual first, then optional "go deeper" detail for the technical audience.

**Tone:** confident and honest. The presenter acts as a trusted advisor, not a pitchman. Every module includes an **"Honest fit"** callout covering where the behavior has trade-offs or limits (Section 6). Never show a number or behavior that a knowledgeable Nutanix engineer would call wrong.

---

## 2. Non-negotiables

- **Single file delivery.** The final build is one `index.html` with all CSS, JS, fonts (system stack or subset inlined) and SVG inlined. No CDN or network calls at runtime, so it works offline, in locked-down customer networks and from email attachments. Target under 2 MB.
- **Accuracy over spectacle.** Animations must reflect the actual mechanisms (write path, replication, rebuild, rolling upgrade). Where the sim simplifies something, label it "Illustrative" with a tooltip explaining the simplification.
- **Show bad outcomes honestly.** If the user fails more nodes than the configuration tolerates, the sim shows data becoming unavailable. Don't hide it or auto-heal it away.
- **Presentation-grade.** Legible from the back of a room at 1080p on a projector: large type, high contrast, no tiny labels, smooth 60 fps animation, no jank when toggling scenarios.
- **Shareable state.** The full scenario (node count, RF, toggles, current module) serializes into the URL hash so the presenter can send a link to a specific configuration.
- **Accessible enough.** Keyboard navigable, visible focus states, `prefers-reduced-motion` respected (step-through instead of continuous animation), color is never the only signal (use icons and labels too).
- **Original content.** Write all explanatory copy yourself. Don't paste text from Nutanix documentation, blogs or the Bible. Nutanix and product names are used descriptively. Put the footer disclaimer and presenter identity in `config.json` (see Section 5) so it can be adjusted.

---

## 3. Visual design: match the reference slide

Study `docs/reference/platform-reference.png`. Reproduce its look and layout.

**Overall:** near-black background, white bold sans-serif title, rounded rectangles in layered purple, white text. Clean, modern, generous spacing.

**Title:** "One Platform For All Apps, Data & AI Anywhere", centered, bold, two lines on narrow widths.

**Layout (three horizontal bands):**

1. **Nutanix Central band** (large purple container, label "Nutanix Central" centered at top). Inside, four darker-purple cards in a row:
   - **Prism Federation**, subtitle "API | Alerts | LCM | IAM"
   - **Cloud Manager**, subtitle "AIOps | Self-Service | Cost | SecOps"
   - **Kubernetes Platform**, subtitle "LCM | Fleet Management | Security"
   - **Data Lens**, subtitle "Security | Privacy"
2. **Services band** (a row of purple cards): **Files, Objects** | **Cloud Native AOS** | **Database Service** | **Enterprise AI**, plus a small unboxed label **Project Beacon** at the right end.
3. **Infrastructure band** (three blocks):
   - Purple block (widest): **Nutanix Cloud Infrastructure**, subtitle "(AOS, AHV, Flow, DR)".
   - Light-gray block: logos/labels for **AWS, Azure, Google Cloud**.
   - Light-gray block: bare-metal server icon with **"Any Bare Metal Linux"**.

**Tokens:** sample colors directly from the reference image into CSS custom properties (page background, outer purple, card purple, hover purple, light-gray panels, text). Don't guess. Document the sampled values in `docs/design-tokens.md`.

**Interaction on the landing page:**

- Every card is a button: hover lifts and brightens, focus ring, click opens its module with a smooth expand/zoom transition (the clicked card grows to become the module's header, so the user keeps spatial context). A persistent "Back to platform" control and breadcrumb return to the landing page.
- Subtle idle motion on the landing page (faint data-flow shimmer between bands) that stops under reduced-motion.
- A "Guided tour" button highlights the panes in a sensible talk order (bottom-up: infrastructure, then services, then Central).
- Responsive: designed for 16:9 presentation first, graceful on laptops and tablets, usable on phones (cards stack).

**Module visual language:** consistent with the landing page. Dark canvas, purple as the structural color, and a restrained status palette: green = healthy, amber = degraded or rebuilding, red = failed or data at risk, blue = data in motion. Pair every color with an icon or text.

---

## 4. Information architecture: pane to module map

Priority: **P0** = must be excellent and accurate. **P1** = solid and interactive. **P2** = good explainer with light interactivity.

| Landing pane | Module | Priority |
|---|---|---|
| **Nutanix Cloud Infrastructure** | Hub with six sub-modules: **Cluster & DSF Lab** (7.2), **Data Path** (7.3), **Protection & Capacity** (7.4), **Failure Gauntlet** (7.5), **LCM Rolling Upgrade** (7.6), **AHV Networking** (7.7) | P0 |
| (within NCI hub) **Flow** | Microsegmentation + Virtual Networking (7.8) | P0 |
| (within NCI hub) **DR** | Disaster Recovery (7.9) | P0 |
| **Prism Federation** | Multi-cluster management, fleet LCM, alerts, IAM (8.1) | P1 |
| **Cloud Manager** | AIOps, self-service, cost governance, security ops (8.2) | P1 |
| **Files, Objects** | Unified storage: Files, Volumes, Objects (8.3) | P1 |
| **Database Service** | Time Machine, thin clones, provisioning (8.4) | P1 |
| **AWS / Azure / Google Cloud** | Hybrid: Nutanix Cloud Clusters (NC2) and cloud-native deployment (8.5) | P1 |
| **Kubernetes Platform** | NKP fleet, LCM, security (9.1) | P2 |
| **Data Lens** | Data security, ransomware detection, privacy (9.2) | P2 |
| **Cloud Native AOS** | AOS as microservices on Kubernetes (9.3) | P2 |
| **Enterprise AI** | Inference endpoints on Kubernetes (9.4) | P2 |
| **Project Beacon** | Vision story (9.5) | P2 |
| **Any Bare Metal Linux** | Cloud-native AOS / NKP on bare metal (9.3) | P2 |
| **Nutanix Central** (container header) | Overview: one control plane across everything below it (8.1) | P1 |

Additional modules to add to the NCI hub after P0 is solid (my brainstorm; confirm scope in your plan):

- **Snapshots & clones**: metadata-only, redirect-on-write; instant clone animation (P1).
- **Data efficiency**: compression, deduplication, erasure coding side by side on a cold/hot data map (folded into 7.4).
- **Security**: data-at-rest encryption (self-encrypting drives or software, with local or external key management), hardening, how Flow fits (P1).
- **Migration**: moving VMs from other hypervisors with Nutanix Move (P1). This is a high-interest topic for customers.
- **Edge / ROBO**: 1-node, 2-node (with Witness) and 3-node clusters, managed centrally (P1).
- **Scale-out vs 3-tier**: add-a-node story, linear scaling, no controller bottleneck, and the honest CVM-overhead discussion (P1).
- **Storage-only and mixed-node clusters**: how data distributes to storage-only nodes and where locality doesn't apply (P2).
- **Operations "day in the life"**: before/after for patching, expansion and a failed drive (P2).
- **"Failure Gauntlet" game mode**: random failures thrown at a configuration; score by whether the cluster stays available and self-heals (P2, optional crowd-pleaser).

---

## 5. Tech stack and repo layout

**Stack:** TypeScript, Vite, `vite-plugin-singlefile` for the inlined build, Vitest for engine tests, Playwright for smoke and visual checks. No UI framework required; use vanilla TS with small component helpers, or Preact if you judge it worth the bytes. Render diagrams with SVG (crisp at any projector resolution), with Canvas only for dense particle effects. No runtime dependencies beyond the framework you choose.

```
/src
  /engine            # pure TS, no DOM
    cluster.ts       # nodes, blocks, racks, disks, VMs, containers
    placement.ts     # replica placement honoring failure domains
    datapath.ts      # write/read path state machines
    failures.ts      # failure injection + detection + status model
    rebuild.ts       # tick-based many-to-many re-protection
    capacity.ts      # RF / EC-X / reserve math
    lcm.ts           # rolling-upgrade orchestrator with pre-checks
    dr.ts            # protection policy, RPO exposure, failover
    flow.ts          # category policies, packet evaluation
    rng.ts           # seeded RNG for reproducible scenarios
  /ui
    shell/           # landing page, router, transitions, presenter mode
    modules/         # one folder per module
    components/      # buttons, sliders, tooltips, status chips
  /content           # talk tracks, honest-fit notes, glossary (data, not code)
  config.json        # presenter name, org, footer disclaimer, optional logo
/tests               # engine unit tests + Playwright smoke
/docs                # facts.md, decisions.md, design-tokens.md, reference/
```

**State and sharing:** one serializable `Scenario` object (seed, node count, nodes per block, RF, EC-X, workload mix, active failures, module, step) round-trips through the URL hash. Include scenario presets (Section 6).

**Engine requirements:**

- Deterministic given a seed.
- Time is simulated: a tick loop with adjustable speed (0.5x, 1x, 2x, 5x) plus pause and single-step.
- The cluster holds a representative sample of extents (for example 200 to 400), each with a replica set across nodes and disks. The sample is enough to show distribution and rebuild visually while staying fast.
- Expose derived status the way an admin would see it: cluster health (OK / Warning / Critical), data resiliency status (how many more failures are tolerable *right now*), rebuild capacity available (yes/no), per-extent state (healthy, under-replicated, unavailable).

**Engine invariants to cover with tests (non-exhaustive, add more):**

1. No extent has two replicas on the same node. With block awareness on, none share a block. With rack awareness on, none share a rack.
2. RF3 cannot be selected below 5 nodes. EC-X cannot be enabled below 4 nodes. Block awareness requires enough blocks (see register). The UI shows *why* a choice is disabled.
3. After one node failure on an RF2 cluster with enough surviving nodes and free capacity, the engine returns to full RF compliance and reports it.
4. If a second failure occurs before re-protection completes on RF2, extents that lost both replicas are marked unavailable. They are never silently restored.
5. When survivors fall below the minimum needed to rebuild, or free capacity is insufficient, the engine reports "cannot self-heal," not "rebuilding."
6. LCM refuses to start if resiliency is not OK. During a rolling upgrade it never takes a second node out of service until the previous node is back, services are up, and resiliency is restored.
7. Capacity math matches the formulas in 7.4 for a grid of inputs.
8. Same seed, same inputs gives identical output.

---

## 6. Presenter features and cross-cutting UX

- **Presenter mode (key: P).** Opens a side panel (or a second-window view) with: the talk track for the current module (3 to 6 bullets), key numbers, three likely customer questions with honest answers, and "what to click next." Content lives in `/src/content`.
- **Honest-fit callouts** on every module: a small collapsible card titled "Where this has trade-offs." Examples are in each module section below. Keep them factual and fair, never negative marketing against any vendor.
- **Scenario presets** (one click): "3-node edge (RF2)", "4-node starter (RF2)", "8-node production (RF2, block-aware)", "12-node RF3 + EC-X", "Two-site DR pair", plus "Reset."
- **"Explain this" tooltips** on every label, with a one-sentence plain-English line and an optional "technical detail" expander.
- **Pause, step and speed controls** on every animated sequence, with a timeline scrubber where it makes sense (failure, rebuild, upgrade, DR failover).
- **Glossary drawer** (CVM, DSF, AOS, AHV, RF, EC-X, LCM, RPO, RTO, etc.) available from anywhere.
- **Keyboard shortcuts** shown in a cheat-sheet overlay (?): P presenter, G glossary, Space play/pause, arrows step, R reset, Esc back.
- **Export:** "Copy link to this scenario" and "Download this view as PNG."
- **Footer:** the disclaimer from `config.json` (default: "Illustrative visualization for education. Behavior, limits and requirements vary by software version and configuration. Refer to Nutanix documentation.") and an "About this simulation" dialog listing which behaviors are modeled and which are simplified.

---

## 7. P0 module specifications (Nutanix Cloud Infrastructure)

### 7.1 NCI hub

A visual of the stack: hardware (any supported server), AHV hypervisor, the Controller VM on every node, AOS and the Distributed Storage Fabric pooling local disks, then Flow and DR on top. Clicking any layer or any of the six sub-modules opens it. Include a one-screen "what's in a node" cutaway: hypervisor, CVM, user VMs, local NVMe/SSD/HDD, NICs.

### 7.2 Cluster & DSF Lab (the centerpiece)

An interactive cluster the user builds and then breaks.

**Controls (all live, no page reload):**

- Node count (1 to 32; show a clear advisory for edge sizes of 1 and 2 nodes and note the Witness requirement for 2 nodes).
- Nodes per block (1, 2 or 4) and a "block awareness" toggle. Rack awareness toggle with rack assignment.
- Cluster redundancy factor and container replication factor (RF2 / RF3) with the min-node rules enforced and explained.
- Erasure coding (EC-X) toggle.
- Drives per node, per-drive capacity, media type (all-NVMe, all-flash, hybrid flash + HDD).
- VM count and workload mix slider (random-heavy to sequential-heavy), to drive data-path behavior.
- Data locality on/off (show the effect when off or when a VM has just moved).
- Simulation speed.

**Visual:** nodes drawn in blocks and racks. Each node shows its hypervisor, CVM (with a heartbeat indicator), VMs, and its disks. A distribution overlay shows extents as small colored tiles inside each disk, colored by replica role (primary/local vs replica), with a toggle to highlight a single VM's data and watch where its copies live. A side panel shows live status in admin terms: cluster health, resiliency ("can tolerate 1 more node failure"), usable capacity, and rebuild capacity available.

**Behaviors to demonstrate:**

- Adding a node: it joins, capacity and CVM count grow, and background rebalancing (disk balancing) spreads data. Show that performance and capacity scale with node count because every node adds a CVM.
- Removing a node gracefully (decommission): data is re-protected elsewhere first.
- Live-migrating a VM between nodes, and what happens to locality afterward (links to 7.3).

### 7.3 Data Path (write and read)

Step-through animations, with a toggle between RF2 and RF3.

**Write, random or bursty:** VM issues write, goes to its **local CVM's Stargate**, lands in the **OpLog** on the fast tier, is **synchronously replicated to the OpLog of 1 remote CVM (RF2) or 2 (RF3)** (chosen dynamically across the cluster based on load), and is **acknowledged only after all copies are written**. Later the OpLog **coalesces and drains sequentially** to the **Extent Store**, where **ILM** places data on the right tier.

**Write, sequential or sustained:** large sequential writes **bypass the OpLog** and go straight to the extent store (the replicas still honor RF). Show the threshold as a tooltip: roughly 1.5 MB of outstanding writes per vDisk in documented versions (verify the current value).

**Read:** check the in-memory/unified cache (single-touch to multi-touch promotion), then OpLog if the data hasn't drained, then the local extent store, then a remote replica if the local copy doesn't exist. Show a latency ladder.

**Data locality sequence:** VM reads locally. VM live-migrates. First reads go remote over the network. Hot extents are then **localized on read** (copied to the VM's new node). Writes always put one replica local. Show a before/after latency and network-traffic comparison, labeled illustrative.

**Metadata strip:** an always-visible mini diagram showing that every operation consults the distributed metadata store (Cassandra-based ring, accessed via Medusa, strongly consistent via Paxos) and that cluster config lives in Zookeeper. Keep the service names as optional "technical detail."

**Honest fit:** data locality helps less with deduplication-heavy reads, storage-only nodes, and workloads that are mostly remote by design. RF3 adds write overhead relative to RF2. Large sequential I/O bypasses OpLog by design.

### 7.4 Protection & Capacity (RF, EC-X, failure domains)

Interactive capacity calculator and placement visualizer.

**Math (implement and unit test):**

- Raw capacity = sum of all drives.
- RF2 usable ≈ raw / 2. RF3 usable ≈ raw / 3.
- EC-X overhead is `(data + parity) / data`. Example: 4/1 strip is 1.25x (vs 2x for RF2); 4/2 strip is 1.5x (vs 3x for RF3). Strip size depends on cluster size (RF2 pattern: 4 nodes gives 2/1, 5 nodes gives 3/1, 6+ nodes gives 4/1; verify the RF3 table and current flexible-strip behavior before shipping).
- EC-X applies only to **write-cold data**, post-process. Add a slider "% of data that is write-cold" (default about 60, range 0 to 100, labeled illustrative) so the blended overhead is honest. The theoretical maximum saving is rarely reached.
- Resilient capacity: subtract a rebuild reserve so the cluster can fully self-heal after a failure (N+1 at minimum, N+2 for RF3 or large clusters; with block awareness, reserve a block's worth of nodes). Show "usable vs usable-after-reserve."
- Optional user-entered compression/dedupe ratio, default 1.0:1 with a note that real ratios are workload-dependent.

**Visuals:** stacked bar from raw to usable with each deduction labeled; a placement diagram showing replicas spread across nodes, then blocks, then racks; a "what failure can this survive?" matrix (disk, node, block, rack) that updates with the configuration.

**Rules to surface in the UI:**

- RF2: 2 data copies, at least 3 nodes, tolerates 1 failure. RF3: 3 data copies, at least 5 nodes, tolerates 2 failures. Metadata and cluster-config copies: 3 under RF2, 5 under RF3.
- Container RF and cluster redundancy factor are different settings; a cluster at RF3 can host both RF2 and RF3 containers.
- Converting RF2 to RF3 (and enabling EC-X) is online but consumes capacity and background resources; show a capacity-check gate before allowing it.

### 7.5 Failure Gauntlet

Click anything to break it, then watch detection, continuity and self-healing.

**Failure types:** single disk, whole node (power-off), CVM only, network partition of one node, entire block, entire rack, and multiple simultaneous failures.

**What the sim must show for each:**

- **Disk:** the replicas on that disk become under-replicated; background re-replication restores RF from surviving copies spread across *all* nodes.
- **CVM only:** the hypervisor keeps running its VMs; I/O is **redirected to other CVMs over the network (autopathing)** with a latency penalty, and locality is rebuilt when the CVM returns. VMs do not restart.
- **Node:** HA restarts that node's VMs on surviving nodes (show restart ordering and a toggle for HA memory reservation, since without reservation restarts are best-effort). Under-replicated extents are re-protected by many survivors in parallel (**many-to-many rebuild**; contrast with a RAID rebuild funneling into one spare). Cluster shows Critical until re-protected, then OK.
- **Block / rack:** only survives without data loss if block or rack awareness is on, with enough blocks or racks. Otherwise show the data-unavailable outcome.
- **Second failure during rebuild:** shows the RF2 risk window honestly (extents with both copies gone are unavailable); RF3 shows it surviving.
- **Cannot self-heal cases:** survivors below the minimum or insufficient free capacity. Show "protected but not re-protectable," with the exact reason and the fix (replace or add node, free capacity).

**Rebuild estimate:** time ≈ (data to re-protect) / (survivor count × per-node rebuild throughput). Expose the throughput as an adjustable assumption, show the formula in a tooltip, and label the estimate "Illustrative, not a measurement."

**Timeline:** scrubber showing failure, detection, VM restart, rebuild progress %, return to OK. A side-by-side "same failure, RF2 vs RF3" comparison mode.

**Honest fit:** a second failure during a long rebuild is the real risk window on RF2, and RF3 and awareness settings exist for that. Rebuild needs spare capacity; a nearly full cluster can't self-heal.

### 7.6 LCM Rolling Upgrade

Life Cycle Manager upgrading AOS, AHV, firmware and tooling while workloads keep running.

**Flow to animate (per node, strictly one at a time):**

1. **Inventory:** LCM scans and lists current vs available versions for software and firmware components.
2. **Select updates:** the user picks components (for example AOS, AHV, BIOS/BMC, drive firmware, NCC). LCM handles ordering and dependencies; show the ordering it chose.
3. **Pre-checks:** health checks, resiliency must be OK, enough capacity, CVM memory and so on. Offer a toggle "inject a degraded cluster" and show that LCM **blocks the upgrade** until resiliency is OK.
4. **Per node:** VMs live-migrate off the node, host enters maintenance mode, CVM is gracefully stopped (I/O redirected to other CVMs, writes continue to meet RF on the remaining nodes), the upgrade or firmware step runs (the node may boot into a maintenance image several times for firmware), host and CVM come back, services start, **data resync completes and resiliency returns to OK**, and only then does LCM move to the next node.
5. **Done:** summary of versions before/after, total time, zero application downtime.

**Controls:** node count, which components are selected, per-node duration assumptions (illustrative defaults, adjustable), a "break something mid-upgrade" button (fail a different node during the upgrade) to show LCM pausing rather than compounding the problem.

**Visuals:** a node-by-node progress rail, a live resiliency indicator, VMs visibly moving around, and a cumulative "workload impact" meter that stays flat.

**Edge cases to model and explain:** small clusters (1-node and 2-node clusters have special handling, and a 3-node minimum is recommended for a normal rolling hypervisor upgrade); Prism Central itself upgrades through LCM too.

**Honest fit:** upgrade duration scales with node count because it is sequential; capacity and resiliency headroom determine whether a node can be taken out safely; some firmware support depends on the server vendor and LCM release.

### 7.7 AHV Networking

Show how a node connects VMs, the CVM and the physical network.

- **Open vSwitch** inside each AHV host, managed as one logical virtual switch through Prism. Default bridge `br0` with an uplink bond (default `br0-up`), plus the internal host-to-CVM link.
- Interactive: add VLAN-backed networks, assign VMs, watch tagged traffic leave via the bond; bond modes (active-backup default, balance-slb, LACP-based modes) with a link-failure toggle showing failover behavior.
- CVM and host management traffic on the native/untagged VLAN by default, with an option to segment.
- Link to Flow (7.8) as "what sits on top."

### 7.8 Flow: microsegmentation and virtual networking

Flow is software-defined networking and security for AHV: a network control plane (the Flow controller) separate from the forwarding plane (AHV hosts plus gateway VMs). Two sub-modules:

**Flow Network Security (microsegmentation):**

- A canvas with VMs in tiers (for example web, app, database) across a couple of environments, tagged with **categories** (AppType, AppTier, Environment). Policies target categories, not IPs.
- **Policy builder:** drag category groups, set allowed protocols/ports, choose policy type (application policy, isolation between environments, quarantine). Support **Monitor** mode (log what *would* be blocked) vs **Enforce** mode.
- **Traffic simulator:** fire packets between VMs and watch them be allowed or dropped at the host, with a live rule-hit log. Include a **ransomware lateral movement** scenario: an infected VM tries to spread; show it contained by policy and by one-click **quarantine**.
- Show that policy follows the VM when it live-migrates (the point of category-based, distributed enforcement).

**Flow Virtual Networking (overlay / VPC):**

- Create VPCs with **overlapping IP ranges**, subnets, external connectivity with NAT, floating IPs, VPN or transit between VPCs and sites, and routing options.
- Packet-flow animation between two VMs in different VPCs and hosts, showing overlay encapsulation across the physical underlay (verify encapsulation details and gateway components before showing them), with the message "no physical network changes required."
- Compare **VLAN-backed** vs **overlay** networks side by side: what the network team must do for each new project.

**Honest fit:** microsegmentation only helps if categories and policies are kept current; monitor mode first is the recommended adoption path. Overlay networking adds an encapsulation layer and gateway sizing considerations.

### 7.9 Disaster Recovery

Data protection and recovery orchestration across sites.

**Replication tiers (policy-based, defined by RPO):**

- **Asynchronous:** RPO of 60 minutes or more.
- **NearSync:** RPO from 1 to 15 minutes (built on async snapshots with intermediate checkpoints).
- **Synchronous (Metro Availability / sync replication):** RPO 0, **requires round-trip latency under 5 ms** between sites; VM-level granularity.

**Interactive scene:** a map with Site A (primary), Site B, Site C, Site D, and a cloud site. Drag an **RPO slider** and the policy auto-classifies as Async / NearSync / Sync. A **latency slider** disables Sync above 5 ms and explains why. A live **data-loss exposure chart** (sawtooth) shows how much data could be lost at any instant for the chosen RPO.

**Constructs to include:** protection policies (RPO, recovery location, snapshot retention), categories to assign VMs, recovery plans (boot order, delays, network mapping, scripts), and a **Witness** that enables automatic failover for synchronous setups.

**Scenarios to play:**

- Planned failover (graceful migration; show zero data loss) vs unplanned failover (show actual data loss equal to the replication lag).
- Test failover (isolated network, no impact to production) and failback.
- Multi-site topology: A to B sync, A to C near-sync, A to D async, and what happens when A and B are lost together.
- DR to a cloud target using Nutanix Cloud Clusters.

**Honest fit:** synchronous replication carries a write-latency cost and a distance limit; RPO is only as good as bandwidth and change rate; recovery plans need network mapping and testing to be trustworthy.

---

## 8. P1 module specifications

**8.1 Nutanix Central and Prism Federation.** One console above many clusters and sites. Demo: three clusters in different locations register to Prism Central; a fleet dashboard shows health and capacity; a single click kicks off fleet-wide LCM with staggered scheduling; alerts roll up; role-based access and identity integration control who sees what; the same API surface for automation. Clarify Prism Element (per cluster) vs Prism Central (multi-cluster).

**8.2 Cloud Manager.** Four tabs. *AIOps:* anomaly detection with an interactive metric graph where a baseline band flags an outlier; capacity-runway forecast with a "what if I add N VMs" slider; right-sizing recommendations. *Self-Service:* a mock catalog where a user requests a blueprint-based app and watches it provision under quota and policy. *Cost:* metering, showback and budgeting by project/team, with cost data kept inside the customer's own infrastructure. *SecOps:* compliance checks against a baseline with auto-remediation suggestions. Mark which capabilities depend on license tier.

**8.3 Unified Storage (Files, Volumes, Objects).** All three run on the same DSF. *Files:* SMB/NFS shares served by a set of file-server VMs forming one namespace; scale up (bigger FSVMs) and out (more FSVMs); kill an FSVM and show a survivor taking over its volume-group ownership. *Volumes:* iSCSI block to VMs or external hosts. *Objects:* S3-compatible buckets, scale-out, with a tiering story to external S3 targets. A side panel shows how each maps down to vDisks and extents in the DSF.

**8.4 Database Service (NDB).** Provision a database in a few clicks; **Time Machine** timeline slider combining application-consistent snapshots with continuous log capture so you can restore or clone to any point in time; **thin clones** created from AOS snapshots in minutes with no full copy (show capacity used before/after); patching and lifecycle automation. Supported engine list must be verified before display.

**8.5 Hybrid and public cloud.** Click an AWS, Azure or Google Cloud tile. Show **Nutanix Cloud Clusters (NC2)**: the same AOS/AHV stack running on bare-metal cloud instances, one operating model and one console, used for DR target, burst capacity, migration and data-center exit. Show the cloud-native alternative: Nutanix Kubernetes Platform and Cloud Native AOS on hyperscaler Kubernetes. **Do not claim NC2 is available on a cloud provider without verifying it**; the reference image shows Google Cloud, which may refer to the cloud-native or tiering offerings rather than NC2.

---

## 9. P2 module specifications (lighter explainers with one or two interactions each)

- **9.1 Kubernetes Platform (NKP).** Fleet of clusters across data center, edge and cloud; lifecycle management, policy and security applied from one place; Flow microsegmentation extending to containers. Interaction: roll a Kubernetes version upgrade across a fleet.
- **9.2 Data Lens.** Analytics and security for unstructured data on Files/Objects: access anomaly and ransomware-pattern detection, privacy and permission exposure, can run on-premises including air-gapped environments in the current generation (verify version). Interaction: simulate mass-encryption activity and show alerting plus snapshot-based recovery.
- **9.3 Cloud Native AOS (and bare-metal Linux).** Nutanix storage and data services delivered as microservices inside Kubernetes (cloud-managed or bare-metal), without requiring a hypervisor, with Kubernetes-API-driven data management and DR across availability zones, clouds and on-premises. Interaction: toggle "VM-based AOS" vs "Cloud Native AOS" deployment to see what's the same and what's different.
- **9.4 Enterprise AI.** Deploy and operate LLM inference endpoints on any Kubernetes (on-premises, edge, or hyperscaler-managed), with model choice (including NVIDIA NIM-optimized models and open models), secure API endpoints for apps, and data kept in the customer's chosen location. Interaction: a mock "deploy a model endpoint" wizard that shows the resulting architecture. Verify the latest product naming (including newer agentic AI offerings) before copy is final.
- **9.5 Project Beacon.** A short vision slide: write and run applications anywhere with consistent data services, management and mobility across infrastructure. Describe it as a direction, not a shipping feature. Verify current positioning and how it relates to Cloud Native AOS.

---

## 10. Domain knowledge reference (research summary)

Use this as your starting understanding. Confidence tags: **[C]** = corroborated by multiple sources, **[S]** = single source or likely dated, **[K]** = from general product knowledge, needs checking. Everything tagged [S] or [K] is also in Section 11.

**Platform shape**

- A **node** runs a hypervisor (AHV is Nutanix's own; ESXi is also supported) plus a **Controller VM (CVM)** that hosts the AOS services. A **block** is a rack-mountable chassis holding 1 to 4 nodes. CVMs across nodes form a single cluster presenting pooled storage (the **Distributed Storage Fabric, DSF**). [C]
- Constructs: one **storage pool** per cluster (recommended), **storage containers** (policy: RF, compression, dedupe, EC-X), and **vDisks**. [C]
- CVM memory is reserved and not ballooned or swapped. CVM sizing grows when advanced features are enabled. [S]

**AOS services on each CVM** [C unless noted]

- **Stargate**: the data path; serves all VM I/O for its local host, manages caching tiers, and performs synchronous replication to peer CVMs.
- **Cassandra** (heavily modified) via **Medusa**: the distributed metadata store. Strict consistency via Paxos. Fine-grained metadata is what enables extent-level placement and fast detection of exactly which copies are missing after a failure.
- **Zeus / Zookeeper**: cluster configuration. Under RF3, five copies of metadata and Zookeeper are kept; under RF2, three. [C for the five-under-RF3 claim; [S] for three-under-RF2]
- **Curator**: cluster-wide background MapReduce-style jobs, run by an elected master. Tasks include re-replication after failures, disk balancing, ILM tiering, EC-X encoding, garbage collection and scrubbing.
- **Genesis**: service manager. **Prism**: UI/API, reachable via any CVM IP. **Acropolis**: AHV VM management, scheduling (ADS) and HA. [K for Acropolis details]

**Data path** [C]

- Storage is divided into **OpLog** (fast-tier write buffer for bursty random writes) and **Extent Store** (bulk persistent storage across tiers). Writes are characterized: sequential and sustained random go direct to extent store; bursty random enters OpLog, is coalesced, and drains sequentially.
- OpLog writes are **synchronously replicated** to the OpLog of one (RF2) or two (RF3) remote CVMs, dynamically chosen; all CVMs participate; ack follows all copies.
- Sequential detection: more than about **1.5 MB outstanding write I/O per vDisk** bypasses OpLog (documented around AOS 4.6; may differ now). [S]
- Reads come from the **Unified/Content Cache** (memory plus SSD; single-touch then multi-touch pools), or from OpLog if not yet drained, or the extent store. [C]
- **Data locality:** a VM's data is served from its local node; one replica is written locally; after live migration, reads go remote at first and extents are localized on access. [C]
- **ILM** places hot data on faster tiers and migrates cold data down (hybrid) or manages it across NVMe/SSD. [C]

**Replication factor and resiliency** [C]

- RF2: 2 data copies, minimum 3 nodes, tolerates 1 node or disk failure. RF3: 3 copies, minimum 5 nodes, tolerates 2. The default is RF2. Conversion RF2 to RF3 is online and needs spare capacity.
- Failure domains: disk, node (default), block, rack. Block awareness places replicas on nodes in different blocks; a commonly cited minimum is 3 blocks for RF2 and 5 for RF3 [S]. Rack awareness is configured manually; RF2 tolerates one rack, RF3 two. [C]
- Sizing guidance for self-healing: RF2 clusters N+1 minimum (consider N+2 above about 24 nodes); RF3 N+2; with block awareness and 4 nodes per block, tolerate-a-block-and-self-heal needs N+4 under RF2. A published rule of thumb is that RF3 self-healing from two sequential node failures needs about 7 nodes (6 for one failure). [S, community expert source; verify]

**Erasure coding (EC-X)** [C unless noted]

- Reed-Solomon-style parity strips across nodes, applied post-process to **write-cold** data only, driven by Curator. Not content-dependent like dedupe; it depends on overwrite behavior.
- Requires at least 4 nodes [C]; RF3-based EC-X minimum may be higher [S]. Overhead examples: 4/1 = 1.25x vs RF2's 2x; 4/2 = 1.5x vs RF3's 3x. Larger strips than 4/1 give diminishing returns and costlier rebuilds. Flexible strip sizes and newer encoding behavior exist in current releases. [S]
- Practical sizing guidance is to assume only a fraction (roughly 50 to 80 percent) of the theoretical saving. [S]

**Failure behavior** [C]

- Detection triggers Curator to find under-replicated extents and rebuild them across all surviving nodes (many-to-many), not into one spare, so per-disk and per-node impact is small versus RAID rebuild.
- Node failure: VMs restart via HA on survivors. AHV HA is best-effort by default; enabling HA reserves memory for guaranteed restarts (configurable number of host failures to tolerate). ADS (dynamic scheduling) is on by default.
- CVM failure: hypervisor stays up; **autopathing** redirects I/O to remote CVMs. [K, widely documented; verify wording]
- Background **disk scrubbing and checksums** detect and fix integrity issues proactively. [C]
- The cluster remains compliant with its configured RF during maintenance and failures for new writes. [S, vendor-authored, treat as positioning]
- Status model: Critical while under-replicated; "rebuild capacity available" indicates whether a full self-heal is possible. [C]

**LCM** [C]

- Inventory then update; manages multi-component upgrades and ordering. Supports AOS, AHV, Prism, Files, Foundation and component firmware on Prism Element; Prism Central handles items such as Objects and Kubernetes components. Hardware vendors include Nutanix NX, Dell, HPE, Lenovo, Fujitsu, Cisco and others (verify current matrix).
- Firmware or hypervisor upgrades proceed **one node at a time**: VMs are migrated off, host is placed in maintenance mode, then upgrade; LCM verifies services up and data resiliency before the next node. Pre-checks abort if resiliency is degraded.
- Older published figures: about 15 minutes per node for AOS, 25+ minutes for AHV under load. Treat as illustrative defaults only. [S, dated]

**Data protection and DR** [C]

- Policy-based on RPO: Async at 60 min or more; NearSync 1 to 15 min; Sync at 0 with under 5 ms round-trip. Marketing summary: Metro 0 RPO/0 RTO, NearSync 1 min, Async 1 hr. Multi-site topologies supported (example from Nutanix: A-B sync, A-C near-sync with about 20 s RPO, A-D async with about 30 min RPO; verify which products and hypervisors those numbers apply to).
- Constructs: protection policies, recovery plans, categories; Witness for automated sync failover. Older "vStore" 20-second replication applies to ESXi. [S]

**Flow** [C]

- Flow Network Security: application-centric microsegmentation and a stateful distributed firewall, with policies on categories not IPs. Flow Virtual Networking: overlay VPCs, subnets, routing, NAT, VPN across edge, on-premises and cloud sites, with no physical network changes. Control plane (Flow controller) separate from forwarding plane (AHV hosts and gateway VMs). Extends to containers on NKP. Policy modes (monitor/enforce) and types (application, isolation, quarantine) are [K].

**AHV networking** [C]

- Open vSwitch in each host; default `br0` with bond `br0-up`; native Linux bridge `virbr0` for the internal host-CVM path; bonds aggregate uplinks; recommended default is CVM and host on untagged/native VLAN; `manage_ovs` utility on the CVM manages OVS; bond modes include active-backup (default) and balance-slb among others.

**Platform services from the reference slide**

- **Prism Element** (per cluster) and **Prism Central** (multi-cluster, runs as VM(s); hosts Self-Service, LCM, DR, Flow policy management). [C]
- **Nutanix Cloud Manager (NCM)** (formerly Prism Pro, Calm, Beam, Security Central): AIOps, self-service and orchestration, cost governance (metering, showback, budgeting; cost data kept in the customer's infrastructure per 2026 announcement), security. License tiers (Starter/Pro/Ultimate) gate features. [C]
- **Unified Storage:** Files (FSVMs, single namespace, SMB/NFS, volume groups with iSCSI vDisks, FSVM failover takes over ownership), Volumes (iSCSI block), Objects (S3). [C]
- **Data Lens:** data governance and security analytics. Version 2.0 reported GA with fully on-prem and air-gapped operation in 2026. [S]
- **NDB:** Time Machine (app-consistent snapshots plus continuous log backups), thin clones from AOS snapshots, DBaaS provisioning and patching; engines include Oracle, PostgreSQL, SQL Server, MySQL, MongoDB. [C, verify list]
- **Cloud Native AOS:** AOS storage rearchitected as microservices on Kubernetes (initially on EKS; bare-metal too), no hypervisor required, Kubernetes-API data management, DR across AZs/clouds/on-prem; builds on Nutanix Data Services for Kubernetes (NDK, March 2024). One source says it was "previously known as Project Beacon." Other coverage presents Project Beacon as the broader 2023 vision. [S, verify the relationship]
- **Enterprise AI (NAI):** deploy and run LLM inference endpoints on any Kubernetes; supports NVIDIA NIM and Hugging Face models; part of GPT-in-a-Box 2.0 with NCI, NKP and Unified Storage. 2026 coverage adds "Nutanix Agentic AI." [C for NAI basics; S for 2026 branding]
- **2026 context** (use carefully, verify before including): NKP on bare metal, Smart Tiering for Objects to additional S3 targets, NC2 on the AWS European Sovereign Cloud announced for later in 2026.

---

## 11. Facts to verify before shipping (register)

Create `docs/facts.md` with a row per item: claim, what you found, source URL, date checked, decision.

1. Current OpLog bypass / sequential-write threshold and wording.
2. EC-X minimum node count and strip-size table for **RF3**, and current flexible-strip behavior; write-cold window default.
3. Block-awareness minimum blocks for RF2 and RF3; rack-awareness requirements; behavior with EC-X.
4. Metadata copies under RF2 vs RF3 (3 vs 5) and Zookeeper node counts.
5. Autopathing description and which hypervisors it applies to.
6. AHV HA defaults, reservation behavior, and the "guaranteed" vs "best effort" wording in current AOS.
7. LCM: current supported components, one-node-at-a-time behavior for each component type, pre-check list, and minimum cluster sizes (1-, 2-, 3-node behavior).
8. DR: current RPO ranges, supported topologies, Metro/Witness behavior, sync latency limit (under 5 ms RTT), and which features require which hypervisor or license.
9. Flow: policy types and modes, overlay encapsulation, gateway components, supported routing and VPN features.
10. NC2: which cloud providers are supported today (do not assume Google Cloud).
11. NDB supported database engines.
12. Cloud Native AOS availability, supported platforms, and its relationship to Project Beacon.
13. Data Lens 2.0 capabilities and availability; Enterprise AI and Agentic AI current naming.
14. Fleet management, NCM tier-to-feature mapping, and Prism Federation terminology on the slide ("Federation" may be a marketing label for multi-cluster/Central capabilities).
15. CVM default resource footprint (shown in honest-fit overhead discussions).

If anything cannot be verified, either leave it out or show it with an "Unverified" tag in the dev build and flag it to me. Do not ship guesses.

---

## 12. Phased build plan and definition of done

**Phase 0: Foundation.** Repo scaffold, Vite single-file build, design-token extraction from the reference image, `facts.md` started, CI for tests and a build-size check.

**Phase 1: Shell.** Landing page matching the reference, router, zoom transitions, back/breadcrumb, guided tour, presenter-mode skeleton, scenario URL state, glossary drawer, keyboard shortcuts.

**Phase 2: Engine core.** Cluster model, placement, capacity math, status model, seeded RNG, with the invariant tests from Section 5.

**Phase 3: Cluster & DSF Lab + Data Path + Protection & Capacity.** (7.2, 7.3, 7.4)

**Phase 4: Failure Gauntlet + LCM.** (7.5, 7.6) Rebuild engine, HA restarts, second-failure behavior, upgrade orchestrator with pre-check gating.

**Phase 5: Flow, DR, AHV Networking.** (7.7, 7.8, 7.9)

**Phase 6: P1 modules.** (Section 8)

**Phase 7: P2 modules and extras.** (Section 9 and the Section 4 brainstorm list)

**Phase 8: Polish and QA.** Projector contrast pass, reduced-motion pass, keyboard pass, performance profiling (60 fps with a 32-node cluster), size budget, cross-browser (current Chrome, Edge, Safari, Firefox), print/PNG export, README with presenter tips.

**Definition of done (per module):**

- Matches the visual language; legible at 1080p projected.
- Every control produces an immediate, correct, explained result.
- Engine tests pass for its invariants; Playwright smoke test opens it and runs its main scenario.
- Presenter-mode talk track, three Q&As and an Honest-fit callout are written.
- Every factual claim traces to `docs/facts.md`; simplifications are labeled "Illustrative."
- No console errors; works offline from the single built file.

**Final deliverables:** `dist/index.html`, source, `README.md` (build, edit content, change config, presenter tips), `docs/facts.md`, `docs/decisions.md`, and a short list of known limitations.

---

## 13. Copy and tone guide

- Plain English first, vocabulary second. Define each acronym on first use per module.
- Lead with what the customer cares about (availability, operations effort, risk, cost), then show the mechanism.
- Short sentences. One idea per label. No superlatives you can't back up.
- Use "typically," "depends on workload," and "in current releases" where behavior varies.
- Never disparage competitors by name. If a comparison helps (for example, traditional 3-tier or RAID rebuild behavior), describe the architectural difference neutrally.

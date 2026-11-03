# Changelog

## Unreleased

- **New module, OEM of Your Choice:** the landing's "Any Bare Metal Linux" pane is now "OEM of your choice". The same Nutanix software lands on Nutanix NX and on Dell XC, HPE DX, Lenovo ThinkAgile HX, Cisco Compute Hyperconverged, Fujitsu PRIMEFLEX XF and Supermicro, then clusters on three vendors share one Prism Central, then servers you already own and NC2 in the public cloud. Sources are in `docs/facts.md` section 17.
- **Kubernetes Platform, reworked:** one loop from islands to one operating model: four environments each run their own way, the same work repeated behind each, the NKP layer above them, one policy and one upgrade across the fleet (attached AKS keeps Azure's upgrades), the platform team and a developer on the same road, and the outcome. The landing pane reads "Fleet Management | Security | GitOps".
- **LCM Rolling Upgrade, Kubernetes (NKP) tab:** the NKP fleet rollout (Healthy rollout, Canary fails) moved here from the Kubernetes Platform module.
- **Snapshots & Clones, redrawn:** an admin's day instead of block maps: a snapshot before a patch, a restore when the patch fails, three clones for dev, test and analytics, and a meter of what is stored against full copies, in two colors.
- **Cloud Manager, Self-Service:** one story of four requests (straight through, held by the approval policy, over quota and sent back, re-ordered smaller and created) replaces the Request choice, and the approval box is drawn as an optional side path.
- **Data Security:** one loop plays the same stolen drive with encryption off, the built-in key manager and an external key manager; the stolen-node case and both choices are gone.
- **Migration with Nutanix Move:** the source platforms are a plain list above one animation, like the external storage arrays.
- **Database Service, Provisioning:** high availability only.
- **Unified Storage, Files:** the request dots travel along the drawn lines to the FSVM serving each folder, at an even pace, and the folder outlines when its request lands.
- **Search:** a search box at the top of every page. Type a keyword like "balance tcp", "metro" or "erasure coding" and it opens the module, or the exact tab or choice inside it, with that option outlined. Typos are forgiven, and older names (Calm, Beam) and acronyms (DR, NKP, VPC) work. Press / or Ctrl/⌘ K to search from the keyboard; on phones it is an icon in the top bar.
- **Legacy vs Nutanix HCI tier labels:** COMPUTE, NETWORKING and STORAGE in large type beside the three legacy tiers, until they fold into one node.
- **Legacy vs Nutanix HCI absorbs Scale-Out vs 3-Tier:** top-of-rack Ethernet switches are drawn from the first frame (the 3-tier hosts use them for VM and management traffic, and after the fold they carry the cluster's storage traffic too), data rebalances onto each new node, and a storage-controller count grows with the nodes while the array stays at two. Scale-Out's CVM cost, performance and node-type points moved into its presenter notes, and old Scale-Out links open it.
- **Enterprise AI, Agent Gateway tab:** one address for every model (NAI endpoint, remote NAI cluster, external provider), a fallback when one fails, a rate limit catching a runaway agent, and the MCP Gateway adding API keys, blocking a tool write and logging every call. Sources are in `docs/facts.md` section 16.
- **New module, Legacy vs Nutanix HCI:** the first tile under Nutanix Cloud Infrastructure. A three-tier design (hosts, two Fibre Channel switches, a dual-controller array, a console per tier, and adding a host touching all three) folds into one node, where the array controllers become the CVM and the drives move inside. Three nodes then form one cluster with one storage pool and one Prism, and it grows a node at a time. Sources are in `docs/facts.md` section 14.
- **Consistent controls everywhere:** Space pauses even right after clicking a preset or tab, a new preset starts over instead of landing on a blank frame while paused, and the play bar readout no longer resizes the scrub bar (it reads "Step 2 of 5"). Every tabbed module uses the same tab strip, and the arrow keys move between tabs.
- **Navigation:** Esc, Back and the breadcrumbs step back through history and return focus to the tile you came from. On 1280 px screens the breadcrumb keeps the parent module. Press J to jump to any module. The presenter drawer has "Open …" buttons for the next modules. Top-bar presets now always land on Protection & Capacity's Copies tab at the chosen size, and no longer show on Scale-out.
- **Every module, one style:** the legend sits above the play bar and every play bar carries an Illustrative note; legends list only what the current view draws; pickers share labels ("What happens", "Copies"); every module has three likely questions, presenter steps that end in "Then open …" and matching "Open …" buttons; the Cluster & DSF Lab now has the Gauntlet's clickable step tracker. Three titles changed: Scale-Out vs 3-Tier, Flow: Network Security & Virtual Networking, and Edge & ROBO. Cloud Manager's SecOps tab is now Security. The glossary gained about 50 terms.
- **Facts rechecked:** claims the register did not already cover were checked against Nutanix sources, and 30 were corrected or softened (`docs/facts.md` section 15). NKP 2.19 is now shown as generally available (October 2026), with NKP Metal still in early access.
- **NCI hub:** the tiles come first, in a basics-first order starting with the new Legacy vs Nutanix HCI, and always match their module's title; the node cutaway follows them. Data Security, Cloud Native AOS and the partial-stack module have their own icons.
- **Guided tour:** a new step for "Don’t want the full stack?", the early-access note on bare metal, and a final "Open Nutanix Cloud Infrastructure" button. About is now "About this explorer", with an accurate Simplified list.
- **Theme menu:** the sun/moon button now opens a small menu with Dark and Light, remembered in this browser; T still switches the theme directly.
- **Home page fit:** on 1440x900 and 1536x864 screens the slide tightens its spacing so the footer shows without scrolling, and on any screen the slide is centered in the space above the footer.
- **Icons and polish:** every icon is now from Lucide (license in About). Home tiles have a soft sheen, diagrams sit on a faint dot grid with rounded node boxes, the Explore grid no longer shows a gray block after the last tile, and the node cutaway's "drives passed to the CVM" label is no longer cut off.
- **External storage:** no more array picker. A "Works with" list names the supported arrays (Everpure FlashArray, Dell PowerStore · PowerFlex, NetApp ONTAP), and the animation is the same for every array: "Your Everpure / Dell / NetApp array". The numbers still mark NetApp ONTAP as announced.
- **Footer:** a "Built by" label, then each author's name with their Slack handle under it in Nutanix purple: @Besaw, and @GabeC followed by "on Slack". The version moved beside About. On the home page the footer sits at the bottom of the window when the slide fits, instead of just below it.

## 1.1 (October 2026)

From a coworker review of 1.0. Sources for every new claim are in `docs/facts.md` section 13, and the choices are in `docs/decisions.md` rows 27 to 32.

- **Playback speed:** a 1x button next to Play picks 0.25x to 2x, like YouTube, for every animation. `<` and `>` step it.
- **Arrow keys:** Left and Right scrub the animation in small steps; with Shift they jump to the previous or next caption.
- **LCM Rolling Upgrade:** "Cluster already degraded" is gone. In "A node fails mid-upgrade" nothing hints at the failure until it happens; then HA restarts the VMs, the cluster rebuilds, and LCM holds until the node is repaired and data has caught up.
- **Disaster Recovery:** NearSync and Sync are one choice. New Metro Availability choice: sync replication under 5 ms round trip plus a Witness, with automatic failover that restarts the VMs, and live migration for a planned move.
- **Edge & ROBO:** "Nodes lose contact" now works on two and three nodes. New "Add a node": a single node can't be expanded, two nodes can grow to three from AOS 7.6, three nodes use Expand Cluster.
- **External storage:** NetApp ONTAP is a fourth array, over NFS. It is marked as announced, because it was not generally available yet as of October 22, 2026.
- The footer and About show the version, and the footer credit is larger.

## 1.0 (October 2026)

The first shared release: the landing slide and its modules, the Cluster & DSF Lab and the Failure Gauntlet, with the documentation review caveats and the replication factor and rebuild space recheck.

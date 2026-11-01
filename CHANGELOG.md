# Changelog

## Unreleased

- **New module, Legacy vs Nutanix HCI:** the first tile under Nutanix Cloud Infrastructure. A three-tier design (hosts, two Fibre Channel switches, a dual-controller array, a console per tier, and adding a host touching all three) folds into one node, where the array controllers become the CVM and the drives move inside. Three nodes then form one cluster with one storage pool and one Prism, and it grows a node at a time. Sources are in `docs/facts.md` section 14.
- **Home page liquid glass:** the home slide's tiles are liquid glass rendered with liquidGL over a glowing gradient, keeping each tile's purple. It runs only on a hardware GPU and outside embedded previews; with reduced transparency, more contrast or forced colors the tiles stay solid. liquidGL's license is in About. In dark mode the backdrop is near black with faint glows, the tiles keep light mode's purple hierarchy as colored glass, the cloud and bare-metal tiles are smoky glass with AWS's white wordmark, and the rims are finer.
- **Consistent controls everywhere:** Space pauses even right after clicking a preset or tab, a new preset starts over instead of landing on a blank frame while paused, and the play bar readout no longer resizes the scrub bar (it reads "Step 2 of 5"). Every tabbed module uses the same tab strip, and the arrow keys move between tabs.
- **Navigation:** Esc, Back and the breadcrumbs step back through history and return focus to the tile you came from. On 1280 px screens the breadcrumb keeps the parent module. Press J to jump to any module. The presenter drawer has "Open …" buttons for the next modules. Top-bar presets now always land on Protection & Capacity's Copies tab at the chosen size, and no longer show on Scale-out.
- **Every module, one style:** the legend sits above the play bar and every play bar carries an Illustrative note; legends list only what the current view draws; pickers share labels ("What happens", "Copies"); every module has three likely questions, presenter steps that end in "Then open …" and matching "Open …" buttons; the Cluster & DSF Lab now has the Gauntlet's clickable step tracker. Three titles changed: Scale-Out vs 3-Tier, Flow: Network Security & Virtual Networking, and Edge & ROBO. Cloud Manager's SecOps tab is now Security. The glossary gained about 50 terms.
- **Facts rechecked:** claims the register did not already cover were checked against Nutanix sources, and 30 were corrected or softened (`docs/facts.md` section 15). NKP 2.19 is now shown as generally available (October 2026), with NKP Metal still in early access.
- **NCI hub:** the tiles come first, in a basics-first order starting with the new Legacy vs Nutanix HCI, and always match their module's title; the node cutaway follows them. Data Security, Cloud Native AOS and the partial-stack module have their own icons.
- **Guided tour:** a new step for "Don’t want the full stack?", the early-access note on bare metal, and a final "Open Nutanix Cloud Infrastructure" button. About is now "About this explorer", with an accurate Simplified list.
- **Theme menu:** the sun/moon button now opens a menu with Dark, Light and a Liquid glass switch for the home page, remembered in this browser. Where the glass can’t run, the switch is greyed out and says why.
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

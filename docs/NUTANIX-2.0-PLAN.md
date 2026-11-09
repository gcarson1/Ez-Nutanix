# Nutanix 2.0: visual plan

Audit date: 2026-11-09, against commit 17751ed. Every page was screenshotted at 1440x900 in the dark theme, eight pages in light, four at 390 px wide.

Owner decisions and the owner's fact review (2026-11-09) are folded in: see section 7. Where a page task below carries a **Fact scope** line, that wording is required, not optional.

This is a work order. Each task says what is wrong today, what to change, which files, and how to tell it is done. Tasks are small on purpose. Do them in the order given: later tasks assume earlier ones.

## 0. Rules for whoever implements this

1. One task per commit. Commit message starts with the task ID (`N2-014 ...`).
2. After every task run all three, and do not move on if any fails:
   - `npm test`
   - `npm run build`
   - `PW_CHROMIUM="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx playwright test --workers=3`
3. Take a before and after screenshot of every page the task touches (1440x900, both themes) and look at them. A task is not done because the tests pass; it is done when the screenshot matches "Good looks like".
4. Do not add a product claim, number, version or vendor name that is not already in `docs/facts.md`. If a task needs a new fact, stop and list it as a question for the owner. Behavior that holds only for one hypervisor, release, policy or deployment must be labeled as that case on screen ("on AHV", "example 4+1 strip", "when the recovery plan orders it"), never drawn as how Nutanix always works.
5. Do not change what an animation teaches unless the task says so. Most tasks change how it looks, not what happens.
6. Every tab and choice must stay listed in `src/content/scenes.ts` (a smoke test checks this). If you rename or remove a control, update that file in the same commit.
7. The build is one HTML file with no external requests and a 2 MB limit. Fonts and images must be embedded. No CDN links.
8. Never use color alone for status. Keep the icon and the word.
9. If a task turns out to be bigger than about 300 changed lines, stop and split it.

Where things live:

| Thing | File |
|---|---|
| Colors, type scale, spacing | `src/styles/tokens.css` |
| Fonts, base elements | `src/styles/base.css` |
| Shell, layout, shared classes | `src/styles/app.css` |
| Home page | `src/ui/shell/Landing.tsx` |
| Top bar, footer, dialogs | `src/ui/shell/App.tsx` |
| Module layout pieces | `src/ui/components/show.tsx`, `controls.tsx`, `StepTracker.tsx` |
| One module | `src/ui/modules/<name>/index.tsx`, `content.ts`, `style.css` |

## 1. What is wrong overall

The content is strong. The look is not yet enterprise software. It reads as a generated dark-mode demo, for these reasons:

- **One recognisable template.** Near-black background, one violet accent on everything, Inter plus JetBrains Mono, uppercase letter-spaced labels above every block, big monospace green numbers, a dot-grid behind each diagram, dashed outlines, numbered cards that light up, a colored bar on the left of every caption, a round floating button bottom-right. Any one is fine. All of them together on every page is the tell.
- **No hierarchy.** Purple marks brand, selection, the CVM, data, links and headings all at once. When everything is accent, nothing is.
- **Two different page layouts.** Cluster Lab and Failure Gauntlet have a right-hand panel and clickable steps. Every other module puts the caption under the play bar, far from the picture. Users relearn the page each time.
- **The picture starts too low.** On a 900 px tall screen the header, tabs, choices and cards use 350 to 530 px before the diagram begins. On Cloud Manager's Cost tab the chart starts at y=530 and the caption is off screen.
- **Diagram text sizes are random.** LCM's labels render at about 20 px, Cluster Lab's VM labels at about 9 px, on the same screen width.
- **Abstract stand-ins.** Data is drawn as circles, triangles, stars and pentagons (Protection & Capacity, AHV Networking) or as anonymous purple squares (DR, Cloud). A storage architect expects extents, vDisks, volumes, VMs with names.
- **Empty containers.** Node and drive boxes are mostly blank space with a few tiny tiles at the bottom.

### What good looks like, in one paragraph

It should look like a vendor's own technical console or design tool: Prism Central, the AWS architecture icons, a Grafana panel. Calm neutral surfaces. One accent used only for "selected" and "the thing this step is about". Text you can read from the back of a room. Every page with the same skeleton, so the eye goes straight to the picture. Diagrams that use the real names of real parts, drawn the same way on every page.

## 2. Phase A: design system (do first, global)

### N2-001 Neutral-first palette
- **Now:** `--ink` (#7855fa) is the brand, the selected state, the CVM fill, data blocks, links and heading eyebrows. Backgrounds are #0a0a0d, almost pure black.
- **Change:** in `tokens.css`, dark theme: `--bg` #14161a, `--bg-2` #1b1e24, `--bg-3` #242830, `--line` #2c3038, `--line-2` #3d424d. Cool grey, not black-violet. Light theme: `--bg` #f4f5f7, `--bg-2` #ffffff, `--bg-3` #eceef2. Keep `--ink` as the Nutanix purple but add `--accent` (same value) and `--part-cvm` (#5b6ee1, a calmer blue-violet) and `--part-data` (#8a93a6, neutral). Then, module by module in Phase C, move CVM fills to `--part-cvm` and data blocks to `--part-data`. `--ink`/`--accent` stays only on: selected tab or button, focus ring, the single element the current step is about.
- **Good looks like:** squint at any page and you see at most one or two purple things. Light theme becomes the default (N2-003).
- **Check:** grep shows `.ink-fill` used in no more than one element per diagram frame.

### N2-002 Typeface (owner decision: Montserrat main, Arial alternate)
- **Now:** Inter for text, JetBrains Mono for every number, IP, label and KPI.
- **Change:**
  - Embed Montserrat (500, 600, 700; it is open-licensed, so it can ship in the file) the same way Inter is embedded in `base.css`, and remove Inter. Montserrat is the face for titles, headings, tab and button labels, box titles in diagrams and key-number values.
  - Arial is the alternate: it is a system font, so do not embed it. Set `--font: 'Montserrat', Arial, Helvetica, sans-serif` and add `--font-alt: Arial, Helvetica, sans-serif`. Use `--font-alt` for long running text (captions, step text, Q&A, tooltips) and for the two smallest diagram sizes (11 and 12 px), because Montserrat is wide and gets hard to read small.
  - Keep one mono (the existing JetBrains Mono, 400 only) for literal machine text only: IP addresses, paths, version strings, log lines. KPIs, step counters, axis labels and node names are not mono; use `font-variant-numeric: tabular-nums`.
- **Good looks like:** headings look like Nutanix's own slides (Montserrat); body text is plain Arial; no monospace anywhere a human-language word or a plain count appears.
- **Check:** `.kpi .v`, hub tile categories, "Step 4 of 10", "v1.1" are not mono. No diagram label is clipped by its box after the font change (Montserrat runs about 10% wider than Inter): screenshot every module. Build stays under 2 MB.

### N2-003 Light theme is the default (owner decision: yes)
- **Now:** dark is default ("projector-first").
- **Change:** default to light unless `localStorage nax-theme` is `dark`. Dark stays available. Fix every SVG that hard-codes `#fff` text (search for `fill: '#fff'` and `fill: #fff`) to use a token that works in both.
- **Good looks like:** the light theme is the one every screenshot in this plan is judged on. It should look like a product, with white cards on a light grey page and 1 px borders.

### N2-004 Remove the decoration set
Remove, everywhere:
- the dot-grid background behind diagrams (`.diagram-scroll` background in `app.css`);
- the gradient and sheen on home tiles;
- the left color bar on captions (`.follow`), replaced in N2-010;
- the dashed "ILLUSTRATIVE" badge on every play bar. Replace with a small `i` button, same tooltip text, same accessible name;
- the uppercase letter-spaced eyebrow above every module title (the breadcrumb already says it);
- uppercase letter-spaced labels inside SVGs (`ONE NODE`, `CLUSTER NETWORK`, `MODEL PROVIDERS`, `DATA CENTER`...). Use sentence case, 12 px, medium weight, `--muted`.
- **Keep** uppercase only for the small control labels (`WHAT HAPPENS`, `COPIES`) but drop letter-spacing to 0.04em and size to 11 px. Or, better, sentence case at 12 px.
- **Good looks like:** diagrams sit on a plain surface inside a 1 px bordered card.

### N2-005 Dashes mean one thing
- **Now:** dashed outlines mean failed, planned, optional, standby, a group, a boundary, and "room to grow".
- **Change:** dashed = "not there yet or not there any more" (empty slot, planned, removed). Failed = solid `--bad` border plus the X icon and word. Groups and boundaries = solid 1 px `--line-2` with a label. Optional = solid, with the word "optional".
- **Check:** list every `stroke-dasharray` and `dashed` in `src/`, and for each say which meaning it has. Fix the rest.

### N2-006 One radius, one border, one shadow
- Radius 6 px for cards and boxes, 4 px for small chips, 0 for nothing. Today SVG boxes are square, tiles are 14 px, cards 8 px.
- Border 1 px `--line-2` on every card. No glow, no colored borders except selected (`--accent`) and status.
- One shadow, used only on popovers and dialogs.

### N2-007 Diagram type scale
- **Now:** each SVG picks its own sizes and its own rendered width.
- **Change:** every module diagram has `viewBox` width 960 and renders at most 960 CSS px wide, so 1 unit = 1 px. Allowed text sizes inside diagrams: 11 (fine print), 12 (secondary), 13 (labels), 15 (box titles). Nothing else. Add four classes in `app.css` (`.d-fine`, `.d-sub`, `.d-label`, `.d-title`) and replace inline `fontSize` styles.
- **Good looks like:** LCM node titles and Cluster Lab node titles are the same size. No label is under 11 px.
- **Check:** grep for `fontSize:` in `src/ui/modules` returns nothing.

### N2-008 Shared part glyphs
Create `src/ui/components/parts.tsx` with small SVG components, each drawn once and used everywhere:
- `VmBox` (rounded rect, name inside, optional status dot),
- `CvmBox` (same shape, `--part-cvm` fill, label "CVM"),
- `Drive` (a short wide rectangle with a notch, label "SSD"/"NVMe"/"HDD", a fill bar showing how full),
- `NodeFrame` (title, status word, slots for VMs, CVM, hypervisor strip, drives),
- `Switch` (wide bar with port ticks),
- `DataBlock` (labeled extent, see N2-009).
Then replace the per-module copies. Do this module by module in Phase C, not in one commit.
- **Good looks like:** a node looks the same on Legacy vs HCI, Cluster Lab, Failure Gauntlet, LCM, Edge, Cloud, External storage.

### N2-009 Replace abstract data shapes
- **Now:** circle, square, triangle, diamond, plus, pentagon, hexagon, star stand for "pieces of data" (`capacity/shapes.tsx`), and for "which VM a packet belongs to" (network).
- **Change:** a piece of data is a `DataBlock`: a 22x16 rounded rectangle with a short label (`A`, `B`, `C`... or `A1`, `A2` for copies; `P` for parity). Copies of the same piece share the letter and a tint from a fixed 8-step neutral-to-blue ramp, so they can be matched by letter first, tint second. Packets in AHV Networking are small rectangles labeled `VM1`, `VM2`, `CVM`.
- **Good looks like:** a viewer can say "block C has copies on N1 and N3" without a legend.

## 3. Phase B: one page skeleton

### N2-010 One module layout
- **Now:** two layouts (`.lab.two` with a right rail; `.show` with top/stage/foot).
- **Change:** every module uses this skeleton, built once in `show.tsx`:

```
┌ top bar ───────────────────────────────────────────────┐
│ Title (20px, one line)        tabs (if any)            │
├───────────────────────────────┬────────────────────────┤
│ controls row (choices)        │ Steps (numbered list,  │
│ ┌ diagram card ─────────────┐ │  current one expanded  │
│ │                           │ │  with its caption)     │
│ │                           │ │                        │
│ └───────────────────────────┘ │ Key numbers (2 to 4)   │
│ legend · play bar             │ Why it matters (1 para)│
└───────────────────────────────┴────────────────────────┘
```

  - Left column 2/3, right panel 320 to 360 px. Under 1100 px wide the panel drops below the diagram.
  - The module summary moves into the right panel under "Why it matters", or into a tooltip on the title. It no longer sits above the picture.
  - The caption is the expanded current step in the Steps list. Remove the separate `Follow` block under the play bar.
  - Every module gets clickable steps (today only Cluster Lab and Gauntlet do). The steps come from the same arrays that already feed `paced(...)`.
  - "Numbered cards that light up" (`Points`) are removed as a separate strip. Their content becomes the step list or "Why it matters".
- **Good looks like:** at 1440x900 the title, controls, whole diagram, play bar, current caption and key numbers are all visible with no scrolling, on every module. The diagram's top edge is no lower than y=200.
- **Check:** add a smoke test that, for every module, asserts `.diagram` top < 220 and `.playbar` bottom < 900 at 1440x900.

### N2-011 Key numbers
- **Now:** 24 px monospace, colored green/amber/red.
- **Change:** label 12 px muted; value 18 px sans semibold in normal text color; status shown by a 8 px dot plus icon before the value, not by coloring the whole number. Max four per module. Sub-labels only when they add a fact.

### N2-012 Controls
- Segmented buttons: 32 px high, 13 px text, selected = `--accent` 1 px border and tinted background, not a solid purple block.
- Replace the native `<select>` "Presets…" in the top bar (Protection & Capacity) with the same menu component the speed and theme menus use, or remove presets from the top bar and put them in the module's controls row.
- At most two control groups per module, at most five options per group. Where a module has more (Edge has 3 + 6), see its page task.

### N2-013 Top bar and footer
- Top bar: app name, breadcrumb, search, then icons. Give each icon button a text tooltip and a visible label at widths over 1280 ("Notes", "Glossary", "Shortcuts"). Four unlabeled icons in a row is a guessing game.
- Footer: one line. `v1.1 · About · Built by Alex Besaw and Gabriel Carson` on the left, the disclaimer in a tooltip on "About". The current three-column footer takes 110 px on every page.
- Remove the floating round tour button. Put "Take the tour" as a text button on the home page next to the headline. On phones it currently covers the Cloud Native AOS tile.

### N2-014 Phone layout
- Diagrams currently shrink into a horizontal scroller where labels are 5 to 6 px tall (Cluster Lab at 390 px). Set a minimum rendered scale so 11 px diagram text never renders under 10 px; let the card scroll sideways with a visible "scroll" fade on the right edge.
- Stack: title, controls, diagram, play bar, steps, numbers.

## 4. Phase C: page by page

Each page task assumes Phases A and B are done. "Depth" items need the owner's sign-off on facts before building.

### N2-020 Home
- **Now:** twelve purple gradient tiles of equal weight. "Project Beacon" floats as loose text with no tile. Short vertical stubs between rows connect nothing in particular. The cloud-logo and OEM tiles are light grey on a black page. Headline in Title Case.
- **Change:**
  - Draw it as a labeled stack. Four bands with a band name down the left edge: **Manage** (Nutanix Central), **Data and AI services**, **Infrastructure** (NCI), **Runs on** (your hardware, public cloud). The partial-stack row is not a layer: see the "Start smaller" strip below.
  - Tiles are neutral cards: icon, name, one line saying what you will see ("Watch a node fail and the cluster heal"). Purple only on hover and focus.
  - Give Project Beacon a normal tile with a "Vision" tag, or move it to the footer of the services band as a text link. Not loose text.
  - Remove the connector stubs. The band order already says "above/below".
  - The public cloud tile reads "Public cloud · NC2" (Nutanix Cloud Clusters on AWS, Azure, Google Cloud), not public cloud in general. "Start smaller" is drawn as a separate strip under the stack with its own heading, not as a fifth layer of the architecture.
  - Vendor logos on the hardware tile: see N2-044.
  - Headline in sentence case, 28 px, left aligned above the stack, with "Take the tour" beside it.
- **Good looks like:** a reference architecture diagram from a vendor's docs, not a row of buttons.

### N2-021 NCI hub
- **Now:** 13 equal tiles in a 3-column grid, so the last row has one orphan. The "What's in a node" cutaway is below the fold. Category words in mono.
- **Change:** group tiles under four headings: **Foundations** (Legacy vs HCI, Cluster & DSF Lab, Data Path), **Protection** (Protection & Capacity, Snapshots & Clones, Failure Gauntlet, Disaster Recovery, Data Security), **Operations** (LCM, Migration, Edge & ROBO), **Networking** (AHV Networking, Flow). Put the node cutaway at the top right beside the intro so it is the first thing seen. Drop the per-tile category word.

### N2-022 Legacy vs Nutanix HCI
- **Bugs seen:** the diagram is pushed right with a dead 200 px gutter on the left at steps without tier labels. The Distributed Storage Fabric band covers Nodes 1 and 2 and stops a third of the way into Node 3. The "Storage controllers" strip floats in empty space under the diagram.
- **Change:** center the cluster. The DSF band must span exactly the drives of every node present. Move the storage-controller comparison into Key numbers. Use `NodeFrame`.
- **Depth:** on the 3-tier side label real parts (HBA, FC switch A/B, controller A/B, disk shelves) and count the things to manage (zoning, LUN masking, multipath) as a short list that empties when it folds.
- **Fact scope:** head the left side "A typical three-tier design". Legacy architectures differ by vendor.

### N2-023 Cluster & DSF Lab
- **Now:** data tiles are 10 px squares, dim, at the bottom of drive boxes that are 80% empty. Hard to see which tiles belong to which VM.
- **Change:** drives become `Drive` glyphs half as tall with tiles filling them. Tiles are `DataBlock`s labeled with the VM number. On hover or step focus, the VM and all of its blocks highlight together and everything else dims to 40%. Rebuild arcs: draw at most six at a time and bundle the rest into one thicker "N more" arc; today 15 crossing arcs under the nodes are unreadable.
- **Depth:** add a sixth story, "CVM fails": the host's storage I/O is redirected to a CVM on another node and the VMs keep running.
- **Fact scope:** the mechanism depends on the hypervisor (`docs/facts.md` HA-3). The lab is an AHV cluster, so the caption says "On AHV, iSCSI redirection sends the host's I/O to another CVM". Mention in the fine print that ESXi and Hyper-V do the same job with CVM autopathing. Never call the AHV mechanism autopathing.

### N2-024 Data Path
- Best depth on the site. Keep the content.
- **Fact scope:** label the cache "Unified Cache". The OpLog is not on every path (large sequential writes skip it, which the module already shows); do not draw it lit on steps that bypass it.
- **Change:** five nodes each repeating four identical boxes is heavy. Show full CVM internals (Stargate, cache, OpLog, Extent store) only on nodes taking part in the current step; collapse the others to a one-line "CVM" bar. Use the shared skeleton.

### N2-025 Protection & Capacity (all three tabs)
- **Now:** nodes are large empty boxes holding two or three shapes. The capacity bar is detached at the bottom.
- **Change:** `DataBlock`s with letters (N2-009). Each node gets a simple fill bar showing how full its drives are. The split into your data, extra copies and rebuild reserve stays a cluster-level bar (it is not a per-node accounting model); move that bar up beside the diagram and put example sizes in TB on it from a node size the engine already uses.
- Erasure coding tab: draw the strip as one row, `A B C D | P`, above the nodes, with lines to where each member lives. Today the ring-and-P notation needs the legend to decode.
- **Fact scope:** title the strip "Example 4+1 strip" (and "Example 4+2" for RF3). Strip width depends on the configuration and cluster size; say so in the fine print.
- Blocks and racks tab: draw blocks as chassis outlines containing nodes; VMs as `VmBox` with names.

### N2-026 Failure Gauntlet
- Use `NodeFrame`. Same arc-bundling rule as N2-023. The Outcome list in the right panel is good; make that pattern (three checkmarked outcomes) part of the shared skeleton for every module that has a failure story.

### N2-027 LCM Rolling Upgrade
- **Now:** text is about 20 px, twice the rest of the site. Empty checkbox-like squares under each node are VMs but look like form controls.
- **Change:** apply the type scale. VMs as `VmBox`. Show the version on each part as a small tag that flips old to new.
- **Depth:** add the stages before the rolling part as a 4-step strip above the timeline. Light each as it runs.
- **Fact scope:** name the stages exactly: "Inventory and framework update", "Pre-checks", "Download and stage", "Upgrade". Inventory can update the LCM framework itself before the pre-checks run. The order of components is set by their dependencies; label the AOS-then-AHV order shown as "this example".

### N2-028 AHV Networking
- **Bug:** the counter reads "Step 1 of 1".
- **Now:** left-heavy; the right 40% is two boxes.
- **Change:** rebalance to three columns: host (VMs, CVM, bridge `br0`, bond `br0-up`), the two NICs, the two switches. Packets labeled, not shapes.
- **Depth:** show VLAN tags on VM vNICs and name the bridge and bond as AHV does (`br0`, `br0-up`). Add steps so each bond mode has a walk-through (traffic flows, a link fails, traffic moves).
- **Fact scope:** no Geneve on this page. This is VLAN-backed networking.

### N2-029 Flow
- Network Security: boxes have a double border (outer policy outline plus inner box). Use one box with a small "policy" shield icon on its corner. Show the policy as a three-row table in the right panel with the row being evaluated highlighted. That table is the technology; today it is invisible.
- **Fact scope (policy table):** columns are Direction, Source category, Destination category, Protocol, Port, Action. Title it "Application policy (example)". Flow has several policy types with different fields, so do not present these columns as every policy.
- Virtual Networking: fine structurally. Apply the type scale; label the encapsulation (Geneve) on the packet only while it crosses the physical network between hosts, on this overlay (VPC) tab only.

### N2-030 Disaster Recovery
- **Now:** twenty anonymous purple squares per site stand for "data the apps wrote". No protection policy, no recovery plan on screen, although the summary talks about both.
- **Change:** show three named VMs per site with their disks. Draw two separate cards and never merge them: **Protection policy** above the link (schedule, RPO, retention: it decides what is replicated and how much can be lost) and **Recovery plan** on the recovery site (stages and boot order: it decides how the apps start). On failover the recovery plan's stages tick off as each powers on.
- **Depth:** an RPO timeline strip under the sites: recovery points as ticks, the failure as a marker, the gap between them shaded.
- **Fact scope:** RPO labels are ranges: Async "1 hour or more", NearSync "1 to 15 minutes", Sync and Metro "zero". Label the boot order "Stages in this recovery plan: 1 Database, 2 App, 3 Web"; it is an order the admin configures, not automatic.

### N2-031 Edge & ROBO
- **Now:** the most crowded page. Three site sizes, six events, a diagram, then a 6-row, 3-column table with a colored pill in every cell.
- **Change:** make the table the control. It becomes the top of the page: clicking a cell selects that size and event and plays it below. Remove the two button groups. Pills become icon plus word in normal text.

### N2-032 Data Security
- **Depth:** the animation shows scrambled blocks, which is correct but shallow. Add a small key hierarchy in the right panel and light the path as a block is written.
- **Fact scope:** two different pictures, switched with the act. Built-in (local) key manager: DEK, wrapped by KEK, wrapped by the master key (MEK) the cluster holds. External key manager: DEK, wrapped by a KEK that the external key server holds; no MEK. Do not draw an MEK in the external case. Add facts rows with sources before building.

### N2-033 Migration with Nutanix Move
- Fine. Apply skeleton and glyphs. Add the snapshot step: the seed copy is taken from a hypervisor snapshot of the source VM, and later syncs use changed block tracking (owner confirmed).
- **Fact scope:** label the box "Move appliance" without saying VM. On-premises it is a VM; for AWS sources it can be an EC2 instance.

### N2-034 Nutanix Central & Prism Federation
- One of the cleanest pages. Apply skeleton. The outer dashed "in view" frame becomes a solid tinted region (N2-005).
- **Fact scope:** keep Prism Central boxes fully drawn and active in the Nutanix Central view. Nutanix Central sits over many Prism Centrals; it does not replace them.

### N2-035 Cloud Manager
- AIOps and Cost charts are good. Give both a proper chart frame: axis titles ("CPU %", "Spend"), lighter gridlines, annotation labels that never overlap the series (the two "Unusual for this hour" labels sit on the line today).
- Self-Service: after N2-010 the four request cards become the step list. The approval detour stays.
- **Fact scope:** show the release in Key numbers on every tab ("Shown: NCM 2.1"). NCM is being re-platformed and its services are not all deployed the same way.
- Security: five tiles and a donut is thin for a compliance tool. Show a findings table instead (Check, Severity, Status, Fix) with the donut as a small summary beside it.

### N2-036 Kubernetes Platform
- The six scene cards across the top take 150 px and repeat the caption. They become the step list.
- Islands use four greys and four shapes for tools. Simplify: each island shows a short text list of its own tools ("upgrade script v3", "Prometheus", "ticket queue") that is visibly different per island. Text differences read faster than shape differences.
- **Depth:** in the NKP layer, name components under each capability band: Cluster API, Flux, Prometheus and Grafana, Velero.
- **Fact scope:** head them "Example components" and add the fine print "what is included and on by default depends on the NKP release and edition". Add a facts row per component for NKP 2.19 before building; drop any you cannot source.

### N2-037 Data Lens
- Ransomware tab: apply skeleton.
- Tiering tab: file cells are empty rectangles. Put a tiny "last opened" age in each (`2d`, `45d`, `200d`) so hot/warm/cold is readable without color.
- **Fact scope:** label the heat levels "example thresholds, set by you".

### N2-038 Unified Storage
- Files: the three FSVM boxes are fine. Chips become file-share rows with a small folder icon.
- Objects: the "older ... newer" strip of dashed slots is abstract. Draw a bucket as a list of object rows with ages.
- **Fact scope (Objects):** show it as one named lifecycle rule on the bucket, written out on screen: "Lifecycle rule (example): transition objects older than 30 days to an S3-compatible tier". Only rows matching the rule move, and the bucket keeps their metadata (`docs/facts.md` TIER-1 to TIER-3). Do not show objects moving with no rule in view, and do not imply every bucket tiers.
- Volumes: apply skeleton.

### N2-039 Cloud Native AOS
- **Now:** a choice, a warning line, three cards, then the diagram, so the picture starts at y=480.
- After N2-010 this resolves itself. Also: the "NDK app snapshot" bar is nearly invisible until its step; hide it until then instead of ghosting it.
- **Fact scope:** open question for the owner: is "NDK application snapshot" the right term, and may it be called application-consistent? `docs/facts.md` CNA-6 supports "the app as one unit: Kubernetes resources and volume data". Keep that wording until answered.

### N2-040 Database Service
- Apply skeleton. Time Machine timeline is good; give it axis labels and make the log-catch-up ticks visible.

### N2-041 Enterprise AI
- Model endpoint: half the frame is empty and a GPU is a purple hexagon. Draw each replica as a pod on a named GPU node, with the GPU as a labeled chip showing memory used (model size vs GPU memory). That makes "full GPU or MIG slice" visible: show one small model on a slice next to a large one on a whole GPU.
- **Fact scope:** the chip shows "GPU memory allocated" against the GPU's or slice's capacity (for example "MIG slice 12 GB of 48 GB"). Do not label it model size: what a model needs at run time is more than its file size. Fractional GPUs are vGPU or NVIDIA MIG (`docs/facts.md` OWN-2).
- Agent Gateway: good. Apply skeleton; the five chips inside the gateway become a two-column list.

### N2-042 Hybrid & Public Cloud
- Eight boxes reading "× off" are noise. Show four named VMs; on site failure they grey out with one "site down" banner, and the same four names light up on the cloud side.
- **Fact scope:** this is Nutanix DR to an NC2 cluster, not generic cloud failover. Title the right side "NC2 on AWS" (or Azure, Google Cloud). Show the protection policy on the link and the recovery plan on the NC2 side, as in N2-030. The failover step is labeled "An admin runs the recovery plan": it is started by a person here, not automatic.

### N2-043 Project Beacon, OEM of Your Choice, Partial stack
- Beacon: apply skeleton; fine otherwise.
- OEM: each vendor tile shows the vendor's logo (N2-044), then the product line as the main label (Dell XC, HPE DX, Lenovo ThinkAgile HX, Cisco Compute Hyperconverged, Fujitsu PRIMEFLEX XF, Supermicro Hyperconverged Optimized: `docs/facts.md` HW-1).
- External storage: seven cards above the diagram (four arrays, three reasons). Arrays become a compact table in the right panel (Logo, Array, How Nutanix connects, Status). Reasons become "Why it matters".
- **Fact scope:** under both lists add "Supported models are on the hardware compatibility list". Nothing on these pages may suggest that any server works with any array.

### N2-044 Vendor logos (owner decision: yes)
- **Where:** OEM page tiles; the home page hardware tile (a row of small marks); the external storage array table (Everpure, Dell, NetApp).
- **Vendors:** Nutanix, Dell, HPE, Lenovo, Cisco, Fujitsu, Supermicro, Everpure, NetApp. The cloud logos already exist in `src/assets/logos/`.
- **How:** follow the existing pattern exactly. One SVG per vendor in `src/assets/logos/`, taken from the vendor's press kit or Wikimedia Commons, paths and colors unchanged. Record each file's source URL and date in `src/assets/logos/README.md`. Imported as assets so they are inlined into the single file. Each `<img>` has the vendor name as `alt`.
- **Rules:** no recoloring, stretching or cropping into the mark. Give each logo a white or light-neutral plate with 12 px padding so it meets its clear-space rule in both themes. All logos the same optical height (about 20 px on tiles, 14 px in tables). If a clean SVG cannot be found for a vendor, use the name in text and list it for the owner; do not redraw a logo by hand.
- **Check:** build stays under 2 MB; `scripts/check-build.mjs` still reports no external references; the About dialog gains a line that vendor names and logos are trademarks of their owners, used to name supported platforms.

## 5. Phase D: polish and proof

### N2-050 Motion
- All transitions 160 ms ease-out. No bobbing (NKP islands), no pulsing dots except data actually moving.
- Respect `prefers-reduced-motion` (already done; keep it working).

### N2-051 Empty and end states
- Every animation's last frame should be a useful still: the outcome, not a mid-flight frame. Check each module's `poster` time.

### N2-052 Acceptance run
For every route in `src/ui/modules/registry.ts`, at 1440x900 and 1280x720, light and dark:
- [ ] diagram top above y=220; play bar fully visible without scrolling
- [ ] at most two accent-colored elements
- [ ] no text under 11 px; no monospace on words or plain counts
- [ ] no dot grid, no gradient, no floating button
- [ ] dashed lines only where something is absent or planned
- [ ] nodes, VMs, CVMs and drives drawn with the shared glyphs
- [ ] steps list present and clickable; caption sits beside the diagram

## 6. Suggested order

1. N2-001 to N2-007 (tokens, type, decoration). The whole site changes at once; fix what breaks.
2. N2-010 to N2-013 (skeleton, numbers, controls, bars). Convert modules one per commit, starting with Protection & Capacity because it has the most variants.
3. N2-008, N2-009 (glyphs, data blocks), N2-044 (logos), then page tasks N2-020 onward in the order listed.
4. N2-014, N2-050 to N2-052.

Depth items (marked **Depth**) are separate commits after the visual task for that page. The owner has approved them within the **Fact scope** wording; each new claim still gets a row in `docs/facts.md` with its source in the same commit.

## 7. Owner decisions and fact review (2026-11-09)

Decisions:
1. Light theme is the default. (N2-003)
2. Fonts: Montserrat is the main face, Arial the alternate. (N2-002)
3. Vendor logos: yes. (N2-044)
4. Depth items: all may go ahead, with the wording limits in the **Fact scope** lines above.

The seven corrections that matter most, in one place:
1. **CVM failure:** AHV uses iSCSI redirection; ESXi and Hyper-V use CVM autopathing. Name the one being shown. (N2-023)
2. **DR:** a protection policy (replication, RPO, retention) and a recovery plan (failover, boot order) are different objects; RPO is a range per replication type. (N2-030, N2-042)
3. **Encryption:** DEK, KEK and MEK with the local key manager; no MEK with an external one. (N2-032)
4. **Geneve:** overlay networking only. (N2-028, N2-029)
5. **Erasure coding:** the strip is an example, not the rule. (N2-025)
6. **Objects:** movement happens only under a named lifecycle rule shown on screen. (N2-038)
7. **Cloud failover:** NC2 plus a configured Nutanix DR workflow, started by an admin. (N2-042)

Still open for the owner:
- Cloud Native AOS: is "NDK application snapshot" the right term, and is it application-consistent? (N2-039)
- NKP 2.19: which of Cluster API, Flux, Prometheus, Grafana and Velero are included by default, by edition? (N2-036)
- Encryption key hierarchy: a source to cite for the DEK, KEK, MEK chain. (N2-032)

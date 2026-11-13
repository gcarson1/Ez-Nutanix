# Nutanix Architecture Explorer

An interactive, single-file explainer of the Nutanix platform for live customer presentations. The home page lays the platform out as a labeled stack (Manage, Data and AI services, Infrastructure, Runs on). Every card opens a module that shows how that part of the platform works, with short looping animations and a few choices per module. The Cluster & DSF Lab is the one module built to be changed and broken on the spot.

Every module uses one layout: controls and the picture on the left; the step list, the caption, key numbers and the module's About on the right.

The build is one `index.html` with all code, styles and fonts inlined. It makes no network calls, so it works offline, on locked-down customer networks and as an email attachment. `npm run build` fails if the file passes 2 MB or references an external script or stylesheet.

## Quick start

Node 22 (what CI uses).

```bash
npm install
npm run dev        # local dev server with hot reload
npm test           # engine and content unit tests (Vitest)
npm run build      # typecheck, build dist/index.html, check size and external references
npm run smoke      # Playwright smoke tests against the built file (run build first)
npm run typecheck  # tsc --noEmit on its own
```

`npm run smoke` needs a browser: `npx playwright install chromium`, or set `PW_CHROMIUM` to an existing Chromium binary.

Send `dist/index.html` to customers as is. It opens from disk in any current browser. `dist/` is not committed; CI builds it, uploads it as an artifact, and on every push to `main` publishes it to GitHub Pages (see [CI](#ci)).

## What is in it

26 modules, reached from the home page. The Nutanix Cloud Infrastructure (NCI) module is a hub for the 13 below it.

| Home page band | Modules |
|---|---|
| Manage | Nutanix Central & Prism Federation, Cloud Manager, Kubernetes Platform, Data Lens |
| Data and AI services | Unified Storage (Files, Volumes, Objects), Cloud Native AOS, Database Service, Enterprise AI, Project Beacon |
| Infrastructure | **Nutanix Cloud Infrastructure**, which holds: Legacy vs Nutanix HCI, Cluster & DSF Lab, Data Path, Protection & Capacity, Snapshots & Clones, Failure Gauntlet, LCM Rolling Upgrade, AHV Networking, Flow (network security and virtual networking), Data Security, Disaster Recovery, Migration with Nutanix Move, Edge & ROBO |
| Runs on | Hybrid & Public Cloud (NC2), OEM of Your Choice |
| Start smaller | "Don't want the full stack?": Nutanix with external storage (AHV on the customer's own array) and ESXi on Nutanix (stay on vSphere, or convert to AHV later) |

Many modules have tabs for their parts. Kubernetes Platform and Enterprise AI open on an Overview tab that tells the whole story, with further tabs for each part.

## Presenting

| Key | Action |
|---|---|
| P | Presenter notes for the current view: talk track, key numbers, likely questions with honest answers, what to click next |
| G | Glossary |
| / or Ctrl/⌘ K | Search |
| J | Jump to any module |
| ? | Shortcut list |
| Space | Pause or resume the current animation |
| Left / Right | Scrub the animation a step at a time (a fortieth of the loop); with Shift, jump to the previous or next caption |
| < / > | Slower or faster playback |
| T | Light or dark theme (light by default, remembered in this browser) |
| Esc | Close a panel or dialog, or go back one level |

Tips:

- Start with **Take the tour** on the home page. It walks the panes bottom-up: infrastructure, then services, then Nutanix Central.
- Search matches keywords ("balance tcp", "metro", "erasure coding"), forgives typos, and knows older names (Calm, Beam) and acronyms (DR, NKP, VPC). It opens the module, or the exact tab or choice inside it, with that option outlined.
- Animations start on their own and loop. A step whose caption needs more time plays slower, at least 0.3 seconds per word. Drag the scrub bar to pause on a moment; press Play (or Space) to carry on.
- The **1x** button next to Play sets the playback speed for every animation, from 0.25x to 2x.
- Click a step in the list to jump to it.
- The **Cluster & DSF Lab** is one fixed 4-node cluster with six scenarios: data placement, live migration, planned shutdown, VM failover, drive failure and CVM fails.
- On Protection & Capacity, the Copies tab's **Copies** and **Nodes** choices set the cluster to match the customer (RF2 or RF3, 3 to 12 nodes). Its other tabs show erasure coding and block and rack awareness.
- Everything you change is kept in the address bar (`#/nci/capacity?nodes=8&rf=3`), so the page's link points to exactly the scenario you showed.
- Anything simplified carries an **Illustrative** tag; hover it to see what was simplified. Reduced-motion users get stills that show each story's outcome.

## Changing the credits

Edit `src/config.json`:

```json
{
  "title": "Nutanix Architecture Explorer",
  "credit": "Built by",
  "authors": [
    { "name": "Alex Besaw", "handle": "@Besaw" },
    { "name": "Gabriel Carson", "handle": "@GabeC" }
  ],
  "disclaimer": "Illustrative visualization for education. …",
  "factsCheckedOn": "2026-10-16"
}
```

The footer is one line: the version (from `package.json`, so `1.1.0` shows as `v1.1`), About this explorer (the disclaimer shows on hover and in full inside About), then the credit and each author with their Slack handle. Rebuild after editing.

## Editing content

Each module lives in `src/ui/modules/<module>/`:

- `content.ts` holds the words: summary, talk track, key numbers, questions and answers, and what to click next. Edit freely; it is data, not code.
- `index.tsx` is the interactive part. It renders engine state and never contains platform logic.

`src/ui/modules/registry.ts` is the one list of modules (path, icon, parent route) that the hub, breadcrumbs and jump dialog read from. The glossary is `src/content/glossary.ts`. Search indexes each module's content plus the options listed in `src/content/scenes.ts`, so a new tab or choice needs an entry there to be found. The home page cards and guided tour are in `src/ui/shell/Landing.tsx`.

## How it is built

Preact and TypeScript, bundled by Vite into one file with `vite-plugin-singlefile`. Icons are Lucide.

```
src/
  engine/        pure, deterministic TypeScript: cluster model, placement, failures and rebuild,
                 capacity math, platform rules, LCM, data path, DR, Flow, AHV networking, Move,
                 anomaly detection, ransomware, Unified Storage, NDB, NCM, NKP, AI endpoints, search
  content/       shared content types, the glossary, shared scenes
  state/         URL-hash routing and the shared cluster scenario
  ui/shell/      home page and tour, top bar, search, presenter panel, glossary, dialogs
  ui/modules/    one folder per module (content.ts + index.tsx, plus tab files where a module has them)
  ui/components/ shared controls, the simulation clock, logos, icons
  styles/        tokens, base, app layer
  config.json    title, credits, disclaimer, facts-checked date
tests/engine/    engine invariants and content checks (Vitest)
tests/smoke/     open the built file from disk, walk the modules, tour and search (Playwright)
scripts/         check-build.mjs, the post-build size and no-network gate
docs/            facts.md (claims and sources), decisions.md, design-tokens.md, DESIGN-SYSTEM.md,
                 NUTANIX-2.0-PLAN.md, MASTER_PROMPT.md, research/
```

Platform rules (minimum node counts, erasure-coding strip sizes, failure-domain minimums and so on) live in `src/engine/rules.ts`, and each one traces to an entry in `docs/facts.md`. Change a rule there and the UI's "why is this disabled" text follows.

New claims need a source in `docs/facts.md`; choices made where the brief left room go in `docs/decisions.md`. `CHANGELOG.md` lists what changed.

## CI

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests: `npm ci`, `npm test`, `npm run build`, install Chromium, `npm run smoke`, then upload `dist/index.html` as an artifact. On a push to `main` the tested build is also deployed to GitHub Pages. Pull requests never deploy.

## Known limitations

- Data is a representative sample of a few hundred items, not real extents; timings and throughput are illustrative assumptions, not measurements.
- Behavior, limits and requirements vary by AOS version, hypervisor, hardware and license. The About dialog says so, and its summary shows when you hover About in the footer.
- Facts were last checked against Nutanix sources on the date in `src/config.json`; product versions move on after that. Some sources (the portal documentation) could not be read directly, so `docs/facts.md` records what each claim rests on.
- On wide screens the left column (picture, steps, caption) fits the window and the picture shrinks to fit, but never below 85% of its size. On a window shorter than about 860 px (for example 1280x720) the page scrolls a little instead (decision 55).
- Presenter notes open in a side panel; there is no separate presenter window.

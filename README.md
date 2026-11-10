# Nutanix Architecture Explorer

An interactive, single-file explainer of the Nutanix platform for live customer presentations. The home page lays the platform out as a labeled stack (Manage, Data and AI services, Infrastructure, Runs on): every card opens a module that shows how that part of the platform works, with short looping animations and a few choices per module, plus one full lab you can change and break on the spot. Every module uses one layout: controls and the picture on the left; the steps (click one to jump there), the caption, key numbers and the module summary on the right.

The build is one `index.html` with all code, styles and fonts inlined. It makes no network calls, so it works offline, on locked-down customer networks and as an email attachment.

## Quick start

```bash
npm install
npm run dev        # local dev server with hot reload
npm test           # engine unit tests (Vitest)
npm run build      # typecheck, build dist/index.html, check size and external references
npm run smoke      # Playwright smoke tests against the built file (run build first)
```

Send `dist/index.html` to customers as is. It opens from disk in any current browser.

## Presenting

| Key | Action |
|---|---|
| P | Presenter notes for the current view: talk track, key numbers, likely questions with honest answers, what to click next |
| G | Glossary |
| ? | Shortcut list |
| Space | Pause or resume the current animation |
| T | Light or dark theme |
| Esc | Close a panel, or go back one level |

Tips:

- Start with **Take the tour** on the home page. It walks the panes bottom-up: infrastructure, then services, then Nutanix Central.
- Animations start on their own and loop without stopping between steps. A step whose caption needs more time plays slower, with at least 0.3 seconds per word, and the speed eases in and out. Drag the scrub bar to pause on a moment; press Play (or Space) to carry on.
- The **1x** button next to Play sets the playback speed for every animation, from 0.25x to 2x (or press `<` and `>`).
- The **Left** and **Right** arrow keys pause and scrub the animation a step at a time (a fortieth of the loop); with **Shift** they jump to the previous or next caption.
- Each module has one or two choices above its picture. The **Cluster & DSF Lab** is one fixed 4-node cluster with six scenarios (data placement, live migration, planned shutdown, VM failover, drive failure, CVM fails), and the right-hand column explains the chosen one.
- On the home page, **Start smaller** opens two partial starting points: Nutanix with external storage (AHV on the customer’s own array) and ESXi on Nutanix (stay on vSphere, or convert to AHV later). Each leads with why customers choose it.
- On Protection & Capacity, the Copies tab's **Copies** and **Nodes** choices set the cluster to match the customer (RF2 or RF3, 3 to 12 nodes). Its other tabs show erasure coding and block and rack awareness.
- Everything you change is kept in the address bar, so the page's link points to exactly the scenario you showed.
- Anything simplified carries an **Illustrative** tag; hover it to see what was simplified.

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

The footer is one line: the version, About this explorer (the disclaimer shows when you hover it, and in full inside About), then the credit and each author with their Slack handle in purple and "on Slack" after the last one. Rebuild after editing.

## Editing content

Each module lives in `src/ui/modules/<module>/`:

- `content.ts` holds the words: summary, talk track, key numbers, questions and answers, and what to click next. Edit freely; it is data, not code.
- `index.tsx` is the interactive part. It renders engine state and never contains platform logic.

The glossary is `src/content/glossary.ts`.

## How it is built

```
src/
  engine/        pure, deterministic TypeScript: cluster model, placement, failures and
                 rebuild, status, capacity math, platform rules, LCM, data path, DR, Flow
  state/         URL-hash routing and the shared cluster scenario
  ui/shell/      home page, top bar, presenter panel, glossary, dialogs, transitions
  ui/modules/    one folder per module (content.ts + index.tsx)
  ui/components/ shared controls, the simulation clock, icons
  styles/        tokens, design-system base, app layer
tests/engine/    engine invariants (Vitest)
tests/smoke/     open the built file and every module (Playwright)
docs/            facts.md (claims and sources), decisions.md, design-tokens.md, research notes
```

Platform rules (minimum node counts, erasure-coding strip sizes, failure-domain minimums and so on) live in `src/engine/rules.ts`, and each one traces to an entry in `docs/facts.md`. Change a rule there and the UI's "why is this disabled" text follows.

## Known limitations

- Data is a representative sample of a few hundred items, not real extents; timings and throughput are illustrative assumptions you can adjust, not measurements.
- Behavior, limits and requirements vary by AOS version, hypervisor, hardware and license. The About dialog says so, and its summary shows when you hover About in the footer.
- On wide screens the left column (picture, steps, caption) fits the window and the picture shrinks to fit, but never below 85% of its size; on a window shorter than about 860 px (for example 1280x720) the page scrolls a little instead (decision 55).
- Presenter notes open in a side panel; there is no separate presenter window yet.

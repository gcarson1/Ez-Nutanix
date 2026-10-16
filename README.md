# Nutanix Architecture Explorer

An interactive, single-file explainer of the Nutanix platform for live customer presentations. The landing page is a live version of the "One Platform For All Apps, Data & AI Anywhere" slide: every pane opens a module that shows how that part of the platform works, with short looping animations and a few presets per module, plus one full lab you can change and break on the spot.

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

- Start with the **Guided tour** on the landing page. It walks the panes bottom-up: infrastructure, then services, then Nutanix Central.
- Animations start on their own and loop, pausing briefly at the end of each step so its caption can be read. Drag the scrub bar to pause on a moment; press Play (or Space) to carry on.
- Each module has one or two preset choices above its picture. The **Cluster & DSF Lab** is one fixed 4-node cluster with five scenarios (data placement, live migration, planned shutdown, VM failover, drive failure) and a right-hand pane that explains the chosen one.
- Under the slide, **Don’t want the full stack?** opens two partial starting points: Nutanix with external storage (AHV on the customer’s own array) and ESXi on Nutanix (stay on vSphere, or convert to AHV later). Each leads with why customers choose it.
- Use **Presets** in the top bar to load a cluster size that matches the customer into Protection & Capacity (3-node edge, 4-node starter, 8-node production, 12-node RF3). Its other tabs show erasure coding and block and rack awareness.
- Everything you change is kept in the address bar. **Copy link** sends the customer exactly the scenario you showed. **PNG** saves the current diagram.
- Anything simplified carries an **Illustrative** tag; hover it to see what was simplified.

## Changing the presenter details

Edit `src/config.json`:

```json
{
  "title": "Nutanix Architecture Explorer",
  "presenterName": "Your Name",
  "presenterRole": "Systems Engineer",
  "organization": "Your Company",
  "contact": "you@example.com",
  "disclaimer": "Illustrative visualization for education. …",
  "factsCheckedOn": "2026-10-16"
}
```

The presenter line and disclaimer show in the footer. Rebuild after editing.

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
  ui/shell/      landing slide, top bar, presenter panel, glossary, dialogs, transitions
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
- Behavior, limits and requirements vary by AOS version, hypervisor, hardware and license. The footer disclaimer says so on every view.
- The reference slide screenshot is not in the repository, so the slide colors were not re-sampled from it (see `docs/design-tokens.md`).
- Presenter notes open in a side panel; there is no separate presenter window yet.

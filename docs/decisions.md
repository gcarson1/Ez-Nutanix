# Decisions

Choices made where the brief left room, or where the brief and other inputs disagreed.

| # | Decision | Why |
|---|---|---|
| 1 | Purple slide look on top of the line-based design system: purple (`--ink`) is the structural color, plus a restrained status palette. | The master prompt asks for the slide's purple look; `DESIGN-SYSTEM.md` is monochrome. The original build's `tokens.css` had already merged them this way, so it was kept. |
| 2 | Preact (about 10 KB) for the UI. | Worth the bytes for a stateful, many-module UI; the build is still far under the 2 MB budget. |
| 3 | The whole scenario lives in the URL hash; cluster settings use shared keys (`src/state/scenario.ts`) across Cluster Lab, Protection & Capacity, Failure Gauntlet and LCM. | A presenter can send a link to an exact configuration, and presets apply to every cluster view. |
| 4 | "Prism Federation" is presented as the slide's label for multi-Prism-Central federation under Nutanix Central, not as a product name. It opens the Nutanix Central module on its Federation tab. | No Nutanix product is called "Prism Federation" (docs/research/E-platform-services.md, 1d). |
| 5 | "Any Bare Metal Linux" opens Cloud Native AOS with the bare-metal target selected. | The brief maps it to 9.3. |
| 6 | Landing pane to module transition uses the View Transitions API (the clicked pane grows into the module header); browsers without it, and reduced motion, navigate without animation. | Spatial continuity without a dependency. |
| 7 | Presenter mode is a side drawer (P), not a second window. | Works when screen-sharing a single window; a second-window view can be added later. |
| 8 | Built file is not committed (`dist/` is ignored). CI builds it and uploads it as an artifact. | Keeps diffs reviewable; the deliverable is reproducible with `npm run build`. |
| 9 | The reference slide screenshot is not in the repo, so slide colors were not re-sampled (see design-tokens.md). | It was never added. |
| 10 | Facts that could not be verified are left out or shown with version-dependent wording rather than shipped as guesses. Details and sources are in `docs/facts.md`. | Brief, section 11. |

# Design system: "quiet, line-based, enterprise"

A complete reference for the visual and interaction style built in the Network+ Study app. Hand this file (plus `design-system-starter.css`) to another agent and they can build a new project in the same style without seeing the original.

Reference implementation: `src/styles.css`, `src/components/*`, `src/modes/*`, `src/labs/*` in this repo.
Starter you can copy: `docs/design-system-starter.css` (tokens, base, controls, shell, rows, forms, grid, choice list, dialogs, responsive).

---

## 0. The feel in one paragraph

A study tool that looks like serious enterprise software, not an "AI-default" app. Near-monochrome. Flat pages with hairline dividers instead of boxes. Square controls, sharp corners (only dialogs and flashcards are rounded). Inter for text, JetBrains Mono for numbers and codes. One solid black button per screen tells you what to do next. Green and red appear only to mean right or wrong. Everything is sized in `rem` on a fluid root, so it reads the same on a laptop, a phone, and a 4K monitor. Almost no words: no marketing copy, no branding, no explanations of things that are obvious.

---

## 1. What was asked for (the brief, in order)

Keep the intent, not just the values. These are the requirements the style grew from, in the order they arrived. A new project should honor all of them unless told otherwise.

1. **Original spec**
   - Minimal black and white, with a dark and light toggle.
   - **Red and green are reserved for correct/incorrect.** Never decorative.
   - **Rounded corners only on large top-level containers.** No rounded corners on small subsections or minor UI.
   - **Small subsections are not boxed.** Separate them with line dividers, not borders and padding.
   - Strong visual hierarchy: one clear, identifiable path through the interface, never ambiguity about "what do I do next".
   - Explicitly avoid the generic "AI-default" look where everything is wrapped in soft rounded rectangles. Clean and non-blocky.
   - Fully responsive, and must work in Slack's mobile in-app browser. Not a shrunken desktop view.
   - Single self-contained HTML file. No backend, no accounts, no reliance on browser storage.
2. **"Refine the UI for usability."** Make it easy to navigate by visual hierarchy, aligned, not cluttered. Cut unnecessary wording. No SEO, so **branding goes**. Take inspiration from the user's Fiv-o discovery tool (flat, line-based, monochrome, color only for meaning, one primary button). **Usability is the goal: "if it's not maximally useful, it's minimally viable."**
3. **"Make it feel enterprise and pristine while keeping it lean and clean."** The UI **was too small on a 4K monitor**, so scaling had to be fixed at the foundation, not patched. "Polish the systems under everything displayed."
4. **Small finishing touches**: a low-contrast credit line at the bottom of the home page, like a site disclaimer.
5. **"Make it 100% accurate."** All displayed facts were fact-checked against standards and official objectives. (Applies to content, but the habit matters: never ship invented or imprecise facts.)

---

## 2. Principles (non-negotiable)

| # | Principle | Why |
|---|-----------|-----|
| 1 | **One scale.** Every length is a `rem` token; root font size is fluid. | The app shrank on 4K because of hard-coded pixels. A single scale makes the whole UI grow as one unit. |
| 2 | **Monochrome by default; color means something.** Green = right/good, red = wrong/bad. Nothing else is colored. | Color is information. Decorative color destroys the signal and reads as "template". |
| 3 | **Lines, not boxes.** Hairline dividers and whitespace separate sections. No card-in-card, no bordered panels for small groups. | Boxes make everything the same weight and feel blocky. Lines keep hierarchy honest. |
| 4 | **Square by default.** Radius 0 on buttons, inputs, rows, chips, pills. Radius 8px only on dialogs and flashcards. | The user's explicit rule. Square reads as precise and enterprise. |
| 5 | **One primary action per view.** One solid ink-colored button, always the next step. Everything else is outlined or a text button. | Removes "what do I do next". |
| 6 | **Hierarchy through size, weight and gray, not decoration.** Title, then muted line, then control. Three grays for text: `text`, `muted`, `faint`. | Cheap, consistent, legible in both themes. |
| 7 | **Cut words.** Labels are nouns or short verbs. No "Welcome to...", no tooltips repeating the label, no paragraph where a line works. | The user asked for it repeatedly. |
| 8 | **Same thing, same place.** Primary action bottom-left of its block; nav top; status in the right rail. | Muscle memory beats cleverness. |
| 9 | **Everything works at phone width and 4K.** Never hide a feature on mobile; reflow it. | Slack in-app browser on phones, a 4K desk monitor. |
| 10 | **Self-contained.** Fonts, CSS, JS inlined into one HTML file. No CDN, no network at runtime. | Shared as a file attachment. |

---

## 3. Foundation

### 3.1 Fluid root (this is what fixed 4K)

```css
html { font-size: 100%; }
@media (min-width: 1280px) {
  html { font-size: clamp(16px, calc(0.45vw + 9.5px), 26px); }
}
```

Resulting root size: 16px up to ~1440 wide, ~21px at 2560, 26px (cap) at 3840. **Every length in the app is `rem`** (or a `var(--sp-*)` / `var(--fs-*)` token that is `rem`). A 4K display therefore shows text at ~26px instead of 16px and the layout grows with it.

Rules:
- No `px` for sizes, spacing, or radii. Allowed `px`: 1px borders, `clamp()` bounds above, media-query breakpoints, SVG internals (viewBox units).
- SVG elements are sized with `rem` via CSS or inline style (`width: 0.875rem`). A `viewBox` with `width="100%"` scales with the page; fixed `width="64"` does not.
- Don't use `vw` for type anywhere except the root clamp.

### 3.2 Spacing (4px grid at a 16px root, as rem)

| Token | rem | px @16 |
|---|---|---|
| `--sp-0h` | 0.125 | 2 |
| `--sp-1` | 0.25 | 4 |
| `--sp-1h` | 0.375 | 6 |
| `--sp-2` | 0.5 | 8 |
| `--sp-3` | 0.75 | 12 |
| `--sp-4` | 1 | 16 |
| `--sp-5` | 1.25 | 20 |
| `--sp-6` | 1.5 | 24 |
| `--sp-7` | 1.75 | 28 |
| `--sp-8` | 2 | 32 |
| `--sp-10` | 2.5 | 40 |
| `--sp-12` | 3 | 48 |
| `--sp-16` | 4 | 64 |

Pick the nearest token; never invent a value. Section gaps `--sp-8`/`--sp-10`; field rows `--sp-5` vertical; inline gaps `--sp-2`/`--sp-3`.

### 3.3 Type

Fonts (both SIL OFL, embedded, Latin variable subsets):
- **Inter** for all UI text (`--font`).
- **JetBrains Mono** for numbers, IDs, addresses, timers, keys, code, tabular data (`--mono`). Always with `font-variant-numeric: tabular-nums`.

Install and embed:
```bash
npm i -D @fontsource-variable/inter @fontsource-variable/jetbrains-mono
cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 src/fonts/inter.woff2
cp node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2 src/fonts/jetbrains-mono.woff2
```
Reference them with `@font-face { src: url('./fonts/inter.woff2') }` and the build plugin inlines them as data URIs (~130 KB total). Declare `font-weight: 100 900` (variable axis).

Scale (rem): `--fs-11` .6875 · `-12` .75 · `-13` .8125 · `-14` .875 · `-15` .9375 (body) · `-16` 1 · `-18` 1.125 · `-20` 1.25 · `-24` 1.5 · `-28` 1.75 (h1) · `-36` 2.25 (big numbers).

Conventions:
- Body 15px-equivalent, `line-height: 1.6`, `font-feature-settings: 'cv02','cv03','cv04','cv11'` (Inter's cleaner alternates).
- Headings: weight 600, `letter-spacing: -0.018em` (h1 `-0.025em`), `line-height: 1.2`.
- **Eyebrow** (small label above a block): 11px, weight 600, `letter-spacing: .08em`, uppercase, `--muted`. Optional count suffix in mono, `--faint`.
- **Big number** (score, readiness): mono 600, 36px, `letter-spacing: -0.04em`, `line-height: 1`.
- Measure: prose capped at `--measure: 46rem`.

### 3.4 Color tokens

Light:
```
--bg #ffffff   --bg-2 #fafafa   --bg-3 #f4f4f5   --sel #f0f0f2
--line #ebebee --line-2 #d9d9de
--text #09090b --text-2 #3f3f46 --muted #6e6e78 --faint #a1a1aa
--ink #18181b  --ink-text #ffffff     (the solid "primary" color and its text)
--track #ebebee --s2 #8e8e96 --s3 #d4d4d8   (meter tracks, chart grays)
--good #15803d --good-bg #f0fdf4   --bad #c42a1c --bad-bg #fef2f2
```
Dark:
```
--bg #0b0b0c   --bg-2 #111113   --bg-3 #18181b   --sel #1d1d21
--line #222226 --line-2 #34343b
--text #fafafa --text-2 #d4d4d8 --muted #a1a1aa --faint #6b6b74
--ink #fafafa  --ink-text #09090b
--track #26262b --s2 #77777f --s3 #3a3a41
--good #56d38a --good-bg rgba(86,211,138,.10)   --bad #f87171 --bad-bg rgba(248,113,113,.10)
```

Semantics:
- **`--ink` is the brand.** It flips black/white between themes. The primary button, selected state, active-nav underline, and chart "network" bits are all `--ink`.
- **`--good`/`--bad` only for correctness or status**, with the soft `-bg` tint for row fills.
- **Never** add a third accent color (blue links, purple highlights). If you need emphasis, use weight or `--ink`.
- Muted/faint text must still meet contrast on `--bg`; `--faint` is for non-essential metadata only.

### 3.5 Theme handling

- `data-theme="light|dark"` on `<html>`. Set it **before first paint** with a tiny inline script in `<head>` (reads saved pref, falls back to `prefers-color-scheme`) so dark mode never flashes light.
- Toggle in the top bar (sun/moon icon). Preference saved in `localStorage` wrapped in try/catch (private windows and in-app browsers can throw). Never depend on it.
- Dark mode uses lower-contrast lines and `--shadow` is a 1px ring plus deep drop, not a soft glow.

### 3.6 Motion

- Duration tokens: `--t-fast: 120ms`, `--t-med: 220ms`; ease `cubic-bezier(.2,.8,.2,1)`.
- Use motion only to confirm state: hover color/border, row arrow nudging 0.2rem, meter fill width, modal pop (translateY .5rem + fade), toast rise, flashcard flip.
- Respect `prefers-reduced-motion` (kill all animation/transition).

---

## 4. Layout

### 4.1 The frame

```
┌────────────────────────── top bar (sticky, blurred) ────────────────────────┐
│  [icon] Home  [icon] Exam  …                         Progress file   ☾      │
├──────────────────────────────────────────────┬──────────────────────────────┤
│  main column  (max 52rem content)            │  right rail (19.5rem)        │
│  title · muted line · primary action         │  status / progress / stats   │
│  hairline rows…                              │  sticky, own scroll          │
│  footer credit (low contrast)                │                              │
└──────────────────────────────────────────────┴──────────────────────────────┘
```

- `--frame = main-max + rail-w + gutters`. The whole frame (bar contents + columns) is **centered** with `max-width: var(--frame)`, so on a 4K monitor the content and rail stay together instead of the rail being flung to the far edge.
- `--main-max: 52rem`, `--rail-w: 19.5rem`, `--gutter: 2rem`. Every page and every lab uses the **same** content width, so tab strips, toolbars, diagrams and tables share one left edge.
- Top bar: height `3.5rem`, `position: sticky`, translucent background + `backdrop-filter: blur(12px)`, 1px bottom hairline. Nav is text + 16px stroke icon; active item has a 2px inset underline in `--text` (not a pill, not a fill).
- Right rail: sticky under the bar, full remaining height, own scroll, 1px left hairline, sections separated by hairlines (`.side-sec`). Holds status the user glances at (progress, counters), never primary content.
- Optional **footer** (`<footer class="foot">`): lives in the main column's bottom grid row, 12px `--faint` text under a hairline, aligned to the content's left edge. Used for a credit line, e.g. `Name | Role`.

### 4.2 Two bar modes

1. **Nav bar** (browsing): icon + label nav, utility actions on the right.
2. **Focus bar** (during a timed or committed task): replaces nav with `← Exit`, task title, 1–2 muted meta items separated by thin vertical rules, and on the right the live value (timer) plus the one completing action (`Submit` / `Finish`). While in focus mode, `body.in-session` removes the mobile tab bar and pins the action row to the bottom of the viewport. This stops the user from wandering mid-task and keeps "what's next" in one place.

### 4.3 Mobile transformation (<= 900px)

- Top nav collapses to a **page title** in the bar; navigation moves to a **fixed bottom tab bar** (icon over label, active = `--text`, others `--faint`, translucent + blur, safe-area padded).
- The right rail drops **below** the main content and becomes a normal section (`--bg-2` background, top hairline). In focus mode, the session rail moves **above** the content, collapsed behind a "Show grid" toggle.
- Gutters shrink to `1rem`. Two-column layouts become one column; 3-up field grids become 2-up.
- No horizontal page scroll, ever. Wide diagrams get an inner scroller with a min-width and a small "Swipe sideways" hint (<= 600px).
- Touch targets: controls are >= 2.25rem tall (2.75rem for large). Primary actions are never below the fold in focus mode (sticky bottom).
- Test target: Slack's mobile in-app browser (no persistent storage, downloads may fail). Provide a copy/paste fallback for any file download.

---

## 5. Components

Class names below are from the reference implementation (`src/styles.css`). Reuse them or rename consistently.

### Buttons: three tiers (never more)

| Tier | Class | Look | Use |
|---|---|---|---|
| Primary | `.btn.primary` | Solid `--ink`, `--ink-text`, square | The one next step per view. `.lg` (2.75rem) for the page's main CTA. |
| Secondary | `.btn` | 1px `--line-2` outline, hover border -> `--text` | Alternatives, "Finish", "Check answers" when not the sole next step. |
| Text | `.tbtn` | No border, `--muted`, underline on hover | Tertiary: Skip, Reset, Show working, Back, Ignore. |

Heights: `--h-sm 2rem`, `--h-md 2.25rem`, `--h-lg 2.75rem`. Keyboard hints inside buttons as mono `.k` at 55% opacity (`Show answer  Space`).
Disabled: opacity .32, `cursor: not-allowed`.
**Rule:** if two buttons in a block are both solid, one of them is wrong.

### Choice controls

- **Segmented control** `.seg` (single choice): joined square buttons sharing 1px borders; selected = solid `--ink`. Optional mono count `.n` at 60% opacity.
- **Toggles** `.toggle` (multi choice): outlined square button with a leading 14px check box that fills `--ink` with a white checkmark (SVG data URI; dark theme swaps the stroke color). Use `aria-pressed`.
- **Chips** `.chipbtn`: outlined square item buttons for pools/placing tasks; selected = solid ink; "used" = dashed + faint.
- **Form fields** (`.field`): stacked, `align-items: flex-start` so a segmented control **hugs its content** (do not let it stretch to full width), a `--fs-13` weight-600 label on top, hairline between fields.

### Inputs

`.input`: 2.25rem tall, 1px `--line-2`, radius 0, **mono** by default (these inputs hold addresses/numbers), hover border `--s2`, focus border `--text` + 1px extra ring (no blue glow), `.good` / `.bad` states use border + `-bg` tint. `select.input` switches back to Inter. Labels above: 12px, weight 500, `--muted`; expected-answer hint in mono green under the field.

### Rows (the signature pattern)

`.rows` is a list with a top hairline; each `.rowbtn` is a full-width button with a bottom hairline, title (600) + muted subtitle on the left and a faint `→` on the right. Hover: title underlines, arrow nudges 0.2rem right and darkens. Use for: mode lists, lab lists, recommendations, review items, pick-lists. **This replaces cards.**

Variants: `.modetile` grid (4-up, 1px gap on a `--line` background so cells are separated by hairlines, icon + title + muted line) for "all modes" overviews.

### Eyebrow, headings, task line

A section = eyebrow (what this is) -> `h1`/`h2` (the thing) -> one muted sentence -> controls. Activity pages open with a single **task line** (`.task`, `--text-2`, bold keywords) that says exactly what to do ("Tap an AP to change its channel. Neighbors that overlap must not share a channel.").

### Feedback block (`.follow`)

The universal way to show a result or an explanation: a 2px left rule (`--line-2`, or `--good`/`--bad`) with an uppercase 11px key label ("CORRECT", "INCORRECT · ANSWER B", "3 OUT OF PLACE") and one or two lines of text (first line normal, rest muted). No icon, no box, no colored background block. Appears directly under the thing that was answered.

### Choice list (`.opts` / `.opt`)

Full-width rows with a square key badge (A, B, 1, 2) in mono. States: hover tint, **selected** (`--sel` fill + 2px inset left bar + filled ink key), **correct** (`--good-bg` + green inset bar + green key + "CORRECT"/"ANSWER" tag), **wrong** (`--bad-bg` + red bar + red key + "YOUR PICK" tag). Keys 1-9 / letters select via keyboard.

### Meters and charts

- `.meter`: 4px tall track `--track`, fill `--good` (mastery) or `--text` (neutral/progress). Thick variant 6px. Animate width 0.6s.
- **Contribution grid** (`.bubbles`): GitHub-style grid, 7 rows, auto-flow column, 13px cells with 3px gaps. States: empty `--track`, answered `--s2`, good `--good`, bad `--bad`; current = 2px outline; flagged = tiny corner triangle. Square cells, not circles (square-by-default rule, even though they're called "bubbles"). Legend below in 12px muted.
- Charts stay monochrome: use `--text`, `--s2`, `--s3`, `--track`. Green/red only if the data is literally right/wrong.

### Tables

Collapse borders; header 11px uppercase muted with a stronger bottom rule; rows separated by hairlines only; numeric columns in mono and `white-space: nowrap`; selected row `--sel`, success row `--good-bg`. Always wrap in `.scroll-x` for narrow screens.

### Pills and kbd

`.pill`: inline, 1.375rem, 1px outline, mono 11px. Good/bad variants recolor the border and text. `kbd`: 1.25rem square, 1px outline, mono 11px muted.

### Dialogs and toasts

- Dialog: the **only** rounded container besides flashcards. 8px radius, 1px `--line`, `--shadow`, `max-width: 32rem`, max-height 78vh, on a `rgba(9,9,11,.4)` overlay with a 2px blur, content starts 14vh from top. Header = title + `×` text button. Sections separated by hairlines; footer right-aligned: text button (cancel) + solid primary (confirm). Esc and outside click close; focus is trapped and restored; body scroll locked.
- Toast: solid `--ink` on `--ink-text`, square, bottom-center, 2.6s, rises in. On mobile sits above the tab bar.

### Flashcard

The one place a large rounded container (8px) is allowed: min-height 21rem, 2rem padding, 1px `--line-2`, flips with a short `rotateX` animation, back face `--bg-2`. Before flip the only primary button is "Show answer"; after flip it is replaced by two equal buttons ("Still learning" outlined, "Got it" solid).

### Diagrams (SVG)

- Square nodes, 1.5px strokes, filled `--ink` for infrastructure, outlined for endpoints, dashed + `--bad-bg` for dead/failed.
- Wires 1.75px `--text`; success path 3.5px `--good`; cut/failed dashed `--bad`; secondary lines `--line-2`.
- Text in Inter/Mono using CSS variables (`fill: var(--text)`); use a **halo** (`paint-order: stroke; stroke: var(--bg); stroke-width: 4`) behind labels that sit on lines.
- Size with `viewBox` and `width: 100%`; give wide ones a `.diagram-scroll` with a min-width at phone width.
- Interaction states (hover thickens stroke; click toggles fail/cut) live in CSS, never inline colors.

---

## 6. Interaction patterns

1. **Next step is always obvious.** Home shows an "Up next" block: eyebrow, specific title ("Practice Troubleshooting"), one muted line of why, one big primary button. Beneath it, a "Recommended" row list, then "All modes". Recommendations are data-driven (weakest area, missed items, unseen items) and fall back to a sensible first-run state.
2. **Setup screens are three or four labeled fields + one primary button.** Hairline between fields, no boxes. Presets arrive from other screens (`go({ name, preset })`) and can auto-start so users aren't asked to configure what the app already knows.
3. **Focus mode for committed tasks** (see 4.2): timer and finish action live in the bar; the action row sticks to the bottom; leaving asks for confirmation if progress would be lost.
4. **Check -> feedback -> next.** The primary button is "Check" until answered, then becomes "Next ->"; feedback appears as a `.follow` block under the question, never in a modal.
5. **Predict-then-reveal** for processes (protocol exchanges, encapsulation): ask the user for the next step before showing it; score predictions; always offer "Just watch".
6. **Hands-on beats reading.** Every topic gets an activity that manipulates something (configure, wire, place, plan, diagnose) before a drill or a reference. Order activities most-hands-on first; references last.
7. **Realistic artifacts.** Troubleshooting uses command output that matches real tools (`ipconfig`, `show spanning-tree`, `sshd` logs). Clues are highlighted only on request ("Highlight clues").
8. **Misses come back.** Drills requeue missed items a few cards later; results offer "Retry the N missed" as the primary action.
9. **Keyboard everywhere**: 1-9/letters answer, Enter checks/advances, arrows move, Space flips, F flags, Esc closes. Show hints only on desktop (`hide-sm`).
10. **Progress is explicit.** No hidden autosave dependency. A "Progress file" button is always in the bar (shows "Save progress" with a small ink square when there are unsaved changes), export/import JSON, plus copy/paste fallback for devices where downloads fail.
11. **Destructive actions confirm** with a dialog that names the consequence ("Replace current progress?"), default focus on the confirm, "Keep going/Stay" as the safe text button.
12. **Metrics must be meaningful.** "Exam readiness" weights each area by its real exam share rather than a flat average; copy beneath it explains the weighting in one line.

---

## 7. Content and copy rules

- Titles are plain nouns ("Practice", "Subnetting", "Exam result"). No taglines, no "Welcome", no product name in the UI chrome.
- One muted sentence under a title, max. Often zero.
- Buttons: verb or verb+object ("Start practice", "Check", "Next ->", "Save progress"). Never "Click here", never "Submit" when "Check" or "Finish" is truer.
- Numbers always in mono; units in regular text ("20 questions · about 15 minutes").
- Status uses the `.follow` key label in caps ("CORRECT", "NOT QUITE"), then plain sentences.
- Remove explanatory empty states unless they say what to do next.
- A credit line goes in the footer, not the header.
- **Facts must be true.** Verify against primary sources; cite exact standards; prefer the official wording for exam-style content. Use documentation/test address ranges (e.g. 192.0.2.0/24, 203.0.113.0/24) in examples, never real third-party IPs.

---

## 8. Accessibility baseline

- Semantic elements: `<nav aria-label>`, `<main aria-label>`, `<aside aria-label>`, real `<button>`s; toggles use `aria-pressed`, tabs use `role="tab"` + `aria-selected`, current page uses `aria-current="page"`.
- Visible focus: 2px `--text` outline, 2px offset, on every interactive element.
- Don't encode meaning in color alone: correct/wrong rows also carry text tags ("CORRECT", "YOUR PICK"), icons/marks, and key fill.
- Progress meters use `role="progressbar"` with values; timers use `role="timer"`; SVG diagrams have `role="img"` + `aria-label`; interactive SVG groups are `role="button"` with labels.
- Dialogs: `role="dialog" aria-modal`, labelled, focus trap + restore, Esc closes.
- Reduced motion honored. `.sr-only` utility available.

---

## 9. Build and delivery (single HTML file)

- React 18 + Vite 6 + `vite-plugin-singlefile`; `build.target 'es2019'`; `assetsInlineLimit` huge so fonts inline as base64. Output renamed to one `.html` (e.g. `dist/NetPlus-Study.html`), ~770 KB with 193 questions and fonts.
- No `fetch`, no CDN, no analytics. Verify with: `grep -oE 'https?://' dist/*.html` returns only namespace strings.
- Data (e.g. a question bank CSV) is imported with `?raw` and parsed at runtime; bad rows surface as console warnings.
- `localStorage` is a convenience only (theme, a safety-net backup), always in try/catch.
- Commit the built file if it is the deliverable people download.

---

## 10. Pitfalls we hit (so you don't)

1. **Everything tiny on 4K** -> hard-coded px. Fix at the root with rem + fluid root, then convert inline styles (we converted 134) and SVG pixel attributes with a codemod, not by hand.
2. **Form controls stretched full width** -> flex column children stretch. Set `align-items: flex-start` on `.field`.
3. **Rail flung to the far edge of a 4K screen** -> center a max-width frame that includes both columns.
4. **Content widths differing per page** -> define one `--main-max` and use it everywhere (including diagrams and tab strips) so left edges align.
5. **Double dividers** -> a section with both a top border and the previous block's bottom border. Pick one separator rule (we use whitespace between top-level sections, hairlines inside lists).
6. **Mobile bottom bar covering content/toasts** -> add body bottom padding and lift toasts; remove both in focus mode.
7. **Diagram labels collide with lines** -> put hints inside nodes, use halo text, shorten strings; test in dark mode.
8. **Green used for "selected/placed"** -> confusing. Green means correct only; "used" or "placed" chips are dashed and faint.
9. **A wrong answer dead-ends** -> make the primary button "fix it" (e.g. "Fix from the first wrong pin") rather than forcing a skip.
10. **Hot reload leaves stale errors in the console** -> reload before judging an error; test the built file too.
11. **Background-tab timers are throttled** -> bring the tab to the front before running long scripted UI sweeps, and split sweeps into smaller calls.
12. **Hardcoded counts** (e.g. "112 questions") -> always derive from data.

---

## 11. QA protocol (do this before saying it's done)

1. Build the single file; confirm size and **zero external URLs**.
2. Load the **built** file (not just the dev server); confirm fonts report `loaded`, console has no errors.
3. Screenshots at **375x812 (phone), 1440x900, 2560x1440, 3840x2160**, light and dark. Confirm: root font size scales (16 -> ~21 -> 26px), content+rail stay centered, nothing wraps awkwardly, no horizontal page scroll (`scrollWidth === innerWidth`).
4. Walk every screen and every sub-activity programmatically (we ran all 41) and assert no console errors and no overflow at 375px.
5. Check each state of every control: default, hover, selected, disabled, correct, wrong, focus.
6. Keyboard-only pass through the primary flow.
7. Verify numbers and facts independently (we cross-checked subnet/IPv6/IPv4 math against Python's `ipaddress` on 11,000+ random cases and content against the official exam objectives PDF).
8. Only then commit; keep the commit message factual about what changed.

---

## 12. Recipe: apply this to a new project

1. Copy `docs/design-system-starter.css` and the two font files; add the pre-paint theme script to `<head>`.
2. Define the **screens as: bar -> main column -> right rail**. Decide what lives in the rail (status, progress), what lives in the bar (nav + utilities), and what the single primary action is on each screen.
3. Build pages from only these parts: eyebrow, h1 + muted line, `.field` setup rows, `.rows`/`.rowbtn` lists, `.seg`/`.toggle` choices, `.opt` choice lists, `.follow` feedback, `.meter`/grid, tables, dialog. Resist adding new component types; if you need one, ask "can this be a row, a field, or a follow block?"
4. Replace any px with tokens. Add `data-theme` dark values for any new color.
5. Write the shortest possible copy. Delete explanatory paragraphs unless they say what to do.
6. Add a focus mode if the app has any committed or timed task.
7. Run the QA protocol.

### Prompt snippet for another agent

> Build `<project>` in the "quiet, line-based, enterprise" style described in `DESIGN-SYSTEM.md`. Start from `design-system-starter.css`. Hard rules: all sizes in rem tokens on the fluid root (it must scale to 4K); monochrome with `--ink` as the only emphasis color; green/red only for right/wrong; square corners except dialogs; hairlines instead of boxes; one solid primary button per view; Inter + JetBrains Mono embedded; dark and light themes applied before first paint; centered frame with a right rail on desktop and bottom tab bar on phones; minimal copy, no branding; single self-contained HTML build. Verify at 375, 1440, 2560 and 3840 px in light and dark before finishing.

---

## 13. File map (reference implementation)

```
src/styles.css                 the full design system (tokens, components, labs, responsive)
src/fonts/                     inter.woff2, jetbrains-mono.woff2
index.html                     pre-paint theme script
src/components/ui.jsx          Eyebrow, Seg, Chips, Meter, Modal, Icon (stroke icons), Paras
src/components/Page.jsx        NavBar, MobileNav, SessionBar (focus bar), Page layout + footer prop
src/components/MasteryPanel.jsx  the right rail (readiness + rows)
src/components/SessionSide.jsx   contribution grid rail for focus mode
src/components/QuestionView.jsx  choice list + feedback block
src/modes/*                    Home (study plan), Exam, Practice, Flashcards, Labs, Results
src/labs/kit.jsx               MatchDrill, OrderBuilder, SequenceAnimator (predict mode), CaseRunner
docs/design-system-starter.css drop-in stylesheet
```

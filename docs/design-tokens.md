# Design tokens

All tokens live in `src/styles/tokens.css`. Dark is the default theme (projector first); light is available from the theme toggle (T).

## Landing slide colors

The landing page reproduces the "One Platform For All Apps, Data & AI Anywhere" slide. The reference screenshot (`docs/reference/platform-reference.png`) is not in the repository, so these values could not be re-sampled in this pass; they are the values the original build chose. If you add the screenshot, sample it and update the table and `tokens.css` together.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--slide-bg` | `#050507` | `#f6f5fa` | Page background behind the slide |
| `--slide-outer` | `#33227f` | `#3a2a8c` | Nutanix Central container |
| `--slide-outer-line` | `#4a37a6` | `#4b3aa8` | Inner edge of the Central container |
| `--slide-card` | `#1f1458` | `#22175e` | Cards inside Nutanix Central |
| `--slide-card-hover` | `#2c1f75` | `#2f2280` | Their hover state |
| `--slide-svc` | `#5235cf` | (same) | Services band cards |
| `--slide-svc-hover` | `#6447e6` | (same) | Their hover state |
| `--slide-nci` | `#7855fa` | (same) | Nutanix Cloud Infrastructure block |
| `--slide-nci-hover` | `#8b6cff` | (same) | Its hover state |
| `--slide-gray` | `#e2e2e7` | `#e4e3ea` | Cloud and bare-metal panels |
| `--slide-gray-text` | `#16161b` | (same) | Text on the gray panels |
| `--slide-text` | `#ffffff` | (same) | Text on purple |
| `--slide-sub` | `rgba(255,255,255,.74)` | (same) | Card subtitles |

## App colors

- Brand / structure: `--ink` `#7855fa` (dark) / `#6a45f0` (light), with `--ink-soft`, `--ink-line` and `--ink-fg` (purple used as text on the page background).
- Status, always paired with an icon and a word: `--ok` healthy, `--warn` degraded or rebuilding, `--bad` failed or data at risk, `--flow` data in motion. Each has a `-bg` tint.
- Neutrals: `--bg`, `--bg-2`, `--bg-3`, `--sel`, `--line`, `--line-2`, `--text`, `--text-2`, `--muted`, `--faint`, `--track`, `--s2`, `--s3`.

## Type, space and motion

Inter and JetBrains Mono are inlined as woff2 subsets (`src/fonts`). Sizes (`--fs-*`) and spacing (`--sp-*`, 4px grid) are rem on a fluid root, so the layout scales from laptop to a 4K projector. Motion uses `--ease`, `--t-fast`, `--t-med`, `--t-slow`, and everything continuous stops under `prefers-reduced-motion`.

# Text mask optimization — measurements

Harness: `scripts/text-mask-parity.mjs` (`bun run parity:text-mask` for the
visual matrix, `bun run perf:text-mask` for the counters below). It drives the
Vite dev server so the dev-only `window.__chladniTextMask` hook is available,
launches headless Chromium with the Metal ANGLE path
(`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`), and records counters
from the manager itself plus real `texSubImage2D`/`texImage2D` calls whose
source is the mask canvas.

Scroll measurement: 4 s synthetic scroll from 0 to `scrollHeight`, DPR 1 at
1440×900 and DPR 3 at 390×844. "4×" is CDP `Emulation.setCPUThrottlingRate`.

## Baseline (before the cache/atlas work)

| Metric | 1440×900 DPR 1 | 390×844 DPR 3 |
|---|---:|---:|
| Startup rasterizations (first ~2.5 s) | 9 | 11 |
| Rasterizations / s during scroll | 30.3 | 30.3 |
| Range calls per rasterization | 530 | 446 |
| `fillText` calls per rasterization | 48.6 | 60.9 |
| Mask upload bytes / s | 79.3 MB | 58.6 MB |
| Real texture uploads / 4 s | 121 | 121 |
| Rasterize ms (no throttle) | 1.08 | 0.78 |
| Rasterize ms (4× CPU throttle) | 3.26 | 2.51 |
| Long tasks during scroll | 0 | 0 |

Mask canvas sizes: 1024×640 (desktop, 2.62 MB/upload) and 473×1024 (mobile,
1.94 MB/upload). 30 rasterizations/s × full-canvas upload is the bandwidth
baseline; every scroll event re-measures DOM text and re-runs filtered
`fillText` for every visible element.

The counts differ slightly from the historical numbers in the task brief
(118 rasterizations, ~50k Range calls, 5.3k `fillText`) because the page
content changed since that measurement (release accordion content, theme
edits). The harness is the source of truth for before/after comparisons.

## Parity baseline

`docs/text-mask-parity/baseline.json` stores a 128-px-long-side screen-space
grayscale sample for 8 variants × 3 scroll positions × 2 viewports (48
captures). Sampling in screen space keeps the baseline comparable when the
mask later moves to document space. Comparison threshold: ≤2% of pixels may
differ by >8/255 and mean absolute difference must stay ≤1.5/255.

## Phase 1 — cached line layout

Per-element layout (font, ascent/descent, document-space lines, visibility) is
measured once per layout version. Scroll now calls `setDirtyPosition()`, which
redraws the cached lines at `docY - scrollY` with no DOM reads. Resize, font
events, the refresh event, `ResizeObserver`, and `MutationObserver`
(characterData/childList/relevant attributes) call `invalidateLayout()`.
Multi-line text nodes use a binary search over line boundaries instead of one
Range query per character; bidi, zero-width, and pre-formatted text keep the
exact per-character fallback.

Back-to-back run, same page content (the machine was busy, so absolute times
are higher than the earlier baseline; compare Phase 0 and Phase 1 columns):

| Metric | Desktop P0 | Desktop P1 | Mobile P0 | Mobile P1 |
|---|---:|---:|---:|---:|
| Startup rasterizations | 9 | 5 | 9 | 6 |
| Rasterizations / s | 23.5 | 23.3 | 27.0 | 19.3 |
| Range calls / raster | 496 | **0** | 434 | **0** |
| `fillText` / raster | 45.4 | 45.1 | 59.7 | 57.4 |
| Upload MB / s | 61.6 | 60.9 | 52.3 | 37.3 |
| Rasterize ms (no throttle) | 4.03 | **0.55** | 2.46 | **0.52** |
| Rasterize ms (4× throttle) | 11.01 | **1.56** | 9.54 | **1.54** |

Cache-hit rasterize time is −79% to −86% at 4× throttle; layout passes no
longer happen during scroll (draw-only). The remaining cost is the clear +
two filtered `fillText` passes, which Phase 3 targets. Visual parity: all 48
captures 0.000% differing pixels.

## Phase 2 — redundant invalidation removed

- `domRepulsion` is no longer an effect dependency; only the 0 → >0 transition
  calls `invalidateLayout()` (the per-frame strength update already lives in
  `renderChladniFrame`). Dragging the slider causes zero rasterizations.
- Startup timeouts: six → one 600 ms fallback. The immediate constructor draw,
  `document.fonts.ready` + rAF, `ResizeObserver`, and `MutationObserver` cover
  the rest. Measured startup rasterizations: **2** (desktop and mobile; target
  ≤4, was 9/11).
- Removed the duplicate resize invalidation from `useCameraControls`; the
  manager's own `resize` listener owns it.
- Added a content signature (viewport/canvas size, per-element type,
  visibility, document rect, font key, text, and line positions). Layout
  invalidations that leave it unchanged skip `drawLayout()` and
  `texture.needsUpdate`. Redundant font-ready/observer/fallback passes are now
  no-ops.
- Hero accordion: the 0/80/160 ms dispatches are replaced by the observers
  plus one `transitionend` refresh (opacity), so there is no per-frame
  dispatch storm during the 200 ms panel animation.

Visual parity remains 0.000% across all 48 captures.



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

# Phase 3 performance results

Before/after for the T3 items implemented in this pass, measured with
`bun run baseline` (headless Chromium, ANGLE Metal renderer, 1440 × 900,
DPR 1) against a production build.

- **Before:** `docs/perf-baseline.json` as committed in `9fe90ed`
  (after the text-mask/font work that landed earlier in this branch).
- **After:** `docs/perf-baseline.json` as committed alongside this document.

Both runs use the same harness and hardware; the only difference is the
code under `perf(...)` commits in this branch.

## Bundle

| Item | Before | After | Delta |
|---|---:|---:|---:|
| Main JS | 951,207 B | 862,588 B | −88,619 B (−9.3%) |
| CSS | 96,199 B | 99,703 B | +3,504 B |

The JS drop is the lazy-loading split (3.4): `ControlPanel` (62.5 kB) and
`WasmResearchLab` (35.0 kB) are now separate chunks fetched on first open.
They are not part of the initial payload, so the main chunk is smaller even
though total shipped bytes are unchanged.

## Runtime

### Idle / scroll (default GPU engine, 10 s each)

| Metric | Before | After |
|---|---:|---:|
| Idle FPS | 60.1 | 60.1 |
| Idle p99 | 16.8 ms | 16.8 ms |
| Scroll FPS | 60.0 | 60.1 |
| Scroll p95 | 16.8 ms | 16.8 ms |
| Scroll dropped frames | 0 | 0 |
| Scroll `fillText` calls | 14,966 | 13,892 (−7.2%) |

Scroll was already at 60 fps before this pass (the big 44.9 → 60 fps win
came from the earlier text-mask work). This pass trims another ~7% of
`fillText` calls by coalescing Hero accordion refreshes and by not
re-rasterizing on redundant events.

### Engine runs (60 s each)

| Engine | FPS before → after | p99 | Dropped | Heap | Live textures |
|---|---|---:|---:|---:|---:|
| GPU | 60.0 → 60.0 | 16.8 → 16.8 ms | 0 → 0 | 10.0 → 10.0 MB | 8 → 8 |
| WASM | 60.0 → 60.0 | 16.8 → 16.8 ms | 0 → 0 | 10.0 → 10.0 MB | 8 → 8 |
| JS CPU | 60.0 → 60.0 | 16.8 → 16.8 ms | 0 → 0 | 10.0 → 10.0 MB | 8 → 8 |

No regression in frame pacing, memory, or texture count. The scatter-texture
leak fix (3.6) does not show in these numbers because the harness does not
scatter during the engine runs; it removes one `DataTexture` allocation +
GPU upload per scatter/reset in normal use.

### Load

FCP/LCP are noisy at this scale (a single warm navigation per scenario).
Across runs they ranged from 156 ms to 400 ms with TBT at 0 ms; no
consistent regression or win is attributable to these changes. The font
preload reduction (3.5) removes ~960 kB of preloads, which shows up as
fewer bytes before first paint rather than as a lower FCP on a warm local
server.

## Not yet measured / not in this pass

- 3.1 (deeper text-mask layout caching), 3.2 (telemetry sample reduction),
  3.3 (metrics isolation — idle React commits are still ~7.5/s), 3.7
  (vendor chunking) were not part of this pass.
- Scroll `fillText` remains the best proxy for rasterization; the harness
  does not expose a dedicated counter.

## Reproduce

```bash
bun run build
bun run baseline
```

The harness now drives Vite's preview binary directly, so it is unaffected
by `bun run preview` mapping to `wrangler dev`.

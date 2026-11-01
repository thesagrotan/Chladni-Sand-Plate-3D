# Performance baseline — pre-refactor

Captured on 2026-11-01 from the production build at HUD commit `77497da`.
Raw results: [`perf-baseline.json`](./perf-baseline.json).

## Environment

| Item | Value |
|---|---|
| Machine | Apple M4 (macOS, arm64) |
| Browser | Chromium 156.0.8078.4 (Playwright headless) |
| GPU path | ANGLE (Apple, Metal Renderer: Apple M4) |
| Viewport | 1440 × 900, DPR 1 |
| Build | `bun run build` → `vite preview` on port 4173 |
| Measurement | `bun run baseline` |
| Warm-up | One full page load before the measured scenarios |

Headless Chromium defaults to SwiftShader. The harness forces
`--use-angle=metal --enable-gpu --ignore-gpu-blocklist` so frame timings reflect
the Metal GPU path. A SwiftShader run is not comparable and is not included.

## Static baseline

| Item | Value |
|---|---|
| JS bundle | 951,177 B (951.17 kB; 255.46 kB gzip) |
| CSS bundle | 95,234 B (95.23 kB; 11.96 kB gzip) |
| `public/` | 42 MB |
| `dist/` | 50 MB |
| `public/fonts` | 30 MB, 237 files |
| `@font-face` blocks | 198 |
| `url()` font references | 218 total, 94 unique, 124 duplicate |
| Referenced font files | 90 exist (8.78 MB) |
| Missing/malformed references | 4 `BB Manual Mono` paths truncated at `(` |
| Unreferenced font files | 147 (23.0 MB), includes `.DS_Store` |
| Font preloads in `index.html` | 11 files, 960,698 B |
| Unused media | 9.1 MB MP4 under `public/assets/aistudio` |
| Lockfile | `bun.lock` only |

## Runtime baseline

### Load (cold navigation after warm-up)

| Scenario | FCP | LCP | CLS | TBT | Long tasks |
|---|---:|---:|---:|---:|---:|
| Default load | 1,176 ms | 1,176 ms | 0.000004 | 13 ms | 1 (63 ms) |
| GPU engine | 1,100 ms | 1,100 ms | 0.000004 | 0 ms | 0 |
| WASM engine | 1,152 ms | 1,152 ms | 0.000009 | 12 ms | 1 (62 ms) |
| JS CPU engine | 2,424 ms | 2,424 ms | 0.000009 | 13 ms | 1 (63 ms) |

The JS CPU navigation is an outlier in this run; the other three settle around
1.1 s FCP/LCP. There is no code splitting: the single 951 kB chunk is parsed
before first paint.

### Idle (10 s, default GPU engine)

| Metric | Value |
|---|---:|
| Frames | 601 |
| p50 / p95 / p99 frame | 16.7 / 16.7 / 16.8 ms |
| FPS | 60.0 |
| Dropped / long frames | 0 / 0 |
| React commits | 75 (7.5/s) |
| 2D `fillText` calls | 0 |
| Live WebGL textures | 8 |

Idle frame pacing is clean, but the app still re-renders ~7.5 times per second
for telemetry, and allocates no new textures.

### Scroll (10 s, full page, default GPU engine)

| Metric | Value |
|---|---:|
| Frames | 450 |
| p50 / p95 / p99 frame | 16.7 / 50.0 / 66.7 ms |
| FPS | 44.9 |
| Dropped / long frames | 52 / 16 |
| Scroll events | 449 |
| React commits | 73 (7.3/s) |
| 2D `fillText` calls | 13,054 (~1,305/s) |
| Live WebGL textures | 8 |

Scroll is the dominant pre-refactor jank source: 44.9 fps with a 50 ms p95 and
16 long frames in 10 s. The text-mask rasterizer redraws every tracked element
twice per update (`fillText` count is the proxy for `rasterizeText()` passes).

### Engine runs (60 s each)

| Engine | p50 / p95 / p99 | FPS | Dropped / long frames | React commits | Heap before → after | Live textures |
|---|---|---:|---:|---:|---:|---:|
| GPU | 16.7 / 16.7 / 16.8 ms | 60.0 | 0 / 0 | 450 | 10.6 → 10.6 MB | 8 |
| WASM | 33.3 / 33.4 / 50.0 ms | 30.1 | 433 / 15 | 452 | 10.6 → 10.6 MB | 8 |
| JS CPU | 33.3 / 33.4 / 50.0 ms | 30.0 | 466 / 13 | 450 | 11.9 → 11.9 MB | 7 |

Both CPU engines settle at 30 fps. The canvas caps CPU engine grain counts at
35k and the engines are constructed even when the GPU engine is active. The GPU
engine holds 60 fps and stable memory.

## Measurement notes

- `React commits` is counted through a minimal
  `__REACT_DEVTOOLS_GLOBAL_HOOK__.onCommitFiberRoot` shim injected before app
  scripts.
- `fillText` calls are counted by wrapping `CanvasRenderingContext2D.prototype.
  fillText`; this is a proxy for text-mask rasterization because the production
  code does not expose `rasterizeText()` counters.
- Live textures are `createTexture` minus `deleteTexture` on
  `WebGL2RenderingContext.prototype`; this approximates `renderer.info.memory`
  without exposing the Three.js renderer.
- Scroll is synthetic: the harness sets `scroll-behavior: auto` for the run so
  the page traverses the same 2,140 px every time.
- `loadEventEnd` is reported as `0` by Chromium for this page; `navigationMs`
  is the wall-clock `goto(..., { waitUntil: 'load' })` duration.
- The baseline is a single workstation run. Re-run `bun run baseline` on the
  target hardware before accepting Phase 3 deltas.

## Findings confirmed by this baseline

- **P2 (scroll text-mask rasterization)** — 44.9 fps, p95 50 ms, ~1.3k
  `fillText` calls/s during scroll.
- **P3 (telemetry re-renders)** — ~7.5 React commits/s while idle; ~450 commits
  per 60 s engine run.
- **S15 / S16 (CPU engines)** — both CPU engines run at 30 fps and are created
  regardless of the selected engine.
- **P4 (single chunk)** — 951 kB JS / 95 kB CSS with no splitting.
- **P5 (font preloads)** — 11 preloads / 961 kB before first paint.
- **P6 (unused media)** — 9.1 MB MP4 copied into `dist/`.

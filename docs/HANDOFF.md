# Handoff: Chladni Sand Plate 3D / TEZETT PLATTE refactor

You are a senior frontend engineer taking over an in-progress refactor. The
original audit and phases 0–1 are complete. Phases 2 is ~60% done and phase 3
has not started. This document is the source of truth for what remains. Do not
re-run the discovery/audit phase.

- **Repo:** `/Users/daniel/Developer/Chladni-Sand-Plate-3D`
- **Branch:** `main`
- **Current HEAD when this was written:** `1af3bad`
  (`refactor(canvas): extract animation loop into renderChladniFrame`)
- **Package manager:** `bun` (the only lockfile is `bun.lock`). Do not switch to npm.
- **Uncommitted working tree at handoff:** `src/components/sections/About.tsx`
  and `src/components/sections/Hero.tsx` (`md:px-20` → `md:px-40`, plus a
  trailing newline). These are **not** part of the plan — do not fold them into
  refactor commits; ask the owner or commit them separately.

## Ground rules (already decided — do not re-litigate)

- Preserve visual and audio behavior except where a task explicitly says to change it.
- **Do not rewrite the simulation or shader math.** Shader equations only change with a parity test.
- Prefer small, independently shippable commits. Each commit must leave `bun run lint` and `bun run build` green.
- Do not add a state-management library unless metrics isolation genuinely requires it.
- Keep the HUD enabled (default on, `H` toggle, corner button).
- Do not delete font files (licensing unconfirmed). Only remove the already-removed non-font junk.
- Do not add secrets. Do not push or open a PR unless asked.
- Where a change is risky, keep the old implementation behind a flag until parity is proven, then delete it.

## Commands

```bash
bun install
bun run lint        # tsc --noEmit
bun run build
bun run test        # vitest run
bun run test:e2e    # Playwright browser specs
bun run check:budgets # bundle/font/scroll budgets (run after build)
bun run dev         # Vite on :3002
bun run preview     # production preview (use for perf traces)
bun run build:wasm  # regenerate/verify the embedded WASM
bun run baseline    # re-run the perf baseline harness
```

Runtime/perf traces must use headless Chromium **with the Metal GPU path**
(`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`); SwiftShader timings
are not comparable. The harness in `scripts/perf-baseline.mjs` already does this.

## What is already done (do not redo)

### Phase 0 — baseline & safety net
- `77497da` HUD re-enabled and committed separately.
- `2b01c37` characterization test suite + pre-refactor baseline.
- `docs/perf-baseline.md` / `docs/perf-baseline.json`, harness `scripts/perf-baseline.mjs`,
  `bun run baseline` script.

### Phase 1 — safe deletions / cleanup
- `61d1e21` dead imports, dead ControlPanel props, unused aliases, no-op font-size controls.
- `a5e64d4` unused deps removed; build-only packages moved to devDependencies.
- `66f50bd` unused 9.1 MB MP4 and stray `.DS_Store` removed.
- `33ce04e` deterministic WASM build/verify script (`scripts/build-wasm.mjs`, `bun run build:wasm`).
- `37c8030` WASM parity relabeled "within 0.5% tolerance" (was "100% Bit-Accurate").
- `93de8c1` `geometric` preset tag given its own filter.
- `be99ac5` dead `uDelta` uniform removed; unused `@` alias removed.

### Phase 2 — structural cleanup (partial)
- `923a88e` settings hydration/persistence extracted to `src/hooks/useChladniSettings.ts`.
- `ac369e0` `Hero`, `About`, `Facility`, `Contact` extracted to `src/components/sections/`.
- `fb5d20e` GLSL sources extracted to `src/simulation/shaders/chladniShaders.ts`.
- `b38b1fb` pan/zoom/pointer/keyboard/resize extracted to `src/hooks/useCameraControls.ts`
  (exports `VRANGE`).
- `1af3bad` animation loop extracted to `src/simulation/renderChladniFrame.ts`
  (owns per-frame engine update, uniform sync, background transform, telemetry emission).
- `b970581` unified grid catalog, randomizer, and font selection
  (`src/utils/grid.ts`, `src/utils/fonts.ts`).
- `9ac0881` storage consolidated + sanitization completed (`src/utils/storage.ts`).
- `cbfe1fc` palette lock + `paletteId: 'silica'`; saved void settings preserved.
- `36873e3` CPU telemetry uses audio-reactive effective params.
- `68359c5` grain engines rebuild on bucket/CPU-count change.
- `b2ff9d2` CPU engines + WASM constructed only when their engine is selected.
- `tests/parity/mathParity.test.ts` added (JS vs WASM math parity — verify coverage).

## Current sizes (definition-of-done target: components under ~400 lines)

| File | Lines | Status |
|---|---|---|
| `src/App.tsx` | 418 | ⚠️ slightly over (lazy-load wiring + prefetch) |
| `src/components/ChladniCanvas.tsx` | 29 | ✅ thin shell |
| `src/components/ControlPanel.tsx` | 450 | ⚠️ shell + section components; ~50 over |
| `src/components/WasmResearchLab.tsx` | 864 | ❌ unchanged (now lazy-loaded) |

T1 and T2 have since landed (`08d1f3f`, `2dd0aea`, `1b60e40`).

## Pending tasks

### T1 — Finish the Canvas split (plan 2.2)

`src/components/ChladniCanvas.tsx` is now 528 lines. It still contains:
- all Three refs (lines ~41–76),
- `useCameraControls(...)` call (line ~78),
- one large mount `useEffect` (line ~93): software-GL detection, `TextMaskManager`
  construction, `Scene`/camera/renderer setup, background quad, `ChladniGpuSimulation`
  + grain geometry/material/points, initial flips, CPU telemetry grains, then the
  `frameDeps` bag + `animate` RAF loop + cleanup,
- five prop-sync effects: scatter (`~337`), reset (`~353`), grain-count rebuild
  (`~394`), lazy CPU engine construction (`~462`), text-mask refresh (`~495`),
- the container `div`.

Target modules (names are suggestions; keep the plan's spirit):
- `src/hooks/useChladniCanvas.ts` — owns renderer/scene/camera/quad/grain setup and
  exposes the refs the caller needs. The component becomes a thin shell.
- `src/simulation/EngineManager.ts` (or a hook) — owns GPU sim + lazy CPU/WASM engine
  construction, grain-count rebuild, and scatter/reset particle resets. This is the
  riskiest piece; preserve the debounce/threshold and lazy-construction behavior from
  `68359c5` and `b2ff9d2` exactly.
- Telemetry is already inside `renderChladniFrame.ts`; only extract a
  `useChladniTelemetry` seam if you also do T3.3 (metrics isolation).

**Verification:** engine matrix (GPU default, WASM, JS CPU), scatter/reset, pointer push,
zoom/pan, keyboard camera keys, text repulsion, grain-count slider across the bucket
threshold and the 35k CPU cap, and metrics updating. Reuse the parity check pattern used
for `renderChladniFrame`: the extracted body must be whitespace-identical to the original
modulo intended renames. Commit each extraction separately.

### T2 — Split ControlPanel (plan 2.3)

`src/components/ControlPanel.tsx` is 1,937 lines and mixes: audio visualizer, font upload,
version history, presets, and grid/typography/resonance/audio control domains.
Split into a shell plus:
`GridSection`, `TypographySection`, `AudioSection`, `VersionHistory`, `PresetsSection`,
and shared primitives (`SliderRow`, `AudioVisualizer`, `formatTime`).

**Verification:** exercise every control; font upload; version save/restore;
audio visualizer; presets. Keep behavior byte-for-byte; commit per section.

### T3 — Phase 3 performance work

Each item requires a before/after trace against `docs/perf-baseline.md`; attach numbers to
the commit/PR. Results for the completed items are in
[`perf-phase3.md`](./perf-phase3.md).

- ✅ **3.4 Lazy-load** `ControlPanel` and `WasmResearchLab` — code-split behind
  `React.lazy` + `Suspense`, prefetched on pointer intent. Main JS −9.3%.
- ✅ **3.5 Font delivery** — Neue Montreal converted to WOFF2 (full weight range),
  only the first-paint font is preloaded (11 → 1 preloads, ~960 kB removed).
  Original OTFs remain in git history as rollback.
- ✅ **3.6 Small fixes** — `scatter()` staging `DataTexture` disposed;
  `AudioVisualizer` rAF stops when audio is idle; `evalChladniGrad` takes an
  optional scratch array (no per-grain tuple); cursor + HUD progress animate via
  `transform` instead of width/height; `transition-all` replaced with explicit
  property lists.
- ✅ **3.8 Cache telemetry** — active-fraction sample memoized on the wave/void
  parameter key; paused frames already skip the block.
- ⬜ **3.1 Text mask** — partial: hidden/collapsed elements skipped, dirty marking
  coalesced to one rasterize per frame, per-element line layout still re-measured.
  Remaining: cache per-element line layout, binary-search line boundaries,
  `OffscreenCanvas`/worker.
- ⬜ **3.2 Telemetry sample budget** — still up to 5 wave evals per active grain
  over 1,024 grains; array reuse is done, sample-count reduction is not.
- ⬜ **3.3 Metrics isolation** — `onMetricsUpdate` still drives a `setState` in
  `App` ~8×/s (idle React commits unchanged at ~7.5/s). Needs
  `useSyncExternalStore` + selectors.
- ⬜ **3.7 Vendor chunking** — not needed yet; revisit if the 862 kB main chunk
  still hurts.


### T4 — Test gaps (plan §6) — ✅ complete

Vitest now covers 11 files / 71 tests (`tests/*.test.ts`, `tests/parity/`).
Landed:

- **GLSL vs JS parity** — `tests/parity/glslParity.test.ts` compiles
  `CHLADNI_GLSL_FUNCTIONS` into an offscreen RGBA32F framebuffer via Playwright
  Chromium and compares `computeChladniW` + `computeChladniGrad` against the JS
  reference over 24 grid/void combinations. Tolerances are `1e-3` for the wave
  and `0.03` for the gradient (float32 + SwiftShader trig precision).
- **Grain-count behavior** — `tests/grainCount.test.ts` covers the 7,500-grain
  (15% of the 50k default) bucket boundary, the 35k CPU cap, lazy CPU/WASM
  construction, reuse within a bucket, and rebuilds when the capped count
  changes.
- **Scatter/reset engines** — `tests/engineManager.test.ts` verifies the shared
  scatter/reset path resets the GPU, WASM, JS CPU, and telemetry grains (and
  tolerates a partially constructed engine set).
- **Playwright e2e** — `playwright.config.ts` + `e2e/*.spec.ts`
  (`bun run test:e2e`): WebGL/UI/audio smoke, keyboard shortcuts
  (D/H/Space/S/R/W/M/G), presets, local font upload, named version
  save/restore/delete, a no-WebGL fallback, and the software-renderer path.
- **No-WebGL fallback** — `useChladniCanvas` probes WebGL2 before constructing
  the renderer and catches renderer failures; `ChladniCanvas` exposes
  `data-webgl-status` and renders a notice while leaving the DOM site usable.
- **Performance budgets in CI** — `scripts/check-perf-budgets.mjs`
  (`bun run check:budgets`) checks main/total JS, CSS, preloaded font bytes, and
  scroll long tasks against `dist/`. Software renderers (CI SwiftShader) use
  wider scroll budgets because those timings are not comparable with Metal.
  `.github/workflows/ci.yml` runs lint, Vitest, build, budgets, and e2e.

### T5 — Housekeeping / leftover findings (not in a phase)

- **D8 stale AI Studio config:** `package.json` name is still `react-example`; `clean`
  script still does `rm -rf dist server.js`; `README.md` is AI Studio boilerplate
  (`GEMINI_API_KEY`, `npm install`); `metadata.json` and `.env.example` are stale. Update
  to reflect `bun` and this app; remove genuinely unused files.
- **D15 (suspected):** `Replica-Mono` maps to `ReplicaPro-Regular2.otf`, not a mono cut —
  confirm and either fix or document.
- `.env` / `.env.example` still reference `GEMINI_API_KEY`; there is no runtime use of it.

## Definition of done

- **Phase 2:** components under ~400 lines; one source of truth for grid/font/random;
  no duplicated font-selection logic; tests green.
- **Phase 3:** baseline-vs-after metrics attached; no regression in frame time, memory,
  or visual output.
- **Final report:** files changed, tests added, before/after perf numbers, remaining blockers.

## External blockers

- **Font licensing:** no LICENSE under `public/fonts` or the repo root. Do not delete fonts;
  leave a TODO for legal confirmation. (Deletion tasks require that sign-off.)
- **Browser/device matrix:** assumed modern evergreen desktop + iOS Safari, 60 fps desktop /
  30 fps mobile, with a no-WebGL fallback. Adjust budgets only if product supplies a matrix.
- **Package manager:** `bun`. If unavailable, flag it — do not silently switch to npm.

## Reference: original decisions that shaped the code

- HUD stays default-on with `H` and the corner toggle.
- Section tracking / `autoSectionGrid` scaffolding was dead and has been removed.
- Brand palette is the site default; applying the locked palette sets `paletteId: 'silica'`.
- Saved void/preset settings survive reload (forced resets removed).
- `headerFontSize`/`bodyFontSize` were dead params and were removed with their selects.
- CPU/WASM engines are secondary/benchmark engines, lazily constructed.
- Embedded base64 WASM is the runtime artifact; `chladni.as.ts` and `.wat` are source/reference.
- Benchmark shows "within 0.5% tolerance", not "100% Bit-Accurate".
- `bun.lock` is the only lockfile.

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
| `src/App.tsx` | 379 | ✅ under target |
| `src/components/ChladniCanvas.tsx` | 528 | ❌ |
| `src/components/ControlPanel.tsx` | 1,937 | ❌ |
| `src/components/WasmResearchLab.tsx` | 864 | ❌ |

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
the commit/PR. None of these are started.

- **3.1 Text mask** (`src/utils/TextMaskManager.ts`): cache per-element line layout,
  binary-search line boundaries, invalidate only on real layout change, reduce blur
  passes, consider `OffscreenCanvas`/worker. Currently does per-character layout reads,
  `getComputedStyle`, blurred draws at ~35 Hz during scroll. Largest scroll-jank win.
- **3.2 Telemetry** (the CPU-sample loop in `renderChladniFrame.ts`): 256–512 samples at
  8–10 Hz, reuse arrays, use WASM eval when loaded. Currently up to 5 wave evals per
  active grain over 1,024 grains per frame.
- **3.3 Metrics isolation**: `onMetricsUpdate` currently drives a `setState` in `App`
  ~8×/s, re-rendering the whole app and any open panel. Move to
  `useSyncExternalStore`/context + selector so only visible consumers update.
- **3.4 Lazy-load** `ControlPanel` and `WasmResearchLab` (statically imported in `App`),
  and defer WASM/JS engine construction. (Engine deferral partly done in `b2ff9d2`.)
- **3.5 Font delivery**: subset/remove unused weights, OTF/TTF → WOFF2, preload only
  first-paint fonts, self-host Geist Mono. `index.html` has 11 preloads (~0.96 MB) and
  `public/fonts` is ~30 MB. **Do not delete font originals** — they are the rollback.
- **3.6 Small fixes**: dispose the `DataTexture` created in `ChladniGpuSimulation.scatter()`;
  pause the `AudioVisualizer` rAF when audio is disabled; remove the per-call tuple
  allocation in `chladniMath.evalChladniGrad`.
- **3.7 Vendor chunking** in `vite.config.ts` if lazy-loading isn't enough.
- **3.8 Cache telemetry** when paused or params unchanged.

### T4 — Test gaps (plan §6)

Vitest covers 9 files / ~66 assertions (`tests/*.test.ts`, `tests/parity/`). Still missing:
- GLSL vs JS parity via offscreen framebuffer readback (item 2).
- Grain-count change behavior around the 15% threshold and CPU caps (item 7).
- **Playwright e2e** (dependency is installed but there is no config and no specs):
  WebGL/audio/UI smoke, keyboard shortcuts, scatter/reset, presets, font upload, version
  history (items 10–11), and a no-WebGL/software-renderer fallback (item 11).
- Performance budgets in CI: bundle size, initial font bytes, scroll long tasks (item 12).

`scripts/perf-baseline.mjs` already drives Playwright's bundled Chromium — reuse it for e2e.

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

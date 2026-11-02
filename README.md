# Chladni Sand Plate 3D — TEZETT PLATTE

An interactive 3D simulation of acoustic resonance. Sand grains bounce across a
vibrating plate and settle on the still nodal lines of a Chladni figure. The
figure responds to audio, pointer pushes, and the resonance controls in the
panel, and can be rendered by a WebGL/GLSL GPU simulation, a WASM kernel, or a
plain-JS CPU fallback.

Built with React 19, TypeScript, Vite, Three.js and Tailwind CSS. Deployed as
static assets on Cloudflare via Wrangler.

## Requirements

- [Bun](https://bun.sh) — the package manager and script runner for this repo.
  `bun.lock` is the only lockfile; do not switch to npm or yarn.
- A WebGL2-capable browser (the app shows a notice and keeps the page usable
  when WebGL is unavailable).

## Getting started

```bash
bun install
bun run dev        # Vite dev server on http://localhost:3002
```

The production build is a static bundle in `dist/`:

```bash
bun run build
bun run preview    # serve dist/ through Wrangler (run build first)
```

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Vite dev server on port 3002. |
| `bun run build` | Production build into `dist/`. |
| `bun run preview` | Serve the built app with `wrangler dev`. |
| `bun run lint` | Type-check with `tsc --noEmit`. |
| `bun run test` | Unit and parity tests (Vitest). |
| `bun run test:e2e` | Browser tests (Playwright Chromium). |
| `bun run check:budgets` | Bundle, font and scroll budgets against `dist/` (run after `build`). |
| `bun run build:wasm` | Rebuild and verify the embedded WASM kernel. |
| `bun run baseline` | Re-run the performance baseline harness. |
| `bun run ci` | Everything CI runs: lint, unit tests, build, budgets, e2e. |
| `bun run deploy` | Deploy `dist/` with Wrangler. |

Runtime and performance traces must use headless Chromium with the Metal GPU
path (`--use-angle=metal --enable-gpu --ignore-gpu-blocklist`). SwiftShader
timings are not comparable; `scripts/perf-baseline.mjs` already sets this up.

## Project layout

```
src/
  App.tsx                 app shell, lazy-loaded panels, keyboard shortcuts
  components/
    ChladniCanvas.tsx     thin canvas shell
    ControlPanel.tsx      control-panel shell
    control/              grid, typography, audio, colour, presets, history
    sections/             Hero, About, Facility, Contact
    HudStats.tsx          live performance HUD (H to toggle)
    WasmResearchLab.tsx   WASM/CPU benchmark lab (lazy-loaded)
  data/releases.ts        label catalog; release ids bind to color themes
  hooks/                  camera controls, canvas setup, settings persistence
  simulation/             GPU / WASM / JS CPU engines, frame loop, audio synth
  utils/                  grid catalogue, font catalogue, storage, text masks
scripts/                  WASM build, perf baseline, budget checks
tests/                    Vitest unit + JS/WASM/GLSL parity tests
e2e/                      Playwright browser specs
docs/                     handoff notes and performance baselines
```

## Notes

- **Engines.** The GPU engine is the default. The WASM and JS CPU engines are
  secondary/benchmark engines and are only constructed when selected.
- **HUD.** Enabled by default; toggle with `H` or the corner button.
- **Persistence.** Settings, presets and named versions are stored locally in
  the browser; saved void/preset settings survive reload. Color themes are
  stored separately, so edits and release assignments survive a params reset;
  the plate itself still returns to the brand palette on reload.
- **WASM.** The runtime artifact is the embedded base64 module in
  `src/simulation/wasm/chladniWasmModule.ts`; `chladni.as.ts` and `chladni.wat`
  are source/reference. Benchmark parity is stated as "within 0.5% tolerance".
- **Fonts.** Files under `public/fonts` are bundled for the typography controls.
  Their redistribution licensing has not been confirmed — do not delete them
  without legal sign-off.
- **No secrets.** The app makes no server-side API calls and needs no
  environment variables.

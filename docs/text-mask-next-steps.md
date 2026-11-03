# Text mask: further optimization — open research brief

Status after the Phase 0–5 work (`docs/text-mask-perf.md`). Scrolling is now
free; the remaining cost is elsewhere.

This document is deliberately **not** a roadmap. It contains:

1. **Observations** — measurements only, with no interpretation.
2. **Assumptions** — the premises currently baked into the implementation,
   written down so they can be attacked rather than inherited.
3. **An open research brief** — to be handed to a web-enabled researcher who is
   asked to survey the problem and the whole design space, not to evaluate a
   shortlist.
4. **A decision framework** — how to turn findings into a plan.
5. **Provisional hypotheses** — explicitly guesses, expected to be replaced by
   whatever the research returns.

Read Part 3 as the deliverable. Parts 4–5 exist only so that nothing is lost if
the research takes a while, and they are marked as provisional so they cannot
quietly become the frame.

---

## 1. Observations

Measured on an M4, headless Chromium, ANGLE Metal, 1440×900, DPR 1, GPU engine,
50k grains unless stated. Full method and parity notes in
[`text-mask-perf.md`](./text-mask-perf.md).

| Scenario | Measurement |
|---|---|
| Scroll, any length, DPR 1 and 3 | 0 rasterizations, 0 DOM reads, 0 texture uploads |
| Startup | 2 rasterizations, 1 upload of 1.88 MB desktop / 2.22 MB mobile |
| Window resize | 1 rasterization |
| DOM-repulsion slider drag (1.0 → 9.2) | 0 rasterizations |
| Font-weight slider drag | 9 rasterizations, 280 ms rasterize, 234 element bitmap builds, 15.7 MB uploaded, 6.2 s wall clock |
| Tracking slider drag | 13 rasterizations, 146 ms rasterize, 338 element bitmap builds, 25.2 MB uploaded, 4.3 s wall clock |
| GPU frame time, mask on vs off, 50k grains | 16.67 ms avg in both cases (vsync-bound) |
| GPU frame time, mask on vs off, 200k grains | 19.25 ms vs 16.67 ms avg; p95 33.4 ms vs 16.8 ms |
| Atlas size | 1024×1833 desktop, 473×4689 mobile portrait |
| Element bitmap cache | 1.2 MP desktop, 1.7 MP mobile |

### What these numbers do *not* tell us

- Whether the 2.6 ms at 200k grains is the texture fetches, the mat3 multiply,
  the bounds test, register pressure, or occupancy. No per-pass GPU timing
  exists yet.
- Whether the typography-drag cost is dominated by canvas drawing, blur
  filtering, texture upload, browser text reflow, or React re-rendering. Only
  the mask side is instrumented.
- Whether the effect would still look right if it were cheaper in a different
  way. Nobody has tested a lower-fidelity approximation against the current one.
- Whether the current architecture (DOM text → Canvas2D → texture → per-grain
  shader sample) is the right shape at all. It has never been compared against
  alternatives, only optimized internally.

---

## 2. Assumptions currently baked in

These are the premises the implementation rests on. They are listed so the
research can challenge them, and so we notice if a finding quietly contradicts
one.

1. **The mask must be a raster image sampled per grain.** Alternative shapes:
   analytic distance fields evaluated in the shader, a coarse force field, a
   particle-level approximation, or no per-grain repulsion at all.
2. **The browser's DOM layout is the source of truth for text position.** The
   canvas redraws what the DOM already laid out. Alternative: render the text
   ourselves and stop using DOM text for this layer.
3. **Glyph fidelity must match the DOM pixel-for-pixel**, including blur, so the
   mask is invisible and only the sand reveals it.
4. **The mask must update while the user drags typography sliders**, at
   interactive latency.
5. **The mask must be recomputed on the main thread**, because `Range` and
   `getComputedStyle` are main-thread-only.
6. **The effect belongs in the existing WebGL2 pipeline**, not a separate
   canvas, layer, or engine.
7. **Per-grain repulsion is the right interaction model** for "sand avoids
   text". Alternative: a precomputed displacement/flow field, a coarser
   particle set, or a purely visual composite.
8. **One document-wide atlas is fine**, and reducing uniform scale on very tall
   pages is an acceptable degradation.

Any of these could be wrong. Assumption 7 in particular has never been tested:
it is a product decision inherited from the original implementation.

---

## 3. Research brief

Paste the block below into a web-enabled agent. It is written to survey, not to
confirm. If you adapt it, keep the "challenge the framing" sections — they are
the point.

```text
ROLE
You are an independent graphics and web-performance researcher brought in to
review a rendering technique. You have no stake in the current implementation.
Your job is to map the problem and the design space, tell me what I have not
considered, and say plainly if the current approach is the wrong shape.

Do not treat my existing implementation as the frame of reference. It is one
point in the design space, arrived at incrementally. Treat it as evidence of
what has been tried, not as a constraint on what is possible.

THE EFFECT (what the user sees)
A WebGL2 + Three.js site (three r186, TypeScript, Vite) renders a Chladni
sand-plate simulation: tens of thousands of grains drift over a vibrating plate
and settle on nodal lines. A layer of real DOM text sits over the canvas. The
sand is pushed out of the letterforms, so text appears as clean negative space
in the sand. The text is normal HTML — it reflows, it is selectable, it follows
the site's typography controls (font family, weight, italic, variable-font axes,
letter-spacing), and it scrolls with the page.

THE GOAL
Make this effect cost approximately nothing: no measurable main-thread work
during scroll or during typography changes beyond what the browser already does
to reflow the text, and no measurable GPU cost at grain counts up to ~1M. It
must keep looking identical — same glyph contours, same soft edge, same
behaviour at any scroll position, rotation, flip and zoom.

CONSTRAINTS
- Modern evergreen desktop plus iOS Safari. 60 fps desktop, 30 fps mobile.
  There is a no-WebGL fallback.
- The site must keep working as a normal DOM document (SEO, selection,
  accessibility, text reflow).
- Adding a dependency is allowed if it is justified; state license, bundle
  size, maintenance status.
- Visual parity with today's output is a hard requirement for whatever ships,
  but you may propose a staged plan where an approximation is validated first.

WHAT EXISTS TODAY (status quo, not a recommendation)
- Text is rasterized with Canvas2D: per element, two blurred fillText passes
  (a wide soft halo and a tight core) into a canvas, which becomes a texture.
- The canvas is a document-space atlas: width = viewport width × scale, height =
  document height × scale, capped to MAX_TEXTURE_SIZE by reducing the scale.
- Per-element offscreen bitmaps are cached and composited with drawImage, so a
  scroll does not redraw text.
- The particle shader maps each grain's world position into atlas UV with a
  precomputed mat3, samples the mask, and pushes the grain along the negated
  gradient of the sampled density.
- Mask texture is single-channel R8, linear filtered, no mipmaps.

MEASURED TODAY (M4, headless Chromium, ANGLE Metal, 1440x900, DPR 1)
- Scroll: zero main-thread work attributable to the mask.
- Startup: 2 rebuilds, one ~1.9 MB upload.
- Dragging a font-weight slider: 9 mask rebuilds, 280 ms of rasterization,
  234 per-element bitmap rebuilds, 15.7 MB uploaded, over a 6.2 s drag.
- Dragging a tracking slider: 13 rebuilds, 146 ms, 338 bitmap rebuilds,
  25.2 MB uploaded.
- GPU: no measurable mask cost at 50k grains (vsync-bound either way); at 200k
  grains the frame goes from 16.67 ms to 19.25 ms average, p95 16.8 to 33.4 ms.
  No per-pass GPU timing exists yet, so this is not attributed to anything.

WHAT I WANT FROM YOU

A. Challenge the framing
   - Which of my implicit assumptions look wrong or unnecessary to you? The
     ones I know I am making are: the mask must be a raster sampled per grain;
     DOM layout must be the source of truth for text position; glyphs must
     match the DOM pixel-for-pixel; the mask must update live during slider
     drags; the work must happen on the main thread; the effect belongs in the
     existing WebGL2 pipeline; per-grain repulsion is the right interaction
     model; one document-wide atlas is acceptable.
   - Is there a materially different architecture for this effect that you
     would choose if starting today? Describe it concretely enough to estimate.
   - Is the effect over-engineered relative to what a viewer can perceive? If a
     cheaper approximation would be indistinguishable in motion, say which
     approximation and what would break.
   - Is there prior art for "text occludes / repels a particle simulation" in
     demos, games, or creative-coding libraries that solved this well? Name it.

B. Survey the design space
   Do not start from the techniques I might have in mind. Instead, decompose
   the effect into its independent stages and enumerate the alternatives at
   each stage yourself. A useful decomposition is:
   - representing text as something a renderer can query (geometry, field,
     raster, something else);
   - moving that representation to the GPU;
   - querying it per grain, or avoiding a per-grain query;
   - reacting to text changes and to camera/scroll changes;
   - deciding what "correct" even means for a soft-edged text mask.
   For every alternative you identify, give: the core idea, cost (main thread,
   GPU, memory, complexity), what it cannot do, maturity, and the single
   experiment that would reveal whether it works here.
   Then tell me which stages have no good alternative and why. If a stage is
   the real bottleneck, say so instead of listing options for it.
   Also cover anything that changes the *interaction model* rather than the
   implementation, and anything that would let us avoid the problem rather
   than solve it.

C. The parity question
   Whatever replaces the current raster has to agree with the browser's own
   text layout. Find out, with sources, how closely independently computed
   glyph advances (canvas measureText, fontkit/opentype.js/HarfBuzz metrics)
   match DOM layout for the same computed font-family, weight, style, size,
   letter-spacing and font-variation-settings — including kerning, shaping and
   fallback fonts. This is the decisive constraint on any "render the text
   ourselves" approach. If it cannot match, say so and explain the practical
   consequence.

D. The two measured symptoms
   For each, tell me how you would attribute the cost and what the likely cause
   is — but propose the attribution experiment first, before the fix:
   - typography drags rebuilding and re-uploading everything;
   - a per-grain mask sample costing ~2.6 ms/frame at 200k grains.
   Do not assume my guesses about the causes are right.

E. Measurement
   What is the current best practice for (a) timing a single GPU pass in
   WebGL2/three.js without stalling, (b) attributing main-thread time to
   script/style/layout/paint in Chrome, (c) measuring canvas and texture memory
   on iOS Safari without crashing the tab? Give versions and sources.

F. Long pages and edge cases
   At what document size does a single document-space atlas stop being
   reasonable, and what are the alternatives? How should fixed/sticky
   positioned text, `content-visibility`, and browser zoom be handled?

OUTPUT FORMAT
1. "If I were starting today" — your recommended architecture, in one page,
   with the reasoning.
2. Assumption audit — each assumption above: still valid, questionable, or
   wrong, with why.
3. Design-space survey — a table of approach families with cost, limits,
   maturity, and the experiment that would validate each.
4. Attribution plan for the two symptoms — experiment first, then the likely
   fix.
5. Sources — a table of claim | source URL | date | confidence | applies to our
   stack (yes/no/unclear).
6. Unknowns — anything you could not verify, phrased as the specific experiment
   that would settle it.

SOURCE STANDARDS
Prefer primary sources: specs (WHATWG/W3C), MDN, chromestatus.com, Chrome and
WebKit release notes, browser bug trackers, library repos and release notes.
For performance claims, prefer benchmarks that state hardware and versions.
Flag anything older than ~18 months as potentially stale. Mark speculation as
speculation — I would rather have "unknown" than a confident guess.

RELEVANT FILES (if you have repo access)
src/utils/TextMaskManager.ts, src/utils/TextMaskLayoutCache.ts,
src/simulation/ChladniGpuSimulation.ts, src/simulation/textMaskTransform.ts,
src/simulation/renderChladniFrame.ts, scripts/text-mask-parity.mjs,
tests/parity/maskPushParity.test.ts, docs/text-mask-perf.md
```

---

## 4. Decision framework

When the findings come back, choose in this order. The first step is not an
optimization; it is a decision about whether to keep optimizing.

1. **Did the audit find a wrong assumption?** If an assumption is wrong, the
   plan changes shape, not order. Re-plan before writing code.
2. **Is the effect over-engineered for what viewers perceive?** If a cheaper
   approximation is indistinguishable in motion, that is the best return
   available and should be validated before any architectural work.
3. **Which symptom is real?** Only optimize what a measurement attributes. The
   2.6 ms at 200k grains is real but may not be user-visible at the default
   grain count; the typography drag is user-visible but may not be
   mask-dominated.
4. **Prefer the change that removes a category of work** over one that makes
   the same work faster. Zero work beats fast work, and it survives future
   feature growth.
5. **Anything that risks parity ships behind a flag**, with the parity harness
   as the gate, and the old path deleted only after the matrix passes.

Guard rails that apply regardless of what the research says:

- Do not reintroduce per-scroll work.
- Do not move `Range`/`getComputedStyle` measurement into a worker.
- Do not trade glyph-contour fidelity for speed without a parity run.
- Do not change the Chladni wave or grain physics to make the mask cheaper.

---

## 5. Provisional hypotheses

These are **guesses**, written down so they can be falsified. They are not a
plan. The plan should be rewritten once Part 3 returns, and most of these
should be expected to lose. If the research recommends an architecture that
appears nowhere in this list, that is the intended outcome, not a gap in the
brief.

Each is phrased as: hypothesis → what would confirm it → what would kill it.

### H1 — Typography drag cost is dominated by full-atlas re-upload
Confirms: an incremental dirty-rect update cuts drag uploads from ~15–25 MB to
under 1 MB and cuts wall time proportionally.
Kills: uploads turn out to be a small share, and the cost is canvas blur or
React re-render.
Note: a `hole` repulsor type now paints with `destination-out`, so a dirty-rect
redraw must repaint everything drawn before an overlapping hole, in order. If
that makes the incremental path complicated, the hypothesis may not be worth
pursuing.

### H2 — Rebuilding once per animation frame is unnecessary during a drag
Confirms: coalescing to ~10 Hz plus a final rebuild on release cuts rebuild
count from 9–13 to 2–4 with no perceptible lag.
Kills: the mask visibly trails the DOM text mid-drag at 4× throttle.

### H3 — The GPU cost is the per-grain texture fetches, not the transform
Confirms: an A/B shader with the fetches removed but the mat3 and bounds test
kept shows most of the 2.6 ms disappearing; a precomputed force field recovers
it.
Kills: the cost stays with the fetches removed, meaning it is register pressure
or occupancy, and the fix is elsewhere.

### H4 — A precomputed force field preserves parity
Confirms: a screen-space direction/magnitude texture, generated per mask update,
reproduces the rendered parity test within tolerance at mask resolution.
Kills: direction quantization at reduced resolution visibly softens the grain
clearing near glyph edges.

### H5 — The current architecture is the right shape
Confirms: the research finds no approach that is both materially cheaper and
able to match DOM text layout.
Kills: signed-distance glyphs, or a different interaction model, turn out to be
both cheaper and parity-safe.

### H6 — Live mask updates during typography drags are required
Confirms: user testing shows the mask must track the text while dragging.
Kills: it is acceptable to update on release only, which removes the entire
class of drag-time cost.

H6 is worth testing early because it is the cheapest experiment here and would
make H1 and H2 moot.

---

## 6. What is explicitly out of scope until the research says otherwise

- Rewriting the simulation layer or moving to WebGPU.
- Any change to the Chladni wave math or grain physics.
- Rendering text with our own engine while the DOM still displays text
  underneath.
- Deleting the Canvas2D path before a replacement passes the parity matrix.

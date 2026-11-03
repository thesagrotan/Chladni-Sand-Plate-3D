# Text mask — research response

Answers to the brief in [`text-mask-next-steps.md`](./text-mask-next-steps.md).

Produced by running the code, not by reading it: every number marked **measured
here** comes from this repo at `localhost:3003` in Playwright 1.64's bundled
Chromium with `--use-angle=metal` (`ANGLE (Apple, ANGLE Metal Renderer: Apple
M4)`), 1440×900, DPR 1, dev build, default 50k grains unless stated. Numbers
marked **from perf doc** are quoted from `text-mask-perf.md` and were not
re-measured.

Three caveats that apply to everything below, stated once:

- **rAF frame deltas are vsync-quantised and drift.** The simulation's own cost
  changes as grains settle, so absolute frame times move by 2× within a single
  page load. Every A/B here is therefore order-sensitive. Where a result could
  not be made stable I say so instead of quoting it.
- **`rasterizeText()` does not measure rasterisation.** Canvas2D records draw
  commands and executes them lazily, so the real cost lands in `texImage2D`.
  A/B evidence in §4.1: the path that records 5× less work takes longer end to
  end. Any instrumentation that times only `rasterizeText()` is measuring
  command submission, or at best a different mix of work.
- **No Safari here.** Everything about WebKit is from MDN/BCD, not from a
  device. iOS is the platform where the current design is most likely wrong
  (§3.4), so that is the largest unverified area.

**Short version.** The architecture is not the problem; three premises inside it
are. (a) There is a live parity bug: canvas cannot express
`font-variation-settings`, so the SPCG and ELSH sliders paint masks that do not
match the DOM — measured, not inferred. (b) The drag cost is real (28–58% of
wall time) but the instrumentation that attributes it is measuring the wrong
thing, so fix the instrument before the code. (c) The per-grain GPU cost only
appears above ~200k grains, where the simulation is already the constraint. The
two experiments worth running before anything else are "does the mask need to
move during a drag" (product) and "can the text just occlude the sand" (effect
design). Either could delete most of this document's subject matter.

---

## 1. If I were starting today

I would keep the shape — raster mask, per-grain repulsion, one document-space
atlas — and change four things. The measurements say the shape is not the
problem; three specific premises inside it are.

**1. Take advances from the DOM, not from canvas.** The mask currently asks
Canvas2D for both *where* the text is (per line, from `Range`) and *how wide*
each glyph is (implicitly, by `fillText`). The browser is only authoritative for
the first. Any typographic input that canvas cannot express — and
`font-variation-settings` is one — makes glyphs drift inside a line while the
line start stays correct. Measured: with `'SPCG' 150` the DOM lays a line out
518.4 CSS px wide; the mask paints 350.3 px of ink. That is a live parity bug
today, not a hypothetical one (§3.4).

The fix is small: `Range.getClientRects()` per character (the manager already
has that path) gives each glyph's x; canvas supplies only the glyph raster.
Advances then come from Blink/WebKit themselves, and every variable axis,
fallback font, kerning mode and letter-spacing value is correct by construction.

**2. Make the mask a push field, not a density plus gradient taps.** Right now
each grain in text does 1 fetch to decide, then 4 taps, then possibly 4 more at
a wider radius, then `normalize`, then a mat3. Baking direction × magnitude into
two channels at mask-update time removes the taps, the fallback branch and the
`normalize` from the per-grain path, and lets the field be stored at a lower
resolution than the density (direction is smooth; contours are not). This is
H4, and it is the only GPU change I would make before measuring, because it
removes a category of work rather than making it faster.

**3. Rasterise the mask off the main thread, and only when idle.** The drag cost
is main-thread canvas raster plus the upload that forces it (§4.1). Both can
move: `OffscreenCanvas` 2D exists in Chrome 69+ and Safari 16.4+, canvas text
works in a worker, and the finished atlas can come back as an `ImageBitmap`.
`Range` and `getComputedStyle` stay on the main thread — that part of the
current design is correct and should not move. What moves is the drawing.

**4. Treat "live during drag" as a product question, not a requirement.** The
mask is 28–58% of typography-drag wall time here (§4.1), so this one decision
is worth more than every optimisation in this document combined. H6 is the
cheapest experiment in the whole brief and should be run first.

What I would **not** change: the document-space atlas (it is what makes scroll
free, and scroll being free is the achievement worth protecting); `R8`; linear
filtering without mipmaps; the per-element bitmap cache (it looks redundant now
that scroll does not redraw, but the build that bypasses it records 5× less
work and is still 20–60% slower end to end — §4.1); and the existing WebGL2
pipeline.

What I would not build: an SDF/MSDF text path. It is the textbook answer for
resolution-independent glyphs, and it fails the actual constraint — matching
Blink's and WebKit's shaping, line-breaking and fallback — for a mask whose only
job is to push grains a few pixels (§3.2, §3.4).

---

## 2. Assumption audit

| # | Assumption | Verdict | Why |
|---|---|---|---|
| 1 | Mask must be a raster sampled per grain | **Questionable, keep for now** | At 50k and 200k grains the mask is free (median 16.6–16.7 ms with it on, flat, and off). At 500k it looks like ~5–8 ms of a 16.7 ms budget, but that is a single-shot, ordering-biased measurement (§4.2) — and the sim itself is already at 24.5 ms there. It is not the binding constraint at any shipping grain count. Alternatives are worth surveying (§3.3) but not urgent. |
| 2 | DOM layout is the source of truth for text position | **Valid premise, currently violated** | Position comes from `Range` per line; *advances* come from canvas. When they disagree (variable axes) the line starts correctly and drifts to the right. Measured 32% shortfall on `'SPCG' 150`. |
| 3 | Glyphs must match the DOM pixel-for-pixel, including blur | **Wrong as stated** | Already false (SPCG, ELSH, and `ctx.letterSpacing` on Safari < 18.4). Also not what the harness checks: it compares screen-space mask samples at ≤2% pixels differing by >8/255. Restate it as "contour agreement to ~1 CSS px plus matching edge softness, gated by the harness". Pixel parity is unachievable *and* unnecessary. |
| 4 | Mask must update while the user drags typography sliders | **Unverified product assumption, expensive** | 28–58% of drag wall time (§4.1). Never tested against a trailing-edge update. H6 first. |
| 5 | Recompute must happen on the main thread | **Half right** | `Range`/`getComputedStyle` are main-thread-only — keep them there. Rasterisation is not; `OffscreenCanvas` covers it on both target browsers. The current design conflates the two. |
| 6 | Effect belongs in the existing WebGL2 pipeline | **Valid** | Any separate layer would need grain positions to compute per-grain force; there is no cheaper place to put it. |
| 7 | Per-grain repulsion is the right interaction model | **Unverified, and the highest-leverage question** | Inherited, never tested. See §3.5 for what else the effect could be. |
| 8 | One document-wide atlas is fine; reduced scale on tall pages is acceptable | **Valid, with a visible cliff** | The atlas is 1024×4480 here (4.6 MP, 4.6 MB R8). On a long page `scale = min(1, cap/docHeight)` and glyph edges soften progressively. 87% of reported devices have `MAX_TEXTURE_SIZE ≥ 16383`, 98% on iOS (web3dsurvey). The cliff is real but far away at current document length. |

---

## 3. Survey

### 3.1 Stage A — representing text so a renderer can query it

| Approach | Idea | Cost | Cannot do | Maturity | Decisive experiment |
|---|---|---|---|---|---|
| **Canvas2D raster of DOM-measured lines** (current) | Browser measures lines, canvas paints | ~1.7 MB upload + 5–23 ms/rebuild recorded; real raster cost is deferred | Variable axes, non-Chrome canvas font features | Production, shipped | Already measured; see §4.1 |
| **Canvas2D raster + per-glyph DOM x** (proposed) | Same raster, advances from `Range` per character | +N `getClientRects` calls (already implemented as a fallback path) | Nothing new; cluster boundaries still approximate for ligatures | Production | Diff mask vs DOM screenshot with SPCG 150; expect ink width 518 px instead of 350 |
| **Own shaping + own raster** (HarfBuzz WASM, fontkit, opentype.js) | Compute advances and outlines yourself, rasterise or emit paths | 100–300 KB WASM, plus you now own line-breaking, bidi, fallback, font-feature defaults | Matching Blink/WebKit exactly — different shapers, different fallback chains, different rounding | Mature for shaping, fragile for *parity* | Run the §3.4 comparison on the site's 29 registered families × 4 axes; expect per-family divergence |
| **SDF/MSDF glyph atlas** (msdfgen, troika-three-text) | Store distance, threshold in shader | Cheap GPU, resolution-independent, sharp at any zoom | Same shaping problem, plus you must still produce advances; MSDF edge quality at 36 px with heavy blur is wasted | Very mature (Valve 2007; msdfgen) | Rasterise one paragraph both ways, diff; then diff *advances* — that is where it fails |
| **SVG `<foreignObject>` → `drawImage`** | Serialise the DOM subtree into an SVG, let the browser lay out and rasterise it, draw to canvas | Serialisation + full re-layout per rebuild; needs inlined CSS and font data URLs; tainting rules | Streaming/incremental use; anything with external refs; performance | Works in Chrome; fragile | Build a 20-element page as foreignObject, compare to the DOM screenshot pixel-wise |
| **Capture the compositor output** | Ask the browser for the already-rasterised text layer | No web API exists | — | — | — |

### 3.2 Stage B — getting it to the GPU

| Approach | Idea | Cost | Limits | Maturity | Experiment |
|---|---|---|---|---|---|
| **Canvas → `texImage2D`** (current) | Full re-upload on change | 1.7 MB/rebuild here; forces the deferred raster synchronously | Stalls the main thread at upload | Production | Time `texImage2D` with a fence (§4.1 step 1) |
| **Dirty-rect `texSubImage2D`** | Upload only changed bands | Bytes drop ~3–5×; bytes are probably not the cost (§4.1) | Complicated by `destination-out` ordering (the doc already flags this) | Production | Upload 1.7 MB vs 0.3 MB with `gl.finish()`; if wall time barely moves, stop |
| **PBO async upload** (`PIXEL_UNPACK_BUFFER`) | Upload from a buffer without blocking on the canvas | Removes the stall, keeps the raster | Still rasterises on the main thread | WebGL2 standard | Same fence test; expect the stall to move, not vanish |
| **`ImageBitmap` from `OffscreenCanvas`** | Raster in a worker, transfer a bitmap | Moves the expensive half off the main thread | Safari support for `ctx.filter` on OffscreenCanvas is unverified | Chrome 69+/Safari 16.4+ for the canvas itself | Run the drag in a worker build; measure main-thread LoAF duration |
| **Render glyphs on the GPU** (SDF quads) | No upload at all after atlas build | Cheapest steady state | Requires Stage A to be solved first | Mature | Only worth it after §3.4 passes |

### 3.3 Stage C — querying per grain

| Approach | Idea | Cost per grain | Limits | Experiment |
|---|---|---|---|---|
| **Density + gradient taps** (current) | 1 + 4–8 dependent fetches, `normalize`, mat3 | Highest | Tap radius in texels, so quality depends on atlas scale | Remove taps via a 1×1 zero mask (§4.2) — done, inconclusive |
| **Baked push field (RG8)** | 1 fetch, decode to direction×magnitude | ~⅓ of current | Field must be regenerated per mask update (cheap, viewport-sized) | Compare frame time at 500k with the two shaders |
| **Baked displacement field** | 1 fetch, add to position; no force integration | Same as above, no wake logic | Changes physics feel; grains stop "flowing" around text | Visual A/B at 4× slow-motion |
| **Coarse occupancy early-out** | 1 cheap fetch of a 1/16-res "is there text here" texture, then the real fetch only if set | ~1 fetch for most grains | Text covers a small fraction of the page, so most grains skip; but you still pay one fetch | Count how many grains are inside text per frame (instrument the shader) |
| **No per-grain query** | Text becomes an occluder in the plate pass; grains render behind it | Zero | Changes the effect's meaning (§3.5) | Screenshot A/B |

**Which stage is the bottleneck:** none of them, at shipping grain counts. At
500k the mask adds roughly 5–8 ms on top of a simulation that is already
vsync-bound at 60 fps; at 1M the simulation alone drops to ~25 fps (17–25 in
repeat runs) and no mask optimisation changes that. The GPU symptom is real but
not yet the constraint — optimise it only if 200k+ becomes a shipped default.

### 3.4 Stage D — the parity question (decisive)

Measured here, Chrome, macOS, `font-size: 36px`, comparing
`ctx.measureText().width` against a `display:inline-block; white-space:pre`
span's border-box width with identical CSS:

| Case | DOM (px) | Canvas (px) | Δ |
|---|---|---|---|
| Latin sentence, 49 chars | 827.281 | 827.280 | −0.001 |
| Mixed script + emoji + RTL fallback | 291.15 | 291.14 | −0.01 |
| Ligatures `ﬁ ﬀ ﬁ` | 81.38 | 81.37 | −0.01 |
| `font-kerning: none` | 196.05 | 196.05 | −0.01 |
| `letter-spacing: 1.5px` (with `ctx.letterSpacing`) | 194.31 | 194.94 | +0.63 |
| `word-spacing: 8px` (with `ctx.wordSpacing`) | 58.05 | 58.04 | −0.01 |
| **`font-variation-settings: 'wght' 700`** | 781.80 | 732.42 | **−49.38** |
| **`font-variation-settings: 'SPCG' 150`** | 1323.00 | 853.19 | **−469.81** |

So: **canvas advances match DOM advances essentially exactly, for every input
canvas can express.** The constraint is not shaping fidelity — Blink's canvas and
Blink's layout use the same shaping stack — it is *expressiveness*. Canvas2D has
no `font-variation-settings` property (`'fontVariationSettings' in ctx` is
`false`; MDN's `CanvasRenderingContext2D` property list has no such entry, and
BCD has no data for it). Variable axes other than what `font-weight`/
`font-stretch`/`font-style` map to cannot be requested.

Consequences:

- **`src/utils/TextMaskManager.ts:607` is a dead branch.** `if
  ('fontVariationSettings' in ctx)` is always false, so
  `applyCanvasTextSettings` silently drops every variation setting. That is why
  the `iA Quattro` SPCG slider and the `Geist Serif` ELSH slider produce masks
  that do not match the DOM.
- **The weight slider is fine; the axis sliders are not.** For every family the
  computed `font-weight` tracks the slider, so canvas gets the right weight even
  though `'wght'` in `font-variation-settings` is dropped. `SPCG` (iA Quattro
  spacing) and `ELSH` (Geist Serif contrast) have no `font-weight`/`stretch`/
  `style` equivalent, so they are lost entirely.
- **ELSH is the subtler of the two.** Its measured advances are identical to
  default (729.35 px both ways), which is what a contrast axis should do — so a
  width-based parity check passes while the mask strokes are drawn at the wrong
  contrast. Whether that is visible at mask resolution is unverified (§6.5).
- **Safari is weaker still.** BCD: `ctx.letterSpacing`/`wordSpacing` Safari
  18.4+, `fontKerning`/`fontStretch`/`fontVariantCaps`/`textRendering` unsupported.
  So on iOS the tracking slider's mask cannot be correct via canvas at all
  before 18.4, and letter-spacing is a shipped, always-visible control.

**Practical consequence:** "render the text ourselves" (HarfBuzz/fontkit/SDF) is
the wrong lever. The browser already gives you exact advances for free — but
only per *cluster/line*, through the DOM. Any approach that computes advances
independently has to reproduce shaping, line-breaking, and the fallback chain,
and will diverge on exactly the fonts and axes this site exposes. The
parity-safe move is to **keep canvas for the glyph raster and take positions
from the DOM at per-character granularity**.

Two harness gaps found while checking this:

- `scripts/text-mask-parity.mjs` has no variant that exercises
  `font-variation-settings` (no SPCG, no ELSH), which is precisely the axis that
  is broken.
- The harness's `tracking` variant uses `fontLetterSpacing: 2.5`, which *is*
  covered — but only on Chrome, where `ctx.letterSpacing` exists. It cannot
  catch the Safari hole.

### 3.5 Stage E — what "correct" means, and the interaction model

Four defensible definitions, in increasing distance from the current design:

1. **Pixel parity with the DOM** — what the brief states. Unachievable
   (variable axes, Safari canvas features) and unnecessary.
2. **Grain-behaviour parity** — the harness's actual check: same screen-space
   mask samples within tolerance. This is the right gate.
3. **Perceptual parity** — "the text reads clean and the sand respects it".
   Weaker than 2 but probably what a viewer experiences; allows lower mask
   resolution away from glyph edges.
4. **No parity** — the mask is an aesthetic choice, not a copy of the DOM.

Alternative interaction models worth putting on the table, because assumption 7
has never been tested:

- **Text as occluder.** Draw the text silhouette into the plate pass as a depth
  or alpha occluder; grains disappear behind it. Zero per-grain cost, no mask
  texture, no rebuild on typography change beyond a re-render of the text layer.
  What breaks: grains no longer *pile up* at the glyph edge, so you lose the
  soft "sand pushed aside" halo that currently sells the effect. This is the
  single biggest cost/quality trade available and nobody has looked at it.
- **Composite-only.** Render sand, then punch the text out with a soft alpha
  edge. Same visual at high grain density; obviously wrong where the plate is
  sparse (a hole with no displaced grains around it).
- **Displacement field instead of force.** Grains are teleported out of text
  rather than pushed, removing the wake/`pos.w` interaction. Cheaper and more
  stable, but changes the motion character.

Prior art worth reading, in order of relevance (I did not inspect these beyond
their docs; confidence marked in §5):

- **tsParticles canvas-mask / text-shape plugins** — particles avoid a canvas
  mask via `getImageData` on the CPU. Same idea, CPU-bound, small counts. The
  closest published analogue.
- **troika-three-text** — SDF text in three.js with its own layout (fontkit +
  bidi). The reference implementation for "render the text ourselves", and a
  good measure of what that costs.
- **msdfgen** and Valve's 2007 *Improved Alpha-Tested Magnification for Vector
  Textures* — the origin of the SDF approach.
- **Red Blob Games' distance-field articles** — the clearest practical write-ups
  of what SDF does and does not fix.
- Fluid-text demos (`didof.dev/type-matter-flow`, `originkit`'s fluid-text) —
  text as an obstacle in a flow field, which is the same problem one level up.
- Games solve "text occludes particles" with the depth/stencil buffer, not a
  mask texture — which is exactly option 1 above.

---

## 4. Attribution plans

### 4.1 Typography drags

**What is already known** (from perf doc): 9 rebuilds / 280 ms rasterise /
234 bitmap builds / 15.7 MB / 6.2 s wall for a weight drag. That is ~690 ms of
wall clock per rebuild slot, of which 31 ms is recorded as "rasterise" — 4.5%.
Either the mask is not the problem, or `rasterizeText()` is not measuring the
problem.

**Experiments run here:**

| Experiment | Result |
|---|---|
| 24-step weight drag, mask update on vs off (`manager.update = noop`) | on: 896 / 1379 ms wall, median frame 25.6 / 58.1 ms. off: 642 / 572 ms wall, median ~17 ms. **Mask = 28–58% of drag wall time**; without it the drag runs at a ~17 ms median frame, so what remains is browser reflow plus the simulation. |
| Per-rebuild cost, weight change | 26 bitmap builds every rebuild (the cache key includes the font, so every slider value misses); ~1.7 MB upload; recorded rasterise 12–23 ms. |
| Bitmap path vs direct `fillText` path (`getTextBitmap = () => null`) | recorded rasterise **4–5 ms vs 12–23 ms** (5× cheaper), but wall time **1244–1517 ms vs 956–983 ms** (worse). |

That last row is the important one, but read it carefully. The direct path
*records* 5× less work and still takes longer end to end. Two explanations fit
and this experiment cannot separate them:

- Canvas2D with `ctx.filter = blur()` on a 1024×4480 surface rasterises lazily,
  and `texImage2D` blocks until it is done — so `rasterizeMsTotal` is measuring
  command recording and the cost moved into the upload.
- The direct path simply does more total raster work (26 blurred passes across a
  4.6 MP surface instead of 26 into small cached bitmaps), and the recorded
  number is small only because it is a different kind of work.

Either way two conclusions hold: **`rasterizeMsTotal` cannot be read as
"rasterisation time"**, and **the per-element bitmap cache is a real
optimisation, not leftover scaffolding** — deleting it would make drags worse.
Which of the two it is determines whether the fix is "move the raster to a
worker" (§1.3) or "make the raster smaller"; the `gl.finish()` instrument in
step 1 below separates them.

**So, in order:**

1. **Fix the instrument first.** After `texture.needsUpdate = true`, force
   completion with `gl.finish()` (measurement only) or a 1-pixel `readPixels`,
   and split the number into `layout | canvas-record | canvas-raster |
   texImage2D | React re-render`. Without this, every future optimisation will
   be measured against a number that does not mean what it says.
2. **H6 (product): does the mask need to move during the drag?** If a
   trailing-edge update is acceptable, the entire drag-time cost disappears.
   Cheapest experiment in the brief; run it first.
3. **H2 (coalesce):** if it does need to move, ~10 Hz plus a trailing rebuild
   removes ~80% of rebuilds at no perceptible cost — the mask is a soft halo.
4. **Move the raster to an `OffscreenCanvas` worker** (§1.3) once 1–3 are done.
   That attacks the only component that survives them.
5. **Upload *bytes* are not the problem — the raster that the upload forces
   is.** 1.7 MB/rebuild, ~10–20 MB per drag. H1 as written ("dominated by
   full-atlas re-upload") is probably wrong, but be precise about why: moving
   fewer bytes with `texSubImage2D` would not help if the cost is the raster
   that `texImage2D` waits for rather than the transfer. Dirty-rect upload is
   also complicated by `destination-out` ordering — not worth it.

### 4.2 The per-grain mask sample

**Experiments run here** (headless Chromium, ANGLE Metal, M4, DPR 1, dev build):

| Grains | Mask on (median) | 1×1 zero mask | Mask off |
|---|---|---|---|
| 50k | 16.6 ms | 16.6 | 16.7 |
| 200k | 16.7 ms | 16.7 | 16.6 |
| 500k | 24.5 ms | 21.7 | 16.6 |
| 1M | 39 ms | 55 | 59 |

Read only the 500k row. 50k and 200k are vsync-bound, so they say "free", not
"zero cost". 1M is unusable: mask-off came out *slower* than mask-on, i.e. the
sim's own state drifted more than the effect being measured. Even at 500k the
run was single-shot and ordering-biased (later conditions looked slower).

Taken at face value, 500k says: mask ≈ 8 ms, of which the gradient taps are
≈ 3 ms and the transform + bounds test + base fetch ≈ 5 ms. That would
**contradict H3** — the taps are not the dominant term — but the data is not
good enough to assert it. Note also that a 1×1 mask makes the base fetch hit a
single cached texel, so it understates the real fetch's cost; the "5 ms" is a
lower bound on fetch+transform.

**The experiment that would settle it** (do this before changing any shader):

- `EXT_disjoint_timer_query_webgl2` around the compute pass only. Verified
  available in this Chromium (`true`); per BCD it is **not** in Safari or
  Firefox, so it is a Chrome-only instrument — fine for relative attribution,
  useless for iOS.
- Pool 3–5 queries, never call `gl.finish()`, only read
  `QUERY_RESULT_AVAILABLE` on a later frame. `gl.getQueryParameter` on an
  unavailable query stalls and will dominate the measurement.
- Run the same grain count five times interleaved (on / flat / off / off / on)
  and report medians; single-shot is what produced the 1M nonsense above.
- Add a variant with the tap block removed but the transform and fetch kept —
  that is the A/B that separates H3 from "it's the fetch".

**Likely fix if it matters:** bake the push field (§1.2). **Likely non-fix:**
reducing mask resolution. The taps are in texels (`1.8 / uTextMaskRes`), so
lowering resolution widens the gradient footprint in CSS px and visibly softens
the clearing radius — exactly the failure mode H4 predicts.

---

## 5. Sources

| Claim | Source | Date | Confidence | Applies to our stack |
|---|---|---|---|---|
| `measureText` returns advances from the same shaping stack as layout | MDN `measureText` + measured here (§3.4) | MDN page 2025-09-25; measurement today | High (direct measurement) | Yes |
| Canvas2D has no `font-variation-settings` property | MDN `CanvasRenderingContext2D` property list; MDN BCD raw JSON (no entry); `'fontVariationSettings' in ctx === false` | BCD main, read 2026-11-02 | High | Yes |
| `ctx.letterSpacing` / `wordSpacing`: Chrome 99, Safari 18.4, Firefox 115 | MDN BCD `api/CanvasRenderingContext2D.json` | 2026-11-02 | High | Yes — Safari < 18.4 is a live hole |
| `ctx.fontKerning` / `fontStretch` / `fontVariantCaps` / `textRendering`: Safari unsupported | same | 2026-11-02 | High | Yes |
| `EXT_disjoint_timer_query_webgl2`: Chrome 70, no Safari, no Firefox; Chrome Android false | MDN BCD `api/EXT_disjoint_timer_query_webgl2.json`; verified present in Chromium here | 2026-11-02 | High | Chrome yes, Safari no |
| Query results only become available at defined times; don't poll | Khronos `EXT_disjoint_timer_query_webgl2` spec, rev 4 | 2023-06-01 | High | Yes |
| LoAF: Chrome 123+, no Safari/Firefox; gives `renderStart`, `styleAndLayoutStart`, `blockingDuration`, per-script `forcedStyleAndLayoutDuration` | MDN BCD `api/PerformanceLongAnimationFrameTiming.json`; Chrome for Developers LoAF doc; worked in this Chromium | 2026-11-02 | High | Chrome only |
| `OffscreenCanvas`: Chrome 69, Safari 16.4, Firefox 105 | MDN BCD `api/OffscreenCanvas.json` | 2026-11-02 | High | Yes (2D `filter` in Safari unverified) |
| `content-visibility`: Chrome 85, Safari 18, Firefox 125 | MDN BCD `css/properties/content-visibility.json` | 2026-11-02 | High | Yes |
| `background-clip: text` widely available (Chrome 120 for the keyword per BCD, Safari 14) | MDN BCD `css/properties/background-clip.json` | 2026-11-02 | Medium (BCD's Chrome 120 looks like a data artefact — Chrome supported `-webkit-` prefix far earlier) | Only if pursuing §3.5 composite |
| `MAX_TEXTURE_SIZE`: 87% ≥ 16383, 85% ≥ 16384, iOS 98% ≥ 16384 | web3dsurvey.com/webgl/parameters/MAX_TEXTURE_SIZE | undated, read today | Medium (self-reported sample) | Yes |
| `performance.measureUserAgentSpecificMemory` requires cross-origin isolation; not in Safari | MDN | 2026-11-02 | High | Chrome only |
| `performance.memory` is non-standard and Chrome-only | MDN | 2026-11-02 | High | No (iOS) |
| Web Inspector memory timeline exists | WebKit blog "Memory Debugging with Web Inspector" | 2016-06-06 | Medium — **older than 18 months, treat as possibly stale** | Yes |
| SDF text from alpha-tested magnification | Green, SIGGRAPH 2007 (Valve) | 2007 | High (historical) | Background only |
| MSDF generation | `github.com/Chlumsky/msdfgen` | active | High | Only if pursuing SDF |
| Own layout + SDF text in three.js | `troika-three-text` (fontkit + bidi) | active | High | Reference for the rejected path |
| Particles avoid a canvas mask via `getImageData` | tsParticles canvas-mask plugin docs | undated | Medium (docs only, not benchmarked) | Prior art |
| Text as a flow-field obstacle | didof.dev/type-matter-flow, originkit fluid-text | undated | Low (not inspected) | Prior art |

---

## 6. Unknowns

Each phrased as the experiment that would settle it.

1. **Does the mask need to move during a drag?** A/B a trailing-edge build
   against live builds with 5 users scrubbing weight and tracking at 4×
   throttle; ask only "does the mask feel attached to the text?".
2. **What is the real per-rebuild cost?** Instrument with `gl.finish()` and a
   four-way split (layout / record / raster / upload) and re-run the weight
   drag. Everything in §4.1 is downstream of this number.
3. **Is the GPU cost the fetch or the taps?** Timer query around the compute
   pass, with a taps-removed variant, 5 interleaved repeats at 500k (§4.2).
4. **Does `OffscreenCanvas` 2D honour `ctx.filter = blur()` in Safari?** Open a
   worker that draws blurred text into an OffscreenCanvas, transfer the bitmap,
   compare against the main-thread result on an iPhone. Unverified everywhere
   above.
5. **Does per-character `Range` positioning actually fix SPCG/ELSH parity, and
   does ELSH need fixing at all?** Implement behind a flag, add `spcg-150` and
   `elsh-100` variants to the harness, and diff mask ink width against DOM line
   width (expected 518 vs 518 for SPCG). For ELSH, first render the mask at both
   axis extremes and diff them: if the difference is under one mask texel, the
   axis can be ignored.
6. **How expensive is `Range.getClientRects()` per character on a long page?**
   The manager already has this path (1623 `rangeBoundingRects` at startup on
   this page). Measure it with the atlas covering a 10,000 px document.
7. **At what document height does the atlas scale visibly degrade?** Render the
   same paragraph at 1× and at `scale = 0.5` and diff the mask against the DOM
   screenshot; find the threshold where the harness tolerance breaks.
8. **How should fixed/sticky text be handled?** Today it is detected and warned
   about. Experiment: a sticky header, scroll to 50%, diff mask vs DOM — the
   error should be exactly the scroll offset, confirming the document-space
   atlas cannot represent it.
9. **Do `content-visibility: auto` subtrees produce stale `Range` rects?**
   Put a `content-visibility: auto` section below the fold, scroll it into view,
   and check whether the mask has a hole where the text is.
10. **Does the effect survive being an occluder instead of a repulsor?**
    Prototype §3.5 option 1 in the plate pass and put the two side by side at
    50k and 5k grains. This is the only experiment that could make the entire
    mask pipeline unnecessary, and it costs a day.

---

## 7. If this became a plan

Ready-to-run prompts for each step are in
[`text-mask-prompts.md`](./text-mask-prompts.md).

Ordered by the decision framework, not by effort:

1. **Fix the instrument** (§4.1 step 1) — nothing else can be trusted until the
   number means what it says.
2. **H6** — decide whether drag-time updates are required. If not, stop
   optimising the drag entirely.
3. **Test the occluder variant** (§3.5) — one day of work, and it is the only
   change that could delete the whole mask pipeline rather than optimise it.
   If it holds up at 5k–50k grains, most of the rest of this document stops
   mattering.
4. **Fix the parity bug** (§1 item 1, §3.4) — a correctness bug today,
   independent of performance, and cheap. Add SPCG/ELSH variants to the harness
   in the same change.
5. **H2** — coalesce to ~10 Hz with a trailing rebuild, behind a flag, measured
   with the fixed instrument.
6. **Only then** touch the shader (H4 / push field), and only if 200k+ grains
   ships. At 50k the mask is free and at 1M the simulation is the constraint.

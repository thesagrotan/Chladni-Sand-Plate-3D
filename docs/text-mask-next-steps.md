# Text mask: further optimization — research prompt + plan

Status after the Phase 0–5 work (`docs/text-mask-perf.md`). Scroll is now free;
the remaining costs are elsewhere. This document has two parts:

1. a self-contained research prompt to run against a web-enabled agent, and
2. a prioritized plan built on the numbers we already have.

---

## Where we are (measured, M4 / headless Chromium / ANGLE Metal)

| Scenario | Cost |
|---|---|
| Scroll (any length, any DPR) | **0 rasterizations, 0 DOM reads, 0 uploads** |
| Startup | 2 rasterizations, 1 upload (1.88 MB desktop / 2.22 MB mobile) |
| Resize | 1 rasterization |
| DOM-repulsion slider drag | 0 rasterizations |
| **Font-weight slider drag** | 9 rasterizations, 280 ms rasterize, 234 bitmap builds, **15.7 MB** uploaded, 6.2 s wall |
| **Tracking slider drag** | 13 rasterizations, 146 ms rasterize, 338 bitmap builds, **25.2 MB** uploaded, 4.3 s wall |
| **GPU mask block @ 50k grains** | ~0 ms (vsync-bound, 16.7 ms p50 with mask on or off) |
| **GPU mask block @ 200k grains** | **+2.6 ms/frame** (avg 19.25 vs 16.67 ms; p95 33.4 vs 16.8 ms) |

So the two real targets are:

- **A. Typography drags** rebuild every element bitmap and re-upload the whole
  atlas, once per animation frame.
- **B. The per-grain mask block** costs ~2.6 ms/frame at 200k grains. It does a
  mat3 multiply, a viewport bounds test and one texture fetch for *every*
  grain, then 4–8 more fetches for grains inside text.

Everything else is already cheap or one-time.

---

## Part 1 — Research prompt

Paste the block below into a web-enabled agent. It is self-contained; if the
agent also has repo access, the file list at the end lets it verify details.

```text
ROLE
You are a graphics and browser-performance researcher. I need evidence-backed,
version-specific answers with sources — not general best-practice advice. Where
the answer is "it depends", say what it depends on and give the measurement that
would settle it.

CONTEXT
A production WebGL2 + Three.js site (r186, TypeScript, Vite) renders a Chladni
sand-plate simulation. A DOM text layer is rasterized with Canvas2D into a mask
texture; a GPU position shader samples that mask per grain to push sand out of
the glyph shapes ("text repulsion"). Text is therefore laid out twice: once by
the browser (real DOM, CSS variables for font/variable axes/letter-spacing) and
once by canvas fillText, and the two must stay visually identical.

What I have already done (do not re-propose these):
- Cached per-element line layout in document coordinates; scroll no longer
  re-measures the DOM. Binary-search line boundaries from Range.getClientRects,
  exact per-character scan kept for bidi/zero-width/pre-formatted text.
- Per-element offscreen bitmaps: the two blurred passes (halo blur 3-8px @ 0.65
  alpha, core blur 1-2.5px @ 1.0) are rendered once into an offscreen canvas and
  composited with drawImage. LRU capped at 64 entries / 8M pixels.
- Document-space mask atlas (width = viewportWidth * scale, height =
  documentHeight * scale, capped to MAX_TEXTURE_SIZE by reducing scale). Shader
  applies scroll via a precomputed mat3, so scrolling does zero work.
- Mask texture is RedFormat/UnsignedByteType (R8), LinearFilter, no mipmaps,
  NoColorSpace, flipY = true.
- Shader mask block: mat3 world->maskUV, viewport-rect bounds test, one density
  fetch, then 1.8-texel and (on retry) 6-texel central-difference gradient taps,
  then a push mat3.

Measured remaining costs (M4, headless Chromium, ANGLE Metal, 1440x900):
- Font-weight slider drag: 9 mask rebuilds, 280 ms total rasterize, 234 element
  bitmap builds, 15.7 MB of full-atlas texture uploads, over a 6.2 s drag.
- Tracking slider drag: 13 rebuilds, 146 ms, 338 bitmap builds, 25.2 MB.
- GPU mask block: ~0 ms/frame at 50k grains (vsync-bound), +2.6 ms/frame at
  200k grains (512x512 position texture, 262144 fragments).
- Startup: 2 rasterizations, 1 upload of 1.88 MB (atlas 1024x1833).

QUESTIONS

1. MSDF / SDF text as a replacement for the canvas mask
   a. What are the current, maintained options for generating a multi-channel
      signed distance field atlas in the browser at runtime from an arbitrary
      font file? Cover msdfgen (native/WASM builds), msdf-bmfont-xml,
      three-msdf-text-utils, troika-three-text, and anything newer. For each:
      license, last release date, bundle size, whether it runs in a Worker, and
      whether it supports variable fonts (wght/SPCG/ELSH axes) and per-glyph
      letter-spacing.
   b. What is the realistic cost of building an MSDF atlas at runtime for
      ~40 KB of text at 1024 px, on desktop and on an iPhone? Cite benchmarks.
   c. The critical question: if I lay out glyphs with canvas measureText (or with
      opentype.js/fontkit metrics), will the resulting advances match the
      browser's own CSS layout for the same computed font-family/weight/style/
      size/letter-spacing/font-variation-settings? Find concrete evidence
      (spec text, browser bug reports, tests) about whether canvas measureText
      and DOM text layout agree on advances, kerning and shaping. This decides
      whether an SDF path can preserve pixel parity or whether it will drift.
   d. Does any approach let me keep the browser's own line breaking and glyph
      positions while rendering glyphs as SDFs (e.g. reading per-character x
      offsets from Range rects and matching them to glyph ids)?

2. Canvas2D rasterization cost and off-main-thread options
   a. Current hardware-acceleration status of Canvas2D `ctx.filter = blur(Npx)`
      in Chrome, Safari/iOS and Firefox. Is filtered fillText GPU-accelerated,
      or does it fall back to CPU? Any known cliff (radius, canvas size, DPR)?
   b. Is OffscreenCanvas + transferControlToOffscreen viable for this workload
      in Safari 17/18 and Chrome? Any restrictions on fonts inside a worker
      (FontFace loading in workers, document.fonts availability)?
   c. Is caching the blurred result as an ImageBitmap (createImageBitmap with
      premultiplyAlpha/colorSpace options) measurably faster to draw than a
      canvas element as a drawImage source?
   d. Support matrix for CanvasRenderingContext2D letterSpacing and
      fontVariationSettings (Chrome/Safari/Firefox, versions and dates). Any
      known rendering differences vs CSS for the same values?

3. Partial texture updates
   a. What is the correct, portable way to update only a dirty rectangle of a
      canvas-backed texture in three.js r186? Does CanvasTexture support it, or
      must I call gl.texSubImage2D directly on the renderer's texture handle?
      Any pitfalls with three.js's internal texture state, flipY, or
      UNPACK_FLIP_Y_WEBGL?
   b. Can a sub-rectangle of a canvas be uploaded without a copy — using
      UNPACK_ROW_LENGTH / UNPACK_SKIP_PIXELS / UNPACK_SKIP_ROWS, or
      createImageBitmap(canvas, sx, sy, sw, sh) as the source?
   c. Measured cost of many small texSubImage2D calls vs one full
      texImage2D on desktop and mobile GPUs. Is there a threshold where batching
      into a full upload wins?
   d. Does WebGPU's copyExternalImageToTexture support dirty rects from a
      canvas, and is it materially faster than WebGL2 for this?

4. GPU mask-sampling cost
   a. Best practice for timing a single pass in three.js GPUComputationRenderer
      with EXT_disjoint_timer_query_webgl2: how to avoid the async-query stall,
      what a reliable measurement loop looks like, and what Chrome does with
      timer queries when the GPU is vsync-throttled.
   b. I am considering precomputing a screen-space "push direction" texture in a
      separate GPU pass on each mask update, so the particle shader does one
      fetch instead of a bounds test plus 1-9 fetches. What packing and
      resolution would you recommend (RG8 at mask scale vs RGBA8 at half
      resolution), and what artifacts should I expect from a lower-resolution
      force field (direction quantization, seams at glyph edges)?
   c. Is a coarse bounding-box gate (a uniform vec4 covering all on-screen text,
      tested before any fetch) worth it, or does the texture cache make the
      unconditional fetch free? Any published measurements?
   d. What is the cheapest way to preserve an exact "retry with a wider gradient
      tap when the narrow gradient is nearly flat" behaviour while reducing the
      common path to one fetch?

5. Measurement and attribution
   a. Current best practice for attributing main-thread time to script vs style
      vs layout vs paint in Chrome: LoAF (long-animation-frame), Event Timing,
      the `scheduler.postTask` priorities. What does LoAF actually give me that
      a PerformanceObserver longtask does not?
   b. How do I measure the memory of a 473x4689 canvas plus its texture on iOS
      Safari without crashing the tab? What are the real canvas/texture memory
      limits on recent iPhones and iPads?

6. Long-page scaling
   a. At what document height does a single document-space mask atlas stop being
      reasonable? Compare (i) reducing the uniform scale, (ii) tiling into
      1024x1024 tiles with only visible tiles uploaded, (iii) a viewport window
      plus a margin that re-renders on scroll (which reintroduces scroll work).
   b. Does `content-visibility: auto` interact badly with getBoundingClientRect
      or Range measurements for off-screen text?

CONSTRAINTS
- The app targets modern evergreen desktop plus iOS Safari; 60 fps desktop,
  30 fps mobile, with a no-WebGL fallback.
- Visual output must not change: same glyph contours, line breaks, spacing,
  alignment, blur radii, opacities and draw order.
- Prefer approaches that keep the browser as the source of truth for text layout.
- Proposals may include libraries, but state license, bundle size, maintenance
  status, and whether the code can be vendored.

OUTPUT FORMAT
1. A findings table: question id | answer in 1-3 sentences | source URL |
   publication or version date | confidence (high/medium/low) | does it apply to
   our stack (yes/no/unclear).
2. A "recommended prototype order" section: what to build first, what it should
   measurably improve, and what result would make you abandon it.
3. A "not viable / not worth it" list with the reason for each.
4. A list of anything you could not verify, phrased as the specific experiment
   that would settle it.

SOURCE STANDARDS
Prefer primary sources: WHATWG/W3C specs, MDN, chromestatus.com, Chrome and
WebKit release notes, browser bug trackers, the library's own repo and release
notes. For performance claims, prefer a benchmark with hardware and versions
stated. Flag any claim older than ~18 months as potentially stale.

RELEVANT FILES (if you have repo access)
src/utils/TextMaskManager.ts, src/utils/TextMaskLayoutCache.ts,
src/simulation/ChladniGpuSimulation.ts, src/simulation/textMaskTransform.ts,
src/simulation/renderChladniFrame.ts, scripts/text-mask-parity.mjs,
tests/parity/maskPushParity.test.ts, docs/text-mask-perf.md
```

---

## Part 2 — Plan

Ordered by expected return. Each phase is independently shippable and keeps
`bun run lint`, `bun run test`, `bun run build` green, with the parity harness
(`bun run parity:text-mask`) as the gate.

### P0 — Measure before optimizing (½ day)

Everything below is a guess until these exist.

1. **GPU timer queries.** Add a dev-only `EXT_disjoint_timer_query_webgl2` probe
   around the position pass so the harness can report mask-on vs mask-off GPU
   time instead of inferring it from rAF deltas. Report p50/p95 per grain-count
   bucket (50k / 200k / 500k / 1M).
2. **Typography-drag scenario** in `scripts/text-mask-parity.mjs`: drag Weight
   and Tracking at 1× and 4× CPU throttle, record rasterizations, layout ms,
   draw ms, bitmap builds, upload bytes, long tasks. Baselines above are from a
   throwaway script; make it permanent.
3. **Fix the counter gap**: `fillTextCalls` currently misses the offscreen
   bitmap build path, so it reads 0 while 234 bitmaps are built. Count them.
4. **Add `bitmapBuildMs`** so P1/P2 can attribute draw time correctly.

Acceptance: `bun run perf:text-mask` prints GPU ms and typography-drag rows.

### P1 — Incremental atlas updates (1–2 days)

**Hypothesis:** a typography drag uploads 15.7 MB because every rebuild clears
and re-uploads the whole 1024×1833 atlas. Only the elements whose key changed
need redrawing.

**Change:**
- Track a dirty-rect union per rebuild (union of the changed elements' bitmap
  bounds, expanded by ≥ 3× the largest blur radius so halo bleed is included).
- Clear only the dirty rect, redraw only the changed elements, and upload only
  that rect with `gl.texSubImage2D` (pad the rect to the 4-pixel alignment
  `UNPACK_ROW_LENGTH` needs).
- Elements that did not change keep their pixels; the bitmap cache already
  tells us which those are (`bitmapCacheHits`).

**Expected:** drag upload 15.7 MB → under 1 MB; draw time down by the share of
unchanged elements.

**Risk:** seams or double-composited halos at dirty-rect edges. Mitigate with
the blur-radius padding and by verifying the full-atlas pixel diff, not just
the screen-space sample.

**Interaction with `hole` repulsors:** `hole` entries paint with
`destination-out`, so they erase whatever was drawn before them (typically a
`pill` silhouette). A dirty-rect redraw therefore cannot repaint a hole in
isolation — it must repaint every earlier element that intersects the rect, in
order. Simplest correct rule: if the dirty set contains a `hole`, or if any
changed element is *before* a hole that overlaps it, widen the redraw to a full
pass for that update. Keep the incremental path for the common case
(typography change on plain text).

**Acceptance:** byte-identical atlas after an incremental update vs a full
rebuild; parity 0.000% at scroll 0; upload bytes per typography drag reported;
a test that a changed `hole` still erases correctly after an incremental
update.

### P2 — Coalesce typography invalidation (½ day)

**Hypothesis:** during a slider drag the mask rebuilds once per animation frame
(9–13 rebuilds per drag), but the text itself is also reflowing at that rate, so
the mask only needs to keep up closely, not exactly.

**Change:** rate-limit `invalidateLayout()`-driven rebuilds to ~10 Hz while a
pointer is down, and always do a final rebuild on `pointerup`/`change`. Reuse the
existing coalescing rAF so nothing is lost.

**Expected:** rebuild count per drag 9–13 → 2–4; rasterize time 280 ms → ~90 ms;
upload volume falls with it.

**Risk:** a visible mismatch between the DOM text and the mask for up to 100 ms
mid-drag. Confirm with a side-by-side screenshot at 4× throttle before shipping.

**Acceptance:** drag scenario shows ≤4 rebuilds and a final mask identical to the
settled state.

### P3 — Screen-space push-direction precompute (2–4 days)

**Hypothesis:** at 200k grains the mask block costs 2.6 ms/frame because every
grain pays the mat3 + bounds test + one fetch, and grains inside text pay 4–8
more.

**Change:**
- On each mask update, run one GPU pass that converts the density atlas into a
  screen-space force texture: direction + magnitude per texel, including the
  wide-tap retry and the flat-gradient sentinel. Resolution can start at mask
  scale and be halved if quality allows.
- Particle shader: mat3 world→screen UV, one fetch of the force texture, apply
  the push mat3. The random fallback stays in the shader (it depends on
  `pos.xy` and time).
- Optional bbox gate: a uniform vec4 covering all on-screen text, tested before
  the fetch.

**Expected:** mask block 2.6 ms → under 1 ms at 200k grains; no change at 50k
(already vsync-bound).

**Risk:** direction quantization at low force-field resolution softens the push
near glyph edges. The rendered parity test (`tests/parity/maskPushParity.test.ts`)
extends to cover it: same particle grid, force-texture path vs legacy formula,
max delta threshold.

**Acceptance:** parity within 2e-4 world units; GPU timer shows the expected
drop; no visible change in grain clearing around glyphs.

### P4 — MSDF/SDF text, only if the research supports it (1–2 weeks)

**Gate:** only start if the research finds evidence that canvas/opentype
advances match DOM layout for the same computed style, *and* a runtime MSDF
path that runs in a worker.

**Why:** it removes the canvas, the per-element bitmaps and the atlas entirely,
is resolution-independent (crisp at any DPR and zoom), and makes typography
changes cost only an atlas rebuild for the changed glyphs.

**Risk:** the highest in this plan. Text parity is the product; if glyph
positions drift even slightly the mask stops matching the DOM text. Keep the
canvas path behind a flag until the parity matrix passes, then delete it.

### P5 — Worker rasterization (2–3 days, only if needed)

`Range`/`getComputedStyle` must stay on the main thread, but the *drawing*
(blurred fillText into offscreen bitmaps) can move to an `OffscreenCanvas` in a
worker. After P1/P2 the main-thread cost may already be small enough that this
is unnecessary — measure first.

### P6 — Long-page guard rails (1 day)

The atlas is capped by `MAX_TEXTURE_SIZE` and reduces the uniform scale when a
page is taller than the cap (~16 800 CSS px on a 390×844 mobile viewport,
~23 000 px on 1440×900). Beyond that, text softens. Add:
- a documented threshold and a dev warning,
- a tiling plan (1024×1024 tiles, upload only visible tiles) if the site ever
  grows past it.

### P7 — WebGPU (future, out of scope)

Compute shaders would remove the readback-free ping-pong and give real GPU
timers, and `copyExternalImageToTexture` handles canvas sources cleanly. This is
a rewrite of the simulation layer, not a mask optimization; revisit only if the
GPU engine becomes the bottleneck at high grain counts.

---

## Open questions to settle before committing to P3/P4

1. Does the 2.6 ms at 200k grains come from the fetches or from the mat3 +
   bounds test? (P0 timer queries plus an A/B shader with the fetch removed.)
2. What fraction of grains are inside text at a typical scroll position? If it
   is small, the retry taps are not the cost and P3 should focus on the
   unconditional path.
3. Is the 100 ms mask lag from P2 actually visible during a font-weight drag?
4. Do canvas `measureText` advances and DOM layout agree closely enough that an
   SDF path can preserve parity? (Research question 1c.)

## Do not do

- Re-rasterize on scroll in any form.
- Move `Range`/`getComputedStyle` measurement into a worker.
- Change the Chladni wave or grain physics to make the mask cheaper.
- Trade glyph-contour fidelity for speed without a parity run.

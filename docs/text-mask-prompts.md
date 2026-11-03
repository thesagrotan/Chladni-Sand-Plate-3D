# Text mask — execution prompts

Seven prompts, one per step, in the order they should run. Each is self-contained:
paste it into a fresh agent session with repo access.

Read alongside:

- [`text-mask-research.md`](./text-mask-research.md) — why these steps, and what
  was measured.
- [`text-mask-next-steps.md`](./text-mask-next-steps.md) — the original brief and
  its assumptions.
- [`text-mask-perf.md`](./text-mask-perf.md) — method and prior numbers.

## Sequencing

```
Prompt 1 (harness gate)  →  Prompt 2 (parity fix)
Prompt 4 (occluder A/B)  ─┐  can run in parallel with 1–2: touches CSS + a
                           │  throwaway shader flag, not the manager
Prompt 3 (H6 trailing)   ─┘  runs after 2: both edit TextMaskManager.ts
Prompt 5 (instrument)    →  Prompt 6 (coalesce)  →  Prompt 7 (push field)
```

Prompts 3 and 6 are decision experiments: each can end the work rather than
continue it. Treat "the answer is no" as a valid, valuable outcome.

## Rules that apply to every prompt

- Do not reintroduce per-scroll work.
- Do not move `Range` / `getComputedStyle` into a worker.
- Do not change the Chladni wave math or grain physics.
- Do not trade glyph-contour fidelity for speed without a parity run.
- Anything that risks parity ships behind a flag, gated by
  `bun run parity:text-mask`.
- `rasterizeMsTotal` is **not** rasterisation time (see research §4.1). Do not
  cite it as such.
- State hardware, browser, and versions with any timing claim. Mark anything you
  did not measure as unverified.
- If an experiment contradicts the plan, say so and stop. Do not work around a
  failed premise.

---

## Prompt 1 — Add the failing parity gate

```text
ROLE
You are adding test coverage that is expected to fail. Do not fix the bug in
this task.

CONTEXT
Read docs/text-mask-research.md §3.4 first, then scripts/text-mask-parity.mjs.

The text mask is built by painting DOM text with Canvas2D into a document-space
atlas. Canvas2D has no `font-variation-settings` property, so
src/utils/TextMaskManager.ts silently drops it (see applyCanvasTextSettings,
around line 607 — `if ('fontVariationSettings' in ctx)` is always false).

The site exposes two variable axes through font-variation-settings:
- 'SPCG' 0–150 on iA Writer Quattro V (spacing). Changes advances.
- 'ELSH' 0–100 on Geist Serif VF (contrast). Changes stroke weight, not advances.

Neither is covered by the parity harness, which is why the bug shipped.

Measured baseline (Chrome, macOS, 36px): with 'SPCG' 150 the DOM lays a line out
518.4 CSS px wide and the mask paints 350.3 px of ink. That is a ~32% shortfall.

TASK
1. Add two variants to the VARIANTS array in scripts/text-mask-parity.mjs:
   - id: 'spcg-150' — fontFamily 'iAWriterQuattroV', fontSpacingAxis 150
   - id: 'elsh-100' — fontFamily 'Geist Serif', fontElshAxis 100
   Use the existing variant shape and settings keys. Check
   src/types/chladni.ts (buildFontVariationSettings, FONTS) and
   src/utils/storage.ts (sanitizeParams) for the exact parameter names and the
   family ids the app accepts.
2. Ensure the font is loaded before sampling, the way the harness already does
   for other variants.
3. Run `bun run perf:text-mask` (perf counters only, does not compare) and then
   `bun run parity:text-mask`.
4. Record the actual failure output for both new variants.

CONSTRAINTS
- Do NOT change src/utils/TextMaskManager.ts or any src file.
- Do NOT run `bun run parity:text-mask --update`. Overwriting the baseline would
  erase the evidence.
- If a variant passes, that is a finding: report it rather than loosening
  tolerance to make it pass. It would mean the failure is viewport- or
  DPR-dependent, which is worth knowing.

ACCEPTANCE
- `bun run parity:text-mask` fails on 'spcg-150' with a diff clearly larger than
  the tolerance (DIFF_CHANNEL_THRESHOLD 8, MAX_DIFF_FRACTION 0.02,
  MAX_MEAN_DIFF 1.5), and the failure message names the variant.
- 'elsh-100' may pass — advances are identical for a contrast axis. If it
  passes, additionally report whether the mask is visually different between
  ELSH 0 and ELSH 100 by sampling both and diffing them directly.

REPORT
- The exact command output for both variants (pass/fail, diff fraction, mean).
- Whether elsh-100 masks differ from each other at all, and by how much.
- The file you changed and nothing else.
```

---

## Prompt 2 — Fix the parity bug

```text
ROLE
You are fixing a correctness bug in a text-mask rasteriser. The performance
work comes later; do not optimise anything here.

CONTEXT
Read docs/text-mask-research.md §1 and §3.4, and
docs/text-mask-prompts.md Prompt 1 (its result is your gate).

The bug: the mask paints text with Canvas2D, which cannot express
font-variation-settings. Positions (per line) come from DOM Range; advances come
implicitly from canvas fillText. When the two disagree, each line starts at the
right x and drifts rightwards across the line.

Measured: 'SPCG' 150 → DOM line 518.4 CSS px, mask ink 350.3 px.
Weight is fine (computed font-weight tracks the slider). ELSH is a contrast
axis: advances match, stroke shapes do not.

Relevant code:
- src/utils/TextMaskManager.ts — buildTextBitmap(), drawEntry(), drawLayout(),
  applyCanvasTextSettings(), PER_CHARACTER_FALLBACK_RE.
- src/utils/TextMaskLayoutCache.ts — TextMaskLayoutEntry, TextMaskLineLayout,
  fontKeyFromStyle.
- There is already a per-character fallback path (rangeBoundingRects counter)
  used for RTL / explicit line breaks / zero-width characters. Read it before
  designing anything new.

TASK
Fix advance mismatch for axes canvas cannot express, behind a flag.

Preferred approach (a): keep drawing the whole line in one fillText so shaping,
kerning and ligatures are preserved, but horizontally scale that line's raster
so its ink width matches the DOM advance width for the same line.
- Get the DOM advance width from the same Range measurement the manager already
  performs.
- Apply the correction per line, not per element.
- Guard against divide-by-zero and against wildly wrong ratios (clamp, and log
  when clamping fires).

Fallback approach (b), only if (a) cannot be made to work: per-character
fillText at DOM-measured x positions. Note in your report that this loses
kerning pairs and ligatures inside the raster — that is why (a) is preferred.

For ELSH specifically: canvas cannot apply a contrast axis at all. Do not
attempt to synthesise it. Measure the mask difference between ELSH 0 and 100
(if Prompt 1 did not already) and report whether it exceeds one mask texel. If
it does, document it as a known limitation with the measurement; do not guess at
a fix.

CONSTRAINTS
- Behind a flag (env var, query param, or a manager option — match how the repo
  already gates dev-only behaviour; textMaskDebug.ts uses import.meta.env.DEV).
- No change to the shader, the simulation, or the upload path.
- No change to how positions are measured for lines that already match.
- Do not remove the existing per-character fallback path.

ACCEPTANCE
- `bun run parity:text-mask` passes for 'spcg-150', with mask ink width within
  ~1 CSS px of the DOM line width (expect 518 px vs 518 px, not 350 px).
- All previously passing variants still pass, including at 390x844@3 (mobile
  DPR 3) and at scroll 0.5 and 1.
- `bun run lint` and `bun run test` clean.
- `bun run perf:text-mask` shows no meaningful regression in rebuild cost. If it
  does, report the number; do not silently accept a large one.

REPORT
- Which approach you implemented and why.
- Before/after diff output for spcg-150 and elsh-100.
- Whether the flag defaults on or off, and what would justify flipping it.
- Any variant that regressed, with numbers.
```

---

## Prompt 3 — H6: does the mask need to move during a drag?

```text
ROLE
You are running a product experiment, not building a feature. The output is a
decision, not a shippable optimisation.

CONTEXT
Read docs/text-mask-research.md §1 item 4 and §4.1, and
docs/text-mask-next-steps.md hypothesis H6.

Measured: during a 24-step font-weight drag the mask is responsible for 28–58%
of wall time (896/1379 ms with the mask vs 642/572 ms without; median frame
25.6/58.1 ms vs ~17 ms). The mask is a soft halo — it may not need to track the
text at frame rate.

TASK
Implement a trailing-edge mode for mask rebuilds and evaluate whether it is
perceptually acceptable.

1. Add a debounce: mask layout invalidations set a timestamp; the per-frame
   update() rebuilds only once no invalidation has arrived for ~120 ms, plus one
   final rebuild. The manager already has `dirty`, `dirtyRafId` and
   `update(now)` — read them first and reuse the existing scheduling rather than
   adding a second timer.
2. Behind a flag, so live and trailing modes can be compared in one build.
3. Measure, in the same session, on the same page:
   - rebuild count and wall time for a scripted 24-step weight drag, live vs
     trailing;
   - main-thread long-animation-frame durations if available (Chrome only);
   - median and p95 frame intervals.
   Report medians over at least 3 interleaved runs (live, trailing, live,
   trailing, ...). Single-shot rAF numbers in this repo drift by up to 2× as
   grains settle — see research §4.2 for how that produced a nonsense result.
4. Capture evidence of visual lag: a scripted drag with screenshots at fixed
   intervals in both modes, so the two can be compared side by side. Save to a
   temp directory; do not commit images.

CONSTRAINTS
- Do not change the shader, the simulation, or the parity path.
- Do not change how often the DOM reflows; this experiment is only about the
  mask.
- The flag must be off by default when you finish.

ACCEPTANCE
- A table of live vs trailing numbers, interleaved, with the variance shown.
- Screenshots or a short recording demonstrating whether the mask visibly trails.
- A one-line recommendation: trailing is acceptable / not acceptable / needs a
  middle setting (e.g. 10 Hz).

REPORT
- The numbers, including the ones that disagree with each other.
- Your judgement on visual lag, and what you looked at to reach it.
- Explicitly: does this experiment make Prompts 5 and 6 unnecessary? If yes, say
  so plainly.
```

---

## Prompt 4 — Occluder A/B: is the repulsion doing any work?

```text
ROLE
You are testing whether a whole subsystem is necessary. Prototype only; nothing
you build ships in this task.

CONTEXT
Read docs/text-mask-research.md §3.5 and §1, then
docs/text-mask-next-steps.md assumption 7.

The effect: sand is pushed out of DOM text so the letters read as clean negative
space with a soft halo of piled grains at the edges. Per-grain repulsion is
inherited from the original implementation and has never been compared against
anything.

There is preliminary evidence this is the highest-leverage question in the
project. Screenshots already captured show:
- mask on: sand cleared from glyphs, dark halo around letterforms;
- mask off, no compensation: grains visibly fill counters and inter-letter gaps,
  reducing legibility over dense nodal lines;
- mask off + `[data-text-repulsor]{text-shadow:0 0 14px 6px #070709}`: visually
  close to mask on at the default grain count.

TASK
Turn that into a controlled comparison and a decision.

1. Build a throwaway dev-only toggle with three modes:
   a. current (mask on, repulsion active);
   b. mask off, no compensation;
   c. mask off + a CSS text-shadow halo tuned to match the current soft edge.
      Start from the 14px/6px above and tune against (a).
2. Capture each mode at:
   - 5k, 50k, 200k grains;
   - a dense nodal region and an empty region of the plate;
   - 1440x900@1 and 390x844@3.
   Save a labelled contact sheet. Do not commit images.
3. Note the specific failure modes of (b) and (c): where does text stop reading
   cleanly? Counters, thin strokes, italic, small sizes, mobile DPR 3?
4. Note what (c) cannot reproduce even when it looks close: is there motion that
   is lost (grains waking and flowing away, the pile-up appearing over time)?

CONSTRAINTS
- Dev-only toggle. No production code path changes.
- Do not delete the mask pipeline. Do not change the shader's physics.
- If (c) requires a halo that visibly differs from the current edge softness,
  that is a parity failure and should be reported as such, not tuned away.

ACCEPTANCE
- A contact sheet with modes as rows and scenarios as columns.
- A written verdict: is per-grain repulsion load-bearing, or is it a halo the
  DOM could draw for free?
- If it is load-bearing, name the smallest version that still works (e.g. push
  only within 2 px of a glyph edge).

REPORT
- The verdict, with the specific scenarios where each mode failed.
- The CSS you settled on for (c), and how far it is from the current edge.
- Whether you would recommend deleting the mask pipeline. Say yes or no.
```

---

## Prompt 5 — Fix the mask instrumentation

```text
ROLE
You are fixing a measurement, not a performance problem. Nothing you ship in
this task should make the product faster; it should make the numbers true.

CONTEXT
Read docs/text-mask-research.md §4.1 and src/utils/textMaskDebug.ts.

The current counters are misleading. Evidence: a build that bypasses the
per-element bitmap cache records 5× less `rasterizeMsTotal` (4–5 ms vs 12–23 ms
per rebuild) and is 20–60% slower end to end (1244–1517 ms vs 956–983 ms wall
for the same drag). Two explanations fit and nobody has separated them:
- Canvas2D records draw commands lazily and executes them during texImage2D, so
  the counter is timing command submission and the cost moved into the upload;
- or the direct path does more total raster work and the counter is measuring a
  different mix of work.

Every optimisation decision currently rests on this number, so it has to be
split.

TASK
Split one rebuild into four measured phases and report them separately:

1. layout — rebuildLayout() (Range reads, getComputedStyle).
2. record — the canvas draw calls in rasterizeText()/drawLayout(), as today.
3. raster — force the canvas to actually rasterise, and time that.
4. upload — force the GPU upload, and time that.

How to force completion:
- For the upload, `renderer.initTexture(texture)` in three.js performs it
  immediately; then `gl.finish()` (or a 1-pixel `readPixels`) to wait.
- For the canvas, a 1×1 `getImageData` from the mask canvas forces pending draw
  work without a full readback.
- Guard all of this behind the existing dev-only gate (`TEXT_MASK_DEBUG_ENABLED`)
  so it is tree-shaken from production. `gl.finish()` must never run in
  production.

Also add:
- a React re-render marker, or use LoAF (`PerformanceObserver` type
  'long-animation-frame', Chrome 123+) to attribute style/layout/script time
  around the rebuild. The existing longtask observer is too coarse; LoAF gives
  renderStart, styleAndLayoutStart and blockingDuration.
- a counter for "rebuilds that produced an identical texture" so redundant work
  is visible.

Then re-run the weight and tracking drags and report the four phases as a share
of wall time.

CONSTRAINTS
- Dev-only. No production behaviour change.
- Do not change the mask algorithm, the cache policy, or the shader.
- Do not call `gl.finish()` or `readPixels` outside the debug path — they stall
  the pipeline and will dominate any measurement taken with them on. Make the
  cost of the instrument visible: report drag numbers with the instrument on and
  off, so its overhead is known.

ACCEPTANCE
- A four-phase breakdown for a 24-step weight drag and a 24-step tracking drag,
  with the instrument's own overhead stated separately.
- The two competing explanations for the earlier result resolved: say which one
  it was.
- `bun run perf:text-mask` still runs, with the new counters in its output.
- `bun run lint` and `bun run test` clean.

REPORT
- The four-phase table.
- Which explanation was correct.
- The instrument's overhead.
- What the numbers now imply for H1 (uploads), H2 (coalescing), and whether the
  bitmap cache should stay.
```

---

## Prompt 6 — Coalesce rebuilds during a drag

```text
ROLE
You are reducing the number of mask rebuilds during typography drags. This is
conditional: only do it if Prompt 3 concluded the mask must move during a drag.

CONTEXT
Read docs/text-mask-research.md §4.1, and the results of Prompts 3 and 5.

Measured today: 9–13 rebuilds per drag, 234–338 element bitmap builds,
15.7–25.2 MB uploaded, 4.3–6.2 s wall. The mask is a soft halo; it almost
certainly does not need 60 rebuilds per second.

TASK
Throttle rebuilds during continuous interaction, with a guaranteed final rebuild.

1. Coalesce to roughly 10 Hz while invalidations are arriving faster than that,
   and always rebuild once the input settles (trailing edge, ~120 ms quiet).
2. Ensure the final rebuild uses the final layout — verify by comparing the mask
   after a throttled drag against a mask built with no throttling at all, for
   the same final parameter values. They must be identical, not merely similar.
3. Behind a flag, off by default until measured.
4. Measure with the instrument from Prompt 5: rebuild count, four-phase times,
   total wall time, median and p95 frame intervals, over 3 interleaved runs.

CONSTRAINTS
- Do not change the mask algorithm or the shader.
- Do not skip the final rebuild under any circumstance.
- Do not apply the throttle to scroll, resize, or startup — those paths already
  do no redundant work and must stay that way. Confirm with counters that scroll
  still shows zero rasterizations.
- Do not move Range measurement to a worker.

ACCEPTANCE
- Rebuild count during a scripted drag drops to roughly 2–4, with wall time down
  proportionally.
- The settled mask is byte-identical to the unthrottled one (compare via
  sampleScreenMask, not a screenshot).
- Scroll still reports zero rasterizations, zero DOM reads, zero uploads.
- All parity variants still pass.

REPORT
- Before/after table.
- The identity check between throttled-final and unthrottled masks.
- Whether the flag should default on, and the evidence for that.
```

---

## Prompt 7 — Bake the push field (only if 200k+ grains ships)

```text
ROLE
You are replacing per-grain gradient sampling with a precomputed push field.
This is a GPU optimisation and it is conditional: do not start unless grain
counts above 200k are a shipped default, and unless Prompt 5's instrument shows
the mask pass is a meaningful share of frame time.

CONTEXT
Read docs/text-mask-research.md §3.3 and §4.2, then
src/simulation/ChladniGpuSimulation.ts (POSITION_FRAGMENT_SHADER),
src/simulation/textMaskTransform.ts, and
tests/parity/maskPushParity.test.ts.

Today, each grain inside text does: 1 density fetch, then 4 gradient taps, then
a possible second set of 4 taps at a wider radius, then normalize, then a mat3
multiply. The taps are expressed in texels (1.8 / uTextMaskRes), so lowering mask
resolution widens the gradient footprint in CSS px and visibly softens the
clearing radius.

Measured, 500k grains, single-shot and order-biased: mask on 24.5 ms, 1×1 zero
mask 21.7 ms, mask off 16.6 ms. That suggests ~8 ms total, with the taps perhaps
~3 ms — which would contradict the hypothesis that taps dominate. Do not trust
that number; re-measure with the timer query below before designing the fix.

TASK
1. First, attribute properly:
   - EXT_disjoint_timer_query_webgl2 around the compute pass only. Verified
     available in this Chromium; NOT in Safari or Firefox (Chrome-only
     instrument).
   - Pool 3–5 queries. Never call gl.finish(). Only read results when
     QUERY_RESULT_AVAILABLE is true on a later frame; polling an unavailable
     query stalls and will dominate the measurement.
   - Interleave conditions across repeats (on / flat / off / off / flat / on),
     at least 5 rounds, and report medians. Single-shot measurements at 1M
     grains produced mask-off slower than mask-on — that is the noise floor.
2. If the taps are a meaningful share, bake direction × magnitude into the mask
   update:
   - Generate a push field at mask-update time, in screen space, from the
     existing density.
   - Store direction in two channels and magnitude in a third (or pack more
     tightly if precision allows — state the precision you chose and why).
   - Per grain: one fetch, decode, apply uMaskPush, done. No normalize, no
     fallback tap.
   - Keep the density fetch only where it is still needed for the
     `density > 0.005` gate and the push magnitude curve.
3. Consider storing the push field at lower resolution than the density. State
   the resolution you chose and the measurement that justified it.

CONSTRAINTS
- The push direction and magnitude at the glyph edge must match the current
  shader within tolerance. `tests/parity/maskPushParity.test.ts` is the gate;
  extend it rather than weakening it.
- Do not change the Chladni wave math, grain physics, or the pointer repulsion.
- Do not change the mask raster, the atlas, or the transform matrices.
- Behind a flag; old shader path kept until parity passes.

ACCEPTANCE
- Timer-query attribution before and after, with the instrument's own cost
  stated.
- maskPushParity passes at all existing variants.
- Frame time at 500k improves measurably, or a clear statement that it did not
  and why.
- No visible change in the clearing radius at 4× slow-motion, at 5k and 50k
  grains.

REPORT
- The attribution table (before) and the improvement (after).
- Precision and resolution choices, with the measurements behind them.
- Whether the result justified the change. "No" is an acceptable answer.
```

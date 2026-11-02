#!/usr/bin/env node
/**
 * Text-mask visual parity + performance harness.
 *
 *   bun run parity:text-mask            # compare against the committed baseline
 *   bun run parity:text-mask --update   # (re)write the baseline
 *   bun run perf:text-mask              # print perf counters only
 *
 * It drives the Vite dev server (the debug hook is dev-only), forces a mask
 * rasterize at 0/50/100% scroll for a matrix of typography/orientation
 * variants, and stores a canonical *screen-space* grayscale sample of what the
 * particle shader samples. Screen-space sampling keeps the baseline meaningful
 * across implementations (viewport canvas today, document atlas later).
 */
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.TEXT_MASK_PORT || 3102);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const OUT_DIR = path.join(ROOT, 'docs', 'text-mask-parity');
const BASELINE_PATH = path.join(OUT_DIR, 'baseline.json');

const UPDATE = process.argv.includes('--update');
const PERF_ONLY = process.argv.includes('--perf');

const VIEWPORTS = [
  { id: '1440x900@1', width: 1440, height: 900, dpr: 1, mobile: false },
  { id: '390x844@3', width: 390, height: 844, dpr: 3, mobile: true },
];

const VARIANTS = [
  { id: 'default', settings: {} },
  { id: 'serif-variable', settings: { fontFamily: 'GT-Sectra-Fine', fontWeight: 500 } },
  { id: 'italic', settings: { fontItalic: true } },
  { id: 'tracking', settings: { fontLetterSpacing: 2.5 } },
  { id: 'rotation-90', settings: { rotationAngle: 90 } },
  { id: 'flip-h', settings: { flipHorizontal: true } },
  { id: 'flip-v', settings: { flipVertical: true } },
  { id: 'accordion-open', settings: {}, openAccordion: true },
];

const SCROLL_FRACTIONS = [0, 0.5, 1];

const DIFF_CHANNEL_THRESHOLD = 8; // 0..255
const MAX_DIFF_FRACTION = 0.02; // ≤ 2% of pixels may differ by > 8
const MAX_MEAN_DIFF = 1.5;

function startDevServer() {
  const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite');
  const child = spawn(viteBin, ['--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[dev] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[dev] ${chunk}`));
  return child;
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      // not ready
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite dev server did not start at ${BASE_URL}`);
}

/** Count real WebGL uploads originating from the mask canvas. */
const UPLOAD_INIT_SCRIPT = () => {
  window.__textMaskUploads = { calls: 0, bytes: 0 };
  const isMaskCanvas = (source) =>
    source && source.dataset && source.dataset.chladniMask === '1';

  for (const protoName of ['WebGL2RenderingContext', 'WebGLRenderingContext']) {
    const proto = window[protoName]?.prototype;
    if (!proto) continue;
    for (const fnName of ['texSubImage2D', 'texImage2D']) {
      const original = proto[fnName];
      if (typeof original !== 'function') continue;
      proto[fnName] = function patchedUpload(...args) {
        const source = args.find((arg) => arg instanceof HTMLCanvasElement);
        if (isMaskCanvas(source)) {
          window.__textMaskUploads.calls++;
          window.__textMaskUploads.bytes += source.width * source.height * 4;
        }
        return original.apply(this, args);
      };
    }
  }

  // Deterministic long-task accounting for the perf run.
  window.__textMaskLongTasks = { count: 0, totalMs: 0 };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__textMaskLongTasks.count++;
        window.__textMaskLongTasks.totalMs += entry.duration;
      }
    }).observe({ type: 'longtask', buffered: false });
  } catch {
    // unsupported
  }
};

async function waitForMask(page) {
  await page.waitForFunction(() => Boolean(window.__chladniTextMask), null, { timeout: 30_000 });
  await page.evaluate(async () => {
    try {
      await document.fonts.ready;
    } catch {
      // ignore
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function newPage(browser, viewport, settings) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.dpr,
    isMobile: viewport.mobile,
    hasTouch: viewport.mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.addInitScript((payload) => {
    try {
      localStorage.setItem('chladni_plate_saved_settings', JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, settings);
  await page.addInitScript(UPLOAD_INIT_SCRIPT);

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60_000 });
  await waitForMask(page);
  // Let late layout shifts (images, font swap) settle.
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
  });

  return { context, page, errors };
}

async function openAccordion(page) {
  const toggle = page.locator('[title="Open release details"]').first();
  if ((await toggle.count()) > 0) {
    await toggle.click();
    await page.waitForTimeout(500);
    await waitForMask(page);
  }
}

function sampleSize(viewport) {
  const long = 128;
  if (viewport.width >= viewport.height) {
    return { width: long, height: Math.round((long * viewport.height) / viewport.width) };
  }
  return { width: Math.round((long * viewport.width) / viewport.height), height: long };
}

async function captureAt(page, viewport, fraction) {
  await page.evaluate((f) => {
    const el = document.scrollingElement || document.documentElement;
    const maxScroll = Math.max(0, el.scrollHeight - window.innerHeight);
    window.scrollTo(0, Math.round(maxScroll * f));
  }, fraction);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
  );
  await page.waitForTimeout(60);

  return page.evaluate(
    ({ sample }) => {
      const api = window.__chladniTextMask;
      // Force a full re-measure + rasterize at this scroll position so the
      // comparison does not depend on the throttle phase.
      api.invalidate();
      return {
        snapshot: api.snapshot(),
        sample: api.sampleScreenMask(sample.width, sample.height),
        scrollY: window.scrollY,
        scrollHeight: (document.scrollingElement || document.documentElement).scrollHeight,
      };
    },
    { sample: sampleSize(viewport) }
  );
}

async function runParity(browser) {
  const result = {
    generatedAt: new Date().toISOString(),
    browser: await browser.version(),
    viewports: {},
  };

  for (const viewport of VIEWPORTS) {
    const captures = {};
    for (const variant of VARIANTS) {
      const { context, page, errors } = await newPage(browser, viewport, variant.settings);
      try {
        if (variant.openAccordion) await openAccordion(page);
        for (const fraction of SCROLL_FRACTIONS) {
          const key = `${variant.id}@${Math.round(fraction * 100)}`;
          captures[key] = await captureAt(page, viewport, fraction);
          if (errors.length) captures[key].errors = errors.slice(0, 5);
        }
      } finally {
        await context.close();
      }
    }
    result.viewports[viewport.id] = {
      width: viewport.width,
      height: viewport.height,
      dpr: viewport.dpr,
      captures,
    };
  }

  return result;
}

function decode(base64) {
  return Buffer.from(base64, 'base64');
}

function diffSamples(a, b) {
  if (a.width !== b.width || a.height !== b.height) {
    return { incompatible: true, width: a.width, height: a.height, otherWidth: b.width, otherHeight: b.height };
  }
  const pa = decode(a.data);
  const pb = decode(b.data);
  const total = Math.min(pa.length, pb.length);
  let differing = 0;
  let sum = 0;
  let max = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -1;
  let maxY = -1;
  for (let i = 0; i < total; i++) {
    const d = Math.abs(pa[i] - pb[i]);
    sum += d;
    if (d > max) max = d;
    if (d > DIFF_CHANNEL_THRESHOLD) {
      differing++;
      const x = i % a.width;
      const y = Math.floor(i / a.width);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  return {
    total,
    differing,
    fraction: total ? differing / total : 0,
    mean: total ? sum / total : 0,
    max,
    region: maxX >= 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
  };
}

async function compare(baseline, current) {
  const rows = [];
  let failures = 0;
  for (const viewportId of Object.keys(baseline.viewports)) {
    const base = baseline.viewports[viewportId];
    const now = current.viewports[viewportId];
    if (!now) {
      rows.push({ viewportId, key: '*', status: 'missing viewport' });
      failures++;
      continue;
    }
    for (const key of Object.keys(base.captures)) {
      const before = base.captures[key];
      const after = now.captures[key];
      if (!after) {
        rows.push({ viewportId, key, status: 'missing capture' });
        failures++;
        continue;
      }
      const diff = diffSamples(before.sample, after.sample);
      if (diff.incompatible) {
        rows.push({ viewportId, key, status: 'sample size changed', diff });
        failures++;
        continue;
      }
      const ok = diff.fraction <= MAX_DIFF_FRACTION && diff.mean <= MAX_MEAN_DIFF;
      if (!ok) failures++;
      rows.push({ viewportId, key, status: ok ? 'ok' : 'FAIL', diff });
    }
  }

  for (const row of rows) {
    const d = row.diff;
    if (!d) {
      console.log(`${row.status.padEnd(10)} ${row.viewportId} ${row.key}`);
      continue;
    }
    if (d.incompatible) {
      console.log(
        `FAIL       ${row.viewportId} ${row.key}  size ${d.width}x${d.height} -> ${d.otherWidth}x${d.otherHeight}`
      );
      continue;
    }
    console.log(
      `${row.status.padEnd(10)} ${row.viewportId} ${row.key.padEnd(20)} ` +
        `diff>${DIFF_CHANNEL_THRESHOLD}: ${(d.fraction * 100).toFixed(3)}% ` +
        `mean ${d.mean.toFixed(3)} max ${d.max}` +
        (d.region ? ` region ${d.region.w}x${d.region.h}@${d.region.x},${d.region.y}` : '')
    );
  }

  return failures;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

async function measureScroll(page, seconds, cpuRate) {
  const cdp = await page.context().newCDPSession(page);
  if (cpuRate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });

  const result = await page.evaluate(async (durationMs) => {
    const api = window.__chladniTextMask;
    api.reset();
    window.__textMaskUploads.calls = 0;
    window.__textMaskUploads.bytes = 0;
    window.__textMaskLongTasks.count = 0;
    window.__textMaskLongTasks.totalMs = 0;

    const el = document.scrollingElement || document.documentElement;
    el.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const maxScroll = Math.max(0, el.scrollHeight - window.innerHeight);
    const start = performance.now();
    const rasterDurations = [];
    let lastRasterizations = 0;

    await new Promise((resolve) => {
      const tick = (now) => {
        const t = (now - start) / durationMs;
        window.scrollTo(0, maxScroll * Math.min(1, t));
        const snap = api.snapshot();
        if (snap.rasterizations > lastRasterizations) {
          // One sample per rasterize pass, using the last measured duration.
          rasterDurations.push(snap.rasterizeMsLast);
          lastRasterizations = snap.rasterizations;
        }
        if (now - start >= durationMs) {
          resolve();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    const snap = api.snapshot();
    return {
      counters: snap,
      uploads: { ...window.__textMaskUploads },
      longTasks: { ...window.__textMaskLongTasks },
      rasterDurations,
      durationMs,
    };
  }, seconds * 1000);

  if (cpuRate > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.detach();

  const rasters = result.counters.rasterizations;
  const rasterMs = result.rasterDurations.length
    ? result.rasterDurations.reduce((a, b) => a + b, 0) / result.rasterDurations.length
    : 0;
  return {
    cpuRate,
    seconds,
    rasterizations: rasters,
    rasterizationsPerSecond: rasters / seconds,
    rangeCallsPerRaster: rasters
      ? (result.counters.rangeClientRects + result.counters.rangeBoundingRects) / rasters
      : 0,
    fillTextPerRaster: rasters ? result.counters.fillTextCalls / rasters : 0,
    uploadBytesPerSecond: result.uploads.bytes / seconds,
    uploadCalls: result.uploads.calls,
    rasterizeMsAvg: rasterMs,
    rasterizeMsMedian: median(result.rasterDurations),
    rasterizeMsTotal: result.counters.rasterizeMsTotal,
    layoutCount: result.counters.layoutCount,
    layoutMsAvg: result.counters.layoutCount
      ? result.counters.layoutMsTotal / result.counters.layoutCount
      : 0,
    drawCount: result.counters.drawCount,
    drawMsAvg: result.counters.drawCount
      ? result.counters.drawMsTotal / result.counters.drawCount
      : 0,
    longTaskCount: result.longTasks.count,
    longTaskMs: result.longTasks.totalMs,
    startupRasterizations: null,
  };
}

async function runPerf(browser) {
  const rows = [];
  for (const viewport of VIEWPORTS) {
    const { context, page } = await newPage(browser, viewport, {});
    try {
      // Startup: navigation already completed in newPage; count what the
      // manager did during construction + settle.
      await page.waitForTimeout(2_500);
      const startup = await page.evaluate(() => window.__chladniTextMask.snapshot().rasterizations);

      const idle = await measureScroll(page, 1.0, 1); // warm-up, discarded
      void idle;
      const normal = await measureScroll(page, 4, 1);
      const throttled = await measureScroll(page, 4, 4);

      rows.push({
        viewport: viewport.id,
        startupRasterizations: startup,
        normal,
        throttled4x: throttled,
      });
    } finally {
      await context.close();
    }
  }
  return rows;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'],
  });

  try {
    if (PERF_ONLY) {
      const rows = await runPerf(browser);
      const report = {
        generatedAt: new Date().toISOString(),
        browser: await browser.version(),
        rows,
      };
      const out = path.join(OUT_DIR, 'perf.json');
      await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
      console.log(JSON.stringify(rows, null, 2));
      console.log(`\nWrote ${out}`);
      return;
    }

    const current = await runParity(browser);

    if (UPDATE) {
      await writeFile(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      console.log(`Wrote baseline ${BASELINE_PATH}`);
      return;
    }

    let baseline;
    try {
      baseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));
    } catch {
      throw new Error(
        `No baseline at ${BASELINE_PATH}. Run \`bun run parity:text-mask --update\` first.`
      );
    }

    console.log(
      `Comparing ${Object.keys(current.viewports).length} viewport(s) against ${baseline.generatedAt}`
    );
    const failures = await compare(baseline, current);
    if (failures > 0) {
      await writeFile(path.join(OUT_DIR, 'last-run.json'), `${JSON.stringify(current, null, 2)}\n`);
      console.error(`\n${failures} capture(s) failed parity. Raw run saved to docs/text-mask-parity/last-run.json`);
      process.exitCode = 1;
      return;
    }
    console.log('\nParity OK.');
  } finally {
    await browser.close();
  }
}

const dev = startDevServer();

try {
  await waitForServer();
  await main();
} finally {
  dev.kill('SIGTERM');
}

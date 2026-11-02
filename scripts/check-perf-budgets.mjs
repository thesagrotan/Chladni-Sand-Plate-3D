/**
 * Performance budgets for CI.
 *
 * Static budgets (bundle + initial font bytes) are checked from `dist/` and are
 * deterministic. The scroll long-task budget runs the production preview in
 * headless Chromium; it is intentionally generous so CI hardware noise does not
 * turn a real regression into a flaky failure.
 *
 * Usage:
 *   bun run build
 *   bun run check:budgets
 *   bun run check:budgets --skip-runtime
 */
import { spawn } from 'node:child_process';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.BUDGET_PORT || 4175);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SKIP_RUNTIME = process.argv.includes('--skip-runtime');

export const BUDGETS = {
  /** Entry chunk (the app shell); lazy panel chunks are excluded. */
  mainJsBytes: 900_000,
  /** Every JS chunk shipped, including lazy ones. */
  totalJsBytes: 1_000_000,
  cssBytes: 120_000,
  /** Bytes of fonts preloaded before first paint. */
  initialFontBytes: 40_000,
  /** Long tasks observed during a 5 s synthetic scroll. */
  scrollLongTaskCount: 4,
  scrollLongTaskTotalMs: 400,
  scrollLongTaskMaxMs: 200,
};

/**
 * SwiftShader/llvmpipe timings are not comparable with the Metal path (see
 * HANDOFF.md). Keep the check running in GPU-less CI, but with budgets that
 * only catch runaway regressions rather than small noise.
 */
export const SOFTWARE_BUDGETS = {
  scrollLongTaskCount: 120,
  scrollLongTaskTotalMs: 15_000,
  scrollLongTaskMaxMs: 500,
};

async function assertDistExists() {
  try {
    await access(path.join(DIST, 'index.html'));
  } catch {
    throw new Error('dist/index.html is missing. Run `bun run build` first.');
  }
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

async function fileSize(urlPath) {
  const clean = urlPath.split('?')[0].replace(/^\//, '');
  const file = path.join(DIST, clean);
  const buffer = await readFile(file);
  return buffer.byteLength;
}

async function staticStats() {
  const html = await readFile(path.join(DIST, 'index.html'), 'utf8');

  const scriptSources = Array.from(html.matchAll(/<script\b[^>]*>/g), (m) => m[0])
    .map((tag) => attr(tag, 'src'))
    .filter(Boolean);
  const mainScripts = scriptSources.filter((src) => /^\/assets\//.test(src));

  const linkTags = Array.from(html.matchAll(/<link\b[^>]*>/g), (m) => m[0]);
  const stylesheetHrefs = linkTags
    .filter((tag) => /\brel="stylesheet"/.test(tag))
    .map((tag) => attr(tag, 'href'))
    .filter((href) => Boolean(href) && href.startsWith('/'));
  const fontHrefs = linkTags
    .filter((tag) => /\brel="preload"/.test(tag) && /\bas="font"/.test(tag))
    .map((tag) => attr(tag, 'href'))
    .filter((href) => Boolean(href) && href.startsWith('/'));

  const mainJsBytes = (
    await Promise.all(mainScripts.map((src) => fileSize(src)))
  ).reduce((sum, bytes) => sum + bytes, 0);

  const cssBytes = (
    await Promise.all(stylesheetHrefs.map((href) => fileSize(href)))
  ).reduce((sum, bytes) => sum + bytes, 0);

  const initialFontBytes = (
    await Promise.all(fontHrefs.map((href) => fileSize(href)))
  ).reduce((sum, bytes) => sum + bytes, 0);

  const assets = await readdir(path.join(DIST, 'assets'));
  const totalJsBytes = (
    await Promise.all(
      assets.filter((name) => name.endsWith('.js')).map((name) => fileSize(`/assets/${name}`))
    )
  ).reduce((sum, bytes) => sum + bytes, 0);

  return {
    mainJsBytes,
    totalJsBytes,
    cssBytes,
    initialFontBytes,
    mainScripts,
    stylesheetHrefs,
    fontHrefs,
    assetCount: assets.length,
  };
}

function startPreview() {
  const viteBin = path.join(ROOT, 'node_modules', '.bin', 'vite');
  const child = spawn(
    viteBin,
    ['preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  child.stdout.on('data', (chunk) => process.stdout.write(`[preview] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[preview] ${chunk}`));
  return child;
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start at ${BASE_URL}`);
}

const MEASURE_SCROLL_LONG_TASKS = (durationMs) =>
  new Promise((resolve) => {
    const durations = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) durations.push(entry.duration);
    });
    try {
      observer.observe({ type: 'longtask' });
    } catch {
      resolve({ supported: false, count: 0, totalMs: 0, maxMs: 0 });
      return;
    }

    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    const start = performance.now();
    const maxScroll = Math.max(
      0,
      (document.scrollingElement || document.documentElement).scrollHeight - window.innerHeight
    );

    const tick = (now) => {
      const t = Math.min(1, (now - start) / durationMs);
      window.scrollTo(0, maxScroll * t);
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      observer.disconnect();
      const total = durations.reduce((sum, duration) => sum + duration, 0);
      resolve({
        supported: true,
        count: durations.length,
        totalMs: +total.toFixed(2),
        maxMs: +(durations.length ? Math.max(...durations) : 0).toFixed(2),
      });
    };
    requestAnimationFrame(tick);
  });

async function runtimeStats() {
  const args = ['--enable-webgl', '--ignore-gpu-blocklist'];
  // Perf numbers are only comparable on the Metal GPU path (see HANDOFF.md).
  if (process.env.BUDGET_ANGLE) {
    args.push(`--use-angle=${process.env.BUDGET_ANGLE}`);
  } else if (process.platform === 'darwin') {
    args.push('--use-angle=metal');
  }

  const browser = await chromium.launch({
    headless: true,
    args,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));

    await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60_000 });
    await page.waitForTimeout(2_000);

    const renderer = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      if (!gl) return 'none';
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    });
    const software = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);

    const scroll = await page.evaluate(MEASURE_SCROLL_LONG_TASKS, 5_000);
    await context.close();

    return { scroll, pageErrors, renderer, software };
  } finally {
    await browser.close();
  }
}

function report(rows) {
  let failed = 0;
  console.log('\nPerformance budgets');
  console.log('─'.repeat(74));
  for (const row of rows) {
    const status = row.pass ? 'PASS' : 'FAIL';
    if (!row.pass) failed++;
    const actual = typeof row.actual === 'number' ? row.actual.toLocaleString() : row.actual;
    const budget = typeof row.budget === 'number' ? row.budget.toLocaleString() : row.budget;
    console.log(
      `${status}  ${row.label.padEnd(32)} ${String(actual).padStart(12)} / ${String(budget).padEnd(12)} ${row.unit}`
    );
  }
  console.log('─'.repeat(74));
  return failed;
}

async function main() {
  await assertDistExists();
  const stats = await staticStats();

  const rows = [
    {
      label: 'Main JS',
      actual: stats.mainJsBytes,
      budget: BUDGETS.mainJsBytes,
      unit: 'bytes',
      pass: stats.mainJsBytes <= BUDGETS.mainJsBytes,
    },
    {
      label: 'Total JS',
      actual: stats.totalJsBytes,
      budget: BUDGETS.totalJsBytes,
      unit: 'bytes',
      pass: stats.totalJsBytes <= BUDGETS.totalJsBytes,
    },
    {
      label: 'CSS',
      actual: stats.cssBytes,
      budget: BUDGETS.cssBytes,
      unit: 'bytes',
      pass: stats.cssBytes <= BUDGETS.cssBytes,
    },
    {
      label: 'Initial preloaded fonts',
      actual: stats.initialFontBytes,
      budget: BUDGETS.initialFontBytes,
      unit: 'bytes',
      pass: stats.initialFontBytes <= BUDGETS.initialFontBytes,
    },
  ];

  if (!SKIP_RUNTIME) {
    const preview = startPreview();
    try {
      await waitForServer();
      const runtime = await runtimeStats();
      const { scroll } = runtime;
      const scrollBudgets = runtime.software ? SOFTWARE_BUDGETS : BUDGETS;

      console.log(
        `\nScroll renderer: ${runtime.renderer}${runtime.software ? ' (software budgets)' : ''}`
      );

      rows.push(
        {
          label: 'Scroll long tasks (count)',
          actual: scroll.count,
          budget: scrollBudgets.scrollLongTaskCount,
          unit: '',
          pass: scroll.count <= scrollBudgets.scrollLongTaskCount,
        },
        {
          label: 'Scroll long tasks (total)',
          actual: scroll.totalMs,
          budget: scrollBudgets.scrollLongTaskTotalMs,
          unit: 'ms',
          pass: scroll.totalMs <= scrollBudgets.scrollLongTaskTotalMs,
        },
        {
          label: 'Scroll long task (max)',
          actual: scroll.maxMs,
          budget: scrollBudgets.scrollLongTaskMaxMs,
          unit: 'ms',
          pass: scroll.maxMs <= scrollBudgets.scrollLongTaskMaxMs,
        }
      );

      if (runtime.pageErrors.length > 0) {
        console.error('\nPage errors during the scroll budget run:');
        for (const error of runtime.pageErrors) console.error(`  - ${error}`);
        rows.push({
          label: 'Page errors',
          actual: runtime.pageErrors.length,
          budget: 0,
          unit: '',
          pass: false,
        });
      }
    } finally {
      preview.kill('SIGTERM');
    }
  }

  const failed = report(rows);
  if (failed > 0) {
    console.error(`\n${failed} budget${failed === 1 ? '' : 's'} exceeded.`);
    process.exitCode = 1;
  } else {
    console.log('\nAll performance budgets passed.');
  }
}

await main();

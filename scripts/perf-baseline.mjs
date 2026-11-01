import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.BASELINE_PORT || 4173);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const IDLE_SECONDS = Number(process.env.BASELINE_IDLE_SECONDS || 10);
const SCROLL_SECONDS = Number(process.env.BASELINE_SCROLL_SECONDS || 10);
const ENGINE_SECONDS = Number(process.env.BASELINE_ENGINE_SECONDS || 60);

const ENGINE_SCENARIOS = [
  { name: 'gpu', settings: { simulationEngine: 'gpu' } },
  { name: 'wasm', settings: { simulationEngine: 'wasm' } },
  { name: 'js_cpu', settings: { simulationEngine: 'js_cpu' } },
];

function startPreview() {
  const child = spawn('bun', ['run', 'preview', '--', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => process.stdout.write(`[preview] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[preview] ${chunk}`));

  return child;
}

async function waitForServer(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE_URL);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Preview server did not start at ${BASE_URL}`);
}

async function bundleStats() {
  const dist = path.join(ROOT, 'dist');
  const html = await readFile(path.join(dist, 'index.html'), 'utf8');
  const assets = Array.from(html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g), (m) => m[1]);

  const files = [];
  for (const asset of assets) {
    const buf = await readFile(path.join(dist, 'assets', asset));
    files.push({ name: asset, bytes: buf.byteLength });
  }

  return files;
}

const INIT_SCRIPT = () => {
  const perf = {
    lcp: 0,
    cls: 0,
    longTasks: [],
    paints: {},
    navigation: {},
    commits: 0,
    textDraws: 0,
    texturesCreated: 0,
    texturesDeleted: 0,
  };
  window.__perfBaseline = perf;

  // Count React commits without loading DevTools.
  try {
    let nextRendererId = 1;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      supportsFiber: true,
      isDisabled: false,
      renderers: new Map(),
      inject() {
        return nextRendererId++;
      },
      onCommitFiberRoot() {
        perf.commits++;
      },
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      checkDCE() {},
      getFiberRoots() {
        return new Set();
      },
    };
  } catch {
    // ignore
  }

  // Proxy text rasterizations and texture lifetime through the 2D/WebGL prototypes.
  try {
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function patchedFillText(...args) {
      perf.textDraws++;
      return fillText.apply(this, args);
    };
  } catch {
    // ignore
  }

  try {
    const proto = WebGL2RenderingContext.prototype;
    const createTexture = proto.createTexture;
    const deleteTexture = proto.deleteTexture;
    proto.createTexture = function patchedCreateTexture(...args) {
      perf.texturesCreated++;
      return createTexture.apply(this, args);
    };
    proto.deleteTexture = function patchedDeleteTexture(...args) {
      perf.texturesDeleted++;
      return deleteTexture.apply(this, args);
    };
  } catch {
    // ignore
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        perf.lcp = entry.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // unsupported
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) perf.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    // unsupported
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        perf.longTasks.push({ start: entry.startTime, duration: entry.duration });
      }
    }).observe({ type: 'longtask', buffered: true });
  } catch {
    // unsupported
  }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        perf.paints[entry.name] = entry.startTime;
      }
    }).observe({ type: 'paint', buffered: true });
  } catch {
    // unsupported
  }

  window.addEventListener('load', () => {
    const nav = performance.getEntriesByType('navigation')[0];
    if (nav) {
      perf.navigation = {
        domContentLoaded: nav.domContentLoadedEventEnd,
        load: nav.loadEventEnd,
        responseEnd: nav.responseEnd,
        transferSize: nav.transferSize,
      };
    }
  });

  window.__scrollEvents = 0;
  window.addEventListener('scroll', () => {
    window.__scrollEvents++;
  }, { passive: true });

  window.__measureFrames = (durationMs, scroll) =>
    new Promise((resolve) => {
      const deltas = [];
      const scrollEventsBefore = window.__scrollEvents;
      const scrollYBefore = window.scrollY;
      let last = performance.now();
      const start = last;
      const el = document.scrollingElement || document.documentElement;
      const maxScroll = Math.max(0, el.scrollHeight - window.innerHeight);

      const finish = () => {
        const sorted = [...deltas].sort((a, b) => a - b);
        const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] || 0;
        const total = deltas.reduce((a, b) => a + b, 0);
        const longFrames = deltas.filter((d) => d > 50).length;
        resolve({
          frames: deltas.length,
          durationMs: total,
          fps: deltas.length ? (deltas.length / total) * 1000 : 0,
          p50: pct(0.5),
          p95: pct(0.95),
          p99: pct(0.99),
          max: sorted[sorted.length - 1] || 0,
          droppedFrames: deltas.filter((d) => d > 33.4).length,
          longFrames,
          scrollEvents: window.__scrollEvents - scrollEventsBefore,
          scrollYBefore,
          scrollYAfter: window.scrollY,
          maxScroll,
        });
      };

      const tick = (now) => {
        deltas.push(now - last);
        last = now;
        if (now - start >= durationMs) {
          finish();
          return;
        }
        if (scroll) {
          const t = (now - start) / durationMs;
          window.scrollTo(0, maxScroll * Math.min(1, t));
        }
        requestAnimationFrame(tick);
      };

      if (scroll) {
        // The site opts into CSS smooth scrolling; make the synthetic scroll
        // deterministic so the measurement covers the same distance every run.
        document.documentElement.style.scrollBehavior = 'auto';
        window.scrollTo(0, 0);
      }
      requestAnimationFrame(tick);
    });

  window.__webglInfo = () => {
    const source = document.querySelector('canvas') || document.createElement('canvas');
    const gl = source.getContext('webgl2') || source.getContext('webgl');
    if (!gl) return { available: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      available: true,
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  };
};

async function summarizeLongTasks(tasks) {
  const durations = tasks.map((task) => task.duration);
  const total = durations.reduce((a, b) => a + b, 0);
  const tbt = durations.reduce((sum, duration) => sum + Math.max(0, duration - 50), 0);
  return {
    count: tasks.length,
    totalMs: +total.toFixed(2),
    tbtMs: +tbt.toFixed(2),
    maxMs: +(durations.length ? Math.max(...durations) : 0).toFixed(2),
  };
}

async function readCounters(page) {
  return page.evaluate(() => {
    const perf = window.__perfBaseline || {};
    return {
      commits: perf.commits ?? 0,
      textDraws: perf.textDraws ?? 0,
      texturesCreated: perf.texturesCreated ?? 0,
      texturesDeleted: perf.texturesDeleted ?? 0,
    };
  });
}

function counterDelta(before, after) {
  return {
    reactCommits: after.commits - before.commits,
    textDraws: after.textDraws - before.textDraws,
    texturesCreated: after.texturesCreated - before.texturesCreated,
    texturesDeleted: after.texturesDeleted - before.texturesDeleted,
    texturesLive: after.texturesCreated - after.texturesDeleted,
  };
}

async function runScenario(browser, scenario) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];

  page.on('pageerror', (error) => consoleErrors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  if (scenario.settings) {
    await page.addInitScript((settings) => {
      try {
        localStorage.setItem('chladni_plate_saved_settings', JSON.stringify(settings));
      } catch {
        // about:blank or a sandboxed origin
      }
    }, scenario.settings);
  }

  await page.addInitScript(INIT_SCRIPT);

  const startedAt = Date.now();
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 60_000 });
  const navigationMs = Date.now() - startedAt;

  await page.waitForTimeout(2_500);

  const load = await page.evaluate(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const perf = window.__perfBaseline || {};
    return {
      fcp: perf.paints?.['first-contentful-paint'] ?? null,
      lcp: perf.lcp ?? null,
      cls: perf.cls ?? null,
      longTasks: perf.longTasks ?? [],
      navigation: perf.navigation ?? {},
      heap: performance.memory
        ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize }
        : null,
      webgl: window.__webglInfo ? window.__webglInfo() : null,
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      canvasCount: document.querySelectorAll('canvas').length,
      counters: {
        commits: perf.commits ?? 0,
        textDraws: perf.textDraws ?? 0,
        texturesCreated: perf.texturesCreated ?? 0,
        texturesDeleted: perf.texturesDeleted ?? 0,
      },
    };
  });

  const result = {
    scenario: scenario.name,
    navigationMs,
    load: {
      fcp: load.fcp,
      lcp: load.lcp,
      cls: load.cls,
      domContentLoaded: load.navigation.domContentLoaded ?? null,
      load: load.navigation.load ?? null,
      transferSize: load.navigation.transferSize ?? null,
      longTasks: await summarizeLongTasks(load.longTasks),
    },
    webgl: load.webgl,
    scrollHeight: load.scrollHeight,
    canvasCount: load.canvasCount,
    heapBefore: load.heap,
    idle: null,
    scroll: null,
    engine: null,
    consoleErrors,
  };

  result.loadCounters = load.counters;

  if (scenario.runIdle) {
    const beforeIdle = await readCounters(page);
    result.idle = await page.evaluate((seconds) => window.__measureFrames(seconds * 1000, false), IDLE_SECONDS);
    result.idleCounters = counterDelta(beforeIdle, await readCounters(page));
  }

  if (scenario.runScroll) {
    const beforeScroll = await readCounters(page);
    result.scroll = await page.evaluate((seconds) => window.__measureFrames(seconds * 1000, true), SCROLL_SECONDS);
    result.scrollCounters = counterDelta(beforeScroll, await readCounters(page));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }

  if (scenario.runEngine) {
    const beforeEngine = await readCounters(page);
    result.engine = await page.evaluate(
      (seconds) => window.__measureFrames(seconds * 1000, false),
      ENGINE_SECONDS
    );
    result.engineCounters = counterDelta(beforeEngine, await readCounters(page));
    result.heapAfter = await page.evaluate(() =>
      performance.memory
        ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize }
        : null
    );
  }

  await context.close();
  return result;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--enable-webgl',
      '--enable-gpu',
      '--ignore-gpu-blocklist',
      '--use-angle=metal',
    ],
  });

  const results = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    browser: await browser.version(),
    viewport: { width: 1440, height: 900 },
    bundle: await bundleStats(),
    scenarios: [],
  };

  try {
    const warmupContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const warmupPage = await warmupContext.newPage();
    await warmupPage.goto(BASE_URL, { waitUntil: 'load', timeout: 60_000 }).catch(() => {});
    await warmupPage.waitForTimeout(1_000);
    await warmupContext.close();

    results.scenarios.push(
      await runScenario(browser, { name: 'load-idle-scroll', runIdle: true, runScroll: true })
    );

    for (const engine of ENGINE_SCENARIOS) {
      results.scenarios.push(
        await runScenario(browser, {
          name: `engine-${engine.name}`,
          settings: engine.settings,
          runEngine: true,
        })
      );
    }
  } finally {
    await browser.close();
  }

  const outDir = path.join(ROOT, 'docs');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'perf-baseline.json'), `${JSON.stringify(results, null, 2)}\n`);

  console.log(JSON.stringify(results, null, 2));
  console.log(`\nWrote ${path.join(outDir, 'perf-baseline.json')}`);
}

const preview = startPreview();

try {
  await waitForServer();
  await main();
} finally {
  preview.kill('SIGTERM');
}

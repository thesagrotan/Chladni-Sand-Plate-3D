/**
 * Dev-only instrumentation for the text mask.
 *
 * Everything here is gated on `import.meta.env.DEV`; Vite replaces that with
 * `false` in production builds, so the attach call is tree-shaken and no debug
 * global is shipped. The counters exist to let the parity/perf harness measure
 * DOM measurement, fillText, and texture-upload cost without monkey-patching
 * prototypes from the outside.
 */

export const TEXT_MASK_DEBUG_ENABLED = import.meta.env.DEV;

export interface TextMaskDebugCounters {
  /** Completed rasterize passes (including the constructor pass). */
  rasterizations: number;
  /** `Range.getClientRects()` calls made while collecting line layout. */
  rangeClientRects: number;
  /** `Range.getBoundingClientRect()` calls (the per-character fallback path). */
  rangeBoundingRects: number;
  /** `document.createTreeWalker()` calls while collecting line layout. */
  treeWalkers: number;
  /** `getComputedStyle()` calls made by the manager. */
  computedStyles: number;
  /** `CanvasRenderingContext2D.fillText()` calls. */
  fillTextCalls: number;
  /** Requests to re-upload the mask texture (`texture.needsUpdate = true`). */
  uploadRequests: number;
  /** Bytes requested per upload (RGBA8 canvas size). */
  uploadBytes: number;
  /** Total time spent inside `rasterizeText()` in ms. */
  rasterizeMsTotal: number;
  /** Duration of the most recent `rasterizeText()` in ms. */
  rasterizeMsLast: number;
  /** Layout re-measure passes and their total time. */
  layoutCount: number;
  layoutMsTotal: number;
  layoutMsLast: number;
  /** Draw-only passes (cache hits) and their total time. */
  drawCount: number;
  drawMsTotal: number;
  drawMsLast: number;
  /** Layout invalidations skipped because the content signature was unchanged. */
  signatureSkips: number;
  /** Long tasks observed since attach (dev only). */
  longTasks: number;
  longTaskMs: number;
}

export interface TextMaskDebugSnapshot extends TextMaskDebugCounters {
  rasterizeMsAvg: number;
  canvasWidth: number;
  canvasHeight: number;
  scrollY: number;
  active: boolean;
  strength: number;
}

export interface TextMaskDebugTarget {
  canvas: HTMLCanvasElement;
  active: boolean;
  strength: number;
  rasterizeText(): void;
  /** Force a full layout re-measure (used by the parity harness). */
  invalidateLayout(): void;
  /** Screen-space (what the shader samples) grayscale sample as base64. */
  sampleScreenMask(width: number, height: number): { width: number; height: number; data: string };
}

export interface TextMaskDebugApi {
  readonly manager: TextMaskDebugTarget;
  readonly canvas: HTMLCanvasElement;
  readonly counters: TextMaskDebugCounters;
  reset(): void;
  snapshot(): TextMaskDebugSnapshot;
  rasterize(): void;
  invalidate(): void;
  sampleScreenMask(
    width?: number,
    height?: number
  ): { width: number; height: number; data: string };
}

export interface TextMaskDebugGlobal {
  __chladniTextMask?: TextMaskDebugApi;
}

function freshCounters(): TextMaskDebugCounters {
  return {
    rasterizations: 0,
    rangeClientRects: 0,
    rangeBoundingRects: 0,
    treeWalkers: 0,
    computedStyles: 0,
    fillTextCalls: 0,
    uploadRequests: 0,
    uploadBytes: 0,
    rasterizeMsTotal: 0,
    rasterizeMsLast: 0,
    layoutCount: 0,
    layoutMsTotal: 0,
    layoutMsLast: 0,
    drawCount: 0,
    drawMsTotal: 0,
    drawMsLast: 0,
    signatureSkips: 0,
    longTasks: 0,
    longTaskMs: 0,
  };
}

/**
 * Attach the debug API to the manager and expose it (non-enumerably) on
 * `window.__chladniTextMask`. Returns `null` in production.
 */
export function attachTextMaskDebug(target: TextMaskDebugTarget): TextMaskDebugApi | null {
  if (!TEXT_MASK_DEBUG_ENABLED) return null;
  if (typeof window === 'undefined') return null;

  const counters = freshCounters();
  let observer: PerformanceObserver | null = null;

  // Let the WebGL upload counter identify the mask canvas among all textures.
  target.canvas.dataset.chladniMask = '1';

  try {
    observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        counters.longTasks++;
        counters.longTaskMs += entry.duration;
      }
    });
    observer.observe({ type: 'longtask', buffered: false });
  } catch {
    // Long-task observer unsupported; counters simply stay at zero.
    observer = null;
  }

  const api: TextMaskDebugApi = {
    manager: target,
    canvas: target.canvas,
    counters,
    reset() {
      Object.assign(counters, freshCounters());
    },
    snapshot() {
      return {
        ...counters,
        rasterizeMsAvg:
          counters.rasterizations > 0
            ? counters.rasterizeMsTotal / counters.rasterizations
            : 0,
        canvasWidth: target.canvas.width,
        canvasHeight: target.canvas.height,
        scrollY: window.scrollY,
        active: target.active,
        strength: target.strength,
      };
    },
    rasterize() {
      target.rasterizeText();
    },
    invalidate() {
      target.invalidateLayout();
      target.rasterizeText();
    },
    sampleScreenMask(width, height) {
      return target.sampleScreenMask(width ?? 128, height ?? 128);
    },
  };

  Object.defineProperty(window, '__chladniTextMask', {
    configurable: true,
    enumerable: false,
    writable: false,
    value: api,
  });

  return api;
}

export function detachTextMaskDebug(api: TextMaskDebugApi | null): void {
  if (!api || typeof window === 'undefined') return;
  const existing = (window as unknown as TextMaskDebugGlobal).__chladniTextMask;
  if (existing === api) {
    try {
      delete (window as unknown as TextMaskDebugGlobal).__chladniTextMask;
    } catch {
      // Non-configurable in some embeddings; leaving it is harmless in dev.
    }
  }
}

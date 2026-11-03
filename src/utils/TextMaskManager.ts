import * as THREE from 'three';
import {
  attachTextMaskDebug,
  detachTextMaskDebug,
  type TextMaskDebugApi,
} from './textMaskDebug.ts';
import {
  fontKeyFromStyle,
  fontShorthand,
  readFontStyle,
  type TextMaskFontStyle,
  type TextMaskLayoutEntry,
  type TextMaskLineLayout,
  type TextMaskRepulsorType,
} from './TextMaskLayoutCache.ts';

export interface TextMaskManagerOptions {
  resolution?: number; // default 1024
  trackedSelector?: string; // default '[data-text-repulsor]'
  strength?: number; // default 0.022
  maxTextureSize?: number; // default 16384; atlas height is capped to this
}

interface RectLike {
  top: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** Strong RTL, explicit line breaks, and zero-width formatting characters take
 * the exact per-character path: binary line-boundary search assumes a simple
 * left-to-right, uniformly styled text node. */
const PER_CHARACTER_FALLBACK_RE =
  /[\u0590-\u08ff\ufb1d-\ufdfd\ufe70-\ufefc\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff\n\r\t]/;

export class TextMaskManager {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public strength: number;
  public active: boolean = true;
  public resolution: number;
  /** Document-space atlas dimensions in CSS pixels and mask pixels per CSS px. */
  public docWidth: number = 0;
  public docHeight: number = 0;
  public maskScale: number = 1;
  public maxTextureSize: number = 16384;
  /** Dev-only counters/global; `null` in production. */
  public debug: TextMaskDebugApi | null = null;

  private trackedSelector: string;
  private dirty: boolean = true;
  private dirtyRafId: number = 0;
  private resizeObserver: ResizeObserver | null = null;
  private mutationObserver: MutationObserver | null = null;
  private boundOnResize: () => void;
  private boundOnCustomRefresh: () => void;
  private isDestroyed: boolean = false;

  // Per-element layout cache (document coordinates). Rebuilt only when the
  // layout version changes; scroll redraws from it without DOM reads.
  private layoutCache: Map<HTMLElement, TextMaskLayoutEntry> | null = null;
  private layoutDirty: boolean = true;
  private trackedElements: HTMLElement[] | null = null;
  private trackedElementsDirty: boolean = true;
  private trackedSet: Set<Element> = new Set();
  private trackedAncestors: Set<Element> = new Set();
  private observedElements: Set<Element> = new Set();
  private warnedFixedPosition: boolean = false;

  // Cheap signature of everything that affects the mask image. Used to skip
  // redraws (and texture uploads) after redundant invalidations.
  private lastLayoutSignature: string = '';

  // Per-element blurred text bitmaps. Built once per layout version and
  // composited with drawImage on every rasterization (including scroll).
  private bitmapCache: Map<
    HTMLElement,
    {
      key: string;
      canvas: HTMLCanvasElement;
      originX: number; // device pixels
      originY: number;
      scale: number;
      superSample: number;
      width: number;
      height: number;
      outerBlur: number;
      coreBlur: number;
      pixels: number;
    }
  > = new Map();
  private bitmapPixelTotal: number = 0;
  private static readonly MAX_BITMAP_ENTRIES = 64;
  private static readonly MAX_BITMAP_PIXELS = 8_000_000; // ~32 MB RGBA

  // Canvas dimensions are kept proportional to the viewport aspect ratio
  // so that scaleX === scaleY (uniform scale), avoiding text distortion.
  public canvasW: number;
  public canvasH: number;

  constructor(options: TextMaskManagerOptions = {}) {
    this.resolution = options.resolution || 1024;
    this.trackedSelector = options.trackedSelector || '[data-text-repulsor]';
    this.strength = options.strength ?? 0.022;
    this.maxTextureSize = options.maxTextureSize || 16384;

    // Compute canvas dimensions that match the current viewport aspect ratio
    // at roughly `resolution` pixels on the longer axis.
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 800;
    const aspect = vw / vh;
    if (aspect >= 1) {
      this.canvasW = this.resolution;
      this.canvasH = Math.round(this.resolution / aspect);
    } else {
      this.canvasH = this.resolution;
      this.canvasW = Math.round(this.resolution * aspect);
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasW;
    this.canvas.height = this.canvasH;

    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    });
    if (!ctx) {
      throw new Error('Failed to create 2D canvas context for TextMaskManager');
    }
    this.ctx = ctx;

    // Fill initial black background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.NoColorSpace;
    this.texture.flipY = true; // matches WebGL orthographic screen coordinates
    // The shader reads `.r` only. WebGL2 accepts a canvas source for R8, so
    // the mask uploads 1 byte/px instead of 4 (and uses a quarter of the VRAM).
    this.texture.format = THREE.RedFormat;
    this.texture.type = THREE.UnsignedByteType;

    // Dev-only instrumentation: exposes counters and a screen-space sampler to
    // the parity harness. Tree-shaken out of production builds.
    this.debug = attachTextMaskDebug(this);

    this.boundOnResize = () => {
      this.invalidateLayout();
    };

    this.boundOnCustomRefresh = () => {
      this.invalidateLayout();
    };

    window.addEventListener('resize', this.boundOnResize, { passive: true });
    window.addEventListener('chladni:refresh-text-mask', this.boundOnCustomRefresh);

    // Ensure fonts are ready before rasterizing
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!this.isDestroyed) {
          this.invalidateLayout();
        }
      });
    }

    // One delayed fallback for late layout shifts (images, font swap). Earlier
    // versions used six timeouts here; the ResizeObserver and MutationObserver
    // now cover those cases, so a single late pass is enough.
    setTimeout(() => {
      if (!this.isDestroyed) {
        this.invalidateLayout();
      }
    }, 600);

    // Size changes on tracked elements (and the body) invalidate layout.
    try {
      this.resizeObserver = new ResizeObserver(() => {
        this.invalidateLayout();
      });
      this.resizeObserver.observe(document.body);
    } catch {
      // Ignore if ResizeObserver is not supported
      this.resizeObserver = null;
    }

    // Text/content/style changes under a tracked element invalidate layout.
    try {
      this.mutationObserver = new MutationObserver((records) => {
        this.onMutations(records);
      });
      this.mutationObserver.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'data-text-repulsor', 'data-repulsor-text'],
      });
    } catch {
      this.mutationObserver = null;
    }

    // Initial render
    this.rasterizeText();
  }

  /**
   * Mark the cached DOM layout as stale: resize, font change, text/content
   * change, element size/visibility change, or accordion open/close.
   */
  public invalidateLayout(): void {
    this.layoutDirty = true;
    this.trackedElementsDirty = true;
    this.scheduleRasterize();
  }

  /** Backwards-compatible alias for typography changes (full re-measure). */
  public setDirty(): void {
    this.invalidateLayout();
  }

  /**
   * Coalesce dirty-marking into at most one flush per animation frame. A
   * ResizeObserver fire, a MutationObserver batch, a font event and a
   * 'chladni:refresh-text-mask' dispatch can all land in the same frame; each
   * one independently marking dirty + running update() would multiply the
   * expensive DOM-measure pass.
   */
  private scheduleRasterize(): void {
    if (this.isDestroyed || this.dirtyRafId !== 0) return;
    this.dirtyRafId = requestAnimationFrame(() => {
      this.dirtyRafId = 0;
      this.dirty = true;
    });
  }

  public update(_now: number, _force = false): boolean {
    if (this.isDestroyed || !this.active) return false;
    if (!this.dirty) return false;

    this.dirty = false;
    this.rasterizeText();
    return true;
  }

  private getTrackedElements(): HTMLElement[] {
    if (!this.trackedElements || this.trackedElementsDirty) {
      const list = Array.from(document.querySelectorAll(this.trackedSelector)) as HTMLElement[];
      this.trackedElements = list;
      this.trackedSet = new Set(list);
      this.trackedAncestors = new Set();
      for (const el of list) {
        let parent = el.parentElement;
        while (parent && parent !== document.body) {
          this.trackedAncestors.add(parent);
          parent = parent.parentElement;
        }
      }
      this.trackedElementsDirty = false;
    }
    return this.trackedElements;
  }

  private onMutations(records: MutationRecord[]): void {
    let layout = false;
    let elements = false;

    for (const record of records) {
      const target =
        record.target.nodeType === Node.ELEMENT_NODE
          ? (record.target as Element)
          : record.target.parentElement;
      if (!target) continue;

      const touchesTracked = this.trackedSet.has(target) || this.trackedAncestors.has(target);

      if (!touchesTracked) {
        if (record.type === 'attributes' && record.attributeName === 'data-text-repulsor') {
          // The attribute may have just added (or removed) tracked status.
          const el = record.target as Element;
          if (el.matches?.(this.trackedSelector)) {
            elements = true;
            layout = true;
          }
        } else if (record.type === 'childList') {
          for (const node of Array.from(record.addedNodes).concat(Array.from(record.removedNodes))) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            const el = node as Element;
            if (
              el.matches?.(this.trackedSelector) ||
              el.querySelector?.(this.trackedSelector)
            ) {
              elements = true;
              layout = true;
              break;
            }
          }
        }
        continue;
      }

      layout = true;
      if (record.type === 'childList' || record.attributeName === 'data-text-repulsor') {
        elements = true;
      }
    }

    if (layout) {
      if (elements) this.trackedElementsDirty = true;
      this.invalidateLayout();
    }
  }

  private syncObservers(elements: HTMLElement[]): void {
    const ro = this.resizeObserver;
    if (!ro) return;

    const current = new Set<Element>(elements);
    for (const observed of Array.from(this.observedElements)) {
      if (!current.has(observed)) {
        ro.unobserve(observed);
        this.observedElements.delete(observed);
      }
    }
    for (const el of elements) {
      if (!this.observedElements.has(el)) {
        ro.observe(el);
        this.observedElements.add(el);
      }
    }
  }

  private isElementVisible(el: HTMLElement): boolean {
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }

    if (this.debug) this.debug.counters.computedStyles++;
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      parseFloat(style.opacity || '1') <= 0.01
    ) {
      return false;
    }

    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      if (this.debug) this.debug.counters.computedStyles++;
      const pStyle = window.getComputedStyle(parent);
      if (
        pStyle.display === 'none' ||
        pStyle.visibility === 'hidden' ||
        parseFloat(pStyle.opacity || '1') <= 0.01 ||
        (parent.clientHeight === 0 && pStyle.overflow === 'hidden')
      ) {
        return false;
      }
      parent = parent.parentElement;
    }
    return true;
  }

  /**
   * Size the document-space atlas. Width follows the viewport aspect and the
   * existing uniform scale; height covers the whole document. If the page is
   * taller than the GPU's texture limit, reduce the uniform scale (never
   * below the limit) instead of tiling.
   */
  private updateAtlasSize(): void {
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const doc = document.documentElement;
    const body = document.body;
    const docHeight = Math.max(
      vh,
      doc ? doc.scrollHeight || 0 : 0,
      body ? body.scrollHeight || 0 : 0
    );

    const baseScale = this.resolution / Math.max(vw, vh);
    let scale = baseScale;
    let needsW = Math.max(1, Math.round(vw * scale));
    let needsH = Math.max(1, Math.ceil(docHeight * scale));

    const max = this.maxTextureSize || 16384;
    if (needsH > max) {
      scale *= max / needsH;
      needsW = Math.max(1, Math.round(vw * scale));
      needsH = max;
    }
    if (needsW > max) {
      scale *= max / needsW;
      needsH = Math.max(1, Math.ceil(docHeight * scale));
      needsW = max;
    }

    this.docWidth = vw;
    this.docHeight = docHeight;
    this.maskScale = scale;

    if (needsW !== this.canvasW || needsH !== this.canvasH) {
      this.canvasW = needsW;
      this.canvasH = needsH;
      this.canvas.width = this.canvasW;
      this.canvas.height = this.canvasH;
    }
  }

  /**
   * Re-measure every tracked element once and store its lines in document
   * coordinates. This is the only path that reads layout/style/text.
   */
  private rebuildLayout(): void {
    this.layoutDirty = false;
    if (!this.layoutCache) this.layoutCache = new Map();
    if (!this.bitmapCache) this.bitmapCache = new Map();
    if (typeof this.bitmapPixelTotal !== 'number') this.bitmapPixelTotal = 0;
    this.layoutCache.clear();

    this.updateAtlasSize();

    const elements = this.getTrackedElements();
    this.pruneBitmaps();
    const scrollX = window.scrollX || 0;
    const scrollY = window.scrollY || 0;
    const ctx = this.ctx;

    // Reuse a single Range object for all measurements to avoid GC pressure.
    const rangeHelper = document.createRange();

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      const rect = el.getBoundingClientRect();

      // Skip collapsed or zero-dimension elements entirely.
      if (rect.width <= 0 || rect.height <= 0) continue;

      const visible = this.isElementVisible(el);
      const repulsorType = (el.getAttribute('data-text-repulsor') || 'text') as TextMaskRepulsorType;

      if (this.debug && !this.warnedFixedPosition) {
        // The atlas is in document coordinates, so fixed/sticky repulsors
        // would need screen-space entries. None exist on this page today.
        const position = window.getComputedStyle(el).position;
        if (position === 'fixed' || position === 'sticky') {
          this.warnedFixedPosition = true;
          console.warn(
            '[TextMaskManager] position:fixed/sticky text repulsor found; the document-space mask ' +
              'atlas assumes static positioning. Add a screen-space entry for this element.'
          );
        }
      }

      // If this element has child repulsors, let the children render
      // individually with their specific styles.
      if (this.trackedAncestors.has(el)) continue;

      const docRect = {
        x: rect.left + scrollX,
        y: rect.top + scrollY,
        w: rect.width,
        h: rect.height,
      };

      if (!visible) {
        // Keep a lightweight entry so the content signature can notice a
        // visibility transition, but do not measure text for hidden elements.
        this.layoutCache.set(el, {
          el,
          repulsorType,
          textToRender: '',
          fontKey: '',
          fontSize: 0,
          font: '',
          letterSpacing: 0,
          fontVariationSettings: 'normal',
          docRect,
          lines: [],
          bitmapKey: '',
          fontAscent: 0,
          fontDescent: 0,
          visible: false,
        });
        continue;
      }

      if (repulsorType === 'line' || repulsorType === 'card' || repulsorType === 'rect') {
        this.layoutCache.set(el, {
          el,
          repulsorType,
          textToRender: '',
          fontKey: '',
          fontSize: 0,
          font: '',
          letterSpacing: 0,
          fontVariationSettings: 'normal',
          docRect,
          lines: [],
          bitmapKey: '',
          fontAscent: 0,
          fontDescent: 0,
          visible: true,
        });
        continue;
      }

      const explicitText = el.getAttribute('data-repulsor-text');
      const textToRender = (
        explicitText !== null ? explicitText : el.innerText || el.textContent || ''
      ).trim();
      if (!textToRender) continue;

      if (this.debug) this.debug.counters.computedStyles++;
      const font = readFontStyle(window.getComputedStyle(el));
      const fontKey = fontKeyFromStyle(font);
      const fontSpec = fontShorthand(font);

      this.applyCanvasFont(ctx, font);

      // Measure font ascent/descent for alphabetic → centered-in-line-box
      // baseline shift. fontBoundingBoxAscent/Descent are the full em-box
      // metrics (preferred); actualBoundingBox* are the ink bounds (fallback).
      const probe = ctx.measureText('Mg|');
      const fontAscent =
        (probe as unknown as { fontBoundingBoxAscent?: number }).fontBoundingBoxAscent ??
        (probe as unknown as { actualBoundingBoxAscent?: number }).actualBoundingBoxAscent ??
        0;
      const fontDescent =
        (probe as unknown as { fontBoundingBoxDescent?: number }).fontBoundingBoxDescent ??
        (probe as unknown as { actualBoundingBoxDescent?: number }).actualBoundingBoxDescent ??
        0;

      // Collect exact per-line text + positions via DOM Range measurements.
      const viewportLines = this.collectLines(el, ctx, rangeHelper, fontAscent, fontDescent);
      const lines: TextMaskLineLayout[] = viewportLines.map((line) => ({
        text: line.text,
        x: line.x + scrollX,
        y: line.y + scrollY,
      }));

      const bitmapKey = [
        window.innerWidth,
        window.innerHeight,
        this.canvasW,
        this.canvasH,
        fontKey,
        docRect.w,
        docRect.h,
        lines.map((line) => `${line.x},${line.y},${line.text}`).join('|'),
      ].join('~');

      this.layoutCache.set(el, {
        el,
        repulsorType,
        textToRender,
        fontKey,
        fontSize: font.fontSize,
        font: fontSpec,
        letterSpacing: font.letterSpacing,
        fontVariationSettings: font.fontVariationSettings,
        docRect,
        lines,
        bitmapKey,
        fontAscent,
        fontDescent,
        visible: true,
      });
    }

    this.syncObservers(elements);
  }

  private applyCanvasFont(ctx: CanvasRenderingContext2D, font: TextMaskFontStyle): void {
    this.applyCanvasTextSettings(ctx, font.letterSpacing, font.fontVariationSettings);
    ctx.font = fontShorthand(font);
  }

  private applyCanvasTextSettings(
    ctx: CanvasRenderingContext2D,
    letterSpacing: number,
    fontVariationSettings: string
  ): void {
    // Handle letter-spacing if supported on canvas. Always assign (including
    // '0px') because the 2D context is reused across elements and across
    // rasterize passes. Setting it only when non-zero would leak a previous
    // element's tracking into later, untracked text.
    try {
      if ('letterSpacing' in ctx) {
        (ctx as unknown as { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
      }
    } catch {
      // Fallback gracefully
    }

    // Handle variable font axes if supported on canvas 2D context.
    try {
      if ('fontVariationSettings' in ctx) {
        (ctx as unknown as { fontVariationSettings: string }).fontVariationSettings =
          fontVariationSettings && fontVariationSettings !== 'normal'
            ? fontVariationSettings
            : 'normal';
      }
    } catch {
      // Fallback gracefully
    }
  }

  /**
   * Collect all text lines to draw for a given element, using DOM Range measurements
   * to locate the exact screen position of each wrapped line.
   *
   * Strategy:
   *   - Walk every text node inside the element via TreeWalker.
   *   - For single-line text nodes (one clientRect) use that rect directly.
   *   - For multi-line text nodes, binary-search the character offset where
   *     each line starts using the node's line rects, then reconstruct the
   *     line text. The old per-character scan remains as a fallback for
   *     bidi/zero-width/pre-formatted text where the search is ambiguous.
   *   - Compute the canvas alphabetic baseline y so glyphs are centered inside
   *     their DOM line box: y = lineRect.top + lineRect.height/2 + (ascent–descent)/2
   *
   * This is far more accurate than the old approach of rect.top + l*lineHeight
   * because it uses the browser's own layout geometry instead of re-simulating it.
   */
  private collectLines(
    el: HTMLElement,
    _ctx: CanvasRenderingContext2D,
    rangeHelper: Range,
    fontAscent: number,
    fontDescent: number
  ): { text: string; x: number; y: number }[] {
    const lines: { text: string; x: number; y: number }[] = [];
    const baselineShift = (fontAscent - fontDescent) * 0.5; // centers glyphs in the line box

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    if (this.debug) this.debug.counters.treeWalkers++;
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const rawText = textNode.textContent ?? '';
      if (!rawText.trim()) continue;

      rangeHelper.selectNode(textNode);
      if (this.debug) this.debug.counters.rangeClientRects++;
      const lineRects = Array.from(rangeHelper.getClientRects()) as unknown as RectLike[];

      if (lineRects.length === 0) continue;

      if (lineRects.length === 1) {
        // Single-line node: use its rect directly.
        const r = lineRects[0];
        const y = r.top + r.height * 0.5 + baselineShift;
        lines.push({ text: rawText.trim(), x: r.left, y });
        continue;
      }

      const fast = PER_CHARACTER_FALLBACK_RE.test(rawText)
        ? null
        : this.collectLinesBinary(textNode, rawText, lineRects, rangeHelper, baselineShift);

      if (fast) {
        lines.push(...fast);
      } else {
        lines.push(
          ...this.collectLinesPerCharacter(
            textNode,
            rawText,
            rangeHelper,
            baselineShift
          )
        );
      }
    }

    return lines;
  }

  /**
   * Binary-search line boundaries using the node's line rects. Returns `null`
   * when the geometry is ambiguous so the caller can use the exact
   * per-character scan.
   */
  private collectLinesBinary(
    textNode: Text,
    rawText: string,
    lineRects: RectLike[],
    rangeHelper: Range,
    baselineShift: number
  ): { text: string; x: number; y: number }[] | null {
    const measure = (index: number): RectLike => {
      rangeHelper.setStart(textNode, index);
      rangeHelper.setEnd(textNode, Math.min(index + 1, rawText.length));
      if (this.debug) this.debug.counters.rangeBoundingRects++;
      return rangeHelper.getBoundingClientRect() as unknown as RectLike;
    };

    const isMeasured = (r: RectLike) => r.width !== 0 || r.height !== 0;

    const firstMeasured = (from: number): { index: number; rect: RectLike } | null => {
      for (let c = from; c < rawText.length; c++) {
        const r = measure(c);
        if (isMeasured(r)) return { index: c, rect: r };
      }
      return null;
    };

    const lines: { text: string; x: number; y: number }[] = [];
    let cursor = 0;

    for (let li = 0; li < lineRects.length; li++) {
      const lineTop = lineRects[li].top;
      const first = firstMeasured(cursor);
      if (!first) break;
      // The first measurable character must sit on this line box.
      if (Math.abs(first.rect.top - lineTop) > 6) return null;

      let end = rawText.length;
      if (li < lineRects.length - 1) {
        const nextTop = lineRects[li + 1].top;

        // First offset whose character belongs to the next line box.
        let lo = first.index + 1;
        let hi = rawText.length;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          const r = measure(mid);
          const after = isMeasured(r) && r.top >= nextTop - 6;
          if (after) hi = mid;
          else lo = mid + 1;
        }
        if (lo >= rawText.length) return null;

        // A zero-size character (trailing space) can break monotonicity;
        // walk back over measurable characters that belong to the next line.
        let boundary = lo;
        while (boundary > first.index + 1) {
          const prev = measure(boundary - 1);
          if (!isMeasured(prev) || Math.abs(prev.top - nextTop) > 6) break;
          boundary--;
        }

        const boundaryRect = measure(boundary);
        if (!isMeasured(boundaryRect) || Math.abs(boundaryRect.top - nextTop) > 6) {
          return null;
        }
        end = boundary;
      }

      let height = first.rect.height;
      if (end > first.index + 1) {
        const last = measure(end - 1);
        if (isMeasured(last) && last.height > height) height = last.height;
      }

      const text = rawText.slice(first.index, end).trim();
      if (text) {
        lines.push({
          text,
          x: first.rect.left,
          y: first.rect.top + height * 0.5 + baselineShift,
        });
      }

      cursor = end;
      if (cursor >= rawText.length) break;
    }

    return lines.length > 0 ? lines : null;
  }

  /** Exact legacy scan: one `getBoundingClientRect` per character. */
  private collectLinesPerCharacter(
    textNode: Text,
    rawText: string,
    rangeHelper: Range,
    baselineShift: number
  ): { text: string; x: number; y: number }[] {
    const lines: { text: string; x: number; y: number }[] = [];
    let currentLine = '';
    let currentRect: { top: number; left: number; right: number; height: number } | null = null;
    let lastTop: number | null = null;

    const pushLine = () => {
      if (currentLine.trim() && currentRect) {
        const y = currentRect.top + currentRect.height * 0.5 + baselineShift;
        lines.push({ text: currentLine.trim(), x: currentRect.left, y });
      }
    };

    for (let c = 0; c < rawText.length; c++) {
      rangeHelper.setStart(textNode, c);
      rangeHelper.setEnd(textNode, c + 1);
      if (this.debug) this.debug.counters.rangeBoundingRects++;
      const r = rangeHelper.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;

      if (lastTop === null || Math.abs(r.top - lastTop) > 6) {
        pushLine();
        currentLine = rawText[c];
        currentRect = { top: r.top, left: r.left, right: r.right, height: r.height };
        lastTop = r.top;
      } else {
        currentLine += rawText[c];
        currentRect!.right = r.right;
        currentRect!.height = Math.max(currentRect!.height, r.height);
      }
    }
    pushLine();

    return lines;
  }

  private pruneBitmaps(): void {
    for (const el of Array.from(this.bitmapCache.keys())) {
      if (!this.trackedSet.has(el)) {
        const cached = this.bitmapCache.get(el);
        if (cached) this.bitmapPixelTotal -= cached.pixels;
        this.bitmapCache.delete(el);
      }
    }
  }

  private trimBitmapCache(): void {
    const maxEntries = TextMaskManager.MAX_BITMAP_ENTRIES;
    const maxPixels = TextMaskManager.MAX_BITMAP_PIXELS;
    while (
      this.bitmapCache.size > maxEntries ||
      (this.bitmapPixelTotal > maxPixels && this.bitmapCache.size > 1)
    ) {
      const oldest = this.bitmapCache.keys().next().value as HTMLElement | undefined;
      if (!oldest) break;
      const cached = this.bitmapCache.get(oldest);
      if (cached) this.bitmapPixelTotal -= cached.pixels;
      this.bitmapCache.delete(oldest);
    }
  }

  private getTextBitmap(
    entry: TextMaskLayoutEntry
  ): {
    canvas: HTMLCanvasElement;
    originX: number;
    originY: number;
    scale: number;
    superSample: number;
    width: number;
    height: number;
    outerBlur: number;
    coreBlur: number;
  } | null {
    const key = entry.bitmapKey;
    const cached = this.bitmapCache.get(entry.el);
    if (cached && cached.key === key) {
      // LRU: move to the end of insertion order.
      this.bitmapCache.delete(entry.el);
      this.bitmapCache.set(entry.el, cached);
      if (this.debug) this.debug.counters.bitmapCacheHits++;
      return cached;
    }

    if (cached) {
      this.bitmapPixelTotal -= cached.pixels;
      this.bitmapCache.delete(entry.el);
    }

    const built = this.buildTextBitmap(entry);
    if (!built) return null;

    this.bitmapCache.set(entry.el, { key, ...built });
    this.bitmapPixelTotal += built.pixels;
    if (this.debug) this.debug.counters.bitmapBuilds++;
    this.trimBitmapCache();
    return built;
  }

  /**
   * Render the exact two blurred passes for one element into an offscreen
   * transparent canvas. The bounds are the union of the element box and the
   * measured ink boxes of its lines, expanded by >= 3× the outer blur so the
   * halo is not clipped. Drawing this bitmap with source-over is equivalent
   * to drawing the halo and core passes directly (source-over is associative).
   */
  private buildTextBitmap(entry: TextMaskLayoutEntry): {
    canvas: HTMLCanvasElement;
    originX: number;
    originY: number;
    scale: number;
    superSample: number;
    width: number;
    height: number;
    outerBlur: number;
    coreBlur: number;
    pixels: number;
  } | null {
    if (entry.lines.length === 0) return null;

    const fontSize = entry.fontSize || 28;
    const outerBlur = Math.min(8, Math.max(3, fontSize * 0.12));
    const coreBlur = Math.min(2.5, Math.max(1, fontSize * 0.04));
    const scale = this.canvasW / (window.innerWidth || 1);

    // Measure ink bounds with the main context (measureText ignores transform).
    const mctx = this.ctx;
    this.applyCanvasTextSettings(mctx, entry.letterSpacing, entry.fontVariationSettings);
    mctx.font = entry.font;

    let minX = entry.docRect.x;
    let minY = entry.docRect.y;
    let maxX = entry.docRect.x + entry.docRect.w;
    let maxY = entry.docRect.y + entry.docRect.h;

    for (const line of entry.lines) {
      const metrics = mctx.measureText(line.text) as TextMetrics & {
        actualBoundingBoxLeft?: number;
        actualBoundingBoxRight?: number;
        actualBoundingBoxAscent?: number;
        actualBoundingBoxDescent?: number;
      };
      const left = metrics.actualBoundingBoxLeft ?? 0;
      const right = metrics.actualBoundingBoxRight ?? metrics.width;
      const ascent = metrics.actualBoundingBoxAscent ?? entry.fontAscent;
      const descent = metrics.actualBoundingBoxDescent ?? entry.fontDescent;
      minX = Math.min(minX, line.x - left);
      maxX = Math.max(maxX, line.x + right);
      minY = Math.min(minY, line.y - ascent);
      maxY = Math.max(maxY, line.y + descent);
    }

    // Pre-blur both passes into a 2× supersampled device-space bitmap.
    // Downscaling an already-smooth bitmap at composite time keeps fractional
    // scroll offsets close to direct subpixel rasterization, while scroll
    // itself does no fillText.
    const superSample = 1;
    const pad = Math.min(24, Math.max(8, Math.ceil(outerBlur * 3)));
    const padDev = Math.max(1, Math.ceil(pad * scale));
    const originX = Math.floor(minX * scale) - padDev;
    const originY = Math.floor(minY * scale) - padDev;
    const width = Math.ceil(maxX * scale) + padDev - originX;
    const height = Math.ceil(maxY * scale) + padDev - originY;
    if (width <= 0 || height <= 0 || width > 2048 || height > 2048) return null;

    const canvas = document.createElement('canvas');
    canvas.width = width * superSample;
    canvas.height = height * superSample;
    const bctx = canvas.getContext('2d', { alpha: true });
    if (!bctx) return null;

    const hiScale = scale * superSample;
    bctx.setTransform(
      hiScale,
      0,
      0,
      hiScale,
      -originX * superSample,
      -originY * superSample
    );
    bctx.textBaseline = 'alphabetic';
    bctx.textAlign = 'left';
    this.applyCanvasTextSettings(bctx, entry.letterSpacing, entry.fontVariationSettings);
    bctx.font = entry.font;

    const drawLines = () => {
      for (const line of entry.lines) {
        bctx.fillText(line.text, line.x, line.y);
      }
    };

    // Pass 1: Outer smooth subtle halo
    bctx.filter = `blur(${(outerBlur * superSample).toFixed(1)}px)`;
    bctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    drawLines();

    // Pass 2: Tight core letter contour
    bctx.filter = `blur(${(coreBlur * superSample).toFixed(1)}px)`;
    bctx.fillStyle = '#ffffff';
    drawLines();

    bctx.filter = 'none';

    return {
      canvas,
      originX,
      originY,
      scale,
      superSample,
      width,
      height,
      outerBlur,
      coreBlur,
      pixels: canvas.width * canvas.height,
    };
  }

  private drawLayout(): void {
    const ctx = this.ctx;
    const scale = this.maskScale;

    // Reset transform to paint full black background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    // Uniform scale: both axes use the same factor so text is not distorted.
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const entries = this.layoutCache ? Array.from(this.layoutCache.values()) : [];

    // Two passes so a `hole` always cuts through whatever was painted before
    // it, regardless of DOM order: solids first, then the cutouts.
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].repulsorType !== 'hole') this.drawEntry(entries[i], scale);
    }
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].repulsorType === 'hole') this.drawEntry(entries[i], scale);
    }

    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';
    this.markTextureDirty();
  }

  /**
   * Paint one layout entry into the mask atlas. Callers set
   * `globalCompositeOperation` (`source-over` for solids, `destination-out`
   * for holes) before the pass that contains this entry.
   */
  private drawEntry(entry: TextMaskLayoutEntry, scale: number): void {
    if (!entry.visible) return;

    const ctx = this.ctx;
    const rect = {
      left: entry.docRect.x,
      top: entry.docRect.y,
      width: entry.docRect.w,
      height: entry.docRect.h,
    };

    if (entry.repulsorType === 'line') {
      const height = Math.max(rect.height, 2);
      ctx.filter = 'blur(6px)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fillRect(rect.left, rect.top, rect.width, height);

      ctx.filter = 'blur(1.5px)';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(rect.left, rect.top, rect.width, height);
      return;
    }

    if (entry.repulsorType === 'card' || entry.repulsorType === 'rect') {
      const radius = entry.repulsorType === 'card' ? 12 : 0;
      // Draw blurred card silhouette
      ctx.filter = 'blur(16px)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.beginPath();
      ctx.roundRect(rect.left, rect.top, rect.width, rect.height, radius);
      ctx.fill();

      ctx.filter = 'blur(4px)';
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(rect.left, rect.top, rect.width, rect.height, radius);
      ctx.fill();
      return;
    }

    if (entry.lines.length === 0) return;

    const bitmap = this.getTextBitmap(entry);
    if (bitmap) {
      // Composite in device pixels; the cached bitmap is already blurred.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.filter = 'none';
      ctx.drawImage(
        bitmap.canvas,
        bitmap.originX,
        bitmap.originY,
        bitmap.width,
        bitmap.height
      );
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      return;
    }

    // Fallback: draw the two passes directly if an offscreen bitmap could
    // not be created (e.g. an element larger than the bitmap size cap).

    // Always draw left-aligned at the exact per-line X position from DOM Range.
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    this.applyCanvasTextSettings(ctx, entry.letterSpacing, entry.fontVariationSettings);
    ctx.font = entry.font;

    // Subtle, tight blur sizes right around the letters (no giant black blobs)
    const fontSize = entry.fontSize || 28;
    const outerBlur = Math.min(8, Math.max(3, fontSize * 0.12));
    const coreBlur = Math.min(2.5, Math.max(1, fontSize * 0.04));

    // Pass 1: Outer smooth subtle halo
    ctx.filter = `blur(${outerBlur.toFixed(1)}px)`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (const line of entry.lines) {
      if (this.debug) this.debug.counters.fillTextCalls++;
      ctx.fillText(line.text, line.x, line.y);
    }

    // Pass 2: Tight core letter contour
    ctx.filter = `blur(${coreBlur.toFixed(1)}px)`;
    ctx.fillStyle = '#ffffff';
    for (const line of entry.lines) {
      if (this.debug) this.debug.counters.fillTextCalls++;
      ctx.fillText(line.text, line.x, line.y);
    }
  }

  /**
   * Cheap signature of the mask's visual inputs (viewport/atlas size,
   * per-element type, visibility, document rect, font, text, and line
   * positions). Layout invalidations that leave this unchanged skip the draw
   * and upload.
   */
  private computeLayoutSignature(): string {
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const parts = [`${vw}x${vh}`, `${this.canvasW}x${this.canvasH}`];

    if (this.layoutCache) {
      for (const entry of this.layoutCache.values()) {
        parts.push(
          `${entry.repulsorType}|${entry.visible ? 1 : 0}|` +
            `${entry.docRect.x},${entry.docRect.y},${entry.docRect.w},${entry.docRect.h}|` +
            `${entry.fontKey}|${entry.textToRender}`
        );
        for (const line of entry.lines) {
          parts.push(`${line.x},${line.y},${line.text}`);
        }
      }
    }

    return parts.join('\n');
  }

  public rasterizeText(): void {
    if (this.isDestroyed) return;
    // The atlas is document-space: once built, scrolling does not change it.
    if (!this.layoutDirty && this.layoutCache) return;

    const debugStart = this.debug ? performance.now() : 0;
    let drew = false;
    try {
      const layoutStart = this.debug ? performance.now() : 0;
      this.rebuildLayout();
      if (this.debug) {
        const layoutDuration = performance.now() - layoutStart;
        this.debug.counters.layoutCount++;
        this.debug.counters.layoutMsLast = layoutDuration;
        this.debug.counters.layoutMsTotal += layoutDuration;
      }

      const signature = this.computeLayoutSignature();
      if (signature === this.lastLayoutSignature) {
        if (this.debug) this.debug.counters.signatureSkips++;
        return;
      }
      this.lastLayoutSignature = signature;

      const drawStart = this.debug ? performance.now() : 0;
      this.drawLayout();
      drew = true;
      if (this.debug) {
        const drawDuration = performance.now() - drawStart;
        this.debug.counters.drawCount++;
        this.debug.counters.drawMsLast = drawDuration;
        this.debug.counters.drawMsTotal += drawDuration;
      }
    } finally {
      if (this.debug && drew) {
        const duration = performance.now() - debugStart;
        this.debug.counters.rasterizations++;
        this.debug.counters.rasterizeMsLast = duration;
        this.debug.counters.rasterizeMsTotal += duration;
      }
    }
  }

  /** Bytes per texel in the uploaded mask texture (R8 after Phase 5). */
  public get bytesPerPixel(): number {
    return this.texture.format === THREE.RedFormat ? 1 : 4;
  }

  private markTextureDirty(): void {
    this.texture.needsUpdate = true;
    if (this.debug) {
      this.debug.counters.uploadRequests++;
      this.debug.counters.uploadBytes += this.canvasW * this.canvasH * this.bytesPerPixel;
    }
  }

  public getBitmapStats(): { entries: number; pixels: number } {
    return {
      entries: this.bitmapCache ? this.bitmapCache.size : 0,
      pixels: this.bitmapPixelTotal || 0,
    };
  }

  /**
   * Dev-only: downsample the mask into a canonical screen-space grayscale
   * image so the parity harness can diff "what the shader samples" across
   * implementations (viewport canvas now, document atlas later).
   */
  public sampleScreenMask(
    width: number,
    height: number
  ): { width: number; height: number; data: string } {
    const sample = document.createElement('canvas');
    sample.width = Math.max(1, Math.round(width));
    sample.height = Math.max(1, Math.round(height));
    const sctx = sample.getContext('2d', { willReadFrequently: true, alpha: false });
    if (!sctx) return { width: sample.width, height: sample.height, data: '' };

    sctx.fillStyle = '#000000';
    sctx.fillRect(0, 0, sample.width, sample.height);
    sctx.imageSmoothingEnabled = true;

    // The atlas is document-space; sample the current viewport region.
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;
    const scale = this.maskScale || this.canvasW / vw;
    const sx = (window.scrollX || 0) * scale;
    const sy = (window.scrollY || 0) * scale;
    const sw = Math.max(1, Math.min(this.canvasW - sx, vw * scale));
    const sh = Math.max(1, Math.min(this.canvasH - sy, vh * scale));
    sctx.drawImage(this.canvas, sx, sy, sw, sh, 0, 0, sample.width, sample.height);

    const pixels = sctx.getImageData(0, 0, sample.width, sample.height).data;
    const gray = new Uint8Array(sample.width * sample.height);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = pixels[p];
    }

    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < gray.length; i += chunk) {
      binary += String.fromCharCode(...gray.subarray(i, i + chunk));
    }

    return {
      width: sample.width,
      height: sample.height,
      data: btoa(binary),
    };
  }

  public dispose(): void {
    this.isDestroyed = true;
    if (this.dirtyRafId !== 0) {
      cancelAnimationFrame(this.dirtyRafId);
      this.dirtyRafId = 0;
    }
    window.removeEventListener('resize', this.boundOnResize);
    window.removeEventListener('chladni:refresh-text-mask', this.boundOnCustomRefresh);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
    this.observedElements.clear();
    if (this.bitmapCache) this.bitmapCache.clear();
    this.bitmapPixelTotal = 0;
    detachTextMaskDebug(this.debug);
    this.debug = null;
    this.texture.dispose();
  }
}

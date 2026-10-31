import * as THREE from 'three';

export interface TextMaskManagerOptions {
  resolution?: number; // default 1024
  trackedSelector?: string; // default '[data-text-repulsor]'
  strength?: number; // default 0.022
}

export class TextMaskManager {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  public strength: number;
  public active: boolean = true;
  public resolution: number;

  private trackedSelector: string;
  private dirty: boolean = true;
  private lastScrollY: number = -999999;
  private lastUpdateTime: number = 0;
  private resizeObserver: ResizeObserver | null = null;
  private boundOnScroll: () => void;
  private boundOnResize: () => void;
  private isDestroyed: boolean = false;

  // Canvas dimensions are kept proportional to the viewport aspect ratio
  // so that scaleX === scaleY (uniform scale), avoiding text distortion.
  public canvasW: number;
  public canvasH: number;

  constructor(options: TextMaskManagerOptions = {}) {
    this.resolution = options.resolution || 1024;
    this.trackedSelector = options.trackedSelector || '[data-text-repulsor]';
    this.strength = options.strength ?? 0.022;

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
    if (typeof window !== 'undefined') {
      (window as any).__maskCanvas = this.canvas;
    }

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

    this.boundOnScroll = () => {
      const sy = window.scrollY;
      if (Math.abs(sy - this.lastScrollY) >= 1) {
        this.dirty = true;
        this.lastScrollY = sy;
      }
    };

    this.boundOnResize = () => {
      this.dirty = true;
    };

    window.addEventListener('scroll', this.boundOnScroll, { passive: true });
    window.addEventListener('resize', this.boundOnResize, { passive: true });

    // Ensure fonts are ready before rasterizing
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        if (!this.isDestroyed) {
          this.dirty = true;
        }
      });
    }

    // Catch post-mount layout shifts as styles and flexbox settle
    [50, 150, 300, 600, 1000, 2000].forEach(delay => {
      setTimeout(() => {
        if (!this.isDestroyed) {
          this.dirty = true;
        }
      }, delay);
    });

    // Set up ResizeObserver to catch layout shifts
    try {
      this.resizeObserver = new ResizeObserver(() => {
        this.dirty = true;
      });
      this.resizeObserver.observe(document.body);
    } catch {
      // Ignore if ResizeObserver is not supported
    }

    // Initial render
    this.rasterizeText();
  }

  public setDirty(): void {
    this.dirty = true;
  }

  public update(now: number, force = false): boolean {
    if (this.isDestroyed || !this.active) return false;

    // Throttle mask updates to ~35fps during fast scrolling, 0fps when stationary
    if (!force && (!this.dirty || now - this.lastUpdateTime < 28)) {
      return false;
    }

    this.dirty = false;
    this.lastUpdateTime = now;
    this.rasterizeText();
    return true;
  }

  /**
   * Collect all text lines to draw for a given element, using DOM Range measurements
   * to locate the exact screen position of each wrapped line.
   *
   * Strategy:
   *   - Walk every text node inside the element via TreeWalker.
   *   - For single-line text nodes (one clientRect) use that rect directly.
   *   - For multi-line text nodes, scan character-by-character to find where
   *     the browser wrapped, recording each line's actual bounding rect.
   *   - Compute the canvas alphabetic baseline y so glyphs are centered inside
   *     their DOM line box: y = lineRect.top + lineRect.height/2 + (ascent–descent)/2
   *
   * This is far more accurate than the old approach of rect.top + l*lineHeight
   * because it uses the browser's own layout geometry instead of re-simulating it.
   */
  private collectLines(
    el: HTMLElement,
    ctx: CanvasRenderingContext2D,
    rangeHelper: Range,
    fontAscent: number,
    fontDescent: number,
  ): { text: string; x: number; y: number }[] {
    const lines: { text: string; x: number; y: number }[] = [];
    const baselineShift = (fontAscent - fontDescent) * 0.5; // centers glyphs in the line box

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const textNode = node as Text;
      const rawText = textNode.textContent ?? '';
      if (!rawText.trim()) continue;

      rangeHelper.selectNode(textNode);
      const lineRects = Array.from(rangeHelper.getClientRects());

      if (lineRects.length === 0) continue;

      if (lineRects.length === 1) {
        // Single-line node: use its rect directly.
        const r = lineRects[0];
        const y = r.top + r.height * 0.5 + baselineShift;
        lines.push({ text: rawText.trim(), x: r.left, y });
        continue;
      }

      // Multi-line node: walk characters to find line-break boundaries.
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
    }

    return lines;
  }

  public rasterizeText(): void {
    if (this.isDestroyed) return;

    const ctx = this.ctx;
    const vw = window.innerWidth || 1;
    const vh = window.innerHeight || 1;

    // Recompute canvas dimensions if the viewport aspect ratio has changed.
    // This ensures a uniform scale factor (scaleX === scaleY) so that text
    // drawn on the canvas is not stretched or squished relative to the DOM.
    const aspect = vw / vh;
    let needsW: number;
    let needsH: number;
    if (aspect >= 1) {
      needsW = this.resolution;
      needsH = Math.round(this.resolution / aspect);
    } else {
      needsH = this.resolution;
      needsW = Math.round(this.resolution * aspect);
    }
    if (needsW !== this.canvasW || needsH !== this.canvasH) {
      this.canvasW = needsW;
      this.canvasH = needsH;
      this.canvas.width = this.canvasW;
      this.canvas.height = this.canvasH;
    }

    const W = this.canvasW;
    const H = this.canvasH;

    // Reset transform to paint full black background
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none';
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // Uniform scale: both axes use the same factor so text is not distorted.
    // W/vw == H/vh because we sized the canvas to match the viewport aspect ratio.
    const scale = W / vw; // == H / vh
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    const elements = document.querySelectorAll(this.trackedSelector);
    if (!elements || elements.length === 0) {
      this.texture.needsUpdate = true;
      return;
    }

    // Reuse a single Range object for all measurements to avoid GC pressure.
    const rangeHelper = document.createRange();

    for (let i = 0; i < elements.length; i++) {
      const el = elements[i] as HTMLElement;
      const rect = el.getBoundingClientRect();

      // Skip elements that are completely outside the visible screen viewport
      if (rect.bottom < -40 || rect.top > vh + 40 || rect.right < -40 || rect.left > vw + 40) {
        continue;
      }

      // If this element has child repulsors, let the children render individually with their specific styles
      if (el.querySelector(this.trackedSelector)) {
        continue;
      }

      // Check if element specifies a card/pill shape or line or exact text
      const repulsorType = el.getAttribute('data-text-repulsor');

      if (repulsorType === 'line') {
        const height = Math.max(rect.height, 2);
        ctx.filter = 'blur(6px)';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(rect.left, rect.top, rect.width, height);

        ctx.filter = 'blur(1.5px)';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(rect.left, rect.top, rect.width, height);
        continue;
      }

      if (repulsorType === 'card' || repulsorType === 'pill') {
        const radius = repulsorType === 'pill' ? rect.height * 0.5 : 12;
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
        continue;
      }

      const explicitText = el.getAttribute('data-repulsor-text');
      const textToRender = (explicitText !== null ? explicitText : el.innerText || el.textContent || '').trim();
      if (!textToRender) continue;

      const style = window.getComputedStyle(el);
      const fontSize = parseFloat(style.fontSize) || 28;
      const fontWeight = style.fontWeight || '700';
      const fontFamily = style.fontFamily || 'system-ui, -apple-system, sans-serif';
      const fontStyle = style.fontStyle || 'normal';
      const letterSpacing = parseFloat(style.letterSpacing) || 0;

      // Always draw left-aligned at the exact per-line X position from DOM Range.
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';

      // Handle letter-spacing if supported on canvas
      try {
        if ('letterSpacing' in ctx && letterSpacing !== 0) {
          (ctx as any).letterSpacing = `${letterSpacing}px`;
        }
      } catch {
        // Fallback gracefully
      }

      // Handle variable font axes if supported on canvas 2D context
      try {
        const fvs = (style as any).fontVariationSettings || style.getPropertyValue('font-variation-settings');
        if ('fontVariationSettings' in ctx) {
          if (fvs && fvs !== 'normal') {
            (ctx as any).fontVariationSettings = fvs;
          } else {
            (ctx as any).fontVariationSettings = 'normal';
          }
        }
      } catch {
        // Fallback gracefully
      }

      ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;

      // Measure font ascent/descent for alphabetic → centered-in-line-box baseline shift.
      // fontBoundingBoxAscent/Descent are the full em-box metrics (preferred).
      // actualBoundingBoxAscent/Descent are the tightest ink-bounds (fallback).
      const probe = ctx.measureText('Mg|');
      const fontAscent =
        (probe as any).fontBoundingBoxAscent ?? probe.actualBoundingBoxAscent;
      const fontDescent =
        (probe as any).fontBoundingBoxDescent ?? probe.actualBoundingBoxDescent;

      // Collect exact per-line text + positions via DOM Range measurements.
      const lines = this.collectLines(el, ctx, rangeHelper, fontAscent, fontDescent);
      if (lines.length === 0) continue;

      // Subtle, tight blur sizes right around the letters (no giant black blobs)
      const outerBlur = Math.min(8, Math.max(3, fontSize * 0.12));
      const coreBlur = Math.min(2.5, Math.max(1, fontSize * 0.04));

      // Pass 1: Outer smooth subtle halo
      ctx.filter = `blur(${outerBlur.toFixed(1)}px)`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      for (const line of lines) {
        ctx.fillText(line.text, line.x, line.y);
      }

      // Pass 2: Tight core letter contour
      ctx.filter = `blur(${coreBlur.toFixed(1)}px)`;
      ctx.fillStyle = '#ffffff';
      for (const line of lines) {
        ctx.fillText(line.text, line.x, line.y);
      }
    }

    ctx.filter = 'none';
    this.texture.needsUpdate = true;
  }

  public dispose(): void {
    this.isDestroyed = true;
    window.removeEventListener('scroll', this.boundOnScroll);
    window.removeEventListener('resize', this.boundOnResize);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.texture.dispose();
  }
}

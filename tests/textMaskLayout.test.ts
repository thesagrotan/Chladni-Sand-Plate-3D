// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TextMaskManager } from '../src/utils/TextMaskManager.ts';

interface FakeRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

function rect(top: number, left: number, width: number, height = 20): FakeRect {
  return { top, left, right: left + width, bottom: top + height, width, height };
}

class FakeRange {
  private selected: Node | null = null;
  private start = 0;
  private rectsByNode = new Map<Node, FakeRect[]>();
  private charRects: (FakeRect | null)[] = [];

  setNodeRects(node: Node, rects: FakeRect[]) {
    this.rectsByNode.set(node, rects);
  }

  setCharRects(rects: (FakeRect | null)[]) {
    this.charRects = rects;
  }

  selectNode(node: Node) {
    this.selected = node;
  }

  getClientRects(): FakeRect[] {
    return this.selected ? this.rectsByNode.get(this.selected) ?? [] : [];
  }

  setStart(_node: Node, offset: number) {
    this.start = offset;
  }

  setEnd(_node: Node, _offset: number) {
    // no-op
  }

  getBoundingClientRect(): FakeRect {
    return this.charRects[this.start] ?? rect(0, 0, 0, 0);
  }
}

function manager() {
  return Object.create(TextMaskManager.prototype) as TextMaskManager;
}

function collect(el: HTMLElement, range: FakeRange, ascent = 16, descent = 4) {
  return (
    manager() as unknown as {
      collectLines: (
        el: HTMLElement,
        ctx: CanvasRenderingContext2D,
        range: Range,
        ascent: number,
        descent: number
      ) => { text: string; x: number; y: number }[];
    }
  ).collectLines(el, {} as CanvasRenderingContext2D, range as unknown as Range, ascent, descent);
}

function collectPerCharacter(el: HTMLElement, range: FakeRange, ascent = 16, descent = 4) {
  return (
    manager() as unknown as {
      collectLinesPerCharacter: (
        node: Text,
        rawText: string,
        range: Range,
        baselineShift: number
      ) => { text: string; x: number; y: number }[];
    }
  ).collectLinesPerCharacter(
    el.firstChild as Text,
    el.textContent ?? '',
    range as unknown as Range,
    (ascent - descent) * 0.5
  );
}

/** Build character rects aligned to raw-text indices for explicit lines. */
function layoutLines(
  text: string,
  lines: string[],
  tops: number[],
  lefts: number[],
  charWidth = 10,
  height = 20
): FakeRect[] {
  const out: FakeRect[] = new Array(text.length);
  let raw = 0;
  lines.forEach((line, lineIndex) => {
    for (let i = 0; i < line.length; i++) {
      out[raw++] = rect(tops[lineIndex], lefts[lineIndex] + i * charWidth, charWidth, height);
    }
    // The space at a soft wrap belongs to the end of the previous line.
    if (lineIndex < lines.length - 1 && text[raw] === ' ') {
      out[raw++] = rect(
        tops[lineIndex],
        lefts[lineIndex] + line.length * charWidth,
        charWidth,
        height
      );
    }
  });
  return out;
}

function paragraphLines(text: string, charsPerLine: number, top = 100): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > charsPerLine && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

describe('TextMaskManager binary line search', () => {
  const pageStrings = [
    'TEZETT PLATTE is a Berlin label and recording studio',
    'Releases',
    'Klanglabor Berlin · Kreuzberg',
    'The quick brown fox jumps over the lazy dog, then it keeps running past the river.',
    'No. 004 — 2024 — 12" vinyl, gatefold sleeve, limited to 300 copies',
    'Aeonik Fono — Between the nodal lines the sand gathers into quiet ridges and stays there',
  ];

  it.each(pageStrings)('matches the per-character scan for %s', (text) => {
    const el = document.createElement('div');
    const node = document.createTextNode(text);
    el.appendChild(node);

    const lines = paragraphLines(text, 18);
    const tops = lines.map((_line, i) => 100 + i * 20);
    const lefts = lines.map((_line, i) => 10 + (i % 2) * 4);
    const charRects = layoutLines(text, lines, tops, lefts);
    // The concatenated line texts must reconstruct the source exactly.
    expect(lines.join(' ')).toBe(text);

    const range = new FakeRange();
    range.setNodeRects(
      node,
      lines.map((line, i) => rect(tops[i], lefts[i], line.length * 10))
    );
    range.setCharRects(charRects);

    const fast = collect(el, range);
    const exact = collectPerCharacter(el, range);
    expect(fast).toEqual(exact);
  });

  it('preserves leading indentation position while trimming the line text', () => {
    const el = document.createElement('div');
    const text = '  indented line one and line two';
    const node = document.createTextNode(text);
    el.appendChild(node);

    const range = new FakeRange();
    range.setNodeRects(node, [rect(100, 30, 120), rect(120, 50, 80)]);
    range.setCharRects(
      layoutLines(text, ['  indented line', 'one and line two'], [100, 120], [30, 50])
    );

    expect(collect(el, range)).toEqual(collectPerCharacter(el, range));
    expect(collect(el, range)[0].x).toBe(30);
  });

  it('handles a 384-character paragraph without diverging', () => {
    const text =
      'Chladni figures appear when a plate vibrates at a resonant frequency, and the sand collects along the nodal lines where the amplitude is zero. ';
    const el = document.createElement('div');
    const node = document.createTextNode(text);
    el.appendChild(node);

    const lines = paragraphLines(text.trim(), 44);
    const tops = lines.map((_line, i) => 60 + i * 24);
    const lefts = lines.map(() => 8);
    const range = new FakeRange();
    range.setNodeRects(
      node,
      lines.map((line, i) => rect(tops[i], lefts[i], line.length * 8))
    );
    range.setCharRects(layoutLines(text.trim(), lines, tops, lefts, 8, 24));

    expect(collect(el, range)).toEqual(collectPerCharacter(el, range));
  });

  it('falls back to the exact scan for bidi text', () => {
    const el = document.createElement('div');
    const text = 'שלום עולם this is mixed';
    const node = document.createTextNode(text);
    el.appendChild(node);

    const range = new FakeRange();
    range.setNodeRects(node, [rect(100, 10, 100), rect(120, 10, 80)]);
    range.setCharRects(
      layoutLines(text, ['שלום עולם this', 'is mixed'], [100, 120], [10, 10])
    );

    expect(collect(el, range)).toEqual(collectPerCharacter(el, range));
  });
});

// ---------------------------------------------------------------------------
// Cache / invalidation behavior
// ---------------------------------------------------------------------------

class MockCtx {
  font = '';
  filter = 'none';
  fillStyle = '';
  textBaseline = 'alphabetic';
  textAlign = 'left';
  letterSpacing = '0px';
  fontVariationSettings = 'normal';
  fills: { text: string; x: number; y: number }[] = [];
  constructor() {
    this.letterSpacing = '0px';
  }
  setTransform() {}
  fillRect() {}
  beginPath() {}
  roundRect() {}
  fill() {}
  measureText() {
    return {
      width: 50,
      fontBoundingBoxAscent: 16,
      fontBoundingBoxDescent: 4,
      actualBoundingBoxAscent: 16,
      actualBoundingBoxDescent: 4,
    };
  }
  fillText(text: string, x: number, y: number) {
    this.fills.push({ text, x, y });
  }
}

function installDomStubs(elements: HTMLElement[]) {
  const mockCtx = new MockCtx();
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type: string) {
    if (type === '2d') return mockCtx as unknown as CanvasRenderingContext2D;
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;

  const origCreateRange = document.createRange.bind(document);
  document.createRange = () => {
    const range = origCreateRange();
    range.selectNode = () => {};
    range.getClientRects = () => [rect(100, 10, 200, 30)] as unknown as DOMRectList;
    range.getBoundingClientRect = () => rect(100, 10, 200, 30) as DOMRect;
    return range;
  };

  for (const el of elements) {
    el.getBoundingClientRect = () => rect(100, 10, 200, 30) as DOMRect;
    el.checkVisibility = () => true;
  }

  return {
    mockCtx,
    restore() {
      HTMLCanvasElement.prototype.getContext = origGetContext;
      document.createRange = origCreateRange;
    },
  };
}

describe('TextMaskManager layout cache invalidation', () => {
  let restore: () => void;
  let ctx: MockCtx;
  let el: HTMLElement;
  let instance: TextMaskManager;

  beforeEach(() => {
    el = document.createElement('div');
    el.setAttribute('data-text-repulsor', '');
    el.textContent = 'Cached line one and line two';
    document.body.appendChild(el);

    const stubs = installDomStubs([el]);
    ctx = stubs.mockCtx;
    restore = stubs.restore;

    Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: 0 });
    Object.defineProperty(window, 'scrollX', { configurable: true, writable: true, value: 0 });
    instance = new TextMaskManager({ resolution: 256 });
  });

  afterEach(() => {
    instance.dispose();
    el.remove();
    restore();
  });

  it('scroll repositions cached lines without re-measuring the DOM', () => {
    const counters = instance.debug!.counters;
    const rangeBefore = counters.rangeClientRects + counters.rangeBoundingRects;
    const walkersBefore = counters.treeWalkers;
    const fillsBefore = ctx.fills.length;
    expect(fillsBefore).toBeGreaterThan(0);

    (window as unknown as { scrollY: number }).scrollY = 120;
    instance.setDirtyPosition();
    instance.rasterizeText();

    expect(counters.rangeClientRects + counters.rangeBoundingRects).toBe(rangeBefore);
    expect(counters.treeWalkers).toBe(walkersBefore);
    // Drawing still happens, and the cached line moved up by the scroll delta.
    expect(ctx.fills.length).toBeGreaterThan(fillsBefore);
    expect(ctx.fills[ctx.fills.length - 1].y).toBe(1);
  });

  it('invalidateLayout re-measures on the next rasterize', () => {
    const counters = instance.debug!.counters;
    const rangeBefore = counters.rangeClientRects + counters.rangeBoundingRects;

    instance.invalidateLayout();
    instance.rasterizeText();

    expect(counters.rangeClientRects + counters.rangeBoundingRects).toBeGreaterThan(rangeBefore);
  });

  it('skips redraw and texture upload when the content signature is unchanged', () => {
    instance.invalidateLayout();
    instance.rasterizeText();
    const fillsBefore = ctx.fills.length;
    const uploadsBefore = instance.debug!.counters.uploadRequests;

    instance.invalidateLayout();
    instance.rasterizeText();

    expect(ctx.fills.length).toBe(fillsBefore);
    expect(instance.debug!.counters.uploadRequests).toBe(uploadsBefore);
    expect(instance.debug!.counters.signatureSkips).toBeGreaterThan(0);
  });

  it('redraws after a scroll even when the layout signature is unchanged', () => {
    instance.invalidateLayout();
    instance.rasterizeText();
    const fillsBefore = ctx.fills.length;

    (window as unknown as { scrollY: number }).scrollY = 40;
    instance.invalidateLayout();
    instance.rasterizeText();

    expect(ctx.fills.length).toBeGreaterThan(fillsBefore);
  });

  it('window resize invalidates layout', async () => {
    instance.invalidateLayout();
    instance.rasterizeText();
    const counters = instance.debug!.counters;
    const walkersBefore = counters.treeWalkers;

    window.dispatchEvent(new Event('resize'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.rasterizeText();

    expect(counters.treeWalkers).toBeGreaterThan(walkersBefore);
  });

  it('chladni:refresh-text-mask invalidates layout (accordion open/close)', async () => {
    instance.invalidateLayout();
    instance.rasterizeText();
    const counters = instance.debug!.counters;
    const walkersBefore = counters.treeWalkers;

    window.dispatchEvent(new CustomEvent('chladni:refresh-text-mask'));
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.rasterizeText();

    expect(counters.treeWalkers).toBeGreaterThan(walkersBefore);
  });

  it('text content changes invalidate layout', async () => {
    instance.invalidateLayout();
    instance.rasterizeText();
    const counters = instance.debug!.counters;
    const walkersBefore = counters.treeWalkers;

    (el.firstChild as Text).textContent = 'Cached line one and a longer second line';
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.rasterizeText();

    expect(counters.treeWalkers).toBeGreaterThan(walkersBefore);
  });

  it('visibility changes invalidate layout and stop drawing the element', async () => {
    instance.invalidateLayout();
    instance.rasterizeText();
    const fillsBefore = ctx.fills.length;

    el.style.opacity = '0';
    el.checkVisibility = () => false;
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.rasterizeText();

    expect(ctx.fills.length).toBe(fillsBefore);
  });

  it('adding data-text-repulsor invalidates layout', async () => {
    const late = document.createElement('div');
    late.textContent = 'Late tracked element';
    document.body.appendChild(late);
    late.getBoundingClientRect = () => rect(100, 10, 200, 30) as DOMRect;
    late.checkVisibility = () => true;

    instance.invalidateLayout();
    instance.rasterizeText();
    const counters = instance.debug!.counters;
    const walkersBefore = counters.treeWalkers;

    late.setAttribute('data-text-repulsor', '');
    await new Promise((resolve) => setTimeout(resolve, 0));
    instance.rasterizeText();

    expect(counters.treeWalkers).toBeGreaterThan(walkersBefore);
    late.remove();
  });
});

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
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

function collect(
  el: HTMLElement,
  range: FakeRange,
  ascent = 16,
  descent = 4
) {
  return (manager() as unknown as {
    collectLines: (
      el: HTMLElement,
      ctx: CanvasRenderingContext2D,
      range: Range,
      ascent: number,
      descent: number
    ) => { text: string; x: number; y: number }[];
  }).collectLines(el, {} as CanvasRenderingContext2D, range as unknown as Range, ascent, descent);
}

describe('TextMaskManager.collectLines', () => {
  it('uses a single-node rect directly and centers the baseline', () => {
    const el = document.createElement('div');
    const text = document.createTextNode('Hello');
    el.appendChild(text);

    const range = new FakeRange();
    range.setNodeRects(text, [rect(100, 10, 50)]);

    expect(collect(el, range)).toEqual([{ text: 'Hello', x: 10, y: 116 }]);
  });

  it('skips whitespace-only text nodes and collects siblings', () => {
    const el = document.createElement('div');
    const first = document.createTextNode('One');
    const blank = document.createTextNode('   ');
    const second = document.createTextNode('Two');
    el.append(first, blank, second);

    const range = new FakeRange();
    range.setNodeRects(first, [rect(10, 5, 30)]);
    range.setNodeRects(blank, [rect(10, 40, 10)]);
    range.setNodeRects(second, [rect(10, 55, 30)]);

    expect(collect(el, range).map((line) => line.text)).toEqual(['One', 'Two']);
  });

  it('walks nested elements', () => {
    const el = document.createElement('div');
    const span = document.createElement('span');
    const text = document.createTextNode('Nested');
    span.appendChild(text);
    el.appendChild(span);

    const range = new FakeRange();
    range.setNodeRects(text, [rect(30, 12, 40)]);

    expect(collect(el, range)).toEqual([{ text: 'Nested', x: 12, y: 46 }]);
  });

  it('splits a wrapped text node into lines at vertical breaks', () => {
    const el = document.createElement('div');
    const text = document.createTextNode('abc def ghi');
    el.appendChild(text);

    const range = new FakeRange();
    range.setNodeRects(text, [rect(100, 0, 100), rect(120, 0, 100)]);
    range.setCharRects(
      'abc def ghi'.split('').map((_char, i) =>
        i < 4 ? rect(100, 10 + i * 10, 10) : rect(120, 10 + (i - 4) * 10, 10)
      )
    );

    expect(collect(el, range)).toEqual([
      { text: 'abc', x: 10, y: 116 },
      { text: 'def ghi', x: 10, y: 136 },
    ]);
  });

  it('skips nodes with no client rects', () => {
    const el = document.createElement('div');
    const text = document.createTextNode('Hidden');
    el.appendChild(text);

    const range = new FakeRange();
    range.setNodeRects(text, []);

    expect(collect(el, range)).toEqual([]);
  });

  it('keeps offscreen lines and returns nothing for an empty element', () => {
    const el = document.createElement('div');
    const text = document.createTextNode('Above');
    el.appendChild(text);

    const range = new FakeRange();
    range.setNodeRects(text, [rect(-500, 10, 50)]);

    expect(collect(el, range)).toEqual([{ text: 'Above', x: 10, y: -484 }]);
    expect(collect(document.createElement('div'), new FakeRange())).toEqual([]);
  });

  it('skips invisible or collapsed elements during rasterization', () => {
    const filledTexts: string[] = [];
    const mockCtx = {
      setTransform: () => {},
      fillRect: () => {},
      measureText: () => ({
        fontBoundingBoxAscent: 10,
        fontBoundingBoxDescent: 2,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      }),
      fillText: (text: string) => {
        filledTexts.push(text);
      },
    } as unknown as CanvasRenderingContext2D;

    const inst = Object.create(TextMaskManager.prototype) as any;
    inst.isDestroyed = false;
    inst.ctx = mockCtx;
    inst.canvas = { width: 1024, height: 1024 };
    inst.resolution = 1024;
    inst.canvasW = 1024;
    inst.canvasH = 1024;
    inst.trackedSelector = '[data-text-repulsor]';
    inst.texture = { needsUpdate: false };

    // Visible element
    const visibleEl = document.createElement('div');
    visibleEl.setAttribute('data-text-repulsor', '');
    visibleEl.textContent = 'Visible Text';
    visibleEl.getBoundingClientRect = () => rect(100, 10, 100, 30) as DOMRect;
    visibleEl.checkVisibility = () => true;

    // Mock createRange so collectLines produces a client rect in happy-dom
    const origCreateRange = document.createRange.bind(document);
    document.createRange = () => {
      const r = origCreateRange();
      r.getClientRects = () => [rect(100, 10, 100, 30)] as unknown as DOMRectList;
      return r;
    };

    // Collapsed element (width/height 0)
    const collapsedEl = document.createElement('div');
    collapsedEl.setAttribute('data-text-repulsor', '');
    collapsedEl.textContent = 'Collapsed Text';
    collapsedEl.getBoundingClientRect = () => rect(100, 10, 0, 0) as DOMRect;
    collapsedEl.checkVisibility = () => false;

    // Invisible element (checkVisibility returns false)
    const invisibleEl = document.createElement('div');
    invisibleEl.setAttribute('data-text-repulsor', '');
    invisibleEl.textContent = 'Invisible Text';
    invisibleEl.getBoundingClientRect = () => rect(100, 10, 100, 30) as DOMRect;
    invisibleEl.checkVisibility = () => false;

    document.body.append(visibleEl, collapsedEl, invisibleEl);

    try {
      inst.rasterizeText();
    } finally {
      document.createRange = origCreateRange;
    }

    expect(filledTexts).toContain('Visible Text');
    expect(filledTexts).not.toContain('Collapsed Text');
    expect(filledTexts).not.toContain('Invisible Text');

    visibleEl.remove();
    collapsedEl.remove();
    invisibleEl.remove();
  });

  it('resets canvas letter-spacing for untracked text so tracking cannot leak', () => {
    const spacingWrites: string[] = [];
    const mockCtx: any = {
      setTransform: () => {},
      fillRect: () => {},
      measureText: () => ({
        fontBoundingBoxAscent: 10,
        fontBoundingBoxDescent: 2,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
        width: 50,
      }),
      fillText: () => {},
      roundRect: () => {},
      beginPath: () => {},
      fill: () => {},
    };
    // `letterSpacing` must exist on the context so the manager's feature check
    // (`'letterSpacing' in ctx`) passes, mirroring a real CanvasRenderingContext2D.
    let currentSpacing = '';
    Object.defineProperty(mockCtx, 'letterSpacing', {
      configurable: true,
      get: () => currentSpacing,
      set: (value: string) => {
        currentSpacing = value;
        spacingWrites.push(value);
      },
    });

    const inst = Object.create(TextMaskManager.prototype) as any;
    inst.isDestroyed = false;
    inst.ctx = mockCtx;
    inst.canvas = { width: 1024, height: 1024 };
    inst.resolution = 1024;
    inst.canvasW = 1024;
    inst.canvasH = 1024;
    inst.trackedSelector = '[data-text-repulsor]';
    inst.texture = { needsUpdate: false };

    const trackedEl = document.createElement('div');
    trackedEl.setAttribute('data-text-repulsor', '');
    trackedEl.textContent = 'TRACKED';
    trackedEl.getBoundingClientRect = () => rect(100, 10, 100, 30) as DOMRect;
    trackedEl.checkVisibility = () => true;

    const plainEl = document.createElement('div');
    plainEl.setAttribute('data-text-repulsor', '');
    plainEl.textContent = 'PLAIN';
    plainEl.getBoundingClientRect = () => rect(100, 10, 100, 30) as DOMRect;
    plainEl.checkVisibility = () => true;

    document.body.append(trackedEl, plainEl);

    const origGetComputedStyle = window.getComputedStyle.bind(window);
    window.getComputedStyle = ((el: Element) => {
      const base = origGetComputedStyle(el);
      return {
        fontSize: '16px',
        fontWeight: '400',
        fontFamily: base.fontFamily || 'sans-serif',
        fontStyle: 'normal',
        letterSpacing: el === trackedEl ? '1.2px' : 'normal',
        fontVariationSettings: 'normal',
        getPropertyValue: (prop: string) =>
          prop === 'font-variation-settings' ? 'normal' : '',
      } as any;
    }) as typeof window.getComputedStyle;

    const origCreateRange = document.createRange.bind(document);
    document.createRange = () => {
      const r = origCreateRange();
      r.getClientRects = () => [rect(100, 10, 100, 30)] as unknown as DOMRectList;
      return r;
    };

    try {
      inst.rasterizeText();
    } finally {
      window.getComputedStyle = origGetComputedStyle;
      document.createRange = origCreateRange;
      trackedEl.remove();
      plainEl.remove();
    }

    // The tracked element sets its tracking, and the following untracked element
    // must explicitly reset it to 0px rather than inheriting 1.2px.
    expect(spacingWrites).toContain('1.2px');
    expect(spacingWrites).toContain('0px');
    expect(spacingWrites[spacingWrites.length - 1]).toBe('0px');
  });
});

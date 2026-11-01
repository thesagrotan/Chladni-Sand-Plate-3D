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
});

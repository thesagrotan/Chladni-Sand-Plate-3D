/**
 * Per-element layout cache types for the text mask.
 *
 * Layout is measured in *document* coordinates so scrolling can redraw the
 * cached lines without touching the DOM (`x - scrollX`, `y - scrollY`). Only a
 * layout invalidation (resize, font/text/style change, visibility change,
 * accordion open/close) re-runs `getBoundingClientRect`, `getComputedStyle`,
 * `measureText`, and the Range line scan.
 */

export interface DocumentRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextMaskLineLayout {
  text: string;
  /** Document-space left edge (same as the DOM Range rect left + scrollX). */
  x: number;
  /** Document-space alphabetic baseline. */
  y: number;
}

export type TextMaskRepulsorType = 'text' | 'line' | 'card' | 'rect' | 'hole';

export interface TextMaskLayoutEntry {
  el: HTMLElement;
  repulsorType: TextMaskRepulsorType;
  /** Trimmed text used for the element (empty for line/card/rect). */
  textToRender: string;
  /** family|weight|style|size|letterSpacing|fontVariationSettings. */
  fontKey: string;
  /** CSS font size in px (used for blur radii). */
  fontSize: number;
  /** Full CSS font shorthand used for canvas drawing. */
  font: string;
  letterSpacing: number;
  fontVariationSettings: string;
  /** Border box in document coordinates. */
  docRect: DocumentRect;
  /** Lines in document coordinates; empty for line/card/rect. */
  lines: TextMaskLineLayout[];
  /** Identity of the cached offscreen bitmap (empty for non-text entries). */
  bitmapKey: string;
  fontAscent: number;
  fontDescent: number;
  /** Style visibility (opacity/display/visibility), not viewport culling. */
  visible: boolean;
}

export interface TextMaskFontStyle {
  fontSize: number;
  fontWeight: string;
  fontFamily: string;
  fontStyle: string;
  letterSpacing: number;
  fontVariationSettings: string;
}

export function readFontStyle(style: CSSStyleDeclaration): TextMaskFontStyle {
  const fontSize = parseFloat(style.fontSize) || 28;
  const fontWeight = style.fontWeight || '700';
  const fontFamily = style.fontFamily || 'system-ui, -apple-system, sans-serif';
  const fontStyle = style.fontStyle || 'normal';
  const letterSpacing = parseFloat(style.letterSpacing) || 0;
  const fvs =
    (style as unknown as { fontVariationSettings?: string }).fontVariationSettings ||
    style.getPropertyValue('font-variation-settings') ||
    'normal';

  return { fontSize, fontWeight, fontFamily, fontStyle, letterSpacing, fontVariationSettings: fvs };
}

export function fontKeyFromStyle(font: TextMaskFontStyle): string {
  return [
    font.fontFamily,
    font.fontWeight,
    font.fontStyle,
    font.fontSize,
    font.letterSpacing,
    font.fontVariationSettings,
  ].join('|');
}

export function fontShorthand(font: TextMaskFontStyle): string {
  return `${font.fontStyle} ${font.fontWeight} ${font.fontSize}px ${font.fontFamily}`;
}

import { describe, expect, it } from 'vitest';
import { GRID_CATALOG, GRID_CATALOG_BY_TYPE, randomizeGridParams } from '../src/utils/grid.ts';
import { findFont, fontSelectionUpdates, nextFontUpdates } from '../src/utils/fonts.ts';
import type { FontOption } from '../src/types/chladni.ts';

const FONTS: FontOption[] = [
  {
    id: 'variable-font',
    name: 'Variable',
    fontFamily: 'Variable',
    category: 'variable',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: true,
    hasSpacingAxis: true,
    hasElshAxis: false,
    badge: '',
    format: 'TTF',
    description: '',
    fileName: '',
  },
  {
    id: 'static-font',
    name: 'Static',
    fontFamily: 'Static',
    category: 'static',
    minWeight: 300,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: '',
    format: 'OTF',
    description: '',
    fileName: '',
  },
];

describe('grid catalog', () => {
  it('contains every grid type exactly once', () => {
    const types = GRID_CATALOG.map((entry) => entry.type);
    expect(new Set(types).size).toBe(6);
    expect(types).toEqual(['annular', 'rectangular', 'polar', 'hexagonal', 'diamond', 'web']);
  });

  it('indexes entries by type', () => {
    for (const entry of GRID_CATALOG) {
      expect(GRID_CATALOG_BY_TYPE[entry.type]).toBe(entry);
    }
  });
});

describe('randomizeGridParams', () => {
  it('only produces values inside the control ranges', () => {
    const types = new Set(GRID_CATALOG.map((entry) => entry.type));

    for (let i = 0; i < 200; i++) {
      const params = randomizeGridParams();

      expect(types.has(params.gridType!)).toBe(true);
      expect(params.centerVoidRadius).toBeGreaterThanOrEqual(0.2);
      expect(params.centerVoidRadius).toBeLessThanOrEqual(0.42);
      expect(['circle', 'square']).toContain(params.centerVoidShape);
      expect(params.centerExpulsion).toBeGreaterThanOrEqual(2.2);
      expect(params.centerExpulsion).toBeLessThanOrEqual(3.6);
      expect(params.modeM).toBeGreaterThanOrEqual(3);
      expect(params.modeM).toBeLessThanOrEqual(6);
      expect(params.modeN).toBeGreaterThanOrEqual(4);
      expect(params.modeN).toBeLessThanOrEqual(7.5);
      expect(params.waveK).toBeGreaterThanOrEqual(28);
      expect(params.waveK).toBeLessThanOrEqual(38);
      expect(params.symmetryBlend).toBeGreaterThanOrEqual(0.55);
      expect(params.symmetryBlend).toBeLessThanOrEqual(0.95);
    }
  });
});

describe('font selection', () => {
  it('finds fonts by id or family', () => {
    expect(findFont(FONTS, 'variable-font')?.name).toBe('Variable');
    expect(findFont(FONTS, 'Static')?.name).toBe('Static');
    expect(findFont(FONTS, 'missing')).toBeUndefined();
  });

  it('clamps weight and clears unsupported axes', () => {
    const updates = fontSelectionUpdates(FONTS[1], 1000);

    expect(updates.fontFamily).toBe('Static');
    expect(updates.fontWeight).toBe(900);
    expect(updates.fontItalic).toBe(false);
    expect(updates.fontSpacingAxis).toBe(0);
    expect(updates.fontElshAxis).toBe(0);
  });

  it('keeps supported axes and font default italic state', () => {
    const updates = fontSelectionUpdates(FONTS[0], 100);

    expect(updates.fontWeight).toBe(400);
    expect(updates.fontItalic).toBeUndefined();
    expect(updates.fontSpacingAxis).toBeUndefined();
    expect(updates.fontElshAxis).toBe(0);
  });

  it('cycles to the next font and wraps', () => {
    expect(nextFontUpdates(FONTS, { fontFamily: 'Variable', fontWeight: 400 })?.fontFamily).toBe(
      'Static'
    );
    expect(nextFontUpdates(FONTS, { fontFamily: 'Static', fontWeight: 400 })?.fontFamily).toBe(
      'Variable'
    );
    expect(nextFontUpdates([], { fontFamily: 'None', fontWeight: 400 })).toBeNull();
  });
});

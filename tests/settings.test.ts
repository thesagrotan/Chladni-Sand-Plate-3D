import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/types/chladni.ts';
import { applyBrandPalette, BRAND_PALETTE, hydrateParams } from '../src/utils/settings.ts';

describe('applyBrandPalette', () => {
  it('forces the brand colors and silica palette id', () => {
    const saved = {
      ...DEFAULT_PARAMS,
      paletteId: 'golden_sand',
      sandColor: '#fde047',
      sandColorSecondary: '#ca8a04',
      plateColor: '#0c0d10',
      glowColor: '#f59e0b',
    };

    const hydrated = applyBrandPalette(saved);

    expect(hydrated.paletteId).toBe('silica');
    expect(hydrated.sandColor).toBe(BRAND_PALETTE.sandColor);
    expect(hydrated.sandColorSecondary).toBe(BRAND_PALETTE.sandColorSecondary);
    expect(hydrated.plateColor).toBe(BRAND_PALETTE.plateColor);
    expect(hydrated.glowColor).toBe(BRAND_PALETTE.glowColor);
  });

  it('hydrates typography and the brand palette while preserving voids', () => {
    const saved = {
      ...DEFAULT_PARAMS,
      fontFamily: '',
      centerVoidRadius: 0.31,
      showVoidGuide: true,
      paletteId: 'crimson_ruby',
    };

    const hydrated = hydrateParams(saved);

    expect(hydrated.fontFamily).toBe(DEFAULT_PARAMS.fontFamily);
    expect(hydrated.paletteId).toBe('silica');
    expect(hydrated.centerVoidRadius).toBe(0.31);
    expect(hydrated.showVoidGuide).toBe(true);
  });

  it('preserves saved void, preset, and simulation settings', () => {
    const saved = {
      ...DEFAULT_PARAMS,
      centerVoidRadius: 0.42,
      showVoidGuide: true,
      modeM: 9.5,
      gridType: 'web' as const,
      grainCount: 250_000,
    };

    const hydrated = applyBrandPalette(saved);

    expect(hydrated.centerVoidRadius).toBe(0.42);
    expect(hydrated.showVoidGuide).toBe(true);
    expect(hydrated.modeM).toBe(9.5);
    expect(hydrated.gridType).toBe('web');
    expect(hydrated.grainCount).toBe(250_000);
  });
});

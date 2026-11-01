import type { ChladniParams } from '../types/chladni.ts';
import { DEFAULT_PARAMS } from '../types/chladni.ts';

export const BRAND_PALETTE = {
  paletteId: 'silica',
  sandColor: '#f7f5f0',
  sandColorSecondary: '#e4dfd3',
  plateColor: '#070709',
  glowColor: '#ffffff',
} as const;

/**
 * Applies the locked brand palette on load. Palette identity is set to silica
 * so the selected swatch matches the rendered colors. Void and preset fields
 * are intentionally preserved.
 */
export function applyBrandPalette(params: ChladniParams): ChladniParams {
  return { ...params, ...BRAND_PALETTE };
}

/**
 * Fills in typography fallbacks and applies the locked brand palette.
 */
export function hydrateParams(saved: ChladniParams): ChladniParams {
  return applyBrandPalette({
    ...saved,
    fontFamily: saved.fontFamily || DEFAULT_PARAMS.fontFamily,
    fontWeight: saved.fontWeight ?? DEFAULT_PARAMS.fontWeight,
    fontItalic: saved.fontItalic ?? DEFAULT_PARAMS.fontItalic,
    fontSpacingAxis: saved.fontSpacingAxis ?? DEFAULT_PARAMS.fontSpacingAxis,
    fontElshAxis: saved.fontElshAxis ?? DEFAULT_PARAMS.fontElshAxis,
    fontLetterSpacing: saved.fontLetterSpacing ?? DEFAULT_PARAMS.fontLetterSpacing,
  });
}

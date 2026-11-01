import type { ChladniParams } from '../types/chladni.ts';

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

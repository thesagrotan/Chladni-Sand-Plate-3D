import type { ChladniParams, FontOption } from '../types/chladni.ts';

export function findFont(fonts: FontOption[], family: string): FontOption | undefined {
  return fonts.find((font) => font.fontFamily === family || font.id === family);
}

/**
 * Returns the parameter patch for selecting a font, clamping weight to the
 * font's supported range and clearing axes the font does not expose.
 */
export function fontSelectionUpdates(
  font: FontOption,
  currentWeight: number
): Partial<ChladniParams> {
  const targetWeight = Math.min(font.maxWeight, Math.max(font.minWeight, currentWeight));
  const updates: Partial<ChladniParams> = {
    fontFamily: font.fontFamily,
    fontWeight: targetWeight,
  };

  if (font.isItalicDefault !== undefined) {
    updates.fontItalic = font.isItalicDefault;
  } else if (!font.hasItalic) {
    updates.fontItalic = false;
  }

  if (!font.hasSpacingAxis) updates.fontSpacingAxis = 0;
  if (!font.hasElshAxis) updates.fontElshAxis = 0;

  return updates;
}

/**
 * Cycles to the next font in the list and returns its parameter patch.
 */
export function nextFontUpdates(
  fonts: FontOption[],
  params: Pick<ChladniParams, 'fontFamily' | 'fontWeight'>
): Partial<ChladniParams> | null {
  if (fonts.length === 0) return null;

  const currentIndex = fonts.findIndex(
    (font) => font.fontFamily === params.fontFamily || font.id === params.fontFamily
  );
  const nextFont = fonts[(currentIndex + 1) % fonts.length];
  return fontSelectionUpdates(nextFont, params.fontWeight);
}

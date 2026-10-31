/**
 * Computes the exact perceived on-screen color of the WebGL Chladni grains.
 *
 * In Three.js, hex colors are parsed into Linear-sRGB: (sRGB / 255) ^ 2.2.
 * The grain shader mixes the primary sand color (~65%) with the secondary sand color (~35%),
 * and writes linear values directly to the canvas framebuffer. Due to subpixel point
 * rasterization, anti-aliased edge falloff, and blending over the dark plate backdrop,
 * the grains have an effective luminance factor of ~0.88.
 *
 * This function calculates the resulting visual tone so that DOM text exactly matches
 * the rendered dots on screen across any selected palette or custom sand colors.
 */
export function getPerceivedDotColor(sandColor: string, sandColorSecondary?: string): string {
  if (!sandColor) return '#c4bdb2';

  const parse = (h: string): [number, number, number] => {
    const clean = h.replace('#', '').trim();
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) || 0;
      const g = parseInt(clean[1] + clean[1], 16) || 0;
      const b = parseInt(clean[2] + clean[2], 16) || 0;
      return [r, g, b];
    }
    const num = parseInt(clean, 16);
    if (Number.isNaN(num)) return [247, 245, 240];
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  };

  const [r1, g1, b1] = parse(sandColor);
  const [r2, g2, b2] = sandColorSecondary ? parse(sandColorSecondary) : [r1, g1, b1];

  // sRGB to Linear conversion (standard Three.js Color constructor behavior)
  const toLinear = (c: number) => Math.pow(c / 255, 2.2);

  // Mixed variegation across grains (65% primary, 35% secondary)
  const linR = toLinear(r1) * 0.65 + toLinear(r2) * 0.35;
  const linG = toLinear(g1) * 0.65 + toLinear(g2) * 0.35;
  const linB = toLinear(b1) * 0.65 + toLinear(b2) * 0.35;

  // Anti-aliased points blended over the dark plate produce an effective screen luminance factor of ~0.88
  const factor = 0.88;
  const clampByte = (v: number) => Math.round(Math.min(255, Math.max(0, v * 255 * factor)));

  const hexR = clampByte(linR).toString(16).padStart(2, '0');
  const hexG = clampByte(linG).toString(16).padStart(2, '0');
  const hexB = clampByte(linB).toString(16).padStart(2, '0');

  return `#${hexR}${hexG}${hexB}`;
}

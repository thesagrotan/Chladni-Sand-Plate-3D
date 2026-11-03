import { getPerceivedDotColor } from './color.ts';

/** The four palette colors used by the plate and the page. */
export interface PaletteColors {
  sandColor: string;
  sandColorSecondary: string;
  plateColor: string;
  glowColor: string;
}

/** How long a deliberate theme change takes to cross-fade. */
export const PALETTE_TRANSITION_MS = 650;

/**
 * Retargeting mid-transition (e.g. dragging a color picker) uses a shorter
 * duration so the plate keeps up with the input instead of trailing it.
 */
export const PALETTE_RETARGET_MS = 200;

function parseHex(hex: string): [number, number, number] {
  const clean = hex.trim().replace('#', '');
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16),
      parseInt(clean[1] + clean[1], 16),
      parseInt(clean[2] + clean[2], 16),
    ];
  }
  const value = parseInt(clean, 16);
  if (Number.isNaN(value)) return [196, 189, 178];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function toHex(channel: number): string {
  return Math.round(Math.min(255, Math.max(0, channel)))
    .toString(16)
    .padStart(2, '0');
}

function mixHex(from: string, to: string, t: number): string {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const [r1, g1, b1] = parseHex(from);
  const [r2, g2, b2] = parseHex(to);
  return `#${toHex(r1 + (r2 - r1) * t)}${toHex(g1 + (g2 - g1) * t)}${toHex(
    b1 + (b2 - b1) * t
  )}`;
}

/** Symmetric ease so the cross-fade starts and lands gently. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function paletteColorsEqual(a: PaletteColors, b: PaletteColors): boolean {
  return (
    a.sandColor === b.sandColor &&
    a.sandColorSecondary === b.sandColorSecondary &&
    a.plateColor === b.plateColor &&
    a.glowColor === b.glowColor
  );
}

export interface PaletteTransition {
  /** Stable object holding the colors currently being rendered. */
  readonly current: PaletteColors;
  /** Where the transition is heading. */
  readonly target: PaletteColors;
  isAnimating(): boolean;
  /** Snap straight to the target, cancelling any running transition. */
  jumpTo(colors: PaletteColors): void;
  /** Begin (or retarget) a transition from the current colors. */
  animateTo(colors: PaletteColors, now: number, durationMs?: number): void;
  /** Advance to `now`; returns true while more frames are needed. */
  step(now: number): boolean;
}

/**
 * Frame-driven color cross-fade shared by the WebGL plate and the DOM. Colors
 * are interpolated in sRGB so the plate, text and cursor stay in lockstep.
 */
export function createPaletteTransition(initial: PaletteColors): PaletteTransition {
  const current: PaletteColors = { ...initial };
  const target: PaletteColors = { ...initial };
  let from: PaletteColors = { ...initial };
  let startedAt = 0;
  let duration = PALETTE_TRANSITION_MS;
  let animating = false;

  const assign = (colors: PaletteColors) => {
    current.sandColor = colors.sandColor;
    current.sandColorSecondary = colors.sandColorSecondary;
    current.plateColor = colors.plateColor;
    current.glowColor = colors.glowColor;
  };

  return {
    current,
    target,
    isAnimating: () => animating,
    jumpTo(colors) {
      assign(colors);
      assignTarget(target, colors);
      from = { ...colors };
      animating = false;
    },
    animateTo(colors, now, durationMs = PALETTE_TRANSITION_MS) {
      assignTarget(target, colors);
      from = { ...current };
      startedAt = now;
      duration = Math.max(1, durationMs);
      animating = true;
    },
    step(now) {
      if (!animating) return false;
      const raw = Math.min(1, Math.max(0, (now - startedAt) / duration));
      const eased = easeInOutCubic(raw);
      current.sandColor = mixHex(from.sandColor, target.sandColor, eased);
      current.sandColorSecondary = mixHex(
        from.sandColorSecondary,
        target.sandColorSecondary,
        eased
      );
      current.plateColor = mixHex(from.plateColor, target.plateColor, eased);
      current.glowColor = mixHex(from.glowColor, target.glowColor, eased);
      if (raw >= 1) {
        assign(target);
        animating = false;
      }
      return animating;
    },
  };
}

function assignTarget(target: PaletteColors, colors: PaletteColors): void {
  target.sandColor = colors.sandColor;
  target.sandColorSecondary = colors.sandColorSecondary;
  target.plateColor = colors.plateColor;
  target.glowColor = colors.glowColor;
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * CSS custom properties mirroring the palette. The perceived grain color is
 * derived the same way the DOM already matched the WebGL output.
 */
export function paletteCssVars(colors: PaletteColors): Record<string, string> {
  const perceived = getPerceivedDotColor(colors.sandColor, colors.sandColorSecondary);
  return {
    '--sand-color': perceived,
    '--sand-color-sec': colors.sandColorSecondary,
    '--sand-color-20': hexToRgba(perceived, 0.2),
    '--sand-color-40': hexToRgba(perceived, 0.4),
    '--plate-color': colors.plateColor,
    '--glow-color': colors.glowColor,
  };
}

/** Writes the palette to the document root so every consumer animates together. */
export function applyPaletteCssVars(
  colors: PaletteColors,
  root: HTMLElement = document.documentElement
): void {
  const vars = paletteCssVars(colors);
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}

// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import {
  PALETTE_TRANSITION_MS,
  applyPaletteCssVars,
  createPaletteTransition,
  paletteColorsEqual,
  paletteCssVars,
  type PaletteColors,
} from '../src/utils/paletteTransition.ts';

const START: PaletteColors = {
  sandColor: '#000000',
  sandColorSecondary: '#000000',
  plateColor: '#000000',
  glowColor: '#000000',
};

const END: PaletteColors = {
  sandColor: '#ffffff',
  sandColorSecondary: '#ffffff',
  plateColor: '#ffffff',
  glowColor: '#ffffff',
};

describe('palette transition', () => {
  it('eases through intermediate colors instead of snapping', () => {
    const transition = createPaletteTransition(START);

    transition.animateTo(END, 0, 1000);
    expect(transition.isAnimating()).toBe(true);

    // First step at t=0 keeps the starting colors.
    expect(transition.step(0)).toBe(true);
    expect(transition.current.sandColor).toBe('#000000');

    // Quarter of the way in, the color is between the two endpoints.
    expect(transition.step(250)).toBe(true);
    expect(transition.current.sandColor).not.toBe('#000000');
    expect(transition.current.sandColor).not.toBe('#ffffff');

    const mid = transition.step(500);
    expect(mid).toBe(true);
    expect(transition.current.sandColor).not.toBe('#000000');

    // Completing the transition lands exactly on the target.
    expect(transition.step(1000)).toBe(false);
    expect(transition.current).toEqual(END);
    expect(transition.isAnimating()).toBe(false);
  });

  it('moves monotonically toward the target', () => {
    const transition = createPaletteTransition(START);
    transition.animateTo(END, 0, 1000);

    const channel = () => parseInt(transition.current.sandColor.slice(1, 3), 16);
    let previous = channel();
    for (const now of [100, 200, 300, 400, 500, 600, 700, 800, 900]) {
      transition.step(now);
      const value = channel();
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('jumps instantly when asked', () => {
    const transition = createPaletteTransition(START);
    transition.animateTo(END, 0, 1000);
    transition.step(100);

    transition.jumpTo(END);

    expect(transition.isAnimating()).toBe(false);
    expect(transition.current).toEqual(END);
    expect(transition.step(200)).toBe(false);
  });

  it('retargets from the current colors rather than the previous start', () => {
    const transition = createPaletteTransition(START);
    transition.animateTo(END, 0, 1000);
    transition.step(500);

    const midway = transition.current.sandColor;
    const other: PaletteColors = {
      sandColor: '#ff0000',
      sandColorSecondary: '#ff0000',
      plateColor: '#ff0000',
      glowColor: '#ff0000',
    };
    transition.animateTo(other, 500, 100);

    expect(transition.current.sandColor).toBe(midway);
    transition.step(550);
    expect(transition.current.sandColor).not.toBe('#ff0000');
    transition.step(600);
    expect(transition.current.sandColor).toBe('#ff0000');
  });

  it('compares palettes by all four colors', () => {
    expect(paletteColorsEqual(START, { ...START })).toBe(true);
    expect(paletteColorsEqual(START, { ...START, glowColor: '#123456' })).toBe(false);
  });

  it('exposes the palette as CSS variables including alpha variants', () => {
    const vars = paletteCssVars({
      sandColor: '#ffffff',
      sandColorSecondary: '#ffffff',
      plateColor: '#111215',
      glowColor: '#38bdf8',
    });

    expect(vars['--sand-color']).toMatch(/^#[0-9a-f]{6}$/);
    expect(vars['--sand-color-sec']).toBe('#ffffff');
    expect(vars['--sand-color-20']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.2\)$/);
    expect(vars['--sand-color-40']).toMatch(/^rgba\(\d+, \d+, \d+, 0\.4\)$/);
    expect(vars['--plate-color']).toBe('#111215');
    expect(vars['--glow-color']).toBe('#38bdf8');
  });

  it('writes the variables onto the document root', () => {
    applyPaletteCssVars({
      sandColor: '#ff0000',
      sandColorSecondary: '#00ff00',
      plateColor: '#0000ff',
      glowColor: '#ffff00',
    });

    const style = document.documentElement.style;
    expect(style.getPropertyValue('--sand-color')).toMatch(/^#[0-9a-f]{6}$/);
    expect(style.getPropertyValue('--sand-color-sec')).toBe('#00ff00');
    expect(style.getPropertyValue('--plate-color')).toBe('#0000ff');
    expect(style.getPropertyValue('--glow-color')).toBe('#ffff00');
  });

  it('defaults to the standard transition duration', () => {
    expect(PALETTE_TRANSITION_MS).toBeGreaterThanOrEqual(400);
  });
});

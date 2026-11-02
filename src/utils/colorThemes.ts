import type { ChladniParams, ColorPalette } from '../types/chladni.ts';
import { COLOR_PALETTES } from '../types/chladni.ts';
import { RELEASES } from '../data/releases.ts';
import { storageGet, storageSet } from './storage.ts';

/** A colour palette that can be edited and bound to a release. */
export interface ColorTheme extends ColorPalette {
  /** Release that applies this theme when it starts playing, if any. */
  releaseId: string | null;
}

export const COLOR_THEMES_STORAGE_KEY = 'chladni_color_themes';

const RELEASE_IDS = new Set(RELEASES.map((release) => release.id));
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * First-run bindings so the release/theme link is visible immediately.
 * Users can change or clear these from the Style panel.
 */
const DEFAULT_RELEASE_BINDINGS: Record<string, string> = {
  golden_sand: 'tz-01',
  cyber_cyan: 'tz-02',
};

/** Fresh copy of the built-in themes, including their default release bindings. */
export function defaultColorThemes(): ColorTheme[] {
  return COLOR_PALETTES.map((palette) => ({
    ...palette,
    releaseId: DEFAULT_RELEASE_BINDINGS[palette.id] ?? null,
  }));
}

function sanitizeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !HEX_COLOR_PATTERN.test(value)) return fallback;
  // `<input type="color">` only accepts #rrggbb, so expand shorthand and drop alpha.
  let hex = value.slice(1);
  if (hex.length === 4) hex = hex.slice(0, 3);
  if (hex.length === 8) hex = hex.slice(0, 6);
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return `#${hex.toLowerCase()}`;
}

function sanitizeTheme(raw: unknown, index: number): ColorTheme | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const id =
    typeof value.id === 'string' && value.id.trim().length > 0
      ? value.id.trim()
      : `theme_${index}`;
  const name =
    typeof value.name === 'string' && value.name.trim().length > 0
      ? value.name.trim()
      : `Theme ${index + 1}`;
  const releaseId =
    typeof value.releaseId === 'string' && RELEASE_IDS.has(value.releaseId)
      ? value.releaseId
      : null;

  return {
    id,
    name,
    sandPrimary: sanitizeColor(value.sandPrimary, '#f7f5f0'),
    sandSecondary: sanitizeColor(value.sandSecondary, '#e4dfd3'),
    plate: sanitizeColor(value.plate, '#111215'),
    glow: sanitizeColor(value.glow, '#38bdf8'),
    releaseId,
  };
}

/**
 * Loads editable themes from local storage. Invalid entries are repaired and a
 * release can only be bound to one theme at a time.
 */
export function loadColorThemes(): ColorTheme[] {
  const raw = storageGet(COLOR_THEMES_STORAGE_KEY);
  if (!raw) return defaultColorThemes();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultColorThemes();

    const themes: ColorTheme[] = [];
    const seenIds = new Set<string>();
    const boundReleases = new Set<string>();

    parsed.forEach((entry, index) => {
      const theme = sanitizeTheme(entry, index);
      if (!theme) return;

      if (seenIds.has(theme.id)) {
        theme.id = `${theme.id}_${index}`;
      }
      seenIds.add(theme.id);

      if (theme.releaseId) {
        if (boundReleases.has(theme.releaseId)) {
          theme.releaseId = null;
        } else {
          boundReleases.add(theme.releaseId);
        }
      }

      themes.push(theme);
    });

    return themes.length > 0 ? themes : defaultColorThemes();
  } catch {
    return defaultColorThemes();
  }
}

/** Persists the full editable theme list. */
export function saveColorThemes(themes: ColorTheme[]): boolean {
  try {
    return storageSet(COLOR_THEMES_STORAGE_KEY, JSON.stringify(themes));
  } catch {
    return false;
  }
}

/** Applies a theme to the live simulation parameters. */
export function themeToParams(theme: ColorTheme): Partial<ChladniParams> {
  return {
    paletteId: theme.id,
    sandColor: theme.sandPrimary,
    sandColorSecondary: theme.sandSecondary,
    plateColor: theme.plate,
    glowColor: theme.glow,
  };
}

/** The palette fields needed to restore the colors that were live before playback. */
export interface PaletteSnapshot {
  paletteId: string;
  sandColor: string;
  sandColorSecondary: string;
  plateColor: string;
  glowColor: string;
}

/** Captures the current palette so playback can restore it when it stops. */
export function paletteSnapshot(params: ChladniParams): PaletteSnapshot {
  return {
    paletteId: params.paletteId,
    sandColor: params.sandColor,
    sandColorSecondary: params.sandColorSecondary,
    plateColor: params.plateColor,
    glowColor: params.glowColor,
  };
}

/** Returns the theme bound to a release, if one exists. */
export function findThemeForRelease(
  themes: ColorTheme[],
  releaseId: string
): ColorTheme | undefined {
  return themes.find((theme) => theme.releaseId === releaseId);
}

/** True when the live params exactly match this theme's colors. */
export function isThemeActive(theme: ColorTheme, params: ChladniParams): boolean {
  return (
    params.paletteId === theme.id &&
    params.sandColor === theme.sandPrimary &&
    params.sandColorSecondary === theme.sandSecondary &&
    params.plateColor === theme.plate &&
    params.glowColor === theme.glow
  );
}

/**
 * Binds a theme to a release. A release can only play one theme, so any other
 * theme previously bound to the same release is unbound.
 */
export function assignThemeToRelease(
  themes: ColorTheme[],
  themeId: string,
  releaseId: string | null
): ColorTheme[] {
  return themes.map((theme) => {
    if (theme.id === themeId) {
      return { ...theme, releaseId };
    }
    if (releaseId && theme.releaseId === releaseId) {
      return { ...theme, releaseId: null };
    }
    return theme;
  });
}

/** Builds a new theme seeded from the colours currently on the plate. */
export function createThemeFromParams(
  params: ChladniParams,
  existingCount: number
): ColorTheme {
  return {
    id: `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: `Custom Theme ${existingCount + 1}`,
    sandPrimary: params.sandColor,
    sandSecondary: params.sandColorSecondary,
    plate: params.plateColor,
    glow: params.glowColor,
    releaseId: null,
  };
}

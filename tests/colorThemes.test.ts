// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS } from '../src/types/chladni.ts';

async function loadModule() {
  return await import('../src/utils/colorThemes.ts');
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('editable color themes', () => {
  it('seeds the built-in themes with release bindings', async () => {
    const { defaultColorThemes, findThemeForRelease } = await loadModule();
    const themes = defaultColorThemes();

    expect(themes.length).toBeGreaterThan(0);
    expect(findThemeForRelease(themes, 'tz-01')?.id).toBe('golden_sand');
    expect(findThemeForRelease(themes, 'tz-02')?.id).toBe('cyber_cyan');
  });

  it('round-trips edits through local storage', async () => {
    const { COLOR_THEMES_STORAGE_KEY, loadColorThemes, saveColorThemes } =
      await loadModule();

    const themes = loadColorThemes();
    themes[0] = {
      ...themes[0],
      name: 'Studio Night',
      sandPrimary: '#123456',
      releaseId: 'tz-02',
    };

    expect(saveColorThemes(themes)).toBe(true);
    expect(localStorage.getItem(COLOR_THEMES_STORAGE_KEY)).toBeTruthy();

    const reloaded = loadColorThemes();
    expect(reloaded[0].name).toBe('Studio Night');
    expect(reloaded[0].sandPrimary).toBe('#123456');
    expect(reloaded[0].releaseId).toBe('tz-02');
    // tz-02 can only belong to one theme.
    expect(reloaded.filter((theme) => theme.releaseId === 'tz-02')).toHaveLength(1);
  });

  it('repairs invalid colors and duplicate release bindings on load', async () => {
    const { COLOR_THEMES_STORAGE_KEY, loadColorThemes } = await loadModule();

    localStorage.setItem(
      COLOR_THEMES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'a',
          name: 'A',
          sandPrimary: 'not-a-color',
          sandSecondary: '#ffffff',
          plate: '#000000',
          glow: '#111111',
          releaseId: 'tz-01',
        },
        {
          id: 'b',
          name: 'B',
          sandPrimary: '#ffffff',
          sandSecondary: '#eeeeee',
          plate: '#000000',
          glow: '#111111',
          releaseId: 'tz-01',
        },
        { id: 'bad', name: 'Bad', releaseId: 'missing-release' },
      ])
    );

    const themes = loadColorThemes();

    expect(themes).toHaveLength(3);
    expect(themes[0].sandPrimary).toBe('#f7f5f0');
    expect(themes[0].releaseId).toBe('tz-01');
    expect(themes[1].releaseId).toBeNull();
    expect(themes[2].releaseId).toBeNull();
  });

  it('normalizes stored colors for color inputs', async () => {
    const { COLOR_THEMES_STORAGE_KEY, loadColorThemes } = await loadModule();

    localStorage.setItem(
      COLOR_THEMES_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'short',
          name: 'Short',
          sandPrimary: '#abc',
          sandSecondary: '#11223344',
          plate: '#000',
          glow: '#ABCDEF',
          releaseId: null,
        },
      ])
    );

    const [theme] = loadColorThemes();
    expect(theme.sandPrimary).toBe('#aabbcc');
    expect(theme.sandSecondary).toBe('#112233');
    expect(theme.plate).toBe('#000000');
    expect(theme.glow).toBe('#abcdef');
  });

  it('moves a release binding to the newly assigned theme', async () => {
    const { assignThemeToRelease, defaultColorThemes } = await loadModule();
    const themes = defaultColorThemes();

    const next = assignThemeToRelease(themes, 'emerald_jade', 'tz-01');

    expect(next.find((theme) => theme.id === 'emerald_jade')?.releaseId).toBe('tz-01');
    expect(next.find((theme) => theme.id === 'golden_sand')?.releaseId).toBeNull();
  });

  it('clears a release binding when assigned to null', async () => {
    const { assignThemeToRelease, defaultColorThemes } = await loadModule();
    const themes = defaultColorThemes();

    const next = assignThemeToRelease(themes, 'golden_sand', null);

    expect(next.find((theme) => theme.id === 'golden_sand')?.releaseId).toBeNull();
  });

  it('maps theme colors into simulation params', async () => {
    const { themeToParams } = await loadModule();

    expect(
      themeToParams({
        id: 'test',
        name: 'Test',
        sandPrimary: '#111111',
        sandSecondary: '#222222',
        plate: '#333333',
        glow: '#444444',
        releaseId: null,
      })
    ).toEqual({
      paletteId: 'test',
      sandColor: '#111111',
      sandColorSecondary: '#222222',
      plateColor: '#333333',
      glowColor: '#444444',
    });
  });

  it('creates a new theme from the current plate colors', async () => {
    const { createThemeFromParams } = await loadModule();
    const theme = createThemeFromParams(
      {
        ...DEFAULT_PARAMS,
        sandColor: '#abcdef',
        sandColorSecondary: '#fedcba',
        plateColor: '#010101',
        glowColor: '#020202',
      },
      2
    );

    expect(theme.id).toMatch(/^custom_/);
    expect(theme.name).toBe('Custom Theme 3');
    expect(theme.sandPrimary).toBe('#abcdef');
    expect(theme.sandSecondary).toBe('#fedcba');
    expect(theme.plate).toBe('#010101');
    expect(theme.glow).toBe('#020202');
    expect(theme.releaseId).toBeNull();
  });

  it('detects when a theme is exactly applied to the live params', async () => {
    const { isThemeActive } = await loadModule();
    const theme = {
      id: 'golden_sand',
      name: 'Golden',
      sandPrimary: '#fde047',
      sandSecondary: '#ca8a04',
      plate: '#0c0d10',
      glow: '#f59e0b',
      releaseId: null,
    };

    const applied = {
      ...DEFAULT_PARAMS,
      paletteId: theme.id,
      sandColor: theme.sandPrimary,
      sandColorSecondary: theme.sandSecondary,
      plateColor: theme.plate,
      glowColor: theme.glow,
    };

    expect(isThemeActive(theme, applied)).toBe(true);
    expect(isThemeActive(theme, { ...applied, sandColor: '#ffffff' })).toBe(false);
    expect(isThemeActive(theme, { ...applied, paletteId: 'silica' })).toBe(false);
  });

  it('snapshots only the palette fields for playback restore', async () => {
    const { paletteSnapshot } = await loadModule();
    const params = {
      ...DEFAULT_PARAMS,
      paletteId: 'crimson_ruby',
      sandColor: '#fca5a5',
      sandColorSecondary: '#ef4444',
      plateColor: '#140c10',
      glowColor: '#f43f5e',
      gridType: 'web' as const,
      grainCount: 99_000,
    };

    expect(paletteSnapshot(params)).toEqual({
      paletteId: 'crimson_ruby',
      sandColor: '#fca5a5',
      sandColorSecondary: '#ef4444',
      plateColor: '#140c10',
      glowColor: '#f43f5e',
    });
  });
});

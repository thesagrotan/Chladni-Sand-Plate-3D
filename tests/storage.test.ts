// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PARAMS, type ChladniParams } from '../src/types/chladni.ts';

async function loadStorageModule() {
  return await import('../src/utils/storage.ts');
}

function sampleParams(overrides: Partial<ChladniParams> = {}): ChladniParams {
  return {
    ...DEFAULT_PARAMS,
    gridType: 'web',
    paletteId: 'golden_sand',
    centerVoidRadius: 0.34,
    showVoidGuide: true,
    grainCount: 42_000,
    modeM: 5.5,
    audioEnabled: true,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('sanitizeParams', () => {
  it('returns defaults for non-object input', async () => {
    const { sanitizeParams } = await loadStorageModule();

    expect(sanitizeParams(null)).toEqual(DEFAULT_PARAMS);
    expect(sanitizeParams('nope')).toEqual(DEFAULT_PARAMS);
  });

  it('replaces invalid numeric and enum fields with defaults', async () => {
    const { sanitizeParams } = await loadStorageModule();

    const result = sanitizeParams({
      ...DEFAULT_PARAMS,
      modeM: Number.NaN,
      grainCount: -5,
      gridType: 'not-a-grid',
      centerVoidShape: 'triangle',
      simulationEngine: 'quantum',
      audioSource: 'theremin',
      sandColor: 'red',
      paletteId: 42,
    });

    expect(result.modeM).toBe(DEFAULT_PARAMS.modeM);
    expect(result.grainCount).toBe(5_000);
    expect(result.gridType).toBe(DEFAULT_PARAMS.gridType);
    expect(result.centerVoidShape).toBe(DEFAULT_PARAMS.centerVoidShape);
    expect(result.simulationEngine).toBe(DEFAULT_PARAMS.simulationEngine);
    expect(result.audioSource).toBe(DEFAULT_PARAMS.audioSource);
    expect(result.sandColor).toBe(DEFAULT_PARAMS.sandColor);
    expect(result.paletteId).toBe(DEFAULT_PARAMS.paletteId);
  });

  it('clamps out-of-range numeric and typography fields', async () => {
    const { sanitizeParams } = await loadStorageModule();

    const result = sanitizeParams({
      ...DEFAULT_PARAMS,
      modeM: 99,
      waveK: -100,
      driveStrength: 100,
      grainCount: 1,
      grainSize: 99,
      centerVoidRadius: 9,
      pointerForce: 99,
      pointerRadius: -1,
      audioVolume: 5,
      audioPlaybackRate: 0.1,
      fontWeight: 50,
      fontSpacingAxis: 999,
      fontElshAxis: -10,
      fontLetterSpacing: 99,
      fontFamily: '   ',
      fontItalic: 1,
      sandColor: 'not-a-color',
    });

    expect(result.modeM).toBe(14);
    expect(result.waveK).toBe(10);
    expect(result.driveStrength).toBe(8);
    expect(result.grainCount).toBe(5_000);
    expect(result.grainSize).toBe(4);
    expect(result.centerVoidRadius).toBe(0.55);
    expect(result.pointerForce).toBe(4);
    expect(result.pointerRadius).toBe(0.02);
    expect(result.audioVolume).toBe(1);
    expect(result.audioPlaybackRate).toBe(0.5);
    expect(result.fontWeight).toBe(100);
    expect(result.fontSpacingAxis).toBe(150);
    expect(result.fontElshAxis).toBe(0);
    expect(result.fontLetterSpacing).toBe(10);
    expect(result.fontFamily).toBe(DEFAULT_PARAMS.fontFamily);
    expect(result.fontItalic).toBe(true);
    expect(result.sandColor).toBe(DEFAULT_PARAMS.sandColor);
  });

  it('migrates the legacy iA Writer default font to Neue Montreal', async () => {
    const { sanitizeParams } = await loadStorageModule();

    const regular = sanitizeParams({ ...DEFAULT_PARAMS, fontFamily: 'iAWriterQuattroV' });
    expect(regular.fontFamily).toBe(DEFAULT_PARAMS.fontFamily);
    expect(regular.fontItalic).toBe(false);

    const italic = sanitizeParams({ ...DEFAULT_PARAMS, fontFamily: 'iAWriterQuattroV-Italic' });
    expect(italic.fontFamily).toBe(DEFAULT_PARAMS.fontFamily);
    expect(italic.fontItalic).toBe(true);

    const untouched = sanitizeParams({ ...DEFAULT_PARAMS, fontFamily: 'Geist' });
    expect(untouched.fontFamily).toBe('Geist');
  });

  it('coerces boolean fields and keeps valid persisted void settings', async () => {
    const { sanitizeParams } = await loadStorageModule();

    const result = sanitizeParams({
      ...DEFAULT_PARAMS,
      centerVoidRadius: 0.4,
      showVoidGuide: true,
      flipHorizontal: 1,
      audioEnabled: 'yes',
    });

    expect(result.centerVoidRadius).toBe(0.4);
    expect(result.showVoidGuide).toBe(true);
    expect(result.flipHorizontal).toBe(true);
    expect(result.audioEnabled).toBe(true);
  });
});

describe('loadSavedSettings / saveSettings', () => {
  it('returns defaults with hasSaved false when nothing is stored', async () => {
    const { loadSavedSettings } = await loadStorageModule();
    const result = loadSavedSettings();

    expect(result.hasSaved).toBe(false);
    expect(result.autoSave).toBe(true);
    expect(result.savedAt).toBeNull();
    expect(result.params).toEqual(DEFAULT_PARAMS);
  });

  it('round-trips saved settings and reports a timestamp', async () => {
    const { saveSettings, loadSavedSettings } = await loadStorageModule();
    const params = sampleParams();

    const saveResult = saveSettings(params);
    const loaded = loadSavedSettings();

    expect(saveResult.success).toBe(true);
    expect(loaded.hasSaved).toBe(true);
    expect(loaded.params).toEqual(params);
    expect(loaded.savedAt).toBe(saveResult.timestamp);
  });

  it('falls back to defaults for corrupt JSON', async () => {
    const { SETTINGS_STORAGE_KEY, loadSavedSettings } = await loadStorageModule();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json');

    const loaded = loadSavedSettings();

    expect(loaded.hasSaved).toBe(false);
    expect(loaded.params).toEqual(DEFAULT_PARAMS);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('persists the auto-save preference', async () => {
    const { setAutoSavePreference, loadSavedSettings } = await loadStorageModule();

    setAutoSavePreference(false);
    expect(loadSavedSettings().autoSave).toBe(false);

    setAutoSavePreference(true);
    expect(loadSavedSettings().autoSave).toBe(true);
  });

  it('clears saved settings and timestamp', async () => {
    const { saveSettings, clearSavedSettings, loadSavedSettings } = await loadStorageModule();

    saveSettings(sampleParams());
    clearSavedSettings();

    const loaded = loadSavedSettings();
    expect(loaded.hasSaved).toBe(false);
    expect(loaded.savedAt).toBeNull();
  });

  it('uses the in-memory fallback when localStorage is unavailable', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new Error('localStorage disabled');
      },
    });

    try {
      const { saveSettings, loadSavedSettings } = await loadStorageModule();
      const params = sampleParams({ gridType: 'diamond' });

      expect(saveSettings(params).success).toBe(true);
      const loaded = loadSavedSettings();
      expect(loaded.hasSaved).toBe(true);
      expect(loaded.params.gridType).toBe('diamond');
    } finally {
      if (descriptor) {
        Object.defineProperty(window, 'localStorage', descriptor);
      } else {
        delete (window as unknown as Record<string, unknown>).localStorage;
      }
    }
  });
});

describe('version history', () => {
  it('saves, lists, restores and deletes versions', async () => {
    const {
      saveVersion,
      listVersions,
      restoreVersion,
      restoreVersionEntry,
      deleteVersion,
    } = await loadStorageModule();
    const params = sampleParams({ modeM: 7.25 });

    const versions = saveVersion(params, '  My preset  ');
    expect(versions).toHaveLength(1);
    expect(versions[0].label).toBe('My preset');
    expect(listVersions()).toHaveLength(1);

    expect(restoreVersion(versions[0].id)).toEqual(params);
    expect(restoreVersionEntry(versions[0].id)?.version.label).toBe('My preset');
    expect(restoreVersionEntry(versions[0].id)?.params).toEqual(params);

    const remaining = deleteVersion(versions[0].id);
    expect(remaining).toHaveLength(0);
    expect(restoreVersion(versions[0].id)).toBeNull();
  });

  it('caps history at ten versions with newest first', async () => {
    const { saveVersion, listVersions } = await loadStorageModule();

    for (let i = 1; i <= 12; i++) {
      saveVersion(sampleParams({ modeM: i }), `v${i}`);
    }

    const versions = listVersions();
    expect(versions).toHaveLength(10);
    expect(versions[0].label).toBe('v12');
    expect(versions[9].label).toBe('v3');
  });

  it('sanitizes params when restoring a version', async () => {
    const { saveVersion, restoreVersion } = await loadStorageModule();
    const versions = saveVersion(
      sampleParams({ modeM: Number.NaN as unknown as number, gridType: 'invalid' as never }),
      'corrupt'
    );

    const restored = restoreVersion(versions[0].id);

    expect(restored?.modeM).toBe(DEFAULT_PARAMS.modeM);
    expect(restored?.gridType).toBe(DEFAULT_PARAMS.gridType);
  });

  it('returns an empty list for corrupt history', async () => {
    const { VERSION_HISTORY_KEY, listVersions } = await loadStorageModule();
    localStorage.setItem(VERSION_HISTORY_KEY, 'not json');

    expect(listVersions()).toEqual([]);
  });
});

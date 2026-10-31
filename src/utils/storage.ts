import { ChladniParams, DEFAULT_PARAMS, GridType, VoidShape } from '../types/chladni.ts';

export const SETTINGS_STORAGE_KEY = 'chladni_plate_saved_settings';
export const AUTOSAVE_STORAGE_KEY = 'chladni_plate_autosave_enabled';
export const TIMESTAMP_STORAGE_KEY = 'chladni_plate_saved_timestamp';

export interface StorageLoadResult {
  params: ChladniParams;
  hasSaved: boolean;
  autoSave: boolean;
  savedAt: string | null;
}

/**
 * Safely accesses localStorage without throwing SecurityError in sandboxes/iframes.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window && window.localStorage !== null) {
      const testKey = '__chladni_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

// In-memory fallback if localStorage is disabled or restricted
const memoryStorage: Record<string, string> = {};

function storageGet(key: string): string | null {
  const store = getStorage();
  if (store) {
    try {
      return store.getItem(key);
    } catch {
      // fallback
    }
  }
  return memoryStorage[key] ?? null;
}

function storageSet(key: string, value: string): boolean {
  memoryStorage[key] = value;
  const store = getStorage();
  if (store) {
    try {
      store.setItem(key, value);
      return true;
    } catch (err) {
      console.warn('[SettingsStorage] setItem failed:', err);
      return false;
    }
  }
  return true;
}

function storageRemove(key: string): void {
  delete memoryStorage[key];
  const store = getStorage();
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      // ignore
    }
  }
}

/**
 * Validates and sanitizes raw settings object against ChladniParams schema.
 */
export function sanitizeParams(raw: unknown): ChladniParams {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_PARAMS };
  }

  const obj = raw as Record<string, unknown>;
  const merged: ChladniParams = {
    ...DEFAULT_PARAMS,
    ...obj,
  } as ChladniParams;

  // Numeric bounds and fallback checks
  if (typeof merged.modeM !== 'number' || isNaN(merged.modeM)) merged.modeM = DEFAULT_PARAMS.modeM;
  if (typeof merged.modeN !== 'number' || isNaN(merged.modeN)) merged.modeN = DEFAULT_PARAMS.modeN;
  if (typeof merged.waveK !== 'number' || isNaN(merged.waveK)) merged.waveK = DEFAULT_PARAMS.waveK;
  if (typeof merged.symmetryBlend !== 'number' || isNaN(merged.symmetryBlend)) merged.symmetryBlend = DEFAULT_PARAMS.symmetryBlend;
  if (typeof merged.driveStrength !== 'number' || isNaN(merged.driveStrength)) merged.driveStrength = DEFAULT_PARAMS.driveStrength;
  if (typeof merged.grainCount !== 'number' || isNaN(merged.grainCount) || merged.grainCount <= 0) merged.grainCount = DEFAULT_PARAMS.grainCount;
  if (typeof merged.centerVoidRadius !== 'number' || isNaN(merged.centerVoidRadius)) merged.centerVoidRadius = DEFAULT_PARAMS.centerVoidRadius;
  if (typeof merged.centerExpulsion !== 'number' || isNaN(merged.centerExpulsion)) merged.centerExpulsion = DEFAULT_PARAMS.centerExpulsion;
  if (typeof merged.domRepulsion !== 'number' || isNaN(merged.domRepulsion)) merged.domRepulsion = DEFAULT_PARAMS.domRepulsion;
  if (typeof merged.rotationAngle !== 'number' || isNaN(merged.rotationAngle)) merged.rotationAngle = DEFAULT_PARAMS.rotationAngle;
  if (typeof merged.fieldOverlay !== 'number' || isNaN(merged.fieldOverlay)) merged.fieldOverlay = DEFAULT_PARAMS.fieldOverlay;

  if (typeof merged.audioVolume !== 'number' || isNaN(merged.audioVolume)) merged.audioVolume = DEFAULT_PARAMS.audioVolume;
  if (typeof merged.audioPlaybackRate !== 'number' || isNaN(merged.audioPlaybackRate)) merged.audioPlaybackRate = DEFAULT_PARAMS.audioPlaybackRate;
  if (typeof merged.audioReactiveIntensity !== 'number' || isNaN(merged.audioReactiveIntensity)) merged.audioReactiveIntensity = DEFAULT_PARAMS.audioReactiveIntensity;

  // Validate enumeration fields
  const validGrids: GridType[] = ['annular', 'rectangular', 'polar', 'hexagonal', 'diamond', 'web'];
  if (!validGrids.includes(merged.gridType)) merged.gridType = DEFAULT_PARAMS.gridType;

  const validShapes: VoidShape[] = ['circle', 'square'];
  if (!validShapes.includes(merged.centerVoidShape)) merged.centerVoidShape = DEFAULT_PARAMS.centerVoidShape;

  const validEngines = ['gpu', 'wasm', 'js_cpu'];
  if (!validEngines.includes(merged.simulationEngine)) merged.simulationEngine = DEFAULT_PARAMS.simulationEngine;

  const validAudioSources = ['umbrafono', 'synth', 'hybrid'];
  if (!validAudioSources.includes(merged.audioSource)) merged.audioSource = DEFAULT_PARAMS.audioSource;

  // Booleans
  merged.flipHorizontal = Boolean(merged.flipHorizontal);
  merged.flipVertical = Boolean(merged.flipVertical);
  merged.showVoidGuide = Boolean(merged.showVoidGuide);
  merged.audioEnabled = Boolean(merged.audioEnabled);
  merged.audioLoop = Boolean(merged.audioLoop);
  merged.audioReactiveDrive = Boolean(merged.audioReactiveDrive);
  merged.audioResonanceFilter = Boolean(merged.audioResonanceFilter);
  merged.audioPitchLinked = Boolean(merged.audioPitchLinked);

  // String color checks
  if (typeof merged.sandColor !== 'string' || !merged.sandColor.startsWith('#')) merged.sandColor = DEFAULT_PARAMS.sandColor;
  if (typeof merged.sandColorSecondary !== 'string' || !merged.sandColorSecondary.startsWith('#')) merged.sandColorSecondary = DEFAULT_PARAMS.sandColorSecondary;
  if (typeof merged.plateColor !== 'string' || !merged.plateColor.startsWith('#')) merged.plateColor = DEFAULT_PARAMS.plateColor;
  if (typeof merged.glowColor !== 'string' || !merged.glowColor.startsWith('#')) merged.glowColor = DEFAULT_PARAMS.glowColor;
  if (typeof merged.paletteId !== 'string') merged.paletteId = DEFAULT_PARAMS.paletteId;

  return merged;
}

/**
 * Loads saved settings from storage.
 */
export function loadSavedSettings(): StorageLoadResult {
  const raw = storageGet(SETTINGS_STORAGE_KEY);
  const autoSaveRaw = storageGet(AUTOSAVE_STORAGE_KEY);
  const savedAt = storageGet(TIMESTAMP_STORAGE_KEY);
  const autoSave = autoSaveRaw !== null ? autoSaveRaw === 'true' : true;

  if (!raw) {
    return {
      params: { ...DEFAULT_PARAMS },
      hasSaved: false,
      autoSave,
      savedAt: null,
    };
  }

  try {
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeParams(parsed);
    return {
      params: sanitized,
      hasSaved: true,
      autoSave,
      savedAt,
    };
  } catch (err) {
    console.warn('[SettingsStorage] Error parsing settings JSON, reverting to default:', err);
    return {
      params: { ...DEFAULT_PARAMS },
      hasSaved: false,
      autoSave,
      savedAt: null,
    };
  }
}

/**
 * Saves current settings to storage with a timestamp.
 */
export function saveSettings(params: ChladniParams): { success: boolean; timestamp: string } {
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  try {
    const payload = JSON.stringify(params);
    const success = storageSet(SETTINGS_STORAGE_KEY, payload);
    if (success) {
      storageSet(TIMESTAMP_STORAGE_KEY, timestamp);
    }
    return { success, timestamp };
  } catch (err) {
    console.warn('[SettingsStorage] Failed to save settings:', err);
    return { success: false, timestamp };
  }
}

/**
 * Clears saved settings from storage.
 */
export function clearSavedSettings(): void {
  storageRemove(SETTINGS_STORAGE_KEY);
  storageRemove(TIMESTAMP_STORAGE_KEY);
}

/**
 * Saves the auto-save preference (true/false).
 */
export function setAutoSavePreference(enabled: boolean): void {
  storageSet(AUTOSAVE_STORAGE_KEY, String(enabled));
}

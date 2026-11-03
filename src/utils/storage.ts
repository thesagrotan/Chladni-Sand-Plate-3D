import { ChladniParams, DEFAULT_PARAMS, GridType, VoidShape } from '../types/chladni.ts';

export const SETTINGS_STORAGE_KEY = 'chladni_plate_saved_settings';
export const AUTOSAVE_STORAGE_KEY = 'chladni_plate_autosave_enabled';
export const TIMESTAMP_STORAGE_KEY = 'chladni_plate_saved_timestamp';
export const VERSION_HISTORY_KEY = 'chladni_plate_version_history';
export const MAX_VERSIONS = 10;

export interface SavedVersion {
  id: string;
  label: string;
  savedAt: string;
  params: ChladniParams;
}

interface StorageLoadResult {
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

export function storageGet(key: string): string | null {
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

export function storageSet(key: string, value: string): boolean {
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

function sanitizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function sanitizeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR_PATTERN.test(value) ? value : fallback;
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
  merged.modeM = sanitizeNumber(merged.modeM, DEFAULT_PARAMS.modeM, 1, 14);
  merged.modeN = sanitizeNumber(merged.modeN, DEFAULT_PARAMS.modeN, 1, 14);
  merged.waveK = sanitizeNumber(merged.waveK, DEFAULT_PARAMS.waveK, 10, 50);
  merged.symmetryBlend = sanitizeNumber(merged.symmetryBlend, DEFAULT_PARAMS.symmetryBlend, 0, 1);
  merged.driveStrength = sanitizeNumber(merged.driveStrength, DEFAULT_PARAMS.driveStrength, 0.5, 8);
  merged.grainCount = Math.round(sanitizeNumber(merged.grainCount, DEFAULT_PARAMS.grainCount, 5_000, 1_000_000));
  merged.grainSize = sanitizeNumber(merged.grainSize, DEFAULT_PARAMS.grainSize, 0.2, 4);
  merged.centerVoidRadius = sanitizeNumber(merged.centerVoidRadius, DEFAULT_PARAMS.centerVoidRadius, 0, 0.55);
  merged.centerExpulsion = sanitizeNumber(merged.centerExpulsion, DEFAULT_PARAMS.centerExpulsion, 0, 5);
  merged.domRepulsion = sanitizeNumber(merged.domRepulsion, DEFAULT_PARAMS.domRepulsion, 0, 10);
  merged.pointerForce = sanitizeNumber(merged.pointerForce, DEFAULT_PARAMS.pointerForce, 0, 4);
  merged.pointerRadius = sanitizeNumber(merged.pointerRadius, DEFAULT_PARAMS.pointerRadius, 0.02, 0.4);
  merged.rotationAngle = sanitizeNumber(merged.rotationAngle, DEFAULT_PARAMS.rotationAngle, 0, 360);
  merged.fieldOverlay = sanitizeNumber(merged.fieldOverlay, DEFAULT_PARAMS.fieldOverlay, 0, 1);
  merged.nodalPronouncement = sanitizeNumber(merged.nodalPronouncement, DEFAULT_PARAMS.nodalPronouncement, 0, 1);

  merged.fontWeight = Math.round(sanitizeNumber(merged.fontWeight, DEFAULT_PARAMS.fontWeight, 100, 900));
  merged.fontSpacingAxis = Math.round(sanitizeNumber(merged.fontSpacingAxis, DEFAULT_PARAMS.fontSpacingAxis, 0, 150));
  merged.fontElshAxis = Math.round(sanitizeNumber(merged.fontElshAxis, DEFAULT_PARAMS.fontElshAxis, 0, 100));
  merged.fontLetterSpacing = sanitizeNumber(merged.fontLetterSpacing, DEFAULT_PARAMS.fontLetterSpacing, -2, 10);

  merged.audioVolume = sanitizeNumber(merged.audioVolume, DEFAULT_PARAMS.audioVolume, 0, 1);
  merged.audioPlaybackRate = sanitizeNumber(merged.audioPlaybackRate, DEFAULT_PARAMS.audioPlaybackRate, 0.5, 2);
  merged.audioReactiveIntensity = sanitizeNumber(
    merged.audioReactiveIntensity,
    DEFAULT_PARAMS.audioReactiveIntensity,
    0,
    1
  );

  // Validate enumeration fields
  const validGrids: GridType[] = ['annular', 'rectangular', 'polar', 'hexagonal', 'diamond', 'web'];
  if (!validGrids.includes(merged.gridType)) merged.gridType = DEFAULT_PARAMS.gridType;

  const validShapes: VoidShape[] = ['circle', 'square'];
  if (!validShapes.includes(merged.centerVoidShape)) merged.centerVoidShape = DEFAULT_PARAMS.centerVoidShape;

  const validEngines = ['gpu', 'wasm', 'js_cpu'];
  if (!validEngines.includes(merged.simulationEngine)) merged.simulationEngine = DEFAULT_PARAMS.simulationEngine;

  const validAudioSources = ['umbrafono', 'synth', 'hybrid'];
  if (!validAudioSources.includes(merged.audioSource)) merged.audioSource = DEFAULT_PARAMS.audioSource;

  // Typography
  merged.fontFamily = sanitizeString(merged.fontFamily, DEFAULT_PARAMS.fontFamily);
  // Migrate the legacy default font (iA Writer Quattro V) to the current default
  if (merged.fontFamily === 'iAWriterQuattroV-Italic') {
    merged.fontFamily = DEFAULT_PARAMS.fontFamily;
    merged.fontItalic = true;
  } else if (merged.fontFamily === 'iAWriterQuattroV') {
    merged.fontFamily = DEFAULT_PARAMS.fontFamily;
  }
  merged.fontItalic = Boolean(merged.fontItalic);

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
  merged.sandColor = sanitizeColor(merged.sandColor, DEFAULT_PARAMS.sandColor);
  merged.sandColorSecondary = sanitizeColor(merged.sandColorSecondary, DEFAULT_PARAMS.sandColorSecondary);
  merged.plateColor = sanitizeColor(merged.plateColor, DEFAULT_PARAMS.plateColor);
  merged.glowColor = sanitizeColor(merged.glowColor, DEFAULT_PARAMS.glowColor);
  merged.paletteId = sanitizeString(merged.paletteId, DEFAULT_PARAMS.paletteId);

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

// ─── Version History ────────────────────────────────────────────────────────

/**
 * Returns the full list of saved versions, newest first.
 */
export function listVersions(): SavedVersion[] {
  const raw = storageGet(VERSION_HISTORY_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as SavedVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Saves the current params as a named version. Trims oldest beyond MAX_VERSIONS.
 * Returns the updated list.
 */
export function saveVersion(params: ChladniParams, label: string): SavedVersion[] {
  const versions = listVersions();
  const now = new Date();
  const savedAt = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const datePart = now.toLocaleDateString([], { month: 'short', day: 'numeric' });
  const newVersion: SavedVersion = {
    id: `v_${Date.now()}`,
    label: label.trim() || `${datePart} ${savedAt}`,
    savedAt: `${datePart} ${savedAt}`,
    params: { ...params },
  };
  // Newest first; trim to MAX_VERSIONS
  const next = [newVersion, ...versions].slice(0, MAX_VERSIONS);
  storageSet(VERSION_HISTORY_KEY, JSON.stringify(next));
  return next;
}

/**
 * Deletes a version by id. Returns the updated list.
 */
export function deleteVersion(id: string): SavedVersion[] {
  const versions = listVersions().filter((v) => v.id !== id);
  storageSet(VERSION_HISTORY_KEY, JSON.stringify(versions));
  return versions;
}

/**
 * Finds a saved version by id without reading the history twice.
 */
export function getVersion(id: string): SavedVersion | null {
  return listVersions().find((v) => v.id === id) ?? null;
}

/**
 * Finds a saved version and its sanitized params in a single lookup.
 */
export function restoreVersionEntry(id: string): { version: SavedVersion; params: ChladniParams } | null {
  const version = getVersion(id);
  return version ? { version, params: sanitizeParams(version.params) } : null;
}

/**
 * Finds and returns the params of a saved version by id, or null if not found.
 */
export function restoreVersion(id: string): ChladniParams | null {
  return restoreVersionEntry(id)?.params ?? null;
}

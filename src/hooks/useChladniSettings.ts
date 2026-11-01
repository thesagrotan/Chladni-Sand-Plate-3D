import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChladniParams } from '../types/chladni.ts';
import { DEFAULT_PARAMS } from '../types/chladni.ts';
import {
  clearSavedSettings,
  deleteVersion,
  listVersions,
  loadSavedSettings,
  restoreVersionEntry,
  saveSettings,
  saveVersion,
  setAutoSavePreference,
  type SavedVersion,
} from '../utils/storage.ts';
import { hydrateParams } from '../utils/settings.ts';

export function useChladniSettings() {
  const [initialSettings] = useState(loadSavedSettings);
  const [params, setParams] = useState<ChladniParams>(() => hydrateParams(initialSettings.params));
  const [hasSavedSettings, setHasSavedSettings] = useState<boolean>(initialSettings.hasSaved);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(initialSettings.autoSave);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(initialSettings.savedAt);
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>(() => listVersions());

  const isResettingRef = useRef(false);
  const isMountedRef = useRef(false);

  // Persist settings when auto-save is enabled, skipping the initial mount and
  // the parameter change caused by an explicit reset.
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (isResettingRef.current) {
      isResettingRef.current = false;
      return;
    }
    if (autoSaveEnabled) {
      const { timestamp } = saveSettings(params);
      setHasSavedSettings(true);
      setLastSavedTime(timestamp);
    }
  }, [params, autoSaveEnabled]);

  const save = useCallback(() => {
    const result = saveSettings(params);
    if (result.success) {
      setHasSavedSettings(true);
      setLastSavedTime(result.timestamp);
    }
    return result;
  }, [params]);

  const reset = useCallback(() => {
    isResettingRef.current = true;
    clearSavedSettings();
    setHasSavedSettings(false);
    setLastSavedTime(null);
    setParams({ ...DEFAULT_PARAMS });
  }, []);

  const toggleAutoSave = useCallback(() => {
    const next = !autoSaveEnabled;
    setAutoSaveEnabled(next);
    setAutoSavePreference(next);
    return next;
  }, [autoSaveEnabled]);

  const saveNamedVersion = useCallback(
    (label: string) => {
      const updated = saveVersion(params, label);
      setSavedVersions(updated);
      return updated;
    },
    [params]
  );

  const restoreNamedVersion = useCallback((id: string) => {
    const restored = restoreVersionEntry(id);
    if (restored) setParams(restored.params);
    return restored;
  }, []);

  const removeVersion = useCallback((id: string) => {
    const updated = deleteVersion(id);
    setSavedVersions(updated);
    return updated;
  }, []);

  return {
    params,
    setParams,
    hasSavedSettings,
    autoSaveEnabled,
    lastSavedTime,
    savedVersions,
    save,
    reset,
    toggleAutoSave,
    saveVersion: saveNamedVersion,
    restoreVersion: restoreNamedVersion,
    deleteVersion: removeVersion,
  };
}

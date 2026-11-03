import { useCallback, useEffect, useState } from 'react';
import {
  loadColorThemes,
  loadReleaseThemesEnabled,
  saveColorThemes,
  saveReleaseThemesEnabled,
  type ColorTheme,
} from '../utils/colorThemes.ts';

/**
 * Owns the editable colour-theme list and the release-theme opt-in, persisting
 * both independently of the simulation parameters so they survive a reset.
 */
export function useColorThemes() {
  const [colorThemes, setColorThemes] = useState<ColorTheme[]>(loadColorThemes);
  const [releaseThemesEnabled, setReleaseThemesEnabledState] = useState<boolean>(
    loadReleaseThemesEnabled
  );

  useEffect(() => {
    saveColorThemes(colorThemes);
  }, [colorThemes]);

  const setReleaseThemesEnabled = useCallback((enabled: boolean) => {
    setReleaseThemesEnabledState(enabled);
    saveReleaseThemesEnabled(enabled);
  }, []);

  return {
    colorThemes,
    setColorThemes,
    releaseThemesEnabled,
    setReleaseThemesEnabled,
  };
}

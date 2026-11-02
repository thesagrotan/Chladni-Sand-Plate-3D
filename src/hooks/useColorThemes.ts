import { useEffect, useState } from 'react';
import {
  loadColorThemes,
  saveColorThemes,
  type ColorTheme,
} from '../utils/colorThemes.ts';

/**
 * Owns the editable colour-theme list and persists it independently of the
 * simulation parameters, so theme definitions survive a params reset.
 */
export function useColorThemes() {
  const [colorThemes, setColorThemes] = useState<ColorTheme[]>(loadColorThemes);

  useEffect(() => {
    saveColorThemes(colorThemes);
  }, [colorThemes]);

  return { colorThemes, setColorThemes };
}

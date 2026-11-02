import React, { useEffect, useState } from 'react';
import { Palette, Plus, RotateCcw, Shuffle, Trash2 } from 'lucide-react';
import type { ChladniParams } from '../../types/chladni.ts';
import { RELEASES } from '../../data/releases.ts';
import {
  assignThemeToRelease,
  createThemeFromParams,
  defaultColorThemes,
  isThemeActive,
  themeToParams,
  type ColorTheme,
} from '../../utils/colorThemes.ts';
import type { UpdateParams } from './types.ts';

interface ColorThemesSectionProps {
  params: ChladniParams;
  updateParams: UpdateParams;
  colorThemes: ColorTheme[];
  setColorThemes: React.Dispatch<React.SetStateAction<ColorTheme[]>>;
}

const COLOR_FIELDS = [
  { key: 'sandPrimary', label: 'Sand' },
  { key: 'sandSecondary', label: 'Shading' },
  { key: 'plate', label: 'Plate' },
  { key: 'glow', label: 'Glow' },
] as const;

type ColorFieldKey = (typeof COLOR_FIELDS)[number]['key'];

export const ColorThemesSection: React.FC<ColorThemesSectionProps> = ({
  params,
  updateParams,
  colorThemes,
  setColorThemes,
}) => {
  const [editingId, setEditingId] = useState<string | null>(() => {
    return (
      colorThemes.find((theme) => theme.id === params.paletteId)?.id ??
      colorThemes[0]?.id ??
      null
    );
  });

  // Keep the editor in sync when a release applies a theme from outside the panel.
  useEffect(() => {
    if (colorThemes.some((theme) => theme.id === params.paletteId)) {
      setEditingId(params.paletteId);
    }
  }, [params.paletteId, colorThemes]);

  const editingTheme =
    colorThemes.find((theme) => theme.id === editingId) ?? colorThemes[0] ?? null;

  const applyTheme = (theme: ColorTheme) => {
    updateParams(themeToParams(theme));
  };

  const selectTheme = (theme: ColorTheme) => {
    setEditingId(theme.id);
    applyTheme(theme);
  };

  const updateColor = (key: ColorFieldKey, value: string) => {
    if (!editingTheme) return;
    const next: ColorTheme = { ...editingTheme, [key]: value };
    setColorThemes((prev) =>
      prev.map((theme) => (theme.id === editingTheme.id ? next : theme))
    );
    // Editing a theme is also a live preview of that theme.
    updateParams(themeToParams(next));
  };

  const updateName = (name: string) => {
    if (!editingTheme) return;
    setColorThemes((prev) =>
      prev.map((theme) => (theme.id === editingTheme.id ? { ...theme, name } : theme))
    );
  };

  const commitName = () => {
    if (!editingTheme || editingTheme.name.trim().length > 0) return;
    setColorThemes((prev) =>
      prev.map((theme) =>
        theme.id === editingTheme.id ? { ...theme, name: 'Untitled Theme' } : theme
      )
    );
  };

  const updateRelease = (releaseId: string) => {
    if (!editingTheme) return;
    setColorThemes((prev) =>
      assignThemeToRelease(prev, editingTheme.id, releaseId || null)
    );
  };

  const handleAddTheme = () => {
    const theme = createThemeFromParams(params, colorThemes.length);
    setColorThemes((prev) => [...prev, theme]);
    setEditingId(theme.id);
    updateParams({ paletteId: theme.id });
  };

  const handleDeleteTheme = () => {
    if (!editingTheme || colorThemes.length <= 1) return;
    const next = colorThemes.filter((theme) => theme.id !== editingTheme.id);
    setColorThemes(next);
    const fallback = next[0];
    if (fallback) {
      setEditingId(fallback.id);
      applyTheme(fallback);
    }
  };

  const handleResetThemes = () => {
    const defaults = defaultColorThemes();
    setColorThemes(defaults);
    setEditingId(defaults[0].id);
    applyTheme(defaults[0]);
  };

  const handleRandomize = () => {
    if (colorThemes.length === 0) return;
    const theme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
    selectTheme(theme);
  };

  const releaseCatalog = (releaseId: string | null) =>
    releaseId ? RELEASES.find((release) => release.id === releaseId)?.catalog : null;

  return (
    <div className="space-y-1.5" data-testid="color-themes-section">
      <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1.5">
          <Palette size={11} className="text-amber-400" />
          <span>Color Themes</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleAddTheme}
            className="p-1 rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
            title="New theme from the current plate colors"
            data-testid="add-theme"
          >
            <Plus size={11} />
          </button>
          <button
            type="button"
            onClick={handleRandomize}
            className="p-1 rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
            title="Apply a random theme"
          >
            <Shuffle size={11} />
          </button>
          <button
            type="button"
            onClick={handleResetThemes}
            className="p-1 rounded border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
            title="Restore the built-in themes"
          >
            <RotateCcw size={11} />
          </button>
        </div>
      </div>

      <p className="text-[9px] text-neutral-500 leading-tight">
        Edit a theme, then bind it to a release. Playing that release applies its theme;
        the previous palette returns when playback stops.
      </p>

      {/* Theme list */}
      <div className="space-y-1">
        {colorThemes.map((theme) => {
          const isSelected = theme.id === editingTheme?.id;
          const isApplied = isThemeActive(theme, params);
          const catalog = releaseCatalog(theme.releaseId);
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => selectTheme(theme)}
              data-testid={`theme-row-${theme.id}`}
              className={`w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md border text-[10px] text-left transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
                isSelected
                  ? 'bg-neutral-900 text-white border-cyan-400 shadow-xs ring-1 ring-cyan-400/40'
                  : 'bg-neutral-950/70 text-neutral-400 border-neutral-800 hover:text-neutral-200'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full border border-black/40 shadow-xs shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${theme.sandPrimary} 50%, ${theme.plate} 50%)`,
                }}
              />
              <span className="truncate flex-1">{theme.name}</span>
              {catalog && (
                <span className="px-1 py-0 rounded bg-neutral-900 text-amber-300 border border-amber-900/60 font-mono text-[8px] shrink-0">
                  {catalog}
                </span>
              )}
              {isSelected && (
                <span className="text-[8px] text-cyan-300 shrink-0">
                  {isApplied ? 'Active' : 'Editing'}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected theme editor */}
      {editingTheme && (
        <div
          className="p-2 rounded-lg bg-neutral-900/50 border border-neutral-800/70 space-y-2"
          data-testid="theme-editor"
        >
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={editingTheme.name}
              onChange={(e) => updateName(e.target.value)}
              onBlur={commitName}
              aria-label="Theme name"
              data-testid="theme-name-input"
              className="flex-1 min-w-0 bg-neutral-950 border border-neutral-700/80 rounded px-1.5 py-1 text-[10px] text-neutral-200 focus:outline-none focus:border-cyan-400"
            />
            <button
              type="button"
              onClick={handleDeleteTheme}
              disabled={colorThemes.length <= 1}
              className="p-1 rounded border border-neutral-800 bg-neutral-950 hover:bg-red-950/60 text-neutral-400 hover:text-red-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title={
                colorThemes.length <= 1
                  ? 'At least one theme is required'
                  : 'Delete this theme'
              }
            >
              <Trash2 size={11} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            {COLOR_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center justify-between">
                <span className="text-[10px] text-neutral-400">{field.label}</span>
                <input
                  type="color"
                  value={editingTheme[field.key]}
                  onChange={(e) => updateColor(field.key, e.target.value)}
                  aria-label={`${field.label} color`}
                  data-testid={`theme-color-${field.key}`}
                  className="w-5 h-5 rounded cursor-pointer border border-neutral-700 bg-transparent"
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-1 text-[10px] pt-1 border-t border-neutral-900">
            <span className="text-neutral-400">Plays on</span>
            <select
              value={editingTheme.releaseId ?? ''}
              onChange={(e) => updateRelease(e.target.value)}
              aria-label="Release assigned to this theme"
              data-testid="theme-release-select"
              className="max-w-[175px] bg-neutral-900 border border-neutral-700/80 rounded px-1.5 py-1 text-[10px] text-neutral-200 focus:outline-none focus:border-cyan-400 cursor-pointer truncate"
            >
              <option value="">No release</option>
              {RELEASES.map((release) => (
                <option key={release.id} value={release.id}>
                  {release.catalog} — {release.artist}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

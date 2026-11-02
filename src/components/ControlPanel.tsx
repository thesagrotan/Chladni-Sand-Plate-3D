import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  SlidersHorizontal,
  Grid,
  Dices,
  Music,
  Activity,
  Save,
  Check,
  Type,
  History,
  Copy,
} from 'lucide-react';
import { ChladniParams, AudioMetrics, FontOption, AVAILABLE_FONTS, DEFAULT_PARAMS } from '../types/chladni.ts';
import { SavedVersion } from '../utils/storage.ts';
import type { ColorTheme } from '../utils/colorThemes.ts';
import { GRID_CATALOG_BY_TYPE, randomizeGridParams } from '../utils/grid.ts';
import { findFont } from '../utils/fonts.ts';
import { GridSection } from './control/GridSection.tsx';
import { TypographySection } from './control/TypographySection.tsx';
import { ResonanceSection } from './control/ResonanceSection.tsx';
import { AudioSection } from './control/AudioSection.tsx';
import { PresetsSection, type PresetFilter } from './control/PresetsSection.tsx';
import { VersionHistory } from './control/VersionHistory.tsx';
import { FloatingActions } from './control/FloatingActions.tsx';

interface ControlPanelProps {
  params: ChladniParams;
  onChange: (params: ChladniParams) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onScatter: () => void;
  onSave?: () => void;
  onReset: () => void;
  isAudioEnabled: boolean;
  onToggleAudio: () => void;
  onOpenWasmLab?: () => void;
  audioMetrics?: AudioMetrics;
  hasSavedSettings?: boolean;
  autoSaveEnabled?: boolean;
  onToggleAutoSave?: () => void;
  lastSavedTime?: string | null;
  savedVersions?: SavedVersion[];
  onSaveVersion?: (label: string) => void;
  onRestoreVersion?: (id: string) => void;
  onDeleteVersion?: (id: string) => void;
  colorThemes: ColorTheme[];
  setColorThemes: React.Dispatch<React.SetStateAction<ColorTheme[]>>;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  params,
  onChange,
  isPaused,
  onTogglePause,
  onScatter,
  onSave,
  onReset,
  isAudioEnabled,
  onToggleAudio,
  onOpenWasmLab,
  audioMetrics,
  hasSavedSettings = false,
  autoSaveEnabled = true,
  onToggleAutoSave,
  lastSavedTime = null,
  savedVersions = [],
  onSaveVersion,
  onRestoreVersion,
  onDeleteVersion,
  colorThemes,
  setColorThemes,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'grid' | 'typo' | 'resonance' | 'audio'>('all');
  const [justSaved, setJustSaved] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [fontLoadError, setFontLoadError] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [presetFilter, setPresetFilter] = useState<PresetFilter>('empty-center');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const allFonts = useMemo(() => {
    return [...AVAILABLE_FONTS, ...customFonts];
  }, [customFonts]);

  const updateParam = <K extends keyof ChladniParams>(key: K, val: ChladniParams[K]) => {
    onChange({
      ...params,
      [key]: val,
    });
  };

  const updateParams = (updates: Partial<ChladniParams>) => {
    onChange({
      ...params,
      ...updates,
    });
  };

  const handleExperimentNextGrid = () => {
    onChange({ ...params, ...randomizeGridParams() });
  };

  const handleSaveClick = () => {
    onSave?.();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  /** Builds a prompt telling an agent which values to promote to defaults. */
  const buildDefaultPrompt = (): string => {
    const changes: string[] = [];
    for (const key of Object.keys(DEFAULT_PARAMS) as (keyof ChladniParams)[]) {
      if (params[key] !== DEFAULT_PARAMS[key]) {
        changes.push(`  ${key}: ${JSON.stringify(params[key])}`);
      }
    }
    const body =
      changes.length > 0
        ? [
            'Change the following keys in DEFAULT_PARAMS (src/types/chladni.ts) from their current default to these new values:',
            changes.join('\n'),
          ].join('\n')
        : 'The current parameters already match DEFAULT_PARAMS — no changes needed.';
    return [
      "Update the project's default parameters so the currently tweaked values become the new defaults.",
      body,
      '',
      'Keep every other field as-is, preserve formatting, and do not alter PRESETS, COLOR_PALETTES, or any other constants.',
    ].join('\n');
  };

  const handleCopyDefaultPrompt = async () => {
    const prompt = buildDefaultPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch {
      // Clipboard may be unavailable (e.g. iframe / non-secure context). Fall back to a textarea + execCommand.
      try {
        const ta = document.createElement('textarea');
        ta.value = prompt;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopiedPrompt(true);
        setTimeout(() => setCopiedPrompt(false), 2500);
      } catch {
        setCopiedPrompt(false);
      }
    }
  };

  const currentFont = findFont(allFonts, params.fontFamily) || allFonts[0];

  const shouldShow = (tab: 'grid' | 'typo' | 'resonance' | 'audio') => {
    return activeTab === 'all' || activeTab === tab;
  };

  return (
    <>
      {/* Right Drawer / Floating Panel */}
      <div
        data-ui-panel
        className={`fixed top-4 right-4 z-30 transition-transform duration-300 ease-in-out ${
          collapsed ? 'translate-x-[calc(100%+1.5rem)]' : 'translate-x-0'
        }`}
        style={{
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          letterSpacing: 'normal',
          ['--active-letter-spacing' as any]: 'normal',
        }}
      >
        <div
          data-ui-panel
          style={{
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: 'normal',
            fontVariationSettings: 'normal',
            ['--active-letter-spacing' as any]: 'normal',
          }}
          className="w-[360px] max-h-[calc(100vh-2rem)] flex flex-col rounded-xl bg-neutral-950/94 border border-neutral-800/80 shadow-2xl backdrop-blur-md text-neutral-200 select-none overflow-hidden"
        >
          {/* TOP FIXED BAR: Header, Status & Quick Tabs */}
          <div className="shrink-0 p-3 pb-2 border-b border-neutral-900 bg-neutral-950/80">
            {/* Title Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <h1 className="text-[14px] font-semibold text-white tracking-tight flex items-center gap-1.5">
                  <SlidersHorizontal size={14} className="text-cyan-400" />
                  <span>Chladni Grid Lab</span>
                </h1>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono">
                  Void & Flips
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleExperimentNextGrid}
                  className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 font-medium flex items-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer"
                  title="Generate random harmonic grid with empty center"
                >
                  <Dices size={11} className="text-cyan-400" />
                  <span>Random</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
                  title="Collapse panel"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Compact Session / Status Strip */}
            <div className="mt-2 flex items-center justify-between text-[10px] bg-neutral-900/70 px-2 py-1 rounded-md border border-neutral-800/70">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    hasSavedSettings
                      ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]'
                      : 'bg-neutral-500'
                  }`}
                  title={hasSavedSettings ? 'Saved Session Active' : 'Default Configuration'}
                />
                <span className="text-neutral-300 truncate font-mono text-[9px]">
                  <span className="text-cyan-300">{GRID_CATALOG_BY_TYPE[params.gridType]?.label || params.gridType}</span>
                </span>
              </div>

              {/* Action Buttons: Save, Reset, History */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleSaveClick}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
                    justSaved
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border-neutral-700'
                  }`}
                  title="Save parameters to local storage"
                >
                  {justSaved ? <Check size={10} className="text-emerald-400" /> : <Save size={10} className="text-cyan-400" />}
                  <span>{justSaved ? 'Saved' : 'Save'}</span>
                </button>

                <button
                  type="button"
                  onClick={onReset}
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 flex items-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer"
                  title="Reset to factory defaults"
                >
                  <RotateCcw size={10} className={hasSavedSettings ? 'text-amber-400' : 'text-neutral-400'} />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyDefaultPrompt}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
                    copiedPrompt
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                      : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 hover:text-white border-neutral-800'
                  }`}
                  title="Copy a prompt for an agent to set the currently changed values as defaults"
                >
                  {copiedPrompt ? <Check size={10} className="text-emerald-400" /> : <Copy size={10} className="text-cyan-400" />}
                  <span>{copiedPrompt ? 'Copied' : 'Prompts'}</span>
                </button>

                {onSaveVersion && (
                  <button
                    type="button"
                    onClick={() => setShowVersionHistory((prev) => !prev)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-0.5 transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
                      showVersionHistory
                        ? 'bg-indigo-950 border-indigo-500 text-indigo-300'
                        : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                    title="Toggle version history"
                  >
                    <History size={10} className="text-indigo-400" />
                    <span>{savedVersions.length}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Auto Options Row (Micro toggles) */}
            <div className="mt-1 flex items-center justify-between text-[9px] text-neutral-400 px-1">
              {onToggleAutoSave && (
                <label className="flex items-center gap-1 cursor-pointer hover:text-neutral-200">
                  <input
                    type="checkbox"
                    checked={autoSaveEnabled}
                    onChange={onToggleAutoSave}
                    className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0 cursor-pointer w-2.5 h-2.5"
                  />
                  <span>Auto-save</span>
                </label>
              )}
              {lastSavedTime && (
                <span className="text-[9px] text-neutral-500 font-mono truncate">{lastSavedTime}</span>
              )}
            </div>

            {/* Version History Collapsible Box */}
            {showVersionHistory && onSaveVersion && (
              <VersionHistory
                savedVersions={savedVersions}
                onSaveVersion={onSaveVersion}
                onRestoreVersion={onRestoreVersion}
                onDeleteVersion={onDeleteVersion}
                versionLabel={versionLabel}
                setVersionLabel={setVersionLabel}
              />
            )}

            {/* Quick Filter Tabs: All, Grid, Typo, Resonance, Audio */}
            <div className="grid grid-cols-5 gap-1 mt-2 pt-1 border-t border-neutral-900 text-[10px]">
              {[
                { id: 'all', label: 'All', icon: <SlidersHorizontal size={10} /> },
                { id: 'grid', label: 'Grid', icon: <Grid size={10} /> },
                { id: 'typo', label: 'Style', icon: <Type size={10} /> },
                { id: 'resonance', label: 'Physics', icon: <Activity size={10} /> },
                { id: 'audio', label: 'Audio', icon: <Music size={10} /> },
              ].map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-1 rounded flex items-center justify-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer font-medium ${
                      isActive
                        ? 'bg-cyan-950 text-cyan-200 border border-cyan-700/80 shadow-xs'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SCROLLABLE MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-neutral-800">
            {/* 1. GRID TOPOLOGY & ORIENTATION SECTION */}
            {shouldShow('grid') && <GridSection params={params} updateParam={updateParam} />}

            {/* 2. STYLE, COLORS & TYPOGRAPHY SECTION */}
            {shouldShow('typo') && (
              <TypographySection
                params={params}
                updateParam={updateParam}
                updateParams={updateParams}
                allFonts={allFonts}
                currentFont={currentFont}
                setCustomFonts={setCustomFonts}
                fontLoadError={fontLoadError}
                setFontLoadError={setFontLoadError}
                colorThemes={colorThemes}
                setColorThemes={setColorThemes}
              />
            )}

            {/* 3. RESONANCE & SAND SECTION */}
            {shouldShow('resonance') && (
              <ResonanceSection
                params={params}
                updateParam={updateParam}
                audioMetrics={audioMetrics}
                onOpenWasmLab={onOpenWasmLab}
              />
            )}

            {/* 4. ACOUSTIC SOUND & PRESETS SECTION */}
            {shouldShow('audio') && (
              <div className="space-y-2">
                <AudioSection
                  params={params}
                  updateParam={updateParam}
                  isAudioEnabled={isAudioEnabled}
                  onToggleAudio={onToggleAudio}
                  audioMetrics={audioMetrics}
                />
                <PresetsSection
                  params={params}
                  onChange={onChange}
                  showPresets={showPresets}
                  setShowPresets={setShowPresets}
                  presetFilter={presetFilter}
                  setPresetFilter={setPresetFilter}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expand Button when collapsed */}
      {collapsed && (
        <button
          type="button"
          data-ui-panel
          onClick={() => setCollapsed(false)}
          className="fixed top-4 right-4 z-30 p-2 rounded-lg bg-neutral-950/90 text-neutral-300 hover:text-white border border-neutral-800 shadow-xl backdrop-blur transition-[background-color,border-color,color,opacity,transform] flex items-center gap-1.5 text-xs cursor-pointer"
          style={{
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            letterSpacing: 'normal',
            ['--active-letter-spacing' as any]: 'normal',
          }}
          title="Open controls"
        >
          <ChevronLeft size={16} />
          <span>Grid Controls</span>
        </button>
      )}

      <FloatingActions
        params={params}
        updateParam={updateParam}
        updateParams={updateParams}
        allFonts={allFonts}
        currentFont={currentFont}
        isPaused={isPaused}
        onTogglePause={onTogglePause}
        onScatter={onScatter}
        onSave={handleSaveClick}
        onReset={onReset}
        isAudioEnabled={isAudioEnabled}
        onToggleAudio={onToggleAudio}
        onOpenWasmLab={onOpenWasmLab}
        hasSavedSettings={hasSavedSettings}
        justSaved={justSaved}
      />
    </>
  );
};

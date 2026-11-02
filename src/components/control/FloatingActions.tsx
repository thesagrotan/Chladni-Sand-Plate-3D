import React from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  FlipHorizontal,
  FlipVertical,
  Zap,
  Save,
  Check,
  Type,
} from 'lucide-react';
import { ChladniParams, FontOption } from '../../types/chladni.ts';
import { nextFontUpdates } from '../../utils/fonts.ts';
import type { UpdateParam, UpdateParams } from './types.ts';

interface FloatingActionsProps {
  params: ChladniParams;
  updateParam: UpdateParam;
  updateParams: UpdateParams;
  allFonts: FontOption[];
  currentFont: FontOption;
  isPaused: boolean;
  onTogglePause: () => void;
  onScatter: () => void;
  onSave?: () => void;
  onReset: () => void;
  isAudioEnabled: boolean;
  onToggleAudio: () => void;
  onOpenWasmLab?: () => void;
  hasSavedSettings: boolean;
  justSaved: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
  params,
  updateParam,
  updateParams,
  allFonts,
  currentFont,
  isPaused,
  onTogglePause,
  onScatter,
  onSave,
  onReset,
  isAudioEnabled,
  onToggleAudio,
  onOpenWasmLab,
  hasSavedSettings,
  justSaved,
}) => {
  return (
    <div
      data-ui-panel
      className="fixed bottom-5 right-5 z-30 flex items-center gap-1.5 select-none flex-wrap justify-end"
      style={{
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        letterSpacing: 'normal',
        ['--active-letter-spacing' as any]: 'normal',
      }}
    >
      {/* WASM Research Lab Quick Button */}
      {onOpenWasmLab && (
        <button
          type="button"
          onClick={onOpenWasmLab}
          className="h-8 px-2.5 rounded-lg flex items-center gap-1 text-xs font-semibold border shadow-xl bg-gradient-to-r from-cyan-950/90 to-indigo-950/90 border-cyan-500/60 text-cyan-300 hover:text-white hover:border-cyan-400 backdrop-blur transition-[background-color,border-color,color,opacity,transform] cursor-pointer group"
          title="Open WebAssembly Performance Research & Live Benchmarking Lab"
        >
          <Zap size={12} className="text-cyan-400 group-hover:scale-110 transition-transform" />
          <span>WASM Lab</span>
        </button>
      )}

      {/* Quick Font Picker Cycle Button */}
      <button
        type="button"
        onClick={() => {
          const updates = nextFontUpdates(allFonts, params);
          if (updates) updateParams(updates);
        }}
        className="h-8 px-2.5 rounded-lg border border-cyan-800/60 bg-neutral-900/90 hover:bg-neutral-800 text-cyan-300 hover:text-white shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] flex items-center gap-1 text-xs font-medium cursor-pointer"
        title={`Active Font: ${currentFont?.name || params.fontFamily} — Click to cycle fonts`}
      >
        <Type size={12} className="text-cyan-400" />
        <span className="max-w-[100px] truncate">{currentFont?.name || 'Font'}</span>
      </button>

      {/* Quick Flip H Toggle */}
      <button
        type="button"
        onClick={() => updateParam('flipHorizontal', !params.flipHorizontal)}
        className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium border shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
          params.flipHorizontal
            ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300'
            : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
        }`}
        title="Flip canvas horizontally (Mirror X)"
      >
        <FlipHorizontal size={13} />
        <span className="hidden md:inline">Flip H</span>
      </button>

      {/* Quick Flip V Toggle */}
      <button
        type="button"
        onClick={() => updateParam('flipVertical', !params.flipVertical)}
        className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium border shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
          params.flipVertical
            ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300'
            : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
        }`}
        title="Flip canvas vertically (Mirror Y)"
      >
        <FlipVertical size={13} />
        <span className="hidden md:inline">Flip V</span>
      </button>

      {/* Audio Resonant Tone Toggle */}
      <button
        type="button"
        onClick={onToggleAudio}
        className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium border shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
          isAudioEnabled
            ? 'bg-amber-950/80 border-amber-500/60 text-amber-200 hover:border-amber-400 shadow-amber-950/40'
            : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
        }`}
        title={
          isAudioEnabled
            ? `Sound active: ${params.audioSource} (${Math.round(params.audioVolume * 100)}%)`
            : 'Turn sound on'
        }
      >
        {isAudioEnabled ? (
          <>
            <Volume2 size={13} className="text-amber-400 animate-pulse" />
            <span className="hidden sm:inline font-mono capitalize">{params.audioSource}</span>
            <span className="text-[10px] text-amber-400 font-mono">
              {Math.round(params.audioVolume * 100)}%
            </span>
          </>
        ) : (
          <>
            <VolumeX size={13} />
            <span className="hidden sm:inline">Muted</span>
          </>
        )}
      </button>

      {/* Pause / Play */}
      <button
        type="button"
        onClick={onTogglePause}
        className="h-8 px-2.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] flex items-center gap-1 text-xs font-medium cursor-pointer"
      >
        {isPaused ? <Play size={12} /> : <Pause size={12} />}
        <span>{isPaused ? 'Play' : 'Pause'}</span>
      </button>

      {/* Scatter */}
      <button
        type="button"
        onClick={onScatter}
        className="h-8 px-2.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] flex items-center gap-1 text-xs font-medium cursor-pointer"
        title="Scatter grains randomly across plate (S)"
      >
        <Sparkles size={12} />
        <span>Scatter</span>
      </button>

      {/* Save Settings */}
      <button
        type="button"
        onClick={onSave}
        className={`h-8 px-2.5 rounded-lg border shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] flex items-center gap-1 text-xs font-medium cursor-pointer ${
          justSaved
            ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
            : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-800 hover:border-neutral-700 text-neutral-200 hover:text-white'
        }`}
        title="Save current parameters to browser storage"
      >
        {justSaved ? <Check size={12} className="text-emerald-400" /> : <Save size={12} className="text-cyan-400" />}
        <span>{justSaved ? 'Saved!' : 'Save'}</span>
      </button>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className={`h-8 px-2.5 rounded-lg border shadow-lg backdrop-blur transition-[background-color,border-color,color,opacity,transform] flex items-center gap-1 text-xs font-medium cursor-pointer ${
          hasSavedSettings
            ? 'bg-neutral-900/90 hover:bg-neutral-800 border-amber-600/40 text-neutral-200 hover:text-white'
            : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-800 text-neutral-200 hover:text-white'
        }`}
        title={
          hasSavedSettings
            ? 'Reset parameters to default and clear saved session (R)'
            : 'Reset parameters to default (R)'
        }
      >
        <RotateCcw size={12} className={hasSavedSettings ? 'text-amber-400' : 'text-neutral-400'} />
        <span>Reset</span>
      </button>
    </div>
  );
};

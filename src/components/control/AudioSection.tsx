import React from 'react';
import { Music, Volume2, VolumeX, Radio, Activity, Waves } from 'lucide-react';
import { ChladniParams, AudioMetrics } from '../../types/chladni.ts';
import { plateAudio } from '../../simulation/audioSynth.ts';
import { SliderRow } from './SliderRow.tsx';
import { AudioVisualizer } from './AudioVisualizer.tsx';
import { formatTime } from './formatTime.ts';
import type { UpdateParam } from './types.ts';

interface AudioSectionProps {
  params: ChladniParams;
  updateParam: UpdateParam;
  isAudioEnabled: boolean;
  onToggleAudio: () => void;
  audioMetrics?: AudioMetrics;
}

export const AudioSection: React.FC<AudioSectionProps> = ({
  params,
  updateParam,
  isAudioEnabled,
  onToggleAudio,
  audioMetrics,
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 flex items-center gap-1.5">
          <Music size={11} className="text-amber-400" />
          <span>Acoustic Audio</span>
        </span>
        <button
          type="button"
          onClick={onToggleAudio}
          className={`text-[9px] px-1.5 py-0.5 rounded font-medium border flex items-center gap-1 transition-all cursor-pointer ${
            isAudioEnabled
              ? 'bg-amber-950 text-amber-300 border-amber-600/70 shadow-xs'
              : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
          }`}
        >
          {isAudioEnabled ? <Volume2 size={10} className="text-amber-400" /> : <VolumeX size={10} />}
          <span>{isAudioEnabled ? 'On' : 'Muted'}</span>
        </button>
      </div>

      {/* Audio Card with Visualizer & Scrubber */}
      <div className="p-2 rounded-lg bg-neutral-950/70 border border-neutral-800/80 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <div className="truncate flex items-center gap-1">
            <Radio size={10} className="text-amber-400 shrink-0" />
            <span className="text-neutral-200 font-medium truncate">Umbráfono (Enrique del Castillo)</span>
          </div>
          <span className="text-[8px] px-1 py-0 rounded bg-neutral-900 text-amber-300 border border-amber-900/60 font-mono shrink-0">
            Optical
          </span>
        </div>

        <AudioVisualizer isEnabled={isAudioEnabled} />

        {/* Scrubber */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between text-[9px] font-mono text-neutral-400">
            <span className="text-amber-300/90">{formatTime(audioMetrics?.currentTime ?? 0)}</span>
            <span>{audioMetrics?.duration ? formatTime(audioMetrics.duration) : '05:04'}</span>
          </div>
          <input
            type="range"
            min={0}
            max={audioMetrics?.duration || 304}
            step={0.5}
            value={audioMetrics?.currentTime || 0}
            onChange={(e) => plateAudio.seek(parseFloat(e.target.value))}
            disabled={!isAudioEnabled}
            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300 disabled:opacity-30"
          />
        </div>
      </div>

      {/* Source Selector: 3-Segment Control */}
      <div className="grid grid-cols-3 gap-1">
        {[
          { id: 'umbrafono', label: 'Umbráfono' },
          { id: 'synth', label: 'Modal Synth' },
          { id: 'hybrid', label: 'Hybrid' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => updateParam('audioSource', s.id as any)}
            className={`py-1 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${
              params.audioSource === s.id
                ? 'bg-amber-400 text-neutral-950 border-amber-300 font-bold shadow-xs'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <SliderRow
        label="Volume"
        value={params.audioVolume}
        min={0.0}
        max={1.0}
        step={0.05}
        digits={2}
        formatFn={(v) => `${Math.round(v * 100)}%`}
        onChange={(val) => updateParam('audioVolume', val)}
      />

      <SliderRow
        label="Pitch / Speed"
        value={params.audioPlaybackRate}
        min={0.5}
        max={2.0}
        step={0.05}
        digits={2}
        formatFn={(v) => `${v.toFixed(2)}x`}
        onChange={(val) => updateParam('audioPlaybackRate', val)}
      />

      {/* Audio-Reactive & Filter Toggles (Compact Cards) */}
      <div className="p-2 rounded-lg bg-neutral-900/40 border border-neutral-850 space-y-2 text-xs">
        {/* Cymatics Toggle */}
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white flex items-center gap-1 font-medium">
            <Activity size={10} className="text-cyan-400" />
            <span>Audio-Reactive Cymatics</span>
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={params.audioReactiveDrive}
              onChange={(e) => updateParam('audioReactiveDrive', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
          </label>
        </div>

        {params.audioReactiveDrive && (
          <div className="pl-1.5 border-l-2 border-cyan-500/40 space-y-1">
            <SliderRow
              label="Reactive depth"
              value={params.audioReactiveIntensity}
              min={0.0}
              max={2.0}
              step={0.05}
              digits={2}
              formatFn={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => updateParam('audioReactiveIntensity', val)}
            />
            {audioMetrics && (
              <div className="grid grid-cols-4 gap-1 text-[8px] font-mono text-center pt-0.5">
                <div className="bg-neutral-950 p-0.5 rounded border border-neutral-800 text-cyan-300">
                  BASS {Math.round(audioMetrics.bass * 100)}%
                </div>
                <div className="bg-neutral-950 p-0.5 rounded border border-neutral-800 text-cyan-300">
                  MID {Math.round(audioMetrics.mid * 100)}%
                </div>
                <div className="bg-neutral-950 p-0.5 rounded border border-neutral-800 text-cyan-300">
                  HI {Math.round(audioMetrics.treble * 100)}%
                </div>
                <div className="bg-neutral-950 p-0.5 rounded border border-neutral-800 text-amber-300">
                  KICK {Math.round(audioMetrics.transientKick * 100)}%
                </div>
              </div>
            )}
          </div>
        )}

        {/* Resonance Filters Audio Toggle */}
        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-neutral-900">
          <span className="text-white flex items-center gap-1 font-medium">
            <Waves size={10} className="text-amber-400" />
            <span>Resonance Filters Audio</span>
          </span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={params.audioResonanceFilter}
              onChange={(e) => updateParam('audioResonanceFilter', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>

        {/* Pitch Linked to Mode Frequency Toggle */}
        <div className="flex items-center justify-between text-[10px] pt-1 border-t border-neutral-900">
          <span className="text-white font-medium">Pitch Linked to Mode</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={params.audioPitchLinked}
              onChange={(e) => updateParam('audioPitchLinked', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
          </label>
        </div>
      </div>
    </div>
  );
};

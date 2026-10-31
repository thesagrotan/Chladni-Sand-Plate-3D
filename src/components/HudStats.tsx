import React from 'react';
import { Cpu, Zap, Activity } from 'lucide-react';
import { ChladniMetrics, ChladniParams, GRID_TYPE_LABELS } from '../types/chladni.ts';

interface HudStatsProps {
  metrics: ChladniMetrics;
  params: ChladniParams;
  onOpenWasmLab?: () => void;
  onToggleAudio?: () => void;
}

export const HudStats: React.FC<HudStatsProps> = ({
  metrics,
  params,
  onOpenWasmLab,
  onToggleAudio,
}) => {
  const settled = Math.min(100, Math.max(0, metrics.settledPercent));
  const activeFraction = Math.min(1, Math.max(0, metrics.activeFraction));
  const hasVoid = params.centerVoidRadius > 0.01;
  const clearance = Math.min(100, Math.max(0, metrics.centerClearance ?? 100));
  const gridInfo = GRID_TYPE_LABELS[params.gridType] || { label: params.gridType };
  const engine = metrics.activeEngine || params.simulationEngine || 'gpu';

  const engineDetails = {
    gpu: {
      label: 'WebGL GPGPU',
      color: 'text-cyan-400',
      badgeBg: 'bg-cyan-950/80 border-cyan-700/50 text-cyan-300',
      dotColor: 'bg-cyan-400',
    },
    wasm: {
      label: 'WebAssembly SIMD',
      color: 'text-emerald-400',
      badgeBg: 'bg-emerald-950/80 border-emerald-600/50 text-emerald-300',
      dotColor: 'bg-emerald-400',
    },
    js_cpu: {
      label: 'JavaScript CPU',
      color: 'text-amber-400',
      badgeBg: 'bg-amber-950/80 border-amber-600/50 text-amber-300',
      dotColor: 'bg-amber-400',
    },
  }[engine];

  return (
    <div className="absolute top-5 left-5 z-20 pointer-events-none select-none font-sans flex flex-col gap-2">
      {/* Active Grid Badge & Wasm Research Trigger */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-900/90 border border-neutral-700/60 text-neutral-200 backdrop-blur shadow-sm">
          {gridInfo.label}
        </span>
        {hasVoid && (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium backdrop-blur shadow-sm transition-colors border ${
              clearance > 85
                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                : 'bg-amber-950/70 border-amber-500/40 text-amber-300'
            }`}
          >
            Center Void {params.centerVoidShape === 'circle' ? '◯' : '▢'} {params.centerVoidRadius.toFixed(2)}
          </span>
        )}
        {(params.flipHorizontal || params.flipVertical || params.rotationAngle > 0) && (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-900/90 border border-cyan-800/60 text-cyan-300 backdrop-blur shadow-sm font-mono">
            {params.flipHorizontal ? '⇄' : ''}
            {params.flipVertical ? '⇅' : ''}
            {params.rotationAngle > 0 ? ` ${params.rotationAngle}°` : ''}
          </span>
        )}

        {/* Audio Active Badge */}
        {params.audioEnabled && (
          <button
            type="button"
            onClick={onToggleAudio}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-950/80 border border-amber-500/50 text-amber-300 hover:text-white transition-all shadow-md backdrop-blur group cursor-pointer"
            title={`Sound active: ${
              params.audioSource === 'umbrafono'
                ? 'Umbráfono (Enrique del Castillo)'
                : params.audioSource === 'synth'
                ? 'Modal Synth'
                : 'Hybrid Audio'
            }${params.audioReactiveDrive ? ' · Reactive Cymatics' : ''}`}
          >
            <span className="flex items-end gap-0.5 h-2.5">
              <span className="w-0.5 bg-amber-400 rounded-xs animate-pulse h-2" />
              <span
                className="w-0.5 bg-amber-300 rounded-xs animate-pulse h-3"
                style={{ animationDelay: '150ms' }}
              />
              <span
                className="w-0.5 bg-amber-400 rounded-xs animate-pulse h-1.5"
                style={{ animationDelay: '300ms' }}
              />
            </span>
            <span>
              {params.audioSource === 'umbrafono'
                ? 'Umbráfono'
                : params.audioSource === 'synth'
                ? 'Modal Synth'
                : 'Hybrid Audio'}
            </span>
            {params.audioReactiveDrive && (
              <span className="px-1 rounded bg-amber-900/60 text-[9px] text-amber-200 font-mono">
                Reactive
              </span>
            )}
          </button>
        )}

        {/* Wasm Research Lab Button */}
        {onOpenWasmLab && (
          <button
            type="button"
            onClick={onOpenWasmLab}
            className="pointer-events-auto flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gradient-to-r from-cyan-950/90 to-indigo-950/90 border border-cyan-500/60 text-cyan-300 hover:text-white hover:border-cyan-400 transition-all shadow-md backdrop-blur group cursor-pointer"
            title="Open WebAssembly Performance Research Lab & Live Benchmarks"
          >
            <Zap size={11} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>WASM Lab</span>
          </button>
        )}
      </div>

      {/* Settled on Nodes Metric */}
      <div className="bg-neutral-950/70 border border-neutral-800/70 backdrop-blur-md rounded-xl p-3 w-56 shadow-xl space-y-2.5">
        <div>
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-neutral-400 font-normal">settled on nodes</span>
            <span className="text-white font-mono font-medium tabular-nums text-sm">
              {settled.toFixed(1)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-[3px] bg-neutral-800/80 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-neutral-200 transition-all duration-150 ease-out rounded-full"
              style={{ width: `${settled}%` }}
            />
          </div>
        </div>

        {/* Center Void Clearance Indicator */}
        {hasVoid && (
          <div className="pt-2 border-t border-neutral-850">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-neutral-400 font-normal flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                center cleared
              </span>
              <span
                className={`font-mono font-semibold tabular-nums text-xs ${
                  clearance > 85 ? 'text-emerald-300' : 'text-amber-300'
                }`}
              >
                {clearance.toFixed(1)}% empty
              </span>
            </div>
            <div className="w-full h-[3px] bg-neutral-800/80 rounded-full mt-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-150 ease-out rounded-full ${
                  clearance > 85 ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
                style={{ width: `${clearance}%` }}
              />
            </div>
          </div>
        )}

        {/* Engine Performance Telemetry */}
        <div className="pt-2 border-t border-neutral-850">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${engineDetails.dotColor} inline-block animate-pulse`} />
              {engineDetails.label}
            </span>
            <span className="font-mono text-neutral-300 tabular-nums">
              {metrics.computeTimeMs != null ? `${metrics.computeTimeMs.toFixed(1)}ms` : '--'}
            </span>
          </div>

          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>Frame Rate:</span>
            <span className="font-mono text-neutral-300">
              {metrics.fps != null ? `${metrics.fps.toFixed(0)} FPS` : '60 FPS'}
            </span>
          </div>
        </div>

        {/* a(x) > a0 metric */}
        <div className="flex items-baseline justify-between pt-1.5 border-t border-neutral-900 text-xs">
          <span className="text-neutral-500 font-normal">
            a(x) &gt; a<sub className="text-[10px]">0</sub> active
          </span>
          <span className="text-neutral-300 font-mono tabular-nums text-xs">
            {activeFraction.toFixed(2)}
          </span>
        </div>

        {/* Acoustic Resonance & Audio Metrics */}
        {params.audioEnabled && metrics.audio && (
          <div className="pt-2 border-t border-neutral-900">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-amber-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
                Resonance Pitch
              </span>
              <span className="font-mono text-amber-300 text-xs font-semibold">
                {metrics.audio.resonanceFreq} Hz
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-neutral-400">
              <span>Audio Level (RMS)</span>
              <span className="font-mono text-neutral-300">
                {(metrics.audio.rms * 100).toFixed(0)}%
              </span>
            </div>
            <div className="w-full h-[2px] bg-neutral-800 rounded-full mt-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-cyan-400 transition-all duration-75"
                style={{ width: `${Math.min(100, metrics.audio.rms * 220)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

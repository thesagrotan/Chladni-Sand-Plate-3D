import React from 'react';
import { Activity, Boxes, Zap } from 'lucide-react';
import { ChladniParams, AudioMetrics } from '../../types/chladni.ts';
import { SliderRow } from './SliderRow.tsx';
import type { UpdateParam } from './types.ts';

interface ResonanceSectionProps {
  params: ChladniParams;
  updateParam: UpdateParam;
  audioMetrics?: AudioMetrics;
  onOpenWasmLab?: () => void;
}

export const ResonanceSection: React.FC<ResonanceSectionProps> = ({
  params,
  updateParam,
  audioMetrics,
  onOpenWasmLab,
}) => {
  const grainCountOptions = [
    { label: '5k', value: 5_000 },
    { label: '10k', value: 10_000 },
    { label: '25k', value: 25_000 },
    { label: '50k', value: 50_000 },
    { label: '100k', value: 100_000 },
    { label: '250k', value: 250_000 },
    { label: '500k', value: 500_000 },
    { label: '1M', value: 1_000_000 },
  ];

  const grainSizeOptions = [
    { label: 'Fine', value: 0.6 },
    { label: 'Normal', value: 1.0 },
    { label: 'Medium', value: 1.6 },
    { label: 'Coarse', value: 2.5 },
  ];

  return (
    <div className="space-y-2">
      {/* Resonance Frequencies */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1.5">
            <Activity size={11} className="text-cyan-400" />
            <span>Resonance Frequencies</span>
          </span>
          {audioMetrics && (
            <span className="text-[9px] text-amber-400 font-mono">
              ~{audioMetrics.resonanceFreq} Hz
            </span>
          )}
        </div>

        <SliderRow
          label="Mode m (radial/horiz)"
          value={params.modeM}
          min={1.0}
          max={14.0}
          step={0.05}
          digits={2}
          onChange={(val) => updateParam('modeM', val)}
        />
        <SliderRow
          label="Mode n (azimuthal/vert)"
          value={params.modeN}
          min={1.0}
          max={14.0}
          step={0.05}
          digits={2}
          onChange={(val) => updateParam('modeN', val)}
        />
        <SliderRow
          label="Wave number k"
          value={params.waveK}
          min={10.0}
          max={50.0}
          step={0.05}
          digits={2}
          onChange={(val) => updateParam('waveK', val)}
        />
        <SliderRow
          label="Symmetry blend"
          value={params.symmetryBlend}
          min={0.0}
          max={1.0}
          step={0.01}
          digits={2}
          onChange={(val) => updateParam('symmetryBlend', val)}
        />
      </div>

      {/* Sand & Physics Controls */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1.5">
            <Boxes size={11} className="text-amber-400" />
            <span>Sand & Simulation</span>
          </span>
        </div>

        <SliderRow
          label="Drive strength a"
          value={params.driveStrength}
          min={0.5}
          max={8.0}
          step={0.05}
          digits={2}
          onChange={(val) => updateParam('driveStrength', val)}
        />

        {/* Grain Count: Slider + Compact 8-Col Preset Row */}
        <div className="space-y-1 pt-0.5">
          <SliderRow
            label="Grain count"
            value={params.grainCount}
            min={5000}
            max={1000000}
            step={5000}
            digits={0}
            formatFn={(val) =>
              val >= 1_000_000
                ? '1M'
                : val >= 1000
                ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k`
                : val.toLocaleString()
            }
            onChange={(val) => updateParam('grainCount', Math.round(val))}
          />
          <div className="grid grid-cols-8 gap-0.5">
            {grainCountOptions.map((opt) => {
              const isMatch = Math.abs(params.grainCount - opt.value) < opt.value * 0.12;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateParam('grainCount', opt.value)}
                  className={`text-[8px] py-0.5 rounded border text-center font-mono cursor-pointer transition-all ${
                    isMatch
                      ? 'bg-neutral-200 text-neutral-950 font-bold border-white shadow-xs'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grain Size: Slider + 4 Presets */}
        <div className="space-y-1 pt-0.5">
          <SliderRow
            label="Grain size"
            value={params.grainSize ?? 1.0}
            min={0.2}
            max={4.0}
            step={0.1}
            digits={1}
            formatFn={(val) => `${val.toFixed(1)}x`}
            onChange={(val) => updateParam('grainSize', val)}
          />
          <div className="grid grid-cols-4 gap-1">
            {grainSizeOptions.map((opt) => {
              const current = params.grainSize ?? 1.0;
              const isMatch = Math.abs(current - opt.value) < 0.15;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => updateParam('grainSize', opt.value)}
                  className={`text-[9px] py-0.5 rounded border text-center cursor-pointer transition-all ${
                    isMatch
                      ? 'bg-neutral-200 text-neutral-950 font-bold border-white shadow-xs'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                >
                  {opt.label} ({opt.value.toFixed(1)}x)
                </button>
              );
            })}
          </div>
        </div>

        <SliderRow
          label="Nodal field overlay"
          value={params.fieldOverlay}
          min={0.0}
          max={1.0}
          step={0.01}
          digits={2}
          onChange={(val) => updateParam('fieldOverlay', val)}
        />

        <SliderRow
          label="Nodal pronouncement"
          value={params.nodalPronouncement ?? 1.0}
          min={0.1}
          max={3.0}
          step={0.05}
          digits={2}
          onChange={(val) => updateParam('nodalPronouncement', val)}
        />

        {/* Simulation Engine Segmented Selector */}
        <div className="pt-1.5 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-emerald-400 font-semibold uppercase tracking-wider flex items-center gap-1">
              <Zap size={10} />
              <span>Simulation Engine</span>
            </span>
            {onOpenWasmLab && (
              <button
                type="button"
                onClick={onOpenWasmLab}
                className="text-[9px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                WASM Lab
              </button>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1">
            <button
              type="button"
              onClick={() => updateParam('simulationEngine', 'gpu')}
              className={`py-1 px-1 rounded border text-center transition-all cursor-pointer ${
                params.simulationEngine === 'gpu'
                  ? 'bg-neutral-200 text-neutral-950 font-semibold border-white shadow-xs'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              <div className="text-[10px] leading-tight">GPU Shader</div>
              <div className="text-[7px] font-mono opacity-80">1M Grains</div>
            </button>

            <button
              type="button"
              onClick={() => updateParam('simulationEngine', 'wasm')}
              className={`py-1 px-1 rounded border text-center transition-all cursor-pointer ${
                params.simulationEngine === 'wasm'
                  ? 'bg-emerald-400 text-neutral-950 font-semibold border-emerald-300 shadow-xs'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              <div className="text-[10px] leading-tight">WASM SIMD</div>
              <div className="text-[7px] font-mono opacity-80">Zero-Copy</div>
            </button>

            <button
              type="button"
              onClick={() => updateParam('simulationEngine', 'js_cpu')}
              className={`py-1 px-1 rounded border text-center transition-all cursor-pointer ${
                params.simulationEngine === 'js_cpu'
                  ? 'bg-amber-400 text-neutral-950 font-semibold border-amber-300 shadow-xs'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              <div className="text-[10px] leading-tight">JS CPU</div>
              <div className="text-[7px] font-mono opacity-80">Baseline</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

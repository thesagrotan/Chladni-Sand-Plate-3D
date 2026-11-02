import React from 'react';
import { Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { ChladniParams, PRESETS } from '../../types/chladni.ts';

export type PresetFilter = 'all' | (typeof PRESETS)[number]['tag'];

interface PresetsSectionProps {
  params: ChladniParams;
  onChange: (params: ChladniParams) => void;
  showPresets: boolean;
  setShowPresets: React.Dispatch<React.SetStateAction<boolean>>;
  presetFilter: PresetFilter;
  setPresetFilter: React.Dispatch<React.SetStateAction<PresetFilter>>;
}

export const PresetsSection: React.FC<PresetsSectionProps> = ({
  params,
  onChange,
  showPresets,
  setShowPresets,
  presetFilter,
  setPresetFilter,
}) => {
  const filteredPresets = PRESETS.filter((p) => {
    if (presetFilter === 'all') return true;
    return p.tag === presetFilter;
  });

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setShowPresets(!showPresets)}
        className="w-full flex items-center justify-between text-[10px] text-neutral-400 hover:text-white py-1 px-2 rounded bg-neutral-900/60 border border-neutral-800/60 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-1 font-medium">
          <Sliders size={11} className="text-cyan-400" />
          <span>Curated Grid Presets ({PRESETS.length})</span>
        </span>
        {showPresets ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>

      {showPresets && (
        <div className="mt-1.5 p-2 rounded bg-neutral-900/50 border border-neutral-800/60 space-y-1.5">
          <div className="flex gap-1">
            {([
              { id: 'empty-center', label: 'Empty Center' },
              { id: 'classic', label: 'Classic' },
              { id: 'geometric', label: 'Geometric' },
              { id: 'all', label: 'All' },
            ] as const).map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setPresetFilter(btn.id)}
                className={`flex-1 text-[9px] py-0.5 rounded transition-colors cursor-pointer font-medium ${
                  presetFilter === btn.id
                    ? 'bg-cyan-950 text-cyan-200 border border-cyan-800'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto scrollbar-thin">
            {filteredPresets.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => {
                  onChange({
                    ...params,
                    ...preset.params,
                  });
                  setShowPresets(false);
                }}
                className="text-left p-1.5 rounded bg-neutral-950 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800/80 transition-[background-color,border-color,color,opacity,transform] flex flex-col cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-white">{preset.name}</span>
                  <span className="text-[8px] uppercase px-1 py-0 rounded bg-neutral-800 text-neutral-400 font-mono">
                    {preset.gridType}
                  </span>
                </div>
                <span className="text-[9px] text-neutral-400 leading-tight truncate mt-0.5">
                  {preset.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

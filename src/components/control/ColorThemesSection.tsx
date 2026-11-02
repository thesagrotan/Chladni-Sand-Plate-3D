import React from 'react';
import { Palette, Shuffle } from 'lucide-react';
import { ChladniParams, COLOR_PALETTES } from '../../types/chladni.ts';
import type { UpdateParams } from './types.ts';

interface ColorThemesSectionProps {
  params: ChladniParams;
  updateParams: UpdateParams;
  showColorCustomizer: boolean;
  setShowColorCustomizer: React.Dispatch<React.SetStateAction<boolean>>;
}

export const ColorThemesSection: React.FC<ColorThemesSectionProps> = ({
  params,
  updateParams,
  showColorCustomizer,
  setShowColorCustomizer,
}) => {
  const handleApplyPalette = (paletteId: string) => {
    const pal = COLOR_PALETTES.find((p) => p.id === paletteId);
    if (!pal) return;
    updateParams({
      paletteId: pal.id,
      sandColor: pal.sandPrimary,
      sandColorSecondary: pal.sandSecondary,
      plateColor: pal.plate,
      glowColor: pal.glow,
    });
  };

  const handleRandomizeColors = () => {
    const pal = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    handleApplyPalette(pal.id);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1.5">
          <Palette size={11} className="text-amber-400" />
          <span>Color Themes</span>
        </span>
        <button
          type="button"
          onClick={() => setShowColorCustomizer(!showColorCustomizer)}
          className="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer"
        >
          {showColorCustomizer ? 'Presets' : 'Custom Pickers'}
        </button>
      </div>
      <p className="text-[9px] text-neutral-500 leading-tight">
        Color changes are session-only; the Silica brand palette restores on reload.
      </p>

      {!showColorCustomizer ? (
        /* Compact Single-Row Swatches Strip */
        <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
          {COLOR_PALETTES.map((pal) => {
            const isSelected = params.paletteId === pal.id;
            return (
              <button
                key={pal.id}
                type="button"
                onClick={() => handleApplyPalette(pal.id)}
                title={`${pal.name} (Sand: ${pal.sandPrimary}, Plate: ${pal.plate})`}
                className={`flex items-center gap-1 px-1.5 py-1 rounded-md border text-[10px] transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-900 text-white border-cyan-400 shadow-xs ring-1 ring-cyan-400/40'
                    : 'bg-neutral-950/70 text-neutral-400 border-neutral-800 hover:text-neutral-200'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/40 shadow-xs"
                  style={{ backgroundColor: pal.sandPrimary }}
                />
                <span className="truncate max-w-[65px]">{pal.name}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={handleRandomizeColors}
            title="Random Theme Palette"
            className="p-1 rounded-md border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white cursor-pointer ml-auto"
          >
            <Shuffle size={12} />
          </button>
        </div>
      ) : (
        /* Custom Color Pickers: Compact 2x2 Grid */
        <div className="p-2 rounded-lg bg-neutral-900/50 border border-neutral-800/70 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Sand</span>
            <input
              type="color"
              value={params.sandColor}
              onChange={(e) => updateParams({ sandColor: e.target.value, paletteId: 'custom' })}
              className="w-5 h-5 rounded cursor-pointer border border-neutral-700 bg-transparent"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Shading</span>
            <input
              type="color"
              value={params.sandColorSecondary}
              onChange={(e) => updateParams({ sandColorSecondary: e.target.value, paletteId: 'custom' })}
              className="w-5 h-5 rounded cursor-pointer border border-neutral-700 bg-transparent"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Plate</span>
            <input
              type="color"
              value={params.plateColor}
              onChange={(e) => updateParams({ plateColor: e.target.value, paletteId: 'custom' })}
              className="w-5 h-5 rounded cursor-pointer border border-neutral-700 bg-transparent"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-neutral-400">Glow</span>
            <input
              type="color"
              value={params.glowColor}
              onChange={(e) => updateParams({ glowColor: e.target.value, paletteId: 'custom' })}
              className="w-5 h-5 rounded cursor-pointer border border-neutral-700 bg-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
};

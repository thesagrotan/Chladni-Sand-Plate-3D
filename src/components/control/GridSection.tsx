import React from 'react';
import {
  CircleDot,
  Grid,
  Disc,
  Hexagon,
  Boxes,
  Radar,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Type,
  MousePointer2,
} from 'lucide-react';
import { ChladniParams, GridType } from '../../types/chladni.ts';
import { GRID_CATALOG } from '../../utils/grid.ts';
import { VOID_SHAPE_CATALOG } from '../../utils/voidShapes.ts';
import { SliderRow } from './SliderRow.tsx';
import { OptionSelect } from './OptionSelect.tsx';
import type { UpdateParam } from './types.ts';

interface GridSectionProps {
  params: ChladniParams;
  updateParam: UpdateParam;
}

export const GridSection: React.FC<GridSectionProps> = ({ params, updateParam }) => {
  const GRID_ICONS: Record<GridType, React.ReactNode> = {
    annular: <CircleDot size={13} />,
    rectangular: <Grid size={13} />,
    polar: <Disc size={13} />,
    hexagonal: <Hexagon size={13} />,
    diamond: <Boxes size={13} />,
    web: <Radar size={13} />,
  };

  const handleRotate90 = () => {
    const nextAngle = (params.rotationAngle + 90) % 360;
    updateParam('rotationAngle', nextAngle);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1.5">
          <Grid size={11} className="text-cyan-400" />
          <span>Grid Architecture</span>
        </span>
        <div className="flex items-center gap-1 text-[9px] font-mono text-neutral-400">
          <span>{params.rotationAngle}°</span>
          {params.flipHorizontal && <span className="text-cyan-400">H</span>}
          {params.flipVertical && <span className="text-cyan-400">V</span>}
        </div>
      </div>

      {/* 6 Grid Architecture Buttons: Compact 3x2 Grid */}
      <div className="grid grid-cols-3 gap-1">
        {GRID_CATALOG.map((t) => {
          const isActive = params.gridType === t.type;
          return (
            <button
              key={t.type}
              type="button"
              onClick={() => updateParam('gridType', t.type)}
              title={t.desc}
              className={`py-1.5 px-1.5 rounded-md border flex items-center gap-1.5 text-left transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
                isActive
                  ? 'bg-neutral-200 text-neutral-950 font-semibold border-white shadow-xs'
                  : 'bg-neutral-900/80 text-neutral-300 border-neutral-800 hover:bg-neutral-800 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-neutral-950' : 'text-cyan-400 shrink-0'}>
                {GRID_ICONS[t.type]}
              </span>
              <span className="text-[10px] truncate">{t.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Canvas Orientation Controls: Segmented Row */}
      <div className="flex items-center gap-1 pt-0.5">
        <button
          type="button"
          onClick={() => updateParam('flipHorizontal', !params.flipHorizontal)}
          className={`flex-1 py-1 rounded border text-[10px] font-medium flex items-center justify-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
            params.flipHorizontal
              ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
              : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
          }`}
          title="Flip canvas horizontally (Mirror Left-Right)"
        >
          <FlipHorizontal size={11} />
          <span>Flip H</span>
        </button>

        <button
          type="button"
          onClick={() => updateParam('flipVertical', !params.flipVertical)}
          className={`flex-1 py-1 rounded border text-[10px] font-medium flex items-center justify-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
            params.flipVertical
              ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
              : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
          }`}
          title="Flip canvas vertically (Mirror Top-Bottom)"
        >
          <FlipVertical size={11} />
          <span>Flip V</span>
        </button>

        <button
          type="button"
          onClick={handleRotate90}
          className="flex-1 py-1 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 hover:text-white hover:bg-neutral-800 text-[10px] font-medium flex items-center justify-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer"
          title="Rotate canvas 90 degrees clockwise"
        >
          <RotateCw size={11} />
          <span>Rot 90°</span>
        </button>
      </div>

      {/* Empty Center Void Controls Box */}
      <div className="p-2 rounded-lg bg-neutral-900/50 border border-neutral-850 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className="font-semibold uppercase tracking-wider text-cyan-400">
            Empty Center Void
          </span>
          <div className="flex items-center gap-1.5">
            {params.centerVoidRadius > 0.01 && (
              <button
                type="button"
                onClick={() => updateParam('centerVoidRadius', 0)}
                className="text-[9px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
              >
                Clear
              </button>
            )}
            {/* Void shape dropdown — add entries in src/utils/voidShapes.ts */}
            <OptionSelect
              ariaLabel="Center void shape"
              value={params.centerVoidShape}
              options={VOID_SHAPE_CATALOG}
              onChange={(shape) => updateParam('centerVoidShape', shape)}
              testId="void-shape-select"
              minPopupWidth={168}
            />
          </div>
        </div>

        <SliderRow
          label="Void radius"
          value={params.centerVoidRadius}
          min={0.0}
          max={0.55}
          step={0.01}
          digits={2}
          onChange={(val) => updateParam('centerVoidRadius', val)}
        />

        <SliderRow
          label="Center expulsion"
          value={params.centerExpulsion}
          min={0.0}
          max={5.0}
          step={0.1}
          digits={1}
          onChange={(val) => updateParam('centerExpulsion', val)}
        />

        <div className="flex items-center justify-between pt-0.5 text-[10px]">
          <span className="text-neutral-400">Show perimeter guide</span>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={params.showVoidGuide}
              onChange={(e) => updateParam('showVoidGuide', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-[transform,border-color] peer-checked:bg-cyan-600"></div>
          </label>
        </div>
      </div>

      {/* DOM Elements Rejection Box */}
      <div className="p-2 rounded-lg bg-neutral-900/50 border border-neutral-850 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1 font-semibold uppercase tracking-wider text-cyan-400">
            <Type size={10} />
            <span>DOM Rejection Force</span>
          </div>
          {(params.domRepulsion ?? 1.0) > 0.01 ? (
            <button
              type="button"
              onClick={() => updateParam('domRepulsion', 0)}
              className="text-[9px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
            >
              Disable
            </button>
          ) : (
            <button
              type="button"
              onClick={() => updateParam('domRepulsion', 1.0)}
              className="text-[9px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              Enable (1×)
            </button>
          )}
        </div>

        <SliderRow
          label="Push sand away from text"
          value={params.domRepulsion ?? 1.0}
          min={0.0}
          max={10.0}
          step={0.1}
          digits={2}
          formatFn={(val) => (val <= 0.01 ? '0.00× (Off)' : `${val.toFixed(2)}×`)}
          onChange={(val) => updateParam('domRepulsion', val)}
        />

        {/* Quick Presets: 5-Col Grid */}
        <div className="grid grid-cols-5 gap-1 pt-0.5">
          {[
            { label: 'Off', value: 0.0 },
            { label: '1×', value: 1.0 },
            { label: '3×', value: 3.0 },
            { label: '6×', value: 6.0 },
            { label: '10×', value: 10.0 },
          ].map((preset) => {
            const currentVal = params.domRepulsion ?? 1.0;
            const isActive = Math.abs(currentVal - preset.value) < 0.15;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateParam('domRepulsion', preset.value)}
                className={`text-[9px] py-0.5 rounded border text-center transition-[background-color,border-color,color,opacity,transform] cursor-pointer font-mono ${
                  isActive
                    ? 'bg-neutral-200 text-neutral-950 font-semibold border-white shadow-xs'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cursor Repulsion Box */}
      <div className="p-2 rounded-lg bg-neutral-900/50 border border-neutral-850 space-y-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1 font-semibold uppercase tracking-wider text-cyan-400">
            <MousePointer2 size={10} />
            <span>Cursor Repulsion</span>
          </div>
          {(params.pointerForce ?? 1.0) > 0.01 ? (
            <button
              type="button"
              onClick={() => updateParam('pointerForce', 0)}
              className="text-[9px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
            >
              Disable
            </button>
          ) : (
            <button
              type="button"
              onClick={() => updateParam('pointerForce', 1.0)}
              className="text-[9px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              Enable (1×)
            </button>
          )}
        </div>

        <SliderRow
          label="Push intensity"
          value={params.pointerForce ?? 1.0}
          min={0.0}
          max={4.0}
          step={0.05}
          digits={2}
          formatFn={(val) => (val <= 0.01 ? '0.00× (Off)' : `${val.toFixed(2)}×`)}
          onChange={(val) => updateParam('pointerForce', val)}
        />

        <SliderRow
          label="Cursor radius"
          value={params.pointerRadius ?? 0.12}
          min={0.02}
          max={0.4}
          step={0.01}
          digits={2}
          onChange={(val) => updateParam('pointerRadius', val)}
        />

        {/* Quick Presets: 5-Col Grid */}
        <div className="grid grid-cols-5 gap-1 pt-0.5">
          {[
            { label: 'Off', value: 0.0 },
            { label: 'Soft', value: 0.5 },
            { label: '1×', value: 1.0 },
            { label: '2×', value: 2.0 },
            { label: '4×', value: 4.0 },
          ].map((preset) => {
            const currentVal = params.pointerForce ?? 1.0;
            const isActive = Math.abs(currentVal - preset.value) < 0.15;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateParam('pointerForce', preset.value)}
                className={`text-[9px] py-0.5 rounded border text-center transition-[background-color,border-color,color,opacity,transform] cursor-pointer font-mono ${
                  isActive
                    ? 'bg-neutral-200 text-neutral-950 font-semibold border-white shadow-xs'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <p className="text-[8px] text-neutral-500 leading-tight">
          Applies to the GPU engine.
        </p>
      </div>
    </div>
  );
};

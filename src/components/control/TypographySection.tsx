import React, { useRef } from 'react';
import { Type, Upload, Italic } from 'lucide-react';
import { ChladniParams, FontOption, buildFontVariationSettings } from '../../types/chladni.ts';
import { findFont, fontSelectionUpdates } from '../../utils/fonts.ts';
import { SliderRow } from './SliderRow.tsx';
import { ColorThemesSection } from './ColorThemesSection.tsx';
import type { UpdateParam, UpdateParams } from './types.ts';

interface TypographySectionProps {
  params: ChladniParams;
  updateParam: UpdateParam;
  updateParams: UpdateParams;
  allFonts: FontOption[];
  currentFont: FontOption;
  setCustomFonts: React.Dispatch<React.SetStateAction<FontOption[]>>;
  fontLoadError: string | null;
  setFontLoadError: React.Dispatch<React.SetStateAction<string | null>>;
  showColorCustomizer: boolean;
  setShowColorCustomizer: React.Dispatch<React.SetStateAction<boolean>>;
}

export const TypographySection: React.FC<TypographySectionProps> = ({
  params,
  updateParam,
  updateParams,
  allFonts,
  currentFont,
  setCustomFonts,
  fontLoadError,
  setFontLoadError,
  showColorCustomizer,
  setShowColorCustomizer,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFontFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setFontLoadError(null);
      const buffer = await file.arrayBuffer();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'otf';
      const rawBaseName = file.name.replace(/\.[^/.]+$/, '').trim();
      const sanitizedFamily = rawBaseName.replace(/[^a-zA-Z0-9_-]/g, '_');

      const fontFace = new FontFace(sanitizedFamily, buffer);
      const loadedFace = await fontFace.load();
      document.fonts.add(loadedFace);

      const isItalic = rawBaseName.toLowerCase().includes('italic');
      const newOption: FontOption = {
        id: `custom-${Date.now()}`,
        name: rawBaseName,
        fontFamily: sanitizedFamily,
        category: 'static',
        minWeight: 100,
        maxWeight: 900,
        defaultWeight: 400,
        hasItalic: isItalic,
        isItalicDefault: isItalic,
        badge: ext === 'otf' ? 'Custom OTF' : `Custom ${ext.toUpperCase()}`,
        format: ext.toUpperCase(),
        fileName: file.name,
        description: `Locally loaded font: ${file.name}`,
      };

      setCustomFonts((prev) => [newOption, ...prev]);
      updateParams({
        fontFamily: sanitizedFamily,
        fontWeight: 400,
        fontItalic: isItalic,
        fontSpacingAxis: 0,
        fontElshAxis: 0,
      });

      if (document.fonts.ready) {
        await document.fonts.ready;
      }
    } catch (err) {
      console.error('Failed to load font file:', err);
      setFontLoadError(err instanceof Error ? err.message : String(err));
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSelectFont = (selectedFamily: string) => {
    const font = findFont(allFonts, selectedFamily);
    if (!font) return;
    updateParams(fontSelectionUpdates(font, params.fontWeight));
  };

  const previewVariationCss = buildFontVariationSettings({
    fontFamily: params.fontFamily,
    fontWeight: params.fontWeight,
    fontSpacingAxis: params.fontSpacingAxis,
    fontElshAxis: params.fontElshAxis,
  });

  return (
    <div className="space-y-2">
      <ColorThemesSection
        params={params}
        updateParams={updateParams}
        showColorCustomizer={showColorCustomizer}
        setShowColorCustomizer={setShowColorCustomizer}
      />

      {/* Typography Controls */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1.5">
            <Type size={11} className="text-cyan-400" />
            <span>Typography & Fonts</span>
          </span>
          <button
            type="button"
            onClick={() => {
              updateParams({
                fontFamily: 'iAWriterQuattroV',
                fontWeight: 400,
                fontItalic: false,
                fontSpacingAxis: 0,
                fontElshAxis: 0,
                fontLetterSpacing: 0,
              });
            }}
            className="text-[9px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
          >
            Reset Font
          </button>
        </div>

        {/* Hidden File Input for Custom Font */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".otf,.ttf,.woff2,.woff,font/*"
          className="hidden"
          onChange={handleFontFileUpload}
        />

        {/* Font Family Dropdown with Inline Upload Button */}
        <div className="flex items-center gap-1">
          <select
            value={params.fontFamily}
            onChange={(e) => handleSelectFont(e.target.value)}
            className="flex-1 bg-neutral-900 border border-neutral-700/80 rounded px-2 py-1 text-xs text-neutral-200 font-medium focus:outline-none focus:border-cyan-400 cursor-pointer truncate"
          >
            {allFonts.map((font) => (
              <option key={font.id} value={font.fontFamily} className="bg-neutral-950 text-neutral-200">
                {font.name} ({font.badge})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1 px-2 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-cyan-300 hover:text-white text-[10px] flex items-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer shrink-0"
            title="Load local font file (.otf, .ttf, .woff2)"
          >
            <Upload size={11} />
            <span>Upload</span>
          </button>
        </div>

        {fontLoadError && (
          <div className="px-2 py-0.5 rounded bg-red-950/80 border border-red-800 text-[9px] text-red-300">
            {fontLoadError}
          </div>
        )}

        {/* Variable Axes Controls Box */}
        <div className="p-2 rounded-lg bg-neutral-950/60 border border-neutral-850 space-y-1.5">
          {/* Weight Slider */}
          <SliderRow
            label="Weight (wght)"
            value={params.fontWeight}
            min={currentFont ? currentFont.minWeight : 100}
            max={currentFont ? currentFont.maxWeight : 900}
            step={currentFont?.id?.startsWith('BB-Manual-Mono-Pro') ? 50 : (currentFont?.id?.startsWith('Scatterplot') || currentFont?.id?.startsWith('Aeonik')) ? 100 : currentFont?.category === 'static' ? 300 : 10}
            digits={0}
            formatFn={(val) => {
              let name = '';
              if (val <= 200) name = 'Thin';
              else if (val <= 350) name = 'Light';
              else if (val <= 450) name = 'Reg';
              else if (val <= 550) name = 'Med';
              else if (val <= 650) name = 'Semi';
              else if (val <= 750) name = 'Bold';
              else name = 'Black';
              return `${Math.round(val)} (${name})`;
            }}
            onChange={(val) => updateParam('fontWeight', Math.round(val))}
          />

          {/* Weight Quick Buttons */}
          <div className="flex gap-1">
            {(currentFont?.id === 'iAWriterQuattroV' || currentFont?.id === 'iAWriterQuattroV-Italic'
              ? [
                  { label: '400', val: 400 },
                  { label: '500', val: 500 },
                  { label: '600', val: 600 },
                  { label: '700', val: 700 },
                ]
              : currentFont?.id?.startsWith('BB-Manual-Mono-Pro')
              ? [
                  { label: '100', val: 100 },
                  { label: '200', val: 200 },
                  { label: '300', val: 300 },
                  { label: '400', val: 400 },
                  { label: '500', val: 500 },
                  { label: '700', val: 700 },
                  { label: '900', val: 900 },
                ]
              : currentFont?.id?.startsWith('Scatterplot')
              ? [
                  { label: '300', val: 300 },
                  { label: '400', val: 400 },
                  { label: '700', val: 700 },
                  { label: '900', val: 900 },
                ]
              : currentFont?.id?.startsWith('Aeonik')
              ? [
                  { label: '100', val: 100 },
                  { label: '300', val: 300 },
                  { label: '400', val: 400 },
                  { label: '700', val: 700 },
                  { label: '900', val: 900 },
                ]
              : currentFont?.category === 'static'
              ? [
                  { label: '400', val: 400 },
                  { label: '700', val: 700 },
                ]
              : [
                  { label: '100', val: 100 },
                  { label: '300', val: 300 },
                  { label: '400', val: 400 },
                  { label: '700', val: 700 },
                  { label: '900', val: 900 },
                ]
            ).map((btn) => (
              <button
                key={btn.label}
                type="button"
                onClick={() => updateParam('fontWeight', btn.val)}
                className={`flex-1 text-[9px] py-0.5 rounded border text-center font-mono cursor-pointer transition-[background-color,border-color,color,opacity,transform] ${
                  params.fontWeight === btn.val
                    ? 'bg-neutral-200 text-neutral-950 font-semibold border-white shadow-xs'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* iA Writer Quattro SPCG Spacing Axis */}
          {(currentFont?.hasSpacingAxis || params.fontFamily.includes('iAWriter') || params.fontFamily.includes('Quattro')) && (
            <div className="pt-1 border-t border-neutral-900 space-y-1">
              <SliderRow
                label="iA Quattro Spacing (SPCG)"
                value={params.fontSpacingAxis || 0}
                min={0}
                max={150}
                step={1}
                digits={0}
                formatFn={(val) => (val === 0 ? '0 (Def)' : `${Math.round(val)}`)}
                onChange={(val) => updateParam('fontSpacingAxis', Math.round(val))}
              />
              <div className="grid grid-cols-4 gap-1">
                {[
                  { label: '0 Norm', val: 0 },
                  { label: '35 Air', val: 35 },
                  { label: '75 Open', val: 75 },
                  { label: '150 Wide', val: 150 },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => updateParam('fontSpacingAxis', btn.val)}
                    className={`text-[9px] py-0.5 rounded border text-center font-mono cursor-pointer transition-[background-color,border-color,color,opacity,transform] ${
                      (params.fontSpacingAxis || 0) === btn.val
                        ? 'bg-cyan-950 text-cyan-200 border-cyan-500 font-semibold'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Geist Serif ELSH Axis */}
          {(currentFont?.hasElshAxis || params.fontFamily.includes('Serif')) && (
            <div className="pt-1 border-t border-neutral-900">
              <SliderRow
                label="Geist Serif Contrast (ELSH)"
                value={params.fontElshAxis || 0}
                min={0}
                max={100}
                step={1}
                digits={0}
                formatFn={(val) => (val === 0 ? '0 (Def)' : `${Math.round(val)}`)}
                onChange={(val) => updateParam('fontElshAxis', Math.round(val))}
              />
            </div>
          )}

          {/* Italic Slant & Letter Tracking Combined Row */}
          <div className="pt-1 border-t border-neutral-900 flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateParam('fontItalic', !params.fontItalic)}
              className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1 transition-[background-color,border-color,color,opacity,transform] cursor-pointer ${
                params.fontItalic
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                  : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              <Italic size={11} />
              <span>{params.fontItalic ? 'Italic' : 'Regular'}</span>
            </button>

            <div className="flex-1">
              <SliderRow
                label="Tracking"
                value={params.fontLetterSpacing || 0}
                min={-2}
                max={10}
                step={0.5}
                digits={1}
                formatFn={(val) => `${val > 0 ? '+' : ''}${val.toFixed(1)}px`}
                onChange={(val) => updateParam('fontLetterSpacing', val)}
              />
            </div>
          </div>

          {/* Compact Live Specimen Preview */}
          <div className="p-1.5 rounded bg-neutral-900/80 border border-neutral-800/80 text-center">
            <div
              className="text-[13px] text-white leading-tight truncate"
              style={{
                fontFamily: `'${params.fontFamily}', sans-serif`,
                fontWeight: params.fontWeight,
                fontStyle: params.fontItalic ? 'italic' : 'normal',
                fontVariationSettings: previewVariationCss,
                letterSpacing: `${params.fontLetterSpacing || 0}px`,
              }}
            >
              TEZETT – PLATTE 2023
            </div>
            <div className="text-[8px] font-mono text-cyan-400/80 truncate mt-0.5">
              {currentFont?.fileName} · {previewVariationCss}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

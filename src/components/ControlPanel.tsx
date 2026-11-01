import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Sliders,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Grid,
  Disc,
  Hexagon,
  Boxes,
  Radar,
  Dices,
  Circle,
  Square,
  FlipHorizontal,
  FlipVertical,
  RotateCw,
  Palette,
  Shuffle,
  Zap,
  Music,
  Radio,
  Activity,
  Waves,
  Save,
  Check,
  Type,
  History,
  Trash2,
  CornerUpLeft,
  PlusCircle,
  Italic,
  SlidersHorizontal,
  Upload,
} from 'lucide-react';
import {
  ChladniParams,
  GridType,
  VoidShape,
  PRESETS,
  GRID_TYPE_LABELS,
  COLOR_PALETTES,
  AudioMetrics,
  AVAILABLE_FONTS,
  FontOption,
  buildFontVariationSettings,
} from '../types/chladni.ts';
import { plateAudio } from '../simulation/audioSynth.ts';
import { SavedVersion, MAX_VERSIONS } from '../utils/storage.ts';

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
}

const formatTime = (sec: number) => {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const AudioVisualizer: React.FC<{ isEnabled: boolean }> = ({ isEnabled }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = '#08090d';
      ctx.fillRect(0, 0, width, height);

      const freqData = plateAudio.getFrequencyData();
      if (!isEnabled || !freqData) {
        ctx.strokeStyle = '#22252d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animId = requestAnimationFrame(render);
        return;
      }

      const numBars = 32;
      const barWidth = width / numBars;
      for (let i = 0; i < numBars; i++) {
        const binIndex = Math.floor((i / numBars) * (freqData.length * 0.75));
        const val = freqData[binIndex] / 255;
        const barHeight = Math.max(2, val * (height - 4));
        const x = i * barWidth;
        const y = height - barHeight;

        const hue = 38 + (i / numBars) * 140;
        ctx.fillStyle = `hsl(${hue}, 88%, ${Math.min(78, 42 + val * 35)}%)`;
        ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isEnabled]);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={28}
      className="w-full h-7 rounded bg-[#08090d] border border-neutral-800/80 shadow-inner"
    />
  );
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits?: number;
  formatFn?: (val: number) => string;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  digits = 2,
  formatFn,
  onChange,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputVal, setInputVal] = useState(value.toString());

  useEffect(() => {
    if (!isEditing) {
      setInputVal(value.toFixed(digits));
    }
  }, [value, digits, isEditing]);

  const displayVal = formatFn ? formatFn(value) : value.toFixed(digits);

  const handleStep = (direction: -1 | 1) => {
    const nextVal = Math.min(max, Math.max(min, +(value + direction * step).toFixed(digits)));
    onChange(nextVal);
  };

  const handleCommitInput = () => {
    setIsEditing(false);
    const parsed = parseFloat(inputVal);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, +parsed.toFixed(digits)));
      onChange(clamped);
    } else {
      setInputVal(value.toFixed(digits));
    }
  };

  return (
    <div className="flex flex-col gap-1 py-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-neutral-400 font-normal truncate max-w-[170px]" title={label}>
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            className="w-4 h-4 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Decrease"
          >
            <ChevronLeft size={11} />
          </button>
          {isEditing ? (
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onBlur={handleCommitInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCommitInput();
                if (e.key === 'Escape') {
                  setIsEditing(false);
                  setInputVal(value.toFixed(digits));
                }
              }}
              autoFocus
              className="w-13 text-center font-mono text-cyan-300 text-[10px] bg-neutral-900 px-0.5 py-0 rounded border border-cyan-500 focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              title="Click to type exact number"
              className="w-13 text-center font-mono text-neutral-200 text-[10px] bg-neutral-900/90 hover:bg-neutral-800/90 px-0.5 py-0 rounded border border-neutral-800/80 cursor-text truncate transition-colors"
            >
              {displayVal}
            </button>
          )}
          <button
            type="button"
            onClick={() => handleStep(1)}
            className="w-4 h-4 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            title="Increase"
          >
            <ChevronRight size={11} />
          </button>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all"
      />
    </div>
  );
};

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
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'grid' | 'typo' | 'resonance' | 'audio'>('all');
  const [showPresets, setShowPresets] = useState(false);
  const [showColorCustomizer, setShowColorCustomizer] = useState(false);
  const [presetFilter, setPresetFilter] = useState<'all' | 'empty-center' | 'classic'>('empty-center');
  const [justSaved, setJustSaved] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionLabel, setVersionLabel] = useState('');
  const [customFonts, setCustomFonts] = useState<FontOption[]>([]);
  const [fontLoadError, setFontLoadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allFonts = useMemo(() => {
    return [...AVAILABLE_FONTS, ...customFonts];
  }, [customFonts]);

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

  const gridTopologies: { type: GridType; label: string; icon: React.ReactNode; desc: string }[] = [
    { type: 'annular', label: 'Annular', icon: <CircleDot size={13} />, desc: 'Ring circuit around empty center' },
    { type: 'rectangular', label: 'Courtyard', icon: <Grid size={13} />, desc: 'Orthogonal grid with open courtyard' },
    { type: 'polar', label: 'Polar', icon: <Disc size={13} />, desc: 'Concentric rings & radiating rays' },
    { type: 'hexagonal', label: 'Hexagon', icon: <Hexagon size={13} />, desc: '60° triaxial honeycomb' },
    { type: 'diamond', label: 'Diamond', icon: <Boxes size={13} />, desc: '45° rotated diagonal rhombus grid' },
    { type: 'web', label: 'Spiderweb', icon: <Radar size={13} />, desc: 'Concentric web looping around center' },
  ];

  const handleExperimentNextGrid = () => {
    const topologies: GridType[] = ['annular', 'rectangular', 'polar', 'hexagonal', 'diamond', 'web'];
    const nextType = topologies[Math.floor(Math.random() * topologies.length)];
    const randomRadius = +(0.20 + Math.random() * 0.22).toFixed(2);
    const nextShape: VoidShape =
      nextType === 'rectangular' || nextType === 'diamond'
        ? Math.random() > 0.4 ? 'square' : 'circle'
        : 'circle';
    const m = +(3.0 + Math.floor(Math.random() * 7) * 0.5).toFixed(2);
    const n = +(4.0 + Math.floor(Math.random() * 8) * 0.5).toFixed(2);
    const k = +(28.0 + Math.random() * 10.0).toFixed(1);
    const blend = +(0.55 + Math.random() * 0.4).toFixed(2);

    onChange({
      ...params,
      gridType: nextType,
      centerVoidRadius: randomRadius,
      centerVoidShape: nextShape,
      centerExpulsion: +(2.2 + Math.random() * 1.4).toFixed(1),
      modeM: m,
      modeN: n,
      waveK: k,
      symmetryBlend: blend,
    });
  };

  const handleApplyPalette = (paletteId: string) => {
    const pal = COLOR_PALETTES.find((p) => p.id === paletteId);
    if (!pal) return;
    onChange({
      ...params,
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

  const handleRotate90 = () => {
    const nextAngle = (params.rotationAngle + 90) % 360;
    updateParam('rotationAngle', nextAngle);
  };

  const filteredPresets = PRESETS.filter((p) => {
    if (presetFilter === 'all') return true;
    if (presetFilter === 'empty-center') return p.tag === 'empty-center';
    return p.tag !== 'empty-center';
  });

  const currentFont = allFonts.find(
    (f) => f.fontFamily === params.fontFamily || f.id === params.fontFamily
  ) || allFonts[0];

  const handleSelectFont = (selectedFamily: string) => {
    const font = allFonts.find(
      (f) => f.fontFamily === selectedFamily || f.id === selectedFamily
    );
    if (!font) return;

    let targetWeight = params.fontWeight;
    if (targetWeight < font.minWeight) targetWeight = font.minWeight;
    if (targetWeight > font.maxWeight) targetWeight = font.maxWeight;

    const updates: Partial<ChladniParams> = {
      fontFamily: font.fontFamily,
      fontWeight: targetWeight,
    };

    if (font.isItalicDefault !== undefined) {
      updates.fontItalic = font.isItalicDefault;
    } else if (!font.hasItalic) {
      updates.fontItalic = false;
    }

    if (!font.hasSpacingAxis) {
      updates.fontSpacingAxis = 0;
    }
    if (!font.hasElshAxis) {
      updates.fontElshAxis = 0;
    }

    updateParams(updates);
  };

  const previewVariationCss = buildFontVariationSettings({
    fontFamily: params.fontFamily,
    fontWeight: params.fontWeight,
    fontSpacingAxis: params.fontSpacingAxis,
    fontElshAxis: params.fontElshAxis,
  });

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
                  className="px-2 py-0.5 rounded text-[10px] bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 font-medium flex items-center gap-1 transition-all cursor-pointer"
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
                  <span className="text-cyan-300">{GRID_TYPE_LABELS[params.gridType]?.label || params.gridType}</span>
                </span>
              </div>

              {/* Action Buttons: Save, Reset, History */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onSave?.();
                    setJustSaved(true);
                    setTimeout(() => setJustSaved(false), 2000);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border transition-all cursor-pointer ${
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
                  className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 flex items-center gap-1 transition-all cursor-pointer"
                  title="Reset to factory defaults"
                >
                  <RotateCcw size={10} className={hasSavedSettings ? 'text-amber-400' : 'text-neutral-400'} />
                  <span>Reset</span>
                </button>

                {onSaveVersion && (
                  <button
                    type="button"
                    onClick={() => setShowVersionHistory((prev) => !prev)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium border flex items-center gap-0.5 transition-all cursor-pointer ${
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
              <div className="mt-2 p-2 rounded-lg bg-neutral-900/90 border border-neutral-800 flex flex-col gap-1.5 text-xs">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={versionLabel}
                    onChange={(e) => setVersionLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && onSaveVersion) {
                        onSaveVersion(versionLabel);
                        setVersionLabel('');
                      }
                    }}
                    placeholder="Version name (optional)…"
                    maxLength={40}
                    className="flex-1 h-5 px-1.5 rounded border border-neutral-700 bg-neutral-950 text-[10px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    disabled={savedVersions.length >= MAX_VERSIONS}
                    onClick={() => {
                      onSaveVersion(versionLabel);
                      setVersionLabel('');
                    }}
                    className="h-5 px-2 rounded border border-indigo-700/70 bg-indigo-950/80 text-indigo-300 hover:bg-indigo-900 text-[10px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40"
                  >
                    <PlusCircle size={10} />
                    <span>Save</span>
                  </button>
                </div>

                {savedVersions.length === 0 ? (
                  <p className="text-[9px] text-neutral-500 italic">No versions yet.</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-28 overflow-y-auto scrollbar-thin pr-0.5">
                    {savedVersions.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-1 p-1 rounded bg-neutral-950/80 border border-neutral-800 text-[9px]"
                      >
                        <div className="min-w-0 flex-1 truncate">
                          <span className="font-medium text-neutral-200">{v.label}</span>
                          <span className="text-neutral-500 ml-1.5 font-mono">{v.savedAt}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onRestoreVersion?.(v.id)}
                            className="px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 hover:text-white"
                          >
                            <CornerUpLeft size={9} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteVersion?.(v.id)}
                            className="p-0.5 rounded bg-neutral-900 text-neutral-500 hover:text-red-400"
                          >
                            <Trash2 size={9} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
                    className={`py-1 rounded flex items-center justify-center gap-1 transition-all cursor-pointer font-medium ${
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
            {shouldShow('grid') && (
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
                  {gridTopologies.map((t) => {
                    const isActive = params.gridType === t.type;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => updateParam('gridType', t.type)}
                        title={t.desc}
                        className={`py-1.5 px-1.5 rounded-md border flex items-center gap-1.5 text-left transition-all cursor-pointer ${
                          isActive
                            ? 'bg-neutral-200 text-neutral-950 font-semibold border-white shadow-xs'
                            : 'bg-neutral-900/80 text-neutral-300 border-neutral-800 hover:bg-neutral-800 hover:text-white'
                        }`}
                      >
                        <span className={isActive ? 'text-neutral-950' : 'text-cyan-400 shrink-0'}>
                          {t.icon}
                        </span>
                        <span className="text-[10px] truncate">{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Canvas Orientation Controls: Segmented Row */}
                <div className="flex items-center gap-1 pt-0.5">
                  <button
                    type="button"
                    onClick={() => updateParam('flipHorizontal', !params.flipHorizontal)}
                    className={`flex-1 py-1 rounded border text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
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
                    className={`flex-1 py-1 rounded border text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer ${
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
                    className="flex-1 py-1 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 hover:text-white hover:bg-neutral-800 text-[10px] font-medium flex items-center justify-center gap-1 transition-all cursor-pointer"
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
                      {/* Circle vs Square Shape Segmented Control */}
                      <div className="flex items-center bg-neutral-950 p-0.5 rounded border border-neutral-800">
                        <button
                          type="button"
                          onClick={() => updateParam('centerVoidShape', 'circle')}
                          className={`p-0.5 px-1 rounded text-[9px] flex items-center gap-0.5 ${
                            params.centerVoidShape === 'circle'
                              ? 'bg-neutral-200 text-neutral-950 font-bold'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                          title="Circular void shape"
                        >
                          <Circle size={8} />
                          <span>Circle</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateParam('centerVoidShape', 'square')}
                          className={`p-0.5 px-1 rounded text-[9px] flex items-center gap-0.5 ${
                            params.centerVoidShape === 'square'
                              ? 'bg-neutral-200 text-neutral-950 font-bold'
                              : 'text-neutral-400 hover:text-white'
                          }`}
                          title="Square void shape"
                        >
                          <Square size={8} />
                          <span>Square</span>
                        </button>
                      </div>
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
                      <div className="w-7 h-3.5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600"></div>
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
                          className={`text-[9px] py-0.5 rounded border text-center transition-all cursor-pointer font-mono ${
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
              </div>
            )}

            {/* 2. STYLE, COLORS & TYPOGRAPHY SECTION */}
            {shouldShow('typo') && (
              <div className="space-y-2">
                {/* Color Palettes Header & Swatch Strip */}
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
                            className={`flex items-center gap-1 px-1.5 py-1 rounded-md border text-[10px] transition-all cursor-pointer ${
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
                      className="p-1 px-2 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-cyan-300 hover:text-white text-[10px] flex items-center gap-1 transition-all cursor-pointer shrink-0"
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
                          className={`flex-1 text-[9px] py-0.5 rounded border text-center font-mono cursor-pointer transition-all ${
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
                              className={`text-[9px] py-0.5 rounded border text-center font-mono cursor-pointer transition-all ${
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
                        className={`px-2 py-1 rounded text-[10px] font-medium border flex items-center gap-1 transition-all cursor-pointer ${
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
            )}

            {/* 3. RESONANCE & SAND SECTION */}
            {shouldShow('resonance') && (
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
            )}

            {/* 4. ACOUSTIC SOUND & PRESETS SECTION */}
            {shouldShow('audio') && (
              <div className="space-y-2">
                {/* Acoustic Sound Header */}
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

                {/* Curated Grid Presets Collapsible Header */}
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
                        {[
                          { id: 'empty-center', label: 'Empty Center' },
                          { id: 'classic', label: 'Classic' },
                          { id: 'all', label: 'All' },
                        ].map((btn) => (
                          <button
                            key={btn.id}
                            type="button"
                            onClick={() => setPresetFilter(btn.id as any)}
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
                            className="text-left p-1.5 rounded bg-neutral-950 hover:bg-neutral-850 text-neutral-300 hover:text-white border border-neutral-800/80 transition-all flex flex-col cursor-pointer"
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
          className="fixed top-4 right-4 z-30 p-2 rounded-lg bg-neutral-950/90 text-neutral-300 hover:text-white border border-neutral-800 shadow-xl backdrop-blur transition-all flex items-center gap-1.5 text-xs cursor-pointer"
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

      {/* Floating Bottom-Right Action Buttons */}
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
            className="h-8 px-2.5 rounded-lg flex items-center gap-1 text-xs font-semibold border shadow-xl bg-gradient-to-r from-cyan-950/90 to-indigo-950/90 border-cyan-500/60 text-cyan-300 hover:text-white hover:border-cyan-400 backdrop-blur transition-all cursor-pointer group"
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
            const currentIndex = allFonts.findIndex(
              (f) => f.fontFamily === params.fontFamily || f.id === params.fontFamily
            );
            const nextFont = allFonts[(currentIndex + 1) % allFonts.length];
            let targetWeight = params.fontWeight;
            if (targetWeight < nextFont.minWeight) targetWeight = nextFont.minWeight;
            if (targetWeight > nextFont.maxWeight) targetWeight = nextFont.maxWeight;

            const updates: Partial<ChladniParams> = {
              fontFamily: nextFont.fontFamily,
              fontWeight: targetWeight,
            };
            if (nextFont.isItalicDefault !== undefined) {
              updates.fontItalic = nextFont.isItalicDefault;
            } else if (!nextFont.hasItalic) {
              updates.fontItalic = false;
            }
            if (!nextFont.hasSpacingAxis) {
              updates.fontSpacingAxis = 0;
            }
            if (!nextFont.hasElshAxis) {
              updates.fontElshAxis = 0;
            }
            updateParams(updates);
          }}
          className="h-8 px-2.5 rounded-lg border border-cyan-800/60 bg-neutral-900/90 hover:bg-neutral-800 text-cyan-300 hover:text-white shadow-lg backdrop-blur transition-all flex items-center gap-1 text-xs font-medium cursor-pointer"
          title={`Active Font: ${currentFont?.name || params.fontFamily} — Click to cycle fonts`}
        >
          <Type size={12} className="text-cyan-400" />
          <span className="max-w-[100px] truncate">{currentFont?.name || 'Font'}</span>
        </button>

        {/* Quick Flip H Toggle */}
        <button
          type="button"
          onClick={() => updateParam('flipHorizontal', !params.flipHorizontal)}
          className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium border shadow-lg backdrop-blur transition-all cursor-pointer ${
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
          className={`h-8 px-2 rounded-lg flex items-center gap-1 text-xs font-medium border shadow-lg backdrop-blur transition-all cursor-pointer ${
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
          className={`h-8 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium border shadow-lg backdrop-blur transition-all cursor-pointer ${
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
          className="h-8 px-2.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white shadow-lg backdrop-blur transition-all flex items-center gap-1 text-xs font-medium cursor-pointer"
        >
          {isPaused ? <Play size={12} /> : <Pause size={12} />}
          <span>{isPaused ? 'Play' : 'Pause'}</span>
        </button>

        {/* Scatter */}
        <button
          type="button"
          onClick={onScatter}
          className="h-8 px-2.5 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white shadow-lg backdrop-blur transition-all flex items-center gap-1 text-xs font-medium cursor-pointer"
          title="Scatter grains randomly across plate (S)"
        >
          <Sparkles size={12} />
          <span>Scatter</span>
        </button>

        {/* Save Settings */}
        <button
          type="button"
          onClick={() => {
            onSave?.();
            setJustSaved(true);
            setTimeout(() => setJustSaved(false), 2000);
          }}
          className={`h-8 px-2.5 rounded-lg border shadow-lg backdrop-blur transition-all flex items-center gap-1 text-xs font-medium cursor-pointer ${
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
          className={`h-8 px-2.5 rounded-lg border shadow-lg backdrop-blur transition-all flex items-center gap-1 text-xs font-medium cursor-pointer ${
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
    </>
  );
};

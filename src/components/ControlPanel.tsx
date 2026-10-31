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
  Eye,
  Zap,
  Microchip,
  Cpu,
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

      // Background
      ctx.fillStyle = '#08090d';
      ctx.fillRect(0, 0, width, height);

      const freqData = plateAudio.getFrequencyData();
      if (!isEnabled || !freqData) {
        // Flat line when muted or paused
        ctx.strokeStyle = '#22252d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        animId = requestAnimationFrame(render);
        return;
      }

      // Draw frequency spectrum bars
      const numBars = 32;
      const barWidth = width / numBars;
      for (let i = 0; i < numBars; i++) {
        const binIndex = Math.floor((i / numBars) * (freqData.length * 0.75));
        const val = freqData[binIndex] / 255;
        const barHeight = Math.max(2, val * (height - 4));
        const x = i * barWidth;
        const y = height - barHeight;

        // Gradient from warm amber (resonance) to luminous aqua
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
      height={36}
      className="w-full h-9 rounded bg-[#08090d] border border-neutral-800/80 shadow-inner"
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
  const displayVal = formatFn ? formatFn(value) : value.toFixed(digits);

  const handleStep = (direction: -1 | 1) => {
    const delta = step * 1;
    const nextVal = Math.min(max, Math.max(min, +(value + direction * delta).toFixed(digits)));
    onChange(nextVal);
  };

  return (
    <div className="flex flex-col gap-1.5 py-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400 font-normal">{label}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleStep(-1)}
            className="w-5 h-5 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Decrease"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="w-14 text-center font-mono text-neutral-200 text-xs bg-neutral-900/80 py-0.5 rounded border border-neutral-800/80">
            {displayVal}
          </span>
          <button
            type="button"
            onClick={() => handleStep(1)}
            className="w-5 h-5 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            title="Increase"
          >
            <ChevronRight size={13} />
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
        className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-300 hover:accent-white transition-all"
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

      // Register new FontFace into document fonts
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
    { type: 'annular', label: 'Annular Halo', icon: <CircleDot size={14} />, desc: 'Ring circuit around empty center' },
    { type: 'rectangular', label: 'Courtyard Lattice', icon: <Grid size={14} />, desc: 'Orthogonal grid with open courtyard' },
    { type: 'polar', label: 'Polar Orbitals', icon: <Disc size={14} />, desc: 'Concentric rings & radiating rays' },
    { type: 'hexagonal', label: 'Hex Honeycomb', icon: <Hexagon size={14} />, desc: '60° triaxial honeycomb' },
    { type: 'diamond', label: 'Diamond Cage', icon: <Boxes size={14} />, desc: '45° rotated diagonal rhombus grid' },
    { type: 'web', label: 'Spiderweb', icon: <Radar size={14} />, desc: 'Concentric web looping around center' },
  ];

  // Procedural generator to experiment with new harmonic grids leaving an empty center
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

  const previewVariationCss = buildFontVariationSettings({
    fontFamily: params.fontFamily,
    fontWeight: params.fontWeight,
    fontSpacingAxis: params.fontSpacingAxis,
    fontElshAxis: params.fontElshAxis,
  });

  return (
    <>
      {/* Right Drawer / Floating Panel */}
      <div
        className={`fixed top-4 right-4 z-30 transition-transform duration-300 ease-in-out ${
          collapsed ? 'translate-x-[calc(100%+1.5rem)]' : 'translate-x-0'
        }`}
      >
        <div
          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          className="w-[355px] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl bg-neutral-950/92 border border-neutral-800/80 shadow-2xl backdrop-blur-md p-4 text-neutral-200 font-sans select-none scrollbar-thin scrollbar-thumb-neutral-800"
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-2 border-b border-neutral-900">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[17px] font-semibold text-white tracking-tight">
                  Chladni Grid Lab
                </h1>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-mono">
                  Void & Flips
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed mt-1 font-normal">
                Flip the canvas, customize colors, and experiment with resonant grids surrounding an
                empty central space.
              </p>

              {/* Session persistence & Settings save card */}
              <div className="mt-2.5 p-2 rounded-lg bg-neutral-900/80 border border-neutral-800 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="flex items-center gap-1.5 text-neutral-300 font-medium">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasSavedSettings
                          ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse'
                          : 'bg-neutral-500'
                      }`}
                    />
                    <span>
                      {hasSavedSettings ? 'Saved Session Active' : 'Default Configuration'}
                    </span>
                  </span>
                  {lastSavedTime && (
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {lastSavedTime}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      onSave?.();
                      setJustSaved(true);
                      setTimeout(() => setJustSaved(false), 2000);
                    }}
                    className={`flex-1 py-1 px-2 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      justSaved
                        ? 'bg-emerald-950 border-emerald-500 text-emerald-300'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border-neutral-700 hover:border-neutral-500'
                    }`}
                    title="Save current parameters to browser storage so they persist across sessions"
                  >
                    {justSaved ? <Check size={12} className="text-emerald-400" /> : <Save size={12} className="text-cyan-400" />}
                    <span>{justSaved ? 'Saved!' : 'Save Settings'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onReset}
                    className="py-1 px-2.5 rounded border border-neutral-800 bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                    title="Reset parameters to factory defaults and clear saved session (R)"
                  >
                    <RotateCcw size={12} className={hasSavedSettings ? 'text-amber-400' : 'text-neutral-400'} />
                    <span>Reset</span>
                  </button>
                </div>

                {onToggleAutoSave && (
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800/60 text-[10px] text-neutral-400">
                    <label className="flex items-center gap-1.5 cursor-pointer hover:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={autoSaveEnabled}
                        onChange={onToggleAutoSave}
                        className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0 cursor-pointer w-3 h-3"
                      />
                      <span>Auto-save changes automatically</span>
                    </label>
                    <span className="text-[9px] text-neutral-500 font-mono">
                      {autoSaveEnabled ? 'Auto: ON' : 'Auto: OFF'}
                    </span>
                  </div>
                )}

                {/* Version History */}
                {onSaveVersion && (
                  <div className="pt-1 border-t border-neutral-800/60">
                    <button
                      type="button"
                      onClick={() => setShowVersionHistory((prev) => !prev)}
                      className="w-full flex items-center justify-between text-[10px] text-neutral-400 hover:text-white transition-colors cursor-pointer py-0.5"
                    >
                      <span className="flex items-center gap-1.5">
                        <History size={11} className="text-indigo-400" />
                        <span className="font-medium">Version History</span>
                        {savedVersions.length > 0 && (
                          <span className="px-1 py-0 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono text-[9px]">
                            {savedVersions.length}/{MAX_VERSIONS}
                          </span>
                        )}
                      </span>
                      {showVersionHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>

                    {showVersionHistory && (
                      <div className="mt-1.5 flex flex-col gap-1.5">
                        {/* Save new version input */}
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
                            className="flex-1 h-6 px-2 rounded border border-neutral-700 bg-neutral-900 text-[10px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-indigo-600 transition-colors"
                          />
                          <button
                            type="button"
                            disabled={savedVersions.length >= MAX_VERSIONS}
                            onClick={() => {
                              onSaveVersion(versionLabel);
                              setVersionLabel('');
                            }}
                            title={savedVersions.length >= MAX_VERSIONS ? `Max ${MAX_VERSIONS} versions` : 'Save new version'}
                            className="h-6 px-2 rounded border border-indigo-700/70 bg-indigo-950/80 text-indigo-300 hover:bg-indigo-900/80 hover:text-white text-[10px] flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <PlusCircle size={11} />
                            <span>Save</span>
                          </button>
                        </div>

                        {/* Version list */}
                        {savedVersions.length === 0 ? (
                          <p className="text-[10px] text-neutral-600 italic px-0.5">
                            No versions saved yet. Name and save one above.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-1 max-h-44 overflow-y-auto scrollbar-thin pr-0.5">
                            {savedVersions.map((v) => (
                              <div
                                key={v.id}
                                className="flex items-center gap-1.5 p-1.5 rounded bg-neutral-900/70 border border-neutral-800/80 group"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[10px] font-medium text-neutral-200 truncate leading-tight">
                                    {v.label}
                                  </div>
                                  <div className="text-[9px] text-neutral-500 font-mono leading-tight">
                                    {v.savedAt}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => onRestoreVersion?.(v.id)}
                                  title={`Restore "${v.label}"`}
                                  className="shrink-0 h-5 px-1.5 rounded border border-indigo-800/60 bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 hover:text-white text-[9px] flex items-center gap-0.5 transition-all cursor-pointer"
                                >
                                  <CornerUpLeft size={10} />
                                  <span>Load</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteVersion?.(v.id)}
                                  title="Delete this version"
                                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded border border-neutral-800 bg-neutral-900 hover:bg-red-950/60 hover:border-red-800/60 text-neutral-600 hover:text-red-400 transition-all cursor-pointer"
                                >
                                  <Trash2 size={10} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              className="p-1 -mr-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Collapse controls"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Quick Experiment / Generator Banner */}
          <div className="mt-3">
            <button
              type="button"
              onClick={handleExperimentNextGrid}
              className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-950/70 via-neutral-900 to-indigo-950/70 hover:from-cyan-900/80 hover:to-indigo-900/80 border border-cyan-700/50 hover:border-cyan-400/80 text-cyan-200 hover:text-white text-xs font-medium flex items-center justify-center gap-2 shadow-sm transition-all group cursor-pointer"
              title="Generate a new harmonic grid variation that encircles an empty center"
            >
              <Dices size={15} className="text-cyan-400 group-hover:rotate-45 transition-transform" />
              <span>Experiment Next Grid (Empty Center)</span>
            </button>
          </div>

          {/* CANVAS FLIP & ORIENTATION CONTROLS */}
          <div className="mt-3.5 pt-2.5 border-t border-neutral-900 bg-neutral-900/40 -mx-4 px-4 pb-2.5 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-300 flex items-center gap-1.5">
                <FlipHorizontal size={12} className="text-cyan-400" />
                <span>Canvas Flip & Orientation</span>
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {params.rotationAngle}°
                {params.flipHorizontal ? ' | Flip H' : ''}
                {params.flipVertical ? ' | Flip V' : ''}
              </span>
            </div>

            {/* Flip Horizontal, Flip Vertical, Rotate 90 Buttons */}
            <div className="grid grid-cols-3 gap-1.5">
              {/* Flip Horizontal */}
              <button
                type="button"
                onClick={() => updateParam('flipHorizontal', !params.flipHorizontal)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                  params.flipHorizontal
                    ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500 shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                }`}
                title="Flip canvas horizontally (Mirror Left-Right)"
              >
                <FlipHorizontal size={13} />
                <span>Flip H</span>
              </button>

              {/* Flip Vertical */}
              <button
                type="button"
                onClick={() => updateParam('flipVertical', !params.flipVertical)}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                  params.flipVertical
                    ? 'bg-cyan-950/90 text-cyan-300 border-cyan-500 shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                }`}
                title="Flip canvas vertically (Mirror Top-Bottom)"
              >
                <FlipVertical size={13} />
                <span>Flip V</span>
              </button>

              {/* Rotate 90° */}
              <button
                type="button"
                onClick={handleRotate90}
                className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-neutral-900 text-neutral-300 border border-neutral-800 hover:text-white hover:bg-neutral-800 text-xs font-medium transition-all cursor-pointer"
                title="Rotate canvas 90 degrees clockwise"
              >
                <RotateCw size={13} />
                <span>Rot 90°</span>
              </button>
            </div>

            {/* View Angle row removed — 2D only */}
          </div>

          {/* COLOR THEMES & SELECTION SECTION */}
          <div className="mt-3.5 pt-2.5 border-t border-neutral-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1.5">
                <Palette size={12} className="text-amber-400" />
                <span>Colors & Palettes</span>
              </span>
              <button
                type="button"
                onClick={() => setShowColorCustomizer(!showColorCustomizer)}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 cursor-pointer flex items-center gap-1"
              >
                <span>{showColorCustomizer ? 'Presets' : 'Custom Pickers'}</span>
              </button>
            </div>

            {!showColorCustomizer ? (
              /* Preset Color Theme Chips */
              <div className="grid grid-cols-2 gap-1.5">
                {COLOR_PALETTES.map((pal) => {
                  const isSelected = params.paletteId === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => handleApplyPalette(pal.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-neutral-900 text-white border-cyan-400/80 shadow-sm'
                          : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      <span className="text-[11px] font-medium truncate">{pal.name}</span>
                      {/* Swatch Preview Dots */}
                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/40 shadow-xs"
                          style={{ backgroundColor: pal.sandPrimary }}
                          title="Sand color"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-neutral-700 shadow-xs"
                          style={{ backgroundColor: pal.plate }}
                          title="Plate color"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* Custom Color Pickers */
              <div className="p-2.5 rounded-lg bg-neutral-900/50 border border-neutral-800/60 flex flex-col gap-2">
                {/* Sand Primary Color */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Sand grain color</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase">
                      {params.sandColor}
                    </span>
                    <input
                      type="color"
                      value={params.sandColor}
                      onChange={(e) => {
                        onChange({ ...params, sandColor: e.target.value, paletteId: 'custom' });
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-neutral-700 bg-transparent"
                    />
                  </div>
                </div>

                {/* Sand Secondary / Accent Color */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Sand shading tint</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase">
                      {params.sandColorSecondary}
                    </span>
                    <input
                      type="color"
                      value={params.sandColorSecondary}
                      onChange={(e) => {
                        onChange({ ...params, sandColorSecondary: e.target.value, paletteId: 'custom' });
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-neutral-700 bg-transparent"
                    />
                  </div>
                </div>

                {/* Plate Surface Color */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Plate surface</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase">
                      {params.plateColor}
                    </span>
                    <input
                      type="color"
                      value={params.plateColor}
                      onChange={(e) => {
                        onChange({ ...params, plateColor: e.target.value, paletteId: 'custom' });
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-neutral-700 bg-transparent"
                    />
                  </div>
                </div>

                {/* Nodal Line / Glow Highlight Color */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Nodal line highlight</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase">
                      {params.glowColor}
                    </span>
                    <input
                      type="color"
                      value={params.glowColor}
                      onChange={(e) => {
                        onChange({ ...params, glowColor: e.target.value, paletteId: 'custom' });
                      }}
                      className="w-6 h-6 rounded cursor-pointer border border-neutral-700 bg-transparent"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRandomizeColors}
                  className="mt-1 py-1 px-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Shuffle size={12} />
                  <span>Random Theme Palette</span>
                </button>
              </div>
            )}
          </div>

          {/* GRID TOPOLOGY SECTION */}
          <div className="mt-4 pt-2 border-t border-neutral-900">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-400">
                Grid Architecture
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                {GRID_TYPE_LABELS[params.gridType]?.label}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {gridTopologies.map((t) => {
                const isActive = params.gridType === t.type;
                return (
                  <button
                    key={t.type}
                    type="button"
                    onClick={() => updateParam('gridType', t.type)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                      isActive
                        ? 'bg-neutral-200 text-neutral-950 font-medium border-white shadow-sm'
                        : 'bg-neutral-900/80 text-neutral-300 border-neutral-800/80 hover:bg-neutral-800 hover:text-white'
                    }`}
                    title={t.desc}
                  >
                    <span className={isActive ? 'text-neutral-950' : 'text-neutral-400'}>
                      {t.icon}
                    </span>
                    <span className="text-[11px] truncate">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* EMPTY CENTER / VOID CONTROLS */}
          <div className="mt-4 pt-3 border-t border-neutral-900 bg-neutral-900/30 -mx-4 px-4 pb-2 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-400">
                  Empty Center Clearance
                </span>
                <span className="text-[10px] text-neutral-500">
                  ({params.centerVoidRadius > 0.01 ? 'Active' : 'Off'})
                </span>
              </div>
              {params.centerVoidRadius > 0.01 && (
                <button
                  type="button"
                  onClick={() => updateParam('centerVoidRadius', 0)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                  title="Clear void setting"
                >
                  Disable
                </button>
              )}
            </div>

            {/* Void Radius Slider */}
            <SliderRow
              label="Void radius (size of empty space)"
              value={params.centerVoidRadius}
              min={0.0}
              max={0.55}
              step={0.01}
              digits={2}
              onChange={(val) => updateParam('centerVoidRadius', val)}
            />

            {/* Void Shape Selector: Circle vs Square */}
            <div className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-neutral-400 font-normal">Void shape</span>
              <div className="flex items-center gap-1 bg-neutral-900/80 p-0.5 rounded border border-neutral-800">
                <button
                  type="button"
                  onClick={() => updateParam('centerVoidShape', 'circle')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                    params.centerVoidShape === 'circle'
                      ? 'bg-neutral-200 text-neutral-950 font-medium'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Circle size={11} />
                  <span>Circular</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('centerVoidShape', 'square')}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer ${
                    params.centerVoidShape === 'square'
                      ? 'bg-neutral-200 text-neutral-950 font-medium'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Square size={11} />
                  <span>Square</span>
                </button>
              </div>
            </div>

            {/* Center Expulsion Force */}
            <SliderRow
              label="Center expulsion drive"
              value={params.centerExpulsion}
              min={0.0}
              max={5.0}
              step={0.1}
              digits={1}
              onChange={(val) => updateParam('centerExpulsion', val)}
            />

            {/* Void Guide Toggle */}
            <div className="flex items-center justify-between pt-1 text-xs">
              <span className="text-neutral-400 font-normal">Show void perimeter guide</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={params.showVoidGuide}
                  onChange={(e) => updateParam('showVoidGuide', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>
          </div>

          {/* DOM ELEMENTS REJECTION CONTROLS */}
          <div className="mt-4 pt-3 border-t border-neutral-900 bg-neutral-900/30 -mx-4 px-4 pb-2.5 rounded-lg">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-400 flex items-center gap-1">
                  <Type size={11} />
                  <span>DOM Elements Rejection</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  {(params.domRepulsion ?? 1.0) > 0.01 ? `(${(params.domRepulsion ?? 1.0).toFixed(2)}×)` : '(Off)'}
                </span>
              </div>
              {(params.domRepulsion ?? 1.0) > 0.01 ? (
                <button
                  type="button"
                  onClick={() => updateParam('domRepulsion', 0)}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                  title="Disable DOM repulsion so sand dots flow through text"
                >
                  Disable
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => updateParam('domRepulsion', 1.0)}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  title="Enable standard repulsion (1.00×)"
                >
                  Enable (1.00×)
                </button>
              )}
            </div>

            <p className="text-[11px] text-neutral-400 leading-tight mb-2 font-normal">
              Controls the repulsive force pushing sand dots away from typography and DOM elements.
            </p>

            {/* Slider with step buttons and formatted value */}
            <SliderRow
              label="Rejection force"
              value={params.domRepulsion ?? 1.0}
              min={0.0}
              max={10.0}
              step={0.1}
              digits={2}
              formatFn={(val) => (val <= 0.01 ? '0.00× (Off)' : `${val.toFixed(2)}×`)}
              onChange={(val) => updateParam('domRepulsion', val)}
            />

            {/* Quick Presets */}
            <div className="grid grid-cols-5 gap-1 mt-1">
              {[
                { label: 'Off', value: 0.0, title: 'No rejection (0×)' },
                { label: '1.0×', value: 1.0, title: 'Standard default rejection (1.0×)' },
                { label: '3.0×', value: 3.0, title: 'Strong rejection (3.0×)' },
                { label: '6.0×', value: 6.0, title: 'Very strong rejection (6.0×)' },
                { label: '10×', value: 10.0, title: 'Maximum rejection (10×)' },
              ].map((preset) => {
                const currentVal = params.domRepulsion ?? 1.0;
                const isActive = Math.abs(currentVal - preset.value) < 0.15;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => updateParam('domRepulsion', preset.value)}
                    title={preset.title}
                    className={`text-[10px] py-1 rounded border text-center transition-all cursor-pointer ${
                      isActive
                        ? 'bg-neutral-200 text-neutral-950 font-medium border-white shadow-sm'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TYPOGRAPHY & VARIABLE FONT CONTROLS */}
          <div className="mt-4 pt-3 border-t border-neutral-900 bg-neutral-900/30 -mx-4 px-4 pb-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-cyan-400 flex items-center gap-1">
                  <Type size={12} />
                  <span>Typography & Variable Fonts</span>
                </span>
                <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/60 truncate max-w-[120px]">
                  {currentFont?.name || params.fontFamily}
                </span>
              </div>
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
                className="text-[10px] text-neutral-500 hover:text-neutral-300 underline cursor-pointer"
                title="Reset typography to iA Writer Quattro V Regular default"
              >
                Reset Font
              </button>
            </div>

            <p className="text-[11px] text-neutral-400 leading-tight mb-2.5 font-normal">
              Quickly switch between fonts in the <code className="text-cyan-300/80 font-mono text-[10px]">fonts/</code> folder. Real-time variable font axes dynamically reshape text contours and sand repulsion.
            </p>

            {/* Hidden File Input for loading custom OTF/TTF/WOFF2 fonts */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".otf,.ttf,.woff2,.woff,font/*"
              className="hidden"
              onChange={handleFontFileUpload}
            />

            {/* Load Local Font Button */}
            <div className="mb-2.5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-1.5 px-3 rounded-lg border border-dashed border-cyan-700/70 hover:border-cyan-400 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-200 hover:text-white text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer group shadow-sm"
                title="Load an external .otf, .ttf, or .woff2 font file directly from your disk"
              >
                <Upload size={12} className="text-cyan-400 group-hover:-translate-y-0.5 transition-transform" />
                <span>Load Font File (.otf, .ttf, .woff2)</span>
              </button>
              {fontLoadError && (
                <div className="mt-1 px-2 py-1 rounded bg-red-950/80 border border-red-800 text-[10px] text-red-300">
                  {fontLoadError}
                </div>
              )}
            </div>

            {/* Font Picker Grid */}
            <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1.5 flex items-center justify-between">
              <span>Font Options ({allFonts.length} Available)</span>
              <span className="text-[9px] text-neutral-500 font-mono">public/fonts/ & custom</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-3">
              {allFonts.map((font) => {
                const isSelected = params.fontFamily === font.fontFamily || params.fontFamily === font.id;
                return (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => {
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
                    }}
                    className={`p-2 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between min-h-[64px] ${
                      isSelected
                        ? 'bg-gradient-to-br from-cyan-950/80 to-neutral-900 text-white border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.15)] ring-1 ring-cyan-400/40'
                        : 'bg-neutral-900/60 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800 hover:border-neutral-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 w-full">
                      <span className="text-[11px] font-semibold truncate leading-tight">
                        {font.name}
                      </span>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)] shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[9px] font-mono">
                      <span className="text-neutral-500 truncate">{font.badge}</span>
                      <span className="px-1 py-0.2 rounded bg-neutral-950/80 text-neutral-400 border border-neutral-800 shrink-0 text-[8px]">
                        {font.format}
                      </span>
                    </div>

                    {/* Specimen sample in that font */}
                    <div
                      className="mt-1 text-[11px] text-neutral-200 truncate"
                      style={{
                        fontFamily: font.fontFamily,
                        fontStyle: font.isItalicDefault ? 'italic' : 'normal',
                      }}
                    >
                      TEZETT – PLATTE
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Variable Font Controls Box */}
            <div className="p-2.5 rounded-lg bg-neutral-950/70 border border-neutral-800/80 space-y-2.5">
              <div className="flex items-center justify-between pb-1 border-b border-neutral-900 text-[10px]">
                <span className="uppercase tracking-wider font-semibold text-neutral-400 flex items-center gap-1">
                  <SlidersHorizontal size={11} className="text-cyan-400" />
                  <span>Variable Font Controls</span>
                </span>
                <span className="text-[9px] text-cyan-400 font-mono">
                  {currentFont?.category === 'variable' ? 'Continuous Variable Axes' : 'Static Stepped'}
                </span>
              </div>

              {/* Weight Axis Slider (wght) */}
              <SliderRow
                label="Weight (wght)"
                value={params.fontWeight}
                min={currentFont ? currentFont.minWeight : 100}
                max={currentFont ? currentFont.maxWeight : 900}
                step={currentFont?.category === 'static' ? 300 : 10}
                digits={0}
                formatFn={(val) => {
                  let name = '';
                  if (val <= 200) name = 'Thin';
                  else if (val <= 350) name = 'Light';
                  else if (val <= 450) name = 'Regular';
                  else if (val <= 550) name = 'Medium';
                  else if (val <= 650) name = 'SemiBold';
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
                      { label: '400 Reg', val: 400 },
                      { label: '500 Med', val: 500 },
                      { label: '600 Semi', val: 600 },
                      { label: '700 Bold', val: 700 },
                    ]
                  : currentFont?.category === 'static'
                  ? [
                      { label: '400 Regular', val: 400 },
                      { label: '700 Bold', val: 700 },
                    ]
                  : [
                      { label: '100', val: 100 },
                      { label: '300', val: 300 },
                      { label: '400', val: 400 },
                      { label: '500', val: 500 },
                      { label: '700', val: 700 },
                      { label: '900', val: 900 },
                    ]
                ).map((btn) => (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => updateParam('fontWeight', btn.val)}
                    className={`flex-1 text-[9px] py-0.5 rounded border text-center transition-all cursor-pointer font-mono ${
                      params.fontWeight === btn.val
                        ? 'bg-neutral-200 text-neutral-950 font-semibold border-white shadow-sm'
                        : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>

              {/* iA Writer Quattro SPCG Spacing Axis */}
              {(currentFont?.hasSpacingAxis || params.fontFamily.includes('iAWriter') || params.fontFamily.includes('Quattro')) && (
                <div className="pt-2 border-t border-neutral-900 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-cyan-300 font-medium flex items-center gap-1">
                      <span>iA Quattro Spacing (SPCG)</span>
                    </span>
                    <span className="font-mono text-[10px] text-neutral-400">
                      {params.fontSpacingAxis || 0} / 150
                    </span>
                  </div>
                  <SliderRow
                    label="Glyph tracking"
                    value={params.fontSpacingAxis || 0}
                    min={0}
                    max={150}
                    step={1}
                    digits={0}
                    formatFn={(val) => (val === 0 ? '0 (Default)' : `${Math.round(val)} SPCG`)}
                    onChange={(val) => updateParam('fontSpacingAxis', Math.round(val))}
                  />
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
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
                        className={`text-[9px] py-0.5 rounded border text-center transition-all cursor-pointer font-mono ${
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
                <div className="pt-2 border-t border-neutral-900 space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-amber-300 font-medium">Geist Serif Contrast (ELSH)</span>
                    <span className="font-mono text-[10px] text-neutral-400">
                      {params.fontElshAxis || 0} / 100
                    </span>
                  </div>
                  <SliderRow
                    label="Elongation shape"
                    value={params.fontElshAxis || 0}
                    min={0}
                    max={100}
                    step={1}
                    digits={0}
                    formatFn={(val) => (val === 0 ? '0 (Default)' : `${Math.round(val)} ELSH`)}
                    onChange={(val) => updateParam('fontElshAxis', Math.round(val))}
                  />
                </div>
              )}

              {/* Italic Cut & Style Toggle */}
              <div className="pt-2 border-t border-neutral-900 flex items-center justify-between">
                <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                  <Italic size={12} className={params.fontItalic ? 'text-cyan-400' : 'text-neutral-500'} />
                  <span>Italic Slant / Cursive Cut</span>
                </span>
                <button
                  type="button"
                  onClick={() => updateParam('fontItalic', !params.fontItalic)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all cursor-pointer ${
                    params.fontItalic
                      ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-sm'
                      : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}
                >
                  <Italic size={11} />
                  <span>{params.fontItalic ? 'Italic Active' : 'Normal'}</span>
                </button>
              </div>

              {/* Letter Spacing CSS Tracking */}
              <div className="pt-2 border-t border-neutral-900">
                <SliderRow
                  label="Letter tracking"
                  value={params.fontLetterSpacing || 0}
                  min={-2}
                  max={10}
                  step={0.5}
                  digits={1}
                  formatFn={(val) => (val === 0 ? '0px (Normal)' : `${val > 0 ? '+' : ''}${val.toFixed(1)}px`)}
                  onChange={(val) => updateParam('fontLetterSpacing', val)}
                />
              </div>

              {/* Live Specimen Preview Box */}
              <div className="mt-2 p-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
                <div className="flex items-center justify-between text-[9px] text-neutral-500 font-mono mb-1">
                  <span>LIVE SPECIMEN</span>
                  <span>{currentFont?.fileName}</span>
                </div>
                <div
                  className="text-base text-white leading-snug transition-all"
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
                <div
                  className="text-xs text-neutral-400 leading-relaxed mt-0.5 transition-all"
                  style={{
                    fontFamily: `'${params.fontFamily}', sans-serif`,
                    fontWeight: params.fontWeight,
                    fontStyle: params.fontItalic ? 'italic' : 'normal',
                    fontVariationSettings: previewVariationCss,
                    letterSpacing: `${params.fontLetterSpacing || 0}px`,
                  }}
                >
                  Berlin acoustic research atelier & recording studio
                </div>
                <div className="mt-2 pt-1.5 border-t border-neutral-800/80 text-[8px] font-mono text-cyan-400/80 truncate">
                  font-variation-settings: {previewVariationCss}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Preset Selector */}
          <div className="mt-4 pt-2 border-t border-neutral-900">
            <button
              type="button"
              onClick={() => setShowPresets(!showPresets)}
              className="w-full flex items-center justify-between text-[11px] text-neutral-400 hover:text-white py-1.5 px-2 rounded bg-neutral-900/60 border border-neutral-800/60 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <Sliders size={12} className="text-cyan-400" />
                <span>Curated Grid Presets ({PRESETS.length})</span>
              </span>
              {showPresets ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {showPresets && (
              <div className="mt-2 p-2 rounded bg-neutral-900/40 border border-neutral-800/50">
                {/* Preset Category Filter */}
                <div className="flex gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setPresetFilter('empty-center')}
                    className={`flex-1 text-[10px] py-1 rounded transition-colors cursor-pointer ${
                      presetFilter === 'empty-center'
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-medium'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Empty Center
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetFilter('classic')}
                    className={`flex-1 text-[10px] py-1 rounded transition-colors cursor-pointer ${
                      presetFilter === 'classic'
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-medium'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    Classic Filled
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetFilter('all')}
                    className={`flex-1 text-[10px] py-1 rounded transition-colors cursor-pointer ${
                      presetFilter === 'all'
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 font-medium'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    All
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto scrollbar-thin">
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
                      className="text-left p-2 rounded bg-neutral-900 hover:bg-neutral-800/90 text-neutral-300 hover:text-white border border-neutral-800/80 transition-all flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-white">{preset.name}</span>
                        <span className="text-[9px] uppercase px-1.5 py-0.2 rounded bg-neutral-800 text-neutral-400 font-mono">
                          {preset.gridType}
                        </span>
                      </div>
                      <span className="text-[10px] text-neutral-400 leading-tight">
                        {preset.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ACOUSTIC SOUND & UMBRÁFONO INTEGRATION */}
          <div className="mt-4 pt-3 border-t border-neutral-900 bg-neutral-900/40 -mx-4 px-4 pb-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-400 flex items-center gap-1.5">
                <Music size={12} className="text-amber-400" />
                <span>Acoustic Sound & Umbráfono</span>
              </span>
              <button
                type="button"
                onClick={onToggleAudio}
                className={`text-[10px] px-2 py-0.5 rounded font-medium border flex items-center gap-1 transition-all cursor-pointer ${
                  isAudioEnabled
                    ? 'bg-amber-950/90 text-amber-300 border-amber-600/70 shadow-sm'
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                }`}
              >
                {isAudioEnabled ? <Volume2 size={11} className="text-amber-400" /> : <VolumeX size={11} />}
                <span>{isAudioEnabled ? 'Sound On' : 'Muted'}</span>
              </button>
            </div>

            {/* Sound Track Info Card */}
            <div className="p-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 mb-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-white truncate flex items-center gap-1.5">
                    <Radio size={11} className="text-amber-400 shrink-0" />
                    <span className="truncate">Umbráfono (Dos Piezas Sonoras)</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate">
                    Enrique del Castillo · Czech Republic Installation
                  </div>
                </div>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-900 text-amber-300 border border-amber-900/60 font-mono shrink-0">
                  Optical Sound
                </span>
              </div>

              {/* Real-time Oscilloscope / Frequency Spectrum */}
              <div className="mt-2">
                <AudioVisualizer isEnabled={isAudioEnabled} />
              </div>

              {/* Playback Scrubber & Progress */}
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400">
                  <span className="text-amber-300/90 font-medium">
                    {formatTime(audioMetrics?.currentTime ?? 0)}
                  </span>
                  <span className="text-neutral-500">
                    {audioMetrics?.duration ? formatTime(audioMetrics.duration) : '05:04'}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={audioMetrics?.duration || 304}
                  step={0.5}
                  value={audioMetrics?.currentTime || 0}
                  onChange={(e) => plateAudio.seek(parseFloat(e.target.value))}
                  disabled={!isAudioEnabled}
                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400 hover:accent-amber-300 disabled:opacity-40"
                  title="Seek audio track position"
                />
              </div>
            </div>

            {/* Audio Source Selector */}
            <div className="mb-2.5">
              <div className="text-[10px] text-neutral-400 mb-1 flex items-center justify-between">
                <span>Resonance Audio Source</span>
                <span className="font-mono text-neutral-300 text-[10px]">
                  {params.audioSource === 'umbrafono'
                    ? 'Umbráfono Piece'
                    : params.audioSource === 'synth'
                    ? 'Modal Sine'
                    : 'Hybrid Layered'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => updateParam('audioSource', 'umbrafono')}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    params.audioSource === 'umbrafono'
                      ? 'bg-amber-400 text-neutral-950 border-amber-300 font-semibold shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                  title="Play Enrique del Castillo's Umbráfono sound piece"
                >
                  Umbráfono
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('audioSource', 'synth')}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    params.audioSource === 'synth'
                      ? 'bg-amber-400 text-neutral-950 border-amber-300 font-semibold shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                  title="Synthesize pure mathematical Chladni eigenfrequencies"
                >
                  Modal Synth
                </button>
                <button
                  type="button"
                  onClick={() => updateParam('audioSource', 'hybrid')}
                  className={`py-1 px-1.5 rounded text-[10px] font-medium border text-center transition-all cursor-pointer ${
                    params.audioSource === 'hybrid'
                      ? 'bg-amber-400 text-neutral-950 border-amber-300 font-semibold shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
                  }`}
                  title="Layer Umbráfono audio piece with harmonic modal resonance"
                >
                  Hybrid
                </button>
              </div>
            </div>

            {/* Master Volume Slider */}
            <SliderRow
              label="Audio Master Volume"
              value={params.audioVolume}
              min={0.0}
              max={1.0}
              step={0.05}
              digits={2}
              formatFn={(v) => `${Math.round(v * 100)}%`}
              onChange={(val) => updateParam('audioVolume', val)}
            />

            {/* Playback Speed / Pitch Slider */}
            <SliderRow
              label="Playback speed / pitch"
              value={params.audioPlaybackRate}
              min={0.5}
              max={2.0}
              step={0.05}
              digits={2}
              formatFn={(v) => `${v.toFixed(2)}x`}
              onChange={(val) => updateParam('audioPlaybackRate', val)}
            />

            {/* SETTINGS CONNECTION 1: Audio-Reactive Cymatics (Sound drives Plate) */}
            <div className="pt-2.5 mt-2 border-t border-neutral-850 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-white text-[11px] flex items-center gap-1.5">
                    <Activity size={12} className="text-cyan-400" />
                    <span>Audio-Reactive Cymatics</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    Sound FFT frequencies vibrate plate & bounce sand in real time
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={params.audioReactiveDrive}
                    onChange={(e) => updateParam('audioReactiveDrive', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500"></div>
                </label>
              </div>

              {params.audioReactiveDrive && (
                <div className="pl-2 border-l-2 border-cyan-500/50 space-y-1.5 mt-1.5">
                  <SliderRow
                    label="Reactive modulation depth"
                    value={params.audioReactiveIntensity}
                    min={0.0}
                    max={2.0}
                    step={0.05}
                    digits={2}
                    formatFn={(v) => `${Math.round(v * 100)}%`}
                    onChange={(val) => updateParam('audioReactiveIntensity', val)}
                  />
                  {audioMetrics && (
                    <div className="grid grid-cols-4 gap-1 text-[9px] font-mono text-center pt-0.5">
                      <div className="bg-neutral-950 p-1 rounded border border-neutral-800">
                        <div className="text-neutral-500">BASS (M)</div>
                        <div className="text-cyan-300">{Math.round(audioMetrics.bass * 100)}%</div>
                      </div>
                      <div className="bg-neutral-950 p-1 rounded border border-neutral-800">
                        <div className="text-neutral-500">MID (N)</div>
                        <div className="text-cyan-300">{Math.round(audioMetrics.mid * 100)}%</div>
                      </div>
                      <div className="bg-neutral-950 p-1 rounded border border-neutral-800">
                        <div className="text-neutral-500">HIGH (K)</div>
                        <div className="text-cyan-300">{Math.round(audioMetrics.treble * 100)}%</div>
                      </div>
                      <div className="bg-neutral-950 p-1 rounded border border-neutral-800">
                        <div className="text-neutral-500">KICK</div>
                        <div className="text-amber-300">{Math.round(audioMetrics.transientKick * 100)}%</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SETTINGS CONNECTION 2: Resonance Filters Audio (Plate Modes drive Sound) */}
            <div className="pt-2 border-t border-neutral-850 mt-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-white text-[11px] flex items-center gap-1.5">
                    <Waves size={12} className="text-amber-400" />
                    <span>Resonance Filters Audio</span>
                  </div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    Modes M, N & K tune acoustic plate filter frequency
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={params.audioResonanceFilter}
                    onChange={(e) => updateParam('audioResonanceFilter', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {params.audioResonanceFilter && audioMetrics && (
                <div className="mt-1.5 p-1.5 rounded bg-neutral-950 text-[10px] font-mono flex items-center justify-between text-neutral-400 border border-neutral-800">
                  <span>Acoustic Peak:</span>
                  <span className="text-amber-300 font-semibold">{audioMetrics.resonanceFreq} Hz</span>
                </div>
              )}
            </div>

            {/* SETTINGS CONNECTION 3: Pitch Linked to Mode Frequency */}
            <div className="pt-2 border-t border-neutral-850 mt-2">
              <div className="flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-white text-[11px]">
                    Pitch Linked to Resonant Mode
                  </div>
                  <div className="text-[10px] text-neutral-400 leading-tight">
                    Higher modes pitch audio up, lower modes pitch down
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer ml-2">
                  <input
                    type="checkbox"
                    checked={params.audioPitchLinked}
                    onChange={(e) => updateParam('audioPitchLinked', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
            </div>
          </div>

          {/* RESONANCE Section */}
          <div className="mt-4 pt-2 border-t border-neutral-900">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
                RESONANCE FREQUENCIES
              </span>
              {audioMetrics && (
                <span className="text-[10px] text-amber-400 font-mono">
                  ~{audioMetrics.resonanceFreq} Hz
                </span>
              )}
            </div>
            <SliderRow
              label="Mode m (radial/horizontal)"
              value={params.modeM}
              min={1.0}
              max={14.0}
              step={0.05}
              digits={2}
              onChange={(val) => updateParam('modeM', val)}
            />
            <SliderRow
              label="Mode n (azimuthal/vertical)"
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

          {/* SAND Section */}
          <div className="mt-4 pt-2 border-t border-neutral-900">
            <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500 mb-1">
              SAND
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
            {/* Grain count selector with lower count choices and continuous slider */}
            <div className="flex flex-col gap-1.5 py-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-normal">Grain count</span>
                <span className="font-mono text-neutral-200 text-xs bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800/80">
                  {params.grainCount >= 1_000_000
                    ? '1,000,000 (1M)'
                    : params.grainCount >= 1000
                    ? `${(params.grainCount / 1000).toFixed(params.grainCount % 1000 === 0 ? 0 : 1)}k`
                    : params.grainCount.toLocaleString()}
                </span>
              </div>

              {/* Quick Select Buttons: 5k to 1M */}
              <div className="grid grid-cols-4 gap-1 mt-0.5">
                {grainCountOptions.map((opt) => {
                  const isMatch = Math.abs(params.grainCount - opt.value) < opt.value * 0.12;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => updateParam('grainCount', opt.value)}
                      className={`text-[10px] py-1 rounded border text-center transition-all cursor-pointer ${
                        isMatch
                          ? 'bg-neutral-200 text-neutral-950 font-medium border-white shadow-sm'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* Continuous Grain Count Range Slider */}
              <div className="pt-1.5">
                <input
                  type="range"
                  min={5000}
                  max={1000000}
                  step={5000}
                  value={params.grainCount}
                  onChange={(e) => updateParam('grainCount', parseInt(e.target.value, 10))}
                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-300 hover:accent-white transition-all"
                />
                <div className="flex justify-between text-[9px] text-neutral-500 font-mono mt-0.5">
                  <span>5k (coarse)</span>
                  <span>100k</span>
                  <span>1M (ultra-fine)</span>
                </div>
              </div>
            </div>

            {/* Grain size selector with quick presets and continuous slider */}
            <div className="flex flex-col gap-1.5 py-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400 font-normal">Grain size</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const current = params.grainSize ?? 1.0;
                      const next = Math.max(0.2, +(current - 0.1).toFixed(1));
                      updateParam('grainSize', next);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Decrease grain size"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span className="w-14 text-center font-mono text-neutral-200 text-xs bg-neutral-900/80 py-0.5 rounded border border-neutral-800/80">
                    {(params.grainSize ?? 1.0).toFixed(1)}x
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const current = params.grainSize ?? 1.0;
                      const next = Math.min(4.0, +(current + 0.1).toFixed(1));
                      updateParam('grainSize', next);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
                    title="Increase grain size"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>

              {/* Quick Select Buttons: Fine to Coarse */}
              <div className="grid grid-cols-4 gap-1 mt-0.5">
                {grainSizeOptions.map((opt) => {
                  const current = params.grainSize ?? 1.0;
                  const isMatch = Math.abs(current - opt.value) < 0.15;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => updateParam('grainSize', opt.value)}
                      className={`text-[10px] py-1 rounded border text-center transition-all cursor-pointer ${
                        isMatch
                          ? 'bg-neutral-200 text-neutral-950 font-medium border-white shadow-sm'
                          : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200 hover:bg-neutral-800'
                      }`}
                    >
                      {opt.label} ({opt.value.toFixed(1)}x)
                    </button>
                  );
                })}
              </div>

              {/* Continuous Grain Size Range Slider */}
              <div className="pt-1.5">
                <input
                  type="range"
                  min={0.2}
                  max={4.0}
                  step={0.1}
                  value={params.grainSize ?? 1.0}
                  onChange={(e) => updateParam('grainSize', parseFloat(e.target.value))}
                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-neutral-300 hover:accent-white transition-all"
                />
                <div className="flex justify-between text-[9px] text-neutral-500 font-mono mt-0.5">
                  <span>0.2x (micro)</span>
                  <span>1.0x (standard)</span>
                  <span>4.0x (macro)</span>
                </div>
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

            {/* SIMULATION ENGINE & WASM ACCELERATION */}
            <div className="mt-4 pt-3 border-t border-neutral-900 bg-neutral-900/40 -mx-4 px-4 pb-3 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400 flex items-center gap-1">
                    <Zap size={11} />
                    Simulation Engine
                  </span>
                </div>
                {onOpenWasmLab && (
                  <button
                    type="button"
                    onClick={onOpenWasmLab}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <span>WASM Lab</span>
                    <ChevronRight size={11} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-3 gap-1 mb-2.5">
                <button
                  type="button"
                  onClick={() => updateParam('simulationEngine', 'gpu')}
                  className={`px-2 py-1.5 rounded text-left border transition-all cursor-pointer ${
                    params.simulationEngine === 'gpu'
                      ? 'bg-neutral-200 text-neutral-950 font-medium border-white shadow-sm'
                      : 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="WebGL fragment shader ping-pong textures. Best for massive 100k - 1M grains."
                >
                  <div className="text-[10px] font-semibold leading-tight">GPU Shader</div>
                  <div className="text-[8px] opacity-75 font-mono">1M Grains</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateParam('simulationEngine', 'wasm')}
                  className={`px-2 py-1.5 rounded text-left border transition-all cursor-pointer ${
                    params.simulationEngine === 'wasm'
                      ? 'bg-emerald-400 text-neutral-950 font-medium border-emerald-300 shadow-sm'
                      : 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="Compiled WebAssembly SIMD particle physics with direct zero-copy WebGL memory streaming."
                >
                  <div className="text-[10px] font-semibold leading-tight">WASM SIMD</div>
                  <div className="text-[8px] opacity-75 font-mono">Zero-Copy</div>
                </button>

                <button
                  type="button"
                  onClick={() => updateParam('simulationEngine', 'js_cpu')}
                  className={`px-2 py-1.5 rounded text-left border transition-all cursor-pointer ${
                    params.simulationEngine === 'js_cpu'
                      ? 'bg-amber-400 text-neutral-950 font-medium border-amber-300 shadow-sm'
                      : 'bg-neutral-900/90 text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                  }`}
                  title="JavaScript CPU execution for baseline performance comparison."
                >
                  <div className="text-[10px] font-semibold leading-tight">JS CPU</div>
                  <div className="text-[8px] opacity-75 font-mono">Baseline JIT</div>
                </button>
              </div>

              {onOpenWasmLab && (
                <button
                  type="button"
                  onClick={onOpenWasmLab}
                  className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-cyan-950/90 to-indigo-950/90 hover:from-cyan-900 hover:to-indigo-900 text-cyan-300 hover:text-white border border-cyan-800/60 transition-all text-xs font-medium flex items-center justify-center gap-1.5 shadow-md cursor-pointer group"
                >
                  <Microchip size={13} className="text-cyan-400 group-hover:rotate-12 transition-transform" />
                  <span>Wasm Research Lab & Benchmarks</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expand Button when collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="fixed top-4 right-4 z-30 p-2.5 rounded-lg bg-neutral-950/90 text-neutral-300 hover:text-white border border-neutral-800 shadow-xl backdrop-blur transition-all flex items-center gap-2 text-xs cursor-pointer"
          title="Open controls"
        >
          <ChevronLeft size={16} />
          <span>Grid Controls</span>
        </button>
      )}

      {/* Floating Bottom-Right Action Buttons */}
      <div className="fixed bottom-5 right-5 z-30 flex items-center gap-2 select-none flex-wrap justify-end">
        {/* WASM Research Lab Quick Button */}
        {onOpenWasmLab && (
          <button
            type="button"
            onClick={onOpenWasmLab}
            className="h-9 px-3 rounded-lg flex items-center gap-1.5 text-xs font-semibold border shadow-xl bg-gradient-to-r from-cyan-950/90 to-indigo-950/90 border-cyan-500/60 text-cyan-300 hover:text-white hover:border-cyan-400 backdrop-blur transition-all cursor-pointer group"
            title="Open WebAssembly Performance Research & Live Benchmarking Lab"
          >
            <Zap size={13} className="text-cyan-400 group-hover:scale-110 transition-transform" />
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
          className="h-9 px-3 rounded-lg border border-cyan-800/60 bg-neutral-900/90 hover:bg-neutral-800 text-cyan-300 hover:text-white shadow-lg backdrop-blur transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          title={`Active Font: ${currentFont?.name || params.fontFamily} — Click to quickly cycle between fonts in fonts folder`}
        >
          <Type size={13} className="text-cyan-400" />
          <span className="max-w-[120px] truncate">{currentFont?.name || 'Font'}</span>
        </button>

        {/* Quick Flip H Toggle */}
        <button
          type="button"
          onClick={() => updateParam('flipHorizontal', !params.flipHorizontal)}
          className={`h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium border shadow-lg backdrop-blur transition-all cursor-pointer ${
            params.flipHorizontal
              ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Flip canvas horizontally (Mirror X)"
        >
          <FlipHorizontal size={14} />
          <span className="hidden md:inline">Flip H</span>
        </button>

        {/* Quick Flip V Toggle */}
        <button
          type="button"
          onClick={() => updateParam('flipVertical', !params.flipVertical)}
          className={`h-9 px-2.5 rounded-lg flex items-center gap-1.5 text-xs font-medium border shadow-lg backdrop-blur transition-all cursor-pointer ${
            params.flipVertical
              ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title="Flip canvas vertically (Mirror Y)"
        >
          <FlipVertical size={14} />
          <span className="hidden md:inline">Flip V</span>
        </button>

        {/* Audio Resonant Tone Toggle */}
        <button
          type="button"
          onClick={onToggleAudio}
          className={`h-9 px-3 rounded-lg flex items-center gap-2 text-xs font-medium border shadow-lg backdrop-blur transition-all cursor-pointer ${
            isAudioEnabled
              ? 'bg-amber-950/80 border-amber-500/60 text-amber-200 hover:border-amber-400 shadow-amber-950/40 shadow-sm'
              : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800'
          }`}
          title={
            isAudioEnabled
              ? `Sound active: ${
                  params.audioSource === 'umbrafono'
                    ? 'Umbráfono (Enrique del Castillo)'
                    : params.audioSource === 'synth'
                    ? 'Modal Synth'
                    : 'Hybrid Audio'
                } (${Math.round(params.audioVolume * 100)}%)`
              : 'Turn sound on (Umbráfono & Resonance)'
          }
        >
          {isAudioEnabled ? (
            <>
              <Volume2 size={14} className="text-amber-400 animate-pulse" />
              <span className="hidden sm:inline font-mono">
                {params.audioSource === 'umbrafono'
                  ? 'Umbráfono'
                  : params.audioSource === 'synth'
                  ? 'Synth'
                  : 'Hybrid'}
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                {Math.round(params.audioVolume * 100)}%
              </span>
            </>
          ) : (
            <>
              <VolumeX size={14} />
              <span className="hidden sm:inline">Sound Muted</span>
            </>
          )}
        </button>

        {/* Pause / Play */}
        <button
          type="button"
          onClick={onTogglePause}
          className="h-9 px-3 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white shadow-lg backdrop-blur transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
        >
          {isPaused ? <Play size={13} /> : <Pause size={13} />}
          <span>{isPaused ? 'Play' : 'Pause'}</span>
        </button>

        {/* Scatter */}
        <button
          type="button"
          onClick={onScatter}
          className="h-9 px-3 rounded-lg bg-neutral-900/90 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white shadow-lg backdrop-blur transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer"
          title="Scatter grains randomly across plate (S)"
        >
          <Sparkles size={13} />
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
          className={`h-9 px-3 rounded-lg border shadow-lg backdrop-blur transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
            justSaved
              ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
              : 'bg-neutral-900/90 hover:bg-neutral-800 border-neutral-800 hover:border-neutral-700 text-neutral-200 hover:text-white'
          }`}
          title="Save current parameters to browser storage (maintains across sessions until reset)"
        >
          {justSaved ? <Check size={13} className="text-emerald-400" /> : <Save size={13} className="text-cyan-400" />}
          <span>{justSaved ? 'Saved!' : 'Save'}</span>
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={onReset}
          className={`h-9 px-3 rounded-lg border shadow-lg backdrop-blur transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer ${
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
          <RotateCcw size={13} className={hasSavedSettings ? 'text-amber-400' : 'text-neutral-400'} />
          <span>Reset</span>
        </button>
      </div>
    </>
  );
};

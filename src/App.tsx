import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChladniParams,
  ChladniMetrics,
  DEFAULT_PARAMS,
  GridType,
  VoidShape,
  PRESETS,
  buildFontVariationSettings,
} from './types/chladni.ts';
import { ChladniCanvas } from './components/ChladniCanvas.tsx';
import { HudStats } from './components/HudStats.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import { WasmResearchLab } from './components/WasmResearchLab.tsx';
import { CustomCursor } from './components/CircleCursor.tsx';
import { plateSynth } from './simulation/audioSynth.ts';
import {
  loadSavedSettings,
  saveSettings,
  clearSavedSettings,
  setAutoSavePreference,
  listVersions,
  saveVersion,
  deleteVersion,
  restoreVersion,
  SavedVersion,
} from './utils/storage.ts';
import { getPerceivedDotColor } from './utils/color.ts';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  Zap,
  Activity,
} from 'lucide-react';

export default function App() {
  const [params, setParams] = useState<ChladniParams>(() => {
    const { params: loadedParams } = loadSavedSettings();
    return {
      ...loadedParams,
      fontFamily: loadedParams.fontFamily || 'iAWriterQuattroV',
      fontWeight: loadedParams.fontWeight ?? 400,
      fontItalic: loadedParams.fontItalic ?? false,
      fontSpacingAxis: loadedParams.fontSpacingAxis ?? 0,
      fontElshAxis: loadedParams.fontElshAxis ?? 0,
      fontLetterSpacing: loadedParams.fontLetterSpacing ?? 0,
      // Minimalist aesthetic palette: silica grains on dark plate
      sandColor: '#f7f5f0',
      sandColorSecondary: '#e4dfd3',
      plateColor: '#070709',
      glowColor: '#ffffff',
      centerVoidRadius: 0.0,
      showVoidGuide: false,
    };
  });
  const [hasSavedSettings, setHasSavedSettings] = useState<boolean>(() => {
    return loadSavedSettings().hasSaved;
  });
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    return loadSavedSettings().autoSave;
  });
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(() => {
    return loadSavedSettings().savedAt;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [savedVersions, setSavedVersions] = useState<SavedVersion[]>(() => listVersions());

  const isResettingRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<ChladniMetrics>({
    settledPercent: 37.9,
    activeFraction: 0.4,
    centerClearance: 99.2,
    centerGrainCount: 0,
    activeEngine: 'gpu',
    computeTimeMs: 0.8,
    fps: 60.0,
    wasmSpeedup: 2.1,
  });
  const [scatterTrigger, setScatterTrigger] = useState<number>(0);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [isWasmLabOpen, setIsWasmLabOpen] = useState<boolean>(false);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(false);

  // Exact perceived on-screen color rendered by the WebGL grain shader
  const dotColor = useMemo(() => {
    return getPerceivedDotColor(params.sandColor, params.sandColorSecondary);
  }, [params.sandColor, params.sandColorSecondary]);

  // Dynamic CSS variable font-variation-settings string
  const fontVariationCss = useMemo(() => {
    return buildFontVariationSettings({
      fontFamily: params.fontFamily,
      fontWeight: params.fontWeight,
      fontSpacingAxis: params.fontSpacingAxis,
      fontElshAxis: params.fontElshAxis,
    });
  }, [params.fontFamily, params.fontWeight, params.fontSpacingAxis, params.fontElshAxis]);

  // Pre-load font when switched to ensure canvas text mask and DOM render immediately
  useEffect(() => {
    if (document.fonts && document.fonts.load) {
      document.fonts.load(`16px "${params.fontFamily}"`).catch(() => {});
      document.fonts.load(`${params.fontWeight} 24px "${params.fontFamily}"`).catch(() => {});
      if (params.fontItalic) {
        document.fonts.load(`italic ${params.fontWeight} 24px "${params.fontFamily}"`).catch(() => {});
      }
    }
  }, [params.fontFamily, params.fontWeight, params.fontItalic]);

  // Auto-dismiss notification toasts
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Handle explicit Save
  const handleSave = useCallback(() => {
    const { timestamp } = saveSettings(params);
    setHasSavedSettings(true);
    setLastSavedTime(timestamp);
    setToastMessage(`✓ Settings saved (${timestamp})`);
  }, [params]);

  // Handle explicit Reset to defaults
  const handleReset = useCallback(() => {
    isResettingRef.current = true;
    clearSavedSettings();
    setHasSavedSettings(false);
    setLastSavedTime(null);
    setParams(DEFAULT_PARAMS);
    setIsPaused(false);
    setResetTrigger((prev) => prev + 1);
    setToastMessage('↺ Settings reset to factory defaults');
  }, []);

  // Handle Toggle Auto-Save
  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      setAutoSavePreference(next);
      setToastMessage(next ? '✓ Auto-save enabled' : 'Auto-save disabled');
      return next;
    });
  }, []);

  // Handle Save Version (named snapshot)
  const handleSaveVersion = useCallback((label: string) => {
    const updated = saveVersion(params, label);
    setSavedVersions(updated);
    setToastMessage(`📌 Version saved: "${label || updated[0].label}"`);
  }, [params]);

  // Handle Restore Version
  const handleRestoreVersion = useCallback((id: string) => {
    const restored = restoreVersion(id);
    if (!restored) return;
    const version = listVersions().find((v) => v.id === id);
    setParams(restored);
    setToastMessage(`↩ Restored: "${version?.label ?? id}"`);
  }, []);

  // Handle Delete Version
  const handleDeleteVersion = useCallback((id: string) => {
    const updated = deleteVersion(id);
    setSavedVersions(updated);
    setToastMessage('🗑 Version deleted');
  }, []);

  // Persist settings across sessions when autoSave is enabled
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (isResettingRef.current) {
      isResettingRef.current = false;
      return;
    }
    if (autoSaveEnabled) {
      const { timestamp } = saveSettings(params);
      setHasSavedSettings(true);
      setLastSavedTime(timestamp);
    }
  }, [params, autoSaveEnabled]);

  // Audio Engine Synchronization with Chladni Settings
  useEffect(() => {
    plateSynth.setEnabled(params.audioEnabled);
  }, [params.audioEnabled]);

  useEffect(() => {
    plateSynth.updateParameters(params, isPaused);
  }, [params, isPaused]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleScatter = useCallback(() => {
    setScatterTrigger((prev) => prev + 1);
    setToastMessage('⚡ Sand scattered');
  }, []);

  const handleToggleAudio = useCallback(() => {
    setParams((prev) => {
      const next = !prev.audioEnabled;
      setToastMessage(next ? '♫ Umbráfono / Acoustic audio playing' : 'Audio muted');
      return { ...prev, audioEnabled: next };
    });
  }, []);

  // Keyboard shortcut to generate next grid
  const handleExperimentNextGrid = useCallback(() => {
    const topologies: GridType[] = ['annular', 'rectangular', 'polar', 'hexagonal', 'diamond', 'web'];
    const nextType = topologies[Math.floor(Math.random() * topologies.length)];
    const m = +(3.0 + Math.floor(Math.random() * 7) * 0.5).toFixed(2);
    const n = +(4.0 + Math.floor(Math.random() * 8) * 0.5).toFixed(2);
    const k = +(28.0 + Math.random() * 10.0).toFixed(1);
    const blend = +(0.55 + Math.random() * 0.4).toFixed(2);

    setParams((prev) => ({
      ...prev,
      gridType: nextType,
      centerVoidRadius: 0.0,
      centerExpulsion: 0.0,
      showVoidGuide: false,
      modeM: m,
      modeN: n,
      waveK: k,
      symmetryBlend: blend,
    }));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePause();
      } else if (e.key === 's' || e.key === 'S') {
        handleScatter();
      } else if (e.key === 'r' || e.key === 'R') {
        handleReset();
      } else if (e.key === 'w' || e.key === 'W') {
        setIsWasmLabOpen((prev) => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        setShowControls((prev) => !prev);
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleAudio();
      } else if (e.key === 'h' || e.key === 'H') {
        setShowHud((prev) => !prev);
      } else if (e.key === 'g' || e.key === 'G') {
        handleExperimentNextGrid();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handleTogglePause,
    handleScatter,
    handleReset,
    handleToggleAudio,
    handleExperimentNextGrid,
  ]);

  return (
    <div
      className="relative min-h-screen w-full bg-[#050507] selection:bg-neutral-800"
      style={{
        '--sand-color': dotColor,
        '--sand-color-sec': params.sandColorSecondary,
        '--active-font-family': `"${params.fontFamily}", system-ui, -apple-system, sans-serif`,
        '--active-font-weight': params.fontWeight,
        '--active-font-style': params.fontItalic ? 'italic' : 'normal',
        '--active-font-variation': fontVariationCss,
        '--active-letter-spacing': params.fontLetterSpacing ? `${params.fontLetterSpacing}px` : 'normal',
        color: dotColor,
      } as React.CSSProperties}
      data-font-italic={params.fontItalic ? 'true' : 'false'}
    >
      {/* 1. FIXED BACKGROUND WEBGL SIMULATION */}
      <ChladniCanvas
        params={params}
        isPaused={isPaused}
        onMetricsUpdate={setMetrics}
        scatterTrigger={scatterTrigger}
        resetTrigger={resetTrigger}
      />

      {/* 2. FOREGROUND DOM ELEMENTS (EXACT LAYOUT FROM REFERENCE IMAGE) */}
      <div className="relative z-10 w-full flex flex-col">
        {/* HERO VIEWPORT — MATCHES SCREENSHOT EXACTLY */}
        <section className="h-screen min-h-[680px] w-full flex flex-col justify-between px-2 sm:px-14 md:px-20 py-8 sm:py-12 select-none">



          {/* Main Title & Subtitle */}
          <div className="w-full my-auto flex flex-col items-start justify-center text-left">
            <p
              data-text-repulsor
              className="w-full max-w-none text-8xl font-serif mx mt-4 sm:mt-5 leading-none tracking-tight font-normal text-left"
              style={{ color: dotColor }}
            >
              TEZETT PLATTE is a Berlin label and recording studio
            </p>
          </div>

          {/* Bottom: Releases Catalog — Artsy & Minimalist: Single Font Size (text-3xl) & Style (font-serif) matching Section About */}
          <div
            className="w-full mx-auto flex flex-col pb-2 sm:pb-4 text-left font-serif text-3xl"
            style={{ color: dotColor }}
          >
            <div
              data-text-repulsor
              className="text-3xl font-serif font-normal mb-6 sm:mb-7 tracking-wide text-left"
            >
              Releases
            </div>

            <div className="flex flex-col gap-5 sm:gap-6 w-full text-3xl font-serif leading-tight font-normal">
              {/* Row 1: Umbrafono Sound Film Series */}
              <div
                onClick={handleToggleAudio}
                className="flex items-start w-full group cursor-pointer text-3xl font-serif leading-tight"
                title="Click to play / toggle Umbráfono sound"
              >
                <span data-text-repulsor className="text-3xl font-serif shrink-0 w-32 sm:w-44">TZ-01</span>
                <div className="flex flex-col text-3xl font-serif leading-tight flex-1">
                  <div className="flex items-baseline justify-between w-full">
                    <span data-text-repulsor className="text-3xl font-serif">Enrique del Castillo</span>
                    <span
                      data-text-repulsor
                      className="text-3xl font-serif italic underline underline-offset-8 cursor-pointer shrink-0 ml-4"
                    >
                      {params.audioEnabled ? '[Playing]' : '[Play]'}
                    </span>
                  </div>
                  <span data-text-repulsor className="text-3xl font-serif italic">Umbráfono (Sound Film Series)</span>
                  <span data-text-repulsor className="text-3xl font-serif">10″ / 35mm — 2023</span>
                </div>
              </div>

              {/* Row 2: Severine Beata That Great Album */}
              <div
                onClick={() => setToastMessage('TZ-02: Severine Beata — That Great Album (12″ Vinyl LP)')}
                className="flex items-start w-full group cursor-pointer text-3xl font-serif leading-tight"
                title="TZ-02: Severine Beata — That Great Album"
              >
                <span data-text-repulsor className="text-3xl font-serif shrink-0 w-32 sm:w-44">TZ-02</span>
                <div className="flex flex-col text-3xl font-serif leading-tight">
                  <span data-text-repulsor className="text-3xl font-serif">Severine Beata</span>
                  <span data-text-repulsor className="text-3xl font-serif italic">That Great Album</span>
                  <span data-text-repulsor className="text-3xl font-serif">12″ LP — 2023</span>
                </div>
              </div>
            </div>
          </div>
        </section>


        {/* SECTION: ABOUT THE STUDIO */}
        <section className="min-h-[70vh] px-2 sm:px-14 md:px-20 py-24 sm:py-32  mx-auto flex flex-col justify-center text-left">
          <div
            data-text-repulsor
            className="text-3xl font-sans font-normal mb-4 tracking-wide text-left"

          >
            About
          </div>

          <h2
            data-text-repulsor
            className="text-3xl font-serif font-normal leading-tight text-left"
            style={{ color: dotColor }}
          >
            Acoustic research atelier, independent label, and recording studio
          </h2>

          <p
            data-text-repulsor
            className="mt-6 text-3xl font-serif leading-tight font-light text-left"
            style={{ color: dotColor, opacity: 0.88 }}
          >
            Founded in Berlin-Kreuzberg, Tezett – Platte is an independent label and recording studio.
            Musicians, sound artists, and composers come to record, perform, and develop work here.
            The space supports a wide range of practices — from electroacoustic and improvised music
            to contemporary composition and experimental sound — and is available for sessions,
            residencies, and label releases.
          </p>
        </section>


        {/* SECTION A: PHYSICAL ATELIER & EQUIPMENT */}
        <section
          id="facility"
          className="px-2 sm:px-14 md:px-20 py-24 sm:py-32 w-full"
        >
          <div
            data-text-repulsor
            className="text-3xl font-sans font-normal mb-10 tracking-wide"
          >
            Facility
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Column 1 */}
            <div>
              <div
                data-text-repulsor
                className="font-mono text-xs uppercase tracking-widest mb-4"
                style={{ color: dotColor, opacity: 0.5 }}
              >
                Acoustic & Resonance
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  'Custom stainless steel Chladni resonance plates (300 – 1200 mm)',
                  'Electrodynamic transducers, 10 Hz – 18 kHz sweep',
                  'Stroboscopic optical film projection rig (35mm dual-optical reader)',
                  'Anechoic measurement chamber for nodal field mapping',
                ].map((item) => (
                  <li
                    key={item}
                    data-text-repulsor
                    className="font-serif text-2xl leading-tight"
                    style={{ color: dotColor, opacity: 0.82 }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 2 */}
            <div>
              <div
                data-text-repulsor
                className="font-mono text-xs uppercase tracking-widest mb-4"
                style={{ color: dotColor, opacity: 0.5 }}
              >
                Recording & Analog Chain
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  'Studer A80 ¼″ 2-track master tape',
                  'Telefunken V72 / Siemens tube preamplifiers',
                  'Coles 4038 ribbon & Neumann KM84 microphones',
                  'Pro Tools HDX + Neve 8078 console for hybrid sessions',
                ].map((item) => (
                  <li
                    key={item}
                    data-text-repulsor
                    className="font-serif text-2xl leading-tight"
                    style={{ color: dotColor, opacity: 0.82 }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3 */}
            <div>
              <div
                data-text-repulsor
                className="font-mono text-xs uppercase tracking-widest mb-4"
                style={{ color: dotColor, opacity: 0.5 }}
              >
                Editions & Lacquer
              </div>
              <ul className="flex flex-col gap-3">
                {[
                  'Short-run polycarbonate & lacquer cutting for archival micro-editions',
                  'Hand-numbered vinyl pressings and cassette duplication',
                  'Silkscreened graphic scores on raw cartridge paper',
                  'Booklet offset printing for limited catalogue publications',
                ].map((item) => (
                  <li
                    key={item}
                    data-text-repulsor
                    className="font-serif text-2xl leading-tight"
                    style={{ color: dotColor, opacity: 0.82 }}
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>



        {/* SECTION: CONTACT & IMPRINT */}
        <footer
          id="contact"
          className="px-8 sm:px-14 md:px-20 py-28 sm:py-36  mx-auto w-full"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div>
              <div
                data-text-repulsor
                className="text-3xl font-sans uppercase tracking-wider mb-2"
                style={{ color: dotColor, opacity: 0.75 }}
              >
                Contact
              </div>
              <p
                data-text-repulsor
                className="text-3xl sm:text-3xl font-serif font-normal"
                style={{ color: dotColor }}
              >
                contact@tezett-platte.berlin
              </p>
              <p
                data-text-repulsor
                className="text-3xl font-sans mt-4"
                style={{ color: dotColor, opacity: 0.75 }}
              >
                Klanglabor Berlin · Kreuzberg
              </p>
            </div>

            {/* ADDITION D: Visit by Appointment */}
            <div>
              <div
                data-text-repulsor
                className="text-3xl font-sans uppercase tracking-wider mb-2"
                style={{ color: dotColor, opacity: 0.75 }}
              >
                Visit
              </div>
              <p
                data-text-repulsor
                className="text-3xl font-serif leading-tight"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                Köpenicker Straße · Hinterhof
                <br />
                10999 Berlin · Kreuzberg
              </p>
              <p
                data-text-repulsor
                className="mt-4 font-mono text-sm"
                style={{ color: dotColor, opacity: 0.5 }}
              >
                Sessions and listening visits by prior arrangement only.
                <br />
                residencies@tezett-platte.berlin
              </p>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <div
                  data-text-repulsor
                  className="text-3xl font-sans uppercase tracking-wider mb-2"
                  style={{ color: dotColor, opacity: 0.75 }}
                >
                  Physical Studio
                </div>
                <p
                  data-text-repulsor
                  className="text-3xl font-sans leading-tight"
                  style={{ color: dotColor, opacity: 0.8 }}
                >
                  Recording, mixing, and mastering for independent artists and labels. Acoustic research
                  apparatus, analog tape, and resonance plates available for sessions by arrangement.
                </p>
              </div>

              <div
                className="mt-8 text-3xl font-mono flex items-center gap-3"
                style={{ color: dotColor, opacity: 0.55 }}
              >
                <span>© 2026 TEZETT – PLATTE</span>
                <span>·</span>
                <span>BERLIN</span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* 3. MINIMALIST CORNER CONTROLS (DISCREET & UNINTRUSIVE) */}
      <div data-ui-panel className="fixed bottom-4 left-4 z-30 flex items-center gap-2 select-none">
        {/* Audio Toggle */}
        <button
          type="button"
          onClick={handleToggleAudio}
          className="px-3 py-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-all flex items-center gap-2 cursor-pointer shadow-lg opacity-70 hover:opacity-100"
          style={{ color: dotColor, borderColor: `${dotColor}33` }}
          title="Toggle Umbráfono / Acoustic audio (M)"
        >
          {params.audioEnabled ? (
            <Volume2 size={13} style={{ color: dotColor }} />
          ) : (
            <VolumeX size={13} style={{ color: dotColor }} />
          )}
          <span>{params.audioEnabled ? 'Umbráfono ON' : 'Audio (M)'}</span>
        </button>

        {/* Scatter Grains */}
        <button
          type="button"
          onClick={handleScatter}
          className="p-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-all cursor-pointer shadow-lg opacity-70 hover:opacity-100"
          style={{ color: dotColor, borderColor: `${dotColor}33` }}
          title="Scatter sand (S)"
        >
          <Sparkles size={13} style={{ color: dotColor }} />
        </button>

        {/* Telemetry HUD */}
        <button
          type="button"
          onClick={() => setShowHud((prev) => !prev)}
          aria-pressed={showHud}
          className={`p-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-all cursor-pointer shadow-lg hover:opacity-100 ${
            showHud ? 'opacity-100' : 'opacity-70'
          }`}
          style={{ color: dotColor, borderColor: showHud ? `${dotColor}66` : `${dotColor}33` }}
          title="Toggle telemetry HUD (H)"
        >
          <Activity size={13} style={{ color: dotColor }} />
        </button>
      </div>

      <div data-ui-panel className="fixed bottom-4 right-4 z-30 flex items-center gap-2 select-none">
        {/* Toggle Controls Drawer */}
        <button
          type="button"
          onClick={() => setShowControls((prev) => !prev)}
          className="px-3 py-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-all flex items-center gap-1.5 cursor-pointer shadow-lg opacity-70 hover:opacity-100"
          style={{ color: dotColor, borderColor: `${dotColor}33` }}
          title="Toggle Physics & Tuning Controls (C)"
        >
          <Sliders size={13} style={{ color: dotColor }} />
          <span>Studio (C)</span>
        </button>

        {/* WASM Benchmarks */}
        <button
          type="button"
          onClick={() => setIsWasmLabOpen(true)}
          className="p-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-all cursor-pointer shadow-lg opacity-70 hover:opacity-100"
          style={{ color: dotColor, borderColor: `${dotColor}33` }}
          title="Open WebAssembly Benchmarks (W)"
        >
          <Zap size={13} style={{ color: dotColor }} />
        </button>
      </div>

      {/* 4. OPTIONAL FLOATING HUD TELEMETRY */}
      {showHud && (
        <HudStats
          metrics={metrics}
          params={params}
          onOpenWasmLab={() => setIsWasmLabOpen(true)}
          onToggleAudio={handleToggleAudio}
        />
      )}

      {/* 5. COLLAPSIBLE CONTROLS DRAWER */}
      {showControls && (
        <ControlPanel
          params={params}
          onChange={setParams}
          isPaused={isPaused}
          onTogglePause={handleTogglePause}
          onScatter={handleScatter}
          onSave={handleSave}
          onReset={handleReset}
          isAudioEnabled={params.audioEnabled}
          onToggleAudio={handleToggleAudio}
          onOpenWasmLab={() => setIsWasmLabOpen(true)}
          audioMetrics={metrics.audio}
          hasSavedSettings={hasSavedSettings}
          autoSaveEnabled={autoSaveEnabled}
          onToggleAutoSave={handleToggleAutoSave}
          lastSavedTime={lastSavedTime}
          savedVersions={savedVersions}
          onSaveVersion={handleSaveVersion}
          onRestoreVersion={handleRestoreVersion}
          onDeleteVersion={handleDeleteVersion}
        />
      )}

      {/* 6. STATUS TOAST */}
      {toastMessage && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-neutral-900/95 border border-neutral-800 shadow-2xl backdrop-blur text-xs text-neutral-200 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="font-mono">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 7. WASM RESEARCH & LIVE BENCHMARKING LAB MODAL */}
      <WasmResearchLab
        isOpen={isWasmLabOpen}
        onClose={() => setIsWasmLabOpen(false)}
        onSelectEngine={(engine) => setParams((prev) => ({ ...prev, simulationEngine: engine }))}
        currentEngine={params.simulationEngine}
      />

      {/* 8. CUSTOM POINTER (FULL CIRCLE) */}
      <CustomCursor color={dotColor} shape="circle" filled={true} />
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ChladniParams,
  ChladniMetrics,
  DEFAULT_PARAMS,
  GridType,
  VoidShape,
  PRESETS,
} from './types/chladni.ts';
import { ChladniCanvas } from './components/ChladniCanvas.tsx';
import { HudStats } from './components/HudStats.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import { WasmResearchLab } from './components/WasmResearchLab.tsx';
import { plateSynth } from './simulation/audioSynth.ts';
import {
  loadSavedSettings,
  saveSettings,
  clearSavedSettings,
  setAutoSavePreference,
} from './utils/storage.ts';
import { getPerceivedDotColor } from './utils/color.ts';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  Zap,
} from 'lucide-react';

export default function App() {
  const [params, setParams] = useState<ChladniParams>(() => {
    const { params: loadedParams } = loadSavedSettings();
    return {
      ...loadedParams,
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
  const [showHud, setShowHud] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);

  // Exact perceived on-screen color rendered by the WebGL grain shader
  const dotColor = useMemo(() => {
    return getPerceivedDotColor(params.sandColor, params.sandColorSecondary);
  }, [params.sandColor, params.sandColorSecondary]);

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
        color: dotColor,
      } as React.CSSProperties}
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
        <section className="h-screen min-h-[680px] w-full flex flex-col justify-between px-8 sm:px-14 md:px-20 py-8 sm:py-12 select-none">
          {/* Top Right: Contact */}
          <div className="w-full flex justify-end">
            <a
              href="#contact"
              data-text-repulsor
              className="text-sm sm:text-base font-normal tracking-wide transition-opacity cursor-pointer hover:opacity-100"
              style={{ color: dotColor, opacity: 0.85 }}
            >
              Contact
            </a>
          </div>

          {/* Center: TEZETT – PLATTE & Subtitle */}
          <div className="my-auto flex flex-col items-center justify-center text-center px-4">
            <h1
              data-text-repulsor
              className="text-base sm:text-lg md:text-xl font-bold tracking-[0.16em] uppercase font-sans"
              style={{ color: dotColor }}
            >
              TEZETT – PLATTE
            </h1>

            <p
              data-text-repulsor
              className="text-2xl sm:text-3xl md:text-4xl lg:text-[42px] font-serif mt-4 sm:mt-5 max-w-4xl leading-tight font-normal"
              style={{ color: dotColor }}
            >
              is a Berlin based label and studio of great musicians
            </p>
          </div>

          {/* Bottom: Releases and Track Rows */}
          <div className="w-full max-w-6xl mx-auto flex flex-col pb-2 sm:pb-4">
            <div
              data-text-repulsor
              className="text-sm sm:text-base font-sans font-normal mb-6 sm:mb-7 tracking-wide"
              style={{ color: dotColor, opacity: 0.8 }}
            >
              Releases
            </div>

            <div className="flex flex-col gap-4 sm:gap-5 w-full">
              {/* Row 1: Umbrafono Sound Film Series ────────────── 2023 */}
              <div
                onClick={handleToggleAudio}
                className="flex items-baseline w-full group cursor-pointer"
                title="Click to play / toggle Umbráfono sound"
              >
                <span
                  data-text-repulsor
                  className="font-serif text-xl sm:text-2xl md:text-3xl transition-opacity group-hover:opacity-100"
                  style={{ color: dotColor }}
                >
                  Umbrafono
                </span>
                <span className="mx-1.5" />
                <span
                  data-text-repulsor
                  className="font-serif italic text-xl sm:text-2xl md:text-3xl transition-opacity group-hover:opacity-100"
                  style={{ color: dotColor, opacity: 0.88 }}
                >
                  Sound Film Series
                </span>
                <div
                  data-text-repulsor="line"
                  className="flex-1 mx-3 sm:mx-6 border-b mb-2 transition-opacity group-hover:opacity-70"
                  style={{ borderColor: dotColor, opacity: 0.35 }}
                />
                <span
                  data-text-repulsor
                  className="font-serif text-xl sm:text-2xl md:text-3xl transition-opacity group-hover:opacity-100"
                  style={{ color: dotColor, opacity: 0.88 }}
                >
                  2023
                </span>
              </div>

              {/* Row 2: Severine Beata That Great Album ────────────── 2023 */}
              <div className="flex items-baseline w-full group cursor-pointer">
                <span
                  data-text-repulsor
                  className="font-serif text-xl sm:text-2xl md:text-3xl transition-opacity group-hover:opacity-100"
                  style={{ color: dotColor }}
                >
                  Severine Beata
                </span>
                <span className="mx-1.5" />
                <span
                  data-text-repulsor
                  className="font-serif italic text-xl sm:text-2xl md:text-3xl transition-opacity group-hover:opacity-100"
                  style={{ color: dotColor, opacity: 0.88 }}
                >
                  That Great Album
                </span>
                <div
                  data-text-repulsor="line"
                  className="flex-1 mx-3 sm:mx-6 border-b mb-2 transition-opacity group-hover:opacity-70"
                  style={{ borderColor: dotColor, opacity: 0.35 }}
                />
                <span
                  data-text-repulsor
                  className="font-serif text-xl sm:text-2xl md:text-3xl transition-opacity group-hover:opacity-100"
                  style={{ color: dotColor, opacity: 0.88 }}
                >
                  2023
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SCROLLABLE CATALOG & STUDIO SECTIONS (REVEALED WHEN SCROLLING) */}
        <section className="min-h-[80vh] px-8 sm:px-14 md:px-20 py-24 sm:py-32 max-w-6xl mx-auto flex flex-col justify-center">
          <div
            data-text-repulsor
            className="text-sm sm:text-base font-sans font-normal mb-8 tracking-wide uppercase"
            style={{ color: dotColor, opacity: 0.75 }}
          >
            Archive & Recordings
          </div>

          <div className="flex flex-col gap-6 sm:gap-8 w-full">
            {/* Archive Row 1 */}
            <div className="flex items-baseline w-full group cursor-pointer">
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor }}
              >
                Enrique del Castillo
              </span>
              <span className="mx-1.5" />
              <span
                data-text-repulsor
                className="font-serif italic text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                Optical Sound Compositions
              </span>
              <div
                data-text-repulsor="line"
                className="flex-1 mx-3 sm:mx-6 border-b mb-2"
                style={{ borderColor: dotColor, opacity: 0.3 }}
              />
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                2022
              </span>
            </div>

            {/* Archive Row 2 */}
            <div className="flex items-baseline w-full group cursor-pointer">
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor }}
              >
                Klara Lewis
              </span>
              <span className="mx-1.5" />
              <span
                data-text-repulsor
                className="font-serif italic text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                Live In Berlin
              </span>
              <div
                data-text-repulsor="line"
                className="flex-1 mx-3 sm:mx-6 border-b mb-2"
                style={{ borderColor: dotColor, opacity: 0.3 }}
              />
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                2022
              </span>
            </div>

            {/* Archive Row 3 */}
            <div className="flex items-baseline w-full group cursor-pointer">
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor }}
              >
                Chladni Waveforms
              </span>
              <span className="mx-1.5" />
              <span
                data-text-repulsor
                className="font-serif italic text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                Acoustic Levitation & Resonance
              </span>
              <div
                data-text-repulsor="line"
                className="flex-1 mx-3 sm:mx-6 border-b mb-2"
                style={{ borderColor: dotColor, opacity: 0.3 }}
              />
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                2021
              </span>
            </div>

            {/* Archive Row 4 */}
            <div className="flex items-baseline w-full group cursor-pointer">
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor }}
              >
                Jan Jelinek
              </span>
              <span className="mx-1.5" />
              <span
                data-text-repulsor
                className="font-serif italic text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                Zwischen den Zeilen
              </span>
              <div
                data-text-repulsor="line"
                className="flex-1 mx-3 sm:mx-6 border-b mb-2"
                style={{ borderColor: dotColor, opacity: 0.3 }}
              />
              <span
                data-text-repulsor
                className="font-serif text-xl sm:text-2xl md:text-3xl"
                style={{ color: dotColor, opacity: 0.88 }}
              >
                2021
              </span>
            </div>
          </div>
        </section>

        {/* SECTION: ABOUT THE STUDIO */}
        <section className="min-h-[70vh] px-8 sm:px-14 md:px-20 py-24 sm:py-32 max-w-5xl mx-auto flex flex-col justify-center">
          <div
            data-text-repulsor
            className="text-sm sm:text-base font-sans font-normal mb-4 tracking-wide uppercase"
            style={{ color: dotColor, opacity: 0.75 }}
          >
            About
          </div>

          <h2
            data-text-repulsor
            className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal leading-snug"
            style={{ color: dotColor }}
          >
            Acoustic physical research atelier and recording studio
          </h2>

          <p
            data-text-repulsor
            className="mt-6 text-lg sm:text-xl font-serif leading-relaxed font-light"
            style={{ color: dotColor, opacity: 0.88 }}
          >
            Founded in Berlin, Tezett – Platte operates as a dedicated laboratory where kinetic
            vibrations, 35mm optical film sound, and Chladni acoustic physics meet independent
            musicians and sound sculptors. Every frequency produces an exact harmonic geometry.
          </p>
        </section>

        {/* SECTION: CONTACT & IMPRINT */}
        <footer
          id="contact"
          className="px-8 sm:px-14 md:px-20 py-28 sm:py-36 max-w-6xl mx-auto w-full border-t"
          style={{ borderColor: `${dotColor}22` }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <div
                data-text-repulsor
                className="text-sm font-sans uppercase tracking-wider mb-2"
                style={{ color: dotColor, opacity: 0.75 }}
              >
                Contact
              </div>
              <p
                data-text-repulsor
                className="text-2xl sm:text-3xl font-serif font-normal"
                style={{ color: dotColor }}
              >
                contact@tezett-platte.berlin
              </p>
              <p
                data-text-repulsor
                className="text-sm font-sans mt-4"
                style={{ color: dotColor, opacity: 0.75 }}
              >
                Klanglabor Berlin · Kreuzberg
              </p>
            </div>

            <div className="flex flex-col justify-between">
              <div>
                <div
                  data-text-repulsor
                  className="text-sm font-sans uppercase tracking-wider mb-2"
                  style={{ color: dotColor, opacity: 0.75 }}
                >
                  Physical Studio
                </div>
                <p
                  data-text-repulsor
                  className="text-sm font-sans leading-relaxed"
                  style={{ color: dotColor, opacity: 0.8 }}
                >
                  Analog tape mastering, optical film projectors, and 2D acoustic sand plates for
                  harmonic visualization.
                </p>
              </div>

              <div
                className="mt-8 text-xs font-mono flex items-center gap-3"
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
      <div className="fixed bottom-4 left-4 z-30 flex items-center gap-2 select-none">
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
      </div>

      <div className="fixed bottom-4 right-4 z-30 flex items-center gap-2 select-none">
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
    </div>
  );
}

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { ChladniMetrics, buildFontVariationSettings } from './types/chladni.ts';
import { randomizeGridParams } from './utils/grid.ts';
import { useChladniSettings } from './hooks/useChladniSettings.ts';
import { ChladniCanvas } from './components/ChladniCanvas.tsx';
import { HudStats } from './components/HudStats.tsx';
import { Hero } from './components/sections/Hero.tsx';
import { About } from './components/sections/About.tsx';
import { Facility } from './components/sections/Facility.tsx';
import { Contact } from './components/sections/Contact.tsx';
import { CustomCursor } from './components/CircleCursor.tsx';
import { plateSynth } from './simulation/audioSynth.ts';
import { getPerceivedDotColor } from './utils/color.ts';
import {
  Volume2,
  VolumeX,
  Sparkles,
  Sliders,
  Zap,
  Activity,
} from 'lucide-react';

// The Studio drawer and the benchmark lab are heavy and only visible on
// demand, so they are code-split and fetched the first time each is opened.
// Exported prefetchers let the UI warm the chunk on hover/pointer intent so
// the first open does not stall on the network.
const loadControlPanel = () => import('./components/ControlPanel.tsx');
const loadWasmResearchLab = () => import('./components/WasmResearchLab.tsx');

const ControlPanel = React.lazy(() =>
  loadControlPanel().then((m) => ({ default: m.ControlPanel }))
);
const WasmResearchLab = React.lazy(() =>
  loadWasmResearchLab().then((m) => ({ default: m.WasmResearchLab }))
);

const prefetchControlPanel = () => {
  loadControlPanel().catch(() => {});
};
const prefetchWasmResearchLab = () => {
  loadWasmResearchLab().catch(() => {});
};

export default function App() {
  const {
    params,
    setParams,
    hasSavedSettings,
    autoSaveEnabled,
    lastSavedTime,
    savedVersions,
    save,
    reset,
    toggleAutoSave,
    saveVersion,
    restoreVersion,
    deleteVersion,
  } = useChladniSettings();

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<ChladniMetrics>({
    settledPercent: 37.9,
    activeFraction: 0.4,
    centerClearance: 99.2,
    centerGrainCount: 0,
    activeEngine: 'gpu',
    computeTimeMs: 0.8,
    fps: 60.0,
  });
  const [scatterTrigger, setScatterTrigger] = useState<number>(0);
  const [resetTrigger, setResetTrigger] = useState<number>(0);
  const [isWasmLabOpen, setIsWasmLabOpen] = useState<boolean>(false);
  const [showHud, setShowHud] = useState<boolean>(true);
  const [showControls, setShowControls] = useState<boolean>(false);
  // Latch so the lazily-loaded lab keeps its benchmark state after first open
  // while still deferring its chunk until the user asks for it.
  const [wasmLabMounted, setWasmLabMounted] = useState<boolean>(false);

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
    const { success, timestamp } = save();
    if (success) {
      setToastMessage(`✓ Settings saved (${timestamp})`);
    } else {
      setToastMessage('⚠ Could not save settings to storage');
    }
  }, [save]);

  // Handle explicit Reset to defaults
  const handleReset = useCallback(() => {
    reset();
    setIsPaused(false);
    setResetTrigger((prev) => prev + 1);
    setToastMessage('↺ Settings reset to factory defaults');
  }, [reset]);

  // Handle Toggle Auto-Save
  const handleToggleAutoSave = useCallback(() => {
    const next = toggleAutoSave();
    setToastMessage(next ? '✓ Auto-save enabled' : 'Auto-save disabled');
  }, [toggleAutoSave]);

  // Handle Save Version (named snapshot)
  const handleSaveVersion = useCallback(
    (label: string) => {
      const updated = saveVersion(label);
      setToastMessage(`📌 Version saved: "${label || updated[0].label}"`);
    },
    [saveVersion]
  );

  // Handle Restore Version
  const handleRestoreVersion = useCallback(
    (id: string) => {
      const restored = restoreVersion(id);
      if (!restored) return;
      setToastMessage(`↩ Restored: "${restored.version.label}"`);
    },
    [restoreVersion]
  );

  // Handle Delete Version
  const handleDeleteVersion = useCallback(
    (id: string) => {
      deleteVersion(id);
      setToastMessage('🗑 Version deleted');
    },
    [deleteVersion]
  );

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

  const handleOpenWasmLab = useCallback(() => {
    setWasmLabMounted(true);
    setIsWasmLabOpen(true);
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
    setParams((prev) => ({ ...prev, ...randomizeGridParams() }));
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
        setWasmLabMounted(true);
        setIsWasmLabOpen((prev) => !prev);
      } else if (e.key === 'd' || e.key === 'D' || e.key === 'c' || e.key === 'C') {
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
        <Hero
          params={params}
          dotColor={dotColor}
          onToggleAudio={handleToggleAudio}
        />

        <About dotColor={dotColor} />

        <Facility dotColor={dotColor} />

        <Contact dotColor={dotColor} />
      </div>

      {/* 3. MINIMALIST CORNER CONTROLS (DISCREET & UNINTRUSIVE) */}
      {showControls && (
        <>
          <div data-ui-panel className="fixed bottom-4 left-4 z-30 flex items-center gap-2 select-none">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={handleToggleAudio}
              className="px-3 py-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-[background-color,border-color,color,opacity,transform,box-shadow] flex items-center gap-2 cursor-pointer shadow-lg opacity-70 hover:opacity-100"
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
              className="p-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-[background-color,border-color,color,opacity,transform,box-shadow] cursor-pointer shadow-lg opacity-70 hover:opacity-100"
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
              className={`p-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-[background-color,border-color,color,opacity,transform,box-shadow] cursor-pointer shadow-lg hover:opacity-100 ${
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
              onPointerEnter={prefetchControlPanel}
              className="px-3 py-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-[background-color,border-color,color,opacity,transform,box-shadow] flex items-center gap-1.5 cursor-pointer shadow-lg opacity-70 hover:opacity-100"
              style={{ color: dotColor, borderColor: `${dotColor}33` }}
              title="Toggle Physics & Tuning Controls (D)"
            >
              <Sliders size={13} style={{ color: dotColor }} />
              <span>Studio (D)</span>
            </button>

            {/* WASM Benchmarks */}
            <button
              type="button"
              onClick={handleOpenWasmLab}
              onPointerEnter={prefetchWasmResearchLab}
              className="p-1.5 rounded-lg border bg-neutral-950/80 text-xs font-mono backdrop-blur transition-[background-color,border-color,color,opacity,transform,box-shadow] cursor-pointer shadow-lg opacity-70 hover:opacity-100"
              style={{ color: dotColor, borderColor: `${dotColor}33` }}
              title="Open WebAssembly Benchmarks (W)"
            >
              <Zap size={13} style={{ color: dotColor }} />
            </button>
          </div>
        </>
      )}

      {/* 4. OPTIONAL FLOATING HUD TELEMETRY */}
      {showControls && showHud && (
        <HudStats
          metrics={metrics}
          params={params}
          onOpenWasmLab={handleOpenWasmLab}
          onToggleAudio={handleToggleAudio}
        />
      )}

      {/* 5. COLLAPSIBLE CONTROLS DRAWER */}
      {showControls && (
        <Suspense fallback={null}>
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
            onOpenWasmLab={handleOpenWasmLab}
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
        </Suspense>
      )}

      {/* 6. STATUS TOAST */}
      {toastMessage && (
        <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-300 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-neutral-900/95 border border-neutral-800 shadow-2xl backdrop-blur text-xs text-neutral-200 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="font-mono">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* 7. WASM RESEARCH & LIVE BENCHMARKING LAB MODAL */}
      {wasmLabMounted && (
        <Suspense fallback={null}>
          <WasmResearchLab
            isOpen={isWasmLabOpen}
            onClose={() => setIsWasmLabOpen(false)}
            onSelectEngine={(engine) => setParams((prev) => ({ ...prev, simulationEngine: engine }))}
            currentEngine={params.simulationEngine}
          />
        </Suspense>
      )}

      {/* 8. CUSTOM POINTER (FULL CIRCLE) */}
      <CustomCursor color={dotColor} shape="circle" filled={true} />
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChladniParams, ChladniMetrics, DEFAULT_PARAMS, GridType, VoidShape } from './types/chladni.ts';
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

export default function App() {
  const [params, setParams] = useState<ChladniParams>(() => {
    const { params: loadedParams } = loadSavedSettings();
    return loadedParams;
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
  const [toastMessage, setToastMessage] = useState<string | null>(() => {
    const { hasSaved, savedAt } = loadSavedSettings();
    return hasSaved ? `Restored saved session${savedAt ? ` (${savedAt})` : ''}` : null;
  });

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
    setToastMessage(`✓ Settings saved (${timestamp}) — maintained across sessions until reset`);
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
    setToastMessage('↺ Settings reset to factory defaults (saved session cleared)');
  }, []);

  // Handle Toggle Auto-Save
  const handleToggleAutoSave = useCallback(() => {
    setAutoSaveEnabled((prev) => {
      const next = !prev;
      setAutoSavePreference(next);
      setToastMessage(next ? '✓ Auto-save enabled' : 'Auto-save disabled (manual save only)');
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
  }, []);

  const handleToggleAudio = useCallback(() => {
    setParams((prev) => ({ ...prev, audioEnabled: !prev.audioEnabled }));
  }, []);

  // Keyboard shortcut to generate next empty-center grid
  const handleExperimentNextGrid = useCallback(() => {
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

    setParams((prev) => ({
      ...prev,
      gridType: nextType,
      centerVoidRadius: randomRadius,
      centerVoidShape: nextShape,
      centerExpulsion: +(2.2 + Math.random() * 1.4).toFixed(1),
      modeM: m,
      modeN: n,
      waveK: k,
      symmetryBlend: blend,
    }));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
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
      } else if (e.key === 'h' || e.key === 'H') {
        setParams((prev) => ({ ...prev, flipHorizontal: !prev.flipHorizontal }));
      } else if (e.key === 'v' || e.key === 'V') {
        setParams((prev) => ({ ...prev, flipVertical: !prev.flipVertical }));
      } else if (e.key === 'c' || e.key === 'C') {
        // 2D mode — no camera cycling
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
    <div className="relative w-screen h-screen overflow-hidden bg-[#0a0a0c] font-sans antialiased">
      {/* 2D WebGL Canvas Viewport */}
      <ChladniCanvas
        params={params}
        isPaused={isPaused}
        onMetricsUpdate={setMetrics}
        scatterTrigger={scatterTrigger}
        resetTrigger={resetTrigger}
      />

      {/* Top Left HUD Telemetry Display */}
      <HudStats
        metrics={metrics}
        params={params}
        onOpenWasmLab={() => setIsWasmLabOpen(true)}
        onToggleAudio={handleToggleAudio}
      />

      {/* Bottom-Left Keyboard Navigation Guide */}
      <div className="fixed bottom-5 left-5 z-20 pointer-events-none select-none flex items-center gap-1.5 text-[11px] font-mono text-neutral-400 bg-neutral-950/80 border border-neutral-800/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg shadow-xl">
        <span className="text-neutral-500">Pan:</span>
        <span className="text-neutral-200 bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800 text-[10px]">↑ ↓ ← →</span>
        <span className="text-neutral-600">·</span>
        <span className="text-neutral-500">Zoom:</span>
        <span className="text-neutral-200 bg-neutral-900 px-1 py-0.5 rounded border border-neutral-800 text-[10px]">+ / −</span>
      </div>

      {/* Right Controls Panel & Bottom Action Buttons */}
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

      {/* Floating Status Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 pointer-events-none transition-all duration-300 animate-in fade-in slide-in-from-bottom-2">
          <div className="px-3.5 py-1.5 rounded-lg bg-neutral-900/95 border border-neutral-700/80 shadow-2xl backdrop-blur text-xs text-neutral-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* WebAssembly Performance Research Lab & Benchmarking Modal */}
      <WasmResearchLab
        isOpen={isWasmLabOpen}
        onClose={() => setIsWasmLabOpen(false)}
        onSelectEngine={(engine) => setParams((prev) => ({ ...prev, simulationEngine: engine }))}
        currentEngine={params.simulationEngine}
      />
    </div>
  );
}

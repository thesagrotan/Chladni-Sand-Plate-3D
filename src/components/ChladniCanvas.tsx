import React from 'react';
import { ChladniParams, ChladniMetrics } from '../types/chladni.ts';
import type { PaletteColors } from '../utils/paletteTransition.ts';
import { useChladniCanvas } from '../hooks/useChladniCanvas.ts';

interface ChladniCanvasProps {
  params: ChladniParams;
  isPaused: boolean;
  onMetricsUpdate: (metrics: ChladniMetrics) => void;
  scatterTrigger: number;
  resetTrigger: number;
  /** Animated palette read by the shader each frame. */
  paletteRef?: React.MutableRefObject<PaletteColors | null>;
}

export const ChladniCanvas: React.FC<ChladniCanvasProps> = (props) => {
  const { mountRef, webglStatus } = useChladniCanvas(props);

  return (
    <div
      ref={mountRef}
      data-webgl-status={webglStatus}
      className="fixed inset-0 w-full h-full pointer-events-none select-none z-0 overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
      }}
    >
      {webglStatus === 'unavailable' && (
        <div
          data-webgl-fallback
          role="status"
          className="absolute inset-x-0 bottom-24 mx-auto w-fit max-w-[90vw] rounded-lg border border-neutral-800 bg-neutral-950/90 px-4 py-2 text-center text-xs text-neutral-300 backdrop-blur"
        >
          WebGL is unavailable in this browser, so the sand simulation is paused. The
          rest of the site still works.
        </div>
      )}
    </div>
  );
};

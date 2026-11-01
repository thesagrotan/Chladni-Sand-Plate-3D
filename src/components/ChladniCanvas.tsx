import React from 'react';
import { ChladniParams, ChladniMetrics } from '../types/chladni.ts';
import { useChladniCanvas } from '../hooks/useChladniCanvas.ts';

interface ChladniCanvasProps {
  params: ChladniParams;
  isPaused: boolean;
  onMetricsUpdate: (metrics: ChladniMetrics) => void;
  scatterTrigger: number;
  resetTrigger: number;
}

export const ChladniCanvas: React.FC<ChladniCanvasProps> = (props) => {
  const { mountRef } = useChladniCanvas(props);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full pointer-events-none select-none z-0 overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
      }}
    />
  );
};

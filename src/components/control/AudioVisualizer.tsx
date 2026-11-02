import React, { useRef, useEffect } from 'react';
import { plateAudio } from '../../simulation/audioSynth.ts';

export const AudioVisualizer: React.FC<{ isEnabled: boolean }> = ({ isEnabled }) => {
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

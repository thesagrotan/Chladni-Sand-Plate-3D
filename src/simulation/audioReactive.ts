import type { AudioMetrics, ChladniParams } from '../types/chladni.ts';

export interface EffectiveWaveParams {
  m: number;
  n: number;
  k: number;
  drive: number;
  isAudioActive: boolean;
}

type AudioReactiveInputs = Pick<
  ChladniParams,
  | 'audioEnabled'
  | 'audioReactiveDrive'
  | 'audioReactiveIntensity'
  | 'modeM'
  | 'modeN'
  | 'waveK'
  | 'driveStrength'
>;

/**
 * Applies audio-reactive modulation to the wave parameters. Both the shader
 * path and the CPU telemetry path use this so reported metrics match what is
 * actually rendered.
 */
export function computeEffectiveWaveParams(
  params: AudioReactiveInputs,
  audio: AudioMetrics
): EffectiveWaveParams {
  const isAudioActive = params.audioEnabled && params.audioReactiveDrive && audio.isPlaying;

  if (!isAudioActive) {
    return {
      m: params.modeM,
      n: params.modeN,
      k: params.waveK,
      drive: params.driveStrength,
      isAudioActive: false,
    };
  }

  const intensity = params.audioReactiveIntensity ?? 0.65;

  return {
    m: +(params.modeM + (audio.bass - 0.22) * 4.5 * intensity).toFixed(3),
    n: +(params.modeN + (audio.mid - 0.22) * 4.5 * intensity).toFixed(3),
    k: +(params.waveK + (audio.treble - 0.15) * 14.0 * intensity).toFixed(3),
    drive: +(
      params.driveStrength * (1.0 + (audio.rms * 3.5 - 0.15) * intensity) +
      audio.transientKick * 6.5 * intensity
    ).toFixed(3),
    isAudioActive: true,
  };
}

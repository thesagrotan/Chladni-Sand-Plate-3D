import { describe, expect, it } from 'vitest';
import type { AudioMetrics } from '../src/types/chladni.ts';
import { DEFAULT_PARAMS } from '../src/types/chladni.ts';
import { computeEffectiveWaveParams } from '../src/simulation/audioReactive.ts';

const AUDIO: AudioMetrics = {
  isPlaying: true,
  currentTime: 1,
  duration: 10,
  rms: 0.5,
  bass: 0.6,
  mid: 0.4,
  treble: 0.3,
  peak: 0.8,
  transientKick: 0.2,
  resonanceFreq: 440,
};

const ACTIVE_PARAMS = {
  ...DEFAULT_PARAMS,
  audioEnabled: true,
  audioReactiveDrive: true,
  audioReactiveIntensity: 0.5,
};

describe('computeEffectiveWaveParams', () => {
  it('returns the raw params when audio reactivity is off', () => {
    expect(computeEffectiveWaveParams(DEFAULT_PARAMS, AUDIO)).toEqual({
      m: DEFAULT_PARAMS.modeM,
      n: DEFAULT_PARAMS.modeN,
      k: DEFAULT_PARAMS.waveK,
      drive: DEFAULT_PARAMS.driveStrength,
      isAudioActive: false,
    });
  });

  it('returns the raw params when audio is not playing', () => {
    const result = computeEffectiveWaveParams(ACTIVE_PARAMS, { ...AUDIO, isPlaying: false });
    expect(result.isAudioActive).toBe(false);
    expect(result.m).toBe(ACTIVE_PARAMS.modeM);
  });

  it('applies the documented audio modulation when active', () => {
    const result = computeEffectiveWaveParams(ACTIVE_PARAMS, AUDIO);

    expect(result.isAudioActive).toBe(true);
    expect(result.m).toBe(+(ACTIVE_PARAMS.modeM + (0.6 - 0.22) * 4.5 * 0.5).toFixed(3));
    expect(result.n).toBe(+(ACTIVE_PARAMS.modeN + (0.4 - 0.22) * 4.5 * 0.5).toFixed(3));
    expect(result.k).toBe(+(ACTIVE_PARAMS.waveK + (0.3 - 0.15) * 14.0 * 0.5).toFixed(3));
    expect(result.drive).toBe(
      +(
        ACTIVE_PARAMS.driveStrength * (1.0 + (0.5 * 3.5 - 0.15) * 0.5) +
        0.2 * 6.5 * 0.5
      ).toFixed(3)
    );
  });

  it('uses the default intensity when the param is missing', () => {
    const result = computeEffectiveWaveParams(
      { ...ACTIVE_PARAMS, audioReactiveIntensity: undefined as unknown as number },
      AUDIO
    );

    expect(result.m).toBe(+(ACTIVE_PARAMS.modeM + (0.6 - 0.22) * 4.5 * 0.65).toFixed(3));
  });
});

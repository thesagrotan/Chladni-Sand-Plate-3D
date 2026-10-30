/**
 * Complete Acoustic & Sound Engine for Chladni Plate Simulation.
 * Integrates Enrique del Castillo's "Umbráfono" optical-film sound installation
 * with harmonic modal plate synthesis and bidirectional connections to Chladni settings.
 */

import { ChladniParams, AudioMetrics, AudioSourceType } from '../types/chladni.ts';

export const UMBRAFONO_AUDIO_SRC =
  '/assets/aistudio/UMBRAFONO-_Enrique_del_Castillo_-_Instalacio_n_dos_piezas_sonoras_CZECH_REPUBLIC_cc99db23.mp3';

class AcousticPlateAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private trackGain: GainNode | null = null;
  private synthGain: GainNode | null = null;

  // Umbráfono Audio Element & Source Node
  private audioEl: HTMLAudioElement | null = null;
  private trackSourceNode: MediaElementAudioSourceNode | null = null;

  // Resonant Biquad Filter (Connected to plate modes M, N, K)
  private filter: BiquadFilterNode | null = null;
  private highpass: BiquadFilterNode | null = null;

  // Modal harmonic oscillators
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private synthFilter: BiquadFilterNode | null = null;

  // Analyser node for real-time FFT spectrum & audio-reactive cymatic drive
  private analyser: AnalyserNode | null = null;
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private timeData: Uint8Array<ArrayBuffer> | null = null;

  private isInitialized = false;
  private isEnabled = false;
  private previousRms = 0.0;
  private smoothedTransient = 0.0;

  // Cached metrics
  private metrics: AudioMetrics = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    rms: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    peak: 0,
    transientKick: 0,
    resonanceFreq: 440,
  };

  constructor() {
    // Lazy initialization on user gesture
  }

  private init() {
    if (this.isInitialized) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      // Analyser Node for FFT and time domain data
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
      this.timeData = new Uint8Array(this.analyser.frequencyBinCount);

      // Resonant Biquad Filter connected to Plate Eigenmodes
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'peaking';
      this.filter.frequency.setValueAtTime(540, this.ctx.currentTime);
      this.filter.Q.setValueAtTime(3.5, this.ctx.currentTime);
      this.filter.gain.setValueAtTime(6.0, this.ctx.currentTime);

      this.highpass = this.ctx.createBiquadFilter();
      this.highpass.type = 'highpass';
      this.highpass.frequency.setValueAtTime(28, this.ctx.currentTime);

      // Umbráfono Audio Element
      this.audioEl = new Audio();
      this.audioEl.src = UMBRAFONO_AUDIO_SRC;
      this.audioEl.loop = true;
      this.audioEl.preload = 'auto';
      this.audioEl.crossOrigin = 'anonymous';

      // Connect Media Element to Web Audio graph
      this.trackSourceNode = this.ctx.createMediaElementSource(this.audioEl);

      this.trackGain = this.ctx.createGain();
      this.trackGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      // Audio Routing:
      // Track -> Highpass -> Resonant Filter -> TrackGain -> MasterGain
      this.trackSourceNode.connect(this.highpass);
      this.highpass.connect(this.filter);
      this.filter.connect(this.trackGain);
      this.trackGain.connect(this.masterGain);

      // Modal Harmonic Synthesizer Setup
      this.synthGain = this.ctx.createGain();
      this.synthGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

      this.synthFilter = this.ctx.createBiquadFilter();
      this.synthFilter.type = 'lowpass';
      this.synthFilter.frequency.setValueAtTime(1400, this.ctx.currentTime);
      this.synthFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sine';
      this.osc1.frequency.setValueAtTime(440, this.ctx.currentTime);

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'triangle';
      this.osc2.frequency.setValueAtTime(220, this.ctx.currentTime);

      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'sine';
      this.oscSub.frequency.setValueAtTime(110, this.ctx.currentTime);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.3, this.ctx.currentTime);

      this.osc1.connect(this.synthFilter);
      this.osc2.connect(this.synthFilter);
      this.oscSub.connect(subGain);
      subGain.connect(this.synthFilter);

      this.synthFilter.connect(this.synthGain);
      this.synthGain.connect(this.masterGain);

      this.osc1.start();
      this.osc2.start();
      this.oscSub.start();

      // Master output into Analyser and Speakers
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.isInitialized = true;
    } catch (err) {
      console.warn('AudioEngine initialization notice:', err);
    }
  }

  /**
   * Enable or disable audio playback.
   */
  public setEnabled(enable: boolean) {
    this.isEnabled = enable;
    if (enable) {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.audioEl && this.audioEl.paused) {
        this.audioEl.play().catch(() => {
          // Auto-play policy waiting for user click
        });
      }
    } else {
      if (this.audioEl && !this.audioEl.paused) {
        this.audioEl.pause();
      }
    }
  }

  public getIsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Update audio engine parameters based on Chladni simulation settings.
   */
  public updateParameters(params: ChladniParams, isPaused: boolean) {
    if (!this.isEnabled) {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.04);
      }
      if (this.audioEl && !this.audioEl.paused) {
        this.audioEl.pause();
      }
      return;
    }

    this.init();
    if (!this.ctx) return;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // Handle Play/Pause
    if (isPaused) {
      if (this.audioEl && !this.audioEl.paused) {
        this.audioEl.pause();
      }
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(0.0, now, 0.04);
      }
      return;
    } else {
      if (this.audioEl && this.audioEl.paused && this.isEnabled) {
        this.audioEl.play().catch(() => {});
      }
    }

    // Modal Resonance Frequency calculation:
    // Plate eigenfrequency f = 120 + sqrt(m^2 + n^2) * (k/30) * 60
    const modeHypot = Math.sqrt(params.modeM * params.modeM + params.modeN * params.modeN);
    const fundamental = 120 + modeHypot * (params.waveK / 30.0) * 60;
    const clampedFreq = Math.max(90, Math.min(2600, fundamental));
    this.metrics.resonanceFreq = Math.round(clampedFreq);

    // 1. Settings modulate Resonant Biquad Filter:
    if (this.filter) {
      if (params.audioResonanceFilter) {
        this.filter.type = 'peaking';
        this.filter.frequency.setTargetAtTime(clampedFreq, now, 0.05);
        const qFactor = 2.0 + params.symmetryBlend * 5.0;
        this.filter.Q.setTargetAtTime(qFactor, now, 0.05);
        const boost = Math.min(12, 3.0 + (params.driveStrength / 4.0) * 6.0);
        this.filter.gain.setTargetAtTime(boost, now, 0.05);
      } else {
        // Flat response when resonance filtering is disabled
        this.filter.gain.setTargetAtTime(0.0, now, 0.05);
      }
    }

    // 2. Playback Speed / Pitch linkage:
    if (this.audioEl) {
      this.audioEl.loop = params.audioLoop;
      let effectiveRate = params.audioPlaybackRate;
      if (params.audioPitchLinked) {
        // Center around base frequency 440 Hz
        const pitchRatio = Math.sqrt(clampedFreq / 440.0);
        effectiveRate = Math.max(0.5, Math.min(2.0, params.audioPlaybackRate * pitchRatio));
      }
      if (Math.abs(this.audioEl.playbackRate - effectiveRate) > 0.01) {
        this.audioEl.playbackRate = effectiveRate;
      }
    }

    // 3. Audio Source Balance (Umbráfono vs Modal Synth):
    const src: AudioSourceType = params.audioSource || 'umbrafono';
    if (this.trackGain && this.synthGain) {
      if (src === 'umbrafono') {
        this.trackGain.gain.setTargetAtTime(1.0, now, 0.04);
        this.synthGain.gain.setTargetAtTime(0.0, now, 0.04);
      } else if (src === 'synth') {
        this.trackGain.gain.setTargetAtTime(0.0, now, 0.04);
        this.synthGain.gain.setTargetAtTime(0.28, now, 0.04);
      } else {
        // Hybrid: both layered
        this.trackGain.gain.setTargetAtTime(0.85, now, 0.04);
        this.synthGain.gain.setTargetAtTime(0.18, now, 0.04);
      }
    }

    // 4. Modal Oscillator tuning (for synth / hybrid):
    if (this.osc1 && this.osc2 && this.oscSub && this.synthFilter) {
      this.osc1.frequency.setTargetAtTime(clampedFreq, now, 0.04);
      this.osc2.frequency.setTargetAtTime(clampedFreq * 0.5, now, 0.04);
      this.oscSub.frequency.setTargetAtTime(clampedFreq * 0.25, now, 0.04);
      this.synthFilter.frequency.setTargetAtTime(clampedFreq * 2.2, now, 0.05);
    }

    // 5. Master Volume:
    if (this.masterGain) {
      const vol = Math.max(0.0, Math.min(1.0, params.audioVolume));
      this.masterGain.gain.setTargetAtTime(vol, now, 0.04);
    }
  }

  /**
   * Sample the current real-time audio analysis metrics (FFT spectrum, RMS, transients).
   * Used every frame by ChladniCanvas to drive physical cymatics.
   */
  public sampleMetrics(): AudioMetrics {
    if (!this.analyser || !this.freqData || !this.timeData || !this.isEnabled) {
      this.metrics.isPlaying = false;
      this.metrics.rms = 0;
      this.metrics.bass = 0;
      this.metrics.mid = 0;
      this.metrics.treble = 0;
      this.metrics.peak = 0;
      this.metrics.transientKick = 0;
      if (this.audioEl) {
        this.metrics.currentTime = this.audioEl.currentTime || 0;
        this.metrics.duration = this.audioEl.duration || 0;
      }
      return this.metrics;
    }

    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const binCount = this.analyser.frequencyBinCount;

    // Calculate RMS from time domain data
    let sumSquares = 0;
    let peak = 0;
    for (let i = 0; i < binCount; i++) {
      const val = (this.timeData[i] - 128) / 128;
      sumSquares += val * val;
      const absVal = Math.abs(val);
      if (absVal > peak) peak = absVal;
    }
    const rms = Math.sqrt(sumSquares / binCount);

    // Frequency bands:
    // Bass (bins 1 to 6: ~20Hz to 250Hz)
    let bassSum = 0;
    const bassEnd = Math.min(6, binCount);
    for (let i = 1; i < bassEnd; i++) {
      bassSum += this.freqData[i] / 255;
    }
    const bass = bassSum / Math.max(1, bassEnd - 1);

    // Mid (bins 6 to 32: ~250Hz to 2.8kHz)
    let midSum = 0;
    const midEnd = Math.min(32, binCount);
    for (let i = bassEnd; i < midEnd; i++) {
      midSum += this.freqData[i] / 255;
    }
    const mid = midSum / Math.max(1, midEnd - bassEnd);

    // Treble (bins 32 to 100: ~2.8kHz to 10kHz)
    let trebleSum = 0;
    const trebleEnd = Math.min(100, binCount);
    for (let i = midEnd; i < trebleEnd; i++) {
      trebleSum += this.freqData[i] / 255;
    }
    const treble = trebleSum / Math.max(1, trebleEnd - midEnd);

    // Transient detection: sudden delta in RMS
    const deltaRms = Math.max(0, rms - this.previousRms);
    this.previousRms = rms;
    const rawTransient = deltaRms > 0.08 ? Math.min(1.0, deltaRms * 5.0) : 0.0;
    this.smoothedTransient = this.smoothedTransient * 0.7 + rawTransient * 0.3;

    this.metrics.isPlaying = !!(this.audioEl && !this.audioEl.paused && this.isEnabled);
    this.metrics.currentTime = this.audioEl?.currentTime || 0;
    this.metrics.duration = this.audioEl?.duration || 0;
    this.metrics.rms = +rms.toFixed(3);
    this.metrics.bass = +bass.toFixed(3);
    this.metrics.mid = +mid.toFixed(3);
    this.metrics.treble = +treble.toFixed(3);
    this.metrics.peak = +peak.toFixed(3);
    this.metrics.transientKick = +this.smoothedTransient.toFixed(3);

    return this.metrics;
  }

  /**
   * Get raw frequency spectrum array for visualizers (oscilloscope/equalizer).
   */
  public getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.freqData) return null;
    this.analyser.getByteFrequencyData(this.freqData);
    return this.freqData;
  }

  /**
   * Seek audio track to specific time in seconds.
   */
  public seek(timeSeconds: number) {
    if (this.audioEl && isFinite(timeSeconds)) {
      this.audioEl.currentTime = Math.max(0, Math.min(this.audioEl.duration || 0, timeSeconds));
    }
  }

  public dispose() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
    }
    this.isInitialized = false;
    this.isEnabled = false;
  }
}

export const plateAudio = new AcousticPlateAudioEngine();
export const plateSynth = plateAudio; // Alias for backward compatibility

export type GridType = 'rectangular' | 'polar' | 'annular' | 'hexagonal' | 'diamond' | 'web';
export type VoidShape = 'circle' | 'square';

export interface ColorPalette {
  id: string;
  name: string;
  sandPrimary: string;
  sandSecondary: string;
  plate: string;
  glow: string;
}

export const COLOR_PALETTES: ColorPalette[] = [
  {
    id: 'silica',
    name: 'Natural Silica',
    sandPrimary: '#f7f5f0',
    sandSecondary: '#e4dfd3',
    plate: '#111215',
    glow: '#38bdf8',
  },
  {
    id: 'golden_sand',
    name: 'Golden Amber',
    sandPrimary: '#fde047',
    sandSecondary: '#ca8a04',
    plate: '#0c0d10',
    glow: '#f59e0b',
  },
  {
    id: 'cyber_cyan',
    name: 'Bioluminescent Aqua',
    sandPrimary: '#67e8f9',
    sandSecondary: '#06b6d4',
    plate: '#090d14',
    glow: '#00f2fe',
  },
  {
    id: 'crimson_ruby',
    name: 'Crimson Garnet',
    sandPrimary: '#fca5a5',
    sandSecondary: '#ef4444',
    plate: '#140c10',
    glow: '#f43f5e',
  },
  {
    id: 'emerald_jade',
    name: 'Emerald Jade',
    sandPrimary: '#86efac',
    sandSecondary: '#10b981',
    plate: '#0b120f',
    glow: '#10b981',
  },
  {
    id: 'electric_violet',
    name: 'Neon Violet',
    sandPrimary: '#e9d5ff',
    sandSecondary: '#a855f7',
    plate: '#0f0a17',
    glow: '#c084fc',
  },
  {
    id: 'alabaster_inverse',
    name: 'Alabaster Inverse',
    sandPrimary: '#1e293b',
    sandSecondary: '#0f172a',
    plate: '#e2e8f0',
    glow: '#2563eb',
  },
];

export interface ChladniParams {
  // Grid Architecture & Center Empty Space
  gridType: GridType;
  centerVoidRadius: number; // 0.0 to 0.6
  centerVoidShape: VoidShape; // 'circle' | 'square'
  centerExpulsion: number; // 0.0 to 5.0
  showVoidGuide: boolean;

  // DOM Elements Rejection
  domRepulsion: number; // 0.0 to 10.0 (rejection force from dots to DOM elements, default 1.0)

  // Canvas Orientation & Flips
  flipHorizontal: boolean; // flip/mirror X
  flipVertical: boolean;   // flip/mirror Y
  rotationAngle: number;   // 0, 90, 180, 270 degrees

  // Color Customization
  paletteId: string;
  sandColor: string;          // Hex e.g. #f7f5f0
  sandColorSecondary: string; // Hex e.g. #e4dfd3
  plateColor: string;         // Hex e.g. #111215
  glowColor: string;          // Hex e.g. #38bdf8

  // Resonance
  modeM: number;
  modeN: number;
  waveK: number;
  symmetryBlend: number;

  // Sand & Simulation
  driveStrength: number;
  grainCount: number;
  fieldOverlay: number;
  simulationEngine: 'gpu' | 'wasm' | 'js_cpu';

  // Acoustic Sound & Umbráfono Integration
  audioEnabled: boolean;
  audioSource: AudioSourceType; // 'umbrafono' | 'synth' | 'hybrid'
  audioVolume: number; // 0.0 to 1.0
  audioPlaybackRate: number; // 0.5 to 2.0
  audioLoop: boolean;
  audioReactiveDrive: boolean; // Sound dynamically drives plate vibrations & sand jumps
  audioReactiveIntensity: number; // 0.0 to 1.0 (modulation depth)
  audioResonanceFilter: boolean; // Plate modes (m, n, k) filter audio timbre
  audioPitchLinked: boolean; // Mode frequency modulates audio pitch / playback speed
}

export type AudioSourceType = 'umbrafono' | 'synth' | 'hybrid';

export interface AudioMetrics {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  rms: number; // 0.0 to 1.0
  bass: number; // 0.0 to 1.0
  mid: number; // 0.0 to 1.0
  treble: number; // 0.0 to 1.0
  peak: number; // 0.0 to 1.0
  transientKick: number; // instantaneous transient spike 0.0 to 1.0
  resonanceFreq: number; // Hz
}

export interface ChladniMetrics {
  settledPercent: number;
  activeFraction: number; // a(x) > a0
  centerClearance: number; // % of center void empty
  centerGrainCount: number; // sample grains in center
  activeEngine: 'gpu' | 'wasm' | 'js_cpu';
  computeTimeMs: number;
  fps: number;
  wasmSpeedup?: number;
  audio?: AudioMetrics;
}

export interface Preset {
  name: string;
  tag: 'empty-center' | 'classic' | 'geometric';
  gridType: GridType;
  params: Partial<ChladniParams>;
  description: string;
}

export const GRID_TYPE_LABELS: Record<GridType, { label: string; iconName: string; desc: string }> = {
  annular: { label: 'Annular Halo', iconName: 'CircleDot', desc: 'Circuits around center with radial ribs' },
  rectangular: { label: 'Courtyard Lattice', iconName: 'Grid', desc: 'Orthogonal grid with empty central zone' },
  polar: { label: 'Polar Orbitals', iconName: 'Disc', desc: 'Concentric wave rings & rays around core' },
  hexagonal: { label: 'Hex Honeycomb', iconName: 'Hexagon', desc: 'Triaxial 60° interference honeycomb' },
  diamond: { label: 'Diamond Cage', iconName: 'Boxes', desc: '45° rotated diagonal rhombus mesh' },
  web: { label: 'Spiderweb', iconName: 'Radar', desc: 'Concentric web looping around center' },
};

export const DEFAULT_PARAMS: ChladniParams = {
  gridType: 'annular',
  centerVoidRadius: 0.0,
  centerVoidShape: 'circle',
  centerExpulsion: 0.0,
  showVoidGuide: false,
  domRepulsion: 1.0,

  // Flips & Orientation
  flipHorizontal: false,
  flipVertical: false,
  rotationAngle: 0,

  // Colors
  paletteId: 'silica',
  sandColor: '#f7f5f0',
  sandColorSecondary: '#e4dfd3',
  plateColor: '#111215',
  glowColor: '#38bdf8',

  modeM: 4.0,
  modeN: 8.0,
  waveK: 32.0,
  symmetryBlend: 0.72,
  driveStrength: 3.2,
  grainCount: 100_000,
  fieldOverlay: 0.0,
  simulationEngine: 'gpu',

  // Acoustic Sound & Umbráfono Integration
  audioEnabled: false,
  audioSource: 'umbrafono',
  audioVolume: 0.75,
  audioPlaybackRate: 1.0,
  audioLoop: true,
  audioReactiveDrive: true,
  audioReactiveIntensity: 0.85,
  audioResonanceFilter: true,
  audioPitchLinked: false,
};

export const PRESETS: Preset[] = [
  {
    name: 'Empty Core Annulus',
    tag: 'empty-center',
    gridType: 'annular',
    params: {
      gridType: 'annular',
      centerVoidRadius: 0.28,
      centerVoidShape: 'circle',
      centerExpulsion: 2.8,
      modeM: 4.0,
      modeN: 8.0,
      waveK: 32.0,
      symmetryBlend: 0.72,
      driveStrength: 3.2,
    },
    description: 'Clean nodal perimeter wrapping around an empty center with 8-fold radial ribs',
  },
  {
    name: 'Courtyard Matrix',
    tag: 'empty-center',
    gridType: 'rectangular',
    params: {
      gridType: 'rectangular',
      centerVoidRadius: 0.32,
      centerVoidShape: 'square',
      centerExpulsion: 3.0,
      modeM: 6.0,
      modeN: 6.0,
      waveK: 30.0,
      symmetryBlend: 0.65,
      driveStrength: 3.0,
    },
    description: 'Orthogonal grid framing a completely open central courtyard',
  },
  {
    name: 'Solar Corona',
    tag: 'empty-center',
    gridType: 'polar',
    params: {
      gridType: 'polar',
      centerVoidRadius: 0.34,
      centerVoidShape: 'circle',
      centerExpulsion: 3.2,
      modeM: 3.5,
      modeN: 10.0,
      waveK: 28.0,
      symmetryBlend: 0.8,
      driveStrength: 3.4,
    },
    description: 'Concentric orbital rings and radiating beams around a dark empty core',
  },
  {
    name: 'Hexagonal Atrium',
    tag: 'empty-center',
    gridType: 'hexagonal',
    params: {
      gridType: 'hexagonal',
      centerVoidRadius: 0.26,
      centerVoidShape: 'circle',
      centerExpulsion: 2.4,
      modeM: 5.5,
      modeN: 6.0,
      waveK: 34.0,
      symmetryBlend: 0.6,
      driveStrength: 3.0,
    },
    description: 'Triaxial honeycomb lattice wrapping around a clear central atrium',
  },
  {
    name: 'Diamond Hollow',
    tag: 'empty-center',
    gridType: 'diamond',
    params: {
      gridType: 'diamond',
      centerVoidRadius: 0.3,
      centerVoidShape: 'square',
      centerExpulsion: 2.6,
      modeM: 4.5,
      modeN: 4.5,
      waveK: 31.0,
      symmetryBlend: 0.5,
      driveStrength: 3.1,
    },
    description: 'Rhombus grid enclosing an open central diamond clearing',
  },
  {
    name: 'Spiderweb Void',
    tag: 'empty-center',
    gridType: 'web',
    params: {
      gridType: 'web',
      centerVoidRadius: 0.25,
      centerVoidShape: 'circle',
      centerExpulsion: 2.2,
      modeM: 5.0,
      modeN: 8.0,
      waveK: 30.0,
      symmetryBlend: 0.7,
      driveStrength: 3.2,
    },
    description: 'Concentric spiderweb cells looping around a circular void',
  },
  {
    name: 'Concentric Moat',
    tag: 'empty-center',
    gridType: 'polar',
    params: {
      gridType: 'polar',
      centerVoidRadius: 0.22,
      centerVoidShape: 'circle',
      centerExpulsion: 2.0,
      modeM: 6.0,
      modeN: 2.0,
      waveK: 36.0,
      symmetryBlend: 0.9,
      driveStrength: 3.2,
    },
    description: 'Multiple nested circular moats orbiting an empty central sanctuary',
  },
  {
    name: 'Classic Orthogonal (Filled)',
    tag: 'classic',
    gridType: 'rectangular',
    params: {
      gridType: 'rectangular',
      centerVoidRadius: 0.0,
      centerVoidShape: 'circle',
      centerExpulsion: 0.0,
      modeM: 5.0,
      modeN: 7.0,
      waveK: 30.0,
      symmetryBlend: 0.65,
      driveStrength: 3.0,
    },
    description: 'Traditional 5x7 orthogonal Chladni plate with central node intersection',
  },
  {
    name: 'Dense Matrix (Filled)',
    tag: 'classic',
    gridType: 'rectangular',
    params: {
      gridType: 'rectangular',
      centerVoidRadius: 0.0,
      centerVoidShape: 'circle',
      centerExpulsion: 0.0,
      modeM: 6.05,
      modeN: 10.21,
      waveK: 37.38,
      symmetryBlend: 0.65,
      driveStrength: 3.0,
    },
    description: 'High-frequency grid lattice with fine rectangular cell divisions',
  },
  {
    name: 'Petal Rosette (Filled)',
    tag: 'geometric',
    gridType: 'rectangular',
    params: {
      gridType: 'rectangular',
      centerVoidRadius: 0.0,
      centerVoidShape: 'circle',
      centerExpulsion: 0.0,
      modeM: 6.05,
      modeN: 10.21,
      waveK: 37.38,
      symmetryBlend: 0.89,
      driveStrength: 3.0,
    },
    description: 'High symmetry blend creating curved petal loops meeting at center',
  },
];

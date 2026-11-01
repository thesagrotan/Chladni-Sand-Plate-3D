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

  // Typography & Variable Font Controls
  fontFamily: string; // 'iAWriterQuattroV' | 'iAWriterQuattroV-Italic' | 'GT-Pressura' | 'Geist' | 'Geist Mono' | 'Geist Serif' | 'Neue-Montreal' | 'Replica-Pro' | 'Replica-Mono' | ...
  fontWeight: number; // e.g. 100 to 900
  fontItalic: boolean; // normal vs italic cut
  fontSpacingAxis: number; // SPCG axis 0 to 150 (for iA Writer Quattro V)
  fontElshAxis: number; // ELSH axis 0 to 100 (for Geist Serif VF)
  fontLetterSpacing: number; // CSS tracking in px (-2 to 10)

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
  grainSize: number;
  fieldOverlay: number;
  nodalPronouncement: number;
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
  audio?: AudioMetrics;
}

export interface Preset {
  name: string;
  tag: 'empty-center' | 'classic' | 'geometric';
  gridType: GridType;
  params: Partial<ChladniParams>;
  description: string;
}

export const GRID_TYPE_LABELS: Record<GridType, { label: string; desc: string }> = {
  annular: { label: 'Annular Halo', desc: 'Circuits around center with radial ribs' },
  rectangular: { label: 'Courtyard Lattice', desc: 'Orthogonal grid with empty central zone' },
  polar: { label: 'Polar Orbitals', desc: 'Concentric wave rings & rays around core' },
  hexagonal: { label: 'Hex Honeycomb', desc: 'Triaxial 60° interference honeycomb' },
  diamond: { label: 'Diamond Cage', desc: '45° rotated diagonal rhombus mesh' },
  web: { label: 'Spiderweb', desc: 'Concentric web looping around center' },
};

export const DEFAULT_PARAMS: ChladniParams = {
  gridType: 'annular',
  centerVoidRadius: 0.0,
  centerVoidShape: 'circle',
  centerExpulsion: 0.0,
  showVoidGuide: false,
  domRepulsion: 1.0,

  // Typography & Variable Font Defaults
  fontFamily: 'iAWriterQuattroV',
  fontWeight: 400,
  fontItalic: false,
  fontSpacingAxis: 0,
  fontElshAxis: 0,
  fontLetterSpacing: 0,

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
  grainSize: 1.0,
  fieldOverlay: 0.0,
  nodalPronouncement: 1.0,
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

/* =====================================================================
   FONTS IN PUBLIC/FONTS/ DIRECTORY
   ===================================================================== */
export interface FontOption {
  id: string; // Identifier
  name: string; // Display Name
  fontFamily: string; // CSS font-family name registered in @font-face
  category: 'variable' | 'static';
  minWeight: number;
  maxWeight: number;
  defaultWeight: number;
  hasItalic: boolean;
  isItalicDefault?: boolean;
  hasSpacingAxis?: boolean; // SPCG variable axis (0 to 150)
  hasElshAxis?: boolean; // ELSH variable axis (0 to 100)
  badge: string;
  format: string;
  description: string;
  fileName: string;
}

export const AVAILABLE_FONTS: FontOption[] = [
  {
    id: 'iAWriterQuattroV',
    name: 'iA Writer Quattro V',
    fontFamily: 'iAWriterQuattroV',
    category: 'variable',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: true,
    hasSpacingAxis: true,
    badge: 'Variable Proportional',
    format: 'TTF',
    fileName: 'iAWriterQuattroV.ttf',
    description: 'Variable proportional font with continuous weight (400–700) & SPCG spacing (0–150)',
  },
  {
    id: 'iAWriterQuattroV-Italic',
    name: 'iA Writer Quattro V (Italic)',
    fontFamily: 'iAWriterQuattroV-Italic',
    category: 'variable',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: true,
    isItalicDefault: true,
    hasSpacingAxis: true,
    badge: 'Variable Italic',
    format: 'TTF',
    fileName: 'iAWriterQuattroV-Italic.ttf',
    description: 'Cursive italic variable font with continuous weight (400–700) & SPCG spacing (0–150)',
  },
  {
    id: 'GT-Pressura',
    name: 'GT Pressura',
    fontFamily: 'GT-Pressura',
    category: 'static',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Swiss Tech',
    format: 'WOFF2',
    fileName: 'GT-Pressura-Standard-Regular.woff2',
    description: 'Technical Swiss grotesk inspired by shipping box stamps (Regular 400 & Bold 700)',
  },
  {
    id: 'GT-America',
    name: 'GT America Standard',
    fontFamily: 'GT-America',
    category: 'static',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Swiss Gothic OTF',
    format: 'OTF',
    fileName: 'GT-America/GT-America-LCGV-Standard-*.otf',
    description: 'Synthesis of American Gothic and European Grotesk (Thin 100 to Black 900 + Italic)',
  },
  {
    id: 'GT-America-Mono',
    name: 'GT America Mono',
    fontFamily: 'GT-America-Mono',
    category: 'static',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Swiss Mono OTF',
    format: 'OTF',
    fileName: 'GT-America/GT-America-LCGV-Mono-*.otf',
    description: 'Monospaced cut of GT America (Regular 400 & Bold 700)',
  },
  {
    id: 'GT-America-Expanded',
    name: 'GT America Expanded',
    fontFamily: 'GT-America-Expanded',
    category: 'static',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Wide OTF',
    format: 'OTF',
    fileName: 'GT-America/GT-America-LCGV-Expanded-*.otf',
    description: 'Ultra-wide horizontal expansion architecture (Regular 400 & Bold 700)',
  },
  {
    id: 'GT-America-Compressed',
    name: 'GT America Compressed',
    fontFamily: 'GT-America-Compressed',
    category: 'static',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Dense OTF',
    format: 'OTF',
    fileName: 'GT-America/GT-America-LCGV-Compressed-*.otf',
    description: 'Narrow compressed display cut of GT America (Regular 400 & Bold 700)',
  },
  {
    id: 'Geist',
    name: 'Geist Sans',
    fontFamily: 'Geist',
    category: 'variable',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Variable Sans',
    format: 'WOFF2',
    fileName: 'Geist-Variable.woff2',
    description: 'Continuous neo-grotesque variable font across full 100–900 weight range',
  },
  {
    id: 'Geist Mono',
    name: 'Geist Mono',
    fontFamily: 'Geist Mono',
    category: 'variable',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Variable Mono',
    format: 'WOFF2',
    fileName: 'GeistMono-Variable.woff2',
    description: 'Engineering monospaced variable font with 100–900 weight & italic cuts',
  },
  {
    id: 'Geist Serif',
    name: 'Geist Serif VF',
    fontFamily: 'Geist Serif',
    category: 'variable',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    hasElshAxis: true,
    badge: 'Variable Serif',
    format: 'WOFF2',
    fileName: 'GeistSerifVF.woff2',
    description: 'High-contrast variable serif with ELSH elongation/contrast axis',
  },
  // BB Manual Mono Pro — 4 optical cuts, 12 weights each, static OTF
  {
    id: 'BB-Manual-Mono-Pro-Text',
    name: 'BB Manual Mono Pro Text',
    fontFamily: 'BB-Manual-Mono-Pro-Text',
    category: 'static',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Mono OTF Text',
    format: 'OTF',
    fileName: 'bb-manual-mono-pro/BB Manual Mono Pro Text/*.otf',
    description: 'BB Manual Mono Pro Text cut — 12 weights (Hairline→Super) + Italics',
  },
  {
    id: 'BB-Manual-Mono-Pro-Original',
    name: 'BB Manual Mono Pro Original',
    fontFamily: 'BB-Manual-Mono-Pro-Original',
    category: 'static',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Mono OTF Original',
    format: 'OTF',
    fileName: 'bb-manual-mono-pro/BB Manual Mono Pro Original/*.otf',
    description: 'BB Manual Mono Pro Original cut — 12 weights (Hairline→Super), no italics',
  },
  {
    id: 'BB-Manual-Mono-Pro-Headline',
    name: 'BB Manual Mono Pro Headline',
    fontFamily: 'BB-Manual-Mono-Pro-Headline',
    category: 'static',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Mono OTF Headline',
    format: 'OTF',
    fileName: 'bb-manual-mono-pro/BB Manual Mono Pro Headline/*.otf',
    description: 'BB Manual Mono Pro Headline cut — 12 weights (Hairline→Super), no italics',
  },
  {
    id: 'BB-Manual-Mono-Pro-Cover',
    name: 'BB Manual Mono Pro Cover',
    fontFamily: 'BB-Manual-Mono-Pro-Cover',
    category: 'static',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Mono OTF Cover',
    format: 'OTF',
    fileName: 'bb-manual-mono-pro/BB Manual Mono Pro Cover/*.otf',
    description: 'BB Manual Mono Pro Cover cut — 12 weights (Hairline→Super), no italics',
  },
  // Scatterplot (CAST Foundry — Giulio Galli)
  {
    id: 'Scatterplot-Mild',
    name: 'Scatterplot Mild',
    fontFamily: 'Scatterplot-Mild',
    category: 'static',
    minWeight: 300,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Dot Matrix Grid',
    format: 'WOFF2',
    fileName: 'scatterplot/Scatterplot-Mild-*.woff2',
    description: 'CAST dot-matrix modular typeface by Giulio Galli — clean alignment on grid (Light 300 to Black 900)',
  },
  {
    id: 'Scatterplot-Borderline',
    name: 'Scatterplot Borderline',
    fontFamily: 'Scatterplot-Borderline',
    category: 'static',
    minWeight: 300,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Dot Jitter',
    format: 'WOFF2',
    fileName: 'scatterplot/Scatterplot-Borderline-*.woff2',
    description: 'Slight random displacement of modular dots across the glyph bounding box',
  },
  {
    id: 'Scatterplot-Wild',
    name: 'Scatterplot Wild',
    fontFamily: 'Scatterplot-Wild',
    category: 'static',
    minWeight: 300,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Sand Scatter',
    format: 'WOFF2',
    fileName: 'scatterplot/Scatterplot-Wild-*.woff2',
    description: 'Pronounced dot dispersal evoking acoustic particulate drift on the sand plate',
  },
  {
    id: 'Scatterplot-UltraWild',
    name: 'Scatterplot UltraWild',
    fontFamily: 'Scatterplot-UltraWild',
    category: 'static',
    minWeight: 300,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Explosive Chladni',
    format: 'WOFF2',
    fileName: 'scatterplot/Scatterplot-UltraWild-*.woff2',
    description: 'Maximum randomized dot displacement into atmospheric sand dust',
  },
  // Aeonik Pro & Aeonik Fono (CoType Foundry — Mark Bloom & Joe Leadbeater)
  {
    id: 'Aeonik-Pro',
    name: 'Aeonik Pro',
    fontFamily: 'Aeonik-Pro',
    category: 'static',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Neo-Grotesque WOFF2',
    format: 'WOFF2',
    fileName: 'aeonik-pro/AeonikPro-*.woff2',
    description: 'Structural neo-grotesque with geometric integrity — 7 weights (Air 100 to Black 900) + Italics',
  },
  {
    id: 'Aeonik-Fono',
    name: 'Aeonik Fono',
    fontFamily: 'Aeonik-Fono',
    category: 'static',
    minWeight: 100,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Mono Mechanical WOFF2',
    format: 'WOFF2',
    fileName: 'aeonik-fono/AeonikFono-*.woff2',
    description: 'Monospaced mechanical companion to Aeonik Pro — 7 weights (Air 100 to Black 900)',
  },
  // Ortica Angular Bold (Benedetta Bovani & Collletttivo)
  {
    id: 'Ortica-Angular',
    name: 'Ortica Angular Bold',
    fontFamily: 'Ortica-Angular',
    category: 'static',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 700,
    hasItalic: false,
    badge: 'Sharp Display OTF',
    format: 'OTF',
    fileName: 'ortica-angular-bold/OrticaAngular-Bold.otf',
    description: 'Sharp, aggressive serif display typeface designed by Benedetta Bovani & Collletttivo',
  },
  // GT Sectra Fine (Grilli Type — Contemporary Serif)
  {
    id: 'GT-Sectra-Fine',
    name: 'GT Sectra Fine',
    fontFamily: 'GT-Sectra-Fine',
    category: 'static',
    minWeight: 400,
    maxWeight: 900,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Contemporary Serif TTF',
    format: 'TTF',
    fileName: 'gt-sectra-fine/GT-Sectra-Fine-*.ttf',
    description: 'Contemporary serif by Grilli Type — Book, Regular, Medium, Bold, Black (400–900) + Italics',
  },
  // Replica Pro & Replica Mono (Lineto — Norm / Dimitri Bruni & Manuel Krebs)
  {
    id: 'Replica-Pro',
    name: 'Replica Pro',
    fontFamily: 'Replica-Pro',
    category: 'static',
    minWeight: 300,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Swiss Grid OTF',
    format: 'OTF',
    fileName: 'replica-pro/ReplicaPro-*.otf',
    description: 'Strict geometric grotesk constructed on a strict raster grid by Norm (Lineto) — Light, Regular, Bold + Italics',
  },
  {
    id: 'Replica-Mono',
    name: 'Replica Mono',
    fontFamily: 'Replica-Mono',
    category: 'static',
    minWeight: 400,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: false,
    badge: 'Swiss Mono OTF',
    format: 'OTF',
    fileName: 'replica-pro/ReplicaPro-Regular2.otf',
    description: 'Monospaced companion cut of Replica by Norm (Lineto)',
  },
  // Neue Montreal (Pangram Pangram — Geometric Sans OTF)
  {
    id: 'Neue-Montreal',
    name: 'Neue Montreal',
    fontFamily: 'Neue-Montreal',
    category: 'static',
    minWeight: 300,
    maxWeight: 700,
    defaultWeight: 400,
    hasItalic: true,
    badge: 'Geometric Sans OTF',
    format: 'OTF',
    fileName: 'neue-montreal/NeueMontreal-*.otf',
    description: 'Geometric sans-serif by Pangram Pangram — Light 300, Regular 400, Medium 500, Bold 700 + Italics',
  },
];

export function buildFontVariationSettings(params: {
  fontFamily?: string;
  fontWeight?: number;
  fontSpacingAxis?: number;
  fontElshAxis?: number;
}): string {
  const fam = params.fontFamily || '';

  // 1. iA Writer Quattro V (wght & SPCG)
  if (fam.includes('iAWriter') || fam.includes('iA Writer') || fam.includes('Quattro')) {
    const parts: string[] = [`'wght' ${params.fontWeight ?? 400}`];
    const spcg = params.fontSpacingAxis ?? 0;
    if (spcg > 0) {
      parts.push(`'SPCG' ${spcg}`);
    }
    return parts.join(', ');
  }

  // 2. Geist Sans & Geist Mono (wght only)
  if (fam === 'Geist' || fam === 'Geist Mono') {
    return `'wght' ${params.fontWeight ?? 400}`;
  }

  // 3. Geist Serif VF (ELSH only, no wght axis)
  if (fam.includes('Serif')) {
    const elsh = params.fontElshAxis ?? 0;
    return elsh > 0 ? `'ELSH' ${elsh}` : 'normal';
  }

  // 4. Static fonts (GT Pressura, GT America, Custom OTF/TTF fonts) -> MUST be 'normal'
  return 'normal';
}

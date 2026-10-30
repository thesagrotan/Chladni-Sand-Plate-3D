/**
 * Chladni plate wave mathematics and analytical functions.
 * Supports multiple grid topologies (rectangular, polar, annular, hexagonal, diamond, web)
 * and central void geometries leaving an empty space in the center.
 */

import { GridType, VoidShape } from '../types/chladni.ts';

export function gridTypeToNumber(type: GridType): number {
  switch (type) {
    case 'rectangular':
      return 0.0;
    case 'polar':
      return 1.0;
    case 'annular':
      return 2.0;
    case 'hexagonal':
      return 3.0;
    case 'diamond':
      return 4.0;
    case 'web':
      return 5.0;
    default:
      return 0.0;
  }
}

export function voidShapeToNumber(shape: VoidShape): number {
  return shape === 'square' ? 1.0 : 0.0;
}

export const CHLADNI_GLSL_FUNCTIONS = /* glsl */ `
// Base wave generator for diverse grid topologies
float computeBaseWave(vec2 p, float m, float n, float k, float blend, float gridType) {
  float sk = (3.141592653589793 / 2.0) * (k / 30.0);
  int type = int(gridType + 0.5);

  if (type == 1) {
    // Polar Rings (Concentric Bessel-like rings + azimuthal harmonics)
    float r = length(p);
    float theta = atan(p.y, p.x);
    return cos(m * sk * r * 1.5) - blend * cos(n * theta) * sin(sk * r * 1.5);
  } else if (type == 2) {
    // Annular Halo (Explicit ring frame around center with radial ribbing)
    float r = length(p);
    float theta = atan(p.y, p.x);
    return cos(m * sk * r * 1.8) * cos(n * theta) - blend * sin(sk * r * 2.0);
  } else if (type == 3) {
    // Hexagonal (Triaxial 3-fold interference lattice)
    float s = sk * (m * 0.4);
    float w1 = cos(s * p.x);
    float w2 = cos(s * (-0.5 * p.x + 0.8660254 * p.y));
    float w3 = cos(s * (-0.5 * p.x - 0.8660254 * p.y));
    float r = length(p);
    return (w1 + w2 + w3) * 0.66667 - blend * cos(n * sk * r);
  } else if (type == 4) {
    // Diamond (Rotated 45-degree diagonal mesh)
    float u = sk * (p.x + p.y) * 0.70710678;
    float v = sk * (p.x - p.y) * 0.70710678;
    return cos(m * u) * cos(n * v) - blend * cos(n * u) * cos(m * v);
  } else if (type == 5) {
    // Radial Web (Spiderweb grid around center)
    float r = length(p);
    float theta = atan(p.y, p.x);
    return sin(m * sk * r * 1.4) * cos(n * theta) - blend * cos(sk * r * 3.0);
  } else {
    // 0: Rectangular orthogonal grid
    float u = sk * p.x;
    float v = sk * p.y;
    return cos(m * u) * cos(n * v) - blend * cos(n * u) * cos(m * v);
  }
}

// Composite Chladni wave with central void clearance
float computeChladniW(vec2 p, float m, float n, float k, float blend, float gridType, float voidRadius, float voidShape, float centerExpulsion) {
  float baseW = computeBaseWave(p, m, n, k, blend, gridType);

  if (voidRadius > 0.01) {
    // Metric distance to center: circle vs square
    float rDist = (voidShape > 0.5) ? max(abs(p.x), abs(p.y)) : length(p);
    
    // Inside the void: strong antinodal vibration with a zero-crossing right at voidRadius
    float t = clamp(rDist / voidRadius, 0.0, 1.0);
    // At t=0 (center): cosine is 1.0 (large amplitude peak)
    // At t=1 (rDist = voidRadius): cosine is 0.0 (nodal boundary enclosing the empty space!)
    float voidAntinode = cos(t * 1.57079632679) * (1.6 + centerExpulsion * 0.6);
    
    // Smooth transition from the void nodal perimeter into the outer grid
    float blendFactor = smoothstep(voidRadius * 0.75, voidRadius * 1.05, rDist);
    return mix(voidAntinode, baseW, blendFactor);
  }

  return baseW;
}

// Robust finite difference gradient of w(x, y)
vec2 computeChladniGrad(vec2 p, float m, float n, float k, float blend, float gridType, float voidRadius, float voidShape, float centerExpulsion) {
  float eps = 0.0015;
  float wX1 = computeChladniW(p + vec2(eps, 0.0), m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  float wX0 = computeChladniW(p - vec2(eps, 0.0), m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  float wY1 = computeChladniW(p + vec2(0.0, eps), m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  float wY0 = computeChladniW(p - vec2(0.0, eps), m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);

  return vec2((wX1 - wX0) / (2.0 * eps), (wY1 - wY0) / (2.0 * eps));
}
`;

function evalBaseWave(
  x: number,
  y: number,
  m: number,
  n: number,
  k: number,
  blend: number,
  gridType: number
): number {
  const sk = (Math.PI / 2.0) * (k / 30.0);
  const type = Math.round(gridType);

  if (type === 1) {
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return Math.cos(m * sk * r * 1.5) - blend * Math.cos(n * theta) * Math.sin(sk * r * 1.5);
  } else if (type === 2) {
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return Math.cos(m * sk * r * 1.8) * Math.cos(n * theta) - blend * Math.sin(sk * r * 2.0);
  } else if (type === 3) {
    const s = sk * (m * 0.4);
    const w1 = Math.cos(s * x);
    const w2 = Math.cos(s * (-0.5 * x + 0.8660254 * y));
    const w3 = Math.cos(s * (-0.5 * x - 0.8660254 * y));
    const r = Math.sqrt(x * x + y * y);
    return (w1 + w2 + w3) * 0.66667 - blend * Math.cos(n * sk * r);
  } else if (type === 4) {
    const u = sk * (x + y) * 0.70710678;
    const v = sk * (x - y) * 0.70710678;
    return Math.cos(m * u) * Math.cos(n * v) - blend * Math.cos(n * u) * Math.cos(m * v);
  } else if (type === 5) {
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return Math.sin(m * sk * r * 1.4) * Math.cos(n * theta) - blend * Math.cos(sk * r * 3.0);
  } else {
    const u = sk * x;
    const v = sk * y;
    return Math.cos(m * u) * Math.cos(n * v) - blend * Math.cos(n * u) * Math.cos(m * v);
  }
}

export function evalChladniW(
  x: number,
  y: number,
  m: number,
  n: number,
  k: number,
  blend: number,
  gridType = 0,
  voidRadius = 0,
  voidShape = 0,
  centerExpulsion = 0
): number {
  const baseW = evalBaseWave(x, y, m, n, k, blend, gridType);

  if (voidRadius > 0.01) {
    const rDist = voidShape > 0.5 ? Math.max(Math.abs(x), Math.abs(y)) : Math.sqrt(x * x + y * y);
    const t = Math.min(1.0, Math.max(0.0, rDist / voidRadius));
    const voidAntinode = Math.cos(t * (Math.PI / 2.0)) * (1.6 + centerExpulsion * 0.6);

    const edge0 = voidRadius * 0.75;
    const edge1 = voidRadius * 1.05;
    const smoothT = Math.min(1.0, Math.max(0.0, (rDist - edge0) / (edge1 - edge0)));
    const blendFactor = smoothT * smoothT * (3 - 2 * smoothT);

    return voidAntinode * (1.0 - blendFactor) + baseW * blendFactor;
  }

  return baseW;
}

export function evalChladniGrad(
  x: number,
  y: number,
  m: number,
  n: number,
  k: number,
  blend: number,
  gridType = 0,
  voidRadius = 0,
  voidShape = 0,
  centerExpulsion = 0
): [number, number] {
  const eps = 0.0015;
  const wX1 = evalChladniW(x + eps, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  const wX0 = evalChladniW(x - eps, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  const wY1 = evalChladniW(x, y + eps, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  const wY0 = evalChladniW(x, y - eps, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);

  return [(wX1 - wX0) / (2.0 * eps), (wY1 - wY0) / (2.0 * eps)];
}

/**
 * Computes fraction of plate area where acceleration exceeds gravity threshold a0 = 1.0.
 */
export function computeActiveFraction(
  m: number,
  n: number,
  k: number,
  blend: number,
  driveStrength: number,
  gridType = 0,
  voidRadius = 0,
  voidShape = 0,
  centerExpulsion = 0,
  gridSamples = 40
): number {
  let activeCount = 0;
  const total = gridSamples * gridSamples;
  const step = 2.0 / gridSamples;

  for (let i = 0; i < gridSamples; i++) {
    const x = -1.0 + (i + 0.5) * step;
    for (let j = 0; j < gridSamples; j++) {
      const y = -1.0 + (j + 0.5) * step;
      const w = evalChladniW(x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
      const accel = driveStrength * Math.abs(w);
      if (accel > 1.0) {
        activeCount++;
      }
    }
  }

  return activeCount / total;
}

/**
 * Computes how effectively the center space inside voidRadius has been cleared of sand.
 * Returns percentage (0 to 100%) and count of grains inside void.
 */
export function computeCenterClearance(
  grains: { x: number; y: number }[],
  voidRadius: number,
  voidShape: number
): { centerClearance: number; centerGrainCount: number } {
  if (voidRadius <= 0.02 || grains.length === 0) {
    return { centerClearance: 100, centerGrainCount: 0 };
  }

  let insideCount = 0;
  for (let i = 0; i < grains.length; i++) {
    const g = grains[i];
    const rDist = voidShape > 0.5 ? Math.max(Math.abs(g.x), Math.abs(g.y)) : Math.sqrt(g.x * g.x + g.y * g.y);
    if (rDist < voidRadius * 0.95) {
      insideCount++;
    }
  }

  // Calculate expected uniform density
  const voidArea = voidShape > 0.5 ? Math.pow(voidRadius * 2, 2) : Math.PI * voidRadius * voidRadius;
  const plateArea = 4.0;
  const expectedGrains = Math.max(1, (voidArea / plateArea) * grains.length);

  // Clearance is 100% when 0 grains are inside
  const ratio = insideCount / expectedGrains;
  const clearance = Math.max(0, Math.min(100, (1.0 - ratio) * 100));

  return {
    centerClearance: clearance,
    centerGrainCount: insideCount,
  };
}

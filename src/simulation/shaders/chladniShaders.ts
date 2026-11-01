import { CHLADNI_GLSL_FUNCTIONS } from '../chladniMath.ts';

// ---------------------------------------------------------------------------
// Background plate shader — 2D quad with Chladni field overlay
// ---------------------------------------------------------------------------
export const BACKGROUND_VERTEX_SHADER = /* glsl */ `
varying vec2 vPos;
void main() {
  vec4 worldPos = modelMatrix * vec4(position.xy, 0.0, 1.0);
  vPos = worldPos.xy;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

export const BACKGROUND_FRAGMENT_SHADER = /* glsl */ `
uniform float uFieldOverlay;
uniform float uNodalPronouncement;
uniform float uModeM;
uniform float uModeN;
uniform float uWaveK;
uniform float uBlend;
uniform float uGridType;
uniform float uVoidRadius;
uniform float uVoidShape;
uniform float uCenterExpulsion;
uniform float uShowVoidGuide;
uniform vec3 uPlateColor;
uniform vec3 uNodeGlowColor;
uniform vec4 uCamData; // (cx, cy, halfW, halfH)

varying vec2 vPos;

${CHLADNI_GLSL_FUNCTIONS}

void main() {
  vec3 color = uPlateColor;

  // Normalize world-space position into isotropic field space [-1,1]×[-1,1]
  // so the Chladni pattern looks identical on any viewport aspect ratio.
  vec2 pField = (vPos - uCamData.xy) / max(uCamData.zw, vec2(0.001));

  // Nodal field overlay heatmap across the full viewport
  if (uFieldOverlay > 0.001) {
    float w = computeChladniW(pField, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
    float absW = abs(w);
    float sharpness = max(uNodalPronouncement, 0.05);
    float edgeWidth = clamp(0.14 / sharpness, 0.005, 0.45);
    float nodeHighlight = pow(clamp(1.0 - smoothstep(0.0, edgeWidth, absW), 0.0, 1.0), max(0.4, sharpness * 0.7));
    vec3 nodeColor = uNodeGlowColor;
    vec3 antinodeColor = vec3(0.65, 0.18, 0.08);
    float antinodeFactor = clamp(pow(absW * 0.75, 1.0 / sharpness), 0.0, 1.0);
    vec3 fieldColor = mix(nodeColor, antinodeColor, antinodeFactor);
    fieldColor += uNodeGlowColor * nodeHighlight * (0.6 * clamp(sharpness, 0.3, 2.5));
    color = mix(color, fieldColor, uFieldOverlay * 0.85);
  }

  // Void guide ring / square in the center
  if (uShowVoidGuide > 0.5 && uVoidRadius > 0.01) {
    vec2 absPos = abs(pField);
    float rDist = (uVoidShape > 0.5) ? max(absPos.x, absPos.y) : length(pField);
    float distToEdge = abs(rDist - uVoidRadius);
    float guideLine = smoothstep(0.006, 0.0015, distToEdge);
    color = mix(color, uNodeGlowColor, guideLine * 0.75);
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Grain particle shader — 2D, reads from GPU texture or CPU buffer attribute
// ---------------------------------------------------------------------------
export const GRAIN_VERTEX_SHADER = /* glsl */ `
uniform sampler2D uPosTex;
uniform float uModeM;
uniform float uModeN;
uniform float uWaveK;
uniform float uBlend;
uniform float uGridType;
uniform float uVoidRadius;
uniform float uVoidShape;
uniform float uCenterExpulsion;
uniform float uGrainCount;
uniform float uGrainSize;
uniform float uNodalPronouncement;
uniform float uUseCpuPositions;
uniform float uPixelRatio;
uniform float uZoom;
uniform vec3 uSandColorPrimary;
uniform vec3 uSandColorSecondary;
uniform vec4 uCamData; // (cx, cy, halfW, halfH)

attribute vec2 aTextureUv;

varying vec3 vColor;
varying float vAlpha;

${CHLADNI_GLSL_FUNCTIONS}

float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 p;

  if (uUseCpuPositions > 0.5) {
    // CPU/WASM path: position.xy holds x,y directly
    p = position.xy;
  } else {
    // GPU path: sample position from ping-pong texture
    vec4 posData = texture2D(uPosTex, aTextureUv);
    p = posData.xy;
  }

  // 2D orthographic placement — grain points live on the XY plane
  vec4 mvPos = modelViewMatrix * vec4(p.x, p.y, 0.0, 1.0);
  gl_Position = projectionMatrix * mvPos;

  // Point sizing scaled by grain density, zoom level, and user grain size multiplier
  float grainSizeHash = hash1(aTextureUv * 987.3);
  float sizeMultiplier = 0.85 + grainSizeHash * 0.5;
  float countScale = clamp(pow(120000.0 / max(uGrainCount, 3000.0), 0.32), 0.85, 2.8);
  float basePx = 1.4 * uPixelRatio * sizeMultiplier * countScale * uZoom * uGrainSize;
  gl_PointSize = clamp(basePx, 1.0, 32.0);

  // Sand color with hash-based variegation
  float colorJitter = hash1(aTextureUv * 543.1);
  vColor = mix(uSandColorPrimary, uSandColorSecondary, colorJitter * 0.7);

  // Subtle brightness near nodal lines across full viewport
  // Normalize to isotropic field space so coloring matches the actual pattern shape
  vec2 pField = (p - uCamData.xy) / max(uCamData.zw, vec2(0.001));
  float w = computeChladniW(pField, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
  float sharpness = max(uNodalPronouncement, 0.05);
  float grainEdgeWidth = clamp(0.08 / sharpness, 0.005, 0.3);
  float nodeCloseness = clamp(1.0 - smoothstep(0.0, grainEdgeWidth, abs(w)), 0.0, 1.0);
  vColor = mix(vColor, vColor * (1.0 + 0.35 * clamp(sharpness, 0.2, 2.5)), nodeCloseness * clamp(0.35 * sharpness, 0.0, 0.85));

  vAlpha = mix(0.96, 0.82, clamp(uGrainCount / 500000.0, 0.0, 1.0));
}
`;

export const GRAIN_FRAGMENT_SHADER = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.48) discard;
  float edge = smoothstep(0.48, 0.35, dist);
  gl_FragColor = vec4(vColor, vAlpha * edge);
}
`;

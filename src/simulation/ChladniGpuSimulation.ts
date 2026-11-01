import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { CHLADNI_GLSL_FUNCTIONS } from './chladniMath.ts';

const POSITION_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uModeM;
uniform float uModeN;
uniform float uWaveK;
uniform float uBlend;
uniform float uDriveStrength;
uniform float uGridType;
uniform float uVoidRadius;
uniform float uVoidShape;
uniform float uCenterExpulsion;
uniform vec2  uPointerPos;
uniform float uPointerRadius;
uniform float uPointerStrength;
uniform float uPointerActive;
uniform sampler2D uTextMask;
uniform float uTextMaskActive;
uniform float uTextMaskStrength;
uniform vec2  uTextMaskRes;
uniform vec4  uCamData;   // (cx, cy, halfW, halfH)
uniform float uRotAngle;  // rotation in radians
uniform float uFlipH;     // 1.0 if horizontal flip
uniform float uFlipV;     // 1.0 if vertical flip

${CHLADNI_GLSL_FUNCTIONS}

// High quality pseudo-random functions
float hash1(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

vec2 hash2(vec2 p) {
  return fract(sin(vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  )) * 43758.5453123);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(tPosition, uv);

  // Normalize particle world-position into isotropic field space [-1,1]×[-1,1].
  // This keeps the Chladni pattern identical on any viewport aspect ratio.
  vec2 pField = (pos.xy - uCamData.xy) / max(uCamData.zw, vec2(0.001));

  // Compute wave amplitude and gradient in normalized field space
  float w = computeChladniW(pField, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
  float accel = uDriveStrength * abs(w);

  // Distance from center in field space for radial expulsion
  float rDist = (uVoidShape > 0.5) ? max(abs(pField.x), abs(pField.y)) : length(pField);

  // a0 = 1.0 is the gravity liftoff threshold
  if (accel > 1.0) {
    // Plate accelerates faster than gravity: grains are kicked into constant tiny hops and wander
    float excess = accel - 1.0;
    float kick = sqrt(excess);

    // Gradient in field space; convert to world-space drift so movement
    // is isotropic (equal pixel speed) regardless of viewport aspect.
    vec2 gradField = computeChladniGrad(pField, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
    vec2 gradW = vec2(gradField.x / max(uCamData.z, 0.001), gradField.y / max(uCamData.w, 0.001));
    float signW = (w >= 0.0) ? 1.0 : -1.0;
    vec2 gradAbsW = signW * gradW;

    // Systematic drift down the amplitude gradient towards still nodal lines
    vec2 drift = -gradAbsW * (0.00022 * uDriveStrength);

    // Active center void expulsion: push particles out of the central empty space toward the nodal perimeter
    if (uVoidRadius > 0.01 && rDist < uVoidRadius) {
      // outward direction in world-space (scale field-space direction back to world)
      vec2 outwardField = (rDist > 0.001) ? (pField / rDist) : vec2(0.0, 1.0);
      vec2 outwardWorld = vec2(outwardField.x * uCamData.z, outwardField.y * uCamData.w);
      float pushStrength = (1.0 - rDist / uVoidRadius) * (0.0035 * (1.0 + uCenterExpulsion));
      drift += outwardWorld * pushStrength;
    }

    // Chaotic Brownian wandering from irregular grain micro-collisions
    vec2 rnd = hash2(pos.xy * 67.3 + vec2(uTime * 23.1, uv.x * 183.7));
    vec2 wander = (rnd - vec2(0.5)) * (0.0042 * kick);

    pos.xy += drift + wander;

    pos.z = 0.0;
    pos.w = 1.0; // active
  } else {
    // In nodal quiet zone: plate acceleration is weaker than gravity.
    // If grain is inside the center void zone, gently escort it out to the nodal perimeter
    if (uVoidRadius > 0.01 && rDist < uVoidRadius) {
      vec2 outwardField = (rDist > 0.001) ? (pField / rDist) : vec2(0.0, 1.0);
      vec2 outwardWorld = vec2(outwardField.x * uCamData.z, outwardField.y * uCamData.w);
      pos.xy += outwardWorld * 0.004;
      pos.z = 0.0;
      pos.w = 1.0;
    } else {
      pos.z = 0.0;

      // Subtle compaction towards the center of the nodal ridge
      if (accel > 0.85) {
        vec2 gradField = computeChladniGrad(pField, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
        vec2 gradW = vec2(gradField.x / max(uCamData.z, 0.001), gradField.y / max(uCamData.w, 0.001));
        float signW = (w >= 0.0) ? 1.0 : -1.0;
        pos.xy += -signW * gradW * 0.00008;
      }

      pos.w = 0.0; // settled
    }
  }

  // Pointer push — repel grains away from the cursor
  if (uPointerActive > 0.5) {
    vec2 toGrain = pos.xy - uPointerPos;
    float dist = length(toGrain);
    if (dist < uPointerRadius && dist > 0.0001) {
      float falloff = 1.0 - (dist / uPointerRadius);
      falloff = falloff * falloff; // quadratic
      vec2 pushDir = toGrain / dist;
      pos.xy += pushDir * falloff * uPointerStrength;
      pos.w = 1.0; // wake settled grains
    }
  }

  // Exact text silhouette repulsion — repel grains away from DOM text shapes
  if (uTextMaskActive > 0.5) {
    vec2 worldP = pos.xy;
    if (uFlipH > 0.5) worldP.x = -worldP.x;
    if (uFlipV > 0.5) worldP.y = -worldP.y;
    if (abs(uRotAngle) > 0.0001) {
      float cosA = cos(uRotAngle);
      float sinA = sin(uRotAngle);
      worldP = vec2(worldP.x * cosA - worldP.y * sinA, worldP.x * sinA + worldP.y * cosA);
    }

    vec2 ndc;
    ndc.x = (worldP.x - uCamData.x) / max(uCamData.z, 0.001);
    ndc.y = (worldP.y - uCamData.y) / max(uCamData.w, 0.001);
    vec2 screenUV = ndc * 0.5 + 0.5;

    if (screenUV.x >= 0.0 && screenUV.x <= 1.0 && screenUV.y >= 0.0 && screenUV.y <= 1.0) {
      float density = texture2D(uTextMask, screenUV).r;
      if (density > 0.005) {
        float eps = 1.8 / uTextMaskRes.x;
        float epsY = 1.8 / uTextMaskRes.y;
        float gx = texture2D(uTextMask, screenUV + vec2(eps, 0.0)).r - texture2D(uTextMask, screenUV - vec2(eps, 0.0)).r;
        float gy = texture2D(uTextMask, screenUV + vec2(0.0, epsY)).r - texture2D(uTextMask, screenUV - vec2(0.0, epsY)).r;
        vec2 gradScreen = vec2(gx, gy);
        float gLen = length(gradScreen);

        if (gLen < 0.004) {
          float epsWide = 6.0 / uTextMaskRes.x;
          float epsWideY = 6.0 / uTextMaskRes.y;
          float gx2 = texture2D(uTextMask, screenUV + vec2(epsWide, 0.0)).r - texture2D(uTextMask, screenUV - vec2(epsWide, 0.0)).r;
          float gy2 = texture2D(uTextMask, screenUV + vec2(0.0, epsWideY)).r - texture2D(uTextMask, screenUV - vec2(0.0, epsWideY)).r;
          gradScreen = vec2(gx2, gy2);
          gLen = length(gradScreen);
        }

        vec2 pushScreen;
        if (gLen > 0.001) {
          pushScreen = -normalize(gradScreen);
        } else {
          vec2 rndW = hash2(pos.xy * 89.1 + vec2(uTime * 31.7, 0.0)) - vec2(0.5);
          pushScreen = normalize(rndW + vec2(0.001));
        }

        vec2 pushWorld = vec2(pushScreen.x * uCamData.z, pushScreen.y * uCamData.w);

        if (abs(uRotAngle) > 0.0001) {
          float cosA = cos(-uRotAngle);
          float sinA = sin(-uRotAngle);
          pushWorld = vec2(pushWorld.x * cosA - pushWorld.y * sinA, pushWorld.x * sinA + pushWorld.y * cosA);
        }
        if (uFlipH > 0.5) pushWorld.x = -pushWorld.x;
        if (uFlipV > 0.5) pushWorld.y = -pushWorld.y;

        float pushMag = clamp(density * 1.6, 0.08, 1.0) * uTextMaskStrength;
        pos.xy += pushWorld * pushMag;
        pos.w = 1.0;
      }
    }
  }

  // Contain sand particles within the full visible viewport boundaries
  float boundX = max(uCamData.z * 0.995, 0.98);
  float boundY = max(uCamData.w * 0.995, 0.98);
  pos.x = clamp(pos.x, uCamData.x - boundX, uCamData.x + boundX);
  pos.y = clamp(pos.y, uCamData.y - boundY, uCamData.y + boundY);

  gl_FragColor = pos;
}
`;

/**
 * Maps a requested grain count to the simulation texture dimension. Changing
 * within a bucket does not require rebuilding GPU textures.
 */
export function gpuTextureSizeForGrainCount(grainCount: number): number {
  if (grainCount <= 7_500) return 72; // ~5,184 grains
  if (grainCount <= 18_000) return 100; // 10,000 grains
  if (grainCount <= 35_000) return 160; // 25,600 grains
  if (grainCount <= 75_000) return 224; // 50,176 grains
  if (grainCount <= 160_000) return 320; // 102,400 grains
  if (grainCount <= 350_000) return 512; // 262,144 grains
  if (grainCount <= 750_000) return 720; // 518,400 grains
  return 1024; // 1,048,576 grains
}

export class ChladniGpuSimulation {
  public gpuCompute: GPUComputationRenderer;
  public posVariable: any;
  public textureWidth: number;
  public textureHeight: number;
  public grainCount: number;

  constructor(
    renderer: THREE.WebGLRenderer,
    grainCount = 100_000,
    initialHalfW = 2.0,
    initialHalfH = 1.05
  ) {
    const dim = gpuTextureSizeForGrainCount(grainCount);

    this.textureWidth = dim;
    this.textureHeight = dim;
    this.grainCount = dim * dim;

    this.gpuCompute = new GPUComputationRenderer(dim, dim, renderer);

    const dtPosition = this.gpuCompute.createTexture();
    this.fillInitialData(dtPosition, initialHalfW, initialHalfH);

    this.posVariable = this.gpuCompute.addVariable('tPosition', POSITION_FRAGMENT_SHADER, dtPosition);
    this.gpuCompute.setVariableDependencies(this.posVariable, [this.posVariable]);

    const u = this.posVariable.material.uniforms;
    u.uTime = { value: 0 };
    u.uModeM = { value: 4.0 };
    u.uModeN = { value: 8.0 };
    u.uWaveK = { value: 32.0 };
    u.uBlend = { value: 0.72 };
    u.uDriveStrength = { value: 3.2 };
    u.uGridType = { value: 2.0 }; // annular
    u.uVoidRadius = { value: 0.28 };
    u.uVoidShape = { value: 0.0 }; // circle
    u.uCenterExpulsion = { value: 2.5 };
    u.uPointerPos = { value: new THREE.Vector2(0, 0) };
    u.uPointerRadius = { value: 0.12 };
    u.uPointerStrength = { value: 0.012 };
    u.uPointerActive = { value: 0.0 };
    u.uTextMask = { value: null };
    u.uTextMaskActive = { value: 0.0 };
    u.uTextMaskStrength = { value: 0.022 };
    u.uTextMaskRes = { value: new THREE.Vector2(1024.0, 1024.0) };
    u.uCamData = { value: new THREE.Vector4(0, 0, initialHalfW, initialHalfH) };
    u.uRotAngle = { value: 0.0 };
    u.uFlipH = { value: 0.0 };
    u.uFlipV = { value: 0.0 };

    const error = this.gpuCompute.init();
    if (error !== null) {
      console.error('GPUComputationRenderer init error:', error);
    }
  }

  public fillInitialData(dtPosition: THREE.DataTexture, halfW = 2.0, halfH = 1.05) {
    const posArray = dtPosition.image.data as Float32Array;
    const count = this.textureWidth * this.textureHeight;

    const spanX = Math.max(halfW * 0.98, 0.96);
    const spanY = Math.max(halfH * 0.98, 0.96);

    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      const rx = (Math.random() * 2.0 - 1.0) * spanX;
      const ry = (Math.random() * 2.0 - 1.0) * spanY;

      posArray[idx + 0] = rx;
      posArray[idx + 1] = ry;
      posArray[idx + 2] = 0.0;
      posArray[idx + 3] = 1.0;
    }
    dtPosition.needsUpdate = true;
  }

  public scatter(halfW = 2.0, halfH = 1.05) {
    const dtPos = this.gpuCompute.createTexture();
    this.fillInitialData(dtPos, halfW, halfH);

    this.gpuCompute.renderTexture(dtPos, this.posVariable.renderTargets[0]);
    this.gpuCompute.renderTexture(dtPos, this.posVariable.renderTargets[1]);
  }

  public update(
    time: number,
    _delta: number,
    m: number,
    n: number,
    k: number,
    blend: number,
    driveStrength: number,
    gridType: number,
    voidRadius: number,
    voidShape: number,
    centerExpulsion: number,
    pointerX = 0,
    pointerY = 0,
    pointerActive = false,
    pointerRadius = 0.12,
    pointerStrength = 0.012,
    textMaskTexture: THREE.Texture | null = null,
    textMaskActive = false,
    textMaskStrength = 0.022,
    textMaskResW = 1024,
    textMaskResH = 1024,
    camData?: THREE.Vector4,
    rotAngle = 0,
    flipH = false,
    flipV = false
  ) {
    const u = this.posVariable.material.uniforms;
    u.uTime.value = time;
    u.uModeM.value = m;
    u.uModeN.value = n;
    u.uWaveK.value = k;
    u.uBlend.value = blend;
    u.uDriveStrength.value = driveStrength;
    u.uGridType.value = gridType;
    u.uVoidRadius.value = voidRadius;
    u.uVoidShape.value = voidShape;
    u.uCenterExpulsion.value = centerExpulsion;
    u.uPointerPos.value.set(pointerX, pointerY);
    u.uPointerRadius.value = pointerRadius;
    u.uPointerStrength.value = pointerStrength;
    u.uPointerActive.value = pointerActive ? 1.0 : 0.0;

    if (textMaskTexture) {
      u.uTextMask.value = textMaskTexture;
    }
    u.uTextMaskActive.value = textMaskActive ? 1.0 : 0.0;
    u.uTextMaskStrength.value = textMaskStrength;
    u.uTextMaskRes.value.set(textMaskResW, textMaskResH);
    if (camData) {
      u.uCamData.value.copy(camData);
    }
    u.uRotAngle.value = rotAngle;
    u.uFlipH.value = flipH ? 1.0 : 0.0;
    u.uFlipV.value = flipV ? 1.0 : 0.0;

    this.gpuCompute.compute();
  }

  public getPositionTexture(): THREE.Texture {
    return this.gpuCompute.getCurrentRenderTarget(this.posVariable).texture;
  }

  public dispose() {
    this.posVariable.material.dispose();
    this.gpuCompute.dispose();
  }
}

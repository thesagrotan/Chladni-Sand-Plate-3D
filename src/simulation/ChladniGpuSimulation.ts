import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { CHLADNI_GLSL_FUNCTIONS } from './chladniMath.ts';

const POSITION_FRAGMENT_SHADER = /* glsl */ `
uniform float uTime;
uniform float uDelta;
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

  // Compute wave amplitude and gradient at current grain coordinate
  float w = computeChladniW(pos.xy, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
  float accel = uDriveStrength * abs(w);

  // Distance from center for radial expulsion
  float rDist = (uVoidShape > 0.5) ? max(abs(pos.x), abs(pos.y)) : length(pos.xy);

  // a0 = 1.0 is the gravity liftoff threshold
  if (accel > 1.0) {
    // Plate accelerates faster than gravity: grains are kicked into constant tiny hops and wander
    float excess = accel - 1.0;
    float kick = sqrt(excess);

    // Compute analytical wave slope gradient
    vec2 gradW = computeChladniGrad(pos.xy, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
    float signW = (w >= 0.0) ? 1.0 : -1.0;
    vec2 gradAbsW = signW * gradW;

    // Systematic drift down the amplitude gradient towards still nodal lines
    vec2 drift = -gradAbsW * (0.00022 * uDriveStrength);

    // Active center void expulsion: push particles out of the central empty space toward the nodal perimeter
    if (uVoidRadius > 0.01 && rDist < uVoidRadius) {
      vec2 outward = (rDist > 0.001) ? (pos.xy / rDist) : vec2(0.0, 1.0);
      float pushStrength = (1.0 - rDist / uVoidRadius) * (0.0035 * (1.0 + uCenterExpulsion));
      drift += outward * pushStrength;
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
      vec2 outward = (rDist > 0.001) ? (pos.xy / rDist) : vec2(0.0, 1.0);
      pos.xy += outward * 0.004;
      pos.z = 0.0;
      pos.w = 1.0;
    } else {
      pos.z = 0.0;

      // Subtle compaction towards the center of the nodal ridge
      if (accel > 0.85) {
        vec2 gradW = computeChladniGrad(pos.xy, uModeM, uModeN, uWaveK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
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

  // Contain sand particles within the plate boundaries
  const float BOUND = 0.975;
  pos.x = clamp(pos.x, -BOUND, BOUND);
  pos.y = clamp(pos.y, -BOUND, BOUND);

  gl_FragColor = pos;
}
`;

export class ChladniGpuSimulation {
  public gpuCompute: GPUComputationRenderer;
  public posVariable: any;
  public textureWidth: number;
  public textureHeight: number;
  public grainCount: number;

  constructor(renderer: THREE.WebGLRenderer, grainCount = 100_000) {
    let dim = 1024;
    if (grainCount <= 7_500) dim = 72; // ~5,184 grains
    else if (grainCount <= 18_000) dim = 100; // 10,000 grains
    else if (grainCount <= 35_000) dim = 160; // 25,600 grains
    else if (grainCount <= 75_000) dim = 224; // 50,176 grains
    else if (grainCount <= 160_000) dim = 320; // 102,400 grains
    else if (grainCount <= 350_000) dim = 512; // 262,144 grains
    else if (grainCount <= 750_000) dim = 720; // 518,400 grains
    else dim = 1024; // 1,048,576 grains

    this.textureWidth = dim;
    this.textureHeight = dim;
    this.grainCount = dim * dim;

    this.gpuCompute = new GPUComputationRenderer(dim, dim, renderer);

    const dtPosition = this.gpuCompute.createTexture();
    this.fillInitialData(dtPosition);

    this.posVariable = this.gpuCompute.addVariable('tPosition', POSITION_FRAGMENT_SHADER, dtPosition);
    this.gpuCompute.setVariableDependencies(this.posVariable, [this.posVariable]);

    const u = this.posVariable.material.uniforms;
    u.uTime = { value: 0 };
    u.uDelta = { value: 0.016 };
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

    const error = this.gpuCompute.init();
    if (error !== null) {
      console.error('GPUComputationRenderer init error:', error);
    }
  }

  public fillInitialData(dtPosition: THREE.DataTexture) {
    const posArray = dtPosition.image.data as Float32Array;
    const count = this.textureWidth * this.textureHeight;

    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      const rx = (Math.random() * 2.0 - 1.0) * 0.96;
      const ry = (Math.random() * 2.0 - 1.0) * 0.96;

      posArray[idx + 0] = rx;
      posArray[idx + 1] = ry;
      posArray[idx + 2] = 0.0;
      posArray[idx + 3] = 1.0;
    }
    dtPosition.needsUpdate = true;
  }

  public scatter() {
    const dtPos = this.gpuCompute.createTexture();
    this.fillInitialData(dtPos);

    this.gpuCompute.renderTexture(dtPos, this.posVariable.renderTargets[0]);
    this.gpuCompute.renderTexture(dtPos, this.posVariable.renderTargets[1]);
  }

  public update(
    time: number,
    delta: number,
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
    pointerStrength = 0.012
  ) {
    const u = this.posVariable.material.uniforms;
    u.uTime.value = time;
    u.uDelta.value = Math.min(delta, 0.05);
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

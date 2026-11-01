import * as THREE from 'three';
import type { MutableRefObject } from 'react';
import type { ChladniParams } from '../types/chladni.ts';
import { ChladniGpuSimulation } from './ChladniGpuSimulation.ts';
import { ChladniWasmSimulation } from './ChladniWasmSimulation.ts';
import { ChladniJsCpuSimulation } from './ChladniJsCpuSimulation.ts';
import { getChladniWasm } from './wasm/chladniWasmModule.ts';
import type { ChladniWasmExports } from './wasm/chladniWasmModule.ts';
import type { CpuParticle } from './renderChladniFrame.ts';

/** Maximum number of grains the CPU/WASM engines will simulate. */
export const CPU_GRAIN_CAP = 35_000;

/** Number of lightweight CPU grains sampled for telemetry. */
export const TELEMETRY_GRAIN_COUNT = 1024;

/**
 * Refs shared between the canvas hook, the camera controls, and the frame
 * renderer. The engine helpers below mutate these in place so the animation
 * loop keeps reading the latest engines without re-rendering.
 */
export interface EngineRefs {
  sim: MutableRefObject<ChladniGpuSimulation | null>;
  wasmSim: MutableRefObject<ChladniWasmSimulation | null>;
  jsCpuSim: MutableRefObject<ChladniJsCpuSimulation | null>;
  wasmExports: MutableRefObject<ChladniWasmExports | null>;
  cpuParticles: MutableRefObject<CpuParticle[]>;
  grainPoints: MutableRefObject<THREE.Points | null>;
  grainMaterial: MutableRefObject<THREE.ShaderMaterial | null>;
  camData: MutableRefObject<THREE.Vector4>;
}

/** Lightweight CPU grain sample used only for telemetry metrics. */
export function createTelemetryGrains(halfW: number, halfH: number): CpuParticle[] {
  const grains: CpuParticle[] = [];
  for (let i = 0; i < TELEMETRY_GRAIN_COUNT; i++) {
    grains.push({
      x: (Math.random() * 2 - 1) * (halfW * 0.95),
      y: (Math.random() * 2 - 1) * (halfH * 0.95),
      settled: false,
    });
  }
  return grains;
}

/**
 * Builds a grain geometry whose texture UVs sample the given simulation's
 * position texture. Positions start at the origin and are filled by the GPU
 * on the first frame.
 */
export function createGrainGeometry(sim: ChladniGpuSimulation): THREE.BufferGeometry {
  const count = sim.grainCount;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const textureUvs = new Float32Array(count * 2);

  for (let i = 0; i < count; i++) {
    const u = ((i % sim.textureWidth) + 0.5) / sim.textureWidth;
    const v = (Math.floor(i / sim.textureWidth) + 0.5) / sim.textureHeight;
    textureUvs[i * 2 + 0] = u;
    textureUvs[i * 2 + 1] = v;
    positions[i * 3 + 0] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aTextureUv', new THREE.BufferAttribute(textureUvs, 2));
  return geometry;
}

/** Applies the 2D flip/rotation transforms from params to a points object. */
export function applyGrainTransform(points: THREE.Points, params: ChladniParams): void {
  points.scale.x = params.flipHorizontal ? -1 : 1;
  points.scale.y = params.flipVertical ? -1 : 1;
  points.rotation.z = (params.rotationAngle * Math.PI) / 180;
}

/** Creates the grain Points object for a simulation and applies its transform. */
export function createGrainPoints(
  geometry: THREE.BufferGeometry,
  material: THREE.ShaderMaterial,
  params: ChladniParams
): THREE.Points {
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 1;
  applyGrainTransform(points, params);
  return points;
}

function randomizeCpuParticles(grains: CpuParticle[], halfW: number, halfH: number): void {
  for (let i = 0; i < grains.length; i++) {
    grains[i].x = (Math.random() * 2 - 1) * (halfW * 0.95);
    grains[i].y = (Math.random() * 2 - 1) * (halfH * 0.95);
    grains[i].settled = false;
  }
}

/**
 * Scatters every active engine across the plate. Used by both the scatter
 * trigger and the reset trigger (reset also re-centers the camera separately).
 */
export function scatterEngines(refs: EngineRefs, halfW: number, halfH: number): void {
  refs.sim.current?.scatter(halfW, halfH);
  refs.wasmSim.current?.resetParticles();
  refs.jsCpuSim.current?.resetParticles(halfW * 0.95, halfH * 0.95);
  randomizeCpuParticles(refs.cpuParticles.current, halfW, halfH);
}

/**
 * Rebuilds the GPU simulation and grain geometry after the requested grain
 * count crosses a texture-bucket boundary. Callers own the debounce.
 */
export function rebuildGpuEngine(
  refs: EngineRefs,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  nextCount: number,
  params: ChladniParams
): void {
  const grainMat = refs.grainMaterial.current;
  if (!grainMat) return;

  if (refs.grainPoints.current) {
    scene.remove(refs.grainPoints.current);
    refs.grainPoints.current.geometry.dispose();
    refs.grainPoints.current = null;
  }

  refs.sim.current?.dispose();

  const cam = refs.camData.current;
  const newSim = new ChladniGpuSimulation(renderer, nextCount, cam.z, cam.w);
  refs.sim.current = newSim;

  const grainGeo = createGrainGeometry(newSim);

  grainMat.uniforms.uPosTex.value = newSim.getPositionTexture();
  if (grainMat.uniforms.uGrainCount) {
    grainMat.uniforms.uGrainCount.value = newSim.grainCount;
  }

  const grainPoints = createGrainPoints(grainGeo, grainMat, params);
  scene.add(grainPoints);
  refs.grainPoints.current = grainPoints;
}

/**
 * Lazily constructs the selected CPU/WASM engine (the default GPU path never
 * allocates CPU particle buffers or fetches the WASM binary). Returns the WASM
 * module promise when the WASM engine is selected so the caller can store the
 * exports; returns null otherwise.
 */
export function ensureSelectedCpuEngine(
  refs: EngineRefs,
  engine: ChladniParams['simulationEngine'],
  grainCount: number
): Promise<ChladniWasmExports> | null {
  const cpuCount = Math.min(grainCount, CPU_GRAIN_CAP);

  if (engine === 'wasm') {
    if (!refs.wasmSim.current || refs.wasmSim.current.grainCount !== cpuCount) {
      refs.wasmSim.current?.dispose();
      refs.wasmSim.current = new ChladniWasmSimulation(cpuCount);
    }
    return getChladniWasm();
  }

  if (engine === 'js_cpu' && (!refs.jsCpuSim.current || refs.jsCpuSim.current.grainCount !== cpuCount)) {
    refs.jsCpuSim.current = new ChladniJsCpuSimulation(cpuCount);
  }

  return null;
}

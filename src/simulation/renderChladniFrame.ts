import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ChladniMetrics, ChladniParams } from '../types/chladni.ts';
import type { ChladniGpuSimulation } from './ChladniGpuSimulation.ts';
import type { ChladniWasmSimulation } from './ChladniWasmSimulation.ts';
import type { ChladniJsCpuSimulation } from './ChladniJsCpuSimulation.ts';
import type { TextMaskManager } from '../utils/TextMaskManager.ts';
import type { ChladniWasmExports } from './wasm/chladniWasmModule.ts';
import { plateAudio } from './audioSynth.ts';
import { computeEffectiveWaveParams } from './audioReactive.ts';
import {
  gridTypeToNumber,
  voidShapeToNumber,
  computeActiveFraction,
  computeCenterClearance,
  evalChladniW,
  evalChladniGrad,
} from './chladniMath.ts';

export interface CpuParticle {
  x: number;
  y: number;
  settled: boolean;
}

export interface ChladniFrameDeps {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  params: MutableRefObject<ChladniParams>;
  isPaused: MutableRefObject<boolean>;
  onMetricsUpdate: MutableRefObject<(metrics: ChladniMetrics) => void>;
  camData: MutableRefObject<THREE.Vector4>;
  bgMesh: MutableRefObject<THREE.Mesh | null>;
  backgroundMaterial: MutableRefObject<THREE.ShaderMaterial | null>;
  grainMaterial: MutableRefObject<THREE.ShaderMaterial | null>;
  grainPoints: MutableRefObject<THREE.Points | null>;
  sim: MutableRefObject<ChladniGpuSimulation | null>;
  wasmSim: MutableRefObject<ChladniWasmSimulation | null>;
  jsCpuSim: MutableRefObject<ChladniJsCpuSimulation | null>;
  wasmExports: MutableRefObject<ChladniWasmExports | null>;
  textMask: MutableRefObject<TextMaskManager | null>;
  cpuParticles: MutableRefObject<CpuParticle[]>;
  frameTimestamps: MutableRefObject<number[]>;
  lastMetricsTime: MutableRefObject<number>;
  pointerSimPos: MutableRefObject<{ x: number; y: number }>;
  pointerActive: MutableRefObject<boolean>;
}

export interface ChladniFrameState {
  lastTime: number;
  simTime: number;
}

/**
 * Runs one simulation frame: advances the selected engine, refreshes shader
 * uniforms and the background mesh transform, and emits metrics. The caller
 * owns requestAnimationFrame scheduling.
 */
export function renderChladniFrame(deps: ChladniFrameDeps, state: ChladniFrameState): void {
  const {
    renderer,
    scene,
    camera,
    params: paramsRef,
    isPaused: isPausedRef,
    onMetricsUpdate: onMetricsUpdateRef,
    camData: camDataRef,
    bgMesh: bgMeshRef,
    backgroundMaterial: backgroundMaterialRef,
    grainMaterial: grainMaterialRef,
    grainPoints: grainPointsRef,
    sim: simRef,
    wasmSim: wasmSimRef,
    jsCpuSim: jsCpuSimRef,
    wasmExports: wasmExportsRef,
    textMask: textMaskManagerRef,
    cpuParticles: cpuParticlesRef,
    frameTimestamps: frameTimestampsRef,
    lastMetricsTime: lastMetricsTimeRef,
    pointerSimPos: pointerSimPosRef,
    pointerActive: pointerActiveRef,
  } = deps;

  const now = performance.now();
  const delta = (now - state.lastTime) / 1000;
  state.lastTime = now;

  const cp = paramsRef.current;
  const curPaused = isPausedRef.current;
  const gridTypeNum = gridTypeToNumber(cp.gridType);
  const voidShapeNum = voidShapeToNumber(cp.centerVoidShape);

  // Keep 2D flips and rotation aligned
  if (grainPointsRef.current) {
    grainPointsRef.current.scale.x = cp.flipHorizontal ? -1 : 1;
    grainPointsRef.current.scale.y = cp.flipVertical ? -1 : 1;
    grainPointsRef.current.rotation.z = (cp.rotationAngle * Math.PI) / 180;
  }
  if (bgMeshRef.current) {
    // Preserve viewport-fill scale while encoding flip as a sign on each axis.
    const bHalfW = camDataRef.current.z;
    const bHalfH = camDataRef.current.w;
    bgMeshRef.current.scale.set(
      bHalfW * 2.1 * (cp.flipHorizontal ? -1 : 1),
      bHalfH * 2.1 * (cp.flipVertical ? -1 : 1),
      1
    );
    bgMeshRef.current.position.set(camDataRef.current.x, camDataRef.current.y, 0);
    bgMeshRef.current.rotation.z = (cp.rotationAngle * Math.PI) / 180;
  }

  // Rolling FPS
  const timestamps = frameTimestampsRef.current;
  timestamps.push(now);
  if (timestamps.length > 30) timestamps.shift();
  const rollingFps =
    timestamps.length > 1
      ? Math.min(
          120,
          Math.max(10, +((1000 * (timestamps.length - 1)) / (now - timestamps[0])).toFixed(1))
        )
      : 60.0;

  // Audio reactivity
  const audioMetrics = plateAudio.sampleMetrics();
  const {
    m: effectiveM,
    n: effectiveN,
    k: effectiveK,
    drive: effectiveDrive,
  } = computeEffectiveWaveParams(cp, audioMetrics);

  if (!curPaused) {
    state.simTime += delta;
    let computeTimeMs = 0;
    let settledPct = 0;

    if (cp.simulationEngine === 'wasm' && wasmSimRef.current && wasmSimRef.current.isReady) {
      const wres = wasmSimRef.current.update(
        state.simTime,
        delta,
        effectiveM,
        effectiveN,
        effectiveK,
        cp.symmetryBlend,
        effectiveDrive,
        gridTypeNum,
        cp.centerVoidRadius,
        voidShapeNum,
        cp.centerExpulsion
      );
      computeTimeMs = wres.computeTimeMs;
      settledPct = (wres.settledCount / wasmSimRef.current.grainCount) * 100;

      if (grainPointsRef.current) {
        wasmSimRef.current.syncToBufferAttribute(
          grainPointsRef.current.geometry.attributes.position as THREE.BufferAttribute
        );
      }
      if (grainMaterialRef.current) {
        grainMaterialRef.current.uniforms.uUseCpuPositions.value = 1.0;
      }
    } else if (cp.simulationEngine === 'js_cpu' && jsCpuSimRef.current) {
      const jres = jsCpuSimRef.current.update(
        state.simTime,
        delta,
        effectiveM,
        effectiveN,
        effectiveK,
        cp.symmetryBlend,
        effectiveDrive,
        gridTypeNum,
        cp.centerVoidRadius,
        voidShapeNum,
        cp.centerExpulsion
      );
      computeTimeMs = jres.computeTimeMs;
      settledPct = (jres.settledCount / jsCpuSimRef.current.grainCount) * 100;

      if (grainPointsRef.current) {
        jsCpuSimRef.current.syncToBufferAttribute(
          grainPointsRef.current.geometry.attributes.position as THREE.BufferAttribute
        );
      }
      if (grainMaterialRef.current) {
        grainMaterialRef.current.uniforms.uUseCpuPositions.value = 1.0;
      }
    } else {
      // GPU engine (default)
      const cam = camera;
      const halfW = cam ? (cam.right - cam.left) * 0.5 : 1.05;
      const halfH = cam ? (cam.top - cam.bottom) * 0.5 : 1.05;
      const cx = cam ? (cam.left + cam.right) * 0.5 : 0;
      const cy = cam ? (cam.bottom + cam.top) * 0.5 : 0;
      camDataRef.current.set(cx, cy, halfW, halfH);

      // Update text mask and dynamic DOM elements rejection strength
      const domRepulsion = cp.domRepulsion !== undefined ? cp.domRepulsion : 1.0;
      const domActive = domRepulsion > 0.001;
      const effectiveDomStrength = 0.024 * domRepulsion;

      if (textMaskManagerRef.current) {
        textMaskManagerRef.current.active = domActive;
        textMaskManagerRef.current.strength = effectiveDomStrength;
        if (domActive) {
          textMaskManagerRef.current.update(now);
        }
      }

      const t0 = performance.now();
      const tmm = textMaskManagerRef.current;
      simRef.current!.update(
        state.simTime,
        delta,
        effectiveM,
        effectiveN,
        effectiveK,
        cp.symmetryBlend,
        effectiveDrive,
        gridTypeNum,
        cp.centerVoidRadius,
        voidShapeNum,
        cp.centerExpulsion,
        pointerSimPosRef.current.x,
        pointerSimPosRef.current.y,
        pointerActiveRef.current,
        0.12,
        0.012,
        tmm ? tmm.texture : null,
        domActive,
        effectiveDomStrength,
        tmm ? tmm.canvasW : 1024,
        tmm ? tmm.canvasH : 1024,
        camDataRef.current,
        (cp.rotationAngle * Math.PI) / 180,
        cp.flipHorizontal,
        cp.flipVertical
      );
      computeTimeMs = +(performance.now() - t0).toFixed(2);

      if (grainMaterialRef.current) {
        grainMaterialRef.current.uniforms.uUseCpuPositions.value = 0.0;
      }

      // CPU sample for telemetry
      let settledCount = 0;
      const grains = cpuParticlesRef.current;
      const camData = camDataRef.current;
      const bx = camData.z * 0.98;
      const by = camData.w * 0.98;

      for (let i = 0; i < grains.length; i++) {
        const g = grains[i];
        const px = g.x;
        const py = g.y;
        const w = evalChladniW(
          px,
          py,
          effectiveM,
          effectiveN,
          effectiveK,
          cp.symmetryBlend,
          gridTypeNum,
          cp.centerVoidRadius,
          voidShapeNum,
          cp.centerExpulsion
        );
        const accel = effectiveDrive * Math.abs(w);
        const rDist =
          voidShapeNum > 0.5
            ? Math.max(Math.abs(px), Math.abs(py))
            : Math.sqrt(px * px + py * py);

        if (accel > 1.0) {
          g.settled = false;
          const [gradX, gradY] = evalChladniGrad(
            px,
            py,
            effectiveM,
            effectiveN,
            effectiveK,
            cp.symmetryBlend,
            gridTypeNum,
            cp.centerVoidRadius,
            voidShapeNum,
            cp.centerExpulsion
          );
          const signW = w >= 0 ? 1 : -1;
          const kick = Math.sqrt(accel - 1.0);
          let dx =
            -signW * gradX * 0.00022 * effectiveDrive +
            (Math.random() - 0.5) * 0.0042 * kick;
          let dy =
            -signW * gradY * 0.00022 * effectiveDrive +
            (Math.random() - 0.5) * 0.0042 * kick;

          if (cp.centerVoidRadius > 0.01 && rDist < cp.centerVoidRadius) {
            const invR = rDist > 0.001 ? 1.0 / rDist : 0;
            const push =
              (1.0 - rDist / cp.centerVoidRadius) * (0.0035 * (1.0 + cp.centerExpulsion));
            dx += g.x * invR * push;
            dy += g.y * invR * push;
          }

          g.x = Math.max(-bx, Math.min(bx, g.x + dx));
          g.y = Math.max(-by, Math.min(by, g.y + dy));
        } else {
          if (cp.centerVoidRadius > 0.01 && rDist < cp.centerVoidRadius) {
            const invR = rDist > 0.001 ? 1.0 / rDist : 0;
            g.x = Math.max(-bx, Math.min(bx, g.x + g.x * invR * 0.004));
            g.y = Math.max(-by, Math.min(by, g.y + g.y * invR * 0.004));
            g.settled = false;
          } else {
            g.settled = true;
            settledCount++;
          }
        }
      }
      settledPct = (settledCount / grains.length) * 100;
    }

    // Metrics update (~8× per second)
    if (now - lastMetricsTimeRef.current > 120) {
      lastMetricsTimeRef.current = now;

      let activeFrac = 0.4;
      if (wasmExportsRef.current) {
        activeFrac = wasmExportsRef.current.computeActiveFractionWasm(
          40,
          effectiveM,
          effectiveN,
          effectiveK,
          cp.symmetryBlend,
          effectiveDrive,
          gridTypeNum,
          cp.centerVoidRadius,
          voidShapeNum,
          cp.centerExpulsion
        );
      } else {
        activeFrac = computeActiveFraction(
          effectiveM,
          effectiveN,
          effectiveK,
          cp.symmetryBlend,
          effectiveDrive,
          gridTypeNum,
          cp.centerVoidRadius,
          voidShapeNum,
          cp.centerExpulsion
        );
      }

      const { centerClearance, centerGrainCount } = computeCenterClearance(
        cpuParticlesRef.current,
        cp.centerVoidRadius,
        voidShapeNum
      );

      onMetricsUpdateRef.current({
        settledPercent: settledPct,
        activeFraction: activeFrac,
        centerClearance,
        centerGrainCount,
        activeEngine: cp.simulationEngine,
        computeTimeMs,
        fps: rollingFps,
        audio: audioMetrics,
      });
    }
  }

  // Update background plate shader uniforms
  if (backgroundMaterialRef.current) {
    const u = backgroundMaterialRef.current.uniforms;
    u.uModeM.value = effectiveM;
    u.uModeN.value = effectiveN;
    u.uWaveK.value = effectiveK;
    u.uBlend.value = cp.symmetryBlend;
    u.uFieldOverlay.value = cp.fieldOverlay;
    u.uNodalPronouncement.value = cp.nodalPronouncement ?? 1.0;
    u.uGridType.value = gridTypeToNumber(cp.gridType);
    u.uVoidRadius.value = cp.centerVoidRadius;
    u.uVoidShape.value = voidShapeToNumber(cp.centerVoidShape);
    u.uCenterExpulsion.value = cp.centerExpulsion;
    u.uShowVoidGuide.value = cp.showVoidGuide ? 1.0 : 0.0;
    u.uPlateColor.value.set(cp.plateColor);
    u.uNodeGlowColor.value.set(cp.glowColor);
    u.uCamData.value.copy(camDataRef.current);
  }

  // Update grain shader uniforms
  if (grainMaterialRef.current) {
    const u = grainMaterialRef.current.uniforms;
    u.uPosTex.value = simRef.current!.getPositionTexture();
    u.uModeM.value = effectiveM;
    u.uModeN.value = effectiveN;
    u.uWaveK.value = effectiveK;
    u.uBlend.value = cp.symmetryBlend;
    u.uGridType.value = gridTypeToNumber(cp.gridType);
    u.uVoidRadius.value = cp.centerVoidRadius;
    u.uVoidShape.value = voidShapeToNumber(cp.centerVoidShape);
    u.uCenterExpulsion.value = cp.centerExpulsion;
    u.uSandColorPrimary.value.set(cp.sandColor);
    u.uSandColorSecondary.value.set(cp.sandColorSecondary);
    u.uCamData.value.copy(camDataRef.current);
    if (u.uGrainSize) {
      u.uGrainSize.value = cp.grainSize ?? 1.0;
    }
    if (u.uNodalPronouncement) {
      u.uNodalPronouncement.value = cp.nodalPronouncement ?? 1.0;
    }
  }

  renderer.render(scene, camera);
}

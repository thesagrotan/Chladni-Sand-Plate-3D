import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import type { ChladniMetrics, ChladniParams } from '../types/chladni.ts';
import type { ChladniGpuSimulation } from './ChladniGpuSimulation.ts';
import type { ChladniWasmSimulation } from './ChladniWasmSimulation.ts';
import type { ChladniJsCpuSimulation } from './ChladniJsCpuSimulation.ts';
import type { TextMaskManager } from '../utils/TextMaskManager.ts';
import type { PaletteColors } from '../utils/paletteTransition.ts';
import type { ChladniWasmExports } from './wasm/chladniWasmModule.ts';
import { plateAudio } from './audioSynth.ts';
import { computeEffectiveWaveParams } from './audioReactive.ts';
import { computeTextMaskTransform } from './textMaskTransform.ts';
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
  /**
   * Colors currently being cross-faded. When present the renderer reads them
   * instead of the params, so theme changes can animate independently of the
   * (instantly updated) parameter values.
   */
  palette?: MutableRefObject<PaletteColors | null>;
}

export interface ChladniFrameState {
  lastTime: number;
  simTime: number;
  /** Cache key + value for the expensive active-fraction sample. */
  activeFracKey: string;
  activeFracValue: number;
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
    palette: paletteRef,
  } = deps;

  const now = performance.now();
  const delta = (now - state.lastTime) / 1000;
  state.lastTime = now;

  const cp = paramsRef.current;
  const palette = paletteRef?.current ?? null;
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

      let maskTransform: THREE.Matrix3 | undefined;
      let maskPush: THREE.Matrix3 | undefined;
      let maskViewport: THREE.Vector4 | undefined;
      if (tmm) {
        const transform = computeTextMaskTransform({
          camData: camDataRef.current,
          rotation: (cp.rotationAngle * Math.PI) / 180,
          flipH: cp.flipHorizontal,
          flipV: cp.flipVertical,
          scrollX: window.scrollX || 0,
          scrollY: window.scrollY || 0,
          viewportWidth: window.innerWidth || 1,
          viewportHeight: window.innerHeight || 1,
          docHeight: tmm.docHeight,
          maskWidth: tmm.canvasW,
          maskHeight: tmm.canvasH,
          maskScale: tmm.maskScale,
        });
        maskTransform = transform.worldToMask;
        maskPush = transform.push;
        maskViewport = transform.viewportUV;
      }

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
        pointerActiveRef.current && (cp.pointerForce ?? 1.0) > 0.001,
        cp.pointerRadius ?? 0.12,
        0.012 * (cp.pointerForce ?? 1.0),
        tmm ? tmm.texture : null,
        domActive,
        effectiveDomStrength,
        tmm ? tmm.canvasW : 1024,
        tmm ? tmm.canvasH : 1024,
        camDataRef.current,
        maskTransform,
        maskPush,
        maskViewport
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
      // Reused across every grain in the loop to avoid a fresh [x, y] tuple per eval.
      const gradScratch: [number, number] = [0, 0];

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
            cp.centerExpulsion,
            gradScratch
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

      // `computeActiveFraction` samples a 40×40 grid; the result only depends
      // on the wave/void parameters. Memoize it so an unchanged plate (and a
      // non-reactive drive) reuses the last sample instead of re-evaluating
      // ~1,600 points eight times a second.
      const activeFracKey = [
        effectiveM,
        effectiveN,
        effectiveK,
        cp.symmetryBlend,
        effectiveDrive,
        gridTypeNum,
        cp.centerVoidRadius,
        voidShapeNum,
        cp.centerExpulsion,
        wasmExportsRef.current ? 'w' : 'j',
      ].join('|');

      if (activeFracKey !== state.activeFracKey) {
        state.activeFracKey = activeFracKey;
        if (wasmExportsRef.current) {
          state.activeFracValue = wasmExportsRef.current.computeActiveFractionWasm(
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
          state.activeFracValue = computeActiveFraction(
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
      }
      const activeFrac = state.activeFracValue;

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
    u.uPlateColor.value.set(palette?.plateColor ?? cp.plateColor);
    u.uNodeGlowColor.value.set(palette?.glowColor ?? cp.glowColor);
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
    u.uSandColorPrimary.value.set(palette?.sandColor ?? cp.sandColor);
    u.uSandColorSecondary.value.set(
      palette?.sandColorSecondary ?? cp.sandColorSecondary
    );
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

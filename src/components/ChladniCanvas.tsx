import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ChladniParams, ChladniMetrics } from '../types/chladni.ts';
import {
  ChladniGpuSimulation,
  gpuTextureSizeForGrainCount,
} from '../simulation/ChladniGpuSimulation.ts';
import { ChladniWasmSimulation } from '../simulation/ChladniWasmSimulation.ts';
import { ChladniJsCpuSimulation } from '../simulation/ChladniJsCpuSimulation.ts';
import { TextMaskManager } from '../utils/TextMaskManager.ts';
import {
  BACKGROUND_VERTEX_SHADER,
  BACKGROUND_FRAGMENT_SHADER,
  GRAIN_VERTEX_SHADER,
  GRAIN_FRAGMENT_SHADER,
} from '../simulation/shaders/chladniShaders.ts';
import { getChladniWasm, ChladniWasmExports } from '../simulation/wasm/chladniWasmModule.ts';
import { plateAudio } from '../simulation/audioSynth.ts';
import { computeEffectiveWaveParams } from '../simulation/audioReactive.ts';
import {
  gridTypeToNumber,
  voidShapeToNumber,
  computeActiveFraction,
  computeCenterClearance,
  evalChladniW,
  evalChladniGrad,
} from '../simulation/chladniMath.ts';

/** Vertical half-range of the orthographic camera at zoom=1 */
const VRANGE = 1.05;

interface ChladniCanvasProps {
  params: ChladniParams;
  isPaused: boolean;
  onMetricsUpdate: (metrics: ChladniMetrics) => void;
  scatterTrigger: number;
  resetTrigger: number;
}

export const ChladniCanvas: React.FC<ChladniCanvasProps> = ({
  params,
  isPaused,
  onMetricsUpdate,
  scatterTrigger,
  resetTrigger,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ChladniGpuSimulation | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const backgroundMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const bgMeshRef = useRef<THREE.Mesh | null>(null);
  const grainMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const grainPointsRef = useRef<THREE.Points | null>(null);
  const frameIdRef = useRef<number>(0);

  // Zoom / pan state (2D)
  const zoomRef = useRef<number>(1.0);
  const panRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Pointer push state
  const pointerSimPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pointerActiveRef = useRef<boolean>(false);

  const paramsRef = useRef(params);
  paramsRef.current = params;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const onMetricsUpdateRef = useRef(onMetricsUpdate);
  onMetricsUpdateRef.current = onMetricsUpdate;

  const cpuParticlesRef = useRef<{ x: number; y: number; settled: boolean }[]>([]);
  const lastMetricsTimeRef = useRef<number>(0);
  const wasmSimRef = useRef<ChladniWasmSimulation | null>(null);
  const jsCpuSimRef = useRef<ChladniJsCpuSimulation | null>(null);
  const wasmExportsRef = useRef<ChladniWasmExports | null>(null);
  const frameTimestampsRef = useRef<number[]>([]);
  const textMaskManagerRef = useRef<TextMaskManager | null>(null);
  const camDataRef = useRef<THREE.Vector4>(new THREE.Vector4(0, 0, 1.05, 1.05));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Initialize TextMaskManager for exact text contour repulsion
    const initialDomRepulsion = params.domRepulsion !== undefined ? params.domRepulsion : 1.0;
    const textMask = new TextMaskManager({
      resolution: 1024,
      trackedSelector: '[data-text-repulsor]',
      strength: 0.024 * initialDomRepulsion,
    });
    textMask.active = initialDomRepulsion > 0.001;
    textMaskManagerRef.current = textMask;

    const scene = new THREE.Scene();
    // Transparent scene allows web page backdrop and DOM styling through
    scene.background = null;
    sceneRef.current = scene;

    // 2D orthographic camera — covers full viewport while preserving 1:1 aspect ratio
    const aspect = width / height;
    const baseRange = VRANGE;
    const halfW = aspect >= 1.0 ? baseRange * aspect : baseRange;
    const halfH = aspect >= 1.0 ? baseRange : baseRange / aspect;
    const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -1, 1);
    camera.position.set(0, 0, 1);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    camDataRef.current.set(0, 0, halfW, halfH);

    const pixelRatio = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2);
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x050507, 1);
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const cur = paramsRef.current;
    const plateCol = new THREE.Color(cur.plateColor);
    const glowCol = new THREE.Color(cur.glowColor);
    const sandPrimCol = new THREE.Color(cur.sandColor);
    const sandSecCol = new THREE.Color(cur.sandColorSecondary);

    // -----------------------------------------------------------------------
    // Background plate quad — covers full viewport behind all grains
    // -----------------------------------------------------------------------
    const bgGeo = new THREE.PlaneGeometry(1.0, 1.0);
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: BACKGROUND_VERTEX_SHADER,
      fragmentShader: BACKGROUND_FRAGMENT_SHADER,
      uniforms: {
        uFieldOverlay: { value: cur.fieldOverlay },
        uNodalPronouncement: { value: cur.nodalPronouncement ?? 1.0 },
        uModeM: { value: cur.modeM },
        uModeN: { value: cur.modeN },
        uWaveK: { value: cur.waveK },
        uBlend: { value: cur.symmetryBlend },
        uGridType: { value: gridTypeToNumber(cur.gridType) },
        uVoidRadius: { value: cur.centerVoidRadius },
        uVoidShape: { value: voidShapeToNumber(cur.centerVoidShape) },
        uCenterExpulsion: { value: cur.centerExpulsion },
        uShowVoidGuide: { value: cur.showVoidGuide ? 1.0 : 0.0 },
        uPlateColor: { value: plateCol },
        uNodeGlowColor: { value: glowCol },
        uCamData: { value: camDataRef.current },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    backgroundMaterialRef.current = bgMat;
    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.scale.set(halfW * 2.1, halfH * 2.1, 1);
    bgMesh.position.set(0, 0, 0);
    bgMesh.renderOrder = 0;
    scene.add(bgMesh);
    bgMeshRef.current = bgMesh;

    // -----------------------------------------------------------------------
    // GPU particle simulation
    // -----------------------------------------------------------------------
    const sim = new ChladniGpuSimulation(renderer, cur.grainCount, halfW, halfH);
    simRef.current = sim;

    const count = sim.grainCount;
    const grainGeo = new THREE.BufferGeometry();
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

    grainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    grainGeo.setAttribute('aTextureUv', new THREE.BufferAttribute(textureUvs, 2));

    const grainMat = new THREE.ShaderMaterial({
      vertexShader: GRAIN_VERTEX_SHADER,
      fragmentShader: GRAIN_FRAGMENT_SHADER,
      uniforms: {
        uPosTex: { value: sim.getPositionTexture() },
        uModeM: { value: cur.modeM },
        uModeN: { value: cur.modeN },
        uWaveK: { value: cur.waveK },
        uBlend: { value: cur.symmetryBlend },
        uPixelRatio: { value: pixelRatio },
        uGridType: { value: gridTypeToNumber(cur.gridType) },
        uVoidRadius: { value: cur.centerVoidRadius },
        uVoidShape: { value: voidShapeToNumber(cur.centerVoidShape) },
        uCenterExpulsion: { value: cur.centerExpulsion },
        uGrainCount: { value: count },
        uGrainSize: { value: cur.grainSize ?? 1.0 },
        uNodalPronouncement: { value: cur.nodalPronouncement ?? 1.0 },
        uUseCpuPositions: { value: 0.0 },
        uZoom: { value: 1.0 },
        uSandColorPrimary: { value: sandPrimCol },
        uSandColorSecondary: { value: sandSecCol },
        uCamData: { value: camDataRef.current },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.NormalBlending,
    });
    grainMaterialRef.current = grainMat;

    const grainPoints = new THREE.Points(grainGeo, grainMat);
    grainPoints.frustumCulled = false;
    grainPoints.renderOrder = 1;
    scene.add(grainPoints);
    grainPointsRef.current = grainPoints;

    // Apply initial flips/rotation (2D: scale.x/scale.y and rotation.z)
    grainPoints.scale.x = cur.flipHorizontal ? -1 : 1;
    grainPoints.scale.y = cur.flipVertical ? -1 : 1;
    grainPoints.rotation.z = (cur.rotationAngle * Math.PI) / 180;
    // Background mesh must keep its viewport-fill scale (halfW*2.1 × halfH*2.1);
    // flip is encoded as a sign on each axis rather than replacing the full scale.
    bgMesh.scale.set(
      halfW * 2.1 * (cur.flipHorizontal ? -1 : 1),
      halfH * 2.1 * (cur.flipVertical ? -1 : 1),
      1
    );
    bgMesh.rotation.z = (cur.rotationAngle * Math.PI) / 180;

    // CPU/WASM engines are constructed lazily when their engine is selected.

    // CPU telemetry grains (lightweight sample for metrics)
    const cpuGrains: { x: number; y: number; settled: boolean }[] = [];
    for (let i = 0; i < 1024; i++) {
      cpuGrains.push({
        x: (Math.random() * 2 - 1) * (halfW * 0.95),
        y: (Math.random() * 2 - 1) * (halfH * 0.95),
        settled: false,
      });
    }
    cpuParticlesRef.current = cpuGrains;

    // -----------------------------------------------------------------------
    // 2D Pan and Zoom interaction
    // -----------------------------------------------------------------------
    const updateCameraFrustum = () => {
      const cam = cameraRef.current;
      if (!cam) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const asp = w / h;
      const z = zoomRef.current;
      const px = panRef.current.x;
      const py = panRef.current.y;
      const baseRange = VRANGE / z;
      const halfW = asp >= 1.0 ? baseRange * asp : baseRange;
      const halfH = asp >= 1.0 ? baseRange : baseRange / asp;
      cam.left = -halfW + px;
      cam.right = halfW + px;
      cam.top = halfH + py;
      cam.bottom = -halfH + py;
      cam.updateProjectionMatrix();

      camDataRef.current.set(px, py, halfW, halfH);

      if (bgMeshRef.current) {
        bgMeshRef.current.scale.set(halfW * 2.1, halfH * 2.1, 1);
        bgMeshRef.current.position.set(px, py, 0);
      }

      if (grainMaterialRef.current) {
        grainMaterialRef.current.uniforms.uZoom.value = z;
      }
    };

    /** Convert a client-space pixel position to simulation XY space [-1,1] */
    const clientToSimSpace = (clientX: number, clientY: number): { x: number; y: number } => {
      const rect = container.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1);
      const cam = cameraRef.current;
      if (!cam) return { x: ndcX, y: ndcY };
      const halfW = (cam.right - cam.left) / 2;
      const halfH = (cam.top - cam.bottom) / 2;
      const cx = (cam.left + cam.right) / 2;
      const cy = (cam.bottom + cam.top) / 2;
      let sx = cx + ndcX * halfW;
      let sy = cy + ndcY * halfH;

      const cp = paramsRef.current;
      if (cp.rotationAngle !== 0) {
        const rad = -(cp.rotationAngle * Math.PI) / 180;
        const cosA = Math.cos(rad);
        const sinA = Math.sin(rad);
        const rx = sx * cosA - sy * sinA;
        const ry = sx * sinA + sy * cosA;
        sx = rx;
        sy = ry;
      }
      if (cp.flipHorizontal) sx = -sx;
      if (cp.flipVertical) sy = -sy;

      return { x: sx, y: sy };
    };

    // Keyboard navigation: + / - to zoom, arrow keys to change viewport position
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      const panStep = (e.shiftKey ? 0.16 : 0.06) * (VRANGE / zoomRef.current);

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        panRef.current.y += panStep;
        updateCameraFrustum();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        panRef.current.y -= panStep;
        updateCameraFrustum();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        panRef.current.x -= panStep;
        updateCameraFrustum();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        panRef.current.x += panStep;
        updateCameraFrustum();
      } else if (
        e.key === '+' ||
        e.key === '=' ||
        e.code === 'Equal' ||
        e.code === 'NumpadAdd'
      ) {
        e.preventDefault();
        const factor = e.shiftKey ? 1.25 : 1.12;
        zoomRef.current = Math.min(8.0, +(zoomRef.current * factor).toFixed(3));
        updateCameraFrustum();
      } else if (
        e.key === '-' ||
        e.key === '_' ||
        e.code === 'Minus' ||
        e.code === 'NumpadSubtract'
      ) {
        e.preventDefault();
        const factor = e.shiftKey ? 1.25 : 1.12;
        zoomRef.current = Math.max(0.4, +(zoomRef.current / factor).toFixed(3));
        updateCameraFrustum();
      }
    };

    // Canvas is fixed in the background: window-level pointer tracking pushes sand always on hover
    const onWindowPointerMove = (e: PointerEvent) => {
      const sp = clientToSimSpace(e.clientX, e.clientY);
      pointerSimPosRef.current = sp;
      pointerActiveRef.current = true;
    };

    const onWindowPointerDown = (e: PointerEvent) => {
      pointerActiveRef.current = true;
      const sp = clientToSimSpace(e.clientX, e.clientY);
      pointerSimPosRef.current = sp;
    };

    const onWindowPointerUp = (e: PointerEvent) => {
      // Touchscreen: lifting finger ends contact. Mouse: keeps affecting dots on hover.
      if (e.pointerType === 'touch') {
        pointerActiveRef.current = false;
      }
    };

    const onWindowMouseLeave = () => {
      pointerActiveRef.current = false;
    };

    const onWindowBlur = () => {
      pointerActiveRef.current = false;
    };

    window.addEventListener('pointermove', onWindowPointerMove, { passive: true });
    window.addEventListener('pointerdown', onWindowPointerDown, { passive: true });
    window.addEventListener('pointerup', onWindowPointerUp, { passive: true });
    document.addEventListener('mouseleave', onWindowMouseLeave);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('keydown', handleKeyDown);

    // -----------------------------------------------------------------------
    // Resize handler
    // -----------------------------------------------------------------------
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h);
      updateCameraFrustum();
      textMaskManagerRef.current?.setDirty();
    };
    window.addEventListener('resize', handleResize);

    // -----------------------------------------------------------------------
    // Animation loop
    // -----------------------------------------------------------------------
    let lastTime = performance.now();
    let simTime = 0;

    const animate = () => {
      const now = performance.now();
      const delta = (now - lastTime) / 1000;
      lastTime = now;

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
          ? Math.min(120, Math.max(10, +((1000 * (timestamps.length - 1)) / (now - timestamps[0])).toFixed(1)))
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
        simTime += delta;
        let computeTimeMs = 0;
        let settledPct = 0;

        if (cp.simulationEngine === 'wasm' && wasmSimRef.current && wasmSimRef.current.isReady) {
          const wres = wasmSimRef.current.update(
            simTime, delta,
            effectiveM, effectiveN, effectiveK,
            cp.symmetryBlend, effectiveDrive, gridTypeNum,
            cp.centerVoidRadius, voidShapeNum, cp.centerExpulsion
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
            simTime, delta,
            effectiveM, effectiveN, effectiveK,
            cp.symmetryBlend, effectiveDrive, gridTypeNum,
            cp.centerVoidRadius, voidShapeNum, cp.centerExpulsion
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
          const cam = cameraRef.current;
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
            simTime, delta,
            effectiveM, effectiveN, effectiveK,
            cp.symmetryBlend, effectiveDrive, gridTypeNum,
            cp.centerVoidRadius, voidShapeNum, cp.centerExpulsion,
            pointerSimPosRef.current.x, pointerSimPosRef.current.y,
            pointerActiveRef.current,
            0.12, 0.012,
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
            const w = evalChladniW(px, py, effectiveM, effectiveN, effectiveK, cp.symmetryBlend, gridTypeNum, cp.centerVoidRadius, voidShapeNum, cp.centerExpulsion);
            const accel = effectiveDrive * Math.abs(w);
            const rDist = voidShapeNum > 0.5 ? Math.max(Math.abs(px), Math.abs(py)) : Math.sqrt(px * px + py * py);

            if (accel > 1.0) {
              g.settled = false;
              const [gradX, gradY] = evalChladniGrad(px, py, effectiveM, effectiveN, effectiveK, cp.symmetryBlend, gridTypeNum, cp.centerVoidRadius, voidShapeNum, cp.centerExpulsion);
              const signW = w >= 0 ? 1 : -1;
              const kick = Math.sqrt(accel - 1.0);
              let dx = -signW * gradX * 0.00022 * effectiveDrive + (Math.random() - 0.5) * 0.0042 * kick;
              let dy = -signW * gradY * 0.00022 * effectiveDrive + (Math.random() - 0.5) * 0.0042 * kick;

              if (cp.centerVoidRadius > 0.01 && rDist < cp.centerVoidRadius) {
                const invR = rDist > 0.001 ? 1.0 / rDist : 0;
                const push = (1.0 - rDist / cp.centerVoidRadius) * (0.0035 * (1.0 + cp.centerExpulsion));
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
              40, effectiveM, effectiveN, effectiveK, cp.symmetryBlend, effectiveDrive,
              gridTypeNum, cp.centerVoidRadius, voidShapeNum, cp.centerExpulsion
            );
          } else {
            activeFrac = computeActiveFraction(
              effectiveM, effectiveN, effectiveK, cp.symmetryBlend, effectiveDrive,
              gridTypeNum, cp.centerVoidRadius, voidShapeNum, cp.centerExpulsion
            );
          }

          const { centerClearance, centerGrainCount } = computeCenterClearance(
            cpuParticlesRef.current, cp.centerVoidRadius, voidShapeNum
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
      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointermove', onWindowPointerMove);
      window.removeEventListener('pointerdown', onWindowPointerDown);
      window.removeEventListener('pointerup', onWindowPointerUp);
      document.removeEventListener('mouseleave', onWindowMouseLeave);
      window.removeEventListener('blur', onWindowBlur);
      textMaskManagerRef.current?.dispose();
      textMaskManagerRef.current = null;
      simRef.current?.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Scatter trigger
  useEffect(() => {
    if (scatterTrigger > 0) {
      const cam = camDataRef.current;
      simRef.current?.scatter(cam.z, cam.w);
      wasmSimRef.current?.resetParticles();
      jsCpuSimRef.current?.resetParticles(cam.z * 0.95, cam.w * 0.95);
      const grains = cpuParticlesRef.current;
      for (let i = 0; i < grains.length; i++) {
        grains[i].x = (Math.random() * 2 - 1) * (cam.z * 0.95);
        grains[i].y = (Math.random() * 2 - 1) * (cam.w * 0.95);
        grains[i].settled = false;
      }
    }
  }, [scatterTrigger]);

  // Reset trigger — also resets 2D zoom/pan
  useEffect(() => {
    if (resetTrigger > 0) {
      zoomRef.current = 1.0;
      panRef.current = { x: 0, y: 0 };
      const w = window.innerWidth;
      const h = window.innerHeight;
      const asp = w / h;
      const baseRange = VRANGE;
      const halfW = asp >= 1.0 ? baseRange * asp : baseRange;
      const halfH = asp >= 1.0 ? baseRange : baseRange / asp;
      camDataRef.current.set(0, 0, halfW, halfH);
      simRef.current?.scatter(halfW, halfH);
      wasmSimRef.current?.resetParticles();
      jsCpuSimRef.current?.resetParticles(halfW * 0.95, halfH * 0.95);
      const cam = cameraRef.current;
      if (cam) {
        cam.left = -halfW;
        cam.right = halfW;
        cam.top = halfH;
        cam.bottom = -halfH;
        cam.updateProjectionMatrix();
      }
      if (bgMeshRef.current) {
        bgMeshRef.current.scale.set(halfW * 2.1, halfH * 2.1, 1);
        bgMeshRef.current.position.set(0, 0, 0);
      }
      if (grainMaterialRef.current) {
        grainMaterialRef.current.uniforms.uZoom.value = 1.0;
      }
      const grains = cpuParticlesRef.current;
      for (let i = 0; i < grains.length; i++) {
        grains[i].x = (Math.random() * 2 - 1) * (halfW * 0.95);
        grains[i].y = (Math.random() * 2 - 1) * (halfH * 0.95);
        grains[i].settled = false;
      }
    }
  }, [resetTrigger]);

  // Grain count change — rebuild only when the GPU bucket or CPU counts change.
  const pendingGrainCount = useRef(params.grainCount);

  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current || !grainMaterialRef.current) return;

    pendingGrainCount.current = params.grainCount;
    const nextCount = params.grainCount;
    const nextGpuDim = gpuTextureSizeForGrainCount(nextCount);

    const currentSim = simRef.current;
    const gpuNeedsRebuild = !currentSim || currentSim.textureWidth !== nextGpuDim;
    if (!gpuNeedsRebuild) return;

    // Debounce slider drags; the last value in a 150 ms window wins.
    const timer = window.setTimeout(() => {
      if (pendingGrainCount.current !== nextCount) return;

      const renderer = rendererRef.current;
      const scene = sceneRef.current;
      const grainMat = grainMaterialRef.current;
      if (!renderer || !scene || !grainMat) return;

      if (grainPointsRef.current) {
        scene.remove(grainPointsRef.current);
        grainPointsRef.current.geometry.dispose();
        grainPointsRef.current = null;
      }

      simRef.current?.dispose();

      const cam = camDataRef.current;
      const newSim = new ChladniGpuSimulation(renderer, nextCount, cam.z, cam.w);
      simRef.current = newSim;

      const count = newSim.grainCount;
      const grainGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(count * 3);
      const textureUvs = new Float32Array(count * 2);

      for (let i = 0; i < count; i++) {
        const u = ((i % newSim.textureWidth) + 0.5) / newSim.textureWidth;
        const v = (Math.floor(i / newSim.textureWidth) + 0.5) / newSim.textureHeight;
        textureUvs[i * 2 + 0] = u;
        textureUvs[i * 2 + 1] = v;
      }

      grainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      grainGeo.setAttribute('aTextureUv', new THREE.BufferAttribute(textureUvs, 2));

      grainMat.uniforms.uPosTex.value = newSim.getPositionTexture();
      if (grainMat.uniforms.uGrainCount) {
        grainMat.uniforms.uGrainCount.value = count;
      }

      const grainPoints = new THREE.Points(grainGeo, grainMat);
      grainPoints.frustumCulled = false;
      grainPoints.renderOrder = 1;
      grainPoints.scale.x = params.flipHorizontal ? -1 : 1;
      grainPoints.scale.y = params.flipVertical ? -1 : 1;
      grainPoints.rotation.z = (params.rotationAngle * Math.PI) / 180;

      scene.add(grainPoints);
      grainPointsRef.current = grainPoints;
    }, 150);

    return () => window.clearTimeout(timer);
  }, [params.grainCount]);

  // Lazily construct the selected CPU engine; the default GPU path never
  // allocates CPU particle buffers or fetches the WASM binary.
  useEffect(() => {
    const engine = params.simulationEngine;
    if (engine === 'gpu') return;

    const cpuCount = Math.min(params.grainCount, 35_000);
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) return;

      if (engine === 'wasm') {
        if (!wasmSimRef.current || wasmSimRef.current.grainCount !== cpuCount) {
          wasmSimRef.current?.dispose();
          wasmSimRef.current = new ChladniWasmSimulation(cpuCount);
        }
        getChladniWasm().then((wasm) => {
          if (!cancelled) wasmExportsRef.current = wasm;
        });
      } else if (
        !jsCpuSimRef.current ||
        jsCpuSimRef.current.grainCount !== cpuCount
      ) {
        jsCpuSimRef.current = new ChladniJsCpuSimulation(cpuCount);
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [params.simulationEngine, params.grainCount]);

  // DOM elements rejection force & typography change — refresh text mask
  useEffect(() => {
    if ((params.domRepulsion ?? 1.0) > 0.001) {
      textMaskManagerRef.current?.setDirty();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
          textMaskManagerRef.current?.setDirty();
        });
      }
    }
  }, [
    params.domRepulsion,
    params.fontFamily,
    params.fontWeight,
    params.fontItalic,
    params.fontSpacingAxis,
    params.fontElshAxis,
    params.fontLetterSpacing,
  ]);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 w-full h-full pointer-events-none select-none z-0 overflow-hidden"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
      }}
    />
  );
};


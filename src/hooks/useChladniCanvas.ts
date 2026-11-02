import { useEffect, useRef, useState } from 'react';
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
  createGrainGeometry,
  createGrainPoints,
  createTelemetryGrains,
  scatterEngines,
  rebuildGpuEngine,
  ensureSelectedCpuEngine,
  type EngineRefs,
} from '../simulation/EngineManager.ts';
import { useCameraControls, VRANGE } from './useCameraControls.ts';
import {
  renderChladniFrame,
  type ChladniFrameDeps,
  type ChladniFrameState,
} from '../simulation/renderChladniFrame.ts';
import {
  BACKGROUND_VERTEX_SHADER,
  BACKGROUND_FRAGMENT_SHADER,
  GRAIN_VERTEX_SHADER,
  GRAIN_FRAGMENT_SHADER,
} from '../simulation/shaders/chladniShaders.ts';
import type { ChladniWasmExports } from '../simulation/wasm/chladniWasmModule.ts';
import { gridTypeToNumber, voidShapeToNumber } from '../simulation/chladniMath.ts';

export interface UseChladniCanvasOptions {
  params: ChladniParams;
  isPaused: boolean;
  onMetricsUpdate: (metrics: ChladniMetrics) => void;
  scatterTrigger: number;
  resetTrigger: number;
}

/**
 * Owns the WebGL scene graph, simulation engines, camera controls, and the
 * animation loop for the Chladni canvas. Returns the mount ref the component
 * attaches to its container element.
 */
export function useChladniCanvas({
  params,
  isPaused,
  onMetricsUpdate,
  scatterTrigger,
  resetTrigger,
}: UseChladniCanvasOptions) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglStatus, setWebglStatus] = useState<'pending' | 'available' | 'unavailable'>('pending');
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

  // Stable refs bag consumed by the engine helpers; the refs themselves never
  // change identity, so building this once per render is cheap.
  const engineRefs: EngineRefs = {
    sim: simRef,
    wasmSim: wasmSimRef,
    jsCpuSim: jsCpuSimRef,
    wasmExports: wasmExportsRef,
    cpuParticles: cpuParticlesRef,
    grainPoints: grainPointsRef,
    grainMaterial: grainMaterialRef,
    camData: camDataRef,
  };

  useCameraControls({
    container: mountRef,
    camera: cameraRef,
    camData: camDataRef,
    bgMesh: bgMeshRef,
    grainMaterial: grainMaterialRef,
    zoom: zoomRef,
    pan: panRef,
    pointerSimPos: pointerSimPosRef,
    pointerActive: pointerActiveRef,
    params: paramsRef,
    renderer: rendererRef,
    textMask: textMaskManagerRef,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const probe = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return { available: false, software: false };
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return {
          available: true,
          software: /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu),
        };
      } catch {
        return { available: false, software: false };
      }
    })();
    const isSoftwareGl = probe.software;

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

    if (!probe.available) {
      // No WebGL2 means the simulation cannot run. Keep the DOM site usable
      // instead of letting the renderer constructor take down the app.
      textMask.dispose();
      textMaskManagerRef.current = null;
      setWebglStatus('unavailable');
      return;
    }

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
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: true,
      });
    } catch (error) {
      console.warn('[ChladniCanvas] WebGL renderer unavailable; using the static fallback.', error);
      textMask.dispose();
      textMaskManagerRef.current = null;
      setWebglStatus('unavailable');
      return;
    }
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
    setWebglStatus('available');

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
    const grainGeo = createGrainGeometry(sim);

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

    // Grain points apply the initial flip/rotation transforms on construction.
    const grainPoints = createGrainPoints(grainGeo, grainMat, cur);
    scene.add(grainPoints);
    grainPointsRef.current = grainPoints;

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
    cpuParticlesRef.current = createTelemetryGrains(halfW, halfH);

    // -----------------------------------------------------------------------
    // Animation loop
    // -----------------------------------------------------------------------
    const frameDeps: ChladniFrameDeps = {
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
    };
    const frameState: ChladniFrameState = {
      lastTime: performance.now(),
      simTime: 0,
      activeFracKey: '',
      activeFracValue: 0.4,
    };

    const animate = () => {
      renderChladniFrame(frameDeps, frameState);
      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameIdRef.current);
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
      scatterEngines(engineRefs, cam.z, cam.w);
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
      scatterEngines(engineRefs, halfW, halfH);
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
      if (!renderer || !scene) return;

      rebuildGpuEngine(engineRefs, renderer, scene, nextCount, params);
    }, 150);

    return () => window.clearTimeout(timer);
  }, [params.grainCount]);

  // Lazily construct the selected CPU engine; the default GPU path never
  // allocates CPU particle buffers or fetches the WASM binary.
  useEffect(() => {
    const engine = params.simulationEngine;
    if (engine === 'gpu') return;

    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) return;

      const pendingWasm = ensureSelectedCpuEngine(engineRefs, engine, params.grainCount);
      if (pendingWasm) {
        pendingWasm.then((wasm) => {
          if (!cancelled) wasmExportsRef.current = wasm;
        });
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
      if (document.fonts && document.fonts.load) {
        // Request only the exact face currently in use, then re-rasterize once it
        // arrives. Relying on document.fonts.ready can resolve before the new
        // weight/style is queued and leave the mask on a fallback face.
        const style = params.fontItalic ? 'italic ' : '';
        const fontSpec = `${style}${params.fontWeight} 24px "${params.fontFamily}"`;
        document.fonts
          .load(fontSpec)
          .then(() => textMaskManagerRef.current?.setDirty())
          .catch(() => {});
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

  return { mountRef, webglStatus };
}

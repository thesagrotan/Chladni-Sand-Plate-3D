import { describe, expect, it } from 'vitest';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import {
  CPU_GRAIN_CAP,
  ensureSelectedCpuEngine,
  type EngineRefs,
} from '../src/simulation/EngineManager.ts';
import { gpuTextureSizeForGrainCount } from '../src/simulation/ChladniGpuSimulation.ts';
import { ChladniJsCpuSimulation } from '../src/simulation/ChladniJsCpuSimulation.ts';
import { ChladniWasmSimulation } from '../src/simulation/ChladniWasmSimulation.ts';
import type { ChladniGpuSimulation } from '../src/simulation/ChladniGpuSimulation.ts';
import type { ChladniWasmExports } from '../src/simulation/wasm/chladniWasmModule.ts';
import type { CpuParticle } from '../src/simulation/renderChladniFrame.ts';

function ref<T>(value: T): MutableRefObject<T> {
  return { current: value };
}

function createEngineRefs(): EngineRefs {
  return {
    sim: ref<ChladniGpuSimulation | null>(null),
    wasmSim: ref<ChladniWasmSimulation | null>(null),
    jsCpuSim: ref<ChladniJsCpuSimulation | null>(null),
    wasmExports: ref<ChladniWasmExports | null>(null),
    cpuParticles: ref<CpuParticle[]>([]),
    grainPoints: ref<THREE.Points | null>(null),
    grainMaterial: ref<THREE.ShaderMaterial | null>(null),
    camData: ref(new THREE.Vector4()),
  };
}

describe('grain-count texture buckets', () => {
  it('treats 15% of the default grain count as the first bucket boundary', () => {
    // The default plate holds 50k grains; 7,500 of those (15%) is the edge of
    // the smallest GPU texture bucket. Crossing it must request a rebuild.
    expect(gpuTextureSizeForGrainCount(7_499)).toBe(72);
    expect(gpuTextureSizeForGrainCount(7_500)).toBe(72);
    expect(gpuTextureSizeForGrainCount(7_501)).toBe(100);
  });

  it('keeps the 35k CPU cap inside a single GPU bucket', () => {
    expect(gpuTextureSizeForGrainCount(CPU_GRAIN_CAP - 1)).toBe(160);
    expect(gpuTextureSizeForGrainCount(CPU_GRAIN_CAP)).toBe(160);
    expect(gpuTextureSizeForGrainCount(CPU_GRAIN_CAP + 1)).toBe(224);
  });
});

describe('ensureSelectedCpuEngine', () => {
  it('does not allocate CPU engines for the default GPU path', () => {
    const refs = createEngineRefs();
    const pending = ensureSelectedCpuEngine(refs, 'gpu', 50_000);

    expect(pending).toBeNull();
    expect(refs.wasmSim.current).toBeNull();
    expect(refs.jsCpuSim.current).toBeNull();
  });

  it('caps the WASM engine at the CPU grain cap', async () => {
    const refs = createEngineRefs();
    const pending = ensureSelectedCpuEngine(refs, 'wasm', 250_000);

    expect(refs.wasmSim.current?.grainCount).toBe(CPU_GRAIN_CAP);
    expect(pending).not.toBeNull();

    const wasm = await pending!;
    expect(typeof wasm.evalChladniW).toBe('function');
    await refs.wasmSim.current?.waitReady();
    expect(refs.wasmSim.current?.isReady).toBe(true);
  });

  it('caps the JS CPU engine at the CPU grain cap', () => {
    const refs = createEngineRefs();
    ensureSelectedCpuEngine(refs, 'js_cpu', 250_000);

    expect(refs.jsCpuSim.current?.grainCount).toBe(CPU_GRAIN_CAP);
  });

  it('reuses the active engine when the grain count is unchanged', () => {
    const refs = createEngineRefs();
    ensureSelectedCpuEngine(refs, 'js_cpu', 20_000);
    const first = refs.jsCpuSim.current;

    ensureSelectedCpuEngine(refs, 'js_cpu', 20_000);

    expect(refs.jsCpuSim.current).toBe(first);
  });

  it('rebuilds the JS CPU engine when the grain count changes', () => {
    const refs = createEngineRefs();
    ensureSelectedCpuEngine(refs, 'js_cpu', 20_000);
    const first = refs.jsCpuSim.current;

    ensureSelectedCpuEngine(refs, 'js_cpu', 20_001);

    expect(refs.jsCpuSim.current).not.toBe(first);
    expect(refs.jsCpuSim.current?.grainCount).toBe(20_001);
  });

  it('does not rebuild the JS CPU engine for counts that clamp to the same cap', () => {
    const refs = createEngineRefs();
    ensureSelectedCpuEngine(refs, 'js_cpu', 200_000);
    const first = refs.jsCpuSim.current;

    ensureSelectedCpuEngine(refs, 'js_cpu', 300_000);

    expect(refs.jsCpuSim.current).toBe(first);
    expect(refs.jsCpuSim.current?.grainCount).toBe(CPU_GRAIN_CAP);
  });

  it('rebuilds the WASM engine when the capped grain count changes', async () => {
    const refs = createEngineRefs();
    const firstPending = ensureSelectedCpuEngine(refs, 'wasm', 10_000);
    const first = refs.wasmSim.current;
    await firstPending;
    await first?.waitReady();

    ensureSelectedCpuEngine(refs, 'wasm', 12_000);

    expect(refs.wasmSim.current).not.toBe(first);
    expect(refs.wasmSim.current?.grainCount).toBe(12_000);
    await refs.wasmSim.current?.waitReady();
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { MutableRefObject } from 'react';
import * as THREE from 'three';
import { scatterEngines, type EngineRefs } from '../src/simulation/EngineManager.ts';
import type { ChladniGpuSimulation } from '../src/simulation/ChladniGpuSimulation.ts';
import type { ChladniWasmSimulation } from '../src/simulation/ChladniWasmSimulation.ts';
import type { ChladniJsCpuSimulation } from '../src/simulation/ChladniJsCpuSimulation.ts';
import type { CpuParticle } from '../src/simulation/renderChladniFrame.ts';
import type { ChladniWasmExports } from '../src/simulation/wasm/chladniWasmModule.ts';

function ref<T>(value: T): MutableRefObject<T> {
  return { current: value };
}

function createRefs(cpuParticles: CpuParticle[]): EngineRefs {
  return {
    sim: ref<ChladniGpuSimulation | null>(null),
    wasmSim: ref<ChladniWasmSimulation | null>(null),
    jsCpuSim: ref<ChladniJsCpuSimulation | null>(null),
    wasmExports: ref<ChladniWasmExports | null>(null),
    cpuParticles: ref(cpuParticles),
    grainPoints: ref<THREE.Points | null>(null),
    grainMaterial: ref<THREE.ShaderMaterial | null>(null),
    camData: ref(new THREE.Vector4()),
  };
}

describe('scatterEngines', () => {
  it('resets every active engine and re-randomizes telemetry grains', () => {
    const gpuScatter = vi.fn();
    const wasmReset = vi.fn();
    const jsReset = vi.fn();
    const cpuParticles: CpuParticle[] = [
      { x: 0, y: 0, settled: true },
      { x: 0.5, y: -0.5, settled: true },
      { x: -0.9, y: 0.9, settled: true },
    ];

    const refs = createRefs(cpuParticles);
    refs.sim.current = { scatter: gpuScatter } as unknown as ChladniGpuSimulation;
    refs.wasmSim.current = { resetParticles: wasmReset } as unknown as ChladniWasmSimulation;
    refs.jsCpuSim.current = { resetParticles: jsReset } as unknown as ChladniJsCpuSimulation;

    scatterEngines(refs, 2, 1);

    expect(gpuScatter).toHaveBeenCalledWith(2, 1);
    expect(wasmReset).toHaveBeenCalledTimes(1);
    expect(jsReset).toHaveBeenCalledWith(1.9, 0.95);

    for (const grain of cpuParticles) {
      expect(grain.settled).toBe(false);
      expect(Math.abs(grain.x)).toBeLessThanOrEqual(2 * 0.95);
      expect(Math.abs(grain.y)).toBeLessThanOrEqual(1 * 0.95);
    }
  });

  it('tolerates a partially constructed engine set', () => {
    const refs = createRefs([{ x: 0, y: 0, settled: true }]);

    expect(() => scatterEngines(refs, 2, 1)).not.toThrow();
    expect(refs.cpuParticles.current[0].settled).toBe(false);
  });
});

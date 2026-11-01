import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from '../src/types/chladni.ts';
import {
  gridTypeToNumber,
  voidShapeToNumber,
} from '../src/simulation/chladniMath.ts';
import { ChladniJsCpuSimulation } from '../src/simulation/ChladniJsCpuSimulation.ts';
import { ChladniWasmSimulation } from '../src/simulation/ChladniWasmSimulation.ts';

const STEP_ARGS = [
  DEFAULT_PARAMS.modeM,
  DEFAULT_PARAMS.modeN,
  DEFAULT_PARAMS.waveK,
  DEFAULT_PARAMS.symmetryBlend,
  DEFAULT_PARAMS.driveStrength,
  gridTypeToNumber(DEFAULT_PARAMS.gridType),
  DEFAULT_PARAMS.centerVoidRadius,
  voidShapeToNumber(DEFAULT_PARAMS.centerVoidShape),
  DEFAULT_PARAMS.centerExpulsion,
] as const;

function assertNoNaN(values: Float32Array) {
  for (let i = 0; i < values.length; i++) {
    expect(Number.isFinite(values[i])).toBe(true);
  }
}

describe('ChladniWasmSimulation', () => {
  it('initializes, steps and produces finite particle positions', async () => {
    const engine = new ChladniWasmSimulation(2_000);
    await engine.waitReady();

    expect(engine.isReady).toBe(true);

    const first = engine.update(0.016, 0.016, ...STEP_ARGS);
    expect(first.settledCount).toBeGreaterThanOrEqual(0);
    expect(first.settledCount).toBeLessThanOrEqual(engine.grainCount);
    expect(Number.isFinite(first.computeTimeMs)).toBe(true);

    engine.update(0.032, 0.016, ...STEP_ARGS);

    const positions = engine.getRawMemoryView();
    expect(positions).not.toBeNull();

    const xy = new Float32Array(engine.grainCount * 2);
    for (let i = 0; i < engine.grainCount; i++) {
      xy[i * 2] = positions![i * 4];
      xy[i * 2 + 1] = positions![i * 4 + 1];
    }
    assertNoNaN(xy);
  });

  it('caps the grain count at 50k', () => {
    const engine = new ChladniWasmSimulation(100_000);
    expect(engine.grainCount).toBe(50_000);
  });
});

describe('ChladniJsCpuSimulation', () => {
  it('initializes, steps and produces finite particle positions', () => {
    const engine = new ChladniJsCpuSimulation(2_000);

    const first = engine.update(0.016, 0.016, ...STEP_ARGS);
    expect(first.settledCount).toBeGreaterThanOrEqual(0);
    expect(first.settledCount).toBeLessThanOrEqual(engine.grainCount);
    expect(Number.isFinite(first.computeTimeMs)).toBe(true);

    engine.update(0.032, 0.016, ...STEP_ARGS);
    assertNoNaN(engine.positions);
  });

  it('caps the grain count at 50k', () => {
    const engine = new ChladniJsCpuSimulation(100_000);
    expect(engine.grainCount).toBe(50_000);
  });
});

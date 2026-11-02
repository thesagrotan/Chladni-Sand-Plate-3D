import { describe, expect, it } from 'vitest';
import {
  computeActiveFraction,
  computeCenterClearance,
  evalChladniGrad,
  gridTypeToNumber,
  voidShapeToNumber,
} from '../src/simulation/chladniMath.ts';
import { DEFAULT_PARAMS } from '../src/types/chladni.ts';

describe('computeCenterClearance', () => {
  it('reports a fully clear center when there is no void', () => {
    expect(computeCenterClearance([{ x: 0, y: 0 }], 0, 0)).toEqual({
      centerClearance: 100,
      centerGrainCount: 0,
    });
  });

  it('reports a fully clear center when there are no grains', () => {
    expect(computeCenterClearance([], 0.3, 0)).toEqual({
      centerClearance: 100,
      centerGrainCount: 0,
    });
  });

  it('counts grains inside a circular void and returns zero clearance when packed', () => {
    const grains = Array.from({ length: 100 }, () => ({ x: 0.05, y: 0.05 }));
    const result = computeCenterClearance(grains, 0.3, 0);

    expect(result.centerGrainCount).toBe(100);
    expect(result.centerClearance).toBe(0);
  });

  it('uses the square metric when voidShape is square', () => {
    const diagonalGrains = [
      { x: 0.25, y: 0.25 },
      { x: -0.25, y: 0.25 },
    ];

    expect(computeCenterClearance(diagonalGrains, 0.3, 0).centerGrainCount).toBe(0);
    expect(computeCenterClearance(diagonalGrains, 0.3, 1).centerGrainCount).toBe(2);
  });

  it('reports zero grains inside when every grain sits outside the void', () => {
    const grains = Array.from({ length: 50 }, (_, i) => ({
      x: 0.8 + (i % 2) * 0.05,
      y: -0.8,
    }));

    expect(computeCenterClearance(grains, 0.3, 0)).toEqual({
      centerClearance: 100,
      centerGrainCount: 0,
    });
  });
});

describe('computeActiveFraction', () => {
  it('is zero with no drive and one with overwhelming drive', () => {
    expect(computeActiveFraction(4, 8, 32, 0.72, 0)).toBe(0);
    expect(computeActiveFraction(4, 8, 32, 0.72, 1e6)).toBe(1);
  });

  it('increases monotonically with drive strength', () => {
    const values = [0.5, 1, 2, 3, 4, 6].map((drive) =>
      computeActiveFraction(4, 8, 32, 0.72, drive)
    );

    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    }
  });

  it('stays within [0, 1] for the default parameters', () => {
    const fraction = computeActiveFraction(
      DEFAULT_PARAMS.modeM,
      DEFAULT_PARAMS.modeN,
      DEFAULT_PARAMS.waveK,
      DEFAULT_PARAMS.symmetryBlend,
      DEFAULT_PARAMS.driveStrength,
      gridTypeToNumber(DEFAULT_PARAMS.gridType),
      DEFAULT_PARAMS.centerVoidRadius,
      voidShapeToNumber(DEFAULT_PARAMS.centerVoidShape),
      DEFAULT_PARAMS.centerExpulsion
    );

    expect(fraction).toBeGreaterThanOrEqual(0);
    expect(fraction).toBeLessThanOrEqual(1);
  });
});

describe('evalChladniGrad scratch output', () => {
  it('writes into the provided array and returns that same instance', () => {
    const scratch: [number, number] = [NaN, NaN];
    const result = evalChladniGrad(0.2, -0.1, 4, 8, 32, 0.72, 0, 0, 0, 0, scratch);

    expect(result).toBe(scratch);
    expect(Number.isFinite(scratch[0])).toBe(true);
    expect(Number.isFinite(scratch[1])).toBe(true);
  });

  it('matches the allocating form', () => {
    const expected = evalChladniGrad(0.35, 0.15, 5, 7, 28, 0.4, 2, 0.25, 1, 1.5);
    const scratch: [number, number] = [0, 0];
    evalChladniGrad(0.35, 0.15, 5, 7, 28, 0.4, 2, 0.25, 1, 1.5, scratch);

    expect(scratch).toEqual(expected);
  });

  it('overwrites stale values from a previous call', () => {
    const scratch: [number, number] = [123, 456];
    evalChladniGrad(0, 0, 4, 8, 32, 0.72, 0, 0, 0, 0, scratch);

    expect(scratch[0]).not.toBe(123);
    expect(scratch[1]).not.toBe(456);
  });
});

import { beforeAll, describe, expect, it } from 'vitest';
import { computeActiveFraction, evalChladniGrad, evalChladniW } from '../../src/simulation/chladniMath.ts';
import { getChladniWasm, type ChladniWasmExports } from '../../src/simulation/wasm/chladniWasmModule.ts';

const GRID_TYPES = [0, 1, 2, 3, 4, 5];
const VOID_SHAPES = [0, 1];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('JS vs WASM wave math parity', () => {
  let wasm: ChladniWasmExports;

  beforeAll(async () => {
    wasm = await getChladniWasm();
  });

  it('computes evalChladniW within float32 tolerance across every grid and void shape', () => {
    const rand = mulberry32(0x9c74ea47);
    let maxDiff = 0;

    for (const gridType of GRID_TYPES) {
      for (const voidShape of VOID_SHAPES) {
        for (let i = 0; i < 200; i++) {
          const x = rand() * 2 - 1;
          const y = rand() * 2 - 1;
          const m = 2 + Math.floor(rand() * 8);
          const n = 2 + Math.floor(rand() * 8);
          const k = 20 + rand() * 25;
          const blend = rand() * 1.2;
          const voidRadius = rand() < 0.5 ? 0 : 0.1 + rand() * 0.4;
          const centerExpulsion = rand() * 4;

          const js = evalChladniW(x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
          const binary = wasm.evalChladniW(x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);

          maxDiff = Math.max(maxDiff, Math.abs(js - binary));
        }
      }
    }

    expect(maxDiff).toBeLessThan(1e-5);
  });

  it('computes evalChladniGrad within float32 tolerance across every grid and void shape', () => {
    const rand = mulberry32(0x4badc0de);
    let maxDiff = 0;

    for (const gridType of GRID_TYPES) {
      for (const voidShape of VOID_SHAPES) {
        for (let i = 0; i < 200; i++) {
          const x = rand() * 2 - 1;
          const y = rand() * 2 - 1;
          const m = 2 + Math.floor(rand() * 8);
          const n = 2 + Math.floor(rand() * 8);
          const k = 20 + rand() * 25;
          const blend = rand() * 1.2;
          const voidRadius = rand() < 0.5 ? 0 : 0.1 + rand() * 0.4;
          const centerExpulsion = rand() * 4;

          const [jsX, jsY] = evalChladniGrad(
            x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion
          );
          const binaryX = wasm.evalChladniGradX(
            x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion
          );
          const binaryY = wasm.evalChladniGradY(
            x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion
          );

          maxDiff = Math.max(maxDiff, Math.abs(jsX - binaryX), Math.abs(jsY - binaryY));
        }
      }
    }

    expect(maxDiff).toBeLessThan(0.01);
  });

  it('computes the active fraction within sampling tolerance', () => {
    const rand = mulberry32(0x0a11ce);
    let maxDiff = 0;

    for (const gridType of GRID_TYPES) {
      for (const voidShape of VOID_SHAPES) {
        for (let i = 0; i < 10; i++) {
          const m = 2 + Math.floor(rand() * 8);
          const n = 2 + Math.floor(rand() * 8);
          const k = 20 + rand() * 25;
          const blend = rand() * 1.2;
          const driveStrength = 1 + rand() * 5;
          const voidRadius = rand() < 0.5 ? 0 : 0.1 + rand() * 0.4;
          const centerExpulsion = rand() * 4;

          const js = computeActiveFraction(
            m, n, k, blend, driveStrength, gridType, voidRadius, voidShape, centerExpulsion
          );
          const binary = wasm.computeActiveFractionWasm(
            40, m, n, k, blend, driveStrength, gridType, voidRadius, voidShape, centerExpulsion
          );

          maxDiff = Math.max(maxDiff, Math.abs(js - binary));
        }
      }
    }

    expect(maxDiff).toBeLessThan(0.02);
  });
});

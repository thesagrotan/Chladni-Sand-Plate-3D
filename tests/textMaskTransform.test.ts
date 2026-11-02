import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  computeTextMaskTransform,
  maskPushMatrix,
  worldToMaskUV,
  type TextMaskTransformInput,
} from '../src/simulation/textMaskTransform.ts';

interface Vec2 {
  x: number;
  y: number;
}

/** The pre-atlas shader formula, kept as the reference implementation. */
function legacyScreenUV(
  px: number,
  py: number,
  cam: { x: number; y: number; z: number; w: number },
  rotation: number,
  flipH: boolean,
  flipV: boolean
): Vec2 {
  let x = flipH ? -px : px;
  let y = flipV ? -py : py;
  const c = Math.cos(rotation);
  const s = Math.sin(rotation);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  return {
    x: (0.5 * (rx - cam.x)) / Math.max(cam.z, 0.001) + 0.5,
    y: (0.5 * (ry - cam.y)) / Math.max(cam.w, 0.001) + 0.5,
  };
}

/** The pre-atlas push formula, kept as the reference implementation. */
function legacyPush(
  dir: Vec2,
  cam: { z: number; w: number },
  rotation: number,
  flipH: boolean,
  flipV: boolean
): Vec2 {
  const sx = dir.x * cam.z;
  const sy = dir.y * cam.w;
  const c = Math.cos(-rotation);
  const s = Math.sin(-rotation);
  const rx = sx * c - sy * s;
  const ry = sx * s + sy * c;
  return { x: flipH ? -rx : rx, y: flipV ? -ry : ry };
}

function applyMat3(m: THREE.Matrix3, v: Vec2): Vec2 {
  const e = m.elements;
  return {
    x: e[0] * v.x + e[3] * v.y + e[6],
    y: e[1] * v.x + e[4] * v.y + e[7],
  };
}

function makeInput(overrides: Partial<TextMaskTransformInput> = {}): TextMaskTransformInput {
  return {
    camData: new THREE.Vector4(0, 0, 1.05, 1.05),
    rotation: 0,
    flipH: false,
    flipV: false,
    scrollX: 0,
    scrollY: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    docHeight: 900,
    maskWidth: 1440,
    maskHeight: 900,
    maskScale: 1,
    ...overrides,
  };
}

const CAMS = [
  new THREE.Vector4(0, 0, 1.05, 1.05),
  new THREE.Vector4(0.3, -0.2, 1.6, 1.1),
  new THREE.Vector4(-0.5, 0.4, 2.2, 1.4),
];
const ROTATIONS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 0.37];
const FLIPS: Array<[boolean, boolean]> = [
  [false, false],
  [true, false],
  [false, true],
  [true, true],
];

describe('text mask transform parity', () => {
  it('matches the legacy screen-UV formula when the atlas is viewport-sized', () => {
    for (const cam of CAMS) {
      for (const rotation of ROTATIONS) {
        for (const [flipH, flipV] of FLIPS) {
          const input = makeInput({
            camData: cam,
            rotation,
            flipH,
            flipV,
            docHeight: 900,
            maskWidth: 1440,
            maskHeight: 900,
            maskScale: 1,
          });
          const matrix = worldToMaskUV(input);
          for (const [px, py] of [
            [0, 0],
            [0.4, -0.7],
            [-1.2, 0.9],
            [1.8, 1.5],
          ]) {
            const legacy = legacyScreenUV(px, py, { x: cam.x, y: cam.y, z: cam.z, w: cam.w }, rotation, flipH, flipV);
            const actual = applyMat3(matrix, { x: px, y: py });
            expect(actual.x).toBeCloseTo(legacy.x, 10);
            expect(actual.y).toBeCloseTo(legacy.y, 10);
          }
        }
      }
    }
  });

  it('maps world positions into document UV at arbitrary scroll and document height', () => {
    const vw = 390;
    const vh = 844;
    const docHeight = 5200;
    const maskScale = 0.9;
    const maskWidth = Math.round(vw * maskScale);
    const maskHeight = Math.ceil(docHeight * maskScale);
    const cam = new THREE.Vector4(0.1, -0.15, 1.4, 1.9);
    const rotation = 0.42;

    for (const scrollY of [0, 733, 4011]) {
      for (const scrollX of [0, 17]) {
        for (const [flipH, flipV] of FLIPS) {
          const input = makeInput({
            camData: cam,
            rotation,
            flipH,
            flipV,
            scrollX,
            scrollY,
            viewportWidth: vw,
            viewportHeight: vh,
            docHeight,
            maskWidth,
            maskHeight,
            maskScale,
          });
          const matrix = worldToMaskUV(input);
          for (const [px, py] of [
            [0, 0],
            [0.7, 0.3],
            [-1.1, -0.8],
          ]) {
            const screen = legacyScreenUV(px, py, { x: cam.x, y: cam.y, z: cam.z, w: cam.w }, rotation, flipH, flipV);
            const expected = {
              x: ((screen.x * vw + scrollX) * maskScale) / maskWidth,
              y: 1 - ((1 - screen.y) * vh + scrollY) * (maskScale / maskHeight),
            };
            const actual = applyMat3(matrix, { x: px, y: py });
            expect(actual.x).toBeCloseTo(expected.x, 10);
            expect(actual.y).toBeCloseTo(expected.y, 10);
          }
        }
      }
    }
  });

  it('matches the legacy push formula for arbitrary directions', () => {
    for (const cam of CAMS) {
      for (const rotation of ROTATIONS) {
        for (const [flipH, flipV] of FLIPS) {
          const input = makeInput({ camData: cam, rotation, flipH, flipV });
          const matrix = maskPushMatrix(input);
          for (const dir of [
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -0.6, y: 0.8 },
            { x: 0.35, y: -0.94 },
          ]) {
            const legacy = legacyPush(dir, { z: cam.z, w: cam.w }, rotation, flipH, flipV);
            const actual = applyMat3(matrix, dir);
            expect(actual.x).toBeCloseTo(legacy.x, 10);
            expect(actual.y).toBeCloseTo(legacy.y, 10);
          }
        }
      }
    }
  });

  it('reports a transform for the viewport-sized and atlas cases', () => {
    const atlas = computeTextMaskTransform(
      makeInput({ viewportWidth: 390, viewportHeight: 844, docHeight: 5200, maskScale: 0.97 })
    );
    expect(atlas.worldToMask.elements.every((v) => Number.isFinite(v))).toBe(true);
    expect(atlas.push.elements.every((v) => Number.isFinite(v))).toBe(true);
  });
});

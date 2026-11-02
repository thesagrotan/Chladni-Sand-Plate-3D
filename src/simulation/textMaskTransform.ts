import * as THREE from 'three';

export interface TextMaskTransformInput {
  /** Camera data as (cx, cy, halfW, halfH). */
  camData: THREE.Vector4 | { x: number; y: number; z: number; w: number };
  /** Camera rotation in radians. */
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  /** Document height in CSS pixels (the atlas covers the whole document). */
  docHeight: number;
  /** Mask atlas dimensions in pixels. */
  maskWidth: number;
  maskHeight: number;
  /** Mask pixels per CSS pixel (atlas width / viewport width, before rounding). */
  maskScale: number;
}

export interface TextMaskTransform {
  /** world position → mask texture UV (v up, matching flipY). */
  worldToMask: THREE.Matrix3;
  /**
   * Linear part for the repulsion push: screen-UV direction → world direction.
   * Mirrors the historical order `flip ∘ rotate(-a) ∘ scale(halfW, halfH)`.
   */
  push: THREE.Matrix3;
  /** Multiplier for the vertical gradient when the atlas is taller than the viewport. */
  vScale: number;
}

function readCam(cam: TextMaskTransformInput['camData']) {
  return {
    x: cam.x,
    y: cam.y,
    z: cam.z,
    w: cam.w,
  };
}

/**
 * Maps a particle world position to the document-space mask texture UV.
 *
 * The historical shader did:
 *   worldP = flip(pos.xy)
 *   worldP = rotate(worldP, rotation)
 *   screenUV = (worldP - cam.xy) / cam.zw * 0.5 + 0.5
 * The atlas adds the screen→document mapping:
 *   u = screenUV.x + scrollX / viewportWidth
 *   v = screenUV.y * (viewportHeight / docHeight) + 1 - vh/docHeight - scrollY/docHeight
 */
export function worldToMaskUV(input: TextMaskTransformInput): THREE.Matrix3 {
  const { z, w } = readCam(input.camData);
  const cam = readCam(input.camData);
  const cos = Math.cos(input.rotation);
  const sin = Math.sin(input.rotation);
  const fh = input.flipH ? -1 : 1;
  const fv = input.flipV ? -1 : 1;

  // S = 0.5 * diag(1/z, 1/w) * R(a) * F
  const sx0 = (0.5 * cos * fh) / Math.max(z, 0.001);
  const sx1 = (-0.5 * sin * fv) / Math.max(z, 0.001);
  const sy0 = (0.5 * sin * fh) / Math.max(w, 0.001);
  const sy1 = (0.5 * cos * fv) / Math.max(w, 0.001);

  const vh = input.viewportHeight || 1;
  const vw = input.viewportWidth || 1;
  const docH = Math.max(input.docHeight || vh, vh);
  const maskScale = input.maskScale || 1;
  const maskW = Math.max(1, input.maskWidth);
  const maskH = Math.max(1, input.maskHeight);
  const uScale = (vw * maskScale) / maskW;
  const vScale = (vh * maskScale) / maskH;

  // A = diag(uScale, vScale); b = (scrollX*scale/maskW, 1 - vScale - scrollY*scale/maskH)
  const l00 = sx0 * uScale;
  const l01 = sx1 * uScale;
  const l10 = sy0 * vScale;
  const l11 = sy1 * vScale;

  const tScreenX = 0.5 - cam.x / (2 * Math.max(z, 0.001));
  const tScreenY = 0.5 - cam.y / (2 * Math.max(w, 0.001));
  const tx = tScreenX * uScale + (input.scrollX * maskScale) / maskW;
  const ty =
    tScreenY * vScale + 1 - vScale - (input.scrollY * maskScale) / maskH;

  // THREE.Matrix3 is column-major: [m11, m21, m31, m12, m22, m32, m13, m23, m33]
  return new THREE.Matrix3().set(l00, l01, tx, l10, l11, ty, 0, 0, 1);
}

/**
 * Linear push transform. The historical shader did:
 *   pushWorld = flip(rotate(-a, pushScreen * (halfW, halfH)))
 * which is `F * R(-a) * diag(z, w)`. The atlas gradient is converted back to
 * screen space (via `vScale`) before this matrix is applied.
 */
export function maskPushMatrix(input: TextMaskTransformInput): THREE.Matrix3 {
  const { z, w } = readCam(input.camData);
  const c = Math.cos(input.rotation);
  const s = Math.sin(input.rotation);
  const fh = input.flipH ? -1 : 1;
  const fv = input.flipV ? -1 : 1;

  // F * R(-a) * diag(z, w)
  const m00 = fh * c * z;
  const m01 = fh * s * w;
  const m10 = -fv * s * z;
  const m11 = fv * c * w;

  return new THREE.Matrix3().set(m00, m01, 0, m10, m11, 0, 0, 0, 1);
}

export function computeTextMaskTransform(input: TextMaskTransformInput): TextMaskTransform {
  const vh = input.viewportHeight || 1;
  const maskScale = input.maskScale || 1;
  return {
    worldToMask: worldToMaskUV(input),
    push: maskPushMatrix(input),
    vScale: (vh * maskScale) / Math.max(1, input.maskHeight),
  };
}

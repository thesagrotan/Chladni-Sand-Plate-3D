import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import * as THREE from 'three';
import { computeTextMaskTransform } from '../../src/simulation/textMaskTransform.ts';

/**
 * Renders the text-mask repulsion block twice into an RGBA32F framebuffer:
 *
 *   legacy — viewport-sized mask, per-particle flip/rotate/camera math and
 *            `1.8 / viewportSize` gradient taps (the pre-atlas shader);
 *   atlas  — document-space mask, precomputed mat3 transforms and
 *            `1.8 / documentSize` taps (the current shader).
 *
 * Both write the resulting world-space push vector for one particle per pixel.
 * Equal output means the atlas + transform refactor preserved the repulsion
 * behaviour exactly, including the gradient tap distance.
 */

const ATLAS_W = 256;
const ATLAS_H = 1024;
const VIEW_W = 256;
const VIEW_H = 512;
const DOC_W = 400;
const DOC_H = 1600;
const MASK_SCALE = ATLAS_W / DOC_W;
const SCROLL_Y = 400;
const VIEW_CSS_H = VIEW_H / MASK_SCALE; // 800
const PARTICLE_GRID = 40;

const LEGACY_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uMask;
uniform vec2 uMaskRes;
uniform vec4 uCamData;
uniform float uRotAngle;
uniform float uFlipH;
uniform float uFlipV;
uniform vec2 uParticleMin;
uniform vec2 uParticleSpan;
uniform float uGrid;

vec2 hash2(vec2 p) {
  return fract(sin(vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  )) * 43758.5453123);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 pos = uParticleMin + (cell / uGrid) * uParticleSpan;

  vec2 worldP = pos;
  if (uFlipH > 0.5) worldP.x = -worldP.x;
  if (uFlipV > 0.5) worldP.y = -worldP.y;
  if (abs(uRotAngle) > 0.0001) {
    float cosA = cos(uRotAngle);
    float sinA = sin(uRotAngle);
    worldP = vec2(worldP.x * cosA - worldP.y * sinA, worldP.x * sinA + worldP.y * cosA);
  }

  vec2 ndc;
  ndc.x = (worldP.x - uCamData.x) / max(uCamData.z, 0.001);
  ndc.y = (worldP.y - uCamData.y) / max(uCamData.w, 0.001);
  vec2 screenUV = ndc * 0.5 + 0.5;

  vec2 push = vec2(0.0);
  float density = 0.0;
  if (screenUV.x >= 0.0 && screenUV.x <= 1.0 && screenUV.y >= 0.0 && screenUV.y <= 1.0) {
    density = texture(uMask, screenUV).r;
    if (density > 0.005) {
      float eps = 1.8 / uMaskRes.x;
      float epsY = 1.8 / uMaskRes.y;
      float gx = texture(uMask, screenUV + vec2(eps, 0.0)).r - texture(uMask, screenUV - vec2(eps, 0.0)).r;
      float gy = texture(uMask, screenUV + vec2(0.0, epsY)).r - texture(uMask, screenUV - vec2(0.0, epsY)).r;
      vec2 gradScreen = vec2(gx, gy);
      float gLen = length(gradScreen);

      if (gLen < 0.004) {
        float epsWide = 6.0 / uMaskRes.x;
        float epsWideY = 6.0 / uMaskRes.y;
        float gx2 = texture(uMask, screenUV + vec2(epsWide, 0.0)).r - texture(uMask, screenUV - vec2(epsWide, 0.0)).r;
        float gy2 = texture(uMask, screenUV + vec2(0.0, epsWideY)).r - texture(uMask, screenUV - vec2(0.0, epsWideY)).r;
        gradScreen = vec2(gx2, gy2);
        gLen = length(gradScreen);
      }

      vec2 pushScreen;
      if (gLen > 0.001) {
        pushScreen = -normalize(gradScreen);
      } else {
        vec2 rndW = hash2(pos.xy * 89.1 + vec2(0.0));
        pushScreen = normalize(rndW + vec2(0.001));
      }

      vec2 pushWorld = vec2(pushScreen.x * uCamData.z, pushScreen.y * uCamData.w);
      if (abs(uRotAngle) > 0.0001) {
        float cosA = cos(-uRotAngle);
        float sinA = sin(-uRotAngle);
        pushWorld = vec2(pushWorld.x * cosA - pushWorld.y * sinA, pushWorld.x * sinA + pushWorld.y * cosA);
      }
      if (uFlipH > 0.5) pushWorld.x = -pushWorld.x;
      if (uFlipV > 0.5) pushWorld.y = -pushWorld.y;

      float pushMag = clamp(density * 1.6, 0.08, 1.0) * 0.022;
      push = pushWorld * pushMag;
    }
  }

  fragColor = vec4(push, density, 1.0);
}
`;

const ATLAS_FRAGMENT = /* glsl */ `#version 300 es
precision highp float;
out vec4 fragColor;
uniform sampler2D uMask;
uniform vec2 uMaskRes;
uniform mat3 uMaskTransform;
uniform mat3 uMaskPush;
uniform vec4 uMaskViewport;
uniform vec2 uParticleMin;
uniform vec2 uParticleSpan;
uniform float uGrid;

vec2 hash2(vec2 p) {
  return fract(sin(vec2(
    dot(p, vec2(127.1, 311.7)),
    dot(p, vec2(269.5, 183.3))
  )) * 43758.5453123);
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 pos = uParticleMin + (cell / uGrid) * uParticleSpan;

  vec2 maskUV = (uMaskTransform * vec3(pos.xy, 1.0)).xy;

  vec2 push = vec2(0.0);
  float density = 0.0;
  if (
    maskUV.x >= uMaskViewport.x && maskUV.x <= uMaskViewport.z &&
    maskUV.y >= uMaskViewport.y && maskUV.y <= uMaskViewport.w
  ) {
    density = texture(uMask, maskUV).r;
    if (density > 0.005) {
      float eps = 1.8 / uMaskRes.x;
      float epsY = 1.8 / uMaskRes.y;
      float gx = texture(uMask, maskUV + vec2(eps, 0.0)).r - texture(uMask, maskUV - vec2(eps, 0.0)).r;
      float gy = texture(uMask, maskUV + vec2(0.0, epsY)).r - texture(uMask, maskUV - vec2(0.0, epsY)).r;
      vec2 gradScreen = vec2(gx, gy);
      float gLen = length(gradScreen);

      if (gLen < 0.004) {
        float epsWide = 6.0 / uMaskRes.x;
        float epsWideY = 6.0 / uMaskRes.y;
        float gx2 = texture(uMask, maskUV + vec2(epsWide, 0.0)).r - texture(uMask, maskUV - vec2(epsWide, 0.0)).r;
        float gy2 = texture(uMask, maskUV + vec2(0.0, epsWideY)).r - texture(uMask, maskUV - vec2(0.0, epsWideY)).r;
        gradScreen = vec2(gx2, gy2);
        gLen = length(gradScreen);
      }

      vec2 pushScreen;
      if (gLen > 0.001) {
        pushScreen = -normalize(gradScreen);
      } else {
        vec2 rndW = hash2(pos.xy * 89.1 + vec2(0.0));
        pushScreen = normalize(rndW + vec2(0.001));
      }

      vec2 pushWorld = (uMaskPush * vec3(pushScreen, 0.0)).xy;

      float pushMag = clamp(density * 1.6, 0.08, 1.0) * 0.022;
      push = pushWorld * pushMag;
    }
  }

  fragColor = vec4(push, density, 1.0);
}
`;

/**
 * Deterministic glyph-like mask in document space.
 *
 * Rows are stored in "v-up" order (row 0 = v 0 = document bottom) so the raw
 * WebGL upload matches three.js CanvasTexture flipY=true without relying on
 * UNPACK_FLIP_Y_WEBGL (which is ignored for ArrayBufferView sources).
 */
function buildAtlas(): Uint8Array {
  const topDown = new Uint8Array(ATLAS_W * ATLAS_H);
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  // Horizontal bands of vertical strokes, plus a box blur to mimic the soft
  // halo the real blurred fillText produces.
  const bands = 9;
  for (let b = 0; b < bands; b++) {
    const top = Math.floor(((b + 0.4) / bands) * ATLAS_H);
    const height = Math.floor(ATLAS_H / bands / 3);
    let x = 12;
    while (x < ATLAS_W - 12) {
      const w = 3 + Math.floor(rand() * 7);
      for (let y = top; y < Math.min(ATLAS_H, top + height); y++) {
        for (let dx = 0; dx < w; dx++) {
          const idx = y * ATLAS_W + x + dx;
          if (idx < topDown.length) topDown[idx] = Math.min(255, topDown[idx] + 200);
        }
      }
      x += w + 4 + Math.floor(rand() * 6);
    }
  }

  const blurred = new Uint8Array(topDown.length);
  const radius = 2;
  for (let y = 0; y < ATLAS_H; y++) {
    for (let x = 0; x < ATLAS_W; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= ATLAS_H) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= ATLAS_W) continue;
          sum += topDown[yy * ATLAS_W + xx];
          count++;
        }
      }
      blurred[y * ATLAS_W + x] = Math.round(sum / count);
    }
  }

  // Flip to v-up order.
  const out = new Uint8Array(blurred.length);
  for (let y = 0; y < ATLAS_H; y++) {
    out.set(
      blurred.subarray((ATLAS_H - 1 - y) * ATLAS_W, (ATLAS_H - y) * ATLAS_W),
      y * ATLAS_W
    );
  }
  return out;
}

/**
 * The visible viewport as the pre-atlas shader saw it: v 0 = bottom of the
 * viewport (document y = scrollY + viewportHeight).
 */
function buildViewportTexture(atlas: Uint8Array): Uint8Array {
  const data = new Uint8Array(VIEW_W * VIEW_H);
  // Exact texel mapping: viewport v-up row r is atlas v-up row offset + r
  // because both cover the same CSS-pixel scale.
  const offset = Math.round(SCROLL_Y * MASK_SCALE);
  for (let r = 0; r < VIEW_H; r++) {
    const atlasRow = offset + r;
    if (atlasRow >= ATLAS_H) continue;
    data.set(atlas.subarray(atlasRow * ATLAS_W, atlasRow * ATLAS_W + VIEW_W), r * VIEW_W);
  }
  return data;
}

interface PushResult {
  push: number[];
  density: number[];
}

/**
 * One WebGL context for the whole test: the two mask textures are uploaded
 * once and each case only re-links its program and sets uniforms.
 */
async function setupGl(
  page: Page,
  atlas: Uint8Array,
  viewport: Uint8Array
): Promise<void> {
  await page.evaluate(
    ({ atlasData, viewportData, atlasSize, viewportSize, grid }) => {
      const canvas = document.createElement('canvas');
      canvas.width = grid;
      canvas.height = grid;
      const gl = canvas.getContext('webgl2', {
        antialias: false,
        preserveDrawingBuffer: true,
      });
      if (!gl) throw new Error('WebGL2 unavailable');
      if (!gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('EXT_color_buffer_float unavailable');
      }

      const uploadMask = (data: number[], width: number, height: number, unit: number) => {
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.R8,
          width,
          height,
          0,
          gl.RED,
          gl.UNSIGNED_BYTE,
          new Uint8Array(data)
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return tex;
      };
      const atlasTex = uploadMask(atlasData, atlasSize[0], atlasSize[1], 0);
      const viewportTex = uploadMask(viewportData, viewportSize[0], viewportSize[1], 1);

      const target = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, grid, grid, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('float framebuffer incomplete');
      }
      gl.viewport(0, 0, grid, grid);

      (window as unknown as { __maskParityGl: unknown }).__maskParityGl = {
        gl,
        grid,
        atlasTex,
        viewportTex,
      };
    },
    {
      atlasData: Array.from(atlas),
      viewportData: Array.from(viewport),
      atlasSize: [ATLAS_W, ATLAS_H],
      viewportSize: [VIEW_W, VIEW_H],
      grid: PARTICLE_GRID,
    }
  );
}

async function render(
  page: Page,
  fragment: string,
  uniforms: Record<string, unknown>,
  maskUnit: 0 | 1
): Promise<PushResult> {
  return page.evaluate(
    ({ fragmentSource, uniformData, maskUnit: unit }) => {
      const { gl, grid, atlasTex, viewportTex } = (
        window as unknown as {
          __maskParityGl: {
            gl: WebGL2RenderingContext;
            grid: number;
            atlasTex: WebGLTexture;
            viewportTex: WebGLTexture;
          };
        }
      ).__maskParityGl;

      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(shader) ?? 'shader compile failed');
        }
        return shader;
      };

      const program = gl.createProgram()!;
      gl.attachShader(
        program,
        compile(
          gl.VERTEX_SHADER,
          `#version 300 es
void main() {
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`
        )
      );
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'link failed');
      }
      gl.useProgram(program);

      const loc = (name: string) => gl.getUniformLocation(program, name);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, unit === 0 ? atlasTex : viewportTex);
      gl.uniform1i(loc('uMask'), 0);

      const setVec2 = (name: string, v: number[]) => {
        const l = loc(name);
        if (l) gl.uniform2f(l, v[0], v[1]);
      };
      const setFloat = (name: string, v: number) => {
        const l = loc(name);
        if (l) gl.uniform1f(l, v);
      };
      const setVec4 = (name: string, v: number[]) => {
        const l = loc(name);
        if (l) gl.uniform4f(l, v[0], v[1], v[2], v[3]);
      };
      const setMat3 = (name: string, v: number[]) => {
        const l = loc(name);
        if (l) gl.uniformMatrix3fv(l, false, v);
      };

      setVec4('uCamData', uniformData.camData as number[]);
      setFloat('uRotAngle', uniformData.rotation as number);
      setFloat('uFlipH', uniformData.flipH as number);
      setFloat('uFlipV', uniformData.flipV as number);
      setVec2('uMaskRes', uniformData.maskRes as number[]);
      setMat3('uMaskTransform', uniformData.transform as number[]);
      setMat3('uMaskPush', uniformData.push as number[]);
      setVec4('uMaskViewport', uniformData.viewport as number[]);
      setVec2('uParticleMin', uniformData.particleMin as number[]);
      setVec2('uParticleSpan', uniformData.particleSpan as number[]);
      setFloat('uGrid', grid);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const out = new Float32Array(grid * grid * 4);
      gl.readPixels(0, 0, grid, grid, gl.RGBA, gl.FLOAT, out);
      const push: number[] = [];
      const density: number[] = [];
      for (let i = 0; i < grid * grid; i++) {
        push.push(out[i * 4], out[i * 4 + 1]);
        density.push(out[i * 4 + 2]);
      }
      gl.deleteProgram(program);
      return { push, density };
    },
    { fragmentSource: fragment, uniformData: uniforms, maskUnit }
  );
}

describe('text mask push parity (rendered)', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'],
    });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it('matches the pre-atlas shader across camera, rotation, flip and scroll', async () => {
    const atlas = buildAtlas();
    const viewport = buildViewportTexture(atlas);
    await setupGl(page, atlas, viewport);

    const camData = new THREE.Vector4(0.12, -0.08, 1.6, 1.6);
    const rotations = [0, Math.PI / 2, 0.37];
    const flips: Array<[boolean, boolean]> = [
      [false, false],
      [true, false],
      [false, true],
      [true, true],
    ];

    let compared = 0;
    let nonzero = 0;

    for (const rotation of rotations) {
      for (const [flipH, flipV] of flips) {
        const transform = computeTextMaskTransform({
          camData,
          rotation,
          flipH,
          flipV,
          scrollX: 0,
          scrollY: SCROLL_Y,
          viewportWidth: DOC_W,
          viewportHeight: VIEW_CSS_H,
          docHeight: DOC_H,
          maskWidth: ATLAS_W,
          maskHeight: ATLAS_H,
          maskScale: MASK_SCALE,
        });

        // Particles stay inside the camera bounds, exactly like the clamped
        // simulation positions (outside that range the legacy shader saw no
        // mask at all).
        const halfW = camData.z * 0.98;
        const halfH = camData.w * 0.98;
        const particleMin = [camData.x - halfW, camData.y - halfH];
        const particleSpan = [halfW * 2, halfH * 2];

        const uniformData = {
          camData: [camData.x, camData.y, camData.z, camData.w],
          rotation,
          flipH: flipH ? 1 : 0,
          flipV: flipV ? 1 : 0,
          transform: transform.worldToMask.elements,
          push: transform.push.elements,
          viewport: transform.viewportUV.toArray(),
          particleMin,
          particleSpan,
        };

        // Sequential: both renders share one GL context/framebuffer.
        const legacy = await render(
          page,
          LEGACY_FRAGMENT,
          { ...uniformData, maskRes: [VIEW_W, VIEW_H] },
          1
        );
        const current = await render(
          page,
          ATLAS_FRAGMENT,
          { ...uniformData, maskRes: [ATLAS_W, ATLAS_H] },
          0
        );

        for (let i = 0; i < legacy.push.length; i += 2) {
          compared++;
          const lx = legacy.push[i];
          const ly = legacy.push[i + 1];
          const cx = current.push[i];
          const cy = current.push[i + 1];
          // Both shaders sample the same blurred document image through
          // different UV paths; allow float/linear-filter rounding only.
          expect(Math.abs(lx - cx)).toBeLessThan(2e-4);
          expect(Math.abs(ly - cy)).toBeLessThan(2e-4);
          if (Math.abs(lx) + Math.abs(ly) > 1e-6) nonzero++;
        }
      }
    }

    // Guard against a vacuous pass (e.g. the mask never being sampled).
    expect(compared).toBeGreaterThan(1000);
    expect(nonzero / compared).toBeGreaterThan(0.05);
  }, 60_000);
});

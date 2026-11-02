import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { CHLADNI_GLSL_FUNCTIONS, evalChladniGrad, evalChladniW } from '../../src/simulation/chladniMath.ts';

const SAMPLE_GRID = 32;

interface ParityCase {
  label: string;
  gridType: number;
  voidShape: number;
  voidRadius: number;
  centerExpulsion: number;
}

interface GlslSample {
  w: number[];
  gx: number[];
  gy: number[];
}

const CASES: ParityCase[] = [];
for (const gridType of [0, 1, 2, 3, 4, 5]) {
  for (const voidShape of [0, 1]) {
    for (const voidRadius of [0, 0.28]) {
      CASES.push({
        label: `grid ${gridType} / ${voidShape === 0 ? 'circle' : 'square'} / void ${voidRadius}`,
        gridType,
        voidShape,
        voidRadius,
        centerExpulsion: 2.5,
      });
    }
  }
}

/**
 * Renders `CHLADNI_GLSL_FUNCTIONS` into an RGBA32F offscreen framebuffer, one
 * sample per pixel, and reads the wave value + finite-difference gradient back.
 * This is the only way to compare the shader source against the JS reference:
 * the shader is a string and never runs in Node.
 */
async function renderGlslSamples(page: Page, params: ParityCase): Promise<GlslSample> {
  return page.evaluate(
    ({ fragmentSource, gridSize, params: p }) => {
      const canvas = document.createElement('canvas');
      canvas.width = gridSize;
      canvas.height = gridSize;
      const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
      if (!gl) throw new Error('WebGL2 is unavailable');
      if (!gl.getExtension('EXT_color_buffer_float')) {
        throw new Error('EXT_color_buffer_float is unavailable');
      }

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
        throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
      }
      gl.useProgram(program);

      const uniforms: Record<string, WebGLUniformLocation | null> = {};
      for (const name of [
        'uGridSize',
        'uM',
        'uN',
        'uK',
        'uBlend',
        'uGridType',
        'uVoidRadius',
        'uVoidShape',
        'uCenterExpulsion',
      ]) {
        uniforms[name] = gl.getUniformLocation(program, name);
      }

      gl.uniform1f(uniforms.uGridSize!, gridSize);
      gl.uniform1f(uniforms.uM!, 4.0);
      gl.uniform1f(uniforms.uN!, 8.0);
      gl.uniform1f(uniforms.uK!, 30.0);
      gl.uniform1f(uniforms.uBlend!, 0.65);
      gl.uniform1f(uniforms.uGridType!, p.gridType);
      gl.uniform1f(uniforms.uVoidRadius!, p.voidRadius);
      gl.uniform1f(uniforms.uVoidShape!, p.voidShape);
      gl.uniform1f(uniforms.uCenterExpulsion!, p.centerExpulsion);

      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, gridSize, gridSize, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('float framebuffer is incomplete');
      }

      gl.viewport(0, 0, gridSize, gridSize);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const pixels = new Float32Array(gridSize * gridSize * 4);
      gl.readPixels(0, 0, gridSize, gridSize, gl.RGBA, gl.FLOAT, pixels);

      const w: number[] = [];
      const gx: number[] = [];
      const gy: number[] = [];
      for (let i = 0; i < gridSize * gridSize; i++) {
        w.push(pixels[i * 4]);
        gx.push(pixels[i * 4 + 1]);
        gy.push(pixels[i * 4 + 2]);
      }

      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
      return { w, gx, gy };
    },
    {
      fragmentSource: `#version 300 es
precision highp float;
uniform float uGridSize;
uniform float uM;
uniform float uN;
uniform float uK;
uniform float uBlend;
uniform float uGridType;
uniform float uVoidRadius;
uniform float uVoidShape;
uniform float uCenterExpulsion;
out vec4 outColor;

${CHLADNI_GLSL_FUNCTIONS}

void main() {
  vec2 p = (gl_FragCoord.xy / uGridSize) * 2.0 - 1.0;
  float w = computeChladniW(p, uM, uN, uK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
  vec2 grad = computeChladniGrad(p, uM, uN, uK, uBlend, uGridType, uVoidRadius, uVoidShape, uCenterExpulsion);
  outColor = vec4(w, grad, 1.0);
}`,
      gridSize: SAMPLE_GRID,
      params,
    }
  );
}

describe('GLSL vs JS wave math parity', () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader'],
    });
    page = await browser.newPage();
    await page.setContent('<!doctype html><html><body></body></html>');
  }, 30_000);

  afterAll(async () => {
    await browser?.close();
  });

  it(
    'renders computeChladniW and computeChladniGrad within float32 tolerance for every grid and void shape',
    async () => {
      let maxWaveDiff = 0;
      let maxGradDiff = 0;
      let worstCase = '';

      for (const parityCase of CASES) {
        const glsl = await renderGlslSamples(page, parityCase);

        for (let row = 0; row < SAMPLE_GRID; row++) {
          for (let col = 0; col < SAMPLE_GRID; col++) {
            const index = row * SAMPLE_GRID + col;
            const x = ((col + 0.5) / SAMPLE_GRID) * 2 - 1;
            const y = ((row + 0.5) / SAMPLE_GRID) * 2 - 1;

            const jsW = evalChladniW(
              x,
              y,
              4.0,
              8.0,
              30.0,
              0.65,
              parityCase.gridType,
              parityCase.voidRadius,
              parityCase.voidShape,
              parityCase.centerExpulsion
            );
            const [jsGx, jsGy] = evalChladniGrad(
              x,
              y,
              4.0,
              8.0,
              30.0,
              0.65,
              parityCase.gridType,
              parityCase.voidRadius,
              parityCase.voidShape,
              parityCase.centerExpulsion
            );

            const waveDiff = Math.abs(jsW - glsl.w[index]);
            const gradDiff = Math.max(Math.abs(jsGx - glsl.gx[index]), Math.abs(jsGy - glsl.gy[index]));
            if (waveDiff > maxWaveDiff || gradDiff > maxGradDiff) {
              worstCase = `${parityCase.label} at (${x.toFixed(3)}, ${y.toFixed(3)})`;
            }
            maxWaveDiff = Math.max(maxWaveDiff, waveDiff);
            maxGradDiff = Math.max(maxGradDiff, gradDiff);
          }
        }
      }

      expect(maxWaveDiff, `worst wave sample: ${worstCase} (max ${maxWaveDiff})`).toBeLessThan(1e-3);
      expect(maxGradDiff, `worst gradient sample: ${worstCase} (max ${maxGradDiff})`).toBeLessThan(0.03);
    },
    120_000
  );
});

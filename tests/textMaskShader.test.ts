import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Guards the text-mask section of the GPU position shader. The math itself is
 * covered by `textMaskTransform.test.ts`; this file pins the shader's use of
 * the precomputed transform (no per-particle trig/flip branches) and the
 * screen-space gradient tap distance.
 */
const source = readFileSync(
  path.join(process.cwd(), 'src/simulation/ChladniGpuSimulation.ts'),
  'utf8'
);

const shader = source.slice(
  source.indexOf('const POSITION_FRAGMENT_SHADER'),
  source.indexOf('export function gpuTextureSizeForGrainCount')
);

describe('text mask shader', () => {
  it('uses the precomputed transform instead of per-particle trig and flips', () => {
    expect(shader).toContain('uniform mat3  uMaskTransform');
    expect(shader).toContain('uniform mat3  uMaskPush');
    expect(shader).toContain('uMaskTransform * vec3(pos.xy, 1.0)');
    expect(shader).toContain('uMaskPush * vec3(pushScreen, 0.0)');

    expect(shader).not.toContain('uRotAngle');
    expect(shader).not.toContain('uFlipH');
    expect(shader).not.toContain('uFlipV');

    // No trig may remain in the mask-push block (the hash helpers and the
    // Chladni wave keep theirs).
    const maskBlock = shader.slice(
      shader.indexOf('// Exact text silhouette repulsion'),
      shader.indexOf('// Contain sand particles')
    );
    expect(maskBlock.length).toBeGreaterThan(200);
    expect(maskBlock).not.toMatch(/\bcos\(/);
    expect(maskBlock).not.toMatch(/\bsin\(/);
  });

  it('keeps the gradient taps at 1.8 / 6 mask texels', () => {
    // The atlas keeps the viewport canvas's texels-per-CSS-pixel scale, so
    // texel taps are the same CSS distance as before. Taps must not use the
    // document extent.
    expect(shader).toContain('float eps = 1.8 / uTextMaskRes.x;');
    expect(shader).toContain('float epsY = 1.8 / uTextMaskRes.y;');
    expect(shader).toContain('float epsWide = 6.0 / uTextMaskRes.x;');
    expect(shader).toContain('float epsWideY = 6.0 / uTextMaskRes.y;');
  });

  it('keeps the density threshold, retry, and push magnitude unchanged', () => {
    expect(shader).toContain('density > 0.005');
    expect(shader).toContain('gLen < 0.004');
    expect(shader).toContain('gLen > 0.001');
    expect(shader).toContain('clamp(density * 1.6, 0.08, 1.0) * uTextMaskStrength');
  });
});

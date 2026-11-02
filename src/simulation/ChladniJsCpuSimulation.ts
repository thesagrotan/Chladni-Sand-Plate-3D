import * as THREE from 'three';
import { evalChladniW, evalChladniGrad } from './chladniMath.ts';

/**
 * Pure JavaScript CPU particle simulation engine for benchmarking against WebAssembly.
 * Standard V8 JIT execution path with floating point math.
 */
export class ChladniJsCpuSimulation {
  public grainCount: number;
  public positions: Float32Array; // [x, y, z, active]

  constructor(grainCount = 50_000) {
    this.grainCount = Math.min(grainCount, 50_000);
    this.positions = new Float32Array(this.grainCount * 4);
    this.resetParticles();
  }

  public resetParticles(spanX = 0.95, spanY = 0.95) {
    for (let i = 0; i < this.grainCount; i++) {
      const idx = i * 4;
      this.positions[idx + 0] = (Math.random() * 2.0 - 1.0) * spanX;
      this.positions[idx + 1] = (Math.random() * 2.0 - 1.0) * spanY;
      this.positions[idx + 2] = 0.0;
      this.positions[idx + 3] = 1.0;
    }
  }

  public update(
    _time: number,
    _delta: number,
    m: number,
    n: number,
    k: number,
    blend: number,
    driveStrength: number,
    gridType: number,
    voidRadius: number,
    voidShape: number,
    centerExpulsion: number,
    boundX = 0.97,
    boundY = 0.97
  ): { settledCount: number; computeTimeMs: number } {
    const t0 = performance.now();
    let settledCount = 0;
    const pos = this.positions;

    for (let i = 0; i < this.grainCount; i++) {
      const base = i * 4;
      let px = pos[base + 0];
      let py = pos[base + 1];

      const w = evalChladniW(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
      const accel = driveStrength * Math.abs(w);
      const rDist = voidShape > 0.5 ? Math.max(Math.abs(px), Math.abs(py)) : Math.sqrt(px * px + py * py);

      if (accel > 1.0) {
        const excess = accel - 1.0;
        const kick = Math.sqrt(excess);

        const [gradX, gradY] = evalChladniGrad(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
        const signW = w >= 0 ? 1 : -1;

        let dx = -signW * gradX * (0.00022 * driveStrength);
        let dy = -signW * gradY * (0.00022 * driveStrength);

        if (voidRadius > 0.01 && rDist < voidRadius) {
          const invR = rDist > 0.001 ? 1.0 / rDist : 0;
          const push = (1.0 - rDist / voidRadius) * (0.0035 * (1.0 + centerExpulsion));
          dx += px * invR * push;
          dy += py * invR * push;
        }

        const wanderX = (Math.random() - 0.5) * (0.0042 * kick);
        const wanderY = (Math.random() - 0.5) * (0.0042 * kick);

        px += dx + wanderX;
        py += dy + wanderY;

        px = Math.max(-boundX, Math.min(boundX, px));
        py = Math.max(-boundY, Math.min(boundY, py));

        pos[base + 0] = px;
        pos[base + 1] = py;
        pos[base + 2] = 0.0;
        pos[base + 3] = 1.0;
      } else {
        if (voidRadius > 0.01 && rDist < voidRadius) {
          const invR = rDist > 0.001 ? 1.0 / rDist : 0;
          px += px * invR * 0.004;
          py += py * invR * 0.004;
          px = Math.max(-boundX, Math.min(boundX, px));
          py = Math.max(-boundY, Math.min(boundY, py));

          pos[base + 0] = px;
          pos[base + 1] = py;
          pos[base + 2] = 0.0;
          pos[base + 3] = 1.0;
        } else {
          if (accel > 0.85) {
            const [gradX, gradY] = evalChladniGrad(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
            const signW = w >= 0 ? 1 : -1;
            px += -signW * gradX * 0.00008;
            py += -signW * gradY * 0.00008;
            px = Math.max(-0.97, Math.min(0.97, px));
            py = Math.max(-0.97, Math.min(0.97, py));
          }

          pos[base + 0] = px;
          pos[base + 1] = py;
          pos[base + 2] = 0.0;
          pos[base + 3] = 0.0;
          settledCount++;
        }
      }
    }

    const t1 = performance.now();
    return {
      settledCount,
      computeTimeMs: +(t1 - t0).toFixed(2),
    };
  }

  public syncToBufferAttribute(positionAttr: THREE.BufferAttribute) {
    const pos = this.positions;
    const targetArr = positionAttr.array as Float32Array;
    const count = Math.min(this.grainCount, positionAttr.count);

    for (let i = 0; i < count; i++) {
      const src = i * 4;
      const dst = i * 3;
      targetArr[dst + 0] = pos[src + 0]; // x
      targetArr[dst + 1] = pos[src + 1]; // y (2D)
      targetArr[dst + 2] = 0.0;
    }
    positionAttr.needsUpdate = true;
  }
}

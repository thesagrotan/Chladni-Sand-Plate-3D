import * as THREE from 'three';
import { getChladniWasm, ChladniWasmExports } from './wasm/chladniWasmModule.ts';

/**
 * High-performance WebAssembly particle simulation engine.
 * Computes particle drift down the Chladni standing wave gradient,
 * Brownian dispersion, and void expulsion in compiled Wasm memory.
 * Features zero-copy direct memory views into WebAssembly.Memory.
 */
export class ChladniWasmSimulation {
  private wasm: ChladniWasmExports | null = null;
  public grainCount: number;
  public byteOffset = 4096; // 4KB aligned offset in Wasm linear memory
  public isReady = false;
  private positionsBuffer: Float32Array | null = null;
  private initPromise: Promise<void>;

  constructor(grainCount = 25_000) {
    this.grainCount = Math.min(grainCount, 50_000); // capped at 50k for smooth 60fps CPU execution

    this.initPromise = (async () => {
      this.wasm = await getChladniWasm();
      this.ensureMemoryCapacity();
      this.resetParticles();
      this.isReady = true;
    })();
  }

  public async waitReady() {
    await this.initPromise;
  }

  private ensureMemoryCapacity() {
    if (!this.wasm) return;
    const bytesNeeded = this.byteOffset + this.grainCount * 16;
    const pagesNeeded = Math.ceil(bytesNeeded / 65536) + 2;
    const currentPages = this.wasm.memory.buffer.byteLength / 65536;
    if (pagesNeeded > currentPages) {
      this.wasm.memory.grow(pagesNeeded - currentPages);
    }
    this.positionsBuffer = new Float32Array(this.wasm.memory.buffer, this.byteOffset, this.grainCount * 4);
  }

  public resetParticles() {
    if (!this.wasm) return;
    this.ensureMemoryCapacity();
    const buf = this.positionsBuffer;
    if (!buf) return;

    for (let i = 0; i < this.grainCount; i++) {
      const idx = i * 4;
      buf[idx + 0] = (Math.random() * 2.0 - 1.0) * 0.95;
      buf[idx + 1] = (Math.random() * 2.0 - 1.0) * 0.95;
      buf[idx + 2] = 0.0;
      buf[idx + 3] = 1.0; // active
    }
  }

  /**
   * Executes a simulation step in WebAssembly.
   * Directly mutates the contiguous linear memory buffer.
   * Returns settled count.
   */
  public update(
    time: number,
    _delta: number,
    m: number,
    n: number,
    k: number,
    blend: number,
    driveStrength: number,
    gridType: number,
    voidRadius: number,
    voidShape: number,
    centerExpulsion: number
  ): { settledCount: number; computeTimeMs: number } {
    if (!this.wasm || !this.isReady) {
      return { settledCount: 0, computeTimeMs: 0 };
    }

    const t0 = performance.now();
    const settledCount = this.wasm.stepParticlesWasm(
      this.byteOffset,
      this.grainCount,
      time,
      m,
      n,
      k,
      blend,
      driveStrength,
      gridType,
      voidRadius,
      voidShape,
      centerExpulsion
    );
    const t1 = performance.now();

    return {
      settledCount,
      computeTimeMs: +(t1 - t0).toFixed(2),
    };
  }

  /**
   * Transfers Wasm particle positions to Three.js BufferGeometry attribute.
   * 2D flat mapping: x→x, y→y, z=0.
   */
  public syncToBufferAttribute(positionAttr: THREE.BufferAttribute, countScale = 1.0) {
    if (!this.wasm || !this.positionsBuffer) return;
    const wasmMem = this.positionsBuffer;
    const targetArr = positionAttr.array as Float32Array;

    const count = Math.min(this.grainCount, positionAttr.count);
    for (let i = 0; i < count; i++) {
      const srcIdx = i * 4;
      const dstIdx = i * 3;
      targetArr[dstIdx + 0] = wasmMem[srcIdx + 0]; // x
      targetArr[dstIdx + 1] = wasmMem[srcIdx + 1]; // y (2D)
      targetArr[dstIdx + 2] = 0.0;
    }

    positionAttr.needsUpdate = true;
  }

  public getRawMemoryView(): Float32Array | null {
    return this.positionsBuffer;
  }

  public dispose() {
    this.positionsBuffer = null;
  }
}

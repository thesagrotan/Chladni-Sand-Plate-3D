// AssemblyScript implementation of high-performance Chladni Plate wave mathematics
// Compiled to WebAssembly with -O3 and SIMD support

@inline
function clampF(val: f32, minVal: f32, maxVal: f32): f32 {
  return f32(Math.max(f64(minVal), Math.min(f64(maxVal), f64(val))));
}

@inline
function hash1(px: f32, py: f32): f32 {
  const d: f32 = px * 12.9898 + py * 78.233;
  const s: f32 = f32(Math.sin(f64(d))) * 43758.5453;
  return s - f32(Math.floor(f64(s)));
}

export function evalBaseWave(
  x: f32,
  y: f32,
  m: f32,
  n: f32,
  k: f32,
  blend: f32,
  gridType: f32
): f32 {
  const PI: f32 = 3.141592653589793;
  const sk: f32 = (PI / 2.0) * (k / 30.0);
  const type: i32 = i32(Math.round(f64(gridType)));

  if (type == 1) {
    // Polar
    const r: f32 = f32(Math.sqrt(f64(x * x + y * y)));
    const theta: f32 = f32(Math.atan2(f64(y), f64(x)));
    return f32(Math.cos(f64(m * sk * r * 1.5))) - blend * f32(Math.cos(f64(n * theta))) * f32(Math.sin(f64(sk * r * 1.5)));
  } else if (type == 2) {
    // Annular
    const r: f32 = f32(Math.sqrt(f64(x * x + y * y)));
    const theta: f32 = f32(Math.atan2(f64(y), f64(x)));
    return f32(Math.cos(f64(m * sk * r * 1.8))) * f32(Math.cos(f64(n * theta))) - blend * f32(Math.sin(f64(sk * r * 2.0)));
  } else if (type == 3) {
    // Hexagonal
    const s: f32 = sk * (m * 0.4);
    const w1: f32 = f32(Math.cos(f64(s * x)));
    const w2: f32 = f32(Math.cos(f64(s * (-0.5 * x + 0.8660254 * y))));
    const w3: f32 = f32(Math.cos(f64(s * (-0.5 * x - 0.8660254 * y))));
    const r: f32 = f32(Math.sqrt(f64(x * x + y * y)));
    return (w1 + w2 + w3) * 0.66667 - blend * f32(Math.cos(f64(n * sk * r)));
  } else if (type == 4) {
    // Diamond
    const u: f32 = sk * (x + y) * 0.70710678;
    const v: f32 = sk * (x - y) * 0.70710678;
    return f32(Math.cos(f64(m * u))) * f32(Math.cos(f64(n * v))) - blend * f32(Math.cos(f64(n * u))) * f32(Math.cos(f64(m * v)));
  } else if (type == 5) {
    // Radial Web
    const r: f32 = f32(Math.sqrt(f64(x * x + y * y)));
    const theta: f32 = f32(Math.atan2(f64(y), f64(x)));
    return f32(Math.sin(f64(m * sk * r * 1.4))) * f32(Math.cos(f64(n * theta))) - blend * f32(Math.cos(f64(sk * r * 3.0)));
  } else {
    // Rectangular
    const u: f32 = sk * x;
    const v: f32 = sk * y;
    return f32(Math.cos(f64(m * u))) * f32(Math.cos(f64(n * v))) - blend * f32(Math.cos(f64(n * u))) * f32(Math.cos(f64(m * v)));
  }
}

export function evalChladniW(
  x: f32,
  y: f32,
  m: f32,
  n: f32,
  k: f32,
  blend: f32,
  gridType: f32,
  voidRadius: f32,
  voidShape: f32,
  centerExpulsion: f32
): f32 {
  const baseW: f32 = evalBaseWave(x, y, m, n, k, blend, gridType);

  if (voidRadius > 0.01) {
    const absX: f32 = f32(Math.abs(f64(x)));
    const absY: f32 = f32(Math.abs(f64(y)));
    const rDist: f32 = voidShape > 0.5 ? f32(Math.max(f64(absX), f64(absY))) : f32(Math.sqrt(f64(x * x + y * y)));
    const t: f32 = clampF(rDist / voidRadius, 0.0, 1.0);
    const voidAntinode: f32 = f32(Math.cos(f64(t * 1.57079632679))) * (1.6 + centerExpulsion * 0.6);

    const edge0: f32 = voidRadius * 0.75;
    const edge1: f32 = voidRadius * 1.05;
    const smoothT: f32 = clampF((rDist - edge0) / (edge1 - edge0), 0.0, 1.0);
    const blendFactor: f32 = smoothT * smoothT * (3.0 - 2.0 * smoothT);

    return voidAntinode * (1.0 - blendFactor) + baseW * blendFactor;
  }

  return baseW;
}

export function evalChladniGradX(
  x: f32,
  y: f32,
  m: f32,
  n: f32,
  k: f32,
  blend: f32,
  gridType: f32,
  voidRadius: f32,
  voidShape: f32,
  centerExpulsion: f32
): f32 {
  const eps: f32 = 0.0015;
  const w1: f32 = evalChladniW(x + eps, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  const w0: f32 = evalChladniW(x - eps, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  return (w1 - w0) / (2.0 * eps);
}

export function evalChladniGradY(
  x: f32,
  y: f32,
  m: f32,
  n: f32,
  k: f32,
  blend: f32,
  gridType: f32,
  voidRadius: f32,
  voidShape: f32,
  centerExpulsion: f32
): f32 {
  const eps: f32 = 0.0015;
  const w1: f32 = evalChladniW(x, y + eps, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  const w0: f32 = evalChladniW(x, y - eps, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
  return (w1 - w0) / (2.0 * eps);
}

// High performance batch calculation benchmark (used for CPU performance testing)
export function benchmarkChladniBatch(
  count: i32,
  m: f32,
  n: f32,
  k: f32,
  blend: f32,
  gridType: f32,
  voidRadius: f32,
  voidShape: f32,
  centerExpulsion: f32
): f32 {
  let accum: f32 = 0.0;
  const invCount: f32 = 2.0 / f32(count);

  for (let i: i32 = 0; i < count; i++) {
    const x: f32 = -1.0 + f32(i) * invCount;
    const y: f32 = f32(Math.sin(f64(x * 3.14159)));
    const w: f32 = evalChladniW(x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
    const gx: f32 = evalChladniGradX(x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
    const gy: f32 = evalChladniGradY(x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
    accum += w + gx * 0.1 + gy * 0.1;
  }
  return accum;
}

// Compute active plate fraction in Wasm across N x N sample points
export function computeActiveFractionWasm(
  gridSamples: i32,
  m: f32,
  n: f32,
  k: f32,
  blend: f32,
  driveStrength: f32,
  gridType: f32,
  voidRadius: f32,
  voidShape: f32,
  centerExpulsion: f32
): f32 {
  let activeCount: i32 = 0;
  const total: i32 = gridSamples * gridSamples;
  const step: f32 = 2.0 / f32(gridSamples);

  for (let i: i32 = 0; i < gridSamples; i++) {
    const x: f32 = -1.0 + (f32(i) + 0.5) * step;
    for (let j: i32 = 0; j < gridSamples; j++) {
      const y: f32 = -1.0 + (f32(j) + 0.5) * step;
      const w: f32 = evalChladniW(x, y, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
      const accel: f32 = driveStrength * f32(Math.abs(f64(w)));
      if (accel > 1.0) {
        activeCount++;
      }
    }
  }

  return f32(activeCount) / f32(total);
}

// Particle simulation step in WebAssembly
// Memory layout: particles buffer starting at byteOffset
// Each particle has 4 floats: [x, y, z, activeFlag] (16 bytes per grain)
export function stepParticlesWasm(
  byteOffset: usize,
  count: i32,
  time: f32,
  m: f32,
  n: f32,
  k: f32,
  blend: f32,
  driveStrength: f32,
  gridType: f32,
  voidRadius: f32,
  voidShape: f32,
  centerExpulsion: f32
): i32 {
  let settledCount: i32 = 0;

  for (let i: i32 = 0; i < count; i++) {
    const base: usize = byteOffset + <usize>(i * 16);
    let px: f32 = load<f32>(base);
    let py: f32 = load<f32>(base + 4);

    const w: f32 = evalChladniW(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
    const absW: f32 = f32(Math.abs(f64(w)));
    const accel: f32 = driveStrength * absW;

    const absX: f32 = f32(Math.abs(f64(px)));
    const absY: f32 = f32(Math.abs(f64(py)));
    const rDist: f32 = voidShape > 0.5 ? f32(Math.max(f64(absX), f64(absY))) : f32(Math.sqrt(f64(px * px + py * py)));

    if (accel > 1.0) {
      const excess: f32 = accel - 1.0;
      const kick: f32 = f32(Math.sqrt(f64(excess)));

      const gradX: f32 = evalChladniGradX(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
      const gradY: f32 = evalChladniGradY(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);

      const signW: f32 = w >= 0.0 ? 1.0 : -1.0;
      let dx: f32 = -signW * gradX * (0.00022 * driveStrength);
      let dy: f32 = -signW * gradY * (0.00022 * driveStrength);

      if (voidRadius > 0.01 && rDist < voidRadius) {
        const invR: f32 = rDist > 0.001 ? 1.0 / rDist : 0.0;
        const push: f32 = (1.0 - rDist / voidRadius) * (0.0035 * (1.0 + centerExpulsion));
        dx += px * invR * push;
        dy += py * invR * push;
      }

      // Pseudo-random wander
      const r1: f32 = hash1(px * 67.3 + time * 13.1, py * 31.7);
      const r2: f32 = hash1(py * 43.1 + time * 27.5, px * 89.2);
      const wx: f32 = (r1 - 0.5) * (0.0042 * kick);
      const wy: f32 = (r2 - 0.5) * (0.0042 * kick);

      px += dx + wx;
      py += dy + wy;

      // Bound clamp
      px = clampF(px, -0.97, 0.97);
      py = clampF(py, -0.97, 0.97);

      store<f32>(base, px);
      store<f32>(base + 4, py);
      store<f32>(base + 8, 0.0);
      store<f32>(base + 12, 1.0); // active
    } else {
      if (voidRadius > 0.01 && rDist < voidRadius) {
        const invR: f32 = rDist > 0.001 ? 1.0 / rDist : 0.0;
        px += px * invR * 0.004;
        py += py * invR * 0.004;
        px = clampF(px, -0.97, 0.97);
        py = clampF(py, -0.97, 0.97);

        store<f32>(base, px);
        store<f32>(base + 4, py);
        store<f32>(base + 8, 0.0);
        store<f32>(base + 12, 1.0);
      } else {
        if (accel > 0.85) {
          const gradX: f32 = evalChladniGradX(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
          const gradY: f32 = evalChladniGradY(px, py, m, n, k, blend, gridType, voidRadius, voidShape, centerExpulsion);
          const signW: f32 = w >= 0.0 ? 1.0 : -1.0;
          px += -signW * gradX * 0.00008;
          py += -signW * gradY * 0.00008;
          px = clampF(px, -0.97, 0.97);
          py = clampF(py, -0.97, 0.97);
        }

        store<f32>(base, px);
        store<f32>(base + 4, py);
        store<f32>(base + 8, 0.0);
        store<f32>(base + 12, 0.0); // settled
        settledCount++;
      }
    }
  }

  return settledCount;
}

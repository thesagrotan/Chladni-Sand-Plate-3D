import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AS_ENTRY = path.join(ROOT, 'node_modules/assemblyscript/bin/asc.js');
const SOURCE = path.join(ROOT, 'src/simulation/wasm/chladni.as.ts');
const CHECKED_IN_WASM = path.join(ROOT, 'src/simulation/wasm/chladni.wasm');
const MODULE_FILE = path.join(ROOT, 'src/simulation/wasm/chladniWasmModule.ts');
const BUILD_DIR = path.join(ROOT, 'build');
const ASC_FLAGS = ['-O3', '--runtime', 'stub'];

const REQUIRED_EXPORTS = [
  'memory',
  'evalBaseWave',
  'evalChladniW',
  'evalChladniGradX',
  'evalChladniGradY',
  'benchmarkChladniBatch',
  'computeActiveFractionWasm',
  'stepParticlesWasm',
];

const RUNTIME_ONLY_EXPORTS = ['__new', '__pin', '__unpin', '__collect', '__rtti_base'];

const sync = process.argv.includes('--sync');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

function compile(outFile) {
  const result = spawnSync(process.execPath, [AS_ENTRY, SOURCE, ...ASC_FLAGS, '-o', outFile], {
    cwd: ROOT,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`asc failed with exit code ${result.status}`);
  }
}

function instantiate(bytes) {
  const module = new WebAssembly.Module(bytes);
  return new WebAssembly.Instance(module, {
    env: {
      abort: () => {
        throw new Error('WASM abort');
      },
    },
  }).exports;
}

async function readEmbeddedBase64() {
  const source = await readFile(MODULE_FILE, 'utf8');
  const match = source.match(/export const CHLADNI_WASM_BASE64 = "([^"]+)";/);
  if (!match) throw new Error('CHLADNI_WASM_BASE64 not found in chladniWasmModule.ts');
  return { source, base64: match[1] };
}

function sampleCases() {
  let seed = 0x9c74ea47;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const cases = [];
  for (let gridType = 0; gridType < 6; gridType++) {
    for (const voidShape of [0, 1]) {
      for (let i = 0; i < 100; i++) {
        cases.push({
          x: rand() * 2 - 1,
          y: rand() * 2 - 1,
          m: 2 + Math.floor(rand() * 8),
          n: 2 + Math.floor(rand() * 8),
          k: 20 + rand() * 25,
          blend: rand() * 1.2,
          gridType,
          voidShape,
          voidRadius: rand() < 0.5 ? 0 : 0.1 + rand() * 0.4,
          centerExpulsion: rand() * 4,
        });
      }
    }
  }
  return cases;
}

function compareExports(a, b) {
  let maxWave = 0;
  let maxGrad = 0;

  for (const c of sampleCases()) {
    const args = [
      c.x,
      c.y,
      c.m,
      c.n,
      c.k,
      c.blend,
      c.gridType,
      c.voidRadius,
      c.voidShape,
      c.centerExpulsion,
    ];

    maxWave = Math.max(maxWave, Math.abs(a.evalChladniW(...args) - b.evalChladniW(...args)));
    maxGrad = Math.max(
      maxGrad,
      Math.abs(a.evalChladniGradX(...args) - b.evalChladniGradX(...args)),
      Math.abs(a.evalChladniGradY(...args) - b.evalChladniGradY(...args))
    );
  }

  return { maxWave, maxGrad };
}

function exportNames(bytes) {
  return WebAssembly.Module.exports(new WebAssembly.Module(bytes)).map((entry) => entry.name);
}

async function main() {
  const checkedIn = await readFile(CHECKED_IN_WASM);
  const { source, base64 } = await readEmbeddedBase64();
  const embedded = Buffer.from(base64, 'base64');

  console.log(`source          ${SOURCE}`);
  console.log(`checked-in wasm ${checkedIn.length} bytes  sha256 ${sha256(checkedIn)}`);
  console.log(`embedded base64 ${embedded.length} bytes  sha256 ${sha256(embedded)}`);

  if (!checkedIn.equals(embedded)) {
    fail('checked-in chladni.wasm does not match CHLADNI_WASM_BASE64');
  } else {
    console.log('embedded artifact matches checked-in wasm: OK');
  }

  await mkdir(BUILD_DIR, { recursive: true });
  const firstOut = path.join(BUILD_DIR, 'chladni.rebuilt-a.wasm');
  const secondOut = path.join(BUILD_DIR, 'chladni.rebuilt-b.wasm');

  try {
    compile(firstOut);
    compile(secondOut);

    const first = await readFile(firstOut);
    const second = await readFile(secondOut);

    console.log(`rebuilt wasm    ${first.length} bytes  sha256 ${sha256(first)}`);

    if (!first.equals(second)) {
      fail('repeated asc builds are not byte-identical');
    } else {
      console.log('deterministic rebuild: OK');
    }

    const checkedExports = exportNames(checkedIn);
    const rebuiltExports = exportNames(first);
    const missingRequired = REQUIRED_EXPORTS.filter((name) => !rebuiltExports.includes(name));
    if (missingRequired.length > 0) {
      fail(`rebuilt wasm is missing required exports: ${missingRequired.join(', ')}`);
    }

    const droppedRuntime = RUNTIME_ONLY_EXPORTS.filter(
      (name) => checkedExports.includes(name) && !rebuiltExports.includes(name)
    );
    if (droppedRuntime.length > 0) {
      console.log(`runtime-only exports omitted from stub rebuild: ${droppedRuntime.join(', ')}`);
    }

    const checked = instantiate(checkedIn);
    const rebuilt = instantiate(first);
    const binaryParity = compareExports(checked, rebuilt);
    console.log(
      `checked-in vs rebuilt numeric parity: max |W| ${binaryParity.maxWave}, max |grad| ${binaryParity.maxGrad}`
    );

    if (binaryParity.maxWave > 1e-6 || binaryParity.maxGrad > 1e-5) {
      fail('rebuilt wasm diverges numerically from the checked-in artifact');
    }

    if (first.equals(checkedIn)) {
      console.log('rebuilt bytes match checked-in artifact: OK');
    } else {
      console.log('rebuilt bytes differ from checked-in artifact (numeric parity holds)');
    }

    if (sync) {
      await writeFile(CHECKED_IN_WASM, first);
      const nextBase64 = first.toString('base64');
      const nextSource = source.replace(
        /export const CHLADNI_WASM_BASE64 = "[^"]+";/,
        `export const CHLADNI_WASM_BASE64 = "${nextBase64}";`
      );
      await writeFile(MODULE_FILE, nextSource);
      console.log(`synced checked-in wasm and embedded base64 (${first.length} bytes, sha256 ${sha256(first)})`);
    }
  } finally {
    await rm(firstOut, { force: true });
    await rm(secondOut, { force: true });
  }

  if (process.exitCode) {
    console.error('\nWASM verification failed.');
  } else {
    console.log('\nWASM verification passed.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

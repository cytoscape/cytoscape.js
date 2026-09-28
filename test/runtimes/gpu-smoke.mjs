/*
Round 131 (discharging 99.2): `cytoscape/headless-gpu` on Deno's native
WebGPU — the GPU executors with no DOM.

    deno run --unstable-webgpu --allow-read test/runtimes/gpu-smoke.mjs

Deno's WebGPU is wgpu, not Dawn, so this is the first non-Dawn compile of
the algorithm kernels and the force integrator.  What runs, on the
headless-gpu ESM:

- the adapter, **named** in the output (99.2's rule: a green run on an
  unnamed adapter says nothing about which GPU it was — the round-18.5 /
  27.9 SwiftShader lesson);
- `pageRank` with `executor: 'gpu'` against `'cpu'` within the parity
  suite's bounds (`playwright-tests/algorithms-gpu.spec.js`: every rank
  within 1e-4, the GPU ranks summing to 1 within 1e-4, no clearly
  separated pair inverted);
- a force run with an explicit `executor: 'gpu'` — the headless device
  host (131.4) — that settles every node at a finite position and moves
  them.

No soft skip: where there is no WebGPU or no adapter, the named
assertion fails and the exit code says so (CI runs it as its own
`continue-on-error` step; the round record says where it went green).
Plain asserts and no imports, like the cross-runtime smoke.
*/

let assertions = 0;

const assert = (ok, what) => {
  assertions++;

  if (!ok) {
    throw new Error(`gpu smoke assertion failed: ${what}`);
  }
};

const gpu = globalThis.navigator?.gpu;

assert(
  gpu != null,
  'navigator.gpu exists (Deno needs --unstable-webgpu; a runtime without ' +
    'WebGPU cannot run this smoke)',
);

const adapter = await gpu.requestAdapter();

assert(adapter != null, 'requestAdapter() answers an adapter');

const info = adapter.info ?? {};
const adapterName =
  [info.vendor, info.architecture, info.device, info.description]
    .filter((s) => s != null && s !== '')
    .join(' / ') || 'an adapter with no info';

console.log(`adapter: ${adapterName}`);

const url = new URL(
  '../../build/cytoscape-headless-gpu.esm.mjs',
  import.meta.url,
);
const cytoscape = (await import(url.href)).default;

assert(typeof cytoscape === 'function', 'the headless-gpu factory loads');

// ── pageRank: the parity suite's ring-with-chords fixture
const els = [];
const n = 60;

for (let i = 0; i < n; i++) {
  els.push({ data: { id: 'n' + i } });
}

for (let i = 0; i < n; i++) {
  els.push({ data: { source: 'n' + i, target: 'n' + ((i + 1) % n) } });

  if (i % 3 === 0) {
    els.push({ data: { source: 'n' + i, target: 'n0' } });
  }
}

const cy = cytoscape({ elements: els });
const cpu = await cy.elements().pageRank({ executor: 'cpu' });
const onGpu = await cy.elements().pageRank({ executor: 'gpu' });
const nodes = cy.nodes();
let maxDelta = 0;
let gpuSum = 0;
let inversions = 0;

nodes.forEach((node) => {
  maxDelta = Math.max(maxDelta, Math.abs(cpu.rank(node) - onGpu.rank(node)));
  gpuSum += onGpu.rank(node);
});

for (let i = 0; i < nodes.length; i++) {
  for (let j = 0; j < nodes.length; j++) {
    const ci = cpu.rank(nodes[i]);
    const cj = cpu.rank(nodes[j]);

    if (ci > cj + 1e-4 && onGpu.rank(nodes[i]) <= onGpu.rank(nodes[j])) {
      inversions++;
    }
  }
}

assert(maxDelta < 1e-4, `pageRank GPU within 1e-4 of CPU (max ${maxDelta})`);
assert(
  Math.abs(gpuSum - 1) < 1e-4,
  `pageRank GPU ranks sum to 1 (got ${gpuSum})`,
);
assert(inversions === 0, `pageRank GPU keeps the order (${inversions} flips)`);
cy.destroy();

// ── force: an explicit 'gpu' run on the headless device host
const ring = [];
const m = 200;

for (let i = 0; i < m; i++) {
  ring.push({
    data: { id: 'r' + i },
    position: { x: (i % 20) * 5, y: Math.floor(i / 20) * 5 },
  });
}

for (let i = 0; i < m; i++) {
  ring.push({ data: { source: 'r' + i, target: 'r' + ((i + 1) % m) } });
}

const fcy = cytoscape({ elements: ring });
const seed = fcy.nodes().map((node) => ({ ...node.position() }));
const errors = [];

fcy.on('error', (_e, message) => errors.push(message));

const started = performance.now();

await fcy
  .layout({ name: 'force', executor: 'gpu', seed: 7, fit: false })
  .run()
  .promise();

const ms = performance.now() - started;
const settled = fcy.nodes().map((node) => ({ ...node.position() }));

assert(errors.length === 0, `the GPU force run raised no error (${errors})`);
assert(
  settled.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
  'the GPU force run settles every node at a finite position',
);
assert(
  settled.some((p, i) => p.x !== seed[i].x || p.y !== seed[i].y),
  'the GPU force run moved the nodes',
);
fcy.destroy();

console.log(
  `ok cytoscape-headless-gpu.esm.mjs (${assertions} assertions) on ` +
    `${globalThis.navigator?.userAgent ?? 'unknown'}: pageRank max delta ` +
    `${maxDelta.toExponential(2)}, force ${m} nodes settled in ${Math.round(ms)} ms`,
);

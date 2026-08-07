// Focused materializer/selector sweep: v3 vs GPU/v4 at BENCH_N scale.
//
// Standalone (not part of index.mjs): covers only the whole-graph
// materializers and flag-selector ops, so it stays runnable at scales
// (BENCH_N=200000) where the full suite's v3-side ops would take too long.
//
//   BENCH_N=200000 node --import tsx benchmark/materializers.mjs

import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, N } from './graph.mjs';

const elements = buildElements();

const v3 = makeV3(elements);
const gpu = makeGpu(elements);

// select ~1% of nodes so :selected has a non-trivial result set
const selN = Math.max(1, Math.floor(N / 100));
for (let i = 0; i < selN; i++) {
  v3.getElementById('n' + ((i * 100) % N)).select();
  gpu.getElementById('n' + ((i * 100) % N)).select();
}

// `gpuOp` overrides the gpu-side op where the idiomatic v4 form differs
// (v4 has no selector strings; queries/predicates replace them)
function cmp(name, op, gpuOp = op) {
  group(name, () => {
    summary(() => {
      bench('v3', () => do_not_optimize(op(v3)));
      bench('gpu', () => do_not_optimize(gpuOp(gpu)));
    });
  });
}

console.log(
  `\n== materializer/selector sweep (N=${N} nodes, ${2 * N} edges, ${selN} selected) ==`,
);

cmp('sweep: nodes()', (c) => c.nodes());
cmp('sweep: edges()', (c) => c.edges());
cmp('sweep: elements()', (c) => c.elements());
cmp(
  'sweep: all nodes ($("node") vs filter({group}))',
  (c) => c.$('node'),
  (c) => c.filter({ group: 'nodes' }),
);
cmp(
  'sweep: selected ($(":selected") vs filter({selected}))',
  (c) => c.$(':selected'),
  (c) => c.filter({ selected: true }),
);
cmp(
  'sweep: selected nodes ($("node:selected") vs filter({group, selected}))',
  (c) => c.$('node:selected'),
  (c) => c.filter({ group: 'nodes', selected: true }),
);
cmp(
  'sweep: nodes(":selected") vs nodes({selected})',
  (c) => c.nodes(':selected'),
  (c) => c.nodes({ selected: true }),
);
cmp('sweep: filter(fn)', (c) => c.filter((e) => e.isNode()));

await finishRun('materializers');

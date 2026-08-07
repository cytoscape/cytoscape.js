// Compound-hierarchy sweep (round 14.12): v3 vs GPU/v4 on the ops the
// auto-bounds machinery makes interesting — parent drags (subtree shift +
// bounds settle), child drags (parent re-derive), and reparenting.
//
// Standalone, like mutators.mjs:
//
//   BENCH_N=20000 node --import tsx benchmark/compound.mjs
//   BENCH_N=200000 BENCH_OP=child node --import tsx benchmark/compound.mjs
//
// The graph is BENCH_N leaves in clusters of 20 under one parent each
// (plus a spare orphan parent for the reparent round-trip); positions are
// clustered so parent boxes are meaningful.  Every op is a reversible
// round-trip and reads a bound afterwards, so the lazy v4 flush is always
// inside the timed region (matching what a drag frame actually pays).

import { bench, group, summary } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { makeV3, makeGpu, N } from './graph.mjs';

const CLUSTER = 20;

function buildCompoundElements(n = N) {
  const clusters = Math.max(1, Math.floor(n / CLUSTER));
  const cols = Math.ceil(Math.sqrt(clusters));
  const nodes = [];
  const edges = [];

  nodes.push({ data: { id: 'spare' } }); // reparent target (kept a parent by its seed child)
  nodes.push({
    data: { id: 'seed', parent: 'spare' },
    position: { x: -500, y: -500 },
  });

  for (let c = 0; c < clusters; c++) {
    nodes.push({ data: { id: 'p' + c } });
  }

  for (let i = 0; i < n; i++) {
    const c = i % clusters;

    nodes.push({
      data: { id: 'n' + i, parent: 'p' + c },
      position: {
        x: (c % cols) * 300 + (i % 7) * 20,
        y: Math.floor(c / cols) * 300 + (Math.floor(i / 7) % 7) * 20,
      },
    });
  }

  for (let j = 0; j < n; j++) {
    // one intra-cluster edge per leaf
    const c = j % clusters;
    const perCluster = Math.floor(n / clusters);
    const other = c + ((Math.floor(j / clusters) + 1) % perCluster) * clusters;

    edges.push({ data: { id: 'e' + j, source: 'n' + j, target: 'n' + other } });
  }

  return [...nodes, ...edges]; // the flat form graph.mjs's helpers expect
}

const OP = process.env.BENCH_OP;
const elements = buildCompoundElements();
const instances = [];

function cmp(name, setup, fn) {
  if (OP != null && !name.includes(OP)) {
    return;
  }

  const a = makeV3(elements, {
    styleEnabled: true,
    layout: { name: 'preset' },
  });
  const b = makeGpu(elements);
  const ta = setup(a);
  const tb = setup(b);
  let i = 0;

  instances.push(a, b);

  group(name, () => {
    summary(() => {
      bench('v3', () => {
        fn(ta, i++, a);
      });
      bench('gpu', () => {
        fn(tb, i++, b);
      });
    });
  });
}

// a parent drag: subtree shift + the bounds read a frame pays
cmp(
  'parent drag (shift subtree + bb settle)',
  (cy) => ({ p: cy.getElementById('p0') }),
  (t, i) => {
    t.p.shift({ x: i % 2 === 0 ? 10 : -10, y: 0 });
    t.p.boundingBox();
  },
);

// a child drag: one leaf moves, its parent re-derives
cmp(
  'child drag (move + parent re-derive)',
  (cy) => ({ c: cy.getElementById('n0'), p: cy.getElementById('p0') }),
  (t, i) => {
    t.c.shift({ x: i % 2 === 0 ? 15 : -15, y: 0 });
    t.p.boundingBox();
  },
);

// reparent round-trip: a leaf hops between two parents
cmp(
  'reparent round-trip',
  (cy) => ({ c: cy.getElementById('n1') }),
  (t, i) => {
    t.c.move({ parent: i % 2 === 0 ? 'spare' : 'p1' });
  },
);

await finishRun('compound');

// v3 compound instances leave live timers behind (style/bounds
// debouncers); tear them down so the process exits like the other suites
for (const cy of instances) {
  cy.destroy();
}

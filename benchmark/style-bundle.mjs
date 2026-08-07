/*
Round 36.5: the style getters, measured **through the built bundle**.

Why this suite exists apart from `style.mjs`.  Every other suite here
imports `src/` through tsx, which injects esbuild's `__name` wrapper — an
`Object.defineProperty` per *closure creation*.  Round 34.0 found 23% of
`readProp`'s samples in it and re-measured the same getter at 292 ns
through `build/cytoscape.esm.mjs` against the 2.0 µs the tsx path
reported, which is why `AGENTS.md` says to check a hot-path finding
against the bundle before acting on it (`grep -c __name` on the bundle
is 0).

Rounds 34 and 35 then reported their headline figures — 292 -> 122 ns,
and round 35's 48–110 ns spread with a 1.27x/1.48x whole-object gain —
from *throwaway* harnesses.  That contradicts round 33's design call 2:
every performance figure in the docs has a re-runnable source or is
marked a historical one-off.  This is that source.

Read the rows as **v3-comparative** for the per-property pairs and
gpu-only for the whole-object aggregates (v3's `style()` with no
argument returns a different shape, so the pair would not be a
comparison).

Needs a current bundle — `npm run build` — and says so if the bundle is
older than `src/`.

  node benchmark/style-bundle.mjs
  node --import tsx benchmark/style-bundle.mjs   # identical; see below

**tsx is harmless here, and that was measured rather than assumed.**  The
`__name` wrapper is injected when esbuild *transpiles a `.mts` source*;
this file is plain JS importing plain-JS bundles, so the loader has
nothing to transform.  Run both ways the rows agree within noise
(119/76/52/52 ns against 118/79/58/52), which is what lets the suite join
`report.mjs --all` on the same `--import tsx` spawn as every other one
instead of needing its own path.

The property set is round 35's: two that sat near the front of the old
150-case switch, two in the middle, two at the very back.  Their *old*
positions are what made the switch's cost positional, so they stay named
here even though the dispatch table has no positions — a future change
that reintroduces a positional cost shows up as a spread across these
six rows.
*/

import { statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const GPU_BUNDLE = join(ROOT, 'build/cytoscape.esm.mjs');
const V3_BUNDLE = join(ROOT, 'v3/build/cytoscape.esm.mjs');

// the render bench's staleness check, reused: a bundle older than the
// sources it was built from measures the previous commit
const newestSrc = (dir, newest = 0) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);

    if (entry.isDirectory()) {
      newest = newestSrc(full, newest);
    } else if (/\.mts$/.test(entry.name)) {
      newest = Math.max(newest, statSync(full).mtimeMs);
    }
  }

  return newest;
};

for (const bundle of [GPU_BUNDLE, V3_BUNDLE]) {
  try {
    if (statSync(bundle).mtimeMs < newestSrc(join(ROOT, 'src'))) {
      console.warn(`!! ${bundle} is older than src/ — run \`npm run build\``);
    }
  } catch {
    console.error(`!! ${bundle} is missing — run \`npm run build\``);
    process.exit(1);
  }
}

const { default: cytoscape } = await import(GPU_BUNDLE);
const { default: cytoscape } = await import(V3_BUNDLE);

const N = Number(process.env.BENCH_N) || 2000;

// one styled node and one styled edge per side, with enough properties
// set that a whole-object read is not answering from defaults alone
const elements = [];

for (let i = 0; i < N; i++) {
  elements.push({
    data: { id: 'n' + i, w: i % 50 },
    position: { x: (i % 100) * 10, y: ((i / 100) | 0) * 10 },
  });
}

for (let i = 1; i < N; i++) {
  elements.push({
    data: { id: 'e' + i, source: 'n' + (i - 1), target: 'n' + i },
  });
}

const gpu = cytoscape({ elements });

gpu.style({
  nodes: {
    'background-color': '#c0392b',
    'border-width': 3,
    'border-color': '#2c3e50',
    width: 40,
    height: 40,
    shape: 'round-rectangle',
    label: 'x',
    'text-wrap': 'wrap',
    'text-max-width': 80,
  },
  edges: {
    'line-color': '#7f8c8d',
    width: 2,
    'curve-style': 'taxi',
    'taxi-radius': 8,
    'target-distance-from-node': 4,
    'target-arrow-shape': 'triangle',
    'target-arrow-color': '#333',
  },
});

const v3 = cytoscape({
  headless: true,
  styleEnabled: true,
  layout: { name: 'preset' },
  elements: JSON.parse(JSON.stringify(elements)),
  style: [
    {
      selector: 'node',
      style: {
        'background-color': '#c0392b',
        'border-width': 3,
        'border-color': '#2c3e50',
        width: 40,
        height: 40,
        shape: 'round-rectangle',
        label: 'x',
        'text-wrap': 'wrap',
        'text-max-width': 80,
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': '#7f8c8d',
        width: 2,
        'curve-style': 'taxi',
        'taxi-radius': 8,
        'target-distance-from-node': 4,
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#333',
      },
    },
  ],
});

// rotate over a pool of operands so a pure read cannot be hoisted out of
// the measured region (the index.mjs convention)
const POOL = 8;
const gpuNodes = Array.from({ length: POOL }, (_, i) =>
  gpu.$id('n' + (i * 7 + 3)),
);
const gpuEdges = Array.from({ length: POOL }, (_, i) =>
  gpu.$id('e' + (i * 7 + 3)),
);
const v3Nodes = Array.from({ length: POOL }, (_, i) =>
  v3.getElementById('n' + (i * 7 + 3)),
);
const v3Edges = Array.from({ length: POOL }, (_, i) =>
  v3.getElementById('e' + (i * 7 + 3)),
);

// [ label, old position in the 150-case switch, group, property ]
const PROPS = [
  ['background-color', '#4', 'nodes', 'background-color'],
  ['border-width', '#6', 'nodes', 'border-width'],
  ['text-wrap', '#73', 'nodes', 'text-wrap'],
  ['text-max-width', '#74', 'nodes', 'text-max-width'],
  ['taxi-radius', '#142', 'edges', 'taxi-radius'],
  ['target-distance-from-node', '#150', 'edges', 'target-distance-from-node'],
];

let i = 0;

for (const [label, pos, groupName, prop] of PROPS) {
  const gpuPool = groupName === 'nodes' ? gpuNodes : gpuEdges;
  const v3Pool = groupName === 'nodes' ? v3Nodes : v3Edges;

  summary(() => {
    group(`style( '${label}' )  (was ${pos} in the switch)`, () => {
      bench('v3', () => {
        do_not_optimize(v3Pool[i++ & (POOL - 1)].style(prop));
      });
      bench('gpu', () => {
        do_not_optimize(gpuPool[i++ & (POOL - 1)].style(prop));
      });
    });
  });
}

// the aggregate round 35 is judged on: a whole-object read touches every
// property of the group, so it is where a flattening shows up
group('whole-object style() (gpu-only: v3 returns a different shape)', () => {
  bench('gpu node', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].style());
  });
  bench('gpu edge', () => {
    do_not_optimize(gpuEdges[i++ & (POOL - 1)].style());
  });
});

// Round 36.5's finding.  Round 35's table read 48–110 ns across six
// properties and called that the post-table spread; it is really two
// populations.  A colour-valued read builds an `rgb()`/`rgba()` string,
// which costs about as much again as the whole dispatch-and-decode —
// and it does so wherever the property sat in the old switch, so it is
// not residual positional cost.  `background-color` was the only colour
// in round 35's six, which is why it topped that table.
group('colour-valued vs numeric reads (the string build)', () => {
  bench('gpu background-color (colour)', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].style('background-color'));
  });
  bench('gpu border-color (colour)', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].style('border-color'));
  });
  bench('gpu border-width (number)', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].style('border-width'));
  });
  bench('gpu width (number)', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].style('width'));
  });
});

group('the getters that ride readProp', () => {
  bench('gpu numericStyle( width )', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].numericStyle('width'));
  });
  bench('gpu effectiveOpacity()', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].effectiveOpacity());
  });
  bench('gpu renderedStyle( width )', () => {
    do_not_optimize(gpuNodes[i++ & (POOL - 1)].renderedStyle('width'));
  });
});

await finishRun('style-bundle');

v3.destroy();
gpu.destroy();

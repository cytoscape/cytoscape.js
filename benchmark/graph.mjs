// Shared graph fixtures for the v3-vs-v4 API benchmarks.
//
// v4 is the package, in src/. v3 is the mature implementation kept for
// comparison in v3/src/ (imported via v3/src/test.mjs, its headless entry).
// Both factories accept the same `{ elements }` shape, so a single element
// list drives both.

import { N } from './bench-size.mjs';
import cytoscapeV3 from '../v3/src/test.mjs';
import cytoscape from '../src/index.mjs';

// The run size lives in bench-size.mjs, which imports nothing — so a module
// that wants only `N` need not evaluate v3 and v4 to get it.  Re-exported
// here because twenty suites import it from this module.
export { N, MIDNUM, MID } from './bench-size.mjs';

/**
 * A deterministic graph: N nodes on a grid, each with two out-edges
 * (to i+1 and i+3, wrapping), giving every node degree 4.
 */
export function buildElements(n = N) {
  const els = [];

  for (let i = 0; i < n; i++) {
    els.push({
      data: { id: 'n' + i, foo: i, weight: i % 7 },
      position: { x: (i % 100) * 10, y: Math.floor(i / 100) * 10 },
    });
  }

  for (let i = 0; i < n; i++) {
    els.push({
      data: { id: 'e' + i + 'a', source: 'n' + i, target: 'n' + ((i + 1) % n) },
    });
    els.push({
      data: { id: 'e' + i + 'b', source: 'n' + i, target: 'n' + ((i + 3) % n) },
    });
  }

  return els;
}

// Factories mutate/consume the def objects, so hand each a fresh deep copy.
const clone = (els) =>
  els.map((e) => ({
    group: e.group,
    data: { ...e.data },
    position: e.position ? { ...e.position } : undefined,
  }));

export function makeV3(elements, opts = {}) {
  return cytoscapeV3({ elements: clone(elements), headless: true, ...opts });
}

export function makeGpu(elements) {
  return cytoscape({ elements: clone(elements) });
}

// MIDNUM / MID — a representative node index/id in the middle of the graph,
// for single-element lookups — are re-exported at the top of this file.
// Benchmarks rotate over a small band of ids starting there so the JIT can't
// hoist a loop-invariant pure call out of the measured region.

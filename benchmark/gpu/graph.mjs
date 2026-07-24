// Shared graph fixtures for the v3-vs-GPU API benchmarks.
//
// v3 is the mature implementation in src/ (imported via src/test.mjs, its
// headless entry). The GPU (v4) prototype lives in src/gpu/. Both factories
// accept the same `{ elements }` shape, so a single element list drives both.

import cytoscape from '../../src/test.mjs';
import cytoscapeGpu from '../../src/gpu/index.mjs';

// Node count is overridable so a run can be scaled up/down:
//   BENCH_N=5000 npm run benchmark:gpu
export const N = Number( process.env.BENCH_N ) || 2000;

/**
 * A deterministic graph: N nodes on a grid, each with two out-edges
 * (to i+1 and i+3, wrapping), giving every node degree 4.
 */
export function buildElements( n = N ){
  const els = [];

  for( let i = 0; i < n; i++ ){
    els.push( {
      data: { id: 'n' + i, foo: i, weight: i % 7 },
      position: { x: ( i % 100 ) * 10, y: Math.floor( i / 100 ) * 10 }
    } );
  }

  for( let i = 0; i < n; i++ ){
    els.push( { data: { id: 'e' + i + 'a', source: 'n' + i, target: 'n' + ( ( i + 1 ) % n ) } } );
    els.push( { data: { id: 'e' + i + 'b', source: 'n' + i, target: 'n' + ( ( i + 3 ) % n ) } } );
  }

  return els;
}

// Factories mutate/consume the def objects, so hand each a fresh deep copy.
const clone = els => els.map( e => ( {
  group: e.group,
  data: { ...e.data },
  position: e.position ? { ...e.position } : undefined
} ) );

export function makeV3( elements ){
  return cytoscape( { elements: clone( elements ), headless: true } );
}

export function makeGpu( elements ){
  return cytoscapeGpu( { elements: clone( elements ) } );
}

// A representative id in the middle of the graph, for single-element lookups.
export const MID = 'n' + Math.floor( N / 2 );

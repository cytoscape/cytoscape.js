// Mapper bulk-write sweep: what a whole-graph data() write costs under
// each evaluation policy of the mapper DSL.
//
// Standalone (not part of index.mjs), gpu-only: the interesting spread is
// between the DSL's own paths, not v3 (whose data-write cost is covered
// by mutators.mjs) —
//
//   - cpu eval: the write re-derives the mapped channels on the CPU
//     (headless behaviour, and the geometry-channel path)
//   - gpu path: the kernel owns the paint channel (simulated here the way
//     the renderer's MapperRuntime configures it), so the write costs the
//     data write + span marking only; the kernel re-evaluates from the
//     uploaded data bytes
//
//   BENCH_N=200000 node --import tsx benchmark/mappers.mjs
//
// Methodology: dedicated instances per line; the whole-node collection is
// resolved outside the timed region; each iteration writes a rotating
// value so nothing can be skipped as unchanged, and drains the mapper
// spans the way a frame would.

import { bench, group, summary } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeGpu, N } from './graph.mjs';

const elements = buildElements();

const COLOR_SHEET = {
  nodes: { 'background-color': { data: 'weight', domain: [ 0, 7 ], range: 'viridis' } }
};

const COLOR_SIZE_SHEET = {
  nodes: {
    'background-color': { data: 'weight', domain: [ 0, 7 ], range: 'viridis' },
    'width': { data: 'weight', domain: [ 0, 7 ], range: [ 10, 40 ] },
    'height': { data: 'weight', domain: [ 0, 7 ], range: [ 10, 40 ] }
  }
};

const LABEL_SHEET = { nodes: { label: { data: 'foo' } } };

function writeBench( name, sheet, key, owned ){
  const cy = makeGpu( elements );

  cy.style( sheet );

  if( owned != null ){ cy._styleEngine.setGpuOwned( 'nodes', owned ); }

  const nodes = cy.nodes();
  const store = cy._store;
  let i = 0;

  bench( name, () => {
    nodes.data( key, ( i++ % 7 ) + 0.5 );
    store.takeMapperSpans(); // a frame's consumption
  } );
}

console.log( `\n== mapper bulk-write sweep (N=${N} nodes, ${2 * N} edges) ==` );

group( 'mapper: bulk write, color', () => {
  summary( () => {
    writeBench( 'cpu eval', COLOR_SHEET, 'weight', null );
    writeBench( 'gpu path', COLOR_SHEET, 'weight', [ 'background-color' ] );
  } );
} );

group( 'mapper: bulk write, color + size', () => {
  summary( () => {
    writeBench( 'cpu eval', COLOR_SIZE_SHEET, 'weight', null );
    writeBench( 'gpu color / cpu size', COLOR_SIZE_SHEET, 'weight', [ 'background-color' ] );
  } );
} );

group( 'mapper: bulk write, mapped labels (round-5 path)', () => {
  summary( () => {
    writeBench( 'label refresh', LABEL_SHEET, 'foo', null );
  } );
} );

// one-off upload accounting for the gpu path (bytes a frame would writeBuffer)
{
  const cy = makeGpu( elements );

  cy.style( COLOR_SHEET );
  cy._styleEngine.setGpuOwned( 'nodes', [ 'background-color' ] );
  cy._store.takeMapperSpans();
  cy.nodes().data( 'weight', 1.5 );

  const spans = cy._store.takeMapperSpans();
  const dataBytes = spans.reduce( ( sum, span ) => sum + ( span.end - span.start ) * 5, 0 );

  console.log(
    `gpu-path upload per bulk color write: ~${dataBytes} B ` +
    `(f32 values + present bytes, ${spans.length} span(s)) ` +
    `vs ~${N * 4} B of fillColor column restyle on the cpu path`
  );
}

await finishRun( 'mappers' );

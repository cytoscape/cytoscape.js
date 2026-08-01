// Slot-compaction sweep (round 19.5): the shrink profile — a peak graph
// cut to 10% of its nodes — comparing the costs that stay proportional to
// the *peak* graph until slots compact, on the same instance before and
// after `cy.compact()`:
//
//  - the synchronous CPU node pick (a descending highWater walk; the
//    worst case is a background miss, which visits every lane),
//  - the GPU cull dispatch width (highWater lanes per group per frame —
//    reported, not timed: it needs a device),
//  - column capacity (the memory the peak pinned).
//
// Plus the one-shot cost of `compact()` itself at this scale.
//
// Removal here goes through the store (not eles.remove()) so the auto
// dead-slot trigger doesn't compact the "peak" side out from under the
// comparison — the point is to measure exactly what the trigger buys.
//
//   BENCH_N=200000 node --import tsx benchmark/gpu/compaction.mjs

import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeGpu, N } from './graph.mjs';
import { pickNodeAt } from '../../src/gpu/render/cpu-pick.mjs';

const KEEP_EVERY = 10;

function makeShrunk(){
  const cy = makeGpu( buildElements() );
  const store = cy._store;

  // store-level removal: no events, no auto trigger — a raw peak store
  for( let i = 0; i < N; i++ ){
    if( i % KEEP_EVERY === 0 ){ continue; }

    const ref = store.lookup( `n${i}` );

    if( ref == null ){ continue; }

    for( const edgeSlot of store.adj.connectedEdges( ref.slot ) ){
      store.removeEdge( edgeSlot );
    }

    store.removeNode( ref.slot );
  }

  return cy;
}

const peak = makeShrunk();
const compacted = makeShrunk();

const t0 = performance.now();

compacted.compact();

const compactMs = performance.now() - t0;

const frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };
// a miss forces the full descending walk — the hover-over-background case
const missX = 1e7;

console.log( `\n== slot-compaction sweep (N=${N} peak nodes → ${peak._store.count( 'nodes' )} live) ==` );
console.log( `compact(): ${compactMs.toFixed( 1 )} ms one-shot` );

for( const g of [ 'nodes', 'edges' ] ){
  console.log(
    `${g}: highWater ${peak._store.highWater( g )} → ${compacted._store.highWater( g )}` +
    ` (cull dispatch lanes per frame), capacity ${peak._store.capacity( g )} → ${compacted._store.capacity( g )} slots`
  );
}

group( 'cpu pick: background miss (full highWater walk)', () => {
  summary( () => {
    bench( 'peak', () => do_not_optimize( pickNodeAt( peak._store, frame, missX, 0 ) ) );
    bench( 'compacted', () => do_not_optimize( pickNodeAt( compacted._store, frame, missX, 0 ) ) );
  } );
} );

group( 'cpu pick: node hit', () => {
  const hit = ( cy ) => {
    const slot = cy._store.lookup( 'n0' ).slot;
    const pos = cy._store.column( 'node.position' );

    return { x: pos[ slot * 2 ], y: pos[ slot * 2 + 1 ] };
  };
  const peakAt = hit( peak );
  const compactedAt = hit( compacted );

  summary( () => {
    bench( 'peak', () => do_not_optimize( pickNodeAt( peak._store, frame, peakAt.x, peakAt.y ) ) );
    bench( 'compacted', () => do_not_optimize( pickNodeAt( compacted._store, frame, compactedAt.x, compactedAt.y ) ) );
  } );
} );

await finishRun( 'compaction' );

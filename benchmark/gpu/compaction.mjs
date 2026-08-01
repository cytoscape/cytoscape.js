// Slot-compaction sweep (round 19.5): the shrink profile — a peak graph
// cut to 10% of its nodes — measured on the same store before and after
// compaction, in four sections:
//
//  1. what compaction buys: the synchronous CPU node pick (a descending
//     highWater walk; the worst case is a background miss), plus the
//     reported GPU cull dispatch width and column memory (the renderer
//     bench's compaction scenario measures the device side for real);
//  2. what it costs: compact() one-shot, the auto-trigger path
//     (eles.remove() with the trigger vs a store-level removal without),
//     and the held-collection first-touch repair;
//  3. the forwarding overhead on the hot path: isCurrent() with forwards
//     present vs absent (expected parity), and the stale-ref chase;
//  4. honesty controls — what compaction does NOT change: order-list
//     scans and whole-graph bounds ride the insertion-order list, which
//     has self-compacted since round 11 (expected parity).
//
// Removal goes through the store where the peak state must survive —
// eles.remove() would auto-compact it out from under the comparison.
//
//   BENCH_N=200000 node --import tsx benchmark/gpu/compaction.mjs

import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeGpu, N } from './graph.mjs';
import { pickNodeAt } from '../../src/gpu/render/cpu-pick.mjs';
import { columnSpecsForGroup } from '../../src/gpu/contract.mjs';

const KEEP_EVERY = 10;

/** Store-level 90% cut (no events, no auto trigger): a raw peak store. */
function shrinkViaStore( cy ){
  const store = cy._store;
  const t0 = performance.now();

  for( let i = 0; i < N; i++ ){
    if( i % KEEP_EVERY === 0 ){ continue; }

    const ref = store.lookup( `n${i}` );

    if( ref == null ){ continue; }

    for( const edgeSlot of store.adj.connectedEdges( ref.slot ) ){
      store.removeEdge( edgeSlot );
    }

    store.removeNode( ref.slot );
  }

  return performance.now() - t0;
}

const columnBytes = ( cy, g ) => columnSpecsForGroup( g ).reduce(
  ( sum, spec ) => sum + spec.components * spec.ctor.BYTES_PER_ELEMENT * cy._store.capacity( g ), 0 );

const mb = bytes => `${( bytes / 1024 / 1024 ).toFixed( 1 )} MiB`;

// -- instances --

const peak = makeGpu( buildElements() );
const storeRemovalMs = shrinkViaStore( peak );

const compacted = makeGpu( buildElements() );

shrinkViaStore( compacted );

// held across the compaction: every surviving ref will move (measures
// the 19.3 first-touch repair below)
const held = compacted.nodes();

const tC = performance.now();

compacted.compact();

const compactMs = performance.now() - tC;

const tR = performance.now();

void held._refs; // the epoch-guarded getter repairs all held refs at once

const repairMs = performance.now() - tR;

// the trigger path: the same cut through the public API — the cascade,
// the remove emits, and the auto-compaction at the end, in one shot
const viaApi = makeGpu( buildElements() );
const tA = performance.now();

viaApi.nodes().filter( ( ele, i ) => i % KEEP_EVERY !== 0 ).remove();

const apiRemoveMs = performance.now() - tA;

if( viaApi._store.highWater( 'nodes' ) !== viaApi._store.count( 'nodes' ) ){
  throw new Error( 'expected the auto trigger to have compacted' );
}

// -- report: one-shots, widths, memory --

console.log( `\n== slot-compaction sweep (N=${N} peak nodes → ${compacted._store.count( 'nodes' )} live) ==` );
console.log( `compact(): ${compactMs.toFixed( 1 )} ms one-shot` );
console.log( `held-collection first-touch repair (${held.length} moved refs): ${repairMs.toFixed( 1 )} ms one-shot` );
console.log( `store-level removal (no trigger): ${storeRemovalMs.toFixed( 0 )} ms; ` +
  `eles.remove() incl. cascade + emits + auto-compaction: ${apiRemoveMs.toFixed( 0 )} ms` );

for( const g of [ 'nodes', 'edges' ] ){
  console.log(
    `${g}: highWater ${peak._store.highWater( g )} → ${compacted._store.highWater( g )}` +
    ` (cull dispatch lanes per frame), capacity ${peak._store.capacity( g )} → ${compacted._store.capacity( g )} slots` +
    ` (columns ${mb( columnBytes( peak, g ) )} → ${mb( columnBytes( compacted, g ) )})`
  );
}

// -- 1. what compaction buys: the CPU pick --

const frame = { panXPx: 0, panYPx: 0, zoomDpr: 1, hidePx: 1, nodeLodPx: 3 };
// a miss forces the full descending walk — the hover-over-background case
const missX = 1e7;

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

// -- 3. forwarding overhead on the hot path --

// isCurrent on a *current* ref: the fast path is one gen compare either
// way — forwards present (compacted: ~0.9 N entries) must not slow it
group( 'isCurrent: current ref (forwards present vs absent)', () => {
  const peakRef = peak._store.lookup( 'n0' );
  const compactedRef = compacted._store.lookup( 'n0' );

  summary( () => {
    bench( 'no forwards (peak)', () => do_not_optimize( peak._store.isCurrent( peakRef ) ) );
    bench( 'forwards present (compacted)', () => do_not_optimize( compacted._store.isCurrent( compactedRef ) ) );
  } );
} );

// the stale path: repair mutates the ref, so each iteration rebuilds a
// stale copy — the identical-alloc current-ref bench is the baseline
group( 'isCurrent: stale-ref repair (chase + rewrite, alloc included)', () => {
  const store = compacted._store;
  const liveRef = store.lookup( 'n0' );
  const liveSlot = liveRef.slot;
  const liveGen = store.table( 'nodes' ).gen[ liveSlot ];
  // a moved survivor's pre-compaction identity: elements were added in
  // id order, so n_k sat at slot k with gen 0 — any keeper past the
  // stable prefix moved and has a forwarding entry
  const oldSlot = KEEP_EVERY * Math.floor( N / KEEP_EVERY / 2 );

  if( !store.isCurrent( { group: 'nodes', slot: oldSlot, gen: 0 } ) ){
    throw new Error( 'expected the stale probe identity to repair' );
  }

  summary( () => {
    bench( 'current (baseline alloc)', () => {
      const ref = { group: 'nodes', slot: liveSlot, gen: liveGen };

      do_not_optimize( store.isCurrent( ref ) );
    } );
    bench( 'stale → repair', () => {
      const ref = { group: 'nodes', slot: oldSlot, gen: 0 };

      do_not_optimize( store.isCurrent( ref ) );
    } );
  } );
} );

// -- 4. honesty controls: what compaction does NOT change --

// order-list scans and whole-graph bounds iterate the insertion-order
// list (tombstone-compacting since round 11), not highWater — parity
group( 'control: nodes({ selected }) scan (order-list, expected parity)', () => {
  peak.nodes().filter( ( ele, i ) => i % 7 === 0 ).select();
  compacted.nodes().filter( ( ele, i ) => i % 7 === 0 ).select();

  summary( () => {
    bench( 'peak', () => do_not_optimize( peak.nodes( { selected: true } ) ) );
    bench( 'compacted', () => do_not_optimize( compacted.nodes( { selected: true } ) ) );
  } );
} );

group( 'control: whole-graph boundingBox (expected parity)', () => {
  summary( () => {
    bench( 'peak', () => do_not_optimize( peak.elements().boundingBox( { includeLabels: false } ) ) );
    bench( 'compacted', () => do_not_optimize( compacted.elements().boundingBox( { includeLabels: false } ) ) );
  } );
} );

await finishRun( 'compaction' );

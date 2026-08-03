// Store-internals, image-registry and chart sweep (round 33.8).
//
// gpu-only throughout, and deliberately so: v3 has no counterpart to any
// of it.  These are the structures every bulk path funnels through — the
// blob-native id index, CSR adjacency, the variable-length blob pools,
// the dirty tracker — plus the two draw-only subsystems whose *CPU* side
// nothing has priced (round 15's image registry and round 23's chart
// records).  compaction.mjs proves the round-11 reclaims hold; it prices
// none of them.
//
//   node --import tsx benchmark/gpu/store.mjs             # N=2000
//   BENCH_N=200000 BENCH_OP=id node --import tsx benchmark/gpu/store.mjs
//
// Structures are driven directly rather than through the public API, so
// a row is the structure's cost and not the API's.  Where a row mutates,
// it is a reversible round-trip or it rebuilds from a fixed input.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { IdMap } from '../../src/gpu/store/id-map.mjs';
import { Adjacency } from '../../src/gpu/store/adjacency.mjs';
import { CurveBlob } from '../../src/gpu/store/curve-blob.mjs';
import { DirtyTracker } from '../../src/gpu/store/dirty.mjs';
import { ImageRegistry } from '../../src/gpu/image-registry.mjs';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeGpu, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();
const instances = [];
const has = name => OP == null || name.includes( OP );

console.log( `\n== store internals sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- the id index -------------------------------------------------------------
// Blob-native: UTF-8 bytes plus an open-addressing probe table, with no
// stored JS strings, so `idAt` is the only place a string is
// materialized (its own doc comment says so).  These three rows are the
// three things the index does.
if( has( 'id' ) ){
  const ids = Array.from( { length: N }, ( _, i ) => 'n' + i );

  const filled = () => {
    const map = new IdMap();

    for( let i = 0; i < N; i++ ){ map.set( ids[ i ], 'nodes', i ); }

    return map;
  };

  const map = filled();
  let i = 0;

  group( `id index: set x ${N} (build)`, () => {
    bench( 'gpu', () => do_not_optimize( filled() ) );
  } );

  group( 'id index: single-key operations', () => {
    summary( () => {
      bench( 'get (probe)', () => do_not_optimize( map.get( ids[ ( i++ ) % N ] ) ) );
      bench( 'has', () => do_not_optimize( map.has( ids[ ( i++ ) % N ] ) ) );
      // `idAt` is the only call that materializes a JS string — but it
      // memoizes into a per-slot name cache, so this row is the *cached*
      // hit (9 ns, cheaper than a probe).  The cold decode is not
      // separable through the public surface, and that is the useful
      // fact: an id decodes once per slot, ever.
      bench( 'idAt (memoized hit)', () => do_not_optimize( map.idAt( 'nodes', ( i++ ) % N ) ) );
      bench( 'hashAt', () => do_not_optimize( map.hashAt( 'nodes', ( i++ ) % N ) ) );
    } );
  } );

  // remove strands the id's bytes; past half the blob they compact into a
  // fresh right-sized one (round 11).  A round-trip keeps the map's size
  // stable across iterations.
  group( 'id index: remove + re-set (churn, drives the round-11 reclaim)', () => {
    bench( 'gpu', () => {
      const k = ( i++ ) % N;

      map.remove( ids[ k ] );
      map.set( ids[ k ], 'nodes', k );
    } );
  } );
}

// -- CSR adjacency ------------------------------------------------------------
// Built in two counting passes from the endpoints column; incremental
// adds accumulate in a per-node overlay until a rebuild folds them in.
if( has( 'adjacency' ) ){
  const edgeCount = 2 * N;
  const edgeSlots = new Uint32Array( edgeCount );
  const endpoints = new Uint32Array( edgeCount * 2 );

  for( let e = 0; e < edgeCount; e++ ){
    edgeSlots[ e ] = e;
    endpoints[ e * 2 ] = e % N;
    endpoints[ e * 2 + 1 ] = ( e + 1 ) % N;
  }

  const built = () => {
    const adj = new Adjacency();

    adj.rebuild( edgeSlots, endpoints, N );

    return adj;
  };

  const adj = built();
  let i = 0;

  group( `adjacency: rebuild (${edgeCount} edges, two counting passes)`, () => {
    bench( 'gpu', () => do_not_optimize( built() ) );
  } );

  group( 'adjacency: reads', () => {
    summary( () => {
      bench( 'outDegree (O(1))', () => do_not_optimize( adj.outDegree( ( i++ ) % N ) ) );
      bench( 'outEdges', () => do_not_optimize( adj.outEdges( ( i++ ) % N ) ) );
      bench( 'connectedEdges', () => do_not_optimize( adj.connectedEdges( ( i++ ) % N ) ) );
    } );
  } );

  // an incremental add lands in the overlay, not in CSR
  group( 'adjacency: addEdge + removeEdge (the overlay path)', () => {
    bench( 'gpu', () => {
      const s = ( i++ ) % N;

      adj.addEdge( edgeCount + 1, s, ( s + 5 ) % N );
      adj.removeEdge( edgeCount + 1, s, ( s + 5 ) % N );
    } );
  } );
}

// -- the blob pool ------------------------------------------------------------
// The variable-length record store behind curve params, custom polygons,
// image lists and charts.  Same-length rewrites land in place; freed
// ranges are metered and compact past waste > half live.
if( has( 'blob' ) ){
  const record = new Float32Array( 12 );

  for( let k = 0; k < record.length; k++ ){ record[ k ] = k; }

  const filled = () => {
    const blob = new CurveBlob( () => {} );

    for( let s = 0; s < N; s++ ){ blob.write( s, record ); }

    return blob;
  };

  const blob = filled();
  let i = 0;

  group( `blob: write x ${N} (build)`, () => {
    bench( 'gpu', () => do_not_optimize( filled() ) );
  } );

  group( 'blob: single-record operations', () => {
    summary( () => {
      bench( 'rewrite in place (same length)', () => do_not_optimize( blob.write( ( i++ ) % N, record ) ) );
      bench( 'offsetOf', () => do_not_optimize( blob.offsetOf( ( i++ ) % N ) ) );
      bench( 'free + rewrite', () => {
        const s = ( i++ ) % N;

        blob.free( s );
        blob.write( s, record );
      } );
    } );
  } );
}

// -- the dirty tracker --------------------------------------------------------
// One coalesced [min, end) span per column per frame.  Every column write
// in the store goes through `mark`, so its cost is paid by every write
// path in this whole benchmark directory.
if( has( 'dirty' ) ){
  const tracker = new DirtyTracker( () => {} );
  let i = 0;

  group( 'dirty: mark (per-write span coalescing)', () => {
    summary( () => {
      bench( 'contiguous marks', () => { tracker.mark( 'node.position', ( i++ ) % N ); } );
      bench( 'scattered marks', () => { tracker.mark( 'node.position', ( ( i++ ) * 977 ) % N ); } );
    } );
  } );

  group( 'dirty: take (a frame\'s drain)', () => {
    bench( 'gpu', () => {
      for( let k = 0; k < 64; k++ ){ tracker.mark( 'node.position', k * 7 ); }

      return do_not_optimize( tracker.take( N, 2 * N ) );
    } );
  } );
}

// -- the image registry (round 15) --------------------------------------------
// Unique images dedup by (kind, crossorigin, url) into refcounted
// entries; ids are slots that recycle through a free list.  Headless, no
// decoder attached — so this is the bookkeeping cost, which is the part
// a style apply pays per element.
if( has( 'image' ) ){
  const urls = Array.from( { length: 64 }, ( _, k ) => `https://example.invalid/icon-${k}.svg` );
  const registry = new ImageRegistry();
  const held = urls.map( u => registry.acquire( u, 0 ) );
  let i = 0;

  group( 'images: registry bookkeeping', () => {
    summary( () => {
      // the icon-per-type case: the url is already known
      bench( 'acquire (existing url)', () => {
        const id = registry.acquire( urls[ ( i++ ) & 63 ], 0 );

        registry.release( id );
      } );
      // a url never seen before: a fresh entry, then reclaimed
      bench( 'acquire (new url) + release', () => {
        const id = registry.acquire( `https://example.invalid/fresh-${i++}.svg`, 0 );

        registry.release( id );
      } );
    } );
  } );

  do_not_optimize( held );
}

// -- charts (round 23) --------------------------------------------------------
// A chart record is written per element at style-write: header plus n
// (value, packed rgba) pairs into a blob pool.  The `{ data }`
// passthrough re-writes them on every write of the mapped key, which is
// the case an app with live data actually runs.
if( has( 'chart' ) ){
  const cy = makeGpu( elements );

  instances.push( cy );

  // per-element pie values in the sidecar (the headline capability)
  cy.nodes().forEach( n => n.data( 'slices', [ 0.2, 0.3, 0.5 ] ) );

  const CHART = {
    nodes: { chart: 'pie', 'chart-values': { data: 'slices' }, width: 30, height: 30 }
  };
  const PLAIN = { nodes: { width: 30, height: 30 } };
  let i = 0;

  group( 'charts: sheet apply, chart vs no chart', () => {
    summary( () => {
      bench( 'no chart', () => { cy.style( { ...PLAIN, nodes: { ...PLAIN.nodes, width: 30 + ( i++ & 1 ) } } ); } );
      bench( 'pie from data (blob record per node)', () => {
        cy.style( { ...CHART, nodes: { ...CHART.nodes, width: 30 + ( i++ & 1 ) } } );
      } );
    } );
  } );

  cy.style( CHART );

  const nodes = cy.nodes();

  group( 'charts: data write refreshing chart-values', () => {
    bench( 'gpu', () => {
      nodes.data( 'slices', ( i++ & 1 ) === 0 ? [ 0.2, 0.3, 0.5 ] : [ 0.4, 0.4, 0.2 ] );
    } );
  } );
}

await finishRun( 'store' );

for( const cy of instances ){ cy.destroy(); }

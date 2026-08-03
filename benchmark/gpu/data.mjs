// data() sidecar + structured query sweep (round 33.6).
//
// mutators.mjs has one `data set` row (whose own record calls it
// GC-noisy at 200k) and materializers.mjs covers the flag scans
// thoroughly.  Neither touches what makes v4's data layer different: the
// sidecar adapts its storage per (group, key) — Float64Array + a present
// mask for numbers, a dictionary for strings, a plain array for
// everything else — and the query IR grew data conditions (round 10 A8)
// and structural terms (round 14.7) that are the documented replacement
// for v3's selectors.
//
//   node --import tsx benchmark/gpu/data.mjs              # N=2000
//   BENCH_N=200000 BENCH_OP=write node --import tsx benchmark/gpu/data.mjs
//
// Each write row rotates its written value so nothing can be skipped as
// unchanged, and the query rows compare against the *idiomatic* v3
// spelling of the same question (a selector string), which is what a v3
// user porting an app would actually reach for.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();
const instances = [];
const has = name => OP == null || name.includes( OP );

function v3Instance(){
  const cy = makeV3( elements, { styleEnabled: true, layout: { name: 'preset' } } );

  instances.push( cy );

  return cy;
}

function gpuInstance(){
  const cy = makeGpu( elements );

  instances.push( cy );

  return cy;
}

console.log( `\n== data sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- the column kinds ---------------------------------------------------------
// One key per storage kind, written across the whole node set.  This is
// the axis nothing has measured: the numeric column is a typed array
// with a present mask, the string column is dictionary-encoded (so a
// write is a dictionary lookup plus an index store, and a *new* value
// grows the dictionary), and the object column falls back to a plain
// array.
if( has( 'write' ) ){
  const gpu = gpuInstance();
  const v3 = v3Instance();
  const nodes = gpu.nodes();
  const v3Nodes = v3.nodes();
  let i = 0;

  group( 'data: bulk write, numeric column', () => {
    summary( () => {
      bench( 'v3',  () => { v3Nodes.data( 'num', ( i++ % 7 ) + 0.5 ); } );
      bench( 'gpu', () => { nodes.data( 'num', ( i++ % 7 ) + 0.5 ); } );
    } );
  } );

  // a small value set: every write hits an existing dictionary entry
  const CATS = [ 'alpha', 'beta', 'gamma', 'delta' ];

  group( 'data: bulk write, dictionary string column (4 values)', () => {
    summary( () => {
      bench( 'v3',  () => { v3Nodes.data( 'cat', CATS[ i++ & 3 ] ); } );
      bench( 'gpu', () => { nodes.data( 'cat', CATS[ i++ & 3 ] ); } );
    } );
  } );

  // a value never seen before, so each pass adds one dictionary entry and
  // drops the reference count of the previous one — the round-11 reclaim
  // path.  Note what this row does *not* measure: every element gets the
  // *same* fresh value, so the dictionary grows by one entry per pass and
  // not by one per element.  Per-element distinct strings would need a
  // per-element loop, which would measure the loop on both sides rather
  // than the column; the honest name is what the row does.
  group( 'data: bulk write, one new dictionary entry per pass', () => {
    summary( () => {
      bench( 'v3',  () => { v3Nodes.data( 'uniq', 'v' + ( i++ ) ); } );
      bench( 'gpu', () => { nodes.data( 'uniq', 'v' + ( i++ ) ); } );
    } );
  } );

  // objects have no columnar form on either side: the fallback array
  group( 'data: bulk write, object column (plain-array fallback)', () => {
    summary( () => {
      bench( 'v3',  () => { v3Nodes.data( 'obj', { k: i++ } ); } );
      bench( 'gpu', () => { nodes.data( 'obj', { k: i++ } ); } );
    } );
  } );

  group( 'data: removeData (whole collection)', () => {
    summary( () => {
      bench( 'v3',  () => { v3Nodes.data( 'tmp', 1 ); v3Nodes.removeData( 'tmp' ); } );
      bench( 'gpu', () => { nodes.data( 'tmp', 1 ); nodes.removeData( 'tmp' ); } );
    } );
  } );
}

// -- reads --------------------------------------------------------------------
if( has( 'read' ) ){
  const K = 8;
  const MASK = K - 1;
  const gpu = gpuInstance();
  const v3 = v3Instance();

  gpu.nodes().data( 'cat', 'alpha' );
  v3.nodes().data( 'cat', 'alpha' );

  const gs = Array.from( { length: K }, ( _, k ) => gpu.$id( 'n' + ( MIDNUM + k ) ) );
  const vs = Array.from( { length: K }, ( _, k ) => v3.getElementById( 'n' + ( MIDNUM + k ) ) );
  let i = 0;

  const cmpRead = ( name, op ) => {
    group( name, () => {
      summary( () => {
        bench( 'v3',  () => { const k = ( i++ ) & MASK; return do_not_optimize( op( vs[ k ] ) ); } );
        bench( 'gpu', () => { const k = ( i++ ) & MASK; return do_not_optimize( op( gs[ k ] ) ); } );
      } );
    } );
  };

  cmpRead( 'data: read one numeric key', n => n.data( 'foo' ) );
  cmpRead( 'data: read one string key (dictionary decode)', n => n.data( 'cat' ) );
  cmpRead( 'data: read the whole object', n => n.data() );
}

// -- structured queries -------------------------------------------------------
// The comparison a porting v3 user makes: a selector string against the
// query object that replaced it.  Both sides answer the same question
// over the same graph.
if( has( 'query' ) ){
  const gpu = gpuInstance();
  const v3 = v3Instance();

  // a spread of values so the predicates are not trivially all-or-nothing
  for( let k = 0; k < 7; k++ ){
    const sel = i => i % 7 === k;

    gpu.nodes().filter( n => sel( n.data( 'foo' ) ) ).data( 'bucket', k );
    v3.nodes().filter( n => sel( n.data( 'foo' ) ) ).data( 'bucket', k );
  }

  group( 'query: data equality ([bucket = 3] vs { data: { bucket: 3 } })', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes( '[bucket = 3]' ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes( { data: { bucket: 3 } } ) ) );
    } );
  } );

  group( 'query: data comparison ([weight > 3] vs { gt })', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes( '[weight > 3]' ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes( { data: { weight: { gt: 3 } } } ) ) );
    } );
  } );

  group( 'query: two keys AND-ed', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes( '[weight > 2][bucket < 5]' ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes( { data: { weight: { gt: 2 }, bucket: { lt: 5 } } } ) ) );
    } );
  } );

  group( 'query: membership ([bucket in ...] vs { in })', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes( '[bucket = 1], [bucket = 2], [bucket = 5]' ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes( { data: { bucket: { in: [ 1, 2, 5 ] } } } ) ) );
    } );
  } );

  // the predicate form, which is v4's answer to everything richer — and
  // the one that pays per-element handle materialization on both sides
  group( 'query: predicate function (both sides)', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes().filter( n => n.data( 'weight' ) > 3 ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes().filter( n => n.data( 'weight' ) > 3 ) ) );
    } );
  } );
}

// -- structural queries -------------------------------------------------------
// Round 14.7's `parent`/`child` booleans against v3's `:parent` /
// `:childless` / `:child` / `:orphan` pseudos — pure flag scans on the v4
// side, with no data columns involved at all.
if( has( 'structural' ) ){
  const CLUSTER = 20;
  const clusters = Math.max( 1, Math.floor( N / CLUSTER ) );
  const compoundEles = () => {
    const out = [];

    for( let c = 0; c < clusters; c++ ){ out.push( { data: { id: 'p' + c } } ); }

    for( let i = 0; i < N; i++ ){
      out.push( {
        data: { id: 'n' + i, foo: i, weight: i % 7, parent: 'p' + ( i % clusters ) },
        position: { x: ( i % 100 ) * 10, y: Math.floor( i / 100 ) * 10 }
      } );
    }

    return out;
  };

  const eles = compoundEles();
  const gpu = makeGpu( eles );
  const v3 = makeV3( eles, { styleEnabled: true, layout: { name: 'preset' } } );

  instances.push( gpu, v3 );

  group( 'query: structural, parents (:parent vs { parent: true })', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes( ':parent' ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes( { parent: true } ) ) );
    } );
  } );

  group( 'query: structural, childless (:childless vs { parent: false })', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes( ':childless' ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes( { parent: false } ) ) );
    } );
  } );

  group( 'query: structural, orphans (:orphan vs { child: false })', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.nodes( ':orphan' ) ) );
      bench( 'gpu', () => do_not_optimize( gpu.nodes( { child: false } ) ) );
    } );
  } );
}

await finishRun( 'data' );

for( const cy of instances ){ cy.destroy(); }

// Focused bulk-mutation sweep: v3 vs GPU/v4 at BENCH_N scale.
//
// Standalone (not part of index.mjs): covers collection-scale *writes* —
// the half the read-oriented suites don't touch — so it stays runnable at
// scales (BENCH_N=200000) where the full suite's v3-side ops would take
// too long.
//
//   BENCH_N=200000 BENCH_OP=select node --import tsx benchmark/gpu/mutators.mjs
//
// BENCH_OP (substring match on the group name) registers only matching
// groups.  At BENCH_N=200000 every group holds a dedicated v3 + gpu
// instance pair, and eight v3 instances of a 200k/400k graph exceed the
// default heap — run one group per process at that scale.
//
// Methodology: each group gets dedicated instances so mutations can't
// contaminate other groups.  Whole-graph operands are resolved once,
// outside the timed region — flag/position/data writes never invalidate
// handles on either implementation.  Every op is a reversible round-trip
// (or value-rotating, for idempotent setters) so the graph is in the same
// state at the start of every iteration.

import { run, bench, group, summary } from 'mitata';
import { buildElements, makeV3, makeGpu, N } from './graph.mjs';

const elements = buildElements();

/**
 * Compare a bulk mutation on dedicated instances.  `setup(cy)` resolves the
 * operand outside the timed region; `fn(operand, i, cy)` runs the mutation.
 * `v3opts` lets a group enable options on the v3 side (e.g. styleEnabled for
 * ops that are style-bypass no-ops without it).
 */
const OP = process.env.BENCH_OP;

function cmpMut( name, setup, fn, v3opts, gpuFn = fn ){
  if( OP != null && !name.includes( OP ) ){ return; }

  const a = makeV3( elements, v3opts );
  const b = makeGpu( elements );
  const ta = setup( a );
  const tb = setup( b );
  let i = 0;

  group( name, () => {
    summary( () => {
      bench( 'v3',  () => { fn( ta, i++, a ); } );
      bench( 'gpu', () => { gpuFn( tb, i++, b ); } );
    } );
  } );
}

const nodes = cy => cy.nodes();

console.log( `\n== bulk mutation sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- flags --
cmpMut( 'mut-bulk: select + unselect', nodes, n => { n.select(); n.unselect(); } );
// v3 hide/show is a style bypass (display: none), so its v3 instance needs
// styleEnabled; the gpu side is a flag write either way.
cmpMut( 'mut-bulk: hide + show', nodes, n => { n.hide(); n.show(); }, { styleEnabled: true } );
cmpMut( 'mut-bulk: lock + unlock', nodes, n => { n.lock(); n.unlock(); } );

// -- positions --
cmpMut( 'mut-bulk: positions(obj)', nodes, ( n, i ) => n.positions( { x: i & 1023, y: 7 } ) );
cmpMut( 'mut-bulk: positions(fn)', nodes,
  ( n, i ) => n.positions( ( ele, j ) => ( { x: j & 1023, y: i & 7 } ) ) );
cmpMut( 'mut-bulk: shift', nodes,
  ( n, i ) => n.shift( { x: ( i & 1 ) === 0 ? 1 : -1, y: 0 } ) );

// -- data --
cmpMut( 'mut-bulk: data set', nodes, ( n, i ) => n.data( 'foo', i & 7 ) );

// -- remove + re-add --
// A fixed band of nodes (cascading to their incident edges), re-added from
// defs captured up front; the band collection is re-resolved per iteration
// (an id comma list — both sides have id fast paths) because a remove +
// re-add cycle invalidates prior handles on both implementations.
const BAND = Math.min( 256, Math.floor( N / 4 ) );
const bandSel = Array.from( { length: BAND }, ( _, i ) => '#n' + i ).join( ', ' );

// idiomatic v4 band resolution: per-id index lookups + union (no selector
// strings in v4); both sides go through their id fast path either way
const bandOf = cy => {
  let eles = cy.collection();

  for( let i = 0; i < BAND; i++ ){ eles = eles.union( cy.$id( 'n' + i ) ); }

  return eles;
};

function setupRemove( cy ){
  // capture defs of the full removal closure (band + incident edges) up
  // front — jsons() after removal loses edge endpoints on the gpu side
  const band = bandOf( cy );
  const closure = band.union( band.connectedEdges() );

  return closure.jsons();
}

cmpMut( `mut-bulk: remove + re-add (${BAND} nodes + cascade)`, setupRemove,
  ( defs, i, cy ) => { cy.$( bandSel ).remove(); cy.add( defs ); },
  undefined,
  ( defs, i, cy ) => { bandOf( cy ).remove(); cy.add( defs ); } );

await run();

// the styleEnabled v3 instance keeps an animation-loop timer alive
process.exit( 0 );

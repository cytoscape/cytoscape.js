// Scenario-level (macro) sweep: v3 vs GPU/v4 at BENCH_N scale.
//
// Standalone (not part of index.mjs).  The micro suites measure ops in
// isolation and — deliberately — with no listeners registered, which means
// they never exercise the listener-gated emit paths (per-element select/
// position/data emits) and never show how the ops compose in a real
// interaction loop.  Each group here replays a small composed trace the way
// an app would run it, WITH core listeners attached, so the numbers answer
// two questions the micro suites can't:
//
//   1. Do the micro wins survive listener-on emit costs and op composition?
//   2. Does the traversal handle-materialization floor (~2-5x, structural;
//      see PLAN.md "Lazy / slot-backed collections") actually dominate any
//      realistic trace — i.e. is the lazy-collection call worth making?
//
//   BENCH_N=200000 BENCH_OP=explore node --import tsx benchmark/gpu/scenarios.mjs
//
// BENCH_OP (substring match on the group name) registers only matching
// groups; at BENCH_N=200000 run one group per process (see mutators.mjs).
//
// Methodology: dedicated instance pairs per group; operands that survive
// mutation are resolved outside the timed region; every trace is a
// reversible round-trip (or value-rotating) so the graph state is the same
// at the start of every iteration.  v3 instances run styleEnabled with a
// preset layout — the realistic app configuration, and required for
// meaningful bounds/fit on the v3 side (headless non-styleEnabled bounds
// are degenerate, and the default grid layout would overwrite the
// fixture's def positions).  The v3 headless viewport is 1x1 px, so fit()
// clamps zoom to minZoom there; the measured work (the bounds scan + fit
// math) is unaffected.  Listener counters are logged after the run as a
// sanity check that the emit paths actually fired on both sides.

import { bench, group, summary } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const elements = buildElements();
const OP = process.env.BENCH_OP;

const V3_OPTS = { styleEnabled: true, layout: { name: 'preset' } };

// state objects collected for the post-run listener-count sanity log
const states = [];

/**
 * Compare a composed trace on dedicated instances.  `setup(cy)` registers
 * listeners and resolves surviving operands outside the timed region,
 * returning a state object; `fn(state, i, cy)` runs one trace iteration.
 * `opts.gpuSetup`/`opts.gpuFn` override the gpu side where the idiomatic
 * v4 form differs (v4 has no selector strings).
 */
function scenario( name, setup, fn, opts = {} ){
  if( OP != null && !name.includes( OP ) ){ return; }

  const a = makeV3( elements, V3_OPTS );
  const b = makeGpu( elements );
  const sa = setup( a );
  const sb = ( opts.gpuSetup ?? setup )( b );
  const gpuFn = opts.gpuFn ?? fn;
  let i = 0;

  states.push( { name, v3: sa, gpu: sb } );

  group( name, () => {
    summary( () => {
      bench( 'v3',  () => { fn( sa, i++, a ); } );
      bench( 'gpu', () => { gpuFn( sb, i++, b ); } );
    } );
  } );
}

console.log( `\n== scenario sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- explore: click a node, expand its 2-hop neighborhood, move the --------
// -- selection there, fit the view to it (select/unselect listeners) -------
// The trace an explorer app runs per click: id lookup, closedNeighborhood +
// a second hop (union/nodes/neighborhood composition — the handle-
// materialization floor lives here), selection swap with per-element emits,
// fit to a small collection.  Per-interaction cost, so it should stay ~flat
// in N on the gpu side.
scenario( 'scn: explore (expand 2-hop + select + fit)',
  cy => {
    const counts = { select: 0, unselect: 0 };

    cy.on( 'select', () => { counts.select++; } );
    cy.on( 'unselect', () => { counts.unselect++; } );

    return { cy, counts, prev: cy.collection() };
  },
  ( s, i ) => {
    const n = s.cy.$id( 'n' + ( MIDNUM + ( i & 63 ) ) );
    const hood = n.closedNeighborhood();
    const hood2 = hood.union( hood.nodes().neighborhood() );

    s.prev.unselect();
    hood2.select();
    s.prev = hood2;

    s.cy.fit( hood2, 20 );
  } );

// -- select-all: whole-graph selection round-trip with listeners on, -------
// -- plus a whole-graph fit ------------------------------------------------
// The listener-on counterpart of the mutators.mjs select round-trip: every
// element select/unselect now emits (2N listener calls per iteration), so
// the delta against the mutators line is the pure emit overhead.  fit() is
// the no-arg whole-graph path (columnar bounds scan on the gpu side).
scenario( 'scn: select-all + fit (listeners on)',
  cy => {
    const counts = { select: 0, unselect: 0 };

    cy.on( 'select', () => { counts.select++; } );
    cy.on( 'unselect', () => { counts.unselect++; } );

    return { cy, counts };
  },
  s => {
    s.cy.nodes().select();
    s.cy.fit();
    s.cy.nodes( ':selected' ).unselect();
  },
  { gpuFn: s => {
    s.cy.nodes().select();
    s.cy.fit();
    s.cy.nodes( { selected: true } ).unselect();
  } } );

// -- drag: select a band, drag it in 8 shift steps (position listener), ----
// -- drop it ----------------------------------------------------------------
// A grab-drag-release of a 100-node selection with a position handler
// attached (minimap/tooltip apps do exactly this): 8 x 100 position emits
// per iteration on top of the columnar shift.  Direction alternates so the
// net offset stays bounded.
const DRAG_BAND = Math.min( 100, Math.floor( N / 4 ) );

// id-band resolution that is idiomatic on both sides (v4 has no selector
// strings): per-id index lookups + union
const bandOf = ( cy, n ) => {
  let eles = cy.collection();

  for( let i = 0; i < n; i++ ){ eles = eles.union( cy.$id( 'n' + i ) ); }

  return eles;
};

scenario( `scn: drag (select band of ${DRAG_BAND} + 8-step shift, position listener)`,
  cy => {
    const counts = { position: 0 };

    cy.on( 'position', () => { counts.position++; } );

    // position/flag writes never invalidate handles on either side
    return { cy, counts, band: bandOf( cy, DRAG_BAND ) };
  },
  ( s, i ) => {
    s.band.select();

    const dx = ( i & 1 ) === 0 ? 2 : -2;

    for( let step = 0; step < 8; step++ ){
      s.band.shift( { x: dx, y: 0 } );
    }

    s.band.unselect();
  } );

// -- edit: delete a band (cascading to incident edges) and restore it, -----
// -- with add/remove listeners ----------------------------------------------
// The structural counterpart of the mutators.mjs remove + re-add group; the
// delta against that (listener-free) line is the add/remove emit overhead.
const EDIT_BAND = Math.min( 256, Math.floor( N / 4 ) );
const editSel = Array.from( { length: EDIT_BAND }, ( _, i ) => '#n' + i ).join( ', ' );

scenario( `scn: edit (remove + re-add ${EDIT_BAND} nodes + cascade, add/remove listeners)`,
  cy => {
    const counts = { add: 0, remove: 0 };

    cy.on( 'add', () => { counts.add++; } );
    cy.on( 'remove', () => { counts.remove++; } );

    // capture defs of the full removal closure up front (see mutators.mjs)
    const band = bandOf( cy, EDIT_BAND );
    const defs = band.union( band.connectedEdges() ).jsons();

    return { cy, counts, defs };
  },
  ( s ) => {
    s.cy.$( editSel ).remove();
    s.cy.add( s.defs );
  },
  { gpuFn: ( s ) => {
    bandOf( s.cy, EDIT_BAND ).remove();
    s.cy.add( s.defs );
  } } );

// -- refresh: bulk data write under a mapped label + data listener, --------
// -- then filter and fit to the hot subset ----------------------------------
// A dashboard tick: new values arrive for every node (data emits per
// element; the label 'data(foo)' mapper makes every write refresh label
// state on both sides), then the view narrows to a data-derived subset.
// filter(fn) reads data per element — the handle floor again, at N scale.
const refreshFn = ( s, i ) => {
  s.nodes.data( 'foo', i & 7 );

  const hot = s.nodes.filter( ele => ele.data( 'weight' ) === 3 ); // ~N/7

  s.cy.fit( hot, 10 );
};

scenario( 'scn: refresh (bulk data write + mapped labels + filter + fit, data listener)',
  cy => {
    const counts = { data: 0 };

    cy.style( [ { selector: 'node', style: { label: 'data(foo)' } } ] );
    cy.on( 'data', () => { counts.data++; } );

    return { cy, counts, nodes: cy.nodes() };
  },
  refreshFn,
  { gpuSetup: cy => {
    const counts = { data: 0 };

    cy.style( { nodes: { label: 'data(foo)' } } ); // the v4 sheet shape
    cy.on( 'data', () => { counts.data++; } );

    return { cy, counts, nodes: cy.nodes() };
  } } );

await finishRun( 'scenarios' );

// sanity: the listener-on paths must actually have fired on both sides
for( const s of states ){
  console.log( `\n${s.name}` );
  console.log( `  v3  emits: ${JSON.stringify( s.v3.counts )}` );
  console.log( `  gpu emits: ${JSON.stringify( s.gpu.counts )}` );
}

// the styleEnabled v3 instances keep an animation-loop timer alive
process.exit( 0 );

/*
Round 29.4: what curved edges cost the CPU — pure Node, no GPU.

Round 12 benchmarked the *device* side of curved edges (the renderer
bench's curved pan scene: the vertex work of extruding 24-quad strips).
Nothing measured the CPU side, which is the half that runs on every
endpoint move at graph scale: the parallel-edge bundle map, per-edge
control-point derivation, the curve-aware accessors, the conservative
curve-hull term in bounds, and the exact curve-vs-rect test in box
selection.

Every number here is reported against the same operation on a
*straight* graph of identical shape, so what is printed is the **curve
premium** rather than the ambient cost of the operation.  The bundled
scene is the expensive one by construction: BUNDLE parallel edges per
node pair, so every endpoint move re-fans a whole bundle.

  node --import tsx benchmark/curves.mjs              # 20k nodes
  BENCH_N=100000 node --import tsx benchmark/curves.mjs
  BENCH_BUNDLE=1 node --import tsx benchmark/curves.mjs   # no parallelism
*/

import cytoscape from '../src/index.mjs';
import { finishManualRun } from './bench-run.mjs';

const N = Number( process.env.BENCH_N ?? 20000 );
const BUNDLE = Number( process.env.BENCH_BUNDLE ?? 4 );
const PAIRS = Math.floor( N / 2 );
const EDGES = PAIRS * BUNDLE;

/** One measurement, reported per unit of work. */
const time = ( fn ) => {
  const t0 = performance.now();

  fn();

  return performance.now() - t0;
};

const rows = [];

/**
 * Run `fn` on a curved graph and on the straight graph of the same
 * shape, and record the ratio.  Each side runs once unmeasured first:
 * whichever was measured first would otherwise pay this suite's JIT
 * warmup and read slower for no reason of its own.  What is reported is
 * therefore steady state — which is also what the mutating benches want,
 * since they invalidate the lazy caches on every iteration anyway.
 */
const compare = ( label, unit, count, fn ) => {
  fn( curved );
  fn( straight );

  const curvedMs = time( () => fn( curved ) );
  const straightMs = time( () => fn( straight ) );
  const ratio = straightMs === 0 ? Infinity : curvedMs / straightMs;

  rows.push( { label, unit, count, curvedMs, straightMs, ratio } );

  console.log(
    `${label.padEnd( 38 )} curved ${curvedMs.toFixed( 1 ).padStart( 8 )} ms  ` +
    `straight ${straightMs.toFixed( 1 ).padStart( 8 )} ms  ` +
    `${ratio.toFixed( 2 )}x  (${( curvedMs * 1e6 / count ).toFixed( 0 )} ns/${unit})` );
};

/** PAIRS node pairs, BUNDLE parallel edges each. */
const elements = () => {
  const eles = [];

  for( let i = 0; i < PAIRS; i++ ){
    eles.push( { data: { id: `a${i}` }, position: { x: ( i % 200 ) * 60, y: Math.floor( i / 200 ) * 60 } } );
    eles.push( { data: { id: `b${i}` }, position: { x: ( i % 200 ) * 60 + 40, y: Math.floor( i / 200 ) * 60 } } );
  }

  for( let i = 0; i < PAIRS; i++ ){
    for( let k = 0; k < BUNDLE; k++ ){
      eles.push( { data: { id: `e${i}_${k}`, source: `a${i}`, target: `b${i}` } } );
    }
  }

  return eles;
};

const build = curveStyle => cytoscape( {
  elements: elements(),
  style: { nodes: { width: 30, height: 30 }, edges: { 'curve-style': curveStyle, width: 3 } }
} );

console.log( `curves: ${PAIRS * 2} nodes, ${EDGES} edges (${BUNDLE} parallel per pair)\n` );

// -- construction ------------------------------------------------------------
// the bundle map and every edge's curve params are built by the first
// style apply, so this is the one-shot cost of turning a graph curved.
// A throwaway pair goes first so neither side pays the module's warmup.
build( 'bezier' ).destroy();
build( 'straight' ).destroy();

let curved;
let straight;

const curvedBuildMs = time( () => { curved = build( 'bezier' ); } );
const straightBuildMs = time( () => { straight = build( 'straight' ); } );

console.log(
  `${'build (style apply + derivation)'.padEnd( 38 )} curved ${curvedBuildMs.toFixed( 1 ).padStart( 8 )} ms  ` +
  `straight ${straightBuildMs.toFixed( 1 ).padStart( 8 )} ms  ` +
  `${( curvedBuildMs / straightBuildMs ).toFixed( 2 )}x  ` +
  `(${( curvedBuildMs * 1e6 / EDGES ).toFixed( 0 )} ns/edge)` );

rows.push( {
  label: 'build (style apply + derivation)', unit: 'edge', count: EDGES,
  curvedMs: curvedBuildMs, straightMs: straightBuildMs, ratio: curvedBuildMs / straightBuildMs
} );

// -- the write path ----------------------------------------------------------
// the number that matters most: moving a node re-derives every incident
// edge's curve, and in the bundled scene that is a whole fan
const DRAGS = Math.min( 2000, PAIRS );

compare( `node.position x ${DRAGS} (drag)`, 'move', DRAGS, cy => {
  for( let i = 0; i < DRAGS; i++ ){
    cy.$id( `a${i}` ).position( { x: ( i % 200 ) * 60 + ( i % 7 ), y: Math.floor( i / 200 ) * 60 } );
  }
} );

// the bulk form: one call, every node moved (layouts and tweens ride this)
compare( 'nodes().positions() (bulk move)', 'node', PAIRS * 2, cy => {
  cy.nodes().positions( ( n, i ) => ( { x: ( i % 200 ) * 61, y: Math.floor( i / 200 ) * 61 } ) );
} );

// ...and where that move's curve work actually lands.  v4 defers
// derivation to the first read, so a write is cheap and the frame that
// reads pays: this pair separates the charge from the steady state.
let moveParity = 0;

compare( 'first read after a bulk move (cold)', 'call', 1, cy => {
  cy.nodes().positions( ( n, i ) => (
    { x: ( i % 200 ) * ( 60 + moveParity ), y: Math.floor( i / 200 ) * ( 60 + moveParity ) } ) );
  moveParity = moveParity === 0 ? 1 : 0;
  cy.elements().boundingBox();
} );

compare( 'same read again (warm)', 'call', 1, cy => {
  cy.elements().boundingBox();
} );

// -- accessors ---------------------------------------------------------------
const SAMPLE = Math.min( 20000, EDGES );

compare( `edge.midpoint x ${SAMPLE}`, 'edge', SAMPLE, cy => {
  let x = 0;

  for( let i = 0; i < SAMPLE; i++ ){
    x += cy.$id( `e${i % PAIRS}_${i % BUNDLE}` ).midpoint().x;
  }

  return x;
} );

compare( `edge.controlPoints x ${SAMPLE}`, 'edge', SAMPLE, cy => {
  let n = 0;

  for( let i = 0; i < SAMPLE; i++ ){
    n += ( cy.$id( `e${i % PAIRS}_${i % BUNDLE}` ).controlPoints() ?? [] ).length;
  }

  return n;
} );

// -- scans -------------------------------------------------------------------
// the curve-hull term in the whole-graph bound, and the exact
// curve-vs-rect test box selection runs per edge
compare( 'cy.elements().boundingBox() x 20', 'call', 20, cy => {
  for( let i = 0; i < 20; i++ ){ cy.elements().boundingBox(); }
} );

compare( 'cy.fit() x 20 (store scan)', 'call', 20, cy => {
  for( let i = 0; i < 20; i++ ){ cy.fit(); }
} );

// `elementsInBox` takes four numbers, not a box object.  Until round
// 33.5 this row passed an object, which silently answers the *empty*
// collection — so the 3.29x premium first published here (and quoted in
// src/README.md) was measured on a degenerate call that never ran the
// curve-vs-rect test it names.  Fixed and re-measured; see the round-33.5
// record in PLAN.md.
compare( 'elementsInBox x 20 (half the graph)', 'call', 20, cy => {
  const bb = cy.elements().boundingBox();

  for( let i = 0; i < 20; i++ ){
    cy.elementsInBox( bb.x1, bb.y1, ( bb.x1 + bb.x2 ) / 2, bb.y2 );
  }
} );

// -- the structural tier -----------------------------------------------------
// hide()/show() re-fans the bundle: the remaining members close ranks
// (round 22.3), which is derivation work no straight graph does
const HIDES = Math.min( 2000, PAIRS );

compare( `edge.hide/show x ${HIDES} (bundle re-fan)`, 'pair', HIDES, cy => {
  let acc = 0;

  for( let i = 0; i < HIDES; i++ ){
    cy.$id( `e${i}_0` ).hide();

    // read a *sibling* — the re-fan is deferred like every other curve
    // derivation, so without this the loop measures the flag write only
    acc += cy.$id( `e${i}_1` ).midpoint().y;

    cy.$id( `e${i}_0` ).show();
    acc += cy.$id( `e${i}_1` ).midpoint().y;
  }

  return acc;
} );

// -- summary -----------------------------------------------------------------
console.log( '\ncurve premium (curved / straight):' );

for( const r of [ ...rows ].sort( ( a, b ) => b.ratio - a.ratio ) ){
  console.log( `  ${r.ratio.toFixed( 2 ).padStart( 6 )}x  ${r.label}` );
}

// join report.mjs's job table (round 33.10): one group per row, the
// curved and straight sides as its two benches
finishManualRun( 'curves', rows.map( r => ( {
  name: `curve premium: ${r.label}`,
  benches: [ { name: 'curved', ms: r.curvedMs }, { name: 'straight', ms: r.straightMs } ]
} ) ) );

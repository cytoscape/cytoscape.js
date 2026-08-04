// Spatial sweep (round 33.5): picking, box selection and bounds — the
// three columnar scans that answer "what is under / inside / around
// this", and the ones an interaction frame actually runs.
//
//   node --import tsx benchmark/gpu/spatial.mjs           # N=2000
//   BENCH_N=200000 BENCH_OP=pick node --import tsx benchmark/gpu/spatial.mjs
//
// **Why picking and box selection are gpu-only rows.**  The plan for this
// pass called for comparing them against v3's `findNearestElement` and
// `getAllInBox`.  Both live on v3's *canvas renderer*, and a headless v3
// instance has none — measured: `cy.renderer()` is a bare object on which
// both are `undefined`.  So there is no honest v3 side for these two
// (design call 1), and they are absolute v4 costs.  Bounds is the one of
// the three v3 can answer headless, and it is comparative.
//
// Picking is where round 27's shape branches live — each is a separate
// CPU replica of the shader's inside-test — but at realistic density the
// **walk dominates and the shape test is invisible** (the descending scan
// stops at the first box-containing candidate, so one test runs per
// pick).  So the shape tests get a fixture built to isolate them: N
// coincident oversized nodes with the point inside every box and outside
// every shape, which runs N inside-tests and misses all of them.  The
// round-* family is additionally measured at two zooms, because 28.1
// recorded `insideRoundPolygon` as the one shape test that is **not
// affine-invariant** — its corner radius is a device-px length.

import { bench, group, summary, do_not_optimize } from 'mitata';
import cytoscapeGpu from '../../src/gpu/index.mjs';
import { pickNodeAt } from '../../src/gpu/render/cpu-pick.mjs';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();
const instances = [];

const has = name => OP == null || name.includes( OP );

const frameAt = zoomDpr => ( { panXPx: 0, panYPx: 0, zoomDpr, hidePx: 1, nodeLodPx: 3 } );

console.log( `\n== spatial sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- picking, by shape --------------------------------------------------------
// One instance per shape keyword, every node the same shape, laid on the
// same grid as the shared fixture.  The hit point is a node's centre and
// the miss point is far outside the graph, which forces the full
// descending walk over highWater — the hover-over-background case.
if( has( 'pick' ) ){
  const SHAPES = [
    [ 'ellipse', {} ],
    [ 'rectangle', {} ],
    [ 'star', {} ],                                  // round-10 polygon table
    [ 'round-hexagon', {} ],                         // round-27.4 offset polygon (not affine-invariant)
    [ 'barrel', {} ],                                // round-27.5 sampled beziers
    [ 'cut-rectangle', {} ],                         // round-27.2 absolute chamfer
    [ 'polygon', { 'shape-polygon-points': [ -1, -1, 1, -1, 1, 1, 0, 0.4, -1, 1 ] } ] // 13 C3 blob walk
  ];

  const pickInstance = ( shape, extra ) => {
    const cy = makeGpu( elements );

    cy.style( { nodes: { shape, width: 30, height: 30, ...extra } } );
    instances.push( cy );

    return cy;
  };

  // the model position of a node in the middle of the grid (graph.mjs
  // lays nodes at (i % 100) * 10, floor( i / 100 ) * 10)
  const hitIndex = Math.min( 1000, N - 1 );
  const hit = { x: ( hitIndex % 100 ) * 10, y: Math.floor( hitIndex / 100 ) * 10 };

  // At realistic density the **walk dominates and the shape test is
  // invisible**: the descending scan stops at the first candidate whose
  // box contains the point, so exactly one inside-test runs per pick.
  // Measured that way, all seven shapes read within 3% of each other
  // (~22 µs at N=2000) and zoom changes nothing — a row per shape would
  // be seven copies of the walk wearing different labels.  So the hit
  // row is one shape, and the shape tests get a fixture built to isolate
  // them below.
  {
    const cy = pickInstance( 'ellipse', {} );
    const store = cy._store;

    group( 'pick: hit (the walk; one inside-test)', () => {
      summary( () => {
        bench( 'zoom 1', () => do_not_optimize( pickNodeAt( store, frameAt( 1 ), hit.x, hit.y ) ) );
        bench( 'zoom 2', () => do_not_optimize( pickNodeAt( store, frameAt( 2 ), hit.x * 2, hit.y * 2 ) ) );
      } );
    } );
  }

  // The shape test, isolated: every node coincident at the origin and
  // large, with the pick point inside every node's *box* but outside
  // every node's *shape* — so the walk runs N inside-tests and all of
  // them miss.  That makes the row the per-shape cost times N instead of
  // the walk plus one test.
  //
  // `rectangle` is deliberately absent: there is no point inside its box
  // and outside its shape, so it cannot be measured this way — which is
  // itself the reason it is the cheap case.
  {
    const coincident = ( shape, extra ) => {
      const eles = [];

      for( let i = 0; i < N; i++ ){ eles.push( { data: { id: 'c' + i }, position: { x: 0, y: 0 } } ); }

      const cy = cytoscapeGpu( { elements: eles } );

      cy.style( { nodes: { shape, width: 100, height: 100, ...extra } } );
      instances.push( cy );

      return cy;
    };

    // The miss point is per shape, because "inside the box and outside
    // the shape" is a different place for each: the box corner works for
    // every generated shape, but it is *inside* the custom polygon below
    // (whose (1,1) vertex reaches it), which made that row stop at the
    // first node and read 1500x faster than the rest — a row measuring
    // one test rather than N.
    const MISS = { polygon: [ 0, 45 ] };          // above the concave notch
    const corner = [ 49.5, 49.5 ];                // just inside the 100x100 box

    // Control: a row is only measuring N inside-tests if every one of
    // them misses.  A hit means the point is inside the shape and the
    // walk stopped early, so the row is void — say so rather than
    // reporting it.
    const missPoint = shape => MISS[ shape ] ?? corner;
    const stores = new Map();

    for( const [ shape, extra ] of SHAPES ){
      if( shape === 'rectangle' ){ continue; }

      const store = coincident( shape, extra )._store;
      const [ x, y ] = missPoint( shape );

      if( pickNodeAt( store, frameAt( 1 ), x, y ) != null ){
        console.warn( `  !! ${shape}: the pick point is INSIDE the shape — that row would measure one test, not ${N}` );
      }

      stores.set( shape, store );
    }

    group( `pick: shape inside-test, ${N} coincident misses`, () => {
      summary( () => {
        for( const [ shape ] of SHAPES ){
          if( shape === 'rectangle' ){ continue; }

          const store = stores.get( shape );
          const [ x, y ] = missPoint( shape );

          bench( shape, () => do_not_optimize( pickNodeAt( store, frameAt( 1 ), x, y ) ) );
        }
      } );
    } );

    // round-* corner radii are device-px lengths, so `insideRoundPolygon`
    // is the one shape test that is not affine-invariant (28.1) — it is
    // the one whose cost can move with the zoom
    {
      const store = coincident( 'round-hexagon', {} )._store;

      group( 'pick: round-hexagon inside-test by zoom (not affine-invariant)', () => {
        summary( () => {
          bench( 'zoom 1', () => do_not_optimize( pickNodeAt( store, frameAt( 1 ), corner[ 0 ], corner[ 1 ] ) ) );
          bench( 'zoom 2', () => do_not_optimize( pickNodeAt( store, frameAt( 2 ), corner[ 0 ] * 2, corner[ 1 ] * 2 ) ) );
        } );
      } );
    }
  }

  // The miss is shape-independent work — the walk itself — so it gets one
  // row rather than seven.  This is the pointer layer's worst case and
  // the one compaction.mjs measures before/after.
  {
    const cy = pickInstance( 'ellipse', {} );
    const store = cy._store;

    group( 'pick: background miss (full highWater walk)', () => {
      bench( 'gpu', () => do_not_optimize( pickNodeAt( store, frameAt( 1 ), 1e7, 0 ) ) );
    } );
  }

  // text-events puts the node's laid label box into the scan (round
  // 20.3), so a labelled graph pays a second box test per candidate
  {
    const plain = makeGpu( elements );
    const labelled = makeGpu( elements );

    plain.style( { nodes: { shape: 'ellipse', width: 30, height: 30, label: { data: 'foo' } } } );
    labelled.style( {
      nodes: { shape: 'ellipse', width: 30, height: 30, label: { data: 'foo' }, 'text-events': 'yes' }
    } );
    instances.push( plain, labelled );

    group( 'pick: label box in the scan (text-events)', () => {
      summary( () => {
        bench( 'text-events: no', () => do_not_optimize( pickNodeAt( plain._store, frameAt( 1 ), 1e7, 0 ) ) );
        bench( 'text-events: yes', () => do_not_optimize( pickNodeAt( labelled._store, frameAt( 1 ), 1e7, 0 ) ) );
      } );
    } );
  }
}

// -- box selection ------------------------------------------------------------
// `cy.elementsInBox` is the public geometric query (the gesture filters
// it further — the 20.2 scope note).  Box fractions matter because the
// scan's cost is the walk, while the *result* size is what the caller
// then pays for.
if( has( 'box' ) ){
  const cy = makeGpu( elements );

  cy.style( { nodes: { width: 30, height: 30, label: { data: 'foo' } } } );
  instances.push( cy );

  const bb = cy.elements().boundingBox();

  // `elementsInBox` takes **four numbers**, not a box object.  Passing an
  // object silently answers the empty collection (measured: 0 elements
  // against 480 for the same band spelled positionally), so a row written
  // that way measures a degenerate call on both sides.  benchmark/gpu/
  // curves.mjs had exactly that bug since round 29.4 — see the commit
  // that fixes it.
  const inBox = frac => cy.elementsInBox(
    bb.x1, bb.y1,
    bb.x1 + ( bb.x2 - bb.x1 ) * frac,
    bb.y1 + ( bb.y2 - bb.y1 ) * frac );

  group( 'box: elementsInBox by covered fraction', () => {
    summary( () => {
      bench( '10%', () => do_not_optimize( inBox( 0.1 ) ) );
      bench( '50%', () => do_not_optimize( inBox( 0.5 ) ) );
      bench( '100%', () => do_not_optimize( inBox( 1 ) ) );
    } );
  } );

  // the round-16.5 option: every candidate additionally needs its label
  // box contained
  const withLabels = makeGpu( elements );

  withLabels.style( { nodes: { width: 30, height: 30, label: { data: 'foo' } } } );
  withLabels.boxSelectionIncludesLabels( true );
  instances.push( withLabels );

  const halfBox = [ bb.x1, bb.y1, ( bb.x1 + bb.x2 ) / 2, bb.y2 ];

  group( 'box: label containment (boxSelectionIncludesLabels)', () => {
    summary( () => {
      bench( 'off', () => do_not_optimize( cy.elementsInBox( ...halfBox ) ) );
      bench( 'on', () => do_not_optimize( withLabels.elementsInBox( ...halfBox ) ) );
    } );
  } );

  // Round 39.1: the overlap mode against the containment default, on the
  // same band.  The rows go through `_elementsInGestureBox` because the
  // mode is read by the *gesture* — `elementsInBox` stays containment
  // whatever the option says, which is itself the point of the second
  // row.
  //
  // What makes overlap cost more is not the node test (an intersect is
  // the same arithmetic as a containment) but the **edges**: containment
  // asks two point-in-box questions, while overlap runs a Liang-Barsky
  // clip per segment — one for a straight edge, up to CURVE_SEGS for a
  // curved one.  So the curved row beside it is the row that matters.
  //
  // Discrimination check (printed by the row builder below): the two
  // modes answer different, non-degenerate sets — a band covering half
  // the graph catches strictly more under overlap — and the curved
  // fixture reports how many of its edges are *actually* curved.  Both
  // numbers are logged because both failed once while being written.
  // The curve style here is `unbundled-bezier` and not `bezier` for
  // exactly that reason: `bezier` bundles **multi-edges only** (the
  // round-12a decision — a lone edge between two nodes renders straight),
  // and this fixture has no parallel pairs, so the first version of the
  // curved row measured straight edges and read identical to the row
  // above it.
  const overlapCy = makeGpu( elements );

  overlapCy.style( { nodes: { width: 30, height: 30 } } );
  overlapCy.boxSelectionMode( 'overlap' );
  instances.push( overlapCy );

  const curvedContain = makeGpu( elements );
  const curvedOverlap = makeGpu( elements );

  for( const [ inst, mode ] of [ [ curvedContain, 'contain' ], [ curvedOverlap, 'overlap' ] ] ){
    inst.style( {
      nodes: { width: 30, height: 30 },
      edges: { 'curve-style': 'unbundled-bezier', 'control-point-distances': 40 }
    } );
    inst.boxSelectionMode( mode );
    instances.push( inst );
  }

  const containCount = cy._elementsInGestureBox( ...halfBox ).length;
  const overlapCount = overlapCy._elementsInGestureBox( ...halfBox ).length;

  const reallyCurved = curvedOverlap.edges()
    .filter( e => e.controlPoints() != null ).length;

  console.log(
    `   box mode fixture: contain caught ${containCount}, overlap ${overlapCount}` +
    ` (curved: ${curvedContain._elementsInGestureBox( ...halfBox ).length}` +
    ` vs ${curvedOverlap._elementsInGestureBox( ...halfBox ).length});` +
    ` ${reallyCurved}/${curvedOverlap.edges().length} edges actually curved` );

  group( 'box: overlap vs contain (straight edges)', () => {
    summary( () => {
      bench( 'contain', () => do_not_optimize( cy._elementsInGestureBox( ...halfBox ) ) );
      bench( 'overlap', () => do_not_optimize( overlapCy._elementsInGestureBox( ...halfBox ) ) );
    } );
  } );

  group( 'box: overlap vs contain (curved edges — the segment walk)', () => {
    summary( () => {
      bench( 'contain', () => do_not_optimize( curvedContain._elementsInGestureBox( ...halfBox ) ) );
      bench( 'overlap', () => do_not_optimize( curvedOverlap._elementsInGestureBox( ...halfBox ) ) );
    } );
  } );
}


// -- bounds -------------------------------------------------------------------
// The one of the three v3 can answer headless.  v4's default *includes
// labels* (round 16.4), so the honest default row is the expensive one;
// the opt-out is measured beside it rather than quietly used to flatter
// the comparison.
if( has( 'bounds' ) ){
  const v3 = makeV3( elements, { styleEnabled: true, layout: { name: 'preset' } } );
  const gpu = makeGpu( elements );

  v3.style( [ { selector: 'node', style: { width: 30, height: 30, label: 'data(foo)' } } ] );
  gpu.style( { nodes: { width: 30, height: 30, label: { data: 'foo' } } } );
  instances.push( v3, gpu );

  const v3Eles = v3.elements();
  const gpuEles = gpu.elements();

  group( 'bounds: whole-graph boundingBox()', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3Eles.boundingBox() ) );
      bench( 'gpu', () => do_not_optimize( gpuEles.boundingBox() ) );
    } );
  } );

  group( 'bounds: boundingBox, labels in vs out (v4)', () => {
    summary( () => {
      bench( 'includeLabels: true (default)', () => do_not_optimize( gpuEles.boundingBox() ) );
      bench( 'includeLabels: false', () => do_not_optimize( gpuEles.boundingBox( { includeLabels: false } ) ) );
    } );
  } );

  // no-arg fit takes the store's columnar scan rather than materializing
  // the whole graph through cy.elements() (the pass-1 fast path)
  group( 'bounds: cy.fit() (whole-graph scan)', () => {
    summary( () => {
      bench( 'v3',  () => { v3.fit(); } );
      bench( 'gpu', () => { gpu.fit(); } );
    } );
  } );

  group( 'bounds: getFitViewport() (compute without committing)', () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3.getFitViewport() ) );
      bench( 'gpu', () => do_not_optimize( gpu.getFitViewport() ) );
    } );
  } );

  // boundingBoxAt is v4-only (round 10 A7): the box at hypothetical
  // positions, which is what an animated layout's fit targets
  group( 'bounds: boundingBoxAt (v4 only)', () => {
    bench( 'gpu', () => do_not_optimize( gpuEles.boundingBoxAt( () => ( { x: 1, y: 2 } ) ) ) );
  } );

  // and the single-element read, which is the one a UI calls per hover
  {
    const v3One = v3.getElementById( 'n1000' );
    const gpuOne = gpu.$id( 'n1000' );

    group( 'bounds: one node boundingBox()', () => {
      summary( () => {
        bench( 'v3',  () => do_not_optimize( v3One.boundingBox() ) );
        bench( 'gpu', () => do_not_optimize( gpuOne.boundingBox() ) );
      } );
    } );

    group( 'bounds: labelBoundingBox (v4 only)', () => {
      bench( 'gpu', () => do_not_optimize( gpuOne.labelBoundingBox() ) );
    } );
  }
}

await finishRun( 'spatial' );

for( const cy of instances ){ cy.destroy(); }

// Round 25.6: what geometry tweens cost at scale — gpu-only, headless.
//
// The design claim under test (PLAN.md, round 25): a geometry tween is
// a plain CPU column write per tick plus its invalidation cascade —
// label re-anchor for node size, ride writes for edge width, the
// auto-bounds re-derive for padding, the sidecar rewrite for
// font-size — and the cascade stays in the per-animated-element cost
// class (never whole-graph work), with the wrap-none font-size fast
// path avoiding the estimator entirely.
//
//   BENCH_N=200000 node --import tsx benchmark/gpu/geometry-tween.mjs
//
// Groups (one manager tick advancing an N-slot tween, per channel):
//   - node size: unlabelled, labelled center-anchored (the re-anchor
//     early-out), labelled corner-anchored (the full re-anchor)
//   - edge width: bare vs with rides (casing + match-line arrows)
//   - compound padding: tick + the auto-bounds flush it stales
//   - font-size: wrap none (the scale-patch fast path) vs wrapped
//     (an honest re-break per tick)
//   - baseline: the round-24 paint tick (opacity) for reference

import { bench, group } from 'mitata';
import { finishRun } from './bench-run.mjs';
import cytoscapeGpu from '../../src/gpu/index.mjs';
import { buildElements, N } from './graph.mjs';

const elements = buildElements();

const makeCy = ( style ) => cytoscapeGpu( {
  elements: elements.map( e => ( {
    data: { ...e.data },
    position: e.position ? { ...e.position } : undefined
  } ) ),
  style
} );

// an endless tween so every tick lands mid-flight
const DUR = { duration: 1e9, easing: 'linear' };

console.log( `\n== geometry-tween sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- node size tick: the re-anchor term, by label anchoring --
{
  const scenes = [
    [ 'unlabelled', {} ],
    // center/center anchors are size-independent (0, marginY): the
    // re-anchor diff early-outs and never rewrites the sidecar entry
    [ 'labelled, center/center (re-anchor early-out)',
      { nodes: { label: { data: 'id' }, 'text-halign': 'center', 'text-valign': 'center' } } ],
    // the default bottom valign (and any non-center anchor) moves with
    // the size: a sidecar rewrite per tick — riding the 25.5 dims fast
    // path (ratio 1), never the estimator
    [ 'labelled, hanging (sidecar rewrite per tick)',
      { nodes: { label: { data: 'id' }, 'text-halign': 'left', 'text-valign': 'top' } } ]
  ];

  for( const [ name, style ] of scenes ){
    const cy = makeCy( style );

    cy.nodes().animate( { style: { width: 500, height: 400 }, ...DUR } );

    let t = 1;

    group( `size tick: ${name} (${N} slots)`, () => {
      bench( 'tick', () => { cy._animations.tick( t++ ); } );
    } );
  }
}

// -- edge width tick: bare vs riding the baked derivatives --
{
  const bare = makeCy( {} );
  const riding = makeCy( { edges: {
    'source-arrow-shape': 'triangle', 'target-arrow-shape': 'triangle',
    'source-arrow-width': 'match-line', 'target-arrow-width': 'match-line',
    'line-outline-width': 2, 'line-outline-color': 'black'
  } } );

  bare.edges().animate( { style: { width: 30 }, ...DUR } );
  riding.edges().animate( { style: { width: 30 }, ...DUR } );

  let t1 = 1;
  let t2 = 1;

  group( `edge width tick (${2 * N} slots)`, () => {
    bench( 'bare', () => { bare._animations.tick( t1++ ); } );
    // + the casing stroke lane and both arrow-width lanes per slot
    bench( 'with rides (casing + match-line arrows)', () => { riding._animations.tick( t2++ ); } );
  } );
}

// -- compound padding tick: the auto-bounds re-derive it stales --
{
  // N/8 parents × 8 children (the compound scene is built, not reused
  // from the flat fixture)
  const parents = Math.max( 1, Math.floor( N / 8 ) );
  const els = [];

  for( let p = 0; p < parents; p++ ){
    els.push( { data: { id: 'p' + p } } );

    for( let c = 0; c < 8; c++ ){
      els.push( {
        data: { id: 'p' + p + 'c' + c, parent: 'p' + p },
        position: { x: c * 20, y: p * 40 }
      } );
    }
  }

  const cy = cytoscapeGpu( { elements: els, style: { parents: { padding: 10 } } } );

  cy._store.flushDerived();
  cy.nodes().animate( { style: { padding: 60 }, ...DUR } );

  let t = 1;

  group( `padding tick + auto-bounds flush (${parents} parents × 8 children)`, () => {
    bench( 'tick + flush', () => {
      cy._animations.tick( t++ );
      cy._store.flushDerived();
    } );
  } );
}

// -- font-size tick: the wrap-none fast path vs an honest re-break --
{
  const none = makeCy( { nodes: { label: 'a moderately long node label' } } );
  const wrapped = makeCy( { nodes: {
    label: 'a moderately long node label',
    'text-wrap': 'wrap', 'text-max-width': 60
  } } );

  none.nodes().animate( { style: { 'font-size': 64 }, ...DUR } );
  wrapped.nodes().animate( { style: { 'font-size': 64 }, ...DUR } );

  let t1 = 1;
  let t2 = 1;

  group( `font-size tick (${N} labels)`, () => {
    bench( 'wrap none (dims scale-patch)', () => { none._animations.tick( t1++ ); } );
    // breaking genuinely moves with the em under a fixed model-px
    // maxWidth, so every tick re-estimates the block
    bench( 'wrapped (re-break per tick)', () => { wrapped._animations.tick( t2++ ); } );
  } );
}

// -- baseline: the round-24 paint tick for reference --
{
  const cy = makeCy( {} );

  cy.nodes().animate( { style: { opacity: 0.1 }, ...DUR } );

  let t = 1;

  group( `baseline: paint (opacity) tick (${N} slots)`, () => {
    bench( 'tick', () => { cy._animations.tick( t++ ); } );
  } );
}

await finishRun( 'geometry-tween' );

process.exit( 0 );

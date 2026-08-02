// Round 24.2: what style transitions cost at scale — gpu-only, headless.
//
// The design claim under test (PLAN.md, round 24): a whole-channel
// transition stays in the cost class of the whole-channel re-derive it
// replaces — the diff, restore and bulk-tween spawn add a constant
// factor, never a new complexity class — and an explicit mapper domain
// keeps a data write O(changed elements), transitions or not.
//
//   BENCH_N=200000 node --import tsx benchmark/gpu/transitions.mjs
//
// Groups:
//   - auto-extent shift: a write that moves the live extent re-derives
//     the whole channel; measured with transitions off vs on.
//   - explicit-domain write: the same write under a pinned domain only
//     re-evaluates the written element; off vs on.
//   - bulk tween tick: one manager tick advancing the N-slot transition
//     the shift spawned (the steady per-frame CPU cost).
//   - sheet swap: whole-graph re-application with a constant color flip;
//     off vs on (every element diffs and tweens).

import { bench, group, summary } from 'mitata';
import { finishRun } from './bench-run.mjs';
import cytoscapeGpu from '../../src/gpu/index.mjs';
import { buildElements, N } from './graph.mjs';

const elements = buildElements();

const TRANSITION = {
  'transition-property': [ 'opacity' ],
  'transition-duration': 1e9, // never completes inside the run
  'transition-timing-function': 'linear'
};

const makeCy = ( nodeStyle ) => cytoscapeGpu( {
  elements: elements.map( e => ( {
    data: { ...e.data },
    position: e.position ? { ...e.position } : undefined
  } ) ),
  style: { nodes: nodeStyle }
} );

console.log( `\n== transition sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- auto-extent shift: whole-channel re-derive, off vs on --
// 'foo' spans 0..N-1; each iteration pushes the max further, so every
// write moves the live extent and re-derives all N mappings.
{
  const off = makeCy( { opacity: { data: 'foo', range: [ 0, 1 ] } } );
  const on = makeCy( { opacity: { data: 'foo', range: [ 0, 1 ] }, ...TRANSITION } );
  const offNode = off.$id( 'n0' );
  const onNode = on.$id( 'n0' );
  let hi = N;

  group( `transition: auto-extent shift, whole-channel re-derive (${N} slots)`, () => {
    summary( () => {
      bench( 'transitions off', () => { offNode.data( 'foo', ++hi ); } );
      // on: the same re-derive + the stored-truth diff, the restore
      // writes, and one bulk-tween spawn (which evicts its predecessor)
      bench( 'transitions on', () => { onNode.data( 'foo', ++hi ); } );
    } );
  } );

  // -- bulk tween tick: the spawned N-slot transition's per-frame cost --
  let t = 1;

  group( `transition: bulk tween tick (${N} slots, one manager tick)`, () => {
    bench( 'tick', () => { on._animations.tick( t++ ); } );
  } );
}

// -- explicit domain: a data write stays O(changed), off vs on --
{
  const off = makeCy( { opacity: { data: 'foo', domain: [ 0, N ], range: [ 0, 1 ] } } );
  const on = makeCy( { opacity: { data: 'foo', domain: [ 0, N ], range: [ 0, 1 ] }, ...TRANSITION } );
  const offNode = off.$id( 'n1' );
  const onNode = on.$id( 'n1' );
  let i = 0;

  group( 'transition: explicit-domain write (O(changed) — one element)', () => {
    summary( () => {
      bench( 'transitions off', () => { offNode.data( 'foo', ( i++ & 1023 ) ); } );
      bench( 'transitions on', () => { onNode.data( 'foo', ( i++ & 1023 ) ); } );
    } );
  } );
}

// -- sheet swap: whole-graph constant re-application, off vs on --
{
  const mk = extra => [
    { 'background-color': 'rgb(10,20,30)', ...extra },
    { 'background-color': 'rgb(200,210,220)', ...extra }
  ];
  const COLOR_TRANSITION = { ...TRANSITION, 'transition-property': [ 'background-color' ] };
  const off = makeCy( mk()[ 0 ] );
  const on = makeCy( mk( COLOR_TRANSITION )[ 0 ] );
  const offSheets = mk();
  const onSheets = mk( COLOR_TRANSITION );
  let i = 0;

  group( `transition: sheet swap, whole-graph apply (${N} slots diff + tween)`, () => {
    summary( () => {
      bench( 'transitions off', () => { off.style( { nodes: offSheets[ i++ & 1 ] } ); } );
      bench( 'transitions on', () => { on.style( { nodes: onSheets[ i++ & 1 ] } ); } );
    } );
  } );
}

await finishRun( 'transitions' );

process.exit( 0 );

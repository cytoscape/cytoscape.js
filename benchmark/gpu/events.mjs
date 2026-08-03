// Events + animation-manager sweep (round 33.7).
//
// The whole emit surface has rested on one figure — ~85 ns per listener
// call, from round 5's scenario sweep — and the animation manager has
// been measured only by its *ticks* (transitions.mjs, geometry-tween.mjs).
// Neither the per-emit cost by qualifier kind, nor the listener-gated
// no-op path that most of the write-side numbers depend on, nor what it
// costs to start and stop an animation, has ever had a row.
//
//   node --import tsx benchmark/gpu/events.mjs            # N=2000
//   BENCH_N=20000 BENCH_OP=emit node --import tsx benchmark/gpu/events.mjs
//
// The headline row is **flat vs phased**.  Round 14.5 records that the
// flat no-compounds path "stays byte-identical (zero cost)" — a claim
// about the path *bubbling does not apply to*, which cannot be
// re-measured without the pre-14.5 code, so this suite does not pretend
// to check it.  What it measures is the other half, which nothing has:
// what the phased walk costs **when it does apply**, as the same
// position write on an orphan node and on a node two ancestors deep, in
// one graph.  The answer includes a finding — see the record in PLAN.md:
// the phased walk runs even when *nothing is listening*, so a compound
// child does not get the listener-gated fast path that every bulk-write
// number in mutators.mjs rests on.
//
// Tick costs stay where they already are and are not duplicated here:
// paint ticks in transitions.mjs, geometry ticks in geometry-tween.mjs.

import { bench, group, summary } from 'mitata';
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

console.log( `\n== events + animation sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- emit cost, by qualifier kind ---------------------------------------------
// One node moved per iteration, alternating so the write is never a
// no-op.  The delta between these rows is the emit; the position write
// underneath is the same on every row of a side.
if( has( 'emit' ) ){
  const move = ( node, i ) => { node.position( { x: ( i & 1 ) * 10, y: 0 } ); };

  const cmpEmit = ( name, register ) => {
    const v3 = v3Instance();
    const gpu = gpuInstance();
    const v3Node = v3.getElementById( 'n' + MIDNUM );
    const gpuNode = gpu.$id( 'n' + MIDNUM );
    let i = 0;

    register( v3, v3Node, gpu, gpuNode );

    group( name, () => {
      summary( () => {
        bench( 'v3',  () => { move( v3Node, i++ ); } );
        bench( 'gpu', () => { move( gpuNode, i++ ); } );
      } );
    } );
  };

  const noop = () => {};

  // the gated fast path: nothing is listening, so v4 skips the emit
  // entirely.  Every bulk-write number in mutators.mjs rests on this row.
  cmpEmit( 'emit: position write, no listeners', noop );

  cmpEmit( 'emit: 1 core listener', ( v3, v3Node, gpu ) => {
    v3.on( 'position', noop );
    gpu.on( 'position', noop );
  } );

  cmpEmit( 'emit: 1 element (ref-qualified) listener', ( v3, v3Node, gpu, gpuNode ) => {
    v3Node.on( 'position', noop );
    gpuNode.on( 'position', noop );
  } );

  // v3 delegates with a selector string; v4 with a predicate function —
  // the idiomatic spelling of the same thing on each side
  cmpEmit( 'emit: delegated (v3 selector vs v4 predicate)', ( v3, v3Node, gpu ) => {
    v3.on( 'position', 'node', noop );
    gpu.on( 'position', ele => ele.isNode(), noop );
  } );

  cmpEmit( 'emit: 10 core listeners', ( v3, v3Node, gpu ) => {
    for( let k = 0; k < 10; k++ ){
      v3.on( 'position', noop );
      gpu.on( 'position', noop );
    }
  } );

  // registration itself
  {
    const v3 = v3Instance();
    const gpu = gpuInstance();

    group( 'emit: on() + off() round-trip', () => {
      summary( () => {
        bench( 'v3',  () => { const h = () => {}; v3.on( 'tap', h ); v3.off( 'tap', h ); } );
        bench( 'gpu', () => { const h = () => {}; gpu.on( 'tap', h ); gpu.off( 'tap', h ); } );
      } );
    } );
  }
}

// -- flat vs phased -----------------------------------------------------------
// One graph, two nodes: an orphan and a child two ancestors deep.  Same
// write, same listener, same instance — so the only difference is how
// many phases the emit walks (see the header for what this does and
// does not claim about round 14.5).
if( has( 'phase' ) ){
  const eles = [
    { data: { id: 'gp' } },
    { data: { id: 'p', parent: 'gp' } },
    { data: { id: 'child', parent: 'p' }, position: { x: 0, y: 0 } },
    { data: { id: 'orphan' }, position: { x: 500, y: 500 } }
  ];
  const cy = makeGpu( eles );

  instances.push( cy );

  const child = cy.$id( 'child' );
  const orphan = cy.$id( 'orphan' );
  let i = 0;

  // a core listener, so both emits have somewhere to go
  cy.on( 'position', () => {} );

  group( 'emit: flat vs phased (compound bubbling, 14.5)', () => {
    summary( () => {
      bench( 'orphan (flat emit)', () => { orphan.position( { x: 500 + ( i++ & 1 ), y: 500 } ); } );
      bench( 'child of 2 ancestors (phased)', () => { child.position( { x: i++ & 1, y: 0 } ); } );
    } );
  } );

  // and the same pair with nobody listening at all, which is the path
  // the compound graphs in mutators/scenarios actually take
  const quiet = makeGpu( eles );

  instances.push( quiet );

  const qChild = quiet.$id( 'child' );
  const qOrphan = quiet.$id( 'orphan' );

  group( 'emit: flat vs phased, no listeners', () => {
    summary( () => {
      bench( 'orphan (flat)', () => { qOrphan.position( { x: 500 + ( i++ & 1 ), y: 500 } ); } );
      bench( 'child (phased)', () => { qChild.position( { x: i++ & 1, y: 0 } ); } );
    } );
  } );
}

// -- the animation manager ----------------------------------------------------
// Not the tick — the *lifecycle*.  Starting an animation captures start
// values into per-channel ChannelWrites and runs the round-21 eviction
// compare against everything already running on those elements; stopping
// settles.  Nothing has priced either.
if( has( 'anim' ) ){
  const v3 = v3Instance();
  const gpu = gpuInstance();
  const v3Node = v3.getElementById( 'n' + MIDNUM );
  const gpuNode = gpu.$id( 'n' + MIDNUM );

  group( 'anim: start + stop, one element', () => {
    summary( () => {
      bench( 'v3',  () => { v3Node.animate( { position: { x: 5, y: 5 }, duration: 1000 } ); v3Node.stop(); } );
      bench( 'gpu', () => { gpuNode.animate( { position: { x: 5, y: 5 }, duration: 1000 } ); gpuNode.stop(); } );
    } );
  } );

  // the round-21 eviction compare: starting an animation whose channels
  // overlap a running one stops the older in place.  The disjoint case
  // composes instead, so the pair isolates the compare + evict.
  {
    const cy = gpuInstance();
    const node = cy.$id( 'n' + MIDNUM );

    group( 'anim: start against a running animation (round-21 eviction)', () => {
      summary( () => {
        bench( 'disjoint channels (composes)', () => {
          node.animate( { position: { x: 5, y: 5 }, duration: 10000 } );
          node.animate( { style: { opacity: 0.5 }, duration: 10000 } );
          node.stop();
        } );
        bench( 'overlapping channels (evicts)', () => {
          node.animate( { position: { x: 5, y: 5 }, duration: 10000 } );
          node.animate( { position: { x: 7, y: 7 }, duration: 10000 } );
          node.stop();
        } );
      } );
    } );
  }

  // a whole-collection animation: the capture is per element, so this is
  // where start cost actually shows up at scale
  {
    const cy = gpuInstance();
    const v3b = v3Instance();
    const band = cy.nodes().slice( 0, Math.min( 512, N ) );
    const v3Band = v3b.nodes().slice( 0, Math.min( 512, N ) );

    group( `anim: start + stop, ${band.length}-node collection`, () => {
      summary( () => {
        bench( 'v3',  () => { v3Band.animate( { position: { x: 5, y: 5 }, duration: 1000 } ); v3Band.stop(); } );
        bench( 'gpu', () => { band.animate( { position: { x: 5, y: 5 }, duration: 1000 } ); band.stop(); } );
      } );
    } );
  }

  // delay() touches no channel at all (round 21: it composes with
  // everything), so it is the manager's floor
  group( 'anim: delay() (no channels touched)', () => {
    summary( () => {
      bench( 'v3',  () => { v3Node.delay( 1000 ); v3Node.stop(); } );
      bench( 'gpu', () => { gpuNode.delay( 1000 ); gpuNode.stop(); } );
    } );
  } );

  // the round-24.3 controls are v4-only
  {
    const cy = gpuInstance();
    const node = cy.$id( 'n' + MIDNUM );

    group( 'anim: controls (v4 only)', () => {
      summary( () => {
        bench( 'pause + resume', () => {
          const a = node.animation( { position: { x: 5, y: 5 }, duration: 10000 } );

          a.play();
          a.pause();
          a.resume();
          a.stop();
        } );
        bench( 'reverse', () => {
          const a = node.animation( { position: { x: 5, y: 5 }, duration: 10000 } );

          a.play();
          a.reverse();
          a.stop();
        } );
      } );
    } );
  }

  // the viewport path, which captures pan/zoom rather than element
  // channels
  group( 'anim: viewport animate + stop', () => {
    summary( () => {
      bench( 'v3',  () => { v3.animate( { zoom: 2, duration: 1000 } ); v3.stop(); } );
      bench( 'gpu', () => { gpu.animate( { zoom: 2, duration: 1000 } ); gpu.stop(); } );
    } );
  } );
}

await finishRun( 'events' );

for( const cy of instances ){ cy.destroy(); }

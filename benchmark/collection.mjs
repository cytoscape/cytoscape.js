// Collection-API micro-benchmarks: v4 (src/) vs v3 (v3/src/).
//
// Each group compares the same logical operation on both implementations.
//
// Methodology — defeating the JIT:
//   Pure, allocation-free calls (same(), degree(), data()) on a fixed operand
//   are loop-invariant, so V8 hoists them out of the measured loop and reports
//   a few nanoseconds regardless of the real cost. To prevent that, every
//   comparison rotates over a small POOL of distinct operands (K of them);
//   because the receiver/args change each iteration the call can't be hoisted.
//   Binary ops (same/contains/union) compare DISTINCT collections of equal
//   membership so an identity short-circuit (v3 has one; v4 doesn't) doesn't
//   make a self-comparison look artificially free.
//
// Element handles and operands are resolved in setup(), outside the timed
// region. Mutations run on dedicated instances as reversible round-trips.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const elements = buildElements();

// shared read-only instances
const v3 = makeV3( elements );
const gpu = makeGpu( elements );

const K = 8;              // rotation pool size (power of two)
const MASK = K - 1;

/**
 * Compare `op` across both implementations, rotating over K distinct operands
 * built by `setup(cy, k)` so the call is never loop-invariant.
 */
function cmp( name, setup, op ){
  const vs = Array.from( { length: K }, ( _, k ) => setup( v3, k ) );
  const gs = Array.from( { length: K }, ( _, k ) => setup( gpu, k ) );
  let i = 0;

  group( name, () => {
    summary( () => {
      bench( 'v3',  () => { const k = ( i++ ) & MASK; return do_not_optimize( op( vs[ k ], k ) ); } );
      bench( 'gpu', () => { const k = ( i++ ) & MASK; return do_not_optimize( op( gs[ k ], k ) ); } );
    } );
  } );
}

/**
 * Compare a reversible element mutation on dedicated instances. The target
 * handle is resolved once, outside the timed region, so the measurement is the
 * mutation itself and not the selection that finds the element.
 */
function cmpMutEle( name, setup, fn ){
  const a = makeV3( elements );
  const b = makeGpu( elements );
  const ta = setup( a );
  const tb = setup( b );

  group( name, () => {
    summary( () => {
      bench( 'v3',  () => { fn( ta ); } );
      bench( 'gpu', () => { fn( tb ); } );
    } );
  } );
}

// operand builders
const node = ( cy, k ) => cy.$id( 'n' + ( MIDNUM + k ) );        // K distinct nodes → distinct handles
const nodes = cy => cy.nodes();                                  // fresh collection each call
const allEles = cy => cy.elements();
const overlap = cy => ( { a: cy.nodes().slice( 0, 100 ), b: cy.nodes().slice( 50, 150 ) } );
const equalPair = cy => ( { a: cy.nodes(), b: cy.nodes() } );    // distinct objects, equal membership
const superSub = cy => ( { a: cy.nodes(), b: cy.nodes().slice( 0, 100 ) } );

console.log( `\n== collection API — v3 vs gpu (N=${N} nodes, ${2 * N} edges) ==` );

// -- traversal --
cmp( 'traverse: neighborhood()',    node, n => n.neighborhood() );
cmp( 'traverse: connectedEdges()',  node, n => n.connectedEdges() );
cmp( 'traverse: outgoers()',        node, n => n.outgoers() );
cmp( 'traverse: incomers()',        node, n => n.incomers() );
cmp( 'traverse: components()',      allEles, e => e.components() );

// -- degree --
cmp( 'degree: node.degree()',       node,  n => n.degree() );
cmp( 'degree: nodes.totalDegree()', nodes, n => n.totalDegree() );
cmp( 'degree: nodes.maxDegree()',   nodes, n => n.maxDegree() );

// -- data / position reads --
cmp( 'data: get',                   node, n => n.data( 'foo' ) );
cmp( 'position: get',               node, n => n.position() );
cmp( 'json: element',               node, n => n.json() );

// -- set operations (distinct operands) --
cmp( 'set: union()',                overlap, o => o.a.union( o.b ) );
cmp( 'set: intersection()',         overlap, o => o.a.intersection( o.b ) );
cmp( 'set: difference()',           overlap, o => o.a.difference( o.b ) );

// -- iteration / comparison --
cmp( 'iter: map()',                 nodes, n => n.map( e => e.id() ) );
cmp( 'iter: forEach()',             nodes, n => { let k = 0; n.forEach( () => k++ ); return k; } );
cmp( 'iter: filter(fn)',            nodes, n => n.filter( e => e.data( 'foo' ) % 2 === 0 ) );
cmp( 'compare: same()',             equalPair, o => o.a.same( o.b ) );
cmp( 'compare: contains()',         superSub, o => o.a.contains( o.b ) );

// -- mutations (target resolved once, outside the timed region) --
const midOf = cy => cy.$id( 'n' + MIDNUM );

cmpMutEle( 'mut: data set',          midOf, n => n.data( 'foo', 1 ) );
cmpMutEle( 'mut: position set',      midOf, n => n.position( { x: 1, y: 2 } ) );
cmpMutEle( 'mut: select + unselect', midOf, n => { n.select(); n.unselect(); } );

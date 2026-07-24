// Collection-API micro-benchmarks: v3 (src/) vs GPU/v4 (src/gpu/).
//
// Each group compares the same logical operation on both implementations.
// Element handles and operands are precomputed per instance so the timed
// region is the operation itself, not the selection that feeds it. Mutating
// ops get dedicated instances and are written as reversible round-trips so the
// graph state returns to baseline every iteration.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { buildElements, makeV3, makeGpu, MID, N } from './graph.mjs';

const elements = buildElements();

// shared read-only instances
const v3 = makeV3( elements );
const gpu = makeGpu( elements );

// precomputed single-element handles
const v3mid = v3.$( '#' + MID );
const gpumid = gpu.$( '#' + MID );

// precomputed set-operation operands (overlapping node ranges)
const v3A = v3.nodes().slice( 0, 100 ), v3B = v3.nodes().slice( 50, 150 );
const gpuA = gpu.nodes().slice( 0, 100 ), gpuB = gpu.nodes().slice( 50, 150 );

// precomputed whole collections for iteration/comparison
const v3nodes = v3.nodes(), gpunodes = gpu.nodes();
const v3all = v3.elements(), gpuall = gpu.elements();

/** Compare one operation across the two implementations. */
function cmp( name, v3fn, gpufn ){
  group( name, () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3fn() ) );
      bench( 'gpu', () => do_not_optimize( gpufn() ) );
    } );
  } );
}

/**
 * Compare a reversible element mutation on dedicated instances. The target
 * handle is resolved once, OUTSIDE the timed region, so the measurement is the
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

console.log( `\n== collection API — v3 vs gpu (N=${N} nodes, ${2 * N} edges) ==` );

// -- traversal --
cmp( 'traverse: neighborhood()',    () => v3mid.neighborhood(),    () => gpumid.neighborhood() );
cmp( 'traverse: connectedEdges()',  () => v3mid.connectedEdges(),  () => gpumid.connectedEdges() );
cmp( 'traverse: outgoers()',        () => v3mid.outgoers(),        () => gpumid.outgoers() );
cmp( 'traverse: incomers()',        () => v3mid.incomers(),        () => gpumid.incomers() );
cmp( 'traverse: components()',      () => v3all.components(),      () => gpuall.components() );

// -- degree --
cmp( 'degree: node.degree()',       () => v3mid.degree(),          () => gpumid.degree() );
cmp( 'degree: nodes.totalDegree()', () => v3nodes.totalDegree(),   () => gpunodes.totalDegree() );
cmp( 'degree: nodes.maxDegree()',   () => v3nodes.maxDegree(),     () => gpunodes.maxDegree() );

// -- data / position reads --
cmp( 'data: get',                   () => v3mid.data( 'foo' ),     () => gpumid.data( 'foo' ) );
cmp( 'position: get',               () => v3mid.position(),        () => gpumid.position() );
cmp( 'json: element',               () => v3mid.json(),            () => gpumid.json() );

// -- set operations --
cmp( 'set: union()',                () => v3A.union( v3B ),        () => gpuA.union( gpuB ) );
cmp( 'set: intersection()',         () => v3A.intersection( v3B ), () => gpuA.intersection( gpuB ) );
cmp( 'set: difference()',           () => v3A.difference( v3B ),   () => gpuA.difference( gpuB ) );

// -- iteration / comparison --
cmp( 'iter: map()',                 () => v3nodes.map( e => e.id() ), () => gpunodes.map( e => e.id() ) );
cmp( 'iter: forEach()',             () => { let k = 0; v3nodes.forEach( () => k++ ); return k; },
                                    () => { let k = 0; gpunodes.forEach( () => k++ ); return k; } );
cmp( 'iter: filter(fn)',            () => v3nodes.filter( e => e.data( 'foo' ) % 2 === 0 ),
                                    () => gpunodes.filter( e => e.data( 'foo' ) % 2 === 0 ) );
cmp( 'compare: same()',             () => v3nodes.same( v3nodes ), () => gpunodes.same( gpunodes ) );
cmp( 'compare: contains()',         () => v3nodes.contains( v3A ), () => gpunodes.contains( gpuA ) );

// -- mutations (target resolved once, outside the timed region) --
const findMid = cy => cy.$( '#' + MID );

cmpMutEle( 'mut: data set',          findMid, n => n.data( 'foo', 1 ) );
cmpMutEle( 'mut: position set',      findMid, n => n.position( { x: 1, y: 2 } ) );
cmpMutEle( 'mut: select + unselect', findMid, n => { n.select(); n.unselect(); } );

// Focused graph-algorithm sweep: v3 vs GPU/v4 at BENCH_N scale.
//
// Standalone (not part of index.mjs).  The round-10 algorithm ports run
// slot-native over CSR; this sweep compares them against the v3
// implementations on the shared deterministic fixture (every node degree 4).
// Ops with superlinear cost gate on N so the default run stays quick:
//
//   npm's default            BENCH_N=2000  — linear-ish ops + betweenness
//   BENCH_N=500 node --import tsx benchmark/gpu/algorithms.mjs
//                                          — adds pageRank, floydWarshall,
//                                            closeness-normalized, clustering
//
// v4 API deltas vs v3 baked into the op pairs: roots/goals are collections
// on the gpu side (v3 takes them too), and weight fns are plain functions.

import { run, bench, group, summary, do_not_optimize } from 'mitata';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const elements = buildElements();

const v3 = makeV3( elements );
const gpu = makeGpu( elements );

const K = 8; // rotation pool size (power of two)
const MASK = K - 1;

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

// operand builders: { eles, root, goal } per rotation slot
const ctx = ( cy, k ) => ( {
  eles: cy.elements(),
  root: cy.$id( 'n' + ( MIDNUM + k ) ),
  goal: cy.$id( 'n' + ( ( MIDNUM + k + Math.floor( N / 4 ) ) % N ) )
} );

const weight = edge => 1 + ( edge.data( 'w' ) ?? 0 ); // constant fn: measures the call path

console.log( `\n== algorithm sweep (N=${ N } nodes, ${ 2 * N } edges) ==` );

cmp( 'algo: bfs (whole graph)', ctx, c => c.eles.bfs( { roots: c.root } ) );
cmp( 'algo: dfs (whole graph)', ctx, c => c.eles.dfs( { roots: c.root } ) );
cmp( 'algo: dijkstra + pathTo', ctx, c => c.eles.dijkstra( { root: c.root, weight } ).pathTo( c.goal ) );
cmp( 'algo: aStar', ctx, c => c.eles.aStar( { root: c.root, goal: c.goal, weight } ) );
cmp( 'algo: bellmanFord', ctx, c => c.eles.bellmanFord( { root: c.root, weight } ) );
cmp( 'algo: kruskal', ctx, c => c.eles.kruskal( weight ) );
cmp( 'algo: tarjan SCC', ctx, c => c.eles.tarjanStronglyConnected() );
cmp( 'algo: hopcroft-tarjan biconnected', ctx, c => c.eles.hopcroftTarjanBiconnected() );
cmp( 'algo: hierholzer (directed)', ctx, c => c.eles.hierholzer( { root: c.root, directed: true } ) );
cmp( 'algo: betweennessCentrality (unweighted)', ctx, c => c.eles.betweennessCentrality() );
cmp( 'algo: degreeCentralityNormalized', ctx, c => c.eles.degreeCentralityNormalized( {} ) );
cmp( 'algo: closenessCentrality (one root)', ctx, c => c.eles.closenessCentrality( { root: c.root } ) );

if( N <= 1000 ){
  cmp( 'algo: pageRank (20 iters)', ctx, c => c.eles.pageRank( { iterations: 20 } ) );
}

if( N <= 500 ){
  cmp( 'algo: floydWarshall', ctx, c => c.eles.floydWarshall( { weight } ) );
  cmp( 'algo: closenessCentralityNormalized', ctx, c => c.eles.closenessCentralityNormalized( {} ) );
  cmp( 'algo: markovClustering', ctx, c => c.eles.markovClustering( {} ) );
  cmp( 'algo: hierarchicalClustering (threshold)', ctx, c => c.eles.hierarchicalClustering( {
    attributes: [ n => n.data( 'foo' ), n => n.data( 'weight' ) ]
  } ) );
  cmp( 'algo: kMeans (fixed centroids)', ctx, c => c.eles.kMeans( {
    k: 4,
    attributes: [ n => n.data( 'foo' ), n => n.data( 'weight' ) ],
    testMode: true,
    testCentroids: [ [ 0, 0 ], [ N / 3, 2 ], [ 2 * N / 3, 4 ], [ N, 6 ] ]
  } ) );
}

await run();

process.exit( 0 );

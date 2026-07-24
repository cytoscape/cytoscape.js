// Focused traversal sweep: v3 vs GPU/v4 at BENCH_N scale.
//
// Standalone (not part of index.mjs): singles and 100-element bands over
// the neighborhood/goers/DAG ops, whose gpu implementations walk the CSR
// adjacency.  On this fixture (each node points at i+1 and i+3, wrapping)
// successors()/predecessors() close over the whole graph, so they scale
// with N — a macro test of the hop machinery, not a micro-op.
//
//   BENCH_N=20000 node --import tsx benchmark/gpu/traversal.mjs

import { run, bench, group, summary, do_not_optimize } from 'mitata';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const elements = buildElements();

const v3 = makeV3( elements );
const gpu = makeGpu( elements );

const K = 8;              // rotation pool size (power of two)
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

// operand builders
const node = ( cy, k ) => cy.$id( 'n' + ( MIDNUM + k ) );
const nodeBand = ( cy, k ) => cy.nodes().slice( k * 50, k * 50 + 100 );
const edgeBand = ( cy, k ) => cy.edges().slice( k * 50, k * 50 + 100 );

console.log( `\n== traversal sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- single-node hops --
cmp( 'trav: neighborhood()',        node, n => n.neighborhood() );
cmp( 'trav: closedNeighborhood()',  node, n => n.closedNeighborhood() );
cmp( 'trav: connectedEdges()',      node, n => n.connectedEdges() );
cmp( 'trav: outgoers()',            node, n => n.outgoers() );
cmp( 'trav: incomers()',            node, n => n.incomers() );

// -- whole-graph closures --
// The fixture's +1/+3 edges give the ring a diameter of ~N/3, so a
// closure is a ~N/3-hop BFS over the whole graph — at 20k that is tens
// of seconds *per call* on v3.  Only benchmarked at small N.
if( N <= 5000 ){
  cmp( 'trav: successors()',        node, n => n.successors() );
  cmp( 'trav: predecessors()',      node, n => n.predecessors() );
}

// -- 100-element bands --
cmp( 'trav: band neighborhood()',   nodeBand, b => b.neighborhood() );
cmp( 'trav: band connectedEdges()', nodeBand, b => b.connectedEdges() );
cmp( 'trav: band roots()',          nodeBand, b => b.roots() );
cmp( 'trav: band sources()',        edgeBand, b => b.sources() );
cmp( 'trav: band connectedNodes()', edgeBand, b => b.connectedNodes() );

await run();

process.exit( 0 );

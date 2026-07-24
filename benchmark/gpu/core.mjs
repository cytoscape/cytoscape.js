// Core-API micro-benchmarks: v3 (src/) vs GPU/v4 (src/gpu/).
//
// Lookup/selection/viewport on the core (cy). See collection.mjs for the
// anti-hoisting methodology: id-based lookups rotate the id over a small band
// so the pure call can't be hoisted out of the measured loop; collection
// accessors allocate and are inherently hoist-resistant.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const elements = buildElements();

const v3 = makeV3( elements );
const gpu = makeGpu( elements );

const K = 8;
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

function cmpMut( name, fn ){
  const a = makeV3( elements );
  const b = makeGpu( elements );

  group( name, () => {
    summary( () => {
      bench( 'v3',  () => { fn( a ); } );
      bench( 'gpu', () => { fn( b ); } );
    } );
  } );
}

const cyOf = cy => cy;   // the core itself; id-based ops rotate via the k arg

console.log( `\n== core API — v3 vs gpu (N=${N} nodes, ${2 * N} edges) ==` );

// -- lookup / selection (id rotated over k to defeat hoisting) --
cmp( 'core: getElementById()',   cyOf, ( c, k ) => c.getElementById( 'n' + ( MIDNUM + k ) ) );
cmp( 'core: $("#id")',           cyOf, ( c, k ) => c.$( '#n' + ( MIDNUM + k ) ) );
cmp( 'core: nodes()',            cyOf, c => c.nodes() );
cmp( 'core: edges()',            cyOf, c => c.edges() );
cmp( 'core: elements()',         cyOf, c => c.elements() );
cmp( 'core: $("node")',          cyOf, c => c.$( 'node' ) );
cmp( 'core: $(":selected")',     cyOf, c => c.$( ':selected' ) );
cmp( 'core: filter(fn)',         cyOf, c => c.filter( e => e.isNode() ) );
cmp( 'core: collection()',       cyOf, c => c.collection() );

// -- viewport reads (extent/pan allocate; kept for coverage) --
cmp( 'core: pan() get',          cyOf, c => c.pan() );
cmp( 'core: extent()',           cyOf, c => c.extent() );

// -- mutations (reversible round-trips; no selection in the timed region) --
cmpMut( 'core: add + remove',    cy => { const e = cy.add( { data: { id: 'tmp' } } ); e.remove(); } );
cmpMut( 'core: zoom set',        cy => { cy.zoom( 2 ); cy.zoom( 1 ); } );

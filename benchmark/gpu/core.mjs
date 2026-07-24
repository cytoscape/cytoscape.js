// Core-API micro-benchmarks: v3 (src/) vs GPU/v4 (src/gpu/).
//
// Selection/lookup/viewport on the core (cy). Read-only groups share one
// instance per implementation; mutating groups get dedicated instances and
// run reversible round-trips.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { buildElements, makeV3, makeGpu, MID, N } from './graph.mjs';

const elements = buildElements();

const v3 = makeV3( elements );
const gpu = makeGpu( elements );

function cmp( name, v3fn, gpufn ){
  group( name, () => {
    summary( () => {
      bench( 'v3',  () => do_not_optimize( v3fn() ) );
      bench( 'gpu', () => do_not_optimize( gpufn() ) );
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

console.log( `\n== core API — v3 vs gpu (N=${N} nodes, ${2 * N} edges) ==` );

// -- lookup / selection --
cmp( 'core: getElementById()',   () => v3.getElementById( MID ),   () => gpu.getElementById( MID ) );
cmp( 'core: $("#id")',           () => v3.$( '#' + MID ),          () => gpu.$( '#' + MID ) );
cmp( 'core: nodes()',            () => v3.nodes(),                 () => gpu.nodes() );
cmp( 'core: edges()',            () => v3.edges(),                 () => gpu.edges() );
cmp( 'core: elements()',         () => v3.elements(),              () => gpu.elements() );
cmp( 'core: $("node")',          () => v3.$( 'node' ),             () => gpu.$( 'node' ) );
cmp( 'core: $(":selected")',     () => v3.$( ':selected' ),        () => gpu.$( ':selected' ) );
cmp( 'core: filter(fn)',         () => v3.filter( e => e.isNode() ), () => gpu.filter( e => e.isNode() ) );
cmp( 'core: collection()',       () => v3.collection(),            () => gpu.collection() );

// -- viewport reads --
cmp( 'core: zoom() get',         () => v3.zoom(),                  () => gpu.zoom() );
cmp( 'core: pan() get',          () => v3.pan(),                   () => gpu.pan() );
cmp( 'core: extent()',           () => v3.extent(),                () => gpu.extent() );

// -- mutations (reversible round-trips) --
cmpMut( 'core: add + remove',    cy => { const e = cy.add( { data: { id: 'tmp' } } ); e.remove(); } );
cmpMut( 'core: zoom set',        cy => { cy.zoom( 2 ); cy.zoom( 1 ); } );

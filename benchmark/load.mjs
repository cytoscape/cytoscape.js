// Loading + wire-format sweep (round 33.4): what it costs to get a graph
// into the model, and back out of it.
//
// The figures this repo quotes most about loading — definition-form init
// 662 -> 236 ms, columnar 80 ms, deserialize ~5 ms, 9.2 MB vs 30 MB —
// all come from one-off profiling of the ndex-x-large fixture during the
// pass-1 follow-ups.  Round 29's survey then dropped a load benchmark as
// "already priced", which is the assumption this round exists to
// question: a number nobody can re-run is a record, not a measurement.
// Every path is a row here:
//
//   node --import tsx benchmark/load.mjs             # N=2000
//   BENCH_N=20000 node --import tsx benchmark/load.mjs
//
// **The def-form rows clone inside the timed region, and must.**  A
// factory consumes its definition objects — v3 adopts position objects
// by reference and writes through them — so re-using one def array across
// iterations silently corrupts it (measured: node positions read back as
// {0,0} from the second iteration on).  Both sides therefore deep-copy
// per iteration, and the clone gets **its own row** so the def numbers
// can be read net of it.  Columnar and wire payloads have no such
// problem: they are re-used as-is, which is also the realistic case
// (serve a static asset, load it repeatedly) — verified by reading
// positions and data back after repeated loads.
//
// Every init row **constructs and disposes**: the instance is destroyed
// inside the timed region on both sides, so the row is a lifecycle
// round-trip rather than init alone, and a long mitata run cannot pile up
// hundreds of live graphs.
//
// **The v3 side is `styleEnabled` with an explicit preset layout**, and
// both halves of that matter — the first version of this suite had
// neither, and they bias in opposite directions.  A headless v3 defaults
// `styleEnabled` to *false*, so an unstyled v3 does less work than v4
// (which always applies its sheet) and the comparison flatters v3; and
// v3's default layout is **grid**, so a plain `cytoscapeV3( { elements } )`
// silently runs a whole layout inside the measured region and the
// comparison flatters v4.  The configuration here is the one
// scenarios.mjs and layouts.mjs already use for the same reasons.

import { bench, group, summary, do_not_optimize } from 'mitata';
import cytoscapeV3 from '../v3/src/test.mjs';
import cytoscape from '../src/index.mjs';
import { finishRun } from './bench-run.mjs';
import { buildElements, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();

// the realistic v3 configuration (see the header): styled, and not
// running its default grid layout inside the measured region
const V3_OPTS = { headless: true, styleEnabled: true, layout: { name: 'preset' } };

const clone = els => els.map( e => ( {
  group: e.group,
  data: { ...e.data },
  position: e.position ? { ...e.position } : undefined
} ) );

// the two prebuilt payload forms (built once — that is their whole point)
const columnar = cytoscape.toColumnarElements( elements );
const wire = cytoscape.serializeElements( columnar );

function has( name ){
  return OP == null || name.includes( OP );
}

console.log( `\n== load sweep (N=${N} nodes, ${2 * N} edges; wire ${( wire.byteLength / 1e6 ).toFixed( 2 )} MB) ==` );

// -- init, both sides ---------------------------------------------------------
if( has( 'init' ) ){
  group( 'load: init from the definition form (construct + dispose)', () => {
    summary( () => {
      bench( 'v3', () => {
        const cy = cytoscapeV3( { elements: clone( elements ), ...V3_OPTS } );

        cy.destroy();
      } );
      bench( 'gpu', () => {
        const cy = cytoscape( { elements: clone( elements ) } );

        cy.destroy();
      } );
    } );
  } );
}

// -- the three v4 ingest forms ------------------------------------------------
// The def row repeats above deliberately: the three forms belong on one
// axis, and the clone control is here so the def number can be read net
// of the copy both it and the v3 row above pay for.
if( has( 'forms' ) ){
  group( 'load: v4 ingest forms (construct + dispose)', () => {
    summary( () => {
      bench( 'definition form', () => {
        const cy = cytoscape( { elements: clone( elements ) } );

        cy.destroy();
      } );
      bench( 'columnar form', () => {
        const cy = cytoscape( { elements: columnar } );

        cy.destroy();
      } );
      bench( 'wire buffer', () => {
        const cy = cytoscape( { elements: wire } );

        cy.destroy();
      } );
      bench( 'def clone alone (control)', () => do_not_optimize( clone( elements ) ) );
    } );
  } );
}

// -- conversion and export ----------------------------------------------------
if( has( 'convert' ) ){
  group( 'load: conversion', () => {
    summary( () => {
      bench( 'toColumnarElements', () => do_not_optimize( cytoscape.toColumnarElements( elements ) ) );
      bench( 'serializeElements (from columnar)', () => do_not_optimize( cytoscape.serializeElements( columnar ) ) );
      bench( 'serializeElements (from defs)', () => do_not_optimize( cytoscape.serializeElements( elements ) ) );
      bench( 'deserializeElements', () => do_not_optimize( cytoscape.deserializeElements( wire ) ) );
    } );
  } );
}

// -- export from a live graph -------------------------------------------------
{
  const gpu = cytoscape( { elements: clone( elements ) } );
  const v3 = cytoscapeV3( { elements: clone( elements ), ...V3_OPTS } );

  if( has( 'export' ) ){
    // cy.serialize() is v4-only (v3 has no binary export at all), so this
    // is a gpu-only row against v4's own json export rather than a
    // comparison v3 cannot take part in
    group( 'load: export from a live graph', () => {
      summary( () => {
        bench( 'cy.serialize() (wire)', () => do_not_optimize( gpu.serialize() ) );
        bench( 'cy.json() (v4)', () => do_not_optimize( gpu.json() ) );
      } );
    } );

    group( 'load: cy.json()', () => {
      summary( () => {
        bench( 'v3',  () => do_not_optimize( v3.json() ) );
        bench( 'gpu', () => do_not_optimize( gpu.json() ) );
      } );
    } );
  }

  // -- incremental add --------------------------------------------------------
  // A band added and removed per iteration, in each of the three forms.
  // This is the path with full per-element semantics (handles, add
  // events) — unlike the factory load, which materializes neither.
  if( has( 'add' ) ){
    const BAND = 256;
    const band = [];

    for( let k = 0; k < BAND; k++ ){
      band.push( { data: { id: 'add' + k, foo: k, weight: k % 7 }, position: { x: k * 3, y: k * 3 } } );
    }

    for( let k = 0; k < BAND; k++ ){
      band.push( { data: { id: 'adde' + k, source: 'add' + k, target: 'add' + ( ( k + 1 ) % BAND ) } } );
    }

    const bandColumnar = cytoscape.toColumnarElements( band );
    const bandWire = cytoscape.serializeElements( bandColumnar );

    group( `load: add a ${BAND}-node band (add + remove)`, () => {
      summary( () => {
        bench( 'v3', () => { v3.add( clone( band ) ).remove(); } );
        bench( 'gpu', () => { gpu.add( clone( band ) ).remove(); } );
      } );
    } );

    group( `load: add a ${BAND}-node band, v4 forms`, () => {
      summary( () => {
        bench( 'definition form', () => { gpu.add( clone( band ) ).remove(); } );
        bench( 'columnar form', () => { gpu.add( bandColumnar ).remove(); } );
        bench( 'wire buffer', () => { gpu.add( bandWire ).remove(); } );
      } );
    } );
  }

  await finishRun( 'load' );

  gpu.destroy();
  v3.destroy();
}

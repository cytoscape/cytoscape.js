// Style-engine sweep (round 33.3): what applying a stylesheet costs.
//
// Before this round the engine's apply paths were priced only obliquely —
// a whole-sheet swap appears in transitions.mjs as a transitions-off-vs-on
// ratio and in scenarios.mjs as one step of the refresh trace, and
// mappers.mjs prices the *data-write* refresh rather than the apply.  This
// suite prices the apply itself:
//
//   node --import tsx benchmark/gpu/style.mjs            # N=2000
//   BENCH_N=200000 BENCH_OP=swap node --import tsx benchmark/gpu/style.mjs
//
// Two sheets alternate on every row that re-applies, so no iteration can
// be skipped as unchanged — the same reason mappers.mjs rotates its
// written value.
//
// Not here, deliberately: the **selection restyle skip**.  The round-4
// finding (v4 skips its restyle pass entirely unless a block matches on
// `:selected`, where v3 pays a style bypass per element) cannot be
// measured as a v4-side variation any more, because v4 has no
// selection-dependent blocks at all — they left with the selector
// removal, and the accent ring is shader-drawn.  There is nothing to turn
// on and off.  What survives of that comparison is the plain
// select/unselect round-trip, which mutators.mjs has priced since
// round 4 (~38x at 200k).  Recorded here rather than silently dropped.

import { bench, group, summary, do_not_optimize } from 'mitata';
import { finishRun } from './bench-run.mjs';
import { buildElements, makeV3, makeGpu, MIDNUM, N } from './graph.mjs';

const OP = process.env.BENCH_OP;
const elements = buildElements();
const instances = [];

// -- the two alternating looks -----------------------------------------------
// Constants only: mapper evaluation has its own suite (mappers.mjs), and
// mixing one in here would make these rows measure the DSL instead of the
// apply.  Same channels on both sides, so the same columns are written.
const GPU_SHEETS = [
  { nodes: { 'background-color': '#3366cc', width: 30, height: 30, 'border-width': 2, 'border-color': '#222' },
    edges: { 'line-color': '#999', width: 2 } },
  { nodes: { 'background-color': '#cc6633', width: 34, height: 34, 'border-width': 3, 'border-color': '#444' },
    edges: { 'line-color': '#777', width: 3 } }
];

const V3_SHEETS = GPU_SHEETS.map( sheet => [
  { selector: 'node', style: { ...sheet.nodes } },
  { selector: 'edge', style: { ...sheet.edges } }
] );

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

function cmp( name, v3Op, gpuOp ){
  if( OP != null && !name.includes( OP ) ){ return; }

  const a = v3Instance();
  const b = gpuInstance();
  let i = 0;

  group( name, () => {
    summary( () => {
      bench( 'v3',  () => { v3Op( a, i++ ); } );
      bench( 'gpu', () => { gpuOp( b, i++ ); } );
    } );
  } );
}

function cmpGpu( name, aLabel, aSetup, aFn, bLabel, bSetup, bFn ){
  if( OP != null && !name.includes( OP ) ){ return; }

  const a = aSetup();
  const b = bSetup();
  let i = 0;

  group( name, () => {
    summary( () => {
      bench( aLabel, () => { aFn( a, i++ ); } );
      bench( bLabel, () => { bFn( b, i++ ); } );
    } );
  } );
}

console.log( `\n== style sweep (N=${N} nodes, ${2 * N} edges) ==` );

// -- whole-sheet application --------------------------------------------------
// The headline: compile + validate + apply every channel of every
// element.  v3 re-applies its stylesheet the same way.
cmp( 'style: sheet swap (compile + applyAll)',
  ( cy, i ) => { cy.style( V3_SHEETS[ i & 1 ] ); },
  ( cy, i ) => { cy.style( GPU_SHEETS[ i & 1 ] ); } );

// Compile alone, separated from apply through the public batching
// semantics: inside a batch `cy.style( sheet )` compiles and validates
// immediately and defers the apply to the outermost endBatch (round 6).
// So the difference between these two rows is the applyAll.
cmpGpu( 'style: compile vs compile + apply',
  'compile only (in batch)', gpuInstance, ( cy, i ) => {
    cy.startBatch();
    cy.style( GPU_SHEETS[ i & 1 ] );
    // drop the apply the batch deferred, so this row is the compile alone
    // (the batch records it as `pending.sheet`, flushed as one applyAll)
    cy._batchPending.sheet = false;
    cy.endBatch();
  },
  'compile + apply', gpuInstance, ( cy, i ) => { cy.style( GPU_SHEETS[ i & 1 ] ); } );

// -- the first apply of newly added elements ----------------------------------
// A band added and removed per iteration: the add pays the first style
// application of its elements (v4 batches it; v3 applies per element).
{
  const BAND = 256;
  const band = Array.from( { length: BAND }, ( _, k ) => ( {
    data: { id: 'add' + k, foo: k, weight: k % 7 },
    position: { x: k * 3, y: k * 3 }
  } ) );

  const addRemove = cy => {
    const added = cy.add( band.map( e => ( { data: { ...e.data }, position: { ...e.position } } ) ) );

    added.remove();
  };

  cmp( `style: first apply on add (${BAND}-node band)`, addRemove, addRemove );
}

// -- the parents overlay ------------------------------------------------------
// Round 14.6 partitions node slots by FLAG_PARENT and resolves the
// parents overlay for the parent half.  This prices that partition: the
// same sheet applied to a flat graph and to a compound one of the same
// element count.  Not a v3 comparison — the two sides are two v4 graphs.
// Both sides run one generator so the two graphs differ in exactly one
// thing.  The first version of this row built the compound side without
// edges and read 3.55x *faster* than flat — which was not the parents
// partition being free, it was 4000 edges missing from one side (design
// call 1, caught by design call 5 for the second time this round).
//
// The one difference that cannot be removed is inherent: a compound graph
// has parent nodes, so the compound side carries N/CLUSTER extra node
// slots.  That is the thing being priced, and it is noted rather than
// engineered away.
{
  const CLUSTER = 20;
  const clusters = Math.max( 1, Math.floor( N / CLUSTER ) );

  const withHierarchy = parents => {
    const out = [];

    if( parents ){
      for( let c = 0; c < clusters; c++ ){ out.push( { data: { id: 'p' + c } } ); }
    }

    for( const e of elements ){
      const data = { ...e.data };

      if( parents && data.source == null && /^n\d+$/.test( data.id ) ){
        data.parent = 'p' + ( Number( data.id.slice( 1 ) ) % clusters );
      }

      out.push( { data, position: e.position ? { ...e.position } : undefined } );
    }

    return out;
  };

  const PARENT_SHEETS = GPU_SHEETS.map( sheet => ( { ...sheet, parents: { 'background-color': '#eee', padding: 10 } } ) );

  const instance = parents => () => {
    const cy = makeGpu( withHierarchy( parents ) );

    instances.push( cy );

    return cy;
  };

  cmpGpu( `style: applyAll, flat vs compound (${clusters} parents — the 14.6 partition)`,
    'flat', instance( false ), ( cy, i ) => { cy.style( PARENT_SHEETS[ i & 1 ] ); },
    'compound', instance( true ), ( cy, i ) => { cy.style( PARENT_SHEETS[ i & 1 ] ); } );
}

// -- readback -----------------------------------------------------------------
// v4's getters read the *stored channels* — the resolved values the
// renderer draws from — where v3 resolves through its style cache.  Ids
// rotate over a band so nothing is hoisted out of the measured region
// (the core.mjs methodology).
//
// These rows were the finding that became rounds 34.5 and 35: they read
// 13–21× v3 here, which was mostly tsx's `__name` wrapper (this suite
// imports `src/`), and under it a real 5.8× gap that memoizing
// `normalizeProp` took to 2.3×.  **They also all read
// `background-color` and `width`, which were the 4th and 6th cases of
// readProp's switch** — the cheapest end of a dispatch whose cost then
// depended on position, so they understated every other property.  The
// switch is a `Map` since round 35, so position no longer matters; the
// row to watch for the whole surface is the whole-object `style()`
// below, which reads every property of the group.
{
  const K = 8;
  const MASK = K - 1;

  function cmpRead( name, op ){
    if( OP != null && !name.includes( OP ) ){ return; }

    const a = v3Instance();
    const b = gpuInstance();

    a.style( V3_SHEETS[ 0 ] );
    b.style( GPU_SHEETS[ 0 ] );

    const vs = Array.from( { length: K }, ( _, k ) => a.getElementById( 'n' + ( MIDNUM + k ) ) );
    const gs = Array.from( { length: K }, ( _, k ) => b.$id( 'n' + ( MIDNUM + k ) ) );
    let i = 0;

    group( name, () => {
      summary( () => {
        bench( 'v3',  () => { const k = ( i++ ) & MASK; return do_not_optimize( op( vs[ k ] ) ); } );
        bench( 'gpu', () => { const k = ( i++ ) & MASK; return do_not_optimize( op( gs[ k ] ) ); } );
      } );
    } );
  }

  cmpRead( 'style: read one prop (color)', n => n.style( 'background-color' ) );
  cmpRead( 'style: read one prop (width)', n => n.style( 'width' ) );
  cmpRead( 'style: numericStyle', n => n.numericStyle( 'width' ) );
  cmpRead( 'style: renderedStyle (one prop)', n => n.renderedStyle( 'width' ) );
  cmpRead( 'style: whole-object style()', n => n.style() );
}

await finishRun( 'style' );

for( const cy of instances ){ cy.destroy(); }

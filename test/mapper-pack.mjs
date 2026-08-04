import { expect } from 'chai';
import {
  packPrograms, buildDataRegions, updateDataRegion, alignSlots,
  PROGRAM_WORDS, PROGRAM_BYTES, KIND, FLAG
} from '../src/render/mapper-runtime.mjs';
import { compileMapper } from '../src/style-scales.mjs';
import { srgbToOklab } from '../src/style-schemes.mjs';
import { DataStore } from '../src/store/data-store.mjs';

// exact byte layout of the GPU eval pass's inputs (no device needed)

const NUM_OPACITY = { kind: 'number', prop: 'opacity' };
const COLOR_BG = { kind: 'color', prop: 'background-color' };

const dataWith = ( values, key = 'w' ) => {
  const data = new DataStore();

  values.forEach( ( value, slot ) => {
    if( value !== undefined ){ data.set( 'nodes', slot, key, value ); }
  } );

  return data;
};

const input = ( spec, opts, fallback = 1 ) => ( { m: compileMapper( spec, opts ), fallback } );

describe('gpu/mapper-pack', function(){

  it('packs a linear scalar program with exact word offsets', function(){
    const packed = packPrograms( 'nodes',
      [ input( { data: 'w', domain: [ 2, 10 ], range: [ 0.2, 1 ] }, NUM_OPACITY, 0.5 ) ],
      dataWith( [ 3 ] ), 6 );

    expect( packed.programCount ).to.equal( 1 );
    expect( packed.programData.byteLength ).to.equal( PROGRAM_BYTES );

    const u32 = new Uint32Array( packed.programData );
    const f32 = new Float32Array( packed.programData );

    expect( u32[ 0 ] ).to.equal( 2 );               // node opacity target
    expect( u32[ 1 ] ).to.equal( KIND.IDENTITY );
    expect( u32[ 2 ] ).to.equal( FLAG.CLAMP );      // scalar, clamped by default
    expect( u32[ 3 ] ).to.equal( 0 );               // dataBase
    expect( f32[ 4 ] ).to.equal( 2 );               // lo
    expect( f32[ 5 ] ).to.equal( 10 );              // hi
    expect( u32[ 8 ] ).to.equal( 1 );               // outBase (after 1 vec4 of inStops)
    expect( u32[ 9 ] ).to.equal( 2 );               // stop count
    expect( u32[ 10 ] ).to.equal( 0 );              // inBase
    expect( f32[ 12 ] ).to.equal( 0.5 );            // fallback scalar

    expect( [ ...packed.stopData ] ).to.deep.equal( [
      2, 10, 0, 0,     // inStops, vec4-padded
      0.2, 0, 0, 0,    // out stop 0
      1, 0, 0, 0       // out stop 1
    ].map( Math.fround ) );

    expect( packed.ownedColumns ).to.deep.equal( [ 'node.opacity' ] );
    expect( packed.keys ).to.deep.equal( [ 'w' ] );
  });

  it('packs transform params (log base, pow exponent)', function(){
    const packed = packPrograms( 'nodes', [
      input( { data: 'w', scale: 'log', base: 2, domain: [ 1, 1024 ], range: [ 0, 1 ] }, NUM_OPACITY ),
      input( { data: 'w', scale: 'pow', exponent: 3, domain: [ 0, 10 ], range: [ 0, 1 ] }, NUM_OPACITY )
    ], dataWith( [ 3 ] ), 4 );

    const u32 = new Uint32Array( packed.programData );
    const f32 = new Float32Array( packed.programData );

    expect( u32[ 1 ] ).to.equal( KIND.LOG );
    expect( f32[ 6 ] ).to.equal( 2 );

    expect( u32[ PROGRAM_WORDS + 1 ] ).to.equal( KIND.POW );
    expect( f32[ PROGRAM_WORDS + 6 ] ).to.equal( 3 );
  });

  it('packs OKLab color stops (and sRGB under interpolate: srgb)', function(){
    const packed = packPrograms( 'nodes',
      [ input( { data: 'w', domain: [ 0, 1 ], range: 'viridis' }, COLOR_BG, [ 0, 0, 0, 255 ] ) ],
      dataWith( [ 0.5 ] ), 4 );

    const u32 = new Uint32Array( packed.programData );

    expect( u32[ 2 ] ).to.equal( FLAG.COLOR | FLAG.CLAMP );
    expect( u32[ 9 ] ).to.equal( 10 );  // viridis stop count
    expect( u32[ 10 ] ).to.equal( 0 );  // inStops first
    expect( u32[ 8 ] ).to.equal( 3 );   // ceil(10/4) vec4s of inStops

    const [ L ] = srgbToOklab( 0x44, 0x01, 0x54 );

    expect( packed.stopData[ 3 * 4 ] ).to.be.closeTo( L, 1e-6 );   // first stop's L
    expect( packed.stopData[ 3 * 4 + 3 ] ).to.equal( 1 );          // alpha

    const srgb = packPrograms( 'nodes',
      [ input( { data: 'w', domain: [ 0, 1 ], range: [ '#000000', '#ffffff' ], interpolate: 'srgb' }, COLOR_BG, [ 0, 0, 0, 255 ] ) ],
      dataWith( [ 0.5 ] ), 4 );

    expect( new Uint32Array( srgb.programData )[ 2 ] ).to.equal( FLAG.COLOR | FLAG.CLAMP | FLAG.SRGB );
    expect( srgb.stopData[ 2 * 4 ] ).to.equal( 1 ); // white stop, normalized sRGB
  });

  it('packs discrete outputs as exact normalized sRGB', function(){
    const packed = packPrograms( 'nodes',
      [ input( { data: 'w', scale: 'threshold', domain: [ 0, 10 ], range: [ '#000000', '#808080', '#ffffff' ] }, COLOR_BG, [ 0, 0, 0, 255 ] ) ],
      dataWith( [ 5 ] ), 4 );

    const u32 = new Uint32Array( packed.programData );

    expect( u32[ 1 ] ).to.equal( KIND.DISCRETE );
    expect( u32[ 9 ] ).to.equal( 3 );
    expect( u32[ 10 ] ).to.equal( 0 );  // cuts
    expect( u32[ 8 ] ).to.equal( 1 );   // outputs after 1 vec4 of cuts

    expect( packed.stopData[ 0 ] ).to.equal( 0 );
    expect( packed.stopData[ 1 ] ).to.equal( 10 );
    expect( packed.stopData[ 2 * 4 ] ).to.equal( Math.fround( 128 / 255 ) ); // middle bin
  });

  it('orders opacity programs first and dedupes data regions by key', function(){
    const packed = packPrograms( 'nodes', [
      input( { data: 'w', domain: [ 0, 1 ], range: [ '#000000', '#ffffff' ] }, COLOR_BG, [ 0, 0, 0, 255 ] ),
      input( { data: 'w', domain: [ 0, 1 ], range: [ 0, 1 ] }, NUM_OPACITY ),
      input( { data: 'z', domain: [ 0, 1 ], range: [ '#000000', '#ffffff' ] }, { kind: 'color', prop: 'border-color' }, [ 0, 0, 0, 255 ] )
    ], dataWith( [ 0.5 ] ), 5 );

    const u32 = new Uint32Array( packed.programData );

    expect( u32[ 0 ] ).to.equal( 2 ); // opacity packed first
    expect( u32[ 3 ] ).to.equal( 0 ); // dataBase for 'w'
    expect( u32[ PROGRAM_WORDS + 3 ] ).to.equal( 0 );      // same key 'w' shares the region
    expect( u32[ 2 * PROGRAM_WORDS + 3 ] ).to.equal( 8 );  // 'z' at alignSlots(5) = 8

    expect( packed.keys ).to.deep.equal( [ 'w', 'z' ] );
  });

  it('skips non-paint props, string/mixed columns and ordinal programs', function(){
    const data = dataWith( [ 1 ] );

    data.set( 'nodes', 0, 's', 'abc' );          // string column
    data.set( 'nodes', 0, 'm', 1 );
    data.set( 'nodes', 0, 'm', true );           // promotes to mixed

    const packed = packPrograms( 'nodes', [
      input( { data: 'w', domain: [ 0, 1 ], range: [ 1, 5 ] }, { kind: 'number', prop: 'width' } ),
      input( { data: 's', domain: [ 0, 1 ], range: [ 0, 1 ] }, NUM_OPACITY ),
      input( { data: 'm', domain: [ 0, 1 ], range: [ 0, 1 ] }, NUM_OPACITY ),
      input( { data: 'w', scale: 'ordinal', domain: [ 1 ], range: [ 0.5 ] }, NUM_OPACITY ),
      input( { data: 'w', domain: [ 0, 1 ], range: [ 0, 1 ] }, NUM_OPACITY )
    ], data, 4 );

    expect( packed.programCount ).to.equal( 1 );
    expect( packed.skipped.map( m => m.prop + ':' + m.program.kind ) ).to.deep.equal( [
      'width:continuous', 'opacity:continuous', 'opacity:continuous', 'opacity:ordinal'
    ] );
  });

  it('packs OKLab fallbacks in OKLab space, with a unit alpha multiplier', function(){
    const packed = packPrograms( 'nodes',
      [ input( { data: 'w', domain: [ 0, 1 ], range: 'viridis' }, COLOR_BG, [ 0x44, 0x01, 0x54, 255 ] ) ],
      dataWith( [ 0.5 ] ), 4 );

    const f32 = new Float32Array( packed.programData );
    const [ L, A, B ] = srgbToOklab( 0x44, 0x01, 0x54 );

    expect( f32[ 7 ] ).to.equal( 1 ); // alphaMul
    expect( f32[ 12 ] ).to.be.closeTo( L, 1e-6 );
    expect( f32[ 13 ] ).to.be.closeTo( A, 1e-6 );
    expect( f32[ 14 ] ).to.be.closeTo( B, 1e-6 );
    expect( f32[ 15 ] ).to.equal( 1 );
  });

  it('flags discrete color outputs as sRGB', function(){
    const packed = packPrograms( 'nodes',
      [ input( { data: 'w', scale: 'threshold', domain: [ 5 ], range: [ '#000000', '#ffffff' ] }, COLOR_BG, [ 0, 0, 0, 255 ] ) ],
      dataWith( [ 1 ] ), 4 );

    expect( new Uint32Array( packed.programData )[ 2 ] ).to.equal( FLAG.COLOR | FLAG.SRGB );
  });

  it('synthesizes constant arrow programs when edge opacity is mapped', function(){
    const ctx = {
      opacityMapped: true,
      constOpacity: 1,
      source: { enabled: false, colorMapped: false, constColor: [ 0, 0, 0, 255 ] },
      target: { enabled: true, colorMapped: false, constColor: [ 255, 0, 0, 255 ] }
    };
    const packed = packPrograms( 'edges',
      [ input( { data: 'o', domain: [ 0, 1 ], range: [ 0, 1 ] }, { kind: 'number', prop: 'opacity' } ) ],
      dataWith( [ 0.5 ], 'o' ), 4, ctx );

    expect( packed.programCount ).to.equal( 2 );
    expect( packed.props ).to.deep.equal( [ 'opacity', 'target-arrow-color' ] );
    expect( packed.ownedColumns ).to.deep.equal( [ 'edge.opacity', 'edge.targetArrow' ] );

    const u32 = new Uint32Array( packed.programData );
    const f32 = new Float32Array( packed.programData );
    const at = PROGRAM_WORDS;

    expect( u32[ at ] ).to.equal( 3 );                 // targetArrow
    expect( u32[ at + 1 ] ).to.equal( KIND.CONSTANT );
    expect( u32[ at + 2 ] ).to.equal( FLAG.COLOR | FLAG.SRGB | FLAG.MUL_ALPHA );
    expect( f32[ at + 12 ] ).to.equal( 1 );            // red, normalized
    expect( f32[ at + 15 ] ).to.equal( 1 );
  });

  it('folds a constant edge opacity into mapped arrow colors via alphaMul', function(){
    const ctx = {
      opacityMapped: false,
      constOpacity: 0.5,
      source: { enabled: true, colorMapped: true, constColor: [ 0, 0, 0, 255 ] },
      target: { enabled: false, colorMapped: false, constColor: [ 0, 0, 0, 255 ] }
    };
    const packed = packPrograms( 'edges',
      [ input( { data: 'o', domain: [ 0, 1 ], range: [ '#000000', '#ffffff' ] }, { kind: 'color', prop: 'source-arrow-color' }, [ 0, 0, 0, 255 ] ) ],
      dataWith( [ 0.5 ], 'o' ), 4, ctx );

    const u32 = new Uint32Array( packed.programData );
    const f32 = new Float32Array( packed.programData );

    expect( packed.programCount ).to.equal( 1 ); // no synthesis without mapped opacity
    expect( u32[ 2 ] & FLAG.MUL_ALPHA ).to.equal( 0 );
    expect( f32[ 7 ] ).to.equal( 0.5 );
  });

  it('packs string ordinals as dict-index LUTs with fallback holes', function(){
    const data = dataWith( [ 'a', 'b' ], 'cat' );
    const packed = packPrograms( 'nodes',
      [ input(
        { data: 'cat', scale: 'ordinal', domain: [ 'a' ], range: [ '#ff0000' ] },
        COLOR_BG, [ 0, 0, 255, 255 ] ) ],
      data, 4 );

    const u32 = new Uint32Array( packed.programData );

    expect( packed.programCount ).to.equal( 1 );
    expect( u32[ 1 ] ).to.equal( KIND.ORDINAL );
    expect( u32[ 2 ] ).to.equal( FLAG.COLOR | FLAG.DICT | FLAG.SRGB );
    expect( u32[ 9 ] ).to.equal( 2 ); // LUT covers the whole dict
    expect( packed.dictSizes ).to.deep.equal( { cat: 2 } );

    // dict entry 'a' → red; 'b' is unlisted → the fallback rides the LUT
    expect( [ ...packed.stopData.slice( 0, 8 ) ] ).to.deep.equal( [ 1, 0, 0, 1, 0, 0, 1, 1 ] );
  });

  it('builds and refreshes packed data regions', function(){
    const data = dataWith( [ 1 / 3, undefined, 2 ] );

    data.set( 'nodes', 1, 's', 'b' );
    data.set( 'nodes', 0, 's', 'a' );

    const regions = buildDataRegions( 'nodes', [ 'w', 's' ], data, 5 );

    expect( regions.capAligned ).to.equal( alignSlots( 5 ) ).and.to.equal( 8 );
    expect( regions.values[ 0 ] ).to.equal( Math.fround( 1 / 3 ) );
    expect( regions.present[ 0 ] ).to.equal( 1 );
    expect( regions.present[ 1 ] ).to.equal( 0 ); // absent
    expect( regions.values[ 2 ] ).to.equal( 2 );

    // dict indices bitcast into the same buffer
    const u32 = new Uint32Array( regions.values.buffer );

    expect( u32[ 8 + 1 ] ).to.equal( 1 );  // 'b' interned first
    expect( u32[ 8 + 0 ] ).to.equal( 2 );
    expect( regions.present[ 8 + 2 ] ).to.equal( 0 );

    // span refresh reports the touched value bytes
    data.set( 'nodes', 1, 'w', 7 );

    const range = updateDataRegion( regions, 'nodes', 0, data, 1, 2 );

    expect( regions.values[ 1 ] ).to.equal( 7 );
    expect( regions.present[ 1 ] ).to.equal( 1 );
    expect( range ).to.deep.equal( { valueByteStart: 4, valueByteEnd: 8 } );
  });

});

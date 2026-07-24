import { expect } from 'chai';
import {
  SCHEMES, resolveScheme, hexToRgb, srgbToOklab, oklabToSrgb
} from '../src/gpu/style-schemes.mjs';
import {
  compileMapper, bindEvaluator, isMapperSpec, autoExtentFor, applyAutoExtent
} from '../src/gpu/style-scales.mjs';
import { DataStore } from '../src/gpu/store/data-store.mjs';
import cytoscapeGpu from '../src/gpu/index.mjs';

// pure compile/eval coverage against a bare DataStore; the engine-level
// behaviour (sheet integration, refresh, getters) lives in later suites

const NUM = { kind: 'number', prop: 'width' };
const COLOR = { kind: 'color', prop: 'background-color' };
const ENUM = {
  kind: 'enum', prop: 'shape',
  parseEnum: v => ( { circle: 0, square: 2 }[ v ] ?? null )
};

/** DataStore with nodes' key 'w' set per slot from the given list. */
const dataWith = ( values, key = 'w' ) => {
  const data = new DataStore();

  values.forEach( ( value, slot ) => {
    if( value !== undefined ){ data.set( 'nodes', slot, key, value ); }
  } );

  return data;
};

const evaluator = ( spec, opts, values, fallback = -1 ) => {
  return bindEvaluator( compileMapper( spec, opts ), dataWith( values ), 'nodes', fallback );
};

describe('gpu/mappers', function(){

  describe('isMapperSpec', function(){
    it('detects plain objects with a string data field', function(){
      expect( isMapperSpec( { data: 'w' } ) ).to.be.true;
      expect( isMapperSpec( { data: 'w', range: [ 0, 1 ] } ) ).to.be.true;
      expect( isMapperSpec( 'data(w)' ) ).to.be.false;
      expect( isMapperSpec( 5 ) ).to.be.false;
      expect( isMapperSpec( null ) ).to.be.false;
      expect( isMapperSpec( [ 1, 2 ] ) ).to.be.false;
      expect( isMapperSpec( { range: [ 0, 1 ] } ) ).to.be.false;
    });
  });

  describe('compile validation', function(){
    const bad = ( spec, opts, re ) => {
      expect( () => compileMapper( spec, opts ), JSON.stringify( spec ) ).to.throw( re );
    };

    it('throws on unknown scales and schemes', function(){
      bad( { data: 'w', scale: 'exp', range: [ 0, 1 ] }, NUM, /unknown scale 'exp'/ );
      bad( { data: 'w', range: 'nope' }, COLOR, /scheme 'nope'/ );
    });

    it('throws on a scaled mapper without a range', function(){
      bad( { data: 'w', scale: 'log' }, NUM, /needs a range/ );
      bad( { data: 'w', domain: [ 0, 1 ] }, NUM, /needs a range/ );
    });

    it('throws on continuous scales over enum channels', function(){
      bad( { data: 'w', domain: [ 0, 1 ], range: [ 'circle', 'square' ] }, ENUM, /cannot be continuously interpolated/ );
    });

    it('throws on log domains touching zero', function(){
      bad( { data: 'w', scale: 'log', domain: [ 0, 10 ], range: [ 0, 1 ] }, NUM, /symlog/ );
      bad( { data: 'w', scale: 'log', domain: [ -1, 1 ], range: [ 0, 1 ] }, NUM, /symlog/ );
    });

    it('throws on malformed domains', function(){
      bad( { data: 'w', domain: [ 1, 1 ], range: [ 0, 1 ] }, NUM, /ascending/ );
      bad( { data: 'w', domain: [ 2, 1 ], range: [ 0, 1 ] }, NUM, /ascending/ );
      bad( { data: 'w', domain: [ 0, 'x' ], range: [ 0, 1 ] }, NUM, /finite numbers/ );
      bad( { data: 'w', scale: 'diverging', domain: [ 0, 1 ], range: [ 0, 1, 2 ] }, NUM, /min, mid, max/ );
    });

    it('throws on pairing violations', function(){
      bad( { data: 'w', domain: [ 0, 1, 2 ], range: [ 0, 1 ] }, NUM, /pair 1:1/ );
      bad( { data: 'w', scale: 'ordinal', domain: [ 'a', 'b' ], range: [ 1 ] }, NUM, /pair 1:1/ );
      bad( { data: 'w', scale: 'threshold', domain: [ 10 ], range: [ 1, 2, 3 ] }, NUM, /domain.length \+ 1/ );
    });

    it('throws on scheme misuse', function(){
      bad( { data: 'w', range: 'viridis' }, NUM, /only valid for color/ );
      bad( { data: 'w', range: 'category10' }, COLOR, /categorical scheme/ );
      bad( { data: 'w', scale: 'quantize', domain: [ 0, 1 ], range: 'viridis' }, COLOR, /bins/ );
    });

    it('throws on unparsable range entries and fallbacks', function(){
      bad( { data: 'w', domain: [ 0, 1 ], range: [ 0, 'wide' ] }, NUM, /not a valid number/ );
      bad( { data: 'w', domain: [ 0, 1 ], range: [ '#000', 'nocolor' ] }, COLOR, /not a valid color/ );
      bad( { data: 'w', scale: 'ordinal', domain: [ 'a' ], range: [ 'hexagon' ] }, ENUM, /not a valid enum/ );
      bad( { data: 'w', fallback: 'wide' }, NUM, /not a valid number/ );
      bad( { data: '' }, NUM, /non-empty/ );
    });
  });

  describe('continuous scales', function(){
    it('linear: endpoints, midpoint, default clamp', function(){
      const ev = evaluator( { data: 'w', domain: [ 0, 10 ], range: [ 0, 100 ] }, NUM, [ 0, 5, 10, 20, -3 ] );

      expect( ev( 0 ) ).to.equal( 0 );
      expect( ev( 1 ) ).to.equal( 50 );
      expect( ev( 2 ) ).to.equal( 100 );
      expect( ev( 3 ) ).to.equal( 100 ); // clamped
      expect( ev( 4 ) ).to.equal( 0 );
    });

    it('clamp: false extrapolates the end segments', function(){
      const ev = evaluator( { data: 'w', domain: [ 0, 10 ], range: [ 0, 100 ], clamp: false }, NUM, [ 20, -5 ] );

      expect( ev( 0 ) ).to.equal( 200 );
      expect( ev( 1 ) ).to.equal( -50 );
    });

    it('multi-stop: pairwise and even-spread', function(){
      const pairwise = evaluator(
        { data: 'w', domain: [ 0, 10, 100 ], range: [ 0, 1, 10 ] }, NUM, [ 55 ] );
      const spread = evaluator(
        { data: 'w', domain: [ 0, 10 ], range: [ 0, 1, 10 ] }, NUM, [ 7.5 ] );

      expect( pairwise( 0 ) ).to.equal( 5.5 );
      expect( spread( 0 ) ).to.equal( 5.5 );
    });

    it('log maps in log space', function(){
      const ev = evaluator(
        { data: 'w', scale: 'log', domain: [ 1, 1000 ], range: [ 0, 30 ] },
        NUM, [ Math.pow( 10, 1.5 ), 1, 1000, 0.5, -5 ] );

      expect( ev( 0 ) ).to.be.closeTo( 15, 1e-9 );
      expect( ev( 1 ) ).to.equal( 0 );
      expect( ev( 2 ) ).to.equal( 30 );
      expect( ev( 3 ) ).to.equal( 0 ); // clamped up to the domain
      expect( ev( 4 ) ).to.equal( 0 ); // sign mismatch clamps too
    });

    it('log with clamp: false treats non-positive data as missing', function(){
      const ev = evaluator(
        { data: 'w', scale: 'log', domain: [ 1, 1000 ], range: [ 0, 30 ], clamp: false, fallback: 99 },
        NUM, [ -5, 0 ] );

      expect( ev( 0 ) ).to.equal( 99 );
      expect( ev( 1 ) ).to.equal( 99 );
    });

    it('sqrt and pow', function(){
      const sqrt = evaluator( { data: 'w', scale: 'sqrt', domain: [ 0, 100 ], range: [ 0, 10 ] }, NUM, [ 25 ] );
      const pow = evaluator( { data: 'w', scale: 'pow', exponent: 2, domain: [ 0, 10 ], range: [ 0, 100 ] }, NUM, [ 5 ] );

      expect( sqrt( 0 ) ).to.equal( 5 );
      expect( pow( 0 ) ).to.equal( 25 );
    });

    it('symlog crosses zero', function(){
      const ev = evaluator(
        { data: 'w', scale: 'symlog', domain: [ -10, 10 ], range: [ 0, 10 ] }, NUM, [ 0, -10, 10 ] );

      expect( ev( 0 ) ).to.be.closeTo( 5, 1e-9 );
      expect( ev( 1 ) ).to.equal( 0 );
      expect( ev( 2 ) ).to.equal( 10 );
    });

    it('diverging centers the range at the midpoint of an asymmetric domain', function(){
      const ev = evaluator(
        { data: 'w', scale: 'diverging', domain: [ -1, 0, 10 ], range: [ 0, 50, 100 ] },
        NUM, [ 0, -0.5, 5, -1, 10 ] );

      expect( ev( 0 ) ).to.equal( 50 );
      expect( ev( 1 ) ).to.equal( 25 );
      expect( ev( 2 ) ).to.equal( 75 );
      expect( ev( 3 ) ).to.equal( 0 );
      expect( ev( 4 ) ).to.equal( 100 );
    });
  });

  describe('discrete scales', function(){
    it('threshold: d3 boundary semantics', function(){
      const ev = evaluator(
        { data: 'w', scale: 'threshold', domain: [ 0, 10 ], range: [ 1, 2, 3 ] },
        NUM, [ -1, 0, 9.99, 10 ] );

      expect( ev( 0 ) ).to.equal( 1 );
      expect( ev( 1 ) ).to.equal( 2 );
      expect( ev( 2 ) ).to.equal( 2 );
      expect( ev( 3 ) ).to.equal( 3 );
    });

    it('quantize: uniform bins from the range length', function(){
      const ev = evaluator(
        { data: 'w', scale: 'quantize', domain: [ 0, 10 ], range: [ 1, 2 ] }, NUM, [ 4.9, 5 ] );

      expect( ev( 0 ) ).to.equal( 1 );
      expect( ev( 1 ) ).to.equal( 2 );
    });

    it('quantize: scheme range with bins', function(){
      const ev = evaluator(
        { data: 'w', scale: 'quantize', domain: [ 0, 1 ], range: 'viridis', bins: 3 },
        COLOR, [ 0.1, 0.9 ] );

      expect( ev( 0 ) ).to.deep.equal( [ 0x44, 0x01, 0x54, 255 ] );
      expect( ev( 1 ) ).to.deep.equal( [ 0xfd, 0xe7, 0x25, 255 ] );
    });

    it('discrete families work on enum channels', function(){
      const ev = evaluator(
        { data: 'w', scale: 'threshold', domain: [ 10 ], range: [ 'circle', 'square' ] },
        ENUM, [ 5, 15 ] );

      expect( ev( 0 ) ).to.equal( 0 );
      expect( ev( 1 ) ).to.equal( 2 );
    });
  });

  describe('ordinal', function(){
    it('maps string categories through the dictionary', function(){
      const ev = bindEvaluator(
        compileMapper( { data: 'w', scale: 'ordinal', domain: [ 'a', 'b' ], range: [ 'circle', 'square' ] }, ENUM ),
        dataWith( [ 'a', 'b', 'c', undefined ] ), 'nodes', -1 );

      expect( ev( 0 ) ).to.equal( 0 );
      expect( ev( 1 ) ).to.equal( 2 );
      expect( ev( 2 ) ).to.equal( -1 ); // unknown category → channel default
      expect( ev( 3 ) ).to.equal( -1 ); // absent
    });

    it('maps numeric categories', function(){
      const ev = evaluator(
        { data: 'w', scale: 'ordinal', domain: [ 1, 2 ], range: [ 10, 20 ], fallback: 0 }, NUM, [ 1, 2, 3 ] );

      expect( ev( 0 ) ).to.equal( 10 );
      expect( ev( 1 ) ).to.equal( 20 );
      expect( ev( 2 ) ).to.equal( 0 ); // fallback beats the channel default
    });

    it('takes categorical schemes from the start', function(){
      const ev = bindEvaluator(
        compileMapper( { data: 'w', scale: 'ordinal', domain: [ 'a', 'b' ], range: 'category10' }, COLOR ),
        dataWith( [ 'a', 'b' ] ), 'nodes', [ 0, 0, 0, 255 ] );

      expect( ev( 0 ) ).to.deep.equal( [ 0x1f, 0x77, 0xb4, 255 ] );
      expect( ev( 1 ) ).to.deep.equal( [ 0xff, 0x7f, 0x0e, 255 ] );
    });
  });

  describe('colors', function(){
    it('scheme endpoints are exact', function(){
      const ev = evaluator( { data: 'w', domain: [ 0, 1 ], range: 'viridis' }, COLOR, [ 0, 1 ] );

      expect( ev( 0 ) ).to.deep.equal( [ 0x44, 0x01, 0x54, 255 ] );
      expect( ev( 1 ) ).to.deep.equal( [ 0xfd, 0xe7, 0x25, 255 ] );
    });

    it('OKLab midpoints avoid the gray sRGB midpoint', function(){
      const oklab = evaluator( { data: 'w', domain: [ 0, 1 ], range: [ 'blue', 'yellow' ] }, COLOR, [ 0.5 ] );
      const srgb = evaluator(
        { data: 'w', domain: [ 0, 1 ], range: [ 'blue', 'yellow' ], interpolate: 'srgb' }, COLOR, [ 0.5 ] );

      expect( srgb( 0 ) ).to.deep.equal( [ 128, 128, 128 , 255 ] );

      const [ r, g, b ] = oklab( 0 );
      const spread = Math.max( r, g, b ) - Math.min( r, g, b );

      expect( spread, `oklab mid rgb(${r},${g},${b}) should not be gray` ).to.be.above( 30 );
    });

    it('interpolates alpha', function(){
      const ev = evaluator(
        { data: 'w', domain: [ 0, 1 ], range: [ 'rgba(255, 0, 0, 0)', 'rgba(255, 0, 0, 1)' ] },
        COLOR, [ 0.5 ] );

      expect( ev( 0 )[ 3 ] ).to.be.closeTo( 128, 1 );
    });

    it('keeps irregular color stops exact (piecewise, not resampled)', function(){
      const ev = evaluator(
        { data: 'w', domain: [ 0, 1, 100 ], range: [ '#000000', '#808080', '#ffffff' ] },
        COLOR, [ 0, 100, 1 ] );

      expect( ev( 0 ) ).to.deep.equal( [ 0, 0, 0, 255 ] );
      expect( ev( 1 ) ).to.deep.equal( [ 255, 255, 255, 255 ] );

      const [ r, g, b ] = ev( 2 ); // the stop squeezed into 1% of the span survives

      expect( r ).to.be.closeTo( 128, 1 );
      expect( g ).to.be.closeTo( 128, 1 );
      expect( b ).to.be.closeTo( 128, 1 );
    });
  });

  describe('passthrough & fallback', function(){
    it('passes numeric data through, with fallback then channel default', function(){
      const plain = evaluator( { data: 'w' }, NUM, [ 42, undefined ], 30 );
      const fb = evaluator( { data: 'w', fallback: 7 }, NUM, [ 42, undefined ], 30 );

      expect( plain( 0 ) ).to.equal( 42 );
      expect( plain( 1 ) ).to.equal( 30 );
      expect( fb( 1 ) ).to.equal( 7 );
    });

    it('parses string data per channel kind', function(){
      const color = evaluator( { data: 'w' }, COLOR, [ 'red', 'nocolor' ], [ 9, 9, 9, 255 ] );
      const num = evaluator( { data: 'w' }, NUM, [ '5' ] , -1 );

      expect( color( 0 ) ).to.deep.equal( [ 255, 0, 0, 255 ] );
      expect( color( 1 ) ).to.deep.equal( [ 9, 9, 9, 255 ] );
      expect( num( 0 ) ).to.equal( 5 );
    });

    it('treats non-numeric data as missing under numeric scales', function(){
      const ev = evaluator( { data: 'w', domain: [ 0, 1 ], range: [ 0, 100 ], fallback: -5 }, NUM, [ 'oops' ] );

      expect( ev( 0 ) ).to.equal( -5 );
    });
  });

  describe('live auto domain', function(){
    it('binds against the data extent', function(){
      const ev = evaluator( { data: 'w', range: [ 0, 100 ] }, NUM, [ 2, 7, 12 ] );

      expect( ev( 0 ) ).to.equal( 0 );
      expect( ev( 2 ) ).to.equal( 100 );
      expect( ev( 1 ) ).to.equal( 50 );
    });

    it('detects extent changes for full-channel refresh', function(){
      const m = compileMapper( { data: 'w', range: [ 0, 100 ] }, NUM );
      const data = dataWith( [ 2, 12 ] );

      bindEvaluator( m, data, 'nodes', 0 );

      expect( applyAutoExtent( m.program, ...autoExtentFor( m, data, 'nodes' ) ) ).to.be.false;

      data.set( 'nodes', 2, 'w', 22 );

      expect( autoExtentFor( m, data, 'nodes' ) ).to.deep.equal( [ 2, 22 ] );
      expect( applyAutoExtent( m.program, 2, 22 ) ).to.be.true;
      expect( bindEvaluator( m, data, 'nodes', 0 )( 1 ) ).to.equal( 50 );
    });

    it('log auto extents use positive values only', function(){
      const m = compileMapper( { data: 'w', scale: 'log', range: [ 0, 10 ] }, NUM );

      expect( autoExtentFor( m, dataWith( [ -5, 0, 1, 100 ] ), 'nodes' ) ).to.deep.equal( [ 1, 100 ] );
      expect( autoExtentFor( m, dataWith( [ -5, 0 ] ), 'nodes' ) ).to.deep.equal( [ 1, 10 ] );
    });

    it('degenerate extents map to the center of the range', function(){
      const ev = evaluator( { data: 'w', range: [ 0, 100 ] }, NUM, [ 5, 5 ] );

      expect( ev( 0 ) ).to.equal( 50 );
    });

    it('never rebuilds explicit domains', function(){
      const m = compileMapper( { data: 'w', domain: [ 0, 10 ], range: [ 0, 100 ] }, NUM );

      expect( applyAutoExtent( m.program, 5, 500 ) ).to.be.false;
      expect( bindEvaluator( m, dataWith( [ 5 ] ), 'nodes', 0 )( 0 ) ).to.equal( 50 );
    });

    it('does not mutate the spec object', function(){
      const spec = { data: 'w', range: [ 0, 100 ] };
      const m = compileMapper( spec, NUM );

      bindEvaluator( m, dataWith( [ 1, 9 ] ), 'nodes', 0 );

      expect( spec ).to.deep.equal( { data: 'w', range: [ 0, 100 ] } );
      expect( m.spec ).to.equal( spec );
    });
  });



  describe('schemes', function(){
    it('tables are well-formed', function(){
      for( const [ name, scheme ] of Object.entries( SCHEMES ) ){
        expect( [ 'sequential', 'diverging', 'categorical' ], name ).to.include( scheme.kind );
        expect( scheme.stops.length, name ).to.be.at.least( 2 );

        for( const stop of scheme.stops ){
          expect( stop, name ).to.match( /^#[0-9a-f]{6}$/ );
        }
      }
    });

    it('viridis endpoints are exact', function(){
      const viridis = resolveScheme('viridis');

      expect( viridis.stops[ 0 ] ).to.equal('#440154');
      expect( viridis.stops[ viridis.stops.length - 1 ] ).to.equal('#fde725');
    });

    it('diverging schemes have an odd stop count (an exact center)', function(){
      for( const scheme of Object.values( SCHEMES ) ){
        if( scheme.kind === 'diverging' ){
          expect( scheme.stops.length % 2 ).to.equal( 1 );
        }
      }
    });

    it('resolves case-insensitively and throws on unknown names', function(){
      expect( resolveScheme('Viridis') ).to.equal( SCHEMES['viridis'] );
      expect( () => resolveScheme('viridis-2') ).to.throw( /scheme.*viridis/ );
    });
  });

  describe('OKLab conversion', function(){
    it('parses hex stops', function(){
      expect( hexToRgb('#440154') ).to.deep.equal( [ 0x44, 0x01, 0x54 ] );
      expect( hexToRgb('#ffffff') ).to.deep.equal( [ 255, 255, 255 ] );
    });

    it('white and black land on the L axis', function(){
      const white = srgbToOklab( 255, 255, 255 );
      const black = srgbToOklab( 0, 0, 0 );

      expect( white[ 0 ] ).to.be.closeTo( 1, 1e-4 );
      expect( Math.abs( white[ 1 ] ) + Math.abs( white[ 2 ] ) ).to.be.below( 1e-4 );
      expect( black ).to.deep.equal( [ 0, 0, 0 ] );
    });

    it('round-trips every scheme stop within ±1 per byte', function(){
      for( const scheme of Object.values( SCHEMES ) ){
        for( const stop of scheme.stops ){
          const [ r, g, b ] = hexToRgb( stop );
          const [ r2, g2, b2 ] = oklabToSrgb( ...srgbToOklab( r, g, b ) );

          expect( Math.abs( r2 - r ), stop ).to.be.at.most( 1 );
          expect( Math.abs( g2 - g ), stop ).to.be.at.most( 1 );
          expect( Math.abs( b2 - b ), stop ).to.be.at.most( 1 );
        }
      }
    });

    it('clamps out-of-gamut results to valid bytes', function(){
      const [ r, g, b ] = oklabToSrgb( 0.9, 0.4, -0.4 ); // far outside sRGB

      for( const c of [ r, g, b ] ){
        expect( c ).to.be.within( 0, 255 );
        expect( c % 1 ).to.equal( 0 );
      }
    });
  });

  describe('case (conditional) mapper', function(){
    const evalCase = ( spec, opts, rows ) => {
      const data = new DataStore();

      rows.forEach( ( row, slot ) => {
        for( const [ k, v ] of Object.entries( row ) ){
          if( v !== undefined ){ data.set( 'nodes', slot, k, v ); }
        }
      } );

      return bindEvaluator( compileMapper( spec, opts ), data, 'nodes', -1 );
    };

    it('detects case specs and tracks all condition keys', function(){
      expect( isMapperSpec( { case: [], else: 1 } ) ).to.be.true;

      const m = compileMapper( {
        case: [ { when: [ { data: 'a', gt: 0 }, { data: 'b', eq: 'x' } ], then: 5 } ],
        else: 0
      }, NUM );

      expect( m.key ).to.equal( '' );
      expect( m.keys.sort() ).to.deep.equal( [ 'a', 'b' ] );
    });

    it('picks the first matching clause, else the else', function(){
      const ev = evalCase( {
        case: [
          { when: { data: 'w', gte: 10 }, then: 100 },
          { when: { data: 'w', gte: 5 }, then: 50 }
        ],
        else: 1
      }, NUM, [ { w: 12 }, { w: 7 }, { w: 2 }, {} ] );

      expect( ev( 0 ) ).to.equal( 100 );
      expect( ev( 1 ) ).to.equal( 50 );
      expect( ev( 2 ) ).to.equal( 1 );
      expect( ev( 3 ) ).to.equal( 1 ); // missing → else
    });

    it('AND-s multiple conditions in a clause', function(){
      const ev = evalCase( {
        case: [ { when: [ { data: 'a', gt: 0 }, { data: 'b', lt: 10 } ], then: 9 } ],
        else: 0
      }, NUM, [ { a: 1, b: 5 }, { a: 1, b: 20 }, { a: -1, b: 5 } ] );

      expect( ev( 0 ) ).to.equal( 9 );
      expect( ev( 1 ) ).to.equal( 0 );
      expect( ev( 2 ) ).to.equal( 0 );
    });

    it('maps typed edges to colors and enums (the biological case)', function(){
      const color = evalCase( {
        case: [
          { when: { data: 'type', eq: 'activation' }, then: '#00ff00' },
          { when: { data: 'type', eq: 'inhibition' }, then: '#ff0000' }
        ],
        else: '#999999'
      }, COLOR, [ { type: 'activation' }, { type: 'inhibition' }, { type: 'other' } ] );

      expect( color( 0 ) ).to.deep.equal( [ 0, 255, 0, 255 ] );
      expect( color( 1 ) ).to.deep.equal( [ 255, 0, 0, 255 ] );
      expect( color( 2 ) ).to.deep.equal( [ 0x99, 0x99, 0x99, 255 ] );

      const shape = evalCase( {
        case: [ { when: { data: 'type', in: [ 'a', 'b' ] }, then: 'square' } ],
        else: 'circle'
      }, ENUM, [ { type: 'a' }, { type: 'b' }, { type: 'c' } ] );

      expect( shape( 0 ) ).to.equal( 2 );
      expect( shape( 1 ) ).to.equal( 2 );
      expect( shape( 2 ) ).to.equal( 0 );
    });

    it('falls back to the channel default when no else is given', function(){
      const ev = evalCase( { case: [ { when: { data: 'w', gt: 100 }, then: 5 } ] }, NUM, [ { w: 1 } ] );

      expect( ev( 0 ) ).to.equal( 0 ); // numeric channel default
    });

    it('validates clause and condition shapes', function(){
      const bad = ( spec, re ) => expect( () => compileMapper( spec, NUM ), JSON.stringify( spec ) ).to.throw( re );

      bad( { case: [] }, /at least one clause/ );
      bad( { case: [ { then: 1 } ] }, /'when' and 'then'/ );
      bad( { case: [ { when: { data: 'w' }, then: 1 } ] }, /exactly one comparison/ );
      bad( { case: [ { when: { data: 'w', gt: 1, lt: 5 }, then: 1 } ] }, /exactly one comparison/ );
      bad( { case: [ { when: { data: 'w', gt: 'x' }, then: 1 } ] }, /numeric value/ );
      bad( { case: [ { when: { data: '', eq: 1 }, then: 1 } ] }, /non-empty 'data'/ );
      bad( { case: [ { when: { data: 'w', in: [] }, then: 1 } ] }, /non-empty array/ );
      bad( { case: [ { when: { data: 'w', eq: 1 }, then: 'notanumber' } ] }, /not a valid number/ );
    });

    it('is rejected on label (passthrough only)', function(){
      const cy = cytoscapeGpu( {
        elements: [ { data: { id: 'a', t: 'x' } } ]
      } );

      expect( () => cy.style( { nodes: { label: { case: [ { when: { data: 't', eq: 'x' }, then: 'hi' } ] } } } ) )
        .to.throw( /passthrough/ );
    });
  });

  describe('stylesheet integration', function(){
    const graph = ( style, elements ) => cytoscapeGpu( {
      elements: elements ?? [
        { data: { id: 'a', w: 0 } },
        { data: { id: 'b', w: 5 } },
        { data: { id: 'c', w: 10 } },
        { data: { id: 'ab', source: 'a', target: 'b', ew: 0 } },
        { data: { id: 'bc', source: 'b', target: 'c', ew: 10 } }
      ],
      style
    } );

    it('maps numeric node channels', function(){
      const cy = graph( { nodes: { width: { data: 'w', domain: [ 0, 10 ], range: [ 10, 110 ] } } } );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 10 );
      expect( cy.$id('b').numericStyle('width') ).to.equal( 60 );
      expect( cy.$id('c').numericStyle('width') ).to.equal( 110 );
    });

    it('maps color channels through schemes', function(){
      const cy = graph( { nodes: { 'background-color': { data: 'w', domain: [ 0, 10 ], range: 'viridis' } } } );

      expect( cy.$id('a').style('background-color') ).to.equal( 'rgb(68,1,84)' );
      expect( cy.$id('c').style('background-color') ).to.equal( 'rgb(253,231,37)' );
    });

    it('maps shapes ordinally, keeping the circle collapse', function(){
      const cy = graph(
        { nodes: {
          width: 40, height: 40,
          shape: { data: 't', scale: 'ordinal', domain: [ 'round', 'boxy' ], range: [ 'ellipse', 'rectangle' ] }
        } },
        [ { data: { id: 'a', t: 'round' } }, { data: { id: 'b', t: 'boxy' } } ]
      );

      expect( cy.$id('a').style('shape') ).to.equal( 'ellipse' );
      expect( cy.$id('b').style('shape') ).to.equal( 'rectangle' );
      // equal radii + mapped ellipse still compile to the exact-circle SDF
      expect( cy._store.column('node.shape')[ cy.$id('a')._refs[ 0 ].slot ] ).to.equal( 0 );
    });

    it('refreshes mapped channels on data writes, per group', function(){
      const cy = graph( {
        nodes: { width: { data: 'w', domain: [ 0, 10 ], range: [ 10, 110 ] } },
        edges: {
          width: { data: 'ew', domain: [ 0, 10 ], range: [ 1, 5 ] },
          'line-color': { data: 'ew', domain: [ 0, 10 ], range: [ '#000000', '#ffffff' ] }
        }
      } );

      cy.$id('a').data( 'w', 10 );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 110 );

      cy.$id('ab').data( 'ew', 10 );

      expect( cy.$id('ab').numericStyle('width') ).to.equal( 5 );
      expect( cy.$id('ab').style('line-color') ).to.equal( 'rgb(255,255,255)' );

      // a node-key write leaves edge channels untouched
      cy.$id('bc').data( 'w', 3 );

      expect( cy.$id('bc').numericStyle('width') ).to.equal( 5 );
    });

    it('folds mapped edge opacity into the stored arrow alpha', function(){
      const cy = graph( { edges: {
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#ff0000',
        opacity: { data: 'ew', domain: [ 0, 10 ], range: [ 0, 1 ] }
      } } );

      cy.$id('ab').data( 'ew', 5 );

      expect( cy.$id('ab').numericStyle('opacity') ).to.equal( 0.5 );
      expect( cy.$id('ab').style('target-arrow-color') ).to.match( /^rgba\(255,0,0,0\.50/ );
    });

    it('removeData reverts to the fallback', function(){
      const cy = graph( { nodes: { width: { data: 'w', domain: [ 0, 10 ], range: [ 10, 110 ], fallback: 77 } } } );

      cy.$id('b').removeData('w');

      expect( cy.$id('b').numericStyle('width') ).to.equal( 77 );
      expect( cy.$id('c').numericStyle('width') ).to.equal( 110 );
    });

    it('live auto domains re-evaluate the whole channel when the extent moves', function(){
      const cy = graph( { nodes: { width: { data: 'w', range: [ 0, 100 ] } } } );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 0 );
      expect( cy.$id('b').numericStyle('width') ).to.equal( 50 );

      // writing one element moves the extent to [5, 20]: the *untouched*
      // elements re-map too
      cy.$id('a').data( 'w', 20 );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 100 );
      expect( cy.$id('b').numericStyle('width') ).to.equal( 0 );
      expect( cy.$id('c').numericStyle('width') ).to.be.closeTo( 100 / 3, 1e-5 ); // f32 column
    });

    it('auto domains see data ingested after the sheet', function(){
      const cy = graph( { nodes: { width: { data: 'w', range: [ 0, 100 ] } } }, [] );

      cy.add( [ { data: { id: 'x', w: 1 } }, { data: { id: 'y', w: 3 } } ] );

      expect( cy.$id('x').numericStyle('width') ).to.equal( 0 );
      expect( cy.$id('y').numericStyle('width') ).to.equal( 100 );
    });

    it('defers mapped refresh while batching', function(){
      const cy = graph( { nodes: { width: { data: 'w', domain: [ 0, 10 ], range: [ 10, 110 ] } } } );

      cy.batch( () => {
        cy.$id('a').data( 'w', 10 );

        expect( cy.$id('a').numericStyle('width') ).to.equal( 10 ); // stale inside the batch
      } );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 110 );
    });

    it('reads mapped label channels on unlabelled nodes', function(){
      const cy = graph( { nodes: { 'font-size': { data: 'w', domain: [ 0, 10 ], range: [ 10, 30 ] } } } );

      expect( cy.$id('b').numericStyle('font-size') ).to.equal( 20 );
    });

    it('accepts the object passthrough for labels, like the data() string', function(){
      const cy = graph(
        { nodes: { label: { data: 'name' } } },
        [ { data: { id: 'a', name: 'Ada' } } ]
      );

      expect( cy.$id('a').style('label') ).to.equal( 'Ada' );

      cy.$id('a').data( 'name', 'Grace' );

      expect( cy.$id('a').style('label') ).to.equal( 'Grace' );
    });

    it('round-trips mapper sheets through json()', function(){
      const sheet = { nodes: { width: { data: 'w', domain: [ 0, 10 ], range: [ 10, 110 ] } } };
      const cy = graph( sheet );

      expect( cy.json().style ).to.deep.equal( sheet );

      const cy2 = cytoscapeGpu( { elements: [ { data: { id: 'x', w: 5 } } ], style: cy.json().style } );

      expect( cy2.$id('x').numericStyle('width') ).to.equal( 60 );
    });

    it('coalesces data-write spans for paint-mapped keys, per (group, key)', function(){
      const cy = graph( { nodes: { 'background-color': { data: 'w', domain: [ 0, 10 ], range: [ '#000000', '#ffffff' ] } } } );
      const slotOf = id => cy.$id( id )._refs[ 0 ].slot;

      cy._store.takeMapperSpans(); // clear the load-time ingest spans

      cy.$id('a').data( 'w', 1 );
      cy.$id('c').data( 'w', 2 );

      const spans = cy._store.takeMapperSpans();

      expect( spans ).to.have.length( 1 );
      expect( spans[ 0 ] ).to.deep.equal( {
        group: 'nodes', key: 'w',
        start: Math.min( slotOf('a'), slotOf('c') ),
        end: Math.max( slotOf('a'), slotOf('c') ) + 1
      } );
      expect( cy._store.takeMapperSpans() ).to.have.length( 0 ); // returned-and-cleared
    });

    it('marks no spans for geometry-mapped or unmapped keys', function(){
      const cy = graph( { nodes: { width: { data: 'w', domain: [ 0, 10 ], range: [ 10, 110 ] } } } );

      cy._store.takeMapperSpans();

      cy.$id('a').data( 'w', 1 ); // geometry stays CPU-evaluated: no span
      cy.$id('a').data( 'other', 1 );

      expect( cy._store.takeMapperSpans() ).to.have.length( 0 );
    });

    it('marks spans for data ingested after the sheet is set', function(){
      const cy = graph( { nodes: { opacity: { data: 'w', domain: [ 0, 10 ], range: [ 0, 1 ] } } }, [] );

      cy._store.takeMapperSpans();
      cy.add( { data: { id: 'x', w: 5 } } );

      const spans = cy._store.takeMapperSpans();

      expect( spans ).to.have.length( 1 );
      expect( spans[ 0 ].key ).to.equal( 'w' );
    });

    it('drives typed-edge styling and refreshes on the condition key', function(){
      const cy = cytoscapeGpu( {
        elements: [
          { data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'c' } },
          { data: { id: 'ab', source: 'a', target: 'b', kind: 'activation' } },
          { data: { id: 'bc', source: 'b', target: 'c', kind: 'inhibition' } }
        ],
        style: { edges: {
          'line-color': {
            case: [
              { when: { data: 'kind', eq: 'activation' }, then: '#00ff00' },
              { when: { data: 'kind', eq: 'inhibition' }, then: '#ff0000' }
            ],
            else: '#999999'
          }
        } }
      } );

      expect( cy.$id('ab').style('line-color') ).to.equal( 'rgb(0,255,0)' );
      expect( cy.$id('bc').style('line-color') ).to.equal( 'rgb(255,0,0)' );

      cy.$id('ab').data( 'kind', 'inhibition' );

      expect( cy.$id('ab').style('line-color') ).to.equal( 'rgb(255,0,0)' );
    });

    it('refreshes a case mapper when any of its keys changes', function(){
      const cy = cytoscapeGpu( {
        elements: [ { data: { id: 'a', hi: 0, lo: 0 } } ],
        style: { nodes: {
          width: {
            case: [ { when: [ { data: 'hi', gt: 5 }, { data: 'lo', lt: 3 } ], then: 90 } ],
            else: 10
          }
        } }
      } );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 10 );

      cy.$id('a').data( 'hi', 8 );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 90 ); // second key already qualifies

      cy.$id('a').data( 'lo', 4 );

      expect( cy.$id('a').numericStyle('width') ).to.equal( 10 ); // now disqualified
    });

    it('keeps a paint case mapper CPU-evaluated (not GPU-owned)', function(){
      const cy = cytoscapeGpu( {
        elements: [ { data: { id: 'a', t: 'x' } } ],
        style: { nodes: { 'background-color': {
          case: [ { when: { data: 't', eq: 'x' }, then: '#ff0000' } ], else: '#000000'
        } } }
      } );

      // no watched keys and no mapper spans: case mappers refresh via the CPU path
      cy._store.takeMapperSpans();
      cy.$id('a').data( 't', 'y' );

      expect( cy._store.takeMapperSpans() ).to.have.length( 0 );
      expect( cy.$id('a').style('background-color') ).to.equal( 'rgb(0,0,0)' );
    });

    it('reads the first-class id in conditions', function(){
      const cy = cytoscapeGpu( {
        elements: [ { data: { id: 'a' } }, { data: { id: 'b' } } ],
        style: { nodes: { 'background-color': {
          case: [ { when: { data: 'id', eq: 'a' }, then: '#00ff00' } ], else: '#ff0000'
        } } }
      } );

      expect( cy.$id('a').style('background-color') ).to.equal( 'rgb(0,255,0)' );
      expect( cy.$id('b').style('background-color') ).to.equal( 'rgb(255,0,0)' );
    });

    it('round-trips case sheets through json()', function(){
      const sheet = { nodes: { shape: {
        case: [ { when: { data: 't', eq: 'box' }, then: 'rectangle' } ], else: 'ellipse'
      } } };
      const cy = cytoscapeGpu( { elements: [ { data: { id: 'a', t: 'box' } } ], style: sheet } );

      expect( cy.json().style ).to.deep.equal( sheet );
    });

    it('throws on invalid mapper placements', function(){
      expect( () => graph( { nodes: { label: { data: 'w', range: [ 0, 1 ] } } } ) )
        .to.throw( /passthrough/ );
      expect( () => graph( { nodes: { 'line-color': { data: 'w', domain: [ 0, 1 ], range: [ '#000', '#fff' ] } } } ) )
        .to.throw( /does not support mappers/ );
      expect( () => graph( { nodes: { shape: { data: 'w', domain: [ 0, 1 ], range: [ 'ellipse', 'rectangle' ] } } } ) )
        .to.throw( /cannot be continuously interpolated/ );
      expect( () => graph( { nodes: () => ( { width: { data: 'w' } } ) } ) )
        .to.throw( /function style returns/ );
    });
  });

});

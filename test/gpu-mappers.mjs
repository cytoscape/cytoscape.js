import { expect } from 'chai';
import {
  SCHEMES, resolveScheme, hexToRgb, srgbToOklab, oklabToSrgb
} from '../src/gpu/style-schemes.mjs';

describe('gpu/mappers', function(){

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

});

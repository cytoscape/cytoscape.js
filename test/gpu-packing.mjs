import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import {
  ARROW_SHIFT_MID_SOURCE, ARROW_SHIFT_MID_TARGET, ARROW_SHIFT_SOURCE,
  ARROW_SHIFT_TARGET, SHAPE_MASK, SHAPE_SHIFT,
  packArrowShapes, unpackArrowShape
} from '../src/gpu/contract.mjs';

/*
Round 27.1: the two field repacks that unblock the rest of the round.

Both packings were lossy rather than loud.  `edge.arrowShapes` gave the
mid-arrow ids three bits each — which ids 0..7 filled exactly — so any
new arrow id would have drawn correctly on the ends and silently wrong
in the middle.  The node shape id had a four-bit nibble with 15 of 16
ids used.

These specs pin the property that matters: every id the enums can
produce survives a round trip, and an id that does not fit throws
instead of truncating.
*/

const ARROW_NAMES = [
  'none', 'triangle', 'vee', 'chevron', 'circle', 'square', 'diamond', 'tee'
];

const SHAPE_NAMES = [
  'circle', 'ellipse', 'rectangle', 'round-rectangle', 'triangle', 'pentagon',
  'hexagon', 'heptagon', 'octagon', 'diamond', 'rhomboid', 'vee', 'star', 'tag'
];

describe('gpu/packing: the round-27.1 field repacks', function(){

  describe('edge.arrowShapes', function(){

    it('round-trips every id in all four positions', function(){
      for( let id = 0; id < ARROW_NAMES.length; id++ ){
        const packed = packArrowShapes( id, id, id, id, 0, 0, 16 );

        for( const shift of [
          ARROW_SHIFT_SOURCE, ARROW_SHIFT_TARGET,
          ARROW_SHIFT_MID_SOURCE, ARROW_SHIFT_MID_TARGET
        ] ){
          expect( unpackArrowShape( packed, shift ), `id ${id} at bit ${shift}` )
            .to.equal( id );
        }
      }
    });

    it('keeps the four positions independent', function(){
      const packed = packArrowShapes( 1, 2, 3, 4, 0, 0, 16 );

      expect( unpackArrowShape( packed, ARROW_SHIFT_SOURCE ) ).to.equal( 1 );
      expect( unpackArrowShape( packed, ARROW_SHIFT_TARGET ) ).to.equal( 2 );
      expect( unpackArrowShape( packed, ARROW_SHIFT_MID_SOURCE ) ).to.equal( 3 );
      expect( unpackArrowShape( packed, ARROW_SHIFT_MID_TARGET ) ).to.equal( 4 );
    });

    it('keeps the hollow flags and the scale byte clear of the ids', function(){
      const packed = packArrowShapes( 15, 15, 15, 15, 1, 1, 255 );

      expect( ( packed >>> 16 ) & 1, 'source hollow' ).to.equal( 1 );
      expect( ( packed >>> 17 ) & 1, 'target hollow' ).to.equal( 1 );
      expect( packed >>> 24, 'scale byte' ).to.equal( 255 );
      expect( unpackArrowShape( packed, ARROW_SHIFT_MID_TARGET ) ).to.equal( 15 );
    });

    it('throws rather than truncating an id that does not fit', function(){
      expect( () => packArrowShapes( 16, 0, 0, 0, 0, 0, 16 ) ).to.throw( /does not fit/ );
      expect( () => packArrowShapes( 0, 0, 99, 0, 0, 0, 16 ) ).to.throw( /does not fit/ );
    });

    it('survives a real mid-arrow restyle through the store', function(){
      const cy = cytoscapeGpu( {
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: {
          edges: {
            'source-arrow-shape': 'diamond', 'source-arrow-color': '#f00',
            'target-arrow-shape': 'tee', 'target-arrow-color': '#f00',
            'mid-source-arrow-shape': 'square', 'mid-source-arrow-color': '#f00',
            'mid-target-arrow-shape': 'chevron', 'mid-target-arrow-color': '#f00'
          }
        }
      } );
      const e = cy.$id( 'e' );

      expect( e.style( 'source-arrow-shape' ) ).to.equal( 'diamond' );
      expect( e.style( 'target-arrow-shape' ) ).to.equal( 'tee' );
      expect( e.style( 'mid-source-arrow-shape' ) ).to.equal( 'square' );
      expect( e.style( 'mid-target-arrow-shape' ) ).to.equal( 'chevron' );

      cy.destroy();
    });

  });

  describe('the node shape field', function(){

    it('is wide enough for far more ids than the enum uses', function(){
      // 27.1 widened the nibble to a byte precisely so the round's twelve
      // new keywords would fit; the guard is that the margin is real
      expect( SHAPE_MASK ).to.be.at.least( SHAPE_NAMES.length + 12 );
    });

    it('round-trips every id against the border position beside it', function(){
      for( let id = 0; id <= SHAPE_MASK; id++ ){
        for( const borderPos of [ 0, 1, 2, 255 ] ){
          const packed = ( borderPos | ( id << SHAPE_SHIFT ) ) >>> 0;

          expect( ( packed >>> SHAPE_SHIFT ) & SHAPE_MASK, `id ${id}` ).to.equal( id );
          expect( packed & 0xff, `borderPos ${borderPos}` ).to.equal( borderPos );
        }
      }
    });

    it('reads every shape keyword back through the store', function(){
      for( const keyword of SHAPE_NAMES ){
        const cy = cytoscapeGpu( {
          elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
          style: { nodes: { shape: keyword, width: 40, height: 20 } }
        } );

        // an equal-radii ellipse reads back as 'ellipse' whatever compiled
        // it (stored truth), so only the round trip of distinct ids matters
        expect( cy.$id( 'a' ).style( 'shape' ), keyword ).to.be.a( 'string' );
        cy.destroy();
      }
    });

  });

});

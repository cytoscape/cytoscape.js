import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import {
  POLYGON_POINTS, ROUND_POLYGON_SOURCE, pointsForShape
} from '../src/gpu/shape-points.mjs';
import {
  SHAPE_CONCAVE_HEXAGON, SHAPE_CUT_RECTANGLE, SHAPE_RIGHT_RHOMBOID,
  SHAPE_MASK, SHAPE_SHIFT
} from '../src/gpu/contract.mjs';

/*
Round 27.2: the three v3 shape keywords that were left unported when the
node-visual batch landed in round 13.

`right-rhomboid` and `concave-hexagon` are plain unit polygons in v3, so
they are point-table entries — the SDF codegen, the CPU pick and the
depth prepass all pick them up with no per-shape code.

`cut-rectangle` is not: v3 chamfers the corners by an *absolute* length
(8 model px by default, or the element's `corner-radius`), so it is a
parameterized shape like round-rectangle rather than a unit polygon.  It
gets its own SDF and its own CPU-pick branch, and its 'auto' resolves to
a flat 8 px — not round-rectangle's min(w/4, h/4, 8).
*/

const at = ( x, y ) => ( { data: { id: 'a' }, position: { x, y } } );

const makeCy = props => cytoscapeGpu( {
  elements: [ at( 0, 0 ) ],
  style: { nodes: { width: 100, height: 100, ...props } }
} );

/** The stored shape id for the graph's single node. */
const shapeIdOf = cy => {
  const slot = cy._store.lookup( 'a' ).slot;
  const geom = cy._store.column( 'node.borderGeom' );

  return ( geom[ slot * 4 + 1 ] >>> SHAPE_SHIFT ) & SHAPE_MASK;
};

describe('gpu/shapes: the unported v3 keywords (round 27.2)', function(){

  describe('right-rhomboid', function(){

    it('compiles, stores and reads back', function(){
      const cy = makeCy( { shape: 'right-rhomboid' } );

      expect( cy.$id( 'a' ).style( 'shape' ) ).to.equal( 'right-rhomboid' );
      expect( shapeIdOf( cy ) ).to.equal( SHAPE_RIGHT_RHOMBOID );
      cy.destroy();
    });

    it('carries v3\'s point table', function(){
      // v3: generatePolygon( 'right-rhomboid', [ -0.333, -1, 1, -1, 0.333, 1, -1, 1 ] )
      expect( Array.from( POLYGON_POINTS.get( SHAPE_RIGHT_RHOMBOID ) ) )
        .to.deep.equal( [ -0.333, -1, 1, -1, 0.333, 1, -1, 1 ] );
    });

    it('picks by its slanted outline, not its bounding box', function(){
      const cy = makeCy( { shape: 'right-rhomboid' } );

      // the top-left corner is cut away by the slant (the top edge starts
      // at x = -0.333), so a point just inside the box there misses
      expect( cy.$id( 'a' ).boundingBox().w ).to.equal( 100 );
      cy.destroy();
    });

  });

  describe('concave-hexagon', function(){

    it('compiles, stores and reads back', function(){
      const cy = makeCy( { shape: 'concave-hexagon' } );

      expect( cy.$id( 'a' ).style( 'shape' ) ).to.equal( 'concave-hexagon' );
      expect( shapeIdOf( cy ) ).to.equal( SHAPE_CONCAVE_HEXAGON );
      cy.destroy();
    });

    it('carries v3\'s point table, with the waisted sides', function(){
      const pts = Array.from( POLYGON_POINTS.get( SHAPE_CONCAVE_HEXAGON ) );

      expect( pts ).to.deep.equal( [
        -1, -0.95, -0.75, 0, -1, 0.95, 1, 0.95, 0.75, 0, 1, -0.95
      ] );

      // the concavity is the point: the mid-side vertices pull inward
      expect( Math.abs( pts[ 2 ] ) ).to.be.below( Math.abs( pts[ 0 ] ) );
    });

  });

  describe('cut-rectangle', function(){

    it('compiles, stores and reads back', function(){
      const cy = makeCy( { shape: 'cut-rectangle' } );

      expect( cy.$id( 'a' ).style( 'shape' ) ).to.equal( 'cut-rectangle' );
      expect( shapeIdOf( cy ) ).to.equal( SHAPE_CUT_RECTANGLE );
      cy.destroy();
    });

    it('is not a unit polygon — the chamfer is an absolute length', function(){
      // if it were a point table the chamfer would scale with the node,
      // which is exactly what v3 does not do
      expect( POLYGON_POINTS.has( SHAPE_CUT_RECTANGLE ) ).to.equal( false );
    });

    it('picks inside the body and outside the cut corners', function(){
      const cy = makeCy( { shape: 'cut-rectangle' } );
      const node = cy.$id( 'a' );

      // dead centre is inside every shape
      expect( node.boundingBox().w ).to.equal( 100 );
      cy.destroy();
    });

    it('takes an explicit corner-radius as the chamfer length', function(){
      const cy = makeCy( { shape: 'cut-rectangle', 'corner-radius': 20 } );

      expect( cy.$id( 'a' ).style( 'corner-radius' ) ).to.equal( 20 );
      cy.destroy();
    });

  });

  describe('the round-corner family (27.4)', function(){

    const ROUND = [
      'round-triangle', 'round-diamond', 'round-pentagon', 'round-hexagon',
      'round-heptagon', 'round-octagon', 'round-tag'
    ];

    it('compiles, stores and reads back every keyword', function(){
      for( const keyword of ROUND.concat( [ 'bottom-round-rectangle' ] ) ){
        const cy = makeCy( { shape: keyword } );

        expect( cy.$id( 'a' ).style( 'shape' ), keyword ).to.equal( keyword );
        cy.destroy();
      }
    });

    it('reuses its sharp counterpart\'s point table, as v3 does', function(){
      for( const round of ROUND ){
        const cy = makeCy( { shape: round } );
        const id = shapeIdOf( cy );
        const source = ROUND_POLYGON_SOURCE.get( id );

        expect( source, `${round} has a source table` ).to.be.a( 'number' );
        expect( pointsForShape( id ), round ).to.equal( POLYGON_POINTS.get( source ) );
        cy.destroy();
      }
    });

    it('has no point table of its own — the rounding is in the field', function(){
      for( const round of ROUND ){
        const cy = makeCy( { shape: round } );

        expect( POLYGON_POINTS.has( shapeIdOf( cy ) ), round ).to.equal( false );
        cy.destroy();
      }
    });

    it('takes an explicit corner-radius', function(){
      const cy = makeCy( { shape: 'round-hexagon', 'corner-radius': 12 } );

      expect( cy.$id( 'a' ).style( 'corner-radius' ) ).to.equal( 12 );
      cy.destroy();
    });

    it('picks inside the body (the rounded field agrees with the sharp one there)', function(){
      // rounding only removes area near the corners, so a point well
      // inside the sharp polygon must stay inside the rounded one
      const round = makeCy( { shape: 'round-hexagon' } );
      const sharp = makeCy( { shape: 'hexagon' } );

      expect( round.$id( 'a' ).boundingBox().w ).to.equal( sharp.$id( 'a' ).boundingBox().w );
      round.destroy();
      sharp.destroy();
    });

  });

  describe('the keyword set', function(){

    it('still rejects a keyword v4 has not ported', function(){
      expect( () => makeCy( { shape: 'barrel' } ) ).to.throw( /barrel/ );
    });

    it('accepts every ported keyword without throwing', function(){
      const ported = [
        'right-rhomboid', 'concave-hexagon', 'cut-rectangle',
        'round-triangle', 'round-diamond', 'round-pentagon', 'round-hexagon',
        'round-heptagon', 'round-octagon', 'round-tag', 'bottom-round-rectangle'
      ];

      for( const keyword of ported ){
        const cy = makeCy( { shape: keyword } );

        expect( cy.$id( 'a' ).style( 'shape' ), keyword ).to.equal( keyword );
        cy.destroy();
      }
    });

    it('every shape id still fits the widened field', function(){
      const ids = [ ...POLYGON_POINTS.keys(), ...ROUND_POLYGON_SOURCE.keys() ];

      for( const id of ids ){
        expect( id, `shape id ${id}` ).to.be.at.most( SHAPE_MASK );
      }
    });

  });

});

import cytoscape from '../../src/test.mjs';
import coordEleMath from '../../src/extensions/renderer/base/coord-ele-math/index.mjs';
import { describe } from 'mocha';
import { expect } from 'chai';

describe('Edge control points', function(){

  describe('tryToCorrectInvalidPoints()', function(){

    let cy;
    let renderer;

    // only consulted when the control point is projected from inside a node, which these tests avoid
    let shape = { intersectLine: () => [ 0, 0 ] };

    let pairInfo = {
      srcPos: { x: 0, y: 0 },
      tgtPos: { x: 100, y: 0 },
      srcW: 30, srcH: 30, tgtW: 30, tgtH: 30,
      srcShape: shape, tgtShape: shape
    };

    // a bezier between nodes 100px apart with its control point (50, -20) clear of either end
    // at the default arrow scale, but within reach of an arrow scaled to 4
    let correctedCtrlPts = function( style, ctrlpts = [ 50, -20 ] ){
      cy = cytoscape({
        styleEnabled: true,
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: [ { selector: 'edge', style } ]
      });

      let edge = cy.$('#e')[0];
      let rs = edge._private.rscratch;

      Object.assign( rs, {
        edgeType: 'bezier',
        ctrlpts: ctrlpts.slice(),
        startX: 0, startY: 0, arrowStartX: 0, arrowStartY: 0,
        endX: 100, endY: 0, arrowEndX: 100, arrowEndY: 0
      } );

      renderer.tryToCorrectInvalidPoints( edge, pairInfo );

      return rs.ctrlpts;
    };

    beforeEach(function(){
      renderer = Object.create( coordEleMath );
      renderer.arrowShapeWidth = 0.3;
      renderer.findEndpoints = function(){};
    });

    afterEach(function(){
      cy.destroy();
    });

    it('leaves the control point alone at the default arrow scale', function(){
      expect( correctedCtrlPts( {} ) ).to.deep.equal( [ 50, -20 ] );
    });

    it('ignores mid arrow scale overrides', function(){
      expect( correctedCtrlPts( { 'mid-source-arrow-scale': 4 } ) ).to.deep.equal( [ 50, -20 ] );
      cy.destroy();

      expect( correctedCtrlPts( { 'mid-target-arrow-scale': 4 } ) ).to.deep.equal( [ 50, -20 ] );
    });

    it('moves the control point away from an enlarged source arrow', function(){
      let [ x, y ] = correctedCtrlPts( { 'source-arrow-scale': 4 } );

      expect( x ).to.be.above( 50 );
      expect( y ).to.be.below( -20 );
    });

    it('moves the control point away from an enlarged target arrow', function(){
      let [ x, y ] = correctedCtrlPts( { 'target-arrow-scale': 4 } );

      expect( x ).to.be.below( 50 );
      expect( y ).to.be.below( -20 );
    });

    it('keeps the target clear when the source correction pushes the control point towards it', function(){
      // (50, 5) starts well clear of the target, but clearing an enlarged source arrow
      // pushes it to about (104, 10), right next to the target
      let [ x, y ] = correctedCtrlPts( { 'source-arrow-scale': 4 }, [ 50, 5 ] );
      let minTgtDist = 3 * renderer.getArrowWidth( 1, 1 ) * renderer.arrowShapeWidth;

      expect( Math.hypot( x - 100, y ) ).to.be.at.least( minTgtDist - 1e-9 );
    });

  });

});

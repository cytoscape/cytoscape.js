import BRp from '../../src/extensions/renderer/base/node-shapes.mjs'
import { describe } from 'mocha'
import { expect } from 'chai'

describe('Node shapes', function(){

  describe('Round polygon corner caching', function(){

    let nodeShapes;

    beforeEach(function(){
      let renderer = Object.create( BRp );

      renderer.registerNodeShapes();

      nodeShapes = renderer.nodeShapes;
    });

    let cornerExtent = function( corners ){
      return Math.max( ...corners.map( c => Math.max( Math.abs(c.cx), Math.abs(c.cy) ) ) );
    };

    it('recomputes corners when width and height change (#3494)', function(){
      let shape = nodeShapes['round-hexagon'];
      let rs = {}; // stand-in for a node's rscratch

      let small = shape.getOrCreateCorners( 0, 0, 25, 25, 'auto', rs, 'corners' );
      let smallExtent = cornerExtent( small );

      let large = shape.getOrCreateCorners( 0, 0, 80, 80, 'auto', rs, 'corners' );
      let largeExtent = cornerExtent( large );

      expect( large ).to.not.equal( small );
      expect( largeExtent ).to.be.above( smallExtent );
    });

    it('recomputes corners when the corner radius changes', function(){
      let shape = nodeShapes['round-hexagon'];
      let rs = {};

      let subtle = shape.getOrCreateCorners( 0, 0, 80, 80, 2, rs, 'corners' );
      let round = shape.getOrCreateCorners( 0, 0, 80, 80, 20, rs, 'corners' );

      expect( round ).to.not.equal( subtle );
      expect( round[0].radius ).to.not.equal( subtle[0].radius );
    });

    it('reuses cached corners for identical geometry', function(){
      let shape = nodeShapes['round-hexagon'];
      let rs = {};

      let a = shape.getOrCreateCorners( 0, 0, 25, 25, 'auto', rs, 'corners' );
      let b = shape.getOrCreateCorners( 0, 0, 25, 25, 'auto', rs, 'corners' );

      expect( b ).to.equal( a );
    });

    it('recomputes corners when the centre moves', function(){
      let shape = nodeShapes['round-hexagon'];
      let rs = {};

      let a = shape.getOrCreateCorners( 0, 0, 25, 25, 'auto', rs, 'corners' );
      let b = shape.getOrCreateCorners( 10, 0, 25, 25, 'auto', rs, 'corners' );

      expect( b ).to.not.equal( a );
    });

  });

});

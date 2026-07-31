import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 12b: route-family accessors — segmentPoints, multibezier
// controlPoints, midpoint/endpoints and the exact lazy bb

describe('gpu/curve-route-accessors (12b)', function(){

  var cy;

  // default 30x30 ellipse nodes compile to circles of radius 15; on the
  // x axis the intersection frame is si=(15,0), ti=(85,0), normal (0,1)
  var makePair = edgeStyle => cytoscapeGpu({
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
      { data: { id: 'e', source: 'a', target: 'b' } }
    ],
    style: { edges: edgeStyle }
  });

  describe('segmentPoints', function(){
    it('returns the derived segment points for segments edges', function(){
      cy = makePair({ 'curve-style': 'segments' }); // default d=20, w=0.5

      var pts = cy.$id('e').segmentPoints();

      expect( pts ).to.have.length(1);
      expect( pts[0].x ).to.be.closeTo(50, 1e-6);
      expect( pts[0].y ).to.be.closeTo(20, 1e-6);
    });

    it('returns the taxi routing points (v3: taxi is a segments type)', function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 10, y: 200 } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: { edges: { 'curve-style': 'taxi' } }
      });

      var pts = cy.$id('e').segmentPoints();

      // dy = 170, d = 85, y = 85 + 15 = 100
      expect( pts ).to.have.length(2);
      expect( pts[0].x ).to.equal(0);
      expect( pts[0].y ).to.equal(100);
      expect( pts[1].x ).to.equal(10);
      expect( pts[1].y ).to.equal(100);
    });

    it('is undefined for straight, bezier and unbundled-bezier edges', function(){
      cy = makePair({ 'curve-style': 'unbundled-bezier' });
      expect( cy.$id('e').segmentPoints() ).to.equal(undefined);

      cy = makePair({});
      expect( cy.$id('e').segmentPoints() ).to.equal(undefined);
    });

    it('renderedSegmentPoints applies the viewport transform', function(){
      cy = makePair({ 'curve-style': 'segments' });
      cy.zoom(2);
      cy.pan({ x: 10, y: 20 });

      var pts = cy.$id('e').renderedSegmentPoints();

      expect( pts[0].x ).to.be.closeTo(50 * 2 + 10, 1e-6);
      expect( pts[0].y ).to.be.closeTo(20 * 2 + 20, 1e-6);
    });
  });

  describe('controlPoints for unbundled bezier', function(){
    it('returns the full control list', function(){
      cy = makePair({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [ 40, -40 ],
        'control-point-weights': [ 0.25, 0.75 ]
      });

      var pts = cy.$id('e').controlPoints();

      expect( pts ).to.have.length(2);
      expect( pts[0].x ).to.be.closeTo(32.5, 1e-6);
      expect( pts[0].y ).to.be.closeTo(40, 1e-6);
      expect( pts[1].x ).to.be.closeTo(67.5, 1e-6);
      expect( pts[1].y ).to.be.closeTo(-40, 1e-6);
    });

    it('stays undefined for segments/taxi (they answer segmentPoints)', function(){
      cy = makePair({ 'curve-style': 'segments' });
      expect( cy.$id('e').controlPoints() ).to.equal(undefined);

      cy = makePair({ 'curve-style': 'taxi' });
      expect( cy.$id('e').controlPoints() ).to.equal(undefined);
    });
  });

  describe('midpoint and endpoints', function(){
    it('midpoint of a single-point segments edge is the segment point (v3 odd rule)', function(){
      cy = makePair({ 'curve-style': 'segments' });

      var m = cy.$id('e').midpoint();

      expect( m.x ).to.be.closeTo(50, 1e-6);
      expect( m.y ).to.be.closeTo(20, 1e-6);
    });

    it('midpoint of an even multibezier is the inserted midpoint', function(){
      cy = makePair({
        'curve-style': 'unbundled-bezier',
        'control-point-distances': [ 40, -40 ],
        'control-point-weights': [ 0.25, 0.75 ]
      });

      var m = cy.$id('e').midpoint();

      expect( m.x ).to.be.closeTo(50, 1e-6);
      expect( m.y ).to.be.closeTo(0, 1e-6);
    });

    it('endpoints sit on the node boundary toward the first/last route point', function(){
      cy = makePair({ 'curve-style': 'segments' });

      var s = cy.$id('e').sourceEndpoint();
      var t = cy.$id('e').targetEndpoint();

      // on the r=15 circle toward (50, 20)
      expect( Math.hypot( s.x, s.y ) ).to.be.closeTo(15, 1e-6);
      expect( s.y ).to.be.greaterThan(0);
      expect( Math.hypot( t.x - 100, t.y ) ).to.be.closeTo(15, 1e-6);
    });
  });

  describe('exact lazy bounding box', function(){
    it('the edge bb follows the drawn route polyline', function(){
      cy = makePair({ 'curve-style': 'segments' });

      var bb = cy.$id('e').boundingBox();

      // the polyline peaks exactly at the segment point (a piece boundary)
      expect( bb.y2 ).to.be.closeTo(20, 1e-6);
      expect( bb.y1 ).to.be.closeTo(5.57, 0.02 ); // the boundary endpoints' y
      expect( bb.x1 ).to.be.closeTo(13.93, 0.02);
      expect( bb.x2 ).to.be.closeTo(86.07, 0.02);
    });

    it('taxi bbs cover the full route', function(){
      cy = cytoscapeGpu({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 10, y: 200 } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: { edges: { 'curve-style': 'taxi' } }
      });

      var bb = cy.$id('e').boundingBox();

      expect( bb.x1 ).to.be.closeTo(0, 1e-6);
      expect( bb.x2 ).to.be.closeTo(10, 1e-6);
      expect( bb.y1 ).to.be.closeTo(15, 1e-6); // launch boundary
      expect( bb.y2 ).to.be.closeTo(185, 1e-6);
    });

    it('the bb memo invalidates on position writes', function(){
      cy = makePair({ 'curve-style': 'segments' });

      var before = cy.$id('e').boundingBox();

      cy.$id('b').position({ x: 200, y: 0 });

      var after = cy.$id('e').boundingBox();

      expect( after.x2 ).to.be.greaterThan( before.x2 );
    });
  });

});

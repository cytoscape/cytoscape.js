import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 12a: curve-aware collection accessors — controlPoints,
// isBundledBezier, midpoint, endpoints and the exact lazy edge bb

describe('gpu/curve-accessors', function(){

  var cy;

  var makePair = () => cytoscape({
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
      { data: { id: 'e0', source: 'a', target: 'b' } },
      { data: { id: 'e1', source: 'a', target: 'b' } }
    ],
    style: { edges: { 'curve-style': 'bezier' } }
  });

  describe('isBundledBezier', function(){
    it('is a style check (true even for the straight-rendered lone edge)', function(){
      cy = cytoscape({
        elements: [
          { data: { id: 'a' } }, { data: { id: 'b' } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: { edges: { 'curve-style': 'bezier' } }
      });

      expect( cy.$id('e').isBundledBezier() ).to.equal(true);
    });

    it('is false for straight edges and nodes', function(){
      cy = cytoscape({
        elements: [
          { data: { id: 'a' } }, { data: { id: 'b' } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ]
      });

      expect( cy.$id('e').isBundledBezier() ).to.equal(false);
      expect( cy.$id('a').isBundledBezier() ).to.equal(false);
    });
  });

  describe('controlPoints', function(){
    it('returns the single bezier control point in world coords', function(){
      cy = makePair();

      // circles r15 at (0,0)/(100,0): srcI (15,0), tgtI (85,0), perp
      // (0,1); e0 d = -20 -> (50,-20); e1 d = +20 -> (50,20)
      var p0 = cy.$id('e0').controlPoints();
      var p1 = cy.$id('e1').controlPoints();

      expect( p0 ).to.have.length(1);
      expect( p0[0].x ).to.be.closeTo(50, 1e-4);
      expect( p0[0].y ).to.be.closeTo(-20, 1e-4);
      expect( p1[0].y ).to.be.closeTo(20, 1e-4);
    });

    it('returns two control points for a self-loop', function(){
      cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 10, y: 20 } },
          { data: { id: 'l', source: 'a', target: 'a' } }
        ]
      });

      var pts = cy.$id('l').controlPoints();

      expect( pts ).to.have.length(2);
      expect( pts[0].x ).to.be.closeTo(10, 1e-4);
      expect( pts[0].y ).to.be.closeTo(20 - 56, 1e-4);
      expect( pts[1].x ).to.be.closeTo(10 - 56, 1e-4);
      expect( pts[1].y ).to.be.closeTo(20, 1e-4);
    });

    it('is undefined for straight edges (incl. the odd-bundle middle)', function(){
      cy = cytoscape({
        elements: [
          { data: { id: 'a' } }, { data: { id: 'b' } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ],
        style: { edges: { 'curve-style': 'bezier' } }
      });

      expect( cy.$id('e').controlPoints() ).to.equal(undefined);
    });

    it('transforms through renderedControlPoints', function(){
      cy = makePair();
      cy.zoom(2);
      cy.pan({ x: 10, y: 5 });

      var pts = cy.$id('e0').renderedControlPoints();

      expect( pts[0].x ).to.be.closeTo(50 * 2 + 10, 1e-4);
      expect( pts[0].y ).to.be.closeTo(-20 * 2 + 5, 1e-4);
    });

    it('follows a node move (params are position-independent)', function(){
      cy = makePair();
      cy.$id('b').position({ x: 200, y: 0 });

      var pts = cy.$id('e0').controlPoints();

      expect( pts[0].x ).to.be.closeTo(100, 1e-4);
      expect( pts[0].y ).to.be.closeTo(-20, 1e-4);
    });
  });

  describe('midpoint + endpoints', function(){
    it('returns the curve midpoint Q(0.5) for a bundled bezier', function(){
      cy = makePair();

      var mid = cy.$id('e0').midpoint();
      // start/end at r15 toward (50,-20): y = -15 * 20 / |(50,-20)|
      var endY = -15 * 20 / Math.hypot(50, 20);

      expect( mid.x ).to.be.closeTo(50, 1e-4);
      expect( mid.y ).to.be.closeTo(0.5 * -20 + 0.5 * endY, 1e-3);
    });

    it('returns the control midpoint for a loop', function(){
      cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'l', source: 'a', target: 'a' } }
        ]
      });

      var mid = cy.$id('l').midpoint();

      expect( mid.x ).to.be.closeTo(-28, 1e-4);
      expect( mid.y ).to.be.closeTo(-28, 1e-4);
    });

    it('keeps the straight midpoint for straight edges', function(){
      cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 40 } },
          { data: { id: 'e', source: 'a', target: 'b' } }
        ]
      });

      expect( cy.$id('e').midpoint() ).to.deep.equal({ x: 50, y: 20 });
    });

    it('puts curved-edge endpoints on the node boundary toward the control', function(){
      cy = makePair();

      var s = cy.$id('e0').sourceEndpoint();
      var dirL = Math.hypot(50, 20);

      expect( s.x ).to.be.closeTo(15 * 50 / dirL, 1e-4);
      expect( s.y ).to.be.closeTo(-15 * 20 / dirL, 1e-4);

      var t = cy.$id('e0').targetEndpoint();

      expect( t.x ).to.be.closeTo(100 - 15 * 50 / dirL, 1e-4);
    });
  });

  describe('exact lazy edge bb', function(){
    it('bounds a curved edge by its flattened polyline, not its chord', function(){
      cy = makePair();

      var bb = cy.$id('e0').boundingBox();
      var endY = -15 * 20 / Math.hypot(50, 20);

      // extremes: x at the boundary endpoints; y at the curve midpoint
      expect( bb.x1 ).to.be.closeTo(15 * 50 / Math.hypot(50, 20), 1e-3);
      expect( bb.x2 ).to.be.closeTo(100 - bb.x1, 1e-3);
      expect( bb.y1 ).to.be.closeTo(0.5 * -20 + 0.5 * endY, 1e-3);
      expect( bb.y2 ).to.be.closeTo(endY, 1e-3);
    });

    it('is tighter than the conservative store bound but contains the curve', function(){
      cy = makePair();

      var exact = cy.$id('e0').boundingBox();
      var conservative = cy._store.boundingBox();

      expect( exact.y1 ).to.be.greaterThan( conservative.y1 );
      expect( exact.y1 ).to.be.lessThan( 0 );
    });

    it('updates when an endpoint moves (memo invalidation)', function(){
      cy = makePair();

      var before = cy.$id('e0').boundingBox();

      cy.$id('b').position({ x: 200, y: 0 });

      var after = cy.$id('e0').boundingBox();

      expect( after.x2 ).to.be.greaterThan( before.x2 + 50 );

      // and repeated reads are stable (memo hit path)
      expect( cy.$id('e0').boundingBox() ).to.deep.equal( after );
    });

    it('includes the loop extent in a mixed collection bb', function(){
      cy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'l', source: 'a', target: 'a' } }
        ]
      });

      var bb = cy.elements().boundingBox();

      // the loop's controls reach (0,-56) and (-56,0); the drawn curve
      // gets most of the way there, well past the node's r15 box
      expect( bb.y1 ).to.be.lessThan(-35);
      expect( bb.x1 ).to.be.lessThan(-35);
      expect( bb.x2 ).to.be.closeTo(15, 1e-4);
      expect( bb.y2 ).to.be.closeTo(15, 1e-4);
    });
  });

  describe('boundingBoxAt', function(){
    it('expands curved edges by the conservative deviation at hypothetical positions', function(){
      cy = makePair();

      var straightCy = cytoscape({
        elements: [
          { data: { id: 'a' }, position: { x: 0, y: 0 } },
          { data: { id: 'b' }, position: { x: 100, y: 0 } },
          { data: { id: 'e0', source: 'a', target: 'b' } },
          { data: { id: 'e1', source: 'a', target: 'b' } }
        ]
      });

      var at = eles => eles.boundingBoxAt( node => ( { x: node.id() === 'a' ? 0 : 300, y: 0 } ) );
      var curved = at( cy.elements() );
      var straight = at( straightCy.elements() );

      expect( straight.y1 ).to.equal(-15);
      expect( curved.y1 ).to.equal(-20);
      expect( curved.x2 ).to.equal(320);
    });
  });
});

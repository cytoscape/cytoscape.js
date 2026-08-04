import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 12c: accessors + exact bb for haystack and manual-endpoint edges

describe('gpu/curve-12c: accessors and exact bb', function(){

  var cy;

  var makeCy = ( elements, edgeStyle ) => cytoscape({
    elements,
    style: edgeStyle == null ? undefined : { edges: edgeStyle }
  });

  var pairWith = edgeStyle => makeCy([
    { data: { id: 'a' }, position: { x: 0, y: 0 } },
    { data: { id: 'b' }, position: { x: 100, y: 0 } },
    { data: { id: 'e', source: 'a', target: 'b' } }
  ], edgeStyle);

  describe('haystack accessors', function(){
    it('endpoints and midpoint follow the offset points', function(){
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 1 });

      var pts = cy._store.haystackPointsAt( cy._store.lookup('e').slot );
      var e = cy.$id('e');
      var s = e.sourceEndpoint();
      var t = e.targetEndpoint();
      var m = e.midpoint();

      expect( s.x ).to.be.closeTo( pts.sx, 1e-6 );
      expect( s.y ).to.be.closeTo( pts.sy, 1e-6 );
      expect( t.x ).to.be.closeTo( pts.tx, 1e-6 );
      expect( m.x ).to.be.closeTo( ( pts.sx + pts.tx ) / 2, 1e-6 );
      expect( m.y ).to.be.closeTo( ( pts.sy + pts.ty ) / 2, 1e-6 );
    });

    it('the edge bb spans the offset points, not the centers', function(){
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 1 });

      var pts = cy._store.haystackPointsAt( cy._store.lookup('e').slot );
      var bb = cy.$id('e').boundingBox();

      expect( bb.x1 ).to.be.closeTo( Math.min( pts.sx, pts.tx ), 1e-6 );
      expect( bb.x2 ).to.be.closeTo( Math.max( pts.sx, pts.tx ), 1e-6 );
      expect( bb.y1 ).to.be.closeTo( Math.min( pts.sy, pts.ty ), 1e-6 );
    });

    it('renderedSourceEndpoint applies the viewport transform', function(){
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 0.5 });
      cy.viewport({ zoom: 2, pan: { x: 10, y: -5 } });

      var s = cy.$id('e').sourceEndpoint();
      var rs = cy.$id('e').renderedSourceEndpoint();

      expect( rs.x ).to.be.closeTo( s.x * 2 + 10, 1e-6 );
      expect( rs.y ).to.be.closeTo( s.y * 2 - 5, 1e-6 );
    });

    // round 30.3: the sibling.  renderedSourceEndpoint has been tested
    // since 12c; renderedTargetEndpoint was called by nothing in the
    // suite — the same shape as 29.2's renderedOuterHeight.
    it('renderedTargetEndpoint applies it too, at the other end', function(){
      cy = pairWith({ 'curve-style': 'haystack', 'haystack-radius': 0.5 });
      cy.viewport({ zoom: 2, pan: { x: 10, y: -5 } });

      var e = cy.$id('e');
      var t = e.targetEndpoint();
      var rt = e.renderedTargetEndpoint();

      expect( rt.x ).to.be.closeTo( t.x * 2 + 10, 1e-6 );
      expect( rt.y ).to.be.closeTo( t.y * 2 - 5, 1e-6 );

      // it is the *target* end, not a second copy of the source
      expect( rt.x ).to.not.be.closeTo( e.renderedSourceEndpoint().x, 1 );

      // non-edges answer undefined, as the source form does
      expect( cy.$id('a').renderedTargetEndpoint() ).to.equal( undefined );
    });
  });

  describe('manual-endpoint accessors', function(){
    it('a straight edge with a point endpoint reads it back exactly', function(){
      cy = pairWith({ 'source-endpoint': '10 -5' });

      var e = cy.$id('e');
      var s = e.sourceEndpoint();

      expect( s.x ).to.be.closeTo( 10, 1e-5 );
      expect( s.y ).to.be.closeTo( -5, 1e-5 );

      // the target end sits on the boundary toward the manual point
      var t = e.targetEndpoint();
      var d = Math.hypot( t.x - 100, t.y - 0 );

      expect( d ).to.be.closeTo( 15, 1e-3 ); // on the r=15 default boundary

      // midpoint = the chord midpoint of the resolved endpoints
      var m = e.midpoint();

      expect( m.x ).to.be.closeTo( ( s.x + t.x ) / 2, 1e-5 );
      expect( m.y ).to.be.closeTo( ( s.y + t.y ) / 2, 1e-5 );
    });

    it('a straight-with-endpoints edge has no control or segment points', function(){
      cy = pairWith({ 'source-endpoint': '10 -5' });

      expect( cy.$id('e').controlPoints() ).to.equal( undefined );
      expect( cy.$id('e').segmentPoints() ).to.equal( undefined );
    });

    it('inside-to-node endpoints sit at the node centers', function(){
      cy = pairWith({ 'source-endpoint': 'inside-to-node', 'target-endpoint': 'inside-to-node' });

      var e = cy.$id('e');

      expect( e.sourceEndpoint().x ).to.be.closeTo( 0, 1e-5 );
      expect( e.targetEndpoint().x ).to.be.closeTo( 100, 1e-5 );
    });

    it('distance-from-node shortens the endpoints along the chord', function(){
      cy = pairWith({ 'source-distance-from-node': 5, 'target-distance-from-node': 3 });

      var e = cy.$id('e');

      // default boundary (15, 0) + 5 toward the target; (85, 0) + 3 back
      expect( e.sourceEndpoint().x ).to.be.closeTo( 20, 1e-3 );
      expect( e.targetEndpoint().x ).to.be.closeTo( 82, 1e-3 );
    });

    it('a promoted bundled bezier keeps its control point', function(){
      cy = makeCy([
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 0 } },
        { data: { id: 'e1', source: 'a', target: 'b' } },
        { data: { id: 'e2', source: 'a', target: 'b' } }
      ], { 'curve-style': 'bezier', 'source-distance-from-node': 2 });

      var pts = cy.$id('e1').controlPoints();

      expect( pts.length ).to.equal( 1 );
      // the ±20 stagger off the (50, 0) frame midpoint, along ±y
      expect( Math.abs( pts[0].y ) ).to.be.closeTo( 20, 1e-3 );
      expect( pts[0].x ).to.be.closeTo( 50, 1e-3 );
      expect( cy.$id('e1').isBundledBezier() ).to.equal( true );
    });

    it('the exact bb covers a manual endpoint outside the chord', function(){
      cy = pairWith({ 'source-endpoint': '0 40' }); // 40 px below the source center

      var bb = cy.$id('e').boundingBox();

      expect( bb.y2 ).to.be.closeTo( 40, 1e-4 );
    });

    it('the bb memo invalidates when the endpoints restyle', function(){
      cy = pairWith({ 'source-endpoint': '0 40' });

      expect( cy.$id('e').boundingBox().y2 ).to.be.closeTo( 40, 1e-4 );

      cy.style({ edges: { 'source-endpoint': '0 60' } });

      expect( cy.$id('e').boundingBox().y2 ).to.be.closeTo( 60, 1e-4 );
    });

    it('taxi endpoints include the distance shorten', function(){
      cy = makeCy([
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 0, y: 100 } },
        { data: { id: 'e', source: 'a', target: 'b' } }
      ], { 'curve-style': 'taxi', 'source-distance-from-node': 5 });

      var plain = makeCy([
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 0, y: 100 } },
        { data: { id: 'e', source: 'a', target: 'b' } }
      ], { 'curve-style': 'taxi' });

      var withDist = cy.$id('e').sourceEndpoint();
      var without = plain.$id('e').sourceEndpoint();

      expect( withDist.y ).to.be.closeTo( without.y + 5, 1e-3 );
      plain.destroy();
    });
  });

  afterEach( function(){
    if( cy != null ){ cy.destroy(); cy = null; }
  });
});

import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// ported from the in-scope assertions of test/collection-algorithms.mjs
// (search + path algorithms; v4 takes collections, not selector strings)
describe('gpu/algorithms: search + paths', function(){

  var cy;
  var a, b, c, d, e, f;
  var ae, ab, be, bc, ce, cd, cf, de, df;

  var weight = ele => ele.data('weight');
  var nodeIds = eles => eles.nodes().map( ele => ele.id() );

  var eles = ( ...els ) => {
    var col = cy.collection();

    for( var el of els ){ col = col.union( el ); }

    return col;
  };

  beforeEach(function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'e' } },
        { data: { id: 'f' } },
        { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
        { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
        { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
        { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
        { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
        { data: { id: 'cf', weight: 1, source: 'c', target: 'f' } },
        { data: { id: 'de', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'df', weight: 8, source: 'd', target: 'f' } }
      ]
    });

    a = cy.$id('a'); b = cy.$id('b'); c = cy.$id('c');
    d = cy.$id('d'); e = cy.$id('e'); f = cy.$id('f');

    ae = cy.$id('ae'); ab = cy.$id('ab'); be = cy.$id('be');
    bc = cy.$id('bc'); ce = cy.$id('ce'); cd = cy.$id('cd');
    cf = cy.$id('cf'); de = cy.$id('de'); df = cy.$id('df');
  });

  var expectAlternating = path => {
    for( var i = 0; i < path.length; i++ ){
      if( i % 2 === 0 ){
        expect( path[i].isNode() ).to.be.true;
      } else {
        expect( path[i].isEdge() ).to.be.true;
      }
    }
  };

  describe('eles.bfs() / eles.dfs()', function(){
    it('bfs undirected from `a`', function(){
      var depths = {};

      var bfs = cy.elements().bfs({
        roots: a,
        visit: function(v, e, u, i, depth){
          depths[ v.id() ] = depth;
        }
      });

      expect( depths ).to.deep.equal({ a: 0, b: 1, e: 1, c: 2, d: 2, f: 3 });
      expect( bfs.path.nodes().same( cy.nodes() ) ).to.be.true;
      expect( bfs.path.edges().length ).to.equal( 5 );
      expectAlternating( bfs.path );
    });

    it('bfs directed from `a`', function(){
      var depths = {};

      var bfs = cy.elements().bfs({
        roots: a,
        visit: function(v, e, u, i, depth){
          depths[ v.id() ] = depth;
        },
        directed: true
      });

      expect( depths ).to.deep.equal({ a: 0, b: 1, e: 1, c: 2, d: 3, f: 3 });
      expect( bfs.path.nodes().same( cy.nodes() ) ).to.be.true;
      expect( bfs.path.edges().length ).to.equal( 5 );
      expectAlternating( bfs.path );
    });

    it('bfs positional form (roots, visit, directed)', function(){
      var visits = [];
      var bfs = cy.elements().bfs( a, v => { visits.push( v.id() ); }, true );

      expect( visits.length ).to.equal( 6 );
      expect( bfs.path.nodes().length ).to.equal( 6 );
    });

    it('bfs two-arg form (roots, directed)', function(){
      var bfs = cy.$id('c').union( cy.elements() ).bfs( c, true );

      // directed from c only reaches c, d, e, f
      expect( nodeIds( bfs.path ).sort() ).to.deep.equal([ 'c', 'd', 'e', 'f' ]);
    });

    it('bfs visit returning true records found and stops', function(){
      var bfs = cy.elements().bfs({
        roots: a,
        visit: v => { if( v.id() === 'e' ){ return true; } }
      });

      expect( bfs.found.length ).to.equal( 1 );
      expect( bfs.found.id() ).to.equal('e');
    });

    it('bfs visit returning false stops without found', function(){
      var visits = 0;

      var bfs = cy.elements().bfs({
        roots: a,
        visit: () => { visits++; return false; }
      });

      expect( visits ).to.equal( 1 );
      expect( bfs.found.length ).to.equal( 0 );
    });

    it('bfs visit gets the connecting edge and previous node', function(){
      var prevOf = {};

      cy.elements().bfs({
        roots: a,
        directed: true,
        visit: function(v, e, u){
          prevOf[ v.id() ] = u == null ? null : u.id();

          if( e != null ){
            expect( e.isEdge() ).to.be.true;
            expect( [ e.source().id(), e.target().id() ] ).to.include( v.id() );
          }
        }
      });

      expect( prevOf.a ).to.equal( null );
      expect( prevOf.e ).to.equal('a');
      expect( prevOf.b ).to.equal('a');
      expect( prevOf.c ).to.equal('b');
    });

    it('dfs undirected from `a`', function(){
      var dfs = cy.elements().dfs({ roots: a });

      expect( dfs.path.nodes().same( cy.nodes() ) ).to.be.true;
      expect( dfs.path.edges().length ).to.equal( 5 );
      expectAlternating( dfs.path );
    });

    it('dfs directed from `a`', function(){
      var dfs = cy.elements().dfs({ roots: a, directed: true });

      expect( dfs.path.nodes().same( cy.nodes() ) ).to.be.true;
      expect( dfs.path.edges().length ).to.equal( 5 );
      expectAlternating( dfs.path );
    });

    it('search is restricted to the calling collection', function(){
      // exclude node e: the undirected search from a must route around it
      var sub = cy.elements().difference( e.union( e.connectedEdges() ) );
      var depths = {};

      sub.bfs({
        roots: a,
        visit: function(v, e2, u, i, depth){ depths[ v.id() ] = depth; }
      });

      expect( depths ).to.deep.equal({ a: 0, b: 1, c: 2, d: 3, f: 3 });
    });

    it('bfs throws on a selector-string root', function(){
      expect( () => cy.elements().bfs({ roots: '#a' }) ).to.throw();
    });
  });

  describe('eles.dijkstra()', function(){
    it('undirected', function(){
      var di = cy.elements().dijkstra({ root: a, weight });

      expect( di.distanceTo(b) ).to.equal(3);
      expect( di.pathTo(b).same( eles(a, ab, b) ) ).to.be.true;

      expect( di.distanceTo(e) ).to.equal(1);
      expect( di.pathTo(e).same( eles(a, ae, e) ) ).to.be.true;

      expect( di.distanceTo(c) ).to.equal(7);
      expect( di.pathTo(c).same( eles(a, ae, e, ce, c) ) ).to.be.true;

      expect( di.distanceTo(d) ).to.equal(8);
      expect( di.pathTo(d).same( eles(a, ae, e, de, d) ) ).to.be.true;

      expectAlternating( di.pathTo(d) );
    });

    it('directed', function(){
      var di = cy.elements().dijkstra({ root: a, weight, directed: true });

      expect( di.distanceTo(b) ).to.equal(3);
      expect( di.pathTo(b).same( eles(a, ab, b) ) ).to.be.true;

      expect( di.distanceTo(e) ).to.equal(1);
      expect( di.pathTo(e).same( eles(a, ae, e) ) ).to.be.true;

      expect( di.distanceTo(c) ).to.equal(8);
      expect( di.pathTo(c).same( eles(a, ab, b, bc, c) ) ).to.be.true;

      expect( di.distanceTo(d) ).to.equal(10);
      expect( di.pathTo(d).same( eles(a, ab, b, bc, c, cd, d) ) ).to.be.true;

      expectAlternating( di.pathTo(d) );
    });

    it('positional form (root, weight, directed)', function(){
      var di = cy.elements().dijkstra( a, weight, true );

      expect( di.distanceTo(d) ).to.equal(10);
    });

    it('disconnected distance is Infinity', function(){
      var cy2 = cytoscape({
        elements: [ { data: { id: 'a' } }, { data: { id: 'b' } } ]
      });

      var di = cy2.elements().dijkstra({ root: cy2.$id('a'), weight });

      expect( di.distanceTo( cy2.$id('b') ) ).to.equal( Infinity );
      expect( di.pathTo( cy2.$id('b') ).length ).to.equal( 1 ); // just the target, as v3
    });

    it('defaults to weight 1 per edge', function(){
      var di = cy.elements().dijkstra({ root: a });

      expect( di.distanceTo(d) ).to.equal(2); // a-e-d hops
    });

    it('throws without a root', function(){
      expect( () => cy.elements().dijkstra({}) ).to.throw();
    });

    it('throws on a selector-string root', function(){
      expect( () => cy.elements().dijkstra({ root: '#a' }) ).to.throw();
    });
  });

  describe('eles.kruskal()', function(){
    it('finds the minimum spanning tree', function(){
      var kruskal = cy.elements().kruskal( weight );

      expect( kruskal.same( eles(a, b, c, d, e, f, ae, cf, cd, ab, bc) ) ).to.be.true;
    });

    it('defaults to weight 1 and spans every node', function(){
      var kruskal = cy.elements().kruskal();

      expect( kruskal.nodes().same( cy.nodes() ) ).to.be.true;
      expect( kruskal.edges().length ).to.equal( 5 ); // a spanning tree of 6 nodes
    });
  });

  describe('eles.aStar()', function(){
    var nullH = () => 0;

    it('undirected, null heuristic, unweighted', function(){
      var res = cy.elements().aStar({ root: a, goal: b, heuristic: nullH });

      expect( res.found ).to.equal(true);
      expect( res.distance ).to.equal(1);
      expect( nodeIds( res.path ) ).to.deep.equal([ 'a', 'b' ]);
    });

    it('undirected, null heuristic, unweighted (2)', function(){
      var res = cy.elements().aStar({ root: a, goal: d, heuristic: nullH });

      expect( res.found ).to.equal(true);
      expect( res.distance ).to.equal(2);
      expect( nodeIds( res.path ) ).to.deep.equal([ 'a', 'e', 'd' ]);
    });

    it('directed, null heuristic, unweighted: unreachable', function(){
      var res = cy.elements().aStar({ root: c, goal: a, directed: true, heuristic: nullH });

      expect( res.found ).to.equal(false);
      expect( res.distance ).to.equal(undefined);
      expect( res.path ).to.equal(undefined);
    });

    it('directed, null heuristic, unweighted (2)', function(){
      var res = cy.elements().aStar({ root: a, goal: d, directed: true, heuristic: nullH });

      expect( res.found ).to.equal(true);
      expect( res.distance ).to.equal(3);
      expect( nodeIds( res.path ) ).to.deep.equal([ 'a', 'b', 'c', 'd' ]);
    });

    it('undirected, null heuristic, weighted', function(){
      var res = cy.elements().aStar({ root: a, goal: d, directed: false, weight, heuristic: nullH });

      expect( res.found ).to.equal(true);
      expect( res.distance ).to.equal(8);
      expect( nodeIds( res.path ) ).to.deep.equal([ 'a', 'e', 'd' ]);
    });

    it('directed, null heuristic, weighted', function(){
      var res = cy.elements().aStar({ root: a, goal: d, directed: true, weight, heuristic: nullH });

      expect( res.found ).to.equal(true);
      expect( res.distance ).to.equal(10);
      expect( nodeIds( res.path ) ).to.deep.equal([ 'a', 'b', 'c', 'd' ]);
    });

    it('directed, weighted, not found', function(){
      var res = cy.elements().aStar({ root: d, goal: a, directed: true, weight, heuristic: nullH });

      expect( res.found ).to.equal(false);
      expect( res.distance ).to.equal(undefined);
      expect( res.path ).to.equal(undefined);
    });

    it('counts steps', function(){
      var res = cy.elements().aStar({ root: a, goal: d, weight });

      expect( res.steps ).to.be.above( 0 );
    });

    it('throws without root and goal', function(){
      expect( () => cy.elements().aStar({ root: a }) ).to.throw();
      expect( () => cy.elements().aStar({ goal: a }) ).to.throw();
    });
  });

  describe('eles.floydWarshall()', function(){
    it('directed, weighted', function(){
      var res = cy.elements().floydWarshall({ directed: true, weight });
      var path = res.path;
      var distance = res.distance;

      expect( distance(a, a) ).to.equal(0);
      expect( nodeIds( path(a, a) ) ).to.deep.equal([ 'a' ]);

      expect( distance(a, b) ).to.equal(3);
      expect( nodeIds( path(a, b) ) ).to.deep.equal([ 'a', 'b' ]);

      expect( distance(a, c) ).to.equal(8);
      expect( nodeIds( path(a, c) ) ).to.deep.equal([ 'a', 'b', 'c' ]);

      expect( distance(a, d) ).to.equal(10);
      expect( nodeIds( path(a, d) ) ).to.deep.equal([ 'a', 'b', 'c', 'd' ]);

      expect( distance(a, e) ).to.equal(1);
      expect( nodeIds( path(a, e) ) ).to.deep.equal([ 'a', 'e' ]);

      expect( distance(b, a) ).to.equal(Infinity);
      expect( path(b, a).empty() ).to.be.true;

      expect( distance(b, d) ).to.equal(7);
      expect( nodeIds( path(b, d) ) ).to.deep.equal([ 'b', 'c', 'd' ]);

      expect( distance(c, a) ).to.equal(Infinity);
      expect( path(c, a).empty() ).to.be.true;

      expect( distance(d, e) ).to.equal(7);
      expect( nodeIds( path(d, e) ) ).to.deep.equal([ 'd', 'e' ]);

      expect( distance(e, d) ).to.equal(Infinity);
      expect( path(e, d).empty() ).to.be.true;
    });

    it('undirected, weighted', function(){
      var res = cy.elements().floydWarshall({ directed: false, weight });
      var path = res.path;
      var distance = res.distance;

      expect( distance(a, c) ).to.equal(7);
      expect( nodeIds( path(a, c) ) ).to.deep.equal([ 'a', 'e', 'c' ]);

      expect( distance(a, d) ).to.equal(8);
      expect( nodeIds( path(a, d) ) ).to.deep.equal([ 'a', 'e', 'd' ]);

      expect( distance(b, a) ).to.equal(3);
      expect( nodeIds( path(b, a) ) ).to.deep.equal([ 'b', 'a' ]);

      expect( distance(c, a) ).to.equal(7);
      expect( nodeIds( path(c, a) ) ).to.deep.equal([ 'c', 'e', 'a' ]);

      expect( distance(d, b) ).to.equal(7);
      expect( nodeIds( path(d, b) ) ).to.deep.equal([ 'd', 'c', 'b' ]);

      expect( distance(e, a) ).to.equal(1);
      expect( nodeIds( path(e, a) ) ).to.deep.equal([ 'e', 'a' ]);
    });

    it('directed, unweighted', function(){
      var res = cy.elements().floydWarshall({ directed: true });

      expect( res.distance(a, d) ).to.equal(3);
      expect( nodeIds( res.path(a, d) ) ).to.deep.equal([ 'a', 'b', 'c', 'd' ]);
    });

    it('undirected, unweighted', function(){
      var res = cy.elements().floydWarshall({});

      expect( res.distance(a, d) ).to.equal(2);
      expect( nodeIds( res.path(a, d) ) ).to.deep.equal([ 'a', 'e', 'd' ]);
    });
  });

  describe('eles.bellmanFord()', function(){
    it('undirected, weighted', function(){
      var res = cy.elements().bellmanFord({ root: a, directed: false, weight });
      var path = res.pathTo;
      var distance = res.distanceTo;

      expect( res.hasNegativeWeightCycle ).to.equal(false);

      expect( distance(a) ).to.equal(0);
      expect( nodeIds( path(a) ) ).to.deep.equal([ 'a' ]);

      expect( distance(b) ).to.equal(3);
      expect( nodeIds( path(b) ) ).to.deep.equal([ 'a', 'b' ]);

      expect( distance(c) ).to.equal(7);
      expect( nodeIds( path(c) ) ).to.deep.equal([ 'a', 'e', 'c' ]);

      expect( distance(d) ).to.equal(8);
      expect( nodeIds( path(d) ) ).to.deep.equal([ 'a', 'e', 'd' ]);

      expect( distance(e) ).to.equal(1);
      expect( nodeIds( path(e) ) ).to.deep.equal([ 'a', 'e' ]);
    });

    it('directed, weighted', function(){
      var res = cy.elements().bellmanFord({ root: b, directed: true, weight });
      var path = res.pathTo;
      var distance = res.distanceTo;

      expect( res.hasNegativeWeightCycle ).to.equal(false);

      expect( distance(a) ).to.equal(Infinity);
      expect( path(a).empty() ).to.be.true;

      expect( distance(b) ).to.equal(0);
      expect( nodeIds( path(b) ) ).to.deep.equal([ 'b' ]);

      expect( distance(c) ).to.equal(5);
      expect( nodeIds( path(c) ) ).to.deep.equal([ 'b', 'c' ]);

      expect( distance(d) ).to.equal(7);
      expect( nodeIds( path(d) ) ).to.deep.equal([ 'b', 'c', 'd' ]);

      expect( distance(e) ).to.equal(4);
      expect( nodeIds( path(e) ) ).to.deep.equal([ 'b', 'e' ]);
    });

    it('undirected, unweighted', function(){
      var res = cy.elements().bellmanFord({ root: a, directed: false });

      expect( res.hasNegativeWeightCycle ).to.equal(false);
      expect( res.distanceTo(b) ).to.equal(1);
      expect( res.distanceTo(c) ).to.equal(2);
      expect( res.distanceTo(d) ).to.equal(2);
      expect( nodeIds( res.pathTo(d) ) ).to.deep.equal([ 'a', 'e', 'd' ]);
    });

    it('detects a negative weight cycle without finding it', function(){
      ce.data('weight', -6);
      cd.data('weight', -2);

      var res = cy.elements().bellmanFord({
        root: a, directed: false, weight, findNegativeWeightCycles: false
      });

      expect( res.hasNegativeWeightCycle ).to.equal(true);
      expect( res.negativeWeightCycles.length ).to.equal(0);
    });

    it('finds negative weight cycles', function(){
      be.data('weight', -5);
      df.data('weight', -5);

      var res = cy.elements().bellmanFord({ root: a, directed: false, weight });
      var numCycles = res.negativeWeightCycles.length;

      expect( numCycles ).to.be.above(0);

      for( var i = 0; i < numCycles; i++ ){
        var cycle = res.negativeWeightCycles[i];

        // v4 collections dedupe, so the closing node collapses: even length,
        // alternating node/edge, and the cycle's edge weights sum negative
        expect( cycle.length % 2 ).to.equal( 0 );

        for( var el = 1; el < cycle.length; el += 2 ){
          expect( cycle[el].isEdge() ).to.equal(true);

          var edgeNodes = [ cycle[el].source().id(), cycle[el].target().id() ];
          var nextNode = cycle[ ( el + 1 ) % cycle.length ];

          expect( edgeNodes ).to.contain( cycle[el - 1].id() );
          expect( edgeNodes ).to.contain( nextNode.id() );
        }

        var sum = 0;

        cycle.edges().forEach( edge => { sum += edge.data('weight'); } );

        expect( sum ).to.be.below(0);
      }
    });

    it('throws without a root', function(){
      expect( () => cy.elements().bellmanFord({}) ).to.throw();
    });
  });
});

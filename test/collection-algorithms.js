var expect = require('chai').expect;
var cytoscape = require('../src/test.js', cytoscape);

describe('Graph theory algorithms (traversing, search, etc)', function(){

  var cy;
  var a, b, c, d, e;
  var ae, ab, be, bc, ce, cd, de;

  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'd' } },
          { data: { id: 'e' } }
        ],

        edges: [
          { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
          { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
          { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
          { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
          { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
          { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
          { data: { id: 'de', weight: 7, source: 'd', target: 'e' } }
        ]
      },
      ready: function(){
        cy = this;

        a = cy.$('#a');
        b = cy.$('#b');
        c = cy.$('#c');
        d = cy.$('#d');
        e = cy.$('#e');

        ae = cy.$('#ae');
        ab = cy.$('#ab');
        be = cy.$('#be');
        bc = cy.$('#bc');
        ce = cy.$('#ce');
        cd = cy.$('#cd');
        de = cy.$('#de');

        done();
      }
    });
  });

  function ele2id(ele){
    return ele.id();
  }

  function isNode(ele){
    return ele.isNode();
  }

  function eles(){
    var col = cy.collection();

    for( var i = 0; i < arguments.length; i++ ){
      var ele = arguments[i];

      col = col.add(ele);
    }

    return col;
  }

  it('eles.bfs() undirected from `a`', function(){
    var expectedDepths = {
      a: 0,
      b: 1,
      e: 1,
      c: 2,
      d: 2
    };

    var depths = {};

    var bfs = cy.elements().bfs({
      roots: a,
      visit: function(v, e, u, i, depth){
        depths[ v.id() ] = depth;
      }
    });

    expect( depths ).to.deep.equal( expectedDepths );
    expect( bfs.path.nodes().same( cy.nodes() ) ).to.be.true;
    expect( bfs.path.edges().length ).to.equal( 4 );

    for( var i = 0; i < bfs.path.length; i++ ){
      if( i % 2 === 0 ){
        expect( bfs.path[i].isNode() ).to.be.true;
      } else {
        expect( bfs.path[i].isEdge() ).to.be.true;
      }
    }
  });

  it('eles.bfs() directed from `a`', function(){
    var expectedDepths = {
      a: 0,
      b: 1,
      e: 1,
      c: 2,
      d: 3
    };

    var depths = {};

    var bfs = cy.elements().bfs({
      roots: a,
      visit: function(v, e, u, i, depth){
        depths[ v.id() ] = depth;
      },
      directed: true
    });

    expect( depths ).to.deep.equal( expectedDepths );
    expect( bfs.path.nodes().same( cy.nodes() ) ).to.be.true;
    expect( bfs.path.edges().length ).to.equal( 4 );

    for( var i = 0; i < bfs.path.length; i++ ){
      if( i % 2 === 0 ){
        expect( bfs.path[i].isNode() ).to.be.true;
      } else {
        expect( bfs.path[i].isEdge() ).to.be.true;
      }
    }
  });

  it('eles.dfs() undirected from `a`', function(){
    var dfs = cy.elements().dfs({
      roots: a
    });

    expect( dfs.path.nodes().same( cy.nodes() ) ).to.be.true;
    expect( dfs.path.edges().length ).to.equal( 4 );

    for( var i = 0; i < dfs.path.length; i++ ){
      if( i % 2 === 0 ){
        expect( dfs.path[i].isNode() ).to.be.true;
      } else {
        expect( dfs.path[i].isEdge() ).to.be.true;
      }
    }
  });

  it('eles.dfs() directed from `a`', function(){
    var dfs = cy.elements().dfs({ roots: a, directed: true });

    expect( dfs.path.nodes().same( cy.nodes() ) ).to.be.true;
    expect( dfs.path.edges().length ).to.equal( 4 );

    for( var i = 0; i < dfs.path.length; i++ ){
      if( i % 2 === 0 ){
        expect( dfs.path[i].isNode() ).to.be.true;
      } else {
        expect( dfs.path[i].isEdge() ).to.be.true;
      }
    }
  });

  it('eles.dijkstra() undirected', function(){
    var di = cy.elements().dijkstra({
      root: a,
      weight: function( ele ){
        return ele.data('weight');
      }
    });

    expect( di.distanceTo(b) ).to.equal(3);
    expect( di.pathTo(b).same( eles(a, ab, b) ) ).to.be.true;

    expect( di.distanceTo(e) ).to.equal(1);
    expect( di.pathTo(e).same( eles(a, ae, e) ) ).to.be.true;

    expect( di.distanceTo(c) ).to.equal(7);
    expect( di.pathTo(c).same( eles(a, ae, e, ce, c) ) ).to.be.true;

    expect( di.distanceTo(d) ).to.equal(8);
    expect( di.pathTo(d).same( eles(a, ae, e, de, d) ) ).to.be.true;

    var adPath = di.pathTo(d);
    for( var i = 0; i < adPath.length; i++ ){
      if( i % 2 === 0 ){
        expect( adPath[i].isNode() ).to.be.true;
      } else {
        expect( adPath[i].isEdge() ).to.be.true;
      }
    }
  });

  it('eles.dijkstra() disconnected infinity', function(){
    var cy = cytoscape({
      elements: [
        {
          group: 'nodes',
          data: { id: 'a' }
        },

        {
          group: 'nodes',
          data: { id: 'b' }
        }
      ],
      headless: true
    });

    var di = cy.elements().dijkstra({
      root: '#a',
      weight: function( ele ){
        return ele.data('weight');
      }
    });

    expect( di.distanceTo('#b') ).to.equal(Infinity);
  });

  it('eles.dijkstra() directed', function(){
    var di = cy.elements().dijkstra({
      root: a,
      weight: function( ele ){
        return ele.data('weight');
      },
      directed: true
    });

    expect( di.distanceTo(b) ).to.equal(3);
    expect( di.pathTo(b).same( eles(a, ab, b) ) ).to.be.true;

    expect( di.distanceTo(e) ).to.equal(1);
    expect( di.pathTo(e).same( eles(a, ae, e) ) ).to.be.true;

    expect( di.distanceTo(c) ).to.equal(8);
    expect( di.pathTo(c).same( eles(a, ab, b, bc, c) ) ).to.be.true;

    expect( di.distanceTo(d) ).to.equal(10);
    expect( di.pathTo(d).same( eles(a, ab, b, bc, c, cd, d) ) ).to.be.true;

    var adPath = di.pathTo(d);
    for( var i = 0; i < adPath.length; i++ ){
      if( i % 2 === 0 ){
        expect( adPath[i].isNode() ).to.be.true;
      } else {
        expect( adPath[i].isEdge() ).to.be.true;
      }
    }
  });

  it('eles.kruskal()', function(){
    var kruskal = cy.elements().kruskal( function( ele ){
      return ele.data('weight');
    } );

    expect( kruskal.same( eles(a, b, c, d, e, ae, cd, ab, bc) ) );
  });


  it('eles.aStar(): undirected, null heuristic, unweighted', function(){
      var options = {root: a,
		     goal: b,
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(true);
      expect(res.distance).to.equal(1);
      expect(res.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b"]);
  });

  it('eles.aStar(): undirected, null heuristic, unweighted (2)', function(){
      var options = {root: a,
		     goal: d,
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(true);
      expect(res.distance).to.equal(2);
      expect(res.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e", "d"]);
  });

  it('eles.aStar(): directed, null heuristic, unweighted', function(){
      var options = {root: c,
		     goal: a,
		     directed: true,
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(false);
  });

  it('eles.aStar(): directed, null heuristic, unweighted (2)', function(){
      var options = {root: a,
		     goal: d,
		     directed: true,
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(true);
      expect(res.distance).to.equal(3);
      expect(res.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b", "c", "d"]);
  });

  it('eles.aStar(): undirected, null heuristic, weighted', function(){
      var options = {root: a,
		     goal: d,
		     directed: false,
		     weight: function( ele ) {return ele.data('weight');},
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect( res.found ).to.equal(true);
      expect( res.distance ).to.equal(8);
      expect( res.path.stdFilter(isNode).map(ele2id) ).to.deep.equal(["a", "e", "d"]);
  });

  it('eles.aStar(): directed, null heuristic, weighted', function(){
      var options = {root: a,
		     goal: d,
		     directed: true,
		     weight: function( ele ) {return ele.data('weight');},
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(true);
      expect(res.distance).to.equal(10);
      expect(res.path.stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b", "c", "d"]);
  });

  it('eles.aStar(): directed, null heuristic, weighted, not found', function(){
      var options = {root: d,
		     goal: a,
		     directed: true,
		     weight: function( ele ) {return ele.data('weight');},
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(false);
      expect(res.distance).to.equal(undefined);
      expect(res.path).to.deep.equal(undefined);
  });

  it('eles.floydWarshall(): directed, weighted', function() {
      var options = {directed: true,
		     weight: function( ele ) {return ele.data('weight');}
		    };
      var res = cy.elements().floydWarshall(options);
      var path = res.path;
      var distance = res.distance;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(3);
      expect(path(a,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(8);
      expect(path(a,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b", "c"]);

      expect(distance(a,d)).to.equal(10);
      expect(path(a,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b", "c", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e"]);

      // Paths from node b
      expect(distance(b,a)).to.equal(Infinity);
      expect(path(b,a).empty()).to.be.true;

      expect(distance(b,b)).to.equal(0);
      expect(path(b,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["b"]);

      expect(distance(b,c)).to.equal(5);
      expect(path(b,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "c"]);

      expect(distance(b,d)).to.equal(7);
      expect(path(b,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "c", "d"]);

      expect(distance(b,e)).to.equal(4);
      expect(path(b,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "e"]);

      // Paths from node c
      expect(distance(c,a)).to.equal(Infinity);
      expect(path(c,a).empty()).to.be.true;

      expect(distance(c,b)).to.equal(Infinity);
      expect(path(c,b).empty()).to.be.true;

      expect(distance(c,c)).to.equal(0);
      expect(path(c,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["c"]);

      expect(distance(c,d)).to.equal(2);
      expect(path(c,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["c", "d"]);

      expect(distance(c,e)).to.equal(6);
      expect(path(c,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["c", "e"]);

      // Paths from node d
      expect(distance(d,a)).to.equal(Infinity);
      expect(path(d,a).empty()).to.be.true;

      expect(distance(d,b)).to.equal(Infinity);
      expect(path(d,b).empty()).to.be.true;

      expect(distance(d,c)).to.equal(Infinity);
      expect(path(d,c).empty()).to.be.true;

      expect(distance(d,d)).to.equal(0);
      expect(path(d,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["d"]);

      expect(distance(d,e)).to.equal(7);
      expect(path(d,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["d", "e"]);

      // Paths from node e
      expect(distance(e,a)).to.equal(Infinity);
      expect(path(e,a).empty()).to.be.true;

      expect(distance(e,b)).to.equal(Infinity);
      expect(path(e,b).empty()).to.be.true;

      expect(distance(e,c)).to.equal(Infinity);
      expect(path(e,c).empty()).to.be.true;

      expect(distance(e,d)).to.equal(Infinity);
      expect(path(e,d).empty()).to.be.true;

      expect(distance(e,e)).to.equal(0);
      expect(path(e,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["e"]);

  });


  it('eles.floydWarshall(): undirected, weighted', function() {
      var options = {directed: false,
		     weight: function( ele ) {return ele.data('weight');}
		    };
      var res = cy.elements().floydWarshall(options);
      var path = res.path;
      var distance = res.distance;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(3);
      expect(path(a,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(7);
      expect(path(a,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e", "c"]);

      expect(distance(a,d)).to.equal(8);
      expect(path(a,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e"]);

      // Paths from node b
      expect(distance(b,a)).to.equal(3);
      expect(path(b,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "a"]);

      expect(distance(b,b)).to.equal(0);
      expect(path(b,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["b"]);

      expect(distance(b,c)).to.equal(5);
      expect(path(b,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "c"]);

      expect(distance(b,d)).to.equal(7);
      expect(path(b,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "c", "d"]);

      expect(distance(b,e)).to.equal(4);
      //expect(path(b,e)).to.deep.equal(["b", "e"]);

      // Paths from node c
      expect(distance(c,a)).to.equal(7);
      expect(path(c,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["c", "e", "a"]);

      expect(distance(c,b)).to.equal(5);
      expect(path(c,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["c", "b"]);

      expect(distance(c,c)).to.equal(0);
      expect(path(c,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["c"]);

      expect(distance(c,d)).to.equal(2);
      expect(path(c,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["c", "d"]);

      expect(distance(c,e)).to.equal(6);
      expect(path(c,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["c", "e"]);

      // Paths from node d
      expect(distance(d,a)).to.equal(8);
      expect(path(d,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["d", "e", "a"]);

      expect(distance(d,b)).to.equal(7);
      expect(path(d,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["d", "c", "b"]);

      expect(distance(d,c)).to.equal(2);
      expect(path(d,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["d", "c"]);

      expect(distance(d,d)).to.equal(0);
      expect(path(d,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["d"]);

      expect(distance(d,e)).to.equal(7);
      expect(path(d,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["d", "e"]);

      // Paths from node e
      expect(distance(e,a)).to.equal(1);
      expect(path(e,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["e", "a"]);

      expect(distance(e,b)).to.equal(4);
      //expect(path(e,b)).to.deep.equal();

      expect(distance(e,c)).to.equal(6);
      expect(path(e,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["e", "c"]);

      expect(distance(e,d)).to.equal(7);
      expect(path(e,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["e", "d"]);

      expect(distance(e,e)).to.equal(0);
      expect(path(e,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["e"]);

  });


  it('eles.floydWarshall(): directed, unweighted', function() {
      var options = {directed: true};
      var res = cy.elements().floydWarshall(options);
      var path = res.path;
      var distance = res.distance;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(1);
      expect(path(a,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(2);
      expect(path(a,c).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b", "c"]);

      expect(distance(a,d)).to.equal(3);
      expect(path(a,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b", "c", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e"]);

  });

  it('eles.floydWarshall(): undirected, unweighted', function() {
      var options = {directed: false};
      var res = cy.elements().floydWarshall(options);
      var path = res.path;
      var distance = res.distance;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a).stdFilter(isNode).map(ele2id)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(1);
      expect(path(a,b).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(2);
      //expect(path(a,c)).to.deep.equal(["a", "b", "c"]);

      expect(distance(a,d)).to.equal(2);
      expect(path(a,d).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e"]);
  });



  it('eles.bellmanFord(): undirected, weighted', function() {
      var options = { root: a,
		      directed: false,
		      weight: function( ele ) {return ele.data('weight');}
		    };
      var res = cy.elements().bellmanFord(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // No negative weight cycles
      expect(res.hasNegativeWeightCycle).to.equal(false);

      // Paths from node a
      expect(distance(a)).to.equal(0);
      expect(path(a).stdFilter(isNode).map(ele2id)).to.deep.equal(["a"]);

      expect(distance(b)).to.equal(3);
      expect(path(b).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b"]);

      expect(distance(c)).to.equal(7);
      expect(path(c).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e", "c"]);

      expect(distance(d)).to.equal(8);
      expect(path(d).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e", "d"]);

       expect(distance(e)).to.equal(1);
       expect(path(e).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e"]);
  });


  it('eles.bellmanFord(): detection of negative weight cycle', function() {
      var options = { root: a,
		      directed: false,
		      weight: function( ele ) {return -1 * ele.data('weight');}
		    };
      var res = cy.elements().bellmanFord(options);

      // No negative weight cycles
      expect(res.hasNegativeWeightCycle).to.equal(true);

  });


  it('eles.bellmanFord(): directed, weighted', function() {
      var options = { root: b,
		      directed: true,
		      weight: function( ele ) {return ele.data('weight');}
		    };
      var res = cy.elements().bellmanFord(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // No negative weight cycles
      expect(res.hasNegativeWeightCycle).to.equal(false);

      // Paths from node b
      expect(distance(a)).to.equal(Infinity);
      expect(path(a).empty()).to.be.true;

      expect(distance(b)).to.equal(0);
      expect(path(b).stdFilter(isNode).map(ele2id)).to.deep.equal(["b"]);

      expect(distance(c)).to.equal(5);
      expect(path(c).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "c"]);

      expect(distance(d)).to.equal(7);
      expect(path(d).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "c", "d"]);

      expect(distance(e)).to.equal(4);
      expect(path(e).stdFilter(isNode).map(ele2id)).to.deep.equal(["b", "e"]);
  });


  it('eles.bellmanFord(): undirected, unweighted', function() {
      var options = { root: a,
		      directed: false
		    };
      var res = cy.elements().bellmanFord(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // No negative weight cycles
      expect(res.hasNegativeWeightCycle).to.equal(false);

      // Paths from node a
      expect(distance(a)).to.equal(0);
      expect(path(a).stdFilter(isNode).map(ele2id)).to.deep.equal(["a"]);

      expect(distance(b)).to.equal(1);
      expect(path(b).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "b"]);

      expect(distance(c)).to.equal(2);
      //expect(path(c)).to.deep.equal(["a", "b", "c"]);

      expect(distance(d)).to.equal(2);
      expect(path(d).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e", "d"]);

      expect(distance(e)).to.equal(1);
      expect(path(e).stdFilter(isNode).map(ele2id)).to.deep.equal(["a", "e"]);

  });

  it('eles.kargerStein() (minimum Cut)', function() {

      var res = cy.elements().kargerStein({});

      // Cut size between 2 and 4
      expect(res.cut.length).to.be.within(2,4);

      // Number of nodes matches
      expect(res.partition1.length + res.partition2.length).to.equal(5);
  });


  it('eles.pageRank(): 1', function() {

      var res = cy.elements().pageRank({iterations: 20});
      // Get the sum of the pageRank of all nodes
      var sum = 0;
      var nodes = cy.nodes();
      for (var i = 0; i < nodes.length; i++) {
	  sum += res.rank(nodes[i]);
      }
      // Sum should be 1 - or really close to it
      expect(Math.abs(sum - 1)).to.be.below(0.0001);
  });

  it('eles.degreeCentrality() unweighted undirected alpha = 0', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        directed: false,
        alpha: 0
      });
    });

    expect( res["dc_a"].degree ).to.equal(2);
    expect( res["dc_b"].degree ).to.equal(3);
    expect( res["dc_c"].degree ).to.equal(3);
    expect( res["dc_d"].degree ).to.equal(2);
    expect( res["dc_e"].degree ).to.equal(4);
  });

  it('eles.degreeCentrality() unweighted undirected alpha = 1', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        directed: false,
        alpha: 1
      });
    });
    // Changing alpha will not change the expectations because graph is unweighted
    expect( res["dc_a"].degree ).to.equal(2);
    expect( res["dc_b"].degree ).to.equal(3);
    expect( res["dc_c"].degree ).to.equal(3);
    expect( res["dc_d"].degree ).to.equal(2);
    expect( res["dc_e"].degree ).to.equal(4);
  });

  it('eles.degreeCentrality() weighted undirected alpha = 0', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        weight: function( ele ){
          return ele.data('weight');
        },
        directed: false,
        alpha: 0
      });
    });

    expect( res["dc_a"].degree ).to.equal(2);
    expect( res["dc_b"].degree ).to.equal(3);
    expect( res["dc_c"].degree ).to.equal(3);
    expect( res["dc_d"].degree ).to.equal(2);
    expect( res["dc_e"].degree ).to.equal(4);
  });

  it('eles.degreeCentrality() weighted undirected alpha = 1', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        weight: function( ele ){
          return ele.data('weight');
        },
        directed: false,
        alpha: 1
      });
    });

    expect( res["dc_a"].degree ).to.equal(4);
    expect( res["dc_b"].degree ).to.equal(12);
    expect( res["dc_c"].degree ).to.equal(13);
    expect( res["dc_d"].degree ).to.equal(9);
    expect( res["dc_e"].degree ).to.equal(18);
  });

  it('eles.degreeCentrality() unweighted directed alpha = 0', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        directed: true,
        alpha: 0
      });
    });

    expect( res["dc_a"].indegree ).to.equal(0);
    expect( res["dc_b"].indegree ).to.equal(1);
    expect( res["dc_c"].indegree ).to.equal(1);
    expect( res["dc_d"].indegree ).to.equal(1);
    expect( res["dc_e"].indegree ).to.equal(4);

    expect( res["dc_a"].outdegree ).to.equal(2);
    expect( res["dc_b"].outdegree ).to.equal(2);
    expect( res["dc_c"].outdegree ).to.equal(2);
    expect( res["dc_d"].outdegree ).to.equal(1);
    expect( res["dc_e"].outdegree ).to.equal(0);
  });

  it('eles.degreeCentrality() unweighted directed alpha = 1', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        directed: true,
        alpha: 1
      });
    });
    // Changing alpha will not change the expectations because graph is unweighted
    expect( res["dc_a"].indegree ).to.equal(0);
    expect( res["dc_b"].indegree ).to.equal(1);
    expect( res["dc_c"].indegree ).to.equal(1);
    expect( res["dc_d"].indegree ).to.equal(1);
    expect( res["dc_e"].indegree ).to.equal(4);

    expect( res["dc_a"].outdegree ).to.equal(2);
    expect( res["dc_b"].outdegree ).to.equal(2);
    expect( res["dc_c"].outdegree ).to.equal(2);
    expect( res["dc_d"].outdegree ).to.equal(1);
    expect( res["dc_e"].outdegree ).to.equal(0);
  });

  it('eles.degreeCentrality() weighted directed alpha = 0', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        weight: function( ele ){
          return ele.data('weight');
        },
        directed: true,
        alpha: 0
      });
    });

    expect( res["dc_a"].indegree ).to.equal(0);
    expect( res["dc_b"].indegree ).to.equal(1);
    expect( res["dc_c"].indegree ).to.equal(1);
    expect( res["dc_d"].indegree ).to.equal(1);
    expect( res["dc_e"].indegree ).to.equal(4);

    expect( res["dc_a"].outdegree ).to.equal(2);
    expect( res["dc_b"].outdegree ).to.equal(2);
    expect( res["dc_c"].outdegree ).to.equal(2);
    expect( res["dc_d"].outdegree ).to.equal(1);
    expect( res["dc_e"].outdegree ).to.equal(0);
  });

  it('eles.degreeCentrality() weighted directed alpha = 1', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().degreeCentrality({
        root: ele,
        weight: function( ele ){
          return ele.data('weight');
        },
        directed: true,
        alpha: 1
      });
    });

    expect( res["dc_a"].indegree ).to.equal(0);
    expect( res["dc_b"].indegree ).to.equal(3);
    expect( res["dc_c"].indegree ).to.equal(5);
    expect( res["dc_d"].indegree ).to.equal(2);
    expect( res["dc_e"].indegree ).to.equal(18);

    expect( res["dc_a"].outdegree ).to.equal(4);
    expect( res["dc_b"].outdegree ).to.equal(9);
    expect( res["dc_c"].outdegree ).to.equal(8);
    expect( res["dc_d"].outdegree ).to.equal(7);
    expect( res["dc_e"].outdegree ).to.equal(0);
  });

  it('eles.closenessCentrality() unweighted undirected', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().closenessCentrality({root: ele});
    });

    expect( res["dc_a"] ).to.equal(3);
    expect( res["dc_b"] ).to.equal(3.5);
    expect( res["dc_c"] ).to.equal(3.5);
    expect( res["dc_d"] ).to.equal(3);
    expect( res["dc_e"] ).to.equal(4);
  });

  it('eles.closenessCentrality() unweighted directed', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().closenessCentrality({
        root: ele,
        directed: true
      });
    });

    expect( +res["dc_a"].toFixed(2) ).to.equal(2.83); //Rounded to 2 decimals in order to handle irrational number
    expect( res["dc_b"] ).to.equal(2.5);
    expect( res["dc_c"] ).to.equal(2);
    expect( res["dc_d"] ).to.equal(1);
    expect( res["dc_e"] ).to.equal(0);
  });

  it('eles.closenessCentrality() weighted undirected', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().closenessCentrality({
        root: ele,
        weight: function( ele ){
          return ele.data('weight');
        }
      });
    });

    expect( +res["dc_a"].toFixed(2) ).to.equal(1.60); //Rounded to 2 decimals in order to handle irrational number
    expect( +res["dc_b"].toFixed(2) ).to.equal(0.93);
    expect( +res["dc_c"].toFixed(2) ).to.equal(1.01);
    expect( +res["dc_d"].toFixed(2) ).to.equal(0.91);
    expect( +res["dc_e"].toFixed(2) ).to.equal(1.56);
  });

  it('eles.closenessCentrality() weighted directed', function(){
    var res = {};
    cy.nodes().forEach(function (ele) {
      res["dc_" + ele.id()] = cy.elements().closenessCentrality({
        root: ele,
        weight: function( ele ){
          return ele.data('weight');
        },
        directed: true
      });
    });

    expect( +res["dc_a"].toFixed(2) ).to.equal(1.56); //Rounded to 2 decimals in order to handle irrational number
    expect( +res["dc_b"].toFixed(2) ).to.equal(0.59);
    expect( +res["dc_c"].toFixed(2) ).to.equal(0.67);
    expect( +res["dc_d"].toFixed(2) ).to.equal(0.14);
    expect( res["dc_e"] ).to.equal(0);
  });

  it('eles.betweennessCentrality() unweighted undirected', function(){
    var res = cy.elements().betweennessCentrality();

    expect( res.betweenness(a) ).to.equal(0);
    expect( res.betweenness(b) ).to.equal(1);
    expect( res.betweenness(c) ).to.equal(1);
    expect( res.betweenness(d) ).to.equal(0);
    expect( res.betweenness(e) ).to.equal(4);
  });

  it('eles.betweennessCentrality() unweighted directed', function(){
    var res = cy.elements().betweennessCentrality({
      directed:true
    });

    expect( res.betweenness(a) ).to.equal(0);
    expect( res.betweenness(b) ).to.equal(2);
    expect( res.betweenness(c) ).to.equal(2);
    expect( res.betweenness(d) ).to.equal(0);
    expect( res.betweenness(e) ).to.equal(0);
  });

  it('eles.betweennessCentrality() weighted undirected', function(){
    var res = cy.elements().betweennessCentrality({
      weight: function( ele ){
        return ele.data('weight');
      }
    });

    expect( res.betweenness(a) ).to.equal(1);
    expect( res.betweenness(b) ).to.equal(0);
    expect( res.betweenness(c) ).to.equal(2);
    expect( res.betweenness(d) ).to.equal(0);
    expect( res.betweenness(e) ).to.equal(4);
  });

  it('eles.betweennessCentrality() weighted directed', function(){
    var res = cy.elements().betweennessCentrality({
      weight: function( ele ){
        return ele.data('weight');
      },
      directed:true
    });

    expect( res.betweenness(a) ).to.equal(0);
    expect( res.betweenness(b) ).to.equal(2);
    expect( res.betweenness(c) ).to.equal(2);
    expect( res.betweenness(d) ).to.equal(0);
    expect( res.betweenness(e) ).to.equal(0);
  });
});

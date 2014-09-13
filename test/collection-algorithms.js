var expect = require('chai').expect;
var cytoscape = require('../build/cytoscape.js', cytoscape);

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
      visit: function(i, depth){
        depths[ this.id() ] = depth;
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
      visit: function(i, depth){
        depths[ this.id() ] = depth;
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
      weight: function(){
        return this.data('weight');
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

  it('eles.dijkstra() directed', function(){
    var di = cy.elements().dijkstra({
      root: a,
      weight: function(){
        return this.data('weight');
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
    var kruskal = cy.elements().kruskal( function(){
      return this.data('weight');
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
      expect(res.path).to.deep.equal(["a", "b"]);
  });

  it('eles.aStar(): undirected, null heuristic, unweighted (2)', function(){
      var options = {root: a, 
		     goal: d, 
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(true);
      expect(res.distance).to.equal(2);
      expect(res.path).to.deep.equal(["a", "e", "d"]);
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
      expect(res.path).to.deep.equal(["a", "b", "c", "d"]);
  });

  it('eles.aStar(): undirected, null heuristic, weighted', function(){
      var options = {root: a, 
		     goal: d, 
		     directed: false, 
		     weight: function() {return this.data('weight');},
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect( res.found ).to.equal(true);
      expect( res.distance ).to.equal(8);
      expect( res.path ).to.deep.equal(["a", "e", "d"]);
  });

  it('eles.aStar(): directed, null heuristic, weighted', function(){
      var options = {root: a, 
		     goal: d, 
		     directed: true, 
		     weight: function() {return this.data('weight');},
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(true);
      expect(res.distance).to.equal(10);
      expect(res.path).to.deep.equal(["a", "b", "c", "d"]);
  });

  it('eles.aStar(): directed, null heuristic, weighted, not found', function(){
      var options = {root: d, 
		     goal: a, 
		     directed: true, 
		     weight: function() {return this.data('weight');},
		     heuristic: function(a){return 0;}
		    };
      var res = cy.elements().aStar(options);
      expect(res.found).to.equal(false);
      expect(res.distance).to.equal(undefined);
      expect(res.path).to.deep.equal(undefined);
  });

  it('eles.floydWarshall(): directed, weighted', function() {
      var options = {directed: true, 
		     weight: function() {return this.data('weight');}
		    };
      var res = cy.elements().floydWarshall(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(3);
      expect(path(a,b)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(8);
      expect(path(a,c)).to.deep.equal(["a", "b", "c"]);

      expect(distance(a,d)).to.equal(10);
      expect(path(a,d)).to.deep.equal(["a", "b", "c", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e)).to.deep.equal(["a", "e"]);

      // Paths from node b
      expect(distance(b,a)).to.equal(Infinity);
      expect(path(b,a)).to.deep.equal(undefined);

      expect(distance(b,b)).to.equal(0);
      expect(path(b,b)).to.deep.equal(["b"]);

      expect(distance(b,c)).to.equal(5);
      expect(path(b,c)).to.deep.equal(["b", "c"]);

      expect(distance(b,d)).to.equal(7);
      expect(path(b,d)).to.deep.equal(["b", "c", "d"]);

      expect(distance(b,e)).to.equal(4);
      expect(path(b,e)).to.deep.equal(["b", "e"]);

      // Paths from node c
      expect(distance(c,a)).to.equal(Infinity);
      expect(path(c,a)).to.deep.equal(undefined);

      expect(distance(c,b)).to.equal(Infinity);
      expect(path(c,b)).to.deep.equal(undefined);

      expect(distance(c,c)).to.equal(0);
      expect(path(c,c)).to.deep.equal(["c"]);

      expect(distance(c,d)).to.equal(2);
      expect(path(c,d)).to.deep.equal(["c", "d"]);

      expect(distance(c,e)).to.equal(6);
      expect(path(c,e)).to.deep.equal(["c", "e"]);

      // Paths from node d
      expect(distance(d,a)).to.equal(Infinity);
      expect(path(d,a)).to.deep.equal(undefined);

      expect(distance(d,b)).to.equal(Infinity);
      expect(path(d,b)).to.deep.equal(undefined);

      expect(distance(d,c)).to.equal(Infinity);
      expect(path(d,c)).to.deep.equal(undefined);

      expect(distance(d,d)).to.equal(0);
      expect(path(d,d)).to.deep.equal(["d"]);

      expect(distance(d,e)).to.equal(7);
      expect(path(d,e)).to.deep.equal(["d", "e"]);

      // Paths from node e
      expect(distance(e,a)).to.equal(Infinity);
      expect(path(e,a)).to.deep.equal(undefined);

      expect(distance(e,b)).to.equal(Infinity);
      expect(path(e,b)).to.deep.equal(undefined);

      expect(distance(e,c)).to.equal(Infinity);
      expect(path(e,c)).to.deep.equal(undefined);

      expect(distance(e,d)).to.equal(Infinity);
      expect(path(e,d)).to.deep.equal(undefined);

      expect(distance(e,e)).to.equal(0);
      expect(path(e,e)).to.deep.equal(["e"]);

  });


  it('eles.floydWarshall(): undirected, weighted', function() {
      var options = {directed: false, 
		     weight: function() {return this.data('weight');}
		    };
      var res = cy.elements().floydWarshall(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(3);
      expect(path(a,b)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(7);
      expect(path(a,c)).to.deep.equal(["a", "e", "c"]);

      expect(distance(a,d)).to.equal(8);
      expect(path(a,d)).to.deep.equal(["a", "e", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e)).to.deep.equal(["a", "e"]);

      // Paths from node b
      expect(distance(b,a)).to.equal(3);
      expect(path(b,a)).to.deep.equal(["b", "a"]);

      expect(distance(b,b)).to.equal(0);
      expect(path(b,b)).to.deep.equal(["b"]);

      expect(distance(b,c)).to.equal(5);
      expect(path(b,c)).to.deep.equal(["b", "c"]);

      expect(distance(b,d)).to.equal(7);
      expect(path(b,d)).to.deep.equal(["b", "c", "d"]);

      expect(distance(b,e)).to.equal(4);
      //expect(path(b,e)).to.deep.equal(["b", "e"]);

      // Paths from node c
      expect(distance(c,a)).to.equal(7);
      expect(path(c,a)).to.deep.equal(["c", "e", "a"]);

      expect(distance(c,b)).to.equal(5);
      expect(path(c,b)).to.deep.equal(["c", "b"]);

      expect(distance(c,c)).to.equal(0);
      expect(path(c,c)).to.deep.equal(["c"]);

      expect(distance(c,d)).to.equal(2);
      expect(path(c,d)).to.deep.equal(["c", "d"]);

      expect(distance(c,e)).to.equal(6);
      expect(path(c,e)).to.deep.equal(["c", "e"]);

      // Paths from node d
      expect(distance(d,a)).to.equal(8);
      expect(path(d,a)).to.deep.equal(["d", "e", "a"]);

      expect(distance(d,b)).to.equal(7);
      expect(path(d,b)).to.deep.equal(["d", "c", "b"]);

      expect(distance(d,c)).to.equal(2);
      expect(path(d,c)).to.deep.equal(["d", "c"]);

      expect(distance(d,d)).to.equal(0);
      expect(path(d,d)).to.deep.equal(["d"]);

      expect(distance(d,e)).to.equal(7);
      expect(path(d,e)).to.deep.equal(["d", "e"]);

      // Paths from node e
      expect(distance(e,a)).to.equal(1);
      expect(path(e,a)).to.deep.equal(["e", "a"]);

      expect(distance(e,b)).to.equal(4);
      //expect(path(e,b)).to.deep.equal();

      expect(distance(e,c)).to.equal(6);
      expect(path(e,c)).to.deep.equal(["e", "c"]);

      expect(distance(e,d)).to.equal(7);
      expect(path(e,d)).to.deep.equal(["e", "d"]);

      expect(distance(e,e)).to.equal(0);
      expect(path(e,e)).to.deep.equal(["e"]);

  });


  it('eles.floydWarshall(): directed, unweighted', function() {
      var options = {directed: true};
      var res = cy.elements().floydWarshall(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(1);
      expect(path(a,b)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(2);
      expect(path(a,c)).to.deep.equal(["a", "b", "c"]);

      expect(distance(a,d)).to.equal(3);
      expect(path(a,d)).to.deep.equal(["a", "b", "c", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e)).to.deep.equal(["a", "e"]);

  });

  it('eles.floydWarshall(): undirected, unweighted', function() {
      var options = {directed: false};
      var res = cy.elements().floydWarshall(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // Paths from node a
      expect(distance(a,a)).to.equal(0);
      expect(path(a,a)).to.deep.equal(["a"]);

      expect(distance(a,b)).to.equal(1);
      expect(path(a,b)).to.deep.equal(["a", "b"]);

      expect(distance(a,c)).to.equal(2);
      //expect(path(a,c)).to.deep.equal(["a", "b", "c"]);

      expect(distance(a,d)).to.equal(2);
      expect(path(a,d)).to.deep.equal(["a", "e", "d"]);

      expect(distance(a,e)).to.equal(1);
      expect(path(a,e)).to.deep.equal(["a", "e"]);
  });



  it('eles.bellmanFord(): undirected, weighted', function() {
      var options = { root: a,
		      directed: false, 
		      weight: function() {return this.data('weight');}
		    };
      var res = cy.elements().bellmanFord(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // No negative weight cycles
      expect(res.hasNegativeWeightCycle).to.equal(false);

      // Paths from node a
      expect(distance(a)).to.equal(0);
      expect(path(a)).to.deep.equal(["a"]);

      expect(distance(b)).to.equal(3);
      expect(path(b)).to.deep.equal(["a", "b"]);

      expect(distance(c)).to.equal(7);
      expect(path(c)).to.deep.equal(["a", "e", "c"]);

      expect(distance(d)).to.equal(8);
      expect(path(d)).to.deep.equal(["a", "e", "d"]);

       expect(distance(e)).to.equal(1);
       expect(path(e)).to.deep.equal(["a", "e"]);
  });


  it('eles.bellmanFord(): detection of negative weight cycle', function() {
      var options = { root: a,
		      directed: false, 
		      weight: function() {return -1 * this.data('weight');}
		    };
      var res = cy.elements().bellmanFord(options);

      // No negative weight cycles
      expect(res.hasNegativeWeightCycle).to.equal(true);

  });


  it('eles.bellmanFord(): directed, weighted', function() {
      var options = { root: b,
		      directed: true, 
		      weight: function() {return this.data('weight');}
		    };
      var res = cy.elements().bellmanFord(options);
      var path = res.pathTo;
      var distance = res.distanceTo;

      // No negative weight cycles
      expect(res.hasNegativeWeightCycle).to.equal(false);

      // Paths from node b
      expect(distance(a)).to.equal(Infinity);
      expect(path(a)).to.deep.equal(undefined);

      expect(distance(b)).to.equal(0);
      expect(path(b)).to.deep.equal(["b"]);

      expect(distance(c)).to.equal(5);
      expect(path(c)).to.deep.equal(["b", "c"]);

      expect(distance(d)).to.equal(7);
      expect(path(d)).to.deep.equal(["b", "c", "d"]);

      expect(distance(e)).to.equal(4);
      expect(path(e)).to.deep.equal(["b", "e"]);
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
      expect(path(a)).to.deep.equal(["a"]);

      expect(distance(b)).to.equal(1);
      expect(path(b)).to.deep.equal(["a", "b"]);

      expect(distance(c)).to.equal(2);
      //expect(path(c)).to.deep.equal(["a", "b", "c"]);

      expect(distance(d)).to.equal(2);
      expect(path(d)).to.deep.equal(["a", "e", "d"]);

      expect(distance(e)).to.equal(1);
      expect(path(e)).to.deep.equal(["a", "e"]);

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

});
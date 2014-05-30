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

});
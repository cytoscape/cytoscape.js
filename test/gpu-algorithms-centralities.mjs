import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// ported from the centrality/pageRank assertions of test/collection-algorithms.mjs
describe('gpu/algorithms: pageRank + centralities', function(){

  var cy;
  var a, b, c, d, e;
  var weight = ele => ele.data('weight');

  beforeEach(function(){
    cy = cytoscapeGpu({
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
    d = cy.$id('d'); e = cy.$id('e');
  });

  var dcOf = opts => {
    var res = {};

    cy.nodes().forEach( ele => {
      res[ ele.id() ] = cy.elements().degreeCentrality( { root: ele, ...opts } );
    } );

    return res;
  };

  var ccOf = opts => {
    var res = {};

    cy.nodes().forEach( ele => {
      res[ ele.id() ] = cy.elements().closenessCentrality( { root: ele, ...opts } );
    } );

    return res;
  };

  it('eles.pageRank(): ranks sum to 1', function(){
    var res = cy.elements().pageRank({ iterations: 20 });
    var sum = 0;

    cy.nodes().forEach( node => { sum += res.rank( node ); } );

    expect( Math.abs( sum - 1 ) ).to.be.below( 0.0001 );
  });

  it('eles.degreeCentrality() unweighted undirected (alpha 0 and 1 agree)', function(){
    for( var alpha of [ 0, 1 ] ){
      var res = dcOf({ directed: false, alpha });

      expect( res.a.degree ).to.equal(2);
      expect( res.b.degree ).to.equal(3);
      expect( res.c.degree ).to.equal(4);
      expect( res.d.degree ).to.equal(3);
      expect( res.e.degree ).to.equal(4);
    }
  });

  it('eles.degreeCentrality() weighted undirected alpha = 0', function(){
    var res = dcOf({ weight, directed: false, alpha: 0 });

    expect( res.a.degree ).to.equal(2);
    expect( res.b.degree ).to.equal(3);
    expect( res.c.degree ).to.equal(4);
    expect( res.d.degree ).to.equal(3);
    expect( res.e.degree ).to.equal(4);
  });

  it('eles.degreeCentrality() weighted undirected alpha = 1', function(){
    var res = dcOf({ weight, directed: false, alpha: 1 });

    expect( res.a.degree ).to.equal(4);
    expect( res.b.degree ).to.equal(12);
    expect( res.c.degree ).to.equal(14);
    expect( res.d.degree ).to.equal(17);
    expect( res.e.degree ).to.equal(18);
  });

  it('eles.degreeCentrality() unweighted directed (alpha 0 and 1 agree)', function(){
    for( var alpha of [ 0, 1 ] ){
      var res = dcOf({ directed: true, alpha });

      expect( res.a.indegree ).to.equal(0);
      expect( res.b.indegree ).to.equal(1);
      expect( res.c.indegree ).to.equal(1);
      expect( res.d.indegree ).to.equal(1);
      expect( res.e.indegree ).to.equal(4);

      expect( res.a.outdegree ).to.equal(2);
      expect( res.b.outdegree ).to.equal(2);
      expect( res.c.outdegree ).to.equal(3);
      expect( res.d.outdegree ).to.equal(2);
      expect( res.e.outdegree ).to.equal(0);
    }
  });

  it('eles.degreeCentrality() weighted directed alpha = 1', function(){
    var res = dcOf({ weight, directed: true, alpha: 1 });

    expect( res.a.indegree ).to.equal(0);
    expect( res.b.indegree ).to.equal(3);
    expect( res.c.indegree ).to.equal(5);
    expect( res.d.indegree ).to.equal(2);
    expect( res.e.indegree ).to.equal(18);

    expect( res.a.outdegree ).to.equal(4);
    expect( res.b.outdegree ).to.equal(9);
    expect( res.c.outdegree ).to.equal(9);
    expect( res.d.outdegree ).to.equal(15);
    expect( res.e.outdegree ).to.equal(0);
  });

  it('eles.degreeCentralityNormalized() undirected', function(){
    var res = cy.elements().degreeCentralityNormalized({ directed: false });

    expect( res.degree( c ) ).to.equal( 1 ); // max degree 4
    expect( res.degree( a ) ).to.equal( 0.5 );
  });

  it('eles.closenessCentrality() unweighted undirected', function(){
    var res = ccOf({});

    expect( res.a.toFixed(2) ).to.equal('3.33');
    expect( res.b ).to.equal(4);
    expect( res.c ).to.equal(4.5);
    expect( res.d ).to.equal(4);
    expect( res.e ).to.equal(4.5);
  });

  it('eles.closenessCentrality() unweighted directed', function(){
    var res = ccOf({ directed: true });

    expect( +res.a.toFixed(2) ).to.equal(3.17);
    expect( res.b ).to.equal(3);
    expect( res.c ).to.equal(3);
    expect( res.d ).to.equal(2);
    expect( res.e ).to.equal(0);
  });

  it('eles.closenessCentrality() weighted undirected', function(){
    var res = ccOf({ weight });

    expect( +res.a.toFixed(2) ).to.equal(1.73);
    expect( +res.b.toFixed(2) ).to.equal(1.09);
    expect( +res.c.toFixed(2) ).to.equal(2.01);
    expect( +res.d.toFixed(2) ).to.equal(1.24);
    expect( +res.e.toFixed(2) ).to.equal(1.70);
  });

  it('eles.closenessCentrality() weighted directed', function(){
    var res = ccOf({ weight, directed: true });

    expect( +res.a.toFixed(2) ).to.equal(1.67);
    expect( +res.b.toFixed(2) ).to.equal(0.76);
    expect( +res.c.toFixed(2) ).to.equal(1.67);
    expect( +res.d.toFixed(2) ).to.equal(0.27);
    expect( res.e ).to.equal(0);
  });

  it('eles.closenessCentralityNormalized()', function(){
    var res = cy.elements().closenessCentralityNormalized({});

    expect( res.closeness( c ) ).to.equal( 1 ); // c and e share the max
    expect( res.closeness( e ) ).to.equal( 1 );
    expect( res.closeness( a ) ).to.be.within( 0.7, 0.8 ); // 3.33 / 4.5
  });

  it('eles.betweennessCentrality() unweighted undirected', function(){
    var res = cy.elements().betweennessCentrality();

    expect( res.betweenness(a) ).to.equal(0);
    expect( res.betweenness(b).toFixed(2) ).to.equal('1.67');
    expect( res.betweenness(c).toFixed(2) ).to.equal('5.33');
    expect( res.betweenness(d).toFixed(2) ).to.equal('1.67');
    expect( res.betweenness(e).toFixed(2) ).to.equal('5.33');
  });

  it('eles.betweennessCentrality() unweighted directed', function(){
    var res = cy.elements().betweennessCentrality({ directed: true });

    expect( res.betweenness(a) ).to.equal(0);
    expect( res.betweenness(b) ).to.equal(3);
    expect( res.betweenness(c) ).to.equal(4);
    expect( res.betweenness(d) ).to.equal(0);
    expect( res.betweenness(e) ).to.equal(0);
  });

  it('eles.betweennessCentrality() weighted undirected', function(){
    var res = cy.elements().betweennessCentrality({ weight });

    expect( res.betweenness(a) ).to.equal(1);
    expect( res.betweenness(b) ).to.equal(0);
    expect( res.betweenness(c) ).to.equal(10);
    expect( res.betweenness(d) ).to.equal(0);
    expect( res.betweenness(e) ).to.equal(6);
  });

  it('eles.betweennessCentrality() weighted directed', function(){
    var res = cy.elements().betweennessCentrality({ weight, directed: true });

    expect( res.betweenness(a) ).to.equal(0);
    expect( res.betweenness(b) ).to.equal(3);
    expect( res.betweenness(c) ).to.equal(4);
    expect( res.betweenness(d) ).to.equal(0);
    expect( res.betweenness(e) ).to.equal(0);
  });

  it('eles.betweennessCentrality() unweighted directed: multiple shortest paths', function(){
    cy.remove( cy.$id('ae') );
    cy.remove( cy.$id('bc') );
    cy.remove( cy.$id('cd') );
    cy.remove( cy.$id('ce') );
    cy.add([
      { group: 'edges', data: { id: 'ad', source: 'a', target: 'd' } },
      { group: 'edges', data: { id: 'ec', source: 'e', target: 'c' } }
    ]);

    var res = cy.elements().betweennessCentrality({ directed: true });

    expect( res.betweenness(a) ).to.equal(0);
    expect( res.betweenness(b) ).to.equal(1);
    expect( res.betweenness(c) ).to.equal(2);
    expect( res.betweenness(d) ).to.equal(2);
    expect( res.betweenness(e) ).to.equal(4);
  });

  it('betweennessNormalized divides by the max', function(){
    var res = cy.elements().betweennessCentrality();

    expect( res.betweennessNormalized(c) ).to.equal(1);
    expect( res.betweennessNormalised(e) ).to.equal(1);
    expect( res.betweennessNormalized(a) ).to.equal(0);
  });

  it('aliases resolve', function(){
    expect( cy.elements().dc({ root: a }).degree ).to.equal(2);
    expect( cy.elements().dcn({}).degree( c ) ).to.equal(1);
    expect( cy.elements().cc({ root: b }) ).to.equal(4);
    expect( cy.elements().ccn({}).closeness( c ) ).to.equal(1);
    expect( cy.elements().bc().betweenness( a ) ).to.equal(0);
  });
});

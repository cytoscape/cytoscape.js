var expect = require('chai').expect;
var cytoscape = require('../src', cytoscape);

describe('Collection building and filtering', function(){

  var cy, n1, n2, n3, n1n2, n2n3;

  // test setup
  beforeEach(function(done){
    cytoscape({
      elements: {
        nodes: [
            { data: { id: 'n1', val: 1, sortVal: 2 } },
            { data: { id: 'n2', val: 2, sortVal: 1 } },
            { data: { id: 'n3', val: 3, sortVal: 3 } }
        ],

        edges: [
            { data: { id: 'n1n2', source: 'n1', target: 'n2' } },
            { data: { id: 'n2n3', source: 'n2', target: 'n3' } }
        ]
      },
      ready: function(){
        cy = this;
        n1 = cy.$('#n1')[0];
        n2 = cy.$('#n2')[0];
        n3 = cy.$('#n3')[0];
        n1n2 = cy.$('#n1n2')[0];
        n2n3 = cy.$('#n2n3')[0];

        done();
      }
    });
  });

  it('eles.add()', function(){
    expect( n1.add(n2).length ).to.equal(2);
    expect( n1.add(n2).same( cy.$('#n1, #n2') ) ).to.be.true;
  });

  it('eles.not()', function(){
    expect( cy.$('#n1, #n2').not('#n2').same( n1 ) ).to.be.true;
    expect( cy.$('#n1, #n2').not(n2).same( n1 ) ).to.be.true;
  });

  it('eles.intersect()', function(){
    expect( cy.$('#n1, #n2').intersect(n1).same(n1) ).to.be.true;
  });

  it('eles.intersect() empty case', function(){
    expect( cy.$('#n1, #n2').intersect( cy.collection() ).empty() ).to.be.true;
  });

  it('eles.filter() etc', function(){
    expect( cy.$('#n1, #n2').filter('#n1').same(n1) ).to.be.true;

    expect( cy.$('#n1, #n2').filter(function(){
      return this.id() === 'n1';
    }).same(n1) ).to.be.true;

  });

  it('eles.stdFilter()', function(){
    expect( cy.$('#n1, #n2').stdFilter(function( ele ){
      return ele.id() === 'n1';
    }).same(n1) ).to.be.true;

    expect( cy.$('#n1, #n2').stdFilter(function( ele ){
      return ele.id() === 'n1';
    }).same(n1) ).to.be.true;
  });

  it('eles.sort()', function(){
    var sorted = cy.nodes().sort(function(a, b){
      return a.data('sortVal') - b.data('sortVal');
    });

    expect( sorted.length ).to.equal(3);
    expect( sorted[0].same(n2) ).to.be.true;
    expect( sorted[1].same(n1) ).to.be.true;
    expect( sorted[2].same(n3) ).to.be.true;
  });

  it('eles.map()', function(){
    var ids = [];
    var nodes = cy.nodes();

    for( var i = 0; i < nodes.length; i++ ){
      ids.push( nodes[i].id() );
    }

    var arr = cy.nodes().map(function( ele ){
      return ele.id();
    });

    expect( arr ).to.deep.equal( ids );
  });

  it('eles.max()', function(){
    var max = cy.nodes().max(function( ele ){ return ele.data('val'); });

    expect( max.value ).to.equal( 3 );
    expect( max.ele.same(n3) ).to.be.true;
  });

  it('eles.min()', function(){
    var min = cy.nodes().min(function( ele ){ return ele.data('val'); });

    expect( min.value ).to.equal( 1 );
    expect( min.ele.same(n1) ).to.be.true;
  });

  it('eles.merge()', function(){
    var eles = cy.collection();
    var _p = eles._private;

    // confirm empty
    expect( _p.indexes ).to.be.empty;
    expect( _p.ids ).to.be.empty;
    expect( eles.length ).to.equal(0);
    expect( eles[0] ).to.not.exist;

    eles.merge( n1 );

    // confirm n1 added
    expect( _p.indexes['n1'] ).to.equal(0);
    expect( _p.ids['n1'] ).to.equal(n1);
    expect( eles.length ).to.equal(1);
    expect( eles[0] ).to.equal(n1);
    expect( eles[1] ).to.not.exist;

    eles.merge( n2 );

    // confirm n1 still there
    expect( _p.indexes['n1'] ).to.equal(0);
    expect( _p.ids['n1'] ).to.equal(n1);
    expect( eles[0] ).to.equal(n1);

    // confirm n2 added
    expect( _p.indexes['n2'] ).to.equal(1);
    expect( _p.ids['n2'] ).to.equal(n2);
    expect( eles.length ).to.equal(2);
    expect( eles[1] ).to.equal(n2);
  });

  it('eles.unmerge()', function(){
    var eles = cy.$('#n1, #n2');
    var _p = eles._private;

    // confirm init state of collection
    expect( _p.indexes['n1'] ).to.equal(0);
    expect( _p.indexes['n2'] ).to.equal(1);
    expect( _p.ids['n1'] ).to.equal(n1);
    expect( _p.ids['n2'] ).to.equal(n2);
    expect( eles.length ).to.equal(2);
    expect( eles[2] ).to.not.exist;

    eles.unmerge( n1 );

    // confirm only n2 left
    expect( _p.indexes['n1'] ).to.not.exist;
    expect( _p.indexes['n2'] ).to.equal(0);
    expect( _p.ids['n1'] ).to.not.exist;
    expect( _p.ids['n2'] ).to.equal(n2);
    expect( eles.length ).to.equal(1);
    expect( eles[1] ).to.not.exist;
    expect( eles[2] ).to.not.exist;

    eles.unmerge( n2 );

    // confirm empty
    expect( _p.indexes['n1'] ).to.not.exist;
    expect( _p.indexes['n2'] ).to.not.exist;
    expect( _p.ids['n1'] ).to.not.exist;
    expect( _p.ids['n2'] ).to.not.exist;
    expect( eles.length ).to.equal(0);
    expect( eles[0] ).to.not.exist;
    expect( eles[1] ).to.not.exist;
    expect( eles[2] ).to.not.exist;
  });

  it('eles.unmerge() last ele', function(){
    var eles = cy.$('#n1, #n2');
    var _p = eles._private;

    // confirm init state of collection
    expect( _p.indexes['n1'] ).to.equal(0);
    expect( _p.indexes['n2'] ).to.equal(1);
    expect( _p.ids['n1'] ).to.equal(n1);
    expect( _p.ids['n2'] ).to.equal(n2);
    expect( eles.length ).to.equal(2);
    expect( eles[2] ).to.not.exist;

    eles.unmerge( n2 );

    // confirm only n1 left
    expect( _p.indexes['n2'] ).to.not.exist;
    expect( _p.indexes['n1'] ).to.equal(0);
    expect( _p.ids['n2'] ).to.not.exist;
    expect( _p.ids['n1'] ).to.equal(n1);
    expect( eles.length ).to.equal(1);
    expect( eles[1] ).to.not.exist;
    expect( eles[2] ).to.not.exist;

    eles.unmerge( n1 );

    // confirm empty
    expect( _p.indexes['n1'] ).to.not.exist;
    expect( _p.indexes['n2'] ).to.not.exist;
    expect( _p.ids['n1'] ).to.not.exist;
    expect( _p.ids['n2'] ).to.not.exist;
    expect( eles.length ).to.equal(0);
    expect( eles[0] ).to.not.exist;
    expect( eles[1] ).to.not.exist;
    expect( eles[2] ).to.not.exist;
  });

  it('eles.xor()', function(){
    var a = cy.$('#n1, #n2');
    var b = cy.$('#n2, #n3');
    var xor = a.xor(b);
    var expectedXor = cy.$('#n1, #n3');

    expect( xor.same( expectedXor ) ).to.be.true;
  });

  it('eles.diff()', function(){
    var a = cy.$('#n1, #n2');
    var b = cy.$('#n2, #n3');
    var diff = a.diff(b);
    var exp = {
      left: cy.$('#n1'),
      right: cy.$('#n3'),
      both: cy.$('#n2')
    };

    expect( diff.left.length ).to.equal(1);
    expect( diff.right.length ).to.equal(1);
    expect( diff.both.length ).to.equal(1);

    expect( diff.left.same( exp.left ) ).to.be.true;
    expect( diff.right.same( exp.right ) ).to.be.true;
    expect( diff.both.same( exp.both ) ).to.be.true;
  });

});

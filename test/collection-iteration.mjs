import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/collection: iteration', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  it('reports size and emptiness', function(){
    expect( cy.elements().size() ).to.equal(4);
    expect( cy.elements().empty() ).to.be.false;
    expect( cy.elements().nonempty() ).to.be.true;
    expect( cy.collection().empty() ).to.be.true;
    expect( cy.collection() ).to.have.length(0);
  });

  it('supports numeric indexing where eles[0] is a length-1 collection', function(){
    var nodes = cy.nodes();

    expect( nodes[0] ).to.have.length(1);
    expect( nodes[0].id() ).to.equal('a');
    expect( nodes[0][0] ).to.equal( nodes[0] ); // element is its own first element
  });

  it('interns element handles (same slot ⇒ same object)', function(){
    expect( cy.$id('a')[0] ).to.equal( cy.nodes()[0] );
  });

  it('iterates with forEach in insertion order', function(){
    var ids = [];
    var indexes = [];

    cy.nodes().forEach(function( ele, i, eles ){
      ids.push( ele.id() );
      indexes.push( i );
      expect( eles ).to.have.length(3);
      expect( this ).to.be.undefined; // plain call without thisArg, like v3
    });

    expect( ids ).to.deep.equal(['a', 'b', 'c']);
    expect( indexes ).to.deep.equal([0, 1, 2]);
  });

  it('exits forEach early on false', function(){
    var count = 0;

    cy.nodes().each(function(){
      count++;
      return false;
    });

    expect( count ).to.equal(1);
  });

  it('supports eq/first/last', function(){
    var nodes = cy.nodes();

    expect( nodes.eq(1).id() ).to.equal('b');
    expect( nodes.first().id() ).to.equal('a');
    expect( nodes.last().id() ).to.equal('c');
    expect( nodes.eq(99) ).to.have.length(0);
  });

  it('runs forEach bound to an explicit thisArg', function(){
    var ctx = { tag: 'ctx' };
    var seen = [];

    cy.nodes().forEach(function( ele ){
      seen.push( this.tag );
      expect( this ).to.equal( ctx );
    }, ctx);

    expect( seen ).to.deep.equal(['ctx', 'ctx', 'ctx']);
  });

  it('supports slice', function(){
    var nodes = cy.nodes();

    expect( nodes.slice(1).map( n => n.id() ) ).to.deep.equal(['b', 'c']);
    expect( nodes.slice(0, 2).map( n => n.id() ) ).to.deep.equal(['a', 'b']);
    expect( nodes.slice(-1).map( n => n.id() ) ).to.deep.equal(['c']);
    expect( nodes.slice().map( n => n.id() ) ).to.deep.equal(['a', 'b', 'c']); // no-arg copies
    expect( nodes.slice(1, -1).map( n => n.id() ) ).to.deep.equal(['b']); // negative end
  });

  it('supports toArray', function(){
    var array = cy.nodes().toArray();

    expect( array ).to.be.an('array');
    expect( array ).to.have.length(3);
    expect( array[2].id() ).to.equal('c');
  });

  it('supports map/some/every', function(){
    var nodes = cy.nodes();

    expect( nodes.map( n => n.id() ) ).to.deep.equal(['a', 'b', 'c']);
    expect( nodes.some( n => n.id() === 'b' ) ).to.be.true;
    expect( nodes.some( n => n.id() === 'z' ) ).to.be.false;
    expect( nodes.every( n => n.isNode() ) ).to.be.true;
    expect( cy.elements().every( n => n.isNode() ) ).to.be.false;
  });

  it('dedupes elements in collections', function(){
    var doubled = cy.$id('a').union( cy.$id('a') );

    expect( doubled ).to.have.length(1);
  });

});

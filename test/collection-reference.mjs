import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/collection: core reference & identity', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'e1', source: 'n1', target: 'n2' } }
      ]
    });
  });

  it('instanceString()', function(){
    expect( cy.$id('n1').instanceString() ).to.equal('collection');
  });

  it('cy() returns the owning core', function(){
    expect( cy.$id('n1').cy() ).to.equal( cy );
    expect( cy.elements().cy() ).to.equal( cy );
  });

  it('renderer() is null when headless', function(){
    expect( cy.$id('n1').renderer() ).to.equal( null );
  });

  it('element() returns the first element as a length-1 collection', function(){
    var first = cy.nodes().element();

    expect( first.length ).to.equal( 1 );
    expect( first.isNode() ).to.equal( true );
  });

  it('element() on an empty collection is empty', function(){
    expect( cy.collection().element().length ).to.equal( 0 );
  });

  it('collection() returns an empty collection in the same core', function(){
    var empty = cy.$id('n1').collection();

    expect( empty.length ).to.equal( 0 );
    expect( empty.cy() ).to.equal( cy );
  });

  it('hasElementWithId()', function(){
    expect( cy.nodes().hasElementWithId('n1') ).to.equal( true );
    expect( cy.nodes().hasElementWithId('e1') ).to.equal( false );
    expect( cy.nodes().hasElementWithId('nope') ).to.equal( false );
  });

  it('indexOf()', function(){
    var nodes = cy.nodes();

    expect( nodes.indexOf( cy.$id('n1') ) ).to.equal( 0 );
    expect( nodes.indexOf( cy.$id('n2') ) ).to.equal( 1 );
    expect( nodes.indexOf( cy.$id('e1') ) ).to.equal( -1 );
  });

  // round 34.1: indexOf answers from the same lazily-built packed-key
  // cache the set ops use, which is now a Map from key to first index
  // rather than a Set.  These pin that the two consumers agree in both
  // orders — the cache built by a set op first, and built by indexOf
  // first — since a wrong shared cache would show up as one of the two
  // answering differently.
  it('indexOf() agrees with the membership cache, whichever builds it', function(){
    var a = cy.nodes();
    var b = cy.nodes();

    // (a) membership first, then indexOf off the same cache
    expect( a.contains( cy.$id('n2') ) ).to.equal( true );
    expect( a.indexOf( cy.$id('n2') ) ).to.equal( 1 );

    // (b) indexOf first, then membership
    expect( b.indexOf( cy.$id('n2') ) ).to.equal( 1 );
    expect( b.contains( cy.$id('n2') ) ).to.equal( true );
    expect( b.contains( cy.$id('e1') ) ).to.equal( false );
    expect( b.indexOf( cy.$id('e1') ) ).to.equal( -1 );
  });

  it('indexOf() finds every element of a larger collection', function(){
    var many = cy.add( Array.from( { length: 40 }, function( _, i ){
      return { data: { id: 'ix' + i } };
    } ) );

    // every element reports its own position, and the last one is not
    // found by luck: a stale or partial cache would fail here first
    many.forEach( function( ele, i ){
      expect( many.indexOf( ele ) ).to.equal( i );
    } );

    expect( many.indexOf( many.last() ) ).to.equal( 39 );

    many.remove();
  });

  it('indexOfId()', function(){
    var nodes = cy.nodes();

    expect( nodes.indexOfId('n1') ).to.equal( 0 );
    expect( nodes.indexOfId('n2') ).to.equal( 1 );
    expect( nodes.indexOfId('nope') ).to.equal( -1 );
  });

});

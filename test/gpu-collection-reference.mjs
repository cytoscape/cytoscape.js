import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/collection: core reference & identity', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
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

  it('indexOfId()', function(){
    var nodes = cy.nodes();

    expect( nodes.indexOfId('n1') ).to.equal( 0 );
    expect( nodes.indexOfId('n2') ).to.equal( 1 );
    expect( nodes.indexOfId('nope') ).to.equal( -1 );
  });

});

import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/collection: show / hide / visible / hidden', function(){

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

  it('elements are visible by default', function(){
    expect( cy.$id('n1').visible() ).to.equal( true );
    expect( cy.$id('n1').hidden() ).to.equal( false );
  });

  it('hide() / show() toggle visibility', function(){
    cy.$id('n1').hide();
    expect( cy.$id('n1').visible() ).to.equal( false );
    expect( cy.$id('n1').hidden() ).to.equal( true );

    cy.$id('n1').show();
    expect( cy.$id('n1').visible() ).to.equal( true );
    expect( cy.$id('n1').hidden() ).to.equal( false );
  });

  it('applies across a collection', function(){
    cy.elements().hide();
    expect( cy.elements().every( e => e.hidden() ) ).to.equal( true );

    cy.nodes().show();
    expect( cy.nodes().every( e => e.visible() ) ).to.equal( true );
    expect( cy.$id('e1').hidden() ).to.equal( true );
  });

  it('hidden() is true for an empty/removed element', function(){
    expect( cy.collection().hidden() ).to.equal( true );

    var n = cy.$id('n1');
    n.remove();
    expect( n.hidden() ).to.equal( true );
  });

  it('hiding marks the flags column dirty (renderer picks it up)', function(){
    cy._store.takeDelta(); // clear
    cy.$id('n1').hide();

    var delta = cy._store.takeDelta();
    var flagSpan = delta.spans.find( s => s.column === 'node.flags' );

    expect( flagSpan ).to.not.equal( undefined );
  });

});

import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/selection', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' }, selected: true },
        { data: { id: 'locked' }, selectable: false },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  it('respects the initial selected state', function(){
    expect( cy.$('#c').selected() ).to.be.true;
    expect( cy.$('#a').selected() ).to.be.false;
    expect( cy.$(':selected') ).to.have.length(1);
  });

  it('selects and unselects', function(){
    cy.$('#a').select();

    expect( cy.$('#a').selected() ).to.be.true;

    cy.$('#a').unselect();

    expect( cy.$('#a').selected() ).to.be.false;
  });

  it('selects a whole collection', function(){
    cy.nodes().select();

    expect( cy.$('node:selected') ).to.have.length(3); // locked is not selectable
  });

  it('does not select unselectable elements', function(){
    expect( cy.$('#locked').selectable() ).to.be.false;

    cy.$('#locked').select();

    expect( cy.$('#locked').selected() ).to.be.false;
  });

  it('selects edges', function(){
    cy.$('#ab').select();

    expect( cy.$('edge:selected') ).to.have.length(1);
  });

  it('unselectify() freezes selection state in both directions', function(){
    cy.$('#a').select();
    cy.$('#a').unselectify();

    // an already-selected node cannot be unselected while unselectable
    cy.$('#a').unselect();
    expect( cy.$('#a').selected() ).to.be.true;

    // and an unselected one cannot be selected
    expect( cy.$('#b').selectable() ).to.be.true;
    cy.$('#b').unselectify().select();
    expect( cy.$('#b').selected() ).to.be.false;
  });

  it('selectify() restores mutable selection state', function(){
    cy.$('#a').select();
    cy.$('#a').unselectify();
    cy.$('#a').selectify();

    cy.$('#a').unselect();
    expect( cy.$('#a').selected() ).to.be.false;
  });

  it('emits select and unselect per state change only', function(){
    var selects = 0;
    var unselects = 0;

    cy.on('select', function(){ selects++; });
    cy.on('unselect', function(){ unselects++; });

    cy.$('#a').select();
    cy.$('#a').select(); // no-op

    expect( selects ).to.equal(1);

    cy.$('#a').unselect();
    cy.$('#a').unselect(); // no-op

    expect( unselects ).to.equal(1);
  });

  it('emits select with the element as target', function(){
    var target = null;

    cy.on('select', function( e ){ target = e.target; });
    cy.$('#a').select();

    expect( target.id() ).to.equal('a');
  });

  it('supports element-level select listeners', function(){
    var called = 0;

    cy.$('#a').on('select', function(){ called++; });

    cy.$('#b').select();
    expect( called ).to.equal(0);

    cy.$('#a').select();
    expect( called ).to.equal(1);
  });

});

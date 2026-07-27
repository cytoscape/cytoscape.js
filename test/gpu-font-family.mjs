import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// The global label font: a constant node style prop routed to the store's
// labelFont (one font per glyph atlas); a change marks every labelled node
// label-dirty so the renderer resets the atlas and re-lays-out in one pass.

describe('gpu/style: font-family', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });

    cy._store.takeLabelDirty(); // start clean
  });

  it('defaults to sans-serif', function(){
    expect( cy._store.labelFont ).to.equal('sans-serif');
    expect( cy.$id('a').style('font-family') ).to.equal('sans-serif');
  });

  it('applies a constant font-family (kebab-case and camelCase)', function(){
    cy.style({ nodes: { 'font-family': `'Open Sans', sans-serif` } });

    expect( cy._store.labelFont ).to.equal(`'Open Sans', sans-serif`);
    expect( cy.$id('a').style('font-family') ).to.equal(`'Open Sans', sans-serif`);

    cy.style({ nodes: { fontFamily: 'monospace' } });

    expect( cy._store.labelFont ).to.equal('monospace');
  });

  it('is included in the whole-props style() read', function(){
    cy.style({ nodes: { fontFamily: 'serif' } });

    expect( cy.$id('a').style()['font-family'] ).to.equal('serif');
  });

  it('resets to the default when a new sheet omits it', function(){
    cy.style({ nodes: { fontFamily: 'serif' } });
    cy.style({ nodes: {} });

    expect( cy._store.labelFont ).to.equal('sans-serif');
  });

  it('rejects mappers (one font per atlas)', function(){
    expect(function(){
      cy.style({ nodes: { fontFamily: { data: 'font' } } });
    }).to.throw(/constant only/);
  });

  it('rejects the edges-group form (labels are node-only)', function(){
    expect(function(){
      cy.style({ edges: { fontFamily: 'serif' } });
    }).to.throw(/node style property/);
  });

  it('rejects an empty family', function(){
    expect(function(){
      cy.style({ nodes: { fontFamily: '  ' } });
    }).to.throw(/not a valid font-family/);
  });

  it('marks every labelled node label-dirty on change, and only on change', function(){
    cy.style({ nodes: { label: 'data(id)' } });
    cy._store.takeLabelDirty(); // drain the label writes

    cy.style({ nodes: { label: 'data(id)', fontFamily: 'monospace' } });

    const slots = cy._store.takeLabelDirty().sort();
    const expected = [ 'a', 'b' ].map( id => cy._store.lookup( id ).slot ).sort();

    expect( slots ).to.deep.equal( expected );

    // same font again: nothing to re-lay-out
    cy.style({ nodes: { label: 'data(id)', fontFamily: 'monospace' } });

    expect( cy._store.takeLabelDirty() ).to.deep.equal( [] );
  });

  it('does not dirty unlabelled graphs on change', function(){
    cy.style({ nodes: { fontFamily: 'monospace' } });

    expect( cy._store.takeLabelDirty() ).to.deep.equal( [] );
  });
});

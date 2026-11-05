import { expect } from 'chai';
import cytoscape from '../src/test.mjs';

describe('Layout cose', function(){

  it('excludes edges with an endpoint outside the laid out nodes', function(){
    var cy = cytoscape({
      headless: true,
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'bc', source: 'b', target: 'c' } },
        { data: { id: 'ca', source: 'c', target: 'a' } }
      ]
    });

    var eles = cy.$('#a, #b').union( cy.edges() );
    var layout = eles.layout({ name: 'cose', animate: false });

    expect( layout.options.eles.edges().map(function( e ){ return e.id(); }) ).to.deep.equal([ 'ab' ]);
    expect( layout.options.eles.nodes().length ).to.equal( 2 );
  });

});

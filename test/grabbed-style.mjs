import { expect } from 'chai';
import cytoscape from '../src/test.mjs';
import { setFreed, setGrabbed } from '../src/extensions/renderer/base/grab-state.mjs';

describe('Grabbed style', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
          { data: { id: 'n1' } }
        ]
      },

      style: [
        {
          selector: 'node',
          style: {
            'border-width': 0
          }
        },
        {
          selector: 'node:grabbed',
          style: {
            'border-width': 3
          }
        }
      ]
    });
  });

  afterEach(function(){
    cy.destroy();
  });

  it('reapplies `:grabbed` style each time the node is grabbed', function(){
    var n1 = cy.$('#n1');

    expect( n1.style('border-width') ).to.equal('0px');

    setGrabbed( n1 );
    expect( n1.style('border-width') ).to.equal('3px');

    setFreed( n1 );
    expect( n1.style('border-width') ).to.equal('0px');

    setGrabbed( n1 );
    expect( n1.style('border-width') ).to.equal('3px');
  });
});

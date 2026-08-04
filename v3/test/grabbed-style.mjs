import { expect } from 'chai';
import cytoscape from '../src/test.mjs';
import { setFreed, setGrabbed } from '../src/extensions/renderer/base/grab-state.mjs';

describe('Grabbed style', function(){

  let cy;

  beforeEach(function(){
    cy = cytoscape({
      styleEnabled: true,

      elements: {
        nodes: [
          { data: { id: 'n1' } },
          { data: { id: 'n2' } }
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

  const setGrabbedAll = eles => eles.forEach( setGrabbed );

  const setFreedAll = eles => eles.forEach( setFreed );

  const expectBorderWidth = ( eles, value ) => {
    eles.forEach( ele => expect( ele.style('border-width') ).to.equal( value ) );
  };

  it('reapplies `:grabbed` style each time the node is grabbed', function(){
    const n1 = cy.$('#n1');

    expect( n1.style('border-width') ).to.equal('0px');

    setGrabbed( n1 );
    expect( n1.style('border-width') ).to.equal('3px');

    setFreed( n1 );
    expect( n1.style('border-width') ).to.equal('0px');

    setGrabbed( n1 );
    expect( n1.style('border-width') ).to.equal('3px');
  });

  it('reapplies `:grabbed` style for a selected group when grabbed repeatedly from either node', function(){
    const n1 = cy.$('#n1');
    const n2 = cy.$('#n2');
    const selectedNodes = n1.add( n2 );

    n1.select();
    n2.select();

    expectBorderWidth( selectedNodes, '0px' );

    setGrabbedAll( selectedNodes );
    expectBorderWidth( selectedNodes, '3px' );

    setFreedAll( selectedNodes );
    expectBorderWidth( selectedNodes, '0px' );

    setGrabbedAll( selectedNodes );
    expectBorderWidth( selectedNodes, '3px' );

    setFreedAll( selectedNodes );
    expectBorderWidth( selectedNodes, '0px' );

    setGrabbedAll( n2.add( n1 ) );
    expectBorderWidth( selectedNodes, '3px' );
  });
});

import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

const GRAPH = {
  nodes: [ { data: { id: 'a' } }, { data: { id: 'b' } } ],
  edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ]
};

const arrowColor = ( cy, column ) => {
  const slot = cy._store.lookup( 'ab' ).slot;
  const col = cy._store.column( column );

  return Array.from( col.subarray( slot * 4, slot * 4 + 4 ) );
};

describe('gpu/style: arrows', function(){

  it('defaults to no arrows (alpha 0 in both columns)', function(){
    const cy = cytoscapeGpu( { elements: GRAPH } );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
    expect( arrowColor( cy, 'edge.sourceArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: false } );
  });

  it('triangle shape writes the arrow color; v3-like default #999', function(){
    const cy = cytoscapeGpu( {
      elements: GRAPH,
      style: { edge: { 'target-arrow-shape': 'triangle' } }
    } );

    expect( arrowColor( cy, 'edge.targetArrow' ) ).to.deep.equal( [ 153, 153, 153, 255 ] );
    expect( arrowColor( cy, 'edge.sourceArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: true } );
  });

  it('arrow colors apply per end', function(){
    const cy = cytoscapeGpu( {
      elements: GRAPH,
      style: {
        edge: {
          'source-arrow-shape': 'triangle',
          'source-arrow-color': '#ff0000',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#0000ff'
        }
      }
    } );

    expect( arrowColor( cy, 'edge.sourceArrow' ) ).to.deep.equal( [ 255, 0, 0, 255 ] );
    expect( arrowColor( cy, 'edge.targetArrow' ) ).to.deep.equal( [ 0, 0, 255, 255 ] );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: true, target: true } );
  });

  it('shape none suppresses the arrow even with a color set', function(){
    const cy = cytoscapeGpu( {
      elements: GRAPH,
      style: { edge: { 'target-arrow-shape': 'none', 'target-arrow-color': '#f00' } }
    } );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
  });

  it('a later stylesheet clears previously applied arrows', function(){
    const cy = cytoscapeGpu( {
      elements: GRAPH,
      style: { edge: { 'target-arrow-shape': 'triangle' } }
    } );

    cy.style( {} );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: false } );
  });

  it('rejects unsupported arrow shapes', function(){
    const cy = cytoscapeGpu( { elements: GRAPH } );

    expect( () => cy.style( { edge: { 'target-arrow-shape': 'tee' } } ) )
      .to.throw( /only 'triangle' and 'none'/ );
  });
});

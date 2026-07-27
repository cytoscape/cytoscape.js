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
      style: { edges: { 'target-arrow-shape': 'triangle' } }
    } );

    expect( arrowColor( cy, 'edge.targetArrow' ) ).to.deep.equal( [ 153, 153, 153, 255 ] );
    expect( arrowColor( cy, 'edge.sourceArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: true } );
  });

  it('arrow colors apply per end', function(){
    const cy = cytoscapeGpu( {
      elements: GRAPH,
      style: {
        edges: {
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
      style: { edges: { 'target-arrow-shape': 'none', 'target-arrow-color': '#f00' } }
    } );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
  });

  it('a later stylesheet clears previously applied arrows', function(){
    const cy = cytoscapeGpu( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'triangle' } }
    } );

    cy.style( {} );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: false } );
  });

  it('rejects unsupported arrow shapes', function(){
    const cy = cytoscapeGpu( { elements: GRAPH } );

    expect( () => cy.style( { edges: { 'target-arrow-shape': 'triangle-backcurve' } } ) )
      .to.throw( /unsupported/ );
  });

  it('supports the round-10 arrow shapes with readback', function(){
    const cy = cytoscapeGpu( { elements: GRAPH } );
    const shapes = [ 'vee', 'chevron', 'circle', 'square', 'diamond', 'tee' ];

    for( const shape of shapes ){
      cy.style( { edges: {
        'source-arrow-shape': shape, 'source-arrow-color': '#123',
        'target-arrow-shape': 'triangle', 'target-arrow-color': '#456'
      } } );

      const edge = cy.edges()[0];

      expect( edge.style('source-arrow-shape'), shape ).to.equal( shape );
      expect( edge.style('target-arrow-shape'), shape ).to.equal('triangle');

      const ref = cy._store.lookup( edge.id() );
      const packed = cy._store.column('edge.arrowShapes')[ ref.slot ];

      expect( packed & 0xff, shape ).to.be.above( 1 ); // the shape id
      expect( ( packed >>> 8 ) & 0xff, shape ).to.equal( 1 ); // triangle
    }
  });

  it('a transparent arrow still reads back as shape none', function(){
    const cy = cytoscapeGpu( { elements: GRAPH } );

    cy.style( { edges: { 'target-arrow-shape': 'vee', 'target-arrow-color': 'rgba(0,0,0,0)' } } );

    // stored-truth rule: fully transparent arrows read shape 'none'
    expect( cy.edges()[0].style('target-arrow-shape') ).to.equal('none');
  });
});

import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

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
    const cy = cytoscape( { elements: GRAPH } );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
    expect( arrowColor( cy, 'edge.sourceArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: false } );
  });

  it('triangle shape writes the arrow color; v3-like default #999', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'triangle' } }
    } );

    expect( arrowColor( cy, 'edge.targetArrow' ) ).to.deep.equal( [ 153, 153, 153, 255 ] );
    expect( arrowColor( cy, 'edge.sourceArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: true } );
  });

  it('arrow colors apply per end', function(){
    const cy = cytoscape( {
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
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'none', 'target-arrow-color': '#f00' } }
    } );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
  });

  it('a later stylesheet clears previously applied arrows', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'triangle' } }
    } );

    cy.style( {} );

    expect( arrowColor( cy, 'edge.targetArrow' )[ 3 ] ).to.equal( 0 );
    expect( cy._styleEngine.arrowEnds ).to.deep.equal( { source: false, target: false } );
  });

  it('rejects an unknown arrow-shape keyword', function(){
    const cy = cytoscape( { elements: GRAPH } );

    // 27.6 completed v3's arrow vocabulary, so this used to name
    // 'triangle-backcurve' and now has to name a non-shape
    expect( () => cy.style( { edges: { 'target-arrow-shape': 'fishtail' } } ) )
      .to.throw( /unsupported/ );
  });

  it('supports v3\'s compound arrow shapes (round 27.6)', function(){
    for( const shape of [ 'triangle-tee', 'circle-triangle', 'triangle-cross', 'triangle-backcurve' ] ){
      const cy = cytoscape( {
        elements: GRAPH,
        style: { edges: { 'target-arrow-shape': shape, 'target-arrow-color': '#f00' } }
      } );

      expect( cy.edges()[0].style( 'target-arrow-shape' ), shape ).to.equal( shape );
      cy.destroy();
    }
  });

  it('a hollow compound head falls back to filled (recorded deviation)', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: {
        'target-arrow-shape': 'triangle-tee', 'target-arrow-color': '#f00',
        'target-arrow-fill': 'hollow'
      } }
    } );

    // the stroke abs(sd) is wrong at the seam between a union's parts,
    // and v3 does not stroke compounds either
    expect( cy.edges()[0].style( 'target-arrow-fill' ) ).to.equal( 'filled' );
    cy.destroy();
  });

  it('supports the round-10 arrow shapes with readback', function(){
    const cy = cytoscape( { elements: GRAPH } );
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

      expect( packed & 0xf, shape ).to.be.above( 1 ); // the shape id
      expect( ( packed >>> 4 ) & 0xf, shape ).to.equal( 1 ); // triangle
    }
  });

  it('a transparent arrow still reads back as shape none', function(){
    const cy = cytoscape( { elements: GRAPH } );

    cy.style( { edges: { 'target-arrow-shape': 'vee', 'target-arrow-color': 'rgba(0,0,0,0)' } } );

    // stored-truth rule: fully transparent arrows read shape 'none'
    expect( cy.edges()[0].style('target-arrow-shape') ).to.equal('none');
  });
});

describe('gpu/store: the edge.width arrow-bits mirror (round 56)', function(){

  /** Lane 1 of edge.width, read back as the raw u32 it was written as. */
  const mirrorBits = ( cy, id = 'ab' ) => {
    const slot = cy._store.lookup( id ).slot;
    const width = cy._store.column( 'edge.width' );

    return new Uint32Array( width.buffer )[ slot * 2 + 1 ];
  };

  const shapeWord = ( cy, id = 'ab' ) =>
    cy._store.column( 'edge.arrowShapes' )[ cy._store.lookup( id ).slot ];

  it('mirrors edge.arrowShapes bit-for-bit into lane 1', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'vee', 'source-arrow-shape': 'tee' } }
    } );

    expect( shapeWord( cy ) ).to.not.equal( 0 );
    expect( mirrorBits( cy ) ).to.equal( shapeWord( cy ) );
  });

  it('keeps the mirror in step when the shapes change', function(){
    const cy = cytoscape( { elements: GRAPH } );

    for( const shape of [ 'triangle', 'circle', 'diamond', 'none', 'chevron' ] ){
      cy.style( { edges: { 'target-arrow-shape': shape } } );

      expect( mirrorBits( cy ), shape ).to.equal( shapeWord( cy ) );
    }
  });

  it('is exact across the whole packed word, sign bit included', function(){
    // Every field at once, at an arrow-scale whose quantization sets the
    // top bit — so the mirrored word is a *negative* f32 and, at the low
    // end, a denormal one.  The point is that lane 1 is never read as a
    // number by anything, so none of that matters; the aliased
    // Uint32Array is what makes it independent of the bit layout.
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: {
        'arrow-scale': 8,
        'source-arrow-shape': 'triangle-backcurve', // id 11, the widest
        'target-arrow-shape': 'vee',
        'mid-source-arrow-shape': 'tee',
        'mid-target-arrow-shape': 'circle-triangle',
        'source-arrow-fill': 'hollow',
        'target-arrow-fill': 'hollow'
      } }
    } );

    const word = shapeWord( cy );

    // preconditions: without these the spec would pass on a word of 0
    expect( word >>> 24, 'arrow-scale x16 in the top byte' ).to.equal( 128 );
    expect( word & 0xffff, 'all four shape fields populated' ).to.not.equal( 0 );
    expect( ( word >>> 16 ) & 3, 'both hollow bits' ).to.equal( 3 );

    expect( mirrorBits( cy ) ).to.equal( word );
  });

  it('a width tween leaves the mirror alone', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'triangle', 'width': 3 } }
    } );

    const word = shapeWord( cy );
    cy.edges().animate( { style: { width: 12 }, duration: 400, easing: 'linear' } );

    cy._animations.tick( 1000 );
    cy._animations.tick( 1200 );

    // the precondition: a tween that never moved would prove nothing
    expect( cy.edges()[0].width(), 'mid-flight' ).to.be.closeTo( 7.5, 1e-3 );
    expect( mirrorBits( cy ), 'the tween wrote lane 0 only' ).to.equal( word );

    cy._animations.tick( 1400 );
    expect( cy.edges()[0].width() ).to.equal( 12 );
    expect( mirrorBits( cy ), 'and still after it settles' ).to.equal( word );
  });

  it('survives table growth, which reallocates the column', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'vee' } }
    } );

    const word = shapeWord( cy );

    // push well past the initial capacity so the edge table doubles
    for( let i = 0; i < 600; i++ ){
      cy.add( [
        { group: 'nodes', data: { id: `n${i}` } },
        { group: 'edges', data: { id: `e${i}`, source: 'a', target: `n${i}` } }
      ] );
    }

    expect( mirrorBits( cy ), 'the original edge' ).to.equal( word );
    expect( mirrorBits( cy, 'e599' ) ).to.equal( shapeWord( cy, 'e599' ) );
  });
});

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

describe('gpu/store: the edge.width mirror lane (round 56)', function(){

  /** Lane 1 of edge.width, read back as the raw u32 it was written as. */
  const mirrorBits = ( cy, id = 'ab' ) => {
    const slot = cy._store.lookup( id ).slot;
    const width = cy._store.column( 'edge.width' );

    return new Uint32Array( width.buffer )[ slot * 2 + 1 ];
  };

  const shapeWord = ( cy, id = 'ab' ) =>
    cy._store.column( 'edge.arrowShapes' )[ cy._store.lookup( id ).slot ];

  // the two mirror-only flags (contract.mts): "this end's head does not
  // hide the line under it"
  const SRC_SHOWS = 1 << 18;
  const TGT_SHOWS = 1 << 19;
  const SHOWS = SRC_SHOWS | TGT_SHOWS;

  it('carries the shape word, and nothing else when both heads are opaque', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'vee', 'source-arrow-shape': 'tee' } }
    } );

    expect( shapeWord( cy ) ).to.not.equal( 0 );
    expect( mirrorBits( cy ) ).to.equal( shapeWord( cy ) );
    expect( mirrorBits( cy ) & SHOWS, 'no head shows the line' ).to.equal( 0 );
  });

  it('keeps the word in step when the shapes change', function(){
    const cy = cytoscape( { elements: GRAPH } );

    for( const shape of [ 'triangle', 'circle', 'diamond', 'none', 'chevron' ] ){
      cy.style( { edges: { 'target-arrow-shape': shape } } );

      expect( mirrorBits( cy ) & ~SHOWS, shape ).to.equal( shapeWord( cy ) );
    }
  });

  it('is exact across the whole packed word, sign bit included', function(){
    // Every field at once, at an arrow-scale whose quantization sets the
    // top bit — so the mirrored word is a *negative* f32.  Nothing reads
    // lane 1 as a number, which is the point; the aliased Uint32Array is
    // what makes that independent of the bit layout.
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

    // hollow heads show the line, so both derived flags ride along
    expect( mirrorBits( cy ) ).to.equal( ( word | SHOWS ) >>> 0 );
  });

  describe('the SHOWS_LINE flags', function(){

    const bitsFor = ( edgeStyle ) => {
      const cy = cytoscape( {
        elements: GRAPH,
        style: { edges: {
          'source-arrow-shape': 'triangle', 'target-arrow-shape': 'triangle',
          ...edgeStyle
        } }
      } );

      return mirrorBits( cy ) & SHOWS;
    };

    it('are clear for an opaque filled head', function(){
      expect( bitsFor( {} ) ).to.equal( 0 );
    });

    it('are set per end by arrow-fill: hollow', function(){
      expect( bitsFor( { 'source-arrow-fill': 'hollow' } ) ).to.equal( SRC_SHOWS );
      expect( bitsFor( { 'target-arrow-fill': 'hollow' } ) ).to.equal( TGT_SHOWS );
    });

    it('are set by a translucent head — the case a hollow-only rule missed', function(){
      // v3 hides the line under a translucent head with its erase, not
      // with the head's own fill, so v4 has to shorten the line past the
      // gap here exactly as it does for a hollow one.  This is what took
      // the translucent parity scene from 0.853% to 0 differing pixels.
      expect( bitsFor( { 'source-arrow-color': 'rgba(0,0,0,0.5)' } ) ).to.equal( SRC_SHOWS );
      expect( bitsFor( { 'line-opacity': 0.5 } ), 'folds through line-opacity' ).to.equal( SHOWS );
      expect( bitsFor( { 'opacity': 0.4 } ), 'folds through edge opacity' ).to.equal( SHOWS );
    });

    it('are clear for a head with no arrow at all', function(){
      // alpha 0 is "no head", not "a see-through head": there is nothing
      // to shorten the line for
      expect( bitsFor( {
        'source-arrow-shape': 'none', 'target-arrow-shape': 'none'
      } ) ).to.equal( 0 );
    });

    it('follow a later arrow-colour write without a restyle of the shapes', function(){
      const cy = cytoscape( {
        elements: GRAPH,
        style: { edges: { 'target-arrow-shape': 'triangle' } }
      } );

      expect( mirrorBits( cy ) & TGT_SHOWS ).to.equal( 0 );

      cy.style( { edges: {
        'target-arrow-shape': 'triangle', 'target-arrow-color': 'rgba(1,2,3,0.25)'
      } } );

      expect( mirrorBits( cy ) & TGT_SHOWS ).to.equal( TGT_SHOWS );
    });
  });

  it('a width tween leaves the mirror lane alone', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'triangle', 'width': 3 } }
    } );

    const bits = mirrorBits( cy );

    cy.edges().animate( { style: { width: 12 }, duration: 400, easing: 'linear' } );

    cy._animations.tick( 1000 );
    cy._animations.tick( 1200 );

    // the precondition: a tween that never moved would prove nothing
    expect( cy.edges()[0].width(), 'mid-flight' ).to.be.closeTo( 7.5, 1e-3 );
    expect( mirrorBits( cy ), 'the tween wrote lane 0 only' ).to.equal( bits );

    cy._animations.tick( 1400 );
    expect( cy.edges()[0].width() ).to.equal( 12 );
    expect( mirrorBits( cy ), 'and still after it settles' ).to.equal( bits );
  });

  it('survives table growth, which reallocates the column', function(){
    const cy = cytoscape( {
      elements: GRAPH,
      style: { edges: { 'target-arrow-shape': 'vee', 'target-arrow-fill': 'hollow' } }
    } );

    const bits = mirrorBits( cy );

    expect( bits & TGT_SHOWS, 'the flag is set to begin with' ).to.equal( TGT_SHOWS );

    // push well past the initial capacity so the edge table doubles
    for( let i = 0; i < 600; i++ ){
      cy.add( [
        { group: 'nodes', data: { id: `n${i}` } },
        { group: 'edges', data: { id: `e${i}`, source: 'a', target: `n${i}` } }
      ] );
    }

    expect( mirrorBits( cy ), 'the original edge' ).to.equal( bits );
    expect( mirrorBits( cy, 'e599' ) & ~SHOWS ).to.equal( shapeWord( cy, 'e599' ) );
  });
});

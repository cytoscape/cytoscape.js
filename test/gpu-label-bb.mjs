import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

// round 16.4: labels join boundingBox()/fit() by default — the bb
// options object ({ includeLabels }), the node-label exact term, the
// edge-label conservative term, and the public labelBoundingBox()
// measure.  Headless dims are estimates (recorded), which is exactly
// what these specs exercise.

const mk = ( style, elements ) => cytoscapeGpu( {
  elements: elements ?? [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ],
  style
} );

describe('gpu/collection: label bounding boxes (round 16.4)', function(){

  it('includes the label below the node by default', function(){
    const cy = mk( { nodes: { 'width': 30, 'height': 30, 'label': 'a wide label', 'font-size': 16 } } );
    const withLabel = cy.$id( 'a' ).boundingBox();
    const bare = cy.$id( 'a' ).boundingBox( { includeLabels: false } );

    expect( bare.y2 ).to.equal( 15 );
    expect( bare.w ).to.equal( 30 );
    // the default v4 placement is below the node: the label extends y2
    expect( withLabel.y2 ).to.be.greaterThan( 15 + 16 ); // margin + a text line
    expect( withLabel.w ).to.be.greaterThan( 30 ); // the label is wider than the node
    expect( withLabel.y1 ).to.equal( -15 ); // nothing above
  });

  it('anchors the label term by the alignment grid', function(){
    const cy = mk( { nodes: {
      'width': 30, 'height': 30, 'label': 'label', 'font-size': 16,
      'text-valign': 'top'
    } } );
    const bb = cy.$id( 'a' ).boundingBox();

    expect( bb.y1 ).to.be.lessThan( -15 ); // extends above now
    expect( bb.y2 ).to.equal( 15 );
  });

  it('grows the label term by the text-background padding', function(){
    const plain = mk( { nodes: { 'width': 30, 'height': 30, 'label': 'x', 'font-size': 16 } } );
    const padded = mk( { nodes: {
      'width': 30, 'height': 30, 'label': 'x', 'font-size': 16,
      'text-background-color': '#ff0', 'text-background-opacity': 1,
      'text-background-padding': 6
    } } );

    expect( padded.$id( 'a' ).boundingBox().y2 )
      .to.be.greaterThan( plain.$id( 'a' ).boundingBox().y2 + 5 );
  });

  it('throws on unknown bb option keys', function(){
    const cy = mk( { nodes: { 'label': 'x' } } );

    expect( () => cy.$id( 'a' ).boundingBox( { includeLabls: true } ) ).to.throw( /includeLabls/ );
  });

  it('multiline labels deepen the box', function(){
    const single = mk( { nodes: { 'width': 30, 'height': 30, 'label': 'aa bb cc dd', 'font-size': 16 } } );
    const wrapped = mk( { nodes: {
      'width': 30, 'height': 30, 'label': 'aa bb cc dd', 'font-size': 16,
      'text-wrap': 'wrap', 'text-max-width': 30
    } } );

    expect( wrapped.$id( 'a' ).boundingBox().y2 )
      .to.be.greaterThan( single.$id( 'a' ).boundingBox().y2 + 16 );
  });

  it('includes edge labels conservatively', function(){
    const elements = [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 200, y: 0 } },
      { data: { id: 'ab', source: 'a', target: 'b' } }
    ];
    const cy = mk( { nodes: { 'width': 20, 'height': 20 },
      edges: { 'label': 'edge label', 'font-size': 14 } }, elements );
    const withLabel = cy.elements().boundingBox();
    const bare = cy.elements().boundingBox( { includeLabels: false } );

    // the conservative edge term grows the box; never shrinks it
    expect( withLabel.h ).to.be.greaterThan( bare.h );
    expect( withLabel.x1 ).to.be.at.most( bare.x1 );
  });

  it('drives the whole-graph fit box (the store scan)', function(){
    const cy = mk( { nodes: { 'width': 30, 'height': 30, 'label': 'a rather long label text', 'font-size': 16 } } );
    const withLabels = cy._store.boundingBox();
    const bare = cy._store.boundingBox( false );

    expect( withLabels.w ).to.be.greaterThan( bare.w );
    expect( withLabels.y2 ).to.be.greaterThan( bare.y2 );

    // and fit reads the label-inclusive box by default
    const fv = cy.getFitViewport( undefined, 0 );
    const fvExpected = Math.min( 800 / withLabels.w, 600 / withLabels.h );

    expect( fv.zoom ).to.be.closeTo( fvExpected, 1e-6 );
  });

  it('measures labels exactly via labelBoundingBox()', function(){
    const cy = mk( { nodes: { 'width': 30, 'height': 30, 'label': 'measured', 'font-size': 16 } } );
    const lb = cy.$id( 'a' ).labelBoundingBox();
    const dims = cy._store.labelDimsAt( cy._store.lookup( 'a' ).slot, 'nodes' );

    expect( lb.w ).to.be.closeTo( dims.w, 1e-6 );
    expect( lb.h ).to.be.closeTo( dims.h, 1e-6 );
    expect( lb.y1 ).to.be.greaterThan( 14 ); // below the node (+ margin)

    // unlabelled collections measure empty
    const none = mk( {} ).$id( 'a' ).labelBoundingBox();

    expect( none.w ).to.equal( 0 );
  });

  it('applies the label term at hypothetical positions (boundingBoxAt)', function(){
    const cy = mk( { nodes: { 'width': 30, 'height': 30, 'label': 'a wide label here', 'font-size': 16 } } );
    const at = cy.nodes().boundingBoxAt( { x: 500, y: 500 } );

    expect( at.w ).to.be.greaterThan( 30 ); // the label term came along
    expect( at.x1 ).to.be.lessThan( 500 - 15 );
  });

  it('gates box selection on label containment when opted in (16.5)', function(){
    const elements = [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ];
    const style = { nodes: { 'width': 20, 'height': 20, 'label': 'a very wide label', 'font-size': 16 } };

    // default (v3): labels don't gate containment
    const off = cytoscapeGpu( { elements, style } );

    expect( off.boxSelectionIncludesLabels() ).to.equal( false );
    expect( off.elementsInBox( -12, -12, 12, 40 ).length ).to.equal( 1 );

    // opted in: the label must be contained too
    const on = cytoscapeGpu( { elements, style, boxSelectionIncludesLabels: true } );

    expect( on.boxSelectionIncludesLabels() ).to.equal( true );
    expect( on.elementsInBox( -12, -12, 12, 40 ).length ).to.equal( 0 ); // label pokes out
    expect( on.elementsInBox( -80, -12, 80, 40 ).length ).to.equal( 1 ); // box covers it

    // runtime toggle
    on.boxSelectionIncludesLabels( false );
    expect( on.elementsInBox( -12, -12, 12, 40 ).length ).to.equal( 1 );
  });

  it('honors the option through renderedBoundingBox', function(){
    const cy = mk( { nodes: { 'width': 30, 'height': 30, 'label': 'wide wide wide', 'font-size': 16 } } );

    cy.zoom( 2 );

    const withL = cy.$id( 'a' ).renderedBoundingBox();
    const bare = cy.$id( 'a' ).renderedBoundingBox( { includeLabels: false } );

    expect( withL.w ).to.be.greaterThan( bare.w );
    expect( bare.w ).to.be.closeTo( 60, 1e-6 );
  });

});

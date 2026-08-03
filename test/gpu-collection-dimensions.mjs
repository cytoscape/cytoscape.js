import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/collection: rendered dimensions, shift, endpoints', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'n1' }, position: { x: 100, y: 100 } },
        { data: { id: 'n2' }, position: { x: 300, y: 200 } },
        { data: { id: 'e1', source: 'n1', target: 'n2' } }
      ],
      style: { nodes: { width: 40, height: 20 } },
      zoom: 2,
      pan: { x: 10, y: 5 }
    });
  });

  it('renderedPosition() getter transforms by zoom/pan', function(){
    expect( cy.$id('n1').renderedPosition() ).to.deep.equal({ x: 210, y: 205 });
    expect( cy.$id('n1').renderedPosition('x') ).to.equal( 210 );
  });

  it('renderedPosition() setter maps back to model', function(){
    cy.$id('n1').renderedPosition({ x: 210, y: 405 });

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 100, y: 200 });
  });

  it('renderedPosition() setter for a single dim', function(){
    cy.$id('n1').renderedPosition('y', 205);

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 100, y: 100 });
  });

  it('position({}) sets one dimension, leaving the other unchanged', function(){
    cy.$id('n1').position({ y: 234 });

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 100, y: 234 });
  });

  it('position({}) sets all elements in a collection', function(){
    cy.nodes().position({ x: 50, y: 60 });

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 50, y: 60 });
    expect( cy.$id('n2').position() ).to.deep.equal({ x: 50, y: 60 });
  });

  it('positions(fn) returning false leaves that element unchanged', function(){
    cy.nodes().positions( ele => ele.id() === 'n1' ? { x: 7, y: 8 } : false );

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 7, y: 8 });
    expect( cy.$id('n2').position() ).to.deep.equal({ x: 300, y: 200 }); // unchanged
  });

  it('shift() offsets by a vector', function(){
    cy.$id('n1').shift({ x: 5, y: -10 });

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 105, y: 90 });
  });

  it('shift({}) offsets only the passed dimension', function(){
    cy.$id('n1').shift({ x: 100 });

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 200, y: 100 });
  });

  it('shift() offsets by a single dim', function(){
    cy.$id('n1').shift('x', 50);

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 150, y: 100 });
  });

  it('silentPosition() does not emit position', function(){
    var fired = 0;

    cy.on('position', () => fired++);
    cy.$id('n1').silentPosition({ x: 1, y: 2 });
    expect( fired ).to.equal( 0 );

    cy.$id('n1').position({ x: 3, y: 4 });
    expect( fired ).to.equal( 1 );
  });

  it('renderedWidth/Height/Outer* scale by zoom', function(){
    expect( cy.$id('n1').renderedWidth() ).to.equal( 80 );
    expect( cy.$id('n1').renderedHeight() ).to.equal( 40 );
    expect( cy.$id('n1').renderedOuterWidth() ).to.equal( 80 );
    // 29.2: the sibling this line had always omitted
    expect( cy.$id('n1').renderedOuterHeight() ).to.equal( 40 );
  });

  it('renderedOuterHeight() covers the border, like outerHeight()', function(){
    var bordered = cytoscapeGpu({
      elements: [ { data: { id: 'n' }, position: { x: 0, y: 0 } } ],
      style: { nodes: { width: 40, height: 20, 'border-width': 5 } },
      zoom: 2
    });
    var n = bordered.$id('n');

    // v4 keeps v3's outerHalf convention under the default centred
    // border position: half the band lies outside, so outer = h + width
    expect( n.outerHeight() ).to.equal( 25 );
    expect( n.renderedOuterHeight() ).to.equal( 50 );  // × zoom
    expect( n.renderedOuterHeight() ).to.equal( n.outerHeight() * bordered.zoom() );

    bordered.destroy();
  });

  it('silentPositions() moves every element without emitting position', function(){
    var fired = 0;

    cy.on('position', () => fired++);
    cy.nodes().silentPositions( ( n, i ) => ( { x: i * 10, y: i * 20 } ) );

    expect( fired ).to.equal( 0 );
    expect( cy.$id('n1').position() ).to.deep.equal({ x: 0, y: 0 });
    expect( cy.$id('n2').position() ).to.deep.equal({ x: 10, y: 20 });

    // the loud form is what fires, so the silence above is the method's
    cy.nodes().positions( () => ( { x: 1, y: 1 } ) );
    expect( fired ).to.be.above( 0 );
  });

  it('silentShift() offsets without emitting position', function(){
    var fired = 0;

    cy.on('position', () => fired++);
    cy.$id('n1').silentShift({ x: 5, y: -5 });

    expect( fired ).to.equal( 0 );
    expect( cy.$id('n1').position() ).to.deep.equal({ x: 105, y: 95 });

    cy.$id('n1').shift({ x: 5, y: -5 });

    expect( fired ).to.equal( 1 );
    expect( cy.$id('n1').position() ).to.deep.equal({ x: 110, y: 90 });
  });

  it('silentShift() takes the single-dim form too', function(){
    cy.$id('n1').silentShift( 'x', 50 );

    expect( cy.$id('n1').position() ).to.deep.equal({ x: 150, y: 100 });
  });

  it('renderedBoundingBox() transforms boundingBox', function(){
    var bb = cy.$id('n1').renderedBoundingBox();

    // model bbox of n1 (40x20 at 100,100) is x1=80,y1=90,x2=120,y2=110
    expect( bb.x1 ).to.equal( 80 * 2 + 10 );
    expect( bb.w ).to.equal( 40 * 2 );
  });

  it('midpoint() of an edge', function(){
    expect( cy.$id('e1').midpoint() ).to.deep.equal({ x: 200, y: 150 });
  });

  it('renderedMidpoint() transforms', function(){
    expect( cy.$id('e1').renderedMidpoint() ).to.deep.equal({ x: 410, y: 305 });
  });

  it('sourceEndpoint() / targetEndpoint()', function(){
    expect( cy.$id('e1').sourceEndpoint() ).to.deep.equal({ x: 100, y: 100 });
    expect( cy.$id('e1').targetEndpoint() ).to.deep.equal({ x: 300, y: 200 });
  });

  it('relativePosition() equals position without compounds', function(){
    expect( cy.$id('n1').relativePosition() ).to.deep.equal( cy.$id('n1').position() );
  });

});

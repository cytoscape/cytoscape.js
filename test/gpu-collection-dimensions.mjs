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
      style: [
        { selector: 'node', style: { width: 40, height: 20 } }
      ],
      zoom: 2,
      pan: { x: 10, y: 5 }
    });
  });

  it('renderedPosition() getter transforms by zoom/pan', function(){
    expect( cy.$('#n1').renderedPosition() ).to.deep.equal({ x: 210, y: 205 });
    expect( cy.$('#n1').renderedPosition('x') ).to.equal( 210 );
  });

  it('renderedPosition() setter maps back to model', function(){
    cy.$('#n1').renderedPosition({ x: 210, y: 405 });

    expect( cy.$('#n1').position() ).to.deep.equal({ x: 100, y: 200 });
  });

  it('renderedPosition() setter for a single dim', function(){
    cy.$('#n1').renderedPosition('y', 205);

    expect( cy.$('#n1').position() ).to.deep.equal({ x: 100, y: 100 });
  });

  it('shift() offsets by a vector', function(){
    cy.$('#n1').shift({ x: 5, y: -10 });

    expect( cy.$('#n1').position() ).to.deep.equal({ x: 105, y: 90 });
  });

  it('shift() offsets by a single dim', function(){
    cy.$('#n1').shift('x', 50);

    expect( cy.$('#n1').position() ).to.deep.equal({ x: 150, y: 100 });
  });

  it('silentPosition() does not emit position', function(){
    var fired = 0;

    cy.on('position', () => fired++);
    cy.$('#n1').silentPosition({ x: 1, y: 2 });
    expect( fired ).to.equal( 0 );

    cy.$('#n1').position({ x: 3, y: 4 });
    expect( fired ).to.equal( 1 );
  });

  it('renderedWidth/Height/Outer* scale by zoom', function(){
    expect( cy.$('#n1').renderedWidth() ).to.equal( 80 );
    expect( cy.$('#n1').renderedHeight() ).to.equal( 40 );
    expect( cy.$('#n1').renderedOuterWidth() ).to.equal( 80 );
  });

  it('renderedBoundingBox() transforms boundingBox', function(){
    var bb = cy.$('#n1').renderedBoundingBox();

    // model bbox of n1 (40x20 at 100,100) is x1=80,y1=90,x2=120,y2=110
    expect( bb.x1 ).to.equal( 80 * 2 + 10 );
    expect( bb.w ).to.equal( 40 * 2 );
  });

  it('midpoint() of an edge', function(){
    expect( cy.$('#e1').midpoint() ).to.deep.equal({ x: 200, y: 150 });
  });

  it('renderedMidpoint() transforms', function(){
    expect( cy.$('#e1').renderedMidpoint() ).to.deep.equal({ x: 410, y: 305 });
  });

  it('sourceEndpoint() / targetEndpoint()', function(){
    expect( cy.$('#e1').sourceEndpoint() ).to.deep.equal({ x: 100, y: 100 });
    expect( cy.$('#e1').targetEndpoint() ).to.deep.equal({ x: 300, y: 200 });
  });

  it('relativePosition() equals position without compounds', function(){
    expect( cy.$('#n1').relativePosition() ).to.deep.equal( cy.$('#n1').position() );
  });

});

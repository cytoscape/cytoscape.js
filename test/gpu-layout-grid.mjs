import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/layout: grid', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      headlessWidth: 400,
      headlessHeight: 400,
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  it('only supports the grid layout', function(){
    expect(function(){ cy.layout({ name: 'cose' }); }).to.throw();
    expect(function(){ cy.layout({}); }).to.throw();
    expect(function(){ cy.layout({ name: 'grid' }); }).to.not.throw();
  });

  it('positions nodes on distinct grid cells', function(){
    cy.layout({ name: 'grid', fit: false }).run();

    var keys = cy.nodes().map( n => {
      var pos = n.position();

      return pos.x + ',' + pos.y;
    } );

    expect( new Set(keys).size ).to.equal(4);
  });

  it('respects rows and cols', function(){
    cy.layout({ name: 'grid', rows: 1, cols: 4, fit: false, avoidOverlap: false, boundingBox: { x1: 0, y1: 0, w: 400, h: 100 } }).run();

    var ys = new Set( cy.nodes().map( n => n.position().y ) );
    var xs = cy.nodes().map( n => n.position().x );

    expect( ys.size ).to.equal(1); // single row
    expect( new Set(xs).size ).to.equal(4);
    expect( xs ).to.deep.equal( [50, 150, 250, 350] );
  });

  it('respects the bounding box', function(){
    cy.layout({ name: 'grid', fit: false, boundingBox: { x1: 100, y1: 200, w: 100, h: 100 } }).run();

    cy.nodes().forEach( n => {
      var pos = n.position();

      expect( pos.x ).to.be.within(100, 200);
      expect( pos.y ).to.be.within(200, 300);
    } );
  });

  it('avoids overlap using node dimensions', function(){
    cy.style({ nodes: { width: 100, height: 100 } });
    cy.layout({ name: 'grid', fit: false, rows: 1, cols: 4, boundingBox: { x1: 0, y1: 0, w: 10, h: 10 }, avoidOverlapPadding: 0 }).run();

    var xs = cy.nodes().map( n => n.position().x ).sort( (a, b) => a - b );

    for( var i = 1; i < xs.length; i++ ){
      expect( xs[i] - xs[i - 1] ).to.be.at.least(100);
    }
  });

  it('supports manual position assignment', function(){
    cy.layout({
      name: 'grid',
      fit: false,
      rows: 2,
      cols: 2,
      avoidOverlap: false,
      boundingBox: { x1: 0, y1: 0, w: 200, h: 200 },
      position: function( node ){
        if( node.id() === 'a' ){ return { row: 1, col: 1 }; }
      }
    }).run();

    expect( cy.$id('a').position() ).to.deep.equal({ x: 150, y: 150 });
  });

  it('supports sorting', function(){
    cy.layout({
      name: 'grid',
      fit: false,
      rows: 1,
      avoidOverlap: false,
      boundingBox: { x1: 0, y1: 0, w: 400, h: 100 },
      sort: function( a, b ){ return b.id().localeCompare( a.id() ); } // reverse alphabetical
    }).run();

    var byX = cy.nodes().toArray().sort( (m, n) => m.position().x - n.position().x ).map( n => n.id() );

    expect( byX ).to.deep.equal(['d', 'c', 'b', 'a']);
  });

  it('applies a spacing factor about the layout center', function(){
    cy.layout({ name: 'grid', fit: false, rows: 1, avoidOverlap: false, boundingBox: { x1: 0, y1: 0, w: 400, h: 100 } }).run();

    var before = cy.nodes().map( n => n.position().x );

    cy.layout({ name: 'grid', fit: false, rows: 1, avoidOverlap: false, spacingFactor: 2, boundingBox: { x1: 0, y1: 0, w: 400, h: 100 } }).run();

    var after = cy.nodes().map( n => n.position().x );
    var center = ( before[0] + before[3] ) / 2;

    for( var i = 0; i < 4; i++ ){
      expect( after[i] - center ).to.be.closeTo( ( before[i] - center ) * 2, 1e-6 );
    }
  });

  it('fits the viewport by default', function(){
    var events = [];

    cy.on('fit', function(){ events.push('fit'); });
    cy.layout({ name: 'grid' }).run();

    expect( events ).to.deep.equal(['fit']);
    expect( cy.zoom() ).to.not.equal(1);
  });

  it('emits layout events in order', function(){
    var events = [];

    cy.on('layoutstart layoutready layoutstop', function( e ){
      events.push( e.type );
      expect( e.layout ).to.exist;
    });

    cy.layout({ name: 'grid', fit: false }).run();

    expect( events ).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
  });

  it('writes positions as one coalesced dirty span', function(){
    cy._store.takeDelta(); // clear init dirt

    cy.layout({ name: 'grid', fit: false }).run();

    var spans = cy._store.takeDelta().spans.filter( s => s.column === 'node.position' );

    expect( spans ).to.have.length(1);
  });

  it('slot path matches the handle path position for position', function(){
    var mk = () => cytoscapeGpu({
      headlessWidth: 400,
      headlessHeight: 400,
      elements: [
        { data: { id: 'a' } }, { data: { id: 'b' } }, { data: { id: 'c' } },
        { data: { id: 'd' } }, { data: { id: 'e' } }
      ],
      style: { nodes: ele => ele.id() === 'c' ? { width: 90, height: 70, 'border-width': 4 } : null }
    });

    var bySlot = mk();
    var byHandle = mk();

    bySlot.layout({ name: 'grid', fit: false }).run();
    // a stable no-op sort forces the per-element path with the same node order
    byHandle.layout({ name: 'grid', fit: false, sort: () => 0 }).run();

    for( var id of [ 'a', 'b', 'c', 'd', 'e' ] ){
      expect( bySlot.$id(id).position(), id ).to.deep.equal( byHandle.$id(id).position() );
    }
  });

  it('slot path emits position events per node when listened to', function(){
    var ids = [];

    cy.on('position', function( e ){ ids.push( e.target.id() ); });
    cy.layout({ name: 'grid', fit: false }).run();

    expect( ids.sort() ).to.deep.equal(['a', 'b', 'c', 'd']);
  });

  it('runs via the layout init option', function(){
    var laidOut = cytoscapeGpu({
      headlessWidth: 400,
      headlessHeight: 400,
      elements: [ { data: { id: 'x' } }, { data: { id: 'y' } } ],
      layout: { name: 'grid', fit: false }
    });

    var xPos = laidOut.$id('x').position();
    var yPos = laidOut.$id('y').position();

    expect( xPos ).to.not.deep.equal( yPos );
  });

});

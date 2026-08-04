import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/json', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({
      elements: [
        { data: { id: 'a', weight: 1 }, position: { x: 10, y: 20 } },
        { data: { id: 'b' }, selected: true, locked: true },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ],
      style: { nodes: { width: 40, height: 40 } },
      zoom: 2,
      pan: { x: 5, y: 6 },
      minZoom: 0.5,
      maxZoom: 4,
      autolock: true
    });

    cy.data('title', 'my graph');
  });

  it('exports elements grouped by default', function(){
    var json = cy.json();

    expect( json.elements.nodes ).to.have.length( 2 );
    expect( json.elements.edges ).to.have.length( 1 );

    var a = json.elements.nodes.find( n => n.data.id === 'a' );

    expect( a.position ).to.deep.equal( { x: 10, y: 20 } );
    expect( a.data.weight ).to.equal( 1 );
    expect( a.selected ).to.be.false;
    expect( a.grabbable ).to.be.true;
    expect( a.pannable ).to.be.false;
    expect( a.locked ).to.be.false;

    var b = json.elements.nodes.find( n => n.data.id === 'b' );

    expect( b.selected ).to.be.true;
    expect( b.locked ).to.be.true;

    var ab = json.elements.edges[0];

    expect( ab.data.source ).to.equal( 'a' );
    expect( ab.data.target ).to.equal( 'b' );
    expect( ab.pannable ).to.be.true;
  });

  it('exports elements flat with json(true)', function(){
    var json = cy.json( true );

    expect( json.elements ).to.be.an( 'array' );
    expect( json.elements ).to.have.length( 3 );
  });

  it('exports the stylesheet, viewport and gating flags', function(){
    var json = cy.json();

    expect( json.style ).to.deep.equal( { nodes: { width: 40, height: 40 } } );
    expect( json.zoom ).to.equal( 2 );
    expect( json.pan ).to.deep.equal( { x: 5, y: 6 } );
    expect( json.minZoom ).to.equal( 0.5 );
    expect( json.maxZoom ).to.equal( 4 );
    expect( json.autolock ).to.be.true;
    expect( json.autoungrabify ).to.be.false;
    expect( json.zoomingEnabled ).to.be.true;
    expect( json.boxSelectionEnabled ).to.be.true;
    expect( json.data ).to.deep.equal( { title: 'my graph' } );
    expect( json.headless ).to.be.true;
  });

  it('exports a snapshot: the pan copy does not track later changes', function(){
    var json = cy.json();

    cy.pan( { x: 100, y: 100 } );

    expect( json.pan ).to.deep.equal( { x: 5, y: 6 } );
  });

  it('round-trips through the element definitions form', function(){
    var json = cy.json();
    var cy2 = cytoscape({
      elements: {
        nodes: json.elements.nodes,
        edges: json.elements.edges
      },
      style: json.style
    });

    expect( cy2.nodes() ).to.have.length( 2 );
    expect( cy2.edges() ).to.have.length( 1 );
    expect( cy2.$id('a').position() ).to.deep.equal( { x: 10, y: 20 } );
    expect( cy2.$id('b').selected() ).to.be.true;
    expect( cy2.$id('b').locked() ).to.be.true;
    expect( cy2.$id('a').width() ).to.equal( 40 );
  });

  it('throws on the import form', function(){
    expect( function(){ cy.json({ zoom: 1 }); } ).to.throw( /export-only/ );
  });
});

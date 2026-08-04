import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/layout: preset', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscape({
      headlessWidth: 400,
      headlessHeight: 400,
      elements: [
        { data: { id: 'a' }, position: { x: 1, y: 1 } },
        { data: { id: 'b' }, position: { x: 2, y: 2 } },
        { data: { id: 'c' }, position: { x: 3, y: 3 } },
        { data: { id: 'ab', source: 'a', target: 'b' } }
      ]
    });
  });

  it('is accepted by cy.layout alongside grid', function(){
    expect(function(){ cy.layout({ name: 'preset' }); }).to.not.throw();
    expect(function(){ cy.layout({ name: 'cose' }); }).to.throw(/built-in name/);
  });

  it('applies an id-keyed positions map; absent ids keep their position', function(){
    cy.layout({
      name: 'preset',
      fit: false,
      positions: { a: { x: 10, y: 20 }, c: { x: 30, y: 40 } }
    }).run();

    expect( cy.$id('a').position() ).to.deep.equal({ x: 10, y: 20 });
    expect( cy.$id('b').position() ).to.deep.equal({ x: 2, y: 2 });
    expect( cy.$id('c').position() ).to.deep.equal({ x: 30, y: 40 });
  });

  it('applies a positions function; null keeps the position', function(){
    cy.layout({
      name: 'preset',
      fit: false,
      positions: node => node.id() === 'b' ? { x: 99, y: 98 } : null
    }).run();

    expect( cy.$id('a').position() ).to.deep.equal({ x: 1, y: 1 });
    expect( cy.$id('b').position() ).to.deep.equal({ x: 99, y: 98 });
  });

  it('keeps all positions and fits by default', function(){
    var fits = 0;

    cy.on('fit', function(){ fits++; });
    cy.layout({ name: 'preset' }).run();

    expect( cy.$id('a').position() ).to.deep.equal({ x: 1, y: 1 });
    expect( fits ).to.equal(1);
  });

  it('applies zoom and pan when fit is false', function(){
    cy.layout({ name: 'preset', fit: false, zoom: 3, pan: { x: 7, y: 8 } }).run();

    expect( cy.zoom() ).to.equal(3);
    expect( cy.pan() ).to.deep.equal({ x: 7, y: 8 });
  });

  it('emits layout events in order and position events per moved node', function(){
    var events = [];
    var moved = [];

    cy.on('layoutstart layoutready layoutstop', e => events.push( e.type ));
    cy.on('position', e => moved.push( e.target.id() ));

    cy.layout({ name: 'preset', fit: false, positions: { b: { x: 5, y: 5 } } }).run();

    expect( events ).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
    expect( moved ).to.deep.equal(['b']);
  });

  it('writes the map form as one coalesced dirty span', function(){
    cy._store.takeDelta();

    cy.layout({
      name: 'preset',
      fit: false,
      positions: { a: { x: 10, y: 10 }, c: { x: 11, y: 11 } }
    }).run();

    var spans = cy._store.takeDelta().spans.filter( s => s.column === 'node.position' );

    expect( spans ).to.have.length(1);
  });

  it('runs via the layout init option', function(){
    var laidOut = cytoscape({
      headlessWidth: 400,
      headlessHeight: 400,
      elements: [ { data: { id: 'x' } } ],
      layout: { name: 'preset', fit: false, positions: { x: { x: 42, y: 43 } } }
    });

    expect( laidOut.$id('x').position() ).to.deep.equal({ x: 42, y: 43 });
  });
});

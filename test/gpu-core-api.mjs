import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';

describe('gpu/core: introspection, data, scratch, renderer, aliases', function(){

  var cy;

  beforeEach(function(){
    cy = cytoscapeGpu({
      elements: [
        { data: { id: 'n1' } },
        { data: { id: 'n2' } },
        { data: { id: 'e1', source: 'n1', target: 'n2' } }
      ]
    });
  });

  it('instanceString()', function(){
    expect( cy.instanceString() ).to.equal('core');
  });

  it('isReady() true when headless', function(){
    expect( cy.isReady() ).to.equal( true );
  });

  it('headless() / styleEnabled() / hasCompoundNodes()', function(){
    expect( cy.headless() ).to.equal( true );
    expect( cy.styleEnabled() ).to.equal( true );
    expect( cy.hasCompoundNodes() ).to.equal( false );
  });

  it('hasElementWithId()', function(){
    expect( cy.hasElementWithId('n1') ).to.equal( true );
    expect( cy.hasElementWithId('nope') ).to.equal( false );
  });

  it('$id alias for getElementById', function(){
    expect( cy.$id('n1').id() ).to.equal('n1');
    expect( cy.$id ).to.equal( cy.getElementById );
  });

  it('mutableElements() returns all elements', function(){
    expect( cy.mutableElements().length ).to.equal( 3 );
  });

  it('options() returns the ctor options', function(){
    var opts = { headlessWidth: 123 };
    var cy2 = cytoscapeGpu( opts );

    expect( cy2.options() ).to.equal( opts );
    expect( cy2.options().headlessWidth ).to.equal( 123 );
  });

  it('window() is null in node', function(){
    expect( cy.window() ).to.equal( null );
  });

  it('graph-level data() getter/setter + event', function(){
    var fired = 0;
    cy.on('data', () => fired++);

    cy.data('name', 'G');
    expect( cy.data('name') ).to.equal('G');
    expect( cy.data() ).to.deep.equal({ name: 'G' });
    expect( fired ).to.equal( 1 );

    cy.data({ a: 1, b: 2 });
    expect( cy.data() ).to.deep.equal({ name: 'G', a: 1, b: 2 });
  });

  it('graph-level removeData()', function(){
    cy.data({ a: 1, b: 2 });
    cy.removeData('a');
    expect( cy.data() ).to.deep.equal({ b: 2 });

    cy.removeData();
    expect( cy.data() ).to.deep.equal({});
  });

  it('attr / removeAttr aliases', function(){
    cy.attr('x', 1);
    expect( cy.attr('x') ).to.equal( 1 );
    cy.removeAttr('x');
    expect( cy.attr('x') ).to.equal( undefined );
  });

  it('scratch() does not emit and stores', function(){
    var fired = 0;
    cy.on('data', () => fired++);

    cy.scratch('_k', 5);
    expect( cy.scratch('_k') ).to.equal( 5 );
    expect( fired ).to.equal( 0 );

    cy.removeScratch('_k');
    expect( cy.scratch('_k') ).to.equal( undefined );
  });

  it('renderer() is null when headless; forceRender/resize are no-ops', function(){
    expect( cy.renderer() ).to.equal( null );
    expect( cy.forceRender() ).to.equal( cy );
    expect( cy.resize() ).to.equal( cy );
  });

  it('resize() emits resize', function(){
    var fired = 0;
    cy.on('resize', () => fired++);
    cy.resize();
    expect( fired ).to.equal( 1 );
  });

  it('onRender/offRender register on the render event', function(){
    var fired = 0;
    var cb = () => fired++;

    cy.onRender( cb );
    cy.emit('render');
    expect( fired ).to.equal( 1 );

    cy.offRender( cb );
    cy.emit('render');
    expect( fired ).to.equal( 1 );
  });

  it('event aliases: once, listen/bind, unlisten/unbind, pon', function(){
    var count = 0;
    cy.once('tap', () => count++);
    cy.emit('tap');
    cy.emit('tap');
    expect( count ).to.equal( 1 );

    expect( cy.listen ).to.equal( cy.on );
    expect( cy.bind ).to.equal( cy.on );
    expect( cy.unlisten ).to.equal( cy.off );
    expect( cy.unbind ).to.equal( cy.off );
    expect( typeof cy.pon ).to.equal('function');
  });

  it('makeLayout / createLayout aliases build a layout without running it', function(){
    var layout = cy.makeLayout({ name: 'grid' });

    expect( typeof layout.run ).to.equal('function');
    expect( cy.makeLayout ).to.equal( cy.layout );
    expect( cy.createLayout ).to.equal( cy.layout );
  });

  it('multiClickDebounceTime is a validated getter/setter with a ctor option', function(){
    var cy = cytoscapeGpu({});

    expect( cy.multiClickDebounceTime() ).to.equal( 250 ); // v3's default
    expect( cy.multiClickDebounceTime( 400 ) ).to.equal( cy );
    expect( cy.multiClickDebounceTime() ).to.equal( 400 );
    expect( () => cy.multiClickDebounceTime( -1 ) ).to.throw();

    var cy2 = cytoscapeGpu({ multiClickDebounceTime: 100 });

    expect( cy2.multiClickDebounceTime() ).to.equal( 100 );
  });

});

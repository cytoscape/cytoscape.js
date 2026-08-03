import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { GpuCore } from '../src/gpu/core.mjs';

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

  // round 30.1: the headless/rendered boundary's own guards.  The
  // README's first claim about headless mode is that "the factory
  // throws synchronously when navigator.gpu is missing", and no spec
  // had ever taken that throw — Node is exactly the environment where
  // it fires, since a container is checked before any DOM is touched.
  describe('the headless boundary throws', function(){

    it('the factory rejects a container with no WebGPU present, before doing any work', function(){
      expect( globalThis.navigator?.gpu, 'Node has no WebGPU' ).to.equal( undefined );

      expect( () => cytoscapeGpu({ container: {} }) )
        .to.throw( /WebGPU is required to render.*omit the container option to run headless/s );

      // *Before* any work is the discriminating half.  The renderer
      // attach path carries its own copy of this guard, so a spec that
      // only asserts "constructing with a container throws" passes with
      // the factory's own check deleted — measured, and it is why this
      // spec feeds a payload that would itself throw during ingest:
      // the container problem has to be the one reported.
      const badEdge = [ { group: 'edges', data: { id: 'e' } } ];

      expect( () => cytoscapeGpu({ container: {}, elements: badEdge }) )
        .to.throw( /WebGPU is required to render/ );

      // control: with no container the same payload reaches ingest
      expect( () => cytoscapeGpu({ elements: badEdge }) )
        .to.throw( /without a source and target/ );

      // control: the same options without a container construct headless
      expect( cytoscapeGpu({}).headless() ).to.equal( true );
    });

    it('mount() needs a container', function(){
      expect( () => cy.mount() ).to.throw( /mount\(\) needs a container element/ );
      expect( () => cy.mount( null ) ).to.throw( /mount\(\) needs a container element/ );
    });

    it('mount() refuses on a core built without the factory', function(){
      // the factory installs _attachFn; `new GpuCore()` has no renderer
      // attach path at all, and the guard says so instead of failing
      // later with a null dereference
      expect( () => new GpuCore({}).mount( {} ) )
        .to.throw( /cannot mount \(it was not created via the cytoscapeGpu factory\)/ );
    });

    it('mount() on a container reaches the same WebGPU guard', function(){
      // the factory guard fires at construction; this is the re-attach
      // path's copy of it, which is what cy.mount() after unmount() hits
      expect( () => cy.mount( {} ) ).to.throw( /WebGPU is required to render/ );
    });

  });

});

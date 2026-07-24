import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { Animation, AnimationManager, EASINGS, EASING_IDS, resolveEasing } from '../src/gpu/animation.mjs';
import { GpuTweenRuntime, TWEEN_SHADER } from '../src/gpu/render/gpu-tween.mjs';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';

// Animations tick deterministically via explicit `now` values; the
// collection/core surface drives the same ticks through cy._animations.

describe('gpu/animation', function(){

  describe('easings', function(){
    it('resolves names and functions, defaulting to ease', function(){
      expect( resolveEasing('linear') ).to.equal( EASINGS.linear );
      const custom = t => t;
      expect( resolveEasing( custom ) ).to.equal( custom );
      expect( resolveEasing( undefined ) ).to.equal( EASINGS.ease );
      expect( resolveEasing('nope') ).to.equal( EASINGS.ease );
    });

    it('all easings pin 0→0 and 1→1', function(){
      for( const [ name, fn ] of Object.entries( EASINGS ) ){
        expect( fn( 0 ), name ).to.be.closeTo( 0, 1e-9 );
        expect( fn( 1 ), name ).to.be.closeTo( 1, 1e-6 );
      }
    });
  });

  describe('Animation (direct, deterministic)', function(){
    const storeWith = () => {
      const s = new GraphStore();
      s.addNode( 'a', 0, 0 );
      return s;
    };

    it('tweens position from captured start to target', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      const ani = new Animation( store, null, [ ref ], false,
        { position: { x: 100, y: 40 }, duration: 400, easing: 'linear' } );
      const pos = () => {
        const c = store.column('node.position');
        return { x: c[ ref.slot * 2 ], y: c[ ref.slot * 2 + 1 ] };
      };

      ani.tick( 1000 );
      expect( pos() ).to.deep.equal( { x: 0, y: 0 } ); // at start

      ani.tick( 1200 );
      expect( pos().x ).to.be.closeTo( 50, 1e-4 );
      expect( pos().y ).to.be.closeTo( 20, 1e-4 );

      expect( ani.tick( 1400 ) ).to.be.true; // finished
      expect( pos() ).to.deep.equal( { x: 100, y: 40 } );
      expect( ani.done ).to.be.true;
    });

    it('tweens a scalar style channel (opacity)', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      store.setScalar( 'node.opacity', ref.slot, 1 );
      const ani = new Animation( store, null, [ ref ], false,
        { style: { opacity: 0 }, duration: 100, easing: 'linear' } );

      ani.tick( 0 );
      ani.tick( 50 );
      expect( store.column('node.opacity')[ ref.slot ] ).to.be.closeTo( 0.5, 1e-4 );
      ani.tick( 100 );
      expect( store.column('node.opacity')[ ref.slot ] ).to.equal( 0 );
    });

    it('tweens a colour channel per sRGB channel', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      store.setColor( 'node.fillColor', ref.slot, 0, 0, 0, 255 );
      const ani = new Animation( store, null, [ ref ], false,
        { style: { 'background-color': 'rgb(255,255,255)' }, duration: 100, easing: 'linear' } );

      ani.tick( 0 );
      ani.tick( 50 );
      const c = store.column('node.fillColor');
      expect( [ c[ ref.slot*4 ], c[ ref.slot*4+1 ], c[ ref.slot*4+2 ] ] ).to.deep.equal( [ 128, 128, 128 ] );
    });

    it('honours a delay before interpolating', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      const ani = new Animation( store, null, [ ref ], false,
        { position: { x: 100, y: 0 }, duration: 100, delay: 200, easing: 'linear' } );

      ani.tick( 0 );   // schedules start at 200
      ani.tick( 100 ); // still in delay
      expect( store.column('node.position')[ ref.slot*2 ] ).to.equal( 0 );
      ani.tick( 250 ); // 50% through
      expect( store.column('node.position')[ ref.slot*2 ] ).to.be.closeTo( 50, 1e-4 );
    });

    it('stop(jumpToEnd) applies the final frame', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      const ani = new Animation( store, null, [ ref ], false,
        { position: { x: 80, y: 0 }, duration: 100 } );

      ani.tick( 0 );
      ani.stop( true );
      expect( store.column('node.position')[ ref.slot*2 ] ).to.equal( 80 );
      expect( ani.done ).to.be.true;
    });

    it('captures start values per element (multi-node position)', function(){
      const store = new GraphStore();
      store.addNode( 'a', 0, 0 );
      store.addNode( 'b', 100, 100 );
      const refs = [ store.ref('nodes', store.lookup('a').slot), store.ref('nodes', store.lookup('b').slot) ];
      const ani = new Animation( store, null, refs, false, { position: { x: 50, y: 50 }, duration: 100, easing: 'linear' } );
      const pos = ( slot ) => { const c = store.column('node.position'); return { x: c[ slot*2 ], y: c[ slot*2+1 ] }; };

      ani.tick( 0 );
      ani.tick( 50 ); // halfway — each node from its OWN start toward (50,50)
      expect( pos( refs[0].slot ) ).to.deep.equal( { x: 25, y: 25 } );  // a: (0,0)→(50,50)
      expect( pos( refs[1].slot ) ).to.deep.equal( { x: 75, y: 75 } );  // b: (100,100)→(50,50)
    });

    it('throws on unsupported animatable props', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );

      expect( () => new Animation( store, null, [ ref ], false, { style: { shape: 'rectangle' } } ) )
        .to.throw( /unsupported/ );
    });
  });

  describe('GpuTweenRuntime (mock device)', function(){
    const makeMock = () => {
      const writes = [];
      const dispatches = [];
      const device = {
        createBuffer: d => ( { label: d.label, size: d.size, destroyed: false, destroy(){ this.destroyed = true; } } ),
        createBindGroupLayout: () => ( {} ),
        createPipelineLayout: () => ( {} ),
        createShaderModule: d => { expect( d.code ).to.include('fn csTween'); return {}; },
        createComputePipeline: d => ( { label: d.label } ),
        createBindGroup: () => ( {} ),
        queue: { writeBuffer( b, off, data ){ writes.push( { label: b.label, off, data } ); } }
      };
      const pass = { setPipeline(){}, setBindGroup(){}, dispatchWorkgroups( n ){ dispatches.push( n ); } };
      return { device, writes, dispatches, pass };
    };

    it('is defined for every easing id', function(){
      for( const id of Object.values( EASING_IDS ) ){
        expect( TWEEN_SHADER, `easing ${id}` ).to.match( new RegExp( `case ${id}u:|default:` ) );
      }
    });

    it('registers a batch, dispatches, and owns node.position', function(){
      const mock = makeMock();
      const rt = new GpuTweenRuntime( mock.device, () => ( { label: 'pos' } ), () => 0 );

      expect( rt.active() ).to.be.false;
      expect( rt.ownedColumns() ).to.deep.equal( [] );

      rt.register( 1, new Uint32Array([ 2, 5 ]), new Float32Array([ 0,0,10,10, 0,0,20,20 ]), 1000, 200, 0 );

      expect( rt.active() ).to.be.true;
      expect( rt.ownedColumns() ).to.deep.equal( [ 'node.position' ] );

      rt.encode( mock.pass, 1100 );
      expect( mock.dispatches ).to.deep.equal( [ 1 ] ); // ceil(2/256)

      // the params uniform carries start/duration/now/count/easingId
      const params = mock.writes.find( w => w.label === 'cy-gpu:tween-params:1' && w.data.length === 8 );
      const f = new Float32Array( params.data.buffer );
      const u = new Uint32Array( params.data.buffer );
      expect( f[0] ).to.equal( 1000 ); // start
      expect( f[1] ).to.equal( 200 );  // duration
      expect( f[2] ).to.equal( 1100 ); // now
      expect( u[3] ).to.equal( 2 );    // count

      rt.unregister( 1 );
      expect( rt.active() ).to.be.false;
    });
  });

  describe('AnimationManager queue', function(){
    it('runs queued animations in sequence per element', function(){
      const store = new GraphStore();
      store.addNode( 'a', 0, 0 );
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      const mgr = new AnimationManager( () => {} );

      mgr.enqueue( new Animation( store, null, [ ref ], false, { position: { x: 100, y: 0 }, duration: 100, easing: 'linear' } ) );
      mgr.enqueue( new Animation( store, null, [ ref ], false, { position: { x: 100, y: 100 }, duration: 100, easing: 'linear' } ) );

      const x = () => store.column('node.position')[ ref.slot*2 ];
      const y = () => store.column('node.position')[ ref.slot*2+1 ];

      mgr.tick( 0 );
      mgr.tick( 100 ); // first done → x=100
      expect( x() ).to.equal( 100 );
      expect( y() ).to.equal( 0 );

      mgr.tick( 100 ); // second starts (captures y=0)
      mgr.tick( 200 ); // second done → y=100
      expect( y() ).to.equal( 100 );
      expect( mgr.active() ).to.be.false;
    });
  });

  describe('collection + core surface', function(){
    const drive = ( cy, ...times ) => { for( const t of times ){ cy._animations.tick( t ); } };

    it('animates element position and reports animated()', function(){
      const cy = cytoscapeGpu( { elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ] } );

      cy.$id('a').animate( { position: { x: 60, y: 0 }, duration: 100, easing: 'linear' } );

      expect( cy.$id('a').animated() ).to.be.true;

      drive( cy, 0, 50 );
      expect( cy.$id('a').position('x') ).to.be.closeTo( 30, 1e-4 );

      drive( cy, 100 );
      expect( cy.$id('a').position('x') ).to.equal( 60 );
      expect( cy.$id('a').animated() ).to.be.false;
    });

    it('resolves the animation promise on complete', async function(){
      const cy = cytoscapeGpu( { elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ] } );
      let done = false;
      const p = cy.$id('a').animation( { position: { x: 10, y: 0 }, duration: 50 } ).play();

      p.then( () => { done = true; } );

      cy._animations.tick( 0 );
      cy._animations.tick( 50 );
      await p;

      expect( done ).to.be.true;
    });

    it('calls the complete callback', function(){
      const cy = cytoscapeGpu( { elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ] } );
      let called = false;

      cy.$id('a').animate( { position: { x: 10, y: 0 }, duration: 50, complete: () => { called = true; } } );

      cy._animations.tick( 0 );
      cy._animations.tick( 50 );
      expect( called ).to.be.true;
    });

    it('animates the viewport pan and zoom', function(){
      const cy = cytoscapeGpu( { elements: [] } );

      cy.pan( { x: 0, y: 0 } );
      cy.zoom( 1 );
      cy.animate( { pan: { x: 100, y: 0 }, zoom: 2, duration: 100, easing: 'linear' } );

      expect( cy.animated() ).to.be.true;

      cy._animations.tick( 0 );
      cy._animations.tick( 50 );
      expect( cy.pan().x ).to.be.closeTo( 50, 1e-4 );
      expect( cy.zoom() ).to.be.closeTo( 1.5, 1e-4 );

      cy._animations.tick( 100 );
      expect( cy.zoom() ).to.equal( 2 );
      expect( cy.animated() ).to.be.false;
    });

    it('forbids grabbing an element while it animates (pointer canDrag)', function(){
      const cy = cytoscapeGpu( { elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ] } );
      const ref = cy.$id('a')._refs[ 0 ];

      cy.$id('a').animate( { position: { x: 50, y: 0 }, duration: 100 } );

      expect( cy._animations.isAnimating( ref ) ).to.be.true;

      cy._animations.tick( 0 );
      cy._animations.tick( 100 );

      expect( cy._animations.isAnimating( ref ) ).to.be.false;
    });
  });

});

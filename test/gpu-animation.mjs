import { expect } from 'chai';
import cytoscapeGpu from '../src/gpu/index.mjs';
import { Animation, AnimationManager, EASINGS, EASING_IDS, resolveEasing } from '../src/gpu/animation.mjs';
import { GpuTweenRuntime, TWEEN_SHADERS } from '../src/gpu/render/gpu-tween.mjs';
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

    it('tweens a colour channel in OKLab, not sRGB', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      store.setColor( 'node.fillColor', ref.slot, 0, 0, 0, 255 );
      const ani = new Animation( store, null, [ ref ], false,
        { style: { 'background-color': 'rgb(255,255,255)' }, duration: 100, easing: 'linear' } );

      ani.tick( 0 );
      ani.tick( 50 );
      const c = store.column('node.fillColor');

      // the sRGB midpoint would be 128; OKLab L=0.5 lands darker
      expect( [ c[ ref.slot*4 ], c[ ref.slot*4+1 ], c[ ref.slot*4+2 ] ] ).to.deep.equal( [ 99, 99, 99 ] );

      ani.tick( 100 );
      expect( Array.from( c.subarray( ref.slot*4, ref.slot*4+4 ) ) ).to.deep.equal( [ 255, 255, 255, 255 ] );
    });

    it('interpolates hues through OKLab (blue→yellow stays colourful)', function(){
      const store = storeWith();
      const ref = store.ref( 'nodes', store.lookup('a').slot );
      store.setColor( 'node.fillColor', ref.slot, 0, 0, 255, 255 );
      const ani = new Animation( store, null, [ ref ], false,
        { style: { 'background-color': 'rgb(255,255,0)' }, duration: 100, easing: 'linear' } );

      ani.tick( 0 );
      ani.tick( 50 );
      const c = store.column('node.fillColor');

      // sRGB would pass through (128,128,128); OKLab keeps chroma
      expect( Array.from( c.subarray( ref.slot*4, ref.slot*4+3 ) ) ).to.deep.equal( [ 108, 171, 199 ] );
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

    const write = ( column, kind, slots, data ) => ( {
      column, kind, paint: kind !== 'position',
      refs: slots.map( slot => ( { group: 'nodes', slot, gen: 0 } ) ),
      slots: new Uint32Array( slots ),
      data: new Float32Array( data )
    } );

    it('every easing id is defined in every kernel', function(){
      for( const [ kind, code ] of Object.entries( TWEEN_SHADERS ) ){
        for( const id of Object.values( EASING_IDS ) ){
          expect( code, `${kind} easing ${id}` ).to.match( new RegExp( `case ${id}u:|default:` ) );
        }
      }
    });

    it('the colour kernel converts out of OKLab (shared with the mapper kernel)', function(){
      expect( TWEEN_SHADERS.color ).to.include('oklabToSrgbNorm');
      expect( TWEEN_SHADERS.position ).to.not.include('oklabToSrgbNorm');
    });

    it('every kernel counts from arrayLength, not the shared params uniform', function(){
      // a batch's channels share one params buffer, and writeBuffer isn't
      // ordered against dispatches within a pass
      for( const [ kind, code ] of Object.entries( TWEEN_SHADERS ) ){
        expect( code, kind ).to.include('arrayLength(&slots)');
        expect( code, kind ).to.not.include('params.count');
      }
    });

    it('registers a batch, dispatches, and owns node.position', function(){
      const mock = makeMock();
      const rt = new GpuTweenRuntime( mock.device, id => ( { label: id } ), () => 0 );

      expect( rt.active() ).to.be.false;
      expect( rt.ownedColumns() ).to.deep.equal( [] );

      rt.register( 1, [ write( 'node.position', 'position', [ 2, 5 ], [ 0,0,10,10, 0,0,20,20 ] ) ], 1000, 200, 0 );

      expect( rt.active() ).to.be.true;
      expect( rt.hasPositions() ).to.be.true;
      expect( rt.ownedColumns() ).to.deep.equal( [ 'node.position' ] );

      rt.encode( mock.pass, 1100, 'position' );
      expect( mock.dispatches ).to.deep.equal( [ 1 ] ); // ceil(2/256)

      // the params uniform carries start/duration/now/easingId
      const params = mock.writes.find( w => w.label === 'cy-gpu:tween-params:1' && w.data.length === 4 );
      const f = new Float32Array( params.data.buffer );
      const u = new Uint32Array( params.data.buffer );
      expect( f[0] ).to.equal( 1000 ); // start
      expect( f[1] ).to.equal( 200 );  // duration
      expect( f[2] ).to.equal( 1100 ); // now
      expect( u[3] ).to.equal( 0 );    // easingId (linear)

      rt.unregister( 1 );
      expect( rt.active() ).to.be.false;
    });

    it('owns every tweened column and dispatches per channel', function(){
      const mock = makeMock();
      const rt = new GpuTweenRuntime( mock.device, id => ( { label: id } ), () => 0 );

      rt.register( 1, [
        write( 'node.position', 'position', [ 1 ], [ 0,0,10,10 ] ),
        write( 'node.opacity', 'scalar', [ 1 ], [ 1, 0 ] ),
        write( 'node.fillColor', 'color', [ 1 ], [ 0,0,0,1, 1,0,0,1 ] )
      ], 0, 100, 1 );

      expect( rt.ownedColumns() ).to.have.members(
        [ 'node.position', 'node.opacity', 'node.fillColor' ] );

      // position rides the pre-cull pass; the two paint channels the cull pass
      rt.encode( mock.pass, 50, 'position' );
      expect( mock.dispatches ).to.have.length( 1 );

      rt.encode( mock.pass, 50, 'paint' );
      expect( mock.dispatches ).to.have.length( 3 );

      rt.unregister( 1 );
      expect( rt.ownedColumns() ).to.deep.equal( [] );
    });

    it('a paint-only batch needs no pre-cull pass', function(){
      const mock = makeMock();
      const rt = new GpuTweenRuntime( mock.device, id => ( { label: id } ), () => 0 );

      rt.register( 1, [ write( 'edge.lineColor', 'color', [ 3 ], [ 0,0,0,1, 1,0,0,1 ] ) ], 0, 100, 1 );

      expect( rt.active() ).to.be.true;
      expect( rt.hasPositions() ).to.be.false;

      rt.encode( mock.pass, 50, 'position' );
      expect( mock.dispatches ).to.deep.equal( [] );
    });

    it('rebuilds bind groups when the mirror reallocates', function(){
      const mock = makeMock();
      let version = 0;
      let binds = 0;
      const device = { ...mock.device, createBindGroup: () => { binds++; return {}; } };
      const rt = new GpuTweenRuntime( device, id => ( { label: id } ), () => version );

      rt.register( 1, [ write( 'node.opacity', 'scalar', [ 1 ], [ 1, 0 ] ) ], 0, 100, 0 );

      rt.encode( mock.pass, 10, 'paint' );
      rt.encode( mock.pass, 20, 'paint' );
      expect( binds ).to.equal( 1 ); // cached

      version = 1;
      rt.encode( mock.pass, 30, 'paint' );
      expect( binds ).to.equal( 2 );
    });

    it('destroys a batch\'s buffers on unregister', function(){
      const created = [];
      const mock = makeMock();
      const device = { ...mock.device,
        createBuffer: d => { const b = { label: d.label, destroyed: false, destroy(){ this.destroyed = true; } }; created.push( b ); return b; } };
      const rt = new GpuTweenRuntime( device, id => ( { label: id } ), () => 0 );

      rt.register( 1, [
        write( 'node.opacity', 'scalar', [ 1 ], [ 1, 0 ] ),
        write( 'node.fillColor', 'color', [ 1 ], [ 0,0,0,1, 1,0,0,1 ] )
      ], 0, 100, 0 );

      expect( created ).to.have.length( 5 ); // 2 slot + 2 data + 1 params
      rt.unregister( 1 );
      expect( created.every( b => b.destroyed ) ).to.be.true;
    });
  });

  describe('GPU eligibility (paint vs geometry tiers)', function(){
    const store = () => { const s = new GraphStore(); s.addNode( 'a', 0, 0 ); return s; };
    const ani = ( opts, isViewport = false ) => {
      const s = store();
      const refs = isViewport ? [] : [ s.ref( 'nodes', s.lookup('a').slot ) ];

      return new Animation( s, null, refs, isViewport, opts );
    };

    it('offloads position and paint channels', function(){
      expect( ani( { position: { x: 1, y: 1 } } ).gpuEligible ).to.be.true;
      expect( ani( { style: { opacity: 0 } } ).gpuEligible ).to.be.true;
      expect( ani( { style: { 'background-color': 'red' } } ).gpuEligible ).to.be.true;
      expect( ani( { style: { 'border-color': 'red', opacity: 0.5 }, position: { x: 1, y: 1 } } ).gpuEligible ).to.be.true;
    });

    it('keeps geometry channels on the CPU — cull, CPU pick and the columnar scans read them', function(){
      expect( ani( { style: { 'border-width': 4 } } ).gpuEligible ).to.be.false;
    });

    it('is all-or-nothing: one geometry channel grounds the whole animation', function(){
      expect( ani( { style: { opacity: 0, 'border-width': 4 }, position: { x: 1, y: 1 } } ).gpuEligible ).to.be.false;
    });

    it('never offloads the viewport, a custom easing function, or a bare delay', function(){
      expect( ani( { pan: { x: 10, y: 0 } }, true ).gpuEligible ).to.be.false;
      expect( ani( { position: { x: 1, y: 1 }, easing: t => t } ).gpuEligible ).to.be.false;
      expect( ani( { duration: 100 } ).gpuEligible ).to.be.false;
    });
  });

  describe('opacity resolves per group', function(){
    const GRAPH = {
      nodes: [ { data: { id: 'a' } }, { data: { id: 'b' } } ],
      edges: [ { data: { id: 'ab', source: 'a', target: 'b' } } ]
    };
    const drive = ( cy, ...times ) => { for( const t of times ){ cy._animations.tick( t ); } };

    it('animates edge opacity (a node-only channel map made this a no-op)', function(){
      const cy = cytoscapeGpu( { elements: GRAPH } );
      const slot = cy._store.lookup('ab').slot;

      cy.$id('ab').animate( { style: { opacity: 0 }, duration: 100, easing: 'linear' } );

      drive( cy, 0, 50 );
      expect( cy._store.column('edge.opacity')[ slot ] ).to.be.closeTo( 0.5, 1e-4 );

      drive( cy, 100 );
      expect( cy._store.column('edge.opacity')[ slot ] ).to.equal( 0 );
    });

    it('splits one animation across both groups', function(){
      const cy = cytoscapeGpu( { elements: GRAPH } );
      const node = cy._store.lookup('a').slot;
      const edge = cy._store.lookup('ab').slot;

      cy.elements().animate( { style: { opacity: 0 }, duration: 100, easing: 'linear' } );

      drive( cy, 0, 100 );
      expect( cy._store.column('node.opacity')[ node ] ).to.equal( 0 );
      expect( cy._store.column('edge.opacity')[ edge ] ).to.equal( 0 );
    });

    it('carries the arrows: their pre-folded alpha follows the tween', function(){
      const cy = cytoscapeGpu( {
        elements: GRAPH,
        style: { edges: { 'target-arrow-shape': 'triangle', 'target-arrow-color': 'rgb(10,20,30)' } }
      } );
      const slot = cy._store.lookup('ab').slot;
      const arrow = () => Array.from( cy._store.column('edge.targetArrow').subarray( slot * 4, slot * 4 + 4 ) );

      expect( arrow() ).to.deep.equal( [ 10, 20, 30, 255 ] );

      cy.$id('ab').animate( { style: { opacity: 0 }, duration: 100, easing: 'linear' } );

      drive( cy, 0, 50 );
      expect( arrow()[ 3 ] ).to.be.closeTo( 128, 1 );

      drive( cy, 100 );
      expect( arrow() ).to.deep.equal( [ 10, 20, 30, 0 ] );
    });

    it('fades arrows back in from a fully transparent start', function(){
      // the stored alpha is 0, so the base can only come from the sheet —
      // a stored-bytes derivation would leave the arrow invisible
      const cy = cytoscapeGpu( {
        elements: GRAPH,
        style: { edges: { opacity: 0, 'target-arrow-shape': 'triangle', 'target-arrow-color': 'rgb(10,20,30)' } }
      } );
      const slot = cy._store.lookup('ab').slot;
      const alpha = () => cy._store.column('edge.targetArrow')[ slot * 4 + 3 ];

      expect( alpha() ).to.equal( 0 );

      cy.$id('ab').animate( { style: { opacity: 1 }, duration: 100, easing: 'linear' } );

      drive( cy, 0, 100 );
      expect( alpha() ).to.equal( 255 );
    });

    it('leaves the arrows alone when the sheet enables no arrowheads', function(){
      const cy = cytoscapeGpu( { elements: GRAPH } );
      const slot = cy._store.lookup('ab').slot;

      cy.$id('ab').animate( { style: { opacity: 0 }, duration: 100, easing: 'linear' } );
      drive( cy, 0, 100 );

      expect( cy._store.column('edge.targetArrow')[ slot * 4 + 3 ] ).to.equal( 0 );
      expect( cy._store.column('edge.sourceArrow')[ slot * 4 + 3 ] ).to.equal( 0 );
    });
  });

  describe('the GPU lease (mock sink)', function(){
    const setup = () => {
      const cy = cytoscapeGpu( { elements: [ { data: { id: 'a' }, position: { x: 0, y: 0 } } ] } );
      const registered = [];
      const unregistered = [];

      cy._animations.attachDriver( {
        register: ( id, writes ) => registered.push( { id, writes } ),
        unregister: id => unregistered.push( id )
      } );

      return { cy, registered, unregistered };
    };
    const fill = cy => Array.from(
      cy._store.column('node.fillColor').subarray( 0, 4 ) );

    it('registers one write per tweened column and leaves the CPU columns alone', function(){
      const { cy, registered } = setup();

      cy.$id('a').animate( {
        style: { 'background-color': 'rgb(255,0,0)' }, position: { x: 100, y: 0 },
        duration: 100, easing: 'linear' } );

      cy._animations.tick( 0 );

      expect( registered ).to.have.length( 1 );
      expect( registered[0].writes.map( w => w.column ) ).to.have.members(
        [ 'node.fillColor', 'node.position' ] );

      // mid-flight the device owns both columns: CPU reads stay at the start
      cy._animations.tick( 50 );
      expect( cy.$id('a').position('x') ).to.equal( 0 );
      expect( fill( cy ) ).to.deep.equal( [ 153, 153, 153, 255 ] ); // still #999
    });

    it('settles the exact final value on the CPU when it completes', function(){
      const { cy, unregistered } = setup();

      cy.$id('a').animate( {
        style: { 'background-color': 'rgb(255,0,0)' }, position: { x: 100, y: 0 },
        duration: 100, easing: 'linear' } );

      cy._animations.tick( 0 );
      cy._animations.tick( 100 );

      expect( unregistered ).to.have.length( 1 );
      expect( cy.$id('a').position('x') ).to.equal( 100 );
      expect( fill( cy ) ).to.deep.equal( [ 255, 0, 0, 255 ] );
      expect( cy.$id('a').animated() ).to.be.false;
    });

    it('honours the delay before capturing, as the CPU path does', function(){
      const { cy, registered } = setup();

      cy.$id('a').animate( { position: { x: 100, y: 0 }, duration: 100, delay: 200 } );

      cy._animations.tick( 0 );
      cy._animations.tick( 100 );
      expect( registered ).to.have.length( 0 ); // still in the delay

      cy._animations.tick( 200 );
      expect( registered ).to.have.length( 1 );
    });

    it('stop(true) releases the lease and lands on the target', function(){
      const { cy, unregistered } = setup();

      cy.$id('a').animate( { position: { x: 100, y: 0 }, duration: 1e6, easing: 'linear' } );
      cy._animations.tick( 0 );

      cy.$id('a').stop( true, true );

      expect( unregistered ).to.have.length( 1 );
      expect( cy.$id('a').position('x') ).to.equal( 100 );
    });

    it('stop() releases the lease and writes back, rather than leaving the columns behind', function(){
      const { cy, unregistered } = setup();

      cy.$id('a').animate( { position: { x: 100, y: 0 }, duration: 1e6, easing: 'linear' } );
      cy._animations.tick( 0 );

      cy.$id('a').stop();

      // released, finished, and the CPU carries a value the device can't
      // silently disagree with any more
      expect( unregistered ).to.have.length( 1 );
      expect( cy.$id('a').animated() ).to.be.false;
      expect( cy.$id('a').position('x') ).to.be.a('number');
    });

    it('keeps a geometry channel on the CPU path even with a sink attached', function(){
      const { cy, registered } = setup();

      cy.$id('a').animate( { style: { 'border-width': 10 }, duration: 100, easing: 'linear' } );

      cy._animations.tick( 0 );
      cy._animations.tick( 50 );

      expect( registered ).to.have.length( 0 );
      expect( cy._store.column('node.borderWidth')[ 0 ] ).to.be.closeTo( 5, 1e-4 );
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

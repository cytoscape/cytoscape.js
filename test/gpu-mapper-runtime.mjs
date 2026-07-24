import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { StyleEngine } from '../src/gpu/style.mjs';
import { MapperRuntime } from '../src/gpu/render/mapper-runtime.mjs';

// the device-side eval lifecycle against mocks: configure-by-version,
// span ingestion, owned-column eval requests, dispatch encoding

const makeMockDevice = () => {
  const writes = [];
  const device = {
    createBuffer( descriptor ){
      return { label: descriptor.label, size: descriptor.size, destroyed: false, destroy(){ this.destroyed = true; } };
    },
    createBindGroupLayout: () => ( {} ),
    createPipelineLayout: () => ( {} ),
    createShaderModule( descriptor ){
      expect( descriptor.code ).to.include( 'fn csEval' ); // sanity: real WGSL
      return {};
    },
    createComputePipeline: descriptor => ( { label: descriptor.label } ),
    createBindGroup: () => ( {} ),
    queue: {
      writeBuffer( buffer, bufferOffset, data, dataOffset, size ){
        writes.push( { label: buffer.label, bufferOffset, size, data } );
      }
    }
  };

  return { device, writes };
};

const makeMockMirror = () => ( {
  version: 0,
  owned: [],
  buffer( id ){ return { label: `mirror:${id}` }; },
  setGpuOwned( ids ){ this.owned = [ ...ids ]; }
} );

const makeMockPass = () => {
  const dispatches = [];

  return {
    dispatches,
    setPipeline(){},
    setBindGroup(){},
    dispatchWorkgroups( n ){ dispatches.push( n ); }
  };
};

const setup = ( sheet ) => {
  const store = new GraphStore();

  store.addNode( 'a', 0, 0 );
  store.addNode( 'b', 10, 0 );
  store.setData( 'nodes', 0, 'w', 2 );
  store.setData( 'nodes', 1, 'w', 8 );

  const engine = new StyleEngine( store, () => null );

  engine.setSheet( sheet );
  store.takeDelta();
  store.takeMapperSpans();

  const mock = makeMockDevice();
  const mirror = makeMockMirror();
  const runtime = new MapperRuntime( mock.device, store, engine, mirror );

  return { store, engine, mirror, runtime, mock };
};

const emptyDelta = { resized: { nodes: false, edges: false }, spans: [] };

describe('gpu/mapper-runtime', function(){

  it('configures on the engine paint version: owns columns and evaluates in full', function(){
    const { store, runtime, mirror, mock } = setup( {
      nodes: { opacity: { data: 'w', domain: [ 0, 10 ], range: [ 0, 1 ] } }
    } );

    runtime.update( emptyDelta );

    expect( runtime.active() ).to.be.true;
    expect( mirror.owned ).to.deep.equal( [ 'node.opacity' ] );
    expect( mock.writes.some( w => w.label === 'cy-gpu:nodes-mapper-programs' ) ).to.be.true;
    expect( mock.writes.some( w => w.label === 'cy-gpu:nodes-mapper-values' ) ).to.be.true;

    const pass = makeMockPass();

    runtime.encode( pass );

    expect( pass.dispatches ).to.deep.equal( [ Math.ceil( store.capacity('nodes') / 256 ) ] );
    expect( runtime.dispatches ).to.equal( 1 );

    // the full range was consumed; nothing pending now
    const pass2 = makeMockPass();

    runtime.encode( pass2 );
    expect( pass2.dispatches ).to.have.length( 0 );
  });

  it('stays inactive without paint mappers', function(){
    const { runtime, mirror } = setup( {
      nodes: { width: { data: 'w', domain: [ 0, 10 ], range: [ 10, 40 ] } } // geometry: CPU
    } );

    runtime.update( emptyDelta );

    expect( runtime.active() ).to.be.false;
    expect( mirror.owned ).to.deep.equal( [] );
  });

  it('turns data writes into byte uploads + a coalesced dispatch', function(){
    const { store, runtime, mock } = setup( {
      nodes: { opacity: { data: 'w', domain: [ 0, 10 ], range: [ 0, 1 ] } }
    } );

    runtime.update( emptyDelta );
    runtime.encode( makeMockPass() ); // drain the configure-time full eval
    mock.writes.length = 0;

    store.setData( 'nodes', 1, 'w', 5 );
    store.takeDelta();
    runtime.update( emptyDelta );

    const valueWrite = mock.writes.find( w => w.label === 'cy-gpu:nodes-mapper-values' );

    expect( valueWrite.bufferOffset ).to.equal( 4 ); // slot 1 × 4 B
    expect( valueWrite.size ).to.equal( 4 );

    const pass = makeMockPass();

    runtime.encode( pass );

    expect( pass.dispatches ).to.deep.equal( [ 1 ] );

    const infoWrite = mock.writes.find( w => w.label === 'cy-gpu:nodes-mapper-info' );

    expect( [ ...infoWrite.data ] ).to.deep.equal( [ 1, 1, 1, 0 ] ); // start 1, count 1, 1 program
  });

  it('treats CPU spans on owned columns as eval requests (element adds)', function(){
    const { store, engine, runtime } = setup( {
      nodes: { opacity: { data: 'w', domain: [ 0, 10 ], range: [ 0, 1 ] } }
    } );

    runtime.update( emptyDelta );
    runtime.encode( makeMockPass() );

    const slot = store.addNode( 'c', 5, 5 );

    engine.applyBulk( 'nodes', [ slot ] ); // the core's add path

    runtime.update( store.takeDelta() );

    const pass = makeMockPass();

    runtime.encode( pass );

    expect( pass.dispatches ).to.have.length( 1 );
  });

  it('repacks when a GPU-owned live extent moves', function(){
    const { store, engine, runtime, mock } = setup( {
      nodes: { opacity: { data: 'w', range: [ 0, 1 ] } } // auto domain
    } );

    runtime.update( emptyDelta );
    runtime.encode( makeMockPass() );
    mock.writes.length = 0;

    store.setData( 'nodes', 1, 'w', 100 ); // extent [2, 8] → [2, 100]
    engine.refreshMapped( 'nodes', [ 1 ], [ 'w' ] ); // owned-only: no CPU eval, but extents re-check

    runtime.update( store.takeDelta() );

    expect( mock.writes.some( w => w.label === 'cy-gpu:nodes-mapper-programs' ) ).to.be.true;

    const pass = makeMockPass();

    runtime.encode( pass );

    // the repack queued a full-range eval
    expect( pass.dispatches ).to.deep.equal( [ Math.ceil( store.capacity('nodes') / 256 ) ] );
  });

  it('skips CPU evaluation of owned channels but keeps getters truthful', function(){
    const { store, engine, runtime } = setup( {
      nodes: { opacity: { data: 'w', domain: [ 0, 10 ], range: [ 0, 1 ] } }
    } );

    runtime.update( emptyDelta );

    const before = ( store.column('node.opacity') )[ 1 ];

    store.setData( 'nodes', 1, 'w', 5 );
    engine.refreshMapped( 'nodes', [ 1 ], [ 'w' ] );

    // stored bytes untouched (the kernel owns them)...
    expect( store.column('node.opacity')[ 1 ] ).to.equal( before );
    // ...but the getter evaluates the shared IR lazily
    expect( engine.readProp( store.ref( 'nodes', 1 ), 'opacity' ) ).to.equal( 0.5 );
  });

});

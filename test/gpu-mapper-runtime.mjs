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

  const engine = new StyleEngine( store );

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

  it('owns color channels and answers arrow getters with the folded IR', function(){
    const store = new GraphStore();

    store.addNode( 'a', 0, 0 );
    store.addNode( 'b', 10, 0 );
    store.addEdge( 'ab', 'a', 'b' );
    store.setData( 'edges', 0, 'o', 0.5 );

    const engine = new StyleEngine( store );

    engine.setSheet( {
      nodes: { 'background-color': { data: 'w', domain: [ 0, 1 ], range: 'viridis' } },
      edges: {
        'opacity': { data: 'o', domain: [ 0, 1 ], range: [ 0, 1 ] },
        'target-arrow-shape': 'triangle',
        'target-arrow-color': '#ff0000'
      }
    } );
    store.takeDelta();
    store.takeMapperSpans();

    const mock = makeMockDevice();
    const mirror = makeMockMirror();
    const runtime = new MapperRuntime( mock.device, store, engine, mirror );

    runtime.update( emptyDelta );

    expect( mirror.owned ).to.deep.equal( [ 'node.fillColor', 'edge.opacity', 'edge.targetArrow' ] );

    const edge = store.ref( 'edges', 0 );

    expect( engine.readProp( edge, 'target-arrow-color' ) ).to.equal( 'rgba(255,0,0,0.502)' );
    expect( engine.readProp( edge, 'target-arrow-shape' ) ).to.equal( 'triangle' );

    store.setData( 'edges', 0, 'o', 0 );
    engine.refreshMapped( 'edges', [ 0 ], [ 'o' ] );

    expect( engine.readProp( edge, 'target-arrow-shape' ) ).to.equal( 'none' );
  });

  it('demotes all edge paint to the CPU when an arrow shape is mapped', function(){
    const { store, runtime, mirror, engine } = setup( {
      edges: {
        'opacity': { data: 'o', domain: [ 0, 1 ], range: [ 0, 1 ] },
        'target-arrow-shape': { data: 't', scale: 'ordinal', domain: [ 'yes' ], range: [ 'triangle' ] }
      }
    } );

    store.addEdge( 'ab', 'a', 'b' );
    store.takeDelta();
    runtime.update( emptyDelta );

    expect( runtime.active() ).to.be.false;
    expect( mirror.owned ).to.deep.equal( [] );
    expect( engine.paintInputs( 'edges' ) ).to.deep.equal( [] );
  });

  it('repacks the ordinal LUT when the dict grows', function(){
    const { store, runtime, mock } = setup( {
      nodes: { 'background-color': {
        data: 'cat', scale: 'ordinal', domain: [ 'x', 'y' ], range: [ '#ff0000', '#00ff00' ]
      } }
    } );

    store.setData( 'nodes', 0, 'cat', 'x' );
    store.takeDelta();
    store.takeMapperSpans();
    runtime.update( emptyDelta ); // configure sees dict [x]
    runtime.encode( makeMockPass() );
    mock.writes.length = 0;

    store.setData( 'nodes', 1, 'cat', 'y' ); // new category: dict grows
    store.takeDelta();
    runtime.update( emptyDelta );

    expect( mock.writes.some( w => w.label === 'cy-gpu:nodes-mapper-programs' ) ).to.be.true;

    const pass = makeMockPass();

    runtime.encode( pass );

    expect( pass.dispatches ).to.deep.equal( [ Math.ceil( store.capacity('nodes') / 256 ) ] );
  });

  it('repacks the ordinal LUT when a dict compaction remaps indices', function(){
    const { store, runtime, mock } = setup( {
      nodes: { 'background-color': {
        data: 'cat', scale: 'ordinal', domain: [ 'c5' ], range: [ '#ff0000' ]
      } }
    } );

    for( let i = 2; i < 9; i++ ){ store.addNode( 'n' + i, i, 0 ); } // setup made slots 0, 1
    for( let i = 0; i < 9; i++ ){ store.setData( 'nodes', i, 'cat', 'c' + i ); } // dict c0..c8

    store.takeDelta();
    store.takeMapperSpans();
    runtime.update( emptyDelta ); // configure sees dict length 9, epoch 0
    runtime.encode( makeMockPass() );
    mock.writes.length = 0;

    // same-frame shrink + regrow to the packed length: 5 categories die
    // (the dict compacts, remapping the survivors' indices) and 5 new
    // ones bring the length back to 9 — length comparison alone would
    // skip the repack and leave the LUT keyed by the old index space
    for( let i = 0; i < 5; i++ ){ store.setData( 'nodes', i, 'cat', 'c5' ); }
    for( let i = 0; i < 5; i++ ){ store.setData( 'nodes', i, 'cat', 'x' + i ); }

    const col = store.data.column( 'nodes', 'cat' );

    expect( col.dict.length ).to.equal( 9 ); // regrown to the packed length
    expect( col.epoch ).to.equal( 1 ); // but remapped

    store.takeDelta();
    runtime.update( emptyDelta );

    expect( mock.writes.some( w => w.label === 'cy-gpu:nodes-mapper-programs' ) ).to.be.true;

    const pass = makeMockPass();

    runtime.encode( pass );

    expect( pass.dispatches ).to.deep.equal( [ Math.ceil( store.capacity('nodes') / 256 ) ] );
  });

  it('demotes to eager CPU when a mapped column promotes to mixed', function(){
    const { store, engine, runtime, mirror } = setup( {
      nodes: { 'background-color': { data: 'w', domain: [ 0, 10 ], range: 'viridis' } }
    } );

    runtime.update( emptyDelta );

    expect( mirror.owned ).to.deep.equal( [ 'node.fillColor' ] );

    const ref1 = store.ref( 'nodes', 1 );
    const lazyBefore = engine.readProp( ref1, 'background-color' );

    store.setData( 'nodes', 0, 'w', 'oops' ); // promotes the column to mixed
    engine.refreshMapped( 'nodes', [ 0 ], [ 'w' ] ); // the data-write path

    // ownership cleared and the stored bytes re-derived on the CPU
    expect( engine.readProp( ref1, 'background-color' ) ).to.equal( lazyBefore );

    const bytes = store.column( 'node.fillColor' );
    const rgb = `rgb(${bytes[ 4 ]},${bytes[ 5 ]},${bytes[ 6 ]})`;

    expect( rgb ).to.equal( lazyBefore );

    runtime.update( store.takeDelta() );

    expect( mirror.owned ).to.deep.equal( [] ); // the runtime repacked against the mixed column
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

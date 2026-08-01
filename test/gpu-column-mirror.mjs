import { expect } from 'chai';
import { GraphStore } from '../src/gpu/store/graph-store.mjs';
import { ColumnMirror } from '../src/gpu/render/column-mirror.mjs';
import { COLUMN_SPECS, columnSpec } from '../src/gpu/contract.mjs';

// ColumnMirror range logic tested against a mock GPUQueue/device.

const makeMockDevice = () => {
  const writes = [];
  const buffers = [];
  let workDoneResolvers = [];

  const device = {
    createBuffer( descriptor ){
      const buffer = {
        label: descriptor.label,
        size: descriptor.size,
        usage: descriptor.usage,
        destroyed: false,
        destroy(){ this.destroyed = true; }
      };

      buffers.push( buffer );

      return buffer;
    },
    queue: {
      writeBuffer( buffer, bufferOffset, data, dataOffset, size ){
        writes.push( { buffer, bufferOffset, dataOffset, size } );
      },
      onSubmittedWorkDone(){
        return new Promise( resolve => workDoneResolvers.push( resolve ) );
      }
    }
  };

  return {
    device,
    writes,
    buffers,
    flushWorkDone(){
      for( const resolve of workDoneResolvers ){ resolve(); }
      workDoneResolvers = [];
    }
  };
};

const drain = () => new Promise( resolve => setTimeout( resolve, 0 ) );

describe('gpu/render: ColumnMirror', function(){

  var store, mock, mirror;

  beforeEach(function(){
    store = new GraphStore();
    store.addNode('a', 1, 2);
    store.addNode('b', 3, 4);
    store.addEdge('ab', 'a', 'b');
    store.takeDelta();

    mock = makeMockDevice();
    mirror = new ColumnMirror( mock.device, store );
  });

  it('creates one buffer per contract column, sized to capacity', function(){
    // + 3: the curve param blob (12b), the custom-polygon blob (13 C3)
    // and the background-image record blob (15.3)
    expect( mock.buffers ).to.have.length( COLUMN_SPECS.length + 3 );

    for( const spec of COLUMN_SPECS ){
      const buffer = mirror.buffer( spec.id );
      const cap = store.capacity( spec.group );

      expect( buffer.size ).to.equal( cap * spec.bytesPerSlot );
    }
  });

  it('fully uploads on construction', function(){
    // one full-array write per column
    expect( mock.writes ).to.have.length( COLUMN_SPECS.length );

    for( const write of mock.writes ){
      expect( write.bufferOffset ).to.equal(0);
    }
  });

  it('uploads dirty spans at the correct byte offsets', function(){
    mock.writes.length = 0;

    store.setPosition( 1, 50, 60 );

    mirror.sync( store.takeDelta() );

    expect( mock.writes ).to.have.length(1);

    const write = mock.writes[0];
    const bps = columnSpec('node.position').bytesPerSlot;

    expect( write.buffer ).to.equal( mirror.buffer('node.position') );
    expect( write.bufferOffset ).to.equal( 1 * bps );
    expect( write.size ).to.equal( 1 * bps );
  });

  it('skips span uploads for GPU-owned columns, but realloc re-uploads them', function(){
    mock.writes.length = 0;

    mirror.setGpuOwned( [ 'node.fillColor' ] );
    store.setColor( 'node.fillColor', 0, 1, 2, 3, 4 );
    store.setPosition( 1, 50, 60 );

    mirror.sync( store.takeDelta() );

    expect( mock.writes ).to.have.length( 1 );
    expect( mock.writes[0].buffer ).to.equal( mirror.buffer('node.position') );

    // capacity growth still uploads the CPU base of owned columns in full
    // (the renderer schedules a full re-eval on resize)
    for( let i = 0; i < 200; i++ ){ store.addNode( 'grow' + i, 0, 0 ); }

    mock.writes.length = 0;
    mirror.sync( store.takeDelta() );

    expect( mock.writes.some( write =>
      write.buffer === mirror.buffer('node.fillColor') && write.bufferOffset === 0
    ) ).to.be.true;
  });

  it('uploads coalesced spans as one write', function(){
    mock.writes.length = 0;

    store.setPosition( 0, 5, 5 );
    store.setPosition( 1, 6, 6 );

    mirror.sync( store.takeDelta() );

    const bps = columnSpec('node.position').bytesPerSlot;

    expect( mock.writes ).to.have.length(1);
    expect( mock.writes[0].bufferOffset ).to.equal(0);
    expect( mock.writes[0].size ).to.equal( 2 * bps );
  });

  it('reallocates and fully re-uploads on group resize', function(){
    const cap = store.capacity('nodes');

    for( let i = store.count('nodes'); i <= cap; i++ ){
      store.addNode('n' + i, 0, 0);
    }

    const versionBefore = mirror.version;
    const nodeColumns = COLUMN_SPECS.filter( spec => spec.group === 'nodes' );

    mock.writes.length = 0;
    mirror.sync( store.takeDelta() );

    expect( mirror.version ).to.be.above( versionBefore );

    // every node column re-uploaded in full at the new capacity
    for( const spec of nodeColumns ){
      const buffer = mirror.buffer( spec.id );

      expect( buffer.size ).to.equal( store.capacity('nodes') * spec.bytesPerSlot );

      const fullWrite = mock.writes.find( write => write.buffer === buffer && write.bufferOffset === 0 );

      expect( fullWrite, spec.id ).to.exist;
    }

    // no span-writes into old (reallocated) node buffers
    for( const write of mock.writes ){
      expect( write.buffer.destroyed ).to.be.false;
    }
  });

  it('defers destroying old buffers until submitted work completes', async function(){
    const oldBuffer = mirror.buffer('node.position');
    const cap = store.capacity('nodes');

    for( let i = store.count('nodes'); i <= cap; i++ ){
      store.addNode('n' + i, 0, 0);
    }

    mirror.sync( store.takeDelta() );

    expect( oldBuffer.destroyed ).to.be.false; // still potentially bound by in-flight frames

    mock.flushWorkDone();
    await drain();

    expect( oldBuffer.destroyed ).to.be.true;
    expect( mirror.buffer('node.position').destroyed ).to.be.false;
  });

  it('leaves untouched-group buffers alone on resize', function(){
    const edgeBuffer = mirror.buffer('edge.endpoints');
    const cap = store.capacity('nodes');

    for( let i = store.count('nodes'); i <= cap; i++ ){
      store.addNode('n' + i, 0, 0);
    }

    mirror.sync( store.takeDelta() );

    expect( mirror.buffer('edge.endpoints') ).to.equal( edgeBuffer );
  });

  it('accumulates uploaded byte stats', function(){
    const before = mirror.uploadedBytes;

    store.setPosition( 0, 9, 9 );
    mirror.sync( store.takeDelta() );

    expect( mirror.uploadedBytes ).to.equal( before + columnSpec('node.position').bytesPerSlot );
  });

  it('destroys all buffers on destroy()', function(){
    mirror.destroy();

    for( const buffer of mock.buffers ){
      expect( buffer.destroyed ).to.be.true;
    }
  });

});

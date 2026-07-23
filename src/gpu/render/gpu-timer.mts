import { BUFFER_USAGE, MAP_MODE } from './webgpu-constants.mjs';

/*
Measures real GPU execution time of the scene work (cull compute pass +
render pass) via the optional 'timestamp-query' feature (requested at
device creation when the adapter supports it).  Begin/end timestamps are
written by both passes, resolved into a query buffer and read back through
a small staging ring — the same latest-wins, skip-when-busy pattern as
picking, so timing never stalls the frame loop.  Values are quantized by
the browser (Chrome: ~100 µs) which is plenty for profiling.

The compute pass must run (even empty) whenever the render pass runs:
timestamp queries persist across resolves, so a skipped pass would leave
stale values behind and corrupt the sum.

This exists because CPU-side timing around queue.submit() only measures
command encoding (~0.1 ms): submission is fire-and-forget and the actual
vertex/raster work lands on the GPU timeline, invisible to
performance.now().
*/

const RING = 2;

interface RingSlot {
  buffer: GPUBuffer;
  busy: boolean;
}

export class GpuTimer {
  /** most recent per-frame GPU duration (cull + render passes); 0 until the first reading */
  lastMs: number;

  private querySet: GPUQuerySet;
  private resolveBuffer: GPUBuffer;
  private ring: RingSlot[];
  private destroyed: boolean;

  static isSupported( device: GPUDevice ): boolean {
    return device.features.has( 'timestamp-query' );
  }

  constructor( device: GPUDevice ){
    this.lastMs = 0;
    this.destroyed = false;

    this.querySet = device.createQuerySet( {
      label: 'cy-gpu:frame-timestamps',
      type: 'timestamp',
      count: 4 // render begin/end, cull-compute begin/end
    } );

    this.resolveBuffer = device.createBuffer( {
      label: 'cy-gpu:timestamp-resolve',
      size: 32, // four u64 timestamps
      usage: BUFFER_USAGE.QUERY_RESOLVE | BUFFER_USAGE.COPY_SRC
    } );

    this.ring = Array.from( { length: RING }, ( _, i ) => ( {
      buffer: device.createBuffer( {
        label: `cy-gpu:timestamp-staging-${i}`,
        size: 32,
        usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST
      } ),
      busy: false
    } ) );
  }

  /** Attach to the scene render pass descriptor. */
  timestampWrites(): GPURenderPassTimestampWrites {
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: 0,
      endOfPassWriteIndex: 1
    };
  }

  /** Attach to the cull compute pass descriptor. */
  computeTimestampWrites(): GPUComputePassTimestampWrites {
    return {
      querySet: this.querySet,
      beginningOfPassWriteIndex: 2,
      endOfPassWriteIndex: 3
    };
  }

  /**
   * Encode the query resolve + staging copy (call after pass.end(), before
   * submit).  Returns an after-submit finisher, or null when the ring is
   * busy (that frame just goes unmeasured).
   */
  encodeResolve( encoder: GPUCommandEncoder ): ( () => void ) | null {
    if( this.destroyed ){ return null; }

    const slot = this.ring.find( s => !s.busy );

    if( slot == null ){ return null; }

    slot.busy = true;
    encoder.resolveQuerySet( this.querySet, 0, 4, this.resolveBuffer, 0 );
    encoder.copyBufferToBuffer( this.resolveBuffer, 0, slot.buffer, 0, 32 );

    return () => { void this.read( slot ); };
  }

  destroy(): void {
    this.destroyed = true;
    this.querySet.destroy();
    this.resolveBuffer.destroy();

    for( const slot of this.ring ){
      slot.buffer.destroy();
    }
  }

  private async read( slot: RingSlot ): Promise<void> {
    try {
      await slot.buffer.mapAsync( MAP_MODE.READ );

      const stamps = new BigUint64Array( slot.buffer.getMappedRange() );
      const renderNs = Number( stamps[ 1 ] - stamps[ 0 ] );
      const cullNs = Number( stamps[ 3 ] - stamps[ 2 ] );

      slot.buffer.unmap();

      if( renderNs > 0 ){ // quantization can yield 0/negative deltas; keep the last real reading
        this.lastMs = ( renderNs + Math.max( cullNs, 0 ) ) / 1e6;
      }
    } catch {
      // device lost or destroyed mid-flight
    } finally {
      slot.busy = false;
    }
  }
}

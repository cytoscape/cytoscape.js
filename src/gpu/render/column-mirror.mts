import { COLUMN_SPECS, columnSpec } from '../contract.mjs';
import type { ColumnId, GroupName, ModelView, StoreDelta } from '../contract.mjs';
import { BUFFER_USAGE } from './webgpu-constants.mjs';

/*
GPU storage-buffer mirror of the CPU-canonical columns.

- Dirty spans upload via queue.writeBuffer at byte offset span.start × bps —
  byte-for-byte copies out of the backing typed arrays.
- When a group's capacity grew (delta.resized), that group's buffers are
  reallocated at the new capacity and re-uploaded in full; the old buffers'
  destroy() is deferred behind queue.onSubmittedWorkDone() so in-flight
  frames keep their bindings valid.  `version` bumps so pipelines rebuild
  their bind groups lazily.
*/

/** The subset of GPUDevice the mirror needs (kept narrow for mock-based unit tests). */
export interface MirrorDevice {
  createBuffer( descriptor: { size: number; usage: number; label?: string } ): GPUBuffer;
  queue: {
    writeBuffer(
      buffer: GPUBuffer, bufferOffset: number,
      data: ArrayBufferLike | ArrayBufferView, dataOffset?: number, size?: number
    ): void;
    onSubmittedWorkDone(): Promise<undefined>;
  };
}

export class ColumnMirror {
  /** bumps whenever buffers are reallocated ⇒ bind groups must be rebuilt */
  version: number;
  /** total bytes uploaded via writeBuffer (stats) */
  uploadedBytes: number;

  private device: MirrorDevice;
  private view: ModelView;
  private buffers: Map<ColumnId, GPUBuffer>;
  private capacities: { nodes: number; edges: number };
  private destroyed: boolean;
  private gpuOwned: ReadonlySet<ColumnId>;
  private tweenOwned: ReadonlySet<ColumnId>;
  /** the curve param blob's mirror (12b); same span/realloc rules */
  private blob: GPUBuffer;
  private blobCapacity: number;
  private poly!: GPUBuffer;

  constructor( device: MirrorDevice, view: ModelView ){
    this.device = device;
    this.view = view;
    this.version = 0;
    this.uploadedBytes = 0;
    this.buffers = new Map();
    this.capacities = { nodes: 0, edges: 0 };
    this.destroyed = false;
    this.gpuOwned = new Set();
    this.tweenOwned = new Set();
    this.blobCapacity = 0;
    this.blob = this.reallocBlob();
    this.poly = this.reallocPolyBlob();

    this.realloc( 'nodes' );
    this.realloc( 'edges' );
  }

  /**
   * Columns whose bytes the mapper eval kernel owns on-GPU: span uploads
   * skip them, so CPU-side fallback writes never clobber evaluated bytes.
   * realloc() still uploads the CPU base in full — the caller schedules a
   * full re-eval for owned columns whenever a group resizes.
   */
  setGpuOwned( ids: Iterable<ColumnId> ): void {
    this.gpuOwned = new Set( ids );
  }

  /**
   * Columns the GPU tween runtime owns while an animation runs (a
   * separate set from the mapper-owned one so the two can't clobber each
   * other); span uploads skip a column owned by either.
   */
  setTweenOwned( ids: Iterable<ColumnId> ): void {
    this.tweenOwned = new Set( ids );
  }

  buffer( id: ColumnId ): GPUBuffer {
    const buffer = this.buffers.get( id );

    if( buffer == null ){
      throw new Error( `No mirror buffer for column '${id}'` );
    }

    return buffer;
  }

  /** The curve param blob's storage buffer (12b route families). */
  blobBuffer(): GPUBuffer {
    return this.blob;
  }

  /** The custom-polygon point blob's storage buffer (round 13 C3). */
  polyBlobBuffer(): GPUBuffer {
    return this.poly;
  }

  /** Apply a StoreDelta: reallocate resized groups, upload dirty spans for the rest. */
  sync( delta: StoreDelta ): void {
    if( this.destroyed ){ return; }

    for( const group of [ 'nodes', 'edges' ] as GroupName[] ){
      if( delta.resized[ group ] || this.view.capacity( group ) !== this.capacities[ group ] ){
        this.realloc( group );
      }
    }

    for( const span of delta.spans ){
      const spec = columnSpec( span.column );

      if( delta.resized[ spec.group ] ){ continue; } // covered by the full re-upload

      if( this.gpuOwned.has( span.column ) || this.tweenOwned.has( span.column ) ){ continue; } // owned on-GPU

      const arr = this.view.column( span.column );
      const byteStart = span.start * spec.bytesPerSlot;
      const byteLength = ( span.end - span.start ) * spec.bytesPerSlot;

      this.device.queue.writeBuffer(
        this.buffer( span.column ), byteStart,
        arr.buffer, arr.byteOffset + byteStart, byteLength
      );

      this.uploadedBytes += byteLength;
    }

    if( delta.curveBlob != null ){
      if( delta.curveBlob.resized ){
        this.blob = this.reallocBlob();
      } else {
        const data = this.view.curveBlob();
        const byteStart = delta.curveBlob.start * 4;
        const byteLength = ( delta.curveBlob.end - delta.curveBlob.start ) * 4;

        this.device.queue.writeBuffer(
          this.blob, byteStart, data.buffer, data.byteOffset + byteStart, byteLength );
        this.uploadedBytes += byteLength;
      }
    }

    if( delta.polyBlob != null ){
      if( delta.polyBlob.resized ){
        this.poly = this.reallocPolyBlob();
      } else {
        const data = this.view.polyBlob();
        const byteStart = delta.polyBlob.start * 4;
        const byteLength = ( delta.polyBlob.end - delta.polyBlob.start ) * 4;

        this.device.queue.writeBuffer(
          this.poly, byteStart, data.buffer, data.byteOffset + byteStart, byteLength );
        this.uploadedBytes += byteLength;
      }
    }
  }

  destroy(): void {
    this.destroyed = true;

    for( const buffer of this.buffers.values() ){
      buffer.destroy();
    }

    this.buffers.clear();
    this.blob.destroy();
    this.poly.destroy();
  }

  /** (Re)allocate the blob mirror at the pool's backing capacity and
   * upload it in full; bumps version so bind groups rebuild. */
  private reallocBlob(): GPUBuffer {
    const data = this.view.curveBlob();
    const old = this.blobCapacity > 0 || this.blob != null ? this.blob : null;
    const buffer = this.device.createBuffer( {
      label: 'cy-gpu:curve-blob',
      size: Math.max( data.byteLength, 4 ),
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
    } );

    if( data.byteLength > 0 ){
      this.device.queue.writeBuffer( buffer, 0, data.buffer, data.byteOffset, data.byteLength );
      this.uploadedBytes += data.byteLength;
    }

    this.blobCapacity = data.length;
    this.version++;

    if( old != null ){
      this.device.queue.onSubmittedWorkDone().then( () => old.destroy() );
    }

    return buffer;
  }

  /** The C3 poly blob's realloc twin. */
  private reallocPolyBlob(): GPUBuffer {
    const data = this.view.polyBlob();
    const old = this.poly;
    const buffer = this.device.createBuffer( {
      label: 'cy-gpu:poly-blob',
      size: Math.max( data.byteLength, 4 ),
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
    } );

    if( data.byteLength > 0 ){
      this.device.queue.writeBuffer( buffer, 0, data.buffer, data.byteOffset, data.byteLength );
      this.uploadedBytes += data.byteLength;
    }

    this.version++;

    if( old != null ){
      this.device.queue.onSubmittedWorkDone().then( () => old.destroy() );
    }

    return buffer;
  }

  private realloc( group: GroupName ): void {
    const cap = this.view.capacity( group );
    const olds: GPUBuffer[] = [];

    for( const spec of COLUMN_SPECS ){
      if( spec.group !== group ){ continue; }

      const old = this.buffers.get( spec.id );

      if( old != null ){ olds.push( old ); }

      const size = Math.max( cap * spec.bytesPerSlot, 4 );
      const buffer = this.device.createBuffer( {
        label: `cy-gpu:${spec.id}`,
        size,
        usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
      } );

      // full upload of the backing array (byte-identical, sized to capacity)
      const arr = this.view.column( spec.id );

      this.device.queue.writeBuffer( buffer, 0, arr.buffer, arr.byteOffset, arr.byteLength );
      this.uploadedBytes += arr.byteLength;

      this.buffers.set( spec.id, buffer );
    }

    this.capacities[ group ] = cap;
    this.version++;

    if( olds.length > 0 ){
      // defer destroy until submitted work (still binding the old buffers) completes
      this.device.queue.onSubmittedWorkDone().then( () => {
        for( const old of olds ){
          old.destroy();
        }
      } );
    }
  }
}

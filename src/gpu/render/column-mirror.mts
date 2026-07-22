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

  constructor( device: MirrorDevice, view: ModelView ){
    this.device = device;
    this.view = view;
    this.version = 0;
    this.uploadedBytes = 0;
    this.buffers = new Map();
    this.capacities = { nodes: 0, edges: 0 };
    this.destroyed = false;

    this.realloc( 'nodes' );
    this.realloc( 'edges' );
  }

  buffer( id: ColumnId ): GPUBuffer {
    const buffer = this.buffers.get( id );

    if( buffer == null ){
      throw new Error( `No mirror buffer for column '${id}'` );
    }

    return buffer;
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

      const arr = this.view.column( span.column );
      const byteStart = span.start * spec.bytesPerSlot;
      const byteLength = ( span.end - span.start ) * spec.bytesPerSlot;

      this.device.queue.writeBuffer(
        this.buffer( span.column ), byteStart,
        arr.buffer, arr.byteOffset + byteStart, byteLength
      );

      this.uploadedBytes += byteLength;
    }
  }

  destroy(): void {
    this.destroyed = true;

    for( const buffer of this.buffers.values() ){
      buffer.destroy();
    }

    this.buffers.clear();
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

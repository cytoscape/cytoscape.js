import { BUFFER_USAGE } from './webgpu-constants.mjs';
import type { MirrorDevice } from './column-mirror.mjs';

/*
Persistent GPU buffer of SDF glyph instances with per-node ranges.

Each glyph stores its node *slot*, so the vertex shader reads the node
position buffer directly — labels follow drags/layouts on-GPU with zero
CPU work here.  Only text/style changes touch this buffer: a node's old
glyph run is tombstoned (sentinel nodeSlot ⇒ degenerate quad) and the new
run is appended; the store compacts when more than half the slots are
garbage.  Uploads are one coalesced dirty span per frame; capacity growth
reallocates the GPU buffer (old one destroyed behind onSubmittedWorkDone)
and bumps `version` for lazy bind-group rebuild — the ColumnMirror rules.

CPU-canonical layout, 12 words (48 bytes) per glyph, matching the WGSL
Glyph struct:
  u32 nodeSlot (0xffffffff = dead), u32 packed RGBA color,
  f32 offsetX/offsetY (model px from the node center, quad top-left),
  f32 w/h (model px), f32 u0/v0/u1/v1,
  u32 packed outline RGBA, f32 outline half-width in SDF sample units.
A negative u0 marks a solid background quad (no atlas sample); its v0
carries the run's glyph-block height for LOD purposes.
*/

export const GLYPH_WORDS = 12;
export const GLYPH_BYTES = GLYPH_WORDS * 4;
export const DEAD_GLYPH = 0xffffffff;

const INITIAL_CAP = 256;
const COMPACT_MIN = 64;

interface Range {
  start: number;
  count: number;
}

export class GlyphBuffer {
  /** bumps whenever the GPU buffer is reallocated ⇒ bind groups must be rebuilt */
  version: number;
  /** one past the highest glyph slot in use; the draw's instance count */
  highWater: number;
  /** total bytes uploaded via writeBuffer (stats) */
  uploadedBytes: number;

  private device: MirrorDevice;
  private cap: number;
  private words: Uint32Array;
  private ranges: Map<number, Range>;
  private garbage: number;
  private dirtyStart: number;
  private dirtyEnd: number;
  private fullUpload: boolean;
  private gpu: GPUBuffer;
  private gpuCap: number;
  private destroyed: boolean;

  constructor( device: MirrorDevice, initialCap: number = INITIAL_CAP ){
    this.device = device;
    this.version = 0;
    this.highWater = 0;
    this.uploadedBytes = 0;
    this.cap = initialCap;
    this.words = new Uint32Array( initialCap * GLYPH_WORDS );
    this.ranges = new Map();
    this.garbage = 0;
    this.dirtyStart = Infinity;
    this.dirtyEnd = 0;
    this.fullUpload = false;
    this.destroyed = false;
    this.gpuCap = initialCap;
    this.gpu = this.createGpuBuffer( initialCap );
  }

  /** live glyph count (for stats) */
  count(): number {
    return this.highWater - this.garbage;
  }

  buffer(): GPUBuffer {
    return this.gpu;
  }

  /**
   * Replace (or clear, with null) a node's glyph run.  `glyphWords` is the
   * interleaved 10-words-per-glyph data (f32 fields bit-cast into u32).
   */
  set( nodeSlot: number, glyphWords: Uint32Array | null ): void {
    const old = this.ranges.get( nodeSlot );

    if( old != null ){
      for( let i = 0; i < old.count; i++ ){
        this.words[ ( old.start + i ) * GLYPH_WORDS ] = DEAD_GLYPH;
      }

      this.markDirty( old.start, old.start + old.count );
      this.ranges.delete( nodeSlot );
      this.garbage += old.count;
    }

    if( glyphWords != null && glyphWords.length > 0 ){
      const count = glyphWords.length / GLYPH_WORDS;

      if( !Number.isInteger( count ) ){
        throw new Error( 'Glyph data must be a whole number of glyphs' );
      }

      this.ensureCapacity( this.highWater + count );
      this.words.set( glyphWords, this.highWater * GLYPH_WORDS );
      this.ranges.set( nodeSlot, { start: this.highWater, count } );
      this.markDirty( this.highWater, this.highWater + count );
      this.highWater += count;
    }

    if( this.garbage > COMPACT_MIN && this.garbage > this.highWater / 2 ){
      this.compact();
    }
  }

  /** Upload pending changes; no-op when clean. */
  sync(): void {
    if( this.destroyed ){ return; }

    if( this.gpuCap !== this.cap ){
      const old = this.gpu;

      this.gpu = this.createGpuBuffer( this.cap ); // uploads the full contents
      this.gpuCap = this.cap;
      this.version++;
      this.fullUpload = false;
      this.dirtyStart = Infinity;
      this.dirtyEnd = 0;

      this.device.queue.onSubmittedWorkDone().then( () => old.destroy() );

      return;
    }

    let start: number;
    let end: number;

    if( this.fullUpload ){
      start = 0;
      end = this.highWater;
    } else if( this.dirtyStart < this.dirtyEnd ){
      start = this.dirtyStart;
      end = Math.min( this.dirtyEnd, this.highWater );
    } else {
      return;
    }

    if( end > start ){
      const byteStart = start * GLYPH_BYTES;
      const byteLength = ( end - start ) * GLYPH_BYTES;

      this.device.queue.writeBuffer(
        this.gpu, byteStart,
        this.words.buffer, this.words.byteOffset + byteStart, byteLength
      );

      this.uploadedBytes += byteLength;
    }

    this.fullUpload = false;
    this.dirtyStart = Infinity;
    this.dirtyEnd = 0;
  }

  destroy(): void {
    this.destroyed = true;
    this.gpu.destroy();
  }

  private markDirty( start: number, end: number ): void {
    this.dirtyStart = Math.min( this.dirtyStart, start );
    this.dirtyEnd = Math.max( this.dirtyEnd, end );
  }

  private ensureCapacity( needed: number ): void {
    if( needed <= this.cap ){ return; }

    let cap = this.cap;

    while( cap < needed ){ cap *= 2; }

    const grown = new Uint32Array( cap * GLYPH_WORDS );

    grown.set( this.words );
    this.words = grown;
    this.cap = cap;
    // the GPU-side realloc + full re-upload happens on the next sync()
  }

  private compact(): void {
    const compacted = new Uint32Array( this.cap * GLYPH_WORDS );
    let write = 0;

    for( const [ nodeSlot, range ] of this.ranges ){
      compacted.set(
        this.words.subarray( range.start * GLYPH_WORDS, ( range.start + range.count ) * GLYPH_WORDS ),
        write * GLYPH_WORDS
      );

      this.ranges.set( nodeSlot, { start: write, count: range.count } );
      write += range.count;
    }

    this.words = compacted;
    this.highWater = write;
    this.garbage = 0;
    this.fullUpload = true; // stale tail beyond highWater is never drawn
  }

  private createGpuBuffer( cap: number ): GPUBuffer {
    const buffer = this.device.createBuffer( {
      label: 'cy-gpu:glyphs',
      size: Math.max( cap * GLYPH_BYTES, 4 ),
      usage: BUFFER_USAGE.STORAGE | BUFFER_USAGE.COPY_DST
    } );

    // full upload of current contents (mirrors ColumnMirror realloc behavior)
    if( this.highWater > 0 ){
      const byteLength = this.highWater * GLYPH_BYTES;

      this.device.queue.writeBuffer( buffer, 0, this.words.buffer, this.words.byteOffset, byteLength );
      this.uploadedBytes += byteLength;
    }

    return buffer;
  }
}

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

CPU-canonical layout, 14 words (56 bytes) per glyph, matching the WGSL
Glyph struct:
  u32 owner word (0xffffffff = dead; else bits 0..30 the owner slot, bit
  31 the autorotate flag — set only on the edge stream), u32 packed RGBA
  color, f32 offsetX/offsetY (model px from the anchor, quad top-left),
  f32 w/h (model px), f32 u0/v0/u1/v1,
  u32 packed outline RGBA, f32 outline half-width in SDF sample units,
  f32 zoomDprMin (min-zoomed-font-size / fontSize; the glyph cull hides
  the glyph when frame.zoomDpr < zoomDprMin — round 13 D2), f32 endParam
  (0 on the node and mid-edge streams; on the end-label streams the sign
  picks the end and |v| - 1 is the arc offset — round 13 D4).
A negative u0 marks a solid background quad (no atlas sample); its v0
carries the run's glyph-block height for LOD purposes.
*/

/*
Round 27.7 widened this from 14 to 16 to carry a per-glyph rotation.
15 would have been enough for the data but breaks the struct's 8-byte
alignment (the vec2f members), so 16 it is — 64 bytes per glyph, up from
56.  That is a real ~14% cost on the heaviest stream, paid so that a
numeric `text-rotation` needs no extra storage binding: the edge label
pipeline is already at 7 storage buffers against a base limit of 8.
*/
export const GLYPH_WORDS = 16;
export const GLYPH_BYTES = GLYPH_WORDS * 4;
export const DEAD_GLYPH = 0xffffffff;
/**
 * Bit 31 of the owner word: rotate the glyph to its edge's angle in the
 * VS (text-rotation: autorotate; edge glyph stream only — element slots
 * stay far below 2^31, and the dead sentinel is the full-ones word, so
 * the flag can never collide with either).
 */
export const GLYPH_ROTATE = 0x80000000;

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

  /**
   * Allocates the CPU staging array and its GPU buffer at the same
   * capacity.  One instance backs one glyph stream (node, mid-edge,
   * source, target labels), since the owner-slot key space and the
   * draw's instance range are per-stream.
   *
   * @param device — the device (or narrow mock) that owns the buffer
   * @param initialCap — glyph slots to preallocate; capacity doubles on
   * demand, so this only trades startup bytes against early reallocs
   */
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

  /**
   * The glyph instance storage buffer.  Its identity survives set() and
   * compaction but not a capacity growth, which sync() services by
   * reallocating and bumping `version` — so callers must re-read it (and
   * rebuild any bind group holding it) whenever `version` changes.
   */
  buffer(): GPUBuffer {
    return this.gpu;
  }

  /**
   * Slot compaction (19.4): drop every run at once — the owner slots
   * baked into the instances are stale wholesale, and an incremental
   * rebuild would leave ghost ranges keyed by old slots (a moved
   * element's stale run can alias a different element's new slot).  The
   * store marks all labels dirty at compaction, so the next process()
   * pass rebuilds the live runs against the new slots.
   */
  clear(): void {
    if( this.highWater === 0 && this.ranges.size === 0 ){ return; }

    this.ranges.clear();
    this.garbage = 0;
    this.highWater = 0;
    this.dirtyStart = Infinity;
    this.dirtyEnd = 0;
    this.fullUpload = true;
  }

  /**
   * Replace (or clear, with null) a node's glyph run.  `glyphWords` is the
   * interleaved GLYPH_WORDS-per-glyph data (f32 fields bit-cast into u32).
   */
  set( nodeSlot: number, glyphWords: Uint32Array | null ): void {
    const old = this.ranges.get( nodeSlot );

    // round 25.5: a same-count replacement — the steady state of a
    // font-size tween's per-tick rebuild — rewrites the run in place:
    // no tombstones, no highWater growth, no compaction churn, and the
    // dirty span covers exactly the rewritten range
    if( old != null && glyphWords != null && glyphWords.length === old.count * GLYPH_WORDS ){
      this.words.set( glyphWords, old.start * GLYPH_WORDS );
      this.markDirty( old.start, old.start + old.count );

      return;
    }

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

  /**
   * Destroys the GPU buffer immediately and latches sync() to a no-op.
   * Unlike the deferred destroy on realloc this does not wait on
   * submitted work, so the caller must already have stopped encoding
   * draws against this stream.  The CPU words are left intact.
   */
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

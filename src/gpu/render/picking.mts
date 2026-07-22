import { BUFFER_USAGE, MAP_MODE, TEXTURE_USAGE } from './webgpu-constants.mjs';

/*
GPU picking: an offscreen r32uint target drawn with the same order as the
render pass (edges then nodes).  Ids: 0 = background, node = slot + 1,
edge = (slot + 1) | 0x80000000.

Readback copies a 64×1 texel region (256 bytes, layout-aligned) around the
cursor into a ring of 3 staging buffers.  Requests within a frame coalesce
latest-wins; when the ring is exhausted the request resolves null (unknown).
Latency is 1–2 frames — fine for hover/tap.
*/

const REGION = 64; // texels per copied row: 64 × 4 bytes = 256
const RING = 3;

export const EDGE_PICK_BIT = 0x80000000;

interface RingSlot {
  buffer: GPUBuffer;
  busy: boolean;
}

interface PendingRequest {
  xPx: number;
  yPx: number;
  resolvers: ( ( id: number | null ) => void )[];
  requestedAt: number;
}

export interface InFlightCopy {
  slot: RingSlot;
  readIndex: number;
  resolvers: ( ( id: number | null ) => void )[];
  requestedAt: number;
}

export class Picking {
  /** rendered-frame latency of the most recent resolved pick */
  lastLatencyMs: number;

  private device: GPUDevice;
  private texture: GPUTexture | null;
  private view: GPUTextureView | null;
  private width: number;
  private height: number;
  private ring: RingSlot[];
  private pending: PendingRequest | null;
  private destroyed: boolean;

  constructor( device: GPUDevice ){
    this.device = device;
    this.texture = null;
    this.view = null;
    this.width = 0;
    this.height = 0;
    this.pending = null;
    this.destroyed = false;
    this.lastLatencyMs = 0;

    this.ring = Array.from( { length: RING }, ( _, i ) => ( {
      buffer: device.createBuffer( {
        label: `cy-gpu:pick-staging-${i}`,
        size: REGION * 4,
        usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST
      } ),
      busy: false
    } ) );
  }

  resize( width: number, height: number ): void {
    if( this.destroyed || ( width === this.width && height === this.height ) ){ return; }

    this.texture?.destroy();
    this.width = width;
    this.height = height;
    this.texture = this.device.createTexture( {
      label: 'cy-gpu:pick-target',
      size: { width: Math.max( 1, width ), height: Math.max( 1, height ) },
      format: 'r32uint',
      usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.COPY_SRC
    } );
    this.view = this.texture.createView();
  }

  targetView(): GPUTextureView | null {
    return this.view;
  }

  hasPending(): boolean {
    return this.pending != null;
  }

  /** Queue a pick at device-px coordinates; coalesces latest-wins within a frame. */
  request( xPx: number, yPx: number ): Promise<number | null> {
    return new Promise( resolve => {
      if( this.destroyed ){
        resolve( null );

        return;
      }

      if( this.pending == null ){
        this.pending = { xPx, yPx, resolvers: [ resolve ], requestedAt: performance.now() };
      } else {
        // latest-wins: earlier unprocessed requests resolve with the newest result
        this.pending.xPx = xPx;
        this.pending.yPx = yPx;
        this.pending.resolvers.push( resolve );
      }
    } );
  }

  /**
   * Encode the staging copy for the pending request (call after the pick
   * pass on the same encoder).  Returns the in-flight token to pass to
   * `finish()` after submit, or null when idle or the ring is full.
   */
  encodeCopy( encoder: GPUCommandEncoder ): InFlightCopy | null {
    const pending = this.pending;

    if( pending == null || this.texture == null ){ return null; }

    this.pending = null;

    const slot = this.ring.find( s => !s.busy );

    if( slot == null ){ // ring full: drop (resolve unknown)
      for( const resolve of pending.resolvers ){ resolve( null ); }

      return null;
    }

    const x = clamp( Math.round( pending.xPx ), 0, this.width - 1 );
    const y = clamp( Math.round( pending.yPx ), 0, this.height - 1 );
    const copyWidth = Math.min( REGION, this.width );
    const x0 = clamp( x - REGION / 2, 0, this.width - copyWidth );

    slot.busy = true;

    encoder.copyTextureToBuffer(
      { texture: this.texture, origin: { x: x0, y } },
      { buffer: slot.buffer }, // single-row copy: bytesPerRow not required
      { width: copyWidth, height: 1 }
    );

    return { slot, readIndex: x - x0, resolvers: pending.resolvers, requestedAt: pending.requestedAt };
  }

  /** Map the staging buffer and resolve the request (call after queue.submit). */
  async finish( inFlight: InFlightCopy ): Promise<void> {
    let id: number | null = null;

    try {
      await inFlight.slot.buffer.mapAsync( MAP_MODE.READ );

      const data = new Uint32Array( inFlight.slot.buffer.getMappedRange() );

      id = data[ inFlight.readIndex ];
      inFlight.slot.buffer.unmap();
      this.lastLatencyMs = performance.now() - inFlight.requestedAt;
    } catch {
      id = null; // device lost or destroyed mid-flight
    } finally {
      inFlight.slot.busy = false;
    }

    for( const resolve of inFlight.resolvers ){ resolve( id ); }
  }

  destroy(): void {
    this.destroyed = true;

    if( this.pending != null ){
      for( const resolve of this.pending.resolvers ){ resolve( null ); }

      this.pending = null;
    }

    this.texture?.destroy();

    for( const slot of this.ring ){
      slot.buffer.destroy();
    }
  }
}

const clamp = ( value: number, min: number, max: number ): number => {
  return Math.max( min, Math.min( max, value ) );
};

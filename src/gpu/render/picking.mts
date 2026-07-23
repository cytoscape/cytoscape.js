import { BUFFER_USAGE, MAP_MODE, TEXTURE_USAGE } from './webgpu-constants.mjs';

/*
GPU picking against a small fixed tile.

The pick pass draws into a fixed 64×64 r32uint tile *centered on the
cursor*: the renderer binds a pick-specific Frame uniform whose viewport is
the tile and whose pan is offset by the tile origin, so the cull pass's
viewport test collapses everything that doesn't overlap the cursor region —
the pick pass costs O(region), not O(scene).  Nodes pick synchronously on
the CPU (cpu-pick.mts), so the tile contains edges only.  Ids: 0 =
background, edge = (slot + 1) | 0x80000000 (the node encoding is retained
in decode for compatibility).

Readback copies the whole tile (16 KB; readback cost is sync overhead, not
size) into a ring of 3 staging buffers.  The resolved tile doubles as a
**pick cache**: while the cursor stays inside it and neither the viewport
nor any pick-affecting geometry has changed, later picks answer instantly
from `cachedIdAt()` with no GPU work at all — at the hover throttle, slow
to medium mouse movement hits the cache for most ticks.  The renderer
invalidates on viewport events and geometry dirt (an epoch guard drops
readbacks that raced an invalidation).

Requests within a frame coalesce latest-wins; when the ring is exhausted
the request resolves null (unknown).  The pick pass is submitted in its own
command buffer ahead of any scene draw, so mapAsync never waits behind a
full-frame render.
*/

/** pick tile size, device px; the cursor sits at the center texel */
export const PICK_TILE = 64;

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
  resolvers: ( ( id: number | null ) => void )[];
  requestedAt: number;
  tileX: number;
  tileY: number;
  epoch: number;
}

const TILE_BYTES = PICK_TILE * PICK_TILE * 4; // r32uint; bytesPerRow 256 ✓

export class Picking {
  /** request-to-resolution latency of the most recent resolved GPU pick */
  lastLatencyMs: number;

  private texture: GPUTexture;
  private view: GPUTextureView;
  private ring: RingSlot[];
  private pending: PendingRequest | null;
  private cacheTile: Uint32Array | null;
  private cacheX: number;
  private cacheY: number;
  private cacheEpoch: number;
  private destroyed: boolean;

  constructor( device: GPUDevice ){
    this.pending = null;
    this.cacheTile = null;
    this.cacheX = 0;
    this.cacheY = 0;
    this.cacheEpoch = 0;
    this.destroyed = false;
    this.lastLatencyMs = 0;

    this.texture = device.createTexture( {
      label: 'cy-gpu:pick-tile',
      size: { width: PICK_TILE, height: PICK_TILE },
      format: 'r32uint',
      usage: TEXTURE_USAGE.RENDER_ATTACHMENT | TEXTURE_USAGE.COPY_SRC
    } );
    this.view = this.texture.createView();

    this.ring = Array.from( { length: RING }, ( _, i ) => ( {
      buffer: device.createBuffer( {
        label: `cy-gpu:pick-staging-${i}`,
        size: TILE_BYTES,
        usage: BUFFER_USAGE.MAP_READ | BUFFER_USAGE.COPY_DST
      } ),
      busy: false
    } ) );
  }

  /** Cached id at device-px coordinates from the last resolved tile, or
   * null when the point is outside it (or the cache was invalidated). */
  cachedIdAt( xPx: number, yPx: number ): number | null {
    if( this.cacheTile == null ){ return null; }

    const tx = Math.floor( xPx ) - this.cacheX;
    const ty = Math.floor( yPx ) - this.cacheY;

    if( tx < 0 || tx >= PICK_TILE || ty < 0 || ty >= PICK_TILE ){ return null; }

    return this.cacheTile[ ty * PICK_TILE + tx ];
  }

  /** Drop the cached tile (viewport moved or pick geometry changed).  The
   * epoch bump also voids any readback already in flight. */
  invalidateCache(): void {
    this.cacheTile = null;
    this.cacheEpoch++;
  }

  targetView(): GPUTextureView {
    return this.view;
  }

  hasPending(): boolean {
    return this.pending != null;
  }

  /** The coalesced pending cursor position (device px), for the pick uniform. */
  peekPending(): { xPx: number; yPx: number } | null {
    return this.pending == null ? null : { xPx: this.pending.xPx, yPx: this.pending.yPx };
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
   * Encode the whole-tile staging copy for the pending request (call after
   * the pick pass on the same encoder).  Returns the in-flight token to pass
   * to `finish()` after submit, or null when idle or the ring is full.
   */
  encodeCopy( encoder: GPUCommandEncoder ): InFlightCopy | null {
    const pending = this.pending;

    if( pending == null ){ return null; }

    this.pending = null;

    const slot = this.ring.find( s => !s.busy );

    if( slot == null ){ // ring full: drop (resolve unknown)
      for( const resolve of pending.resolvers ){ resolve( null ); }

      return null;
    }

    slot.busy = true;

    encoder.copyTextureToBuffer(
      { texture: this.texture },
      { buffer: slot.buffer, bytesPerRow: PICK_TILE * 4 },
      { width: PICK_TILE, height: PICK_TILE }
    );

    return {
      slot,
      resolvers: pending.resolvers,
      requestedAt: pending.requestedAt,
      // tile origin in device px; must match writePickUniform's offsets
      tileX: Math.floor( pending.xPx ) - PICK_TILE / 2,
      tileY: Math.floor( pending.yPx ) - PICK_TILE / 2,
      epoch: this.cacheEpoch
    };
  }

  /** Map the staging buffer, cache the tile and resolve the request (call
   * after queue.submit). */
  async finish( inFlight: InFlightCopy ): Promise<void> {
    let id: number | null = null;

    try {
      await inFlight.slot.buffer.mapAsync( MAP_MODE.READ );

      const data = new Uint32Array( inFlight.slot.buffer.getMappedRange() );

      id = data[ ( PICK_TILE / 2 ) * PICK_TILE + PICK_TILE / 2 ]; // cursor texel

      // keep the tile as the pick cache — unless an invalidation raced
      // this readback, in which case the data is already stale
      if( !this.destroyed && inFlight.epoch === this.cacheEpoch ){
        this.cacheTile = data.slice();
        this.cacheX = inFlight.tileX;
        this.cacheY = inFlight.tileY;
      }

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

    this.texture.destroy();

    for( const slot of this.ring ){
      slot.buffer.destroy();
    }
  }
}

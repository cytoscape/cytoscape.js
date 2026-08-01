/*
ImageRegistry (round 15.1): the unique-image pool behind the
`background-image` family.

Unique images dedup by (kind, crossorigin, url) into refcounted entries —
the string-dictionary discipline applied to rasters.  Each rgba entry is
assigned a size *tier* (IMAGE_TIER_SIZES; texture_2d_array layers
renderer-side, round 15.3) from its decoded size; `sdf-icon` entries
raster once at SDF_IMAGE_SIZE for the single r8 icon array (round 15.5)
and carry no rgba tier.  Entry ids are slots: freed ids recycle through a
free-list, and the renderer reclaims their layers via `takeFreed()`.

Decoding runs behind an injectable async rasterizer so the registry is
fully Node-testable and headless-safe: without a decoder entries stay
pending and nothing throws; `setDecoder()` (the renderer supplies the
browser decoder at mount) kicks every pending entry.  A failed decode
warns once per url and renders imageless — no per-element error state
(recorded).  A decode that resolves after its entry was freed is dropped
by object identity, so recycled ids can never receive stale rasters.

Vector sources (SVG) re-raster losslessly: `promote(id, demandPx)`
re-decodes a vector entry at the smallest tier covering the on-screen
demand (the 15.6 zoom-promotion meter calls this; exports call it at
export scale).  Raster sources never promote — source resolution is
their ceiling, as in v3.
*/

/** rgba tier sizes (px, longest side); the last entry is the cap tier
 * (`imageMaxSize` trims or extends this per renderer instance). */
export const IMAGE_TIER_SIZES: readonly number[] = [ 128, 512, 1024 ];

/** fixed raster size for sdf-icon entries (the glyph-EDT path, 15.5) */
export const SDF_IMAGE_SIZE = 128;

export const IMAGE_KIND_AUTO = 0;
export const IMAGE_KIND_SDF = 1;

export const IMAGE_PENDING = 0;
export const IMAGE_READY = 1;
export const IMAGE_FAILED = 2;

/** What a decoder yields: an opaque raster handle plus its dimensions.
 * `data` is an ImageBitmap in the browser; tests pass anything. */
export interface DecodedImage {
  data: unknown;
  width: number;
  height: number;
  /** vector sources (SVG) re-raster losslessly at any target size */
  vector: boolean;
}

export interface ImageDecodeOpts {
  crossOrigin: string;
  /** raster size hint (px, longest side); 0 = the source's natural size */
  targetPx: number;
  /** rasterize for the single-channel sdf-icon path */
  sdf: boolean;
}

export type ImageDecoder = ( url: string, opts: ImageDecodeOpts ) => Promise<DecodedImage>;

export interface ImageEntry {
  id: number;
  url: string;
  kind: number;
  crossOrigin: string;
  refCount: number;
  status: number;
  /** opaque decoded raster (renderer uploads it; null until ready) */
  data: unknown;
  /** native source dims (vector: the intrinsic size of the last raster) */
  width: number;
  height: number;
  vector: boolean;
  /** rgba tier index into IMAGE_TIER_SIZES; -1 until ready and for sdf entries */
  tier: number;
  /** longest side of the current raster (vector promotion compares demand to this) */
  rasterPx: number;
}

export class ImageRegistry {
  private entries: ( ImageEntry | null )[] = [];
  private freeIds: number[] = [];
  private byKey = new Map<string, number>();
  private decoder: ImageDecoder | null = null;
  private readyQueue: number[] = [];
  private freedQueue: number[] = [];
  private warned = new Set<string>();
  private tiers: readonly number[];

  /** fires when any entry changes state (ready, failed, freed) — the
   * store routes it to the dirty scheduler so a frame redraws */
  onChange: ( () => void ) | null = null;

  constructor( tierSizes: readonly number[] = IMAGE_TIER_SIZES ){
    this.tiers = tierSizes;
  }

  /** the smallest tier covering px, else the cap tier */
  tierFor( px: number ): number {
    for( let i = 0; i < this.tiers.length; i++ ){
      if( px <= this.tiers[ i ] ){ return i; }
    }

    return this.tiers.length - 1;
  }

  acquire( url: string, kind: number, crossOrigin: string = 'anonymous' ): number {
    const key = `${kind}|${crossOrigin}|${url}`;
    const existing = this.byKey.get( key );

    if( existing != null ){
      this.entries[ existing ]!.refCount++;

      return existing;
    }

    const id = this.freeIds.length > 0 ? this.freeIds.pop()! : this.entries.length;
    const entry: ImageEntry = {
      id, url, kind, crossOrigin,
      refCount: 1,
      status: IMAGE_PENDING,
      data: null,
      width: 0,
      height: 0,
      vector: false,
      tier: -1,
      rasterPx: 0
    };

    this.entries[ id ] = entry;
    this.byKey.set( key, id );

    // a url that already failed once stays failed: warn-once, no re-kick
    if( this.warned.has( url ) ){
      entry.status = IMAGE_FAILED;
    } else {
      this.kick( entry );
    }

    return id;
  }

  release( id: number ): void {
    const entry = this.entries[ id ];

    if( entry == null ){ return; }

    if( --entry.refCount > 0 ){ return; }

    this.byKey.delete( `${entry.kind}|${entry.crossOrigin}|${entry.url}` );
    this.entries[ id ] = null;
    this.freeIds.push( id );
    this.freedQueue.push( id );
    this.onChange?.();
  }

  get( id: number ): ImageEntry | null {
    return this.entries[ id ] ?? null;
  }

  /** Attach (or replace) the async rasterizer; kicks every pending entry. */
  setDecoder( decoder: ImageDecoder | null ): void {
    this.decoder = decoder;

    if( decoder == null ){ return; }

    for( const entry of this.entries ){
      if( entry != null && entry.status === IMAGE_PENDING ){ this.kick( entry ); }
    }
  }

  /**
   * Re-raster a vector entry to cover an on-screen demand (px, longest
   * side).  Snaps to the smallest tier covering the demand, clamped at
   * the cap tier; raster sources and already-covered demands no-op.
   */
  promote( id: number, demandPx: number ): void {
    const entry = this.entries[ id ];

    if( entry == null || !entry.vector || entry.status !== IMAGE_READY ){ return; }

    const target = this.tiers[ this.tierFor( demandPx ) ];

    if( target <= entry.rasterPx ){ return; }

    this.kick( entry, target );
  }

  /** entry ids decoded since the last call; returns-and-clears */
  takeReady(): number[] {
    if( this.readyQueue.length === 0 ){ return []; }

    const out = this.readyQueue;

    this.readyQueue = [];

    return out;
  }

  /** entry ids freed since the last call; returns-and-clears */
  takeFreed(): number[] {
    if( this.freedQueue.length === 0 ){ return []; }

    const out = this.freedQueue;

    this.freedQueue = [];

    return out;
  }

  liveCount(): number {
    return this.byKey.size;
  }

  pendingCount(): number {
    let n = 0;

    for( const entry of this.entries ){
      if( entry != null && entry.status === IMAGE_PENDING ){ n++; }
    }

    return n;
  }

  private kick( entry: ImageEntry, targetPx: number = 0 ): void {
    if( this.decoder == null ){ return; }

    const sdf = entry.kind === IMAGE_KIND_SDF;
    const opts: ImageDecodeOpts = {
      crossOrigin: entry.crossOrigin,
      targetPx: sdf ? SDF_IMAGE_SIZE : targetPx,
      sdf
    };

    this.decoder( entry.url, opts ).then( decoded => {
      // dropped if the entry was freed (or recycled) while in flight
      if( this.entries[ entry.id ] !== entry ){ return; }

      entry.data = decoded.data;
      entry.width = decoded.width;
      entry.height = decoded.height;
      entry.vector = decoded.vector;
      entry.rasterPx = Math.max( decoded.width, decoded.height );
      entry.tier = sdf ? -1 : this.tierFor( entry.rasterPx );
      entry.status = IMAGE_READY;
      this.readyQueue.push( entry.id );
      this.onChange?.();
    }, ( err: unknown ) => {
      if( this.entries[ entry.id ] !== entry ){ return; }

      if( !this.warned.has( entry.url ) ){
        this.warned.add( entry.url );
        console.warn( `The background image '${entry.url}' failed to load and will not render`,
          err instanceof Error ? `(${err.message})` : '' );
      }

      entry.status = IMAGE_FAILED;
      this.onChange?.();
    } );
  }
}

import type { Position } from './types.mjs';

export interface ZoomOptions {
  level: number;
  /** model point to keep fixed while zooming */
  position?: Position;
  /** rendered (on-screen) point to keep fixed while zooming */
  renderedPosition?: Position;
}

export interface Extent {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
}

export interface BoundsLike {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  w: number;
  h: number;
}

/** What the viewport needs from its owner (the core): rendered dimensions. */
export interface ViewportHost {
  width(): number;
  height(): number;
}

/**
 * Core-owned zoom/pan state and viewport math.  Pure state — the core wraps
 * the setters and emits zoom/pan/viewport/fit events.
 */
export class Viewport {
  /** Lower zoom bound; the current zoom is clamped into it on every set. */
  minZoom: number;

  /** Upper zoom bound; the current zoom is clamped into it on every set. */
  maxZoom: number;

  private host: ViewportHost;
  private _zoom: number;
  private _pan: Position;

  /**
   * @param host — supplies the rendered viewport dimensions (the core)
   * @param opts — initial `zoom` (default 1, clamped) and `pan` (default
   *   the origin), plus the `minZoom`/`maxZoom` bounds, which default
   *   wide enough (1e-50 … 1e50) to be effectively unbounded
   */
  constructor( host: ViewportHost, opts: { zoom?: number; pan?: Position; minZoom?: number; maxZoom?: number } = {} ){
    this.host = host;
    this.minZoom = opts.minZoom ?? 1e-50;
    this.maxZoom = opts.maxZoom ?? 1e50;
    this._zoom = this.clampZoom( opts.zoom ?? 1 );
    this._pan = { x: opts.pan?.x ?? 0, y: opts.pan?.y ?? 0 };
  }

  /**
   * The current zoom level.
   *
   * @returns model-to-rendered scale
   */
  zoom(): number {
    return this._zoom;
  }

  /**
   * The current pan.  Live internal object (as in v3) — treat as read-only.
   *
   * @returns the rendered-space translation applied before the zoom; the
   *   *same* object on every call, which the setters replace rather than
   *   mutate, so a caller that wants a stable snapshot must copy it
   */
  pan(): Position {
    return this._pan;
  }

  /**
   * Set the zoom, optionally about a fixed point.
   *
   * @param zoom — the level, or `{ level, position | renderedPosition }`
   *   to keep that point stationary while zooming
   * @returns true when the state changed
   */
  setZoom( zoom: number | ZoomOptions ): boolean {
    let level: number;
    let rendered: Position | null = null;

    if( typeof zoom === 'number' ){
      level = zoom;
    } else {
      level = zoom.level;

      if( zoom.renderedPosition != null ){
        rendered = zoom.renderedPosition;
      } else if( zoom.position != null ){
        rendered = this.modelToRendered( zoom.position );
      }
    }

    if( typeof level !== 'number' || !isFinite( level ) || level <= 0 ){ return false; }

    level = this.clampZoom( level );

    if( rendered == null ){
      if( level === this._zoom ){ return false; }

      this._zoom = level;

      return true;
    }

    // keep the model point under `rendered` fixed on screen
    const model = this.renderedToModel( rendered );
    const pan = {
      x: rendered.x - model.x * level,
      y: rendered.y - model.y * level
    };

    if( level === this._zoom && pan.x === this._pan.x && pan.y === this._pan.y ){ return false; }

    this._zoom = level;
    this._pan = pan;

    return true;
  }

  /**
   * Set the pan.
   *
   * @param pan — the rendered-space pan; non-numeric components are
   *   rejected rather than written
   * @returns true when the state changed
   */
  setPan( pan: Position ): boolean {
    if( typeof pan.x !== 'number' || typeof pan.y !== 'number' ){ return false; }
    if( pan.x === this._pan.x && pan.y === this._pan.y ){ return false; }

    this._pan = { x: pan.x, y: pan.y };

    return true;
  }

  /**
   * Shift the pan by a rendered-space delta.
   *
   * @param delta — the offset to add; missing components count as 0
   * @returns true when the pan changed
   */
  panBy( delta: Position ): boolean {
    return this.setPan( { x: this._pan.x + ( delta.x || 0 ), y: this._pan.y + ( delta.y || 0 ) } );
  }

  /**
   * Set the min zoom bound and re-clamp the current zoom.
   *
   * @param min — the new lower bound
   * @returns true when the current zoom moved to satisfy it
   */
  setMinZoom( min: number ): boolean {
    this.minZoom = min;

    return this.reclampZoom();
  }

  /**
   * Set the max zoom bound and re-clamp the current zoom.
   *
   * @param max — the new upper bound
   * @returns true when the current zoom moved to satisfy it
   */
  setMaxZoom( max: number ): boolean {
    this.maxZoom = max;

    return this.reclampZoom();
  }

  private reclampZoom(): boolean {
    const clamped = this.clampZoom( this._zoom );

    if( clamped === this._zoom ){ return false; }

    this._zoom = clamped;

    return true;
  }

  /**
   * The { zoom, pan } that would fit the given bounds — computed, not
   * applied.
   *
   * @param bb — the model-space bounds to fit
   * @param padding — rendered px of margin on every side
   * @returns the fitting viewport, with the zoom clamped to the bounds
   */
  fitViewport( bb: BoundsLike, padding: number = 0 ): { zoom: number; pan: Position } {
    const w = this.host.width();
    const h = this.host.height();

    if( bb.w === 0 && bb.h === 0 ){
      // nothing to scale to; keep zoom and just center on the point
      return { zoom: this._zoom, pan: this.centerPan( bb, this._zoom ) };
    }

    const zoomW = bb.w === 0 ? Infinity : ( w - 2 * padding ) / bb.w;
    const zoomH = bb.h === 0 ? Infinity : ( h - 2 * padding ) / bb.h;
    const zoom = this.clampZoom( Math.min( zoomW, zoomH ) );

    return { zoom, pan: this.centerPan( bb, zoom ) };
  }

  /**
   * Compute-and-apply a fit to the given bounds.
   *
   * @param bb — the model-space bounds to fit
   * @param padding — rendered px of margin on every side
   * @returns true when the state changed
   */
  fit( bb: BoundsLike, padding: number = 0 ): boolean {
    const { zoom, pan } = this.fitViewport( bb, padding );
    const changed = zoom !== this._zoom || pan.x !== this._pan.x || pan.y !== this._pan.y;

    this._zoom = zoom;
    this._pan = pan;

    return changed;
  }

  /**
   * The pan that would center the given bounds.
   *
   * @param bb — the model-space bounds to center
   * @param zoom — the zoom to center at; defaults to the current one
   * @returns the pan
   */
  centerPan( bb: BoundsLike, zoom: number = this._zoom ): Position {
    return {
      x: ( this.host.width() - zoom * ( bb.x1 + bb.x2 ) ) / 2,
      y: ( this.host.height() - zoom * ( bb.y1 + bb.y2 ) ) / 2
    };
  }

  /**
   * Pan (keeping the zoom) so the given bounds are centered.
   *
   * @param bb — the model-space bounds to center
   * @returns true when the state changed
   */
  centerOn( bb: BoundsLike ): boolean {
    return this.setPan( this.centerPan( bb ) );
  }

  /**
   * The rendered (on-screen) viewport rectangle.
   *
   * @returns the canvas rectangle in rendered px, always anchored at the
   *   origin — pan and zoom move the *content*, not this box, so it
   *   answers the container's size and nothing about the view
   */
  renderedExtent(): Extent {
    const w = this.host.width();
    const h = this.host.height();

    return { x1: 0, y1: 0, x2: w, y2: h, w, h };
  }

  /**
   * The model-coordinate rectangle currently visible.
   *
   * @returns the container's rendered box projected back through the
   *   current pan and zoom — so it moves as the view moves, and its `w`/`h`
   *   shrink as the zoom rises
   */
  extent(): Extent {
    const zoom = this._zoom;
    const pan = this._pan;
    const x1 = -pan.x / zoom;
    const y1 = -pan.y / zoom;
    const x2 = ( this.host.width() - pan.x ) / zoom;
    const y2 = ( this.host.height() - pan.y ) / zoom;

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  /**
   * Project a model-space point into rendered (CSS px) space.
   *
   * @param pos — the model-space point
   * @returns the rendered-space point
   */
  modelToRendered( pos: Position ): Position {
    return { x: pos.x * this._zoom + this._pan.x, y: pos.y * this._zoom + this._pan.y };
  }

  /**
   * Unproject a rendered (CSS px) point back into model space — the
   * inverse of `modelToRendered`.
   *
   * @param pos — the rendered-space point
   * @returns the model-space point
   */
  renderedToModel( pos: Position ): Position {
    return { x: ( pos.x - this._pan.x ) / this._zoom, y: ( pos.y - this._pan.y ) / this._zoom };
  }

  private clampZoom( zoom: number ): number {
    return Math.max( this.minZoom, Math.min( this.maxZoom, zoom ) );
  }
}

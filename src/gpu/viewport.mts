import type { Position } from '../types.mjs';

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
  minZoom: number;
  maxZoom: number;

  private host: ViewportHost;
  private _zoom: number;
  private _pan: Position;

  constructor( host: ViewportHost, opts: { zoom?: number; pan?: Position; minZoom?: number; maxZoom?: number } = {} ){
    this.host = host;
    this.minZoom = opts.minZoom ?? 1e-50;
    this.maxZoom = opts.maxZoom ?? 1e50;
    this._zoom = this.clampZoom( opts.zoom ?? 1 );
    this._pan = { x: opts.pan?.x ?? 0, y: opts.pan?.y ?? 0 };
  }

  zoom(): number {
    return this._zoom;
  }

  pan(): Position {
    return { x: this._pan.x, y: this._pan.y };
  }

  /** Returns true when the state changed. */
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

  /** Returns true when the state changed. */
  setPan( pan: Position ): boolean {
    if( typeof pan.x !== 'number' || typeof pan.y !== 'number' ){ return false; }
    if( pan.x === this._pan.x && pan.y === this._pan.y ){ return false; }

    this._pan = { x: pan.x, y: pan.y };

    return true;
  }

  panBy( delta: Position ): boolean {
    return this.setPan( { x: this._pan.x + ( delta.x || 0 ), y: this._pan.y + ( delta.y || 0 ) } );
  }

  /** Compute-and-apply a fit to the given bounds; returns true when the state changed. */
  fit( bb: BoundsLike, padding: number = 0 ): boolean {
    const w = this.host.width();
    const h = this.host.height();

    if( bb.w === 0 && bb.h === 0 ){
      // nothing to scale to; just center on the point
      return this.centerOn( bb );
    }

    const zoomW = bb.w === 0 ? Infinity : ( w - 2 * padding ) / bb.w;
    const zoomH = bb.h === 0 ? Infinity : ( h - 2 * padding ) / bb.h;
    const zoom = this.clampZoom( Math.min( zoomW, zoomH ) );

    const pan = {
      x: ( w - zoom * ( bb.x1 + bb.x2 ) ) / 2,
      y: ( h - zoom * ( bb.y1 + bb.y2 ) ) / 2
    };

    const changed = zoom !== this._zoom || pan.x !== this._pan.x || pan.y !== this._pan.y;

    this._zoom = zoom;
    this._pan = pan;

    return changed;
  }

  /** Pan (keeping zoom) so the given bounds are centered; returns true when the state changed. */
  centerOn( bb: BoundsLike ): boolean {
    return this.setPan( {
      x: ( this.host.width() - this._zoom * ( bb.x1 + bb.x2 ) ) / 2,
      y: ( this.host.height() - this._zoom * ( bb.y1 + bb.y2 ) ) / 2
    } );
  }

  /** The model-coordinate rectangle currently visible. */
  extent(): Extent {
    const zoom = this._zoom;
    const pan = this._pan;
    const x1 = -pan.x / zoom;
    const y1 = -pan.y / zoom;
    const x2 = ( this.host.width() - pan.x ) / zoom;
    const y2 = ( this.host.height() - pan.y ) / zoom;

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  modelToRendered( pos: Position ): Position {
    return { x: pos.x * this._zoom + this._pan.x, y: pos.y * this._zoom + this._pan.y };
  }

  renderedToModel( pos: Position ): Position {
    return { x: ( pos.x - this._pan.x ) / this._zoom, y: ( pos.y - this._pan.y ) / this._zoom };
  }

  private clampZoom( zoom: number ): number {
    return Math.max( this.minZoom, Math.min( this.maxZoom, zoom ) );
  }
}

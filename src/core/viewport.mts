import * as is from '../is.mjs';
import * as math from '../math.mjs';

import type { Core } from './core-types.mjs';
import type { Collection } from '../collection/eles-types.mjs';
import type { Position, BoundingBox } from '../types.mjs';

/** Result of computing a zoom change about an optional focal point. */
interface ZoomedViewport {
  zoomed: boolean;
  panned: boolean;
  zoom: number;
  pan: Position;
}

/** A computed fit viewport (zoom + pan). */
interface FitViewport {
  zoom: number;
  pan: Position;
}

/** Params accepted by `zoom()` / `getZoomedViewport()` when zooming about a point. */
interface ZoomOptions {
  level?: number;
  position?: Position;
  renderedPosition?: Position;
}

/** Options accepted by `viewport()`. */
interface ViewportOptions {
  zoom?: number;
  pan?: Position;
  cancelOnFailedZoom?: boolean;
}

/** The contribution interface this mixin adds to `Core`. */
export interface CoreViewport {
  autolock(): boolean;
  autolock( bool: boolean ): Core;
  /** @deprecated backwards-compatibility alias of {@link autolock}. */
  autolockNodes(): boolean;
  autolockNodes( bool: boolean ): Core;

  autoungrabify(): boolean;
  autoungrabify( bool: boolean ): Core;
  /** @deprecated backwards-compatibility alias of {@link autoungrabify}. */
  autoungrabifyNodes(): boolean;
  autoungrabifyNodes( bool: boolean ): Core;

  autounselectify(): boolean;
  autounselectify( bool: boolean ): Core;

  selectionType(): 'single' | 'additive';
  selectionType( selType: 'single' | 'additive' ): Core;

  panningEnabled(): boolean;
  panningEnabled( bool: boolean ): Core;

  userPanningEnabled(): boolean;
  userPanningEnabled( bool: boolean ): Core;

  zoomingEnabled(): boolean;
  zoomingEnabled( bool: boolean ): Core;

  userZoomingEnabled(): boolean;
  userZoomingEnabled( bool: boolean ): Core;

  boxSelectionEnabled(): boolean;
  boxSelectionEnabled( bool: boolean ): Core;

  pan(): Position;
  pan( dim: string ): number;
  pan( dims: Position ): Core;
  pan( dim: string, val: number ): Core;

  panBy( dims: Position ): Core;
  panBy( dim: string, val: number ): Core;

  gc(): void;

  fit( elements?: Collection | string | BoundingBox | number, padding?: number ): Core;
  getFitViewport( elements?: Collection | string | BoundingBox | number, padding?: number ): FitViewport | undefined;

  zoomRange( min: number | { min?: number; max?: number }, max?: number ): Core;
  minZoom(): number;
  minZoom( zoom: number ): Core;
  maxZoom(): number;
  maxZoom( zoom: number ): Core;

  getZoomedViewport( params: number | ZoomOptions ): ZoomedViewport | null;
  zoom(): number;
  zoom( params: number | ZoomOptions ): Core;

  viewport( opts: ViewportOptions ): Core;

  center( elements?: Collection | string ): Core;
  /** Alias of {@link center}. */
  centre( elements?: Collection | string ): Core;
  getCenterPan( elements?: Collection | string, zoom?: number ): Position | undefined;

  reset(): Core;

  invalidateSize(): void;
  size(): { width: number; height: number };
  width(): number;
  height(): number;

  extent(): BoundingBox;
  renderedExtent(): BoundingBox;

  multiClickDebounceTime(): number;
  multiClickDebounceTime( int: number ): Core;
}

let defaultSelectionType = 'single';

let corefn = ({

  autolock: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.autolock = bool ? true : false;
    } else {
      return this._private.autolock;
    }

    return this; // chaining
  },

  autoungrabify: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.autoungrabify = bool ? true : false;
    } else {
      return this._private.autoungrabify;
    }

    return this; // chaining
  },

  autounselectify: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.autounselectify = bool ? true : false;
    } else {
      return this._private.autounselectify;
    }

    return this; // chaining
  },

  selectionType: function( this: Core, selType?: 'single' | 'additive' ){
    let _p = this._private;

    if( _p.selectionType == null ){
      _p.selectionType = defaultSelectionType as 'single' | 'additive';
    }

    if( selType !== undefined ){
      if( selType === 'additive' || selType === 'single' ){
        _p.selectionType = selType;
      }
    } else {
      return _p.selectionType;
    }

    return this;
  },

  panningEnabled: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.panningEnabled = bool ? true : false;
    } else {
      return this._private.panningEnabled;
    }

    return this; // chaining
  },

  userPanningEnabled: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.userPanningEnabled = bool ? true : false;
    } else {
      return this._private.userPanningEnabled;
    }

    return this; // chaining
  },

  zoomingEnabled: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.zoomingEnabled = bool ? true : false;
    } else {
      return this._private.zoomingEnabled;
    }

    return this; // chaining
  },

  userZoomingEnabled: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.userZoomingEnabled = bool ? true : false;
    } else {
      return this._private.userZoomingEnabled;
    }

    return this; // chaining
  },

  boxSelectionEnabled: function( this: Core, bool?: boolean ){
    if( bool !== undefined ){
      this._private.boxSelectionEnabled = bool ? true : false;
    } else {
      return this._private.boxSelectionEnabled;
    }

    return this; // chaining
  },

  pan: function( this: Core ){
    let args = arguments; // eslint-disable-line prefer-rest-params -- behavior keyed on arguments.length across call forms
    let pan = this._private.pan;
    let dim, val, dims, x, y;

    switch( args.length ){
    case 0: // .pan()
      return pan;

    case 1:

      if( is.string( args[0] ) ){ // .pan('x')
        dim = args[0];
        return pan[ dim as keyof Position ];

      } else if( is.plainObject( args[0] ) ){ // .pan({ x: 0, y: 100 })
        if( !this._private.panningEnabled ){
          return this;
        }

        dims = args[0] as Partial<Position>;
        x = dims.x;
        y = dims.y;

        if( is.number( x ) ){
          pan.x = x;
        }

        if( is.number( y ) ){
          pan.y = y;
        }

        this.emit( 'pan viewport' );
      }
      break;

    case 2: // .pan('x', 100)
      if( !this._private.panningEnabled ){
        return this;
      }

      dim = args[0];
      val = args[1];

      if( (dim === 'x' || dim === 'y') && is.number( val ) ){
        pan[ dim as 'x' | 'y' ] = val;
      }

      this.emit( 'pan viewport' );
      break;

    default:
      break; // invalid
    }

    this.notify('viewport');

    return this; // chaining
  },

  panBy: function( this: Core, arg0?: string | Partial<Position>, arg1?: number ){
    let args = arguments; // eslint-disable-line prefer-rest-params -- behavior keyed on arguments.length across call forms
    let pan = this._private.pan;
    let dim, val, dims, x, y;

    if( !this._private.panningEnabled ){
      return this;
    }

    switch( args.length ){
    case 1:

      if( is.plainObject( arg0 ) ){ // .panBy({ x: 0, y: 100 })
        dims = args[0] as Partial<Position>;
        x = dims.x;
        y = dims.y;

        if( is.number( x ) ){
          pan.x += x;
        }

        if( is.number( y ) ){
          pan.y += y;
        }

        this.emit( 'pan viewport' );
      }
      break;

    case 2: // .panBy('x', 100)
      dim = arg0;
      val = arg1;

      if( (dim === 'x' || dim === 'y') && is.number( val ) ){
        pan[ dim ] += val;
      }

      this.emit( 'pan viewport' );
      break;

    default:
      break; // invalid
    }

    this.notify('viewport');

    return this; // chaining
  },

  gc: function( this: Core ) {
    this.notify('gc');
  },

  fit: function( this: Core, elements?: Collection | string | BoundingBox | number, padding?: number ){
    let viewportState = this.getFitViewport( elements, padding );

    if( viewportState ){
      let _p = this._private;
      _p.zoom = viewportState.zoom;
      _p.pan = viewportState.pan;

      this.emit( 'pan zoom viewport' );

      this.notify('viewport');
    }

    return this; // chaining
  },

  getFitViewport: function( this: Core, elements?: Collection | string | BoundingBox | number, padding?: number ): FitViewport | undefined {
    if( is.number( elements ) && padding === undefined ){ // elements is optional
      padding = elements;
      elements = undefined;
    }

    if( !this._private.panningEnabled || !this._private.zoomingEnabled ){
      return;
    }

    // bb gets a w/h added below; type as a mutable bounding box
    let bb: BoundingBox | undefined;

    if( is.string( elements ) ){
      let sel = elements;
      elements = this.$( sel );

    } else if( is.boundingBox( elements ) ){ // assume bb
      let bbe = elements;
      bb = {
        x1: bbe.x1,
        y1: bbe.y1,
        x2: bbe.x2,
        y2: bbe.y2
      } as BoundingBox;

      bb.w = bb.x2 - bb.x1;
      bb.h = bb.y2 - bb.y1;

    } else if( !is.elementOrCollection( elements ) ){
      elements = this.mutableElements();
    }

    // narrow: after the branches above, a non-bb path yields a Collection
    let eles = elements as Collection;

    if( is.elementOrCollection( elements ) && eles.empty() ){ return; } // can't fit to nothing

    bb = bb || eles.boundingBox();

    let w = this.width();
    let h = this.height();
    let zoom;
    padding = is.number( padding ) ? padding : 0;

    if( !isNaN( w ) && !isNaN( h ) && w > 0 && h > 0 && !isNaN( bb.w ) && !isNaN( bb.h ) &&  bb.w > 0 && bb.h > 0 ){
      zoom = Math.min( (w - 2 * padding) / bb.w, (h - 2 * padding) / bb.h );

      // crop zoom
      zoom = zoom > this._private.maxZoom ? this._private.maxZoom : zoom;
      zoom = zoom < this._private.minZoom ? this._private.minZoom : zoom;

      let pan = { // now pan to middle
        x: (w - zoom * ( bb.x1 + bb.x2 )) / 2,
        y: (h - zoom * ( bb.y1 + bb.y2 )) / 2
      };

      return {
        zoom: zoom,
        pan: pan
      };
    }

    return;
  },

  zoomRange: function( this: Core, min: number | { min?: number; max?: number }, max?: number ){
    let _p = this._private;

    let minVal: number | undefined;
    let maxVal: number | undefined = max;

    if( max == null ){
      let opts = min as { min?: number; max?: number };

      minVal = opts.min;
      maxVal = opts.max;
    } else {
      minVal = min as number;
    }

    if( is.number( minVal ) && is.number( maxVal ) && minVal <= maxVal ){
      _p.minZoom = minVal;
      _p.maxZoom = maxVal;
    } else if( is.number( minVal ) && maxVal === undefined && minVal <= _p.maxZoom ){
      _p.minZoom = minVal;
    } else if( is.number( maxVal ) && minVal === undefined && maxVal >= _p.minZoom ){
      _p.maxZoom = maxVal;
    }

    return this;
  },

  minZoom: function( this: Core, zoom?: number ){
    if( zoom === undefined ){
      return this._private.minZoom;
    } else {
      return this.zoomRange({ min: zoom });
    }
  },

  maxZoom: function( this: Core, zoom?: number ){
    if( zoom === undefined ){
      return this._private.maxZoom;
    } else {
      return this.zoomRange({ max: zoom });
    }
  },

  getZoomedViewport: function( this: Core, params: number | ZoomOptions ): ZoomedViewport | null {
    let _p = this._private;
    let currentPan = _p.pan;
    let currentZoom = _p.zoom;
    let pos: Position | undefined; // in rendered px
    let zoom: number | undefined;
    let bail = false;

    if( !_p.zoomingEnabled ){ // zooming disabled
      bail = true;
    }

    if( is.number( params ) ){ // then set the zoom
      zoom = params;

    } else if( is.plainObject( params ) ){ // then zoom about a point
      let zParams = params as ZoomOptions;
      zoom = zParams.level;

      if( zParams.position != null ){
        pos = math.modelToRenderedPosition( zParams.position, currentZoom, currentPan );
      } else if( zParams.renderedPosition != null ){
        pos = zParams.renderedPosition;
      }

      if( pos != null && !_p.panningEnabled ){ // panning disabled
        bail = true;
      }
    }

    // crop zoom
    zoom = (zoom as number) > _p.maxZoom ? _p.maxZoom : zoom;
    zoom = (zoom as number) < _p.minZoom ? _p.minZoom : zoom;

    // can't zoom with invalid params
    if( bail || !is.number( zoom ) || zoom === currentZoom || ( pos != null && (!is.number( pos.x ) || !is.number( pos.y )) ) ){
      return null;
    }

    if( pos != null ){ // set zoom about position
      let pan1 = currentPan;
      let zoom1 = currentZoom;
      let zoom2 = zoom;

      let pan2 = {
        x: -zoom2 / zoom1 * (pos.x - pan1.x) + pos.x,
        y: -zoom2 / zoom1 * (pos.y - pan1.y) + pos.y
      };

      return {
        zoomed: true,
        panned: true,
        zoom: zoom2,
        pan: pan2
      };

    } else { // just set the zoom
      return {
        zoomed: true,
        panned: false,
        zoom: zoom,
        pan: currentPan
      };
    }
  },

  zoom: function( this: Core, params?: number | ZoomOptions ){
    if( params === undefined ){ // get
      return this._private.zoom;
    } else { // set
      let vp = this.getZoomedViewport( params );
      let _p = this._private;

      if( vp == null || !vp.zoomed ){ return this; }

      _p.zoom = vp.zoom;

      if( vp.panned ){
        _p.pan.x = vp.pan.x;
        _p.pan.y = vp.pan.y;
      }

      this.emit( 'zoom' + ( vp.panned ? ' pan' : '' ) + ' viewport' );

      this.notify('viewport');

      return this; // chaining
    }
  },

  viewport: function( this: Core, opts: ViewportOptions ){
    let _p = this._private;
    let zoomDefd = true;
    let panDefd = true;
    let events = []; // to trigger
    let zoomFailed = false;
    let panFailed = false;

    if( !opts ){ return this; }
    if( !is.number( opts.zoom ) ){ zoomDefd = false; }
    if( !is.plainObject( opts.pan ) ){ panDefd = false; }
    if( !zoomDefd && !panDefd ){ return this; }

    if( zoomDefd ){
      let z = opts.zoom as number;

      if( z < _p.minZoom || z > _p.maxZoom || !_p.zoomingEnabled ){
        zoomFailed = true;

      } else {
        _p.zoom = z;

        events.push( 'zoom' );
      }
    }

    if( panDefd && (!zoomFailed || !opts.cancelOnFailedZoom) && _p.panningEnabled ){
      let p = opts.pan as Position;

      if( is.number( p.x ) ){
        _p.pan.x = p.x;
        panFailed = false;
      }

      if( is.number( p.y ) ){
        _p.pan.y = p.y;
        panFailed = false;
      }

      if( !panFailed ){
        events.push( 'pan' );
      }
    }

    if( events.length > 0 ){
      events.push( 'viewport' );
      this.emit( events.join( ' ' ) );

      this.notify('viewport');
    }

    return this; // chaining
  },

  center: function( this: Core, elements?: Collection | string ){
    let pan = this.getCenterPan( elements );

    if( pan ){
      this._private.pan = pan;

      this.emit( 'pan viewport' );

      this.notify('viewport');
    }

    return this; // chaining
  },

  getCenterPan: function( this: Core, elements?: Collection | string, zoom?: number ): Position | undefined {
    if( !this._private.panningEnabled ){
      return;
    }

    if( is.string( elements ) ){
      let selector = elements;
      elements = this.mutableElements().filter( selector );
    } else if( !is.elementOrCollection( elements ) ){
      elements = this.mutableElements();
    }

    let eles = elements as Collection;

    if( eles.length === 0 ){ return; } // can't centre pan to nothing

    let bb = eles.boundingBox();
    let w = this.width();
    let h = this.height();
    zoom = zoom === undefined ? this._private.zoom : zoom;

    let pan = { // middle
      x: (w - zoom * ( bb.x1 + bb.x2 )) / 2,
      y: (h - zoom * ( bb.y1 + bb.y2 )) / 2
    };

    return pan;
  },

  reset: function( this: Core ){
    if( !this._private.panningEnabled || !this._private.zoomingEnabled ){
      return this;
    }

    this.viewport( {
      pan: { x: 0, y: 0 },
      zoom: 1
    } );

    return this; // chaining
  },

  invalidateSize: function( this: Core ){
    this._private.sizeCache = null;
  },

  size: function( this: Core ){
    let _p = this._private;
    let container = _p.container;
    let cy = this; // eslint-disable-line @typescript-eslint/no-this-alias

    return ( _p.sizeCache = (_p.sizeCache as { width: number; height: number } | undefined) || ( container ? (function(){
      let style = cy.window()!.getComputedStyle( container as HTMLElement );
      let val = function( name: string ){ return parseFloat( style.getPropertyValue( name ) ); };

      return {
        width: (container as HTMLElement).clientWidth - val('padding-left') - val('padding-right'),
        height: (container as HTMLElement).clientHeight - val('padding-top') - val('padding-bottom')
      };
    })() : { // fallback if no container (not 0 b/c can be used for dividing etc)
      width: 1,
      height: 1
    } ) ) as { width: number; height: number };
  },

  width: function( this: Core ){
    return this.size().width;
  },

  height: function( this: Core ){
    return this.size().height;
  },

  extent: function( this: Core ): BoundingBox {
    let pan = this._private.pan;
    let zoom = this._private.zoom;
    let rb = this.renderedExtent();

    let b = {
      x1: ( rb.x1 - pan.x ) / zoom,
      x2: ( rb.x2 - pan.x ) / zoom,
      y1: ( rb.y1 - pan.y ) / zoom,
      y2: ( rb.y2 - pan.y ) / zoom
    } as BoundingBox;

    b.w = b.x2 - b.x1;
    b.h = b.y2 - b.y1;

    return b;
  },

  renderedExtent: function( this: Core ): BoundingBox {
    let width = this.width();
    let height = this.height();

    return {
      x1: 0,
      y1: 0,
      x2: width,
      y2: height,
      w: width,
      h: height
    };
  },

  multiClickDebounceTime: function ( this: Core, int?: number ){
    if( int ) (this._private.multiClickDebounceTime = int);
    else return this._private.multiClickDebounceTime;
    return this; // chaining
  }
});

// the contributed methods are merged into Core.prototype; aliases below add
// the alias keys not present on the object literal's inferred type
let aliased = corefn as unknown as Record<string, unknown>;

// aliases
aliased.centre = corefn.center;

// backwards compatibility
aliased.autolockNodes = corefn.autolock;
aliased.autoungrabifyNodes = corefn.autoungrabify;

export default corefn;

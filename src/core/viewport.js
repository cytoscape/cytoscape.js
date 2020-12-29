import * as is from '../is';
import window from '../window';
import * as math from '../math';

let defaultSelectionType = 'single';

let corefn = ({

  /**
 * @typedef {object} cy_autolock
 * @property {object} NULL
 * @property {object} bool - A truthy value enables autolocking; a falsey value disables it.
 */

  /**
 * Get or set whether nodes are automatically locked (i.e. if `true`, nodes are locked despite their individual state).
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_autolock} bool - Get whether autolocking is enabled. | Set whether autolocking is enabled.
 * @methodName cy.autolock
 */
  autolock: function( bool ){
    if( bool !== undefined ){
      this._private.autolock = bool ? true : false;
    } else {
      return this._private.autolock;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_autoungrabify
 * @property {object} NULL
 * @property {object} bool - A truthy value enables autoungrabifying; a falsey value disables it.
 */

  /**
 * Get or set whether nodes are automatically ungrabified (i.e. if `true`, nodes are ungrabbale despite their individual state).
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_autoungrabify} bool - Get whether autoungrabifying is enabled. | Set whether autoungrabifying is enabled.
 * @methodName cy.autoungrabify
 */
  autoungrabify: function( bool ){
    if( bool !== undefined ){
      this._private.autoungrabify = bool ? true : false;
    } else {
      return this._private.autoungrabify;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_autounselectify
 * @property {object} NULL
 * @property {object} bool - A truthy value enables autounselectifying; a falsey value disables it.
 */

  /**
 * Get or set whether nodes are automatically unselectified (i.e. if `true`, nodes are ungrabbale despite their individual state).
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_autounselectify} bool - Get whether autounselectifying is enabled. | Set whether autounselectifying is enabled.
 * @methodName cy.autounselectify
 */
  autounselectify: function( bool ){
    if( bool !== undefined ){
      this._private.autounselectify = bool ? true : false;
    } else {
      return this._private.autounselectify;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_selectionType
 * @property {object} NULL
 * @property {object} type - The selection type string; one of `'single'` (default) or `'additive'`.
 */

  /**
 * Get or set the selection type.  The `'single'` selection type is the default, tapping an element selects that element and deselects the previous elements.  The `'additive' selection type toggles the selection state of an element when tapped.`
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_selectionType} selType - Get the selection type string. | Set the selection type.
 * @methodName cy.selectionType
 */
  selectionType: function( selType ){
    let _p = this._private;

    if( _p.selectionType == null ){
      _p.selectionType = defaultSelectionType;
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

  /**
 * @typedef {object} cy_panningEnabled
 * @property {object} NULL
 * @property {object} bool - A truthy value enables panning; a falsey value disables it.
 */

  /**
 * Get or set whether panning is enabled.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_panningEnabled} bool - Get whether panning is enabled. | Set whether panning is enabled
 * @methodName cy.panningEnabled
 */
  panningEnabled: function( bool ){
    if( bool !== undefined ){
      this._private.panningEnabled = bool ? true : false;
    } else {
      return this._private.panningEnabled;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_userPanningEnabled
 * @property {object} NULL
 * @property {object} bool - A truthy value enables panning; a falsey value disables it.
 */

  /**
 * Get or set whether panning by user events (e.g. dragging the graph background) is enabled.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_userPanningEnabled} bool - Get whether user panning is enabled. | Set whether user panning is enabled
 * @methodName cy.userPanningEnabled
 */
  userPanningEnabled: function( bool ){
    if( bool !== undefined ){
      this._private.userPanningEnabled = bool ? true : false;
    } else {
      return this._private.userPanningEnabled;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_zoomingEnabled
 * @property {object} NULL
 * @property {object} bool - A truthy value enables zooming; a falsey value disables it.
 */

  /**
 * Get or set whether zooming is enabled.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_zoomingEnabled} bool - Get whether zooming is enabled. | Set whether zooming is enabled
 * @methodName cy.zoomingEnabled
 */
  zoomingEnabled: function( bool ){
    if( bool !== undefined ){
      this._private.zoomingEnabled = bool ? true : false;
    } else {
      return this._private.zoomingEnabled;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_userZoomingEnabled
 * @property {object} NULL
 * @property {object} bool - A truthy value enables user zooming; a falsey value disables it.
 */

  /**
 * Get or set whether user zooming by user events (e.g. mouse wheel, pinch-to-zoom) is enabled.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_userZoomingEnabled} bool - Get whether user zooming is enabled. | Set whether zooming is enabled
 * @methodName cy.userZoomingEnabled
 */
  userZoomingEnabled: function( bool ){
    if( bool !== undefined ){
      this._private.userZoomingEnabled = bool ? true : false;
    } else {
      return this._private.userZoomingEnabled;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_boxSelectionEnabled
 * @property {object} NULL
 * @property {object} bool - A truthy value enables box selection; a falsey value disables it.
 */

  /**
 * Get or set whether box selection is enabled. If enabled along with panning, the user must hold down one of shift, control, alt, or command to initiate box selection.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_boxSelectionEnabled} bool - Get whether box selection is enabled. | Set whether box selection is enabled.
 * @methodName cy.boxSelectionEnabled
 */
  boxSelectionEnabled: function( bool ){
    if( bool !== undefined ){
      this._private.boxSelectionEnabled = bool ? true : false;
    } else {
      return this._private.boxSelectionEnabled;
    }

    return this; // chaining
  },

  /**
 * @typedef {object} cy_pan
 * @property {object} NULL
 * @property {object} renderedPosition - The rendered position to pan the graph to.
 */

  /**
 * Get or set the panning position of the graph.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_pan} renderedPosition - Get the current panning position. | Set the current panning position.
 * @methodName cy.pan
 */
  pan: function(){
    let args = arguments;
    let pan = this._private.pan;
    let dim, val, dims, x, y;

    switch( args.length ){
    case 0: // .pan()
      return pan;

    case 1:

      if( is.string( args[0] ) ){ // .pan('x')
        dim = args[0];
        return pan[ dim ];

      } else if( is.plainObject( args[0] ) ){ // .pan({ x: 0, y: 100 })
        if( !this._private.panningEnabled ){
          return this;
        }

        dims = args[0];
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
        pan[ dim ] = val;
      }

      this.emit( 'pan viewport' );
      break;

    default:
      break; // invalid
    }

    this.notify('viewport');

    return this; // chaining
  },

  /**
 * @typedef {object} cy_panBy
 * @property {object} renderedPosition - The rendered position vector to pan the graph by.
 */

  /**
 * Relatively pan the graph by a specified rendered position vector.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_panBy} arg0 - The rendered position
 * @methodName cy.panBy
 */
  panBy: function( arg0, arg1 ){
    let args = arguments;
    let pan = this._private.pan;
    let dim, val, dims, x, y;

    if( !this._private.panningEnabled ){
      return this;
    }

    switch( args.length ){
    case 1:

      if( is.plainObject( arg0 ) ){ // .panBy({ x: 0, y: 100 })
        dims = args[0];
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

  /**
 *  eles, padding
 * @typedef {object} cy_fit_eles_padding
 * @property {object} eles - The collection to fit to.
 * @property {object} padding -  An amount of padding (in rendered pixels) to have around the graph (default 0).
 */

/**
 * @typedef {object} cy_fit
 * @property {object} NULL
 * @property {cy_fit_eles_padding} cy_fit_eles_padding
 */

  /**
 * Pan and zooms the graph to fit to a collection.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_fit} elements - Fit to all elements in the graph. | Fit to the specified elements.
 * @methodName cy.fit
 */
  fit: function( elements, padding ){
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

  getFitViewport: function( elements, padding ){
    if( is.number( elements ) && padding === undefined ){ // elements is optional
      padding = elements;
      elements = undefined;
    }

    if( !this._private.panningEnabled || !this._private.zoomingEnabled ){
      return;
    }

    let bb;

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
      };

      bb.w = bb.x2 - bb.x1;
      bb.h = bb.y2 - bb.y1;

    } else if( !is.elementOrCollection( elements ) ){
      elements = this.mutableElements();
    }

    if( is.elementOrCollection( elements ) && elements.empty() ){ return; } // can't fit to nothing

    bb = bb || elements.boundingBox();

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

  zoomRange: function( min, max ){
    let _p = this._private;

    if( max == null ){
      let opts = min;

      min = opts.min;
      max = opts.max;
    }

    if( is.number( min ) && is.number( max ) && min <= max ){
      _p.minZoom = min;
      _p.maxZoom = max;
    } else if( is.number( min ) && max === undefined && min <= _p.maxZoom ){
      _p.minZoom = min;
    } else if( is.number( max ) && min === undefined && max >= _p.minZoom ){
      _p.maxZoom = max;
    }

    return this;
  },

  /**
 * @typedef {object} cy_minZoom
 * @property {object} NULL
 * @property {object} zoom - The new minimum zoom level to use.
 */

  /**
 * Get or set the minimum zoom level.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_minZoom} zoom - Get the minimum zoom level. | Set the minimum zoom level.
 * @methodName cy.minZoom
 */
  minZoom: function( zoom ){
    if( zoom === undefined ){
      return this._private.minZoom;
    } else {
      return this.zoomRange({ min: zoom });
    }
  },

  /**
 * @typedef {object} cy_maxZoom
 * @property {object} NULL
 * @property {object} zoom - The new maximum zoom level to use.
 */

  /**
 * Get or set the maximum zoom level.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_maxZoom} zoom - Get the maximum zoom level. | Set the maximum zoom level.
 * @methodName cy.maxZoom
 */
  maxZoom: function( zoom ){
    if( zoom === undefined ){
      return this._private.maxZoom;
    } else {
      return this.zoomRange({ max: zoom });
    }
  },

  getZoomedViewport: function( params ){
    let _p = this._private;
    let currentPan = _p.pan;
    let currentZoom = _p.zoom;
    let pos; // in rendered px
    let zoom;
    let bail = false;

    if( !_p.zoomingEnabled ){ // zooming disabled
      bail = true;
    }

    if( is.number( params ) ){ // then set the zoom
      zoom = params;

    } else if( is.plainObject( params ) ){ // then zoom about a point
      zoom = params.level;

      if( params.position != null ){
        pos = math.modelToRenderedPosition( params.position, currentZoom, currentPan );
      } else if( params.renderedPosition != null ){
        pos = params.renderedPosition;
      }

      if( pos != null && !_p.panningEnabled ){ // panning disabled
        bail = true;
      }
    }

    // crop zoom
    zoom = zoom > _p.maxZoom ? _p.maxZoom : zoom;
    zoom = zoom < _p.minZoom ? _p.minZoom : zoom;

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

  /**
 * @callback zoom_options
 * @property {zoom_options_type} options - zoom_options_type
 */

/**
 * options
 * @typedef {object} zoom_options_type
 * @property {object} level - The zoom level to set.
 * @property {object} position - The position about which to zoom.
 * @property {object} renderedPosition - The rendered position about which to zoom.
 */

/**
 * @typedef {object} cy_zoom
 * @property {object} NULL
 * @property {object} level - The zoom level to set.
 * @property {function(zoom_options):any} zoom_options - The options for zooming.
 */

  /**
 * Get or set the zoom level of the graph.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_zoom} params - Get the zoom level. | Set the zoom level. | Set the zoom level.
 * @methodName cy.zoom
 */
  zoom: function( params ){
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

  /**
 *  zoom, pan
 * @typedef {object} cy_viewport_zoom_pan
 * @property {object} zoom - The zoom level to set.
 * @property {object} pan - The pan to set (a rendered position).
 */

/**
 * @typedef {object} cy_viewport
 * @property {cy_viewport_zoom_pan} cy_viewport_zoom_pan
 */

  /**
 * Set the viewport state (pan & zoom) in one call.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @param {...cy_viewport} opts - Set viewport
 * @methodName cy.viewport
 */
  viewport: function( opts ){
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
      let z = opts.zoom;

      if( z < _p.minZoom || z > _p.maxZoom || !_p.zoomingEnabled ){
        zoomFailed = true;

      } else {
        _p.zoom = z;

        events.push( 'zoom' );
      }
    }

    if( panDefd && (!zoomFailed || !opts.cancelOnFailedZoom) && _p.panningEnabled ){
      let p = opts.pan;

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

  /**
 * @typedef {object} cy_center
 * @property {object} NULL
 * @property {object} eles - The collection to centre upon.
 */

  /**
 * Pan the graph to the centre of a collection.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @pureAliases cy.centre
 * @param {...cy_center} elements - Centre on all elements in the graph. | Centre on the specified elements.
 * @methodName cy.center
 */
  center: function( elements ){
    let pan = this.getCenterPan( elements );

    if( pan ){
      this._private.pan = pan;

      this.emit( 'pan viewport' );

      this.notify('viewport');
    }

    return this; // chaining
  },

  getCenterPan: function( elements, zoom ){
    if( !this._private.panningEnabled ){
      return;
    }

    if( is.string( elements ) ){
      let selector = elements;
      elements = this.mutableElements().filter( selector );
    } else if( !is.elementOrCollection( elements ) ){
      elements = this.mutableElements();
    }

    if( elements.length === 0 ){ return; } // can't centre pan to nothing

    let bb = elements.boundingBox();
    let w = this.width();
    let h = this.height();
    zoom = zoom === undefined ? this._private.zoom : zoom;

    let pan = { // middle
      x: (w - zoom * ( bb.x1 + bb.x2 )) / 2,
      y: (h - zoom * ( bb.y1 + bb.y2 )) / 2
    };

    return pan;
  },

  /**
 * Reset the graph to the default zoom level and panning position.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @methodName cy.reset
 */
  reset: function(){
    if( !this._private.panningEnabled || !this._private.zoomingEnabled ){
      return this;
    }

    this.viewport( {
      pan: { x: 0, y: 0 },
      zoom: 1
    } );

    return this; // chaining
  },

  invalidateSize: function(){
    this._private.sizeCache = null;
  },

  size: function(){
    let _p = this._private;
    let container = _p.container;

    return ( _p.sizeCache = _p.sizeCache || ( container ? (function(){
      let style = window.getComputedStyle( container );
      let val = function( name ){ return parseFloat( style.getPropertyValue( name ) ); };

      return {
        width: container.clientWidth - val('padding-left') - val('padding-right'),
        height: container.clientHeight - val('padding-top') - val('padding-bottom')
      };
    })() : { // fallback if no container (not 0 b/c can be used for dividing etc)
      width: 1,
      height: 1
    } ) );
  },

  /**
 * Get the on-screen width of the viewport in pixels.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @methodName cy.width
 */
  width: function(){
    return this.size().width;
  },

  /**
 * Get the on-screen height of the viewport in pixels.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @methodName cy.height
 */
  height: function(){
    return this.size().height;
  },

  /**
 * Get the extent of the viewport, a bounding box in model co-ordinates that lets you know what model positions are visible in the viewport.
 * @memberof cy
 * @path Core/Viewport manipulation
 * @methodName cy.extent
 */
  extent: function(){
    let pan = this._private.pan;
    let zoom = this._private.zoom;
    let rb = this.renderedExtent();

    let b = {
      x1: ( rb.x1 - pan.x ) / zoom,
      x2: ( rb.x2 - pan.x ) / zoom,
      y1: ( rb.y1 - pan.y ) / zoom,
      y2: ( rb.y2 - pan.y ) / zoom
    };

    b.w = b.x2 - b.x1;
    b.h = b.y2 - b.y1;

    return b;
  },

  renderedExtent: function(){
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
  }
});

// aliases
corefn.centre = corefn.center;

// backwards compatibility
corefn.autolockNodes = corefn.autolock;
corefn.autoungrabifyNodes = corefn.autoungrabify;

export default corefn;

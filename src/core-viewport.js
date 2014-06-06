;(function($$){ 'use strict';
  
  $$.fn.core({
    
    autolockNodes: function(bool){
      if( bool !== undefined ){
        this._private.autolockNodes = bool ? true : false;
      } else {
        return this._private.autolockNodes;
      }
      
      return this; // chaining
    },

    autoungrabifyNodes: function(bool){
      if( bool !== undefined ){
        this._private.autoungrabifyNodes = bool ? true : false;
      } else {
        return this._private.autoungrabifyNodes;
      }
      
      return this; // chaining
    },

    panningEnabled: function( bool ){
      if( bool !== undefined ){
        this._private.panningEnabled = bool ? true : false;
      } else {
        return this._private.panningEnabled;
      }
      
      return this; // chaining
    },

    userPanningEnabled: function( bool ){
      if( bool !== undefined ){
        this._private.userPanningEnabled = bool ? true : false;
      } else {
        return this._private.userPanningEnabled;
      }
      
      return this; // chaining
    },
    
    zoomingEnabled: function( bool ){
      if( bool !== undefined ){
        this._private.zoomingEnabled = bool ? true : false;
      } else {
        return this._private.zoomingEnabled;
      }
      
      return this; // chaining
    },

    userZoomingEnabled: function( bool ){
      if( bool !== undefined ){
        this._private.userZoomingEnabled = bool ? true : false;
      } else {
        return this._private.userZoomingEnabled;
      }
      
      return this; // chaining
    },

    boxSelectionEnabled: function( bool ){
      if( bool !== undefined ){
        this._private.boxSelectionEnabled = bool ? true : false;
      } else {
        return this._private.boxSelectionEnabled;
      }
      
      return this; // chaining
    },
    
    pan: function(){
      var args = arguments;
      var pan = this._private.pan;
      var dim, val, dims, x, y;

      switch( args.length ){
      case 0: // .pan()
        return pan;

      case 1: 

        if( !this._private.panningEnabled ){
          return this;

        } else if( $$.is.string( args[0] ) ){ // .pan('x')
          dim = args[0];
          return pan[ dim ];

        } else if( $$.is.plainObject( args[0] ) ) { // .pan({ x: 0, y: 100 })
          dims = args[0];
          x = dims.x;
          y = dims.y;

          if( $$.is.number(x) ){
            pan.x = x;
          }

          if( $$.is.number(y) ){
            pan.y = y;
          }

          this.trigger('pan');
        }
        break;

      case 2: // .pan('x', 100)
        if( !this._private.panningEnabled ){
          return this;
        }

        dim = args[0];
        val = args[1];

        if( (dim === 'x' || dim === 'y') && $$.is.number(val) ){
          pan[dim] = val;
        }

        this.trigger('pan');
        break;

      default:
        break; // invalid
      }

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });

      return this; // chaining
    },
    
    panBy: function(params){
      var args = arguments;
      var pan = this._private.pan;
      var dim, val, dims, x, y;

      if( !this._private.panningEnabled ){
        return this;
      }

      switch( args.length ){
      case 1: 

        if( $$.is.plainObject( args[0] ) ) { // .panBy({ x: 0, y: 100 })
          dims = args[0];
          x = dims.x;
          y = dims.y;

          if( $$.is.number(x) ){
            pan.x += x;
          }

          if( $$.is.number(y) ){
            pan.y += y;
          }

          this.trigger('pan');
        }
        break;

      case 2: // .panBy('x', 100)
        dim = args[0];
        val = args[1];

        if( (dim === 'x' || dim === 'y') && $$.is.number(val) ){
          pan[dim] += val;
        }

        this.trigger('pan');
        break;

      default:
        break; // invalid
      }

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });

      return this; // chaining
    },
    
    fit: function( elements, padding ){
      if( $$.is.number(elements) && padding === undefined ){ // elements is optional
        padding = elements;
        elements = undefined;
      }

      if( !this._private.panningEnabled || !this._private.zoomingEnabled ){
        return this;
      }

      var bb;

      if( $$.is.string(elements) ){
        var sel = elements;
        elements = this.$( sel );

      } else if( $$.is.boundingBox(elements) ){ // assume bb
        var bbe = elements;
        bb = {
          x1: bbe.x1,
          y1: bbe.y1,
          x2: bbe.x2,
          y2: bbe.y2
        };

        bb.w = bb.x2 - bb.x1;
        bb.h = bb.y2 - bb.y1;

      } else if( !$$.is.elementOrCollection(elements) ){
        elements = this.elements();
      }

      bb = bb || elements.boundingBox();
      var style = this.style();

      var w = this.width();
      var h = this.height();
      var zoom;
      padding = $$.is.number(padding) ? padding : 0;

      if( !isNaN(w) && !isNaN(h) && w > 0 && h > 0 && !isNaN(bb.w) && !isNaN(bb.h) &&  bb.w > 0 && bb.h > 0 ){
        zoom = this._private.zoom = Math.min( (w - 2*padding)/bb.w, (h - 2*padding)/bb.h );

        // crop zoom
        zoom = zoom > this._private.maxZoom ? this._private.maxZoom : zoom;
        zoom = zoom < this._private.minZoom ? this._private.minZoom : zoom;

        this._private.pan = { // now pan to middle
          x: (w - zoom*( bb.x1 + bb.x2 ))/2,
          y: (h - zoom*( bb.y1 + bb.y2 ))/2
        };

        this.trigger('pan zoom');

        this.notify({ // notify the renderer that the viewport changed
          type: 'viewport'
        });
      }

      return this; // chaining
    },
    
    minZoom: function( zoom ){
      if( zoom === undefined ){
        return this._private.minZoom;
      } else if( $$.is.number(zoom) ){
        this._private.minZoom = zoom;
      }

      return this;
    },

    maxZoom: function( zoom ){
      if( zoom === undefined ){
        return this._private.maxZoom;
      } else if( $$.is.number(zoom) ){
        this._private.maxZoom = zoom;
      }

      return this;
    },

    zoom: function( params ){
      var pos; // in rendered px
      var zoom;

      if( params === undefined ){ // then get the zoom
        return this._private.zoom;

      } else if( $$.is.number(params) ){ // then set the zoom
        zoom = params;

      } else if( $$.is.plainObject(params) ){ // then zoom about a point
        zoom = params.level;

        if( params.position ){
          var p = params.position;
          var pan = this._private.pan;
          var z = this._private.zoom;

          pos = { // convert to rendered px
            x: p.x * z + pan.x,
            y: p.y * z + pan.y
          };
        } else if( params.renderedPosition ){
          pos = params.renderedPosition;
        }

        if( pos && !this._private.panningEnabled ){
          return this; // panning disabled
        }
      }

      if( !this._private.zoomingEnabled ){
        return this; // zooming disabled
      }

      if( !$$.is.number(zoom) || ( pos && (!$$.is.number(pos.x) || !$$.is.number(pos.y)) ) ){
        return this; // can't zoom with invalid params
      }

      // crop zoom
      zoom = zoom > this._private.maxZoom ? this._private.maxZoom : zoom;
      zoom = zoom < this._private.minZoom ? this._private.minZoom : zoom;

      if( pos ){ // set zoom about position
        var pan1 = this._private.pan;
        var zoom1 = this._private.zoom;
        var zoom2 = zoom;
        
        var pan2 = {
          x: -zoom2/zoom1 * (pos.x - pan1.x) + pos.x,
          y: -zoom2/zoom1 * (pos.y - pan1.y) + pos.y
        };

        this._private.zoom = zoom;
        this._private.pan = pan2;

        var posChanged = pan1.x !== pan2.x || pan1.y !== pan2.y;
        this.trigger('zoom' + (posChanged ? ' pan' : '') );
      
      } else { // just set the zoom
        this._private.zoom = zoom;
        this.trigger('zoom');
      }

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });

      return this; // chaining
    },

    viewport: function( opts ){ 
      var _p = this._private;
      var zoomDefd = true;
      var panDefd = true;
      var events = []; // to trigger
      var zoomFailed = false;
      var panFailed = false;

      if( !opts ){ return this; }
      if( !$$.is.number(opts.zoom) ){ zoomDefd = false; }
      if( !$$.is.plainObject(opts.pan) ){ panDefd = false; }
      if( !zoomDefd && !panDefd ){ return this; }

      if( zoomDefd ){
        var z = opts.zoom;

        if( z < _p.minZoom || z > _p.maxZoom || !_p.zoomingEnabled ){
          zoomFailed = true;

        } else {
          _p.zoom = z;

          events.push('zoom');
        }
      }

      if( panDefd && !zoomFailed && _p.panningEnabled ){
        var p = opts.pan;

        if( $$.is.number(p.x) ){
          _p.pan.x = p.x;
          panFailed = false;
        }

        if( $$.is.number(p.y) ){
          _p.pan.y = p.y;
          panFailed = false;
        }

        if( !panFailed ){
          events.push('pan');
        }
      }

      if( events.length > 0 ){
        this.trigger( events.join(' ') );
      }

      this.notify({
        type: 'viewport'
      });

      return this; // chaining
    },
    
    center: function(elements){
      if( !this._private.panningEnabled || !this._private.zoomingEnabled ){
        return this;
      }

      if( $$.is.string(elements) ){
        var selector = elements;
        elements = this.elements( selector );
      } else if( !$$.is.elementOrCollection(elements) ){
        elements = this.elements();
      }

      var bb = elements.boundingBox();
      var style = this.style();
      var w = parseFloat( style.containerCss('width') );
      var h = parseFloat( style.containerCss('height') );
      var zoom = this._private.zoom;

      this.pan({ // now pan to middle
        x: (w - zoom*( bb.x1 + bb.x2 ))/2,
        y: (h - zoom*( bb.y1 + bb.y2 ))/2
      });
      
      this.trigger('pan');

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });

      return this; // chaining
    },
    
    reset: function(){
      if( !this._private.panningEnabled || !this._private.zoomingEnabled ){
        return this;
      }

      this.pan({ x: 0, y: 0 });

      if( this._private.maxZoom > 1 && this._private.minZoom < 1 ){
        this.zoom(1);
      }

      this.notify({ // notify the renderer that the viewport changed
        type: 'viewport'
      });
      
      return this; // chaining
    },

    width: function(){
      var container = this._private.container;

      if( container ){
        return container.clientWidth;
      }

      return 1; // fallback if no container (not 0 b/c can be used for dividing etc)
    },

    height: function(){
      var container = this._private.container;

      if( container ){
        return container.clientHeight;
      }

      return 1; // fallback if no container (not 0 b/c can be used for dividing etc)
    },

    extent: function(){
      var pan = this._private.pan;
      var zoom = this._private.zoom;
      var rb = this.renderedExtent();

      var b = {
        x1: ( rb.x1 - pan.x )/zoom,
        x2: ( rb.x2 - pan.x )/zoom,
        y1: ( rb.y1 - pan.y )/zoom,
        y2: ( rb.y2 - pan.y )/zoom,
      };

      b.w = b.x2 - b.x1;
      b.h = b.y2 - b.y1;

      return b;
    },

    renderedExtent: function(){
      var width = this.width();
      var height = this.height();

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
  
})( cytoscape );

'use strict';

var define = require( '../define' );
var is = require( '../is' );
var util = require( '../util' );
var math = require( '../math' );
var fn, elesfn;

fn = elesfn = ({

  position: define.data( {
    field: 'position',
    bindingEvent: 'position',
    allowBinding: true,
    allowSetting: true,
    settingEvent: 'position',
    settingTriggersEvent: true,
    triggerFnName: 'rtrigger',
    allowGetting: true,
    validKeys: [ 'x', 'y' ],
    onSet: function( eles ){
      var updatedEles = eles.updateCompoundBounds();
      updatedEles.rtrigger( 'position' );
    },
    canSet: function( ele ){
      return !ele.locked() && !ele.isParent();
    }
  } ),

  // position but no notification to renderer
  silentPosition: define.data( {
    field: 'position',
    bindingEvent: 'position',
    allowBinding: false,
    allowSetting: true,
    settingEvent: 'position',
    settingTriggersEvent: false,
    triggerFnName: 'trigger',
    allowGetting: true,
    validKeys: [ 'x', 'y' ],
    onSet: function( eles ){
      eles.updateCompoundBounds();
    },
    canSet: function( ele ){
      return !ele.locked() && !ele.isParent();
    }
  } ),

  positions: function( pos, silent ){
    if( is.plainObject( pos ) ){
      this.position( pos );

    } else if( is.fn( pos ) ){
      var fn = pos;

      for( var i = 0; i < this.length; i++ ){
        var ele = this[ i ];

        var pos = fn.apply( ele, [ i, ele ] );

        if( pos && !ele.locked() && !ele.isParent() ){
          var elePos = ele._private.position;
          elePos.x = pos.x;
          elePos.y = pos.y;
        }
      }

      var updatedEles = this.updateCompoundBounds();
      var toTrigger = updatedEles.length > 0 ? this.add( updatedEles ) : this;

      if( silent ){
        toTrigger.trigger( 'position' );
      } else {
        toTrigger.rtrigger( 'position' );
      }
    }

    return this; // chaining
  },

  silentPositions: function( pos ){
    return this.positions( pos, true );
  },

  // get/set the rendered (i.e. on screen) positon of the element
  renderedPosition: function( dim, val ){
    var ele = this[0];
    var cy = this.cy();
    var zoom = cy.zoom();
    var pan = cy.pan();
    var rpos = is.plainObject( dim ) ? dim : undefined;
    var setting = rpos !== undefined || ( val !== undefined && is.string( dim ) );

    if( ele && ele.isNode() ){ // must have an element and must be a node to return position
      if( setting ){
        for( var i = 0; i < this.length; i++ ){
          var ele = this[ i ];

          if( val !== undefined ){ // set one dimension
            ele._private.position[ dim ] = ( val - pan[ dim ] ) / zoom;
          } else if( rpos !== undefined ){ // set whole position
            ele._private.position = {
              x: ( rpos.x - pan.x ) / zoom,
              y: ( rpos.y - pan.y ) / zoom
            };
          }
        }

        this.rtrigger( 'position' );
      } else { // getting
        var pos = ele._private.position;
        rpos = {
          x: pos.x * zoom + pan.x,
          y: pos.y * zoom + pan.y
        };

        if( dim === undefined ){ // then return the whole rendered position
          return rpos;
        } else { // then return the specified dimension
          return rpos[ dim ];
        }
      }
    } else if( !setting ){
      return undefined; // for empty collection case
    }

    return this; // chaining
  },

  // get/set the position relative to the parent
  relativePosition: function( dim, val ){
    var ele = this[0];
    var cy = this.cy();
    var ppos = is.plainObject( dim ) ? dim : undefined;
    var setting = ppos !== undefined || ( val !== undefined && is.string( dim ) );
    var hasCompoundNodes = cy.hasCompoundNodes();

    if( ele && ele.isNode() ){ // must have an element and must be a node to return position
      if( setting ){
        for( var i = 0; i < this.length; i++ ){
          var ele = this[ i ];
          var parent = hasCompoundNodes ? ele.parent() : null;
          var hasParent = parent && parent.length > 0;
          var relativeToParent = hasParent;

          if( hasParent ){
            parent = parent[0];
          }

          var origin = relativeToParent ? parent._private.position : { x: 0, y: 0 };

          if( val !== undefined ){ // set one dimension
            ele._private.position[ dim ] = val + origin[ dim ];
          } else if( ppos !== undefined ){ // set whole position
            ele._private.position = {
              x: ppos.x + origin.x,
              y: ppos.y + origin.y
            };
          }
        }

        this.rtrigger( 'position' );

      } else { // getting
        var pos = ele._private.position;
        var parent = hasCompoundNodes ? ele.parent() : null;
        var hasParent = parent && parent.length > 0;
        var relativeToParent = hasParent;

        if( hasParent ){
          parent = parent[0];
        }

        var origin = relativeToParent ? parent._private.position : { x: 0, y: 0 };

        ppos = {
          x: pos.x - origin.x,
          y: pos.y - origin.y
        };

        if( dim === undefined ){ // then return the whole rendered position
          return ppos;
        } else { // then return the specified dimension
          return ppos[ dim ];
        }
      }
    } else if( !setting ){
      return undefined; // for empty collection case
    }

    return this; // chaining
  },

  renderedBoundingBox: function( options ){
    var bb = this.boundingBox( options );
    var cy = this.cy();
    var zoom = cy.zoom();
    var pan = cy.pan();

    var x1 = bb.x1 * zoom + pan.x;
    var x2 = bb.x2 * zoom + pan.x;
    var y1 = bb.y1 * zoom + pan.y;
    var y2 = bb.y2 * zoom + pan.y;

    return {
      x1: x1,
      x2: x2,
      y1: y1,
      y2: y2,
      w: x2 - x1,
      h: y2 - y1
    };
  },

  updateCompoundBounds: function(){
    var cy = this.cy();

    // save cycles for non compound graphs or when style disabled
    if( !cy.styleEnabled() || !cy.hasCompoundNodes() ){ return cy.collection(); }

    var updated = [];

    function update( parent ){
      if( !parent.isParent() ){ return; }

      var _p = parent._private;
      var children = parent.children();
      var includeLabels = parent.pstyle( 'compound-sizing-wrt-labels' ).value === 'include';
      var bb = children.boundingBox( {
        includeLabels: includeLabels,
        includeShadows: false,
        includeOverlays: false,

        // updating the compound bounds happens outside of the regular
        // cache cycle (i.e. before fired events)
        useCache: false
      } );
      var padding = {
        top: parent.pstyle( 'padding-top' ).pfValue,
        bottom: parent.pstyle( 'padding-bottom' ).pfValue,
        left: parent.pstyle( 'padding-left' ).pfValue,
        right: parent.pstyle( 'padding-right' ).pfValue
      };
      var pos = _p.position;

      _p.autoWidth = bb.w;
      pos.x = (bb.x1 + bb.x2 - padding.left + padding.right) / 2;

      _p.autoHeight = bb.h;
      pos.y = (bb.y1 + bb.y2 - padding.top + padding.bottom) / 2;

      updated.push( parent );
    }

    // go up, level by level
    var eles = this;
    while( eles.nonempty() ){

      // update each parent node in this level
      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[ i ];

        update( ele );
      }

      // next level
      eles = eles.parent();
    }

    // return changed
    return this.spawn( updated );
  }
});

var noninf = function( x ){
  if( x === Infinity || x === -Infinity ){
    return 0;
  }

  return x;
};

var updateBounds = function( b, x1, y1, x2, y2 ){
  // don't update with zero area boxes
  if( x2 - x1 === 0 || y2 - y1 === 0 ){ return; }

  b.x1 = x1 < b.x1 ? x1 : b.x1;
  b.x2 = x2 > b.x2 ? x2 : b.x2;
  b.y1 = y1 < b.y1 ? y1 : b.y1;
  b.y2 = y2 > b.y2 ? y2 : b.y2;
};

var updateBoundsFromBox = function( b, b2 ){
  return updateBounds( b, b2.x1, b2.y1, b2.x2, b2.y2 );
};

var prefixedProperty = function( obj, field, prefix ){
  return util.getPrefixedProperty( obj, field, prefix );
};

var updateBoundsFromArrow = function( bounds, ele, prefix, options ){
  var _p = ele._private;
  var rstyle = _p.rstyle;
  var halfArW = rstyle.arrowWidth / 2;
  var arrowType = ele.pstyle( prefix + '-arrow-shape' ).value;
  var x;
  var y;

  if( arrowType !== 'none' ){
    if( prefix === 'source' ){
      x = rstyle.srcX;
      y = rstyle.srcY;
    } else if( prefix === 'target' ){
      x = rstyle.tgtX;
      y = rstyle.tgtY;
    } else {
      x = rstyle.midX;
      y = rstyle.midY;
    }

    updateBounds( bounds, x - halfArW, y - halfArW, x + halfArW, y + halfArW );
  }
};

var updateBoundsFromLabel = function( bounds, ele, prefix, options ){
  var prefixDash;

  if( prefix ){
    prefixDash = prefix + '-';
  } else {
    prefixDash = '';
  }

  var _p = ele._private;
  var rstyle = _p.rstyle;
  var label = ele.pstyle( prefixDash + 'label' ).strValue;

  if( label ){
    var halign = ele.pstyle( 'text-halign' );
    var valign = ele.pstyle( 'text-valign' );
    var labelWidth = prefixedProperty( rstyle, 'labelWidth', prefix );
    var labelHeight = prefixedProperty( rstyle, 'labelHeight', prefix );
    var labelX = prefixedProperty( rstyle, 'labelX', prefix );
    var labelY = prefixedProperty( rstyle, 'labelY', prefix );
    var marginX = ele.pstyle( prefixDash + 'text-margin-x' ).pfValue;
    var marginY = ele.pstyle( prefixDash + 'text-margin-y' ).pfValue;
    var isEdge = ele.isEdge();
    var rotation = ele.pstyle( prefixDash + 'text-rotation' );
    var shadowR = ele.pstyle( 'text-shadow-blur' ).pfValue / 2;
    var shadowX = ele.pstyle( 'text-shadow-offset-x' ).pfValue;
    var shadowY = ele.pstyle( 'text-shadow-offset-y' ).pfValue;
    var shadowOpacity = ele.pstyle( 'text-shadow-opacity' ).value;
    var outlineWidth = ele.pstyle( 'text-outline-width' ).pfValue;
    var borderWidth = ele.pstyle( 'text-border-width' ).pfValue;
    var halfBorderWidth = borderWidth / 2;

    var lh = labelHeight;
    var lw = labelWidth;
    var lw_2 = lw / 2;
    var lh_2 = lh / 2;
    var lx1, lx2, ly1, ly2;

    if( isEdge ){
      lx1 = labelX - lw_2;
      lx2 = labelX + lw_2;
      ly1 = labelY - lh_2;
      ly2 = labelY + lh_2;
    } else {
      switch( halign.value ){
        case 'left':
          lx1 = labelX - lw;
          lx2 = labelX;
          break;

        case 'center':
          lx1 = labelX - lw_2;
          lx2 = labelX + lw_2;
          break;

        case 'right':
          lx1 = labelX;
          lx2 = labelX + lw;
          break;
      }

      switch( valign.value ){
        case 'top':
          ly1 = labelY - lh;
          ly2 = labelY;
          break;

        case 'center':
          ly1 = labelY - lh_2;
          ly2 = labelY + lh_2;
          break;

        case 'bottom':
          ly1 = labelY;
          ly2 = labelY + lh;
          break;
      }
    }

    var isAutorotate = ( isEdge && rotation.strValue === 'autorotate' );
    var isPfValue = ( rotation.pfValue != null && rotation.pfValue !== 0 );

    if( isAutorotate || isPfValue ){
      var theta = isAutorotate ? prefixedProperty( _p.rstyle, 'labelAngle', prefix ) : rotation.pfValue;
      var cos = Math.cos( theta );
      var sin = Math.sin( theta );

      var rotate = function( x, y ){
        x = x - labelX;
        y = y - labelY;

        return {
          x: x * cos - y * sin + labelX,
          y: x * sin + y * cos + labelY
        };
      };

      var px1y1 = rotate( lx1, ly1 );
      var px1y2 = rotate( lx1, ly2 );
      var px2y1 = rotate( lx2, ly1 );
      var px2y2 = rotate( lx2, ly2 );

      lx1 = Math.min( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      lx2 = Math.max( px1y1.x, px1y2.x, px2y1.x, px2y2.x );
      ly1 = Math.min( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
      ly2 = Math.max( px1y1.y, px1y2.y, px2y1.y, px2y2.y );
    }

    lx1 += marginX - Math.max( outlineWidth, halfBorderWidth );
    lx2 += marginX + Math.max( outlineWidth, halfBorderWidth );
    ly1 += marginY - Math.max( outlineWidth, halfBorderWidth );
    ly2 += marginY + Math.max( outlineWidth, halfBorderWidth );

    updateBounds( bounds, lx1, ly1, lx2, ly2 );

    if( options.includeShadows && shadowOpacity > 0 ){
      lx1 += - shadowR + shadowX;
      lx2 += + shadowR + shadowX;
      ly1 += - shadowR + shadowY;
      ly2 += + shadowR + shadowY;

      updateBounds( bounds, lx1, ly1, lx2, ly2 );
    }
  }

  return bounds;
};

// get the bounding box of the elements (in raw model position)
var boundingBoxImpl = function( ele, options ){
  var cy = ele._private.cy;
  var cy_p = cy._private;
  var styleEnabled = cy_p.styleEnabled;

  var bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  var _p = ele._private;
  var display = styleEnabled ? ele.pstyle( 'display' ).value : 'element';
  var isNode = ele.isNode();
  var isEdge = ele.isEdge();
  var ex1, ex2, ey1, ey2, x, y;
  var displayed = display !== 'none';

  if( displayed ){
    var overlayOpacity = 0;
    var overlayPadding = 0;

    if( styleEnabled && options.includeOverlays ){
      overlayOpacity = ele.pstyle( 'overlay-opacity' ).value;

      if( overlayOpacity !== 0 ){
        overlayPadding = ele.pstyle( 'overlay-padding' ).value;
      }
    }

    var w = 0;
    var wHalf = 0;

    if( styleEnabled ){
      w = ele.pstyle( 'width' ).pfValue;
      wHalf = w / 2;
    }

    if( isNode && options.includeNodes ){
      var pos = _p.position;
      x = pos.x;
      y = pos.y;
      var w = ele.outerWidth();
      var halfW = w / 2;
      var h = ele.outerHeight();
      var halfH = h / 2;

      // handle node dimensions
      /////////////////////////

      ex1 = x - halfW - overlayPadding;
      ex2 = x + halfW + overlayPadding;
      ey1 = y - halfH - overlayPadding;
      ey2 = y + halfH + overlayPadding;

      updateBounds( bounds, ex1, ey1, ex2, ey2 );

    } else if( isEdge && options.includeEdges ){
      var rstyle = _p.rstyle || {};

      // handle edge dimensions (rough box estimate)
      //////////////////////////////////////////////
      if( styleEnabled ){
        ex1 = Math.min( rstyle.srcX, rstyle.midX, rstyle.tgtX );
        ex2 = Math.max( rstyle.srcX, rstyle.midX, rstyle.tgtX );
        ey1 = Math.min( rstyle.srcY, rstyle.midY, rstyle.tgtY );
        ey2 = Math.max( rstyle.srcY, rstyle.midY, rstyle.tgtY );

        // take into account edge width
        ex1 -= wHalf;
        ex2 += wHalf;
        ey1 -= wHalf;
        ey2 += wHalf;

        updateBounds( bounds, ex1, ey1, ex2, ey2 );
      }

      // precise haystacks
      ////////////////////
      if( styleEnabled && ele.pstyle( 'curve-style' ).strValue === 'haystack' ){
        var hpts = rstyle.haystackPts;

        ex1 = hpts[0].x;
        ey1 = hpts[0].y;
        ex2 = hpts[1].x;
        ey2 = hpts[1].y;

        if( ex1 > ex2 ){
          var temp = ex1;
          ex1 = ex2;
          ex2 = temp;
        }

        if( ey1 > ey2 ){
          var temp = ey1;
          ey1 = ey2;
          ey2 = temp;
        }

        updateBounds( bounds, ex1 - wHalf, ey1 - wHalf, ex2 + wHalf, ey2 + wHalf );

      // handle points along edge
      ///////////////////////////
      } else {
        var pts = rstyle.bezierPts || rstyle.linePts || [];

        for( var j = 0; j < pts.length; j++ ){
          var pt = pts[ j ];

          ex1 = pt.x - wHalf;
          ex2 = pt.x + wHalf;
          ey1 = pt.y - wHalf;
          ey2 = pt.y + wHalf;

          updateBounds( bounds, ex1, ey1, ex2, ey2 );
        }

        // fallback on source and target positions
        //////////////////////////////////////////
        if( pts.length === 0 ){
          var n1 = _p.source;
          var n1_p = n1._private;
          var n1pos = n1_p.position;

          var n2 = _p.target;
          var n2_p = n2._private;
          var n2pos = n2_p.position;

          ex1 = n1pos.x;
          ex2 = n2pos.x;
          ey1 = n1pos.y;
          ey2 = n2pos.y;

          if( ex1 > ex2 ){
            var temp = ex1;
            ex1 = ex2;
            ex2 = temp;
          }

          if( ey1 > ey2 ){
            var temp = ey1;
            ey1 = ey2;
            ey2 = temp;
          }

          // take into account edge width
          ex1 -= wHalf;
          ex2 += wHalf;
          ey1 -= wHalf;
          ey2 += wHalf;

          updateBounds( bounds, ex1, ey1, ex2, ey2 );
        }
      }

    } // edges

    // shadow and overlay
    /////////////////////

    if( styleEnabled ){

      ex1 = bounds.x1;
      ex2 = bounds.x2;
      ey1 = bounds.y1;
      ey2 = bounds.y2;

      if( options.includeShadows && ele.pstyle('shadow-opacity').value > 0 ){
        var r = ele.pstyle('shadow-blur').pfValue / 2;
        var ox = ele.pstyle('shadow-offset-x').pfValue;
        var oy = ele.pstyle('shadow-offset-y').pfValue;

        updateBounds( bounds, ex1 - r + ox, ey1 - r + oy, ex2 + r + ox, ey2 + r + oy );
      }

      updateBounds( bounds, ex1 - overlayPadding, ey1 - overlayPadding, ex2 + overlayPadding, ey2 + overlayPadding );
    }

    // handle edge arrow size
    /////////////////////////

    if( styleEnabled && options.includeEdges && isEdge ){
      updateBoundsFromArrow( bounds, ele, 'mid-source', options );
      updateBoundsFromArrow( bounds, ele, 'mid-target', options );
      updateBoundsFromArrow( bounds, ele, 'source', options );
      updateBoundsFromArrow( bounds, ele, 'target', options );
    }

    // handle label dimensions
    //////////////////////////

    if( styleEnabled && options.includeLabels ){
      updateBoundsFromLabel( bounds, ele, null, options );

      if( isEdge ){
        updateBoundsFromLabel( bounds, ele, 'source', options );
        updateBoundsFromLabel( bounds, ele, 'target', options );
      }
    } // style enabled for labels
  } // if displayed

  bounds.x1 = noninf( bounds.x1 );
  bounds.y1 = noninf( bounds.y1 );
  bounds.x2 = noninf( bounds.x2 );
  bounds.y2 = noninf( bounds.y2 );
  bounds.w = noninf( bounds.x2 - bounds.x1 );
  bounds.h = noninf( bounds.y2 - bounds.y1 );

  // expand bounds by 1 because antialiasing can increase the visual/effective size by 1 on all sides
  if( bounds.w > 0 && bounds.h > 0 && displayed ){
    math.expandBoundingBox( bounds, 1 );
  }

  return bounds;
};

var tf = function( val ){
  if( val ){
    return 't';
  } else {
    return 'f';
  }
};

var getKey = function( opts ){
  var key = '';

  key += tf( opts.incudeNodes );
  key += tf( opts.includeEdges );
  key += tf( opts.includeLabels );
  key += tf( opts.includeShadows );
  key += tf( opts.includeOverlays );

  return key;
};

var cachedBoundingBoxImpl = function( ele, opts ){
  var _p = ele._private;
  var bb;
  var headless = ele.cy().headless();
  var key = opts === defBbOpts ? defBbOptsKey : getKey( opts );

  if( !opts.useCache || headless || !_p.bbCache || !_p.bbCache[key] ){
    bb = boundingBoxImpl( ele, opts );

    if( !headless ){
      _p.bbCache = _p.bbCache || {};
      _p.bbCache[key] = bb;
    }
  } else {
    bb = _p.bbCache[key];
  }

  return bb;
};

var defBbOpts = {
  includeNodes: true,
  includeEdges: true,
  includeLabels: true,
  includeShadows: true,
  includeOverlays: true,
  useCache: true
};

var defBbOptsKey = getKey( defBbOpts );

elesfn.recalculateRenderedStyle = function( useCache ){
  var cy = this.cy();
  var renderer = cy.renderer();
  var styleEnabled = cy.styleEnabled();

  if( renderer && styleEnabled ){
    renderer.recalculateRenderedStyle( this, useCache );
  }

  return this;
};

elesfn.boundingBox = function( options ){
  // the main usecase is ele.boundingBox() for a single element with no/def options
  // specified s.t. the cache is used, so check for this case to make it faster by
  // avoiding the overhead of the rest of the function
  if( this.length === 1 && this[0]._private.bbCache && (options === undefined || options.useCache === undefined || options.useCache === true) ){
    if( options === undefined ){
      options = defBbOpts;
    }

    return cachedBoundingBoxImpl( this[0], options );
  }

  var bounds = {
    x1: Infinity,
    y1: Infinity,
    x2: -Infinity,
    y2: -Infinity
  };

  options = options || util.staticEmptyObject();

  var opts = {
    includeNodes: util.default( options.includeNodes, defBbOpts.includeNodes ),
    includeEdges: util.default( options.includeEdges, defBbOpts.includeEdges ),
    includeLabels: util.default( options.includeLabels, defBbOpts.includeLabels ),
    includeShadows: util.default( options.includeShadows, defBbOpts.includeShadows ),
    includeOverlays: util.default( options.includeOverlays, defBbOpts.includeOverlays ),
    useCache: util.default( options.useCache, defBbOpts.useCache )
  };

  var eles = this;
  var cy = eles.cy();
  var styleEnabled = cy.styleEnabled();

  if( styleEnabled ){
    this.recalculateRenderedStyle( opts.useCache );
  }

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];

    if( styleEnabled && ele.isEdge() && ele.pstyle('curve-style').strValue === 'bezier' ){
      ele.parallelEdges().recalculateRenderedStyle( opts.useCache ); // n.b. ele.parallelEdges() single is cached
    }

    updateBoundsFromBox( bounds, cachedBoundingBoxImpl( ele, opts ) );
  }

  bounds.x1 = noninf( bounds.x1 );
  bounds.y1 = noninf( bounds.y1 );
  bounds.x2 = noninf( bounds.x2 );
  bounds.y2 = noninf( bounds.y2 );
  bounds.w = noninf( bounds.x2 - bounds.x1 );
  bounds.h = noninf( bounds.y2 - bounds.y1 );

  return bounds;
};

var defineDimFns = function( opts ){
  opts.uppercaseName = util.capitalize( opts.name );
  opts.autoName = 'auto' + opts.uppercaseName;
  opts.labelName = 'label' + opts.uppercaseName;
  opts.outerName = 'outer' + opts.uppercaseName;
  opts.uppercaseOuterName = util.capitalize( opts.outerName );

  fn[ opts.name ] = function dimImpl(){
    var ele = this[0];
    var _p = ele._private;
    var cy = _p.cy;
    var styleEnabled = cy._private.styleEnabled;

    if( ele ){
      if( styleEnabled ){
        if( ele.isParent() ){
          return _p[ opts.autoName ] || 0;
        }

        var d = ele.pstyle( opts.name );

        switch( d.strValue ){
          case 'label':
            return _p.rstyle[ opts.labelName ] || 0;
          default:
            return d.pfValue;
        }
      } else {
        return 1;
      }
    }
  };

  fn[ 'outer' + opts.uppercaseName ] = function outerDimImpl(){
    var ele = this[0];
    var _p = ele._private;
    var cy = _p.cy;
    var styleEnabled = cy._private.styleEnabled;

    if( ele ){
      if( styleEnabled ){
        var dim = ele[ opts.name ]();
        var border = ele.pstyle( 'border-width' ).pfValue;
        var padding = ele.pstyle( opts.paddings[0] ).pfValue + ele.pstyle( opts.paddings[1] ).pfValue;

        return dim + border + padding;
      } else {
        return 1;
      }
    }
  };

  fn[ 'rendered' + opts.uppercaseName ] = function renderedDimImpl(){
    var ele = this[0];

    if( ele ){
      var d = ele[ opts.name ]();
      return d * this.cy().zoom();
    }
  };

  fn[ 'rendered' + opts.uppercaseOuterName ] = function renderedOuterDimImpl(){
    var ele = this[0];

    if( ele ){
      var od = ele[ opts.outerName ]();
      return od * this.cy().zoom();
    }
  };
};

defineDimFns( {
  name: 'width',
  paddings: [ 'padding-left', 'padding-right' ]
} );

defineDimFns( {
  name: 'height',
  paddings: [ 'padding-top', 'padding-bottom' ]
} );

// aliases
fn.modelPosition = fn.point = fn.position;
fn.modelPositions = fn.points = fn.positions;
fn.renderedPoint = fn.renderedPosition;
fn.relativePoint = fn.relativePosition;
fn.boundingbox = fn.boundingBox;
fn.renderedBoundingbox = fn.renderedBoundingBox;

module.exports = elesfn;

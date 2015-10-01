'use strict';

var CRp = {};

CRp.drawEdge = function(context, edge, drawOverlayInstead) {
  var rs = edge._private.rscratch;
  var usePaths = this.usePaths();

  // if bezier ctrl pts can not be calculated, then die
  if( rs.badBezier || rs.badLine || isNaN( rs.allpts[0] ) ){ // iNaN in case edge is impossible and browser bugs (e.g. safari)
    return;
  }

  var style = edge._private.style;

  // Edge line width
  if (style['width'].pfValue <= 0) {
    return;
  }

  var overlayPadding = style['overlay-padding'].pfValue;
  var overlayOpacity = style['overlay-opacity'].value;
  var overlayColor = style['overlay-color'].value;

  // Edge color & opacity
  if( drawOverlayInstead ){

    if( overlayOpacity === 0 ){ // exit early if no overlay
      return;
    }

    this.strokeStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);
    context.lineCap = 'round';

    if( rs.edgeType == 'self' && !usePaths ){
      context.lineCap = 'butt';
    }

  } else {
    var lineColor = style['line-color'].value;

    this.strokeStyle(context, lineColor[0], lineColor[1], lineColor[2], style.opacity.value);

    context.lineCap = 'butt';
  }

  var source = edge._private.source;
  var target = edge._private.target;
  var srcPos = source._private.position;
  var tgtPos = target._private.position;

  var edgeWidth = style['width'].pfValue + (drawOverlayInstead ? 2 * overlayPadding : 0);
  var lineStyle = drawOverlayInstead ? 'solid' : style['line-style'].value;
  context.lineWidth = edgeWidth;

  var shadowBlur = style['shadow-blur'].pfValue;
  var shadowOpacity = style['shadow-opacity'].value;
  var shadowColor = style['shadow-color'].value;
  var shadowOffsetX = style['shadow-offset-x'].pfValue;
  var shadowOffsetY = style['shadow-offset-y'].pfValue;

  this.shadowStyle(context,  shadowColor, drawOverlayInstead ? 0 : shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY);

  this.drawEdgePath(
    edge,
    context,
    rs.allpts,
    lineStyle,
    edgeWidth
  );

  if( rs.edgeType === 'haystack' ){
    this.drawArrowheads(context, edge, drawOverlayInstead);
  } else if ( rs.noArrowPlacement !== true && rs.startX !== undefined ){
    this.drawArrowheads(context, edge, drawOverlayInstead);
  }

  this.shadowStyle(context, 'transparent', 0); // reset for next guy

};


CRp.drawEdgePath = function(edge, context, pts, type, width) {
  var rs = edge._private.rscratch;
  var canvasCxt = context;
  var path;
  var pathCacheHit = false;
  var usePaths = this.usePaths();

  if( usePaths ){
    var pathCacheKey = pts.join('$');
    var keyMatches = rs.pathCacheKey && rs.pathCacheKey === pathCacheKey;

    if( keyMatches ){
      path = context = rs.pathCache;
      pathCacheHit = true;
    } else {
      path = context = new Path2D();
      rs.pathCacheKey = pathCacheKey;
      rs.pathCache = path;
    }
  }

  if( canvasCxt.setLineDash ){ // for very outofdate browsers
    switch( type ){
      case 'dotted':
        canvasCxt.setLineDash([ 1, 1 ]);
        break;

      case 'dashed':
        canvasCxt.setLineDash([ 6, 3 ]);
        break;

      case 'solid':
        canvasCxt.setLineDash([ ]);
        break;
    }
  }

  if( !pathCacheHit ){
    if( context.beginPath ){ context.beginPath(); }
    context.moveTo( pts[0], pts[1] );

    switch( rs.edgeType ){
      case 'bezier':
      case 'self':
      case 'compound':
      case 'multibezier':
        if( !rs.badBezier ){
          for( var i = 2; i + 3 < pts.length; i += 4 ){
            context.quadraticCurveTo( pts[i], pts[i+1], pts[i+2], pts[i+3] );
          }
        }
        break;

      case 'straight':
      case 'segments':
      case 'haystack':
        if( !rs.badLine ){
          for( var i = 2; i + 1 < pts.length; i += 2 ){
            context.lineTo( pts[i], pts[i+1] );
          }
        }
        break;
    }
  }

  context = canvasCxt;
  if( usePaths ){
    context.stroke( path );
  } else {
    context.stroke();
  }

  // reset any line dashes
  if( context.setLineDash ){ // for very outofdate browsers
    context.setLineDash([ ]);
  }

};

CRp.drawArrowheads = function(context, edge, drawOverlayInstead) {
  if( drawOverlayInstead ){ return; } // don't do anything for overlays

  var rs = edge._private.rscratch;
  var isHaystack = rs.edgeType === 'haystack';

  if( !isHaystack ){
    this.drawArrowhead( context, edge, 'source', rs.arrowStartX, rs.arrowStartY, rs.srcArrowAngle );
  }

  this.drawArrowhead( context, edge, 'mid-target', rs.midX, rs.midY, rs.midtgtArrowAngle );

  this.drawArrowhead( context, edge, 'mid-source', rs.midX, rs.midY, rs.midsrcArrowAngle );

  if( !isHaystack ){
    this.drawArrowhead( context, edge, 'target', rs.arrowEndX, rs.arrowEndY, rs.tgtArrowAngle );
  }
};

CRp.drawArrowhead = function( context, edge, prefix, x, y, angle ){
  if( isNaN(x) || isNaN(y) || isNaN(angle) ){ return; }

  var self = this;
  var style = edge._private.style;
  var arrowShape = style[prefix + '-arrow-shape'].value;

  if( arrowShape === 'none' ){
    return;
  }

  var gco = context.globalCompositeOperation;

  var arrowClearFill = style[prefix + '-arrow-fill'].value === 'hollow' ? 'both' : 'filled';
  var arrowFill = style[prefix + '-arrow-fill'].value;

  if( arrowShape === 'half-triangle-overshot' ){
    arrowFill = 'hollow';
    arrowClearFill = 'hollow';
  }

  if( style.opacity.value !== 1 || arrowFill === 'hollow' ){ // then extra clear is needed
    context.globalCompositeOperation = 'destination-out';

    self.fillStyle(context, 255, 255, 255, 1);
    self.strokeStyle(context, 255, 255, 255, 1);

    self.drawArrowShape( edge, prefix, context,
      arrowClearFill, style['width'].pfValue, style[prefix + '-arrow-shape'].value,
      x, y, angle
    );

    context.globalCompositeOperation = gco;
  } // otherwise, the opaque arrow clears it for free :)

  var color = style[prefix + '-arrow-color'].value;
  self.fillStyle(context, color[0], color[1], color[2], style.opacity.value);
  self.strokeStyle(context, color[0], color[1], color[2], style.opacity.value);

  self.drawArrowShape( edge, prefix, context,
    arrowFill, style['width'].pfValue, style[prefix + '-arrow-shape'].value,
    x, y, angle
  );
};

CRp.drawArrowShape = function(edge, arrowType, context, fill, edgeWidth, shape, x, y, angle) {
  var r = this;
  var usePaths = this.usePaths();
  var rs = edge._private.rscratch;
  var pathCacheHit = false;
  var path;
  var canvasContext = context;
  var translation = { x: x, y: y };
  var size = this.getArrowWidth( edgeWidth );
  var shapeImpl = r.arrowShapes[shape];

  if( usePaths ){
    var pathCacheKey = size + '$' + shape + '$' + angle + '$' + x + '$' + y;
    rs.arrowPathCacheKey = rs.arrowPathCacheKey || {};
    rs.arrowPathCache = rs.arrowPathCache || {};

    var alreadyCached = rs.arrowPathCacheKey[arrowType] === pathCacheKey;
    if( alreadyCached ){
      path = context = rs.arrowPathCache[arrowType];
      pathCacheHit = true;
    } else {
      path = context = new Path2D();
      rs.arrowPathCacheKey[arrowType] = pathCacheKey;
      rs.arrowPathCache[arrowType] = path;
    }
  }

  if( context.beginPath ){ context.beginPath(); }

  if( !pathCacheHit ){
    shapeImpl.draw(context, size, angle, translation);
  }

  if( !shapeImpl.leavePathOpen && context.closePath ){
    context.closePath();
  }

  context = canvasContext;

  if( fill === 'filled' || fill === 'both' ){
    if( usePaths ){
      context.fill( path );
    } else {
      context.fill();
    }
  }

  if( fill === 'hollow' || fill === 'both' ){
    context.lineWidth = ( shapeImpl.matchEdgeWidth ? edgeWidth : 1 );
    context.lineJoin = 'miter';

    if( usePaths ){
      context.stroke( path );
    } else {
      context.stroke();
    }

  }
};

module.exports = CRp;

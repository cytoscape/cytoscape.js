'use strict';

var CRp = {};

CRp.drawEdge = function( context, edge, shiftToOriginWithBb, drawLabel, drawOverlayInstead ){
  var rs = edge._private.rscratch;
  var usePaths = this.usePaths();

  // if bezier ctrl pts can not be calculated, then die
  if( rs.badLine || isNaN(rs.allpts[0]) ){ // isNaN in case edge is impossible and browser bugs (e.g. safari)
    return;
  }

  if( !edge.visible() ){ return; }

  var bb;
  if( shiftToOriginWithBb ){
    bb = shiftToOriginWithBb;

    context.translate( -bb.x1, -bb.y1 );
  }

  var overlayPadding = edge.pstyle( 'overlay-padding' ).pfValue;
  var overlayOpacity = edge.pstyle( 'overlay-opacity' ).value;
  var overlayColor = edge.pstyle( 'overlay-color' ).value;

  // Edge color & opacity
  if( drawOverlayInstead ){

    if( overlayOpacity === 0 ){ // exit early if no overlay
      return;
    }

    this.strokeStyle( context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity );
    context.lineCap = 'round';

    if( rs.edgeType == 'self' && !usePaths ){
      context.lineCap = 'butt';
    }

  } else {
    var lineColor = edge.pstyle( 'line-color' ).value;

    this.strokeStyle( context, lineColor[0], lineColor[1], lineColor[2], edge.pstyle( 'opacity' ).value );

    context.lineCap = 'butt';
  }

  context.lineJoin = 'round';

  var edgeWidth = edge.pstyle( 'width' ).pfValue + (drawOverlayInstead ? 2 * overlayPadding : 0);
  var lineStyle = drawOverlayInstead ? 'solid' : edge.pstyle( 'line-style' ).value;
  context.lineWidth = edgeWidth;

  var shadowBlur = edge.pstyle( 'shadow-blur' ).pfValue;
  var shadowOpacity = edge.pstyle( 'shadow-opacity' ).value;
  var shadowColor = edge.pstyle( 'shadow-color' ).value;
  var shadowOffsetX = edge.pstyle( 'shadow-offset-x' ).pfValue;
  var shadowOffsetY = edge.pstyle( 'shadow-offset-y' ).pfValue;

  this.shadowStyle( context,  shadowColor, drawOverlayInstead ? 0 : shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY );

  this.drawEdgePath(
    edge,
    context,
    rs.allpts,
    lineStyle,
    edgeWidth
  );

  this.drawArrowheads( context, edge, drawOverlayInstead );

  this.shadowStyle( context, 'transparent', 0 ); // reset for next guy

  if( !drawOverlayInstead ){
    this.drawEdge( context, edge, false, drawLabel, true );
  }

  this.drawElementText( context, edge, drawLabel );

  if( shiftToOriginWithBb ){
    context.translate( bb.x1, bb.y1 );
  }
};


CRp.drawEdgePath = function( edge, context, pts, type, width ){
  var rs = edge._private.rscratch;
  var canvasCxt = context;
  var path;
  var pathCacheHit = false;
  var usePaths = this.usePaths();

  if( usePaths ){
    var pathCacheKey = pts.join( '$' );
    var keyMatches = rs.pathCacheKey && rs.pathCacheKey === pathCacheKey;

    if( keyMatches ){
      path = context = rs.pathCache;
      pathCacheHit = true;
    } else {
      path = context = new Path2D(); // eslint-disable-line no-undef
      rs.pathCacheKey = pathCacheKey;
      rs.pathCache = path;
    }
  }

  if( canvasCxt.setLineDash ){ // for very outofdate browsers
    switch( type ){
      case 'dotted':
        canvasCxt.setLineDash( [ 1, 1 ] );
        break;

      case 'dashed':
        canvasCxt.setLineDash( [ 6, 3 ] );
        break;

      case 'solid':
        canvasCxt.setLineDash( [ ] );
        break;
    }
  }

  if( !pathCacheHit && !rs.badLine ){
    if( context.beginPath ){ context.beginPath(); }
    context.moveTo( pts[0], pts[1] );

    switch( rs.edgeType ){
      case 'bezier':
      case 'self':
      case 'compound':
      case 'multibezier':
        for( var i = 2; i + 3 < pts.length; i += 4 ){
          context.quadraticCurveTo( pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3] );
        }
        break;

      case 'straight':
      case 'segments':
      case 'haystack':
        for( var i = 2; i + 1 < pts.length; i += 2 ){
          context.lineTo( pts[ i ], pts[ i + 1] );
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
    context.setLineDash( [ ] );
  }

};

CRp.drawArrowheads = function( context, edge, drawOverlayInstead ){
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
  if( isNaN( x ) || x == null || isNaN( y ) || y == null || isNaN( angle ) || angle == null ){ return; }

  var self = this;
  var arrowShape = edge.pstyle( prefix + '-arrow-shape' ).value;

  if( arrowShape === 'none' ){
    return;
  }

  var gco = context.globalCompositeOperation;

  var arrowClearFill = edge.pstyle( prefix + '-arrow-fill' ).value === 'hollow' ? 'both' : 'filled';
  var arrowFill = edge.pstyle( prefix + '-arrow-fill' ).value;
  var opacity = edge.pstyle( 'opacity' ).value;

  if( arrowShape === 'half-triangle-overshot' ){
    arrowFill = 'hollow';
    arrowClearFill = 'hollow';
  }

  if( opacity !== 1 || arrowFill === 'hollow' ){ // then extra clear is needed
    context.globalCompositeOperation = 'destination-out';

    self.fillStyle( context, 255, 255, 255, 1 );
    self.strokeStyle( context, 255, 255, 255, 1 );

    self.drawArrowShape( edge, prefix, context,
      arrowClearFill, edge.pstyle( 'width' ).pfValue, edge.pstyle( prefix + '-arrow-shape' ).value,
      x, y, angle
    );

    context.globalCompositeOperation = gco;
  } // otherwise, the opaque arrow clears it for free :)

  var color = edge.pstyle( prefix + '-arrow-color' ).value;
  self.fillStyle( context, color[0], color[1], color[2], opacity );
  self.strokeStyle( context, color[0], color[1], color[2], opacity );

  self.drawArrowShape( edge, prefix, context,
    arrowFill, edge.pstyle( 'width' ).pfValue, edge.pstyle( prefix + '-arrow-shape' ).value,
    x, y, angle
  );
};

CRp.drawArrowShape = function( edge, arrowType, context, fill, edgeWidth, shape, x, y, angle ){
  var r = this;
  var usePaths = this.usePaths();
  var rs = edge._private.rscratch;
  var pathCacheHit = false;
  var path;
  var canvasContext = context;
  var translation = { x: x, y: y };
  var size = this.getArrowWidth( edgeWidth );
  var shapeImpl = r.arrowShapes[ shape ];

  if( usePaths ){
    var pathCacheKey = size + '$' + shape + '$' + angle + '$' + x + '$' + y;
    rs.arrowPathCacheKey = rs.arrowPathCacheKey || {};
    rs.arrowPathCache = rs.arrowPathCache || {};

    var alreadyCached = rs.arrowPathCacheKey[ arrowType ] === pathCacheKey;
    if( alreadyCached ){
      path = context = rs.arrowPathCache[ arrowType ];
      pathCacheHit = true;
    } else {
      path = context = new Path2D(); // eslint-disable-line no-undef
      rs.arrowPathCacheKey[ arrowType ] = pathCacheKey;
      rs.arrowPathCache[ arrowType ] = path;
    }
  }

  if( context.beginPath ){ context.beginPath(); }

  if( !pathCacheHit ){
    shapeImpl.draw( context, size, angle, translation );
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

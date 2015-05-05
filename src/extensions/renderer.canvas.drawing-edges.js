;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var CRp = CanvasRenderer.prototype;

// Draw edge
  CRp.drawEdge = function(context, edge, drawOverlayInstead) {
    var rs = edge._private.rscratch;
    var usePaths = CanvasRenderer.usePaths();

    // if bezier ctrl pts can not be calculated, then die
    if( rs.badBezier || ( (rs.edgeType === 'bezier' || rs.edgeType === 'straight') && isNaN(rs.startX)) ){ // extra isNaN() for safari 7.1 b/c it mangles ctrlpt calcs
      return;
    }

    var style = edge._private.style;
    
    // Edge line width
    if (style['width'].pxValue <= 0) {
      return;
    }

    var overlayPadding = style['overlay-padding'].pxValue;
    var overlayOpacity = style['overlay-opacity'].value;
    var overlayColor = style['overlay-color'].value;

    // Edge color & opacity
    if( drawOverlayInstead ){

      if( overlayOpacity === 0 ){ // exit early if no overlay
        return;
      }

      this.strokeStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);
      context.lineCap = 'round';

      if( edge._private.rscratch.edgeType == 'self' && !usePaths ){
        context.lineCap = 'butt';
      }

    } else {
      var lineColor = style['line-color'].value;

      this.strokeStyle(context, lineColor[0], lineColor[1], lineColor[2], style.opacity.value);
      
      context.lineCap = 'butt'; 
    }
    
    var startNode, endNode, source, target;
    source = startNode = edge._private.source;
    target = endNode = edge._private.target;

    var targetPos = target._private.position;
    var targetW = target.width();
    var targetH = target.height();
    var sourcePos = source._private.position;
    var sourceW = source.width();
    var sourceH = source.height();


    var edgeWidth = style['width'].pxValue + (drawOverlayInstead ? 2 * overlayPadding : 0);
    var lineStyle = drawOverlayInstead ? 'solid' : style['line-style'].value;
    context.lineWidth = edgeWidth;
    
    var shadowBlur = style['shadow-blur'].pxValue;
    var shadowOpacity = style['shadow-opacity'].value;
    var shadowColor = style['shadow-color'].value;
    var shadowOffsetX = style['shadow-offset-x'].pxValue;
    var shadowOffsetY = style['shadow-offset-y'].pxValue;

    this.shadowStyle(context,  shadowColor, drawOverlayInstead ? 0 : shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY);
    
    // if( rs.edgeType !== 'haystack' ){
    //   this.findEndpoints(edge);
    // }
    
    if( rs.edgeType === 'haystack' ){
      var radius = style['haystack-radius'].value;
      var halfRadius = radius/2; // b/c have to half width/height

      this.drawStyledEdge(
        edge, 
        context, 
        rs.haystackPts,
        lineStyle,
        edgeWidth
      );
    } else if (rs.edgeType === 'self' || rs.edgeType === 'compound') {
      
      var details = edge._private.rscratch;
      var points = [details.startX, details.startY, details.cp2ax,
        details.cp2ay, details.selfEdgeMidX, details.selfEdgeMidY,
        details.selfEdgeMidX, details.selfEdgeMidY,
        details.cp2cx, details.cp2cy, details.endX, details.endY];

      this.drawStyledEdge(edge, context, points, lineStyle, edgeWidth);
      
    } else if (rs.edgeType === 'straight') {
      
      var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
      var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
      
      var edgeDirectionX = rs.endX - rs.startX;
      var edgeDirectionY = rs.endY - rs.startY;
      
      if (nodeDirectionX * edgeDirectionX
        + nodeDirectionY * edgeDirectionY < 0) {
        
        rs.straightEdgeTooShort = true;  
      } else {
        
        var details = rs;
        this.drawStyledEdge(edge, context, [details.startX, details.startY,
                                      details.endX, details.endY],
                                      lineStyle,
                                      edgeWidth);
        
        rs.straightEdgeTooShort = false;  
      }  
    } else {
      
      var details = rs;
      
      this.drawStyledEdge(edge, context, [details.startX, details.startY,
        details.cp2x, details.cp2y, details.endX, details.endY],
        lineStyle,
        edgeWidth);
      
    }
    
    if( rs.edgeType === 'haystack' ){
      this.drawArrowheads(context, edge, drawOverlayInstead);
    } else if ( rs.noArrowPlacement !== true && rs.startX !== undefined ){
      this.drawArrowheads(context, edge, drawOverlayInstead);
    }

    this.shadowStyle(context, 'transparent', 0); // reset for next guy

  };
  
  
  CRp.drawStyledEdge = function(
      edge, context, pts, type, width) {

    // 3 points given -> assume Bezier
    // 2 -> assume straight
    
    var rs = edge._private.rscratch;
    var canvasCxt = context;
    var path;
    var pathCacheHit = false;
    var usePaths = CanvasRenderer.usePaths();


    if( usePaths ){

      var pathCacheKey = pts;
      var keyLengthMatches = rs.pathCacheKey && pathCacheKey.length === rs.pathCacheKey.length;
      var keyMatches = keyLengthMatches;

      for( var i = 0; keyMatches && i < pathCacheKey.length; i++ ){
        if( rs.pathCacheKey[i] !== pathCacheKey[i] ){
          keyMatches = false;
        }
      }

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
      context.moveTo(pts[0], pts[1]);
      
      if (pts.length === 3 * 2) { // bezier
        context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      } else if( pts.length === 3 * 2 * 2 ){ // double bezier loop
        context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
        context.quadraticCurveTo(pts[8], pts[9], pts[10], pts[11]);
      } else { // line
        context.lineTo(pts[2], pts[3]);
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
    var self = this;
    var isHaystack = rs.edgeType === 'haystack';

    // Displacement gives direction for arrowhead orientation
    var dispX, dispY;
    var startX, startY, endX, endY;

    var srcPos = edge.source().position();
    var tgtPos = edge.target().position();

    if( isHaystack ){
      startX = rs.haystackPts[0];
      startY = rs.haystackPts[1];
      endX = rs.haystackPts[2];
      endY = rs.haystackPts[3];
    } else {
      startX = rs.arrowStartX;
      startY = rs.arrowStartY;
      endX = rs.arrowEndX;
      endY = rs.arrowEndY;
    }

    var style = edge._private.style;
    
    function drawArrowhead( prefix, x, y, dispX, dispY ){
      var arrowShape = style[prefix + '-arrow-shape'].value;

      if( arrowShape === 'none' ){
        return;
      }

      var gco = context.globalCompositeOperation;

      context.globalCompositeOperation = 'destination-out';
      
      self.fillStyle(context, 255, 255, 255, 1);


      var arrowClearFill = style[prefix + '-arrow-fill'].value === 'hollow' ? 'both' : 'filled';
      var arrowFill = style[prefix + '-arrow-fill'].value;

      if( arrowShape === 'half-triangle-overshot' ){
        arrowFill = 'hollow';
        arrowClearFill = 'hollow';
      }

      self.drawArrowShape( edge, prefix, context, 
        arrowClearFill, style['width'].pxValue, style[prefix + '-arrow-shape'].value, 
        x, y, dispX, dispY
      );

      context.globalCompositeOperation = gco;

      var color = style[prefix + '-arrow-color'].value;
      self.fillStyle(context, color[0], color[1], color[2], style.opacity.value);

      self.drawArrowShape( edge, prefix, context, 
        arrowFill, style['width'].pxValue, style[prefix + '-arrow-shape'].value, 
        x, y, dispX, dispY
      );
    }

    dispX = startX - srcPos.x;
    dispY = startY - srcPos.y;

    if( !isHaystack && !isNaN(startX) && !isNaN(startY) && !isNaN(dispX) && !isNaN(dispY) ){
      drawArrowhead( 'source', startX, startY, dispX, dispY );

    } else {
      // window.badArrow = true;
      // debugger;
    }
    
    var midX = rs.midX;
    var midY = rs.midY;

    if( isHaystack ){
      midX = ( startX + endX )/2;
      midY = ( startY + endY )/2;
    }

    dispX = startX - endX;
    dispY = startY - endY;

    if( rs.edgeType === 'self' ){
      dispX = 1;
      dispY = -1;
    }

    if( !isNaN(midX) && !isNaN(midY) ){
      drawArrowhead( 'mid-target', midX, midY, dispX, dispY );
    }

    dispX *= -1;
    dispY *= -1;

    if( !isNaN(midX) && !isNaN(midY) ){
      drawArrowhead( 'mid-source', midX, midY, dispX, dispY );
    }
    
    dispX = endX - tgtPos.x;
    dispY = endY - tgtPos.y;
    
    if( !isHaystack && !isNaN(endX) && !isNaN(endY) && !isNaN(dispX) && !isNaN(dispY) ){
      drawArrowhead( 'target', endX, endY, dispX, dispY );
    }
  };
  
  // Draw arrowshape
  CRp.drawArrowShape = function(edge, arrowType, context, fill, edgeWidth, shape, x, y, dispX, dispY) {
    var usePaths = CanvasRenderer.usePaths();
    var rs = edge._private.rscratch;
    var pathCacheHit = false;
    var path;
    var canvasContext = context;
    var translation = { x: x, y: y };

    // Negative of the angle
    var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
  
    if (dispX < 0) {
      angle = angle + Math.PI / 2;
    } else {
      angle = - (Math.PI / 2 + angle);
    }
    
    var size = this.getArrowWidth( edgeWidth );
    var shapeImpl = CanvasRenderer.arrowShapes[shape];

    // context.translate(x, y);

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

    // context.translate(-x, -y);
  };

})( cytoscape );

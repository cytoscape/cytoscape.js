;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');

// Draw edge
  CanvasRenderer.prototype.drawEdge = function(context, edge, drawOverlayInstead) {
    var rs = edge._private.rscratch;

    // if bezier ctrl pts can not be calculated, then die
    if( rs.badBezier ){
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

      if( edge._private.rscratch.edgeType == 'self'){
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
    
    if( rs.edgeType !== 'haystack' ){
      this.findEndpoints(edge);
    }
    
    if( rs.edgeType === 'haystack' ){
      var radius = style['haystack-radius'].value;
      var halfRadius = radius/2; // b/c have to half width/height

      this.drawStyledEdge(
        edge, 
        context, 
        [
          rs.source.x * sourceW * halfRadius + sourcePos.x,
          rs.source.y * sourceH * halfRadius + sourcePos.y,
          rs.target.x * targetW * halfRadius + targetPos.x,
          rs.target.y * targetH * halfRadius + targetPos.y
        ],
        lineStyle,
        edgeWidth
      );
    } else if (rs.edgeType === 'self') {
          
      var details = edge._private.rscratch;
      this.drawStyledEdge(edge, context, [details.startX, details.startY, details.cp2ax,
        details.cp2ay, details.selfEdgeMidX, details.selfEdgeMidY],
        lineStyle,
        edgeWidth);
      
      this.drawStyledEdge(edge, context, [details.selfEdgeMidX, details.selfEdgeMidY,
        details.cp2cx, details.cp2cy, details.endX, details.endY],
        lineStyle,
        edgeWidth);
      
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
    
    if ( rs.edgeType !== 'haystack' && rs.noArrowPlacement !== true && rs.startX !== undefined ){
      this.drawArrowheads(context, edge, drawOverlayInstead);
    }

  };
  
  var _genPoints = function(pt, spacing, even) {
    
    var approxLen = Math.sqrt(Math.pow(pt[4] - pt[0], 2) + Math.pow(pt[5] - pt[1], 2));
    approxLen += Math.sqrt(Math.pow((pt[4] + pt[0]) / 2 - pt[2], 2) + Math.pow((pt[5] + pt[1]) / 2 - pt[3], 2));

    var pts = Math.ceil(approxLen / spacing); 
    var pz;
    
    if (pts > 0) {
      pz = new Array(pts * 2);
    } else {
      return null;
    }
    
    for (var i = 0; i < pts; i++) {
      var cur = i / pts;
      pz[i * 2] = pt[0] * (1 - cur) * (1 - cur) + 2 * (pt[2]) * (1 - cur) * cur + pt[4] * (cur) * (cur);
      pz[i * 2 + 1] = pt[1] * (1 - cur) * (1 - cur) + 2 * (pt[3]) * (1 - cur) * cur + pt[5] * (cur) * (cur);
    }
    
    return pz;
  };
  
  var _genStraightLinePoints = function(pt, spacing, even) {
    
    var approxLen = Math.sqrt(Math.pow(pt[2] - pt[0], 2) + Math.pow(pt[3] - pt[1], 2));
    
    var pts = Math.ceil(approxLen / spacing);
    var pz;
    
    if (pts > 0) {
      pz = new Array(pts * 2);
    } else {
      return null;
    }
    
    var lineOffset = [pt[2] - pt[0], pt[3] - pt[1]];
    for (var i = 0; i < pts; i++) {
      var cur = i / pts;
      pz[i * 2] = lineOffset[0] * cur + pt[0];
      pz[i * 2 + 1] = lineOffset[1] * cur + pt[1];
    }
    
    return pz;
  };

  
  CanvasRenderer.prototype.drawStyledEdge = function(
      edge, context, pts, type, width) {

    // 3 points given -> assume Bezier
    // 2 -> assume straight
    
    var cy = this.data.cy;
    var zoom = cy.zoom();
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

    switch( type ){
      case 'dotted':
        context.setLineDash([ 1, 1 ]);
        break;

      case 'dashed':
        context.setLineDash([ 6, 3 ]);
        break;

      case 'solid':
      default:
        context.setLineDash([ ]);
        break;
    }

    if( !pathCacheHit ){
      if( context.beginPath ){ context.beginPath(); }
      context.moveTo(pts[0], pts[1]);
      if (pts.length == 3 * 2) {
        context.quadraticCurveTo(pts[2], pts[3], pts[4], pts[5]);
      } else {
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
    context.setLineDash([ ]);

  };

  CanvasRenderer.prototype.drawArrowheads = function(context, edge, drawOverlayInstead) {
    if( drawOverlayInstead ){ return; } // don't do anything for overlays 

    // Displacement gives direction for arrowhead orientation
    var dispX, dispY;

    var startX = edge._private.rscratch.arrowStartX;
    var startY = edge._private.rscratch.arrowStartY;

    var style = edge._private.style;
    
    var srcPos = edge.source().position();
    dispX = startX - srcPos.x;
    dispY = startY - srcPos.y;
    
    if( !isNaN(startX) && !isNaN(startY) && !isNaN(dispX) && !isNaN(dispY) ){

      var gco = context.globalCompositeOperation;

      context.globalCompositeOperation = 'destination-out';
      
      this.fillStyle(context, 255, 255, 255, 1);

      this.drawArrowShape(context, 'filled', style['source-arrow-shape'].value, 
        startX, startY, dispX, dispY);

      context.globalCompositeOperation = gco;

      var color = style['source-arrow-color'].value;
      this.fillStyle(context, color[0], color[1], color[2], style.opacity.value);

      this.drawArrowShape(context, style['source-arrow-fill'].value, style['source-arrow-shape'].value, 
        startX, startY, dispX, dispY);

    } else {
      // window.badArrow = true;
      // debugger;
    }
    
    var endX = edge._private.rscratch.arrowEndX;
    var endY = edge._private.rscratch.arrowEndY;
    
    var tgtPos = edge.target().position();
    dispX = endX - tgtPos.x;
    dispY = endY - tgtPos.y;
    
    if( !isNaN(endX) && !isNaN(endY) && !isNaN(dispX) && !isNaN(dispY) ){

      var gco = context.globalCompositeOperation;

      context.globalCompositeOperation = 'destination-out';

      this.fillStyle(context, 255, 255, 255, 1);

      this.drawArrowShape(context, 'filled', style['target-arrow-shape'].value,
        endX, endY, dispX, dispY);

      context.globalCompositeOperation = gco;

      var color = style['target-arrow-color'].value;
      this.fillStyle(context, color[0], color[1], color[2], style.opacity.value);

      this.drawArrowShape(context, style['target-arrow-fill'].value, style['target-arrow-shape'].value,
        endX, endY, dispX, dispY);
    }
  };
  
  // Draw arrowshape
  CanvasRenderer.prototype.drawArrowShape = function(context, fill, shape, x, y, dispX, dispY) {
  
    // Negative of the angle
    var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
  
    if (dispX < 0) {
      //context.strokeStyle = 'AA99AA';
      angle = angle + Math.PI / 2;
    } else {
      //context.strokeStyle = 'AAAA99';
      angle = - (Math.PI / 2 + angle);
    }
    
    //context.save();
    context.translate(x, y);
    
    context.moveTo(0, 0);
    context.rotate(-angle);
    
    var size = this.getArrowWidth(context.lineWidth);
    /// size = 100;
    context.scale(size, size);
    
    context.beginPath();
    
    CanvasRenderer.arrowShapes[shape].draw(context);
    
    context.closePath();
    
//    context.stroke();
    if( fill === 'hollow' ){
      context.lineWidth = 1/size;
      context.stroke();
    } else {
      context.fill();
    }

    context.scale(1/size, 1/size);
    context.rotate(angle);
    context.translate(-x, -y);
    //context.restore();
  };

})( cytoscape );
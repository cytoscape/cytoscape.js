;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');

  // @O Polygon drawing
  CanvasRenderer.prototype.drawPolygonPath = function(
    context, x, y, width, height, points) {

    var halfW = width / 2;
    var halfH = height / 2;

    if( context.beginPath ){ context.beginPath(); }

    context.moveTo( x + halfW * points[0], y + halfH * points[1] );

    for (var i = 1; i < points.length / 2; i++) {
      context.lineTo( x + halfW * points[i * 2], y + halfH * points[i * 2 + 1] );
    }
    
    context.closePath();
  };
  
  CanvasRenderer.prototype.drawPolygon = function(
    context, x, y, width, height, points) {

    // Draw path
    this.drawPolygonPath(context, x, y, width, height, points);
    
    // Fill path
    context.fill();
  };
  
  // Round rectangle drawing
  CanvasRenderer.prototype.drawRoundRectanglePath = function(
    context, x, y, width, height, radius) {
    
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    var cornerRadius = $$.math.getRoundRectangleRadius(width, height);
    
    if( context.beginPath ){ context.beginPath(); }
    
    // Start at top middle
    context.moveTo(x, y - halfHeight);
    // Arc from middle top to right side
    context.arcTo(x + halfWidth, y - halfHeight, x + halfWidth, y, cornerRadius);
    // Arc from right side to bottom
    context.arcTo(x + halfWidth, y + halfHeight, x, y + halfHeight, cornerRadius);
    // Arc from bottom to left side
    context.arcTo(x - halfWidth, y + halfHeight, x - halfWidth, y, cornerRadius);
    // Arc from left side to topBorder
    context.arcTo(x - halfWidth, y - halfHeight, x, y - halfHeight, cornerRadius);
    // Join line
    context.lineTo(x, y - halfHeight);
    
    
    context.closePath();
  };
  
  CanvasRenderer.prototype.drawRoundRectangle = function(
    context, x, y, width, height, radius) {
    
    this.drawRoundRectanglePath(context, x, y, width, height, radius);
    
    context.fill();
  };


})( cytoscape );

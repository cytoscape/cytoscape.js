;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');

  // Draw node
  CanvasRenderer.prototype.drawNode = function(context, node, drawOverlayInstead) {

    var nodeWidth, nodeHeight;
    var style = node._private.style;
    var rs = node._private.rscratch;
    
    if ( !node.visible() ) {
      return;
    }

    var usePaths = CanvasRenderer.usePaths();
    var canvasContext = context;
    var path;
    var pathCacheHit = false;

    var overlayPadding = style['overlay-padding'].pxValue;
    var overlayOpacity = style['overlay-opacity'].value;
    var overlayColor = style['overlay-color'].value;

    if( drawOverlayInstead && overlayOpacity === 0 ){ // exit early if drawing overlay but none to draw
      return;
    }

    var parentOpacity = node.effectiveOpacity();
    if( parentOpacity === 0 ){ return; }

    nodeWidth = this.getNodeWidth(node);
    nodeHeight = this.getNodeHeight(node);
    
    context.lineWidth = style['border-width'].pxValue;

    if( drawOverlayInstead === undefined || !drawOverlayInstead ){

      // Node color & opacity

      var bgColor = style['background-color'].value;
      var borderColor = style['border-color'].value;

      this.fillStyle(context, bgColor[0], bgColor[1], bgColor[2], style['background-opacity'].value * style['opacity'].value * parentOpacity);
      
      this.strokeStyle(context, borderColor[0], borderColor[1], borderColor[2], style['border-opacity'].value * style['opacity'].value * parentOpacity);

      context.lineJoin = 'miter'; // so borders are square with the node shape

      //var image = this.getCachedImage('url');
      
      var url = style['background-image'].value[2] ||
        style['background-image'].value[1];
      
      var styleShape = style['shape'].strValue;

      var pos = node._private.position;

      if( usePaths ){
        var pathCacheKey = styleShape + '$' + nodeWidth +'$' + nodeHeight;

        context.translate( pos.x, pos.y );

        if( rs.pathCacheKey === pathCacheKey ){
          path = context = rs.pathCache;
          pathCacheHit = true;
        } else {
          path = context = new Path2D();
          rs.pathCacheKey = pathCacheKey;
          rs.pathCache = path;
        }
      }

      if( !pathCacheHit ){

        var npos = pos;

        if( usePaths ){
          npos = {
            x: 0,
            y: 0
          };
        }

        CanvasRenderer.nodeShapes[this.getNodeShape(node)].drawPath(
              context,
              npos.x,
              npos.y,
              nodeWidth,
              nodeHeight);
      }

      context = canvasContext;

      if( usePaths ){
        context.fill( path );
      } else {
        context.fill();
      }

      if (url != undefined) {
        
        var r = this;
        var image = this.getCachedImage(url,
            
            function() {
              
//              console.log(e);
              r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
              r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;
              
              // Replace Image object with Canvas to solve zooming too far
              // into image graphical errors (Jan 10 2013)
              r.swapCachedImage(url);
              
              r.redraw();
            }
        );
        
        if (image.complete == false) {
          
        } else {
          //context.clip
          this.drawInscribedImage(context, image, node);
        }
        
      } 
      
      var darkness = style['background-blacken'].value;

      if( this.hasPie(node) ){
        this.drawPie(context, node);

        // redraw path for blacken and border
        if( darkness !== 0 ){

          if( !usePaths ){
            CanvasRenderer.nodeShapes[this.getNodeShape(node)].drawPath(
                context,
                pos.x,
                pos.y,
                nodeWidth,
                nodeHeight);
          }
        }
      }

      if( darkness > 0 ){
        this.fillStyle(context, 0, 0, 0, darkness);

        if( usePaths ){
          context.fill( path );
        } else {
          context.fill();
        }
        
      } else if( darkness < 0 ){
        this.fillStyle(context, 255, 255, 255, -darkness);
        
        if( usePaths ){
          context.fill( path );
        } else {
          context.fill();
        }
      }

      // Border width, draw border
      if (style['border-width'].pxValue > 0) {

        if( usePaths ){
          context.stroke( path );
        } else {
          context.stroke();
        }

      }

      if( usePaths ){
        context.translate( -pos.x, -pos.y );
      }

    // draw the overlay
    } else {

      if( overlayOpacity > 0 ){
        this.fillStyle(context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity);

        CanvasRenderer.nodeShapes['roundrectangle'].drawPath(
          context,
          node._private.position.x,
          node._private.position.y,
          nodeWidth + overlayPadding * 2,
          nodeHeight + overlayPadding * 2
        );

        context.fill();
      }
    }

  };

  // does the node have at least one pie piece?
  CanvasRenderer.prototype.hasPie = function(node){
    node = node[0]; // ensure ele ref
    
    return node._private.hasPie;
  };

  CanvasRenderer.prototype.drawPie = function(context, node){
    node = node[0]; // ensure ele ref

    var pieSize = node._private.style['pie-size'];
    var nodeW = this.getNodeWidth( node );
    var nodeH = this.getNodeHeight( node );
    var x = node._private.position.x;
    var y = node._private.position.y;
    var radius = Math.min( nodeW, nodeH ) / 2; // must fit in node
    var lastPercent = 0; // what % to continue drawing pie slices from on [0, 1]

    if( pieSize.units === '%' ){
      radius = radius * pieSize.value / 100;
    } else if( pieSize.pxValue !== undefined ){
      radius = pieSize.pxValue / 2;
    }

    for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
      var size = node._private.style['pie-' + i + '-background-size'].value;
      var color = node._private.style['pie-' + i + '-background-color'].value;
      var percent = size / 100; // map integer range [0, 100] to [0, 1]
      var angleStart = 1.5 * Math.PI + 2 * Math.PI * lastPercent; // start at 12 o'clock and go clockwise
      var angleDelta = 2 * Math.PI * percent;
      var angleEnd = angleStart + angleDelta;

      // slice start and end points
      var sx1 = x + radius * Math.cos( angleStart );
      var sy1 = y + radius * Math.sin( angleStart );

      // ignore if
      // - zero size
      // - we're already beyond the full circle
      // - adding the current slice would go beyond the full circle
      if( size === 0 || lastPercent >= 1 || lastPercent + percent > 1 ){
        continue;
      }

      context.beginPath();
      context.moveTo(x, y);
      context.arc( x, y, radius, angleStart, angleEnd );
      context.closePath();

      this.fillStyle(context, color[0], color[1], color[2], 1);

      context.fill();

      lastPercent += percent;
    }

  };

  
})( cytoscape );
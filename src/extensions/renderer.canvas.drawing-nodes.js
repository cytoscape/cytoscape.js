;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var CRp = CanvasRenderer.prototype;

  // Draw node
  CRp.drawNode = function(context, node, drawOverlayInstead) {

    var r = this;
    var nodeWidth, nodeHeight;
    var style = node._private.style;
    var rs = node._private.rscratch;
    var _p = node._private;
    
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

      var url = style['background-image'].value[2] ||
        style['background-image'].value[1];
      var image;

      if (url !== undefined) {
        
        // get image, and if not loaded then ask to redraw when later loaded
        image = this.getCachedImage(url, function(){
          r.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true;
          r.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true;
          
          r.redraw();
        });
        
        var prevBging = _p.backgrounding;
        _p.backgrounding = !image.complete;

        if( prevBging !== _p.backgrounding ){ // update style b/c :backgrounding state changed
          node.updateStyle( false );
        }
      } 

      // Node color & opacity

      var bgColor = style['background-color'].value;
      var borderColor = style['border-color'].value;
      var borderStyle = style['border-style'].value;

      this.fillStyle(context, bgColor[0], bgColor[1], bgColor[2], style['background-opacity'].value * style['opacity'].value * parentOpacity);
      
      this.strokeStyle(context, borderColor[0], borderColor[1], borderColor[2], style['border-opacity'].value * style['opacity'].value * parentOpacity);
      
      var shadowBlur = style['shadow-blur'].pxValue;
      var shadowOpacity = style['shadow-opacity'].value;
      var shadowColor = style['shadow-color'].value;
      var shadowOffsetX = style['shadow-offset-x'].pxValue;
      var shadowOffsetY = style['shadow-offset-y'].pxValue;

      this.shadowStyle(context, shadowColor, shadowOpacity, shadowBlur, shadowOffsetX, shadowOffsetY);

      context.lineJoin = 'miter'; // so borders are square with the node shape

      if( context.setLineDash ){ // for very outofdate browsers
        switch( borderStyle ){
          case 'dotted':
            context.setLineDash([ 1, 1 ]);
            break;

          case 'dashed':
            context.setLineDash([ 4, 2 ]);
            break;

          case 'solid':
          case 'double':
            context.setLineDash([ ]);
            break;
        }
      }

      
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

      this.shadowStyle(context, 'transparent', 0); // reset for next guy

      if (url !== undefined) {
        if( image.complete ){
          this.drawInscribedImage(context, image, node);
        }
      } 
      
      var darkness = style['background-blacken'].value;
      var borderWidth = style['border-width'].pxValue;

      if( this.hasPie(node) ){
        this.drawPie(context, node);

        // redraw path for blacken and border
        if( darkness !== 0 || borderWidth !== 0 ){

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
      if (borderWidth > 0) {

        if( usePaths ){
          context.stroke( path );
        } else {
          context.stroke();
        }

        if( borderStyle === 'double' ){
          context.lineWidth = style['border-width'].pxValue/3;

          var gco = context.globalCompositeOperation;
          context.globalCompositeOperation = 'destination-out';

          if( usePaths ){
            context.stroke( path );
          } else {
            context.stroke();
          }

          context.globalCompositeOperation = gco;
        }

      }

      if( usePaths ){
        context.translate( -pos.x, -pos.y );
      }

      // reset in case we changed the border style
      if( context.setLineDash ){ // for very outofdate browsers
        context.setLineDash([ ]);
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
  CRp.hasPie = function(node){
    node = node[0]; // ensure ele ref
    
    return node._private.hasPie;
  };

  CRp.drawPie = function(context, node){
    node = node[0]; // ensure ele ref

    var pieSize = node._private.style['pie-size'];
    var nodeW = this.getNodeWidth( node );
    var nodeH = this.getNodeHeight( node );
    var x = node._private.position.x;
    var y = node._private.position.y;
    var radius = Math.min( nodeW, nodeH ) / 2; // must fit in node
    var lastPercent = 0; // what % to continue drawing pie slices from on [0, 1]
    var usePaths = CanvasRenderer.usePaths();

    if( usePaths ){
      x = 0;
      y = 0;
    }

    if( pieSize.units === '%' ){
      radius = radius * pieSize.value / 100;
    } else if( pieSize.pxValue !== undefined ){
      radius = pieSize.pxValue / 2;
    }

    for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
      var size = node._private.style['pie-' + i + '-background-size'].value;
      var color = node._private.style['pie-' + i + '-background-color'].value;
      var opacity = node._private.style['pie-' + i + '-background-opacity'].value;
      var percent = size / 100; // map integer range [0, 100] to [0, 1]
      var angleStart = 1.5 * Math.PI + 2 * Math.PI * lastPercent; // start at 12 o'clock and go clockwise
      var angleDelta = 2 * Math.PI * percent;
      var angleEnd = angleStart + angleDelta;

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

      this.fillStyle(context, color[0], color[1], color[2], opacity);

      context.fill();

      lastPercent += percent;
    }

  };

  
})( cytoscape );
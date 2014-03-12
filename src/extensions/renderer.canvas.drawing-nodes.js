;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');

  // Draw node
  CanvasRenderer.prototype.drawNode = function(context, node, drawOverlayInstead) {

    var nodeWidth, nodeHeight;
    var style = node._private.style;
    
    if ( !node.visible() ) {
      return;
    }

    var parentOpacity = node.effectiveOpacity();
    if( parentOpacity === 0 ){ return; }

    // context.fillStyle = 'orange';
    // context.fillRect(node.position().x, node.position().y, 2, 2);
    
    nodeWidth = this.getNodeWidth(node);
    nodeHeight = this.getNodeHeight(node);
    
    context.lineWidth = style['border-width'].pxValue;

    if( drawOverlayInstead === undefined || !drawOverlayInstead ){

      // Node color & opacity
      context.fillStyle = "rgba(" 
        + style['background-color'].value[0] + ","
        + style['background-color'].value[1] + ","
        + style['background-color'].value[2] + ","
        + (style['background-opacity'].value 
        * style['opacity'].value * parentOpacity) + ")";
      
      // Node border color & opacity
      context.strokeStyle = "rgba(" 
        + style['border-color'].value[0] + ","
        + style['border-color'].value[1] + ","
        + style['border-color'].value[2] + ","
        + (style['border-opacity'].value * style['opacity'].value * parentOpacity) + ")";
      
      context.lineJoin = 'miter'; // so borders are square with the node shape

      //var image = this.getCachedImage('url');
      
      var url = style['background-image'].value[2] ||
        style['background-image'].value[1];
      
      CanvasRenderer.nodeShapes[this.getNodeShape(node)].draw(
            context,
            node._private.position.x,
            node._private.position.y,
            nodeWidth,
            nodeHeight);

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
      
      this.drawPie(context, node);

      var darkness = style['background-blacken'].value;
      if( darkness > 0 ){
        context.fillStyle = 'rgba(0, 0, 0, ' + darkness + ')';
        context.fill();
      } else if( darkness < 0 ){
        context.fillStyle = 'rgba(255, 255, 255, ' + Math.abs(darkness) + ')';
        context.fill();
      }

      // Border width, draw border
      if (style['border-width'].pxValue > 0) {
        context.stroke();
      }

    // draw the overlay
    } else {

      var overlayPadding = style['overlay-padding'].pxValue;
      var overlayOpacity = style['overlay-opacity'].value;
      var overlayColor = style['overlay-color'].value;
      if( overlayOpacity > 0 ){
        context.fillStyle = "rgba( " + overlayColor[0] + ", " + overlayColor[1] + ", " + overlayColor[2] + ", " + overlayOpacity + " )";

        CanvasRenderer.nodeShapes['roundrectangle'].draw(
          context,
          node._private.position.x,
          node._private.position.y,
          nodeWidth + overlayPadding * 2,
          nodeHeight + overlayPadding * 2
        );
      }
    }

  };

  // does the node have at least one pie piece?
  CanvasRenderer.prototype.hasPie = function(node){
    node = node[0]; // ensure ele ref

    for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
      var size = node._private.style['pie-' + i + '-background-size'].value;

      if( size > 0 ){
        return true;
      }
    }

    return false;
  };

  CanvasRenderer.prototype.drawPie = function(context, node){
    node = node[0]; // ensure ele ref

    if( !this.hasPie(node) ){ return; } // exit early if not needed

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

    // context.save();

    // // clip to the node shape
    // CanvasRenderer.nodeShapes[ this.getNodeShape(node) ]
    //   .drawPath( context, x, y, nodeW, nodeH )
    // ;
    // context.clip();

    for( var i = 1; i <= $$.style.pieBackgroundN; i++ ){ // 1..N
      var size = node._private.style['pie-' + i + '-background-size'].value;
      var color = node._private.style['pie-' + i + '-background-color'];
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

      context.fillStyle = 'rgb(' 
        + color.value[0] + ','
        + color.value[1] + ','
        + color.value[2] + ')'
      ;

      context.fill();

      lastPercent += percent;
    }

    context.restore();
  };

  
})( cytoscape );
'use strict';

var is = require( '../../../is' );

var CRp = {};

CRp.drawNode = function( context, node, shiftToOriginWithBb, drawLabel ){
  var r = this;
  var nodeWidth, nodeHeight;
  var rs = node._private.rscratch;
  var _p = node._private;
  var pos = pos || node.position();

  if( !is.number( pos.x ) || !is.number( pos.y ) ){
    return; // can't draw node with undefined position
  }

  if( !node.visible() ){ return; }

  var parentOpacity = node.effectiveOpacity();

  var usePaths = this.usePaths();
  var path;
  var pathCacheHit = false;

  var padding = node.padding();

  nodeWidth = node.width() + 2 * padding;
  nodeHeight = node.height() + 2 * padding;

  context.lineWidth = node.pstyle( 'border-width' ).pfValue;

  //
  // setup shift

  var bb;
  if( shiftToOriginWithBb ){
    bb = shiftToOriginWithBb;

    context.translate( -bb.x1, -bb.y1 );
  }

  //
  // load bg image

  var bgImgProp = node.pstyle( 'background-image' );
  var urls = bgImgProp.value;
  var url;
  var urlDefined = [];
  var image = [];
  var numImages = urls.length;
  for( var i = 0; i < numImages; i++ ){
    url = urls[i];
    urlDefined[i] = url != null && url !== 'none';
    if( urlDefined[i] ){
      var bgImgCrossOrigin = node.cy().style().getIndexedStyle(node, 'background-image-crossorigin', 'value', i);

      // get image, and if not loaded then ask to redraw when later loaded
      image[i] = this.getCachedImage( url, bgImgCrossOrigin, function(){
        node.rtrigger('background');
      } );
    }
  }

  //
  // setup styles

  var bgColor = node.pstyle( 'background-color' ).value;
  var borderColor = node.pstyle( 'border-color' ).value;
  var borderStyle = node.pstyle( 'border-style' ).value;

  this.fillStyle( context, bgColor[0], bgColor[1], bgColor[2], node.pstyle( 'background-opacity' ).value * parentOpacity );

  this.strokeStyle( context, borderColor[0], borderColor[1], borderColor[2], node.pstyle( 'border-opacity' ).value * parentOpacity );

  context.lineJoin = 'miter'; // so borders are square with the node shape

  if( context.setLineDash ){ // for very outofdate browsers
    switch( borderStyle ){
      case 'dotted':
        context.setLineDash( [ 1, 1 ] );
        break;

      case 'dashed':
        context.setLineDash( [ 4, 2 ] );
        break;

      case 'solid':
      case 'double':
        context.setLineDash( [ ] );
        break;
    }
  }


  //
  // draw shape

  var styleShape = node.pstyle('shape').strValue;
  var shapePts = node.pstyle('shape-polygon-points').pfValue;

  if( usePaths ){
    var pathCacheKey = styleShape + '$' + nodeWidth + '$' + nodeHeight + ( styleShape === 'polygon' ? '$' + shapePts.join('$') : '' );

    context.translate( pos.x, pos.y );

    if( rs.pathCacheKey === pathCacheKey ){
      path = rs.pathCache;
      pathCacheHit = true;
    } else {
      path = new Path2D(); // eslint-disable-line no-undef
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

    r.nodeShapes[ this.getNodeShape( node ) ].draw(
          ( path || context ),
          npos.x,
          npos.y,
          nodeWidth,
          nodeHeight );
  }

  if( usePaths ){
    context.fill( path );
  } else {
    context.fill();
  }

  //
  // bg image

  var prevBging = _p.backgrounding;
  var totalCompleted = 0;

  for( var i = 0; i < numImages; i++ ){
    if( ( urlDefined[i] ) && image[i].complete ){
      totalCompleted++;
      this.drawInscribedImage( context, image[i], node, i );
    }
  }

  _p.backgrounding = !(totalCompleted === numImages);
  if( prevBging !== _p.backgrounding ){ // update style b/c :backgrounding state changed
    node.updateStyle( false );
  }

  //
  // pie

  var darkness = node.pstyle( 'background-blacken' ).value;
  var borderWidth = node.pstyle( 'border-width' ).pfValue;

  if( this.hasPie( node ) ){
    this.drawPie( context, node, parentOpacity );

    // redraw path for blacken and border
    if( darkness !== 0 || borderWidth !== 0 ){

      if( !usePaths ){
        r.nodeShapes[ this.getNodeShape( node ) ].draw(
            context,
            pos.x,
            pos.y,
            nodeWidth,
            nodeHeight );
      }
    }
  }

  //
  // darken/lighten

  if( darkness > 0 ){
    this.fillStyle( context, 0, 0, 0, darkness );

    if( usePaths ){
      context.fill( path );
    } else {
      context.fill();
    }

  } else if( darkness < 0 ){
    this.fillStyle( context, 255, 255, 255, -darkness );

    if( usePaths ){
      context.fill( path );
    } else {
      context.fill();
    }
  }

  //
  // border

  if( borderWidth > 0 ){

    if( usePaths ){
      context.stroke( path );
    } else {
      context.stroke();
    }

    if( borderStyle === 'double' ){
      context.lineWidth = node.pstyle( 'border-width' ).pfValue / 3;

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
    context.setLineDash( [ ] );
  }

  //
  // label

  r.drawElementText( context, node, drawLabel );

  //
  // overlay

  var overlayPadding = node.pstyle( 'overlay-padding' ).pfValue;
  var overlayOpacity = node.pstyle( 'overlay-opacity' ).value;
  var overlayColor = node.pstyle( 'overlay-color' ).value;

  if( overlayOpacity > 0 ){
    this.fillStyle( context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity );

    r.nodeShapes[ 'roundrectangle' ].draw(
      context,
      pos.x,
      pos.y,
      nodeWidth + overlayPadding * 2,
      nodeHeight + overlayPadding * 2
    );

    context.fill();
  }

  //
  // clean up shift

  if( shiftToOriginWithBb ){
    context.translate( bb.x1, bb.y1 );
  }

};

// does the node have at least one pie piece?
CRp.hasPie = function( node ){
  node = node[0]; // ensure ele ref

  return node._private.hasPie;
};

CRp.drawPie = function( context, node, nodeOpacity, pos ){
  node = node[0]; // ensure ele ref

  var cyStyle = node.cy().style();
  var pieSize = node.pstyle( 'pie-size' );
  var nodeW = node.width();
  var nodeH = node.height();
  var pos = pos || node.position();
  var x = pos.x;
  var y = pos.y;
  var radius = Math.min( nodeW, nodeH ) / 2; // must fit in node
  var lastPercent = 0; // what % to continue drawing pie slices from on [0, 1]
  var usePaths = this.usePaths();

  if( usePaths ){
    x = 0;
    y = 0;
  }

  if( pieSize.units === '%' ){
    radius = radius * pieSize.pfValue;
  } else if( pieSize.pfValue !== undefined ){
    radius = pieSize.pfValue / 2;
  }

  for( var i = 1; i <= cyStyle.pieBackgroundN; i++ ){ // 1..N
    var size = node.pstyle( 'pie-' + i + '-background-size' ).value;
    var color = node.pstyle( 'pie-' + i + '-background-color' ).value;
    var opacity = node.pstyle( 'pie-' + i + '-background-opacity' ).value * nodeOpacity;
    var percent = size / 100; // map integer range [0, 100] to [0, 1]

    // percent can't push beyond 1
    if( percent + lastPercent > 1 ){
      percent = 1 - lastPercent;
    }

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
    context.moveTo( x, y );
    context.arc( x, y, radius, angleStart, angleEnd );
    context.closePath();

    this.fillStyle( context, color[0], color[1], color[2], opacity );

    context.fill();

    lastPercent += percent;
  }

};


module.exports = CRp;

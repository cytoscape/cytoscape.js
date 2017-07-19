/* global Path2D */

let is = require( '../../../is' );

let CRp = {};

CRp.drawNode = function( context, node, shiftToOriginWithBb, drawLabel ){
  let r = this;
  let nodeWidth, nodeHeight;
  let _p = node._private;
  let rs = _p.rscratch;
  let pos = node.position();

  if( !is.number( pos.x ) || !is.number( pos.y ) ){
    return; // can't draw node with undefined position
  }

  if( !node.visible() ){ return; }

  let parentOpacity = node.effectiveOpacity();

  let usePaths = r.usePaths();
  let path;
  let pathCacheHit = false;

  let padding = node.padding();

  nodeWidth = node.width() + 2 * padding;
  nodeHeight = node.height() + 2 * padding;

  context.lineWidth = node.pstyle( 'border-width' ).pfValue;

  //
  // setup shift

  let bb;
  if( shiftToOriginWithBb ){
    bb = shiftToOriginWithBb;

    context.translate( -bb.x1, -bb.y1 );
  }

  //
  // load bg image

  let bgImgProp = node.pstyle( 'background-image' );
  let urls = bgImgProp.value;
  let url;
  let urlDefined = [];
  let image = [];
  let numImages = urls.length;
  for( let i = 0; i < numImages; i++ ){
    url = urls[i];
    urlDefined[i] = url != null && url !== 'none';
    if( urlDefined[i] ){
      let bgImgCrossOrigin = node.cy().style().getIndexedStyle(node, 'background-image-crossorigin', 'value', i);

      // get image, and if not loaded then ask to redraw when later loaded
      image[i] = r.getCachedImage( url, bgImgCrossOrigin, function(){
        node.emitAndNotify('background');
      } );
    }
  }

  //
  // setup styles

  let darkness = node.pstyle('background-blacken').value;
  let borderWidth = node.pstyle('border-width').pfValue;
  let bgColor = node.pstyle('background-color').value;
  let bgOpacity = node.pstyle('background-opacity').value * parentOpacity;
  let borderColor = node.pstyle('border-color').value;
  let borderStyle = node.pstyle('border-style').value;
  let borderOpacity = node.pstyle('border-opacity').value * parentOpacity;

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

  let setupShapeColor = ( bgOpy = bgOpacity ) => {
    r.fillStyle( context, bgColor[0], bgColor[1], bgColor[2], bgOpy );
  };

  let setupBorderColor = ( bdrOpy = borderOpacity ) => {
    r.strokeStyle( context, borderColor[0], borderColor[1], borderColor[2], bdrOpy );
  };


  //
  // setup shape

  let styleShape = node.pstyle('shape').strValue;
  let shapePts = node.pstyle('shape-polygon-points').pfValue;

  if( usePaths ){
    let pathCacheKey = styleShape + '$' + nodeWidth + '$' + nodeHeight + ( styleShape === 'polygon' ? '$' + shapePts.join('$') : '' );

    context.translate( pos.x, pos.y );

    if( rs.pathCacheKey === pathCacheKey ){
      path = rs.pathCache;
      pathCacheHit = true;
    } else {
      path = new Path2D();
      rs.pathCacheKey = pathCacheKey;
      rs.pathCache = path;
    }
  }

  let drawShape = () => {
    if( !pathCacheHit ){

      let npos = pos;

      if( usePaths ){
        npos = {
          x: 0,
          y: 0
        };
      }

      r.nodeShapes[ r.getNodeShape( node ) ].draw(
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
  };

  let drawImages = ( nodeOpacity = parentOpacity ) => {
    let prevBging = _p.backgrounding;
    let totalCompleted = 0;

    for( let i = 0; i < numImages; i++ ){
      if( urlDefined[i] && image[i].complete && !image[i].error ){
        totalCompleted++;
        r.drawInscribedImage( context, image[i], node, i, nodeOpacity );
      }
    }

    _p.backgrounding = !(totalCompleted === numImages);
    if( prevBging !== _p.backgrounding ){ // update style b/c :backgrounding state changed
      node.updateStyle( false );
    }
  };

  let drawPie = ( redrawShape = false, pieOpacity = parentOpacity ) => {
    if( r.hasPie( node ) ){
      r.drawPie( context, node, pieOpacity );

      // redraw/restore path if steps after pie need it
      if( redrawShape ){

        if( !usePaths ){
          r.nodeShapes[ r.getNodeShape( node ) ].draw(
              context,
              pos.x,
              pos.y,
              nodeWidth,
              nodeHeight );
        }
      }
    }
  };

  let darken = ( darkenOpacity = parentOpacity ) => {
    let opacity = ( darkness > 0 ? darkness : -darkness ) * darkenOpacity;
    let c = darkness > 0 ? 0 : 255;

    if( darkness !== 0 ){
      r.fillStyle( context, c, c, c, opacity );

      if( usePaths ){
        context.fill( path );
      } else {
        context.fill();
      }
    }
  };

  let drawBorder = () => {
    if( borderWidth > 0 ){

      if( usePaths ){
        context.stroke( path );
      } else {
        context.stroke();
      }

      if( borderStyle === 'double' ){
        context.lineWidth = borderWidth / 3;

        let gco = context.globalCompositeOperation;
        context.globalCompositeOperation = 'destination-out';

        if( usePaths ){
          context.stroke( path );
        } else {
          context.stroke();
        }

        context.globalCompositeOperation = gco;
      }

    }
  };

  let drawOverlay = () => {
    let overlayPadding = node.pstyle( 'overlay-padding' ).pfValue;
    let overlayOpacity = node.pstyle( 'overlay-opacity' ).value;
    let overlayColor = node.pstyle( 'overlay-color' ).value;

    if( overlayOpacity > 0 ){
      r.fillStyle( context, overlayColor[0], overlayColor[1], overlayColor[2], overlayOpacity );

      r.nodeShapes[ 'roundrectangle' ].draw(
        context,
        pos.x,
        pos.y,
        nodeWidth + overlayPadding * 2,
        nodeHeight + overlayPadding * 2
      );

      context.fill();
    }
  };

  let drawText = () => {
    r.drawElementText( context, node, drawLabel );
  };

  let ghost = node.pstyle('ghost').value === 'yes';

  if( ghost ){
    let gx = node.pstyle('ghost-offset-x').pfValue;
    let gy = node.pstyle('ghost-offset-y').pfValue;
    let ghostOpacity = node.pstyle('ghost-opacity').value;
    let effGhostOpacity = ghostOpacity * parentOpacity;

    context.translate( gx, gy );

    setupShapeColor( ghostOpacity * bgOpacity );
    drawShape();
    drawImages( effGhostOpacity );
    drawPie( darkness !== 0 || borderWidth !== 0 );
    darken( effGhostOpacity );
    setupBorderColor( ghostOpacity * borderOpacity );
    drawBorder();

    context.translate( -gx, -gy );
  }

  setupShapeColor();
  drawShape();
  drawImages();
  drawPie( darkness !== 0 || borderWidth !== 0 );
  darken();
  setupBorderColor();
  drawBorder();

  if( usePaths ){
    context.translate( -pos.x, -pos.y );
  }

  drawText();
  drawOverlay();

  // reset in case we changed the border style
  if( context.setLineDash ){ // for very outofdate browsers
    context.setLineDash( [ ] );
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
  pos || node.position();

  let cyStyle = node.cy().style();
  let pieSize = node.pstyle( 'pie-size' );
  let x = pos.x;
  let y = pos.y;
  let nodeW = node.width();
  let nodeH = node.height();
  let radius = Math.min( nodeW, nodeH ) / 2; // must fit in node
  let lastPercent = 0; // what % to continue drawing pie slices from on [0, 1]
  let usePaths = this.usePaths();

  if( usePaths ){
    x = 0;
    y = 0;
  }

  if( pieSize.units === '%' ){
    radius = radius * pieSize.pfValue;
  } else if( pieSize.pfValue !== undefined ){
    radius = pieSize.pfValue / 2;
  }

  for( let i = 1; i <= cyStyle.pieBackgroundN; i++ ){ // 1..N
    let size = node.pstyle( 'pie-' + i + '-background-size' ).value;
    let color = node.pstyle( 'pie-' + i + '-background-color' ).value;
    let opacity = node.pstyle( 'pie-' + i + '-background-opacity' ).value * nodeOpacity;
    let percent = size / 100; // map integer range [0, 100] to [0, 1]

    // percent can't push beyond 1
    if( percent + lastPercent > 1 ){
      percent = 1 - lastPercent;
    }

    let angleStart = 1.5 * Math.PI + 2 * Math.PI * lastPercent; // start at 12 o'clock and go clockwise
    let angleDelta = 2 * Math.PI * percent;
    let angleEnd = angleStart + angleDelta;

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

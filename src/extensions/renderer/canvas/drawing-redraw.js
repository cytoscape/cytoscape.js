'use strict';

var CRp = {};

var util = require( '../../../util' );

var motionBlurDelay = 100;

// var isFirefox = typeof InstallTrigger !== 'undefined';

CRp.getPixelRatio = function(){
  var context = this.data.contexts[0];

  if( this.forcedPixelRatio != null ){
    return this.forcedPixelRatio;
  }

  var backingStore = context.backingStorePixelRatio ||
    context.webkitBackingStorePixelRatio ||
    context.mozBackingStorePixelRatio ||
    context.msBackingStorePixelRatio ||
    context.oBackingStorePixelRatio ||
    context.backingStorePixelRatio || 1;

  return (window.devicePixelRatio || 1) / backingStore; // eslint-disable-line no-undef
};

CRp.paintCache = function( context ){
  var caches = this.paintCaches = this.paintCaches || [];
  var needToCreateCache = true;
  var cache;

  for( var i = 0; i < caches.length; i++ ){
    cache = caches[ i ];

    if( cache.context === context ){
      needToCreateCache = false;
      break;
    }
  }

  if( needToCreateCache ){
    cache = {
      context: context
    };
    caches.push( cache );
  }

  return cache;
};

CRp.fillStyle = function( context, r, g, b, a ){
  context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // turn off for now, seems context does its own caching

  // var cache = this.paintCache(context);

  // var fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // if( cache.fillStyle !== fillStyle ){
  //   context.fillStyle = cache.fillStyle = fillStyle;
  // }
};

CRp.strokeStyle = function( context, r, g, b, a ){
  context.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // turn off for now, seems context does its own caching

  // var cache = this.paintCache(context);

  // var strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

  // if( cache.strokeStyle !== strokeStyle ){
  //   context.strokeStyle = cache.strokeStyle = strokeStyle;
  // }
};

CRp.shadowStyle = function( context, color, opacity, blur, offsetX, offsetY ){
  var zoom = this.cy.zoom();

  // var cache = this.paintCache( context );
  //
  // // don't make expensive changes to the shadow style if it's not used
  // if( cache.shadowOpacity === 0 && opacity === 0 ){
  //   return;
  // }
  //
  // cache.shadowOpacity = opacity;

  if( opacity > 0 ){
    context.shadowBlur = blur * zoom;
    context.shadowColor = 'rgba(' + color[0] + ',' + color[1] + ',' + color[2] + ',' + opacity + ')';
    context.shadowOffsetX = offsetX * zoom;
    context.shadowOffsetY = offsetY * zoom;
  } else {
    context.shadowBlur = 0;
    context.shadowColor = 'transparent';
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;
  }
};

// Resize canvas
CRp.matchCanvasSize = function( container ){
  var r = this;
  var data = r.data;
  var width = container.clientWidth;
  var height = container.clientHeight;
  var pixelRatio = r.getPixelRatio();
  var mbPxRatio = r.motionBlurPxRatio;

  if(
    container === r.data.bufferCanvases[ r.MOTIONBLUR_BUFFER_NODE ] ||
    container === r.data.bufferCanvases[ r.MOTIONBLUR_BUFFER_DRAG ]
  ){
    pixelRatio = mbPxRatio;
  }

  var canvasWidth = width * pixelRatio;
  var canvasHeight = height * pixelRatio;
  var canvas;

  if( canvasWidth === r.canvasWidth && canvasHeight === r.canvasHeight ){
    return; // save cycles if same
  }

  r.fontCaches = null; // resizing resets the style

  var canvasContainer = data.canvasContainer;
  canvasContainer.style.width = width + 'px';
  canvasContainer.style.height = height + 'px';

  for( var i = 0; i < r.CANVAS_LAYERS; i++ ){

    canvas = data.canvases[ i ];

    if( canvas.width !== canvasWidth || canvas.height !== canvasHeight ){

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }
  }

  for( var i = 0; i < r.BUFFER_COUNT; i++ ){

    canvas = data.bufferCanvases[ i ];

    if( canvas.width !== canvasWidth || canvas.height !== canvasHeight ){

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
    }
  }

  r.textureMult = 1;
  if( pixelRatio <= 1 ){
    canvas = data.bufferCanvases[ r.TEXTURE_BUFFER ];

    r.textureMult = 2;
    canvas.width = canvasWidth * r.textureMult;
    canvas.height = canvasHeight * r.textureMult;
  }

  r.canvasWidth = canvasWidth;
  r.canvasHeight = canvasHeight;

};

CRp.renderTo = function( cxt, zoom, pan, pxRatio ){
  this.render( {
    forcedContext: cxt,
    forcedZoom: zoom,
    forcedPan: pan,
    drawAllLayers: true,
    forcedPxRatio: pxRatio
  } );
};

CRp.render = function( options ){
  options = options || util.staticEmptyObject();

  var forcedContext = options.forcedContext;
  var drawAllLayers = options.drawAllLayers;
  var drawOnlyNodeLayer = options.drawOnlyNodeLayer;
  var forcedZoom = options.forcedZoom;
  var forcedPan = options.forcedPan;
  var r = this;
  var pixelRatio = options.forcedPxRatio === undefined ? this.getPixelRatio() : options.forcedPxRatio;
  var cy = r.cy; var data = r.data;
  var needDraw = data.canvasNeedsRedraw;
  var textureDraw = r.textureOnViewport && !forcedContext && (r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming);
  var motionBlur = options.motionBlur !== undefined ? options.motionBlur : r.motionBlur;
  var mbPxRatio = r.motionBlurPxRatio;
  var hasCompoundNodes = cy.hasCompoundNodes();
  var inNodeDragGesture = r.hoverData.draggingEles;
  var inBoxSelection = r.hoverData.selecting || r.touchData.selecting ? true : false;
  motionBlur = motionBlur && !forcedContext && r.motionBlurEnabled && !inBoxSelection;
  var motionBlurFadeEffect = motionBlur;

  if( !forcedContext ){
    if( r.prevPxRatio !== pixelRatio ){
      r.invalidateContainerClientCoordsCache();
      r.matchCanvasSize( r.container );

      r.redrawHint('eles', true);
      r.redrawHint('drag', true);
    }

    r.prevPxRatio = pixelRatio;
  }

  if( !forcedContext && r.motionBlurTimeout ){
    clearTimeout( r.motionBlurTimeout );
  }

  if( motionBlur ){
    if( r.mbFrames == null ){
      r.mbFrames = 0;
    }

    if( !r.drawingImage ){ // image loading frames don't count towards motion blur blurry frames
      r.mbFrames++;
    }

    if( r.mbFrames < 3 ){ // need several frames before even high quality motionblur
      motionBlurFadeEffect = false;
    }

    // go to lower quality blurry frames when several m/b frames have been rendered (avoids flashing)
    if( r.mbFrames > r.minMbLowQualFrames ){
      //r.fullQualityMb = false;
      r.motionBlurPxRatio = r.mbPxRBlurry;
    }
  }

  if( r.clearingMotionBlur ){
    r.motionBlurPxRatio = 1;
  }

  // b/c drawToContext() may be async w.r.t. redraw(), keep track of last texture frame
  // because a rogue async texture frame would clear needDraw
  if( r.textureDrawLastFrame && !textureDraw ){
    needDraw[ r.NODE ] = true;
    needDraw[ r.SELECT_BOX ] = true;
  }

  var coreStyle = cy.style()._private.coreStyle;

  var zoom = cy.zoom();
  var effectiveZoom = forcedZoom !== undefined ? forcedZoom : zoom;
  var pan = cy.pan();
  var effectivePan = {
    x: pan.x,
    y: pan.y
  };

  var vp = {
    zoom: zoom,
    pan: {
      x: pan.x,
      y: pan.y
    }
  };
  var prevVp = r.prevViewport;
  var viewportIsDiff = prevVp === undefined || vp.zoom !== prevVp.zoom || vp.pan.x !== prevVp.pan.x || vp.pan.y !== prevVp.pan.y;

  // we want the low quality motionblur only when the viewport is being manipulated etc (where it's not noticed)
  if( !viewportIsDiff && !(inNodeDragGesture && !hasCompoundNodes) ){
    r.motionBlurPxRatio = 1;
  }

  if( forcedPan ){
    effectivePan = forcedPan;
  }

  // apply pixel ratio

  effectiveZoom *= pixelRatio;
  effectivePan.x *= pixelRatio;
  effectivePan.y *= pixelRatio;

  var eles = r.getCachedZSortedEles();

  function mbclear( context, x, y, w, h ){
    var gco = context.globalCompositeOperation;

    context.globalCompositeOperation = 'destination-out';
    r.fillStyle( context, 255, 255, 255, r.motionBlurTransparency );
    context.fillRect( x, y, w, h );

    context.globalCompositeOperation = gco;
  }

  function setContextTransform( context, clear ){
    var ePan, eZoom, w, h;

    if( !r.clearingMotionBlur && (context === data.bufferContexts[ r.MOTIONBLUR_BUFFER_NODE ] || context === data.bufferContexts[ r.MOTIONBLUR_BUFFER_DRAG ]) ){
      ePan = {
        x: pan.x * mbPxRatio,
        y: pan.y * mbPxRatio
      };

      eZoom = zoom * mbPxRatio;

      w = r.canvasWidth * mbPxRatio;
      h = r.canvasHeight * mbPxRatio;
    } else {
      ePan = effectivePan;
      eZoom = effectiveZoom;

      w = r.canvasWidth;
      h = r.canvasHeight;
    }

    context.setTransform( 1, 0, 0, 1, 0, 0 );

    if( clear === 'motionBlur' ){
      mbclear( context, 0, 0, w, h );
    } else if( !forcedContext && (clear === undefined || clear) ){
      context.clearRect( 0, 0, w, h );
    }

    if( !drawAllLayers ){
      context.translate( ePan.x, ePan.y );
      context.scale( eZoom, eZoom );
    }
    if( forcedPan ){
      context.translate( forcedPan.x, forcedPan.y );
    }
    if( forcedZoom ){
      context.scale( forcedZoom, forcedZoom );
    }
  }

  if( !textureDraw ){
    r.textureDrawLastFrame = false;
  }

  if( textureDraw ){
    r.textureDrawLastFrame = true;

    var bb;

    if( !r.textureCache ){
      r.textureCache = {};

      bb = r.textureCache.bb = cy.mutableElements().boundingBox();

      r.textureCache.texture = r.data.bufferCanvases[ r.TEXTURE_BUFFER ];

      var cxt = r.data.bufferContexts[ r.TEXTURE_BUFFER ];

      cxt.setTransform( 1, 0, 0, 1, 0, 0 );
      cxt.clearRect( 0, 0, r.canvasWidth * r.textureMult, r.canvasHeight * r.textureMult );

      r.render( {
        forcedContext: cxt,
        drawOnlyNodeLayer: true,
        forcedPxRatio: pixelRatio * r.textureMult
      } );

      var vp = r.textureCache.viewport = {
        zoom: cy.zoom(),
        pan: cy.pan(),
        width: r.canvasWidth,
        height: r.canvasHeight
      };

      vp.mpan = {
        x: (0 - vp.pan.x) / vp.zoom,
        y: (0 - vp.pan.y) / vp.zoom
      };
    }

    needDraw[ r.DRAG ] = false;
    needDraw[ r.NODE ] = false;

    var context = data.contexts[ r.NODE ];

    var texture = r.textureCache.texture;
    var vp = r.textureCache.viewport;
    bb = r.textureCache.bb;

    context.setTransform( 1, 0, 0, 1, 0, 0 );

    if( motionBlur ){
      mbclear( context, 0, 0, vp.width, vp.height );
    } else {
      context.clearRect( 0, 0, vp.width, vp.height );
    }

    var outsideBgColor = coreStyle[ 'outside-texture-bg-color' ].value;
    var outsideBgOpacity = coreStyle[ 'outside-texture-bg-opacity' ].value;
    r.fillStyle( context, outsideBgColor[0], outsideBgColor[1], outsideBgColor[2], outsideBgOpacity );
    context.fillRect( 0, 0, vp.width, vp.height );

    var zoom = cy.zoom();

    setContextTransform( context, false );

    context.clearRect( vp.mpan.x, vp.mpan.y, vp.width / vp.zoom / pixelRatio, vp.height / vp.zoom / pixelRatio );
    context.drawImage( texture, vp.mpan.x, vp.mpan.y, vp.width / vp.zoom / pixelRatio, vp.height / vp.zoom / pixelRatio );

  } else if( r.textureOnViewport && !forcedContext ){ // clear the cache since we don't need it
    r.textureCache = null;
  }

  var extent = cy.extent();
  var vpManip = (r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming || r.hoverData.draggingEles);
  var hideEdges = r.hideEdgesOnViewport && vpManip;

  var needMbClear = [];

  needMbClear[ r.NODE ] = !needDraw[ r.NODE ] && motionBlur && !r.clearedForMotionBlur[ r.NODE ] || r.clearingMotionBlur;
  if( needMbClear[ r.NODE ] ){ r.clearedForMotionBlur[ r.NODE ] = true; }

  needMbClear[ r.DRAG ] = !needDraw[ r.DRAG ] && motionBlur && !r.clearedForMotionBlur[ r.DRAG ] || r.clearingMotionBlur;
  if( needMbClear[ r.DRAG ] ){ r.clearedForMotionBlur[ r.DRAG ] = true; }

  if( needDraw[ r.NODE ] || drawAllLayers || drawOnlyNodeLayer || needMbClear[ r.NODE ] ){
    var useBuffer = motionBlur && !needMbClear[ r.NODE ] && mbPxRatio !== 1;
    var context = forcedContext || ( useBuffer ? r.data.bufferContexts[ r.MOTIONBLUR_BUFFER_NODE ] : data.contexts[ r.NODE ] );
    var clear = motionBlur && !useBuffer ? 'motionBlur' : undefined;

    setContextTransform( context, clear );

    if( hideEdges ){
      r.drawCachedNodes( context, eles.nondrag, pixelRatio, extent );
    } else {
      r.drawLayeredElements( context, eles.nondrag, pixelRatio, extent );
    }

    if( !drawAllLayers && !motionBlur ){
      needDraw[ r.NODE ] = false;
    }
  }

  if( !drawOnlyNodeLayer && (needDraw[ r.DRAG ] || drawAllLayers || needMbClear[ r.DRAG ]) ){
    var useBuffer = motionBlur && !needMbClear[ r.DRAG ] && mbPxRatio !== 1;
    var context = forcedContext || ( useBuffer ? r.data.bufferContexts[ r.MOTIONBLUR_BUFFER_DRAG ] : data.contexts[ r.DRAG ] );

    setContextTransform( context, motionBlur && !useBuffer ? 'motionBlur' : undefined );

    if( hideEdges ){
      r.drawCachedNodes( context, eles.drag, pixelRatio, extent );
    } else {
      r.drawCachedElements( context, eles.drag, pixelRatio, extent );
    }

    if( !drawAllLayers && !motionBlur ){
      needDraw[ r.DRAG ] = false;
    }
  }

  if( r.showFps || (!drawOnlyNodeLayer && (needDraw[ r.SELECT_BOX ] && !drawAllLayers)) ){
    var context = forcedContext || data.contexts[ r.SELECT_BOX ];

    setContextTransform( context );

    if( r.selection[4] == 1 && ( r.hoverData.selecting || r.touchData.selecting ) ){
      var zoom = r.cy.zoom();
      var borderWidth = coreStyle[ 'selection-box-border-width' ].value / zoom;

      context.lineWidth = borderWidth;
      context.fillStyle = 'rgba('
        + coreStyle[ 'selection-box-color' ].value[0] + ','
        + coreStyle[ 'selection-box-color' ].value[1] + ','
        + coreStyle[ 'selection-box-color' ].value[2] + ','
        + coreStyle[ 'selection-box-opacity' ].value + ')';

      context.fillRect(
        r.selection[0],
        r.selection[1],
        r.selection[2] - r.selection[0],
        r.selection[3] - r.selection[1] );

      if( borderWidth > 0 ){
        context.strokeStyle = 'rgba('
          + coreStyle[ 'selection-box-border-color' ].value[0] + ','
          + coreStyle[ 'selection-box-border-color' ].value[1] + ','
          + coreStyle[ 'selection-box-border-color' ].value[2] + ','
          + coreStyle[ 'selection-box-opacity' ].value + ')';

        context.strokeRect(
          r.selection[0],
          r.selection[1],
          r.selection[2] - r.selection[0],
          r.selection[3] - r.selection[1] );
      }
    }

    if( data.bgActivePosistion && !r.hoverData.selecting ){
      var zoom = r.cy.zoom();
      var pos = data.bgActivePosistion;

      context.fillStyle = 'rgba('
        + coreStyle[ 'active-bg-color' ].value[0] + ','
        + coreStyle[ 'active-bg-color' ].value[1] + ','
        + coreStyle[ 'active-bg-color' ].value[2] + ','
        + coreStyle[ 'active-bg-opacity' ].value + ')';

      context.beginPath();
      context.arc( pos.x, pos.y, coreStyle[ 'active-bg-size' ].pfValue / zoom, 0, 2 * Math.PI );
      context.fill();
    }

    var timeToRender = r.lastRedrawTime;
    if( r.showFps && timeToRender ){
      timeToRender = Math.round( timeToRender );
      var fps = Math.round( 1000 / timeToRender );

      context.setTransform( 1, 0, 0, 1, 0, 0 );

      context.fillStyle = 'rgba(255, 0, 0, 0.75)';
      context.strokeStyle = 'rgba(255, 0, 0, 0.75)';
      context.lineWidth = 1;
      context.fillText( '1 frame = ' + timeToRender + ' ms = ' + fps + ' fps', 0, 20 );

      var maxFps = 60;
      context.strokeRect( 0, 30, 250, 20 );
      context.fillRect( 0, 30, 250 * Math.min( fps / maxFps, 1 ), 20 );
    }

    if( !drawAllLayers ){
      needDraw[ r.SELECT_BOX ] = false;
    }
  }

  // motionblur: blit rendered blurry frames
  if( motionBlur && mbPxRatio !== 1 ){
    var cxtNode = data.contexts[ r.NODE ];
    var txtNode = r.data.bufferCanvases[ r.MOTIONBLUR_BUFFER_NODE ];

    var cxtDrag = data.contexts[ r.DRAG ];
    var txtDrag = r.data.bufferCanvases[ r.MOTIONBLUR_BUFFER_DRAG ];

    var drawMotionBlur = function( cxt, txt, needClear ){
      cxt.setTransform( 1, 0, 0, 1, 0, 0 );

      if( needClear || !motionBlurFadeEffect ){
        cxt.clearRect( 0, 0, r.canvasWidth, r.canvasHeight );
      } else {
        mbclear( cxt, 0, 0, r.canvasWidth, r.canvasHeight );
      }

      var pxr = mbPxRatio;

      cxt.drawImage(
        txt, // img
        0, 0, // sx, sy
        r.canvasWidth * pxr, r.canvasHeight * pxr, // sw, sh
        0, 0, // x, y
        r.canvasWidth, r.canvasHeight // w, h
      );
    };

    if( needDraw[ r.NODE ] || needMbClear[ r.NODE ] ){
      drawMotionBlur( cxtNode, txtNode, needMbClear[ r.NODE ] );
      needDraw[ r.NODE ] = false;
    }

    if( needDraw[ r.DRAG ] || needMbClear[ r.DRAG ] ){
      drawMotionBlur( cxtDrag, txtDrag, needMbClear[ r.DRAG ] );
      needDraw[ r.DRAG ] = false;
    }
  }

  r.prevViewport = vp;

  if( r.clearingMotionBlur ){
    r.clearingMotionBlur = false;
    r.motionBlurCleared = true;
    r.motionBlur = true;
  }

  if( motionBlur ){
    r.motionBlurTimeout = setTimeout( function(){
      r.motionBlurTimeout = null;

      r.clearedForMotionBlur[ r.NODE ] = false;
      r.clearedForMotionBlur[ r.DRAG ] = false;
      r.motionBlur = false;
      r.clearingMotionBlur = !textureDraw;
      r.mbFrames = 0;

      needDraw[ r.NODE ] = true;
      needDraw[ r.DRAG ] = true;

      r.redraw();
    }, motionBlurDelay );
  }

  r.drawingImage = false;


  if( !forcedContext && !r.initrender ){
    r.initrender = true;
    cy.trigger( 'initrender' );
  }

  if( !forcedContext ){
    cy.trigger('render');
  }

};

module.exports = CRp;

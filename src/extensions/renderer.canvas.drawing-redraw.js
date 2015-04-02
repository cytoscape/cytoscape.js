;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');
  var CR = CanvasRenderer;
  var CRp = CanvasRenderer.prototype;

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

    //console.log(window.devicePixelRatio, backingStore);

    // if( isFirefox ){ // because ff can't scale canvas properly
    //   return 1;
    // }

    return (window.devicePixelRatio || 1) / backingStore;
  };

  CRp.paintCache = function(context){
    var caches = this.paintCaches = this.paintCaches || [];
    var needToCreateCache = true;
    var cache;

    for(var i = 0; i < caches.length; i++ ){
      cache = caches[i];

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

  CRp.fillStyle = function(context, r, g, b, a){
    context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    
    // turn off for now, seems context does its own caching

    // var cache = this.paintCache(context);

    // var fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

    // if( cache.fillStyle !== fillStyle ){
    //   context.fillStyle = cache.fillStyle = fillStyle;
    // }
  };

  CRp.strokeStyle = function(context, r, g, b, a){
    context.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
    
    // turn off for now, seems context does its own caching

    // var cache = this.paintCache(context);

    // var strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

    // if( cache.strokeStyle !== strokeStyle ){
    //   context.strokeStyle = cache.strokeStyle = strokeStyle;
    // }
  };
  
  CRp.shadowStyle = function(context, color, opacity, blur, offsetX, offsetY){
    var zoom = this.data.cy.zoom();

    if (opacity > 0) {
      context.shadowBlur = blur * zoom;
      context.shadowColor = "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + opacity + ")";
      context.shadowOffsetX = offsetX * zoom;
      context.shadowOffsetY = offsetY * zoom;
    } else {
      context.shadowBlur = 0;
      context.shadowColor = "transparent";
    }
  }

  // Resize canvas
  CRp.matchCanvasSize = function(container) {
    var data = this.data;
    var width = container.clientWidth;
    var height = container.clientHeight;
    var pixelRatio = this.getPixelRatio();
    var mbPxRatio = this.motionBlurPxRatio;

    if(
      container === this.data.bufferCanvases[CR.MOTIONBLUR_BUFFER_NODE] ||
      container === this.data.bufferCanvases[CR.MOTIONBLUR_BUFFER_DRAG]
    ){
      pixelRatio = mbPxRatio;
    }

    var canvasWidth = width * pixelRatio;
    var canvasHeight = height * pixelRatio;
    var canvas;

    if( canvasWidth === this.canvasWidth && canvasHeight === this.canvasHeight ){
      return; // save cycles if same
    }

    this.fontCaches = null; // resizing resets the style

    var canvasContainer = data.canvasContainer;
    canvasContainer.style.width = width + 'px';
    canvasContainer.style.height = height + 'px';

    for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {

      canvas = data.canvases[i];
      
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
      }
    }
    
    for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
      
      canvas = data.bufferCanvases[i];
      
      if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
      }
    }

    this.textureMult = 1;
    if( pixelRatio <= 1 ){
      canvas = data.bufferCanvases[ CanvasRenderer.TEXTURE_BUFFER ];

      this.textureMult = 2;
      canvas.width = canvasWidth * this.textureMult;
      canvas.height = canvasHeight * this.textureMult;
    }

    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

  };

  CRp.renderTo = function( cxt, zoom, pan, pxRatio ){
    this.redraw({
      forcedContext: cxt,
      forcedZoom: zoom,
      forcedPan: pan,
      drawAllLayers: true,
      forcedPxRatio: pxRatio
    });
  };

  CRp.timeToRender = function(){
    return this.redrawTotalTime / this.redrawCount;
  };

  CanvasRenderer.minRedrawLimit = 1000/60; // people can't see much better than 60fps
  CanvasRenderer.maxRedrawLimit = 1000;  // don't cap max b/c it's more important to be responsive than smooth
  CanvasRenderer.motionBlurDelay = 100;

  // Redraw frame
  CRp.redraw = function( options ) {
    options = options || {};

    // console.log('redraw');

    var forcedContext = options.forcedContext;
    var drawAllLayers = options.drawAllLayers;
    var drawOnlyNodeLayer = options.drawOnlyNodeLayer;
    var forcedZoom = options.forcedZoom;
    var forcedPan = options.forcedPan;
    var r = this;
    var pixelRatio = options.forcedPxRatio === undefined ? this.getPixelRatio() : options.forcedPxRatio;
    var cy = r.data.cy; var data = r.data; 
    var needDraw = data.canvasNeedsRedraw;
    var motionBlur = options.motionBlur !== undefined ? options.motionBlur : r.motionBlur;
    var mbPxRatio = r.motionBlurPxRatio;
    var inBoxSelection = r.hoverData.selecting || r.touchData.selecting ? true : false;
    motionBlur = motionBlur && !forcedContext && r.motionBlurEnabled && !inBoxSelection;

    if( motionBlur ){
      if( r.mbFrames == null ){
        r.mbFrames = 0;
      }

      r.mbFrames++;

      // go to lower quality blurry frames when several m/b frames have been rendered (avoids flashing)
      if( r.mbFrames > r.minMbLowQualFrames ){
        //r.fullQualityMb = false;
        r.motionBlurPxRatio = r.mbPxRBlurry;
      }
    } 

    // console.log('mb: %s, mbframes: %s, fq: %s', motionBlur, r.mbFrames, r.fullQualityMb);

    if( motionBlur && r.motionBlurTimeout ){
      clearTimeout( r.motionBlurTimeout );
    }

    if( !forcedContext && this.redrawTimeout ){
      clearTimeout( this.redrawTimeout );
    }
    this.redrawTimeout = null;

    if( this.averageRedrawTime === undefined ){ this.averageRedrawTime = 0; }

    var minRedrawLimit = CanvasRenderer.minRedrawLimit; 
    var maxRedrawLimit = CanvasRenderer.maxRedrawLimit;

    var redrawLimit = this.averageRedrawTime; // estimate the ideal redraw limit based on how fast we can draw
    redrawLimit = minRedrawLimit > redrawLimit ? minRedrawLimit : redrawLimit;
    redrawLimit = redrawLimit < maxRedrawLimit ? redrawLimit : maxRedrawLimit;

    //console.log('--\nideal: %i; effective: %i', this.averageRedrawTime, redrawLimit);

    if( this.lastDrawTime === undefined ){ this.lastDrawTime = 0; }

    var nowTime = Date.now();
    var timeElapsed = nowTime - this.lastDrawTime;
    var callAfterLimit = timeElapsed >= redrawLimit;

    if( !forcedContext && !r.clearingMotionBlur ){
      if( !callAfterLimit || this.currentlyDrawing ){
        // console.log('-- skip');

        // we have new things to draw but we're busy, so try again when possibly free
        this.redrawTimeout = setTimeout(function(){
          r.redraw();
        }, redrawLimit);
        return;
      }

      this.lastDrawTime = nowTime;
      this.currentlyDrawing = true;
    }

    if( r.clearingMotionBlur ){
      //r.fullQualityMb = true; // TODO enable when doesn't cause scaled flashing issue

      r.motionBlurPxRatio = 1;
    }


    var startTime = Date.now();

    //console.log('-- redraw --')


    function drawToContext(){ 
      // startTime = Date.now();
      // console.profile('draw' + startTime)

      var edges = r.getCachedEdges();
      var coreStyle = cy.style()._private.coreStyle;
      
      var zoom = cy.zoom();
      var effectiveZoom = forcedZoom !== undefined ? forcedZoom : zoom;
      var pan = cy.pan();
      var effectivePan = {
        x: pan.x,
        y: pan.y
      };

      if( forcedPan ){
        effectivePan = forcedPan;
      }

      // apply pixel ratio

      effectiveZoom *= pixelRatio;
      effectivePan.x *= pixelRatio;
      effectivePan.y *= pixelRatio;
      
      var eles = {
        drag: {
          nodes: [],
          edges: [],
          eles: []
        },
        nondrag: {
          nodes: [],
          edges: [],
          eles: []
        }
      };

      function mbclear( context, x, y, w, h ){
        var gco = context.globalCompositeOperation;

          context.globalCompositeOperation = 'destination-out';
          r.fillStyle( context, 255, 255, 255, 0.666 );
          context.fillRect(x, y, w, h);

          context.globalCompositeOperation = gco;
      }

      function setContextTransform(context, clear){
        var ePan, eZoom, w, h;

        if( /*!r.fullQualityMb &&*/ !r.clearingMotionBlur && (context === data.bufferContexts[CR.MOTIONBLUR_BUFFER_NODE] || context === data.bufferContexts[CR.MOTIONBLUR_BUFFER_DRAG]) ){
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

        context.setTransform(1, 0, 0, 1, 0, 0);

        if( clear === 'motionBlur' ){ 
          mbclear(context, 0, 0, w, h);
        } else if( !forcedContext && (clear === undefined || clear) ){
          context.clearRect(0, 0, w, h);
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

      var textureDraw = r.textureOnViewport && !forcedContext && (r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming);

      if( textureDraw ){

        var bb;

        if( !r.textureCache ){
          r.textureCache = {};

          bb = r.textureCache.bb = cy.elements().boundingBox();

          r.textureCache.texture = r.data.bufferCanvases[ CanvasRenderer.TEXTURE_BUFFER ];

          var cxt = r.data.bufferContexts[ CanvasRenderer.TEXTURE_BUFFER ];

          cxt.setTransform(1, 0, 0, 1, 0, 0);
          cxt.clearRect(0, 0, r.canvasWidth * r.textureMult, r.canvasHeight * r.textureMult);
          
          r.redraw({
            forcedContext: cxt,
            drawOnlyNodeLayer: true,
            forcedPxRatio: pixelRatio * r.textureMult
          });

          var vp = r.textureCache.viewport = {
            zoom: cy.zoom(),
            pan: cy.pan(),
            width: r.canvasWidth,
            height: r.canvasHeight
          };

          vp.mpan = {
            x: (0 - vp.pan.x)/vp.zoom,
            y: (0 - vp.pan.y)/vp.zoom
          };
        }

        needDraw[CR.DRAG] = false;
        needDraw[CR.NODE] = false;

        var context = data.contexts[CR.NODE];

        var texture = r.textureCache.texture;
        var vp = r.textureCache.viewport;
        bb = r.textureCache.bb;

        context.setTransform(1, 0, 0, 1, 0, 0);

        if( motionBlur ){
          mbclear(context, 0, 0, vp.width, vp.height);
        } else {
          context.clearRect(0, 0, vp.width, vp.height);
        }

        var outsideBgColor = coreStyle['outside-texture-bg-color'].value;
        var outsideBgOpacity = coreStyle['outside-texture-bg-opacity'].value;
        r.fillStyle( context, outsideBgColor[0], outsideBgColor[1], outsideBgColor[2], outsideBgOpacity );
        context.fillRect( 0, 0, vp.width, vp.height );

        var zoom = cy.zoom();
        
        setContextTransform( context, false );

        context.clearRect( vp.mpan.x, vp.mpan.y, vp.width/vp.zoom/pixelRatio, vp.height/vp.zoom/pixelRatio );
        context.drawImage( texture, vp.mpan.x, vp.mpan.y, vp.width/vp.zoom/pixelRatio, vp.height/vp.zoom/pixelRatio );

      } else if( r.textureOnViewport && !forcedContext ){ // clear the cache since we don't need it
        r.textureCache = null;
      }

      var vpManip = (r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming || r.hoverData.draggingEles);
      var hideEdges = r.hideEdgesOnViewport && vpManip;
      var hideLabels = r.hideLabelsOnViewport && vpManip;

      if (needDraw[CR.DRAG] || needDraw[CR.NODE] || drawAllLayers || drawOnlyNodeLayer) {
        //NB : VERY EXPENSIVE

        if( hideEdges ){ 
        } else {
          r.findEdgeControlPoints(edges);
        }

        var zEles = r.getCachedZSortedEles();
        var extent = cy.extent();

        for (var i = 0; i < zEles.length; i++) {
          var ele = zEles[i];
          var list;
          var bb = forcedContext ? null : ele.boundingBox();
          var insideExtent = forcedContext ? true : $$.math.boundingBoxesIntersect( extent, bb );

          if( !insideExtent ){ continue; } // no need to render

          if ( ele._private.rscratch.inDragLayer ) {
            list = eles.drag;
          } else {
            list = eles.nondrag;
          }

          list.eles.push( ele );
        }

      }
      
      
      function drawElements( list, context ){
        var eles = list.eles;

        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[i];

          if( ele.isNode() ){
            r.drawNode(context, ele);

            if( !hideLabels ){
              r.drawNodeText(context, ele);
            }

            r.drawNode(context, ele, true);
          } else if( !hideEdges ) {
            r.drawEdge(context, ele);

            if( !hideLabels ){
              r.drawEdgeText(context, ele);
            }

            r.drawEdge(context, ele, true);
          }
          
          
        }

      }

      var needMbClear = [];

      needMbClear[CR.NODE] = !needDraw[CR.NODE] && motionBlur && !r.clearedForMotionBlur[CR.NODE];
      if( needMbClear[CR.NODE] ){ r.clearedForMotionBlur[CR.NODE] = true; }

      needMbClear[CR.DRAG] = !needDraw[CR.DRAG] && motionBlur && !r.clearedForMotionBlur[CR.DRAG];
      if( needMbClear[CR.DRAG] ){ r.clearedForMotionBlur[CR.DRAG] = true; }

      // console.log('--');

      if( needDraw[CR.DRAG] && motionBlur && needMbClear[CR.NODE] ){
        // console.log('NODE blurclean');

        var context = forcedContext || data.contexts[CR.NODE];

        setContextTransform( context );
        drawElements(eles.nondrag, context);

        if( !drawAllLayers ){
          needDraw[CR.NODE] = false; 
          needMbClear[CR.NODE] = false;
        }

      } else if( needDraw[CR.NODE] || drawAllLayers || drawOnlyNodeLayer || needMbClear[CR.NODE] ){
        // console.log('NODE');

        var context = forcedContext || ( motionBlur && !needMbClear[CR.NODE] ? r.data.bufferContexts[ CR.MOTIONBLUR_BUFFER_NODE ] : data.contexts[CR.NODE] );

        setContextTransform( context ); //, motionBlur && !needMbClear[CR.NODE] ? 'motionBlur' : undefined );
        drawElements(eles.nondrag, context);
        
        if( !drawAllLayers && !motionBlur ){
          needDraw[CR.NODE] = false; 
        }
      }

      if ( !drawOnlyNodeLayer && (needDraw[CR.DRAG] || drawAllLayers) ) {
        // console.log('DRAG');

        var context = forcedContext || ( motionBlur && !needMbClear[CR.DRAG] ? r.data.bufferContexts[ CR.MOTIONBLUR_BUFFER_DRAG ] : data.contexts[CR.DRAG] );
        
        setContextTransform( context ); //, motionBlur && !needMbClear[CR.NODE] ? 'motionBlur' : undefined );
        drawElements(eles.drag, context);
        
        if( !drawAllLayers && !motionBlur ){
          needDraw[CR.DRAG] = false;
        }

        if( !r.clearedForMotionBlur[CR.NODE] ){
          needDraw[CR.NODE] = true;
          needMbClear[CR.NODE] = true;
        }
      }
      
      if( r.showFps || (!drawOnlyNodeLayer && (needDraw[CR.SELECT_BOX] && !drawAllLayers)) ) {
        // console.log('redrawing selection box');
        
        var context = forcedContext || data.contexts[CR.SELECT_BOX];

        setContextTransform( context );

        if( data.select[4] == 1 && r.hoverData.selecting ){
          var zoom = data.cy.zoom();
          var borderWidth = coreStyle['selection-box-border-width'].value / zoom;
          
          context.lineWidth = borderWidth;
          context.fillStyle = "rgba(" 
            + coreStyle['selection-box-color'].value[0] + ","
            + coreStyle['selection-box-color'].value[1] + ","
            + coreStyle['selection-box-color'].value[2] + ","
            + coreStyle['selection-box-opacity'].value + ")";
          
          context.fillRect(
            data.select[0],
            data.select[1],
            data.select[2] - data.select[0],
            data.select[3] - data.select[1]);
          
          if (borderWidth > 0) {
            context.strokeStyle = "rgba(" 
              + coreStyle['selection-box-border-color'].value[0] + ","
              + coreStyle['selection-box-border-color'].value[1] + ","
              + coreStyle['selection-box-border-color'].value[2] + ","
              + coreStyle['selection-box-opacity'].value + ")";
            
            context.strokeRect(
              data.select[0],
              data.select[1],
              data.select[2] - data.select[0],
              data.select[3] - data.select[1]);
          }
        }

        if( data.bgActivePosistion && !r.hoverData.selecting ){
          var zoom = data.cy.zoom();
          var pos = data.bgActivePosistion;

          context.fillStyle = "rgba(" 
            + coreStyle['active-bg-color'].value[0] + ","
            + coreStyle['active-bg-color'].value[1] + ","
            + coreStyle['active-bg-color'].value[2] + ","
            + coreStyle['active-bg-opacity'].value + ")";

          context.beginPath();
          context.arc(pos.x, pos.y, coreStyle['active-bg-size'].pxValue / zoom, 0, 2 * Math.PI); 
          context.fill();
        }
        
        var timeToRender = r.averageRedrawTime;
        if( r.showFps && timeToRender ){
          timeToRender = Math.round( timeToRender );
          var fps = Math.round(1000/timeToRender);

          context.setTransform(1, 0, 0, 1, 0, 0);

          //context.font = '20px helvetica';
          context.fillStyle = 'rgba(255, 0, 0, 0.75)';
          context.strokeStyle = 'rgba(255, 0, 0, 0.75)';
          context.lineWidth = 1;
          context.fillText( '1 frame = ' + timeToRender + ' ms = ' + fps + ' fps', 0, 20);

          var maxFps = 60;
          context.strokeRect(0, 30, 250, 20);
          context.fillRect(0, 30, 250 * Math.min(fps/maxFps, 1), 20);
        }

        if( !drawAllLayers ){
          needDraw[CR.SELECT_BOX] = false; 
        }
      }

      // motionblur: blit rendered blurry frames
      if( motionBlur ){
        var cxtNode = data.contexts[CR.NODE];
        var txtNode = r.data.bufferCanvases[ CR.MOTIONBLUR_BUFFER_NODE ];

        var cxtDrag = data.contexts[CR.DRAG];
        var txtDrag = r.data.bufferCanvases[ CR.MOTIONBLUR_BUFFER_DRAG ];

        var drawMotionBlur = function( cxt, txt ){
          cxt.setTransform(1, 0, 0, 1, 0, 0);

          // trailing frames effect
          var gco = cxt.globalCompositeOperation;
          cxt.globalCompositeOperation = 'destination-out';
          cxt.fillStyle = 'rgba(255, 255, 255, 0.666)';
          cxt.fillRect(0, 0, r.canvasWidth, r.canvasHeight);
          cxt.globalCompositeOperation = gco;

          var pxr = /*r.fullQualityMb ? 1 :*/ mbPxRatio;

          cxt.drawImage( 
            txt, // img
            0, 0, // sx, sy
            r.canvasWidth * pxr, r.canvasHeight * pxr, // sw, sh
            0, 0, // x, y
            r.canvasWidth, r.canvasHeight // w, h
          );
        }

        if( needDraw[CR.NODE] || needMbClear[CR.NODE] ){
          // console.log('mb NODE');

          drawMotionBlur( cxtNode, txtNode );
          needDraw[CR.NODE] = false;
        }

        if( needDraw[CR.DRAG] || needMbClear[CR.DRAG] ){
          // console.log('mb DRAG');

          drawMotionBlur( cxtDrag, txtDrag );
          needDraw[CR.DRAG] = false;
          //needMbClear[CR.NODE] = true;
        }
      }


      var endTime = Date.now();

      if( r.averageRedrawTime === undefined ){
        r.averageRedrawTime = endTime - startTime;
      }

      if( r.redrawCount === undefined ){
        r.redrawCount = 0;
      }

      r.redrawCount++;

      if( r.redrawTotalTime === undefined ){
        r.redrawTotalTime = 0;
      }

      r.redrawTotalTime += endTime - startTime;
      r.lastRedrawTime = endTime - startTime;

      // use a weighted average with a bias from the previous average so we don't spike so easily
      r.averageRedrawTime = r.averageRedrawTime/2 + (endTime - startTime)/2;
      //console.log('actual: %i, average: %i', endTime - startTime, this.averageRedrawTime);

      r.currentlyDrawing = false;

      // console.profileEnd('draw' + startTime)

      if( r.clearingMotionBlur ){
        r.clearingMotionBlur = false;
        r.motionBlurCleared = true;
        r.motionBlur = true;
      }

      if( motionBlur ){ 
        r.motionBlurTimeout = setTimeout(function(){
          r.motionBlurTimeout = null;
          // console.log('mb CLEAR');

          r.clearedForMotionBlur[CR.NODE] = false;
          r.clearedForMotionBlur[CR.DRAG] = false;
          r.motionBlur = false;
          r.clearingMotionBlur = true;
          r.mbFrames = 0;

          needDraw[CR.NODE] = true; 
          needDraw[CR.DRAG] = true; 

          r.redraw();
        }, CanvasRenderer.motionBlurDelay);
      }

    } // draw to context

    if( !forcedContext ){
      $$.util.requestAnimationFrame(drawToContext); // makes direct renders to screen a bit more responsive
    } else {
      drawToContext();
    }

    if( !forcedContext && !r.initrender ){
      r.initrender = true;
      cy.trigger('initrender');
    }

    if( !forcedContext ){
      cy.triggerOnRender();
    }
    
  };

})( cytoscape );

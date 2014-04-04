;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');

  CanvasRenderer.prototype.getPixelRatio = function(){ 
    var canvas = this.data.canvases[0];
    var context = canvas.getContext('2d');

    var backingStore = context.backingStorePixelRatio ||
      context.webkitBackingStorePixelRatio ||
      context.mozBackingStorePixelRatio ||
      context.msBackingStorePixelRatio ||
      context.oBackingStorePixelRatio ||
      context.backingStorePixelRatio || 1;

    //console.log(window.devicePixelRatio, backingStore);

    var isFirefox = typeof InstallTrigger !== 'undefined';

    if( isFirefox ){ // because ff can't scale canvas properly
      return 1;
    }

    return (window.devicePixelRatio || 1) / backingStore;
  }

  // TODO use this
  CanvasRenderer.prototype.fillStyle = function(context, r, g, b, a){
    var caches = this.fillStyleCaches = this.fillStyleCaches || [];
    var needToCreateCache = true;

    for(var i = 0; i < caches; i++ ){
      var cache = caches[i];

      if( cache.context === context ){
        needToCreateCache = false;
        break;
      }
    }

    if( needToCreateCache ){
      cache = {};
      this.fillStyleCaches.push( cache );
    }

    var style = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';

    if( cache.style !== style ){
      context.fillStyle = style;
    }
  };

  // TODO test and implement as above
  CanvasRenderer.prototype.strokeStyle = function(context, r, g, b, a){
    context.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  };

  // Resize canvas
  CanvasRenderer.prototype.matchCanvasSize = function(container) {
    var data = this.data; var width = container.clientWidth; var height = container.clientHeight;
    
    var canvas, canvasWidth = width, canvasHeight = height;
    var pixelRatio = this.getPixelRatio();

    // apply pixel ratio
    canvasWidth *= pixelRatio;
    canvasHeight *= pixelRatio;

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
      }
    }

  }

  CanvasRenderer.prototype.renderTo = function( cxt, zoom, pan, pxRatio ){
    this.redraw({
      forcedContext: cxt,
      forcedZoom: zoom,
      forcedPan: pan,
      drawAllLayers: true,
      forcedPxRatio: pxRatio
    });
  };

  // Redraw frame
  CanvasRenderer.prototype.redraw = function( options ) {
    options = options || {};

    // console.log('redraw');

    var forcedContext = options.forcedContext;
    var drawAllLayers = options.drawAllLayers;
    var forcedZoom = options.forcedZoom;
    var forcedPan = options.forcedPan;
    var r = this;
    var pixelRatio = options.forcedPxRatio === undefined ? this.getPixelRatio() : options.forcedPxRatio;
    var cy = r.data.cy; var data = r.data; 
    var needDraw = data.canvasNeedsRedraw;
    
    clearTimeout( this.redrawTimeout );

    if( this.averageRedrawTime === undefined ){ this.averageRedrawTime = 0; }

    var minRedrawLimit = 1000/60; // people can't see much better than 60fps
    var maxRedrawLimit = 1000; // don't cap max b/c it's more important to be responsive than smooth

    var redrawLimit = this.averageRedrawTime; // estimate the ideal redraw limit based on how fast we can draw
    redrawLimit = Math.max(minRedrawLimit, redrawLimit);
    redrawLimit = Math.min(redrawLimit, maxRedrawLimit);

    //console.log('--\nideal: %i; effective: %i', this.averageRedrawTime, redrawLimit);

    if( this.lastDrawTime === undefined ){ this.lastDrawTime = 0; }

    var nowTime = +new Date;
    var timeElapsed = nowTime - this.lastDrawTime;
    var callAfterLimit = timeElapsed >= redrawLimit;

    if( !forcedContext ){
      if( !callAfterLimit ){
        // console.log('-- skip');

        clearTimeout( this.redrawTimeout );
        this.redrawTimeout = setTimeout(function(){
          r.redraw();
        }, redrawLimit);
        return;
      }

      this.lastDrawTime = nowTime;
    }


    var startTime = nowTime;

    var looperMax = 100;
    //console.log('-- redraw --')

    // console.time('init'); for( var looper = 0; looper <= looperMax; looper++ ){
  

    // } console.timeEnd('init')

    function drawToContext(){
      var nodes = r.getCachedNodes(); var edges = r.getCachedEdges();

      console.log( needDraw[CanvasRenderer.DRAG], needDraw[CanvasRenderer.NODE] );

      // if( !forcedContext ){
      //   r.matchCanvasSize(data.container);
      // }

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
          edges: []
        },
        nondrag: {
          nodes: [],
          edges: []
        }
      };

      function setContextTransform(context){
        context.setTransform(1, 0, 0, 1, 0, 0);
        !forcedContext && context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        
        if( !drawAllLayers ){
          context.translate(effectivePan.x, effectivePan.y);
          context.scale(effectiveZoom, effectiveZoom);
        }
        if( forcedPan ){
          context.translate(forcedPan.x, forcedPan.y);
        } 
        if( forcedZoom ){
          context.scale(forcedZoom, forcedZoom);
        }
      }

      if (needDraw[CanvasRenderer.DRAG] || needDraw[CanvasRenderer.NODE] || drawAllLayers) {
        //NB : VERY EXPENSIVE
        //console.time('edgectlpts'); for( var looper = 0; looper <= looperMax; looper++ ){

        var hideEdges = r.hideEdgesOnViewport && (r.pinching || r.hoverData.dragging || r.swipePanning || r.data.wheelZooming || r.hoverData.draggingEles);

        if( hideEdges ){ 
        } else {
          r.findEdgeControlPoints(edges);
        }

        //} console.timeEnd('edgectlpts')

      

        // console.time('sort'); for( var looper = 0; looper <= looperMax; looper++ ){
        var zEles = r.getCachedZSortedEles();
        // } console.timeEnd('sort')

        for (var i = 0; i < zEles.length; i++) {
          var ele = zEles[i];
          var list;

          if ( ele._private.rscratch.inDragLayer ) {
            list = eles.drag;
          } else {
            list = eles.nondrag;
          }

          list[ ele._private.group ].push( ele );
        }

        // console.time('updatecompounds'); for( var looper = 0; looper <= looperMax; looper++ ){
        // no need to update graph if there is no compound node
        // if ( cy.hasCompoundNodes() )
        // {
        //   r.updateAllCompounds(elements);
        // }
        // } console.timeEnd('updatecompounds')
      }
      
      
      function drawElements( list, context ){
        var edges = list.edges;
        var nodes = list.nodes;

        for (var i = 0; i < edges.length && !hideEdges; i++) {
          ele = edges[i];
          
          r.drawEdge(context, ele);
          r.drawEdgeText(context, ele);
          r.drawEdge(context, ele, true);
        }

        for( var i = 0; i < nodes.length; i++ ){
          var ele = nodes[i];

          r.drawNode(context, ele);
          r.drawNodeText(context, ele);
          r.drawNode(context, ele, true);
        }
      }


      // console.time('drawing'); for( var looper = 0; looper <= looperMax; looper++ ){
      if (needDraw[CanvasRenderer.NODE] || drawAllLayers) {
        // console.log('redrawing node layer');
        
        var context = forcedContext || data.canvases[CanvasRenderer.NODE].getContext('2d');

        setContextTransform( context );
        drawElements(eles.nondrag, context);
        
        if( !drawAllLayers ){
          needDraw[CanvasRenderer.NODE] = false; 
        }
      }
      
      if (needDraw[CanvasRenderer.DRAG] || drawAllLayers) {
        
        var context = forcedContext || data.canvases[CanvasRenderer.DRAG].getContext('2d');
        
        setContextTransform( context );
        drawElements(eles.drag, context);
        
        if( !drawAllLayers ){
          needDraw[CanvasRenderer.DRAG] = false;
        }
      }
      
      if (needDraw[CanvasRenderer.SELECT_BOX] && !drawAllLayers) {
        // console.log('redrawing selection box');
        
        var context = forcedContext || data.canvases[CanvasRenderer.SELECT_BOX].getContext('2d');
        
        setContextTransform( context );
        
        var coreStyle = cy.style()._private.coreStyle;

        if (data.select[4] == 1) {
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

        if( data.bgActivePosistion ){
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
        
        if( !drawAllLayers ){
          needDraw[CanvasRenderer.SELECT_BOX] = false; 
        }
      }

      // } console.timeEnd('drawing')

      var endTime = +new Date;

      if( r.averageRedrawTime === undefined ){
        r.averageRedrawTime = endTime - startTime;
      }

      // use a weighted average with a bias from the previous average so we don't spike so easily
      r.averageRedrawTime = r.averageRedrawTime/2 + (endTime - startTime)/2;
      //console.log('actual: %i, average: %i', endTime - startTime, this.averageRedrawTime);
    }

    if( !forcedContext ){
      $$.util.requestAnimationFrame(drawToContext); // makes direct renders to screen a bit more responsive
    } else {
      drawToContext();
    }

    if( !forcedContext && !r.initrender ){
      r.initrender = true;
      cy.trigger('initrender');
    }
    
  };

})( cytoscape );

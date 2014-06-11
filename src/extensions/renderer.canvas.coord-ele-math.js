;(function($$){ 'use strict';

  var CanvasRenderer = $$('renderer', 'canvas');

  // Project mouse
  CanvasRenderer.prototype.projectIntoViewport = function(clientX, clientY) {
    var offsets = this.findContainerClientCoords();
    var offsetLeft = offsets[0];
    var offsetTop = offsets[1];
    
    var x = clientX - offsetLeft; 
    var y = clientY - offsetTop;
    
    x -= this.data.cy.pan().x; y -= this.data.cy.pan().y; x /= this.data.cy.zoom(); y /= this.data.cy.zoom();
    return [x, y];
  };

  CanvasRenderer.prototype.findContainerClientCoords = function() {
    var container = this.data.container;

    var bb = this.containerBB = this.containerBB || container.getBoundingClientRect();

    return [bb.left, bb.top, bb.right - bb.left, bb.bottom - bb.top];
  };

  CanvasRenderer.prototype.invalidateContainerClientCoordsCache = function(){
    this.containerBB = null;
  };

  // Find nearest element
  CanvasRenderer.prototype.findNearestElement = function(x, y, visibleElementsOnly){
    var self = this;
    var eles = this.getCachedZSortedEles();
    var near = [];
    var isTouch = CanvasRenderer.isTouch;
    var zoom = this.data.cy.zoom();
    var hasCompounds = this.data.cy.hasCompoundNodes();
    var edgeThreshold = (isTouch ? 256 : 32) / zoom;
    var nodeThreshold = (isTouch ? 16 : 0) /  zoom;

    function checkNode(node){
      var shape = CanvasRenderer.nodeShapes[ self.getNodeShape(node) ];
      var borderWO = node._private.style['border-width'].pxValue / 2;
      var width = self.getNodeWidth( node );
      var height = self.getNodeHeight( node );
      var hw = width/2;
      var hh = height/2;
      var pos = node._private.position;
      var visible = node.visible() && !node.transparent();

      // exit early if invisible edge and must be visible
      if( visibleElementsOnly && !visible ){
        return;
      }

      if(
        pos.x - hw <= x && x <= pos.x + hw // bb check x
          &&
        pos.y - hh <= y && y <= pos.y + hh // bb check y
          && 
        shape.checkPointRough(x, y, borderWO, width + nodeThreshold, height + nodeThreshold, pos.x, pos.y)
          &&
        shape.checkPoint(x, y, borderWO, width + nodeThreshold, height + nodeThreshold, pos.x, pos.y)
      ){
          near.push( node );
      }
    }

    function checkEdge(edge){
      var rs = edge._private.rscratch;
      var style = edge._private.style;
      var width = style['width'].pxValue;
      var widthSq = width * width;
      var width2 = width * 2;
      var visible = edge.visible() && !edge.transparent();
      var src = edge._private.source;
      var tgt = edge._private.target;

      // exit early if invisible edge and must be visible
      if( visibleElementsOnly && !visible ){
        return;
      }

      if (rs.edgeType === 'self') {
        if(
            (
              $$.math.inBezierVicinity(x, y, rs.startX, rs.startY, rs.cp2ax, rs.cp2ay, rs.selfEdgeMidX, rs.selfEdgeMidY, widthSq)
                &&
              ( widthSq + edgeThreshold > $$.math.sqDistanceToQuadraticBezier(x, y, rs.startX, rs.startY, rs.cp2ax, rs.cp2ay, rs.selfEdgeMidX, rs.selfEdgeMidY) )
            )
              ||
            (
              $$.math.inBezierVicinity(x, y, rs.selfEdgeMidX, rs.selfEdgeMidY, rs.cp2cx, rs.cp2cy, rs.endX, rs.endY, widthSq)
                &&
              ( widthSq + edgeThreshold > $$.math.sqDistanceToQuadraticBezier(x, y, rs.selfEdgeMidX, rs.selfEdgeMidY, rs.cp2cx, rs.cp2cy, rs.endX, rs.endY) )
            )
        ){
          near.push( edge );
        }
      
      } else if (rs.edgeType == 'haystack') {
        var tgtPos = tgt._private.position;
        var tgtW = tgt.width();
        var tgtH = tgt.height();
        var srcPos = src._private.position;
        var srcW = src.width();
        var srcH = src.height();

        var startX = srcPos.x + rs.source.x * srcW;
        var startY = srcPos.y + rs.source.y * srcH;
        var endX = tgtPos.x + rs.target.x * tgtW;
        var endY = tgtPos.y + rs.target.y * tgtH;

        if( 
          $$.math.inLineVicinity(x, y, startX, startY, endX, endY, width2)
            &&
          widthSq + edgeThreshold > $$.math.sqDistanceToFiniteLine( x, y, startX, startY, endX, endY )
        ){
          near.push( edge );
        }
      
      } else if (rs.edgeType === 'straight') {
        if(
          $$.math.inLineVicinity(x, y, rs.startX, rs.startY, rs.endX, rs.endY, width2)
            &&
          widthSq + edgeThreshold > $$.math.sqDistanceToFiniteLine(x, y, rs.startX, rs.startY, rs.endX, rs.endY)
        ){
          near.push( edge );
        }
      
      } else if (rs.edgeType === 'bezier') {
        if(
          $$.math.inBezierVicinity(x, y, rs.startX, rs.startY, rs.cp2x, rs.cp2y, rs.endX, rs.endY, widthSq)
            &&
          (widthSq + edgeThreshold > $$.math.sqDistanceToQuadraticBezier(x, y, rs.startX, rs.startY, rs.cp2x, rs.cp2y, rs.endX, rs.endY))
        ){
          near.push( edge );
        }
      }
      
      if( near.length === 0 || near[near.length - 1] !== edge ){
        var srcShape = CanvasRenderer.arrowShapes[ style['source-arrow-shape'].value ];
        var tgtShape = CanvasRenderer.arrowShapes[ style['target-arrow-shape'].value ];

        var src = src || edge._private.source;
        var tgt = tgt || edge._private.target;

        var tgtPos = tgt._private.position;
        var srcPos = src._private.position;

        var srcArW = self.getArrowWidth( style['width'].pxValue );
        var srcArH = self.getArrowHeight( style['width'].pxValue );

        var tgtArW = srcArW;
        var tgtArH = srcArH;

        if(
          (
            srcShape.roughCollide(x, y, rs.arrowStartX, rs.arrowStartY, srcArW, srcArH, [rs.arrowStartX - srcPos.x, rs.arrowStartY - srcPos.y], 0)
              &&
            srcShape.collide(x, y, rs.arrowStartX, rs.arrowStartY, srcArW, srcArH, [rs.arrowStartX - srcPos.x, rs.arrowStartY - srcPos.y], 0)
          )
            ||
          (
            tgtShape.roughCollide(x, y, rs.arrowEndX, rs.arrowEndY, tgtArW, tgtArH, [rs.arrowEndX - tgtPos.x, rs.arrowEndY - tgtPos.y], 0)
              &&
            tgtShape.collide(x, y, rs.arrowEndX, rs.arrowEndY, tgtArW, tgtArH, [rs.arrowEndX - tgtPos.x, rs.arrowEndY - tgtPos.y], 0)
          )
        ){
          near.push( edge );
        }
      }

      // for compound graphs, hitting edge may actually want a connected node instead (b/c edge may have greater z-index precedence)
      if( hasCompounds &&  near.length > 0 && near[ near.length - 1 ] === edge ){
        checkNode( src );
        checkNode( tgt );
      }
    }

    for( var i = eles.length - 1; i >= 0; i-- ){ // reverse order for precedence
      var ele = eles[i];

      if( near.length > 0 ){ break; } // since we check in z-order, first found is top and best result => exit early

      if( ele._private.group === 'nodes' ){ 
        checkNode( eles[i] );

      } else  { // then edge
        checkEdge( eles[i] );
      }

    }
  
    
    if( near.length > 0 ){
      return near[ near.length - 1 ];
    } else {
      return null;
    }
  }; 

  // 'Give me everything from this box'
  CanvasRenderer.prototype.getAllInBox = function(x1, y1, x2, y2) {
    var nodes = this.getCachedNodes();
    var edges = this.getCachedEdges();
    var box = [];
    
    var x1c = Math.min(x1, x2);
    var x2c = Math.max(x1, x2);
    var y1c = Math.min(y1, y2);
    var y2c = Math.max(y1, y2); 

    x1 = x1c; 
    x2 = x2c; 
    y1 = y1c; 
    y2 = y2c; 

    var heur;
    
    for ( var i = 0; i < nodes.length; i++ ){
      var pos = nodes[i]._private.position;
      var nShape = this.getNodeShape(nodes[i]);
      var w = this.getNodeWidth(nodes[i]);
      var h = this.getNodeHeight(nodes[i]);
      var border = nodes[i]._private.style['border-width'].pxValue / 2;
      var shapeObj = CanvasRenderer.nodeShapes[ nShape ];

      if ( shapeObj.intersectBox(x1, y1, x2, y2, w, h, pos.x, pos.y, border) ){
        box.push(nodes[i]);
      }
    }
    
    for ( var i = 0; i < edges.length; i++ ){
      var rs = edges[i]._private.rscratch;

      if (edges[i]._private.rscratch.edgeType == 'self') {
        if ((heur = $$.math.boxInBezierVicinity(x1, y1, x2, y2,
            rs.startX, rs.startY,
            rs.cp2ax, rs.cp2ay,
            rs.endX, rs.endY, edges[i]._private.style['width'].pxValue))
              &&
            (heur == 2 || (heur == 1 && $$.math.checkBezierInBox(x1, y1, x2, y2,
              rs.startX, rs.startY,
              rs.cp2ax, rs.cp2ay,
              rs.endX, rs.endY, edges[i]._private.style['width'].pxValue)))
                ||
          (heur = $$.math.boxInBezierVicinity(x1, y1, x2, y2,
            rs.startX, rs.startY,
            rs.cp2cx, rs.cp2cy,
            rs.endX, rs.endY, edges[i]._private.style['width'].pxValue))
              &&
            (heur == 2 || (heur == 1 && $$.math.checkBezierInBox(x1, y1, x2, y2,
              rs.startX, rs.startY,
              rs.cp2cx, rs.cp2cy,
              rs.endX, rs.endY, edges[i]._private.style['width'].pxValue)))
          )
        { box.push(edges[i]); }
      }
      
      if (rs.edgeType == 'bezier' &&
        (heur = $$.math.boxInBezierVicinity(x1, y1, x2, y2,
            rs.startX, rs.startY,
            rs.cp2x, rs.cp2y,
            rs.endX, rs.endY, edges[i]._private.style['width'].pxValue))
              &&
            (heur == 2 || (heur == 1 && $$.math.checkBezierInBox(x1, y1, x2, y2,
              rs.startX, rs.startY,
              rs.cp2x, rs.cp2y,
              rs.endX, rs.endY, edges[i]._private.style['width'].pxValue))))
        { box.push(edges[i]); }
    
      if (rs.edgeType == 'straight' &&
        (heur = $$.math.boxInBezierVicinity(x1, y1, x2, y2,
            rs.startX, rs.startY,
            rs.startX * 0.5 + rs.endX * 0.5, 
            rs.startY * 0.5 + rs.endY * 0.5, 
            rs.endX, rs.endY, edges[i]._private.style['width'].pxValue))
              && /* console.log('test', heur) == undefined && */
            (heur == 2 || (heur == 1 && $$.math.checkStraightEdgeInBox(x1, y1, x2, y2,
              rs.startX, rs.startY,
              rs.endX, rs.endY, edges[i]._private.style['width'].pxValue))))
        { box.push(edges[i]); }


      if (rs.edgeType == 'haystack'){
        var tgt = edges[i].target()[0];
        var tgtPos = tgt.position();
        var src = edges[i].source()[0];
        var srcPos = src.position();

        var startX = srcPos.x + rs.source.x;
        var startY = srcPos.y + rs.source.y;
        var endX = tgtPos.x + rs.target.x;
        var endY = tgtPos.y + rs.target.y;

        var startInBox = (x1 <= startX && startX <= x2) && (y1 <= startY && startY <= y2);
        var endInBox = (x1 <= endX && endX <= x2) && (y1 <= endY && endY <= y2);

        if( startInBox && endInBox ){
          box.push( edges[i] );
        }
      }
      
    }
    
    return box;
  };


  /**
   * Returns the width of the given node. If the width is set to auto,
   * returns the value of the autoWidth field.
   *
   * @param node          a node
   * @return {number}     width of the node
   */
  CanvasRenderer.prototype.getNodeWidth = function(node)
  {
    return node.width();
  };

  /**
   * Returns the height of the given node. If the height is set to auto,
   * returns the value of the autoHeight field.
   *
   * @param node          a node
   * @return {number}     width of the node
   */
  CanvasRenderer.prototype.getNodeHeight = function(node)
  {
    return node.height();
  };

  /**
   * Returns the shape of the given node. If the height or width of the given node
   * is set to auto, the node is considered to be a compound.
   *
   * @param node          a node
   * @return {String}     shape of the node
   */
  CanvasRenderer.prototype.getNodeShape = function(node)
  {
    // TODO only allow rectangle for a compound node?
//    if (node._private.style['width'].value == 'auto' ||
//        node._private.style['height'].value == 'auto')
//    {
//      return 'rectangle';
//    }

    var shape = node._private.style['shape'].value;

    if( node.isParent() ){
      if( shape === 'rectangle' || shape === 'roundrectangle' ){
        return shape;
      } else {
        return 'rectangle';
      }
    }

    return shape;
  };


  CanvasRenderer.prototype.getNodePadding = function(node)
  {
    var left = node._private.style['padding-left'].pxValue;
    var right = node._private.style['padding-right'].pxValue;
    var top = node._private.style['padding-top'].pxValue;
    var bottom = node._private.style['padding-bottom'].pxValue;

    if (isNaN(left))
    {
      left = 0;
    }

    if (isNaN(right))
    {
      right = 0;
    }

    if (isNaN(top))
    {
      top = 0;
    }

    if (isNaN(bottom))
    {
      bottom = 0;
    }

    return {left : left,
      right : right,
      top : top,
      bottom : bottom};
  };

  CanvasRenderer.prototype.zOrderSort = $$.Collection.zIndexSort;

  CanvasRenderer.prototype.updateCachedZSortedEles = function(){
    this.getCachedZSortedEles( true );
  };

  CanvasRenderer.prototype.getCachedZSortedEles = function( forceRecalc ){
    var lastNodes = this.lastZOrderCachedNodes;
    var lastEdges = this.lastZOrderCachedEdges;
    var nodes = this.getCachedNodes();
    var edges = this.getCachedEdges();
    var eles = [];

    if( forceRecalc || !lastNodes || !lastEdges || lastNodes !== nodes || lastEdges !== edges ){ 
      //console.time('cachezorder')
      
      for( var i = 0; i < nodes.length; i++ ){
        var rs = nodes[i]._private.rscratch;

        if( nodes[i].visible() && !nodes[i].transparent() ){
          eles.push( nodes[i] );
        }
      }

      for( var i = 0; i < edges.length; i++ ){
        if( edges[i].visible() && !edges[i].transparent() ){
          eles.push( edges[i] );
        }
      }

      eles.sort( this.zOrderSort );
      this.cachedZSortedEles = eles;
      //console.log('make cache')

      //console.timeEnd('cachezorder')
    } else {
      eles = this.cachedZSortedEles;
      //console.log('read cache')
    }

    this.lastZOrderCachedNodes = nodes;
    this.lastZOrderCachedEdges = edges;

    return eles;
  };

  CanvasRenderer.prototype.projectBezier = function(edge){
    var qbezierAt = $$.math.qbezierAt;
    var rs = edge._private.rscratch;
    var bpts = edge._private.rstyle.bezierPts = [];

    function pushBezierPts(pts){
      bpts.push({
        x: qbezierAt( pts[0], pts[2], pts[4], 0.05 ),
        y: qbezierAt( pts[1], pts[3], pts[5], 0.05 )
      });

      bpts.push({
        x: qbezierAt( pts[0], pts[2], pts[4], 0.25 ),
        y: qbezierAt( pts[1], pts[3], pts[5], 0.25 )
      });

      bpts.push({
        x: qbezierAt( pts[0], pts[2], pts[4], 0.4 ),
        y: qbezierAt( pts[1], pts[3], pts[5], 0.4 )
      });

      bpts.push({
        x: qbezierAt( pts[0], pts[2], pts[4], 0.5 ),
        y: qbezierAt( pts[1], pts[3], pts[5], 0.5 )
      });

      bpts.push({
        x: qbezierAt( pts[0], pts[2], pts[4], 0.6 ),
        y: qbezierAt( pts[1], pts[3], pts[5], 0.6 )
      });

      bpts.push({
        x: qbezierAt( pts[0], pts[2], pts[4], 0.75 ),
        y: qbezierAt( pts[1], pts[3], pts[5], 0.75 )
      });

      bpts.push({
        x: qbezierAt( pts[0], pts[2], pts[4], 0.95 ),
        y: qbezierAt( pts[1], pts[3], pts[5], 0.95 )
      });
    }

    if( rs.edgeType === 'self' ){
      pushBezierPts( [rs.startX, rs.startY, rs.cp2ax, rs.cp2ay, rs.selfEdgeMidX, rs.selfEdgeMidY] );
      pushBezierPts( [rs.selfEdgeMidX, rs.selfEdgeMidY, rs.cp2cx, rs.cp2cy, rs.endX, rs.endY] );
    } else if( rs.edgeType === 'bezier' ){
      pushBezierPts( [rs.startX, rs.startY, rs.cp2x, rs.cp2y, rs.endX, rs.endY] );
    }
  };

  CanvasRenderer.prototype.recalculateNodeLabelProjection = function( node ){
    var content = node._private.style['content'].strValue;
    if( !content || content.match(/^\s+$/) ){ return; }

    var textX, textY;
    var nodeWidth = node.outerWidth();
    var nodeHeight = node.outerHeight();
    var nodePos = node._private.position;
    var textHalign = node._private.style['text-halign'].strValue;
    var textValign = node._private.style['text-valign'].strValue;
    var rs = node._private.rscratch;
    var rstyle = node._private.rstyle;

    switch( textHalign ){
      case 'left':
        textX = nodePos.x - nodeWidth / 2;
        break;

      case 'right':
        textX = nodePos.x + nodeWidth / 2;
        break;

      default: // e.g. center
        textX = nodePos.x;
    }

    switch( textValign ){
      case 'top':
        textY = nodePos.y - nodeHeight / 2;
        break;

      case 'bottom':
        textY = nodePos.y + nodeHeight / 2;
        break;

      default: // e.g. middle
        textY = nodePos.y;
    }
  
    rs.labelX = textX;
    rs.labelY = textY;
    rstyle.labelX = textX;
    rstyle.labelY = textY;

    this.applyLabelDimensions( node );
  };

  CanvasRenderer.prototype.recalculateEdgeLabelProjection = function( edge ){
    var content = edge._private.style['content'].strValue;
    if( !content || content.match(/^\s+$/) ){ return; }

    var textX, textY;  
    var edgeCenterX, edgeCenterY;
    var rs = edge._private.rscratch;
    var rstyle = edge._private.rstyle;
    
    if (rs.edgeType == 'self') {
      edgeCenterX = rs.selfEdgeMidX;
      edgeCenterY = rs.selfEdgeMidY;
    } else if (rs.edgeType == 'straight') {
      edgeCenterX = (rs.startX + rs.endX) / 2;
      edgeCenterY = (rs.startY + rs.endY) / 2;
    } else if (rs.edgeType == 'bezier') {
      edgeCenterX = $$.math.qbezierAt( rs.startX, rs.cp2x, rs.endX, 0.5 );
      edgeCenterY = $$.math.qbezierAt( rs.startY, rs.cp2y, rs.endY, 0.5 );
    } else if (rs.edgeType == 'haystack') {
      var srcPos = edge.source().position();
      var tgtPos = edge.target().position();

      edgeCenterX = (srcPos.x + rs.source.x + tgtPos.x + rs.target.x)/2;
      edgeCenterY = (srcPos.y + rs.source.y + tgtPos.y + rs.target.y)/2;
    }
    
    textX = edgeCenterX;
    textY = edgeCenterY;

    // add center point to style so bounding box calculations can use it
    rs.labelX = textX;
    rs.labelY = textY;
    rstyle.labelX = textX;
    rstyle.labelY = textY;

    this.applyLabelDimensions( edge );
  };

  CanvasRenderer.prototype.applyLabelDimensions = function( ele ){
    var rs = ele._private.rscratch;
    var rstyle = ele._private.rstyle;

    var text = this.getLabelText( ele );
    var labelDims = this.calculateLabelDimensions( ele, text );
 
    rstyle.labelWidth = labelDims.width;
    rs.labelWidth = labelDims.width;
 
    rstyle.labelHeight = labelDims.height;
    rs.labelHeight = labelDims.height;
  };

  CanvasRenderer.prototype.getLabelText = function( ele ){
    var style = ele._private.style;
    var text = ele._private.style['content'].strValue;
    var textTransform = style['text-transform'].value;
    
    if (textTransform == 'none') {
    } else if (textTransform == 'uppercase') {
      text = text.toUpperCase();
    } else if (textTransform == 'lowercase') {
      text = text.toLowerCase();
    }

    return text;
  };

  CanvasRenderer.prototype.calculateLabelDimensions = function( ele, text ){
    var style = ele._private.style;
    var fStyle = style['font-style'].strValue;
    var size = style['font-size'].pxValue + 'px';
    var family = style['font-family'].strValue;
    var variant = style['font-variant'].strValue;
    var weight = style['font-weight'].strValue;

    var rscratch = ele._private.rscratch;
    var cacheKey = ele._private.labelKey;
    var cache = rscratch.labelDimCache || (rscratch.labelDimCache = {});

    if( cache[cacheKey] ){
      return cache[cacheKey];
    }

    var div = this.labelCalcDiv;

    if( !div ){
      div = this.labelCalcDiv = document.createElement('div');
      document.body.appendChild( div );
    }

    var ds = div.style;

    // from ele style
    ds.fontFamily = family;
    ds.fontStyle = fStyle;
    ds.fontSize = size;
    ds.fontVariant = variant;
    ds.fontWeight = weight;

    // forced style
    ds.position = 'absolute';
    ds.left = '-9999px';
    ds.top = '-9999px';
    ds.zIndex = '-1';
    ds.visibility = 'hidden';
    ds.padding = '0';
    ds.lineHeight = '1';

    // put label content in div
    div.innerText = text;

    cache[cacheKey] = {
      width: div.clientWidth,
      height: div.clientHeight
    };

    return cache[cacheKey];
  };  

  CanvasRenderer.prototype.recalculateRenderedStyle = function( eles ){
    var edges = [];
    var nodes = [];
    var handledEdge = {};

    for( var i = 0; i < eles.length; i++ ){
      var ele = eles[i];
      var id = ele._private.data.id;
      var styleSame = ele._private.styleKey === ele._private.rscratch.styleKey;

      if( !styleSame ){ // only need to recalc if diff style
        if( ele._private.group === 'nodes' ){
          if( !styleSame ){
            nodes.push( ele );
          }
        } else { // edges
          var curveType = ele._private.style['curve-style'].value;

          if( curveType === 'bezier' ){
            edges.push( ele );
            handledEdge[ id ] = true;

            var parallelEdges = ele.parallelEdges();
            for( var i = 0; i < parallelEdges.length; i++ ){
              var pEdge = parallelEdges[i];
              var pId = pEdge._private.data.id;

              if( !handledEdge[ pId ] ){
                edges.push( pEdge );
                handledEdge[ pId ] = true;
              }
              
            }
          } else {
            edges.push( ele );
          }

        }
      }

      ele._private.rscratch.styleKey = ele._private.styleKey;
    }

    this.recalculateEdgeProjections( edges );
    this.recalculateLabelProjections( nodes, edges );
  };

  CanvasRenderer.prototype.recalculateLabelProjections = function( nodes, edges ){
    for( var i = 0; i < nodes.length; i++ ){
      this.recalculateNodeLabelProjection( nodes[i] );
    }

    for( var i = 0; i < edges.length; i++ ){
      this.recalculateEdgeLabelProjection( edges[i] );
    }
  };

  CanvasRenderer.prototype.recalculateEdgeProjections = function( edges ){
    this.findEdgeControlPoints( edges );
  };


  // Find edge control points
  CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
    var hashTable = {}; var cy = this.data.cy;
    var pairIds = [];
    var haystackEdges = [];
    
    // create a table of edge (src, tgt) => list of edges between them
    var pairId;
    for (var i = 0; i < edges.length; i++){
      var edge = edges[i];
      var style = edge._private.style;

      // ignore edges who are not to be displayed
      // they shouldn't take up space
      if( style.display.value === 'none' ){
        continue;
      }

      if( style['curve-style'].value === 'haystack' ){
        haystackEdges.push( edge );
        continue;
      }

      var srcId = edge._private.data.source;
      var tgtId = edge._private.data.target;

      pairId = srcId > tgtId ?
        tgtId + '-' + srcId :
        srcId + '-' + tgtId ;

      if (hashTable[pairId] == null) {
        hashTable[pairId] = [];
      }
      
      hashTable[pairId].push( edge );
      pairIds.push( pairId );
    }

    var src, tgt, srcPos, tgtPos, srcW, srcH, tgtW, tgtH, srcShape, tgtShape, srcBorder, tgtBorder;
    var vectorNormInverse;
    var badBezier;
    
    // for each pair (src, tgt), create the ctrl pts
    // Nested for loop is OK; total number of iterations for both loops = edgeCount  
    for (var p = 0; p < pairIds.length; p++) {
      pairId = pairIds[p];
    
      src = cy.getElementById( hashTable[pairId][0]._private.data.source );
      tgt = cy.getElementById( hashTable[pairId][0]._private.data.target );

      srcPos = src._private.position;
      tgtPos = tgt._private.position;

      srcW = this.getNodeWidth(src);
      srcH = this.getNodeHeight(src);

      tgtW = this.getNodeWidth(tgt);
      tgtH = this.getNodeHeight(tgt);

      srcShape = CanvasRenderer.nodeShapes[ this.getNodeShape(src) ];
      tgtShape = CanvasRenderer.nodeShapes[ this.getNodeShape(tgt) ];

      srcBorder = src._private.style['border-width'].pxValue;
      tgtBorder = tgt._private.style['border-width'].pxValue;

      badBezier = false;
      

      if (hashTable[pairId].length > 1 && src !== tgt) {

        // pt outside src shape to calc distance/displacement from src to tgt
        var srcOutside = srcShape.intersectLine(
          srcPos.x,
          srcPos.y,
          srcW,
          srcH,
          tgtPos.x,
          tgtPos.y,
          srcBorder / 2
        );

        // pt outside tgt shape to calc distance/displacement from src to tgt
        var tgtOutside = tgtShape.intersectLine(
          tgtPos.x,
          tgtPos.y,
          tgtW,
          tgtH,
          srcPos.x,
          srcPos.y,
          tgtBorder / 2
        );

        var midptSrcPts = {
          x1: srcOutside[0],
          x2: tgtOutside[0],
          y1: srcOutside[1],
          y2: tgtOutside[1]
        };

        var dy = ( tgtOutside[1] - srcOutside[1] );
        var dx = ( tgtOutside[0] - srcOutside[0] );
        var l = Math.sqrt( dx*dx + dy*dy );

        var vector = {
          x: dx,
          y: dy
        };
        
        var vectorNorm = {
          x: vector.x/l,
          y: vector.y/l
        };
        vectorNormInverse = {
          x: -vectorNorm.y,
          y: vectorNorm.x
        };

        // if src intersection is inside tgt or tgt intersection is inside src, then no ctrl pts to draw
        if( 
          tgtShape.checkPoint( srcOutside[0], srcOutside[1], tgtBorder/2, tgtW, tgtH, tgtPos.x, tgtPos.y )  ||
          srcShape.checkPoint( tgtOutside[0], tgtOutside[1], srcBorder/2, srcW, srcH, srcPos.x, srcPos.y ) 
        ){
          vectorNormInverse = {};
          badBezier = true;
        }
        
      }
      
      var edge;
      var rs;
      
      for (var i = 0; i < hashTable[pairId].length; i++) {
        edge = hashTable[pairId][i];
        rs = edge._private.rscratch;
        
        var edgeIndex1 = rs.lastEdgeIndex;
        var edgeIndex2 = i;

        var numEdges1 = rs.lastNumEdges;
        var numEdges2 = hashTable[pairId].length;

        var srcX1 = rs.lastSrcCtlPtX;
        var srcX2 = srcPos.x;
        var srcY1 = rs.lastSrcCtlPtY;
        var srcY2 = srcPos.y;
        var srcW1 = rs.lastSrcCtlPtW;
        var srcW2 = src.outerWidth();
        var srcH1 = rs.lastSrcCtlPtH;
        var srcH2 = src.outerHeight();

        var tgtX1 = rs.lastTgtCtlPtX;
        var tgtX2 = tgtPos.x;
        var tgtY1 = rs.lastTgtCtlPtY;
        var tgtY2 = tgtPos.y;
        var tgtW1 = rs.lastTgtCtlPtW;
        var tgtW2 = tgt.outerWidth();
        var tgtH1 = rs.lastTgtCtlPtH;
        var tgtH2 = tgt.outerHeight();

        if( badBezier ){
          rs.badBezier = true;
        } else {
          rs.badBezier = false;
        }

        if( srcX1 === srcX2 && srcY1 === srcY2 && srcW1 === srcW2 && srcH1 === srcH2
        &&  tgtX1 === tgtX2 && tgtY1 === tgtY2 && tgtW1 === tgtW2 && tgtH1 === tgtH2
        &&  edgeIndex1 === edgeIndex2 && numEdges1 === numEdges2 ){
          // console.log('edge ctrl pt cache HIT')
          continue; // then the control points haven't changed and we can skip calculating them
        } else {
          rs.lastSrcCtlPtX = srcX2;
          rs.lastSrcCtlPtY = srcY2;
          rs.lastSrcCtlPtW = srcW2;
          rs.lastSrcCtlPtH = srcH2;
          rs.lastTgtCtlPtX = tgtX2;
          rs.lastTgtCtlPtY = tgtY2;
          rs.lastTgtCtlPtW = tgtW2;
          rs.lastTgtCtlPtH = tgtH2;
          rs.lastEdgeIndex = edgeIndex2;
          rs.lastNumEdges = numEdges2;
          // console.log('edge ctrl pt cache MISS')
        }

        var eStyle = edge._private.style;
        var stepSize = eStyle['control-point-step-size'].pxValue;
        var stepDist = eStyle['control-point-distance'] !== undefined ? eStyle['control-point-distance'].pxValue : undefined;
        var stepWeight = eStyle['control-point-weight'].value;

        // Self-edge
        if ( src.id() == tgt.id() ) {
            
          rs.edgeType = 'self';
          
          // New -- fix for large nodes
          rs.cp2ax = srcPos.x;
          rs.cp2ay = srcPos.y - (1 + Math.pow(srcH, 1.12) / 100) * stepSize * (i / 3 + 1);
          
          rs.cp2cx = src._private.position.x - (1 + Math.pow(srcW, 1.12) / 100) * stepSize * (i / 3 + 1);
          rs.cp2cy = srcPos.y;
          
          rs.selfEdgeMidX = (rs.cp2ax + rs.cp2cx) / 2.0;
          rs.selfEdgeMidY = (rs.cp2ay + rs.cp2cy) / 2.0;
          
        // Straight edge
        } else if (hashTable[pairId].length % 2 == 1
          && i == Math.floor(hashTable[pairId].length / 2)) {
          
          rs.edgeType = 'straight';
          
        // Bezier edge
        } else {
          var normStepDist = (0.5 - hashTable[pairId].length / 2 + i) * stepSize;
          var manStepDist = stepDist !== undefined ? $$.math.signum( normStepDist ) * stepDist : undefined;
          var distanceFromMidpoint = manStepDist !== undefined ? manStepDist : normStepDist;
          
          var adjustedMidpt = {
            x: midptSrcPts.x1 * (1 - stepWeight) + midptSrcPts.x2 * stepWeight,
            y: midptSrcPts.y1 * (1 - stepWeight) + midptSrcPts.y2 * stepWeight
          };

          rs.edgeType = 'bezier';
          
          rs.cp2x = adjustedMidpt.x + vectorNormInverse.x * distanceFromMidpoint;
          rs.cp2y = adjustedMidpt.y + vectorNormInverse.y * distanceFromMidpoint;
          
          // console.log(edge, midPointX, displacementX, distanceFromMidpoint);
        }

        // find endpts for edge
        this.findEndpoints( edge );

        var badStart = !$$.is.number( rs.startX ) || !$$.is.number( rs.startY );
        var badAStart = !$$.is.number( rs.arrowStartX ) || !$$.is.number( rs.arrowStartY );
        var badEnd = !$$.is.number( rs.endX ) || !$$.is.number( rs.endY );
        var badAEnd = !$$.is.number( rs.arrowEndX ) || !$$.is.number( rs.arrowEndY );

        var minCpADistFactor = 3;
        var arrowW = this.getArrowWidth( edge._private.style['width'].pxValue ) * CanvasRenderer.arrowShapeHeight;
        var minCpADist = minCpADistFactor * arrowW;
        var startACpDist = $$.math.distance( { x: rs.cp2x, y: rs.cp2y }, { x: rs.startX, y: rs.startY } );
        var closeStartACp = startACpDist < minCpADist;
        var endACpDist = $$.math.distance( { x: rs.cp2x, y: rs.cp2y }, { x: rs.endX, y: rs.endY } );
        var closeEndACp = endACpDist < minCpADist;

        if( rs.edgeType === 'bezier' ){
          var overlapping = false;

          if( badStart || badAStart || closeStartACp ){
            overlapping = true;

            // project control point along line from src centre to outside the src shape
            // (otherwise intersection will yield nothing)
            var cpD = { // delta
              x: rs.cp2x - srcPos.x,
              y: rs.cp2y - srcPos.y
            };
            var cpL = Math.sqrt( cpD.x*cpD.x + cpD.y*cpD.y ); // length of line
            var cpM = { // normalised delta
              x: cpD.x / cpL,
              y: cpD.y / cpL
            };
            var radius = Math.max(srcW, srcH);
            var cpProj = { // *2 radius guarantees outside shape
              x: rs.cp2x + cpM.x * 2 * radius,
              y: rs.cp2y + cpM.y * 2 * radius
            };

            var srcCtrlPtIntn = srcShape.intersectLine(
              srcPos.x,
              srcPos.y,
              srcW,
              srcH,
              cpProj.x,
              cpProj.y,
              srcBorder / 2
            );

            if( closeStartACp ){
              rs.cp2x = rs.cp2x + cpM.x * (minCpADist - startACpDist); 
              rs.cp2y = rs.cp2y + cpM.y * (minCpADist - startACpDist);
            } else {
              rs.cp2x = srcCtrlPtIntn[0] + cpM.x * minCpADist; 
              rs.cp2y = srcCtrlPtIntn[1] + cpM.y * minCpADist;
            }
          }

          if( badEnd || badAEnd || closeEndACp ){
            overlapping = true;

            // project control point along line from tgt centre to outside the tgt shape
            // (otherwise intersection will yield nothing)
            var cpD = { // delta
              x: rs.cp2x - tgtPos.x,
              y: rs.cp2y - tgtPos.y
            };
            var cpL = Math.sqrt( cpD.x*cpD.x + cpD.y*cpD.y ); // length of line
            var cpM = { // normalised delta
              x: cpD.x / cpL,
              y: cpD.y / cpL
            };
            var radius = Math.max(srcW, srcH);
            var cpProj = { // *2 radius guarantees outside shape
              x: rs.cp2x + cpM.x * 2 * radius,
              y: rs.cp2y + cpM.y * 2 * radius
            };

            var tgtCtrlPtIntn = tgtShape.intersectLine(
              tgtPos.x,
              tgtPos.y,
              tgtW,
              tgtH,
              cpProj.x,
              cpProj.y,
              tgtBorder / 2
            );

            if( closeEndACp ){
              rs.cp2x = rs.cp2x + cpM.x * (minCpADist - endACpDist); 
              rs.cp2y = rs.cp2y + cpM.y * (minCpADist - endACpDist);
            } else {
              rs.cp2x = tgtCtrlPtIntn[0] + cpM.x * minCpADist; 
              rs.cp2y = tgtCtrlPtIntn[1] + cpM.y * minCpADist;
            }
            
          }

          if( overlapping ){
            // recalc endpts
            this.findEndpoints( edge );
          }
        }

        // project the edge into rstyle
        this.projectBezier( edge );

      }
    }
      
    for( var i = 0; i < haystackEdges.length; i++ ){
      var edge = haystackEdges[i];
      var rscratch = edge._private.rscratch;
      var rFactor = 0.8;

      if( !rscratch.haystack ){
        var srcR = rFactor * 0.5;
        var angle = Math.random() * 2 * Math.PI;

        rscratch.source = {
          x: srcR * Math.cos(angle),
          y: srcR * Math.sin(angle)
        };

        var tgtR = rFactor * 0.5;
        var angle = Math.random() * 2 * Math.PI;

        rscratch.target = {
          x: tgtR * Math.cos(angle),
          y: tgtR * Math.sin(angle)
        };

        rscratch.edgeType = 'haystack';
        rscratch.haystack = true;
      }  
    }

    return hashTable;
  };

  CanvasRenderer.prototype.findEndpoints = function(edge) {
    var intersect;

    var source = edge.source()[0];
    var target = edge.target()[0];
    
    var tgtArShape = edge._private.style['target-arrow-shape'].value;
    var srcArShape = edge._private.style['source-arrow-shape'].value;

    var tgtBorderW = target._private.style['border-width'].pxValue;
    var srcBorderW = source._private.style['border-width'].pxValue;

    var rs = edge._private.rscratch;
    
    if (edge._private.rscratch.edgeType == 'self') {
      
      var cp = [rs.cp2cx, rs.cp2cy];
      
      intersect = CanvasRenderer.nodeShapes[this.getNodeShape(target)].intersectLine(
        target._private.position.x,
        target._private.position.y,
        this.getNodeWidth(target),
        this.getNodeHeight(target),
        cp[0],
        cp[1], 
        tgtBorderW / 2
      );
      
      var arrowEnd = $$.math.shortenIntersection(intersect, cp,
        CanvasRenderer.arrowShapes[tgtArShape].spacing(edge));
      var edgeEnd = $$.math.shortenIntersection(intersect, cp,
        CanvasRenderer.arrowShapes[tgtArShape].gap(edge));
      
      rs.endX = edgeEnd[0];
      rs.endY = edgeEnd[1];
      
      rs.arrowEndX = arrowEnd[0];
      rs.arrowEndY = arrowEnd[1];
      
      var cp = [rs.cp2ax, rs.cp2ay];

      intersect = CanvasRenderer.nodeShapes[this.getNodeShape(source)].intersectLine(
        source._private.position.x,
        source._private.position.y,
        this.getNodeWidth(source),
        this.getNodeHeight(source),
        cp[0], //halfPointX,
        cp[1], //halfPointY
        srcBorderW / 2
      );
      
      var arrowStart = $$.math.shortenIntersection(intersect, cp,
        CanvasRenderer.arrowShapes[srcArShape].spacing(edge));
      var edgeStart = $$.math.shortenIntersection(intersect, cp,
        CanvasRenderer.arrowShapes[srcArShape].gap(edge));
      
      rs.startX = edgeStart[0];
      rs.startY = edgeStart[1];


      rs.arrowStartX = arrowStart[0];
      rs.arrowStartY = arrowStart[1];
      
    } else if (rs.edgeType == 'straight') {
    
      intersect = CanvasRenderer.nodeShapes[this.getNodeShape(target)].intersectLine(
        target._private.position.x,
        target._private.position.y,
        this.getNodeWidth(target),
        this.getNodeHeight(target),
        source.position().x,
        source.position().y,
        tgtBorderW / 2);
        
      if (intersect.length === 0) {
        rs.noArrowPlacement = true;
  //      return;
      } else {
        rs.noArrowPlacement = false;
      }
      
      var arrowEnd = $$.math.shortenIntersection(intersect,
        [source.position().x, source.position().y],
        CanvasRenderer.arrowShapes[tgtArShape].spacing(edge));
      var edgeEnd = $$.math.shortenIntersection(intersect,
        [source.position().x, source.position().y],
        CanvasRenderer.arrowShapes[tgtArShape].gap(edge));

      rs.endX = edgeEnd[0];
      rs.endY = edgeEnd[1];
      
      rs.arrowEndX = arrowEnd[0];
      rs.arrowEndY = arrowEnd[1];
    
      intersect = CanvasRenderer.nodeShapes[this.getNodeShape(source)].intersectLine(
        source._private.position.x,
        source._private.position.y,
        this.getNodeWidth(source),
        this.getNodeHeight(source),
        target.position().x,
        target.position().y,
        srcBorderW / 2);
      
      if (intersect.length === 0) {
        rs.noArrowPlacement = true;
  //      return;
      } else {
        rs.noArrowPlacement = false;
      }
      
      /*
      console.log("1: "
        + CanvasRenderer.arrowShapes[srcArShape],
          srcArShape);
      */
      var arrowStart = $$.math.shortenIntersection(intersect,
        [target.position().x, target.position().y],
        CanvasRenderer.arrowShapes[srcArShape].spacing(edge));
      var edgeStart = $$.math.shortenIntersection(intersect,
        [target.position().x, target.position().y],
        CanvasRenderer.arrowShapes[srcArShape].gap(edge));

      rs.startX = edgeStart[0];
      rs.startY = edgeStart[1];
      
      rs.arrowStartX = arrowStart[0];
      rs.arrowStartY = arrowStart[1];
            
    } else if (rs.edgeType == 'bezier') {
      // if( window.badArrow) debugger;
      var cp = [rs.cp2x, rs.cp2y];
      
      intersect = CanvasRenderer.nodeShapes[
        this.getNodeShape(target)].intersectLine(
        target._private.position.x,
        target._private.position.y,
        this.getNodeWidth(target),
        this.getNodeHeight(target),
        cp[0], //halfPointX,
        cp[1], //halfPointY
        tgtBorderW / 2
      );
      
      /*
      console.log("2: "
        + CanvasRenderer.arrowShapes[srcArShape],
          srcArShape);
      */
      var arrowEnd = $$.math.shortenIntersection(intersect, cp,
        CanvasRenderer.arrowShapes[tgtArShape].spacing(edge));
      var edgeEnd = $$.math.shortenIntersection(intersect, cp,
        CanvasRenderer.arrowShapes[tgtArShape].gap(edge));
      
      rs.endX = edgeEnd[0];
      rs.endY = edgeEnd[1];
      
      rs.arrowEndX = arrowEnd[0];
      rs.arrowEndY = arrowEnd[1];
      
      intersect = CanvasRenderer.nodeShapes[
        this.getNodeShape(source)].intersectLine(
        source._private.position.x,
        source._private.position.y,
        this.getNodeWidth(source),
        this.getNodeHeight(source),
        cp[0], //halfPointX,
        cp[1], //halfPointY
        srcBorderW / 2
      );
      
      var arrowStart = $$.math.shortenIntersection(
        intersect, 
        cp,
        CanvasRenderer.arrowShapes[srcArShape].spacing(edge)
      );
      var edgeStart = $$.math.shortenIntersection(
        intersect, 
        cp,
        CanvasRenderer.arrowShapes[srcArShape].gap(edge)
      );
    
      rs.startX = edgeStart[0];
      rs.startY = edgeStart[1];
      
      rs.arrowStartX = arrowStart[0];
      rs.arrowStartY = arrowStart[1];
      
      // if( isNaN(rs.startX) || isNaN(rs.startY) ){
      //   debugger;
      // }

    } else if (rs.isArcEdge) {
      return;
    }
  };

  // Find adjacent edges
  CanvasRenderer.prototype.findEdges = function(nodeSet) {
    
    var edges = this.getCachedEdges();
    
    var hashTable = {};
    var adjacentEdges = [];
    
    for (var i = 0; i < nodeSet.length; i++) {
      hashTable[nodeSet[i]._private.data.id] = nodeSet[i];
    }
    
    for (var i = 0; i < edges.length; i++) {
      if (hashTable[edges[i]._private.data.source]
        || hashTable[edges[i]._private.data.target]) {
        
        adjacentEdges.push(edges[i]);
      }
    }
    
    return adjacentEdges;
  };

  CanvasRenderer.prototype.getArrowWidth = function(edgeWidth) {
    return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
  };
  
  CanvasRenderer.prototype.getArrowHeight = function(edgeWidth) {
    return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
  };


})( cytoscape );

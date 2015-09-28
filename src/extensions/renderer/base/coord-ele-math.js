'use strict';

var math = require('../../../math');
var is = require('../../../is');
var zIndexSort = require('../../../collection/zsort');

var BRp = {};

// Project mouse
BRp.projectIntoViewport = function(clientX, clientY) {
  var offsets = this.findContainerClientCoords();
  var offsetLeft = offsets[0];
  var offsetTop = offsets[1];

  var x = clientX - offsetLeft;
  var y = clientY - offsetTop;

  x -= this.cy.pan().x; y -= this.cy.pan().y; x /= this.cy.zoom(); y /= this.cy.zoom();
  return [x, y];
};

BRp.findContainerClientCoords = function() {
  var container = this.container;

  var bb = this.containerBB = this.containerBB || container.getBoundingClientRect();

  return [bb.left, bb.top, bb.right - bb.left, bb.bottom - bb.top];
};

BRp.invalidateContainerClientCoordsCache = function(){
  this.containerBB = null;
};

// Find nearest element
BRp.findNearestElement = function(x, y, visibleElementsOnly, isTouch){
  var self = this;
  var r = this;
  var eles = r.getCachedZSortedEles();
  var near = [];
  var zoom = r.cy.zoom();
  var hasCompounds = r.cy.hasCompoundNodes();
  var edgeThreshold = (isTouch ? 24 : 8) / zoom;
  var nodeThreshold = (isTouch ? 8 : 2) / zoom;
  var labelThreshold = (isTouch ? 8 : 2) / zoom;

  function checkNode(node){
    var _p = node._private;

    if( _p.style['events'].strValue === 'no' ){ return; }

    var width = node.outerWidth() + 2*nodeThreshold;
    var height = node.outerHeight() + 2*nodeThreshold;
    var hw = width/2;
    var hh = height/2;
    var pos = _p.position;

    if(
      pos.x - hw <= x && x <= pos.x + hw // bb check x
        &&
      pos.y - hh <= y && y <= pos.y + hh // bb check y
    ){
      var visible = !visibleElementsOnly || ( node.visible() && !node.transparent() );

      // exit early if invisible edge and must be visible
      if( visibleElementsOnly && !visible ){
        return;
      }

      var shape = r.nodeShapes[ self.getNodeShape(node) ];

      if(
        shape.checkPoint(x, y, 0, width, height, pos.x, pos.y)
      ){
        near.push( node );
      }

    }
  }

  function checkEdge(edge){
    var _p = edge._private;

    if( _p.style['events'].strValue === 'no' ){ return; }

    var rs = _p.rscratch;
    var style = _p.style;
    var width = style['width'].pfValue/2 + edgeThreshold; // more like a distance radius from centre
    var widthSq = width * width;
    var width2 = width * 2;
    var src = _p.source;
    var tgt = _p.target;
    var inEdgeBB = false;
    var sqDist;

    // exit early if invisible edge and must be visible
    var passedVisibilityCheck;
    var passesVisibilityCheck = function(){
      if( passedVisibilityCheck !== undefined ){
        return passedVisibilityCheck;
      }

      if( !visibleElementsOnly ){
        passedVisibilityCheck = true;
        return true;
      }

      var visible = edge.visible() && !edge.transparent();
      if( visible ){
        passedVisibilityCheck = true;
        return true;
      }

      passedVisibilityCheck = false;
      return false;
    };

    if( rs.edgeType === 'haystack' ){
      var radius = style['haystack-radius'].value;
      var halfRadius = radius/2; // b/c have to half width/height

      var tgtPos = tgt._private.position;
      var tgtW = tgt.width();
      var tgtH = tgt.height();
      var srcPos = src._private.position;
      var srcW = src.width();
      var srcH = src.height();

      var startX = srcPos.x + rs.source.x * srcW * halfRadius;
      var startY = srcPos.y + rs.source.y * srcH * halfRadius;
      var endX = tgtPos.x + rs.target.x * tgtW * halfRadius;
      var endY = tgtPos.y + rs.target.y * tgtH * halfRadius;

      if(
        (inEdgeBB = math.inLineVicinity(x, y, startX, startY, endX, endY, width2))
          && passesVisibilityCheck() &&
        widthSq > ( sqDist = math.sqDistanceToFiniteLine( x, y, startX, startY, endX, endY ) )
      ){
        near.push( edge );
      }

    } else if( rs.edgeType === 'segments' || rs.edgeType === 'straight' ){
      var pts = rs.allpts;

      for( var i = 0; i + 3 < pts.length; i += 2 ){
        if(
          (inEdgeBB = math.inLineVicinity(x, y, pts[i], pts[i+1], pts[i+2], pts[i+3], width2))
            && passesVisibilityCheck() &&
          widthSq > ( sqDist = math.sqDistanceToFiniteLine(x, y, pts[i], pts[i+1], pts[i+2], pts[i+3]) )
        ){
          near.push( edge );
        }
      }

    } else if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){
      var pts = rs.allpts;
      for( var i = 0; i + 5 < rs.allpts.length; i += 4 ){
        if(
          (inEdgeBB = math.inBezierVicinity(x, y, pts[i], pts[i+1], pts[i+2], pts[i+3], pts[i+4], pts[i+5], widthSq))
            && passesVisibilityCheck() &&
          (widthSq > (sqDist = math.sqDistanceToQuadraticBezier(x, y, pts[i], pts[i+1], pts[i+2], pts[i+3], pts[i+4], pts[i+5])) )
        ){
          near.push( edge );
        }
      }
    }

    // if we're close to the edge but didn't hit it, maybe we hit its arrows
    if( inEdgeBB && passesVisibilityCheck() && near.length === 0 || near[near.length - 1] !== edge ){
      var srcShape = r.arrowShapes[ style['source-arrow-shape'].value ];
      var tgtShape = r.arrowShapes[ style['target-arrow-shape'].value ];

      var src = src || _p.source;
      var tgt = tgt || _p.target;

      var tgtPos = tgt._private.position;
      var srcPos = src._private.position;

      var srcArW = self.getArrowWidth( style['width'].pfValue );
      var srcArH = self.getArrowHeight( style['width'].pfValue );

      var tgtArW = srcArW;
      var tgtArH = srcArH;

      if(
        (
          srcShape.roughCollide(x, y, rs.arrowStartX, rs.arrowStartY, srcArW, srcArH, [rs.arrowStartX - srcPos.x, rs.arrowStartY - srcPos.y], edgeThreshold)
            &&
          srcShape.collide(x, y, rs.arrowStartX, rs.arrowStartY, srcArW, srcArH, [rs.arrowStartX - srcPos.x, rs.arrowStartY - srcPos.y], edgeThreshold)
        )
          ||
        (
          tgtShape.roughCollide(x, y, rs.arrowEndX, rs.arrowEndY, tgtArW, tgtArH, [rs.arrowEndX - tgtPos.x, rs.arrowEndY - tgtPos.y], edgeThreshold)
            &&
          tgtShape.collide(x, y, rs.arrowEndX, rs.arrowEndY, tgtArW, tgtArH, [rs.arrowEndX - tgtPos.x, rs.arrowEndY - tgtPos.y], edgeThreshold)
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

  function checkLabel(ele){
    var _p = ele._private;
    var th = labelThreshold;

    if( _p.style['text-events'].strValue === 'no' ){ return; }

    // adjust bb w/ angle
    if( _p.group === 'edges' && _p.style['edge-text-rotation'].strValue === 'autorotate' ){

      var rstyle = _p.rstyle;
      var lw = rstyle.labelWidth + 2*th;
      var lh = rstyle.labelHeight + 2*th;
      var lx = rstyle.labelX;
      var ly = rstyle.labelY;

      var theta = _p.rscratch.labelAngle;
      var cos = Math.cos( theta );
      var sin = Math.sin( theta );

      var rotate = function( x, y ){
        x = x - lx;
        y = y - ly;

        return {
          x: x*cos - y*sin + lx,
          y: x*sin + y*cos + ly
        };
      };

      var lx1 = lx - lw/2;
      var lx2 = lx + lw/2;
      var ly1 = ly - lh/2;
      var ly2 = ly + lh/2;

      var px1y1 = rotate( lx1, ly1 );
      var px1y2 = rotate( lx1, ly2 );
      var px2y1 = rotate( lx2, ly1 );
      var px2y2 = rotate( lx2, ly2 );

      var points = [
        px1y1.x, px1y1.y,
        px2y1.x, px2y1.y,
        px2y2.x, px2y2.y,
        px1y2.x, px1y2.y
      ];

      if( math.pointInsidePolygonPoints( x, y, points ) ){
        near.push( ele );
      }

    } else {
      var bb = ele.boundingBox({
        includeLabels: true,
        includeNodes: false,
        includeEdges: false
      });

      // adjust bb w/ threshold
      bb.x1 -= th;
      bb.y1 -= th;
      bb.x2 += th;
      bb.y2 += th;
      bb.w = bb.x2 - bb.x1;
      bb.h = bb.y2 - bb.y1;

      if( math.inBoundingBox( bb, x, y ) ){
        near.push( ele );
      }
    }

  }

  for( var i = eles.length - 1; i >= 0; i-- ){ // reverse order for precedence
    var ele = eles[i];
    var _p = ele._private;

    if( near.length > 0 ){ break; } // since we check in z-order, first found is top and best result => exit early

    if( _p.group === 'nodes' ){
      checkNode( ele );

    } else  { // then edge
      checkEdge( ele );
    }

    checkLabel( ele );

  }


  if( near.length > 0 ){
    return near[ near.length - 1 ];
  } else {
    return null;
  }
};

// 'Give me everything from this box'
BRp.getAllInBox = function(x1, y1, x2, y2) {
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

  var boxBb = math.makeBoundingBox({
    x1: x1, y1: y1,
    x2: x2, y2: y2
  });

  var heur;

  for ( var i = 0; i < nodes.length; i++ ){
    var node = nodes[i];
    var nodeBb = node.boundingBox({
      includeNodes: true,
      includeEdges: false,
      includeLabels: false
    });

    if( math.boundingBoxesIntersect(boxBb, nodeBb) ){
      box.push(nodes[i]);
    }
  }

  for( var e = 0; e < edges.length; e++ ){
    var edge = edges[e];
    var _p = edge._private;
    var style = _p.style;
    var rs = _p.rscratch;
    var width = style['width'].pfValue;

    if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){

      var pts = rs.allpts;
      for( var i = 0; i + 6 < pts.length; i += 4 ){
        if(
          math.boxInBezierVicinity( x1, y1, x2, y2, pts[i], pts[i+1], pts[i+2], pts[i+3], pts[i+4], pts[i+5], width )
          && math.checkBezierInBox( x1, y1, x2, y2, pts[i], pts[i+1], pts[i+2], pts[i+3], pts[i+4], pts[i+5], width )
        ){
          box.push(edge);
        }
      }

    } else if( rs.edgeType === 'straight' ){

      if( (heur = math.boxInBezierVicinity(x1, y1, x2, y2,
            rs.startX, rs.startY,
            rs.startX * 0.5 + rs.endX * 0.5,
            rs.startY * 0.5 + rs.endY * 0.5,
            rs.endX, rs.endY, width))
              &&
            (heur === 2 || (heur === 1 && math.checkStraightEdgeInBox(x1, y1, x2, y2,
              rs.startX, rs.startY,
              rs.endX, rs.endY, width)))
      ){
        box.push(edge);
      }

    } else if( rs.edgeType === 'haystack' ){
      var tgt = edge.target()[0];
      var tgtPos = tgt.position();
      var src = edge.source()[0];
      var srcPos = src.position();

      var startX = srcPos.x + rs.source.x;
      var startY = srcPos.y + rs.source.y;
      var endX = tgtPos.x + rs.target.x;
      var endY = tgtPos.y + rs.target.y;

      var startInBox = (x1 <= startX && startX <= x2) && (y1 <= startY && startY <= y2);
      var endInBox = (x1 <= endX && endX <= x2) && (y1 <= endY && endY <= y2);

      if( startInBox && endInBox ){
        box.push( edge );
      }
    }

  }

  return box;
};


/**
 * Returns the shape of the given node. If the height or width of the given node
 * is set to auto, the node is considered to be a compound.
 *
 * @param node          a node
 * @return {String}     shape of the node
 */
BRp.getNodeShape = function( node ){
  var r = this;
  var style = node._private.style;
  var shape = style['shape'].value;

  if( node.isParent() ){
    if( shape === 'rectangle' || shape === 'roundrectangle' ){
      return shape;
    } else {
      return 'rectangle';
    }
  }

  if( shape === 'polygon' ){
    var points = style['shape-polygon-points'].value;

    return r.nodeShapes.makePolygon( points ).name;
  }

  return shape;
};

BRp.updateCachedZSortedEles = function(){
  this.getCachedZSortedEles( true );
};

BRp.getCachedZSortedEles = function( forceRecalc ){
  var lastNodes = this.lastZOrderCachedNodes;
  var lastEdges = this.lastZOrderCachedEdges;
  var nodes = this.getCachedNodes();
  var edges = this.getCachedEdges();
  var eles = [];

  if( forceRecalc || !lastNodes || !lastEdges || lastNodes !== nodes || lastEdges !== edges ){
    //console.time('cachezorder')

    for( var i = 0; i < nodes.length; i++ ){
      var n = nodes[i];

      if( n.animated() || (n.visible() && !n.transparent()) ){
        eles.push( n );
      }
    }

    for( var i = 0; i < edges.length; i++ ){
      var e = edges[i];

      if( e.animated() || (e.visible() && !e.transparent()) ){
        eles.push( e );
      }
    }

    eles.sort( zIndexSort );
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

function pushBezierPts(edge, pts){
  var qbezierAt = function( p1, p2, p3, t ){ return math.qbezierAt(p1, p2, p3, t); };
  var _p = edge._private;
  var rs = _p.rscratch;
  var bpts = _p.rstyle.bezierPts;

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

  var mid = {
    x: qbezierAt( pts[0], pts[2], pts[4], 0.5 ),
    y: qbezierAt( pts[1], pts[3], pts[5], 0.5 )
  };

  bpts.push( mid );

  if( rs.edgeType === 'self' || rs.edgeType === 'compound' ){
    rs.midX = rs.selfEdgeMidX;
    rs.midY = rs.selfEdgeMidY;
  } else {
    rs.midX = mid.x;
    rs.midY = mid.y;
  }

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

BRp.projectBezier = function( edge ){
  var _p = edge._private;
  var rs = _p.rscratch;

  if( rs.edgeType === 'multibezier' || rs.edgeType === 'bezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){
    var bpts = _p.rstyle.bezierPts = []; // jshint ignore:line

    for( var i = 0; i + 5 < rs.allpts.length; i += 4 ){
      pushBezierPts( edge, rs.allpts.slice(i, i+6) );
    }
  }
};

BRp.recalculateNodeLabelProjection = function( node ){
  var content = node._private.style['label'].strValue;
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

BRp.recalculateEdgeLabelProjection = function( edge ){
  var content = edge._private.style['label'].strValue;
  if( !content || content.match(/^\s+$/) ){ return; }

  var textX, textY;
  var edgeCenterX, edgeCenterY;
  var _p = edge._private;
  var rs = _p.rscratch;
  //var style = _p.style;
  var rstyle = _p.rstyle;

  if( rs.edgeType === 'self' || rs.edgeType === 'compound' ){
    edgeCenterX = rs.allpts[4];
    edgeCenterY = rs.allpts[5];
  } else if (rs.edgeType === 'straight' ){
    edgeCenterX = (rs.startX + rs.endX) / 2;
    edgeCenterY = (rs.startY + rs.endY) / 2;
  } else if( rs.edgeType === 'bezier' ){
    edgeCenterX = math.qbezierAt( rs.allpts[0], rs.allpts[2], rs.allpts[4], 0.5 );
    edgeCenterY = math.qbezierAt( rs.allpts[1], rs.allpts[3], rs.allpts[5], 0.5 );
  } else if( rs.edgeType === 'multibezier' ){
    // TODO better placement
    edgeCenterX = (rs.startX + rs.endX) / 2;
    edgeCenterY = (rs.startY + rs.endY) / 2;
  } else if( rs.edgeType === 'haystack' ){
    var pts = rs.haystackPts;

    edgeCenterX = ( pts[0] + pts[2] )/2;
    edgeCenterY = ( pts[1] + pts[3] )/2;
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

BRp.applyLabelDimensions = function( ele ){
  var rs = ele._private.rscratch;
  var rstyle = ele._private.rstyle;

  var text = this.getLabelText( ele );
  var labelDims = this.calculateLabelDimensions( ele, text );

  rstyle.labelWidth = labelDims.width;
  rs.labelWidth = labelDims.width;

  rstyle.labelHeight = labelDims.height;
  rs.labelHeight = labelDims.height;
};

BRp.getLabelText = function( ele ){
  var style = ele._private.style;
  var text = ele._private.style['label'].strValue;
  var textTransform = style['text-transform'].value;
  var rscratch = ele._private.rscratch;

  if (textTransform == 'none') {
  } else if (textTransform == 'uppercase') {
    text = text.toUpperCase();
  } else if (textTransform == 'lowercase') {
    text = text.toLowerCase();
  }

  if( style['text-wrap'].value === 'wrap' ){
    //console.log('wrap');

    // save recalc if the label is the same as before
    if( rscratch.labelWrapKey === rscratch.labelKey ){
      // console.log('wrap cache hit');
      return rscratch.labelWrapCachedText;
    }
    // console.log('wrap cache miss');

    var lines = text.split('\n');
    var maxW = style['text-max-width'].pfValue;
    var wrappedLines = [];

    for( var l = 0; l < lines.length; l++ ){
      var line = lines[l];
      var lineDims = this.calculateLabelDimensions( ele, line, 'line=' + line );
      var lineW = lineDims.width;

      if( lineW > maxW ){ // line is too long
        var words = line.split(/\s+/); // NB: assume collapsed whitespace into single space
        var subline = '';

        for( var w = 0; w < words.length; w++ ){
          var word = words[w];
          var testLine = subline.length === 0 ? word : subline + ' ' + word;
          var testDims = this.calculateLabelDimensions( ele, testLine, 'testLine=' + testLine );
          var testW = testDims.width;

          if( testW <= maxW ){ // word fits on current line
            subline += word + ' ';
          } else { // word starts new line
            wrappedLines.push( subline );
            subline = word + ' ';
          }
        }

        // if there's remaining text, put it in a wrapped line
        if( !subline.match(/^\s+$/) ){
          wrappedLines.push( subline );
        }
      } else { // line is already short enough
        wrappedLines.push( line );
      }
    } // for

    rscratch.labelWrapCachedLines = wrappedLines;
    rscratch.labelWrapCachedText = text = wrappedLines.join('\n');
    rscratch.labelWrapKey = rscratch.labelKey;

    // console.log(text)
  } // if wrap

  return text;
};

BRp.calculateLabelDimensions = function( ele, text, extraKey ){
  var r = this;
  var style = ele._private.style;
  var fStyle = style['font-style'].strValue;
  var size = style['font-size'].pfValue + 'px';
  var family = style['font-family'].strValue;
  // var variant = style['font-variant'].strValue;
  var weight = style['font-weight'].strValue;

  var cacheKey = ele._private.labelKey;

  if( extraKey ){
    cacheKey += '$@$' + extraKey;
  }

  var cache = r.labelDimCache || (r.labelDimCache = {});

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
  // ds.fontVariant = variant;
  ds.fontWeight = weight;

  // forced style
  ds.position = 'absolute';
  ds.left = '-9999px';
  ds.top = '-9999px';
  ds.zIndex = '-1';
  ds.visibility = 'hidden';
  ds.pointerEvents = 'none';
  ds.padding = '0';
  ds.lineHeight = '1';

  if( style['text-wrap'].value === 'wrap' ){
    ds.whiteSpace = 'pre'; // so newlines are taken into account
  } else {
    ds.whiteSpace = 'normal';
  }

  // put label content in div
  div.textContent = text;

  cache[cacheKey] = {
    width: div.clientWidth,
    height: div.clientHeight
  };

  return cache[cacheKey];
};

BRp.recalculateRenderedStyle = function( eles ){
  var edges = [];
  var nodes = [];
  var handledEdge = {};

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];
    var _p = ele._private;
    var style = _p.style;
    var rs = _p.rscratch;
    var rstyle = _p.rstyle;
    var id = _p.data.id;
    var bbStyleSame = rs.boundingBoxKey != null && _p.boundingBoxKey === rs.boundingBoxKey;
    var labelStyleSame = rs.labelKey != null && _p.labelKey === rs.labelKey;
    var styleSame = bbStyleSame && labelStyleSame;

    if( _p.group === 'nodes' ){
      var pos = _p.position;
      var posSame = rstyle.nodeX != null && rstyle.nodeY != null && pos.x === rstyle.nodeX && pos.y === rstyle.nodeY;
      var wSame = rstyle.nodeW != null && rstyle.nodeW === style['width'].pfValue;
      var hSame = rstyle.nodeH != null && rstyle.nodeH === style['height'].pfValue;

      if( !posSame || !styleSame || !wSame || !hSame ){
        nodes.push( ele );
      }

      rstyle.nodeX = pos.x;
      rstyle.nodeY = pos.y;
      rstyle.nodeW = style['width'].pfValue;
      rstyle.nodeH = style['height'].pfValue;
    } else { // edges

      var srcPos = _p.source._private.position;
      var tgtPos = _p.target._private.position;
      var srcSame = rstyle.srcX != null && rstyle.srcY != null && srcPos.x === rstyle.srcX && srcPos.y === rstyle.srcY;
      var tgtSame = rstyle.tgtX != null && rstyle.tgtY != null && tgtPos.x === rstyle.tgtX && tgtPos.y === rstyle.tgtY;
      var positionsSame = srcSame && tgtSame;

      if( !positionsSame || !styleSame ){
        if( rs.edgeType === 'bezier' || rs.edgeType === 'straight' ){
          if( !handledEdge[ id ] ){
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
          }
        } else {
          edges.push( ele );
        }
      } // if positions diff

      // update rstyle positions
      rstyle.srcX = srcPos.x;
      rstyle.srcY = srcPos.y;
      rstyle.tgtX = tgtPos.x;
      rstyle.tgtY = tgtPos.y;

    } // if edges

    rs.boundingBoxKey = _p.boundingBoxKey;
    rs.labelKey = _p.labelKey;
  }

  this.recalculateEdgeProjections( edges );
  this.recalculateLabelProjections( nodes, edges );
};

BRp.recalculateLabelProjections = function( nodes, edges ){
  for( var i = 0; i < nodes.length; i++ ){
    this.recalculateNodeLabelProjection( nodes[i] );
  }

  for( var i = 0; i < edges.length; i++ ){
    this.recalculateEdgeLabelProjection( edges[i] );
  }
};

BRp.recalculateEdgeProjections = function( edges ){
  this.findEdgeControlPoints( edges );
};


// Find edge control points
BRp.findEdgeControlPoints = function(edges) {
  if( !edges || edges.length === 0 ){ return; }

  var r = this;
  var cy = r.cy;
  var hasCompounds = cy.hasCompoundNodes();
  var hashTable = {};
  var pairIds = [];
  var haystackEdges = [];
  var autorotateEdges = [];

  // create a table of edge (src, tgt) => list of edges between them
  var pairId;
  for (var i = 0; i < edges.length; i++){
    var edge = edges[i];
    var _p = edge._private;
    var data = _p.data;
    var style = _p.style;
    var curveStyle = style['curve-style'].value;
    var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';

    // ignore edges who are not to be displayed
    // they shouldn't take up space
    if( style.display.value === 'none' ){
      continue;
    }

    if( style['edge-text-rotation'].strValue === 'autorotate' ){
      autorotateEdges.push( edge );
    }

    if( curveStyle === 'haystack' ){
      haystackEdges.push( edge );
      continue;
    }

    var srcId = data.source;
    var tgtId = data.target;

    pairId = srcId > tgtId ?
      tgtId + '$-$' + srcId :
      srcId + '$-$' + tgtId ;

    if( edgeIsUnbundled ){
      pairId = 'unbundled' + '$-$' + data.id;
    }

    if( hashTable[pairId] == null ){
      hashTable[pairId] = [];
      pairIds.push( pairId );
    }

    hashTable[pairId].push( edge );

    if( edgeIsUnbundled ){
      hashTable[pairId].hasUnbundled = true;
    }
  }

  var src, tgt, src_p, tgt_p, srcPos, tgtPos, srcW, srcH, tgtW, tgtH, srcShape, tgtShape;
  var vectorNormInverse;
  var badBezier;

  // for each pair (src, tgt), create the ctrl pts
  // Nested for loop is OK; total number of iterations for both loops = edgeCount
  for (var p = 0; p < pairIds.length; p++) {
    pairId = pairIds[p];
    var pairEdges = hashTable[pairId];

    // for each pair id, the edges should be sorted by index
    pairEdges.sort(function(edge1, edge2){
      return edge1._private.index - edge2._private.index;
    });

    src = pairEdges[0]._private.source;
    tgt = pairEdges[0]._private.target;

    src_p = src._private;
    tgt_p = tgt._private;

    // make sure src/tgt distinction is consistent
    // (src/tgt in this case are just for ctrlpts and don't actually have to be true src/tgt)
    if( src_p.data.id > tgt_p.data.id ){
      var temp = src;
      src = tgt;
      tgt = temp;
    }

    srcPos = src_p.position;
    tgtPos = tgt_p.position;

    srcW = src.outerWidth();
    srcH = src.outerHeight();

    tgtW = tgt.outerWidth();
    tgtH = tgt.outerHeight();

    srcShape = r.nodeShapes[ this.getNodeShape(src) ];
    tgtShape = r.nodeShapes[ this.getNodeShape(tgt) ];

    badBezier = false;


    if( (pairEdges.length > 1 && src !== tgt) || pairEdges.hasUnbundled ){

      // pt outside src shape to calc distance/displacement from src to tgt
      var srcOutside = srcShape.intersectLine(
        srcPos.x,
        srcPos.y,
        srcW,
        srcH,
        tgtPos.x,
        tgtPos.y,
        0
      );

      // pt outside tgt shape to calc distance/displacement from src to tgt
      var tgtOutside = tgtShape.intersectLine(
        tgtPos.x,
        tgtPos.y,
        tgtW,
        tgtH,
        srcPos.x,
        srcPos.y,
        0
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
        tgtShape.checkPoint( srcOutside[0], srcOutside[1], 0, tgtW, tgtH, tgtPos.x, tgtPos.y )  ||
        srcShape.checkPoint( tgtOutside[0], tgtOutside[1], 0, srcW, srcH, srcPos.x, srcPos.y )
      ){
        vectorNormInverse = {};
        badBezier = true;
      }

    }

    var edge;
    var edge_p;
    var rs;

    for (var i = 0; i < pairEdges.length; i++) {
      edge = pairEdges[i];
      edge_p = edge._private;
      rs = edge_p.rscratch;

      var edgeIndex1 = rs.lastEdgeIndex;
      var edgeIndex2 = i;

      var numEdges1 = rs.lastNumEdges;
      var numEdges2 = pairEdges.length;

      var eStyle = style = edge_p.style;
      var curveStyle = eStyle['curve-style'].value;
      var ctrlptDists = eStyle['control-point-distances'];
      var ctrlptWs = eStyle['control-point-weights'];
      var bezierN = ctrlptDists && ctrlptWs ? Math.min( ctrlptDists.value.length, ctrlptWs.value.length ) : 1;
      var stepSize = eStyle['control-point-step-size'].pfValue;
      var ctrlptDist = ctrlptDists !== undefined ? ctrlptDists.pfValue[0] : undefined;
      var ctrlptWeight = ctrlptWs.value[0];
      var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';

      var swappedDirection = edge_p.source !== src;

      if( swappedDirection && edgeIsUnbundled ){
        ctrlptDist *= -1;
      }

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

      var width1 = rs.lastW;
      var width2 = eStyle['control-point-step-size'].pfValue;

      if( badBezier ){
        rs.badBezier = true;
      } else {
        rs.badBezier = false;
      }

      if( srcX1 === srcX2 && srcY1 === srcY2 && srcW1 === srcW2 && srcH1 === srcH2
      &&  tgtX1 === tgtX2 && tgtY1 === tgtY2 && tgtW1 === tgtW2 && tgtH1 === tgtH2
      &&  width1 === width2
      &&  ((edgeIndex1 === edgeIndex2 && numEdges1 === numEdges2) || edgeIsUnbundled) ){
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
        rs.lastWidth = width2;
        // console.log('edge ctrl pt cache MISS')
      }

      if( src === tgt ){
        // Self-edge

        rs.edgeType = 'self';

        var j = i;
        var loopDist = stepSize;

        if( edgeIsUnbundled ){
          j = 0;
          loopDist = ctrlptDist;
        }

        rs.ctrlpts = [
          srcPos.x,
          srcPos.y - (1 + Math.pow(srcH, 1.12) / 100) * loopDist * (j / 3 + 1),

          srcPos.x - (1 + Math.pow(srcW, 1.12) / 100) * loopDist * (j / 3 + 1),
          srcPos.y
        ];

      } else if(
        hasCompounds &&
        ( src.isParent() || src.isChild() || tgt.isParent() || tgt.isChild() ) &&
        ( src.parents().anySame(tgt) || tgt.parents().anySame(src) )
      ){
        // Compound edge

        rs.edgeType = 'compound';

        // because the line approximation doesn't apply for compound beziers
        // (loop/self edges are already elided b/c of cheap src==tgt check)
        rs.badBezier = false;

        var j = i;
        var loopDist = stepSize;

        if( edgeIsUnbundled ){
          j = 0;
          loopDist = ctrlptDist;
        }

        var loopW = 50;

        var loopaPos = {
          x: srcPos.x - srcW/2,
          y: srcPos.y - srcH/2
        };

        var loopbPos = {
          x: tgtPos.x - tgtW/2,
          y: tgtPos.y - tgtH/2
        };

        // avoids cases with impossible beziers
        var minCompoundStretch = 1;
        var compoundStretchA = Math.max( minCompoundStretch, Math.log(srcW * 0.01) );
        var compoundStretchB = Math.max( minCompoundStretch, Math.log(tgtW * 0.01) );

        rs.ctrlpts = [
          loopaPos.x,
          loopaPos.y - (1 + Math.pow(loopW, 1.12) / 100) * loopDist * (j / 3 + 1) * compoundStretchA,

          loopbPos.x - (1 + Math.pow(loopW, 1.12) / 100) * loopDist * (j / 3 + 1) * compoundStretchB,
          loopbPos.y
        ];

      } else if( curveStyle === 'segments' ){
        // Segments (multiple straight lines)

        rs.edgeType = 'segments';
        rs.segpts = [];

        var segmentWs = eStyle['segment-weights'].pfValue;
        var segmentDs = eStyle['segment-distances'].pfValue;
        var segmentsN = Math.min( segmentWs.length, segmentDs.length );

        for( var s = 0; s < segmentsN; s++ ){
          var w = segmentWs[s];
          var d = segmentDs[s];

          // d = swappedDirection ? -d : d;
          //
          // d = Math.abs(d);

          // var w1 = !swappedDirection ? (1 - w) : w;
          // var w2 = !swappedDirection ? w : (1 - w);

          var w1 = (1 - w);
          var w2 = w;

          var adjustedMidpt = {
            x: midptSrcPts.x1 * w1 + midptSrcPts.x2 * w2,
            y: midptSrcPts.y1 * w1 + midptSrcPts.y2 * w2
          };

          rs.segpts.push(
            adjustedMidpt.x + vectorNormInverse.x * d,
            adjustedMidpt.y + vectorNormInverse.y * d
          );
        }

      // Straight edge
      } else if (
        pairEdges.length % 2 === 1
        && i === Math.floor(pairEdges.length / 2)
        && !edgeIsUnbundled
      ){

        rs.edgeType = 'straight';

      } else {
        // (Multi)bezier

        var multi = edgeIsUnbundled;

        rs.edgeType = multi ? 'multibezier' : 'bezier';
        rs.ctrlpts = [];

        for( var b = 0; b < bezierN; b++ ){
          var normctrlptDist = (0.5 - pairEdges.length / 2 + i) * stepSize;
          var manctrlptDist;
          var sign = math.signum( normctrlptDist );

          if( multi ){
            ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[b] : stepSize; // fall back on step size
            ctrlptWeight = ctrlptWs.value[b];
          }

          if( edgeIsUnbundled ){ // multi or single unbundled
            manctrlptDist = ctrlptDist;
          } else {
            manctrlptDist = ctrlptDist !== undefined ? sign * ctrlptDist : undefined;
          }

          var distanceFromMidpoint = manctrlptDist !== undefined ? manctrlptDist : normctrlptDist;

          var w1 = !swappedDirection || edgeIsUnbundled ? (1 - ctrlptWeight) : ctrlptWeight;
          var w2 = !swappedDirection || edgeIsUnbundled ? ctrlptWeight : (1 - ctrlptWeight);

          var adjustedMidpt = {
            x: midptSrcPts.x1 * w1 + midptSrcPts.x2 * w2,
            y: midptSrcPts.y1 * w1 + midptSrcPts.y2 * w2
          };

          rs.ctrlpts.push(
            adjustedMidpt.x + vectorNormInverse.x * distanceFromMidpoint,
            adjustedMidpt.y + vectorNormInverse.y * distanceFromMidpoint
          );
        }

      }

      // find endpts for edge
      this.findEndpoints( edge );

      var badStart = !is.number( rs.startX ) || !is.number( rs.startY );
      var badAStart = !is.number( rs.arrowStartX ) || !is.number( rs.arrowStartY );
      var badEnd = !is.number( rs.endX ) || !is.number( rs.endY );
      var badAEnd = !is.number( rs.arrowEndX ) || !is.number( rs.arrowEndY );

      var minCpADistFactor = 3;
      var arrowW = this.getArrowWidth( eStyle['width'].pfValue ) * this.arrowShapeHeight;
      var minCpADist = minCpADistFactor * arrowW;

      if( rs.edgeType === 'bezier' ){
        var startACpDist = math.distance( { x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.startX, y: rs.startY } );
        var closeStartACp = startACpDist < minCpADist;
        var endACpDist = math.distance( { x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.endX, y: rs.endY } );
        var closeEndACp = endACpDist < minCpADist;

        var overlapping = false;

        if( badStart || badAStart || closeStartACp ){
          overlapping = true;

          // project control point along line from src centre to outside the src shape
          // (otherwise intersection will yield nothing)
          var cpD = { // delta
            x: rs.ctrlpts[0] - srcPos.x,
            y: rs.ctrlpts[1] - srcPos.y
          };
          var cpL = Math.sqrt( cpD.x*cpD.x + cpD.y*cpD.y ); // length of line
          var cpM = { // normalised delta
            x: cpD.x / cpL,
            y: cpD.y / cpL
          };
          var radius = Math.max(srcW, srcH);
          var cpProj = { // *2 radius guarantees outside shape
            x: rs.ctrlpts[0] + cpM.x * 2 * radius,
            y: rs.ctrlpts[1] + cpM.y * 2 * radius
          };

          var srcCtrlPtIntn = srcShape.intersectLine(
            srcPos.x,
            srcPos.y,
            srcW,
            srcH,
            cpProj.x,
            cpProj.y,
            0
          );

          if( closeStartACp ){
            rs.ctrlpts[0] = rs.ctrlpts[0] + cpM.x * (minCpADist - startACpDist);
            rs.ctrlpts[1] = rs.ctrlpts[1] + cpM.y * (minCpADist - startACpDist);
          } else {
            rs.ctrlpts[0] = srcCtrlPtIntn[0] + cpM.x * minCpADist;
            rs.ctrlpts[1] = srcCtrlPtIntn[1] + cpM.y * minCpADist;
          }
        }

        if( badEnd || badAEnd || closeEndACp ){
          overlapping = true;

          // project control point along line from tgt centre to outside the tgt shape
          // (otherwise intersection will yield nothing)
          var cpD = { // delta
            x: rs.ctrlpts[0] - tgtPos.x,
            y: rs.ctrlpts[1] - tgtPos.y
          };
          var cpL = Math.sqrt( cpD.x*cpD.x + cpD.y*cpD.y ); // length of line
          var cpM = { // normalised delta
            x: cpD.x / cpL,
            y: cpD.y / cpL
          };
          var radius = Math.max(srcW, srcH);
          var cpProj = { // *2 radius guarantees outside shape
            x: rs.ctrlpts[0] + cpM.x * 2 * radius,
            y: rs.ctrlpts[1] + cpM.y * 2 * radius
          };

          var tgtCtrlPtIntn = tgtShape.intersectLine(
            tgtPos.x,
            tgtPos.y,
            tgtW,
            tgtH,
            cpProj.x,
            cpProj.y,
            0
          );

          if( closeEndACp ){
            rs.ctrlpts[0] = rs.ctrlpts[0] + cpM.x * (minCpADist - endACpDist);
            rs.ctrlpts[1] = rs.ctrlpts[1] + cpM.y * (minCpADist - endACpDist);
          } else {
            rs.ctrlpts[0] = tgtCtrlPtIntn[0] + cpM.x * minCpADist;
            rs.ctrlpts[1] = tgtCtrlPtIntn[1] + cpM.y * minCpADist;
          }

        }

        if( overlapping ){
          // recalc endpts
          this.findEndpoints( edge );
        }

      }

      if( rs.edgeType === 'multibezier' || rs.edgeType === 'bezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){
        rs.allpts = [];

        rs.allpts.push( rs.startX, rs.startY );

        for( var b = 0; b+1 < rs.ctrlpts.length; b += 2 ){
          // ctrl pt itself
          rs.allpts.push( rs.ctrlpts[b], rs.ctrlpts[b+1] );

          // the midpt between ctrlpts as intermediate destination pts
          if( b + 3 < rs.ctrlpts.length ){
            rs.allpts.push( (rs.ctrlpts[b] + rs.ctrlpts[b+2])/2, (rs.ctrlpts[b+1] + rs.ctrlpts[b+3])/2 );
          }
        }

        rs.allpts.push( rs.endX, rs.endY );

      } else if( rs.edgeType === 'straight' ){
        // need to calc these after endpts
        rs.allpts = [ rs.startX, rs.startY, rs.endX, rs.endY ];

        // default midpt for labels etc
        rs.midX = ( srcX2 + tgtX2 )/2;
        rs.midY = ( srcY2 + tgtY2 )/2;

      } else if( rs.edgeType === 'segments' ){
        rs.allpts = [];
        rs.allpts.push( rs.startX, rs.startY );
        rs.allpts.push.apply( rs.allpts, rs.segpts );
        rs.allpts.push( rs.endX, rs.endY );

        if( rs.segpts.length % 4 === 0 ){
          var i2 = rs.segpts.length / 2;
          var i1 = i2 - 2;

          rs.midX = ( rs.segpts[i1] + rs.segpts[i2] ) / 2;
          rs.midY = ( rs.segpts[i1+1] + rs.segpts[i2+1] ) / 2;
        } else {
          var i1 = rs.segpts.length / 2 - 1;

          rs.midX = rs.segpts[i1];
          rs.midY = rs.segpts[i1+1];
        }
      }

      // project the edge into rstyle
      this.projectBezier( edge );
      this.recalculateEdgeLabelProjection( edge );

    }
  }

  for( var i = 0; i < haystackEdges.length; i++ ){
    var edge = haystackEdges[i];
    var _p = edge._private;
    var rscratch = _p.rscratch;
    var rs = rscratch;

    if( !rscratch.haystack ){
      var angle = Math.random() * 2 * Math.PI;

      rscratch.source = {
        x: Math.cos(angle),
        y: Math.sin(angle)
      };

      var angle = Math.random() * 2 * Math.PI;

      rscratch.target = {
        x: Math.cos(angle),
        y: Math.sin(angle)
      };

    }

    var src = _p.source;
    var tgt = _p.target;
    var srcPos = src._private.position;
    var tgtPos = tgt._private.position;
    var srcW = src.width();
    var tgtW = tgt.width();
    var srcH = src.height();
    var tgtH = tgt.height();
    var radius = style['haystack-radius'].value;
    var halfRadius = radius/2; // b/c have to half width/height

    rs.haystackPts = [
      rs.source.x * srcW * halfRadius + srcPos.x,
      rs.source.y * srcH * halfRadius + srcPos.y,
      rs.target.x * tgtW * halfRadius + tgtPos.x,
      rs.target.y * tgtH * halfRadius + tgtPos.y
    ];

    // always override as haystack in case set to different type previously
    rscratch.edgeType = 'haystack';
    rscratch.haystack = true;

    this.recalculateEdgeLabelProjection( edge );
  }

  for( var i = 0 ; i < autorotateEdges.length; i++ ){
    var edge = autorotateEdges[i];
    var rs = edge._private.rscratch;

    switch( rs.edgeType ){
      case 'haystack':
        dx = rs.haystackPts[2] - rs.haystackPts[0];
        dy = rs.haystackPts[3] - rs.haystackPts[1];
        break;
      default:
        dx = rs.endX - rs.startX;
        dy = rs.endY - rs.startY;
    }

    rs.labelAngle = Math.atan( dy / dx );
  }

  return hashTable;
};

BRp.findEndpoints = function( edge ){
  var r = this;
  var intersect;

  var source = edge.source()[0];
  var target = edge.target()[0];

  var src_p = source._private;
  var tgt_p = target._private;

  var srcPos = src_p.position;
  var tgtPos = tgt_p.position;

  var tgtArShape = edge._private.style['target-arrow-shape'].value;
  var srcArShape = edge._private.style['source-arrow-shape'].value;

  var rs = edge._private.rscratch;

  if( rs.edgeType === 'self' || rs.edgeType === 'compound' ){

    var cp = [rs.cp2cx, rs.cp2cy];

    intersect = r.nodeShapes[this.getNodeShape(target)].intersectLine(
      tgtPos.x,
      tgtPos.y,
      target.outerWidth(),
      target.outerHeight(),
      cp[0],
      cp[1],
      0
    );

    var arrowEnd = math.shortenIntersection(intersect, cp,
      r.arrowShapes[tgtArShape].spacing(edge));
    var edgeEnd = math.shortenIntersection(intersect, cp,
      r.arrowShapes[tgtArShape].gap(edge));

    rs.endX = edgeEnd[0];
    rs.endY = edgeEnd[1];

    rs.arrowEndX = arrowEnd[0];
    rs.arrowEndY = arrowEnd[1];

    var cp = [rs.cp2ax, rs.cp2ay];

    intersect = r.nodeShapes[this.getNodeShape(source)].intersectLine(
      srcPos.x,
      srcPos.y,
      source.outerWidth(),
      source.outerHeight(),
      cp[0],
      cp[1],
      0
    );

    var arrowStart = math.shortenIntersection(intersect, cp,
      r.arrowShapes[srcArShape].spacing(edge));
    var edgeStart = math.shortenIntersection(intersect, cp,
      r.arrowShapes[srcArShape].gap(edge));

    rs.startX = edgeStart[0];
    rs.startY = edgeStart[1];


    rs.arrowStartX = arrowStart[0];
    rs.arrowStartY = arrowStart[1];

  } else if( rs.edgeType === 'straight' || rs.edgeType === 'segments' ){

    var intersect1, intersect2;

    var endArrowFromPt = rs.edgeType === 'straight' ? [ srcPos.x, srcPos.y ] : rs.segpts.slice( rs.segpts.length - 2 );

    intersect = intersect1 = r.nodeShapes[this.getNodeShape(target)].intersectLine(
      tgtPos.x,
      tgtPos.y,
      target.outerWidth(),
      target.outerHeight(),
      endArrowFromPt[0],
      endArrowFromPt[1],
      0);

    var arrowEnd = math.shortenIntersection(intersect,
      endArrowFromPt,
      r.arrowShapes[tgtArShape].spacing(edge));
    var edgeEnd = math.shortenIntersection(intersect,
      endArrowFromPt,
      r.arrowShapes[tgtArShape].gap(edge));

    rs.endX = edgeEnd[0];
    rs.endY = edgeEnd[1];

    rs.arrowEndX = arrowEnd[0];
    rs.arrowEndY = arrowEnd[1];

    var startArrowFromPt = rs.edgeType === 'straight' ? [ tgtPos.x, tgtPos.y ] : rs.segpts.slice( 0, 2 );

    intersect = intersect2 = r.nodeShapes[this.getNodeShape(source)].intersectLine(
      srcPos.x,
      srcPos.y,
      source.outerWidth(),
      source.outerHeight(),
      startArrowFromPt[0],
      startArrowFromPt[1],
      0);

    if( intersect1.length === 0 || intersect2.length === 0 ){
      rs.noArrowPlacement = true;
    } else {
      rs.noArrowPlacement = false;
    }

    var arrowStart = math.shortenIntersection(intersect,
      startArrowFromPt,
      r.arrowShapes[srcArShape].spacing(edge));
    var edgeStart = math.shortenIntersection(intersect,
      startArrowFromPt,
      r.arrowShapes[srcArShape].gap(edge));

    rs.startX = edgeStart[0];
    rs.startY = edgeStart[1];

    rs.arrowStartX = arrowStart[0];
    rs.arrowStartY = arrowStart[1];

    if( !is.number(rs.startX) || !is.number(rs.startY) || !is.number(rs.endX) || !is.number(rs.endY) ){
      rs.badLine = true;
    } else {
      rs.badLine = false;
    }

  } else if ( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' ){
    var multi = rs.edgeType === 'multibezier';
    var cpStart = [ rs.ctrlpts[0], rs.ctrlpts[1] ];
    var cpEnd = multi ? [ rs.ctrlpts[rs.ctrlpts.length - 2], rs.ctrlpts[rs.ctrlpts.length - 1] ] : cpStart;

    intersect = r.nodeShapes[this.getNodeShape(target)].intersectLine(
      tgtPos.x,
      tgtPos.y,
      target.outerWidth(),
      target.outerHeight(),
      cpEnd[0],
      cpEnd[1],
      0
    );

    var arrowEnd = math.shortenIntersection(intersect, cpEnd,
      r.arrowShapes[tgtArShape].spacing(edge));
    var edgeEnd = math.shortenIntersection(intersect, cpEnd,
      r.arrowShapes[tgtArShape].gap(edge));

    rs.endX = edgeEnd[0];
    rs.endY = edgeEnd[1];

    rs.arrowEndX = arrowEnd[0];
    rs.arrowEndY = arrowEnd[1];

    intersect = r.nodeShapes[this.getNodeShape(source)].intersectLine(
      srcPos.x,
      srcPos.y,
      source.outerWidth(),
      source.outerHeight(),
      cpStart[0],
      cpStart[1],
      0
    );

    var arrowStart = math.shortenIntersection(
      intersect, cpStart,
      r.arrowShapes[srcArShape].spacing(edge)
    );
    var edgeStart = math.shortenIntersection(
      intersect, cpStart,
      r.arrowShapes[srcArShape].gap(edge)
    );

    rs.startX = edgeStart[0];
    rs.startY = edgeStart[1];

    rs.arrowStartX = arrowStart[0];
    rs.arrowStartY = arrowStart[1];

  }
};

BRp.getArrowWidth = BRp.getArrowHeight = function(edgeWidth) {
  var cache = this.arrowWidthCache = this.arrowWidthCache || {};

  var cachedVal = cache[edgeWidth];
  if( cachedVal ){
    return cachedVal;
  }

  cachedVal =  Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
  cache[edgeWidth] = cachedVal;

  return cachedVal;
};

module.exports = BRp;

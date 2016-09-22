'use strict';

var math = require( '../../../math' );
var is = require( '../../../is' );
var util = require( '../../../util' );
var zIndexSort = require( '../../../collection/zsort' );

var BRp = {};

BRp.registerCalculationListeners = function(){
  var cy = this.cy;
  var elesToUpdate = cy.collection();
  var r = this;

  var enqueue = function( eles, e ){
    elesToUpdate.merge( eles );

    for( var i = 0; i < eles.length; i++ ){
      var ele = eles[i];
      var _p = ele._private;
      var rstyle = _p.rstyle;

      rstyle.clean = false;
      _p.bbCache = null;

      var evts = rstyle.dirtyEvents = rstyle.dirtyEvents || { length: 0 };

      if( !evts[ e.type ] ){
        evts[ e.type ] = true;
        evts.length++;
//
        // elesToUpdate.merge( ele );
      }
    }
  };

  r.binder( cy )
    // nodes

    .on('position.* style.* free.*', 'node', function onDirtyModNode( e ){
      var node = e.cyTarget;

      enqueue( node, e );
      enqueue( node.connectedEdges(), e );

      if( cy.hasCompoundNodes() ){
        var parents = node.parents();

        enqueue( parents, e );
        enqueue( parents.connectedEdges(), e );
      }
    })

    .on('add.* background.*', 'node', function onDirtyAddNode( e ){
      var ele = e.cyTarget;

      enqueue( ele, e );
    })

    // edges

    .on('add.* style.*', 'edge', function onDirtyEdge( e ){
      var edge = e.cyTarget;

      enqueue( edge, e );
      enqueue( edge.parallelEdges(), e );
    })

    .on('remove.*', 'edge', function onDirtyRemoveEdge( e ){
      var edge = e.cyTarget;
      var pEdges = edge.parallelEdges();

      for( var i = 0; i < pEdges.length; i++ ){
        var pEdge = pEdges[i];

        if( !pEdge.removed() ){
          enqueue( pEdge, e );
        }
      }
    })
  ;

  var updateEleCalcs = function( willDraw ){
    if( willDraw ){
      var fns = r.onUpdateEleCalcsFns;

      if( fns ){ for( var i = 0; i < fns.length; i++ ){
        var fn = fns[i];

        fn( willDraw, elesToUpdate );
      } }

      r.recalculateRenderedStyle( elesToUpdate, false );

      for( var i = 0; i < elesToUpdate.length; i++ ){
        elesToUpdate[i]._private.rstyle.dirtyEvents = null;
      }

      elesToUpdate = cy.collection();
    }
  };

  r.beforeRender( updateEleCalcs, r.beforeRenderPriorities.eleCalcs );
};

BRp.onUpdateEleCalcs = function( fn ){
  var fns = this.onUpdateEleCalcsFns = this.onUpdateEleCalcsFns || [];

  fns.push( fn );
};

BRp.recalculateRenderedStyle = function( eles, useCache ){
  var edges = [];
  var nodes = [];

  // the renderer can't be used for calcs when destroyed, e.g. ele.boundingBox()
  if( this.destroyed ){ return; }

  // use cache by default for perf
  if( useCache === undefined ){ useCache = true; }

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[ i ];
    var _p = ele._private;
    var rstyle = _p.rstyle;

    // only update if dirty and in graph
    if( (useCache && rstyle.clean) || ele.removed() ){ continue; }

    if( _p.group === 'nodes' ){
      nodes.push( ele );
    } else { // edges
      edges.push( ele );
    }

    rstyle.clean = true;
    // rstyle.dirtyEvents = null;
  }

  // update node data from projections
  for( var i = 0; i < nodes.length; i++ ){
    var ele = nodes[i];
    var _p = ele._private;
    var rstyle = _p.rstyle;
    var pos = _p.position;

    this.recalculateNodeLabelProjection( ele );

    rstyle.nodeX = pos.x;
    rstyle.nodeY = pos.y;
    rstyle.nodeW = ele.pstyle( 'width' ).pfValue;
    rstyle.nodeH = ele.pstyle( 'height' ).pfValue;
  }

  this.recalculateEdgeProjections( edges );

  // update edge data from projections
  for( var i = 0; i < edges.length; i++ ){
    var ele = edges[ i ];
    var _p = ele._private;
    var rstyle = _p.rstyle;
    var rs = _p.rscratch;

    this.recalculateEdgeLabelProjections( ele );

    // update rstyle positions
    rstyle.srcX = rs.arrowStartX;
    rstyle.srcY = rs.arrowStartY;
    rstyle.tgtX = rs.arrowEndX;
    rstyle.tgtY = rs.arrowEndY;
    rstyle.midX = rs.midX;
    rstyle.midY = rs.midY;
    rstyle.labelAngle = rs.labelAngle;
    rstyle.sourceLabelAngle = rs.sourceLabelAngle;
    rstyle.targetLabelAngle = rs.targetLabelAngle;
  }
};

// Project mouse
BRp.projectIntoViewport = function( clientX, clientY ){
  var offsets = this.findContainerClientCoords();
  var offsetLeft = offsets[0];
  var offsetTop = offsets[1];

  var x = clientX - offsetLeft;
  var y = clientY - offsetTop;

  x -= this.cy.pan().x; y -= this.cy.pan().y; x /= this.cy.zoom(); y /= this.cy.zoom();
  return [ x, y ];
};

BRp.findContainerClientCoords = function(){
  var container = this.container;

  var bb = this.containerBB = this.containerBB || container.getBoundingClientRect();

  return [ bb.left, bb.top, bb.right - bb.left, bb.bottom - bb.top ];
};

BRp.invalidateContainerClientCoordsCache = function(){
  this.containerBB = null;
};

BRp.findNearestElement = function( x, y, visibleElementsOnly, isTouch ){
  return this.findNearestElements( x, y, visibleElementsOnly, isTouch )[0];
};

BRp.findNearestElements = function( x, y, visibleElementsOnly, isTouch ){
  var self = this;
  var r = this;
  var eles = r.getCachedZSortedEles();
  var near = []; // 1 node max, 1 edge max
  var zoom = r.cy.zoom();
  var hasCompounds = r.cy.hasCompoundNodes();
  var edgeThreshold = (isTouch ? 24 : 8) / zoom;
  var nodeThreshold = (isTouch ? 8 : 2) / zoom;
  var labelThreshold = (isTouch ? 8 : 2) / zoom;
  var minSqDist = Infinity;
  var nearEdge;
  var nearNode;

  function addEle( ele, sqDist ){
    if( ele.isNode() ){
      if( nearNode ){
        return; // can't replace node
      } else {
        nearNode = ele;
        near.push( ele );
      }
    }

    if( ele.isEdge() && ( sqDist == null || sqDist < minSqDist ) ){
      if( nearEdge ){ // then replace existing edge
        // can replace only if same z-index
        if( nearEdge.pstyle( 'z-index' ).value === ele.pstyle('z-index').value ){
          for( var i = 0; i < near.length; i++ ){
            if( near[i].isEdge() ){
              near[i] = ele;
              nearEdge = ele;
              minSqDist = sqDist != null ? sqDist : minSqDist;
              break;
            }
          }
        }
      } else {
        near.push( ele );
        nearEdge = ele;
        minSqDist = sqDist != null ? sqDist : minSqDist;
      }
    }
  }

  function checkNode( node ){
    var _p = node._private;

    if( node.pstyle( 'events' ).strValue === 'no' ){ return; }

    var width = node.outerWidth() + 2 * nodeThreshold;
    var height = node.outerHeight() + 2 * nodeThreshold;
    var hw = width / 2;
    var hh = height / 2;
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

      var shape = r.nodeShapes[ self.getNodeShape( node ) ];

      if(
        shape.checkPoint( x, y, 0, width, height, pos.x, pos.y )
      ){
        addEle( node, 0 );
      }

    }
  }

  function checkEdge( edge ){
    var _p = edge._private;

    if( edge.pstyle('events').strValue === 'no' ){ return; }

    var rs = _p.rscratch;
    var width = edge.pstyle( 'width' ).pfValue / 2 + edgeThreshold; // more like a distance radius from centre
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

    if( rs.edgeType === 'segments' || rs.edgeType === 'straight' || rs.edgeType === 'haystack' ){
      var pts = rs.allpts;

      for( var i = 0; i + 3 < pts.length; i += 2 ){
        if(
          (inEdgeBB = math.inLineVicinity( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], width2 ))
            && passesVisibilityCheck() &&
          widthSq > ( sqDist = math.sqdistToFiniteLine( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3] ) )
        ){
          addEle( edge, sqDist );
        }
      }

    } else if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){
      var pts = rs.allpts;
      for( var i = 0; i + 5 < rs.allpts.length; i += 4 ){
        if(
          (inEdgeBB = math.inBezierVicinity( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], pts[ i + 4], pts[ i + 5], width2 ))
            && passesVisibilityCheck() &&
          (widthSq > (sqDist = math.sqdistToQuadraticBezier( x, y, pts[ i ], pts[ i + 1], pts[ i + 2], pts[ i + 3], pts[ i + 4], pts[ i + 5] )) )
        ){
          addEle( edge, sqDist );
        }
      }
    }

    // if we're close to the edge but didn't hit it, maybe we hit its arrows
    if( inEdgeBB && passesVisibilityCheck() ){
      var src = src || _p.source;
      var tgt = tgt || _p.target;

      var eWidth = edge.pstyle( 'width' ).pfValue;
      var arSize = self.getArrowWidth( eWidth );

      var arrows = [
        { name: 'source', x: rs.arrowStartX, y: rs.arrowStartY, angle: rs.srcArrowAngle },
        { name: 'target', x: rs.arrowEndX, y: rs.arrowEndY, angle: rs.tgtArrowAngle },
        { name: 'mid-source', x: rs.midX, y: rs.midY, angle: rs.midsrcArrowAngle },
        { name: 'mid-target', x: rs.midX, y: rs.midY, angle: rs.midtgtArrowAngle }
      ];

      for( var i = 0; i < arrows.length; i++ ){
        var ar = arrows[ i ];
        var shape = r.arrowShapes[ edge.pstyle( ar.name + '-arrow-shape' ).value ];

        if(
          shape.roughCollide( x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeThreshold )
           &&
          shape.collide( x, y, arSize, ar.angle, { x: ar.x, y: ar.y }, edgeThreshold )
        ){
          addEle( edge );
          break;
        }
      }
    }

    // for compound graphs, hitting edge may actually want a connected node instead (b/c edge may have greater z-index precedence)
    if( hasCompounds && near.length > 0 ){
      checkNode( src );
      checkNode( tgt );
    }
  }

  function preprop( obj, name, pre ){
    return util.getPrefixedProperty( obj, name, pre );
  }

  function checkLabel( ele, prefix ){
    var _p = ele._private;
    var th = labelThreshold;

    var prefixDash;
    if( prefix ){
      prefixDash = prefix + '-';
    } else {
      prefixDash = '';
    }

    if( ele.pstyle( 'text-events' ).strValue === 'no' ){ return; }

    var rotation = ele.pstyle( prefixDash + 'text-rotation' );

    // adjust bb w/ angle
    if( rotation.strValue === 'autorotate' || !!rotation.pfValue ){

      var rstyle = _p.rstyle;
      var bw = ele.pstyle('text-border-width').pfValue;
      var lw = preprop( rstyle, 'labelWidth', prefix ) + bw/2 + 2*th;
      var lh = preprop( rstyle, 'labelHeight', prefix ) + bw/2 + 2*th;
      var lx = preprop( rstyle, 'labelX', prefix );
      var ly = preprop( rstyle, 'labelY', prefix );

      var theta = preprop( _p.rscratch, 'labelAngle', prefix );
      var cos = Math.cos( theta );
      var sin = Math.sin( theta );

      var rotate = function( x, y ){
        x = x - lx;
        y = y - ly;

        return {
          x: x * cos - y * sin + lx,
          y: x * sin + y * cos + ly
        };
      };

      var lx1 = lx - lw / 2;
      var lx2 = lx + lw / 2;
      var ly1 = ly - lh / 2;
      var ly2 = ly + lh / 2;

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
        addEle( ele );
      }

    } else {
      var bb = ele.boundingBox( {
        includeLabels: true,
        includeNodes: false,
        includeEdges: false
      } );

      // adjust bb w/ threshold
      bb.x1 -= th;
      bb.y1 -= th;
      bb.x2 += th;
      bb.y2 += th;
      bb.w = bb.x2 - bb.x1;
      bb.h = bb.y2 - bb.y1;

      if( math.inBoundingBox( bb, x, y ) ){
        addEle( ele );
      }
    }

  }

  for( var i = eles.length - 1; i >= 0; i-- ){ // reverse order for precedence
    var ele = eles[ i ];

    if( ele.isNode() ){
      checkNode( ele );

      checkLabel( ele );

    } else { // then edge
      checkEdge( ele );

      checkLabel( ele );
      checkLabel( ele, 'source' );
      checkLabel( ele, 'target' );
    }
  }

  return near;
};

// 'Give me everything from this box'
BRp.getAllInBox = function( x1, y1, x2, y2 ){
  var eles = this.getCachedZSortedEles();
  var nodes = eles.nodes;
  var edges = eles.edges;
  var box = [];

  var x1c = Math.min( x1, x2 );
  var x2c = Math.max( x1, x2 );
  var y1c = Math.min( y1, y2 );
  var y2c = Math.max( y1, y2 );

  x1 = x1c;
  x2 = x2c;
  y1 = y1c;
  y2 = y2c;

  var boxBb = math.makeBoundingBox( {
    x1: x1, y1: y1,
    x2: x2, y2: y2
  } );

  for( var i = 0; i < nodes.length; i++ ){
    var node = nodes[ i ];
    var nodeBb = node.boundingBox( {
      includeNodes: true,
      includeEdges: false,
      includeLabels: false,
      includeShadows: false
    } );

    if( math.boundingBoxesIntersect( boxBb, nodeBb ) ){
      box.push( nodes[ i ] );
    }
  }

  for( var e = 0; e < edges.length; e++ ){
    var edge = edges[ e ];
    var _p = edge._private;
    var rs = _p.rscratch;

    if( rs.startX != null && rs.startY != null && !math.inBoundingBox( boxBb, rs.startX, rs.startY ) ){ continue; }
    if( rs.endX != null && rs.endY != null && !math.inBoundingBox( boxBb, rs.endX, rs.endY ) ){ continue; }

    if( rs.edgeType === 'bezier' || rs.edgeType === 'multibezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' || rs.edgeType === 'segments' || rs.edgeType === 'haystack' ){

      var pts = _p.rstyle.bezierPts || _p.rstyle.linePts || _p.rstyle.haystackPts;
      var allInside = true;

      for( var i = 0; i < pts.length; i++ ){
        if( !math.pointInBoundingBox( boxBb, pts[ i ] ) ){
          allInside = false;
          break;
        }
      }

      if( allInside ){
        box.push( edge );
      }

    } else if( rs.edgeType === 'haystack' || rs.edgeType === 'straight' ){
      box.push( edge );
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
  var shape = node.pstyle( 'shape' ).value;

  if( node.isParent() ){
    if( shape === 'rectangle' || shape === 'roundrectangle' ){
      return shape;
    } else {
      return 'rectangle';
    }
  }

  if( shape === 'polygon' ){
    var points = node.pstyle( 'shape-polygon-points' ).value;

    return r.nodeShapes.makePolygon( points ).name;
  }

  return shape;
};

BRp.updateCachedZSortedEles = function(){
  this.getCachedZSortedEles( true );
};

BRp.updateCachedGrabbedEles = function(){
  var eles = this.cachedZSortedEles;

  eles.drag = [];
  eles.nondrag = [];

  var grabTarget;

  for( var i = 0; i < eles.length; i++ ){
    var ele = eles[i];
    var rs = ele._private.rscratch;

    if( rs.isGrabTarget && !ele.isParent() ){
      grabTarget = ele;
    } else if( rs.inDragLayer ){
      eles.drag.push( ele );
    } else {
      eles.nondrag.push( ele );
    }
  }

  // put the grab target node last so it's on top of its neighbourhood
  if( grabTarget ){
    eles.drag.push( grabTarget );
  }
};

BRp.getCachedZSortedEles = function( forceRecalc ){
  if( forceRecalc || !this.cachedZSortedEles ){
    //console.time('cachezorder')

    var cyEles = this.cy.mutableElements();
    var eles = [];

    eles.nodes = [];
    eles.edges = [];

    for( var i = 0; i < cyEles.length; i++ ){
      var ele = cyEles[i];

      if( ele.animated() || (ele.visible() && !ele.transparent()) ){
        eles.push( ele );

        if( ele.isNode() ){
          eles.nodes.push( ele );
        } else {
          eles.edges.push( ele );
        }
      }
    }

    eles.sort( zIndexSort );

    this.cachedZSortedEles = eles;

    this.updateCachedGrabbedEles();

    //console.log('make cache')

    //console.timeEnd('cachezorder')
  } else {
    eles = this.cachedZSortedEles;
    //console.log('read cache')
  }

  return eles;
};

function pushBezierPts( r, edge, pts ){
  var qbezierAt = function( p1, p2, p3, t ){ return math.qbezierAt( p1, p2, p3, t ); };
  var _p = edge._private;
  var bpts = _p.rstyle.bezierPts;

  for( var i = 0; i < r.bezierProjPcts.length; i++ ){
    var p = r.bezierProjPcts[i];

    bpts.push( {
      x: qbezierAt( pts[0], pts[2], pts[4], p ),
      y: qbezierAt( pts[1], pts[3], pts[5], p )
    } );
  }
}

BRp.projectLines = function( edge ){
  var _p = edge._private;
  var rs = _p.rscratch;
  var et = rs.edgeType;

  // clear the cached points state
  _p.rstyle.bezierPts = null;
  _p.rstyle.linePts = null;
  _p.rstyle.haystackPts = null;

  if( et === 'multibezier' ||  et === 'bezier' ||  et === 'self' ||  et === 'compound' ){
    var bpts = _p.rstyle.bezierPts = []; // jshint ignore:line

    for( var i = 0; i + 5 < rs.allpts.length; i += 4 ){
      pushBezierPts( this, edge, rs.allpts.slice( i, i + 6 ) );
    }
  } else if(  et === 'segments' ){
    var lpts = _p.rstyle.linePts = [];

    for( var i = 0; i + 1 < rs.allpts.length; i += 2 ){
      lpts.push( {
        x: rs.allpts[ i ],
        y: rs.allpts[ i + 1]
      } );
    }
  } else if( et === 'haystack' ){
    var hpts = rs.haystackPts;

    _p.rstyle.haystackPts = [
      { x: hpts[0], y: hpts[1] },
      { x: hpts[2], y: hpts[3] }
    ];
  }

  _p.rstyle.arrowWidth = this.getArrowWidth( edge.pstyle('width').pfValue ) * this.arrowShapeWidth;
};

BRp.projectBezier = BRp.projectLines;

BRp.recalculateNodeLabelProjection = function( node ){
  var content = node.pstyle( 'label' ).strValue;

  if( is.emptyString(content) ){ return; }

  var textX, textY;
  var _p = node._private;
  var nodeWidth = node.width();
  var nodeHeight = node.height();
  var paddingLeft = node.pstyle('padding-left').pfValue;
  var paddingRight = node.pstyle('padding-right').pfValue;
  var paddingTop = node.pstyle('padding-top').pfValue;
  var paddingBottom = node.pstyle('padding-bottom').pfValue;
  var nodePos = _p.position;
  var textHalign = node.pstyle( 'text-halign' ).strValue;
  var textValign = node.pstyle( 'text-valign' ).strValue;
  var rs = _p.rscratch;
  var rstyle = _p.rstyle;

  switch( textHalign ){
    case 'left':
      textX = nodePos.x - nodeWidth / 2 - paddingLeft;
      break;

    case 'right':
      textX = nodePos.x + nodeWidth / 2 + paddingRight;
      break;

    default: // e.g. center
      textX = nodePos.x;
  }

  switch( textValign ){
    case 'top':
      textY = nodePos.y - nodeHeight / 2 - paddingTop;
      break;

    case 'bottom':
      textY = nodePos.y + nodeHeight / 2 + paddingBottom;
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

BRp.recalculateEdgeLabelProjections = function( edge ){
  var p;
  var _p = edge._private;
  var rs = _p.rscratch;
  var r = this;
  var content = {
    mid: edge.pstyle('label').strValue,
    source: edge.pstyle('source-label').strValue,
    target: edge.pstyle('target-label').strValue
  };

  if( content.mid || content.source || content.target ){
    // then we have to calculate...
  } else {
    return; // no labels => no calcs
  }

  // add center point to style so bounding box calculations can use it
  //
  p = {
    x: rs.midX,
    y: rs.midY
  };

  var setRs = function( propName, prefix, value ){
    util.setPrefixedProperty( _p.rscratch, propName, prefix, value );
    util.setPrefixedProperty( _p.rstyle, propName, prefix, value );
  };

  setRs( 'labelX', null, p.x );
  setRs( 'labelY', null, p.y );

  var createControlPointInfo = function(){
    if( createControlPointInfo.cache ){ return createControlPointInfo.cache; } // use cache so only 1x per edge

    var ctrlpts = [];

    // store each ctrlpt info init
    for( var i = 0; i + 5 < rs.allpts.length; i += 4 ){
      var p0 = { x: rs.allpts[i], y: rs.allpts[i+1] };
      var p1 = { x: rs.allpts[i+2], y: rs.allpts[i+3] }; // ctrlpt
      var p2 = { x: rs.allpts[i+4], y: rs.allpts[i+5] };

      ctrlpts.push({
        p0: p0,
        p1: p1,
        p2: p2,
        startDist: 0,
        length: 0,
        segments: []
      });
    }

    var bpts = _p.rstyle.bezierPts;
    var nProjs = r.bezierProjPcts.length;

    function addSegment( cp, p0, p1, t0, t1 ){
      var length = math.dist( p0, p1 );
      var prevSegment = cp.segments[ cp.segments.length - 1 ];
      var segment = {
        p0: p0,
        p1: p1,
        t0: t0,
        t1: t1,
        startDist: prevSegment ? prevSegment.startDist + prevSegment.length : 0,
        length: length
      };

      cp.segments.push( segment );

      cp.length += length;
    }

    // update each ctrlpt with segment info
    for( var i = 0; i < ctrlpts.length; i++ ){
      var cp = ctrlpts[i];
      var prevCp = ctrlpts[i - 1];

      if( prevCp ){
        cp.startDist = prevCp.startDist + prevCp.length;
      }

      addSegment(
        cp,
        cp.p0,   bpts[ i * nProjs ],
        0,       r.bezierProjPcts[ 0 ]
      ); // first

      for( var j = 0; j < nProjs - 1; j++ ){
        addSegment(
          cp,
          bpts[ i * nProjs + j ],   bpts[ i * nProjs + j + 1 ],
          r.bezierProjPcts[ j ],    r.bezierProjPcts[ j + 1 ]
        );
      }

      addSegment(
        cp,
        bpts[ i * nProjs + nProjs - 1 ],   cp.p2,
        r.bezierProjPcts[ nProjs - 1 ],    1
      ); // last
    }

    return ( createControlPointInfo.cache = ctrlpts );
  };

  var calculateEndProjection = function( prefix ){
    var angle;
    var isSrc = prefix === 'source';

    if( !content[ prefix ] ){ return; }

    var offset = edge.pstyle(prefix+'-text-offset').pfValue;

    var lineAngle = function( p0, p1 ){
      var dx = p1.x - p0.x;
      var dy = p1.y - p0.y;

      return Math.atan( dy / dx );
    };

    var bezierAngle = function( p0, p1, p2, t ){
      var t0 = math.bound( 0, t - 0.001, 1 );
      var t1 = math.bound( 0, t + 0.001, 1 );

      var lp0 = math.qbezierPtAt( p0, p1, p2, t0 );
      var lp1 = math.qbezierPtAt( p0, p1, p2, t1 );

      return lineAngle( lp0, lp1 );
    };

    switch( rs.edgeType ){
      case 'self':
      case 'compound':
      case 'bezier':
      case 'multibezier':
        var cps = createControlPointInfo();
        var selected;
        var startDist = 0;
        var totalDist = 0;

        // find the segment we're on
        for( var i = 0; i < cps.length; i++ ){
          var cp = cps[ isSrc ? i : cps.length - 1 - i ];

          for( var j = 0; j < cp.segments.length; j++ ){
            var seg = cp.segments[ isSrc ? j : cp.segments.length - 1 - j ];
            var lastSeg = i === cps.length - 1 && j === cp.segments.length - 1;

            startDist = totalDist;
            totalDist += seg.length;

            if( totalDist >= offset || lastSeg ){
              selected = { cp: cp, segment: seg };
              break;
            }
          }

          if( selected ){ break; }
        }

        var cp = selected.cp;
        var seg = selected.segment;
        var tSegment = ( offset - startDist ) / ( seg.length );
        var segDt = seg.t1 - seg.t0;
        var t = isSrc ? seg.t0 + segDt * tSegment : seg.t1 - segDt * tSegment;

        t = math.bound( 0, t, 1 );
        p = math.qbezierPtAt( cp.p0, cp.p1, cp.p2, t );
        angle = bezierAngle( cp.p0, cp.p1, cp.p2, t, p );

        break;

      case 'straight':
      case 'segments':
      case 'haystack':
        var d = 0, di, d0;
        var p0, p1;
        var l = rs.allpts.length;

        for( var i = 0; i + 3 < l; i += 2 ){
          if( isSrc ){
            p0 = { x: rs.allpts[i],     y: rs.allpts[i+1] };
            p1 = { x: rs.allpts[i+2],   y: rs.allpts[i+3] };
          } else {
            p0 = { x: rs.allpts[l-2-i], y: rs.allpts[l-1-i] };
            p1 = { x: rs.allpts[l-4-i], y: rs.allpts[l-3-i] };
          }

          di = math.dist( p0, p1 );
          d0 = d;
          d += di;

          if( d >= offset ){ break; }
        }

        var pD = offset - d0;
        var t = pD / di;

        t  = math.bound( 0, t, 1 );
        p = math.lineAt( p0, p1, t );
        angle = lineAngle( p0, p1 );

        break;
    }

    setRs( 'labelX', prefix, p.x );
    setRs( 'labelY', prefix, p.y );
    setRs( 'labelAutoAngle', prefix, angle );
  };

  calculateEndProjection( 'source' );
  calculateEndProjection( 'target' );

  this.applyLabelDimensions( edge );
};

BRp.applyLabelDimensions = function( ele ){
  this.applyPrefixedLabelDimensions( ele );

  if( ele.isEdge() ){
    this.applyPrefixedLabelDimensions( ele, 'source' );
    this.applyPrefixedLabelDimensions( ele, 'target' );
  }
};

BRp.applyPrefixedLabelDimensions = function( ele, prefix ){
  var _p = ele._private;

  var text = this.getLabelText( ele, prefix );
  var labelDims = this.calculateLabelDimensions( ele, text );

  util.setPrefixedProperty( _p.rstyle,   'labelWidth', prefix, labelDims.width );
  util.setPrefixedProperty( _p.rscratch, 'labelWidth', prefix, labelDims.width );

  util.setPrefixedProperty( _p.rstyle,   'labelHeight', prefix, labelDims.height );
  util.setPrefixedProperty( _p.rscratch, 'labelHeight', prefix, labelDims.height );
};

BRp.getLabelText = function( ele, prefix ){
  var _p = ele._private;
  var pfd = prefix ? prefix + '-' : '';
  var text = ele.pstyle( pfd + 'label' ).strValue;
  var textTransform = ele.pstyle( 'text-transform' ).value;
  var rscratch = function( propName, value ){
    if( value ){
      util.setPrefixedProperty( _p.rscratch, propName, prefix, value );
      return value;
    } else {
      return util.getPrefixedProperty( _p.rscratch, propName, prefix );
    }
  };

  if( textTransform == 'none' ){
    // passthrough
  } else if( textTransform == 'uppercase' ){
    text = text.toUpperCase();
  } else if( textTransform == 'lowercase' ){
    text = text.toLowerCase();
  }

  if( ele.pstyle( 'text-wrap' ).value === 'wrap' ){
    //console.log('wrap');

    var labelKey = rscratch( 'labelKey' );

    // save recalc if the label is the same as before
    if( labelKey && rscratch( 'labelWrapKey' ) === labelKey ){
      // console.log('wrap cache hit');
      return rscratch( 'labelWrapCachedText' );
    }
    // console.log('wrap cache miss');

    var lines = text.split( '\n' );
    var maxW = ele.pstyle( 'text-max-width' ).pfValue;
    var wrappedLines = [];

    for( var l = 0; l < lines.length; l++ ){
      var line = lines[ l ];
      var lineDims = this.calculateLabelDimensions( ele, line, 'line=' + line );
      var lineW = lineDims.width;

      if( lineW > maxW ){ // line is too long
        var words = line.split( /\s+/ ); // NB: assume collapsed whitespace into single space
        var subline = '';

        for( var w = 0; w < words.length; w++ ){
          var word = words[ w ];
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
        if( !subline.match( /^\s+$/ ) ){
          wrappedLines.push( subline );
        }
      } else { // line is already short enough
        wrappedLines.push( line );
      }
    } // for

    rscratch( 'labelWrapCachedLines', wrappedLines );
    text = rscratch( 'labelWrapCachedText', wrappedLines.join( '\n' ) );
    rscratch( 'labelWrapKey', labelKey );

    // console.log(text)
  } // if wrap

  return text;
};

BRp.calculateLabelDimensions = function( ele, text, extraKey ){
  var r = this;

  var cacheKey = ele._private.labelStyleKey + '$@$' + text;

  if( extraKey ){
    cacheKey += '$@$' + extraKey;
  }

  var cache = r.labelDimCache || (r.labelDimCache = {});

  if( cache[ cacheKey ] ){
    return cache[ cacheKey ];
  }

  var sizeMult = 1; // increase the scale to increase accuracy w.r.t. zoomed text
  var fStyle = ele.pstyle( 'font-style' ).strValue;
  var size = ( sizeMult * ele.pstyle( 'font-size' ).pfValue ) + 'px';
  var family = ele.pstyle( 'font-family' ).strValue;
  var weight = ele.pstyle( 'font-weight' ).strValue;

  var div = this.labelCalcDiv;

  if( !div ){
    div = this.labelCalcDiv = document.createElement( 'div' ); // eslint-disable-line no-undef
    document.body.appendChild( div ); // eslint-disable-line no-undef
  }

  var ds = div.style;

  // from ele style
  ds.fontFamily = family;
  ds.fontStyle = fStyle;
  ds.fontSize = size;
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

  if( ele.pstyle( 'text-wrap' ).value === 'wrap' ){
    ds.whiteSpace = 'pre'; // so newlines are taken into account
  } else {
    ds.whiteSpace = 'normal';
  }

  // put label content in div
  div.textContent = text;

  cache[ cacheKey ] = {
    width: Math.ceil( div.clientWidth / sizeMult ),
    height: Math.ceil( div.clientHeight / sizeMult )
  };

  return cache[ cacheKey ];
};

BRp.recalculateEdgeProjections = function( edges ){
  this.findEdgeControlPoints( edges );
};


// Find edge control points
BRp.findEdgeControlPoints = function( edges ){
  if( !edges || edges.length === 0 ){ return; }

  var r = this;
  var cy = r.cy;
  var hasCompounds = cy.hasCompoundNodes();
  var hashTable = {};
  var pairIds = [];
  var haystackEdges = [];

  // create a table of edge (src, tgt) => list of edges between them
  var pairId;
  for( var i = 0; i < edges.length; i++ ){
    var edge = edges[ i ];
    var _p = edge._private;
    var data = _p.data;
    var curveStyle = edge.pstyle( 'curve-style' ).value;
    var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';

    // ignore edges who are not to be displayed
    // they shouldn't take up space
    if( edge.pstyle( 'display').value === 'none' ){
      continue;
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

    if( hashTable[ pairId ] == null ){
      hashTable[ pairId ] = [];
      pairIds.push( pairId );
    }

    hashTable[ pairId ].push( edge );

    if( edgeIsUnbundled ){
      hashTable[ pairId ].hasUnbundled = true;
    }
  }

  var src, tgt, src_p, tgt_p, srcPos, tgtPos, srcW, srcH, tgtW, tgtH, srcShape, tgtShape;
  var vectorNormInverse;
  var badBezier;

  // for each pair (src, tgt), create the ctrl pts
  // Nested for loop is OK; total number of iterations for both loops = edgeCount
  for( var p = 0; p < pairIds.length; p++ ){
    pairId = pairIds[ p ];
    var pairEdges = hashTable[ pairId ];

    // for each pair id, the edges should be sorted by index
    pairEdges.sort( function( edge1, edge2 ){
      return edge1.poolIndex() - edge2.poolIndex();
    } );

    src = pairEdges[0]._private.source;
    tgt = pairEdges[0]._private.target;

    // make sure src/tgt distinction is consistent for bundled edges
    if( !pairEdges.hasUnbundled && src.id() > tgt.id() ){
      var temp = src;
      src = tgt;
      tgt = temp;
    }

    src_p = src._private;
    tgt_p = tgt._private;

    srcPos = src_p.position;
    tgtPos = tgt_p.position;

    srcW = src.outerWidth();
    srcH = src.outerHeight();

    tgtW = tgt.outerWidth();
    tgtH = tgt.outerHeight();

    srcShape = r.nodeShapes[ this.getNodeShape( src ) ];
    tgtShape = r.nodeShapes[ this.getNodeShape( tgt ) ];

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

      var posPts = {
        x1: srcPos.x,
        x2: tgtPos.x,
        y1: srcPos.y,
        y2: tgtPos.y
      };

      var dy = ( tgtOutside[1] - srcOutside[1] );
      var dx = ( tgtOutside[0] - srcOutside[0] );
      var l = Math.sqrt( dx * dx + dy * dy );

      var vector = {
        x: dx,
        y: dy
      };

      var vectorNorm = {
        x: vector.x / l,
        y: vector.y / l
      };
      vectorNormInverse = {
        x: -vectorNorm.y,
        y: vectorNorm.x
      };


      // if node shapes overlap, then no ctrl pts to draw
      if(
        tgtShape.checkPoint( srcOutside[0], srcOutside[1], 0, tgtW, tgtH, tgtPos.x, tgtPos.y )  &&
        srcShape.checkPoint( tgtOutside[0], tgtOutside[1], 0, srcW, srcH, srcPos.x, srcPos.y )
      ){
        vectorNormInverse = {};
        badBezier = true;
      }

    }

    var edge;
    var edge_p;
    var rs;

    for( var i = 0; i < pairEdges.length; i++ ){
      edge = pairEdges[ i ];
      edge_p = edge._private;
      rs = edge_p.rscratch;

      var edgeIndex1 = rs.lastEdgeIndex;
      var edgeIndex2 = i;

      var numEdges1 = rs.lastNumEdges;
      var numEdges2 = pairEdges.length;

      var curveStyle = edge.pstyle( 'curve-style' ).value;
      var ctrlptDists = edge.pstyle( 'control-point-distances' );
      var ctrlptWs = edge.pstyle( 'control-point-weights' );
      var bezierN = ctrlptDists && ctrlptWs ? Math.min( ctrlptDists.value.length, ctrlptWs.value.length ) : 1;
      var stepSize = edge.pstyle( 'control-point-step-size' ).pfValue;
      var ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[0] : undefined;
      var ctrlptWeight = ctrlptWs.value[0];
      var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';

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
      var width2 = edge.pstyle( 'control-point-step-size' ).pfValue;

      var edgeDistances = edge.pstyle('edge-distances').value;

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
          srcPos.y - (1 + Math.pow( srcH, 1.12 ) / 100) * loopDist * (j / 3 + 1),

          srcPos.x - (1 + Math.pow( srcW, 1.12 ) / 100) * loopDist * (j / 3 + 1),
          srcPos.y
        ];

      } else if(
        hasCompounds &&
        ( src.isParent() || src.isChild() || tgt.isParent() || tgt.isChild() ) &&
        ( src.parents().anySame( tgt ) || tgt.parents().anySame( src ) )
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
          x: srcPos.x - srcW / 2,
          y: srcPos.y - srcH / 2
        };

        var loopbPos = {
          x: tgtPos.x - tgtW / 2,
          y: tgtPos.y - tgtH / 2
        };

        var loopPos = {
          x: Math.min( loopaPos.x, loopbPos.x ),
          y: Math.min( loopaPos.y, loopbPos.y )
        };

        // avoids cases with impossible beziers
        var minCompoundStretch = 0.5;
        var compoundStretchA = Math.max( minCompoundStretch, Math.log( srcW * 0.01 ) );
        var compoundStretchB = Math.max( minCompoundStretch, Math.log( tgtW * 0.01 ) );

        rs.ctrlpts = [
          loopPos.x,
          loopPos.y - (1 + Math.pow( loopW, 1.12 ) / 100) * loopDist * (j / 3 + 1) * compoundStretchA,

          loopPos.x - (1 + Math.pow( loopW, 1.12 ) / 100) * loopDist * (j / 3 + 1) * compoundStretchB,
          loopPos.y
        ];

      } else if( curveStyle === 'segments' ){
        // Segments (multiple straight lines)

        rs.edgeType = 'segments';
        rs.segpts = [];

        var segmentWs = edge.pstyle( 'segment-weights' ).pfValue;
        var segmentDs = edge.pstyle( 'segment-distances' ).pfValue;
        var segmentsN = Math.min( segmentWs.length, segmentDs.length );

        for( var s = 0; s < segmentsN; s++ ){
          var w = segmentWs[ s ];
          var d = segmentDs[ s ];

          var w1 = 1 - w;
          var w2 = w;

          var midptPts = edgeDistances === 'node-position' ? posPts : midptSrcPts;

          var adjustedMidpt = {
            x: midptPts.x1 * w1 + midptPts.x2 * w2,
            y: midptPts.y1 * w1 + midptPts.y2 * w2
          };

          rs.segpts.push(
            adjustedMidpt.x + vectorNormInverse.x * d,
            adjustedMidpt.y + vectorNormInverse.y * d
          );
        }

      // Straight edge
      } else if(
        pairEdges.length % 2 === 1
        && i === Math.floor( pairEdges.length / 2 )
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
            ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[ b ] : stepSize; // fall back on step size
            ctrlptWeight = ctrlptWs.value[ b ];
          }

          if( edgeIsUnbundled ){ // multi or single unbundled
            manctrlptDist = ctrlptDist;
          } else {
            manctrlptDist = ctrlptDist !== undefined ? sign * ctrlptDist : undefined;
          }

          var distanceFromMidpoint = manctrlptDist !== undefined ? manctrlptDist : normctrlptDist;

          var w1 = 1 - ctrlptWeight;
          var w2 = ctrlptWeight;

          var midptPts = edgeDistances === 'node-position' ? posPts : midptSrcPts;

          var adjustedMidpt = {
            x: midptPts.x1 * w1 + midptPts.x2 * w2,
            y: midptPts.y1 * w1 + midptPts.y2 * w2
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
      var arrowW = this.getArrowWidth( edge.pstyle( 'width' ).pfValue ) * this.arrowShapeWidth;
      var minCpADist = minCpADistFactor * arrowW;

      if( rs.edgeType === 'bezier' ){
        var startACpDist = math.dist( { x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.startX, y: rs.startY } );
        var closeStartACp = startACpDist < minCpADist;
        var endACpDist = math.dist( { x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.endX, y: rs.endY } );
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
          var cpL = Math.sqrt( cpD.x * cpD.x + cpD.y * cpD.y ); // length of line
          var cpM = { // normalised delta
            x: cpD.x / cpL,
            y: cpD.y / cpL
          };
          var radius = Math.max( srcW, srcH );
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
          var cpL = Math.sqrt( cpD.x * cpD.x + cpD.y * cpD.y ); // length of line
          var cpM = { // normalised delta
            x: cpD.x / cpL,
            y: cpD.y / cpL
          };
          var radius = Math.max( srcW, srcH );
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

        for( var b = 0; b + 1 < rs.ctrlpts.length; b += 2 ){
          // ctrl pt itself
          rs.allpts.push( rs.ctrlpts[ b ], rs.ctrlpts[ b + 1] );

          // the midpt between ctrlpts as intermediate destination pts
          if( b + 3 < rs.ctrlpts.length ){
            rs.allpts.push( (rs.ctrlpts[ b ] + rs.ctrlpts[ b + 2]) / 2, (rs.ctrlpts[ b + 1] + rs.ctrlpts[ b + 3]) / 2 );
          }
        }

        rs.allpts.push( rs.endX, rs.endY );

        var m, mt;
        if( rs.ctrlpts.length / 2 % 2 === 0 ){
          m = rs.allpts.length / 2 - 1;

          rs.midX = rs.allpts[ m ];
          rs.midY = rs.allpts[ m + 1];
        } else {
          m = rs.allpts.length / 2 - 3;
          mt = 0.5;

          rs.midX = math.qbezierAt( rs.allpts[ m ], rs.allpts[ m + 2], rs.allpts[ m + 4], mt );
          rs.midY = math.qbezierAt( rs.allpts[ m + 1], rs.allpts[ m + 3], rs.allpts[ m + 5], mt );
        }

      } else if( rs.edgeType === 'straight' ){
        // need to calc these after endpts
        rs.allpts = [ rs.startX, rs.startY, rs.endX, rs.endY ];

        // default midpt for labels etc
        rs.midX = ( rs.startX + rs.endX + rs.arrowStartX + rs.arrowEndX ) / 4;
        rs.midY = ( rs.startY + rs.endY + rs.arrowStartY + rs.arrowEndY ) / 4;

      } else if( rs.edgeType === 'segments' ){
        rs.allpts = [];
        rs.allpts.push( rs.startX, rs.startY );
        rs.allpts.push.apply( rs.allpts, rs.segpts );
        rs.allpts.push( rs.endX, rs.endY );

        if( rs.segpts.length % 4 === 0 ){
          var i2 = rs.segpts.length / 2;
          var i1 = i2 - 2;

          rs.midX = ( rs.segpts[ i1 ] + rs.segpts[ i2 ] ) / 2;
          rs.midY = ( rs.segpts[ i1 + 1] + rs.segpts[ i2 + 1] ) / 2;
        } else {
          var i1 = rs.segpts.length / 2 - 1;

          rs.midX = rs.segpts[ i1 ];
          rs.midY = rs.segpts[ i1 + 1];
        }


      }

      this.projectLines( edge );
      this.calculateArrowAngles( edge );
      this.recalculateEdgeLabelProjections( edge );
      this.calculateLabelAngles( edge );

    } // for pair edges
  } // for pair ids

  for( var i = 0; i < haystackEdges.length; i++ ){
    var edge = haystackEdges[ i ];
    var _p = edge._private;
    var rscratch = _p.rscratch;
    var rs = rscratch;

    if( !rscratch.haystack ){
      var angle = Math.random() * 2 * Math.PI;

      rscratch.source = {
        x: Math.cos( angle ),
        y: Math.sin( angle )
      };

      var angle = Math.random() * 2 * Math.PI;

      rscratch.target = {
        x: Math.cos( angle ),
        y: Math.sin( angle )
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
    var radius = edge.pstyle( 'haystack-radius' ).value;
    var halfRadius = radius / 2; // b/c have to half width/height

    rs.haystackPts = rs.allpts = [
      rs.source.x * srcW * halfRadius + srcPos.x,
      rs.source.y * srcH * halfRadius + srcPos.y,
      rs.target.x * tgtW * halfRadius + tgtPos.x,
      rs.target.y * tgtH * halfRadius + tgtPos.y
    ];

    rs.midX = (rs.allpts[0] + rs.allpts[2]) / 2;
    rs.midY = (rs.allpts[1] + rs.allpts[3]) / 2;

    // always override as haystack in case set to different type previously
    rscratch.edgeType = 'haystack';
    rscratch.haystack = true;

    this.projectLines( edge );
    this.calculateArrowAngles( edge );
    this.recalculateEdgeLabelProjections( edge );
    this.calculateLabelAngles( edge );
  }

  return hashTable;
};

var getAngleFromDisp = function( dispX, dispY ){
  return Math.atan2( dispY, dispX ) - Math.PI / 2;
};

BRp.calculateArrowAngles = function( edge ){
  var rs = edge._private.rscratch;
  var isHaystack = rs.edgeType === 'haystack';
  var isMultibezier = rs.edgeType === 'multibezier';
  var isSegments = rs.edgeType === 'segments';
  var isCompound = rs.edgeType === 'compound';
  var isSelf = rs.edgeType === 'self';

  // Displacement gives direction for arrowhead orientation
  var dispX, dispY;
  var startX, startY, endX, endY;

  var srcPos = edge._private.source._private.position;
  var tgtPos = edge._private.target._private.position;

  if( isHaystack ){
    startX = rs.haystackPts[0];
    startY = rs.haystackPts[1];
    endX = rs.haystackPts[2];
    endY = rs.haystackPts[3];
  } else {
    startX = rs.arrowStartX;
    startY = rs.arrowStartY;
    endX = rs.arrowEndX;
    endY = rs.arrowEndY;
  }

  // source
  //

  dispX = srcPos.x - startX;
  dispY = srcPos.y - startY;

  rs.srcArrowAngle = getAngleFromDisp( dispX, dispY );

  // mid target
  //

  var midX = rs.midX;
  var midY = rs.midY;

  if( isHaystack ){
    midX = ( startX + endX ) / 2;
    midY = ( startY + endY ) / 2;
  }

  dispX = endX - startX;
  dispY = endY - startY;

  if( isSelf ){
    dispX = -1;
    dispY = 1;
  } else if( isSegments ){
    var pts = rs.allpts;

    if( pts.length / 2 % 2 === 0 ){
      var i2 = pts.length / 2;
      var i1 = i2 - 2;

      dispX = ( pts[ i2 ] - pts[ i1 ] );
      dispY = ( pts[ i2 + 1] - pts[ i1 + 1] );
    } else {
      var i2 = pts.length / 2 - 1;
      var i1 = i2 - 2;
      var i3 = i2 + 2;

      dispX = ( pts[ i2 ] - pts[ i1 ] );
      dispY = ( pts[ i2 + 1] - pts[ i1 + 1] );
    }
  } else if( isMultibezier || isCompound ){
    var pts = rs.allpts;
    var cpts = rs.ctrlpts;
    var bp0x, bp0y;
    var bp1x, bp1y;

    if( cpts.length / 2 % 2 === 0 ){
      var p0 = pts.length / 2 - 1; // startpt
      var ic = p0 + 2;
      var p1 = ic + 2;

      bp0x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.0 );
      bp0y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.0 );

      bp1x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.0001 );
      bp1y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.0001 );
    } else {
      var ic = pts.length / 2 - 1; // ctrpt
      var p0 = ic - 2; // startpt
      var p1 = ic + 2; // endpt

      bp0x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.4999 );
      bp0y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.4999 );

      bp1x = math.qbezierAt( pts[ p0 ], pts[ ic ], pts[ p1 ], 0.5 );
      bp1y = math.qbezierAt( pts[ p0 + 1], pts[ ic + 1], pts[ p1 + 1], 0.5 );
    }

    dispX = ( bp1x - bp0x );
    dispY = ( bp1y - bp0y );
  }

  rs.midtgtArrowAngle = getAngleFromDisp( dispX, dispY );

  rs.midDispX = dispX;
  rs.midDispY = dispY;

  // mid source
  //

  dispX *= -1;
  dispY *= -1;

  if( isSegments ){
    var pts = rs.allpts;

    if( pts.length / 2 % 2 === 0 ){
      // already ok
    } else {
      var i2 = pts.length / 2 - 1;
      var i3 = i2 + 2;

      dispX = -( pts[ i3 ] - pts[ i2 ] );
      dispY = -( pts[ i3 + 1] - pts[ i2 + 1] );
    }
  }

  rs.midsrcArrowAngle = getAngleFromDisp( dispX, dispY );

  // target
  //

  dispX = tgtPos.x - endX;
  dispY = tgtPos.y - endY;

  rs.tgtArrowAngle = getAngleFromDisp( dispX, dispY );
};

BRp.calculateLabelAngles = function( ele ){
  var _p = ele._private;
  var rs = _p.rscratch;
  var isEdge = ele.isEdge();
  var rot = ele.pstyle( 'text-rotation' );
  var rotStr = rot.strValue;

  if( rotStr === 'none' ){
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = 0;
  } else if( isEdge && rotStr === 'autorotate' ){
    rs.labelAngle = Math.atan( rs.midDispY / rs.midDispX );
    rs.sourceLabelAngle = rs.sourceLabelAutoAngle;
    rs.targetLabelAngle = rs.targetLabelAutoAngle;
  } else if( rotStr === 'autorotate' ){
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = 0;
  } else {
    rs.labelAngle = rs.sourceLabelAngle = rs.targetLabelAngle = rot.pfValue;
  }
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

  var tgtArShape = edge.pstyle( 'target-arrow-shape' ).value;
  var srcArShape = edge.pstyle( 'source-arrow-shape' ).value;

  var rs = edge._private.rscratch;

  var et = rs.edgeType;
  var bezier = et === 'bezier' || et === 'multibezier' || et === 'self' || et === 'compound';
  var multi = et !== 'bezier';
  var lines = et === 'straight' || et === 'segments';
  var segments = et === 'segments';
  var hasEndpts = bezier || multi || lines;

  var p1, p2;

  if( bezier ){
    var cpStart = [ rs.ctrlpts[0], rs.ctrlpts[1] ];
    var cpEnd = multi ? [ rs.ctrlpts[ rs.ctrlpts.length - 2], rs.ctrlpts[ rs.ctrlpts.length - 1] ] : cpStart;

    p1 = cpEnd;
    p2 = cpStart;
  } else if( lines ){
    var srcArrowFromPt = !segments ? [ tgtPos.x, tgtPos.y ] : rs.segpts.slice( 0, 2 );
    var tgtArrowFromPt = !segments ? [ srcPos.x, srcPos.y ] : rs.segpts.slice( rs.segpts.length - 2 );

    p1 = tgtArrowFromPt;
    p2 = srcArrowFromPt;
  }

  intersect = r.nodeShapes[ this.getNodeShape( target ) ].intersectLine(
    tgtPos.x,
    tgtPos.y,
    target.outerWidth(),
    target.outerHeight(),
    p1[0],
    p1[1],
    0
  );

  var arrowEnd = math.shortenIntersection( intersect, p1,
    r.arrowShapes[ tgtArShape ].spacing( edge ) );
  var edgeEnd = math.shortenIntersection( intersect, p1,
    r.arrowShapes[ tgtArShape ].gap( edge ) );

  rs.endX = edgeEnd[0];
  rs.endY = edgeEnd[1];

  rs.arrowEndX = arrowEnd[0];
  rs.arrowEndY = arrowEnd[1];

  intersect = r.nodeShapes[ this.getNodeShape( source ) ].intersectLine(
    srcPos.x,
    srcPos.y,
    source.outerWidth(),
    source.outerHeight(),
    p2[0],
    p2[1],
    0
  );

  var arrowStart = math.shortenIntersection(
    intersect, p2,
    r.arrowShapes[ srcArShape ].spacing( edge )
  );
  var edgeStart = math.shortenIntersection(
    intersect, p2,
    r.arrowShapes[ srcArShape ].gap( edge )
  );

  rs.startX = edgeStart[0];
  rs.startY = edgeStart[1];

  rs.arrowStartX = arrowStart[0];
  rs.arrowStartY = arrowStart[1];

  if( hasEndpts ){
    if( !is.number( rs.startX ) || !is.number( rs.startY ) || !is.number( rs.endX ) || !is.number( rs.endY ) ){
      rs.badLine = true;
    } else {
      rs.badLine = false;
    }
  }
};

BRp.getArrowWidth = BRp.getArrowHeight = function( edgeWidth ){
  var cache = this.arrowWidthCache = this.arrowWidthCache || {};

  var cachedVal = cache[ edgeWidth ];
  if( cachedVal ){
    return cachedVal;
  }

  cachedVal =  Math.max( Math.pow( edgeWidth * 13.37, 0.9 ), 29 );
  cache[ edgeWidth ] = cachedVal;

  return cachedVal;
};

module.exports = BRp;

var BRp = {};

BRp.registerCalculationListeners = function(){
  var cy = this.cy;
  var elesToUpdate = cy.collection();
  var r = this;

  var enqueue = function( eles, e, dirtyStyleCaches = true ){
    elesToUpdate.merge( eles );

    for( var i = 0; i < eles.length; i++ ){
      var ele = eles[i];
      var _p = ele._private;
      var rstyle = _p.rstyle;

      if( dirtyStyleCaches ){
        rstyle.clean = false;
        _p.bbCache = null;
      }

      var evts = rstyle.dirtyEvents = rstyle.dirtyEvents || { length: 0 };

      if( !evts[ e.type ] ){
        evts[ e.type ] = true;
        evts.length++;
      }
    }
  };

  r.binder( cy )
    // nodes

    .on('position.* style.* free.* bounds.*', 'node', function onDirtyModNode( e ){
      var node = e.target;

      enqueue( node, e );
      enqueue( node.connectedEdges(), e );
    })

    .on('add.*', 'node', function onDirtyAddNode( e ){
      var ele = e.target;

      enqueue( ele, e );
    })

    .on('background.*', 'node', function onDirtyBgNode( e ){
      var ele = e.target;

      enqueue( ele, e, false );
    })

    // edges

    .on('add.* style.*', 'edge', function onDirtyEdge( e ){
      var edge = e.target;

      enqueue( edge, e );
      enqueue( edge.parallelEdges(), e );
    })

    .on('remove.*', 'edge', function onDirtyRemoveEdge( e ){
      var edge = e.target;
      var pEdges = edge.parallelEdges();

      for( var i = 0; i < pEdges.length; i++ ){
        var pEdge = pEdges[i];

        if( !pEdge.removed() ){
          enqueue( pEdge, e );
        }
      }
    })

    // manual dirtying

    .on('dirty.*', 'node', function onDirtyEle( e ){
      var ele = e.target;

      enqueue( ele, e );
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

    // only update if not display: none
    if( ele.pstyle('display').value === 'none' ){ continue; }

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
    var pos = ele.position();

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

module.exports = BRp;

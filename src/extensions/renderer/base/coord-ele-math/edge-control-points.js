var math = require( '../../../../math' );
var is = require( '../../../../is' );

var BRp = {};

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
    var edgeIsBezier = curveStyle === 'unbundled-bezier' || curveStyle === 'bezier';

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

    var tableEntry = hashTable[ pairId ];

    if( tableEntry == null ){
      tableEntry = hashTable[ pairId ] = [];
      pairIds.push( pairId );
    }

    tableEntry.push( edge );

    if( edgeIsUnbundled ){
      tableEntry.hasUnbundled = true;
    }

    if( edgeIsBezier ){
      tableEntry.hasBezier = true;
    }
  }

  var src, tgt, srcPos, tgtPos, srcW, srcH, tgtW, tgtH, srcShape, tgtShape;
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

    srcPos = src.position();
    tgtPos = tgt.position();

    srcW = src.outerWidth();
    srcH = src.outerHeight();

    tgtW = tgt.outerWidth();
    tgtH = tgt.outerHeight();

    srcShape = r.nodeShapes[ this.getNodeShape( src ) ];
    tgtShape = r.nodeShapes[ this.getNodeShape( tgt ) ];

    badBezier = false;

    var edge;
    var edge_p;
    var rs;

    var dirCounts = {
      'north': 0,
      'west': 0,
      'south': 0,
      'east': 0,
      'northwest': 0,
      'southwest': 0,
      'northeast': 0,
      'southeast': 0
    };

    var srcX2 = srcPos.x;
    var srcY2 = srcPos.y;
    var srcW2 = srcW;
    var srcH2 = srcH;

    var tgtX2 = tgtPos.x;
    var tgtY2 = tgtPos.y;
    var tgtW2 = tgtW;
    var tgtH2 = tgtH;

    var numEdges2 = pairEdges.length;

    for( var i = 0; i < pairEdges.length; i++ ){
      edge = pairEdges[ i ];
      edge_p = edge._private;
      rs = edge_p.rscratch;

      var edgeIndex1 = rs.lastEdgeIndex;
      var edgeIndex2 = i;

      var numEdges1 = rs.lastNumEdges;

      var curveStyle = edge.pstyle( 'curve-style' ).value;

      var edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';

      // whether the normalised pair order is the reverse of the edge's src-tgt order
      var edgeIsSwapped = src.id() !== edge.source().id();

      var ctrlptDists = edge.pstyle( 'control-point-distances' );
      var loopDir = edge.pstyle('loop-direction').pfValue;
      var loopSwp = edge.pstyle('loop-sweep').pfValue;
      var ctrlptWs = edge.pstyle( 'control-point-weights' );
      var bezierN = ctrlptDists && ctrlptWs ? Math.min( ctrlptDists.value.length, ctrlptWs.value.length ) : 1;
      var stepSize = edge.pstyle( 'control-point-step-size' ).pfValue;
      var ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[0] : undefined;
      var ctrlptWeight = ctrlptWs.value[0];
      var edgeDistances = edge.pstyle('edge-distances').value;
      var segmentWs = edge.pstyle( 'segment-weights' );
      var segmentDs = edge.pstyle( 'segment-distances' );
      var segmentsN = Math.min( segmentWs.pfValue.length, segmentDs.pfValue.length );
      var srcEndpt = edge.pstyle('source-endpoint').value;
      var tgtEndpt = edge.pstyle('target-endpoint').value;
      var srcArrShape = edge.pstyle('source-arrow-shape').value;
      var tgtArrShape = edge.pstyle('target-arrow-shape').value;
      var arrowScale = edge.pstyle('arrow-scale').value;
      var lineWidth = edge.pstyle('width').pfValue;

      var srcX1 = rs.lastSrcCtlPtX;
      var srcY1 = rs.lastSrcCtlPtY;
      var srcW1 = rs.lastSrcCtlPtW;
      var srcH1 = rs.lastSrcCtlPtH;

      var tgtX1 = rs.lastTgtCtlPtX;
      var tgtY1 = rs.lastTgtCtlPtY;
      var tgtW1 = rs.lastTgtCtlPtW;
      var tgtH1 = rs.lastTgtCtlPtH;

      var curveStyle1 = rs.lastCurveStyle;
      var curveStyle2 = curveStyle;

      var ctrlptDists1 = rs.lastCtrlptDists;
      var ctrlptDists2 = ctrlptDists ? ctrlptDists.strValue : null;

      var ctrlptWs1 = rs.lastCtrlptWs;
      var ctrlptWs2 = ctrlptWs.strValue;

      var segmentWs1 = rs.lastSegmentWs;
      var segmentWs2 = segmentWs.strValue;

      var segmentDs1 = rs.lastSegmentDs;
      var segmentDs2 = segmentDs.strValue;

      var stepSize1 = rs.lastStepSize;
      var stepSize2 = stepSize;

      var loopDir1 = rs.lastLoopDir;
      var loopDir2 = loopDir;

      var loopSwp1 = rs.lastLoopSwp;
      var loopSwp2 = loopSwp;

      var edgeDistances1 = rs.lastEdgeDistances;
      var edgeDistances2 = edgeDistances;

      var srcEndpt1 = rs.lastSrcEndpt;
      var srcEndpt2 = srcEndpt;

      var tgtEndpt1 = rs.lastTgtEndpt;
      var tgtEndpt2 = tgtEndpt;

      var srcArr1 = rs.lastSrcArr;
      var srcArr2 = srcArrShape;

      var tgtArr1 = rs.lastTgtArr;
      var tgtArr2 = tgtArrShape;

      var lineW1 = rs.lastLineW;
      var lineW2 = lineWidth;

      var arrScl1 = rs.lastArrScl;
      var arrScl2 = arrowScale;

      if( badBezier ){
        rs.badBezier = true;
      } else {
        rs.badBezier = false;
      }

      var ptCacheHit;

      if( srcX1 === srcX2 && srcY1 === srcY2 && srcW1 === srcW2 && srcH1 === srcH2
      &&  tgtX1 === tgtX2 && tgtY1 === tgtY2 && tgtW1 === tgtW2 && tgtH1 === tgtH2
      &&  curveStyle1 === curveStyle2
      &&  ctrlptDists1 === ctrlptDists2
      &&  ctrlptWs1 === ctrlptWs2
      &&  segmentWs1 === segmentWs2
      &&  segmentDs1 === segmentDs2
      &&  stepSize1 === stepSize2
      &&  loopDir1 === loopDir2
      &&  loopSwp1 === loopSwp2
      &&  edgeDistances1 === edgeDistances2
      &&  srcEndpt1 === srcEndpt2
      &&  tgtEndpt1 === tgtEndpt2
      &&  srcArr1 === srcArr2
      &&  tgtArr1 === tgtArr2
      &&  lineW1 === lineW2
      &&  arrScl1 === arrScl2
      &&  ((edgeIndex1 === edgeIndex2 && numEdges1 === numEdges2) || edgeIsUnbundled) ){
        ptCacheHit = true; // then the control points haven't changed and we can skip calculating them
      } else {
        ptCacheHit = false;

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
        rs.lastCurveStyle = curveStyle2;
        rs.lastCtrlptDists = ctrlptDists2;
        rs.lastCtrlptWs = ctrlptWs2;
        rs.lastSegmentDs = segmentDs2;
        rs.lastSegmentWs = segmentWs2;
        rs.lastStepSize = stepSize2;
        rs.lastLoopDir = loopDir2;
        rs.lastLoopSwp = loopSwp2;
        rs.lastEdgeDistances = edgeDistances2;
        rs.lastSrcEndpt = srcEndpt2;
        rs.lastTgtEndpt = tgtEndpt2;
        rs.lastSrcArr = srcArr2;
        rs.lastTgtArr = tgtArr2;
        rs.lastLineW = lineW2;
        rs.lastArrScl = arrScl2;
      }

      if( !ptCacheHit ){

        if( !pairEdges.calculatedIntersection && src !== tgt && ( pairEdges.hasBezier || pairEdges.hasUnbundled ) ){

          pairEdges.calculatedIntersection = true;

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

          pairEdges.srcIntn = srcOutside;

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

          pairEdges.tgtIntn = tgtOutside;

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

        if( !edgeIsSwapped ){
          rs.srcIntn = pairEdges.srcIntn;
          rs.tgtIntn = pairEdges.tgtIntn;
        } else { // ensure that the per-edge cached value for intersections are correct for swapped bundled edges
          rs.srcIntn = pairEdges.tgtIntn;
          rs.tgtIntn = pairEdges.srcIntn;
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

          var loopAngle = loopDir - Math.PI / 2;
          var outAngle =  loopAngle - loopSwp / 2;
          var inAngle =  loopAngle + loopSwp / 2;

          // increase by step size for overlapping loops, keyed on direction and sweep values
          var dc = String(loopDir + '_' + loopSwp);
          j = dirCounts[dc] === undefined ? dirCounts[dc] = 0 : ++dirCounts[dc];

          rs.ctrlpts = [
            srcPos.x + Math.cos(outAngle) * 1.4 * loopDist * (j / 3 + 1),
            srcPos.y + Math.sin(outAngle) * 1.4 * loopDist * (j / 3 + 1),
            srcPos.x + Math.cos(inAngle) * 1.4 * loopDist * (j / 3 + 1),
            srcPos.y + Math.sin(inAngle) * 1.4 * loopDist * (j / 3 + 1)
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

          for( var s = 0; s < segmentsN; s++ ){
            var w = segmentWs.pfValue[ s ];
            var d = segmentDs.pfValue[ s ];

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

            if( edgeIsSwapped ){
              var temp = w1;
              w1 = w2;
              w2 = temp;
            }

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
        var arrowW = this.getArrowWidth( edge.pstyle( 'width' ).pfValue, edge.pstyle( 'arrow-scale' ).value )
          * this.arrowShapeWidth;
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

        this.storeEdgeProjections( edge );
        this.calculateArrowAngles( edge );
      } // if point cache miss

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
    var srcPos = src.position();
    var tgtPos = tgt.position();
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
    rscratch.edgeType = rscratch.lastCurveStyle = 'haystack';
    rscratch.haystack = true;

    this.storeEdgeProjections( edge );
    this.calculateArrowAngles( edge );
    this.recalculateEdgeLabelProjections( edge );
    this.calculateLabelAngles( edge );
  }
};

function getPts( pts ){
  let retPts = [];

  if( pts == null ){ return; }

  for( let i = 0; i < pts.length; i += 2 ){
    let x = pts[i];
    let y = pts[i+1];

    retPts.push({ x, y });
  }

  return retPts;
}

BRp.getSegmentPoints = function( edge ){
  let rs = edge[0]._private.rscratch;
  let type = rs.edgeType;

  if( type === 'segments' ){
    return getPts( rs.segpts );
  }
};

BRp.getControlPoints = function( edge ){
  let rs = edge[0]._private.rscratch;
  let type = rs.edgeType;

  if( type === 'bezier' || type === 'multibezier' ){
    return getPts( rs.ctrlpts );
  }
};

BRp.getEdgeMidpoint = function( edge ){
  let rs = edge[0]._private.rscratch;

  return {
    x: rs.midX,
    y: rs.midY
  };
};

module.exports = BRp;

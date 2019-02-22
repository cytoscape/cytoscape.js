import * as math from '../../../../math';
import * as is from '../../../../is';
import * as util from '../../../../util';
import Map from '../../../../map';

let BRp = {};

BRp.findHaystackPoints = function( edges ){
  for( let i = 0; i < edges.length; i++ ){
    let edge = edges[i];
    let _p = edge._private;
    let rs = _p.rscratch;

    if( !rs.haystack ){
      let angle = Math.random() * 2 * Math.PI;

      rs.source = {
        x: Math.cos( angle ),
        y: Math.sin( angle )
      };

      angle = Math.random() * 2 * Math.PI;

      rs.target = {
        x: Math.cos( angle ),
        y: Math.sin( angle )
      };

    }

    let src = _p.source;
    let tgt = _p.target;
    let srcPos = src.position();
    let tgtPos = tgt.position();
    let srcW = src.width();
    let tgtW = tgt.width();
    let srcH = src.height();
    let tgtH = tgt.height();
    let radius = edge.pstyle( 'haystack-radius' ).value;
    let halfRadius = radius / 2; // b/c have to half width/height

    rs.haystackPts = rs.allpts = [
      rs.source.x * srcW * halfRadius + srcPos.x,
      rs.source.y * srcH * halfRadius + srcPos.y,
      rs.target.x * tgtW * halfRadius + tgtPos.x,
      rs.target.y * tgtH * halfRadius + tgtPos.y
    ];

    rs.midX = (rs.allpts[0] + rs.allpts[2]) / 2;
    rs.midY = (rs.allpts[1] + rs.allpts[3]) / 2;

    // always override as haystack in case set to different type previously
    rs.edgeType = rs.lastCurveStyle = 'haystack';
    rs.haystack = true;

    this.storeEdgeProjections( edge );
    this.calculateArrowAngles( edge );
    this.recalculateEdgeLabelProjections( edge );
    this.calculateLabelAngles( edge );
  }
};

BRp.storeAllpts = function( edge ){
  let rs = edge._private.rscratch;

  if( rs.edgeType === 'multibezier' || rs.edgeType === 'bezier' || rs.edgeType === 'self' || rs.edgeType === 'compound' ){
    rs.allpts = [];

    rs.allpts.push( rs.startX, rs.startY );

    for( let b = 0; b + 1 < rs.ctrlpts.length; b += 2 ){
      // ctrl pt itself
      rs.allpts.push( rs.ctrlpts[ b ], rs.ctrlpts[ b + 1] );

      // the midpt between ctrlpts as intermediate destination pts
      if( b + 3 < rs.ctrlpts.length ){
        rs.allpts.push( (rs.ctrlpts[ b ] + rs.ctrlpts[ b + 2]) / 2, (rs.ctrlpts[ b + 1] + rs.ctrlpts[ b + 3]) / 2 );
      }
    }

    rs.allpts.push( rs.endX, rs.endY );

    let m, mt;
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
      let i2 = rs.segpts.length / 2;
      let i1 = i2 - 2;

      rs.midX = ( rs.segpts[ i1 ] + rs.segpts[ i2 ] ) / 2;
      rs.midY = ( rs.segpts[ i1 + 1] + rs.segpts[ i2 + 1] ) / 2;
    } else {
      let i1 = rs.segpts.length / 2 - 1;

      rs.midX = rs.segpts[ i1 ];
      rs.midY = rs.segpts[ i1 + 1];
    }


  }
};

BRp.checkForInvalidEdgeWarning = function( edge ){
  let rs = edge._private.rscratch;

  if( !is.number(rs.startX) || !is.number(rs.startY) || !is.number(rs.endX) || !is.number(rs.endY) ){
    if( !rs.loggedErr ){
      rs.loggedErr = true;
      util.warn('Edge `' + edge.id() + '` has invalid endpoints and so it is impossible to draw.  Adjust your edge style (e.g. control points) accordingly or use an alternative edge type.  This is expected behaviour when the source node and the target node overlap.');
    }
  } else {
    rs.loggedErr = false;
  }
};

BRp.findEdgeControlPoints = function( edges ){
  if( !edges || edges.length === 0 ){ return; }

  let r = this;
  let cy = r.cy;
  let hasCompounds = cy.hasCompoundNodes();
  let hashTable = new Map();
  let pairIds = [];
  let haystackEdges = [];

  // create a table of edge (src, tgt) => list of edges between them
  for( let i = 0; i < edges.length; i++ ){
    let edge = edges[ i ];
    let _p = edge._private;
    let curveStyle = edge.pstyle( 'curve-style' ).value;
    let edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments' || curveStyle === 'straight';
    let edgeIsBezier = curveStyle === 'unbundled-bezier' || curveStyle === 'bezier';

    // ignore edges who are not to be displayed
    // they shouldn't take up space
    if( edge.pstyle( 'display').value === 'none' ){
      continue;
    }

    if( curveStyle === 'haystack' ){
      haystackEdges.push( edge );
      continue;
    }

    let srcIndex = _p.source.poolIndex();
    let tgtIndex = _p.target.poolIndex();

    let hash = (edgeIsUnbundled ? -1 : 1) * util.hashIntsArray([ srcIndex, tgtIndex ].sort());
    let pairId = hash;

    let tableEntry = hashTable.get( pairId );

    if( tableEntry == null ){
      tableEntry = [];

      hashTable.set( pairId, tableEntry );
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

  let src, tgt, srcPos, tgtPos, srcW, srcH, tgtW, tgtH, srcShape, tgtShape;
  let vectorNormInverse;
  let badBezier;

  // for each pair (src, tgt), create the ctrl pts
  // Nested for loop is OK; total number of iterations for both loops = edgeCount
  for( let p = 0; p < pairIds.length; p++ ){
    let pairId = pairIds[ p ];
    let pairEdges = hashTable.get( pairId );

    if( !pairEdges.hasUnbundled ){
      let isBundledBezier = edge => edge.pstyle( 'curve-style' ).value === 'bezier';
      let pllEdges = pairEdges[0].parallelEdges().filter(isBundledBezier);

      util.clearArray( pairEdges );

      pllEdges.forEach( edge => pairEdges.push(edge) );

      // for each pair id, the edges should be sorted by index
      pairEdges.sort( (edge1, edge2) => edge1.poolIndex() - edge2.poolIndex() );
    }

    src = pairEdges[0]._private.source;
    tgt = pairEdges[0]._private.target;

    // make sure src/tgt distinction is consistent w.r.t. pairId
    if( src.poolIndex() > tgt.poolIndex() ){
      let temp = src;
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

    let edge;
    let edge_p;
    let rs;

    let dirCounts = {
      'north': 0,
      'west': 0,
      'south': 0,
      'east': 0,
      'northwest': 0,
      'southwest': 0,
      'northeast': 0,
      'southeast': 0
    };

    for( let i = 0; i < pairEdges.length; i++ ){
      edge = pairEdges[ i ];
      edge_p = edge._private;
      rs = edge_p.rscratch;

      let curveStyle = edge.pstyle( 'curve-style' ).value;

      let edgeIsUnbundled = curveStyle === 'unbundled-bezier' || curveStyle === 'segments';

      // whether the normalised pair order is the reverse of the edge's src-tgt order
      let edgeIsSwapped = !src.same(edge.source());

      let ctrlptDists = edge.pstyle( 'control-point-distances' );
      let loopDir = edge.pstyle('loop-direction').pfValue;
      let loopSwp = edge.pstyle('loop-sweep').pfValue;
      let ctrlptWs = edge.pstyle( 'control-point-weights' );
      let bezierN = ctrlptDists && ctrlptWs ? Math.min( ctrlptDists.value.length, ctrlptWs.value.length ) : 1;
      let stepSize = edge.pstyle( 'control-point-step-size' ).pfValue;
      let ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[0] : undefined;
      let ctrlptWeight = ctrlptWs.value[0];
      let edgeDistances = edge.pstyle('edge-distances').value;
      let segmentWs = edge.pstyle( 'segment-weights' );
      let segmentDs = edge.pstyle( 'segment-distances' );
      let segmentsN = Math.min( segmentWs.pfValue.length, segmentDs.pfValue.length );

      if( badBezier ){
        rs.badBezier = true;
      } else {
        rs.badBezier = false;
      }

      if( !pairEdges.calculatedIntersection && src !== tgt && ( pairEdges.hasBezier || pairEdges.hasUnbundled ) ){

        pairEdges.calculatedIntersection = true;

        // pt outside src shape to calc distance/displacement from src to tgt
        let srcOutside = srcShape.intersectLine(
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
        let tgtOutside = tgtShape.intersectLine(
          tgtPos.x,
          tgtPos.y,
          tgtW,
          tgtH,
          srcPos.x,
          srcPos.y,
          0
        );

        pairEdges.tgtIntn = tgtOutside;

        let midptSrcPts = {
          x1: srcOutside[0],
          x2: tgtOutside[0],
          y1: srcOutside[1],
          y2: tgtOutside[1]
        };

        pairEdges.midptSrcPts = midptSrcPts;

        let posPts = {
          x1: srcPos.x,
          x2: tgtPos.x,
          y1: srcPos.y,
          y2: tgtPos.y
        };

        pairEdges.posPts = posPts;

        let dy = ( tgtOutside[1] - srcOutside[1] );
        let dx = ( tgtOutside[0] - srcOutside[0] );
        let l = Math.sqrt( dx * dx + dy * dy );

        let vector = {
          x: dx,
          y: dy
        };

        let vectorNorm = {
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

        let j = i;
        let loopDist = stepSize;

        if( edgeIsUnbundled ){
          j = 0;
          loopDist = ctrlptDist;
        }

        let loopAngle = loopDir - Math.PI / 2;
        let outAngle =  loopAngle - loopSwp / 2;
        let inAngle =  loopAngle + loopSwp / 2;

        // increase by step size for overlapping loops, keyed on direction and sweep values
        let dc = String(loopDir + '_' + loopSwp);
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

        let j = i;
        let loopDist = stepSize;

        if( edgeIsUnbundled ){
          j = 0;
          loopDist = ctrlptDist;
        }

        let loopW = 50;

        let loopaPos = {
          x: srcPos.x - srcW / 2,
          y: srcPos.y - srcH / 2
        };

        let loopbPos = {
          x: tgtPos.x - tgtW / 2,
          y: tgtPos.y - tgtH / 2
        };

        let loopPos = {
          x: Math.min( loopaPos.x, loopbPos.x ),
          y: Math.min( loopaPos.y, loopbPos.y )
        };

        // avoids cases with impossible beziers
        let minCompoundStretch = 0.5;
        let compoundStretchA = Math.max( minCompoundStretch, Math.log( srcW * 0.01 ) );
        let compoundStretchB = Math.max( minCompoundStretch, Math.log( tgtW * 0.01 ) );

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

        for( let s = 0; s < segmentsN; s++ ){
          let w = segmentWs.pfValue[ s ];
          let d = segmentDs.pfValue[ s ];

          let w1 = 1 - w;
          let w2 = w;

          let midptPts = edgeDistances === 'node-position' ? pairEdges.posPts : pairEdges.midptSrcPts;

          let adjustedMidpt = {
            x: midptPts.x1 * w1 + midptPts.x2 * w2,
            y: midptPts.y1 * w1 + midptPts.y2 * w2
          };

          rs.segpts.push(
            adjustedMidpt.x + vectorNormInverse.x * d,
            adjustedMidpt.y + vectorNormInverse.y * d
          );
        }


      } else if(
        curveStyle === 'straight'
        || (
          !edgeIsUnbundled
          && pairEdges.length % 2 === 1
          && i === Math.floor( pairEdges.length / 2 )
        )
      ){
        // Straight edge within bundle

        rs.edgeType = 'straight';

      } else {
        // (Multi)bezier

        let multi = edgeIsUnbundled;

        rs.edgeType = multi ? 'multibezier' : 'bezier';
        rs.ctrlpts = [];

        for( let b = 0; b < bezierN; b++ ){
          let normctrlptDist = (0.5 - pairEdges.length / 2 + i) * stepSize;
          let manctrlptDist;
          let sign = math.signum( normctrlptDist );

          if( multi ){
            ctrlptDist = ctrlptDists ? ctrlptDists.pfValue[ b ] : stepSize; // fall back on step size
            ctrlptWeight = ctrlptWs.value[ b ];
          }

          if( edgeIsUnbundled ){ // multi or single unbundled
            manctrlptDist = ctrlptDist;
          } else {
            manctrlptDist = ctrlptDist !== undefined ? sign * ctrlptDist : undefined;
          }

          let distanceFromMidpoint = manctrlptDist !== undefined ? manctrlptDist : normctrlptDist;

          let w1 = 1 - ctrlptWeight;
          let w2 = ctrlptWeight;

          if( edgeIsSwapped ){
            let temp = w1;
            w1 = w2;
            w2 = temp;
          }

          let midptPts = edgeDistances === 'node-position' ? pairEdges.posPts : pairEdges.midptSrcPts;

          let adjustedMidpt = {
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

      let badStart = !is.number( rs.startX ) || !is.number( rs.startY );
      let badAStart = !is.number( rs.arrowStartX ) || !is.number( rs.arrowStartY );
      let badEnd = !is.number( rs.endX ) || !is.number( rs.endY );
      let badAEnd = !is.number( rs.arrowEndX ) || !is.number( rs.arrowEndY );

      let minCpADistFactor = 3;
      let arrowW = this.getArrowWidth( edge.pstyle( 'width' ).pfValue, edge.pstyle( 'arrow-scale' ).value )
        * this.arrowShapeWidth;
      let minCpADist = minCpADistFactor * arrowW;

      if( rs.edgeType === 'bezier' ){
        let startACpDist = math.dist( { x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.startX, y: rs.startY } );
        let closeStartACp = startACpDist < minCpADist;
        let endACpDist = math.dist( { x: rs.ctrlpts[0], y: rs.ctrlpts[1] }, { x: rs.endX, y: rs.endY } );
        let closeEndACp = endACpDist < minCpADist;

        let overlapping = false;

        if( badStart || badAStart || closeStartACp ){
          overlapping = true;

          // project control point along line from src centre to outside the src shape
          // (otherwise intersection will yield nothing)
          let cpD = { // delta
            x: rs.ctrlpts[0] - srcPos.x,
            y: rs.ctrlpts[1] - srcPos.y
          };
          let cpL = Math.sqrt( cpD.x * cpD.x + cpD.y * cpD.y ); // length of line
          let cpM = { // normalised delta
            x: cpD.x / cpL,
            y: cpD.y / cpL
          };
          let radius = Math.max( srcW, srcH );
          let cpProj = { // *2 radius guarantees outside shape
            x: rs.ctrlpts[0] + cpM.x * 2 * radius,
            y: rs.ctrlpts[1] + cpM.y * 2 * radius
          };

          let srcCtrlPtIntn = srcShape.intersectLine(
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
          let cpD = { // delta
            x: rs.ctrlpts[0] - tgtPos.x,
            y: rs.ctrlpts[1] - tgtPos.y
          };
          let cpL = Math.sqrt( cpD.x * cpD.x + cpD.y * cpD.y ); // length of line
          let cpM = { // normalised delta
            x: cpD.x / cpL,
            y: cpD.y / cpL
          };
          let radius = Math.max( srcW, srcH );
          let cpProj = { // *2 radius guarantees outside shape
            x: rs.ctrlpts[0] + cpM.x * 2 * radius,
            y: rs.ctrlpts[1] + cpM.y * 2 * radius
          };

          let tgtCtrlPtIntn = tgtShape.intersectLine(
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

      this.checkForInvalidEdgeWarning( edge );
      this.storeAllpts( edge );
      this.storeEdgeProjections( edge );
      this.calculateArrowAngles( edge );

      this.recalculateEdgeLabelProjections( edge );
      this.calculateLabelAngles( edge );

    } // for pair edges
  } // for pair ids

  this.findHaystackPoints( haystackEdges );
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
    this.recalculateRenderedStyle( edge );

    return getPts( rs.segpts );
  }
};

BRp.getControlPoints = function( edge ){
  let rs = edge[0]._private.rscratch;
  let type = rs.edgeType;

  if( type === 'bezier' || type === 'multibezier' || type === 'self' || type === 'compound' ){
    this.recalculateRenderedStyle( edge );

    return getPts( rs.ctrlpts );
  }
};

BRp.getEdgeMidpoint = function( edge ){
  let rs = edge[0]._private.rscratch;

  this.recalculateRenderedStyle( edge );

  return {
    x: rs.midX,
    y: rs.midY
  };
};

export default BRp;

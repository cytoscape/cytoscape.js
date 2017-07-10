let math = require( '../../../../math' );
let is = require( '../../../../is' );

let BRp = {};

BRp.manualEndptToPx = function( node, prop ){
  let r = this;
  let npos = node.position();
  let w = node.outerWidth();
  let h = node.outerHeight();

  if( prop.value.length === 2 ){
    let p = [
      prop.pfValue[0],
      prop.pfValue[1]
    ];

    if( prop.units[0] === '%' ){
      p[0] = p[0] * w;
    }

    if( prop.units[1] === '%' ){
      p[1] = p[1] * h;
    }

    p[0] += npos.x;
    p[1] += npos.y;

    return p;
  } else {
    let angle = prop.pfValue[0];

    angle = -Math.PI / 2 + angle; // start at 12 o'clock

    let l = 2 * Math.max( w, h );

    let p = [
      npos.x + Math.cos( angle ) * l,
      npos.y + Math.sin( angle ) * l
    ];

    return r.nodeShapes[ this.getNodeShape( node ) ].intersectLine(
      npos.x, npos.y,
      w, h,
      p[0], p[1],
      0
    );
  }
};

BRp.findEndpoints = function( edge ){
  let r = this;
  let intersect;

  let source = edge.source()[0];
  let target = edge.target()[0];

  let srcPos = source.position();
  let tgtPos = target.position();

  let tgtArShape = edge.pstyle( 'target-arrow-shape' ).value;
  let srcArShape = edge.pstyle( 'source-arrow-shape' ).value;

  let tgtDist = edge.pstyle( 'target-distance-from-node' ).pfValue;
  let srcDist = edge.pstyle( 'source-distance-from-node' ).pfValue;

  let rs = edge._private.rscratch;

  let et = rs.edgeType;
  let self = et === 'self' || et === 'compound';
  let bezier = et === 'bezier' || et === 'multibezier' || self;
  let multi = et !== 'bezier';
  let lines = et === 'straight' || et === 'segments';
  let segments = et === 'segments';
  let hasEndpts = bezier || multi || lines;
  let srcManEndpt = edge.pstyle('source-endpoint');
  let srcManEndptVal = self ? 'outside-to-node' : srcManEndpt.value;
  let tgtManEndpt = edge.pstyle('target-endpoint');
  let tgtManEndptVal = self ? 'outside-to-node' : tgtManEndpt.value;

  rs.srcManEndpt = srcManEndpt;
  rs.tgtManEndpt = tgtManEndpt;

  let p1; // last known point of edge on target side
  let p2; // last known point of edge on source side

  let p1_i; // point to intersect with target shape
  let p2_i; // point to intersect with source shape

  if( bezier ){
    let cpStart = [ rs.ctrlpts[0], rs.ctrlpts[1] ];
    let cpEnd = multi ? [ rs.ctrlpts[ rs.ctrlpts.length - 2], rs.ctrlpts[ rs.ctrlpts.length - 1] ] : cpStart;

    p1 = cpEnd;
    p2 = cpStart;
  } else if( lines ){
    let srcArrowFromPt = !segments ? [ tgtPos.x, tgtPos.y ] : rs.segpts.slice( 0, 2 );
    let tgtArrowFromPt = !segments ? [ srcPos.x, srcPos.y ] : rs.segpts.slice( rs.segpts.length - 2 );

    p1 = tgtArrowFromPt;
    p2 = srcArrowFromPt;
  }

  if( tgtManEndptVal === 'inside-to-node' ){
    intersect = [ tgtPos.x, tgtPos.y ];
  } else if( tgtManEndpt.units ){
    intersect = this.manualEndptToPx( target, tgtManEndpt );
  } else if( tgtManEndptVal === 'outside-to-line' ){
    intersect = rs.tgtIntn; // use cached value from ctrlpt calc
  } else {
    if( tgtManEndptVal === 'outside-to-node' ){
      p1_i = p1;
    } else if( tgtManEndptVal === 'outside-to-line' ){
      p1_i = [ srcPos.x, srcPos.y ];
    }

    intersect = r.nodeShapes[ this.getNodeShape( target ) ].intersectLine(
      tgtPos.x,
      tgtPos.y,
      target.outerWidth(),
      target.outerHeight(),
      p1_i[0],
      p1_i[1],
      0
    );
  }

  let arrowEnd = math.shortenIntersection(
    intersect,
    p1,
    r.arrowShapes[ tgtArShape ].spacing( edge ) + tgtDist
  );
  let edgeEnd = math.shortenIntersection(
    intersect,
    p1,
    r.arrowShapes[ tgtArShape ].gap( edge ) + tgtDist
  );

  rs.endX = edgeEnd[0];
  rs.endY = edgeEnd[1];

  rs.arrowEndX = arrowEnd[0];
  rs.arrowEndY = arrowEnd[1];

  if( srcManEndptVal === 'inside-to-node' ){
    intersect = [ srcPos.x, srcPos.y ];
  } else if( srcManEndpt.units ){
    intersect = this.manualEndptToPx( source, srcManEndpt );
  } else if( srcManEndptVal === 'outside-to-line' ){
    intersect = rs.srcIntn; // use cached value from ctrlpt calc
  } else {
    if( srcManEndptVal === 'outside-to-node' ){
      p2_i = p2;
    } else if( srcManEndptVal === 'outside-to-line' ){
      p2_i = [ tgtPos.x, tgtPos.y ];
    }

    intersect = r.nodeShapes[ this.getNodeShape( source ) ].intersectLine(
      srcPos.x,
      srcPos.y,
      source.outerWidth(),
      source.outerHeight(),
      p2_i[0],
      p2_i[1],
      0
    );
  }

  let arrowStart = math.shortenIntersection(
    intersect,
    p2,
    r.arrowShapes[ srcArShape ].spacing( edge ) + srcDist
  );
  let edgeStart = math.shortenIntersection(
    intersect,
    p2,
    r.arrowShapes[ srcArShape ].gap( edge ) + srcDist
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

BRp.getSourceEndpoint = function( edge ){
  let rs = edge[0]._private.rscratch;

  switch( rs.edgeType ){
    case 'haystack':
      return {
        x: rs.haystackPts[0],
        y: rs.haystackPts[1]
      };
    default:
      return {
        x: rs.arrowStartX,
        y: rs.arrowStartY
      };
  }
};

BRp.getTargetEndpoint = function( edge ){
  let rs = edge[0]._private.rscratch;

  switch( rs.edgeType ){
    case 'haystack':
      return {
        x: rs.haystackPts[2],
        y: rs.haystackPts[3]
      };
    default:
      return {
        x: rs.arrowEndX,
        y: rs.arrowEndY
      };
  }
};

module.exports = BRp;

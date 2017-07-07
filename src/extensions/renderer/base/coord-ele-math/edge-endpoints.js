'use strict';

var math = require( '../../../../math' );
var is = require( '../../../../is' );

var BRp = {};

BRp.manualEndptToPx = function( node, prop ){
  var r = this;
  var npos = node.position();
  var w = node.outerWidth();
  var h = node.outerHeight();

  if( prop.value.length === 2 ){
    var p = [
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
    var angle = prop.pfValue[0];

    angle = -Math.PI / 2 + angle; // start at 12 o'clock

    var l = 2 * Math.max( w, h );

    var p = [
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
  var r = this;
  var intersect;

  var source = edge.source()[0];
  var target = edge.target()[0];

  var srcPos = source.position();
  var tgtPos = target.position();

  var tgtArShape = edge.pstyle( 'target-arrow-shape' ).value;
  var srcArShape = edge.pstyle( 'source-arrow-shape' ).value;

  var tgtDist = edge.pstyle( 'target-distance-from-node' ).pfValue;
  var srcDist = edge.pstyle( 'source-distance-from-node' ).pfValue;

  var rs = edge._private.rscratch;

  var et = rs.edgeType;
  var self = et === 'self' || et === 'compound';
  var bezier = et === 'bezier' || et === 'multibezier' || self;
  var multi = et !== 'bezier';
  var lines = et === 'straight' || et === 'segments';
  var segments = et === 'segments';
  var hasEndpts = bezier || multi || lines;
  var srcManEndpt = edge.pstyle('source-endpoint');
  var srcManEndptVal = self ? 'outside-to-node' : srcManEndpt.value;
  var tgtManEndpt = edge.pstyle('target-endpoint');
  var tgtManEndptVal = self ? 'outside-to-node' : tgtManEndpt.value;

  rs.srcManEndpt = srcManEndpt;
  rs.tgtManEndpt = tgtManEndpt;

  var p1; // last known point of edge on target side
  var p2; // last known point of edge on source side

  var p1_i; // point to intersect with target shape
  var p2_i; // point to intersect with source shape

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

  var arrowEnd = math.shortenIntersection(
    intersect,
    p1,
    r.arrowShapes[ tgtArShape ].spacing( edge ) + tgtDist
  );
  var edgeEnd = math.shortenIntersection(
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

  var arrowStart = math.shortenIntersection(
    intersect,
    p2,
    r.arrowShapes[ srcArShape ].spacing( edge ) + srcDist
  );
  var edgeStart = math.shortenIntersection(
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

module.exports = BRp;

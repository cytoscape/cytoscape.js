'use strict';

var util = require( '../../util' );
var math = require( '../../math' );
var is = require( '../../is' );

var defaults = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // the padding on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox and radius if not enough space
  radius: undefined, // the radius of the circle
  startAngle: 3 / 2 * Math.PI, // where nodes start in radians
  sweep: undefined, // how many radians should be between the first and last node (defaults to full circle)
  clockwise: true, // whether the layout should go clockwise (true) or counterclockwise/anticlockwise (false)
  sort: undefined, // a sorting function to order the nodes; e.g. function(a, b){ return a.data('weight') - b.data('weight') }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  ready: undefined, // callback on layoutready
  stop: undefined // callback on layoutstop
};

function CircleLayout( options ){
  this.options = util.extend( {}, defaults, options );
}

CircleLayout.prototype.run = function(){
  var params = this.options;
  var options = params;

  var cy = params.cy;
  var eles = options.eles;

  var clockwise = options.counterclockwise !== undefined ? !options.counterclockwise : options.clockwise;

  var nodes = eles.nodes().not( ':parent' );

  if( options.sort ){
    nodes = nodes.sort( options.sort );
  }

  var bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } );

  var center = {
    x: bb.x1 + bb.w / 2,
    y: bb.y1 + bb.h / 2
  };

  var sweep = options.sweep === undefined ? 2 * Math.PI - 2 * Math.PI / nodes.length : options.sweep;

  var dTheta = sweep / ( Math.max( 1, nodes.length - 1 ) );
  var r;

  var minDistance = 0;
  for( var i = 0; i < nodes.length; i++ ){
    var n = nodes[ i ];
    var nbb = n.boundingBox();
    var w = nbb.w;
    var h = nbb.h;

    minDistance = Math.max( minDistance, w, h );
  }

  if( is.number( options.radius ) ){
    r = options.radius;
  } else if( nodes.length <= 1 ){
    r = 0;
  } else {
    r = Math.min( bb.h, bb.w ) / 2 - minDistance;
  }

  // calculate the radius
  if( nodes.length > 1 && options.avoidOverlap ){ // but only if more than one node (can't overlap)
    minDistance *= 1.75; // just to have some nice spacing

    var dcos = Math.cos( dTheta ) - Math.cos( 0 );
    var dsin = Math.sin( dTheta ) - Math.sin( 0 );
    var rMin = Math.sqrt( minDistance * minDistance / ( dcos * dcos + dsin * dsin ) ); // s.t. no nodes overlapping
    r = Math.max( rMin, r );
  }

  var getPos = function( i, ele ){
    var theta = options.startAngle + i * dTheta * ( clockwise ? 1 : -1 );

    var rx = r * Math.cos( theta );
    var ry = r * Math.sin( theta );
    var pos = {
      x: center.x + rx,
      y: center.y + ry
    };

    return pos;
  };

  nodes.layoutPositions( this, options, getPos );

  return this; // chaining
};

module.exports = CircleLayout;

'use strict';

var util = require( '../../util' );
var math = require( '../../math' );

var defaults = {
  fit: true, // whether to fit to viewport
  padding: 30, // fit padding
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  ready: undefined, // callback on layoutready
  stop: undefined // callback on layoutstop
};

function RandomLayout( options ){
  this.options = util.extend( {}, defaults, options );
}

RandomLayout.prototype.run = function(){
  var options = this.options;
  var cy = options.cy;
  var eles = options.eles;
  var nodes = eles.nodes().not( ':parent' );

  var bb = math.makeBoundingBox( options.boundingBox ? options.boundingBox : {
    x1: 0, y1: 0, w: cy.width(), h: cy.height()
  } );

  var getPos = function( i, node ){
    return {
      x: bb.x1 + Math.round( Math.random() * bb.w ),
      y: bb.y1 + Math.round( Math.random() * bb.h )
    };
  };

  nodes.layoutPositions( this, options, getPos );

  return this; // chaining
};

module.exports = RandomLayout;

'use strict';

var util = require( '../../util' );
var is = require( '../../is' );

var defaults = {
  positions: undefined, // map of (node id) => (position obj); or function(node){ return somPos; }
  zoom: undefined, // the zoom level to set (prob want fit = false if set)
  pan: undefined, // the pan level to set (prob want fit = false if set)
  fit: true, // whether to fit to viewport
  padding: 30, // padding on fit
  animate: false, // whether to transition the node positions
  animationDuration: 500, // duration of animation in ms if enabled
  animationEasing: undefined, // easing of animation if enabled
  ready: undefined, // callback on layoutready
  stop: undefined // callback on layoutstop
};

function PresetLayout( options ){
  this.options = util.extend( {}, defaults, options );
}

PresetLayout.prototype.run = function(){
  var options = this.options;
  var eles = options.eles;

  var nodes = eles.nodes();
  var posIsFn = is.fn( options.positions );

  function getPosition( node ){
    if( options.positions == null ){
      return null;
    }

    if( posIsFn ){
      return options.positions.apply( node, [ node ] );
    }

    var pos = options.positions[ node._private.data.id ];

    if( pos == null ){
      return null;
    }

    return pos;
  }

  nodes.layoutPositions( this, options, function( i, node ){
    var position = getPosition( node );

    if( node.locked() || position == null ){
      return false;
    }

    return position;
  } );

  return this; // chaining
};

module.exports = PresetLayout;

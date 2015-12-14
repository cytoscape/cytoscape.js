'use strict';

var util = require( '../../util' );

// default layout options
var defaults = {
  ready: function(){}, // on layoutready
  stop: function(){} // on layoutstop
};

// constructor
// options : object containing layout options
function NullLayout( options ){
  this.options = util.extend( {}, defaults, options );
}

// runs the layout
NullLayout.prototype.run = function(){
  var options = this.options;
  var eles = options.eles; // elements to consider in the layout
  var layout = this;

  // cy is automatically populated for us in the constructor
  var cy = options.cy; // jshint ignore:line

  layout.trigger( 'layoutstart' );

  // puts all nodes at (0, 0)
  eles.nodes().positions( function(){
    return {
      x: 0,
      y: 0
    };
  } );

  // trigger layoutready when each node has had its position set at least once
  layout.one( 'layoutready', options.ready );
  layout.trigger( 'layoutready' );

  // trigger layoutstop when the layout stops (e.g. finishes)
  layout.one( 'layoutstop', options.stop );
  layout.trigger( 'layoutstop' );

  return this; // chaining
};

// called on continuous layouts to stop them before they finish
NullLayout.prototype.stop = function(){
  return this; // chaining
};

module.exports = NullLayout;

let util = require( '../../util' );

// default layout options
let defaults = {
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
  let options = this.options;
  let eles = options.eles; // elements to consider in the layout
  let layout = this;

  // cy is automatically populated for us in the constructor
  let cy = options.cy; // jshint ignore:line

  layout.emit( 'layoutstart' );

  // puts all nodes at (0, 0)
  eles.nodes().positions( function(){
    return {
      x: 0,
      y: 0
    };
  } );

  // trigger layoutready when each node has had its position set at least once
  layout.one( 'layoutready', options.ready );
  layout.emit( 'layoutready' );

  // trigger layoutstop when the layout stops (e.g. finishes)
  layout.one( 'layoutstop', options.stop );
  layout.emit( 'layoutstop' );

  return this; // chaining
};

// called on continuous layouts to stop them before they finish
NullLayout.prototype.stop = function(){
  return this; // chaining
};

module.exports = NullLayout;

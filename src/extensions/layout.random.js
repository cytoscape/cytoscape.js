;(function($$){ 'use strict';
  
  var defaults = {
    fit: true, // whether to fit to viewport
    padding: 30, // fit padding
    animate: true, // whether to transition the node positions
    animationDuration: 500, // duration of animation in ms if enabled
    ready: undefined, // callback on layoutready
    stop: undefined // callback on layoutstop
  };
  
  function RandomLayout( options ){
    this.options = $$.util.extend(true, {}, defaults, options);
  }
  
  RandomLayout.prototype.run = function(){
    var options = this.options;
    var cy = options.cy;
    var width = cy.width();
    var height = cy.width();
    var nodes = cy.nodes().not(':parent');
    
    var getPos = function( i, node ){
      return {
        x: Math.round( Math.random() * width ),
        y: Math.round( Math.random() * height )
      };
    };

    nodes.layoutPositions( this, options, getPos );

  };
  
  RandomLayout.prototype.stop = function(){
    // stop the layout if it were running continuously
  };

  // register the layout
  $$(
    'layout', // we're registering a layout
    'random', // the layout name
    RandomLayout // the layout prototype
  );
  
})(cytoscape);

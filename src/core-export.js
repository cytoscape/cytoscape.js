;(function($$){ 'use strict';
  
  $$.fn.core({
    
    png: function( options ){
      var cy = this;
      var renderer = this._private.renderer;
      options = options || {};

      return renderer.png( options );      
    }
    
  });
  
})( cytoscape );
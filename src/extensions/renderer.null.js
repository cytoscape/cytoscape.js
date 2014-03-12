;(function($$){ 'use strict';
    
  function NullRenderer(options){
  }
  
  NullRenderer.prototype.notify = function(params){
  };
  
  $$('renderer', 'null', NullRenderer);
  
})( cytoscape );

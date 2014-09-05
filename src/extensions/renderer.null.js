;(function($$){ 'use strict';
    
  function NullRenderer(options){
    this.options = options;
  }
  
  NullRenderer.prototype.recalculateRenderedStyle = function(){
  };

  NullRenderer.prototype.notify = function(){
    // the null renderer does nothing
  };
  
  $$('renderer', 'null', NullRenderer);
  
})( cytoscape );

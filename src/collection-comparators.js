;(function($$){ "use strict";

  $$.fn.eles({
    allAre: function(selector){
      return this.filter(selector).length === this.length;
    },

    is: function(selector){
      return this.filter(selector).length > 0;
    },

    same: function( collection ){
      collection = this.cy().collection( collection );

      // cheap extra check
      if( this.length !== collection.length ){
        return false;
      }

      return this.intersect( collection ).length === this.length;
    },

    anySame: function(collection){
      collection = this.cy().collection( collection );

      return this.intersect( collection ).length > 0;
    },

    allAreNeighbors: function(collection){
      collection = this.cy().collection( collection );

      return this.neighborhood().intersect( collection ).length === collection.length;
    }
  });
  
})( cytoscape );

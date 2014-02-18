(function($$){ "use strict";
  
  $$.fn.core({
    notify: function( params ){
      if( !this._private.notificationsEnabled ){ return; } // exit on disabled
      
      var renderer = this.renderer();
      var cy = this;
      
      // normalise params.collection 
      if( $$.is.element(params.collection) ){ // make collection from element
        var element = params.collection;
        params.collection = new $$.Collection(cy, [ element ]);  
      
      } else if( $$.is.array(params.collection) ){ // make collection from elements array
        var elements = params.collection;
        params.collection = new $$.Collection(cy, elements);  
      } 
      
      renderer.notify(params);
    },
    
    notifications: function( bool ){
      var p = this._private;
      
      if( bool === undefined ){
        return p.notificationsEnabled;
      } else {
        p.notificationsEnabled = bool ? true : false;
      }
    },
    
    noNotifications: function( callback ){
      this.notifications(false);
      callback();
      this.notifications(true);
    }
  });
  
})( cytoscape );

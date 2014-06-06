(function($$){ 'use strict';
  
  $$.fn.core({
    notify: function( params ){
      if( this._private.batchingNotify ){
        var bEles = this._private.batchNotifyEles;
        var bTypes = this._private.batchNotifyTypes;

        if( params.collection ){ for( var i = 0; i < params.collection.length; i++ ){
          var ele = params.collection[i];

          if( !bEles.ids[ ele._private.id ] ){
            bEles.push( ele );
          }
        } }

        if( !bTypes.ids[ params.type ] ){
          bTypes.push( params.type );
        }

        return; // notifications are disabled during batching
      }

      if( !this._private.notificationsEnabled ){ return; } // exit on disabled

      var renderer = this.renderer();
      var cy = this;
      
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
    },

    batch: function( callback ){
      var _p = this._private;

      _p.batchingStyle = _p.batchingNotify = true;
      _p.batchStyleEles = [];
      _p.batchNotifyEles = [];
      _p.batchNotifyTypes = [];

      _p.batchStyleEles.ids = {};
      _p.batchNotifyEles.ids = {};
      _p.batchNotifyTypes.ids = {};

      callback();

      // update style for dirty eles
      _p.batchingStyle = false;
      new $$.Collection(this, _p.batchStyleEles).updateStyle();

      // notify the renderer of queued eles and event types
      _p.batchingNotify = false;
      this.notify({
        type: _p.batchNotifyTypes,
        collection: _p.batchNotifyEles
      });
    }
  });
  
})( cytoscape );

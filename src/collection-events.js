;(function($$){ "use strict";
  
  // Functions for binding & triggering events
  ////////////////////////////////////////////////////////////////////////////////////////////////////
  
  $$.fn.eles({
    on: $$.define.on(), // .on( events [, selector] [, data], handler)
    one: $$.define.on({ unbindSelfOnTrigger: true }),
    once: $$.define.on({ unbindAllBindersOnTrigger: true }),
    off: $$.define.off(), // .off( events [, selector] [, handler] )
    trigger: $$.define.trigger(), // .trigger( events [, extraParams] )

    rtrigger: function(event, extraParams){ // for internal use only
      if( this.length === 0 ){ return; } // empty collections don't need to notify anything

      // notify renderer unless removed
      this.cy().notify({
        type: event,
        collection: this.filter(function(){
          return !this.removed();
        })
      });
      
      this.trigger(event, extraParams);
      return this;
    }
  });

  // aliases for those folks who like old stuff:
  $$.elesfn.bind = $$.elesfn.on;
  $$.elesfn.unbind = $$.elesfn.off;
  
})( cytoscape );

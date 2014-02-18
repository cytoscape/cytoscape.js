;(function($$){ "use strict";
  
  $$.fn.core({
    
    renderTo: function( context, zoom, pan ){
      var r = this._private.renderer;

      r.renderTo( context, zoom, pan );
      return this;
    },

    renderer: function(){
      return this._private.renderer;
    },

    forceRender: function(){
      this.notify({
        type: "draw"
      });

      return this;
    },
    
    initRenderer: function( options ){
      var cy = this;

      var rendererProto = $$.extension("renderer", options.name);
      if( rendererProto == null ){
        $$.util.error("Can not initialise: No such renderer `%s` found; did you include its JS file?", options.name);
        return;
      }
      
      this._private.renderer = new rendererProto(
        $$.util.extend({}, options, {
          cy: cy,
          style: cy._private.style
        })
      );
      
      
    },

    recalculateRenderedStyle: function(){
      var renderer = this.renderer();

      if( renderer.recalculateRenderedStyle ){
        renderer.recalculateRenderedStyle();
      }
    }
    
  });  
  
})( cytoscape );
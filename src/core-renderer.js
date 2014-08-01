;(function($$){ 'use strict';
  
  $$.fn.core({
    
    renderTo: function( context, zoom, pan, pxRatio ){
      var r = this._private.renderer;

      r.renderTo( context, zoom, pan, pxRatio );
      return this;
    },

    renderer: function(){
      return this._private.renderer;
    },

    forceRender: function(){
      this.notify({
        type: 'draw'
      });

      return this;
    },

    resize: function(){
      this._private.layout().resize();

      this.notify({
        type: 'resize'
      });

      this.trigger('resize');

      return this;
    },
    
    initRenderer: function( options ){
      var cy = this;

      var RendererProto = $$.extension('renderer', options.name);
      if( RendererProto == null ){
        $$.util.error('Can not initialise: No such renderer `%s` found; did you include its JS file?', options.name);
        return;
      }
      
      this._private.renderer = new RendererProto(
        $$.util.extend({}, options, {
          cy: cy,
          style: cy._private.style
        })
      );
       
    },

    // ask renderer to recalc rendered styles for eles
    recalculateRenderedStyle: function( eles ){
      var renderer = this.renderer();

      if( !eles ){
        eles = this.elements();
      }

      if( renderer.recalculateRenderedStyle ){
        renderer.recalculateRenderedStyle( eles );
      }
    }
    
  });  
  
})( cytoscape );
;(function($$){ 'use strict';
  
  $$.fn.core({
    
    style: function( newStyle ){
      if( newStyle ){
        var s = this.setStyle( newStyle );

        s.update();
      }

      return this._private.style;
    },

    setStyle: function( style ){
      var _p = this._private;

      if( $$.is.stylesheet(style) ){
        _p.style = style.generateStyle(this);
      
      } else if( $$.is.array(style) ) {
        _p.style = $$.style.fromJson(this, style);
      
      } else if( $$.is.string(style) ){
        _p.style = $$.style.fromString(this, style);
      
      } else {
        _p.style = new $$.Style( this );
      }

      return _p.style;
    }
  });
  
})( cytoscape );


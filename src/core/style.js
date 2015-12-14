'use strict';

var is = require( '../is' );
var Style = require( '../style' );

var corefn = ({

  style: function( newStyle ){
    if( newStyle ){
      var s = this.setStyle( newStyle );

      s.update();
    }

    return this._private.style;
  },

  setStyle: function( style ){
    var _p = this._private;

    if( is.stylesheet( style ) ){
      _p.style = style.generateStyle( this );

    } else if( is.array( style ) ){
      _p.style = Style.fromJson( this, style );

    } else if( is.string( style ) ){
      _p.style = Style.fromString( this, style );

    } else {
      _p.style = Style( this );
    }

    return _p.style;
  }
});

module.exports = corefn;

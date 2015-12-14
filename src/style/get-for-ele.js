'use strict';

var util = require( '../util' );
var is = require( '../is' );

var styfn = {};

// gets the rendered style for an element
styfn.getRenderedStyle = function( ele ){
  return this.getRawStyle( ele, true );
};

// gets the raw style for an element
styfn.getRawStyle = function( ele, isRenderedVal ){
  var self = this;
  var ele = ele[0]; // insure it's an element

  if( ele ){
    var rstyle = {};

    for( var i = 0; i < self.properties.length; i++ ){
      var prop = self.properties[ i ];
      var val = self.getStylePropertyValue( ele, prop.name, isRenderedVal );

      if( val ){
        rstyle[ prop.name ] = val;
        rstyle[ util.dash2camel( prop.name ) ] = val;
      }
    }

    return rstyle;
  }
};

styfn.getStylePropertyValue = function( ele, propName, isRenderedVal ){
  var self = this;
  var ele = ele[0]; // insure it's an element

  if( ele ){
    var style = ele._private.style;
    var prop = self.properties[ propName ];
    var type = prop.type;
    var styleProp = style[ prop.name ];
    var zoom = ele.cy().zoom();

    if( styleProp ){
      var units = styleProp.units ? type.implicitUnits || 'px' : null;
      var val = units ? [].concat( styleProp.pfValue ).map( function( pfValue ){
        return ( pfValue * (isRenderedVal ? zoom : 1) ) + units;
      } ).join( ' ' ) : styleProp.strValue;

      return val;
    }
  }
};

// gets the value style for an element (useful for things like animations)
styfn.getValueStyle = function( ele ){
  var self = this;
  var rstyle = {};
  var style;
  var isEle = is.element( ele );

  if( isEle ){
    style = ele._private.style;
  } else {
    style = ele; // just passed the style itself
  }

  if( style ){
    for( var i = 0; i < self.properties.length; i++ ){
      var prop = self.properties[ i ];
      var styleProp = style[ prop.name ] || style[ util.dash2camel( prop.name ) ];

      if( styleProp !== undefined ){ // then make a prop of it
        if( is.plainObject( styleProp ) ){
          styleProp = this.parse( prop.name, styleProp.strValue );
        } else {
          styleProp = this.parse( prop.name, styleProp );
        }
      }

      if( styleProp ){
        rstyle[ prop.name ] = styleProp;
        rstyle[ util.dash2camel( prop.name ) ] = styleProp;
      }
    }
  }

  return rstyle;
};

styfn.getPropsList = function( propsObj ){
  var self = this;
  var rstyle = [];
  var style = propsObj;
  var props = self.properties;

  if( style ){
    for( var name in style ){
      var val = style[ name ];
      var prop = props[ name ] || props[ util.camel2dash( name ) ];
      var styleProp = this.parse( prop.name, val );

      rstyle.push( styleProp );
    }
  }

  return rstyle;
};

module.exports = styfn;

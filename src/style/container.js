'use strict';

var window = require('../window');

var styfn = {};

// gets what an em size corresponds to in pixels relative to a dom element
styfn.getEmSizeInPixels = function(){
  var cy = this._private.cy;
  var domElement = cy.container();

  if( window && domElement && window.getComputedStyle ){
    var pxAsStr = window.getComputedStyle(domElement).getPropertyValue('font-size');
    var px = parseFloat( pxAsStr );
    return px;
  } else {
    return 1; // in case we're running outside of the browser
  }
};

// gets css property from the core container
styfn.containerCss = function( propName ){
  var cy = this._private.cy;
  var domElement = cy.container();

  if( window && domElement && window.getComputedStyle ){
    return window.getComputedStyle(domElement).getPropertyValue( propName );
  }
};

styfn.containerProperty = function( propName ){
  var propStr = this.containerCss( propName );
  var prop = this.parse( propName, propStr );
  return prop;
};

styfn.containerPropertyAsString = function( propName ){
  var prop = this.containerProperty( propName );

  if( prop ){
    return prop.strValue;
  }
};

module.exports = styfn;

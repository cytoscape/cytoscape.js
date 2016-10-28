'use strict';

var window = require( '../window' );

var styfn = {};

// gets what an em size corresponds to in pixels relative to a dom element
styfn.getEmSizeInPixels = function(){
  var px = this.containerCss( 'font-size' );

  if( px != null ){
    return parseFloat( px );
  } else {
    return 1; // for headless
  }
};

// gets css property from the core container
styfn.containerCss = function( propName ){
  var cy = this._private.cy;
  var domElement = cy.container();

  if( window && domElement && window.getComputedStyle ){
    return window.getComputedStyle( domElement ).getPropertyValue( propName );
  }
};

module.exports = styfn;

'use strict';

var is = require( '../is' );
var util = require( '../util' );
var Selector = require( '../selector' );

var Style = function( cy ){

  if( !(this instanceof Style) ){
    return new Style( cy );
  }

  if( !is.core( cy ) ){
    util.error( 'A style must have a core reference' );
    return;
  }

  this._private = {
    cy: cy,
    coreStyle: {}
  };

  this.length = 0;

  this.resetToDefault();
};

var styfn = Style.prototype;

styfn.instanceString = function(){
  return 'style';
};

// remove all contexts
styfn.clear = function(){
  for( var i = 0; i < this.length; i++ ){
    this[ i ] = undefined;
  }
  this.length = 0;

  var _p = this._private;

  _p.newStyle = true;

  return this; // chaining
};

styfn.resetToDefault = function(){
  this.clear();
  this.addDefaultStylesheet();

  return this;
};

// builds a style object for the 'core' selector
styfn.core = function(){
  return this._private.coreStyle;
};

// create a new context from the specified selector string and switch to that context
styfn.selector = function( selectorStr ){
  // 'core' is a special case and does not need a selector
  var selector = selectorStr === 'core' ? null : new Selector( selectorStr );

  var i = this.length++; // new context means new index
  this[ i ] = {
    selector: selector,
    properties: [],
    mappedProperties: [],
    index: i
  };

  return this; // chaining
};

// add one or many css rules to the current context
styfn.css = function(){
  var self = this;
  var args = arguments;

  switch( args.length ){
  case 1:
    var map = args[0];

    for( var i = 0; i < self.properties.length; i++ ){
      var prop = self.properties[ i ];
      var mapVal = map[ prop.name ];

      if( mapVal === undefined ){
        mapVal = map[ util.dash2camel( prop.name ) ];
      }

      if( mapVal !== undefined ){
        this.cssRule( prop.name, mapVal );
      }
    }

    break;

  case 2:
    this.cssRule( args[0], args[1] );
    break;

  default:
    break; // do nothing if args are invalid
  }

  return this; // chaining
};
styfn.style = styfn.css;

// add a single css rule to the current context
styfn.cssRule = function( name, value ){
  // name-value pair
  var property = this.parse( name, value );

  // add property to current context if valid
  if( property ){
    var i = this.length - 1;
    this[ i ].properties.push( property );
    this[ i ].properties[ property.name ] = property; // allow access by name as well

    if( property.name.match( /pie-(\d+)-background-size/ ) && property.value ){
      this._private.hasPie = true;
    }

    if( property.mapped ){
      this[ i ].mappedProperties.push( property );
    }

    // add to core style if necessary
    var currentSelectorIsCore = !this[ i ].selector;
    if( currentSelectorIsCore ){
      this._private.coreStyle[ property.name ] = property;
    }
  }

  return this; // chaining
};

// static function
Style.fromJson = function( cy, json ){
  var style = new Style( cy );

  style.fromJson( json );

  return style;
};

Style.fromString = function( cy, string ){
  return new Style( cy ).fromString( string );
};

[
  require( './apply' ),
  require( './bypass' ),
  require( './container' ),
  require( './get-for-ele' ),
  require( './json' ),
  require( './string-sheet' ),
  require( './properties' ),
  require( './parse' )
].forEach( function( props ){
  util.extend( styfn, props );
} );


Style.types = styfn.types;
Style.properties = styfn.properties;

module.exports = Style;

'use strict';

var is = require( './is' );
var util = require( './util' );
var Style = require( './style' );

// a dummy stylesheet object that doesn't need a reference to the core
// (useful for init)
var Stylesheet = function(){
  if( !(this instanceof Stylesheet) ){
    return new Stylesheet();
  }

  this.length = 0;
};

var sheetfn = Stylesheet.prototype;

sheetfn.instanceString = function(){
  return 'stylesheet';
};

// just store the selector to be parsed later
sheetfn.selector = function( selector ){
  var i = this.length++;

  this[ i ] = {
    selector: selector,
    properties: []
  };

  return this; // chaining
};

// just store the property to be parsed later
sheetfn.css = function( name, value ){
  var i = this.length - 1;

  if( is.string( name ) ){
    this[ i ].properties.push( {
      name: name,
      value: value
    } );
  } else if( is.plainObject( name ) ){
    var map = name;

    for( var j = 0; j < Style.properties.length; j++ ){
      var prop = Style.properties[ j ];
      var mapVal = map[ prop.name ];

      if( mapVal === undefined ){ // also try camel case name
        mapVal = map[ util.dash2camel( prop.name ) ];
      }

      if( mapVal !== undefined ){
        var name = prop.name;
        var value = mapVal;

        this[ i ].properties.push( {
          name: name,
          value: value
        } );
      }
    }
  }

  return this; // chaining
};

sheetfn.style = sheetfn.css;

// generate a real style object from the dummy stylesheet
sheetfn.generateStyle = function( cy ){
  var style = new Style( cy );

  for( var i = 0; i < this.length; i++ ){
    var context = this[ i ];
    var selector = context.selector;
    var props = context.properties;

    style.selector( selector ); // apply selector

    for( var j = 0; j < props.length; j++ ){
      var prop = props[ j ];

      style.css( prop.name, prop.value ); // apply property
    }
  }

  return style;
};

module.exports = Stylesheet;

'use strict';

require('./-preamble');

var window = require( './window' );
var is = require( './is' );
var Core = require( './core' );
var extension = require( './extension' );
var registerJquery = require( './jquery-plugin' );
var Stylesheet = require( './stylesheet' );
var Thread = require( './thread' );
var Fabric = require( './fabric' );

var cytoscape = function( options ){ // jshint ignore:line
  // if no options specified, use default
  if( options === undefined ){
    options = {};
  }

  // create instance
  if( is.plainObject( options ) ){
    return new Core( options );
  }

  // allow for registration of extensions
  else if( is.string( options ) ){
    return extension.apply( extension, arguments );
  }
};

// replaced by build system
cytoscape.version = require('./version.json');

// try to register w/ jquery
if( window && window.jQuery ){
  registerJquery( window.jQuery, cytoscape );
}

// expose register api
cytoscape.registerJquery = function( jQuery ){
  registerJquery( jQuery, cytoscape );
};

// expose public apis (mostly for extensions)
cytoscape.stylesheet = cytoscape.Stylesheet = Stylesheet;
cytoscape.thread = cytoscape.Thread = Thread;
cytoscape.fabric = cytoscape.Fabric = Fabric;

module.exports = cytoscape;

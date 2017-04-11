'use strict';

require('./-preamble');

var window = require( './window' );
var is = require( './is' );
var Core = require( './core' );
var extension = require( './extension' );
var Stylesheet = require( './stylesheet' );

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

// e.g. cytoscape.use( require('cytoscape-foo'), bar )
cytoscape.use = function( ext ){
  var args = Array.prototype.slice.call( arguments, 1 ); // args to pass to ext

  args.unshift( cytoscape ); // cytoscape is first arg to ext

  ext.apply( null, args );
};

// replaced by build system
cytoscape.version = require('./version');

// expose public apis (mostly for extensions)
cytoscape.stylesheet = cytoscape.Stylesheet = Stylesheet;

module.exports = cytoscape;

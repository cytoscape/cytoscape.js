'use strict';

var window = require('./window');
var is = require('./is');
var util = require('./util');
var Core = require('./core');
var extension = require('./extension');
var registerJquery = require('./jquery-plugin');
var Stylesheet = require('./stylesheet');
var Thread = require('./thread');
var Fabric = require('./fabric');

// the object iteself is a function that init's an instance of cytoscape

var cytoscape = function(){ // jshint ignore:line
  return cytoscape.init.apply(cytoscape, arguments);
};

// replaced by build system
cytoscape.version = '{{VERSION}}';

// allow functional access to cytoscape.js
// e.g. var cyto = $.cytoscape({ selector: "#foo", ... });
//      var nodes = cyto.nodes();
cytoscape.init = function( options ){

  // if no options specified, use default
  if( options === undefined ){
    options = {};
  }

  // create instance
  if( is.plainObject( options ) ){
    return new Core( options );
  }

  // allow for registration of extensions
  // e.g. $.cytoscape('renderer', 'svg', SvgRenderer);
  // e.g. $.cytoscape('renderer', 'svg', 'nodeshape', 'ellipse', SvgEllipseNodeShape);
  // e.g. $.cytoscape('core', 'doSomething', function(){ /* doSomething code */ });
  // e.g. $.cytoscape('collection', 'doSomething', function(){ /* doSomething code */ });
  else if( is.string( options ) ) {
    return extension.apply(extension, arguments);
  }
};

// make sure we always register in the window just in case (e.g. w/ derbyjs)
if( window ){
  window.cytoscape = cytoscape;
}

// TODO this isn't same w/cjs
// extra set to `this` is necessary for meteor
this.cytoscape = cytoscape;

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
cytoscape.is = is;
cytoscape.util = util;

module.exports = cytoscape;

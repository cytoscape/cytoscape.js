// this is put as a global var in the browser
// or it's just a global to this module if commonjs

var cytoscape;

(function(window){ 'use strict';

  // the object iteself is a function that init's an instance of cytoscape

  var $$ = cytoscape = function(){ // jshint ignore:line
    return cytoscape.init.apply(cytoscape, arguments);
  };

  $$.version = '{{VERSION}}';
  
  // allow functional access to cytoscape.js
  // e.g. var cyto = $.cytoscape({ selector: "#foo", ... });
  //      var nodes = cyto.nodes();
  $$.init = function( options ){
    
    // if no options specified, use default
    if( options === undefined ){
      options = {};
    }

    // create instance
    if( $$.is.plainObject( options ) ){
      return new $$.Core( options );
    } 
    
    // allow for registration of extensions
    // e.g. $.cytoscape('renderer', 'svg', SvgRenderer);
    // e.g. $.cytoscape('renderer', 'svg', 'nodeshape', 'ellipse', SvgEllipseNodeShape);
    // e.g. $.cytoscape('core', 'doSomething', function(){ /* doSomething code */ });
    // e.g. $.cytoscape('collection', 'doSomething', function(){ /* doSomething code */ });
    else if( $$.is.string( options ) ) {
      return $$.extension.apply($$.extension, arguments);
    }
  };

  // define the function namespace here, since it has members in many places
  $$.fn = {};

  if( typeof module !== 'undefined' && module.exports ){ // expose as a commonjs module
    module.exports = cytoscape;
  }

  if( typeof define !== 'undefined' && define.amd ){ // expose as an amd/requirejs module
    define('cytoscape', function(){
      return cytoscape;
    });
  }

  // make sure we always register in the window just in case (e.g. w/ derbyjs)
  if( window ){
    window.cytoscape = cytoscape;
  }
  
})( typeof window === 'undefined' ? null : window );

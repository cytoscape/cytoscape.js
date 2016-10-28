'use strict';

var is = require( './is' );

var cyReg = function( $ele ){
  var d = $ele[0]._cyreg = $ele[0]._cyreg || {};

  return d;
};

var registerJquery = function( $, cytoscape ){
  if( !$ ){ return; } // no jquery => don't need this

  if( $.fn.cytoscape ){ return; } // already registered

  // allow calls on a jQuery selector by proxying calls to $.cytoscape
  // e.g. $("#foo").cytoscape(options) => $.cytoscape(options) on #foo
  $.fn.cytoscape = function( opts ){
    var $this = $( this );

    // get object
    if( opts === 'get' ){
      return cyReg( $this ).cy;
    }

    // bind to ready
    else if( is.fn( opts ) ){

      var ready = opts;
      var cy = cyReg( $this ).cy;

      if( cy && cy.isReady() ){ // already ready so just trigger now
        cy.trigger( 'ready', [], ready );

      } else { // not yet ready, so add to readies list
        var data = cyReg( $this );
        var readies = data.readies = data.readies || [];

        readies.push( ready );
      }

    }

    // proxy to create instance
    else if( is.plainObject( opts ) ){
      return $this.each( function(){
        var options = $.extend( {}, opts, {
          container: $( this )[0]
        } );

        cytoscape( options );
      } );
    }
  };

  // allow access to the global cytoscape object under jquery for legacy reasons
  $.cytoscape = cytoscape;

  // use short alias (cy) if not already defined
  if( $.fn.cy == null && $.cy == null ){
    $.fn.cy = $.fn.cytoscape;
    $.cy = $.cytoscape;
  }
};

module.exports = registerJquery;

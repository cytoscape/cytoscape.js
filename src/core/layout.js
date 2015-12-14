'use strict';

var util = require( '../util' );
var is = require( '../is' );

var corefn = ({

  layout: function( params ){
    var layout = this._private.prevLayout = ( params == null ? this._private.prevLayout : this.makeLayout( params ) );

    layout.run();

    return this; // chaining
  },

  makeLayout: function( options ){
    var cy = this;

    if( options == null ){
      util.error( 'Layout options must be specified to make a layout' );
      return;
    }

    if( options.name == null ){
      util.error( 'A `name` must be specified to make a layout' );
      return;
    }

    var name = options.name;
    var Layout = cy.extension( 'layout', name );

    if( Layout == null ){
      util.error( 'Can not apply layout: No such layout `' + name + '` found; did you include its JS file?' );
      return;
    }

    var eles;
    if( is.string( options.eles ) ){
      eles = cy.$( options.eles );
    } else {
      eles = options.eles != null ? options.eles : cy.$();
    }

    var layout = new Layout( util.extend( {}, options, {
      cy: cy,
      eles: eles
    } ) );

    return layout;
  }

});

corefn.createLayout = corefn.makeLayout;

module.exports = corefn;

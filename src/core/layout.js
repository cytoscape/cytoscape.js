let util = require( '../util' );
let is = require( '../is' );

let corefn = ({

  layout: function( options ){
    let cy = this;

    if( options == null ){
      util.error( 'Layout options must be specified to make a layout' );
      return;
    }

    if( options.name == null ){
      util.error( 'A `name` must be specified to make a layout' );
      return;
    }

    let name = options.name;
    let Layout = cy.extension( 'layout', name );

    if( Layout == null ){
      util.error( 'Can not apply layout: No such layout `' + name + '` found; did you include its JS file?' );
      return;
    }

    let eles;
    if( is.string( options.eles ) ){
      eles = cy.$( options.eles );
    } else {
      eles = options.eles != null ? options.eles : cy.$();
    }

    let layout = new Layout( util.extend( {}, options, {
      cy: cy,
      eles: eles
    } ) );

    return layout;
  }

});

corefn.createLayout = corefn.makeLayout = corefn.layout;

module.exports = corefn;

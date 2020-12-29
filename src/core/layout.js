import * as util from '../util';
import * as is from '../is';

let corefn = ({

    /**
   * @typedef {object} cy_layout
   * @property {object} options - The layout options.
   */


    /**
   * Get a new layout, which can be used to algorithmically position the nodes in the graph
   * @memberof cy
   * @path Core/Layout
   * @pureAliases cy.createLayout|cy.makeLayout
   * @param {...cy_layout} options - Get layouts
   * @methodName cy.layout
   */
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
      util.error( 'No such layout `' + name + '` found.  Did you forget to import it and `cytoscape.use()` it?' );
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

export default corefn;

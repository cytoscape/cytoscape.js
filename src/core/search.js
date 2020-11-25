import * as is from '../is';
import Collection from '../collection';

let corefn = ({

  // get a collection
  // - empty collection on no args
  // - collection of elements in the graph on selector arg
  // - guarantee a returned collection when elements or collection specified

    /**
 * Return a new, empty collection.
 * @memberof cy
 * @path Core/Graph manipulation
 * @param_desc Get an empty collection.
 * @namespace cy.collection
 */
  collection: function( eles, opts ){

    if( is.string( eles ) ){
      return this.$( eles );

    } else if( is.elementOrCollection( eles ) ){
      return eles.collection();

    } else if( is.array( eles ) ){
      return new Collection( this, eles, opts );
    }

    return new Collection( this );
  },

  nodes: function( selector ){
    let nodes = this.$( function( ele ){
      return ele.isNode();
    } );

    if( selector ){
      return nodes.filter( selector );
    }

    return nodes;
  },

  edges: function( selector ){
    let edges = this.$( function( ele ){
      return ele.isEdge();
    } );

    if( selector ){
      return edges.filter( selector );
    }

    return edges;
  },

  // search the graph like jQuery

  /**
 * @callback filter_callback
 * @property {filter_callback_type} function(ele,i,eles) - filter_callback_type
 */

/**
 * function(ele, i, eles)
 * @typedef {object} filter_callback_type
 * @property {object} ele - The current element under consideration for filtering.
 * @property {object} i - The counter used for iteration over the elements in the graph.
 * @property {object} eles - The collection of elements being filtered
 */

/**
 * @typedef {object} cy_$
 * @property {object} selector - The selector the elements should match.
 * @property {object} selector - The selector the elements should match.
 * @property {object} selector - The selector the nodes should match.
 * @property {object} selector - The selector the edges should match.
 * @property {object} selector - The selector the elements should match.
 * @property {function(filter_callback):any} filter_callback - The filter function that returns true for elements that should be returned.
 */

  /**
 * Get elements in the graph matching a selector or a filter function.
 * @memberof cy
 * @path Core/Graph manipulation
 * @sub_functions cy.$|cy.elements|cy.nodes|cy.edges|cy.filter|cy.filter
 * @param {...cy_$} selector - Get elements in the graph matching the specified selector. | Get elements in the graph matching the specified selector. | Get nodes in the graph matching the specified selector. | Get edges in the graph matching the specified selector. | Get elements in the graph matching the specified selector. | Get elements in the graph matching the specified filter function.
 * @namespace cy.$
 */
  $: function( selector ){
    let eles = this._private.elements;

    if( selector ){
      return eles.filter( selector );
    } else {
      return eles.spawnSelf();
    }
  },

  mutableElements: function(){
    return this._private.elements;
  }

});

// aliases
corefn.elements = corefn.filter = corefn.$;

export default corefn;

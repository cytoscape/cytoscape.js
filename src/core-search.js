;(function($$){ 'use strict';

  $$.fn.core({

    // get a collection
    // - empty collection on no args
    // - collection of elements in the graph on selector arg
    // - guarantee a returned collection when elements or collection specified
    collection: function( eles ){

      if( $$.is.string( eles ) ){
        return this.$( eles );

      } else if( $$.is.elementOrCollection( eles ) ){
        return eles.collection();

      } else if( $$.is.array( eles ) ){
        return new $$.Collection( this, eles );
      }

      return new $$.Collection( this );
    },

    nodes: function( selector ){
      var nodes = this.$(function(){
        return this.isNode();
      });

      if( selector ){
        return nodes.filter( selector );
      }

      return nodes;
    },

    edges: function( selector ){
      var edges = this.$(function(){
        return this.isEdge();
      });

      if( selector ){
        return edges.filter( selector );
      }

      return edges;
    },

    // search the graph like jQuery
    $: function( selector ){
      var eles = new $$.Collection( this, this._private.elements );

      if( selector ){
        return eles.filter( selector );
      }

      return eles;
    }

  });

  // aliases
  $$.corefn.elements = $$.corefn.filter = $$.corefn.$;

})( cytoscape );

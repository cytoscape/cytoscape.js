import * as is from '../is.mjs';
import Collection from '../collection/index.mjs';
import type { Core } from './core-types.mjs';
import type { Collection as Coll, Element, CoreAccess, NodeCollection, EdgeCollection } from '../collection/eles-types.mjs';
import type { FilterArg } from '../collection/filter.mjs';

/** Options accepted by `collection()` when building from an array. */
interface CollectionOpts {
  unique?: boolean;
  removed?: boolean;
}

let corefn = ({

  // get a collection
  // - empty collection on no args
  // - collection of elements in the graph on selector arg
  // - guarantee a returned collection when elements or collection specified
  collection: function( this: Core, eles?: string | Coll | Element | Element[], opts?: CollectionOpts ){

    if( is.string( eles ) ){
      return this.$( eles );

    } else if( is.elementOrCollection( eles ) ){
      return ( eles as unknown as Coll ).collection();

    } else if( is.array( eles ) ){
      if (!opts) {
        opts = {};
      }
      // the collection constructor accepts the structural CoreAccess view
      return new Collection( this as unknown as CoreAccess, eles, opts.unique, opts.removed );
    }

    return new Collection( this as unknown as CoreAccess );
  },

  nodes: function( this: Core, selector?: FilterArg ){
    let nodes = this.$( function( ele: Element ){
      return ele.isNode();
    } );

    if( selector ){
      return nodes.filter( selector );
    }

    return nodes;
  },

  edges: function( this: Core, selector?: FilterArg ){
    let edges = this.$( function( ele: Element ){
      return ele.isEdge();
    } );

    if( selector ){
      return edges.filter( selector );
    }

    return edges;
  },

  // search the graph like jQuery
  $: function( this: Core, selector?: FilterArg ){
    let eles = this._private.elements;

    if( selector ){
      return eles.filter( selector );
    } else {
      return eles.spawnSelf();
    }
  },

  mutableElements: function( this: Core ){
    return this._private.elements;
  }

}) as unknown as CoreSearch;

// aliases
corefn.elements = corefn.filter = corefn.$;

/** Graph search/collection helpers contributed to the core prototype. */
export interface CoreSearch {
  collection( this: Core, eles?: string | Coll | Element | Element[], opts?: CollectionOpts ): Coll;
  nodes( this: Core, selector?: FilterArg ): NodeCollection;
  edges( this: Core, selector?: FilterArg ): EdgeCollection;
  $( this: Core, selector?: FilterArg ): Coll;
  elements( this: Core, selector?: FilterArg ): Coll;
  filter( this: Core, selector?: FilterArg ): Coll;
  /** @internal */
  mutableElements( this: Core ): Coll;
}

export default corefn as CoreSearch;

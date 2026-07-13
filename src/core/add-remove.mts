import * as is from '../is.mjs';
import * as util from '../util/index.mjs';
import Collection from '../collection/index.mjs';
import Element from '../collection/element.mjs';
import type { Core } from './core-types.mjs';
import type { Collection as Coll, ElementDefinition, CoreAccess, SharedCollection } from '../collection/eles-types.mjs';

/** The shapes accepted by `add()`. */
type AddOpts =
  | SharedCollection
  | ElementDefinition
  | ElementDefinition[]
  | { nodes?: ElementDefinition[]; edges?: ElementDefinition[] };

let corefn = {
  add: function( this: Core, opts: AddOpts ){

    let elements: Coll;
    // the collection/element constructors accept the structural CoreAccess view
    let cy = this as unknown as CoreAccess;

    // add the elements
    if( is.elementOrCollection( opts ) ){
      let eles = opts as unknown as Coll;

      if( eles._private.cy === cy ){ // same instance => just restore
        elements = eles.restore();

      } else { // otherwise, copy from json
        let jsons = [];

        for( let i = 0; i < eles.length; i++ ){
          let ele = eles[ i ];
          jsons.push( ele.json() );
        }

        elements = new Collection( cy, jsons as unknown as ElementDefinition[] );
      }
    }

    // specify an array of options
    else if( is.array( opts ) ){
      let jsons = opts;

      elements = new Collection( cy, jsons as unknown as ElementDefinition[] );
    }

    // specify via opts.nodes and opts.edges
    else if( is.plainObject( opts ) && (is.array( opts.nodes ) || is.array( opts.edges )) ){
      let elesByGroup = opts as { nodes?: ElementDefinition[]; edges?: ElementDefinition[] };
      let jsons = [];

      let grs = [ 'nodes', 'edges' ] as const;
      for( let i = 0, il = grs.length; i < il; i++ ){
        let group = grs[ i ];
        let elesArray = elesByGroup[ group ];

        if( is.array( elesArray ) ){

          for( let j = 0, jl = elesArray.length; j < jl; j++ ){
            let json = util.extend( { group: group }, elesArray[ j ] );

            jsons.push( json );
          }
        }
      }

      elements = new Collection( cy, jsons );
    }

    // specify options for one element
    else {
      let json = opts as ElementDefinition;
      elements = (new Element( cy, json )).collection();
    }

    return elements;
  },

  remove: function( this: Core, collection: SharedCollection | string ){
    if( is.elementOrCollection( collection ) ){
      // already have right ref
    } else if( is.string( collection ) ){
      let selector = collection;
      collection = this.$( selector );
    }

    return ( collection as unknown as Coll ).remove();
  }
} as CoreAddRemove;

/** Add/remove element methods contributed to the core prototype. */
export interface CoreAddRemove {
  add( this: Core, opts: AddOpts ): Coll;
  remove( this: Core, collection: SharedCollection | string ): Coll;
}

export default corefn as CoreAddRemove;

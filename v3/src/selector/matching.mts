import { matches as queryMatches } from './query-type-match.mjs';
import Type from './type.mjs';
import type { SelectorCollection, SelectorEle } from './type.mjs';
import type Selector from './index.mjs';

// filter an existing collection
let filter = function( this: Selector, collection: SelectorCollection ): SelectorCollection {
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias -- self is captured by the closure below

  // for 1 id #foo queries, just get the element
  if( self.length === 1 && self[0].checks.length === 1 && self[0].checks[0].type === Type.ID ){
    return collection.getElementById( self[0].checks[0].value as string ).collection();
  }

  let selectorFunction = function( element: SelectorEle ){
    for( let j = 0; j < self.length; j++ ){
      let query = self[ j ];

      if( queryMatches( query, element ) ){
        return true;
      }
    }

    return false;
  };

  if( self.text() == null ){
    selectorFunction = function(){ return true; };
  }

  return collection.filter( selectorFunction );
}; // filter

// does selector match a single element?
let matches = function( this: Selector, ele: SelectorEle ): boolean {
  let self = this; // eslint-disable-line @typescript-eslint/no-this-alias -- preserve the original code verbatim

  for( let j = 0; j < self.length; j++ ){
    let query = self[ j ];

    if( queryMatches( query, ele ) ){
      return true;
    }
  }

  return false;
}; // matches

/** The methods that the matching mixin contributes to the Selector prototype */
export interface MatchingMixin {
  matches( this: Selector, ele: SelectorEle ): boolean;
  filter( this: Selector, collection: SelectorCollection ): SelectorCollection;
}

export default { matches, filter };

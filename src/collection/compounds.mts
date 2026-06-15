import Set from '../set.mjs';
import cache from './cache-traversal-call.mjs';
import type { Collection, SharedCollection, Element, NodeCollection } from './eles-types.mjs';
import type { FilterArg } from './filter.mjs';
import type { SetLike } from '../set.mjs';

/** Compound-graph navigation methods contributed to the prototype. */
export interface CollectionCompounds {
  parent( selector?: FilterArg ): NodeCollection;
  parents( selector?: FilterArg ): NodeCollection;
  ancestors( selector?: FilterArg ): NodeCollection;
  commonAncestors( selector?: FilterArg ): NodeCollection;
  orphans( selector?: FilterArg ): NodeCollection;
  nonorphans( selector?: FilterArg ): NodeCollection;
  children( selector?: FilterArg ): NodeCollection;
  siblings( selector?: FilterArg ): NodeCollection;
  isParent(): boolean | undefined;
  isChildless(): boolean | undefined;
  isChild(): boolean | undefined;
  isOrphan(): boolean | undefined;
  descendants( selector?: FilterArg ): NodeCollection;
  /** @internal */
  forEachDown( fn: ( ele: Element ) => unknown, includeSelf?: boolean ): Collection;
  /** @internal */
  forEachUp( fn: ( ele: Element ) => unknown, includeSelf?: boolean ): Collection;
  /** @internal */
  forEachUpAndDown( fn: ( ele: Element ) => unknown, includeSelf?: boolean ): Collection;
}

type RecursiveStep = ( q: Element[], did: SetLike<string>, ele: Element ) => void;

let elesfn = ({
  parent: function( this: Collection, selector?: FilterArg ){
    let parents: Element[] = [];

    // optimisation for single ele call
    if( this.length === 1 ){
      let parent = this[0]._private.parent;

      if( parent ){ return parent; }
    }

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      let parent = ele._private.parent;

      if( parent ){
        parents.push( parent );
      }
    }

    return this.spawn( parents, true ).filter( selector );
  },

  parents: function( this: Collection, selector?: FilterArg ){
    let parents: Element[] = [];

    let eles = this.parent();
    while( eles.nonempty() ){
      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];
        parents.push( ele );
      }

      eles = eles.parent();
    }

    return this.spawn( parents, true ).filter( selector );
  },

  commonAncestors: function( this: Collection, selector?: FilterArg ){
    let ancestors: Collection | undefined;

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      let parents = ele.parents();

      // parents is a NodeCollection; widen to the mixed Collection accumulator
      ancestors = ancestors || ( parents as Collection );

      ancestors = ancestors.intersect( parents ); // current list must be common with current ele parents set
    }

    return ancestors!.filter( selector );
  },

  orphans: function( this: Collection, selector?: FilterArg ){
    return this.stdFilter( function( ele ){
      return ele.isOrphan();
    } ).filter( selector );
  },

  nonorphans: function( this: Collection, selector?: FilterArg ){
    return this.stdFilter( function( ele ){
      return ele.isChild();
    } ).filter( selector );
  },

  children: cache( function( this: Collection, selector?: FilterArg ){
    let children: Element[] = [];

    for( let i = 0; i < this.length; i++ ){
      let ele = this[ i ];
      let eleChildren = ele._private.children;

      for( let j = 0; j < eleChildren.length; j++ ){
        children.push( eleChildren[j] );
      }
    }

    return this.spawn( children, true ).filter( selector );
  }, 'children' ),

  siblings: function( this: Collection, selector?: FilterArg ){
    return this.parent().children().not( this ).filter( selector );
  },

  isParent: function( this: Collection ){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.children.length !== 0;
    }
  },

  isChildless: function( this: Collection ){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.children.length === 0;
    }
  },

  isChild: function( this: Collection ){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.parent != null;
    }
  },

  isOrphan: function( this: Collection ){
    let ele = this[0];

    if( ele ){
      return ele.isNode() && ele._private.parent == null;
    }
  },

  descendants: function( this: Collection, selector?: FilterArg ){
    let elements: Element[] = [];

    function add( eles: SharedCollection ){
      for( let i = 0; i < eles.length; i++ ){
        let ele = eles[ i ];

        elements.push( ele );

        if( ele.children().nonempty() ){
          add( ele.children() );
        }
      }
    }

    add( this.children() );

    return this.spawn( elements, true ).filter( selector );
  }
}) as unknown as CollectionCompounds;

function forEachCompound( eles: Collection, fn: ( ele: Element ) => unknown, includeSelf: boolean, recursiveStep: RecursiveStep ){
  let q: Element[] = [];
  let did = new Set<string>();
  let cy = eles.cy();
  let hasCompounds = cy.hasCompoundNodes();

  for( let i = 0; i < eles.length; i++ ){
    let ele = eles[i];

    if( includeSelf ){
      q.push( ele );
    } else if( hasCompounds ){
      recursiveStep( q, did, ele );
    }
  }

  while( q.length > 0 ){
    let ele = q.shift()!;

    fn( ele );

    did.add( ele.id()! );

    if( hasCompounds ){
      recursiveStep( q, did, ele );
    }
  }

  return eles;
}

function addChildren( q: Element[], did: SetLike<string>, ele: Element ){
  if( ele.isParent() ){
    let children = ele._private.children;

    for( let i = 0; i < children.length; i++ ){
      let child = children[i];

      if( !did.has( child.id()! ) ){
        q.push( child );
      }
    }
  }
}

// very efficient version of eles.add( eles.descendants() ).forEach()
// for internal use
( elesfn as CollectionCompounds ).forEachDown = function( this: Collection, fn: ( ele: Element ) => unknown, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addChildren );
};

function addParent( q: Element[], did: SetLike<string>, ele: Element ){
  if( ele.isChild() ){
    let parent = ele._private.parent!; // isChild() guarantees a parent

    if( !did.has( parent.id()! ) ){
      q.push( parent );
    }
  }
}

( elesfn as CollectionCompounds ).forEachUp = function( this: Collection, fn: ( ele: Element ) => unknown, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addParent );
};

function addParentAndChildren( q: Element[], did: SetLike<string>, ele: Element ){
  addParent( q, did, ele );
  addChildren( q, did, ele );
}

( elesfn as CollectionCompounds ).forEachUpAndDown = function( this: Collection, fn: ( ele: Element ) => unknown, includeSelf = true ){
  return forEachCompound( this, fn, includeSelf, addParentAndChildren );
};

// aliases
( elesfn as CollectionCompounds ).ancestors = elesfn.parents;

export default elesfn;

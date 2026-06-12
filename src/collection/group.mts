import type { Collection } from './eles-types.mjs';

// TODO(eles-types): `source()`/`target()` are contributed by the
// not-yet-converted traversing.mjs mixin; drop this local view once
// CollectionTraversing exports them.
type HasEndpoints = Collection & {
  source(): Collection;
  target(): Collection;
};

/** Group/type-test methods contributed to the collection prototype. */
export interface CollectionGroup {
  isNode(): boolean;
  isEdge(): boolean;
  isLoop(): boolean;
  isSimple(): boolean;
  group(): 'nodes' | 'edges' | undefined;
}

let elesfn = ({
  isNode: function( this: Collection ){
    return this.group() === 'nodes';
  },

  isEdge: function( this: Collection ){
    return this.group() === 'edges';
  },

  isLoop: function( this: Collection ){
    return this.isEdge() && ( this as HasEndpoints ).source()[0] === ( this as HasEndpoints ).target()[0];
  },

  isSimple: function( this: Collection ){
    return this.isEdge() && ( this as HasEndpoints ).source()[0] !== ( this as HasEndpoints ).target()[0];
  },

  group: function( this: Collection ){
    let ele = this[0];

    if( ele ){
      return ele._private.group;
    }
  }
}) satisfies CollectionGroup;


export default elesfn as CollectionGroup;

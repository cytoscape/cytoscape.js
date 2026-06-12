import zIndexSort from '../../../../collection/zsort.mjs';
import type { Renderer, Element } from '../../renderer-types.mjs';

// the z-sorted eles array carries extra partition lists tacked on as properties
type ZSortedEles = Element[] & {
  drag?: Element[];
  nondrag?: Element[];
  interactive?: Element[];
};

let BRp: Record<string, unknown> = {};

BRp.updateCachedGrabbedEles = function( this: Renderer ){
  let eles = this.cachedZSortedEles as ZSortedEles | undefined;

  if( !eles ){
    // just let this be recalculated on the next z sort tick
    return;
  }

  eles.drag = [];
  eles.nondrag = [];

  let grabTargets: Element[] = [];

  for( var i = 0; i < eles.length; i++ ){ // eslint-disable-line no-var
    var ele = eles[i]; // eslint-disable-line no-var
    let rs = ele._private.rscratch;

    if( ele.grabbed() && !ele.isParent() ){
      grabTargets.push( ele );
    } else if( rs.inDragLayer ){
      eles.drag.push( ele );
    } else {
      eles.nondrag.push( ele );
    }
  }

  // put the grab target nodes last so it's on top of its neighbourhood
  for( var i = 0; i < grabTargets.length; i++ ){ // eslint-disable-line no-var, @typescript-eslint/no-redeclare
    var ele = grabTargets[i]; // eslint-disable-line no-var, @typescript-eslint/no-redeclare

    eles.drag.push( ele );
  }
};

BRp.invalidateCachedZSortedEles = function( this: Renderer ){
  this.cachedZSortedEles = null;
};

BRp.getCachedZSortedEles = function( this: Renderer, forceRecalc?: boolean ){
  let eles: ZSortedEles;

  if( forceRecalc || !this.cachedZSortedEles ){
    eles = this.cy.mutableElements().toArray() as ZSortedEles;

    eles.sort( zIndexSort );

    eles.interactive = eles.filter(ele => ele.interactive());

    this.cachedZSortedEles = eles;

    this.updateCachedGrabbedEles();
  } else {
    eles = this.cachedZSortedEles as ZSortedEles;
  }

  return eles;
};

export default BRp;

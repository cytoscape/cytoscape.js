import define from '../define/index.mjs';
import type Animation from '../animation.mjs';
import type { AnimationOptions } from '../animation.mjs';
import type { Collection, SharedCollection } from './eles-types.mjs';

// Animation is kind-agnostic API (documented on `ele`/`eles`), so it is typed
// with `this: SharedCollection` — the base both node and edge projections are
// assignable to — rather than the wide `Collection`, which the `Omit<>`-based
// NodeCollection/EdgeCollection are NOT assignable to. Without this,
// `cy.nodes().animation()` / `node.animation()` would not type-check.
/** Animation methods contributed to the collection prototype. */
export interface CollectionAnimation {
  animate( this: SharedCollection, properties: AnimationOptions, params?: AnimationOptions ): Collection;
  animation( this: SharedCollection, properties?: AnimationOptions, params?: AnimationOptions ): Animation;
  animated( this: SharedCollection ): boolean | undefined;
  clearQueue( this: SharedCollection ): Collection;
  delay( this: SharedCollection, time: number, complete?: () => void ): Collection;
  delayAnimation( this: SharedCollection, time: number, complete?: () => void ): Animation;
  stop( this: SharedCollection, clearQueue?: boolean, jumpToEnd?: boolean ): Collection;
}

let elesfn = ({
  animate: define.animate<SharedCollection>(),
  animation: define.animation<SharedCollection>(),
  animated: define.animated<SharedCollection>(),
  clearQueue: define.clearQueue<SharedCollection>(),
  delay: define.delay<SharedCollection>(),
  delayAnimation: define.delayAnimation<SharedCollection>(),
  stop: define.stop<SharedCollection>()
});

export default elesfn as CollectionAnimation;

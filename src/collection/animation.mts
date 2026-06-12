import define from '../define/index.mjs';
import type Animation from '../animation.mjs';
import type { AnimationOptions } from '../animation.mjs';
import type { Collection } from './eles-types.mjs';

/** Animation methods contributed to the collection prototype. */
export interface CollectionAnimation {
  animate( this: Collection, properties: AnimationOptions, params?: AnimationOptions ): Collection;
  animation( this: Collection, properties?: AnimationOptions, params?: AnimationOptions ): Animation | Collection;
  animated( this: Collection ): boolean | undefined;
  clearQueue( this: Collection ): Collection;
  delay( this: Collection, time: number, complete?: () => void ): Collection;
  delayAnimation( this: Collection, time: number, complete?: () => void ): Animation | Collection;
  stop( this: Collection, clearQueue?: boolean, jumpToEnd?: boolean ): Collection;
}

let elesfn = ({
  animate: define.animate<Collection>(),
  animation: define.animation<Collection>(),
  animated: define.animated<Collection>(),
  clearQueue: define.clearQueue<Collection>(),
  delay: define.delay<Collection>(),
  delayAnimation: define.delayAnimation<Collection>(),
  stop: define.stop<Collection>()
});

export default elesfn as CollectionAnimation;

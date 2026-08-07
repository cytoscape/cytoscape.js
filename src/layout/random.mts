import * as math from '../math.mjs';
import type { BoundingBox } from '../types.mjs';
import type { RandomLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/** Random layout: v3's, over the collection scope via layoutPositions. */

const defaults: Omit<RandomLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  boundingBox: undefined,
  animate: false,
  animationDuration: 500,
  animationEasing: undefined,
  animateFilter: undefined,
  ready: undefined,
  stop: undefined,
  transform: undefined,
};

/**
 * Scatter nodes uniformly at random within the viewport or an explicit `boundingBox`.
 *
 * Useful as a starting state for a force layout that is not seeding its own.
 */
export class RandomLayout {
  /** the resolved options this layout was created with */
  options: RandomLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'random' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: RandomLayoutOptions) {
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  /**
   * Run the layout: emits `layoutstart`, writes the positions, then
   * emits `layoutready`/`layoutstop`.  Under `animate: true` the nodes
   * tween to their targets and a `fit` animates the viewport to the box
   * at the *final* positions, concurrently.
   *
   * @returns this layout, for chaining
   */
  run(): this {
    const cy = this.cy;
    const options = this.options;
    const eles = (options.eles as Collection | undefined) ?? cy.elements();

    const bb = math.makeBoundingBox(
      options.boundingBox ?? {
        x1: 0,
        y1: 0,
        w: cy.width(),
        h: cy.height(),
      },
    ) as BoundingBox;

    const getPos = (): { x: number; y: number } => ({
      x: bb.x1 + Math.round(Math.random() * bb.w),
      y: bb.y1 + Math.round(Math.random() * bb.h),
    });

    eles.nodes().layoutPositions(this, { ...options, eles }, getPos);

    return this;
  }
}

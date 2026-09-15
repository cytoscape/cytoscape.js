import * as math from '../math.mjs';
import type { BoundingBox } from '../types.mjs';
import type { RandomLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/** Random layout: v3's, over the collection scope via layoutPositions.
 * 125.8: a `seed` makes the scatter deterministic — the one property
 * the audit's stability criterion asks of every layout and a scatter
 * from `Math.random` cannot give; without one it is v3's, unseeded. */

/**
 * mulberry32: a small, well-distributed 32-bit generator, enough for a
 * scatter.  Not shared with force's Knuth hash — that one is indexed
 * by sim slot for the GPU's sake; this one is a plain stream.
 *
 * @param seed — any number; its low 32 bits seed the stream
 * @returns a function yielding uniform doubles in [0, 1)
 */
export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;

    let t = a;

    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const defaults: Omit<RandomLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  boundingBox: undefined,
  seed: undefined,
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

    const seed = options.seed;

    if (seed != null && !Number.isFinite(seed)) {
      throw new TypeError(
        `The random layout's seed must be a finite number, got ${String(seed)}`,
      );
    }

    const rand = seed != null ? mulberry32(seed) : Math.random;
    const getPos = (): { x: number; y: number } => ({
      x: bb.x1 + Math.round(rand() * bb.w),
      y: bb.y1 + Math.round(rand() * bb.h),
    });

    eles.nodes().layoutPositions(this, { ...options, eles }, getPos);

    return this;
  }
}

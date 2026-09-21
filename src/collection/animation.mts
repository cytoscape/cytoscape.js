// Collection's animation entry points (round 130 split).

import { Animation, AnimationHandleImpl } from '../animation.mjs';
import type { AnimateOptions, AnimationHandle } from '../animation.mjs';
import type { Collection } from '../collection.mjs';

/**
 * Animate these elements' style and/or position to explicit targets
 * over `duration` ms, easing the normalized time.
 *
 * There is no queue (round 21): the animation starts immediately,
 * animations on disjoint channels run concurrently, and starting one
 * that overlaps a running animation's channels stops the older one in
 * place — its promise resolves, its values freeze, and the new
 * animation captures from there.  Sequence with `await
 * animation( … ).play()` rather than by queueing.
 *
 * Animatable: `position`; `opacity` (both groups); node
 * `background-color`/`border-color`/`border-width`, edge `line-color`;
 * and — since round 25 — the geometry numerics node `width`/`height`,
 * edge `width`, compound `padding` and `font-size`.  Colours
 * interpolate in **OKLab**, matching the colour mappers, which
 * deliberately differs from v3's per-channel sRGB tweening.
 *
 * Easings are names, not functions: v3's full enum plus
 * `cubic-bezier( … )`, CSS `linear( … )` and `spring( bounce )`.  A
 * custom easing *function* is rejected — a closure cannot cross to the
 * GPU, so accepting one would mean a curve that silently depended on
 * whether the animation got offloaded.
 *
 * @param opts — targets (`position`, `style`, plus the viewport forms
 *   on `cy.animate`), `duration`, `easing`, `delay`, `complete`
 * @returns this collection, for chaining; use `animation()` when you
 *   want the handle
 * @see Collection#animation for the handle form with
 *   `promise`/`pause`/`resume`/`reverse`
 */
export function animate(self: Collection, opts: AnimateOptions): Collection {
  // start directly rather than through the handle: the chaining form
  // never exposes the promise, so play()'s per-call Promise + resolver
  // would be pure allocation here (round 62.4)
  const cy = self._cy;

  const ani = new Animation(
    cy._store,
    null,
    self._liveRefs(),
    false,
    opts,
    cy._styleEngine,
  );

  ani.lockAll = cy.autolock() === true;
  cy._animations.start(ani);

  return self;
}

/**
 * Build an animation for these elements without starting it.
 *
 * @param opts — the tween targets (`position`, `style`) plus
 *   `duration`, `delay`, `easing` and `complete`
 * @returns the handle; nothing runs until `play()`
 */
export function animation(
  self: Collection,
  opts: AnimateOptions,
): AnimationHandle {
  const cy = self._cy;
  const ani = new Animation(
    cy._store,
    null,
    self._liveRefs(),
    false,
    opts,
    cy._styleEngine,
  );

  ani.lockAll = cy.autolock() === true;

  return new AnimationHandleImpl(cy._animations, ani);
}

/**
 * True when any of these elements has a running animation.
 *
 * @returns whether **any** element here is animating — not whether all
 *   are, and not whether the viewport is (that is `cy.animated()`)
 */
export function animated(self: Collection): boolean {
  const mgr = self._cy._animations;

  // nothing running anywhere answers without touching refs — the
  // common case for a UI polling animation state (round 62.4)
  if (!mgr.anyRunning()) {
    return false;
  }

  for (const ref of self._refs) {
    if (mgr.isAnimating(ref)) {
      return true;
    }
  }

  return false;
}

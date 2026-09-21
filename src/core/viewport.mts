// Core's viewport writes and viewport animation (round 130 split).

import { Collection } from '../collection.mjs';
import { Animation, AnimationHandleImpl } from '../animation.mjs';
import type { AnimateOptions, AnimationHandle } from '../animation.mjs';
import * as math from '../math.mjs';
import type { BoundsLike } from '../viewport.mjs';
import type { Position } from '../public-types.mjs';
import type { Core } from '../core.mjs';

/**
 * Animate the viewport (`pan`/`zoom`) over `duration` ms.  Element
 * animation is on the collection (`eles.animate`).  Tweens are
 * CPU-canonical; a data write / manual pan mid-animation is not
 * prevented but will be overwritten by the next tick.
 *
 * @param opts — the viewport targets (`pan`, `panBy`, `zoom`, `fit`,
 *   `center`) plus `duration`, `easing` and `complete`; `fit` beats
 *   `center` beats `panBy` beats `pan`, and `panBy` with `pan` throws
 * @returns this core, for chaining
 */
export function animate(core: Core, opts: AnimateOptions): Core {
  // resolve first, so a `panBy` delta gates on panningEnabled exactly
  // as the absolute target it resolves to
  const resolved = _resolveViewportTargets(core, opts);

  if (opts.fit == null && opts.center == null) {
    if (resolved.pan != null && !core._panningEnabled) {
      return core;
    }
    if (resolved.zoom != null && !core._zoomingEnabled) {
      return core;
    }
  }

  core._animations.start(
    new Animation(core._store, core._viewport, [], true, resolved),
  );

  return core;
}

/**
 * Like `animate`, but returns a handle with `play`/`stop`/`promise` —
 * the viewport counterpart of `eles.animation`.
 *
 * @param opts — as {@link animate}; the animation does not start until
 *   `play()`
 * @returns the handle
 */
export function animation(core: Core, opts: AnimateOptions): AnimationHandle {
  return new AnimationHandleImpl(
    core._animations,
    new Animation(
      core._store,
      core._viewport,
      [],
      true,
      _resolveViewportTargets(core, opts),
    ),
  );
}

/**
 * Resolve `fit`/`center`/`panBy` targets to concrete pan/zoom at
 * creation time, as v3 does.  Precedence follows v3's override order:
 * `fit` beats `center` beats `panBy` beats an explicit `pan`.
 */
export function _resolveViewportTargets(
  core: Core,
  opts: AnimateOptions,
): AnimateOptions {
  if (opts.panBy != null && opts.pan != null) {
    throw new Error(
      `'panBy' and 'pan' both target the viewport pan — pass one ` +
        `(v3 silently preferred panBy; v4 does not guess)`,
    );
  }

  if (opts.fit != null) {
    const fit = opts.fit;
    const padding = fit.padding ?? 0;
    const fv =
      fit.boundingBox != null
        ? core._viewport.fitViewport(
            math.makeBoundingBox(fit.boundingBox) as BoundsLike,
            padding,
          )
        : core.getFitViewport(fit.eles as Collection | undefined, padding);

    if (fv != null) {
      return { ...opts, pan: fv.pan, zoom: fv.zoom };
    }
  } else if (opts.center != null) {
    const pan = core.getCenterPan(opts.center.eles as Collection | undefined);

    if (pan != null) {
      return { ...opts, pan };
    }
  } else if (opts.panBy != null) {
    const from = core._viewport.pan() as Position;

    return {
      ...opts,
      pan: { x: from.x + opts.panBy.x, y: from.y + opts.panBy.y },
    };
  }

  return opts;
}

/** Called after each animation tick: redraw, and emit viewport events while it pans/zooms. */
export function _afterAnimationTick(core: Core): void {
  if (core._animations.isViewportAnimating()) {
    core._emitViewportEvents(['pan', 'zoom', 'viewport']);
  }

  core._renderer?.requestRender();
}

/** The model bounding box of the given elements, or of the whole graph when none are given. */
export function _boundsOf(
  core: Core,
  eles?: Collection,
): ReturnType<Collection['boundingBox']> | null {
  if (eles == null) {
    // whole-graph fast path: columnar scan in the store, skipping the
    // per-element handle layer entirely
    return core._store.boundingBox();
  }

  if (eles.length === 0) {
    return null;
  }

  return eles.boundingBox();
}

/**
 * Pan and zoom so the given elements fill the viewport.
 *
 * Bounds **include labels by default** (round 16), so a fit never
 * clips the text it was asked to show; edge-label terms are
 * conservative, so a fit may slightly over-fit but never under-fits.
 *
 * @param eles — the elements to fit; omit for the whole graph
 * @param padding — rendered-space padding around the box
 * @returns this core, for chaining
 */
export function fit(core: Core, eles?: Collection, padding: number = 0): Core {
  const bb = core._boundsOf(eles);

  if (bb == null) {
    return core;
  }

  core._viewport.fit(bb, padding);
  core._emitViewportEvents(['zoom', 'pan', 'fit']);

  return core;
}

/**
 * Pan so the given elements are centred, leaving the zoom alone.
 * Bounds include labels, as in `fit()`.
 *
 * @param eles — the elements to centre on; omit for the whole graph
 * @returns this core, for chaining
 */
export function center(core: Core, eles?: Collection): Core {
  const bb = core._boundsOf(eles);

  if (bb == null) {
    return core;
  }

  if (core._viewport.centerOn(bb)) {
    core._emitViewportEvents(['pan']);
  }

  return core;
}

/**
 * Set both zoom bounds; accepts (min, max) or { min, max }.
 *
 * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
 *
 * @param min — the minimum zoom, or an object carrying both bounds
 * @param max — the maximum zoom, when `min` is a number
 * @returns this core, for chaining
 */
export function zoomRange(
  core: Core,
  min: number | { min?: number; max?: number },
  max?: number,
): Core {
  const lo = typeof min === 'object' ? min.min : min;
  const hi = typeof min === 'object' ? min.max : max;
  let changed = false;

  if (lo != null && core._viewport.setMinZoom(lo)) {
    changed = true;
  }
  if (hi != null && core._viewport.setMaxZoom(hi)) {
    changed = true;
  }

  if (changed) {
    core._emitViewportEvents(['zoom']);
  }

  return core;
}

/**
 * Set zoom and/or pan together, emitting once.
 *
 * @param opts — the `zoom` and/or `pan` to apply; omitted keys are left
 *   as they are
 * @returns this core, for chaining
 */
export function viewport(
  core: Core,
  opts: { zoom?: number; pan?: Position },
): Core {
  const events: string[] = [];

  if (opts.zoom != null && core._viewport.setZoom(opts.zoom)) {
    events.push('zoom');
  }
  if (opts.pan != null && core._viewport.setPan(opts.pan)) {
    events.push('pan');
  }

  if (events.length > 0) {
    core._emitViewportEvents(events);
  }

  return core;
}

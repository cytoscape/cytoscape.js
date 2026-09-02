/*
Shared node dimensions for layouts (round 114.1).

Every layout that avoids overlap needs the same numbers — how big each
node is — and until this round each read them its own way: circle,
concentric and breadthfirst through `layoutDimensions()` (labels only
on request), grid through `outerWidth()`/`outerHeight()` or the size
column (labels never), flow through the size and border columns (labels
never), radial and force not at all.  This module is the one reading.

The box is **node-local** — position plus `(x1, y1)..(x2, y2)` is the
box in model px — and **asymmetric** when a label is included, because
a label below the node makes `y2 > -y1`.  A consumer that needs
symmetric halves takes `max(-y1, y2)`.

Included: the body (`size / 2 + borderWidth / 2`, the store's own
bounding-box term) and, on request (`nodeDimensionsIncludeLabels`,
default false since round 115 — v3's default), the label box the store
keeps per node.  Deliberately excluded, as v3's `layoutDimensions` excluded them:
outline, overlay / underlay padding and ghost offsets — decoration, not
the node's footprint.  Headless label dimensions are the store's
estimates (round 16.4), so overlap avoidance with labels is exact only
once a renderer has laid the glyphs.
*/

import { FLAG_VISIBLE } from '../contract.mjs';
import type { GraphStore } from '../store/graph-store.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/** Slot-parallel node-local boxes, one entry per requested node. */
export interface LayoutNodeDims {
  /** how many nodes the arrays describe */
  n: number;
  /** left edge relative to the node position (negative) */
  x1: Float32Array;
  /** top edge relative to the node position (negative) */
  y1: Float32Array;
  /** right edge relative to the node position */
  x2: Float32Array;
  /** bottom edge relative to the node position */
  y2: Float32Array;
  /** the widest box's width */
  maxW: number;
  /** the tallest box's height */
  maxH: number;
}

/** What a dimensions read includes. */
export interface DimsOptions {
  /** union the label box into each node's box (default true here; the
   * layouts pass their `nodeDimensionsIncludeLabels`, default false) */
  includeLabels?: boolean;
  /** extra room around every node, split half per side (default 0) */
  padding?: number;
}

/**
 * Read the layout boxes of `slots` straight off the store's columns.
 *
 * @param store — the graph store
 * @param slots — node slots, in the order the arrays should follow
 * @param options — `includeLabels` (default true) and `padding`
 * @returns the slot-parallel boxes
 */
export const nodeDims = (
  store: GraphStore,
  slots: ArrayLike<number>,
  options: DimsOptions = {},
): LayoutNodeDims => {
  const n = slots.length;
  const x1 = new Float32Array(n);
  const y1 = new Float32Array(n);
  const x2 = new Float32Array(n);
  const y2 = new Float32Array(n);
  const size = store.column('node.size') as Float32Array;
  const border = store.column('node.borderWidth') as Float32Array;
  const flags = store.column('node.flags') as Uint32Array;
  const withLabels = options.includeLabels !== false && store.hasNodeLabels();
  const half = (options.padding ?? 0) / 2;
  let maxW = 0;
  let maxH = 0;

  for (let i = 0; i < n; i++) {
    const slot = slots[i];
    let l: number;
    let t: number;
    let r: number;
    let b: number;

    if ((flags[slot] & FLAG_VISIBLE) === 0) {
      // hidden takes no space; sanitised to a point-sized box below, as
      // v3's layoutDimensions sanitised zero against division
      l = t = r = b = 0;
    } else {
      const hw = size[slot * 2] / 2 + border[slot] / 2;
      const hh = size[slot * 2 + 1] / 2 + border[slot] / 2;

      l = -hw;
      t = -hh;
      r = hw;
      b = hh;

      if (withLabels) {
        const lb = store.nodeLabelBox(slot);

        if (lb != null) {
          l = Math.min(l, lb.x1);
          t = Math.min(t, lb.y1);
          r = Math.max(r, lb.x2);
          b = Math.max(b, lb.y2);
        }
      }
    }

    if (r - l === 0 || b - t === 0) {
      l = t = -0.5;
      r = b = 0.5;
    }

    l -= half;
    t -= half;
    r += half;
    b += half;

    x1[i] = l;
    y1[i] = t;
    x2[i] = r;
    y2[i] = b;
    maxW = Math.max(maxW, r - l);
    maxH = Math.max(maxH, b - t);
  }

  return { n, x1, y1, x2, y2, maxW, maxH };
};

/**
 * The handle-tier twin of `nodeDims`: the boxes of a collection's nodes,
 * in the collection's order (one entry per live node handle; edges are
 * skipped, so callers pass a node collection).
 *
 * @param cy — the core
 * @param nodes — the node handles to measure
 * @param options — as `nodeDims`
 * @returns the boxes, parallel to `nodes`
 */
export const nodeDimsOf = (
  cy: Core,
  nodes: Collection,
  options: DimsOptions = {},
): LayoutNodeDims => {
  const slots: number[] = [];

  for (const ref of nodes._liveRefs()) {
    if (ref.group === 'nodes') {
      slots.push(ref.slot);
    }
  }

  return nodeDims(cy._store, slots, options);
};

/**
 * The larger side of one box — the footprint a ring or spiral layout
 * spaces by.
 *
 * @param dims — the boxes
 * @param i — which one
 * @returns `max(width, height)`
 */
export const maxExtent = (dims: LayoutNodeDims, i: number): number =>
  Math.max(dims.x2[i] - dims.x1[i], dims.y2[i] - dims.y1[i]);

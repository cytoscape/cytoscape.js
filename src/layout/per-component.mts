import * as math from '../math.mjs';
import { nodeDimsOf } from './dims.mjs';
import {
  componentBoxes,
  fitBodiesToBox,
  packComponentBodies,
  type BoxInput,
  type NodeExtents,
  type PackGrouping,
} from './pack.mjs';
import type { BoundingBox, Position } from '../types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';
import type { Ref } from '../contract.mjs';

/*
Per-component discrete layouts (round 123, item 58): `packComponents:
true` on circle, concentric, grid, breadthfirst and radial lays each
disconnected component out on its own — one ring, one grid, one tree
per component — and shelf-packs the results with force's re-pack
(`packComponentBodies`), under the same `componentSpacing`,
`componentGroup`, `componentOrder` and `groupSpacing` a force run
takes.  The layout's own placement math is unchanged: it is called
once per component with a box sized to that component's share of the
scope's area, and the packed field is then centred in the scope's box
— scaled down, never up, when the caller gave an explicit
`boundingBox` (flow's rule).

Locked nodes are left out (they hold their place under every layout
since 114.3, and a packed component cannot be translated onto one),
and the packed field is moved off their boxes when it would land on
them: the smaller of a shift to the right of the locked union box and
a shift below it, a `componentSpacing` clear.
*/

/** What `componentGroup` and `componentOrder` see: one description per
 * disconnected component (121.1). */
export interface LayoutComponent {
  /** the component's nodes */
  nodes: Collection;
  /** how many nodes it has */
  size: number;
  /** its packed box's width, bodies included */
  width: number;
  /** its packed box's height, bodies included */
  height: number;
}

/** The component-packing options the discrete layouts share with
 * force (123.1). */
export interface PackOptions {
  /** the gap between packed component boxes (default 40) */
  componentSpacing?: number;
  /** a key per component; the groups stand in a row by key */
  componentGroup?: (
    component: LayoutComponent,
  ) => string | number | null | undefined;
  /** the order within a packing, ahead of largest-first */
  componentOrder?: (a: LayoutComponent, b: LayoutComponent) => number;
  /** the gap between group boxes (default three spacings) */
  groupSpacing?: number;
}

/**
 * The grouping and the order are functions or nothing — a data key
 * here would fail silently at the pack.
 *
 * @param options — the layout's options
 * @param layoutName — for the message
 * @throws when either is set and is not a function
 */
export const validatePackOptions = (
  options: PackOptions,
  layoutName: string,
): void => {
  for (const name of ['componentGroup', 'componentOrder'] as const) {
    const fn = options[name];

    if (fn != null && typeof fn !== 'function') {
      throw new Error(
        `${layoutName} layout: ${name} must be a function of a component, ` +
          `got ${typeof fn}`,
      );
    }
  }
};

/**
 * The re-pack's grouping from a caller's `componentGroup` /
 * `componentOrder` over the components' descriptions (factored out of
 * force's settle, 121.1): the keys sorted into group indices — numbers
 * ascending, then strings, then the unkeyed last — and the comparator
 * wrapped over component ids.
 *
 * @param described — one description per component, by component id
 * @param options — the caller's grouping options
 * @param spacing — the component spacing the group spacing defaults from
 * @returns the grouping `packComponentBodies` takes
 */
export const groupingOf = (
  described: LayoutComponent[],
  options: PackOptions,
  spacing: number,
): PackGrouping => {
  const groupOf = options.componentGroup;
  const orderOf = options.componentOrder;
  const grouping: PackGrouping = {
    groupSpacing: options.groupSpacing ?? spacing * 3,
  };

  if (groupOf != null) {
    const keys = described.map((d) => groupOf(d) ?? null);
    const distinct = [...new Set(keys.filter((k) => k != null))];

    distinct.sort((a, b) => {
      const na = typeof a === 'number';
      const nb = typeof b === 'number';

      if (na && nb) {
        return (a as number) - (b as number);
      }
      if (na !== nb) {
        return na ? -1 : 1;
      }

      return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
    });

    const index = new Map(distinct.map((k, i) => [k, i]));
    const unkeyed = keys.some((k) => k == null) ? 1 : 0;

    grouping.groupOf = Int32Array.from(
      keys,
      (k) => (k == null ? distinct.length : index.get(k)) as number,
    );
    grouping.groupCount = distinct.length + unkeyed;
  }

  if (orderOf != null) {
    grouping.compare = (a, b) => orderOf(described[a], described[b]);
  }

  return grouping;
};

/** The scope split into components over the nodes a layout places:
 * per-node component id (in `nodes` order), the count, and each
 * component's nodes as a collection. */
export interface ComponentSplit {
  compOf: Int32Array;
  count: number;
  members: Collection[];
}

/**
 * Split the placed nodes by the scope's connected components
 * (`eles.components()` — an edge with an endpoint outside the scope
 * connects nothing), dropping the nodes the layout does not place
 * (parents, locked nodes) from each; a component left empty vanishes.
 * Components come in size order, largest first, ties in the scope's
 * first-seen order, so component 0 is the largest.
 *
 * @param eles — the scope
 * @param nodes — the nodes the layout places, a subset of the scope
 * @returns the split
 */
export const splitByComponent = (
  eles: Collection,
  nodes: Collection,
): ComponentSplit => {
  const indexOf = new Map<Collection, number>();

  for (let i = 0; i < nodes.length; i++) {
    indexOf.set(nodes[i], i);
  }

  // which component each placed node is in, then the components'
  // members in the *caller's* node order — a sorted ring stays sorted
  const compIdOf = new Map<Collection, number>();
  const comps = eles.components();

  for (let c = 0; c < comps.length; c++) {
    const compNodes = comps[c].nodes();

    for (let j = 0; j < compNodes.length; j++) {
      compIdOf.set(compNodes[j], c);
    }
  }

  const refsOf: Ref[][] = Array.from({ length: comps.length }, () => []);

  for (let i = 0; i < nodes.length; i++) {
    const c = compIdOf.get(nodes[i]);

    if (c != null) {
      refsOf[c].push(nodes._refs[i]);
    }
  }

  const members: Collection[] = refsOf
    .filter((refs) => refs.length > 0)
    .map((refs) => nodes._spawnUnique(refs));

  // largest first; a stable sort keeps the scope order among equals
  members.sort((a, b) => b.length - a.length);

  const compOf = new Int32Array(nodes.length);

  for (let c = 0; c < members.length; c++) {
    const list = members[c];

    for (let j = 0; j < list.length; j++) {
      compOf[indexOf.get(list[j]) as number] = c;
    }
  }

  return { compOf, count: members.length, members };
};

/** What `layoutPerComponent` needs from the calling layout. */
export interface PerComponentInput {
  /** the scope */
  eles: Collection;
  /** the nodes the layout places (leaves, unlocked), in the order the
   * returned positions are indexed by */
  nodes: Collection;
  /** the scope's box — the viewport or the caller's `boundingBox` */
  bb: BoundingBox;
  /** the caller's explicit `boundingBox`, or nothing: with one the
   * packed field is scaled down to fit it (flow's rule); without, it
   * is centred on the viewport and `fit` does the rest */
  boundingBox?: BoxInput | null;
  /** the packing options */
  options: PackOptions;
  /** the boxes the pack keeps apart — labels on request, padded */
  includeLabels: boolean;
  padding: number;
  /** locked leaves in scope, which the field must not land on */
  held: Collection;
}

/**
 * Lay a scope out one component at a time and pack the results (123.1).
 * `place` is the layout's own placement over one component's nodes in
 * a box centred on the origin and sized to the component's share of
 * the scope's area (side ∝ √(size / n), never under twice the
 * component's largest node); the components' body boxes are then
 * shelf-packed largest first under the caller's grouping and order,
 * the field is centred in the scope box (scaled down to an explicit
 * `boundingBox`), and moved off any locked node it would cover.
 *
 * @param cy — the core
 * @param input — the scope, the nodes, the boxes and the options
 * @param place — the layout over one component: returns the position
 *   of a node by handle and index within that component
 * @returns the packed position of each placed node, by handle
 */
export const layoutPerComponent = (
  cy: Core,
  input: PerComponentInput,
  place: (
    compNodes: Collection,
    box: BoundingBox,
  ) => (node: Collection, i: number) => Position,
): ((node: Collection) => Position) => {
  const { eles, nodes, bb, options } = input;
  const n = nodes.length;
  const spacing = options.componentSpacing ?? 40;
  const split = splitByComponent(eles, nodes);
  const dims = nodeDimsOf(cy, nodes, {
    includeLabels: input.includeLabels,
    padding: input.padding,
  });
  const indexOf = new Map<Collection, number>();

  for (let i = 0; i < n; i++) {
    indexOf.set(nodes[i], i);
  }

  const xy = new Float64Array(n * 2);

  for (const compNodes of split.members) {
    // the component's share of the scope's area, and never a box a
    // node of it could not stand in twice over
    const share = Math.sqrt(compNodes.length / Math.max(1, n));
    let maxW = 0;
    let maxH = 0;

    for (let j = 0; j < compNodes.length; j++) {
      const i = indexOf.get(compNodes[j]) as number;

      maxW = Math.max(maxW, dims.x2[i] - dims.x1[i]);
      maxH = Math.max(maxH, dims.y2[i] - dims.y1[i]);
    }

    const w = Math.max(bb.w * share, maxW * 2);
    const h = Math.max(bb.h * share, maxH * 2);
    const box = math.makeBoundingBox({
      x1: -w / 2,
      y1: -h / 2,
      w,
      h,
    }) as BoundingBox;
    const posOf = place(compNodes, box);

    for (let j = 0; j < compNodes.length; j++) {
      const i = indexOf.get(compNodes[j]) as number;
      const p = posOf(compNodes[j], j);

      xy[i * 2] = p.x;
      xy[i * 2 + 1] = p.y;
    }
  }

  if (split.count > 1) {
    const boxes = componentBoxes(n, split.compOf, split.count, xy, dims);
    const described: LayoutComponent[] = split.members.map((m, c) => ({
      nodes: m,
      size: m.length,
      width: Math.max(1, boxes.x2[c] - boxes.x1[c]),
      height: Math.max(1, boxes.y2[c] - boxes.y1[c]),
    }));

    packComponentBodies(
      n,
      split.compOf,
      split.count,
      xy,
      dims,
      spacing,
      false,
      groupingOf(described, options, spacing),
    );
  }

  if (input.boundingBox != null) {
    fitBodiesToBox(n, xy, dims, input.boundingBox);
  } else {
    centreField(n, xy, dims, bb);
  }

  avoidHeld(cy, n, xy, dims, input.held, input.includeLabels, spacing);

  return (node) => {
    const i = indexOf.get(node) as number;

    return { x: xy[i * 2], y: xy[i * 2 + 1] };
  };
};

/** The bodies' union box at the positions. */
const fieldBox = (
  n: number,
  xy: Float64Array,
  dims: NodeExtents,
): BoundingBox => {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  for (let i = 0; i < n; i++) {
    x1 = Math.min(x1, xy[i * 2] + dims.x1[i]);
    y1 = Math.min(y1, xy[i * 2 + 1] + dims.y1[i]);
    x2 = Math.max(x2, xy[i * 2] + dims.x2[i]);
    y2 = Math.max(y2, xy[i * 2 + 1] + dims.y2[i]);
  }

  return math.makeBoundingBox({ x1, y1, x2, y2 }) as BoundingBox;
};

/** Translate the field so its bodies' box is centred on `bb`. */
const centreField = (
  n: number,
  xy: Float64Array,
  dims: NodeExtents,
  bb: BoundingBox,
): void => {
  if (n === 0) {
    return;
  }

  const box = fieldBox(n, xy, dims);
  const dx = bb.x1 + bb.w / 2 - (box.x1 + box.x2) / 2;
  const dy = bb.y1 + bb.h / 2 - (box.y1 + box.y2) / 2;

  for (let i = 0; i < n; i++) {
    xy[i * 2] += dx;
    xy[i * 2 + 1] += dy;
  }
};

/**
 * Move the packed field off the locked nodes it would cover: the
 * smaller of a shift to the right of their union box and a shift
 * below it, `spacing` clear.
 */
const avoidHeld = (
  cy: Core,
  n: number,
  xy: Float64Array,
  dims: NodeExtents,
  held: Collection,
  includeLabels: boolean,
  spacing: number,
): void => {
  if (n === 0 || held.length === 0) {
    return;
  }

  const heldDims = nodeDimsOf(cy, held, { includeLabels });
  let hx1 = Infinity;
  let hy1 = Infinity;
  let hx2 = -Infinity;
  let hy2 = -Infinity;

  for (let j = 0; j < held.length; j++) {
    const p = held[j].position() as Position;

    hx1 = Math.min(hx1, p.x + heldDims.x1[j]);
    hy1 = Math.min(hy1, p.y + heldDims.y1[j]);
    hx2 = Math.max(hx2, p.x + heldDims.x2[j]);
    hy2 = Math.max(hy2, p.y + heldDims.y2[j]);
  }

  const box = fieldBox(n, xy, dims);
  const apart =
    box.x2 <= hx1 || box.x1 >= hx2 || box.y2 <= hy1 || box.y1 >= hy2;

  if (apart) {
    return;
  }

  const dx = hx2 + spacing - box.x1;
  const dy = hy2 + spacing - box.y1;
  const right = Math.abs(dx) <= Math.abs(dy);

  for (let i = 0; i < n; i++) {
    if (right) {
      xy[i * 2] += dx;
    } else {
      xy[i * 2 + 1] += dy;
    }
  }
};

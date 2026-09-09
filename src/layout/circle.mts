import * as math from '../math.mjs';
import { isSortMapping, sortComparator } from './layout-mapping.mjs';
import { nodeDimsOf } from './dims.mjs';
import { ringTangentialRadius } from './separation.mjs';
import { layoutPerComponent, validatePackOptions } from './per-component.mjs';
import type { BoundingBox, Position } from '../types.mjs';
import type { CircleLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/*
Circle layout: v3's math over the collection scope.  One deliberate
correction vs the repo's v3 file: `layoutPositions` is called on the
*sorted* node collection (as upstream v3 does), so the `sort` option
actually orders nodes around the circle.

Overlap (round 115): v3 grew a crowded ring by the largest node's
longer side times 1.75, for every pair alike.  The ring now takes the
smallest radius at which no two of its nodes overlap — each angular
pair separated along its own chord, so a wide label at the side of the
ring (where the chord runs vertically) costs its height, not its width
— plus `avoidOverlapPadding` around every box.

Components (round 123.2): `packComponents: true` draws one ring per
disconnected component — a singleton a point, a pair two points, a
triple a triangle — each at the smallest radius that separates its
members, `sort` ordering each ring, and shelf-packs the rings largest
first under the shared `componentSpacing` / `componentGroup` /
`componentOrder` (`per-component.mts`).  Off (the default), one ring
about one centre, as v3.
*/

const defaults: Omit<CircleLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  boundingBox: undefined,
  avoidOverlap: true,
  avoidOverlapPadding: 10,
  spacingFactor: undefined,
  radius: undefined,
  startAngle: (3 / 2) * Math.PI,
  sweep: undefined,
  clockwise: true,
  sort: undefined,
  packComponents: false,
  componentSpacing: 40,
  componentGroup: undefined,
  componentOrder: undefined,
  groupSpacing: undefined,
  animate: false,
  animationDuration: 500,
  animationEasing: undefined,
  animateFilter: undefined,
  ready: undefined,
  stop: undefined,
  transform: undefined,
};

/**
 * Place nodes evenly around a single circle.
 *
 * The radius derives from the node count and spacing unless given explicitly; `sort` controls the order around the ring.
 */
export class CircleLayout {
  /** the resolved options this layout was created with */
  options: CircleLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'circle' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: CircleLayoutOptions) {
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

    // parents derive; a locked node holds its place and takes no slot on
    // the ring (114.3 — circle places by index)
    let nodes = eles
      .nodes()
      .filter((n: Collection) => !n.isParent() && !n.locked());

    if (options.sort != null) {
      // the { data, order? } sort mapping is the serializable spelling
      // (85.3); a comparator fn stays the escape hatch
      const comparator = isSortMapping(options.sort)
        ? sortComparator(cy, options.sort, 'sort')
        : (options.sort as (a: Collection, b: Collection) => number);

      nodes = nodes.sort(comparator);
    }

    const bb = math.makeBoundingBox(
      options.boundingBox ?? {
        x1: 0,
        y1: 0,
        w: cy.width(),
        h: cy.height(),
      },
    ) as BoundingBox;

    // one ring per component, packed (123.2) — or v3's one ring
    let getPos: (node: Collection, i: number) => Position;

    if (options.packComponents === true) {
      validatePackOptions(options, 'circle');

      const perComponent = layoutPerComponent(
        cy,
        {
          eles,
          nodes,
          bb,
          boundingBox: options.boundingBox ?? null,
          options,
          includeLabels: options.nodeDimensionsIncludeLabels === true,
          padding: options.avoidOverlapPadding ?? 10,
          held: eles.nodes().filter((n: Collection) => n.locked()),
        },
        (compNodes, box) => this.ring(compNodes, box),
      );

      getPos = (node) => perComponent(node);
    } else {
      getPos = this.ring(nodes, bb);
    }

    nodes.layoutPositions(this, { ...options, eles }, getPos);

    return this;
  }

  /**
   * One ring: `nodes` evenly around the centre of `bb`, at the given
   * radius, or the box's, grown under `avoidOverlap` until no two
   * overlap.
   *
   * @param nodes — the nodes, in ring order
   * @param bb — the box the ring is centred in and sized by
   * @returns the position of a node by its index in `nodes`
   */
  private ring(
    nodes: Collection,
    bb: BoundingBox,
  ): (node: Collection, i: number) => Position {
    const cy = this.cy;
    const options = this.options;
    const clockwise =
      options.counterclockwise !== undefined
        ? !options.counterclockwise
        : options.clockwise;
    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2,
    };

    const sweep =
      options.sweep === undefined
        ? 2 * Math.PI - (2 * Math.PI) / nodes.length
        : options.sweep;
    const dTheta = sweep / Math.max(1, nodes.length - 1);
    let r: number;

    let minDistance = 0;

    for (let i = 0; i < nodes.length; i++) {
      const nbb = nodes[i].layoutDimensions(options);

      minDistance = Math.max(minDistance, nbb.w, nbb.h);
    }

    if (typeof options.radius === 'number') {
      r = options.radius;
    } else if (nodes.length <= 1) {
      r = 0;
    } else {
      r = Math.max(0, Math.min(bb.h, bb.w) / 2 - minDistance);
    }

    const angleOf = (i: number): number =>
      (options.startAngle as number) + i * dTheta * (clockwise ? 1 : -1);

    // grow the radius until no two nodes overlap (115: exact per pair)
    if (nodes.length > 1 && options.avoidOverlap) {
      const dims = nodeDimsOf(cy, nodes, {
        includeLabels: options.nodeDimensionsIncludeLabels === true,
        padding: options.avoidOverlapPadding ?? 10,
      });
      const members = new Int32Array(nodes.length);
      const angles = new Float64Array(nodes.length);

      for (let i = 0; i < nodes.length; i++) {
        members[i] = i;
        angles[i] = angleOf(i);
      }

      r = Math.max(ringTangentialRadius(dims, { members, angles }), r);
    }

    return (_ele: Collection, i: number): Position => {
      const theta = angleOf(i);

      return {
        x: center.x + r * Math.cos(theta),
        y: center.y + r * Math.sin(theta),
      };
    };
  }
}

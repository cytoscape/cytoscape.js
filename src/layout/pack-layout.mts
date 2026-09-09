import { nodeDimsOf } from './dims.mjs';
import {
  componentBoxes,
  fitBodiesToBox,
  packComponentBodies,
} from './pack.mjs';
import {
  groupingOf,
  splitByComponent,
  validatePackOptions,
  type LayoutComponent,
} from './per-component.mjs';
import type { Position } from '../types.mjs';
import type { PackLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/*
The pack layout (round 123.1, item 58): force's settle re-pack on its
own.  The components at their current positions are shelf-packed by
their body boxes, largest first, under `componentGroup`,
`componentOrder`, `componentSpacing` and `groupSpacing` — the same
spellings force takes — with the largest component's centre held, so
a drawing whose structure is done (a sim, a preset, an arrangement by
hand) can have its components grouped and ordered without being
recomputed.  EnrichmentMap's case: keep the layout, regroup by sign.

Translation only: no shapes and no orientation (120, 121.2), which
need edge lengths and belong to force.  Locked nodes are left out, as
under every layout since 114.3, and their components pack by their
free members alone.
*/

const defaults: Omit<PackLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  boundingBox: undefined,
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
 * Pack the disconnected components at their current positions: each
 * component translated as one body, the boxes shelf-packed largest
 * first with `componentSpacing` between, grouped and ordered by
 * `componentGroup` and `componentOrder`, the largest component's centre
 * held.  A re-pack for a drawing that is otherwise done.
 */
export class PackLayout {
  /** the resolved options this layout was created with */
  options: PackLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'pack' } )` / `eles.layout( … )`
   * rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `transform`, `animate`,
   *   the lifecycle callbacks)
   */
  constructor(cy: Core, options: PackLayoutOptions) {
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  /**
   * Run the layout: emits `layoutstart`, writes the packed positions,
   * then emits `layoutready`/`layoutstop`.  Under `animate: true` every
   * component tweens to its packed place.
   *
   * @returns this layout, for chaining
   * @throws at start when `componentGroup` or `componentOrder` is set
   *   and is not a function
   */
  run(): this {
    const cy = this.cy;
    const options = this.options;
    const eles = (options.eles as Collection | undefined) ?? cy.elements();

    validatePackOptions(options, 'pack');

    const nodes = eles
      .nodes()
      .filter((n: Collection) => !n.isParent() && !n.locked()) as Collection;
    const n = nodes.length;
    const spacing = options.componentSpacing ?? 40;
    const split = splitByComponent(eles, nodes);
    const dims = nodeDimsOf(cy, nodes, {
      includeLabels: options.nodeDimensionsIncludeLabels === true,
    });
    const xy = new Float64Array(n * 2);

    for (let i = 0; i < n; i++) {
      const p = nodes[i].position() as Position;

      xy[i * 2] = p.x;
      xy[i * 2 + 1] = p.y;
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
        true,
        groupingOf(described, options, spacing),
      );
    }

    // an explicit box after the re-pack, as force honours it (116.2):
    // the packed field scaled down — never up — and centred in it
    if (options.boundingBox != null) {
      fitBodiesToBox(n, xy, dims, options.boundingBox);
    }

    nodes.layoutPositions(this, { ...options, eles }, (_node, i) => ({
      x: xy[i * 2],
      y: xy[i * 2 + 1],
    }));

    return this;
  }
}

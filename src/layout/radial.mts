import * as math from '../math.mjs';
import { nodeDimsOf } from './dims.mjs';
import { ringRadius, type Ring } from './separation.mjs';
import type { BoundingBox, Position } from '../types.mjs';
import type { RadialLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/*
Radial tree layout (round 85.1, #2493): hierarchy-aware angular
allocation.  A BFS tree is grown from the roots (round-10 slot-native
bfs; non-tree edges just draw — breadthfirst's stance), then every
node receives an angular *wedge*: a share of its parent's wedge
proportional to its subtree's weight.  The node sits at its wedge's
bisector at radius depth × levelSpacing — so a subtree occupies one
contiguous sector and its edges never have to cross the circle, which
is exactly what breadthfirst's `circle: true` (uniform per-index ring
angles, no wedges) cannot promise, and the ask of #2493 (the Vega
radial-tree behaviour).

Multiple roots partition the sweep proportionally to their trees'
weights.  A single root sits exactly at the centre; with several
roots (or several components) every root moves out to the first ring
so they cannot coincide at the centre.  Nodes the BFS never reaches
from the given roots seed their own trees, in scope order — a
disconnected component always gets a wedge.

`roots` takes a collection or an array of node ids (no selector
strings).  Leaves only; compound parents derive from their placed
children (the standing rule).

Overlap (round 114.6, exact since 115): the wedge angles are the
structure, so a ring's radius is the one degree of freedom — under
`avoidOverlap` (default) each ring takes the smallest radius at which
neither the ring inside it nor the neighbours along it touch, every
pair separated along its own direction (`separation.mts`), node boxes
read through the shared dimensions (labels on request).
*/

const defaults: Omit<RadialLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  boundingBox: undefined,
  roots: undefined,
  startAngle: (3 / 2) * Math.PI,
  sweep: 2 * Math.PI,
  clockwise: true,
  levelSpacing: undefined,
  avoidOverlap: true,
  avoidOverlapPadding: 10,
  weight: 'leaves',
  spacingFactor: undefined,
  animate: false,
  animationDuration: 500,
  animationEasing: undefined,
  animateFilter: undefined,
  ready: undefined,
  stop: undefined,
  transform: undefined,
};

/**
 * Place a tree in concentric rings with hierarchy-aware angular
 * wedges: each subtree occupies a contiguous sector sized by its
 * weight, so children sit inside their parent's wedge and subtrees
 * never interleave (#2493, the Vega radial-tree behaviour).
 *
 * `roots` is a collection or an array of node ids (never a selector
 * string); omitted, the roots are inferred per component by maximum
 * degree, as breadthfirst infers them.
 */
export class RadialLayout {
  /** the resolved options this layout was created with */
  options: RadialLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'radial' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: RadialLayoutOptions) {
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  /**
   * Run the layout: grow the BFS trees, weigh every subtree, allocate
   * wedges, and finish through the shared `layoutPositions` plumbing
   * (spacingFactor / transform / animate / fit and the lifecycle).
   *
   * @returns this layout, for chaining
   * @throws when `roots` is a selector string — v4 has no selector
   *   strings, so the string is a v3 call site rather than a value
   *   that could mean anything here
   */
  run(): this {
    const cy = this.cy;
    const options = this.options;
    const eles = (options.eles as Collection | undefined) ?? cy.elements();
    const nodes = eles.nodes().filter((n: Collection) => !n.isParent());

    const bb = math.makeBoundingBox(
      options.boundingBox ?? {
        x1: 0,
        y1: 0,
        w: cy.width(),
        h: cy.height(),
      },
    ) as BoundingBox;

    // resolve the roots: collection, id array, or inferred (the
    // breadthfirst undirected arm — max degree per component)
    let roots: Collection;
    const optRoots = options.roots;

    if (typeof optRoots === 'string') {
      throw new TypeError(
        '`roots` must be a collection or an array of node ids — v4 has no selector strings',
      );
    } else if (Array.isArray(optRoots)) {
      roots = (optRoots as string[])
        .map((id) => cy.$id(id))
        .reduce((acc, ele) => acc.union(ele), cy.collection());
    } else if (optRoots != null) {
      roots = optRoots as Collection;
    } else {
      const components = eles.components();

      roots = cy.collection();

      for (const comp of components) {
        const maxDegree = comp.maxDegree(false) as number;
        const compRoots = comp.filter(
          (ele: Collection) => ele.isNode() && ele.degree(false) === maxDegree,
        );

        roots = roots.union(compRoots);
      }
    }

    // grow the BFS trees: parent links and depths.  Handles are
    // interned singletons, so Maps keyed by handle are sound (the
    // breadthfirst precedent).
    const childrenOf = new Map<Collection, Collection[]>();
    const depthOf = new Map<Collection, number>();
    const order: Collection[] = []; // visit order — parents before children
    const treeRoots: Collection[] = [];

    const grow = (bfsRoots: Collection): void => {
      eles.bfs({
        roots: bfsRoots,
        visit: (v, _e, u, _i, depth) => {
          if (depthOf.has(v)) {
            return;
          }

          depthOf.set(v, depth);
          childrenOf.set(v, []);
          order.push(v);

          if (u != null && depth > 0) {
            (childrenOf.get(u) as Collection[]).push(v);
          } else {
            treeRoots.push(v);
          }
        },
      });
    };

    if (roots.length > 0) {
      grow(roots);

      // the slot-native bfs seeds its queue in reverse roots order
      // (v3's exact queue mechanics) — wedge order must follow the
      // *caller's* roots order, so put the discovered tree roots back
      // in it
      if (treeRoots.length > 1) {
        const rank = new Map<Collection, number>();

        for (let i = 0; i < roots.length; i++) {
          rank.set(roots[i], i);
        }

        treeRoots.sort((a, b) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0));
      }
    }

    // unreached nodes seed their own trees, in scope order — every
    // disconnected component gets a wedge
    for (let i = 0; i < nodes.length; i++) {
      if (!depthOf.has(nodes[i])) {
        grow(nodes[i]);
      }
    }

    // subtree weights, children-first (reverse visit order):
    // 'leaves' counts the subtree's leaves, 'subtree' its nodes
    const weightOf = new Map<Collection, number>();
    const subtreeWeight = options.weight === 'subtree';

    for (let i = order.length - 1; i >= 0; i--) {
      const node = order[i];
      const children = childrenOf.get(node) as Collection[];
      let w = 0;

      for (const child of children) {
        w += weightOf.get(child) as number;
      }

      weightOf.set(node, children.length === 0 ? 1 : subtreeWeight ? w + 1 : w);
    }

    // wedges: each root takes a share of the sweep proportional to
    // its tree's weight; each child a share of its parent's wedge
    // proportional to its subtree's — assigned parents-first, so the
    // visit order doubles as the traversal
    const sweep = options.sweep as number;
    const dir = options.clockwise === false ? -1 : 1;
    const wedgeStart = new Map<Collection, number>();
    const wedgeSize = new Map<Collection, number>();
    let totalWeight = 0;

    for (const root of treeRoots) {
      totalWeight += weightOf.get(root) as number;
    }

    let rootAt = 0;

    for (const root of treeRoots) {
      const share = (sweep * (weightOf.get(root) as number)) / totalWeight;

      wedgeStart.set(root, rootAt);
      wedgeSize.set(root, share);
      rootAt += share;
    }

    for (const node of order) {
      const children = childrenOf.get(node) as Collection[];

      if (children.length === 0) {
        continue;
      }

      const start = wedgeStart.get(node) as number;
      const size = wedgeSize.get(node) as number;
      let childWeight = 0;

      for (const child of children) {
        childWeight += weightOf.get(child) as number;
      }

      let at = start;

      for (const child of children) {
        const share = (size * (weightOf.get(child) as number)) / childWeight;

        wedgeStart.set(child, at);
        wedgeSize.set(child, share);
        at += share;
      }
    }

    // radii: a lone root sits exactly at the centre; several roots
    // move out to the first ring so they cannot coincide there
    const rootOffset = treeRoots.length > 1 ? 1 : 0;
    let maxRing = 0;

    for (const node of order) {
      maxRing = Math.max(maxRing, (depthOf.get(node) as number) + rootOffset);
    }

    const base =
      options.levelSpacing ??
      Math.min(bb.w, bb.h) / 2 / Math.max(1, maxRing + 1);
    const bisectorOf = (node: Collection): number =>
      (wedgeStart.get(node) as number) + (wedgeSize.get(node) as number) / 2;

    // per-ring radii (114.6): each ring starts at its share of the
    // spacing and, under avoidOverlap, grows until neither its radial
    // neighbours (the ring before it) nor its angular neighbours (the
    // nodes beside it on the ring, whatever wedge they belong to) can
    // touch — concentric's chord rule, applied per consecutive pair
    // because wedges are not uniform.  The wedge angles never change:
    // radius is the one degree of freedom that keeps the sectors.
    const radii = new Float64Array(maxRing + 1);

    for (let k = 1; k <= maxRing; k++) {
      radii[k] = k * base;
    }

    if (options.avoidOverlap !== false && nodes.length > 1) {
      const dims = nodeDimsOf(cy, nodes, {
        includeLabels: options.nodeDimensionsIncludeLabels === true,
        padding: options.avoidOverlapPadding ?? 10,
      });
      const indexOf = new Map<Collection, number>();

      for (let i = 0; i < nodes.length; i++) {
        indexOf.set(nodes[i], i);
      }

      const rings: Collection[][] = [];

      for (let k = 0; k <= maxRing; k++) {
        rings.push([]);
      }

      for (const node of order) {
        rings[(depthOf.get(node) as number) + rootOffset].push(node);
      }

      const ringOf = (k: number): Ring => {
        const list = rings[k];
        const members = new Int32Array(list.length);
        const angles = new Float64Array(list.length);

        for (let j = 0; j < list.length; j++) {
          members[j] = indexOf.get(list[j]) as number;
          angles[j] =
            (options.startAngle as number) + dir * bisectorOf(list[j]);
        }

        return { members, angles };
      };

      let inner = ringOf(0);

      for (let k = 1; k <= maxRing; k++) {
        const ring = ringOf(k);

        radii[k] = ringRadius(dims, ring, inner, radii[k - 1], radii[k]);
        inner = ring;
      }
    }

    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2,
    };

    const getPos = (node: Collection): Position => {
      const ring = (depthOf.get(node) as number) + rootOffset;

      if (ring === 0) {
        return { x: center.x, y: center.y };
      }

      const theta = (options.startAngle as number) + dir * bisectorOf(node);
      const radius = radii[ring];

      return {
        x: center.x + radius * Math.cos(theta),
        y: center.y + radius * Math.sin(theta),
      };
    };

    nodes.layoutPositions(this, { ...options, eles }, getPos);

    return this;
  }
}

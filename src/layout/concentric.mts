import * as math from '../math.mjs';
import {
  checkScoreColumn,
  isScoreMapping,
  resolveScores,
  validateScoreMapping,
} from './layout-mapping.mjs';
import { nodeDimsOf } from './dims.mjs';
import { ringRadius, type Ring } from './separation.mjs';
import { layoutPerComponent, validatePackOptions } from './per-component.mjs';
import type { BoundingBox, Position } from '../types.mjs';
import type { ConcentricLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/*
Concentric layout: v3's level-binning over the collection scope.  The
concentric value is recorded in each node's scratch (`concentric` key)
as v3 does; v4 has no style functions, so there is no updateStyle()
pass.

Overlap (round 115): v3 spaced every level by one number — the largest
node's longer side plus `minNodeSpacing` — as both the chord between
angular neighbours and the step between rings.  Each ring now takes
the smallest radius that clears its own nodes and the ring inside it
(`separation.mts`), `minNodeSpacing` padding every box; a level's
angles are untouched.  `avoidOverlap: false` keeps v3's bounded
uniform steps.

Components (round 123.2): `packComponents: true` draws one set of
rings per disconnected component, the scores resolved once over the
scope (a `range` mapping normalizes across the whole graph) but the
levels binned per component — `levelWidth` sees that component's
nodes — and shelf-packs the drawings largest first under the shared
`componentSpacing` / `componentGroup` / `componentOrder`
(`per-component.mts`).  Off (the default), one set of rings about one
centre, as v3.
*/

const defaults: Omit<ConcentricLayoutOptions, 'name'> = {
  fit: true,
  padding: 30,
  startAngle: (3 / 2) * Math.PI,
  sweep: undefined,
  clockwise: true,
  equidistant: false,
  minNodeSpacing: 10,
  boundingBox: undefined,
  avoidOverlap: true,
  height: undefined,
  width: undefined,
  spacingFactor: undefined,
  concentric: (node) => (node as Collection).degree() ?? 0,
  levelWidth: (nodes) => ((nodes as Collection).maxDegree() ?? 0) / 4,
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

type Level = { value: number; node: Collection }[] & {
  dTheta?: number;
  r?: number;
};

/**
 * Place nodes on concentric rings, most important innermost.
 *
 * `concentric` scores each node (degree by default) and `levelWidth` decides how wide a score band a ring covers.
 */
export class ConcentricLayout {
  /** the resolved options this layout was created with */
  options: ConcentricLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'concentric' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: ConcentricLayoutOptions) {
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
    const nodes = eles.nodes().filter((n: Collection) => !n.isParent());

    const bb = math.makeBoundingBox(
      options.boundingBox ?? {
        x1: 0,
        y1: 0,
        w: cy.width(),
        h: cy.height(),
      },
    ) as BoundingBox;

    // the score-mapping form (85.3): the column resolved once — the
    // serializable spelling; the fn form (and the degree default) stay
    const concentricOpt = options.concentric;
    let scoreOf: (node: Collection, i: number) => number;

    if (isScoreMapping(concentricOpt)) {
      validateScoreMapping(concentricOpt, 'concentric');
      checkScoreColumn(cy, 'nodes', concentricOpt, 'concentric');

      const key = concentricOpt.data;
      const resolved = resolveScores(
        nodes.map((node: Collection) => node.data(key)),
        concentricOpt,
        0,
      );

      scoreOf = (_node, i) => resolved[i];
    } else {
      const fn = concentricOpt as (node: Collection) => number;

      scoreOf = (node) => fn(node);
    }

    // every node's score, once over the scope, in its scratch as v3
    const valueOf = new Map<Collection, number>();

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const value = scoreOf(node, i);

      valueOf.set(node, value);
      node.scratch('concentric', value);
    }

    // one set of rings per component, packed (123.2) — or v3's one
    let getPos: (node: Collection) => Position;

    if (options.packComponents === true) {
      validatePackOptions(options, 'concentric');

      const perComponent = layoutPerComponent(
        cy,
        {
          eles,
          nodes,
          bb,
          boundingBox: options.boundingBox ?? null,
          options,
          includeLabels: options.nodeDimensionsIncludeLabels === true,
          padding: options.minNodeSpacing as number,
          held: eles.nodes().filter((n: Collection) => n.locked()),
        },
        (compNodes, box) => this.rings(compNodes, box, valueOf),
      );

      getPos = (node) => perComponent(node);
    } else {
      getPos = this.rings(nodes, bb, valueOf);
    }

    nodes.layoutPositions(this, { ...options, eles }, (ele) => getPos(ele));

    return this;
  }

  /**
   * One set of rings: `nodes` binned into levels by score and
   * `levelWidth`, each ring at the radius that clears its own nodes
   * and the ring inside it, about the centre of `bb`.
   *
   * @param nodes — the nodes to place
   * @param bb — the box the rings are centred in
   * @param valueOf — each node's score
   * @returns the position of a node by handle
   */
  private rings(
    nodes: Collection,
    bb: BoundingBox,
    valueOf: Map<Collection, number>,
  ): (node: Collection) => Position {
    const options = this.options;
    const clockwise =
      options.counterclockwise !== undefined
        ? !options.counterclockwise
        : options.clockwise;
    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2,
    };
    const nodeValues: { value: number; node: Collection }[] = [];
    let maxNodeSize = 0;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      nodeValues.push({ value: valueOf.get(node) as number, node });
    }

    for (let i = 0; i < nodes.length; i++) {
      const nbb = nodes[i].layoutDimensions(options);

      maxNodeSize = Math.max(maxNodeSize, nbb.w, nbb.h);
    }

    // decreasing order
    nodeValues.sort((a, b) => b.value - a.value);

    const levelWidth = (options.levelWidth as (nodes: Collection) => number)(
      nodes,
    );

    // bin the values into levels
    const levels: Level[] = [[]];
    let currentLevel: Level = levels[0];

    for (const val of nodeValues) {
      if (currentLevel.length > 0) {
        const diff = Math.abs(currentLevel[0].value - val.value);

        if (diff >= levelWidth) {
          currentLevel = [];
          levels.push(currentLevel);
        }
      }

      currentLevel.push(val);
    }

    let minDist = maxNodeSize + (options.minNodeSpacing as number);

    if (!options.avoidOverlap) {
      // then strictly constrain to bb
      const firstLvlHasMulti = levels.length > 0 && levels[0].length > 1;
      const maxR = Math.min(bb.w, bb.h) / 2 - minDist;
      const rStep =
        maxR /
        (levels.length + (firstLvlHasMulti as unknown as number) ? 1 : 0); // preserve v3's coercion

      minDist = Math.min(minDist, rStep);
    }

    // find each level's metrics.  Under avoidOverlap (115) each ring is
    // solved exactly against its own nodes and the ring inside it; the
    // boxes carry minNodeSpacing as padding
    const dims = options.avoidOverlap
      ? nodeDimsOf(this.cy, nodes, {
          includeLabels: options.nodeDimensionsIncludeLabels === true,
          padding: options.minNodeSpacing as number,
        })
      : null;
    const indexOf = new Map<Collection, number>();

    for (let i = 0; i < nodes.length; i++) {
      indexOf.set(nodes[i], i);
    }

    let r = 0;
    let inner: Ring | null = null;
    let innerR = 0;

    for (const level of levels) {
      const sweep =
        options.sweep === undefined
          ? 2 * Math.PI - (2 * Math.PI) / level.length
          : options.sweep;

      level.dTheta = sweep / Math.max(1, level.length - 1);

      if (dims != null) {
        const members = new Int32Array(level.length);
        const angles = new Float64Array(level.length);

        for (let j = 0; j < level.length; j++) {
          members[j] = indexOf.get(level[j].node) as number;
          angles[j] =
            (options.startAngle as number) +
            (clockwise ? 1 : -1) * level.dTheta * j;
        }

        const ring = { members, angles };

        level.r = ringRadius(dims, ring, inner, innerR, 0);
        inner = ring;
        innerR = level.r;
      } else {
        level.r = r;
        r += minDist;
      }
    }

    if (options.equidistant) {
      let rDeltaMax = 0;
      let rr = 0;

      for (const level of levels) {
        rDeltaMax = Math.max(rDeltaMax, (level.r as number) - rr);
      }

      rr = 0;

      for (let i = 0; i < levels.length; i++) {
        const level = levels[i];

        if (i === 0) {
          rr = level.r as number;
        }

        level.r = rr;
        rr += rDeltaMax;
      }
    }

    // positions per node handle
    const pos = new Map<Collection, Position>();

    for (const level of levels) {
      const dTheta = level.dTheta as number;
      const levelR = level.r as number;

      for (let j = 0; j < level.length; j++) {
        const val = level[j];
        const theta =
          (options.startAngle as number) + (clockwise ? 1 : -1) * dTheta * j;

        pos.set(val.node, {
          x: center.x + levelR * Math.cos(theta),
          y: center.y + levelR * Math.sin(theta),
        });
      }
    }

    return (ele: Collection): Position => pos.get(ele) as Position;
  }
}

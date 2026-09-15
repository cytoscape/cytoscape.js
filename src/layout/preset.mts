import { FLAG_LOCKED, FLAG_PARENT } from '../contract.mjs';
import { hasListeners } from '../events.mjs';
import type { Position } from '../types.mjs';
import type { PresetLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/*
Preset layout: applies `options.positions` (id-keyed map or per-node
function) and the viewport options, as v3's preset layout does.  The map
form resolves ids straight to slots and bulk-writes — O(map), no element
handles; only the function form (which takes handles by contract) walks
nodes.  With no `positions` at all, node positions are already in the
model (set at add time), so only the viewport options apply.  With
`animate`/`animateFilter`/`transform` or the `ready`/`stop` callbacks
the run finishes through the shared `eles.layoutPositions` instead
(87.3).
*/

/**
 * A supplied position must carry a finite x and a finite y (125.8): a
 * map entry of `{ x: 100 }` used to write `y: NaN` into the store, and
 * a `null` axis was coerced to 0 by the column — both silently, and
 * both the kind of half-position a data import produces.  Loud, as v4
 * is by design.
 *
 * @param pos — the position handed in for `id`
 * @param id — the node it is for, for the message
 */
const checkPosition = (pos: Position, id: string): void => {
  if (
    pos == null ||
    typeof pos.x !== 'number' ||
    typeof pos.y !== 'number' ||
    !Number.isFinite(pos.x) ||
    !Number.isFinite(pos.y)
  ) {
    throw new TypeError(
      `The preset layout's position for node '${id}' must have a finite x and y, got ${JSON.stringify(pos)}`,
    );
  }
};

const defaults: Omit<PresetLayoutOptions, 'name'> = {
  positions: undefined, // map of (node id) => position, or function(node) => position
  zoom: undefined, // the zoom level to set (prob want fit = false if set)
  pan: undefined, // the pan level to set (prob want fit = false if set)
  fit: true, // whether to fit to viewport
  padding: 30, // padding on fit
};

/**
 * Place nodes at explicitly supplied positions.
 *
 * `positions` is a map from element id to `{ x, y }`, or a function of the node; nodes without a position keep the one they have.
 */
export class PresetLayout {
  /** the resolved options this layout was created with */
  options: PresetLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'preset' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: PresetLayoutOptions) {
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  /**
   * Run the layout.  The bare call writes positions directly — the map
   * form straight to slots, one dirty span — and emits `layoutstart`/
   * `layoutready`/`layoutstop` synchronously.  With `animate`,
   * `animateFilter`, `transform` or the `ready`/`stop` callbacks
   * present, the run finishes through the shared `layoutPositions`
   * plumbing instead: under `animate: true` the nodes tween to their
   * targets and a `fit` animates the viewport to the box at the
   * *final* positions, concurrently (87.3 — previously preset ignored
   * all four and never called `ready`/`stop`).  Nodes without a
   * supplied position keep the one they have on every path.
   *
   * @returns this layout, for chaining
   */
  run(): this {
    const cy = this.cy;
    const options = this.options;
    const positions = options.positions;

    if (
      options.animate ||
      options.animateFilter != null ||
      options.transform != null ||
      options.ready != null ||
      options.stop != null
    ) {
      this.runWithFinisher();

      return this;
    }

    cy.emit({ type: 'layoutstart', layout: this });

    const scope = (options.eles as Collection | undefined) ?? cy;

    if (typeof positions === 'function') {
      // function form takes handles by contract
      scope.nodes().positions((ele: Collection) => {
        if (ele.isParent()) {
          return false;
        } // parents derive (14.11)

        const pos = (
          positions as (node: Collection) => Position | null | undefined
        )(ele);

        if (pos == null) {
          return false;
        }

        checkPosition(pos, ele.id() as string);

        return pos;
      });
    } else if (positions != null) {
      // map form: resolve ids to slots directly; absent ids keep their position
      const store = cy._store;
      const slots: number[] = [];
      const xy: number[] = [];

      for (const id of Object.keys(positions)) {
        const entry = store.lookup(id);
        const pos = positions[id];

        if (entry == null || entry.group !== 'nodes' || pos == null) {
          continue;
        }

        checkPosition(pos, id);
        if (store.hasFlag('nodes', entry.slot, FLAG_PARENT)) {
          continue;
        } // parents derive (14.11)
        if (store.hasFlag('nodes', entry.slot, FLAG_LOCKED)) {
          continue;
        } // locked nodes hold their place (114.3)

        slots.push(entry.slot);
        xy.push(pos.x, pos.y);
      }

      store.setPositions(slots, xy);

      if (hasListeners(cy._emitter, 'position')) {
        for (const slot of slots) {
          cy._emitOnEle('position', cy._ele('nodes', slot));
        }
      }
    }

    if (options.fit !== false) {
      cy.fit(options.eles as Collection | undefined, options.padding ?? 30);
    } else {
      if (options.zoom != null) {
        cy.zoom(options.zoom);
      }
      if (options.pan != null) {
        cy.pan(options.pan);
      }
    }

    cy.emit({ type: 'layoutready', layout: this });
    cy.emit({ type: 'layoutstop', layout: this });

    return this;
  }

  /** The finisher path (87.3): both forms resolve to a position per
   * node — absent entries resolve to the node's current position, so
   * an unmentioned node tweens nowhere — and the shared
   * `layoutPositions` plumbing owns animate/transform/callbacks and
   * the viewport.  `spacingFactor` is handed to it unset: the discrete
   * path ignores it (explicit positions are not scaled), and the two
   * paths must agree. */
  private runWithFinisher(): void {
    const cy = this.cy;
    const options = this.options;
    const positions = options.positions;
    const eles = (options.eles as Collection | undefined) ?? cy.elements();
    const nodes = eles.nodes();

    const getPos = (node: Collection): Position => {
      let pos: Position | null | undefined;

      if (typeof positions === 'function') {
        pos = (positions as (node: Collection) => Position | null | undefined)(
          node,
        );
      } else if (positions != null) {
        pos = positions[node.id() as string];
      }

      if (pos != null) {
        checkPosition(pos, node.id() as string);

        return pos;
      }

      const current = node.position() as Position;

      return { x: current.x, y: current.y };
    };

    nodes.layoutPositions(
      this,
      { ...options, eles, spacingFactor: undefined },
      getPos,
    );
  }
}

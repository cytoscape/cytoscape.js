import * as math from '../math.mjs';
import { FLAG_ALIVE, FLAG_LOCKED, FLAG_PARENT } from '../contract.mjs';
import { hasListeners } from '../events.mjs';
import { isSortMapping, sortComparator } from './layout-mapping.mjs';
import type { BoundingBox, Position } from '../types.mjs';
import type { GridLayoutOptions } from '../public-types.mjs';
import type { Collection } from '../collection.mjs';
import type { Core } from '../core.mjs';

/*
Grid layout: the cell-packing math is ported verbatim from v3's grid
(src/extensions/layout/grid.mts lines 76-277).  Label-aware sizing and
compound handling are dropped.

The default path never materializes element handles: cells are computed
from the size/border columns by slot and written back with one
`setPositions` call.  The `sort` and `position` callback options —
which take handles by contract — plus subset scopes and the finisher
plumbing (`animate`, `animateFilter`, `transform`, `ready`/`stop` —
87.3) fall back to the per-element path, which finishes through the
shared `eles.layoutPositions`.
*/

const defaults: Omit<GridLayoutOptions, 'name'> = {
  fit: true, // whether to fit the viewport to the graph
  padding: 30, // padding used on fit
  boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
  avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
  avoidOverlapPadding: 10, // extra spacing around nodes when avoidOverlap: true
  spacingFactor: undefined, // applies a multiplicative factor (>0) to expand or compress the overall area that the nodes take up
  condense: false, // uses all available space on false, uses minimal space on true
  rows: undefined, // force num of rows in the grid
  cols: undefined, // force num of columns in the grid
  position: undefined, // returns { row, col } for element
  sort: undefined, // a sorting function to order the nodes
};

type RowCol = { row?: number; col?: number };

/**
 * Place nodes on a regular grid, sized to fit the viewport or an explicit `boundingBox`.
 *
 * The cell-packing maths is v3's verbatim.  The default path never materializes element handles — cells come off the size and border columns by slot and land in one bulk `setPositions` write; the `sort` and `position` callbacks, which take handles by contract, fall back to the per-element path.
 */
export class GridLayout {
  /** the resolved options this layout was created with */
  options: GridLayoutOptions;

  private cy: Core;

  /**
   * Reached through `cy.layout( { name: 'grid' } )` /
   * `eles.layout( … )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — this layout's options merged over its defaults,
   *   plus the shared plumbing (`fit`, `padding`, `spacingFactor`,
   *   `transform`, `animate`, the lifecycle callbacks)
   */
  constructor(cy: Core, options: GridLayoutOptions) {
    this.cy = cy;
    this.options = { ...defaults, ...options };
  }

  /**
   * Run the layout.  The bare call takes the columnar bulk path (one
   * dirty span, no handles) and emits `layoutstart`/`layoutready`/
   * `layoutstop` synchronously.  Any handle-demanding option — `sort`,
   * `position`, a subset scope, `animate`, `animateFilter`,
   * `transform`, or the `ready`/`stop` callbacks — routes through the
   * per-element path, which finishes with the shared `layoutPositions`
   * plumbing: under `animate: true` the nodes tween to their targets
   * and a `fit` animates the viewport to the box at the *final*
   * positions, concurrently (87.3 — previously grid ignored `animate`,
   * `animateFilter` and `transform` and never called `ready`/`stop`).
   *
   * @returns this layout, for chaining
   */
  run(): this {
    const cy = this.cy;
    const options = this.options;

    const bb = math.makeBoundingBox(
      options.boundingBox ?? {
        x1: 0,
        y1: 0,
        w: cy.width(),
        h: cy.height(),
      },
    ) as BoundingBox;

    // handles when a callback option demands them, on a subset scope,
    // or when the finisher's plumbing (animate/transform/callbacks) is
    // asked for (87.3)
    if (
      options.sort != null ||
      options.position != null ||
      options.eles != null ||
      options.animate ||
      options.animateFilter != null ||
      options.transform != null ||
      options.ready != null ||
      options.stop != null
    ) {
      this.runWithHandles(bb);

      return this;
    }

    cy.emit({ type: 'layoutstart', layout: this });
    this.runBySlot(bb);

    if (options.fit !== false) {
      cy.fit(options.eles as Collection | undefined, options.padding ?? 30);
    }

    cy.emit({ type: 'layoutready', layout: this });
    cy.emit({ type: 'layoutstop', layout: this });

    return this;
  }

  /** Columnar path: cell sizes from the size/border columns, one bulk write. */
  private runBySlot(bb: BoundingBox): void {
    const cy = this.cy;
    const store = cy._store;
    const slots: number[] = [];

    // alive, not a parent (parents derive from their placed leaves), not
    // locked (114.3: a locked node holds its place and takes no cell —
    // grid places by index) — the contract's nodeSlots() mask
    if (cy.autolock() !== true) {
      store.scanSlotsInto(
        slots,
        0,
        'nodes',
        FLAG_ALIVE | FLAG_PARENT | FLAG_LOCKED,
        FLAG_ALIVE,
      );
    }

    const size = store.column('node.size') as Float32Array;
    const border = store.column('node.borderWidth') as Float32Array;

    const positions = this.cellPositions(
      slots.length,
      bb,
      (i) => size[slots[i] * 2] + border[slots[i]],
      (i) => size[slots[i] * 2 + 1] + border[slots[i]],
      null,
    );

    const xy = new Float32Array(slots.length * 2);

    for (let i = 0; i < slots.length; i++) {
      xy[i * 2] = positions[i].x;
      xy[i * 2 + 1] = positions[i].y;
    }

    store.setPositions(slots, xy);

    if (hasListeners(cy._emitter, 'position')) {
      for (const slot of slots) {
        cy._emitOnEle('position', cy._ele('nodes', slot));
      }
    }
  }

  /** Per-element path for the `sort`/`position` callback options,
   * subset scopes, and the finisher plumbing (animate/transform/
   * callbacks — 87.3).  Finishes through the shared
   * `eles.layoutPositions`; `spacingFactor` is handed to it unset
   * because `cellPositions` already applied it, identically on both
   * paths. */
  private runWithHandles(bb: BoundingBox): void {
    const cy = this.cy;
    const options = this.options;
    const eles = (options.eles as Collection | undefined) ?? cy.elements();

    // parents derive; locked nodes hold their place and take no cell
    let nodes = eles
      .nodes()
      .filter((node: Collection) => !node.isParent() && !node.locked());

    if (options.sort != null) {
      // the { data, order? } sort mapping is the serializable spelling
      // (85.3); a comparator fn stays the escape hatch
      const comparator = isSortMapping(options.sort)
        ? sortComparator(cy, options.sort, 'sort')
        : (options.sort as (a: Collection, b: Collection) => number);

      nodes = nodes.sort(comparator);
    }

    const manRaw =
      options.position != null
        ? nodes.map((node: Collection) => options.position!(node) ?? undefined)
        : null;

    const positions = this.cellPositions(
      nodes.length,
      bb,
      (i) => nodes[i].outerWidth() ?? 0,
      (i) => nodes[i].outerHeight() ?? 0,
      manRaw,
    );

    nodes.layoutPositions(
      this,
      { ...options, eles, spacingFactor: undefined },
      (_node: Collection, i: number) => positions[i],
    );
  }

  /** The ported v3 grid cell-packing math, indexed by node ordinal. */
  private cellPositions(
    cells: number,
    bb: BoundingBox,
    outerWidth: (i: number) => number,
    outerHeight: (i: number) => number,
    manRaw: (RowCol | undefined)[] | null,
  ): Position[] {
    const options = this.options;

    if (bb.h === 0 || bb.w === 0 || cells === 0) {
      return Array.from({ length: cells }, () => ({ x: bb.x1, y: bb.y1 }));
    }

    // width/height * splits^2 = cells where splits is number of times to split width
    const splits = Math.sqrt((cells * bb.h) / bb.w);
    let rows = Math.round(splits);
    let cols = Math.round((bb.w / bb.h) * splits);

    const small = (val?: number): number | undefined => {
      if (val == null) {
        return Math.min(rows, cols);
      } else {
        const min = Math.min(rows, cols);

        if (min == rows) {
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    const large = (val?: number): number | undefined => {
      if (val == null) {
        return Math.max(rows, cols);
      } else {
        const max = Math.max(rows, cols);

        if (max == rows) {
          rows = val;
        } else {
          cols = val;
        }
      }
    };

    const oRows = options.rows;
    const oCols = options.cols;

    // if rows or columns were set in options, use those values
    if (oRows != null && oCols != null) {
      rows = oRows;
      cols = oCols;
    } else if (oRows != null && oCols == null) {
      rows = oRows;
      cols = Math.ceil(cells / rows);
    } else if (oRows == null && oCols != null) {
      cols = oCols;
      rows = Math.ceil(cells / cols);
    }

    // otherwise use the automatic values and adjust accordingly
    // if rounding was up, see if we can reduce rows or columns
    else if (cols * rows > cells) {
      const sm = small() as number;
      const lg = large() as number;

      // reducing the small side takes away the most cells, so try it first
      if ((sm - 1) * lg >= cells) {
        small(sm - 1);
      } else if ((lg - 1) * sm >= cells) {
        large(lg - 1);
      }
    } else {
      // if rounding was too low, add rows or columns
      while (cols * rows < cells) {
        const sm = small() as number;
        const lg = large() as number;

        // try to add to larger side first (adds less in multiplication)
        if ((lg + 1) * sm >= cells) {
          large(lg + 1);
        } else {
          small(sm + 1);
        }
      }
    }

    let cellWidth = bb.w / cols;
    let cellHeight = bb.h / rows;

    if (options.condense) {
      cellWidth = 0;
      cellHeight = 0;
    }

    if (options.avoidOverlap !== false) {
      for (let i = 0; i < cells; i++) {
        const p = options.avoidOverlapPadding ?? 0;

        cellWidth = Math.max(cellWidth, outerWidth(i) + p);
        cellHeight = Math.max(cellHeight, outerHeight(i) + p);
      }
    }

    const cellUsed: Record<string, boolean> = {}; // e.g. 'c-0-2' => true

    const used = (row: number, col: number): boolean => {
      return cellUsed['c-' + row + '-' + col] ? true : false;
    };

    const use = (row: number, col: number): void => {
      cellUsed['c-' + row + '-' + col] = true;
    };

    // to keep track of current cell position
    let row = 0;
    let col = 0;
    const moveToNextCell = (): void => {
      col++;

      if (col >= cols) {
        col = 0;
        row++;
      }
    };

    // resolve the manual positions (marking their cells used)
    const manPos: ({ row: number; col: number } | undefined)[] | null =
      manRaw == null
        ? null
        : manRaw.map((rcPos) => {
            if (
              !rcPos ||
              (rcPos.row === undefined && rcPos.col === undefined)
            ) {
              return undefined;
            } // must have at least row or col def'd

            const pos = { row: rcPos.row, col: rcPos.col } as {
              row: number;
              col: number;
            };

            if (pos.col === undefined) {
              // find unused col
              pos.col = 0;

              while (used(pos.row, pos.col)) {
                pos.col++;
              }
            } else if (pos.row === undefined) {
              // find unused row
              pos.row = 0;

              while (used(pos.row, pos.col)) {
                pos.row++;
              }
            }

            use(pos.row, pos.col);

            return pos;
          });

    const raw: Position[] = [];

    for (let i = 0; i < cells; i++) {
      let x: number;
      let y: number;

      // see if we have a manual position set
      const rcPos = manPos?.[i];

      if (rcPos) {
        x = rcPos.col * cellWidth + cellWidth / 2 + bb.x1;
        y = rcPos.row * cellHeight + cellHeight / 2 + bb.y1;
      } else {
        // otherwise set automatically

        // without manual positions no cell is ever pre-used, so the
        // used-cell bookkeeping (string-keyed, O(cells) allocs) can be skipped
        if (manPos != null) {
          while (used(row, col)) {
            moveToNextCell();
          }
        }

        x = col * cellWidth + cellWidth / 2 + bb.x1;
        y = row * cellHeight + cellHeight / 2 + bb.y1;

        if (manPos != null) {
          use(row, col);
        }

        moveToNextCell();
      }

      raw.push({ x, y });
    }

    return this.applySpacing(raw);
  }

  /** Scale positions about their bounding-box center (as v3 layoutPositions does). */
  private applySpacing(positions: Position[]): Position[] {
    const factor = this.options.spacingFactor;

    if (factor == null || factor === 1 || positions.length === 0) {
      return positions;
    }

    const spacing = Math.abs(factor);
    const bb = math.makeBoundingBox() as BoundingBox;

    for (const pos of positions) {
      math.expandBoundingBoxByPoint(bb, pos.x, pos.y);
    }

    const center = {
      x: bb.x1 + bb.w / 2,
      y: bb.y1 + bb.h / 2,
    };

    return positions.map((pos) => ({
      x: center.x + (pos.x - center.x) * spacing,
      y: center.y + (pos.y - center.y) * spacing,
    }));
  }
}

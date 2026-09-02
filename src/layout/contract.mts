/*
The layout extension contract (round 17.5): direct objects, no
registry.

v4 has no `cytoscape.use` and no string registration — an extension
layout is an import the app passes straight in:

    import { Fcose } from 'fcose-gpu';
    cy.layout( { impl: Fcose, animate: true, ... } ).run();

`impl` is a class (constructed with no arguments) or a plain object
implementing `{ run( ctx ), stop?() }`.  `run` may return a promise —
the lifecycle waits for it (the shape a GPU-resident layout needs).
Layout instances stay non-emitters (the round-10 rule): the lifecycle
events — `layoutstart`, `layoutready`, `layoutstop`, with the wrapper
as `event.layout` — fire on the core exactly once per run, whether the
impl uses the discrete finisher or the direct bulk path.

The **LayoutContext** is columnar-first: slot-indexed reads (the live
position column, CSR degrees, edge endpoints, the scope's slots
pre-filtered to unlocked leaves — parents derive from their placed
children, the round-14 rule) and one bulk write, `setPositions`, on
the round-5 slot path (one dirty span, no per-element handles).
Handles stay reachable (`ctx.eles`, `ctx.nodes`) at handle cost — the
contract makes the columnar path the obvious one.  For discrete
layouts, `ctx.layoutPositions( fn )` is the full v3 finisher
(spacingFactor / transform / animate / fit and the lifecycle).
*/

import { FLAG_ALIVE, FLAG_LOCKED, FLAG_PARENT } from '../contract.mjs';
import { computeComponents, packComponentBodies } from './pack.mjs';
import type { Components } from './pack.mjs';
import { nodeDims } from './dims.mjs';
import type { DimsOptions, LayoutNodeDims } from './dims.mjs';
import type { Core } from '../core.mjs';
import type { Collection } from '../collection.mjs';
import type {
  CustomLayoutOptions,
  LayoutBaseOptions,
  Position,
} from '../public-types.mjs';

export interface LayoutImpl {
  run(ctx: LayoutContext): void | Promise<void>;
  stop?(): void;
}

export class LayoutContext {
  // -- scope --

  /** the core being laid out */
  readonly cy: Core;
  /** the resolved layout options (custom knobs included) */
  readonly options: CustomLayoutOptions;
  private _eles: Collection | null = null;
  private _nodes: Collection | null = null;

  /**
   * The layout scope (handles tier); the whole graph unless this run
   * came from `eles.layout()`.
   *
   * **Lazy since round 34.4.**  It used to be assigned in the
   * constructor, which meant every run of every layout materialized
   * `cy.elements()` — a handle per element — including for the
   * columnar-first layouts this contract exists to encourage, which
   * never touch it.  That cost 333 µs per run at 25k elements for an
   * impl that does nothing.  Reading it still costs what it always did;
   * not reading it is now free.
   *
   * @returns the scope's handles — `eles.layout()`'s collection, or the
   *   whole graph's elements when the layout was started from the core.
   *   Materialized on first read and cached for the run
   */
  get eles(): Collection {
    return (this._eles ??=
      (this.options.eles as Collection | undefined) ?? this.cy.elements());
  }

  /**
   * The scope's node handles (lazy — see `eles`).
   *
   * @returns the node subset of `eles`, *unfiltered* — unlike
   *   `nodeSlots()`, this keeps locked nodes and compound parents, so a
   *   layout iterating it must apply its own rules
   */
  get nodes(): Collection {
    return (this._nodes ??= this.eles.nodes());
  }

  /** the discrete finisher ran: its lifecycle covers the run */
  _finisherUsed = false;

  private layout: object;
  private slots: number[] | null = null;

  /**
   * Built by the wrapper, once per run — a layout impl receives one of
   * these and never constructs it.
   *
   * @param cy — the core being laid out
   * @param layout — the wrapper, passed through as `event.layout` on the
   *   lifecycle events
   * @param options — the resolved layout options; `eles` narrows the
   *   scope (from `eles.layout()`), defaulting to the whole graph
   */
  constructor(cy: Core, layout: object, options: CustomLayoutOptions) {
    this.cy = cy;
    this.layout = layout;
    this.options = options;
    // `eles`/`nodes` are lazy getters (34.4): a columnar layout never
    // pays for handles it does not ask for
  }

  // -- columnar reads --

  /**
   * The slots to lay out: the scope's nodes, pre-filtered to unlocked
   * leaves (locked nodes hold their place; parents derive from their
   * placed children — round 14.11).  Scope order.
   *
   * @returns the slots to place, in exactly `cy.nodes()` order — which is
   *   load-bearing rather than incidental, since grid and circle assign
   *   positions by index, so a different enumeration order is a different
   *   layout
   */
  nodeSlots(): number[] {
    if (this.slots != null) {
      return this.slots;
    }

    const store = this.cy._store;
    const scope = this.options.eles as Collection | undefined;
    const out: number[] = [];

    if (this.cy.autolock() === true) {
      // every node is locked: nothing to place (114.3)
      this.slots = out;

      return out;
    }

    if (scope == null) {
      // Whole graph: walk the store's insertion-order list directly
      // (34.4).  This is the same walk `scanRefsInto` takes — and so the
      // same order `cy.nodes()` produces, which layouts depend on since
      // grid and circle place by index — but in slot space, with no ref
      // allocated and no handle interned.  The mask is the old
      // per-element filter in one test: alive, not a parent (parents
      // derive from their placed children), not locked.
      store.scanSlotsInto(
        out,
        0,
        'nodes',
        FLAG_ALIVE | FLAG_PARENT | FLAG_LOCKED,
        FLAG_ALIVE,
      );
    } else {
      // Subset scope: the caller already holds the collection, so its
      // refs are the cheap path — still no handles.
      for (const ref of scope._liveRefs()) {
        if (ref.group !== 'nodes') {
          continue;
        }

        if (
          store.hasFlag('nodes', ref.slot, FLAG_PARENT) ||
          store.hasFlag('nodes', ref.slot, FLAG_LOCKED)
        ) {
          continue;
        }

        out.push(ref.slot);
      }
    }

    this.slots = out;

    return out;
  }

  /**
   * The scope's edge slots.
   *
   * @returns every live edge of the scope in `cy.edges()` order, with no
   *   filtering — the counterpart of `nodeSlots()`, which does filter
   */
  edgeSlots(): number[] {
    const scope = this.options.eles as Collection | undefined;
    const out: number[] = [];

    if (scope == null) {
      // whole graph: the order-list walk, as in nodeSlots (34.4)
      this.cy._store.scanSlotsInto(out, 0, 'edges', FLAG_ALIVE, FLAG_ALIVE);
    } else {
      for (const ref of scope._liveRefs()) {
        if (ref.group === 'edges') {
          out.push(ref.slot);
        }
      }
    }

    return out;
  }

  /**
   * The live position column (x,y interleaved by slot) — read it, write
   * through `setPositions`.
   *
   * @returns the store's own column, not a copy: it changes underneath a
   *   held reference as positions are written, and writing into it
   *   directly bypasses the dirty tracking the renderer depends on
   */
  positions(): Float32Array {
    return this.cy._store.column('node.position') as Float32Array;
  }

  /**
   * The live edge endpoint column (source,target node slots).
   *
   * @returns the store's own column, indexed by edge slot — node *slots*,
   *   not ids, so it pairs directly with `positions()` without a lookup
   */
  endpoints(): Uint32Array {
    return this.cy._store.column('edge.endpoints') as Uint32Array;
  }

  /**
   * O(1) degree off the CSR adjacency.
   *
   * @param slot — a node slot, as handed out by `nodeSlots()`
   * @returns its whole-graph degree, loops counted as v3 counts them
   */
  degreeOf(slot: number): number {
    const adj = this.cy._store.adj;

    return adj.outDegree(slot) + adj.inDegree(slot);
  }

  /**
   * The layout boxes of the scope's nodes (round 114.1): slot-parallel
   * node-local extents read off the size, border and label columns —
   * the one reading every built-in spaces by.  Labels are included
   * unless the run's `nodeDimensionsIncludeLabels` is `false`, so the
   * box is asymmetric when a label hangs below the body; take
   * `max( -y1, y2 )` for a symmetric half.  Headless label dimensions
   * are estimates (16.4), exact once a renderer has laid the glyphs.
   *
   * @param slots — the node slots to measure (default `nodeSlots()`)
   * @param options — `includeLabels` (default: the run's option, itself
   *   defaulting to true) and `padding` (split half per side)
   * @returns the boxes, parallel to `slots`
   */
  nodeDimensions(
    slots: ArrayLike<number> = this.nodeSlots(),
    options: DimsOptions = {},
  ): LayoutNodeDims {
    return nodeDims(this.cy._store, slots, {
      includeLabels:
        options.includeLabels ??
        this.options.nodeDimensionsIncludeLabels !== false,
      padding: options.padding,
    });
  }

  // -- bounds --

  /**
   * The scope's current bounding box, labels included.
   *
   * @returns `{ x1, y1, x2, y2, w, h }` in model coordinates
   */
  boundingBox(): ReturnType<Collection['boundingBox']> {
    return this.eles.boundingBox();
  }

  /**
   * The viewport width in CSS px — what a layout sizing itself to the
   * screen should use.  Headless instances report the configured
   * headless width, so a layout still works without a DOM.
   *
   * @returns the viewport width
   */
  width(): number {
    return this.cy.width() as number;
  }

  /**
   * The viewport height in CSS px.
   *
   * @returns the viewport height
   */
  height(): number {
    return this.cy.height() as number;
  }

  // -- writing positions --

  /**
   * The bulk write: xy[i*2], xy[i*2+1] land on slots[i] — one dirty
   * span, no handles (the round-5 slot path; under compounds it takes
   * the per-slot sequential path so auto-bounds stay exact).
   *
   * @param slots — the node slots to move
   * @param xy — the packed positions: `xy[i*2]`, `xy[i*2+1]` land on
   *   `slots[i]`
   */
  setPositions(slots: number[], xy: number[] | Float32Array): void {
    this.cy._store.setPositions(slots, xy);
  }

  /**
   * The scope's connected components over `nodeSlots()` (round 114.4,
   * factored out of `packComponents` for layouts that pack their own
   * arrays): union-find over the scope's own edges — an edge with an
   * endpoint outside the scope connects nothing here — indexed by
   * position in `nodeSlots()`.
   *
   * @returns the component assignment, ids in first-seen node order
   */
  components(): Components {
    const slots = this.nodeSlots();
    const n = slots.length;
    const simIndex = new Map<number, number>();

    for (let i = 0; i < n; i++) {
      simIndex.set(slots[i], i);
    }

    const endpoints = this.endpoints();
    const simEdges: number[] = [];

    for (const edgeSlot of this.edgeSlots()) {
      const s = simIndex.get(endpoints[edgeSlot * 2]);
      const t = simIndex.get(endpoints[edgeSlot * 2 + 1]);

      if (s == null || t == null || s === t) {
        continue;
      }

      simEdges.push(s, t);
    }

    return computeComponents(n, Uint32Array.from(simEdges));
  }

  /**
   * Separate the scope's disconnected components (round 87.1): v3's
   * `separateComponents` as a one-call, translation-only post-pass.
   * Per-component bounding boxes at the current positions are
   * shelf-packed largest-first with `spacing` between them, every
   * member translated with its component, and the largest component's
   * centre held fixed — the dominant structure keeps its place and the
   * strays come to it.
   *
   * The boxes are **body** boxes since round 114.4 (`nodeDimensions()`,
   * labels included by the run's option), so two singleton components
   * end up `spacing` apart edge to edge rather than centre to centre;
   * `bodies: false` restores the 87.1 point boxes.
   *
   * Components are computed over the scope's own edges (an edge with an
   * endpoint outside the scope connects nothing here), and only the
   * `nodeSlots()` nodes move — a locked node neither moves nor holds
   * its component in place, so a scope mixing locked and unlocked
   * members of one component can separate them.  The write lands
   * through `setPositions` (one dirty span).
   *
   * @param spacing — the gap between packed component boxes
   *   (default 40, the force layout's `componentSpacing` default)
   * @param options — `bodies` (default true) packs the nodes' boxes
   *   rather than their positions; `includeLabels` overrides the run's
   *   `nodeDimensionsIncludeLabels` for those boxes; `positions` packs
   *   that array (2n, parallel to `nodeSlots()`) in place instead of
   *   the store — for a layout that lands through `finish()` and must
   *   not write positions before the tween starts
   */
  packComponents(
    spacing: number = 40,
    options: {
      bodies?: boolean;
      includeLabels?: boolean;
      positions?: Float32Array | Float64Array;
    } = {},
  ): void {
    const slots = this.nodeSlots();
    const n = slots.length;

    if (n === 0) {
      return;
    }

    const comps = this.components();

    if (comps.count <= 1) {
      return;
    }

    let xy = options.positions;

    if (xy == null) {
      const column = this.positions();

      xy = new Float32Array(n * 2);

      for (let i = 0; i < n; i++) {
        xy[i * 2] = column[slots[i] * 2];
        xy[i * 2 + 1] = column[slots[i] * 2 + 1];
      }
    }

    const extents =
      options.bodies === false
        ? null
        : this.nodeDimensions(slots, { includeLabels: options.includeLabels });

    packComponentBodies(
      n,
      comps.compOf,
      comps.count,
      xy,
      extents,
      spacing,
      true,
    );

    if (options.positions == null) {
      this.setPositions(slots, xy as Float32Array);
    }
  }

  /**
   * The discrete finisher: v3's layoutPositions plumbing over the
   * scope — spacingFactor, transform, animate (with the
   * fit-at-final-positions viewport animation), fit/zoom/pan, and the
   * layoutready/layoutstop events.  The wrapper's layoutstart covers
   * the start (no double emit).
   *
   * @param fn — called per scoped node with the node and its index,
   *   returning the model position to place it at
   * @param overrides — an impl's own defaults, merged over the run's
   *   options (round 114.2: flow's `fit: true` default never reached
   *   the finisher before this).  `ready` and `stop` are never
   *   overridden — the wrapper's `stop` is what resolves `promise()`
   */
  layoutPositions(
    fn: (node: Collection, i: number) => Position,
    overrides: LayoutBaseOptions = {},
  ): void {
    this._finisherUsed = true;
    this.eles.layoutPositions(
      this.layout,
      {
        ...this.options,
        ...overrides,
        ready: this.options.ready,
        stop: this.options.stop,
        eles: this.eles,
        _startEmitted: true,
      } as CustomLayoutOptions,
      fn,
    );
  }

  /**
   * Land computed positions the way a built-in does (round 114.2): the
   * finisher when the run asks for anything it owns — `animate`,
   * `animateFilter`, `transform`, `spacingFactor` — and otherwise the
   * bulk slot write followed by fit / zoom / pan.  One rule for flow,
   * force and any extension that computes into an array.
   *
   * @param slots — the node slots the positions land on
   * @param xy — the packed positions: `xy[i*2]`, `xy[i*2+1]` for
   *   `slots[i]`
   * @param overrides — the impl's defaults, merged as `layoutPositions`
   *   merges them
   */
  finish(
    slots: number[],
    xy: ArrayLike<number>,
    overrides: LayoutBaseOptions = {},
  ): void {
    const o = { ...this.options, ...overrides };

    if (
      o.animate === true ||
      o.animateFilter != null ||
      o.transform != null ||
      (o.spacingFactor != null && o.spacingFactor !== 1)
    ) {
      const posOf = new Map<number, Position>();

      for (let i = 0; i < slots.length; i++) {
        posOf.set(slots[i], { x: xy[i * 2], y: xy[i * 2 + 1] });
      }

      this.layoutPositions((node: Collection): Position => {
        const ref = node._eventRef();

        return (
          (ref != null ? posOf.get(ref.slot) : undefined) ??
          (node.position() as Position)
        );
      }, overrides);

      return;
    }

    this.setPositions(slots, xy as number[] | Float32Array);

    if (o.fit !== false) {
      this.cy.fit(this.eles, o.padding ?? 30);
    } else {
      if (o.zoom != null) {
        this.cy.zoom(o.zoom);
      }

      if (o.pan != null) {
        this.cy.pan(o.pan as Position);
      }
    }
  }
}

/** The wrapper cy.layout({ impl }) returns: the builtins' shape plus
 * promise() (resolves at this run's layoutstop). */
export class CustomLayout {
  // -- running a layout --

  /** the resolved options this run was created with */
  options: CustomLayoutOptions;

  private cy: Core;
  private impl: LayoutImpl;
  private donePromise: Promise<void> = Promise.resolve();

  /**
   * Wrap a layout impl.  Reached through `cy.layout( { impl } )` /
   * `eles.layout( { impl } )` rather than constructed directly.
   *
   * @param cy — the core to lay out
   * @param options — must carry `impl`, a class constructed with no
   *   arguments or a plain object, implementing `{ run( ctx ), stop?() }`
   * @throws if `impl` is missing, or does not implement `run( ctx )`
   */
  constructor(cy: Core, options: CustomLayoutOptions) {
    const provided = options.impl;
    let impl: LayoutImpl;

    if (typeof provided === 'function') {
      impl = new (provided as new () => LayoutImpl)();
    } else if (provided != null && typeof provided === 'object') {
      impl = provided as LayoutImpl;
    } else {
      throw new Error(`A custom layout needs an impl class or object`);
    }

    if (typeof impl.run !== 'function') {
      throw new Error(`A layout impl must implement run( ctx )`);
    }

    this.cy = cy;
    this.impl = impl;
    this.options = options;
  }

  /**
   * Start the layout.  Emits `layoutstart` on the core, calls
   * `impl.run( ctx )` and awaits it if it returns a promise (the shape a
   * GPU-resident layout needs).
   *
   * The lifecycle fires exactly once per run either way: an impl that
   * finishes through `ctx.layoutPositions()` lets the finisher emit
   * `layoutready`/`layoutstop`, and one that writes positions directly
   * has them emitted here instead.
   *
   * @returns this layout, for chaining; await `promise()` for
   *   completion
   */
  run(): this {
    const cy = this.cy;
    let resolve!: () => void;

    this.donePromise = new Promise<void>((r) => {
      resolve = r;
    });

    const ctx = new LayoutContext(cy, this, {
      ...this.options,
      // the finisher resolves the run promise at its stop callback
      stop: () => {
        this.options.stop?.();
        resolve();
      },
    });

    cy.emit({ type: 'layoutstart', layout: this });

    Promise.resolve(this.impl.run(ctx)).then(() => {
      if (ctx._finisherUsed) {
        return;
      } // its lifecycle covers the run

      this.options.ready?.();
      cy.emit({ type: 'layoutready', layout: this });
      this.options.stop?.();
      cy.emit({ type: 'layoutstop', layout: this });
      resolve();
    });

    return this;
  }

  /** Resolves at this run's layoutstop (immediately when never run). */
  promise(): Promise<void> {
    return this.donePromise;
  }

  /**
   * Ask the layout to stop early, by calling the impl's optional
   * `stop()`.  An impl without one simply runs to completion.
   *
   * @returns this layout, for chaining
   */
  stop(): this {
    this.impl.stop?.();

    return this;
  }
}

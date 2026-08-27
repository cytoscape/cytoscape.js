import { GraphStore } from './store/graph-store.mjs';
import { Collection } from './collection.mjs';
import { buildColumnar, isColumnarElements } from './columnar.mjs';
import type { FlagOverride } from './columnar.mjs';
import {
  deserializeElements,
  isSerializedElements,
  serializeElements,
} from './wire.mjs';
import { partitionDefs } from './element-defs.mjs';
import type { PartitionedDefs } from './element-defs.mjs';
import {
  hasListeners,
  makeCoreEmitter,
  predicateQualifier,
  refKey,
} from './events.mjs';
import type { ElePredicate, Qualifier, PhasedEvent } from './events.mjs';
import { Event } from './event.mjs';
import { compileQuery } from './matcher.mjs';
import type { FlagTest, Query } from './matcher.mjs';
import { testCondition } from './style-scales.mjs';
import type { CompiledCondition } from './style-scales.mjs';
import { Viewport, type ZoomOptions, type Extent } from './viewport.mjs';
import { StyleEngine } from './style.mjs';
import {
  Animation,
  AnimationHandleImpl,
  AnimationManager,
} from './animation.mjs';
import type { AnimateOptions, AnimationHandle } from './animation.mjs';
import * as math from './math.mjs';
import type { BoundsLike } from './viewport.mjs';
import { CustomLayout } from './layout/contract.mjs';
import { ForceLayoutImpl } from './layout/force.mjs';
import type { CustomLayoutOptions } from './public-types.mjs';
import { GridLayout } from './layout/grid.mjs';
import { PresetLayout } from './layout/preset.mjs';
import { CircleLayout } from './layout/circle.mjs';
import { ConcentricLayout } from './layout/concentric.mjs';
import { BreadthFirstLayout } from './layout/breadthfirst.mjs';
import { RandomLayout } from './layout/random.mjs';

export type Layout =
  | CustomLayout
  | GridLayout
  | PresetLayout
  | CircleLayout
  | ConcentricLayout
  | BreadthFirstLayout
  | RandomLayout;
import type { Emitter } from './emitter.mjs';
import type { EventHandler } from './emitter.mjs';
import type { EventProps } from './event.mjs';
import {
  FLAG_ALIVE,
  FLAG_GRABBABLE,
  FLAG_LOCKED,
  FLAG_PANNABLE,
  FLAG_SELECTABLE,
  FLAG_SELECTED,
  NO_SLOT,
} from './contract.mjs';
import { EDGE_PICK_BIT } from './render/picking.mjs';
import { NO_PARENT } from './public-types.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type {
  BoxSelectionMode,
  CytoscapeOptions,
  ColumnarElements,
  ElementDefinition,
  ElementsDefinition,
  ElementsInput,
  ExportOptions,
  LayoutOptions,
  Stylesheet,
  Position,
  RendererStats,
} from './public-types.mjs';
import type { EleFilterFn } from './collection.mjs';

/** What the core needs from the renderer (wired by the factory), plus the
 * documented public surface reachable via `cy.renderer()` (e.g. `stats()`). */
export interface RendererLike {
  destroy(): void;
  /** resolves with the packed pick id under the point (a slot + 1, with
   * the edge namespace bit for edges), or null for background — decoded
   * and re-validated by {@link Core._decodePick} (round 86.2) */
  pick(x: number, y: number): Promise<number | null>;
  requestRender(): void;
  resize(): void;
  stats(): RendererStats;
  /** true while a GPU force-layout run owns the position column (18.3) */
  forceActive(): boolean;
  exportImage(options: ExportOptions): Promise<{
    data: Uint8ClampedArray<ArrayBuffer>;
    width: number;
    height: number;
  }>;
}

export interface LayoutLike {
  run(): LayoutLike;
}

const DEFAULT_HEADLESS_WIDTH = 800;
const DEFAULT_HEADLESS_HEIGHT = 600;

/** dead slots below this never auto-compact (small graphs don't churn) */
const COMPACT_FLOOR = 1024;

/** The hosting window, resolved once at module load — its existence
 * cannot change at runtime, and `cy.window()` is called often enough in
 * extensions that the per-call typeof test showed (round 62.4). */
const GLOBAL_WINDOW: (Window & typeof globalThis) | null =
  typeof window !== 'undefined' ? window : null;

/** The memoized unfiltered collections and the structure epoch they belong to (round 34.2). */
interface AllCache {
  epoch: number;
  all: Collection | null;
  nodes: Collection | null;
  edges: Collection | null;
}

/** Style work deferred by an open batch (flushed once at the outermost endBatch). */
interface BatchPending {
  /** the sheet changed during the batch: one applyAll() subsumes the per-slot work */
  sheet: boolean;
  /** freshly-added elements awaiting their first style apply */
  style: Ref[];
  /** elements whose data()-mapped style channels need re-deriving */
  mapped: Ref[];
  /** the data keys those writes touched (refresh gates per group on them) */
  mappedKeys: Set<string>;
}

/**
 * The Core facade: the familiar synchronous core API over the columnar
 * store (#3486).  See src/README.md for the maintained API scope —
 * viewport, events, graph manipulation, compounds, style/mappers/
 * transitions, layouts, animation, algorithms, image export,
 * mount/unmount.
 */
export class Core {
  _store: GraphStore;
  _emitter: Emitter<Core, Qualifier>;
  _styleEngine: StyleEngine;
  _renderer: RendererLike | null;
  /** the pointer handler paired with the renderer (torn down on unmount) */
  _pointer: { destroy(): void } | null;
  /** wired by the factory: (re)attaches a renderer + pointer to a container */
  _attachFn: ((container: HTMLElement) => void) | null;
  private _recoveringDevice: boolean;
  /** the zoom/pan state object — reach it through cy's own viewport
   * surface
   * @internal */
  _viewport: Viewport;

  // -- lifecycle --

  /** resolves once the render pipeline is usable (immediately when headless) */
  ready: Promise<Core>;

  /** true once the render pipeline is usable (immediately when headless) */
  _readyResolved: boolean;

  /** interned singleton handles, dense by slot (slots are dense, so an array beats a Map) */
  _pool: {
    nodes: (Collection | undefined)[];
    edges: (Collection | undefined)[];
  };
  private _container: HTMLElement | null;
  private _options: CytoscapeOptions;
  private _headlessWidth: number;
  private _headlessHeight: number;
  private _destroyed: boolean;
  private _idCounter: number;
  private _scratch: Record<string, unknown>;
  private _graphData: Record<string, unknown>;
  private _autolock: boolean;
  private _autoungrabify: boolean;
  private _autounselectify: boolean;
  private _panningEnabled: boolean;
  private _userPanningEnabled: boolean;
  private _zoomingEnabled: boolean;
  private _userZoomingEnabled: boolean;
  private _boxSelectionEnabled: boolean;
  /** box selection considers label boxes too (16.5; default off — v3).
   * Narrows a 'contain' selection, widens an 'overlap' one (39.1). */
  private _boxSelectionIncludesLabels: boolean;
  private _boxSelectionMode: BoxSelectionMode;
  private _selectionType: 'single' | 'additive';
  private _multiClickDebounceTime: number;
  /** round 20.1: the interaction option quartet (v3 defaults) */
  private _wheelSensitivity: number;
  private _wheelSensitivityWarned: boolean;
  private _desktopTapThreshold: number;
  private _touchTapThreshold: number;
  private _tapholdDuration: number;
  private _batchDepth: number;
  private _batchPending: BatchPending | null;
  /** round 34.2: the memoized unfiltered collections, keyed by store structure epoch */
  private _allCache: AllCache | null = null;
  /** round 62.6: the whole-graph memo flattened to one field, so the
   * `elements()` hit is a single load — nulled by
   * the same push-invalidation as `_allCache` */
  private _allEles: Collection | null = null;
  _animations: AnimationManager;

  /**
   * Build a core over a fresh columnar store.  Prefer the `cytoscape(
   * options )` factory: it is the documented entry point and additionally
   * ingests `options.elements`, runs `options.layout`, and attaches a
   * renderer when a `container` is given.  Constructing directly yields a
   * headless, empty instance regardless of those options.
   *
   * **Unknown options are ignored, deliberately** (decided 2026-08-04, fifth
   * design sitting).  This is the one v4 entry point that does not fail loudly
   * on a name it does not know — an unknown sheet key, style property or query
   * key all throw — because strictness here resolves at the *type* layer:
   * TypeScript's excess-property check rejects `{ motionBlur: true }` and any
   * other typo against `CytoscapeOptions`, and v4 does not replicate at
   * runtime what the build already checks.  The boundary is TypeScript's:
   * excess-property checking applies to object literals, so options assembled
   * into a variable first are widened and pass.  Pinned by the compile-only
   * consumer test in `typescript/tests/gpu.test-d.ts`.
   *
   * @param options — the instance options (see `CytoscapeOptions`);
   *   viewport, interaction-gating and interaction-tuning options are
   *   applied here, and `style` compiles immediately.  Unrecognized keys are
   *   kept as given and returned by `options()`, never validated.
   */
  constructor(options: CytoscapeOptions = {}) {
    this._store = new GraphStore();
    this._emitter = makeCoreEmitter<Core>(this);
    this._styleEngine = new StyleEngine(this._store);

    // the compounds 0 <-> >0 transitions change paint eval config (the
    // opacity fold demotes the GPU opacity mapper, round 14.4)
    this._store.onCompoundsToggled = () => {
      this._styleEngine.paintVersion++;
    };

    // a leaf <-> parent flip restyles the slot against the right sheet
    // group (nodes vs the parents overlay, round 14.6); the label entry
    // re-bakes through the same apply
    this._store.onParentFlip = (slot) => {
      this._styleEngine.applyBulk('nodes', [slot]);
    };

    // a reparented node's structural case conditions ({ child: ... } /
    // { parent: ... }) re-evaluate via the pseudo-key refresh (14.7),
    // and any live GPU tween settles to the CPU first — the moved slots
    // now sit under CPU-side derivations (auto-bounds, folds; 14.11)
    this._store.onReparented = (slot) => {
      this._animations.settleGpuAll();
      this._styleEngine.refreshMapped('nodes', [slot], ['::parent', '::child']);
    };
    // A styled state bit flipped (round 57.1): re-evaluate the mappers
    // that read it, on the slots that changed.  The store notifies only
    // for bits some `case` condition actually mentions, so a sheet that
    // says nothing about selection or press never reaches here.  Round
    // 61 routes the flip through the partition-diff fast path — a
    // default-sheet select writes one channel per slot, not the element
    // (the 60.4 regression's fix).
    this._store.onStateChange = (group, key, slots) => {
      this._styleEngine.refreshState(group, key, slots);
    };
    // round 62.5b: push-invalidate the whole-graph collection cache, so
    // the memo-hit read (`elements()`) needs no epoch
    // compare at all
    this._store.onStructureChange = () => {
      this._allCache = null;
      this._allEles = null;
    };
    this._animations = new AnimationManager(() => this._afterAnimationTick());

    // round 24.1: the engine's transition diffs spawn preset bulk tweens
    // through the manager — the round-21 channel eviction gives uniform
    // latest-wins between transitions and user animations
    this._styleEngine.transitionSink = (refs, writes, opts) => {
      this._animations.start(Animation.preset(this._store, refs, writes, opts));
    };
    this._renderer = null;
    this._pointer = null;
    this._attachFn = null;
    this._recoveringDevice = false;
    this._pool = { nodes: [], edges: [] };
    this._container = options.container ?? null;
    this._options = options;
    this._headlessWidth = options.headlessWidth ?? DEFAULT_HEADLESS_WIDTH;
    this._headlessHeight = options.headlessHeight ?? DEFAULT_HEADLESS_HEIGHT;
    this._destroyed = false;
    this._idCounter = 0;
    this._scratch = {};
    this._graphData = {};
    this._autolock = options.autolock ?? false;
    this._autoungrabify = options.autoungrabify ?? false;
    this._autounselectify = options.autounselectify ?? false;
    this._panningEnabled = options.panningEnabled ?? true;
    this._userPanningEnabled = options.userPanningEnabled ?? true;
    this._zoomingEnabled = options.zoomingEnabled ?? true;
    this._userZoomingEnabled = options.userZoomingEnabled ?? true;
    this._boxSelectionEnabled = options.boxSelectionEnabled ?? true;
    this._boxSelectionIncludesLabels =
      options.boxSelectionIncludesLabels ?? false;
    this._boxSelectionMode = 'contain';
    this._selectionType = 'single';
    this._multiClickDebounceTime = 250; // v3's default
    this._wheelSensitivity = 1; // v3's default (a multiplier on the zoom rate)
    this._wheelSensitivityWarned = false;
    this._desktopTapThreshold = 4; // v3's defaults: css px of movement
    this._touchTapThreshold = 8; // before a press stops being a tap
    this._tapholdDuration = 500; // v3's (hardcoded) press-and-hold duration
    this._batchDepth = 0;
    this._batchPending = null;

    if (options.boxSelectionMode != null) {
      this.boxSelectionMode(options.boxSelectionMode);
    }

    if (options.selectionType != null) {
      this.selectionType(options.selectionType);
    }

    if (options.multiClickDebounceTime != null) {
      this.multiClickDebounceTime(options.multiClickDebounceTime);
    }

    if (options.wheelSensitivity != null) {
      this.wheelSensitivity(options.wheelSensitivity);
    }

    if (options.desktopTapThreshold != null) {
      this.desktopTapThreshold(options.desktopTapThreshold);
    }

    if (options.touchTapThreshold != null) {
      this.touchTapThreshold(options.touchTapThreshold);
    }

    if (options.tapholdDuration != null) {
      this.tapholdDuration(options.tapholdDuration);
    }
    this._readyResolved = this._container == null; // headless is ready immediately
    this._viewport = new Viewport(this, {
      zoom: options.zoom,
      pan: options.pan,
      minZoom: options.minZoom,
      maxZoom: options.maxZoom,
    });
    this.ready = Promise.resolve(this);

    if (options.style != null) {
      this._styleEngine.setSheet(options.style);
    }
  }

  // -- style --

  /**
   * Get the style engine, or set the stylesheet and return it.
   *
   * v4's sheet is a plain `{ nodes, edges, parents, core }` object of prop
   * objects — there are no selector blocks and no style functions.  All
   * per-element variation is declarative: mapper objects (`{ data, scale,
   * … }`) and `case` conditionals, which is what keeps every value
   * analyzable, serializable and GPU-evaluable.
   *
   * Inside a batch the sheet is compiled and validated immediately (so
   * errors still throw at the call site) but applied once at the outermost
   * `endBatch()`.
   *
   * @param sheet — the stylesheet to install; omit to read the engine
   * @returns the style engine (also reachable as the return value when
   *   setting, so calls chain)
   * @throws if the sheet references an unknown property or an invalid
   *   value
   */
  style(sheet?: Stylesheet): StyleEngine {
    if (sheet != null) {
      if (this._batchPending != null) {
        // compile (and validate) now; apply once at the outermost endBatch
        this._styleEngine.setSheet(sheet, false);
        this._batchPending.sheet = true;
      } else {
        this._styleEngine.setSheet(sheet);
      }

      this.emit('style');
    }

    return this._styleEngine;
  }

  // -- batching --

  /*
  Batch semantics (as in v3): a batch defers *style application* — the
  first style apply of added elements, sheet re-application, and
  data-mapped label refresh — until the outermost endBatch(), where the
  deferred work flushes as one bulk pass.  Events still fire during the
  batch, and reads of style-derived state (width(), label(), ...) may be
  stale inside it.  Renderer scheduling needs no deferral: the dirty
  tracker already coalesces per microtask, after the batch's synchronous
  block.
  */

  /**
   * True while inside a startBatch()/endBatch() pair.
   *
   * @returns whether a batch is open at *any* depth — nesting is counted,
   *   and only the outermost `endBatch` flushes the deferred style work
   * @internal
   */
  batching(): boolean {
    return this._batchDepth > 0;
  }

  /**
   * Slot-moving compaction, explicit form (round 19.5): move live
   * elements down to a dense slot prefix so `highWater`, column capacity
   * and pass-iteration widths shrink to the current graph instead of its
   * peak.  A monotone remap keeps draw order — compaction is a visual
   * no-op — and held refs/handles/listeners repair through forwarding
   * (19.3).  The automatic dead-slot-ratio trigger covers the common
   * shrink/churn profiles; this call is for deterministic timing (e.g.
   * right after a bulk filter, before an animation).  Throws mid-batch;
   * defers with a warning while a GPU force layout runs.
   */
  compact(): this {
    this._compact();

    return this;
  }

  /**
   * v3's `cy.gc()`, kept as the spelling an upgrading app already has
   * (round 39.3).  It is an exact alias of `compact()` — the same
   * slot-moving compaction, the same triggers and the same refusals —
   * because what `gc` meant in v3 is what round 19 built.  v4 has no
   * separate garbage-collection concept for it to name: element bytes are
   * reclaimed by the slot free-list at `remove()`, and the slot-stable
   * structures self-compact on their own waste thresholds (round 11).
   *
   * @see Core#compact — the documented form, and where the semantics live
   */
  declare gc: this['compact'];

  /**
   * The automatic trigger (19.5), checked at safe boundaries — a
   * completed removal, the outermost endBatch: compact when a group's
   * dead slots exceed its live count (the round-11 waste-over-half
   * policy) past a floor that keeps small graphs from churning.  Defers
   * silently while batching or while a GPU force run owns positions.
   */
  _maybeCompact(): void {
    if (this._batchDepth > 0 || this._destroyed) {
      return;
    }
    if (this._renderer?.forceActive()) {
      return;
    } // re-checked on the next boundary

    for (const group of ['nodes', 'edges'] as GroupName[]) {
      const table = this._store.table(group);
      const dead = table.highWater - table.count;

      if (dead > COMPACT_FLOOR && dead > table.count) {
        this._compact();

        return;
      }
    }
  }

  /**
   * Slot compaction, core tier (round 19.3; the public trigger policy is
   * 19.5): settle any GPU-driven tweens (the reparent precedent), compact
   * the store, then repair the core-held slot-keyed state — the interned
   * handle pool moves with its elements (handle identity and scratch
   * survive), element-bound listener qualifiers repair in place and
   * re-key so later off() calls match, and the animation queues re-key
   * with their slot arrays re-pointed.  Throws mid-batch: the deferred
   * style refs hold slots and the flush must not straddle a remap.
   */
  _compact(): void {
    if (this._batchDepth > 0) {
      throw new Error('Can not compact inside a batch');
    }

    if (this._renderer?.forceActive()) {
      // the sim owns node.position on-device (the 18.3 lease); moving
      // slots under it would scatter the integrator's writes — defer
      console.warn('Deferring slot compaction: a GPU force layout is running');

      return;
    }

    // GPU-driven tweens leave the device (their slot buffers hold the
    // old slots) but keep running on the CPU with repaired slot lists
    this._animations.demoteGpuAll();

    const result = this._store.compact();

    if (result.nodes == null && result.edges == null) {
      return;
    }

    this._remapPool('nodes', result.nodes?.remap ?? null);
    this._remapPool('edges', result.edges?.remap ?? null);

    for (const listener of this._emitter.listeners) {
      const qualifier = listener.qualifier;

      if (qualifier?.ref != null) {
        this._store.isCurrent(qualifier.ref); // repairs in place
        qualifier.key = 'ref:' + refKey(qualifier.ref);
      }
    }

    this._animations.onCompacted(this._store);
    this._styleEngine.onCompacted(); // refresh the styled-generation marks (24.1)
  }

  /** Move the interned singleton handles to their elements' new slots
   * (dead slots' handles drop out of the pool; holders keep dead reads). */
  private _remapPool(group: GroupName, remap: Uint32Array | null): void {
    if (remap == null) {
      return;
    }

    const pool = this._pool[group];
    const n = Math.min(remap.length, pool.length);

    for (let s = 0; s < n; s++) {
      const ele = pool[s];

      if (ele == null) {
        continue;
      }

      pool[s] = undefined;

      const d = remap[s];

      if (d === NO_SLOT) {
        continue;
      }

      void ele._refs; // the epoch-guarded getter repairs the singleton's ref
      pool[d] = ele;
    }
  }

  /**
   * Open a batch: defer style application until the matching `endBatch()`.
   * Pairs nest — only the outermost `endBatch()` flushes.  Prefer
   * `batch( fn )`, which cannot leak a depth on an exception.
   *
   * @returns this core, for chaining
   */
  startBatch(): this {
    if (this._batchDepth === 0) {
      this._batchPending = {
        sheet: false,
        style: [],
        mapped: [],
        mappedKeys: new Set(),
      };
    }

    this._batchDepth++;

    return this;
  }

  /**
   * Close a batch.  At the outermost close the deferred work flushes as
   * one bulk pass — filtered to elements still live, so adding and
   * removing within the same batch costs nothing — and the automatic
   * slot-compaction trigger gets its boundary check.  A sheet change
   * during the batch subsumes the per-element work: one `applyAll()`
   * covers every live element.
   *
   * Unbalanced calls are a no-op rather than an error, matching v3.
   *
   * @returns this core, for chaining
   */
  endBatch(): this {
    if (this._batchDepth === 0) {
      return this;
    }

    this._batchDepth--;

    if (this._batchDepth > 0) {
      return this;
    }

    const pending = this._batchPending as BatchPending;

    this._batchPending = null;

    if (pending.sheet) {
      this._styleEngine.applyAll(); // covers every live element, so the per-slot work is subsumed
      this._maybeCompact();

      return this;
    }

    const store = this._store;
    const nodeSlots: number[] = [];
    const edgeSlots: number[] = [];

    for (const ref of pending.style) {
      if (!store.isCurrent(ref)) {
        continue;
      } // added then removed within the batch

      (ref.group === 'nodes' ? nodeSlots : edgeSlots).push(ref.slot);
    }

    this._styleEngine.applyBulk('nodes', nodeSlots);
    this._styleEngine.applyBulk('edges', edgeSlots);

    const mappedNodes: number[] = [];
    const mappedEdges: number[] = [];

    for (const ref of pending.mapped) {
      if (!store.isCurrent(ref)) {
        continue;
      }

      (ref.group === 'nodes' ? mappedNodes : mappedEdges).push(ref.slot);
    }

    const keys = [...pending.mappedKeys];

    this._styleEngine.refreshMapped('nodes', mappedNodes, keys);
    this._styleEngine.refreshMapped('edges', mappedEdges, keys);

    this._maybeCompact(); // removals inside the batch deferred to here

    return this;
  }

  /**
   * Run `fn` inside a `startBatch()`/`endBatch()` pair.  The batch closes
   * even if `fn` throws, so this is the form to prefer.
   *
   * @param fn — the mutations to batch; its return value is discarded
   * @returns this core, for chaining
   */
  batch(fn: () => void): this {
    this.startBatch();

    try {
      fn();
    } finally {
      this.endBatch();
    }

    return this;
  }

  // -- layout --

  /**
   * Make a layout over the whole graph.  The layout does not run until you
   * call `.run()` on it.
   *
   * Built-ins: `grid`, `preset`, `circle`, `concentric`, `breadthfirst`,
   * `random` and `force` (the GPU-capable spring–electric layout, round
   * 18).  An external layout is passed **directly** rather than
   * registered — v4 has no `cytoscape.use` and no string registry — by
   * giving `impl`: a class or object implementing `{ run( ctx ), stop?() }`
   * (see `layout/contract.mts` for the `LayoutContext` it receives).
   *
   * Lifecycle events (`layoutstart`/`layoutready`/`layoutstop`) fire on
   * the core, once per run; layout instances are not emitters.
   *
   * @param options — `{ name }` for a built-in or `{ impl }` for an
   *   extension, plus that layout's own options and the shared
   *   `layoutPositions` plumbing (`animate`, `spacingFactor`, `transform`,
   *   `fit`, `padding`, …)
   * @returns the layout instance, unstarted
   * @throws if neither a known `name` nor an `impl` is given
   * @see Collection#layout to lay out a subset
   */
  layout(options: LayoutOptions): Layout {
    // the extension contract (round 17.5): direct objects, no registry
    if ((options as { impl?: unknown })?.impl != null) {
      return new CustomLayout(this, options as CustomLayoutOptions);
    }

    if (options?.name === 'grid') {
      return new GridLayout(this, options);
    }
    if (options?.name === 'preset') {
      return new PresetLayout(this, options);
    }
    if (options?.name === 'circle') {
      return new CircleLayout(this, options);
    }
    if (options?.name === 'concentric') {
      return new ConcentricLayout(this, options);
    }
    if (options?.name === 'breadthfirst') {
      return new BreadthFirstLayout(this, options);
    }
    if (options?.name === 'random') {
      return new RandomLayout(this, options);
    }

    // the built-in force layout (round 18.2) rides the extension
    // contract — exactly what an external layout would do
    if ((options as { name?: string })?.name === 'force') {
      return new CustomLayout(this, {
        ...(options as object),
        impl: ForceLayoutImpl,
      } as CustomLayoutOptions);
    }

    const got = (options as { name?: string } | null)?.name;

    throw new Error(
      `A layout needs a built-in name ('grid', 'preset', 'circle', 'concentric', ` +
        `'breadthfirst', 'random', 'force') or an impl (the extension contract)` +
        (got != null ? `; got name '${got}'` : ''),
    );
  }

  declare makeLayout: this['layout'];
  declare createLayout: this['layout'];

  // -- graph manipulation --

  /**
   * Add elements to the graph and return them as a collection.
   *
   * Takes all three input forms: the classic v3 definition form (one
   * object, an array, or `{ nodes, edges }`), the columnar bulk form
   * (typed-array columns with edge endpoints as node *indices*), and the
   * binary wire buffer produced by `serializeElements`/`cy.serialize()`.
   * Nodes are added before edges, so an edge may reference a node added in
   * the same call.
   *
   * Fires `add` per element.  Inside a batch the first style application
   * of the new elements defers to the outermost `endBatch()`, so
   * style-derived reads (`width()`, `label()`) may be stale until then.
   *
   * **Graph-level `data()` in a wire buffer is ignored here** (round
   * 39.2), where `options.elements` applies it: adding elements to a
   * populated graph must not overwrite that graph's own `data()`.  Apply
   * it explicitly with `cy.data( deserializeElements( buf ).data )` if
   * that is what you want.
   *
   * @param input — elements in definition, columnar or wire form
   * @returns a collection of the added elements
   */
  add(input: ElementsInput): Collection {
    const defs = isSerializedElements(input)
      ? deserializeElements(input)
      : input;
    const refs = isColumnarElements(defs)
      ? this._columnarRefs(this._addColumnar(defs))
      : this._addDefs(defs);
    const added = new Collection(this, refs, { unique: true });

    if (this._hasListeners('add')) {
      for (let i = 0; i < added.length; i++) {
        this._emitOnEle('add', added[i]);
      }
    }

    return added;
  }

  /**
   * Bulk load path (the factory's `options.elements`): adds without
   * materializing per-element handles or a return collection — on a
   * 500k-element load the handle layer costs more than the model writes
   * and the caller uses none of it.  `add` events still fire per element
   * when anyone is listening (never the case at construction time).
   *
   * **A definition-form payload loads through the columnar ingest too**
   * (round 66): it is converted first, because convert-then-ingest is
   * cheaper than the def loop — measured 1.2-1.8x end to end, from 4k to
   * 800k elements and on the ndex-x-large renderer scene (1696 -> 980 ms).
   * The def loop pays a `Table.alloc` per element and two
   * `IdIndex` lookups per edge, where the columnar path takes one
   * contiguous `allocBulk` run and resolves endpoints by index; the
   * conversion costs about a tenth of what that saves.  The route is
   * taken only when the payload is self-contained (every edge endpoint
   * names a node in the same payload) — otherwise `buildColumnar` answers
   * null and the def path runs, and reports the error, as before.
   */
  _bulkAdd(input: ElementsInput): void {
    // round 67: one bulk-load window over the whole ingest, so the curve
    // index takes one pass over the finished pair map instead of a mark
    // per edge.  `cy.add()` gets no window, deliberately — it adds into
    // a populated graph, where the pairs it touches are a small subset.
    this._store.beginBulkLoad();

    try {
      this._bulkAddInner(input);
    } finally {
      this._store.endBulkLoad();
    }
  }

  private _bulkAddInner(input: ElementsInput): void {
    const defs = isSerializedElements(input)
      ? deserializeElements(input)
      : input;

    if (isColumnarElements(defs)) {
      // graph-level data rides the wire since round 39.2, and only this
      // path applies it: at construction the graph's data() is empty, so
      // there is nothing to clobber.  `add()` deliberately drops it.
      if (defs.data != null) {
        Object.assign(this._graphData, defs.data);
      }

      const { nodeSlots, edgeSlots } = this._addColumnar(defs);

      this._emitBulkAdds(nodeSlots, edgeSlots);

      return;
    }

    const part = partitionDefs(defs);
    const bulk = buildColumnar(part, false);

    if (bulk != null) {
      const { nodeSlots, edgeSlots } = this._addColumnar(
        bulk.elements,
        bulk.nodeFlags,
        bulk.edgeFlags,
      );

      this._emitBulkAdds(nodeSlots, edgeSlots);

      return;
    }

    const refs = this._addPartition(part);

    if (this._hasListeners('add')) {
      for (const ref of refs) {
        this._emitOnEle('add', this._eleFromRef(ref));
      }
    }
  }

  /** Per-element `add` for a columnar bulk, nodes before edges. */
  private _emitBulkAdds(nodeSlots: Uint32Array, edgeSlots: Uint32Array): void {
    if (!this._hasListeners('add')) {
      return;
    }

    for (const slot of nodeSlots) {
      this._emitOnEle('add', this._ele('nodes', slot));
    }
    for (const slot of edgeSlots) {
      this._emitOnEle('add', this._ele('edges', slot));
    }
  }

  /**
   * Columnar ingest: store-level bulk adds + one bulk style pass.
   *
   * The optional flag overrides come from a converted definition payload
   * — `locked`, `grabbable` and `pannable` have no column.  They are
   * written before the style pass, where the def path also has them: a
   * later write would still be *correct*, since `::locked` and
   * `::grabbable` are styleable conditions and a condition-flag write
   * restyles its slot, but it would pay for that restyle.
   */
  private _addColumnar(
    elements: ColumnarElements,
    nodeFlags?: FlagOverride[],
    edgeFlags?: FlagOverride[],
  ): {
    nodeSlots: Uint32Array;
    edgeSlots: Uint32Array;
  } {
    const newId = (): string => this._newId();
    const nodeSlots =
      elements.nodes != null && elements.nodes.count > 0
        ? this._store.addNodesColumnar(elements.nodes, newId)
        : new Uint32Array(0);
    const edgeSlots =
      elements.edges != null && elements.edges.count > 0
        ? this._store.addEdgesColumnar(elements.edges, nodeSlots, newId)
        : new Uint32Array(0);

    if (nodeFlags != null && nodeFlags.length > 0) {
      this._applyFlagOverrides('nodes', nodeSlots, nodeFlags, false);
    }
    if (edgeFlags != null && edgeFlags.length > 0) {
      this._applyFlagOverrides('edges', edgeSlots, edgeFlags, true);
    }

    this._applyStyle('nodes', nodeSlots);
    this._applyStyle('edges', edgeSlots);

    return { nodeSlots, edgeSlots };
  }

  /** Write the def flags the columnar columns cannot carry. */
  private _applyFlagOverrides(
    group: GroupName,
    slots: Uint32Array,
    overrides: FlagOverride[],
    pannableDefault: boolean,
  ): void {
    for (const { at, def } of overrides) {
      const slot = slots[at];

      if (def.locked === true) {
        this._store.setFlag(group, slot, FLAG_LOCKED, true);
      }
      if (def.grabbable === false) {
        this._store.setFlag(group, slot, FLAG_GRABBABLE, false);
      }
      if (def.pannable != null && def.pannable !== pannableDefault) {
        this._store.setFlag(group, slot, FLAG_PANNABLE, def.pannable);
      }
    }
  }

  private _columnarRefs({
    nodeSlots,
    edgeSlots,
  }: {
    nodeSlots: Uint32Array;
    edgeSlots: Uint32Array;
  }): Ref[] {
    const refs: Ref[] = [];

    for (const slot of nodeSlots) {
      refs.push(this._store.ref('nodes', slot));
    }
    for (const slot of edgeSlots) {
      refs.push(this._store.ref('edges', slot));
    }

    return refs;
  }

  /** Shared add loop: nodes first so edges can reference same-call nodes. */
  private _addDefs(defs: ElementsDefinition | ElementDefinition): Ref[] {
    return this._addPartition(partitionDefs(defs));
  }

  /**
   * `_addDefs` over defs already split by group, so the bulk load path
   * can partition once and hand the same split to whichever route it
   * takes.
   */
  private _addPartition(part: PartitionedDefs): Ref[] {
    const { nodes: nodeDefs, edges: edgeDefs } = part;

    this._store.reserve(nodeDefs.length, edgeDefs.length);

    const refs: Ref[] = [];
    const nodeSlots: number[] = [];
    const edgeSlots: number[] = [];

    for (const def of nodeDefs) {
      const data = def.data ?? {};
      const id = data.id != null ? String(data.id) : this._newId();
      const pos = def.position ?? { x: 0, y: 0 };
      const slot = this._store.addNode(id, pos.x, pos.y, def);

      this._store.setDefData('nodes', slot, data);
      nodeSlots.push(slot);
      refs.push(this._store.ref('nodes', slot));
    }

    // second pass (round 14.2): resolve def parents once the batch's nodes
    // all exist, so forward references work in any def order; an unknown or
    // non-node parent warns and leaves the node an orphan (v3's rule, with
    // the silent-drop case upgraded to a warning)
    for (let i = 0; i < nodeDefs.length; i++) {
      const parent = nodeDefs[i].data?.parent;

      if (parent == null) {
        continue;
      }

      const parentRef = this._store.lookup(String(parent));

      if (parentRef == null || parentRef.group !== 'nodes') {
        console.warn(
          `Node '${this._store.idAt('nodes', nodeSlots[i])}' has nonexistant parent ` +
            `'${String(parent)}'; added as an orphan`,
        );

        continue;
      }

      this._store.setParent(nodeSlots[i], parentRef.slot);
    }

    for (const def of edgeDefs) {
      const data = def.data ?? {};
      const id = data.id != null ? String(data.id) : this._newId();

      if (data.source == null || data.target == null) {
        throw new Error(
          `Can not create edge '${id}' without a source and target`,
        );
      }

      const slot = this._store.addEdge(
        id,
        String(data.source),
        String(data.target),
        def,
      );

      this._store.setDefData('edges', slot, data);
      edgeSlots.push(slot);
      refs.push(this._store.ref('edges', slot));
    }

    this._applyStyle('nodes', nodeSlots);
    this._applyStyle('edges', edgeSlots);

    return refs;
  }

  /**
   * Remove elements from the graph.  Removing a node removes its
   * connected edges, and removing a compound parent removes its
   * descendants.  Equivalent to `eles.remove()`.
   *
   * @param eles — the elements to remove
   * @returns the removed elements
   */
  remove(eles: Collection): Collection {
    return eles.remove();
  }

  // -- collections --

  /**
   * An empty collection bound to this core — the accumulator for
   * `union`/`add` chains.
   *
   * Takes **no arguments**, and throws if given any (round 64, closing
   * ledger item 28): v3's `collection( eles, opts )` also built from a
   * string, an array or a collection, so the v3-shaped call used to
   * return the empty collection *silently* — the one method boundary
   * where a typo did nothing, against the unknown-key/unknown-prop
   * throws everywhere else.  Build a set with `union()` over this
   * accumulator, or query with `cy.$( query )` / `cy.filter( query )`.
   *
   * @returns a collection of zero elements
   * @throws if called with any argument — v3's building forms are not
   *   ported; the message names the replacements
   */
  collection(): Collection {
    if (arguments.length > 0) {
      throw new Error(
        'cy.collection() takes no arguments in v4 — it is the empty ' +
          'accumulator.  Build from elements with union() ' +
          '(eles.union( other )), or query with cy.$( query ) / ' +
          'cy.filter( query )',
      );
    }

    return new Collection(this, []);
  }

  /**
   * Look up one element by id through the O(1) id index.
   *
   * @param id — the element id
   * @returns a collection of one element, or an empty collection when no
   *   element has that id
   */
  getElementById(id: string): Collection {
    // the packed-code lookup (round 62.3): no IdEntry, no Ref — the
    // probe answers an integer and the pool answers the handle
    const code = this._store.lookupCode(id);

    return code < 0
      ? this.collection()
      : this._ele((code & 1) === 1 ? 'edges' : 'nodes', code >>> 1);
  }

  /**
   * All elements, optionally filtered — nodes (in insertion order) then
   * edges.
   *
   * v4 has no selector strings: pass a structured **query object**
   * (`{ group, selected, parent, data: { weight: { gt: 0.5 } } }`), which
   * compiles to per-group flag tests answered by one columnar scan, or a
   * **predicate function** for anything richer.  Unknown query keys throw,
   * so a typo cannot silently match everything.
   *
   * Called with **no query**, the result is memoized until the graph
   * next gains or loses an element (round 34.2), so repeated calls are
   * O(1) and two of them return *the same collection object*.  A v4
   * collection is an immutable snapshot holding refs into the columns,
   * so it still reads live values — a style, position or data write
   * neither invalidates it nor goes unseen through it.
   *
   * @param query — a query object or an `( ele ) => boolean` predicate;
   *   omit for everything
   * @returns the matching elements
   */
  elements(query?: Query | EleFilterFn): Collection {
    return query === undefined
      ? (this._allEles ?? this._allOf(null))
      : this._query(query, null);
  }

  /**
   * The graph's nodes, optionally filtered.  Same query forms as
   * `elements()`, restricted to the node group — and, with no query,
   * the same memo (34.2).
   *
   * @param query — a query object or an `( ele ) => boolean` predicate
   * @returns the matching nodes
   */
  nodes(query?: Query | EleFilterFn): Collection {
    return query === undefined
      ? this._allOf('nodes')
      : this._query(query, 'nodes');
  }

  /**
   * The graph's edges, optionally filtered.  Same query forms as
   * `elements()`, restricted to the edge group — and, with no query,
   * the same memo (34.2).
   *
   * @param query — a query object or an `( ele ) => boolean` predicate
   * @returns the matching edges
   */
  edges(query?: Query | EleFilterFn): Collection {
    return query === undefined
      ? this._allOf('edges')
      : this._query(query, 'edges');
  }

  /**
   * Filter the whole graph.  Identical to `elements( query )`, kept for
   * symmetry with `eles.filter()`.
   *
   * @param query — a query object or an `( ele ) => boolean` predicate
   * @returns the matching elements
   */
  filter(query: Query | EleFilterFn): Collection {
    return this._query(query, null);
  }

  // round 64: cy.$ returns, as a plain alias of filter() over the v4
  // query API — in line with cy.$id().  Selector strings still throw,
  // through filter's own rejection.
  declare $: this['filter'];

  /**
   * The unfiltered whole-graph collections (`elements()`, `nodes()`,
   * `edges()` with no query), memoized against the store's structure
   * epoch (round 34.2).
   *
   * These are the calls an app makes in a loop, and each one was an
   * O(V+E) scan plus a handle intern per element — the whole-graph read
   * measured 121 µs at 2000 nodes against v3's 18 ns, because v3 hands
   * back a live internal collection and v4 built a fresh one every
   * time.  A v4 collection is an immutable snapshot, so the only thing
   * that can invalidate it is an element entering or leaving the graph,
   * which is exactly what the epoch counts.  Style, flag, position and
   * data writes do not move it, and a compaction does — refs would
   * self-repair anyway (19.3), but the cache drops rather than relying
   * on that.
   *
   * The visible consequence, deliberate: two calls with no structural
   * change between them now return **the same collection object**
   * where they used to return two equal ones.  Collections are
   * immutable, so nothing can observe the difference except identity
   * itself.
   */
  private _allOf(restrict: GroupName | null): Collection {
    const epoch = this._store.structureEpoch;
    const cached = this._allCache;

    // a non-null cache is current: onStructureChange nulls it (62.5b)
    if (cached != null) {
      const hit =
        restrict == null
          ? cached.all
          : restrict === 'nodes'
            ? cached.nodes
            : cached.edges;

      if (hit != null) {
        return hit;
      }
    }

    const fresh = this._query(undefined, restrict);
    const slot =
      cached != null && cached.epoch === epoch
        ? cached
        : ({ epoch, all: null, nodes: null, edges: null } as AllCache);

    if (restrict == null) {
      slot.all = fresh;
      this._allEles = fresh;
    } else if (restrict === 'nodes') {
      slot.nodes = fresh;
    } else {
      slot.edges = fresh;
    }

    this._allCache = slot;

    return fresh;
  }

  /**
   * Resolve a whole-graph query.  Structured queries compile to per-group
   * (mask, want) flag tests answered by one columnar scan — no element
   * handles, no per-element matching.  Predicate functions materialize
   * the group(s) and filter per element.  `restrict` narrows the result
   * to one group (for `cy.nodes(q)` / `cy.edges(q)`).
   */
  private _query(
    query: Query | EleFilterFn | undefined,
    restrict: GroupName | null,
  ): Collection {
    if (typeof query === 'function') {
      return this._query(undefined, restrict).filter(query);
    }

    const plan = compileQuery(query ?? {}, restrict);

    return this._scanCollection(plan.nodes, plan.edges, plan.data);
  }

  /**
   * Live, visible elements contained in the model-coordinate box (corners
   * in any order): the box-selection query, answered by one columnar
   * scan.  Nodes count when their bounding box lies fully inside; edges
   * when both endpoint node centers do (v3's default 'contain'
   * semantics, with straight-edge endpoints taken at the node centers).
   *
   * **`boxSelectionMode` does not reach here** (round 39.1): this stays
   * the pure geometric containment query whatever the *gesture* is set
   * to.  For the overlap question, `boxSelectionMode( 'overlap' )` and
   * drag a box, or test intersection yourself against
   * `eles.boundingBox()`.  (`boxSelectionIncludesLabels` is the one
   * interaction setting that *does* reach here: with it on, a node's
   * label box must be contained too.)
   *
   * @param x1 — one corner's model x
   * @param y1 — that corner's model y
   * @param x2 — the opposite corner's model x
   * @param y2 — that corner's model y
   * @returns the contained elements
   */
  elementsInBox(x1: number, y1: number, x2: number, y2: number): Collection {
    return new Collection(
      this,
      this._store.refsInBox(x1, y1, x2, y2, this._boxSelectionIncludesLabels),
      { unique: true, live: true },
    );
  }

  /**
   * The *gesture's* box query: `elementsInBox` with this instance's
   * `boxSelectionMode` applied (round 39.1).  Internal because the mode
   * is an interaction preference — the public query stays geometric, and
   * both pointer paths (mouse/pen release and the three-finger touch box)
   * come through here so they cannot drift apart.
   */
  _elementsInGestureBox(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): Collection {
    return new Collection(
      this,
      this._store.refsInBox(
        x1,
        y1,
        x2,
        y2,
        this._boxSelectionIncludesLabels,
        this._boxSelectionMode,
      ),
      { unique: true, live: true },
    );
  }

  /** Collection of the live slots matching per-group flag tests (null matches nothing). */
  private _scanCollection(
    nodeTest: FlagTest | null,
    edgeTest: FlagTest | null,
    dataConds: CompiledCondition[] | null = null,
  ): Collection {
    const store = this._store;
    const cap =
      (nodeTest == null ? 0 : store.count('nodes')) +
      (edgeTest == null ? 0 : store.count('edges'));
    const refs: Ref[] = new Array(cap);
    const dataTests =
      dataConds == null
        ? undefined
        : dataConds.map((cond) => ({
            key: cond.key,
            test: (v: unknown) => testCondition(cond, v),
          }));
    let n = 0;

    if (nodeTest != null) {
      n = store.scanRefsInto(
        refs,
        n,
        'nodes',
        nodeTest.mask,
        nodeTest.want,
        dataTests,
      );
    }
    if (edgeTest != null) {
      n = store.scanRefsInto(
        refs,
        n,
        'edges',
        edgeTest.mask,
        edgeTest.want,
        dataTests,
      );
    }

    if (n !== refs.length) {
      refs.length = n;
    }

    return new Collection(this, refs, { unique: true, live: true });
  }

  // -- events --

  /**
   * Listen for events on the core.
   *
   * Delegation is **predicate-based** — there are no selector strings.
   * With a trailing callback the middle argument is a predicate over the
   * event target: `cy.on( 'tap', ele => ele.isNode(), handler )`.
   *
   * **Any name registers, and that is deliberate** (decided 2026-08-04,
   * fifth design sitting).  Custom events are supported API — `emit( 'foo' )`
   * fires handlers bound to `'foo'` — so event names cannot be validated
   * against a list without breaking them.  The consequence is worth stating
   * plainly, because it is a silent one: a name v4 never emits registers
   * cleanly and then never fires.  That covers the round-17 drops — the
   * `vmouse*` aliases and v3's raw mouse/touch re-emits (`mousedown`,
   * `click`, `touchstart`, …), for which `pointer*` is the one modern
   * spelling; `mouseover`/`mouseout` do still fire.  A ported v3 handler
   * does nothing at all rather than erroring, so port event names by the
   * vocabulary in `src/README.md` rather than by trying them.
   *
   * **Namespaces are exactly that rule, not an exception to it** (round
   * 41.2).  There is no namespace machinery: a type is matched whole, so
   * `'tap.ns'` is one literal name that `emit( 'tap' )` does not reach and
   * `off( 'tap.ns' )` removes on its own.  Until round 41 v4 imported v3's
   * emitter and so inherited v3's namespace semantics in full, against its
   * own design — measured in 37.4 and closed in 41.2.
   *
   * @param events — one or more space-separated event names
   * @param predicateOrCb — the delegation predicate when `callback` is
   *   given, otherwise the handler itself
   * @param callback — the handler, when delegating
   * @returns this core, for chaining
   * @see Core#off — removing a delegated handler takes the same
   *   `( events, predicate, handler )` triple, since predicates compare
   *   by function identity
   */
  on(events: string, callback: EventHandler): this;
  /**
   * Listen with predicate delegation: the handler runs only for events
   * whose target satisfies `predicate`.
   *
   * @param events — one or more space-separated event names
   * @param predicate — `( ele ) => boolean` over the event target; only
   *   runs for element targets
   * @param callback — the handler
   * @returns this core, for chaining
   */
  on(events: string, predicate: ElePredicate, callback: EventHandler): this;
  on(
    events: string,
    predicateOrCb?: ElePredicate | EventHandler,
    callback?: EventHandler,
  ): this {
    if (callback != null) {
      this._emitter.on(
        events,
        predicateQualifier(predicateOrCb as ElePredicate),
        callback,
      );
    } else {
      this._emitter.on(events, null, predicateOrCb as EventHandler | undefined);
    }

    return this;
  }

  declare addListener: this['on'];

  /**
   * Like `on()`, but the handler runs at most once and then removes
   * itself.
   *
   * @param events — one or more space-separated event names
   * @param predicateOrCb — the delegation predicate when `callback` is
   *   given, otherwise the handler itself
   * @param callback — the handler, when delegating
   * @returns this core, for chaining
   */
  one(events: string, callback: EventHandler): this;
  /**
   * Like `on()` with delegation, but the handler runs at most once.
   *
   * @param events — one or more space-separated event names
   * @param predicate — `( ele ) => boolean` over the event target
   * @param callback — the handler
   * @returns this core, for chaining
   */
  one(events: string, predicate: ElePredicate, callback: EventHandler): this;
  one(
    events: string,
    predicateOrCb?: ElePredicate | EventHandler,
    callback?: EventHandler,
  ): this {
    if (callback != null) {
      this._emitter.one(
        events,
        predicateQualifier(predicateOrCb as ElePredicate),
        callback,
      );
    } else {
      this._emitter.one(
        events,
        null,
        predicateOrCb as EventHandler | undefined,
      );
    }

    return this;
  }

  declare once: this['one'];

  /**
   * Stop listening.  Removing a delegated handler takes the same
   * `( events, predicate, handler )` triple it was added with —
   * predicates compare by function identity, so the predicate must be the
   * same function object, not an equivalent one.
   *
   * @param events — one or more space-separated event names
   * @param predicateOrCb — the delegation predicate when `callback` is
   *   given, otherwise the handler itself; omit both to remove every
   *   handler for `events`
   * @param callback — the handler, when delegating
   * @returns this core, for chaining
   */
  off(events: string, callback?: EventHandler): this;
  /**
   * Remove a delegated handler.  The predicate must be the *same
   * function object* it was registered with — predicates compare by
   * identity, not by structure.
   *
   * @param events — one or more space-separated event names
   * @param predicate — the predicate the handler was added with
   * @param callback — the handler to remove
   * @returns this core, for chaining
   */
  off(events: string, predicate: ElePredicate, callback: EventHandler): this;
  off(
    events: string,
    predicateOrCb?: ElePredicate | EventHandler,
    callback?: EventHandler,
  ): this {
    if (callback != null) {
      this._emitter.off(
        events,
        predicateQualifier(predicateOrCb as ElePredicate),
        callback,
      );
    } else {
      this._emitter.off(
        events,
        null,
        predicateOrCb as EventHandler | undefined,
      );
    }

    return this;
  }

  declare removeListener: this['off'];

  /**
   * Remove every listener on the core, including element-bound and
   * delegated ones.
   *
   * @returns this core, for chaining
   */
  removeAllListeners(): this {
    this._emitter.removeAllListeners();

    return this;
  }

  /**
   * Emit an event on the core.
   *
   * **Custom event names are supported API**, which is why `on()` validates
   * none: `cy.emit( 'myevent' )` runs handlers registered for `'myevent'`,
   * and the same holds on elements.  Names v4 itself never emits are
   * therefore legal to register and simply never fire — see `on()` for which
   * those are, and PLAN.md's open-call record for why no denylist exists.
   *
   * @param events — one or more space-separated event names, or an event
   *   props object
   * @param extraParams — extra arguments passed to each handler after the
   *   event object
   * @returns this core, for chaining
   */
  emit(events: string | EventProps, extraParams?: unknown[]): this {
    this._emitter.emit(events, extraParams);

    return this;
  }

  declare trigger: this['emit'];

  /**
   * Resolve once the next matching event fires — the promise form of
   * `one()`.
   *
   * @param events — one or more space-separated event names
   * @param predicate — an optional delegation predicate over the target
   * @returns a promise for the event object
   */
  promiseOn(events: string, predicate?: ElePredicate): Promise<Event> {
    return new Promise((resolve) => {
      if (predicate != null) {
        this.one(events, predicate, (event) => resolve(event));
      } else {
        this.one(events, (event: Event) => resolve(event));
      }
    });
  }

  declare pon: this['promiseOn'];

  // -- viewport --

  /**
   * Get the zoom level, or set it.  Setting is a no-op while
   * `zoomingEnabled()` is false, and the level is clamped to
   * `zoomRange()`.
   *
   * @param zoom — the new level, or `{ level, position | renderedPosition }`
   *   to zoom about a fixed point; omit to read
   * @returns the current zoom when reading, this core when setting
   */
  zoom(zoom?: number | ZoomOptions): number | this {
    if (zoom === undefined) {
      return this._viewport.zoom();
    }

    if (this._zoomingEnabled && this._viewport.setZoom(zoom)) {
      this._emitViewportEvents(['zoom']);
    }

    return this;
  }

  /**
   * Get the pan offset, or set it.  Setting is a no-op while
   * `panningEnabled()` is false.
   *
   * @param pan — the new rendered-space offset; omit to read
   * @returns the current pan when reading, this core when setting
   */
  pan(pan?: Position): Position | this {
    if (pan === undefined) {
      return this._viewport._pan;
    }

    if (this._panningEnabled && this._viewport.setPan(pan)) {
      this._emitViewportEvents(['pan']);
    }

    return this;
  }

  /**
   * Shift the pan by a delta.  A no-op while `panningEnabled()` is false.
   *
   * @param delta — the rendered-space offset to add
   * @returns this core, for chaining
   */
  panBy(delta: Position): this {
    if (this._panningEnabled && this._viewport.panBy(delta)) {
      this._emitViewportEvents(['pan']);
    }

    return this;
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
  fit(eles?: Collection, padding: number = 0): this {
    const bb = this._boundsOf(eles);

    if (bb == null) {
      return this;
    }

    this._viewport.fit(bb, padding);
    this._emitViewportEvents(['zoom', 'pan', 'fit']);

    return this;
  }

  /**
   * Pan so the given elements are centred, leaving the zoom alone.
   * Bounds include labels, as in `fit()`.
   *
   * @param eles — the elements to centre on; omit for the whole graph
   * @returns this core, for chaining
   */
  center(eles?: Collection): this {
    const bb = this._boundsOf(eles);

    if (bb == null) {
      return this;
    }

    if (this._viewport.centerOn(bb)) {
      this._emitViewportEvents(['pan']);
    }

    return this;
  }

  declare centre: this['center'];

  // -- animation (viewport) --

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
  animate(opts: AnimateOptions): this {
    // resolve first, so a `panBy` delta gates on panningEnabled exactly
    // as the absolute target it resolves to
    const resolved = this._resolveViewportTargets(opts);

    if (opts.fit == null && opts.center == null) {
      if (resolved.pan != null && !this._panningEnabled) {
        return this;
      }
      if (resolved.zoom != null && !this._zoomingEnabled) {
        return this;
      }
    }

    this._animations.start(
      new Animation(this._store, this._viewport, [], true, resolved),
    );

    return this;
  }

  /**
   * Like `animate`, but returns a handle with `play`/`stop`/`promise` —
   * the viewport counterpart of `eles.animation`.
   *
   * @param opts — as {@link animate}; the animation does not start until
   *   `play()`
   * @returns the handle
   */
  animation(opts: AnimateOptions): AnimationHandle {
    return new AnimationHandleImpl(
      this._animations,
      new Animation(
        this._store,
        this._viewport,
        [],
        true,
        this._resolveViewportTargets(opts),
      ),
    );
  }

  /**
   * Resolve `fit`/`center`/`panBy` targets to concrete pan/zoom at
   * creation time, as v3 does.  Precedence follows v3's override order:
   * `fit` beats `center` beats `panBy` beats an explicit `pan`.
   */
  private _resolveViewportTargets(opts: AnimateOptions): AnimateOptions {
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
          ? this._viewport.fitViewport(
              math.makeBoundingBox(fit.boundingBox) as BoundsLike,
              padding,
            )
          : this.getFitViewport(fit.eles as Collection | undefined, padding);

      if (fv != null) {
        return { ...opts, pan: fv.pan, zoom: fv.zoom };
      }
    } else if (opts.center != null) {
      const pan = this.getCenterPan(opts.center.eles as Collection | undefined);

      if (pan != null) {
        return { ...opts, pan };
      }
    } else if (opts.panBy != null) {
      const from = this._viewport.pan() as Position;

      return {
        ...opts,
        pan: { x: from.x + opts.panBy.x, y: from.y + opts.panBy.y },
      };
    }

    return opts;
  }

  /**
   * True while the viewport is animating.
   *
   * @returns whether a *viewport* animation (pan/zoom/fit/center) is
   *   running; element animations do not count here — those are
   *   `eles.animated()`
   */
  animated(): boolean {
    return this._animations.isViewportAnimating();
  }

  /**
   * Stop every running viewport animation (round 21: no queue — the v3
   * clearQueue argument is gone).
   *
   * @param jumpToEnd — apply each animation's final values instead of
   *   freezing the viewport where the tween reached
   * @returns this core, for chaining
   */
  stop(jumpToEnd: boolean = false): this {
    this._animations.stopViewport(jumpToEnd);

    return this;
  }

  /** Called after each animation tick: redraw, and emit viewport events while it pans/zooms. */
  private _afterAnimationTick(): void {
    if (this._animations.isViewportAnimating()) {
      this._emitViewportEvents(['pan', 'zoom', 'viewport']);
    }

    this._renderer?.requestRender();
  }

  /**
   * The model-space rectangle currently visible, as
   * `{ x1, y1, x2, y2, w, h }` — the inverse of the pan/zoom transform
   * applied to the viewport box.
   *
   * @returns the visible extent in model coordinates
   * @see Core#renderedExtent for the same box in rendered coordinates
   */
  extent(): Extent {
    return this._viewport.extent();
  }

  /**
   * The rendered (on-screen) viewport rectangle.
   *
   * @returns the container's box in rendered px, anchored at the origin —
   *   the rendered-space counterpart of `extent()`, which is the same box
   *   projected into model coordinates
   * @see Core#extent for the model-coordinate form
   */
  renderedExtent(): Extent {
    return this._viewport.renderedExtent();
  }

  /** Rendered dimensions as { width, height }. */
  size(): { width: number; height: number } {
    return { width: this.width(), height: this.height() };
  }

  /**
   * Get the minimum zoom, or set it.  Setting re-clamps the current zoom.
   *
   * @param zoom — the new minimum; omit to read
   * @returns the current minimum when reading, this core when setting
   */
  minZoom(zoom?: number): number | this {
    if (zoom === undefined) {
      return this._viewport.minZoom;
    }

    if (this._viewport.setMinZoom(zoom)) {
      this._emitViewportEvents(['zoom']);
    }

    return this;
  }

  /**
   * Get the maximum zoom, or set it.  Setting re-clamps the current zoom.
   *
   * @param zoom — the new maximum; omit to read
   * @returns the current maximum when reading, this core when setting
   */
  maxZoom(zoom?: number): number | this {
    if (zoom === undefined) {
      return this._viewport.maxZoom;
    }

    if (this._viewport.setMaxZoom(zoom)) {
      this._emitViewportEvents(['zoom']);
    }

    return this;
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
  zoomRange(min: number | { min?: number; max?: number }, max?: number): this {
    const lo = typeof min === 'object' ? min.min : min;
    const hi = typeof min === 'object' ? min.max : max;
    let changed = false;

    if (lo != null && this._viewport.setMinZoom(lo)) {
      changed = true;
    }
    if (hi != null && this._viewport.setMaxZoom(hi)) {
      changed = true;
    }

    if (changed) {
      this._emitViewportEvents(['zoom']);
    }

    return this;
  }

  /**
   * Set zoom and/or pan together, emitting once.
   *
   * @param opts — the `zoom` and/or `pan` to apply; omitted keys are left
   *   as they are
   * @returns this core, for chaining
   */
  viewport(opts: { zoom?: number; pan?: Position }): this {
    const events: string[] = [];

    if (opts.zoom != null && this._viewport.setZoom(opts.zoom)) {
      events.push('zoom');
    }
    if (opts.pan != null && this._viewport.setPan(opts.pan)) {
      events.push('pan');
    }

    if (events.length > 0) {
      this._emitViewportEvents(events);
    }

    return this;
  }

  /** Reset the viewport to zoom 1, pan (0, 0). */
  reset(): this {
    return this.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
  }

  /**
   * The { zoom, pan } that would fit the given elements — computed, not
   * applied.
   *
   * @param eles — the elements to fit; omit for the whole graph
   * @param padding — rendered px of margin to leave on every side
   * @returns the viewport, or null when there is nothing to fit
   * @internal
   */
  getFitViewport(
    eles?: Collection,
    padding: number = 0,
  ): { zoom: number; pan: Position } | null {
    const bb = this._boundsOf(eles);

    return bb == null ? null : this._viewport.fitViewport(bb, padding);
  }

  /**
   * The pan that would center the given elements.
   *
   * @param eles — the elements to center; omit for the whole graph
   * @param zoom — the zoom to center at; defaults to the current one
   * @returns the pan, or null when there is nothing to center
   * @internal
   */
  getCenterPan(eles?: Collection, zoom?: number): Position | null {
    const bb = this._boundsOf(eles);

    return bb == null ? null : this._viewport.centerPan(bb, zoom);
  }

  /**
   * Async GPU pick at a rendered (CSS px) position; resolves with the
   * element under the point or null (always null when headless).
   *
   * Exact: a hit is a point on the drawn element.  The pointer gestures
   * additionally apply v3's hit halos (8 rendered px around edges for a
   * mouse, 24 for touch; 2/8 around nodes — round 57.9), so a press can
   * land where this method answers null; the halo belongs to the
   * gesture, not the API.
   *
   * **What wins when elements overlap, as contract** (round 97.1): a
   * non-parent node, then an edge, then a compound parent — the reverse
   * of the order v4 draws them in (parents, edges, leaves), so the
   * answer is always the topmost thing drawn at that point.  Nesting
   * depth does not change it: a parent inside another parent still draws
   * under every edge, and among parents the deepest wins.  v3 ordered
   * these by `z-index` / `z-compound-depth` instead, which v4 does not
   * have, so a deeply nested v3 parent could beat a shallower edge where
   * v4's edge wins.
   *
   * @param x — rendered (CSS px) x, relative to the container
   * @param y — rendered (CSS px) y
   * @returns the element under the point, or null
   */
  async pick(x: number, y: number): Promise<Collection | null> {
    return this._renderer != null
      ? this._decodePick(await this._renderer.pick(x, y))
      : null;
  }

  /**
   * Decode a renderer pick id to a live element (round 86.2, moved here
   * from the renderer so it speaks slots and ids only).  A GPU pick can
   * be up to two frames stale, so the slot is re-validated against the
   * model before an element handle is made.
   *
   * @param id — the packed pick id (slot + 1; edges carry the namespace
   *   bit), or null/0 for background
   * @returns the element, or null when the id is background or stale
   * @internal
   */
  _decodePick(id: number | null): Collection | null {
    if (id == null || id === 0) {
      return null;
    }

    const isEdge = (id & EDGE_PICK_BIT) !== 0;
    const group: GroupName = isEdge ? 'edges' : 'nodes';
    const slot = (isEdge ? id & ~EDGE_PICK_BIT : id) - 1;

    if (
      slot >= this._store.highWater(group) ||
      !this._store.hasFlag(group, slot, FLAG_ALIVE)
    ) {
      return null;
    }

    return this._ele(group, slot);
  }

  // -- renderer --

  /**
   * The renderer, or null when headless.  Demoted from the public surface
   * in round 90 — v3 marks its equivalent `@internal`, and the one piece
   * of it a consumer was documented to reach, `stats()`, is public as
   * `cy.stats()`.
   *
   * @returns the renderer, or null on a headless instance
   * @internal
   */
  renderer(): RendererLike | null {
    return this._renderer;
  }

  /**
   * The renderer's frame statistics, or null when headless.  The snapshot
   * carries the frame timings, cache hit rates and pass counters — note
   * that `cpuFrameMs` is encode/submit cost only (submission is
   * fire-and-forget), so reconcile fps against `gpuFrameMs`.
   *
   * @returns a {@link RendererStats} snapshot, or null on a headless
   *   instance
   */
  stats(): RendererStats | null {
    return this._renderer?.stats() ?? null;
  }

  /** Re-measure the container and redraw (no-op when headless). */
  resize(): this {
    this._renderer?.resize();
    this.emit('resize');

    return this;
  }

  declare invalidateSize: this['resize'];

  // -- image export --

  /**
   * Export the rendered graph as a PNG.  Async — the pixels live on the
   * GPU (offscreen render + readback), unlike v3's synchronous base64
   * form; every output form resolves through the returned promise.
   * Options as in v3: `bg`, `full`, `scale` or `maxWidth`/`maxHeight`,
   * `output` ('base64uri' default | 'base64' | 'blob'; 'blob-promise' is
   * an accepted alias of 'blob').  Headless instances reject — there is
   * no renderer to export from.
   *
   * @param options — the v3 export options named above
   * @returns the encoded image in the requested output form
   */
  png(options: ExportOptions = {}): Promise<string | Blob> {
    return this._exportImage('image/png', options);
  }

  /**
   * Export as JPEG: as {@link png}, plus `quality` (0..1) and a white
   * default `bg` (JPEG has no alpha channel).
   *
   * @param options — as {@link png}, plus `quality`
   * @returns the encoded image in the requested output form
   */
  jpg(options: ExportOptions = {}): Promise<string | Blob> {
    return this._exportImage('image/jpeg', { bg: '#fff', ...options });
  }

  declare jpeg: this['jpg'];

  private async _exportImage(
    mime: string,
    options: ExportOptions,
  ): Promise<string | Blob> {
    const output = options.output ?? 'base64uri';

    if (
      output !== 'base64uri' &&
      output !== 'base64' &&
      output !== 'blob' &&
      output !== 'blob-promise'
    ) {
      throw new Error(
        `Invalid image export output '${String(output)}'; use 'base64uri', 'base64' or 'blob'`,
      );
    }

    if (this._renderer == null) {
      throw new Error(
        'An image can only be exported from a rendered instance; this instance is headless',
      );
    }

    const { data, width, height } = await this._renderer.exportImage(options);
    const doc = (this._container as HTMLElement).ownerDocument as Document;
    const canvas = doc.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d') as CanvasRenderingContext2D;

    context.putImageData(new ImageData(data, width, height), 0, 0);

    const quality = options.quality;

    if (output === 'blob' || output === 'blob-promise') {
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (blob) =>
            blob != null
              ? resolve(blob)
              : reject(
                  new Error(`Could not encode the exported image as ${mime}`),
                ),
          mime,
          quality,
        );
      });
    }

    const uri = canvas.toDataURL(mime, quality);

    return output === 'base64' ? uri.substring(uri.indexOf(',') + 1) : uri;
  }

  // -- graph-level data & scratch (plain objects, not columns) --

  /**
   * Graph-level data — read all, read one key, or write.  This is a plain
   * object, not a columnar sidecar (which is `ele.data()`).  It **is**
   * carried by the wire format since round 39.2: `serialize()` writes it
   * and `options.elements` applies it, while `cy.add( buffer )`
   * deliberately ignores it.  Writing emits `data`.
   *
   * @param args — `()` for the whole object, `( key )` to read one,
   *   `( key, value )` or `( patchObject )` to write
   * @returns the data object or value when reading, this core when
   *   writing
   */
  data(
    ...args: [] | [string] | [string, unknown] | [Record<string, unknown>]
  ): unknown {
    return this._objectAccess(this._graphData, args, 'data');
  }

  /**
   * Delete graph-level data keys.  Emits `data` when anything was
   * removed.
   *
   * @param names — space-separated key names; omit to clear everything
   * @returns this core, for chaining
   */
  removeData(names?: string): this {
    return this._objectRemove(this._graphData, names, 'data');
  }

  declare attr: this['data'];
  declare removeAttr: this['removeData'];

  /**
   * Graph-level scratchpad — like `data()`, but for transient state that
   * is never exported and never emits.  Namespace your keys (an
   * extension convention: `'_myExtension'`).
   *
   * @param args — `()` for the whole object, `( key )` to read one,
   *   `( key, value )` or `( patchObject )` to write
   * @returns the scratch object or value when reading, this core when
   *   writing
   */
  scratch(
    ...args: [] | [string] | [string, unknown] | [Record<string, unknown>]
  ): unknown {
    return this._objectAccess(this._scratch, args, null);
  }

  /**
   * Delete graph-level scratch keys.
   *
   * @param names — space-separated key names; omit to clear everything
   * @returns this core, for chaining
   */
  removeScratch(names?: string): this {
    return this._objectRemove(this._scratch, names, null);
  }

  private _objectAccess(
    target: Record<string, unknown>,
    args: [] | [string] | [string, unknown] | [Record<string, unknown>],
    event: string | null,
  ): unknown {
    const [key, value] = args;

    if (args.length === 0) {
      return target;
    }
    if (typeof key === 'string' && args.length === 1) {
      return target[key];
    }

    const patch: Record<string, unknown> =
      typeof key === 'string'
        ? { [key]: value }
        : (key as Record<string, unknown>);

    Object.assign(target, patch);

    if (event != null) {
      this.emit(event);
    }

    return this;
  }

  private _objectRemove(
    target: Record<string, unknown>,
    names: string | undefined,
    event: string | null,
  ): this {
    const keys =
      names == null
        ? Object.keys(target)
        : names.split(/\s+/).filter((n) => n !== '');

    for (const k of keys) {
      delete target[k];
    }

    if (event != null && keys.length > 0) {
      this.emit(event);
    }

    return this;
  }

  // -- interaction gating --

  /**
   * Get or set whether every node is locked (immovable) regardless of its
   * own `locked` flag — the graph-wide override.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  autolock(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._autolock;
    }

    this._autolock = bool;

    return this;
  }

  /**
   * Get or set whether every node is ungrabbable regardless of its own
   * `grabbable` flag.  Unlike `autolock()`, this blocks only user
   * dragging; programmatic position writes still apply.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  autoungrabify(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._autoungrabify;
    }

    this._autoungrabify = bool;

    return this;
  }

  /**
   * Get or set whether every element is unselectable regardless of its
   * own `selectable` flag.  Programmatic `select()` still applies.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  autounselectify(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._autounselectify;
    }

    this._autounselectify = bool;

    return this;
  }

  declare autolockNodes: this['autolock'];
  declare autoungrabifyNodes: this['autoungrabify'];

  /**
   * Get or set whether panning is allowed at all — programmatic `pan()`
   * included.  Use `userPanningEnabled()` to block only the gesture.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  panningEnabled(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._panningEnabled;
    }

    this._panningEnabled = bool;

    return this;
  }

  /**
   * Get or set whether the user may pan by dragging.  Programmatic
   * `pan()` is unaffected.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  userPanningEnabled(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._userPanningEnabled;
    }

    this._userPanningEnabled = bool;

    return this;
  }

  /**
   * Get or set whether zooming is allowed at all — programmatic `zoom()`
   * included.  Use `userZoomingEnabled()` to block only the gesture.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  zoomingEnabled(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._zoomingEnabled;
    }

    this._zoomingEnabled = bool;

    return this;
  }

  /**
   * Get or set whether the user may zoom by wheel or pinch.
   * Programmatic `zoom()` is unaffected.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  userZoomingEnabled(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._userZoomingEnabled;
    }

    this._userZoomingEnabled = bool;

    return this;
  }

  /**
   * Whether box selection considers label boxes as well as node bodies
   * (round 16.5; v3's box-select-labels, reshaped as a core option —
   * default off).  Its sense **follows `boxSelectionMode`**: under
   * `'contain'` the label box must *also* be inside the band, under
   * `'overlap'` a label that merely crosses the band is *enough*.
   *
   * @param bool — the setting to apply; omit to read it
   * @returns the setting, or this when setting
   */
  boxSelectionIncludesLabels(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._boxSelectionIncludesLabels;
    }

    this._boxSelectionIncludesLabels = bool;

    return this;
  }

  /**
   * What the box-selection gesture counts as caught: `'contain'`
   * (default, v3's) selects only elements wholly inside the band;
   * `'overlap'` selects anything the band touches — a node whose box
   * intersects it, an edge any part of whose drawn path crosses it.
   * Round 39.1.
   *
   * Two notes on the boundary.  This setting is read by the **gesture**
   * only: `cy.elementsInBox()` stays the pure geometric containment
   * query it has always been, so a programmatic caller's results do not
   * change under *this* setting.  And
   * `boxSelectionIncludesLabels` reverses sense with the mode, because
   * it can only mean one thing in each: under 'contain' the label box
   * must *also* be inside, under 'overlap' a label that crosses the band
   * is *enough*.
   *
   * @param mode — the mode to set; omit to read the current one
   * @returns the mode, or this when setting
   * @throws if `mode` is neither 'contain' nor 'overlap'
   */
  boxSelectionMode(mode?: BoxSelectionMode): BoxSelectionMode | this {
    if (mode === undefined) {
      return this._boxSelectionMode;
    }

    if (mode !== 'contain' && mode !== 'overlap') {
      throw new Error(
        `Invalid box selection mode '${String(mode)}'; use 'contain' or 'overlap'`,
      );
    }

    this._boxSelectionMode = mode;

    return this;
  }

  /**
   * Get or set whether the box-selection gesture is available.
   *
   * @param bool — the new setting; omit to read
   * @returns the current setting when reading, this core when setting
   */
  boxSelectionEnabled(bool?: boolean): boolean | this {
    if (bool === undefined) {
      return this._boxSelectionEnabled;
    }

    this._boxSelectionEnabled = bool;

    return this;
  }

  /**
   * How user selection composes: 'single' (a tap or box replaces the
   * selection) or 'additive' (taps toggle and boxes add, as if a
   * multiple-select key were always held).
   *
   * @param type — the mode to set; omit to read the current one
   * @returns the mode, or this when setting
   * @throws if `type` is neither 'single' nor 'additive'
   */
  selectionType(type?: 'single' | 'additive'): ('single' | 'additive') | this {
    if (type === undefined) {
      return this._selectionType;
    }

    if (type !== 'single' && type !== 'additive') {
      throw new Error(
        `Invalid selection type '${String(type)}'; use 'single' or 'additive'`,
      );
    }

    this._selectionType = type;

    return this;
  }
  /**
   * The dbltap/onetap debounce window in ms (v3 parity; default 250).
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @param ms — the window to set; omit to read it
   * @returns the window, or this when setting
   * @throws if `ms` is not a finite non-negative number
   */
  multiClickDebounceTime(ms?: number): number | this {
    if (ms === undefined) {
      return this._multiClickDebounceTime;
    }

    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) {
      throw new Error(
        `multiClickDebounceTime must be a non-negative number; got '${String(ms)}'`,
      );
    }

    this._multiClickDebounceTime = ms;

    return this;
  }

  /**
   * Wheel-zoom sensitivity: a multiplier on the zoom-per-wheel-tick
   * exponent (v3 parity; default 1).  Non-default values warn once per
   * instance, as v3 does — a custom sensitivity tuned on one mouse/OS
   * zooms unnaturally on others.
   *
   * @param mult — the multiplier to set; omit to read it
   * @returns the multiplier, or this when setting
   * @throws if `mult` is not a finite positive number (0 would freeze the
   *   zoom, so the bound is strict where the threshold setters allow 0)
   */
  wheelSensitivity(mult?: number): number | this {
    if (mult === undefined) {
      return this._wheelSensitivity;
    }

    if (typeof mult !== 'number' || !isFinite(mult) || mult <= 0) {
      throw new Error(
        `wheelSensitivity must be a positive number; got '${String(mult)}'`,
      );
    }

    if (mult !== 1 && !this._wheelSensitivityWarned) {
      this._wheelSensitivityWarned = true;
      console.warn(
        'You have set a custom wheel sensitivity.  This will make your app zoom unnaturally when using mainstream mice.  You should change this value from the default only if you can guarantee that all your users will use the same hardware and OS configuration as your current machine.',
      );
    }

    this._wheelSensitivity = mult;

    return this;
  }

  /**
   * Css px a mouse/pen press may move and still count as a tap (v3 parity;
   * default 4).
   *
   * @param px — the threshold to set; omit to read it
   * @returns the threshold, or this when setting
   * @throws if `px` is not a finite non-negative number
   */
  desktopTapThreshold(px?: number): number | this {
    if (px === undefined) {
      return this._desktopTapThreshold;
    }

    if (typeof px !== 'number' || !isFinite(px) || px < 0) {
      throw new Error(
        `desktopTapThreshold must be a non-negative number; got '${String(px)}'`,
      );
    }

    this._desktopTapThreshold = px;

    return this;
  }

  /**
   * Css px a touch press may move and still count as a tap (v3 parity;
   * default 8).
   *
   * @param px — the threshold to set; omit to read it
   * @returns the threshold, or this when setting
   * @throws if `px` is not a finite non-negative number
   */
  touchTapThreshold(px?: number): number | this {
    if (px === undefined) {
      return this._touchTapThreshold;
    }

    if (typeof px !== 'number' || !isFinite(px) || px < 0) {
      throw new Error(
        `touchTapThreshold must be a non-negative number; got '${String(px)}'`,
      );
    }

    this._touchTapThreshold = px;

    return this;
  }

  /**
   * Unmoved-press duration before 'taphold' fires, ms (default 500 — v3's
   * constant, configurable in v4).
   *
   * @param ms — the duration to set; omit to read it
   * @returns the duration, or this when setting
   * @throws if `ms` is not a finite non-negative number
   */
  tapholdDuration(ms?: number): number | this {
    if (ms === undefined) {
      return this._tapholdDuration;
    }

    if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) {
      throw new Error(
        `tapholdDuration must be a non-negative number; got '${String(ms)}'`,
      );
    }

    this._tapholdDuration = ms;

    return this;
  }

  // -- environment --

  /**
   * The type tag `'core'` — the counterpart of a collection's
   * `'collection'`, for code that accepts either.  Demoted in round 90:
   * v3 never documented it (it fed v3's is-checks), and v4 has no
   * caller.
   *
   * @returns `'core'`
   * @internal
   */
  instanceString(): string {
    return 'core';
  }

  /**
   * Whether the render pipeline is usable yet.  Always true on a headless
   * instance; on a rendered one this flips when `cy.ready` resolves.
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @returns true once rendering can proceed
   */
  isReady(): boolean {
    return this._readyResolved;
  }

  /**
   * Whether this instance has no container and therefore no GPU — the
   * Node-testable mode, in which every model API works and the render,
   * pick and image-export paths are no-ops or reject.
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @returns true when running headless
   */
  headless(): boolean {
    return this._container == null;
  }

  /**
   * Always true: v4 has no style-disabled mode, since the columnar model
   * derives geometry from stored style channels rather than treating
   * style as an optional layer.  Kept so v3 code that checks it works.
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @returns true
   */
  styleEnabled(): boolean {
    return true;
  }

  /**
   * Whether any node currently has a parent.  Worth checking because the
   * compound tier changes paint evaluation and draw order; the renderer
   * pays nothing for compounds while this is false.
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @returns true when the graph has at least one parent/child relation
   */
  hasCompoundNodes(): boolean {
    return this._store.hasCompounds();
  }

  /**
   * Whether an element with this id exists, via the O(1) id index —
   * cheaper than `getElementById( id ).nonempty()` because no handle is
   * materialized.
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @param id — the element id
   * @returns true when the graph holds that element
   */
  hasElementWithId(id: string): boolean {
    return this._store.lookupCode(id) >= 0;
  }

  declare $id: this['getElementById'];

  // round 64: a brevity alias of getElementById, beside $id
  declare byId: this['getElementById'];

  /**
   * The `window` this instance renders into, or null when there is no DOM
   * (Node).  v3 parity, for extensions that need the hosting realm.
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @returns the global window, or null outside a browser
   */
  window(): (Window & typeof globalThis) | null {
    return GLOBAL_WINDOW;
  }

  /**
   * The options the instance was constructed with.
   *
   * Public in v4 by decision (round 90) — v3 kept its counterpart internal.
   *
   * @returns the caller's own options object, held by reference — not a
   *   copy and not a defaults-resolved view, so an option the caller
   *   omitted reads back absent rather than as the default in force
   */
  options(): CytoscapeOptions {
    return this._options;
  }

  /**
   * Export the live graph as the binary wire format (the buffer
   * `options.elements`/`add()` accept directly): the columnar counterpart
   * of `json()`.  Carries ids, positions, selection state, the data()
   * sidecar and — since round 39.2 — graph-level `data()`; style,
   * viewport and scratch are not part of the wire.
   *
   * Note the asymmetry in *loading* that graph data back: `options.
   * elements` applies it, `cy.add( buffer )` ignores it.  Adding elements
   * to a populated graph must not overwrite that graph's own `data()`,
   * and there is no third answer that is right in both places.
   *
   * @returns a fresh little-endian buffer, self-contained (every edge
   *   endpoint indexes a node in the same payload) and directly loadable —
   *   derived geometry is flushed first, so parent boxes are the current
   *   ones rather than whatever was last materialized
   */
  serialize(): ArrayBuffer {
    const store = this._store;

    store.flushDerived(); // parent positions are derived (round 14.8)

    const nodeSlots = store.slotsOrdered('nodes');
    const edgeSlots = store.slotsOrdered('edges');
    const pos = store.column('node.position') as Float32Array;
    const nodeFlags = store.column('node.flags') as Uint32Array;
    const edgeFlags = store.column('edge.flags') as Uint32Array;
    const endpoints = store.column('edge.endpoints') as Uint32Array;

    const nodeIds: string[] = new Array(nodeSlots.length);
    const positions = new Float32Array(nodeSlots.length * 2);
    const nodeSelected = new Uint8Array(nodeSlots.length);
    const nodeSelectable = new Uint8Array(nodeSlots.length);
    const indexOfSlot = new Map<number, number>();

    for (let i = 0; i < nodeSlots.length; i++) {
      const slot = nodeSlots[i];

      indexOfSlot.set(slot, i);
      nodeIds[i] = store.idAt('nodes', slot) as string;
      positions[i * 2] = pos[slot * 2];
      positions[i * 2 + 1] = pos[slot * 2 + 1];
      nodeSelected[i] = (nodeFlags[slot] & FLAG_SELECTED) !== 0 ? 1 : 0;
      nodeSelectable[i] = (nodeFlags[slot] & FLAG_SELECTABLE) !== 0 ? 1 : 0;
    }

    // hierarchy (round 14.8): parent slots -> payload indices (a second
    // pass — a parent may sit later in slot order than its children)
    let nodeParents: Uint32Array | undefined;

    if (store.hasCompounds()) {
      nodeParents = new Uint32Array(nodeSlots.length).fill(NO_PARENT);

      for (let i = 0; i < nodeSlots.length; i++) {
        const parentSlot = store.parentOf(nodeSlots[i]);

        if (parentSlot >= 0) {
          nodeParents[i] = indexOfSlot.get(parentSlot) as number;
        }
      }
    }

    const edgeIds: string[] = new Array(edgeSlots.length);
    const sources = new Uint32Array(edgeSlots.length);
    const targets = new Uint32Array(edgeSlots.length);
    const edgeSelected = new Uint8Array(edgeSlots.length);
    const edgeSelectable = new Uint8Array(edgeSlots.length);

    for (let i = 0; i < edgeSlots.length; i++) {
      const slot = edgeSlots[i];

      edgeIds[i] = store.idAt('edges', slot) as string;
      sources[i] = indexOfSlot.get(endpoints[slot * 2]) as number;
      targets[i] = indexOfSlot.get(endpoints[slot * 2 + 1]) as number;
      edgeSelected[i] = (edgeFlags[slot] & FLAG_SELECTED) !== 0 ? 1 : 0;
      edgeSelectable[i] = (edgeFlags[slot] & FLAG_SELECTABLE) !== 0 ? 1 : 0;
    }

    return serializeElements({
      columnar: true,
      nodes: {
        count: nodeSlots.length,
        ids: nodeIds,
        positions,
        selected: nodeSelected,
        selectable: nodeSelectable,
        ...(nodeParents != null ? { parent: nodeParents } : {}),
        data: store.data.exportColumns('nodes', nodeSlots),
      },
      edges: {
        count: edgeSlots.length,
        ids: edgeIds,
        sources,
        targets,
        selected: edgeSelected,
        selectable: edgeSelectable,
        data: store.data.exportColumns('edges', edgeSlots),
      },
      // graph-level data (round 39.2), copied rather than held by
      // reference: the buffer is a snapshot, and a later cy.data() write
      // must not reach back into a payload the caller may still be
      // serializing
      ...(Object.keys(this._graphData).length > 0
        ? { data: { ...this._graphData } }
        : {}),
    });
  }

  /**
   * Export the graph as a plain object — elements, stylesheet, viewport,
   * gating flags and graph-level data.
   *
   * Export-only: the v3 import/restore form (`json( obj )`) is not
   * supported, because rebuilding from a snapshot needs the stored
   * element definitions that the columnar model deliberately does not
   * keep.  Use `serialize()` for the compact binary counterpart, which
   * *can* be fed back in.
   *
   * @param flat — when true, elements export as one flat array instead of
   *   `{ nodes, edges }` (v3's option)
   * @returns the exported graph
   * @throws if given anything but a boolean — the guard that catches an
   *   attempted `json( obj )` import
   */
  json(flat?: boolean): Record<string, unknown> {
    if (flat != null && typeof flat !== 'boolean') {
      throw new Error(
        'cy.json() is export-only in the GPU prototype; the import/restore form is not supported',
      );
    }

    const elements =
      flat === true
        ? this.elements().jsons()
        : { nodes: this.nodes().jsons(), edges: this.edges().jsons() };

    return {
      elements,
      style: this._styleEngine.json(),
      data: { ...this._graphData },
      zoom: this._viewport.zoom(),
      pan: { ...(this._viewport.pan() as Position) },
      minZoom: this._viewport.minZoom,
      maxZoom: this._viewport.maxZoom,
      zoomingEnabled: this._zoomingEnabled,
      userZoomingEnabled: this._userZoomingEnabled,
      panningEnabled: this._panningEnabled,
      userPanningEnabled: this._userPanningEnabled,
      boxSelectionEnabled: this._boxSelectionEnabled,
      selectionType: this._selectionType,
      autolock: this._autolock,
      autoungrabify: this._autoungrabify,
      autounselectify: this._autounselectify,
      headless: this.headless(),
      styleEnabled: this.styleEnabled(),
    };
  }

  /**
   * Detach the renderer: the instance becomes headless (the model is
   * CPU-canonical, so nothing is lost).  No-op when already headless.
   */
  unmount(): this {
    if (this._container == null) {
      return this;
    }

    this._pointer?.destroy();
    this._pointer = null;
    this._renderer?.destroy();
    this._renderer = null;
    this._container = null;
    this._readyResolved = true; // headless is ready by definition
    this.ready = Promise.resolve(this);

    return this;
  }

  /**
   * (Re)attach a renderer to a container.  Re-mounting to a different
   * container unmounts first; the fresh renderer re-uploads every column
   * from the CPU-canonical model and rebuilds all glyph runs.
   *
   * @param container — the element to render into
   * @returns this
   * @throws if no container is given, if the instance was built directly
   *   rather than through the `cytoscape` factory (there is no renderer
   *   to attach), or if WebGPU is unavailable — mounting is the one way a
   *   headless instance can demand a GPU after construction
   */
  mount(container: HTMLElement): this {
    if (container == null) {
      throw new Error('mount() needs a container element');
    }

    if (this._attachFn == null) {
      throw new Error(
        'This instance cannot mount (it was not created via the cytoscape factory)',
      );
    }

    if (this._container != null) {
      if (this._container === container) {
        return this;
      }

      this.unmount();
    }

    this._container = container;
    this._readyResolved = false;
    // the old label layer consumed the dirty channel; a fresh one starts
    // empty, so every labelled slot must queue for a glyph rebuild
    this._store.markAllLabelsDirty();
    this._attachFn(container);

    return this;
  }

  /**
   * Device-loss recovery (round 10 policy): auto-recover once per loss —
   * emit 'devicelost', re-mount a fresh renderer against the same
   * container (the model is CPU-canonical, so everything rebuilds), then
   * emit 'devicerestored'.  If a loss arrives while a recovery is already
   * in flight, or re-acquisition fails, the instance goes headless-dead
   * and emits 'error' (the pre-round-10 behavior).
   */
  _handleDeviceLost(message: string): void {
    if (this._destroyed) {
      return;
    }

    this.emit({ type: 'devicelost' }, [message]);

    const container = this._container;

    if (this._recoveringDevice || container == null || this._attachFn == null) {
      this.unmount();
      this.emit({ type: 'error' }, [`WebGPU device lost: ${message}`]);

      return;
    }

    this._recoveringDevice = true;
    this.unmount();

    try {
      this.mount(container);
    } catch (err) {
      this._recoveringDevice = false;
      this.emit({ type: 'error' }, [
        `WebGPU device lost and could not recover: ${(err as Error).message}`,
      ]);

      return;
    }

    this.ready.then(
      () => {
        this._recoveringDevice = false;
        this.emit('devicerestored');
      },
      (err: Error) => {
        this._recoveringDevice = false;
        this.unmount();
        this.emit({ type: 'error' }, [
          `WebGPU device lost and could not recover: ${err.message}`,
        ]);
      },
    );
  }

  /**
   * The DOM element this instance renders into, or null when headless or
   * unmounted.
   *
   * @returns the container element, or null
   */
  container(): HTMLElement | null {
    return this._container;
  }

  /**
   * The rendered width in CSS px.  Headless instances report the
   * configured `headlessWidth` (default 800), so viewport maths works
   * without a DOM.
   *
   * @returns the viewport width in CSS px
   */
  width(): number {
    return this._container != null
      ? this._container.clientWidth || this._headlessWidth
      : this._headlessWidth;
  }

  /**
   * The rendered height in CSS px.  Headless instances report the
   * configured `headlessHeight` (default 600).
   *
   * @returns the viewport height in CSS px
   */
  height(): number {
    return this._container != null
      ? this._container.clientHeight || this._headlessHeight
      : this._headlessHeight;
  }

  /**
   * Tear the instance down: emit `destroy`, drop every listener, and
   * release the pointer handler and the renderer (with its GPU
   * resources).  Idempotent.  The store is left intact but the instance
   * must not be used afterwards.
   *
   * @returns this core
   */
  destroy(): this {
    if (this._destroyed) {
      return this;
    }

    this.emit('destroy');
    this._emitter.removeAllListeners();

    this._pointer?.destroy();
    this._pointer = null;

    if (this._renderer != null) {
      this._renderer.destroy();
      this._renderer = null;
    }

    this._destroyed = true;

    return this;
  }

  /**
   * Whether `destroy()` has run.
   *
   * @returns true once destroyed
   */
  destroyed(): boolean {
    return this._destroyed;
  }

  // -- internals --

  /** Interned singleton handle for a live slot. */
  _ele(group: GroupName, slot: number): Collection {
    const pool = this._pool[group];
    const gen = this._store.table(group).gen[slot];
    let ele = pool[slot];

    if (ele == null || ele._refs[0].gen !== gen) {
      ele = new Collection(this, [this._store.ref(group, slot)], {
        singleton: true,
      });
      pool[slot] = ele;
    }

    return ele;
  }

  /** Handle for a ref that may be stale (prefers the interned pre-removal handle). */
  _eleFromRef(ref: Ref): Collection {
    if (this._store.isCurrent(ref)) {
      return this._ele(ref.group, ref.slot);
    }

    const pooled = this._pool[ref.group][ref.slot];

    if (pooled != null && pooled._refs[0].gen === ref.gen) {
      return pooled;
    }

    return new Collection(this, [ref], { singleton: true });
  }

  /** True when writing any of these data() keys can change the group's computed style. */
  _stylesDependOnData(group: GroupName, keys: string[]): boolean {
    return this._styleEngine.stylesDependOnData(group, keys);
  }

  /** Refresh style channels computed from data() (mapped channels + labels), deferred while batching. */
  _refreshMappedStyles(
    group: GroupName,
    slots: number[],
    keys: string[],
  ): void {
    if (this._batchPending != null) {
      for (const slot of slots) {
        this._batchPending.mapped.push(this._store.ref(group, slot));
      }

      for (const key of keys) {
        this._batchPending.mappedKeys.add(key);
      }

      return;
    }

    this._styleEngine.refreshMapped(group, slots, keys);
  }

  /** First style apply for freshly-added slots, deferred while batching. */
  private _applyStyle(group: GroupName, slots: ArrayLike<number>): void {
    if (this._batchPending != null) {
      for (let i = 0; i < slots.length; i++) {
        this._batchPending.style.push(this._store.ref(group, slots[i]));
      }

      return;
    }

    this._styleEngine.applyBulk(group, slots);
  }

  _emitOnEle(
    type: string,
    ele: Collection,
    extraParams?: unknown[],
    props?: Partial<EventProps>,
  ): void {
    // Round 34.3: nothing listens for this type, so there is nothing to
    // do.  Sound because v4's emitter has no bubbling of its own (round
    // 41.2 dropped v3's `bubble`/`parent`; compound bubbling is the
    // phase walk below) — so an emit with no matching listener is
    // observably a no-op.
    //
    // Most callers gate already; the *pointer layer's* sixteen do not
    // (mouseover/mouseout, the pointer pair, tap, tapselect, the box
    // family), and those fire on hover transitions and pointer moves.
    // On a compound graph an ungated emit built an Event, interned a
    // handle per ancestor and emitted once per phase before discovering
    // that nobody cared: 338 ns for a node two ancestors deep against
    // 159 ns for an orphan.
    if (!hasListeners(this._emitter, type)) {
      return;
    }

    const store = this._store;

    if (store.hasCompounds()) {
      const ref = ele._eventRef();

      if (
        ref != null &&
        ref.group === 'nodes' &&
        store.parentOf(ref.slot) >= 0
      ) {
        // compound bubbling (round 14.5): origin -> ancestors -> core in
        // phases on one shared Event, so stopPropagation carries between
        // them.  event.target stays the originator; each phase's element
        // rides _phaseRef/_phaseEle (see events.mts).
        const eventObj = new Event({
          type,
          target: ele,
          ...props,
        }) as PhasedEvent;

        eventObj._phaseRef = ref;
        eventObj._phaseEle = ele;
        this._emitter.emit(eventObj, extraParams);

        for (let p = store.parentOf(ref.slot); p >= 0; p = store.parentOf(p)) {
          if (eventObj.isPropagationStopped()) {
            return;
          }

          const phaseEle = this._ele('nodes', p);

          eventObj._phaseRef = phaseEle._eventRef();
          eventObj._phaseEle = phaseEle;
          this._emitter.emit(eventObj, extraParams);
        }

        if (eventObj.isPropagationStopped()) {
          return;
        }

        eventObj._phaseRef = null;
        eventObj._phaseEle = null;
        this._emitter.emit(eventObj, extraParams);

        return;
      }
    }

    this._emitter.emit({ type, target: ele, ...props }, extraParams);
  }

  _hasListeners(type: string): boolean {
    return hasListeners(this._emitter, type);
  }

  _emitViewportEvents(types: string[]): void {
    for (const type of [...types, 'viewport']) {
      this.emit(type);
    }
  }

  private _boundsOf(
    eles?: Collection,
  ): ReturnType<Collection['boundingBox']> | null {
    if (eles == null) {
      // whole-graph fast path: columnar scan in the store, skipping the
      // per-element handle layer entirely
      return this._store.boundingBox();
    }

    if (eles.length === 0) {
      return null;
    }

    return eles.boundingBox();
  }

  /**
   * A synthetic id for an element added without one.  The prefix read `gpu-`
   * until round 43 — a leftover the 42.6 rename missed, and a user-visible one,
   * since it is what `ele.id()` returns.
   */
  private _newId(): string {
    let id: string;

    do {
      id = 'cy-' + this._idCounter;
      this._idCounter++;
    } while (this._store.ids.has(id));

    return id;
  }
}

Core.prototype.centre = Core.prototype.center;
Core.prototype.$ = Core.prototype.filter;
Core.prototype.byId = Core.prototype.getElementById;
Core.prototype.addListener = Core.prototype.on;
Core.prototype.removeListener = Core.prototype.off;
Core.prototype.once = Core.prototype.one;
Core.prototype.pon = Core.prototype.promiseOn;
Core.prototype.trigger = Core.prototype.emit;
Core.prototype.$id = Core.prototype.getElementById;
Core.prototype.makeLayout = Core.prototype.layout;
Core.prototype.createLayout = Core.prototype.layout;
Core.prototype.invalidateSize = Core.prototype.resize;
Core.prototype.attr = Core.prototype.data;
Core.prototype.removeAttr = Core.prototype.removeData;
Core.prototype.autolockNodes = Core.prototype.autolock;
Core.prototype.autoungrabifyNodes = Core.prototype.autoungrabify;
Core.prototype.jpeg = Core.prototype.jpg;
Core.prototype.gc = Core.prototype.compact;

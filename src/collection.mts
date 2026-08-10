import {
  CURVE_CMPD,
  CURVE_HAS_ENDPT,
  CURVE_MULTI,
  CURVE_STRAIGHT,
  CURVE_TAXI,
  FLAG_ACTIVE,
  FLAG_ALIVE,
  FLAG_CURVED_BOX,
  FLAG_GRABBABLE,
  FLAG_GRABBED,
  FLAG_LOCKED,
  FLAG_NO_EVENTS,
  FLAG_PANNABLE,
  FLAG_PARENT,
  FLAG_SELECTABLE,
  FLAG_SELECTED,
  FLAG_VISIBLE,
} from './contract.mjs';
import type { GroupName, Ref } from './contract.mjs';
import type { GraphStore } from './store/graph-store.mjs';
import { headerDeviation, routeMidpoint } from './curve-geometry.mjs';
import type { CurveRoute } from './curve-geometry.mjs';
import { CURVE_STYLE_BEZIER } from './store/curve-index.mjs';
import { compileQuery, planMatchesRef } from './matcher.mjs';
import type { Query } from './matcher.mjs';
import { testCondition } from './style-scales.mjs';
import { hasListeners, refQualifier } from './events.mjs';
import { normalizeProp as normalizeCss } from './style.mjs';
import { Animation, AnimationHandleImpl } from './animation.mjs';
import type { AnimateOptions, AnimationHandle } from './animation.mjs';
import type { Position } from './types.mjs';
import type { LayoutBaseOptions, LayoutOptions } from './public-types.mjs';
import {
  search as searchImpl,
  dijkstra as dijkstraImpl,
  aStar as aStarImpl,
  bellmanFord as bellmanFordImpl,
  floydWarshall as floydWarshallImpl,
  kruskal as kruskalImpl,
  tarjanStronglyConnected as tarjanImpl,
  hopcroftTarjanBiconnected as hopcroftTarjanImpl,
  hierholzer as hierholzerImpl,
  kargerStein as kargerSteinImpl,
  pageRank as pageRankImpl,
  degreeCentrality as degreeCentralityImpl,
  degreeCentralityNormalized as degreeCentralityNormalizedImpl,
  closenessCentrality as closenessCentralityImpl,
  closenessCentralityNormalized as closenessCentralityNormalizedImpl,
  betweennessCentrality as betweennessCentralityImpl,
  kMeans as kMeansImpl,
  kMedoids as kMedoidsImpl,
  fuzzyCMeans as fuzzyCMeansImpl,
  hierarchicalClustering as hierarchicalClusteringImpl,
  markovClustering as markovClusteringImpl,
  affinityPropagation as affinityPropagationImpl,
} from './algorithms/index.mjs';
import type {
  SearchArgs,
  SearchResult,
  DijkstraArgs,
  DijkstraResult,
  AStarOptions,
  AStarResult,
  BellmanFordOptions,
  BellmanFordResult,
  FloydWarshallOptions,
  FloydWarshallResult,
  WeightFn,
  TarjanStronglyConnectedResult,
  HopcroftTarjanBiconnectedResult,
  HierholzerArgs,
  HierholzerResult,
  KargerSteinResult,
  PageRankOptions,
  PageRankResult,
  DegreeCentralityOptions,
  DegreeCentralityResult,
  DegreeCentralityNormalizedResult,
  ClosenessCentralityOptions,
  ClosenessCentralityNormalizedResult,
  BetweennessCentralityOptions,
  BetweennessCentralityResult,
  KClusteringOptions,
  FuzzyCMeansResult,
  HierarchicalClusteringOptions,
  MarkovClusteringOptions,
  AffinityPropagationOptions,
} from './algorithms/index.mjs';
import type { Core } from './core.mjs';
import type { EventHandler } from './emitter.mjs';
import type { Event } from './event.mjs';

export type EleFilterFn = (
  ele: Collection,
  i: number,
  eles: Collection,
) => boolean;
export type ElePositionFn = (
  ele: Collection,
  i: number,
) => Position | false | undefined;

/** A subset criterion: a structured query or a per-element predicate. */
type FilterLike = Query | EleFilterFn;

// Pack a ref into a single safe integer (group in bit 52, slot in bits 24..51,
// gen in bits 0..23) for set membership. Avoids the per-element string
// allocation of refKey() in the hot dedupe and set-operation paths, while still
// keying on the full {group, slot, gen} identity. Safe for slot < 2^28 and
// gen < 2^24 — far beyond any practical graph.
const packRef = (r: Ref): number =>
  (r.group === 'nodes' ? 0 : 0x10000000000000) + r.slot * 0x1000000 + r.gen;

/** Model-px style props that renderedStyle() scales by the zoom. */
const RENDERED_LENGTH_PROPS: ReadonlySet<string> = new Set([
  'width',
  'height',
  'border-width',
  'font-size',
]);

/**
 * Guard for the methods that take another collection (29.3).  v4 has no
 * selector strings, so these take collections — but a v3-style string
 * used to reach the body and either crash with an internal TypeError
 * (`other._refs is not iterable`) or, worse, answer silently: `same('#a')`
 * returned false.
 *
 * @param other — the argument to check
 * @param method — the method name, for the message
 * @throws when `other` is not a collection
 */
const assertCollection = (other: unknown, method: string, cy?: Core): void => {
  if (other == null || !Array.isArray((other as Collection)._refs)) {
    throw new Error(
      `${method}() takes a collection, not ${
        typeof other === 'string'
          ? `the selector string '${other}'`
          : `a ${other === null ? 'null' : typeof other}`
      } — ` +
        `v4 has no selector strings; use cy.$id( id ), a query object like ` +
        `cy.nodes({ selected: true }), or a predicate`,
    );
  }

  // Round 48.4, found by the multi-instance soak. A ref is
  // `{ group, slot, gen }` and identity keys on those three packed into an
  // integer — all of which are *per instance*, so the first node of one
  // graph and the first node of another pack identically. Every method
  // below then answered as though they were one element: `same()` was true,
  // `intersection()` returned everything, `difference()` returned nothing,
  // and `union()` silently dropped the other graph's elements entirely
  // (two graphs of two nodes united to two).
  //
  // A collection belongs to one core — mixing two is not a thing v4 can
  // represent, since `_refs` are meaningless outside their store — so the
  // answer is to refuse rather than to invent a cross-instance identity.
  // That is this repo's rule for the same shape of defect one round over:
  // round 29.3 added this guard because these twelve methods crashed on a
  // non-collection *or, in `same()`'s case, quietly returned false, which
  // reads as working code*. This is that sentence again with a different
  // wrong answer.
  if (cy != null && (other as Collection)._cy !== cy) {
    throw new Error(
      `${method}() takes a collection from the same instance — element ` +
        'identity is per instance in v4 (a ref is a slot in *this* store), so ' +
        'comparing across two cytoscape instances has no meaning',
    );
  }
};

// Round 34.1: a Map from packed key to *first index*, not a Set.  Set
// membership only ever asks `.has()`, which a Map answers identically,
// and carrying the index makes `indexOf` O(1) off the same cache
// instead of a linear scan that re-packs every ref (3.63 µs over a
// 2000-element collection, against v3's 45 ns).  One cache, two
// consumers — the shape this codebase reaches for elsewhere.
const refIndex = (refs: Ref[]): Map<number, number> => {
  const index = new Map<number, number>();

  for (let i = 0; i < refs.length; i++) {
    const key = packRef(refs[i]);

    // first index wins: collections are unique by construction, so this
    // only matters if one ever is not
    if (!index.has(key)) {
      index.set(key, i);
    }
  }

  return index;
};

/**
 * A v3-style collection over the columnar store: an element is a length-1
 * collection, interned per live slot so `eles[0]`, `forEach` args and
 * `same()` behave as expected.  Handles hold `{ group, slot, gen }` refs
 * validated on access; stale refs (removed elements) read as no-ops or
 * `undefined`, though cached `id()`/`group()` stay readable.
 */
export class Collection {
  [index: number]: Collection;

  // -- basics --

  /** How many elements this collection holds. */
  length: number;

  _cy: Core;
  /** the owning store, held directly (round 62.5): every accessor read
   * it through a getter chain, which showed on the nanosecond rows */
  _store: GraphStore;
  private __refs!: Ref[];
  /** the store's compactEpoch this collection last synced against (19.3) */
  private _syncEpoch = -1;
  _id: string | undefined;
  _group: GroupName | undefined;
  /** per-element scratchpad, lazily created on the interned singleton handle */
  _scratch?: Record<string, unknown>;
  /** lazily-built packed-key → first-index map; safe to cache since _refs is immutable */
  _keys?: Map<number, number>;
  /** lazily-built id → index map for indexOfId (round 62.4), cacheable
   * on the same immutability grounds as _keys */
  _idIdx?: Map<string, number>;
  /** the whole-object data() cache (round 62.4), valid while the
   * DataStore epoch, the synthesized-field inputs (parent slot or
   * endpoints) and the ref's generation all hold */
  _dataObj?: {
    epoch: number;
    aux: number;
    gen: number;
    obj: Record<string, unknown>;
  };
  /** the algorithms' SubgraphView memo (round 62.1), keyed by the
   * store's structureEpoch — sound because membership is _refs (immutable)
   * minus dead refs, and death moves the epoch.  Typed loosely to keep
   * the algorithms layer out of this module's imports. */
  _sgView?: { epoch: number; view: unknown };

  /**
   * The collection's refs, repaired lazily after a slot compaction
   * (19.3): on first access past a new compaction epoch, every stale-
   * but-forwarded ref rewrites in place (fixing all holders of that ref
   * object) and the packed membership cache drops.  The array identity
   * and length never change — dead refs stay dead in place, matching
   * removed-element semantics.
   */
  get _refs(): Ref[] {
    const store = this._cy._store;

    if (this._syncEpoch !== store.compactEpoch) {
      this._syncEpoch = store.compactEpoch;

      const refs = this.__refs;

      for (let i = 0; i < refs.length; i++) {
        store.isCurrent(refs[i]);
      }

      this._keys = undefined;
    }

    return this.__refs;
  }

  set _refs(refs: Ref[]) {
    this.__refs = refs;
    this._syncEpoch = this._cy._store.compactEpoch;
  }

  /**
   * Build a collection over a ref list.  Not part of the public API —
   * collections come from the core (`cy.nodes()`, `cy.$id()`,
   * `cy.collection()`) and from other collections; going through those
   * keeps handle interning and dedupe correct.
   *
   * @param cy — the owning core
   * @param refs — the element refs to hold
   * @param opts — `singleton` for the interned per-slot handle, `unique`
   *   when the refs are already deduped, `live` when they are also known
   *   current (both skip work on the hot path)
   */
  constructor(
    cy: Core,
    refs: Ref[],
    opts: {
      singleton?: boolean;
      unique?: boolean;
      live?: boolean;
      /** interned handles matching `refs` one-for-one (round 62.4):
       * a slice of an existing collection passes its own — they are
       * exactly what re-interning would return, minus the per-element
       * validation the source collection already carries */
      handles?: Collection[];
    } = {},
  ) {
    this._cy = cy;
    this._store = cy._store;

    if (opts.handles != null) {
      const handles = opts.handles;

      for (let i = 0; i < handles.length; i++) {
        this[i] = handles[i];
      }

      this._refs = refs;
      this.length = refs.length;

      if (refs.length === 1) {
        this._id = this[0]._id;
        this._group = refs[0].group;
      }

      return;
    }

    if (opts.singleton) {
      const ref = refs[0];

      this._refs = [ref];
      this._id = cy._store.idAt(ref.group, ref.slot);
      this._group = ref.group;
      this[0] = this;
      this.length = 1;

      return;
    }

    let deduped: Ref[];

    if (opts.unique) {
      // trusted internal path: the refs are known distinct (fresh adds,
      // ordered-slot iteration), so skip the refKey/Set dedupe pass
      deduped = refs;

      if (opts.live) {
        // trusted further: the refs are current (store-scan / id-index
        // output), so intern with the pool and gen lookups hoisted out of
        // the per-element path instead of going through _eleFromRef
        const nodePool = cy._pool.nodes;
        const edgePool = cy._pool.edges;

        for (let i = 0; i < refs.length; i++) {
          const ref = refs[i];
          const pool = ref.group === 'nodes' ? nodePool : edgePool;
          let ele = pool[ref.slot];

          if (ele == null || ele._refs[0].gen !== ref.gen) {
            ele = new Collection(cy, [ref], { singleton: true });
            pool[ref.slot] = ele;
          }

          this[i] = ele;
        }
      } else {
        for (let i = 0; i < refs.length; i++) {
          this[i] = cy._eleFromRef(refs[i]);
        }
      }
    } else {
      // dedupe while preserving order; intern per-element handles
      const seen = new Set<number>();

      deduped = [];

      let i = 0;

      for (const ref of refs) {
        // intern first: _eleFromRef repairs a compaction-forwarded stale
        // ref in place, so the packed key below is its current identity
        const ele = cy._eleFromRef(ref);
        const key = packRef(ref);

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        deduped.push(ref);
        this[i] = ele;
        i++;
      }
    }

    this._refs = deduped;
    this.length = deduped.length;

    if (deduped.length === 1) {
      this._id = this[0]._id;
      this._group = deduped[0].group;
    }
  }

  // -- internals --

  _first(): Ref | undefined {
    return this._refs[0];
  }

  /** the event system's view of this collection (see events.mts) */
  _eventRef(): Ref | null {
    return this.length === 1 ? this._refs[0] : null;
  }

  _liveRefs(): Ref[] {
    return this._refs.filter((ref) => this._store.isCurrent(ref));
  }

  _spawn(refs: Ref[]): Collection {
    return new Collection(this._cy, refs);
  }

  /**
   * Like `_spawn`, but for refs already known to be distinct (a subset of this
   * collection's deduped refs). Skips the dedupe Set build.
   */
  _spawnUnique(refs: Ref[]): Collection {
    return new Collection(this._cy, refs, { unique: true });
  }

  /**
   * Like `_spawnUnique`, but for refs also known to be current (freshly
   * read off the store, e.g. traversal output): interning skips the
   * per-element gen re-validation of `_eleFromRef`.
   */
  _spawnLive(refs: Ref[]): Collection {
    return new Collection(this._cy, refs, { unique: true, live: true });
  }

  /**
   * A cached Map of this collection's packed element keys to their first
   * index, for set membership (`.has()`) and `indexOf` alike.
   * Sound to cache: `_refs` is fixed at construction, and a packed key encodes
   * the ref's own {group, slot, gen}, so it stays valid even as the store
   * mutates. Built lazily — collections that never do a set op or an
   * `indexOf` pay nothing.
   */
  _keySet(): Map<number, number> {
    return (this._keys ??= refIndex(this._refs));
  }

  // -- core reference & identity --

  /**
   * The type tag `'collection'` — the counterpart of the core's
   * `'core'`, for code that accepts either.
   *
   * @returns `'collection'`
   */
  instanceString(): string {
    return 'collection';
  }

  /**
   * The core this collection belongs to.
   *
   * @returns the instance that owns these elements — a collection cannot
   *   span two cores, so this is also the identity a set operation
   *   against a foreign collection would violate
   */
  cy(): Core {
    return this._cy;
  }

  /**
   * The renderer, or null when headless.
   *
   * @returns the renderer, or null on a headless instance — the model is
   *   CPU-canonical, so a null renderer costs drawing, picking and image
   *   export and nothing else
   */
  renderer(): Core['_renderer'] {
    return this._cy._renderer;
  }

  /**
   * The first element as a length-1 collection (empty collection when empty).
   *
   * @returns a length-1 collection, or an empty one — v4 has no separate
   *   element type, so this narrows rather than unwraps
   */
  element(): Collection {
    return this.eq(0);
  }

  /**
   * An empty collection in the same core.
   *
   * @returns a fresh empty collection bound to this core — the seed for
   *   building a set up by union
   */
  collection(): Collection {
    return this._cy.collection();
  }

  /**
   * Whether this collection contains an element with the given id.
   *
   * @param id — the element id
   * @returns true when a member has that id
   */
  hasElementWithId(id: string): boolean {
    return this.getElementById(id).nonempty();
  }

  /**
   * Index of an element within this collection.
   *
   * @param ele — the element to find; only its first element is used
   * @returns the index, or -1 when it is not in this collection
   */
  indexOf(ele: Collection): number {
    assertCollection(ele, 'indexOf', this._cy);

    const ref = ele._first();

    if (ref == null) {
      return -1;
    }

    // O(1) off the shared packed-key cache (34.1), which set membership
    // builds anyway; a linear re-packing scan was 81× v3 here
    return this._keySet().get(packRef(ref)) ?? -1;
  }

  /**
   * Position of the element with this id within the collection.
   *
   * @param id — the element id
   * @returns the index, or -1 when absent
   */
  indexOfId(id: string): number {
    // Lazily-built id → index map, sound for the same reason `_keys`
    // is: `_refs` is immutable, ids are immutable, and a removed
    // member's handle keeps its cached `_id` — which is exactly what
    // the linear scan compared, so the map preserves the
    // still-answers-for-removed-elements contract round 34.1 kept
    // this method out of the id index for (round 62.4: the scan read
    // 0.02× against v3's indexed lookup).
    let map = this._idIdx;

    if (map == null) {
      map = new Map();

      for (let i = this.length - 1; i >= 0; i--) {
        const id0 = this[i]._id;

        if (id0 != null) {
          map.set(id0, i);
        }
      }

      this._idIdx = map;
    }

    const at = map.get(id);

    return at === undefined ? -1 : at;
  }

  // -- iteration --

  /**
   * The number of elements — the method form of `length`.
   *
   * @returns the element count
   */
  size(): number {
    return this.length;
  }

  /**
   * Whether the collection holds no elements.
   *
   * @returns true when empty
   */
  empty(): boolean {
    return this.length === 0;
  }

  /**
   * Whether the collection holds at least one element.
   *
   * @returns true when non-empty
   */
  nonempty(): boolean {
    return this.length > 0;
  }

  /**
   * Call `fn` for each element.  Returning `false` from the callback
   * stops the iteration early, as in v3.
   *
   * With no `thisArg` the callback is plain-called, so `this` is
   * undefined inside it — v3's semantics, and deliberate: rebinding the
   * receiver per element costs about 2x on large collections.
   *
   * @param fn — `( ele, i, eles )`; return `false` to stop
   * @param thisArg — optional receiver for the callback
   * @returns this collection, for chaining
   */
  forEach(
    fn: (ele: Collection, i: number, eles: Collection) => void | false,
    thisArg?: unknown,
  ): this {
    const n = this.length;

    // exit early like v3 when the callback returns false; a plain call when
    // there is no thisArg, like v3 — rebinding the receiver per element via
    // fn.call() costs ~2x on large collections
    if (thisArg == null) {
      for (let i = 0; i < n; i++) {
        if (fn(this[i], i, this) === false) {
          break;
        }
      }
    } else {
      for (let i = 0; i < n; i++) {
        if (fn.call(thisArg, this[i], i, this) === false) {
          break;
        }
      }
    }

    return this;
  }

  declare each: this['forEach'];

  /**
   * The elements as a plain array of length-1 collections.
   *
   * @returns a new array of the members
   */
  toArray(): Collection[] {
    const n = this.length;
    const array: Collection[] = new Array(n);

    for (let i = 0; i < n; i++) {
      array[i] = this[i];
    }

    return array;
  }

  /**
   * A sub-range of the collection, with `Array#slice` semantics
   * (negative indices count from the end).
   *
   * @param start — first index, inclusive
   * @param end — last index, exclusive
   * @returns the sub-range as a new collection
   */
  slice(start: number = 0, end: number = this.length): Collection {
    if (start < 0) {
      start = this.length + start;
    }
    if (end < 0) {
      end = this.length + end;
    }

    // the _refs getter syncs the compaction epoch first, so the copied
    // refs and handles are current together (round 62.4)
    const refs = this._refs.slice(start, end);
    const handles: Collection[] = new Array(refs.length);

    for (let i = 0; i < refs.length; i++) {
      handles[i] = this[start + i];
    }

    return new Collection(this._cy, refs, { unique: true, handles });
  }

  /**
   * A copy sorted by a comparator.  Note that sort order is a property
   * of the *collection*, not of drawing: v4 draw order is structural and
   * there is no `z-index`.
   *
   * @param sortFn — `( a, b )` comparator over length-1 collections; a
   *   non-function is ignored and returns this collection unchanged
   * @returns a new, sorted collection
   */
  sort(sortFn: (a: Collection, b: Collection) => number): Collection {
    if (typeof sortFn !== 'function') {
      return this;
    }

    const sorted = this.toArray().sort(sortFn);
    // the sorted handles are this collection's own interned singletons,
    // so they pass straight through as the new collection's handles —
    // no per-element re-validation or dedupe (round 62.5)
    const refs: Ref[] = new Array(sorted.length);

    for (let i = 0; i < sorted.length; i++) {
      refs[i] = sorted[i]._refs[0];
    }

    return new Collection(this._cy, refs, { unique: true, handles: sorted });
  }

  /**
   * The element at an index, as a length-1 collection.
   *
   * @param i — the index
   * @returns that element, or an empty collection when out of range
   */
  eq(i: number): Collection {
    return this[i] ?? this._spawn([]);
  }

  /**
   * The first element, as a length-1 collection.
   *
   * @returns the first element, or an empty collection
   */
  first(): Collection {
    return this.eq(0);
  }

  /**
   * The last element, as a length-1 collection.
   *
   * @returns the last element, or an empty collection
   */
  last(): Collection {
    return this.eq(this.length - 1);
  }

  /**
   * Map each element through `fn` into a plain array.
   *
   * @param fn — `( ele, i, eles )`
   * @param thisArg — optional receiver for the callback
   * @returns an array of the results
   */
  map<T>(
    fn: (ele: Collection, i: number, eles: Collection) => T,
    thisArg?: unknown,
  ): T[] {
    const n = this.length;
    const array: T[] = new Array(n);

    if (thisArg == null) {
      for (let i = 0; i < n; i++) {
        array[i] = fn(this[i], i, this);
      }
    } else {
      for (let i = 0; i < n; i++) {
        array[i] = fn.call(thisArg, this[i], i, this);
      }
    }

    return array;
  }

  /**
   * Whether any element satisfies the predicate.  Short-circuits.
   *
   * @param fn — `( ele, i, eles ) => boolean`
   * @param thisArg — optional receiver for the callback
   * @returns true when at least one element matches
   */
  some(fn: EleFilterFn, thisArg?: unknown): boolean {
    for (let i = 0; i < this.length; i++) {
      const ret =
        thisArg == null
          ? fn(this[i], i, this)
          : fn.call(thisArg, this[i], i, this);

      if (ret) {
        return true;
      }
    }

    return false;
  }

  /**
   * Whether every element satisfies the predicate.  Short-circuits, and
   * is vacuously true for an empty collection.
   *
   * @param fn — `( ele, i, eles ) => boolean`
   * @param thisArg — optional receiver for the callback
   * @returns true when all elements match
   */
  every(fn: EleFilterFn, thisArg?: unknown): boolean {
    for (let i = 0; i < this.length; i++) {
      const ret =
        thisArg == null
          ? fn(this[i], i, this)
          : fn.call(thisArg, this[i], i, this);

      if (!ret) {
        return false;
      }
    }

    return true;
  }

  // -- identity --

  /**
   * The first element's id.  Cached on the handle, so it stays readable
   * after the element is removed.
   *
   * @returns the id, or undefined when the collection is empty
   */
  id(): string | undefined {
    return this[0]?._id;
  }

  /**
   * The first element's group.  Cached on the handle, so it stays
   * readable after removal.
   *
   * @returns `'nodes'` or `'edges'`, or undefined when empty
   */
  group(): GroupName | undefined {
    return this[0]?._group;
  }

  /**
   * Plain-object form of the first element (undefined when empty).
   *
   * @returns the definition-form object for the **first** element, or
   *   undefined when the collection is empty; it round-trips through
   *   `cy.add()`, which is the supported restore path since `cy.json()`'s
   *   import form is not in v4
   */
  json(): Record<string, unknown> | undefined {
    const ref = this._first();

    if (ref == null) {
      return undefined;
    }

    const group = this._group ?? ref.group;
    const data = (this.data() as Record<string, unknown>) ?? { id: this.id() };
    const json: Record<string, unknown> = {
      group,
      data,
      removed: this.removed(),
      selected: this.selected(),
      selectable: this.selectable(),
      locked: this.locked(),
      // the raw grabbable field, not the pannable-overridden getter (as in v3 json)
      grabbable: this._hasBit(FLAG_GRABBABLE),
      pannable: this.pannable(),
      classes: '',
    };

    if (group === 'nodes') {
      json.position = (this.position() as Position | undefined) ?? {
        x: 0,
        y: 0,
      };
    }

    return json;
  }

  /**
   * Plain-object form of every element.
   *
   * @returns one object per element, in collection order — the plural of
   *   `json()`, not a graph-level export
   */
  jsons(): (Record<string, unknown> | undefined)[] {
    const out: (Record<string, unknown> | undefined)[] = [];

    for (let i = 0; i < this.length; i++) {
      out.push(this[i].json());
    }

    return out;
  }

  /**
   * Whether the first element is a node.
   *
   * @returns true for a node
   */
  isNode(): boolean {
    return this.group() === 'nodes';
  }

  /**
   * Whether the first element is an edge.
   *
   * @returns true for an edge
   */
  isEdge(): boolean {
    return this.group() === 'edges';
  }

  /**
   * Whether the first element is a self-loop — an edge whose source and
   * target are the same node.
   *
   * @returns true for a loop edge; false for nodes and removed elements
   */
  isLoop(): boolean {
    return this._isLoop(true);
  }

  /**
   * Whether the first element is a non-loop edge.
   *
   * @returns true for an edge between two distinct nodes
   */
  isSimple(): boolean {
    return this._isLoop(false);
  }

  private _isLoop(wantLoop: boolean): boolean {
    const ref = this._first();

    if (ref == null || ref.group !== 'edges' || !this._store.isCurrent(ref)) {
      return false;
    }

    const endpoints = this._store.column('edge.endpoints') as Uint32Array;
    const isLoop = endpoints[ref.slot * 2] === endpoints[ref.slot * 2 + 1];

    return wantLoop ? isLoop : !isLoop;
  }

  /**
   * Whether the first element has been removed from the graph.  A
   * removed element's handle stays usable — reads are no-ops or
   * undefined, and the cached `id()`/`group()` remain readable.
   *
   * @returns true when the element is no longer in the graph
   */
  removed(): boolean {
    const ref = this._first();

    return ref == null ? false : !this._store.isCurrent(ref);
  }

  /**
   * Whether the first element is still in the graph — the complement of
   * `removed()`.
   *
   * @returns true when the element is live
   */
  inside(): boolean {
    const ref = this._first();

    return ref == null ? false : this._store.isCurrent(ref);
  }

  // -- comparison --

  /**
   * Whether both collections hold exactly the same elements, ignoring
   * order.
   *
   * @param other — the collection to compare against
   * @returns true when the element sets are equal
   */
  same(other: Collection): boolean {
    assertCollection(other, 'same', this._cy);

    if (this === other) {
      return true;
    }
    if (this.length !== other.length) {
      return false;
    }

    const keys = this._keySet();
    const or = other._refs;

    for (let i = 0; i < or.length; i++) {
      if (!keys.has(packRef(or[i]))) {
        return false;
      }
    }

    return true;
  }

  /**
   * Whether the two collections share at least one element.
   *
   * @param other — the collection to compare against
   * @returns true when the sets intersect
   */
  anySame(other: Collection): boolean {
    assertCollection(other, 'anySame', this._cy);

    if (this === other) {
      return this.length > 0;
    }

    const keys = this._keySet();
    const or = other._refs;

    for (let i = 0; i < or.length; i++) {
      if (keys.has(packRef(or[i]))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Whether every element of `other` is also in this collection.
   *
   * @param other — the candidate subset
   * @returns true when `other` is contained
   */
  contains(other: Collection): boolean {
    assertCollection(other, 'contains', this._cy);

    if (this === other) {
      return true;
    }
    if (other.length > this.length) {
      return false;
    }

    const keys = this._keySet();
    const or = other._refs;

    for (let i = 0; i < or.length; i++) {
      if (!keys.has(packRef(or[i]))) {
        return false;
      }
    }

    return true;
  }

  declare has: this['contains'];
  declare equal: this['same'];
  declare equals: this['same'];

  /**
   * Whether every element of `other` is in this collection's neighborhood.
   *
   * @param other — the elements to test
   * @returns true when all of them are neighbors
   */
  allAreNeighbors(other: Collection): boolean {
    assertCollection(other, 'allAreNeighbors', this._cy);

    const nhood = this.neighborhood();

    return other.every((ele) => nhood.hasElementWithId(ele.id() as string));
  }

  declare allAreNeighbours: this['allAreNeighbors'];

  /**
   * Whether every element matches the criterion.
   *
   * @param criterion — a query object or an `( ele ) => boolean`
   *   predicate (there are no selector strings in v4)
   * @returns true when all elements match
   */
  allAre(criterion: FilterLike): boolean {
    if (typeof criterion === 'function') {
      return this.every(criterion);
    }

    const plan = compileQuery(criterion);

    return this._refs.every((ref) => planMatchesRef(this._store, ref, plan));
  }

  /**
   * Whether any element matches the criterion.
   *
   * @param criterion — a query object or an `( ele ) => boolean`
   *   predicate
   * @returns true when at least one element matches
   */
  is(criterion: FilterLike): boolean {
    if (typeof criterion === 'function') {
      return this.some(criterion);
    }

    const plan = compileQuery(criterion);

    return this._refs.some((ref) => planMatchesRef(this._store, ref, plan));
  }

  // -- building and filtering --

  /**
   * The union of the two collections, deduped.
   *
   * @param other — the collection to add
   * @returns a new collection holding both sets
   */
  union(other: Collection): Collection {
    assertCollection(other, 'union', this._cy);

    return this._spawn([...this._refs, ...other._refs]);
  }

  declare u: this['union'];
  declare or: this['union'];
  declare add: this['union'];
  declare merge: this['union'];

  /**
   * This collection's elements that are not in `other`.
   *
   * @param other — the collection to subtract
   * @returns a new collection
   */
  difference(other: Collection): Collection {
    assertCollection(other, 'difference', this._cy);

    const keys = other._keySet();

    return this._spawnUnique(
      this._refs.filter((ref) => !keys.has(packRef(ref))),
    );
  }

  declare not: this['difference'];
  declare subtract: this['difference'];
  declare unmerge: this['difference'];
  declare relativeComplement: this['difference'];

  /**
   * The elements present in both collections.
   *
   * @param other — the collection to intersect with
   * @returns a new collection
   */
  intersection(other: Collection): Collection {
    assertCollection(other, 'intersection', this._cy);

    const keys = other._keySet();

    return this._spawnUnique(
      this._refs.filter((ref) => keys.has(packRef(ref))),
    );
  }

  declare intersect: this['intersection'];
  declare and: this['intersection'];

  /**
   * The elements in exactly one of the two collections.
   *
   * @param other — the other collection
   * @returns a new collection
   */
  symmetricDifference(other: Collection): Collection {
    assertCollection(other, 'symmetricDifference', this._cy);

    const otherEles = other;
    const mine = this._keySet();
    const theirs = otherEles._keySet();

    // the two parts are disjoint by construction, so the result is unique
    return this._spawnUnique([
      ...this._refs.filter((ref) => !theirs.has(packRef(ref))),
      ...otherEles._refs.filter((ref) => !mine.has(packRef(ref))),
    ]);
  }

  declare symdiff: this['symmetricDifference'];
  declare xor: this['symmetricDifference'];

  /**
   * The subset matching the criterion.
   *
   * A structured **query object** is answered directly off the flags
   * column — no per-element handles and no closures — while a
   * **predicate function** is called per element.  v4 has no selector
   * strings, so those two forms cover what v3 spelled with a selector.
   *
   * @param criterion — a query object (`{ selected: true }`,
   *   `{ data: { weight: { gt: 0.5 } } }`, …) or an
   *   `( ele, i, eles ) => boolean` predicate
   * @param thisArg — optional receiver, for the predicate form
   * @returns a new collection of the matching elements
   * @throws if a query object carries an unknown key — a typo must not
   *   silently match everything
   */
  filter(criterion: FilterLike, thisArg?: unknown): Collection {
    // the result is a subset of this collection's (already unique) refs
    if (typeof criterion === 'function') {
      const refs: Ref[] = [];
      const n = this.length;

      for (let i = 0; i < n; i++) {
        const include =
          thisArg == null
            ? criterion(this[i], i, this)
            : criterion.call(thisArg, this[i], i, this);

        if (include) {
          refs.push(this._refs[i]);
        }
      }

      return this._spawnUnique(refs);
    }

    // structured query: test each ref against its group's (mask, want)
    // directly on the flags column — no per-ref handles or closures
    const store = this._store;
    const plan = compileQuery(criterion);
    const nodeTest = plan.nodes;
    const edgeTest = plan.edges;
    const nodeGen = store.nodes.gen;
    const edgeGen = store.edges.gen;
    const nodeFlags = store.column('node.flags') as Uint32Array;
    const edgeFlags = store.column('edge.flags') as Uint32Array;
    const dataConds = plan.data;
    const refs: Ref[] = [];

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];
      const isNode = ref.group === 'nodes';
      const test = isNode ? nodeTest : edgeTest;

      if (test == null) {
        continue;
      }

      if ((isNode ? nodeGen : edgeGen)[ref.slot] !== ref.gen) {
        continue;
      } // stale

      const flags = (isNode ? nodeFlags : edgeFlags)[ref.slot];

      if ((flags & test.mask) !== test.want) {
        continue;
      }

      if (dataConds != null) {
        let pass = true;

        for (const cond of dataConds) {
          if (
            !testCondition(cond, store.data.get(ref.group, ref.slot, cond.key))
          ) {
            pass = false;
            break;
          }
        }

        if (!pass) {
          continue;
        }
      }

      refs.push(ref);
    }

    return this._spawnUnique(refs);
  }

  /**
   * The nodes in this collection, optionally filtered.
   *
   * @param criterion — a query object or predicate; omit for all nodes
   * @returns a new collection of nodes
   */
  nodes(criterion?: FilterLike): Collection {
    const nodes = this._spawnUnique(
      this._refs.filter((ref) => ref.group === 'nodes'),
    );

    return criterion == null ? nodes : nodes.filter(criterion);
  }

  /**
   * The edges in this collection, optionally filtered.
   *
   * @param criterion — a query object or predicate; omit for all edges
   * @returns a new collection of edges
   */
  edges(criterion?: FilterLike): Collection {
    const edges = this._spawnUnique(
      this._refs.filter((ref) => ref.group === 'edges'),
    );

    return criterion == null ? edges : edges.filter(criterion);
  }

  /**
   * Find a member by id.  This is a linear scan of the collection; use
   * `cy.$id( id )` for the O(1) whole-graph index.
   *
   * @param id — the element id
   * @returns a collection of one element, or an empty collection
   */
  getElementById(id: string): Collection {
    for (let i = 0; i < this.length; i++) {
      if (this[i]._id === id) {
        return this[i];
      }
    }

    return this._spawn([]);
  }

  /** Split into { nodes, edges }. */
  byGroup(): { nodes: Collection; edges: Collection } {
    return { nodes: this.nodes(), edges: this.edges() };
  }

  /**
   * All elements of the graph not in this collection.
   *
   * @returns the complement against the **whole graph**, not against any
   *   enclosing collection — which is what the `absolute` in the name is
   *   distinguishing
   */
  absoluteComplement(): Collection {
    return this._cy.elements().difference(this);
  }

  declare complement: this['absoluteComplement'];
  declare abscomp: this['absoluteComplement'];

  /**
   * Three-way set difference against another collection.
   *
   * @param other — the collection to compare with
   * @returns `{ left: only in this, right: only in other, both: in both }`
   */
  diff(other: Collection): {
    left: Collection;
    right: Collection;
    both: Collection;
  } {
    assertCollection(other, 'diff', this._cy);

    const otherColl = other;
    const mine = this._keySet();
    const theirs = otherColl._keySet();

    return {
      left: this._spawnUnique(
        this._refs.filter((ref) => !theirs.has(packRef(ref))),
      ),
      right: this._spawnUnique(
        otherColl._refs.filter((ref) => !mine.has(packRef(ref))),
      ),
      both: this._spawnUnique(
        this._refs.filter((ref) => theirs.has(packRef(ref))),
      ),
    };
  }

  /**
   * Fold the collection into a single value.
   *
   * @param fn — `( accumulator, ele, i, eles )`
   * @param initial — the starting accumulator (required, unlike
   *   `Array#reduce`)
   * @returns the final accumulator
   */
  reduce<T>(
    fn: (acc: T, ele: Collection, i: number, eles: Collection) => T,
    initial: T,
  ): T {
    let val = initial;

    for (let i = 0; i < this.length; i++) {
      val = fn(val, this[i], i, this);
    }

    return val;
  }

  /**
   * The element maximizing `valFn`, with its value.
   *
   * @param valFn — `( ele, i, eles ) => number`
   * @param thisArg — optional receiver for the callback
   * @returns `{ value, ele }`, or `{ value: -Infinity, ele: undefined }`
   *   when the collection is empty
   */
  max(
    valFn: (ele: Collection, i: number, eles: Collection) => number,
    thisArg?: unknown,
  ): { value: number; ele: Collection | undefined } {
    return this._extremum(valFn, thisArg, 1);
  }

  /**
   * The element minimizing `valFn`, with its value.
   *
   * @param valFn — `( ele, i, eles ) => number`
   * @param thisArg — optional receiver for the callback
   * @returns `{ value, ele }`, or `{ value: Infinity, ele: undefined }`
   *   when the collection is empty
   */
  min(
    valFn: (ele: Collection, i: number, eles: Collection) => number,
    thisArg?: unknown,
  ): { value: number; ele: Collection | undefined } {
    return this._extremum(valFn, thisArg, -1);
  }

  private _extremum(
    valFn: (ele: Collection, i: number, eles: Collection) => number,
    thisArg: unknown,
    sign: 1 | -1,
  ): { value: number; ele: Collection | undefined } {
    let best = sign * -Infinity;
    let bestEle: Collection | undefined;

    for (let i = 0; i < this.length; i++) {
      const val =
        thisArg == null
          ? valFn(this[i], i, this)
          : valFn.call(thisArg, this[i], i, this);

      if (sign * val > sign * best) {
        best = val;
        bestEle = this[i];
      }
    }

    return { value: best, ele: bestEle };
  }

  // -- position and dimensions --

  /**
   * Get or set the first element's model-space position (nodes only).
   *
   * Reading a **compound parent** settles pending auto-bounds first, so
   * the derived centre is current.  Reading a node whose position is
   * under a GPU-owned tween (an offloaded position animation or a live
   * force layout) reports the stale mirror until the tween settles — the
   * motion-staleness rule; geometry channels like `width()` do *not*
   * behave this way.
   *
   * @param dim — `'x'` or `'y'` to read/write one axis, or a
   *   `{ x, y }` object to write both; omit to read the pair
   * @param value — the new coordinate, with the `'x'`/`'y'` form
   * @returns the position or coordinate when reading (undefined for
   *   edges and removed elements), this collection when writing
   */
  position(
    dim?: string | Position,
    value?: number,
  ): Position | number | undefined | this {
    return this._positionImpl(dim, value, false);
  }

  /**
   * Like `position()`, but a write emits no `position` event.  For bulk
   * or intermediate moves — a layout's own iterations — where per-step
   * events would be noise.
   *
   * @param dim — `'x'`/`'y'`, or a `{ x, y }` object
   * @param value — the new coordinate, with the `'x'`/`'y'` form
   * @returns the position when reading, this collection when writing
   */
  silentPosition(
    dim?: string | Position,
    value?: number,
  ): Position | number | undefined | this {
    return this._positionImpl(dim, value, true);
  }

  declare modelPosition: this['position'];
  declare point: this['position'];

  private _positionImpl(
    dim: string | Position | undefined,
    value: number | undefined,
    silent: boolean,
  ): Position | number | undefined | this {
    // getter forms
    if (dim === undefined || (typeof dim === 'string' && value === undefined)) {
      const ref = this._refs[0];
      const store = this._store;

      if (ref == null || ref.group !== 'nodes' || !store.isCurrent(ref)) {
        return undefined;
      }

      // parent positions are derived: settle pending auto-bounds first
      if (store.hasCompounds()) {
        store.flushDerived();
      }

      // the hot cache (round 62.5): no Map hop at all on the array the
      // most-read accessor in the API reads
      const xy = store.nodePositions();
      const slot = ref.slot;
      const pos = { x: xy[slot * 2], y: xy[slot * 2 + 1] };

      return typeof dim === 'string' ? pos[dim as 'x' | 'y'] : pos;
    }

    // setter forms
    if (typeof dim === 'string') {
      return this._positions(dim === 'x' ? { x: value } : { y: value }, silent);
    }

    return this._positions(dim, silent);
  }

  /**
   * Set every node's position, from a constant or per-element function.
   *
   * @param pos — a `{ x, y }` for all of them, or
   *   `( ele, i ) => ( { x, y } )`
   * @returns this collection, for chaining
   */
  positions(pos: Position | ElePositionFn): this {
    return this._positions(pos, false);
  }

  /**
   * Like `positions()`, but emits no `position` events.
   *
   * @param pos — a `{ x, y }` for all of them, or `( ele, i ) => pos`
   * @returns this collection, for chaining
   */
  silentPositions(pos: Position | ElePositionFn): this {
    return this._positions(pos, true);
  }

  declare modelPositions: this['positions'];
  declare points: this['positions'];

  // -- animation --

  /**
   * Animate these elements' style and/or position to explicit targets
   * over `duration` ms, easing the normalized time.
   *
   * There is no queue (round 21): the animation starts immediately,
   * animations on disjoint channels run concurrently, and starting one
   * that overlaps a running animation's channels stops the older one in
   * place — its promise resolves, its values freeze, and the new
   * animation captures from there.  Sequence with `await
   * animation( … ).play()` rather than by queueing.
   *
   * Animatable: `position`; `opacity` (both groups); node
   * `background-color`/`border-color`/`border-width`, edge `line-color`;
   * and — since round 25 — the geometry numerics node `width`/`height`,
   * edge `width`, compound `padding` and `font-size`.  Colours
   * interpolate in **OKLab**, matching the colour mappers, which
   * deliberately differs from v3's per-channel sRGB tweening.
   *
   * Easings are names, not functions: v3's full enum plus
   * `cubic-bezier( … )`, CSS `linear( … )` and `spring( bounce )`.  A
   * custom easing *function* is rejected — a closure cannot cross to the
   * GPU, so accepting one would mean a curve that silently depended on
   * whether the animation got offloaded.
   *
   * @param opts — targets (`position`, `style`, plus the viewport forms
   *   on `cy.animate`), `duration`, `easing`, `delay`, `complete`
   * @returns this collection, for chaining; use `animation()` when you
   *   want the handle
   * @see Collection#animation for the handle form with
   *   `promise`/`pause`/`resume`/`reverse`
   */
  animate(opts: AnimateOptions): this {
    // start directly rather than through the handle: the chaining form
    // never exposes the promise, so play()'s per-call Promise + resolver
    // would be pure allocation here (round 62.4)
    const cy = this._cy;

    cy._animations.start(
      new Animation(
        cy._store,
        null,
        this._liveRefs(),
        false,
        opts,
        cy._styleEngine,
      ),
    );

    return this;
  }

  /**
   * Build an animation for these elements without starting it.
   *
   * @param opts — the tween targets (`position`, `style`) plus
   *   `duration`, `delay`, `easing` and `complete`
   * @returns the handle; nothing runs until `play()`
   */
  animation(opts: AnimateOptions): AnimationHandle {
    const cy = this._cy;

    return new AnimationHandleImpl(
      cy._animations,
      new Animation(
        cy._store,
        null,
        this._liveRefs(),
        false,
        opts,
        cy._styleEngine,
      ),
    );
  }

  /**
   * A no-op tween — a timed pause that touches no channels, so it
   * composes with any running animation (round 21: use
   * `delayAnimation().play()` + await to sequence).
   *
   * @param duration — the pause in ms
   * @param complete — called when it elapses
   * @returns this collection, for chaining
   */
  delay(duration: number, complete?: () => void): this {
    return this.animate({ duration, complete });
  }

  /**
   * Like {@link delay}, but returns the handle instead of chaining.
   *
   * @param duration — the pause in ms
   * @param complete — called when it elapses
   * @returns the handle; nothing runs until `play()`
   */
  delayAnimation(duration: number, complete?: () => void): AnimationHandle {
    return this.animation({ duration, complete });
  }

  /**
   * True when any of these elements has a running animation.
   *
   * @returns whether **any** element here is animating — not whether all
   *   are, and not whether the viewport is (that is `cy.animated()`)
   */
  animated(): boolean {
    const mgr = this._cy._animations;

    // nothing running anywhere answers without touching refs — the
    // common case for a UI polling animation state (round 62.4)
    if (!mgr.anyRunning()) {
      return false;
    }

    for (const ref of this._refs) {
      if (mgr.isAnimating(ref)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Stop every running animation on these elements (round 21: no queue —
   * the v3 clearQueue argument is gone).
   *
   * @param jumpToEnd — apply each animation's final values instead of
   *   freezing each channel where its tween reached
   * @returns this collection, for chaining
   */
  stop(jumpToEnd: boolean = false): this {
    this._cy._animations.stop(this._liveRefs(), jumpToEnd);

    return this;
  }

  private _positions(
    pos: Partial<Position> | ElePositionFn,
    silent: boolean,
  ): this {
    const store = this._store;
    const wantEmit = !silent && hasListeners(this._cy._emitter, 'position');

    // constant (possibly partial) object: direct columnar write — no
    // per-element handles, callbacks, or Position allocations
    if (typeof pos !== 'function') {
      const x = pos.x ?? null;
      const y = pos.y ?? null;

      if (x == null && y == null) {
        return this;
      }

      const slots: number[] = [];
      const emitIdx: number[] | null = wantEmit ? [] : null;

      for (let i = 0; i < this.length; i++) {
        const ref = this._refs[i];

        if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
          continue;
        }

        slots.push(ref.slot);

        if (emitIdx != null) {
          emitIdx.push(i);
        }
      }

      store.setPositionsConst(slots, x, y);

      if (emitIdx != null) {
        for (const i of emitIdx) {
          this._cy._emitOnEle('position', this[i]);
        }

        this._emitSubtreePositions(emitIdx);
      }

      return this;
    }

    const posCol = store.column('node.position') as Float32Array;
    const slots: number[] = [];
    const xy: number[] = [];
    const emitIdx: number[] | null = wantEmit ? [] : null;

    for (let i = 0; i < this.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      const p = pos(this[i], i);

      if (p == null || (p as unknown) === false) {
        continue;
      }

      // a partial object (e.g. { y: 3 }) leaves the omitted axis unchanged,
      // matching v3's position() merge semantics
      const pp = p as { x?: number; y?: number };
      const px = pp.x ?? posCol[ref.slot * 2];
      const py = pp.y ?? posCol[ref.slot * 2 + 1];

      slots.push(ref.slot);
      xy.push(px, py);

      if (emitIdx != null) {
        emitIdx.push(i);
      }
    }

    store.setPositions(slots, xy);

    if (emitIdx != null) {
      for (const i of emitIdx) {
        this._cy._emitOnEle('position', this[i]);
      }

      this._emitSubtreePositions(emitIdx);
    }

    return this;
  }

  /**
   * v3 parity: descendants moved along by a parent's position write emit
   * 'position' too — once each (members that already emitted are skipped).
   * Only called when position listeners exist.
   */
  private _emitSubtreePositions(emitIdx: number[]): void {
    const store = this._store;

    if (!store.hasCompounds()) {
      return;
    }

    const emitted = new Set<number>();

    for (const i of emitIdx) {
      const ref = this._refs[i];

      if (ref.group === 'nodes') {
        emitted.add(ref.slot);
      }
    }

    for (const i of emitIdx) {
      const ref = this._refs[i];

      if (
        ref.group !== 'nodes' ||
        !store.hasFlag('nodes', ref.slot, FLAG_PARENT)
      ) {
        continue;
      }

      const stack: number[] = [...store.childrenOf(ref.slot)];

      while (stack.length > 0) {
        const s = stack.pop() as number;

        for (const kid of store.childrenOf(s)) {
          stack.push(kid);
        }

        if (!emitted.has(s)) {
          emitted.add(s);
          this._cy._emitOnEle('position', this._cy._ele('nodes', s));
        }
      }
    }
  }

  /**
   * Offset positions by a vector or along one axis.
   *
   * @param dim — a `{ x, y }` delta, or 'x' / 'y' with `value`
   * @param value — the offset, when `dim` names an axis
   * @returns this collection, for chaining
   */
  shift(dim: string | Position, value?: number): this {
    return this._shift(dim, value, false);
  }

  /**
   * Like `shift()`, but emits no `position` events.
   *
   * @param dim — `'x'`/`'y'`, or a `{ x, y }` offset
   * @param value — the offset, with the `'x'`/`'y'` form
   * @returns this collection, for chaining
   */
  silentShift(dim: string | Position, value?: number): this {
    return this._shift(dim, value, true);
  }

  private _shift(
    dim: string | Position,
    value: number | undefined,
    silent: boolean,
  ): this {
    const dx =
      typeof dim === 'string'
        ? dim === 'x'
          ? (value as number)
          : 0
        : dim.x || 0;
    const dy =
      typeof dim === 'string'
        ? dim === 'y'
          ? (value as number)
          : 0
        : dim.y || 0;

    if (dx === 0 && dy === 0) {
      return this;
    }

    // direct columnar offset — no callbacks or per-element Position objects
    const store = this._store;
    const wantEmit = !silent && hasListeners(this._cy._emitter, 'position');
    const slots: number[] = [];
    const emitIdx: number[] | null = wantEmit ? [] : null;

    // v3's shift dedupe: an element whose ancestor is also shifted is
    // skipped — the ancestor's subtree shift moves it exactly once
    const inSet: Set<number> | null = store.hasCompounds() ? new Set() : null;

    if (inSet != null) {
      for (const ref of this._refs) {
        if (ref.group === 'nodes' && store.isCurrent(ref)) {
          inSet.add(ref.slot);
        }
      }
    }

    for (let i = 0; i < this.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      if (inSet != null) {
        let ancestorInSet = false;

        for (let p = store.parentOf(ref.slot); p >= 0; p = store.parentOf(p)) {
          if (inSet.has(p)) {
            ancestorInSet = true;
            break;
          }
        }

        if (ancestorInSet) {
          continue;
        }
      }

      slots.push(ref.slot);

      if (emitIdx != null) {
        emitIdx.push(i);
      }
    }

    store.shiftPositions(slots, dx, dy);

    if (emitIdx != null) {
      for (const i of emitIdx) {
        this._cy._emitOnEle('position', this[i]);
      }

      this._emitSubtreePositions(emitIdx);
    }

    return this;
  }

  /**
   * Compound-relative position: the model position minus the immediate
   * parent's (derived) position — the model position for orphans and
   * compound-free graphs (round 14.3, v3 semantics).
   *
   * @param dim — omit to read the pair, 'x' / 'y' to read one axis, or
   *   pass a `{ x, y }` (with no `value`) to write both
   * @param value — the relative coordinate to write, when `dim` names an axis
   * @returns the position or coordinate when reading, this when writing
   */
  relativePosition(
    dim?: string | Position,
    value?: number,
  ): Position | number | undefined | this {
    const store = this._store;

    if (!store.hasCompounds()) {
      return this._positionImpl(dim, value, false);
    }

    // getter forms
    if (dim === undefined || (typeof dim === 'string' && value === undefined)) {
      const pos = this._positionImpl(undefined, undefined, false) as
        | Position
        | undefined;

      if (pos == null) {
        return undefined;
      }

      const origin = this._relOrigin(this._refs[0]);
      const rel = { x: pos.x - origin.x, y: pos.y - origin.y };

      return typeof dim === 'string' ? rel[dim as 'x' | 'y'] : rel;
    }

    // setter forms: model = parent origin + rel, resolved per element
    if (typeof dim === 'string') {
      return this._positions((ele) => {
        const prev = ele.relativePosition() as Position;
        const origin = ele._relOrigin(ele._refs[0]);
        const rx = dim === 'x' ? (value as number) : prev.x;
        const ry = dim === 'y' ? (value as number) : prev.y;

        return { x: origin.x + rx, y: origin.y + ry };
      }, false);
    }

    return this._positions((ele) => {
      const origin = ele._relOrigin(ele._refs[0]);

      return {
        x: origin.x + (dim as Position).x,
        y: origin.y + (dim as Position).y,
      };
    }, false);
  }

  /** The immediate parent's position ({0, 0} for orphans); flushes first. */
  private _relOrigin(ref: Ref): Position {
    const store = this._store;

    store.flushDerived();

    const p = store.parentOf(ref.slot);

    if (p < 0) {
      return { x: 0, y: 0 };
    }

    const xy = store.column('node.position') as Float32Array;

    return { x: xy[p * 2], y: xy[p * 2 + 1] };
  }

  declare relativePoint: this['relativePosition'];

  /**
   * Get or set the first element's position in rendered (CSS px) space —
   * `position()` put through the current pan and zoom.  Writing
   * unprojects back to model space, so the element lands under the given
   * screen point at the current viewport.
   *
   * @param dim — `'x'`/`'y'`, or a `{ x, y }` object to write both;
   *   omit to read the pair
   * @param value — the new coordinate, with the `'x'`/`'y'` form
   * @returns the rendered position when reading, this collection when
   *   writing
   */
  renderedPosition(
    dim?: string | Position,
    value?: number,
  ): Position | number | undefined | this {
    const zoom = this._cy.zoom() as number;
    const pan = this._cy.pan() as Position;

    // getter forms
    if (dim === undefined || (typeof dim === 'string' && value === undefined)) {
      const pos = this.position() as Position | undefined;

      if (pos == null) {
        return undefined;
      }

      const rendered = { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };

      return typeof dim === 'string' ? rendered[dim as 'x' | 'y'] : rendered;
    }

    // setter forms: rendered → model
    const toModel = (rx: number, ry: number): Position => ({
      x: (rx - pan.x) / zoom,
      y: (ry - pan.y) / zoom,
    });

    if (typeof dim === 'string') {
      return this._positions((ele) => {
        const prev = ele.renderedPosition() as Position;
        const rx = dim === 'x' ? (value as number) : prev.x;
        const ry = dim === 'y' ? (value as number) : prev.y;

        return toModel(rx, ry);
      }, false);
    }

    return this._positions(toModel(dim.x, dim.y), false);
  }

  declare renderedPoint: this['renderedPosition'];

  /**
   * The first element's width — a node's model-space width, or an edge's
   * stroke width.
   *
   * For a compound parent this is the *content* width, with the padding
   * subtracted from the stored drawn box (v3's `autoWidth`).  Mid-tween
   * this reads the exact current value: geometry tweens are
   * CPU-canonical every tick and never leased to the GPU (round 25), so
   * unlike a position tween there is no staleness window.
   *
   * @returns the width, or undefined when empty or removed
   * @see Collection#outerWidth to include the border
   */
  width(): number | undefined {
    const ref = this._first();

    if (ref == null || !this._store.isCurrent(ref)) {
      return undefined;
    }

    return ref.group === 'nodes'
      ? this._nodeDim(ref, 0)
      : (this._store.column('edge.width') as Float32Array)[ref.slot * 2];
  }

  /**
   * The first element's height — a node's model-space height, or an
   * edge's stroke width (as in v3, where an edge's `height` is its
   * width).
   *
   * For a compound parent this is the *content* height: the column
   * stores the padded drawn box, so the padding is subtracted here
   * (v3's `autoHeight`).  Mid-tween this reads the exact current value:
   * geometry tweens are CPU-canonical every tick and never leased to the
   * GPU (round 25).
   *
   * @returns the height, or undefined when empty or removed
   */
  height(): number | undefined {
    const ref = this._first();

    if (ref == null || !this._store.isCurrent(ref)) {
      return undefined;
    }

    return ref.group === 'nodes'
      ? this._nodeDim(ref, 1)
      : (this._store.column('edge.width') as Float32Array)[ref.slot * 2];
  }

  /** A node's core width/height: for parents the column stores the
   * padded/drawn box (auto-bounds, round 14.3), so the readback
   * subtracts the padding — v3's autoWidth/autoHeight. */
  private _nodeDim(ref: Ref, axis: 0 | 1): number {
    const store = this._store;

    if (store.hasCompounds() && store.hasFlag('nodes', ref.slot, FLAG_PARENT)) {
      store.flushDerived();

      const size = store.column('node.size') as Float32Array;

      return size[ref.slot * 2 + axis] - 2 * store.paddingOf(ref.slot);
    }

    return (store.column('node.size') as Float32Array)[ref.slot * 2 + axis];
  }

  /**
   * data() over the sidecar columns.  `id` (and `source`/`target` on
   * edges) are first-class and immutable — reading them works, writing
   * them throws.  Setters apply to every element in the collection and
   * emit `data` per element; a write refreshes data-mapped labels.
   *
   * @param args — nothing (read the first element's whole object), a key
   *   (read it), a key and a value, or an object of keys to merge
   * @returns the read value, or this collection when writing
   */
  data(
    ...args: [] | [string] | [string, unknown] | [Record<string, unknown>]
  ): unknown {
    const [key, value] = args;

    // whole-object getter
    if (args.length === 0) {
      const ref = this._first();
      const store = this._store;

      if (ref == null || !store.isCurrent(ref)) {
        return undefined;
      }

      // Cached against the DataStore epoch plus the synthesized fields'
      // own inputs (round 62.4): rebuilding from the columns per call
      // read ~5× slower than v3's return-the-stored-object, and no
      // rebuild can beat a pointer.  Two data() calls with no write
      // between them therefore return the *same object* — logged as a
      // public-surface change beside the round-34.2 elements() memo it
      // mirrors; a caller mutating the snapshot sees its own mutation
      // until the next data write, where v3 hands out its live internal
      // object outright.
      const aux =
        ref.group === 'edges'
          ? (() => {
              const endpoints = store.edgeEndpoints();

              return (
                endpoints[ref.slot * 2] * 0x4000000 +
                endpoints[ref.slot * 2 + 1]
              );
            })()
          : store.parentOf(ref.slot);
      const cached = this._dataObj;

      if (
        cached != null &&
        cached.epoch === store.data.epoch &&
        cached.aux === aux &&
        cached.gen === ref.gen
      ) {
        return cached.obj;
      }

      const out: Record<string, unknown> = {
        id: store.idAt(ref.group, ref.slot),
      };

      if (ref.group === 'edges') {
        out.source = this.source().id();
        out.target = this.target().id();
      } else {
        // parent is first-class hierarchy state, synthesized on read
        // like edge source/target (round 14); absent for orphans
        if (aux >= 0) {
          out.parent = store.idAt('nodes', aux);
        }
      }

      Object.assign(out, store.data.object(ref.group, ref.slot));
      this._dataObj = { epoch: store.data.epoch, aux, gen: ref.gen, obj: out };

      return out;
    }

    // single-key getter
    if (typeof key === 'string' && args.length === 1) {
      const ref = this._first();

      if (ref == null || !this._store.isCurrent(ref)) {
        return undefined;
      }
      if (key === 'id') {
        return this._store.idAt(ref.group, ref.slot);
      }

      if (ref.group === 'edges' && (key === 'source' || key === 'target')) {
        return (key === 'source' ? this.source() : this.target()).id();
      }

      if (ref.group === 'nodes' && key === 'parent') {
        const parentSlot = this._store.parentOf(ref.slot);

        return parentSlot < 0
          ? undefined
          : this._store.idAt('nodes', parentSlot);
      }

      return this._store.data.get(ref.group, ref.slot, key);
    }

    // setter forms: one key (undefined clears it) or an object of keys
    const patch: Record<string, unknown> =
      typeof key === 'string'
        ? { [key]: value }
        : (key as Record<string, unknown>);

    return this._setData(patch);
  }

  private _setData(patch: Record<string, unknown>): this {
    const store = this._store;
    const cy = this._cy;
    const keys = Object.keys(patch);
    const wantEmit = hasListeners(cy._emitter, 'data');
    // a data write can only change computed style through a mapper (or a
    // mapped label) on one of the written keys — decided once per group,
    // not per element
    const touched: Record<'nodes' | 'edges', number[] | null> = {
      nodes: cy._stylesDependOnData('nodes', keys) ? [] : null,
      edges: cy._stylesDependOnData('edges', keys) ? [] : null,
    };

    for (const k of keys) {
      if (k === 'id') {
        throw new Error(`Can not change the immutable data field 'id'`);
      }
    }

    for (let i = 0; i < this.length; i++) {
      const ref = this._refs[i];

      if (!store.isCurrent(ref)) {
        continue;
      }

      for (const k of keys) {
        if (ref.group === 'edges' && (k === 'source' || k === 'target')) {
          throw new Error(
            `Can not change the immutable data field '${k}' of an edge`,
          );
        }

        if (ref.group === 'nodes' && k === 'parent') {
          throw new Error(
            `Can not change the immutable data field 'parent' of a node; reparent with move()`,
          );
        }

        store.setData(ref.group, ref.slot, k, patch[k]);
      }

      touched[ref.group]?.push(ref.slot);
    }

    // mapped style refreshes before emits so data listeners observe fresh state
    for (const group of ['nodes', 'edges'] as const) {
      const slots = touched[group];

      if (slots != null && slots.length > 0) {
        cy._refreshMappedStyles(group, slots, keys);
      }
    }

    if (wantEmit) {
      for (let i = 0; i < this.length; i++) {
        if (store.isCurrent(this._refs[i])) {
          cy._emitOnEle('data', this[i]);
        }
      }
    }

    return this;
  }

  /**
   * Remove sidecar data keys.
   *
   * @param names — space-separated key names; omit to clear every key
   * @returns this collection, for chaining
   */
  removeData(names?: string): this {
    const store = this._store;
    const requested =
      names == null ? null : names.split(/\s+/).filter((n) => n !== '');

    for (let i = 0; i < this.length; i++) {
      const ref = this._refs[i];

      if (!store.isCurrent(ref)) {
        continue;
      }

      const keys =
        requested ?? Object.keys(store.data.object(ref.group, ref.slot));
      const patch: Record<string, unknown> = {};

      for (const k of keys) {
        patch[k] = undefined;
      }

      if (Object.keys(patch).length > 0) {
        this[i]._setData(patch);
      }
    }

    return this;
  }

  declare attr: this['data'];
  declare removeAttr: this['removeData'];

  /**
   * Per-element scratchpad (plain JS, not a column): `scratch()` reads the
   * first element's whole object, `scratch(ns)` one namespace, `scratch(ns,
   * val)` / `scratch(obj)` write to every element.
   *
   * @param args — the form to take: nothing (read the whole object), a
   *   namespace (read it), a namespace and a value (write it to every
   *   element), or one object (merge its keys into every element)
   * @returns the reader forms answer the first element — the whole
   *   scratch object under no argument, one namespace's value under
   *   `scratch(ns)`, undefined when the collection is empty — while the
   *   writer forms return this collection for chaining
   */
  scratch(
    ...args: [] | [string] | [string, unknown] | [Record<string, unknown>]
  ): unknown {
    const [ns, value] = args;

    // whole-object getter
    if (args.length === 0) {
      return this[0]?._scratch ?? {};
    }

    // single-namespace getter
    if (typeof ns === 'string' && args.length === 1) {
      return this[0]?._scratch?.[ns];
    }

    const patch: Record<string, unknown> =
      typeof ns === 'string'
        ? { [ns]: value }
        : (ns as Record<string, unknown>);

    for (let i = 0; i < this.length; i++) {
      const ele = this[i];

      ele._scratch ??= {};
      Object.assign(ele._scratch, patch);
    }

    return this;
  }

  /**
   * Delete scratchpad keys from every element.
   *
   * @param namespace — the key to remove; omit to clear each element's
   *   whole scratchpad
   * @returns this collection, for chaining
   */
  removeScratch(namespace?: string): this {
    for (let i = 0; i < this.length; i++) {
      const ele = this[i];

      if (ele._scratch == null) {
        continue;
      }

      if (namespace == null) {
        ele._scratch = {};
      } else {
        delete ele._scratch[namespace];
      }
    }

    return this;
  }

  // -- style (read-only) --

  /**
   * Resolved style read off the stored channels: `style()` returns all of
   * the first element's group props, `style(name)` one value (numbers for
   * numeric props, `rgb()`/`rgba()` strings for colors, keywords
   * otherwise).
   *
   * Setter forms throw — v4 has no per-element bypass.  Per-element
   * styling is declarative instead: a `case` mapper for conditionals, a
   * `data(key)` scale for per-element values.  (Until round 31 both this
   * comment and the throw pointed at "the function form of the
   * stylesheet", which round 8 removed and 29.3 made throw — following
   * the advice hit a second error.)
   *
   * @param name — a property name to read one value; omit for the whole
   *   group.  An object or a second argument is a setter form
   * @param value — never valid; present so the setter form throws rather
   *   than silently ignoring it
   * @returns one resolved value, or the whole group's props
   * @throws if called in any setter form
   */
  style(name?: string | Record<string, unknown>, value?: unknown): unknown {
    if (value !== undefined || (name != null && typeof name !== 'string')) {
      throw new Error(
        'Per-element style bypass is not supported in v4; per-element styling ' +
          "is declarative: use a 'case' mapper for conditionals and 'data(key)' " +
          'scales for per-element values',
      );
    }

    const ref = this._first();

    if (ref == null || !this._store.isCurrent(ref)) {
      return undefined;
    }

    const engine = this._cy.style();

    return name == null ? engine.readProps(ref) : engine.readProp(ref, name);
  }

  declare css: this['style'];

  /**
   * Like `style()`, but with length props (width, height, border-width,
   * font-size) scaled into rendered (on-screen) px by the zoom.
   *
   * @param name — a property name; omit for the whole group
   * @returns the rendered-space value, or the whole group's props
   */
  renderedStyle(name?: string): unknown {
    const value = this.style(name);

    if (value === undefined) {
      return undefined;
    }

    const zoom = this._cy.zoom() as number;

    if (name != null) {
      return RENDERED_LENGTH_PROPS.has(normalizeCss(name))
        ? (value as number) * zoom
        : value;
    }

    const props = value as Record<string, string | number>;

    for (const prop of RENDERED_LENGTH_PROPS) {
      if (typeof props[prop] === 'number') {
        props[prop] = (props[prop] as number) * zoom;
      }
    }

    return props;
  }

  declare renderedCss: this['renderedStyle'];

  /**
   * The numeric value of a numeric style prop.
   *
   * @param name — a numeric style property
   * @returns the number, or undefined when the collection is empty or the
   *   prop belongs to the other group
   * @throws if the prop resolves to a colour or a keyword rather than a number
   */
  numericStyle(name: string): number | undefined {
    const value = this.style(name);

    if (value === undefined) {
      return undefined;
    }

    if (typeof value !== 'number') {
      throw new Error(`The style property '${name}' is not numeric`);
    }

    return value;
  }

  /** The rendered opacity: a node's own opacity times its ancestors'
   * (v3's product rule — the store keeps the folded value in the
   * column, round 14.4); an edge's own opacity (edges have no parent).
   *
   * @returns the opacity actually rendered, which is what `transparent()`
   *   tests against 0 — not the declared `opacity` style value, which
   *   `style('opacity')` reads; undefined when empty or removed
   */
  effectiveOpacity(): number | undefined {
    const ref = this._first();

    if (ref == null || !this._store.isCurrent(ref)) {
      return undefined;
    }

    if (ref.group === 'nodes' && this._store.hasCompounds()) {
      return (this._store.column('node.opacity') as Float32Array)[ref.slot];
    }

    return this.numericStyle('opacity');
  }

  /**
   * Whether the first element is fully transparent — its effective
   * opacity, with compound ancestors folded in, is exactly 0.
   *
   * @returns true when invisible through opacity
   */
  transparent(): boolean {
    return this.effectiveOpacity() === 0;
  }

  /** The space tier (round 22): shown elements occupy space — they join
   * bb/fit and size their compound parents — even when `visibility:
   * 'hidden'` keeps them from rendering.  display-tier hide() clears it.
   *
   * @returns whether the element occupies space — since round 22 this can
   *   differ from `visible()`, which is the paint tier
   */
  takesUpSpace(): boolean {
    return this._hasBit(FLAG_VISIBLE);
  }

  /** Whether the element can be interacted with: visible and not
   * pointer-transparent (`events: 'no'` — round 20.2).
   *
   * @returns whether any pointer path will resolve to this element; it
   *   rides `visible()`, so an element hidden either way is inert
   */
  interactive(): boolean {
    return this.visible() && !this._hasBit(FLAG_NO_EVENTS);
  }

  /**
   * The node's resolved label text ('' when none); read-only in the prototype.
   *
   * @returns the resolved text of the first element's label — `''` when it
   *   has none (a labelled-but-empty label reads the same), and undefined
   *   when the collection is empty or the element was removed
   */
  label(): string | undefined {
    const ref = this._first();

    if (ref == null || !this._store.isCurrent(ref)) {
      return undefined;
    }

    return this._store.labelAt(ref.slot, ref.group)?.text ?? '';
  }

  /**
   * v3-parity accessor: node padding.  Leaves have no padding in v4
   * (no compound-free `padding` prop); parents answer the resolved
   * auto-bounds padding (round 14.3).
   *
   * @returns the resolved padding in model px — 0 for leaves and for any
   *   graph with no compounds at all, the derived value for a parent;
   *   undefined when the collection is empty
   */
  padding(): number | undefined {
    const ref = this._first();

    if (ref == null) {
      return undefined;
    }

    if (
      ref.group !== 'nodes' ||
      !this._store.isCurrent(ref) ||
      !this._store.hasCompounds()
    ) {
      return 0;
    }

    return this._store.paddingOf(ref.slot);
  }

  /**
   * The drawn box: core dims + 2 x padding (v3's paddedWidth).
   *
   * @returns the padded width — identical to `width()` for leaves, which
   *   have no padding; undefined when empty or removed
   */
  paddedWidth(): number | undefined {
    return this._paddedDim(0);
  }

  /**
   * The drawn box height: content height plus twice the padding (v3's
   * `paddedHeight`).  Identical to `height()` for leaves, which have no
   * padding.
   *
   * @returns the padded height, or undefined when empty or removed
   */
  paddedHeight(): number | undefined {
    return this._paddedDim(1);
  }

  private _paddedDim(axis: 0 | 1): number | undefined {
    const ref = this._first();

    if (ref == null || !this._store.isCurrent(ref)) {
      return undefined;
    }

    if (
      ref.group === 'nodes' &&
      this._store.hasCompounds() &&
      this._store.hasFlag('nodes', ref.slot, FLAG_PARENT)
    ) {
      this._store.flushDerived();

      // the size column stores the padded/drawn box for parents
      return (this._store.column('node.size') as Float32Array)[
        ref.slot * 2 + axis
      ];
    }

    return axis === 0 ? this.width() : this.height();
  }

  /**
   * The full drawn width including the border — padded width plus the
   * border width.  This is the box bounds and endpoint clipping use.
   *
   * @returns the outer width, or undefined when empty or removed
   */
  outerWidth(): number | undefined {
    const w = this.paddedWidth();

    return w == null ? undefined : w + this._borderWidth();
  }

  /**
   * The full drawn height including the border.
   *
   * @returns the outer height, or undefined when empty or removed
   */
  outerHeight(): number | undefined {
    const h = this.paddedHeight();

    return h == null ? undefined : h + this._borderWidth();
  }

  private _borderWidth(): number {
    const ref = this._first();

    if (ref == null || ref.group !== 'nodes') {
      return 0;
    }

    return (this._store.column('node.borderWidth') as Float32Array)[ref.slot];
  }

  /**
   * The model-space box enclosing every element of the collection.
   *
   * **Labels are included by default** (round 16.4) — v3 excluded them
   * unless asked.  Node label terms are exact (the laid text block at its
   * anchor plus text-box padding); edge label terms are conservative (a
   * rotation-safe radius about both endpoints), so a box may be slightly
   * larger than the ink but never smaller.  The box also covers ghost
   * offsets, overlay/underlay padding and outlines.
   *
   * @param options — `{ includeLabels }` (default true)
   * @returns `{ x1, y1, x2, y2, w, h }` in model coordinates
   * @throws on an unknown option key — a typo must not silently change
   *   fit semantics
   * @see Collection#labelBoundingBox for the label box alone
   */
  boundingBox(options?: { includeLabels?: boolean }): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } {
    // labels join the box by default (round 16.4); unknown keys throw —
    // a typo must not silently change fit semantics
    if (options != null) {
      for (const key of Object.keys(options)) {
        if (key !== 'includeLabels') {
          throw new Error(
            `Unknown boundingBox() option '${key}'; supported: includeLabels`,
          );
        }
      }
    }

    const includeLabels = options?.includeLabels !== false;
    const store = this._store;
    let x1 = Infinity,
      y1 = Infinity,
      x2 = -Infinity,
      y2 = -Infinity;

    const expandPoint = (
      x: number,
      y: number,
      halfW: number = 0,
      halfH: number = 0,
    ): void => {
      x1 = Math.min(x1, x - halfW);
      y1 = Math.min(y1, y - halfH);
      x2 = Math.max(x2, x + halfW);
      y2 = Math.max(y2, y + halfH);
    };

    const size = store.column('node.size') as Float32Array;
    const border = store.column('node.borderWidth') as Float32Array;
    const ghost = store.column('node.ghost') as Float32Array;
    const bGeom = store.column('node.borderGeom') as Uint32Array;
    const endpoints = store.column('edge.endpoints') as Uint32Array;

    store.flushDerived(); // parent auto-bounds + curved-edge params derive below

    // the space tier (round 22): display-hidden elements take no space
    // (v3's rule; the whole-graph fit scan already excluded them), while
    // `visibility: 'hidden'` elements keep theirs — the mask is VISIBLE,
    // not DRAWN.  An edge needs both endpoints shown (the drawn-edge rule).
    const nodeFlags = store.column('node.flags') as Uint32Array;
    const edgeFlags = store.column('edge.flags') as Uint32Array;
    const shownMask = FLAG_ALIVE | FLAG_VISIBLE;
    const shown = (flags: Uint32Array, slot: number): boolean =>
      (flags[slot] & shownMask) === shownMask;

    for (const ref of this._liveRefs()) {
      if (ref.group === 'nodes' && !shown(nodeFlags, ref.slot)) {
        continue;
      }

      if (
        ref.group === 'edges' &&
        !(
          shown(edgeFlags, ref.slot) &&
          shown(nodeFlags, endpoints[ref.slot * 2]) &&
          shown(nodeFlags, endpoints[ref.slot * 2 + 1])
        )
      ) {
        continue;
      }

      if (ref.group === 'nodes') {
        const slot = ref.slot;
        let hw = size[slot * 2] / 2 + border[slot] / 2;
        let hh = size[slot * 2 + 1] / 2 + border[slot] / 2;

        // an outline ring grows the box (round 13 B5)
        if (bGeom[slot * 4 + 2] >>> 24 !== 0) {
          const wo = bGeom[slot * 4 + 3];
          const extra = (wo >>> 16) / 256 / 2 + (wo & 0xffff) / 256;

          hw += extra;
          hh += extra;
        }

        expandPoint(store.getX(slot), store.getY(slot), hw, hh);

        // a ghost duplicates the body at the offset (round 13 A1)
        if (ghost[slot * 4 + 3] !== 0) {
          expandPoint(
            store.getX(slot) + ghost[slot * 4],
            store.getY(slot) + ghost[slot * 4 + 1],
            hw,
            hh,
          );
        }

        // the node label's laid box at its anchor (round 16.4)
        if (includeLabels) {
          const lb = store.nodeLabelBox(slot);

          if (lb != null) {
            expandPoint(store.getX(slot) + lb.x1, store.getY(slot) + lb.y1);
            expandPoint(store.getX(slot) + lb.x2, store.getY(slot) + lb.y2);
          }
        }
      } else {
        // curved edges use the exact lazy bound (memoized flattened
        // polyline); straight edges span their endpoint centers
        const curveBB = store.curveBBAt(ref.slot);
        const hay = curveBB == null ? store.haystackPointsAt(ref.slot) : null;

        if (curveBB != null) {
          expandPoint(curveBB.x1, curveBB.y1);
          expandPoint(curveBB.x2, curveBB.y2);
        } else if (hay != null) {
          // haystack edges (12c) span their offset points (v3's allpts)
          expandPoint(hay.sx, hay.sy);
          expandPoint(hay.tx, hay.ty);
        } else {
          expandPoint(
            store.getX(endpoints[ref.slot * 2]),
            store.getY(endpoints[ref.slot * 2]),
          );
          expandPoint(
            store.getX(endpoints[ref.slot * 2 + 1]),
            store.getY(endpoints[ref.slot * 2 + 1]),
          );
        }

        // edge labels (16.4): the conservative block-covering radius
        // about both endpoints (the anchor lies on the drawn path) — a
        // recorded approximation; node labels are exact above
        if (includeLabels) {
          const r = store.edgeLabelSlack(ref.slot);

          if (r > 0) {
            expandPoint(
              store.getX(endpoints[ref.slot * 2]),
              store.getY(endpoints[ref.slot * 2]),
              r,
              r,
            );
            expandPoint(
              store.getX(endpoints[ref.slot * 2 + 1]),
              store.getY(endpoints[ref.slot * 2 + 1]),
              r,
              r,
            );
          }
        }
      }
    }

    if (x1 === Infinity) {
      return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
    }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  /**
   * The exact laid label boxes of this collection's elements, unioned
   * (round 16.4 — the v4 form of v3's text-metrics surface): node
   * labels at their anchors, edge mid-labels at the drawn midpoint,
   * end labels conservatively about their endpoint.  Empty (zero) when
   * nothing is labelled.  Headless dims are estimates (recorded).
   */
  labelBoundingBox(): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } {
    const store = this._store;
    let x1 = Infinity,
      y1 = Infinity,
      x2 = -Infinity,
      y2 = -Infinity;

    const expand = (
      bx1: number,
      by1: number,
      bx2: number,
      by2: number,
    ): void => {
      x1 = Math.min(x1, bx1);
      y1 = Math.min(y1, by1);
      x2 = Math.max(x2, bx2);
      y2 = Math.max(y2, by2);
    };

    for (const ref of this._liveRefs()) {
      if (ref.group === 'nodes') {
        const lb = store.nodeLabelBox(ref.slot);

        if (lb != null) {
          const x = store.getX(ref.slot);
          const y = store.getY(ref.slot);

          expand(x + lb.x1, y + lb.y1, x + lb.x2, y + lb.y2);
        }

        continue;
      }

      // edge mid-labels: the block about the drawn midpoint; end labels
      // ride the conservative endpoint radius
      const entry = store.labelAt(ref.slot, 'edges');
      const dims = store.labelDimsAt(ref.slot, 'edges');

      if (entry != null && dims != null) {
        const m = this._cy._ele(ref.group, ref.slot).midpoint() ?? {
          x: 0,
          y: 0,
        };
        const dx = entry.marginX;
        const pad = entry.bgColor >>> 24 > 0 ? entry.bgPadding : 0;

        expand(
          m.x + dx - dims.w / 2 - pad,
          m.y + entry.anchorY - pad,
          m.x + dx + dims.w / 2 + pad,
          m.y + entry.anchorY + dims.h + pad,
        );
      }

      const r = Math.max(
        store.labelDimsAt(ref.slot, 'edgeSource') != null
          ? store.edgeLabelSlack(ref.slot)
          : 0,
        store.labelDimsAt(ref.slot, 'edgeTarget') != null
          ? store.edgeLabelSlack(ref.slot)
          : 0,
      );

      if (r > 0) {
        const endpoints = store.column('edge.endpoints') as Uint32Array;

        for (let end = 0; end < 2; end++) {
          const node = endpoints[ref.slot * 2 + end];

          expand(
            store.getX(node) - r,
            store.getY(node) - r,
            store.getX(node) + r,
            store.getY(node) + r,
          );
        }
      }
    }

    if (x1 === Infinity) {
      return { x1: 0, y1: 0, x2: 0, y2: 0, w: 0, h: 0 };
    }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  /**
   * `boundingBox()` transformed into rendered (on-screen) coordinates.
   *
   * @param options — as `boundingBox()`: `{ includeLabels }`, default
   *   true; an unknown key throws
   * @returns the rendered-space box
   */
  renderedBoundingBox(options?: { includeLabels?: boolean }): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } {
    const bb = this.boundingBox(options);
    const zoom = this._cy.zoom() as number;
    const pan = this._cy.pan() as Position;
    const x1 = bb.x1 * zoom + pan.x;
    const y1 = bb.y1 * zoom + pan.y;
    const x2 = bb.x2 * zoom + pan.x;
    const y2 = bb.y2 * zoom + pan.y;

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  declare renderedBoundingbox: this['renderedBoundingBox'];

  /**
   * `width()` scaled by the current zoom — the on-screen width in CSS px.
   *
   * @returns the rendered width, or undefined when empty or removed
   */
  renderedWidth(): number | undefined {
    return this._rendered(this.width());
  }

  /**
   * `height()` scaled by the current zoom.
   *
   * @returns the rendered height, or undefined when empty or removed
   */
  renderedHeight(): number | undefined {
    return this._rendered(this.height());
  }

  /**
   * `outerWidth()` scaled by the current zoom.
   *
   * @returns the rendered outer width, or undefined when empty or
   *   removed
   */
  renderedOuterWidth(): number | undefined {
    return this._rendered(this.outerWidth());
  }

  /**
   * `outerHeight()` scaled by the current zoom.
   *
   * @returns the rendered outer height, or undefined when empty or
   *   removed
   */
  renderedOuterHeight(): number | undefined {
    return this._rendered(this.outerHeight());
  }

  private _rendered(modelLength: number | undefined): number | undefined {
    return modelLength == null
      ? undefined
      : modelLength * (this._cy.zoom() as number);
  }

  /** Midpoint of the edge: the curve/route midpoint for curved edges
   * (v3's rs.mid rules per family), the endpoint-center average for
   * straight ones.
   *
   * @returns the point a mid-label and a mid-arrow anchor at, in model
   *   space; undefined for non-edges.  Mid-tween it inherits the position
   *   lease's staleness, like the endpoints it derives from
   */
  midpoint(): Position | undefined {
    const ref = this._first();

    if (ref == null || ref.group !== 'edges' || !this._store.isCurrent(ref)) {
      return undefined;
    }

    const ev = this._store.curveEvalAt(ref.slot);

    if (ev != null) {
      return { x: ev.mx, y: ev.my };
    }

    const route = this._store.curveRouteAt(ref.slot);

    if (route != null) {
      const m = { x: 0, y: 0, tx: 0, ty: 0 };

      routeMidpoint(route, m);

      return { x: m.x, y: m.y };
    }

    // haystack edges (12c): the offset-point average, v3's rs.mid
    const hay = this._store.haystackPointsAt(ref.slot);

    if (hay != null) {
      return { x: (hay.sx + hay.tx) / 2, y: (hay.sy + hay.ty) / 2 };
    }

    // Straight edges: v3's `storeAllpts` does *not* answer the chord
    // midpoint here, it answers
    //
    //     ( startX + endX + arrowStartX + arrowEndX ) / 4
    //
    // — the mean of the two gap-shortened line ends and the two
    // spacing-shortened arrow points.  With the same head at both ends
    // the shortenings cancel and it lands back on the chord midpoint,
    // which is why this read as correct for four rounds; give the ends
    // different heads and it stops cancelling.  It matters beyond the
    // accessor: this is where a mid-arrow sits and an edge label
    // anchors.
    const line = this._store.straightLineEndAt(ref.slot, 0);
    const lineEnd = this._store.straightLineEndAt(ref.slot, 1);
    const arrow = this._store.straightEndpointAt(ref.slot, 0);
    const arrowEnd = this._store.straightEndpointAt(ref.slot, 1);

    return {
      x: (line.x + lineEnd.x + arrow.x + arrowEnd.x) / 4,
      y: (line.y + lineEnd.y + arrow.y + arrowEnd.y) / 4,
    };
  }

  /**
   * `midpoint()` in rendered (CSS px) space.
   *
   * @returns the rendered midpoint, or undefined for non-edges
   */
  renderedMidpoint(): Position | undefined {
    return this._toRenderedPoint(this.midpoint());
  }

  /**
   * The edge's source-side endpoint in model space, resolved through the
   * route evaluator — so it accounts for curve family, node boundary
   * clipping, haystack offsets and any manual `source-endpoint`.
   *
   * A **straight** edge answers the node boundary along the chord
   * between the node centres, pulled back by the arrow shape's
   * `spacing` (round 55 landed the boundary, round 56 the spacing) —
   * v3's `rs.arrowStartX/Y`.  That is the *arrow* point, not the drawn
   * line's end: the line stops `gap` behind the boundary, further back
   * again, which is what makes a hollow head read as one shape.
   *
   * @returns the endpoint, or undefined for non-edges
   */
  sourceEndpoint(): Position | undefined {
    return this._endpointPoint(0);
  }

  /**
   * The edge's target-side endpoint in model space, resolved through the
   * route evaluator — so it accounts for curve family, node boundary
   * clipping, haystack offsets and any manual `target-endpoint`.
   *
   * A **straight** edge answers the node boundary along the chord
   * between the node centres, pulled back by the arrow shape's
   * `spacing` (round 55 landed the boundary, round 56 the spacing) —
   * v3's `rs.arrowStartX/Y`.  That is the *arrow* point, not the drawn
   * line's end: the line stops `gap` behind the boundary, further back
   * again, which is what makes a hollow head read as one shape.
   *
   * @returns the endpoint, or undefined for non-edges
   */
  targetEndpoint(): Position | undefined {
    return this._endpointPoint(1);
  }

  /**
   * `sourceEndpoint()` in rendered (CSS px) space.
   *
   * @returns the rendered endpoint, or undefined for non-edges
   */
  renderedSourceEndpoint(): Position | undefined {
    return this._toRenderedPoint(this.sourceEndpoint());
  }

  /**
   * `targetEndpoint()` in rendered (CSS px) space.
   *
   * @returns the rendered endpoint, or undefined for non-edges
   */
  renderedTargetEndpoint(): Position | undefined {
    return this._toRenderedPoint(this.targetEndpoint());
  }

  /** Whether the edge participates in bezier bundling — v3 semantics:
   * a style check (`curve-style: bezier`), true even for the lone or
   * odd-middle member that renders straight.
   *
   * @returns whether the *styled record* says bezier — a question about
   *   style, not about the rendered shape, which is why a lone edge under
   *   `curve-style: bezier` answers true while drawing as a line.  False
   *   for nodes and for removed elements
   */
  isBundledBezier(): boolean {
    const ref = this._first();

    if (ref == null || ref.group !== 'edges' || !this._store.isCurrent(ref)) {
      return false;
    }

    return this._store.curveStyleAt(ref.slot).style === CURVE_STYLE_BEZIER;
  }

  /** The edge's curve control points (model coords): one for a bundled
   * bezier, two for a self-loop, the control list for an unbundled
   * bezier, undefined otherwise — v3's getControlPoints surface
   * (segments/taxi answer segmentPoints() instead).
   *
   * @returns the control points in model space, or undefined when the
   *   edge has none — which covers straight edges, segments/taxi routes,
   *   and a straight edge carrying manual endpoints (the 12c `n = 0`
   *   chord)
   */
  controlPoints(): Position[] | undefined {
    const ref = this._first();

    if (ref == null || ref.group !== 'edges' || !this._store.isCurrent(ref)) {
      return undefined;
    }

    const ev = this._store.curveEvalAt(ref.slot);

    if (ev != null) {
      return ev.c1x === ev.c2x && ev.c1y === ev.c2y
        ? [{ x: ev.c1x, y: ev.c1y }]
        : [
            { x: ev.c1x, y: ev.c1y },
            { x: ev.c2x, y: ev.c2y },
          ];
    }

    const route = this._store.curveRouteAt(ref.slot);

    // a straight-styled edge with manual endpoints derives as the
    // MULTI n = 0 chord (12c) — it has no control points
    if (route == null || route.kind !== CURVE_MULTI || route.n === 0) {
      return undefined;
    }

    return this._routeInteriorPoints(route);
  }

  /**
   * `controlPoints()` in rendered (CSS px) space.
   *
   * @returns the rendered control points, or undefined when the edge has
   *   none
   */
  renderedControlPoints(): Position[] | undefined {
    const pts = this.controlPoints();

    if (pts == null) {
      return undefined;
    }

    return pts.map((p) => this._toRenderedPoint(p) as Position);
  }

  /** The edge's segment points (model coords) — v3's getSegmentPoints:
   * defined for segments *and* taxi edges (taxi derives its points),
   * undefined otherwise.
   *
   * @returns the interior route points in model space — *derived* ones
   *   for taxi, which computes rather than declares them — or undefined
   *   for every other family
   */
  segmentPoints(): Position[] | undefined {
    const ref = this._first();

    if (ref == null || ref.group !== 'edges' || !this._store.isCurrent(ref)) {
      return undefined;
    }

    const route = this._store.curveRouteAt(ref.slot);

    if (route == null || route.kind === CURVE_MULTI) {
      return undefined;
    }

    return this._routeInteriorPoints(route);
  }

  /**
   * `segmentPoints()` in rendered (CSS px) space.
   *
   * @returns the rendered segment points, or undefined when the edge has
   *   none
   */
  renderedSegmentPoints(): Position[] | undefined {
    const pts = this.segmentPoints();

    if (pts == null) {
      return undefined;
    }

    return pts.map((p) => this._toRenderedPoint(p) as Position);
  }

  private _routeInteriorPoints(route: CurveRoute): Position[] {
    const pts: Position[] = [];

    for (let i = 0; i < route.n; i++) {
      pts.push({ x: route.qx[i + 1], y: route.qy[i + 1] });
    }

    return pts;
  }

  private _endpointPoint(which: 0 | 1): Position | undefined {
    const ref = this._first();

    if (ref == null || ref.group !== 'edges' || !this._store.isCurrent(ref)) {
      return undefined;
    }

    // v3 answers its *arrow* points here (`rs.arrowStartX/Y`), which sit
    // `spacing` behind the boundary — not the drawn line's ends, which
    // sit `gap` behind it.  The evaluators carry both since round 56.
    const ev = this._store.curveEvalAt(ref.slot);

    if (ev != null) {
      return which === 0 ? { x: ev.asx, y: ev.asy } : { x: ev.aex, y: ev.aey };
    }

    const route = this._store.curveRouteAt(ref.slot);

    if (route != null) {
      return which === 0
        ? { x: route.asx, y: route.asy }
        : { x: route.aex, y: route.aey };
    }

    // haystack edges (12c): the offset points — v3's haystackPts
    const hay = this._store.haystackPointsAt(ref.slot);

    if (hay != null) {
      return which === 0 ? { x: hay.sx, y: hay.sy } : { x: hay.tx, y: hay.ty };
    }

    // straight edges (round 55): the node boundary along the chord, which
    // is both what v3 answers and what v4's arrow shader draws to.  This
    // used to return the node *centre* — off by a whole node radius, and
    // visible to anyone using renderedTargetEndpoint() to place an
    // overlay.  v3 additionally pulls the point back by the arrow shape's
    // `spacing`, which is zero for every head except `tee`; that term
    // lands with the gap/trim port, so that the accessor never describes
    // a point the renderer does not draw.
    return this._store.straightEndpointAt(ref.slot, which);
  }

  private _toRenderedPoint(pos: Position | undefined): Position | undefined {
    if (pos == null) {
      return undefined;
    }

    const zoom = this._cy.zoom() as number;
    const pan = this._cy.pan() as Position;

    return { x: pos.x * zoom + pan.x, y: pos.y * zoom + pan.y };
  }

  // -- selection --

  /**
   * Whether the first element is selected.
   *
   * @returns true when selected
   */
  selected(): boolean {
    const ref = this._first();

    return (
      ref != null &&
      this._store.isCurrent(ref) &&
      this._store.hasFlag(ref.group, ref.slot, FLAG_SELECTED)
    );
  }

  /**
   * Whether the first element may be selected by the user.  The
   * graph-wide `cy.autounselectify()` overrides this for user gestures.
   *
   * @returns true when selectable
   */
  selectable(): boolean {
    const ref = this._first();

    return (
      ref != null &&
      this._store.isCurrent(ref) &&
      this._store.hasFlag(ref.group, ref.slot, FLAG_SELECTABLE)
    );
  }

  /**
   * Select every selectable element, emitting `select` for each one that
   * changed.  Unselectable elements are skipped.
   *
   * @returns this collection, for chaining
   */
  select(): this {
    return this._setSelected(true);
  }

  /**
   * Deselect every element, emitting `unselect` for each one that
   * changed.
   *
   * @returns this collection, for chaining
   */
  unselect(): this {
    return this._setSelected(false);
  }

  declare deselect: this['unselect'];

  /**
   * Make these elements selectable.
   *
   * @returns this collection, for chaining
   */
  selectify(): this {
    return this._setBit(FLAG_SELECTABLE, true);
  }

  /**
   * Make these elements unselectable.  Does not deselect them; call
   * `unselect()` for that.
   *
   * @returns this collection, for chaining
   */
  unselectify(): this {
    return this._setBit(FLAG_SELECTABLE, false);
  }

  // -- grab / lock --

  /**
   * Pannable elements are not draggable, so pannable overrides grabbable
   * (as in v3).
   *
   * @returns whether a drag gesture would move this element — the
   *   *effective* answer, so a grabbable-but-pannable element reads false
   *   here while `json()` reports the raw field
   */
  grabbable(): boolean {
    return this._hasBit(FLAG_GRABBABLE) && !this._hasBit(FLAG_PANNABLE);
  }

  /**
   * Whether the first element is currently held by a drag gesture.
   *
   * @returns true while grabbed
   */
  grabbed(): boolean {
    return this._hasBit(FLAG_GRABBED);
  }

  /**
   * Make these elements grabbable.
   *
   * @returns this collection, for chaining
   */
  grabify(): this {
    return this._setBit(FLAG_GRABBABLE, true);
  }

  /**
   * Make these elements ungrabbable — the user can no longer drag them,
   * while programmatic position writes still apply.
   *
   * @returns this collection, for chaining
   */
  ungrabify(): this {
    return this._setBit(FLAG_GRABBABLE, false);
  }

  // -- visibility --

  /**
   * Whether the first element renders (round 22: the derived FLAG_DRAWN
   * — shown AND not `visibility: 'hidden'` on self or, for nodes, any
   * ancestor; edges additionally fold their endpoints, v3's rule).  The
   * renderer's cull pass and CPU picking mask on the same bit, so an
   * element that is not visible() neither draws nor picks.  For
   * space-tier state (in the bb, sizing its compound parent) see
   * `takesUpSpace()` — an invisible element keeps its space.
   *
   * @returns whether the element draws and picks; false for a removed
   *   element, for an edge either of whose endpoints is hidden, and for a
   *   node under a hidden or invisible ancestor
   */
  visible(): boolean {
    const ref = this._first();

    return (
      ref != null && this._store.isCurrent(ref) && this._store.isDrawn(ref)
    );
  }

  /**
   * The complement of `visible()`.
   *
   * @returns true when the first element does not draw
   */
  hidden(): boolean {
    return !this.visible();
  }

  /**
   * Show these elements — the **display tier**, v3's structural
   * `display: element`.  Shown elements take up space again, rejoin
   * bounds and fit, and re-fan their bezier bundles.
   *
   * For paint-only invisibility that keeps space and bundle ranks, use
   * the `visibility` style property instead (round 22), and for a fade
   * use an `opacity` transition.
   *
   * @returns this collection, for chaining
   */
  show(): this {
    return this._setVisibility(true);
  }

  /**
   * Hide these elements structurally — v3's `display: none`.  They stop
   * drawing and picking, leave the bounding box and their ancestors'
   * auto-bounds, and their bezier bundles re-fan without them.
   * Descendants of a hidden node are gated too.
   *
   * @returns this collection, for chaining
   */
  hide(): this {
    return this._setVisibility(false);
  }

  /** show/hide (round 14.4): the store records the own state in
   * FLAG_SELF_HIDDEN and recomputes the effective FLAG_VISIBLE over
   * affected subtrees — descendants gate on hidden ancestors, and
   * hidden children leave their ancestors' auto-bounds. */
  private _setVisibility(on: boolean): this {
    this._store.setVisibility(this._refs, on);

    return this;
  }

  /**
   * Whether the first element is locked — immovable, by layouts and
   * position writes alike.  The force layout treats locked nodes as
   * fixed obstacles.
   *
   * @returns true when locked
   */
  locked(): boolean {
    return this._hasBit(FLAG_LOCKED);
  }

  /**
   * Lock these elements against movement.
   *
   * @returns this collection, for chaining
   */
  lock(): this {
    return this._setBit(FLAG_LOCKED, true);
  }

  /**
   * Unlock these elements.
   *
   * @returns this collection, for chaining
   */
  unlock(): this {
    return this._setBit(FLAG_LOCKED, false);
  }

  // -- active / pannable --

  /**
   * Whether the first element is in the transient pressed ("active") state.
   *
   * @returns the pressed flag the pointer layer sets while a press is
   *   held — transient interaction state, not a persisted property
   */
  active(): boolean {
    return this._hasBit(FLAG_ACTIVE);
  }

  /**
   * True when the first element is live and not active (v3 `inactive()`).
   *
   * @returns not simply the negation of `active()`: a removed element is
   *   neither active nor inactive, so both read false for it
   */
  inactive(): boolean {
    const ref = this._first();

    return (
      ref != null &&
      this._store.isCurrent(ref) &&
      !this._store.hasFlag(ref.group, ref.slot, FLAG_ACTIVE)
    );
  }

  /**
   * Put these elements into the transient pressed ("active") state, the
   * one the pointer layer sets while a press is held.
   *
   * @returns this collection, for chaining
   */
  activate(): this {
    return this._setBit(FLAG_ACTIVE, true);
  }

  /**
   * Clear the pressed ("active") state.
   *
   * @returns this collection, for chaining
   */
  unactivate(): this {
    return this._setBit(FLAG_ACTIVE, false);
  }

  /**
   * Whether dragging the first element pans the graph instead of grabbing it.
   *
   * @returns the raw pannable flag; because pannable overrides grabbable,
   *   a true here forces `grabbable()` false
   */
  pannable(): boolean {
    return this._hasBit(FLAG_PANNABLE);
  }

  /**
   * Make dragging these elements pan the viewport instead of moving
   * them.  Pannable overrides grabbable, as in v3.
   *
   * @returns this collection, for chaining
   */
  panify(): this {
    return this._setBit(FLAG_PANNABLE, true);
  }

  /**
   * Stop these elements from panning the viewport when dragged, so a
   * grabbable one becomes draggable again.
   *
   * @returns this collection, for chaining
   */
  unpanify(): this {
    return this._setBit(FLAG_PANNABLE, false);
  }

  private _hasBit(bit: number): boolean {
    const ref = this._first();

    return (
      ref != null &&
      this._store.isCurrent(ref) &&
      this._store.hasFlag(ref.group, ref.slot, bit)
    );
  }

  private _setBit(bit: number, on: boolean): this {
    this._store.flagRefs(this._refs, bit, on);

    return this;
  }

  private _setSelected(selected: boolean): this {
    const cy = this._cy;
    const changedIdx: number[] = [];

    this._store.flagRefs(
      this._refs,
      FLAG_SELECTED,
      selected,
      FLAG_SELECTABLE,
      changedIdx,
    );

    if (changedIdx.length === 0) {
      return this;
    }

    // The restyle a selection change may need is not here: `flagRefs`
    // notifies the store's `onStateChange`, which the core wires to the
    // round-61 state refresh (the partition-record diff; refreshMapped
    // before that).  Round 57.1 wrote that hook by hand at this one
    // site and then wanted it at six more (lock, grab, activate,
    // selectify, grabify, hover), which is the argument for it living at
    // the flag choke point instead.
    const type = selected ? 'select' : 'unselect';

    if (cy._hasListeners(type)) {
      for (const i of changedIdx) {
        cy._emitOnEle(type, this[i]);
      }
    }

    return this;
  }

  // -- graph manipulation --

  /**
   * Remove these elements from the graph; incident edges of removed nodes
   * cascade.  Already-removed elements are skipped (no second `remove`
   * event).
   *
   * @returns the elements actually removed — the closure, so it can be
   *   *larger* than the receiver: removing a parent brings its
   *   descendants, and removing a node brings its incident edges.  The
   *   returned refs are dead by construction (v4 removals are terminal),
   *   so only their cached `id()`/`group()` still read
   */
  remove(): Collection {
    const cy = this._cy;
    const store = this._store;

    // build the closure: requested live elements + their descendants
    // (compound removal cascades, v3) + incident edges of removed nodes
    const edgeHandles: Collection[] = [];
    const nodeHandles: Collection[] = [];
    const seen = new Set<number>();

    const addEdge = (ele: Collection): void => {
      const key = packRef(ele._refs[0]);

      if (!seen.has(key)) {
        seen.add(key);
        edgeHandles.push(ele);
      }
    };

    const addNode = (ele: Collection): void => {
      const key = packRef(ele._refs[0]);

      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      nodeHandles.push(ele);

      const slot = ele._refs[0].slot;

      for (const edgeSlot of store.adj.connectedEdges(slot)) {
        addEdge(cy._ele('edges', edgeSlot));
      }

      for (const childSlot of store.childrenOf(slot)) {
        addNode(cy._ele('nodes', childSlot));
      }
    };

    for (let i = 0; i < this.length; i++) {
      const ref = this._refs[i];

      if (!store.isCurrent(ref)) {
        continue;
      }

      if (ref.group === 'edges') {
        addEdge(this[i]);
      } else {
        addNode(this[i]);
      }
    }

    // children before parents: the store refuses to remove a node whose
    // children are still alive (depths are strictly increasing down a chain)
    nodeHandles.sort(
      (a, b) => store.depthOf(b._refs[0].slot) - store.depthOf(a._refs[0].slot),
    );

    // edges first, then nodes; emit remove per element after the store mutation
    for (const edge of edgeHandles) {
      store.removeEdge(edge._refs[0].slot);
    }

    for (const node of nodeHandles) {
      store.removeNode(node._refs[0].slot);
    }

    for (const ele of [...edgeHandles, ...nodeHandles]) {
      cy._emitOnEle('remove', ele);
    }

    const removed = this._spawn(
      [...edgeHandles, ...nodeHandles].map((ele) => ele._refs[0]),
    );

    cy._maybeCompact(); // the auto dead-slot trigger's safe boundary (19.5)

    return removed;
  }

  /**
   * Move elements in place, keeping slot, id and data: `{ parent }`
   * re-parents nodes (null orphans them; the compound move, round 14.2 —
   * emits `moveout` before and `move` after per changed node), while
   * `{ source, target }` re-points edges.  As in v3 the modes are
   * exclusive — a `parent` key takes precedence.  An unknown parent id is
   * a silent no-op (v3); a cyclic assignment warns and drops (the
   * hierarchy rule).
   *
   * @param opts — `{ parent }` to re-parent nodes (null orphans them), or
   *   `{ source, target }` to re-point edges; `parent` wins if both are
   *   given
   * @returns this collection, for chaining
   */
  move(opts: {
    source?: string;
    target?: string;
    parent?: string | null;
  }): this {
    const store = this._store;

    if (opts.parent !== undefined) {
      let parentSlot = -1;

      if (opts.parent != null) {
        const parentRef = store.lookup(String(opts.parent));

        if (parentRef == null || parentRef.group !== 'nodes') {
          return this;
        } // v3: silent no-op

        parentSlot = parentRef.slot;
      }

      const wantEmit =
        hasListeners(this._cy._emitter, 'moveout') ||
        hasListeners(this._cy._emitter, 'move');

      for (let i = 0; i < this.length; i++) {
        const ref = this._refs[i];

        if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
          continue;
        }
        if (store.parentOf(ref.slot) === parentSlot) {
          continue;
        }

        // a cyclic assignment is dropped by setParent (with its warning);
        // it gets no events since nothing changes
        const cyclic =
          parentSlot >= 0 &&
          (parentSlot === ref.slot || store.isAncestorOf(ref.slot, parentSlot));

        if (!cyclic && wantEmit) {
          this._cy._emitOnEle('moveout', this[i]);
        }

        store.setParent(ref.slot, parentSlot);

        if (!cyclic && wantEmit) {
          this._cy._emitOnEle('move', this[i]);
        }
      }

      return this;
    }

    if (opts.source == null && opts.target == null) {
      return this;
    }

    const newSource =
      opts.source != null ? this._resolveNode(opts.source, 'source') : null;
    const newTarget =
      opts.target != null ? this._resolveNode(opts.target, 'target') : null;

    for (let i = 0; i < this.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'edges' || !store.isCurrent(ref)) {
        continue;
      }

      const endpoints = store.column('edge.endpoints') as Uint32Array;

      store.moveEdge(
        ref.slot,
        newSource ?? endpoints[ref.slot * 2],
        newTarget ?? endpoints[ref.slot * 2 + 1],
      );

      if (hasListeners(this._cy._emitter, 'move')) {
        this._cy._emitOnEle('move', this[i]);
      }
    }

    return this;
  }

  private _resolveNode(id: string, role: string): number {
    const ref = this._store.lookup(id);

    if (ref == null || ref.group !== 'nodes') {
      throw new Error(`Can not move edge to nonexistant ${role} node '${id}'`);
    }

    return ref.slot;
  }

  // -- traversal --

  /**
   * The source node of the first edge.
   *
   * @returns the source node, or an empty collection for a non-edge
   */
  source(): Collection {
    return this._endpoint(0);
  }

  /**
   * The target node of the first edge.
   *
   * @returns the target node, or an empty collection for a non-edge
   */
  target(): Collection {
    return this._endpoint(1);
  }

  /**
   * The source nodes of every edge in the collection, deduped.
   *
   * @returns the source nodes
   */
  sources(): Collection {
    return this._endpoints(0);
  }

  /**
   * The target nodes of every edge in the collection, deduped.
   *
   * @returns the target nodes
   */
  targets(): Collection {
    return this._endpoints(1);
  }

  private _endpoint(which: 0 | 1): Collection {
    const ref = this._first();

    if (ref == null || ref.group !== 'edges') {
      return this._spawn([]);
    }

    // the lean accessor: source()/target() lost to v3 on the per-call
    // column spec walk alone (round 62.4)
    const endpoints = this._store.edgeEndpoints();

    return this._cy._ele('nodes', endpoints[ref.slot * 2 + which]);
  }

  private _endpoints(which: 0 | 1): Collection {
    const store = this._store;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'edges' || !store.isCurrent(ref)) {
        continue;
      }

      const nodeSlot = endpoints[ref.slot * 2 + which];

      if (!seen.has(nodeSlot)) {
        seen.add(nodeSlot);
        refs.push(store.ref('nodes', nodeSlot));
      }
    }

    return this._spawnLive(refs);
  }

  /**
   * Every edge incident on the nodes in this collection, deduped —
   * answered off the CSR adjacency index, so it is O(incident edges)
   * rather than a scan.  Loops appear once.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the incident edges
   */
  connectedEdges(criterion?: FilterLike): Collection {
    const store = this._store;
    const adj = store.adj;
    const refs: Ref[] = [];
    const seen = new Set<number>(); // edge slots: dedupes loops and shared edges alike

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      const out = adj.outEdges(ref.slot);
      const inn = adj.inEdges(ref.slot);

      for (let j = 0; j < out.length; j++) {
        const edgeSlot = out[j];

        if (!seen.has(edgeSlot)) {
          seen.add(edgeSlot);
          refs.push(store.ref('edges', edgeSlot));
        }
      }

      for (let j = 0; j < inn.length; j++) {
        const edgeSlot = inn[j];

        if (!seen.has(edgeSlot)) {
          seen.add(edgeSlot);
          refs.push(store.ref('edges', edgeSlot));
        }
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * The endpoint nodes of every edge in this collection, deduped.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the endpoint nodes
   */
  connectedNodes(criterion?: FilterLike): Collection {
    const store = this._store;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'edges' || !store.isCurrent(ref)) {
        continue;
      }

      const source = endpoints[ref.slot * 2];
      const target = endpoints[ref.slot * 2 + 1];

      if (!seen.has(source)) {
        seen.add(source);
        refs.push(store.ref('nodes', source));
      }

      if (!seen.has(target)) {
        seen.add(target);
        refs.push(store.ref('nodes', target));
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * The immediate outgoing neighbourhood: the edges leaving these nodes
   * plus the nodes they point at.  One hop only — use `successors()` for
   * the transitive closure.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the outgoing edges and their target nodes
   */
  outgoers(criterion?: FilterLike): Collection {
    return this._goers('out', criterion);
  }

  /**
   * The immediate incoming neighbourhood: the edges arriving at these
   * nodes plus the nodes they come from.  One hop only — use
   * `predecessors()` for the transitive closure.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the incoming edges and their source nodes
   */
  incomers(criterion?: FilterLike): Collection {
    return this._goers('in', criterion);
  }

  private _goers(direction: 'out' | 'in', criterion?: FilterLike): Collection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const refs: Ref[] = [];
    // packed (group, slot) keys: node = slot * 2, edge = slot * 2 + 1
    const seen = new Set<number>();

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      const edgeSlots =
        direction === 'out' ? adj.outEdges(ref.slot) : adj.inEdges(ref.slot);

      for (let j = 0; j < edgeSlots.length; j++) {
        const edgeSlot = edgeSlots[j];
        const otherSlot =
          direction === 'out'
            ? endpoints[edgeSlot * 2 + 1]
            : endpoints[edgeSlot * 2];

        if (!seen.has(edgeSlot * 2 + 1)) {
          seen.add(edgeSlot * 2 + 1);
          refs.push(store.ref('edges', edgeSlot));
        }

        if (!seen.has(otherSlot * 2)) {
          seen.add(otherSlot * 2);
          refs.push(store.ref('nodes', otherSlot));
        }
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * The *open* neighbourhood: the incident edges and the nodes on their
   * far ends, ignoring edge direction, excluding the collection's own
   * elements.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the neighbouring edges and nodes
   * @see Collection#closedNeighborhood to include these nodes
   */
  neighborhood(criterion?: FilterLike): Collection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const refs: Ref[] = [];
    // packed (group, slot) keys; the collection's own live elements are
    // pre-seeded so the open neighborhood excludes them during the walk
    const seen = new Set<number>();

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (store.isCurrent(ref)) {
        seen.add(ref.group === 'nodes' ? ref.slot * 2 : ref.slot * 2 + 1);
      }
    }

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      const out = adj.outEdges(ref.slot);
      const inn = adj.inEdges(ref.slot);

      for (let pass = 0; pass < 2; pass++) {
        const edgeSlots = pass === 0 ? out : inn;

        for (let j = 0; j < edgeSlots.length; j++) {
          const edgeSlot = edgeSlots[j];
          const source = endpoints[edgeSlot * 2];
          const target = endpoints[edgeSlot * 2 + 1];
          const otherSlot = source === ref.slot ? target : source;

          if (!seen.has(edgeSlot * 2 + 1)) {
            seen.add(edgeSlot * 2 + 1);
            refs.push(store.ref('edges', edgeSlot));
          }

          if (!seen.has(otherSlot * 2)) {
            seen.add(otherSlot * 2);
            refs.push(store.ref('nodes', otherSlot));
          }
        }
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  declare openNeighborhood: this['neighborhood'];

  /**
   * The open neighbourhood plus this collection's own nodes.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the closed neighbourhood
   */
  closedNeighborhood(criterion?: FilterLike): Collection {
    const eles = this.neighborhood().union(this.nodes());

    return criterion == null ? eles : eles.filter(criterion);
  }

  // -- compound hierarchy (round 14.2) --

  /** Immediate parents of every node in the collection (unique).  v4
   * always returns a proper collection — v3's single-element raw-ref
   * shortcut (which also ignored the selector argument) is not ported.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the immediate parents
   */
  parent(criterion?: FilterLike): Collection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      const p = store.parentOf(ref.slot);

      if (p >= 0 && !seen.has(p)) {
        seen.add(p);
        refs.push(store.ref('nodes', p));
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * All ancestors, level by level: every nearest parent first, then the
   * grandparents, and so on (v3's iterated-parent() order).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the ancestors, nearest first
   */
  parents(criterion?: FilterLike): Collection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();
    let level: number[] = [];

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group === 'nodes' && store.isCurrent(ref)) {
        level.push(ref.slot);
      }
    }

    while (level.length > 0) {
      const next: number[] = [];

      for (const slot of level) {
        const p = store.parentOf(slot);

        if (p >= 0 && !seen.has(p)) {
          seen.add(p);
          refs.push(store.ref('nodes', p));
          next.push(p);
        }
      }

      level = next;
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  declare ancestors: this['parents'];

  /**
   * Direct children of every node, in link order per parent.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the children
   */
  children(criterion?: FilterLike): Collection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      for (const child of store.childrenOf(ref.slot)) {
        if (!seen.has(child)) {
          seen.add(child);
          refs.push(store.ref('nodes', child));
        }
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * The subtree below every node in pre-order, excluding the nodes
   * themselves.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the descendants
   */
  descendants(criterion?: FilterLike): Collection {
    const store = this._store;
    const refs: Ref[] = [];
    const seen = new Set<number>();
    const stack: number[] = [];

    const pushChildren = (slot: number): void => {
      const kids = store.childrenOf(slot);

      for (let j = kids.length - 1; j >= 0; j--) {
        stack.push(kids[j]);
      }
    };

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      pushChildren(ref.slot);

      while (stack.length > 0) {
        const slot = stack.pop() as number;

        if (seen.has(slot)) {
          continue;
        }

        seen.add(slot);
        refs.push(store.ref('nodes', slot));
        pushChildren(slot);
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * Nodes sharing a parent with the collection's nodes, excluding them;
   * orphans are nobody's siblings (v3).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the siblings
   */
  siblings(criterion?: FilterLike): Collection {
    const eles = this.parent().children().difference(this);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * The collection's nodes without a parent.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the parentless nodes
   */
  orphans(criterion?: FilterLike): Collection {
    return this._byParentedness(false, criterion);
  }

  /**
   * The collection's nodes that have a parent.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the parented nodes
   */
  nonorphans(criterion?: FilterLike): Collection {
    return this._byParentedness(true, criterion);
  }

  private _byParentedness(
    wantChild: boolean,
    criterion?: FilterLike,
  ): Collection {
    const store = this._store;
    const refs: Ref[] = [];

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      if (store.parentOf(ref.slot) >= 0 === wantChild) {
        refs.push(store.ref('nodes', ref.slot));
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * Ancestors common to every element, closest first (an edge in the
   * collection has no ancestors, so it empties the result — v3).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the shared ancestors, closest first
   */
  commonAncestors(criterion?: FilterLike): Collection {
    const store = this._store;
    let chain: number[] | null = null;

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (!store.isCurrent(ref)) {
        continue;
      }

      const own: number[] = [];

      if (ref.group === 'nodes') {
        for (let p = store.parentOf(ref.slot); p >= 0; p = store.parentOf(p)) {
          own.push(p);
        }
      }

      if (chain == null) {
        chain = own;
      } else {
        const keep = new Set(own);

        chain = chain.filter((slot) => keep.has(slot));
      }

      if (chain.length === 0) {
        break;
      }
    }

    const eles = this._spawnLive(
      (chain ?? []).map((slot) => store.ref('nodes', slot)),
    );

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * Whether the first element is a node with at least one child.
   *
   * @returns v3's `:parent` as a predicate; false for edges and for
   *   removed elements, which are nodes of no hierarchy
   */
  isParent(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.childrenOf(ref.slot).length > 0;
  }

  /**
   * Whether the first element is a node with no children.
   *
   * @returns v3's `:childless`; false for edges, so it is not the plain
   *   negation of `isParent()`
   */
  isChildless(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.childrenOf(ref.slot).length === 0;
  }

  /**
   * Whether the first element is a node with a parent.
   *
   * @returns v3's `:child`; false for edges and removed elements
   */
  isChild(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.parentOf(ref.slot) >= 0;
  }

  /**
   * Whether the first element is a node without a parent.
   *
   * @returns v3's `:orphan`; false for edges, so it is not the plain
   *   negation of `isChild()`
   */
  isOrphan(): boolean {
    const ref = this._liveNodeRef();

    return ref != null && this._store.parentOf(ref.slot) < 0;
  }

  private _liveNodeRef(): Ref | null {
    const ref = this._first();

    return ref != null && ref.group === 'nodes' && this._store.isCurrent(ref)
      ? ref
      : null;
  }

  // -- DAG traversal --

  /**
   * Collection nodes with no non-loop incoming edge (whole-graph
   * incidence, as in v3).   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the source nodes
   */
  roots(criterion?: FilterLike): Collection {
    return this._dagExtremity('in', criterion);
  }

  /**
   * Collection nodes with no non-loop outgoing edge.   *
   * @param criterion — an optional query object or predicate applied to
   *   the result, exactly as `filter()` takes it
   * @returns the sink nodes
   */
  leaves(criterion?: FilterLike): Collection {
    return this._dagExtremity('out', criterion);
  }

  private _dagExtremity(
    direction: 'in' | 'out',
    criterion?: FilterLike,
  ): Collection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const refs: Ref[] = [];

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group !== 'nodes' || !store.isCurrent(ref)) {
        continue;
      }

      const edges =
        direction === 'in' ? adj.inEdges(ref.slot) : adj.outEdges(ref.slot);
      let disqualified = false;

      for (let j = 0; j < edges.length; j++) {
        const edgeSlot = edges[j];

        // a loop (source === target) never disqualifies
        if (endpoints[edgeSlot * 2] !== endpoints[edgeSlot * 2 + 1]) {
          disqualified = true;
          break;
        }
      }

      if (!disqualified) {
        refs.push(ref);
      }
    }

    const eles = this._spawnLive(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  /**
   * Everything reachable by following outgoing edges, transitively — the
   * edges and nodes of the forward closure, excluding these nodes
   * themselves (unless a cycle reaches them).
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the reachable edges and nodes
   */
  successors(criterion?: FilterLike): Collection {
    return this._dagAllHops('out', criterion);
  }

  /**
   * Everything that reaches these nodes by following incoming edges,
   * transitively.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the edges and nodes of the backward closure
   */
  predecessors(criterion?: FilterLike): Collection {
    return this._dagAllHops('in', criterion);
  }

  private _dagAllHops(
    direction: 'out' | 'in',
    criterion?: FilterLike,
  ): Collection {
    const store = this._store;
    const adj = store.adj;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const acc: Ref[] = [];
    // packed (group, slot) keys: node = slot * 2, edge = slot * 2 + 1;
    // a raw slot BFS — no per-hop collection spawns or handle interning
    const seen = new Set<number>();
    let frontier: number[] = [];

    for (let i = 0; i < this._refs.length; i++) {
      const ref = this._refs[i];

      if (ref.group === 'nodes' && store.isCurrent(ref)) {
        frontier.push(ref.slot);
      }
    }

    while (frontier.length > 0) {
      const next: number[] = [];

      for (let i = 0; i < frontier.length; i++) {
        const nodeSlot = frontier[i];
        const edgeSlots =
          direction === 'out' ? adj.outEdges(nodeSlot) : adj.inEdges(nodeSlot);

        for (let j = 0; j < edgeSlots.length; j++) {
          const edgeSlot = edgeSlots[j];
          const otherSlot =
            direction === 'out'
              ? endpoints[edgeSlot * 2 + 1]
              : endpoints[edgeSlot * 2];

          if (!seen.has(edgeSlot * 2 + 1)) {
            seen.add(edgeSlot * 2 + 1);
            acc.push(store.ref('edges', edgeSlot));
          }

          if (!seen.has(otherSlot * 2)) {
            seen.add(otherSlot * 2);
            acc.push(store.ref('nodes', otherSlot));
            next.push(otherSlot);
          }
        }
      }

      frontier = next;
    }

    const out = this._spawnLive(acc);

    return criterion == null ? out : out.filter(criterion);
  }

  // -- edge relations --

  /**
   * The edges connecting this collection's nodes with `others`, in
   * either direction.
   *
   * @param others — the nodes on the far side (a collection, never a
   *   selector string)
   * @returns the connecting edges
   */
  edgesWith(others: Collection): Collection {
    assertCollection(others, 'edgesWith', this._cy);

    return this._edgesWith(others, false);
  }

  /**
   * The edges running *from* this collection's nodes *to* `others` —
   * `edgesWith()` restricted by direction.
   *
   * @param others — the target-side nodes
   * @returns the directed connecting edges
   */
  edgesTo(others: Collection): Collection {
    assertCollection(others, 'edgesTo', this._cy);

    return this._edgesWith(others, true);
  }

  private _edgesWith(others: Collection, thisIsSrc: boolean): Collection {
    const store = this._store;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const otherColl = others;

    const thisNodes = this._nodeSlotSet();
    const otherNodes = otherColl._nodeSlotSet();
    const refs: Ref[] = [];

    for (const oref of otherColl._liveRefs()) {
      if (oref.group !== 'nodes') {
        continue;
      }

      for (const edgeSlot of store.adj.connectedEdges(oref.slot)) {
        const s = endpoints[edgeSlot * 2];
        const t = endpoints[edgeSlot * 2 + 1];
        const thisToOther = thisNodes.has(s) && otherNodes.has(t);
        const otherToThis = otherNodes.has(s) && thisNodes.has(t);

        if (!(thisToOther || otherToThis)) {
          continue;
        }
        if (thisIsSrc && !thisToOther) {
          continue;
        }

        refs.push(store.ref('edges', edgeSlot));
      }
    }

    return this._spawn(refs);
  }

  /**
   * The edges sharing endpoints with these edges, in either direction —
   * including each edge itself.  These are the edges a bezier bundle
   * fans apart.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the parallel edges
   */
  parallelEdges(criterion?: FilterLike): Collection {
    return this._parallelEdges(false, criterion);
  }

  /**
   * The parallel edges pointing the same way — same source and same
   * target — including each edge itself.
   *
   * @param criterion — an optional query object or predicate to filter
   *   the result
   * @returns the codirected edges
   */
  codirectedEdges(criterion?: FilterLike): Collection {
    return this._parallelEdges(true, criterion);
  }

  private _parallelEdges(
    codirectedOnly: boolean,
    criterion?: FilterLike,
  ): Collection {
    const store = this._store;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const refs: Ref[] = [];

    for (const ref of this._liveRefs()) {
      if (ref.group !== 'edges') {
        continue;
      }

      const src1 = endpoints[ref.slot * 2];
      const tgt1 = endpoints[ref.slot * 2 + 1];

      // every edge parallel to this one is incident to its source node
      for (const e2 of store.adj.connectedEdges(src1)) {
        const s2 = endpoints[e2 * 2];
        const t2 = endpoints[e2 * 2 + 1];
        const codirected = s2 === src1 && t2 === tgt1;
        const opposed = s2 === tgt1 && t2 === src1;

        if (
          (codirectedOnly && codirected) ||
          (!codirectedOnly && (codirected || opposed))
        ) {
          refs.push(store.ref('edges', e2));
        }
      }
    }

    const eles = this._spawn(refs);

    return criterion == null ? eles : eles.filter(criterion);
  }

  // -- connected components --

  /**
   * Connected components within this collection (undirected), each as a
   * collection of the reached nodes plus the collection's edges internal
   * to that component.
   *
   * @param root — restricts the seed nodes; omit to seed from every node
   * @returns one collection per component
   */
  components(root?: Collection | null): Collection[] {
    const store = this._store;
    const endpoints = store.column('edge.endpoints') as Uint32Array;
    const nodeSlots = this._nodeSlotSet();
    const edgeSlots: number[] = [];
    const edgeSlotSet = new Set<number>();

    for (const ref of this._liveRefs()) {
      if (ref.group === 'edges') {
        edgeSlots.push(ref.slot);
        edgeSlotSet.add(ref.slot);
      }
    }

    let seeds: number[];

    if (root == null) {
      seeds = [...nodeSlots];
    } else {
      const rootColl = root;
      const rootNodes = rootColl._nodeSlotSet();

      seeds =
        rootNodes.size > 0
          ? [...rootNodes].filter((s) => nodeSlots.has(s))
          : // root has only edges: seed from their source-side nodes
            rootColl
              ._liveRefs()
              .filter((r) => r.group === 'edges')
              .map((r) => endpoints[r.slot * 2])
              .filter((s) => nodeSlots.has(s));
    }

    const visited = new Set<number>();
    const comps: Collection[] = [];

    for (const seed of seeds) {
      if (visited.has(seed)) {
        continue;
      }

      const compNodes = new Set<number>();
      const stack = [seed];

      visited.add(seed);

      while (stack.length > 0) {
        const n = stack.pop() as number;

        compNodes.add(n);

        for (const edgeSlot of store.adj.connectedEdges(n)) {
          if (!edgeSlotSet.has(edgeSlot)) {
            continue;
          } // only walk edges within this collection

          const s = endpoints[edgeSlot * 2];
          const t = endpoints[edgeSlot * 2 + 1];
          const other = s === n ? t : s;

          if (nodeSlots.has(other) && !visited.has(other)) {
            visited.add(other);
            stack.push(other);
          }
        }
      }

      const refs: Ref[] = [];

      for (const s of compNodes) {
        refs.push(store.ref('nodes', s));
      }

      for (const edgeSlot of edgeSlots) {
        if (
          compNodes.has(endpoints[edgeSlot * 2]) &&
          compNodes.has(endpoints[edgeSlot * 2 + 1])
        ) {
          refs.push(store.ref('edges', edgeSlot));
        }
      }

      comps.push(this._spawn(refs));
    }

    return comps;
  }

  declare componentsOf: this['components'];

  /**
   * The whole-graph connected component containing the first element.
   *
   * @returns the component as nodes *and* their connecting edges, computed
   *   over the whole graph rather than within this collection; an empty
   *   collection when this one is empty
   */
  component(): Collection {
    if (this._first() == null) {
      return this._spawn([]);
    }

    return this._cy.elements().components(this)[0] ?? this._spawn([]);
  }

  private _nodeSlotSet(): Set<number> {
    const set = new Set<number>();

    for (const ref of this._liveRefs()) {
      if (ref.group === 'nodes') {
        set.add(ref.slot);
      }
    }

    return set;
  }

  /**
   * The bounding box this collection would have if its nodes sat at the
   * given hypothetical positions (a position fn or one shared position) —
   * v3's boundingBoxAt, computed directly with no store writes.  Edges
   * span their endpoints' hypothetical (or, outside the collection,
   * current) positions.
   *
   * @param fn — one position shared by every node, or `( node, i ) =>
   *   position` evaluated per node in this collection's order
   * @returns the hypothetical box, in model coordinates
   */
  boundingBoxAt(fn: Position | ((node: Collection, i: number) => Position)): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } {
    const nodes = this.nodes();
    const posFn = typeof fn === 'function' ? fn : () => fn;
    const posMap = new Map<Collection, Position>();

    let x1 = Infinity,
      y1 = Infinity,
      x2 = -Infinity,
      y2 = -Infinity;

    const expandPoint = (x: number, y: number): void => {
      x1 = Math.min(x1, x);
      x2 = Math.max(x2, x);
      y1 = Math.min(y1, y);
      y2 = Math.max(y2, y);
    };

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      // parents derive from their children (14.11): the leaves'
      // hypothetical boxes stand in for the parent body (the padding
      // margin is not modeled — a recorded fit-target approximation)
      if (node.isParent()) {
        continue;
      }

      const pos = posFn(node, i);

      posMap.set(node, pos);

      const halfW = (node.outerWidth() ?? 0) / 2;
      const halfH = (node.outerHeight() ?? 0) / 2;

      expandPoint(pos.x - halfW, pos.y - halfH);
      expandPoint(pos.x + halfW, pos.y + halfH);

      // the node-relative label box comes along (round 16.4): an
      // animated layout's fit target covers the labels too
      const lb = this._store.nodeLabelBox(node._refs[0].slot);

      if (lb != null) {
        expandPoint(pos.x + lb.x1, pos.y + lb.y1);
        expandPoint(pos.x + lb.x2, pos.y + lb.y2);
      }
    }

    const curveParams = this._store.column('edge.curveParams') as Float32Array;
    const edgeFlags = this._store.column('edge.flags') as Uint32Array;

    this._store.flushDerived();

    for (const ref of this._liveRefs()) {
      if (ref.group !== 'edges') {
        continue;
      }

      const edge = this._cy._ele('edges', ref.slot);

      // curved edges expand by the conservative hull deviation — exact
      // eval at hypothetical positions isn't needed for a fit target.
      // The formulation is round 54's, twinned with
      // `GraphStore.boundingBox`: compound loops take a directional
      // per-edge box (controls hang up-left of the union of the two
      // outer boxes by at most the stored p2), and box-bounded routes
      // add the edge's own endpoints' outer halves — never the global
      // nodeHalfMax — plus the chord for weight extrapolation only.
      const at = ref.slot * 4;
      const kind = curveParams[at + 3];
      const source = edge.source();
      const target = edge.target();
      const sPos = posMap.get(source) ?? (source.position() as Position);
      const tPos = posMap.get(target) ?? (target.position() as Position);
      const sOW = (source.outerWidth() ?? 0) / 2;
      const sOH = (source.outerHeight() ?? 0) / 2;
      const tOW = (target.outerWidth() ?? 0) / 2;
      const tOH = (target.outerHeight() ?? 0) / 2;

      if (kind === CURVE_CMPD) {
        const p2 = Math.abs(curveParams[at + 2]);

        expandPoint(
          Math.min(sPos.x - sOW, tPos.x - tOW) - p2,
          Math.min(sPos.y - sOH, tPos.y - tOH) - p2,
        );
        expandPoint(
          Math.max(sPos.x + sOW, tPos.x + tOW),
          Math.max(sPos.y + sOH, tPos.y + tOH),
        );
        continue;
      }

      let dev =
        kind === CURVE_STRAIGHT
          ? 0
          : headerDeviation(
              kind,
              curveParams[at],
              curveParams[at + 1],
              curveParams[at + 2],
            );

      if ((edgeFlags[ref.slot] & FLAG_CURVED_BOX) !== 0) {
        const base = kind >= CURVE_HAS_ENDPT ? kind - CURVE_HAS_ENDPT : kind;

        // taxi routes exactly, at the hypothetical centres (round 54):
        // a forced-direction route overshoots by the turn, which no
        // node-half margin bounds — see the twin in GraphStore.  The
        // raw route points hull-bound the drawn path (rounded corners
        // stay inside their corner's polyline).
        if (base === CURVE_TAXI) {
          const route = this._store.curveRouteAtPositions(
            ref.slot,
            sPos.x,
            sPos.y,
            tPos.x,
            tPos.y,
          );

          if (route != null) {
            for (let k = 0; k < route.n + 2; k++) {
              expandPoint(route.qx[k], route.qy[k]);
            }
            continue;
          }
        }

        dev += Math.max(sOW, sOH, tOW, tOH);
        dev += Math.hypot(tPos.x - sPos.x, tPos.y - sPos.y);
      }

      for (const pos of [sPos, tPos]) {
        expandPoint(pos.x - dev, pos.y - dev);
        expandPoint(pos.x + dev, pos.y + dev);
      }
    }

    if (x1 === Infinity) {
      x1 = y1 = x2 = y2 = 0;
    }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  // -- layouts --

  /**
   * Node dimensions for layout spacing, as v3's layoutDimensions.
   *
   * @param options — `{ nodeDimensionsIncludeLabels }` to measure the
   *   label box too rather than the node body alone
   * @returns the first element's `{ w, h }`
   */
  layoutDimensions(options: { nodeDimensionsIncludeLabels?: boolean } = {}): {
    w: number;
    h: number;
  } {
    let dims: { w: number; h: number };

    if (!this.takesUpSpace()) {
      dims = { w: 0, h: 0 };
    } else if (options.nodeDimensionsIncludeLabels) {
      const bb = this.boundingBox();

      dims = { w: bb.w, h: bb.h };
    } else {
      dims = { w: this.outerWidth() ?? 0, h: this.outerHeight() ?? 0 };
    }

    // sanitise for layouts (avoid division by zero)
    if (dims.w === 0 || dims.h === 0) {
      dims.w = dims.h = 1;
    }

    return dims;
  }

  /**
   * Apply a layout's position function to this collection's nodes with the
   * standard layout options (spacingFactor, transform, fit/zoom/pan, animate)
   * and the layoutstart/layoutready/layoutstop event flow — v3's helper.
   * With `animate: true` the viewport animates concurrently (a fit targets
   * the bounding box at the *final* positions, as v3 does).
   *
   * @param layout — the layout instance the lifecycle events carry as
   *   `event.layout`; it is not called back, only reported
   * @param options — the standard layout options (`spacingFactor`,
   *   `transform`, `fit`/`padding`, `zoom`/`pan`, `animate`,
   *   `animationDuration`, `animateFilter`)
   * @param fn — `( node, i ) => position`, evaluated once per positioned
   *   node; parents are excluded (auto-bounds derive them)
   * @returns this collection, for chaining
   */
  layoutPositions(
    layout: object,
    options: LayoutBaseOptions,
    fn: (node: Collection, i: number) => Position,
  ): this {
    const cy = this._cy;
    // v3: parents are excluded from layout positioning (auto-bounds
    // derive them from their placed leaves, round 14.11)
    const nodes = cy._store.hasCompounds()
      ? this.nodes().filter((n: Collection) => !n.isParent())
      : this.nodes();
    const eles = (options.eles as Collection | undefined) ?? this;

    // the extension wrapper emits its own layoutstart before run()
    // (round 17.5); the finisher folds into that lifecycle
    if ((options as { _startEmitted?: boolean })._startEmitted !== true) {
      cy.emit({ type: 'layoutstart', layout });
    }

    // memoize by handle: handles are interned singletons
    const rawMemo = new Map<Collection, Position>();

    const rawPos = (node: Collection, i: number): Position => {
      let p = rawMemo.get(node);

      if (p == null) {
        p = fn(node, i);
        rawMemo.set(node, p);
      }

      return p;
    };

    const factor = options.spacingFactor;
    const useSpacing = factor != null && factor !== 1 && nodes.length > 0;
    let center: Position | null = null;

    if (useSpacing) {
      let x1 = Infinity,
        y1 = Infinity,
        x2 = -Infinity,
        y2 = -Infinity;

      for (let i = 0; i < nodes.length; i++) {
        const p = rawPos(nodes[i], i);

        x1 = Math.min(x1, p.x);
        x2 = Math.max(x2, p.x);
        y1 = Math.min(y1, p.y);
        y2 = Math.max(y2, p.y);
      }

      center = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
    }

    const finalMemo = new Map<Collection, Position>();

    const getFinalPos = (node: Collection, i: number): Position => {
      let p = finalMemo.get(node);

      if (p != null) {
        return p;
      }

      p = rawPos(node, i);

      if (useSpacing && center != null) {
        const spacing = Math.abs(factor as number);

        p = {
          x: center.x + (p.x - center.x) * spacing,
          y: center.y + (p.y - center.y) * spacing,
        };
      }

      if (options.transform != null) {
        p = options.transform(node, p);
      }

      finalMemo.set(node, p);

      return p;
    };

    const applyViewport = (): void => {
      if (options.fit) {
        cy.fit(eles, options.padding ?? 30);
      } else {
        if (options.zoom != null) {
          cy.zoom(options.zoom);
        }
        if (options.pan != null) {
          cy.pan(options.pan);
        }
      }
    };

    if (options.animate) {
      const anis: AnimationHandle[] = [];

      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const newPos = getFinalPos(node, i);
        const animateNode =
          options.animateFilter == null || options.animateFilter(node, i);

        if (animateNode) {
          anis.push(
            node.animation({
              position: newPos,
              duration: options.animationDuration ?? 500,
              easing: options.animationEasing,
            }),
          );
        } else {
          node.position(newPos);
        }
      }

      // the viewport animates alongside the nodes: a fit targets the box at
      // the final positions (v3 semantics)
      if (options.fit) {
        anis.push(
          cy.animation({
            fit: {
              boundingBox: eles.boundingBoxAt(getFinalPos),
              padding: options.padding ?? 30,
            },
            duration: options.animationDuration ?? 500,
            easing: options.animationEasing,
          }),
        );
      } else if (options.zoom != null && options.pan != null) {
        anis.push(
          cy.animation({
            zoom: options.zoom,
            pan: options.pan,
            duration: options.animationDuration ?? 500,
            easing: options.animationEasing,
          }),
        );
      }

      for (const ani of anis) {
        ani.play();
      }

      options.ready?.();
      cy.emit({ type: 'layoutready', layout });

      Promise.all(anis.map((ani) => ani.promise())).then(() => {
        options.stop?.();
        cy.emit({ type: 'layoutstop', layout });
      });
    } else {
      nodes.positions(getFinalPos);
      applyViewport();

      options.ready?.();
      cy.emit({ type: 'layoutready', layout });

      options.stop?.();
      cy.emit({ type: 'layoutstop', layout });
    }

    return this;
  }

  /**
   * A layout scoped to this collection.
   *
   * @param options — the layout options, as `cy.layout()`; `eles` is set
   *   to this collection
   * @returns the layout instance; nothing runs until `run()`
   */
  layout(options: LayoutOptions): ReturnType<Core['layout']> {
    return this._cy.layout({ ...options, eles: this });
  }

  declare makeLayout: this['layout'];
  declare createLayout: this['layout'];

  // the implementations are slot-native, in ./algorithms/
  // -- graph algorithms --

  /**
   * Breadth-first search from one or more roots over this collection's
   * subgraph, walking slot-native over the CSR adjacency.
   *
   * @param args — v3's option shape (`{ roots, visit, directed }`) or the
   *   positional form; `roots` is a **collection**, since v4 has no
   *   selector strings
   * @returns `{ path, found }`
   */
  breadthFirstSearch(...args: SearchArgs): SearchResult {
    return searchImpl(this, true, args);
  }

  /**
   * Depth-first search from one or more roots.  Same options as
   * `breadthFirstSearch`.
   *
   * @param args — `{ roots, visit, directed }` or the positional form
   * @returns `{ path, found }`
   */
  depthFirstSearch(...args: SearchArgs): SearchResult {
    return searchImpl(this, false, args);
  }

  declare bfs: this['breadthFirstSearch'];
  declare dfs: this['depthFirstSearch'];

  /**
   * Dijkstra shortest paths from a root over non-negative weights.
   *
   * @param args — `{ root, weight, directed }`; `weight` is a plain
   *   function `( edge ) => number`
   * @returns `{ distanceTo, pathTo }`
   */
  dijkstra(...args: DijkstraArgs): DijkstraResult {
    return dijkstraImpl(this, args);
  }

  /**
   * A* shortest path between two nodes.
   *
   * @param options — `{ root, goal, weight, heuristic, directed }`, with
   *   `weight` and `heuristic` as plain functions
   * @returns `{ found, distance, path }`
   */
  aStar(options?: AStarOptions): AStarResult {
    return aStarImpl(this, options);
  }

  /**
   * Bellman–Ford shortest paths, which unlike Dijkstra tolerates
   * negative weights and reports negative cycles.
   *
   * @param options — `{ root, weight, directed }`
   * @returns `{ distanceTo, pathTo, hasNegativeWeightCycle, negativeWeightCycles }`
   */
  bellmanFord(options?: BellmanFordOptions): BellmanFordResult {
    return bellmanFordImpl(this, options);
  }

  /**
   * Floyd–Warshall all-pairs shortest paths.  O(n³) — for a single
   * source prefer `dijkstra`/`bellmanFord`.
   *
   * @param options — `{ weight, directed }`
   * @returns `{ distance, path }` accessors
   */
  floydWarshall(options?: FloydWarshallOptions): FloydWarshallResult {
    return floydWarshallImpl(this, options);
  }

  /**
   * Kruskal's minimum spanning tree/forest.
   *
   * @param weight — `( edge ) => number`; defaults to unit weights
   * @returns the spanning forest's nodes and edges
   */
  kruskal(weight?: WeightFn): Collection {
    return kruskalImpl(this, weight);
  }

  /**
   * Tarjan's strongly connected components.  Implemented iteratively, so
   * deep graphs cannot overflow the JS stack.
   *
   * @returns `{ components, cut }`
   */
  tarjanStronglyConnected(): TarjanStronglyConnectedResult {
    return tarjanImpl(this);
  }

  declare tsc: this['tarjanStronglyConnected'];
  declare tscc: this['tarjanStronglyConnected'];
  declare tarjanStronglyConnectedComponents: this['tarjanStronglyConnected'];

  /**
   * Hopcroft–Tarjan biconnected components and articulation points.
   *
   * @returns `{ components, cut }`
   */
  hopcroftTarjanBiconnected(): HopcroftTarjanBiconnectedResult {
    return hopcroftTarjanImpl(this);
  }

  declare htbc: this['hopcroftTarjanBiconnected'];
  declare htb: this['hopcroftTarjanBiconnected'];
  declare hopcroftTarjanBiconnectedComponents: this['hopcroftTarjanBiconnected'];

  /**
   * Hierholzer's Eulerian path/circuit.
   *
   * @param args — `{ root }` or the positional form
   * @returns `{ found, trail }`
   */
  hierholzer(...args: HierholzerArgs): HierholzerResult {
    return hierholzerImpl(this, args);
  }

  /**
   * Karger–Stein randomized minimum cut.  Randomized, so repeated runs
   * may differ.
   *
   * @returns `{ cut, components, partition1, partition2 }`
   */
  kargerStein(): KargerSteinResult {
    return kargerSteinImpl(this);
  }

  /**
   * PageRank over the (directed) subgraph.
   *
   * @param options — `{ dampingFactor, precision, iterations }`
   * @returns `{ rank }`, a per-node accessor
   */
  pageRank(options?: PageRankOptions): PageRankResult {
    return pageRankImpl(this, options);
  }

  /**
   * Degree centrality of one node relative to the collection.
   *
   * @param options — `{ root, weight, alpha, directed }`
   * @returns `{ degree }`, or `{ indegree, outdegree }` when directed
   */
  degreeCentrality(options?: DegreeCentralityOptions): DegreeCentralityResult {
    return degreeCentralityImpl(this, options);
  }

  declare dc: this['degreeCentrality'];

  /**
   * Degree centrality for every node, normalized to [0, 1].
   *
   * @param options — `{ weight, alpha, directed }`
   * @returns a `degree` accessor, or `indegree`/`outdegree` when
   *   directed
   */
  degreeCentralityNormalized(
    options?: DegreeCentralityOptions,
  ): DegreeCentralityNormalizedResult {
    return degreeCentralityNormalizedImpl(this, options);
  }

  declare dcn: this['degreeCentralityNormalized'];
  declare degreeCentralityNormalised: this['degreeCentralityNormalized'];

  /**
   * Closeness centrality of one node — the reciprocal of its summed
   * shortest-path distances to the rest of the collection.
   *
   * @param options — `{ root, weight, directed, harmonic }`
   * @returns the closeness score
   */
  closenessCentrality(options?: ClosenessCentralityOptions): number {
    return closenessCentralityImpl(this, options);
  }

  declare cc: this['closenessCentrality'];

  /**
   * Closeness centrality for every node, normalized to [0, 1].
   *
   * @param options — `{ weight, directed, harmonic }`
   * @returns a `closeness` accessor
   */
  closenessCentralityNormalized(
    options?: ClosenessCentralityOptions,
  ): ClosenessCentralityNormalizedResult {
    return closenessCentralityNormalizedImpl(this, options);
  }

  declare ccn: this['closenessCentralityNormalized'];
  declare closenessCentralityNormalised: this['closenessCentralityNormalized'];

  /**
   * Betweenness centrality — how often each node lies on shortest paths
   * between other pairs.
   *
   * @param options — `{ weight, directed }`
   * @returns `{ betweenness, betweennessNormalized }` accessors
   */
  betweennessCentrality(
    options?: BetweennessCentralityOptions,
  ): BetweennessCentralityResult {
    return betweennessCentralityImpl(this, options);
  }

  declare bc: this['betweennessCentrality'];

  /**
   * k-means clustering in attribute space.  Like v3's clustering
   * algorithms this works on handles and `attributes` accessors rather
   * than on graph structure.
   *
   * @param options — `{ k, attributes, distance, maxIterations,
   *   sensitivityThreshold }`, with `attributes` as plain functions
   * @returns one collection per cluster
   */
  kMeans(options?: KClusteringOptions): Collection[] {
    return kMeansImpl(this, options);
  }

  /**
   * k-medoids clustering — like k-means, but cluster centres are actual
   * elements, which makes it robust to outliers.
   *
   * @param options — as `kMeans`
   * @returns one collection per cluster
   */
  kMedoids(options?: KClusteringOptions): Collection[] {
    return kMedoidsImpl(this, options);
  }

  /**
   * Fuzzy c-means clustering: each element gets a degree of membership
   * in every cluster rather than one hard assignment.
   *
   * @param options — as `kMeans`, plus the fuzziness exponent
   * @returns `{ clusters, degreeOfMembership }`
   */
  fuzzyCMeans(options?: KClusteringOptions): FuzzyCMeansResult {
    return fuzzyCMeansImpl(this, options);
  }

  declare fcm: this['fuzzyCMeans'];

  /**
   * Agglomerative hierarchical clustering.
   *
   * @param options — `{ attributes, distance, linkage, mode,
   *   dendrogramDepth }`
   * @returns one collection per cluster
   */
  hierarchicalClustering(
    options?: HierarchicalClusteringOptions,
  ): Collection[] {
    return hierarchicalClusteringImpl(this, options);
  }

  declare hca: this['hierarchicalClustering'];

  /**
   * Markov clustering (MCL) — flow simulation over the graph, so unlike
   * the attribute-space algorithms this one clusters by structure.
   *
   * @param options — `{ attributes, expandFactor, inflateFactor,
   *   multFactor, maxIterations }`
   * @returns one collection per cluster
   */
  markovClustering(options?: MarkovClusteringOptions): Collection[] {
    return markovClusteringImpl(this, options);
  }

  declare mcl: this['markovClustering'];

  /**
   * Affinity propagation, which picks exemplars by message passing and
   * so needs no target cluster count.
   *
   * @param options — `{ attributes, distance, preference, damping,
   *   minIterations, maxIterations }`
   * @returns one collection per cluster
   */
  affinityPropagation(options?: AffinityPropagationOptions): Collection[] {
    return affinityPropagationImpl(this, options);
  }

  declare ap: this['affinityPropagation'];

  // -- degree --

  // degree()/indegree()/outdegree() are singular accessors: they report the
  // FIRST element's degree (undefined if it isn't a live node), as in v3. The
  // whole-collection sum is totalDegree().
  /**
   * The **first** element's total degree, in + out, answered in O(1) off
   * the adjacency index.
   *
   * This is a singular accessor, as in v3 — it reports one node's
   * degree, not a collection-wide figure.  For the sum over the whole
   * collection use `totalDegree()`.
   *
   * @param includeLoops — whether self-loops count (each contributes 2)
   * @returns the degree, or undefined when the first element is not a
   *   live node
   */
  degree(includeLoops: boolean = true): number | undefined {
    return this._degree(
      includeLoops,
      (store, slot) => store.adj.outDegree(slot) + store.adj.inDegree(slot),
    );
  }

  /**
   * The first element's out-degree, in O(1).  Singular, like `degree()`.
   *
   * @param includeLoops — whether self-loops count
   * @returns the out-degree, or undefined when not a live node
   */
  outdegree(includeLoops: boolean = true): number | undefined {
    return this._degree(
      includeLoops,
      (store, slot) => store.adj.outDegree(slot),
      'out',
    );
  }

  /**
   * The first element's in-degree, in O(1).  Singular, like `degree()`.
   *
   * @param includeLoops — whether self-loops count
   * @returns the in-degree, or undefined when not a live node
   */
  indegree(includeLoops: boolean = true): number | undefined {
    return this._degree(
      includeLoops,
      (store, slot) => store.adj.inDegree(slot),
      'in',
    );
  }

  /**
   * The smallest total degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the minimum degree, or undefined when there are no nodes
   */
  minDegree(includeLoops: boolean = true): number | undefined {
    return this._degreeBound('degree', includeLoops, -1);
  }

  /**
   * The largest total degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the maximum degree, or undefined when there are no nodes
   */
  maxDegree(includeLoops: boolean = true): number | undefined {
    return this._degreeBound('degree', includeLoops, 1);
  }

  /**
   * The smallest in-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the minimum in-degree, or undefined when there are no nodes
   */
  minIndegree(includeLoops: boolean = true): number | undefined {
    return this._degreeBound('indegree', includeLoops, -1);
  }

  /**
   * The largest in-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the maximum in-degree, or undefined when there are no nodes
   */
  maxIndegree(includeLoops: boolean = true): number | undefined {
    return this._degreeBound('indegree', includeLoops, 1);
  }

  /**
   * The smallest out-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the minimum out-degree, or undefined when there are no
   *   nodes
   */
  minOutdegree(includeLoops: boolean = true): number | undefined {
    return this._degreeBound('outdegree', includeLoops, -1);
  }

  /**
   * The largest out-degree among the collection's nodes.
   *
   * @param includeLoops — whether self-loops count
   * @returns the maximum out-degree, or undefined when there are no
   *   nodes
   */
  maxOutdegree(includeLoops: boolean = true): number | undefined {
    return this._degreeBound('outdegree', includeLoops, 1);
  }

  /**
   * The summed degree of every node in the collection — the
   * whole-collection figure that `degree()` deliberately is not.
   *
   * @param includeLoops — whether self-loops count
   * @returns the total degree (0 when there are no nodes)
   */
  totalDegree(includeLoops: boolean = true): number {
    let total = 0;

    for (let i = 0; i < this.length; i++) {
      const d = this[i].degree(includeLoops);

      if (d !== undefined) {
        total += d;
      }
    }

    return total;
  }

  private _degreeBound(
    fn: 'degree' | 'indegree' | 'outdegree',
    includeLoops: boolean,
    sign: 1 | -1,
  ): number | undefined {
    let ret: number | undefined;

    for (let i = 0; i < this.length; i++) {
      if (!this[i].isNode()) {
        continue;
      }

      const degree =
        fn === 'degree'
          ? this[i].degree(includeLoops)
          : fn === 'indegree'
            ? this[i].indegree(includeLoops)
            : this[i].outdegree(includeLoops);

      if (degree === undefined) {
        continue;
      }

      if (ret === undefined || sign * degree > sign * ret) {
        ret = degree;
      }
    }

    return ret;
  }

  private _degree(
    includeLoops: boolean,
    count: (store: Core['_store'], slot: number) => number,
    direction?: 'out' | 'in',
  ): number | undefined {
    const store = this._store;
    const ref = this._first();

    // first element must be a live node, else undefined (as in v3)
    if (ref == null || ref.group !== 'nodes' || !store.isCurrent(ref)) {
      return undefined;
    }

    let total = count(store, ref.slot);

    if (!includeLoops) {
      const endpoints = store.column('edge.endpoints') as Uint32Array;

      // a loop contributes 1 to outdegree, 1 to indegree, 2 to degree
      for (const edgeSlot of store.adj.outEdges(ref.slot)) {
        if (endpoints[edgeSlot * 2] === endpoints[edgeSlot * 2 + 1]) {
          total -= direction == null ? 2 : 1;
        }
      }
    }

    return total;
  }

  // -- events --

  /**
   * Listen for events on each element of this collection.  The handler
   * is bound per element, and keeps firing across slot compaction —
   * listeners repair with their elements rather than going stale.
   *
   * Events bubble from an element through its compound ancestors to the
   * core (round 14.5), with `stopPropagation()` honoured.
   *
   * **Any name registers**, as on the core and for the same reason — custom
   * events are supported API (`ele.emit( 'foo' )`), so names cannot be gated.
   * A name v4 never emits registers cleanly and never fires: that is v3's
   * `vmouse*` aliases and its raw mouse/touch re-emits — and, since round
   * 41.2, any name containing a dot: there is no namespace machinery, so
   * `'data.ns'` is a literal type v4 never raises.  See `Core#on`.
   *
   * @param events — one or more space-separated event names
   * @param callback — the handler
   * @returns this collection, for chaining
   */
  on(events: string, callback?: EventHandler): this {
    for (const ref of this._refs) {
      this._cy._emitter.on(events, refQualifier(ref), callback);
    }

    return this;
  }

  declare addListener: this['on'];

  /**
   * Like `on()`, but each element's handler runs at most once.
   *
   * @param events — one or more space-separated event names
   * @param callback — the handler
   * @returns this collection, for chaining
   */
  one(events: string, callback?: EventHandler): this {
    for (const ref of this._refs) {
      this._cy._emitter.one(events, refQualifier(ref), callback);
    }

    return this;
  }

  declare once: this['one'];
  declare listen: this['on'];
  declare bind: this['on'];

  /**
   * Stop listening on each element of this collection.
   *
   * @param events — one or more space-separated event names
   * @param callback — the handler to remove; omit to remove every
   *   handler these elements have for `events`
   * @returns this collection, for chaining
   */
  off(events: string, callback?: EventHandler): this {
    for (const ref of this._refs) {
      this._cy._emitter.off(events, refQualifier(ref), callback);
    }

    return this;
  }

  declare removeListener: this['off'];
  declare unlisten: this['off'];
  declare unbind: this['off'];

  /**
   * Emit an event on each element, bubbling through compound ancestors
   * to the core.
   *
   * @param events — one or more space-separated event names
   * @param extraParams — extra arguments passed to each handler after
   *   the event object
   * @returns this collection, for chaining
   */
  emit(events: string, extraParams?: unknown[]): this {
    // v4 does not support event namespaces (see PLAN.md); types are emitted verbatim
    for (let i = 0; i < this.length; i++) {
      for (const type of events.split(/\s+/)) {
        if (type !== '') {
          this._cy._emitOnEle(type, this[i], extraParams);
        }
      }
    }

    return this;
  }

  declare trigger: this['emit'];

  /**
   * Resolve once the next matching event fires on any element of this
   * collection — the promise form of `one()`.
   *
   * @param events — one or more space-separated event names
   * @returns a promise for the event object
   */
  promiseOn(events: string): Promise<Event> {
    return new Promise((resolve) => {
      this.one(events, (event) => resolve(event));
    });
  }

  declare pon: this['promiseOn'];
}

Collection.prototype.each = Collection.prototype.forEach;
Collection.prototype.has = Collection.prototype.contains;
Collection.prototype.u = Collection.prototype.union;
Collection.prototype.or = Collection.prototype.union;
Collection.prototype.add = Collection.prototype.union;
Collection.prototype.merge = Collection.prototype.union;
Collection.prototype.not = Collection.prototype.difference;
Collection.prototype.subtract = Collection.prototype.difference;
Collection.prototype.unmerge = Collection.prototype.difference;
Collection.prototype.relativeComplement = Collection.prototype.difference;
Collection.prototype.complement = Collection.prototype.absoluteComplement;
Collection.prototype.abscomp = Collection.prototype.absoluteComplement;
Collection.prototype.equal = Collection.prototype.same;
Collection.prototype.equals = Collection.prototype.same;
Collection.prototype.allAreNeighbours = Collection.prototype.allAreNeighbors;
Collection.prototype.modelPosition = Collection.prototype.position;
Collection.prototype.point = Collection.prototype.position;
Collection.prototype.modelPositions = Collection.prototype.positions;
Collection.prototype.points = Collection.prototype.positions;
Collection.prototype.relativePoint = Collection.prototype.relativePosition;
Collection.prototype.renderedPoint = Collection.prototype.renderedPosition;
Collection.prototype.renderedBoundingbox =
  Collection.prototype.renderedBoundingBox;
Collection.prototype.intersect = Collection.prototype.intersection;
Collection.prototype.and = Collection.prototype.intersection;
Collection.prototype.symdiff = Collection.prototype.symmetricDifference;
Collection.prototype.xor = Collection.prototype.symmetricDifference;
Collection.prototype.deselect = Collection.prototype.unselect;
Collection.prototype.openNeighborhood = Collection.prototype.neighborhood;
Collection.prototype.ancestors = Collection.prototype.parents;
Collection.prototype.componentsOf = Collection.prototype.components;
Collection.prototype.makeLayout = Collection.prototype.layout;
Collection.prototype.createLayout = Collection.prototype.layout;
Collection.prototype.bfs = Collection.prototype.breadthFirstSearch;
Collection.prototype.dfs = Collection.prototype.depthFirstSearch;
Collection.prototype.tsc = Collection.prototype.tarjanStronglyConnected;
Collection.prototype.tscc = Collection.prototype.tarjanStronglyConnected;
Collection.prototype.tarjanStronglyConnectedComponents =
  Collection.prototype.tarjanStronglyConnected;
Collection.prototype.htbc = Collection.prototype.hopcroftTarjanBiconnected;
Collection.prototype.htb = Collection.prototype.hopcroftTarjanBiconnected;
Collection.prototype.hopcroftTarjanBiconnectedComponents =
  Collection.prototype.hopcroftTarjanBiconnected;
Collection.prototype.dc = Collection.prototype.degreeCentrality;
Collection.prototype.dcn = Collection.prototype.degreeCentralityNormalized;
Collection.prototype.degreeCentralityNormalised =
  Collection.prototype.degreeCentralityNormalized;
Collection.prototype.cc = Collection.prototype.closenessCentrality;
Collection.prototype.ccn = Collection.prototype.closenessCentralityNormalized;
Collection.prototype.closenessCentralityNormalised =
  Collection.prototype.closenessCentralityNormalized;
Collection.prototype.bc = Collection.prototype.betweennessCentrality;
Collection.prototype.fcm = Collection.prototype.fuzzyCMeans;
Collection.prototype.hca = Collection.prototype.hierarchicalClustering;
Collection.prototype.mcl = Collection.prototype.markovClustering;
Collection.prototype.ap = Collection.prototype.affinityPropagation;
Collection.prototype.addListener = Collection.prototype.on;
Collection.prototype.removeListener = Collection.prototype.off;
Collection.prototype.trigger = Collection.prototype.emit;
Collection.prototype.once = Collection.prototype.one;
Collection.prototype.listen = Collection.prototype.on;
Collection.prototype.bind = Collection.prototype.on;
Collection.prototype.unlisten = Collection.prototype.off;
Collection.prototype.unbind = Collection.prototype.off;
Collection.prototype.pon = Collection.prototype.promiseOn;
Collection.prototype.attr = Collection.prototype.data;
Collection.prototype.removeAttr = Collection.prototype.removeData;
Collection.prototype.css = Collection.prototype.style;
Collection.prototype.renderedCss = Collection.prototype.renderedStyle;

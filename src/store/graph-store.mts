import { ColumnTable } from './table.mjs';
import { IdMap } from './id-map.mjs';
import { Adjacency } from './adjacency.mjs';
import { DataStore } from './data-store.mjs';
import { DirtyTracker } from './dirty.mjs';
import { CurveIndex } from './curve-index.mjs';
import type { CurveStyleExtras, EndpointSpec } from './curve-index.mjs';
import { HierarchyIndex } from './hierarchy.mjs';
import type { CompoundStyle } from './hierarchy.mjs';
import { CurveBlob } from './curve-blob.mjs';
import { emptyCurveEval, emptyCurveRoute } from '../curve-geometry.mjs';
import type { ArrowTrim, CurveEval, CurveRoute } from '../curve-geometry.mjs';
import {
  GROUP_EDGES,
  GROUP_NODES,
  COL,
  columnSpec,
  columnSpecsForGroup,
  FLAG_VISIBLE,
} from '../contract.mjs';
import type {
  LabelStream,
  ColumnArray,
  ColumnId,
  GroupName,
  LabelEntry,
  ModelView,
  Ref,
  StoreDelta,
} from '../contract.mjs';
import type {
  BoxSelectionMode,
  ColumnarEdges,
  ColumnarNodes,
} from '../public-types.mjs';
import { ImageRegistry } from '../image-registry.mjs';
import * as curvesImpl from './graph-store/curves.mjs';
import * as scanImpl from './graph-store/scan.mjs';
import * as compoundImpl from './graph-store/compound.mjs';
import * as compactionImpl from './graph-store/compaction.mjs';
import * as mutationImpl from './graph-store/mutation.mjs';
import * as layersImpl from './graph-store/layers.mjs';
import * as channelsImpl from './graph-store/channels.mjs';
import * as imagesImpl from './graph-store/images.mjs';
import * as labelsImpl from './graph-store/labels.mjs';
import * as positionsImpl from './graph-store/positions.mjs';
import * as flagsImpl from './graph-store/flags.mjs';
export const IMG_STRIDE = 12;

export interface BgLen {
  v: number;
  pct: boolean;
}
/** A background-width/-height value: mode 0 auto, 1 px, 2 percent. */
export interface BgSize {
  mode: number;
  v: number;
}

/** One styled background image, as the style engine hands it over. */
export interface NodeImageSpec {
  url: string;
  sdf: boolean;
  crossOrigin: string;
  fit: number;
  repeat: number;
  clip: number;
  containment: number;
  smoothing: boolean;
  opacity: number;
  posX: BgLen;
  posY: BgLen;
  offX: BgLen;
  offY: BgLen;
  w: BgSize;
  h: BgSize;
  tint: [number, number, number, number];
}

/** A stored image record decoded back out of the pool (readback). */
export interface NodeImageRecord extends Omit<
  NodeImageSpec,
  'url' | 'crossOrigin'
> {
  entryId: number;
  url: string;
}

export interface AddElementOpts {
  selected?: boolean;
  selectable?: boolean;
  visible?: boolean;
  grabbable?: boolean;
  locked?: boolean;
  /** defaults true for edges, false for nodes (as in v3) */
  pannable?: boolean;
}

/** Insertion-order slot list with tombstone skipping and lazy compaction. */
interface OrderList {
  slots: number[];
  gens: number[];
  stale: number;
}

const emptyOrder = (): OrderList => ({ slots: [], gens: [], stale: 0 });

/** A coalesced [start, end) span of data writes to one watched (group, key). */
export interface MapperSpan {
  group: GroupName;
  key: string;
  start: number;
  end: number;
}

/** One group's slot-moving compaction result (round 19.1). */
export interface GroupCompaction {
  /** old slot → new slot; NO_SLOT where the old slot was a hole */
  remap: Uint32Array;
  /** live elements whose slot actually changed */
  moved: number;
  oldHighWater: number;
}

/** Scratch for the single-slot state-change notification (one write per
 * flag flip; the callee never retains it). */
export const ONE_SLOT = [0];

/**
 * The CPU-canonical columnar model: NodeTable + EdgeTable + IdMap +
 * Adjacency, with per-column dirty spans for the renderer.  Synchronous API
 * reads always hit these typed-array columns; the store works headless (no
 * GPU, Node-testable).  The store itself never emits events — the core does.
 */
export class GraphStore implements ModelView {
  /** the node table: one typed-array column per `node.*` column id */
  readonly nodes: ColumnTable;
  /** the edge table: one typed-array column per `edge.*` column id */
  readonly edges: ColumnTable;
  /** id <-> (group, slot) index; owns id uniqueness across both groups */
  readonly ids: IdMap;
  /** the incident-edge index (CSR + overlay); rebuilt on waste */
  readonly adj: Adjacency;
  /** the sidecar `data()` store (typed columns + dictionaries) */
  readonly data: DataStore;
  /** per-column dirty spans, drained by takeDelta() once per frame */
  readonly dirty: DirtyTracker;
  /** styled curve records + the lazy derivation of edge.curveParams */
  readonly curves: CurveIndex;
  /** the compound hierarchy (round 14); reads go through the delegates below @internal */
  hierarchy: HierarchyIndex;
  /** per-parent stashed *style* size: the degenerate-children fallback,
   * restored to the column when the node becomes a leaf again (14.3)
   * @internal */
  parentFallback = new Map<number, [number, number]>();
  /** fires on the compounds 0 <-> >0 transitions (the core re-configures
   * paint eval: the opacity fold demotes the GPU mapper, round 14.4) */
  onCompoundsToggled: (() => void) | null = null;
  /** fires when a node flips leaf <-> parent (the core restyles the slot
   * against the right sheet group, round 14.6) */
  onParentFlip: ((slot: number) => void) | null = null;
  /** fires when a node's parent changes (structural case conditions on
   * the moved node re-evaluate, round 14.7) */
  onReparented: ((slot: number) => void) | null = null;

  // conservative monotone maxima behind curveSlack() (see that doc)
  /** @internal */
  curveDevMax = 0;
  /** @internal */
  nodeHalfMax = 0;
  /** @internal */
  borderMax = 0;
  /** monotone: some edge has carried a box-bounded curve kind (taxi /
   * extrapolated weights), so curveSlack() must stay engaged even when
   * curveDevMax is 0
   * @internal */
  hasBoxCurves = false;
  /** monotone: some edge has entered the curved *stream* — see
   * hasCurvedEdges(), which gates the renderer's curved pipelines
   * @internal */
  curvedEver = false;
  /** monotone (12c): the largest pct-endpoint magnitude in node-half
   * units — offsets past 1 exceed the slack's node-half term, so the
   * excess joins curveSlack() (see that doc)
   * @internal */
  endptPctMax = 0;
  /** monotone (12c): the largest haystack-radius any edge has styled —
   * haystack offsets stray from the endpoint centers by at most
   * radius × outerHalf, and the straight-stream cull tests grow by
   * haystackSlack() to stay sound
   * @internal */
  haystackRadiusMax = 0;

  /** the 12b variable-length curve param pool (see store/curve-blob.mts) @internal */
  blob: CurveBlob;
  /** the C3 custom-polygon unit-point pool @internal */
  polyPool!: CurveBlob;
  /** the 15.2 background-image record pool (IMG_STRIDE floats per image) @internal */
  imagePool!: CurveBlob;
  /** round 23: chart records (node.chartRef = offset | n << 24) @internal */
  chartPool!: CurveBlob;
  /** live charted nodes (the chart pass skips at 0) @internal */
  chartedNodes = 0;
  /** the unique-image registry (round 15.1); style writes acquire/release */
  readonly images = new ImageRegistry();

  // exact-curve-bb memo (see curveBBAt): any geometry write bumps the
  // epoch, invalidating every cached edge box at once — sound and cheap.
  // Label writes deliberately do not bump it (25.5): the memo has no
  // label terms, and a font-size tween would otherwise nuke it per tick.
  /** @internal */
  geoEpoch = 1;
  /** the geo epoch the taxi-track pass last ran at (round 124) @internal */
  taxiTrackEpoch = 0;
  /** @internal */
  edgeBBEpoch = new Uint32Array(0);
  /** @internal */
  edgeBB = new Float64Array(0);
  /** @internal */
  curveScratch = emptyCurveEval();
  /** @internal */
  routeScratch = emptyCurveRoute();

  /** @internal */
  order: { nodes: OrderList; edges: OrderList };
  /** @internal */
  labels: Record<LabelStream, (LabelEntry | undefined)[]>;
  /** @internal */
  labelDirty: Record<LabelStream, Set<number>>;
  /** laid (or estimated) label block dims per stream (round 16.2) @internal */
  labelDims: Record<
    LabelStream,
    Map<number, { w: number; h: number; exact: boolean }>
  > = {
    nodes: new Map(),
    edges: new Map(),
    edgeSource: new Map(),
    edgeTarget: new Map(),
  };
  /** global label font-family (one font per glyph atlas); style-owned */
  labelFont: string;
  /** global label font-style ('normal' / 'italic'); style-owned (13 D1) */
  labelFontStyle: string;
  /** global label font-weight ('normal', 'bold', a number); style-owned */
  labelFontWeight: string;
  /** data keys whose writes feed GPU-evaluated mappers (registered by the StyleEngine) @internal */
  watchedKeys: Record<GroupName, ReadonlySet<string>>;
  /** reserved state keys some `case` condition reads (registered by the StyleEngine) @internal */
  watchedStates: Record<GroupName, ReadonlySet<string>>;
  /**
   * Told when a styled state bit flips on live slots — the core wires
   * this to the StyleEngine's state refresh (round 57.1; the round-61
   * partition-record diff since).  Null until then, and consulted
   * before any per-slot bookkeeping, so a store with no style attached
   * does the flag write and nothing else.
   */
  onStateChange:
    | ((group: GroupName, key: string, slots: readonly number[]) => void)
    | null = null;
  /** coalesced watched-key write spans, keyed 'group:key' (consumed by the renderer) @internal */
  mapperSpans: Map<string, MapperSpan>;

  /** forwarding chains for refs staled by slot compaction (19.3):
   * packed (slot, gen) → packed (newSlot, newGen), per group
   * @internal */
  forwards: Record<GroupName, Map<number, number>> = {
    nodes: new Map(),
    edges: new Map(),
  };
  /** @internal */
  _compactEpoch = 0;
  // Round 34.2: bumped whenever an element enters or leaves the
  // insertion-order list — the one structure every add and every remove
  // passes through — so a cached whole-graph collection can tell
  // "unchanged" from "add one, remove one" (which a count cannot).
  /**
   * Monotonic counter of structural changes — every element added or
   * removed, and every slot compaction (round 34.2; a plain field since
   * round 62.5b, because the getter call showed on the memo-hit reads
   * that consult it).  Treat as read-only outside the store.
   */
  structureEpoch = 0;

  /** Told when structureEpoch moves (round 62.5b) — the core nulls its
   * whole-graph collection cache here, so the memo-hit read needs no
   * epoch compare at all. */
  onStructureChange: (() => void) | null = null;

  /** The one place structureEpoch moves: bump plus the push-invalidation
   * hook (round 62.5b).
   * @internal */
  bumpStructureEpoch(): void {
    this.structureEpoch++;
    this.onStructureChange?.();
  }

  /**
   * Build an empty store: both tables at zero capacity, empty id /
   * adjacency / data / hierarchy / curve indexes, and the sub-index
   * callbacks wired.  Those callbacks are the whole point of the
   * constructor — the blob pools' relocation hooks rewrite their
   * owning header columns, the dict-remap hook re-uploads a watched
   * data column, the CurveIndex reads endpoints/flags/hierarchy back
   * out of the store, and the HierarchyIndex writes derived parent
   * geometry back into the columns.  Takes no arguments: the store is
   * headless and grows on demand.
   */
  constructor() {
    this.nodes = new ColumnTable(GROUP_NODES, columnSpecsForGroup(GROUP_NODES));
    this.edges = new ColumnTable(GROUP_EDGES, columnSpecsForGroup(GROUP_EDGES));
    this.ids = new IdMap();
    this.adj = new Adjacency();
    this.data = new DataStore();
    this.dirty = new DirtyTracker();
    this.order = { nodes: emptyOrder(), edges: emptyOrder() };
    this.labels = { nodes: [], edges: [], edgeSource: [], edgeTarget: [] };
    this.labelDirty = {
      nodes: new Set(),
      edges: new Set(),
      edgeSource: new Set(),
      edgeTarget: new Set(),
    };
    this.labelFont = 'sans-serif';
    this.labelFontStyle = 'normal';
    this.labelFontWeight = 'normal';
    this.watchedKeys = { nodes: new Set(), edges: new Set() };
    this.mapperSpans = new Map();
    this.watchedStates = { nodes: new Set(), edges: new Set() };

    // a dict compaction remaps every slot's stored index for that key:
    // a watched key must re-upload its whole column (and, via the bumped
    // dict epoch, repack the GPU ordinal LUT); unwatched keys no-op
    this.data.onDictRemap = (group, key) => {
      this.markDataWrite(group, key, 0, this.table(group).highWater);
    };

    this.curves = new CurveIndex({
      endpoints: () => this.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array,
      aliveEdgeSlots: () => this.slotsOrdered(GROUP_EDGES),
      writeParams: (slot, p0, p1, p2, kind) =>
        this.setCurveParams(slot, p0, p1, p2, kind),
      writeBlobParams: (slot, kind, values, n, dev, box, endptPct) =>
        this.setCurveParamsBlob(slot, kind, values, n, dev, box, endptPct),
      idHash: (slot) => this.ids.hashAt(GROUP_EDGES, slot),
      schedule: () => this.dirty.touch(),
      // display tier (round 22.3): hidden members leave their bundles
      edgeShown: (slot) =>
        ((this.edges.column(COL.EDGE_FLAGS) as Uint32Array)[slot] &
          FLAG_VISIBLE) !==
        0,
      // compound relation (14.10): ancestor/descendant endpoints, or a
      // self-loop on a parent — such edges route around the outside
      relation: (a, b) =>
        a === b
          ? this.hierarchy.childrenOf(a).length > 0
          : this.hierarchy.isAncestorOf(a, b) ||
            this.hierarchy.isAncestorOf(b, a),
      outerHalfW: (slot) =>
        (this.nodes.column(COL.NODE_OUTER_HALF) as Float32Array)[slot * 2],
    });

    this.hierarchy = new HierarchyIndex({
      flags: () => this.nodes.column(COL.NODE_FLAGS) as Uint32Array,
      gen: () => this.nodes.gen,
      markFlag: (slot) => this.dirty.mark(COL.NODE_FLAGS, slot),
      schedule: () => this.dirty.touch(),
      positions: () => this.nodes.column(COL.NODE_POSITION) as Float32Array,
      outerHalf: () => this.nodes.column(COL.NODE_OUTER_HALF) as Float32Array,
      readSize: (slot) => {
        const stashed = this.parentFallback.get(slot);

        if (stashed != null) {
          return stashed;
        }

        const size = this.nodes.column(COL.NODE_SIZE) as Float32Array;

        return [size[slot * 2], size[slot * 2 + 1]];
      },
      onFlip: (slot, becameParent) => {
        if (becameParent) {
          // stash the style size: auto-bounds owns the column from here,
          // and the stash is both the degenerate fallback and what a
          // leaf-again node returns to
          const size = this.nodes.column(COL.NODE_SIZE) as Float32Array;

          this.parentFallback.set(slot, [size[slot * 2], size[slot * 2 + 1]]);
        } else {
          const stashed = this.parentFallback.get(slot);

          this.parentFallback.delete(slot);

          if (stashed != null) {
            this.setPair(COL.NODE_SIZE, slot, stashed[0], stashed[1]);
          }
        }

        // paint config depends on hasCompounds (the opacity-fold GPU
        // demotion, round 14.4): notify on the 0 <-> >0 transitions
        if (
          becameParent
            ? this.hierarchy.parentCount() === 1
            : this.hierarchy.parentCount() === 0
        ) {
          this.onCompoundsToggled?.();
        }

        // a flipped node restyles against the right sheet group (14.6)
        this.onParentFlip?.(slot);

        // its self-loops flip between plain and compound routing (14.10)
        const endpoints = this.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;

        for (const edgeSlot of this.adj.connectedEdges(slot)) {
          if (endpoints[edgeSlot * 2] === endpoints[edgeSlot * 2 + 1]) {
            this.curves.invalidateRelation(slot, slot);
          }
        }
      },
      materialize: (slot, x, y, w, h) =>
        this.materializeParentGeom(slot, x, y, w, h),
    });

    // a blob compaction moves records: rewrite the header offset (a
    // normal column write, so the renderer re-uploads it as a span).
    // Geometry is unchanged, so the bb memo epoch is left alone.
    this.blob = new CurveBlob((slot, offset) => {
      const params = this.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;

      params[slot * 4] = offset;
      this.dirty.mark(COL.EDGE_CURVE_PARAMS, slot);
    });

    // C3: the custom-polygon point pool (same slot-stable policy); a
    // relocation rewrites the borderGeom[0] ref in place
    this.polyPool = new CurveBlob((slot, offset) => {
      const geom = this.nodes.column(COL.NODE_BORDER_GEOM) as Uint32Array;
      const count = geom[slot * 4] >>> 24;

      geom[slot * 4] = (offset | (count << 24)) >>> 0;
      this.dirty.mark(COL.NODE_BORDER_GEOM, slot);
    });

    // 15.2: the image-record pool; a relocation rewrites node.imageRef
    this.imagePool = new CurveBlob((slot, offset) => {
      const refs = this.nodes.column(COL.NODE_IMAGE_REF) as Uint32Array;
      const count = refs[slot] >>> 24;

      refs[slot] = (offset | (count << 24)) >>> 0;
      this.dirty.mark(COL.NODE_IMAGE_REF, slot);
    });

    // round 23: the chart-record pool; a relocation rewrites node.chartRef
    this.chartPool = new CurveBlob((slot, offset) => {
      const refs = this.nodes.column(COL.NODE_CHART_REF) as Uint32Array;
      const n = refs[slot] >>> 24;

      refs[slot] = (offset | (n << 24)) >>> 0;
      this.dirty.mark(COL.NODE_CHART_REF, slot);
    });

    // an image decode landing (or an entry freeing) redraws the scene;
    // no column changes, so the pick-tile cache stays valid
    this.images.onChange = () => this.dirty.touch();
  }

  /**
   * The ColumnTable for a group — the group-generic dispatch every
   * other method routes through, so callers never branch on 'nodes' /
   * 'edges' themselves.
   *
   * @param group — 'nodes' or 'edges'
   * @returns the live table (not a copy; its columns are reallocated on
   * growth, so never cache the arrays across a mutation)
   */
  table(group: GroupName): ColumnTable {
    return group === GROUP_NODES ? this.nodes : this.edges;
  }

  // -- ModelView (the renderer's read surface) --

  /**
   * The group's allocated slot capacity — the length the renderer sizes
   * its GPU buffers to.  Always >= highWater(); grows by doubling and
   * shrinks only in a compaction.
   */
  capacity(group: GroupName): number {
    return this.table(group).cap;
  }

  /**
   * One past the highest slot ever allocated in the group — the only
   * range the renderer must upload or scan.  Holes below it are
   * tombstones (flags 0, no FLAG_ALIVE), which collapse to degenerate
   * quads rather than being skipped.
   */
  highWater(group: GroupName): number {
    return this.table(group).highWater;
  }

  /**
   * The live typed array backing a column, addressed by column id (the
   * group is looked up from the contract's spec).  The array is the
   * store's own storage — writing through it bypasses the dirty
   * tracker, so readers must not mutate it.
   */
  column(id: ColumnId): ColumnArray {
    return this.table(columnSpec(id).group).column(id);
  }

  /** The node position column through the hot cache (round 62.4/5). */
  nodePositions(): Float32Array {
    if (this.hotNodeV !== this.nodes.arraysVersion) {
      this.hotNodeFlags(); // one sync path for the node pair
    }

    return this.hotNPos;
  }

  /** The edge endpoints column through the hot cache (round 62.4/5). */
  edgeEndpoints(): Uint32Array {
    if (this.hotEdgeV !== this.edges.arraysVersion) {
      this.hotEdgeFlags(); // one sync path for the edge pair
    }

    return this.hotEEnds;
  }

  /** Whether any column write or touch() is pending a frame. */
  hasDirty(): boolean {
    return this.dirty.hasDirty();
  }

  /**
   * Drain the frame's pending writes: flushes the lazy derivations
   * first (so parent auto-bounds and curve params land as ordinary
   * column spans inside this delta), then takes the column spans and
   * each blob pool's dirty range.  Destructive — the trackers are
   * cleared, so exactly one consumer (the renderer) may call it.
   *
   * @returns the delta, with the four blob ranges attached only when
   * that pool actually changed
   */
  takeDelta(): StoreDelta {
    return imagesImpl.takeDelta(this);
  }

  /** The 12b curve param pool's backing array (the renderer's upload
   * source); reallocated on growth, so re-read it every frame. */
  curveBlob(): Float32Array {
    return this.blob.data();
  }

  /** Floats in use in the curve pool — the upload length (data() may be
   * longer: the pool over-allocates). */
  curveBlobLength(): number {
    return this.blob.length();
  }

  /** The C3 custom-polygon unit-point pool's backing array. */
  polyBlob(): Float32Array {
    return this.polyPool.data();
  }

  /** Floats in use in the polygon pool — the upload length. */
  polyBlobLength(): number {
    return this.polyPool.length();
  }

  /**
   * Store a node's custom polygon points (round 13 C3): flat unit
   * [x, y, ...] pairs, or null to clear.  Returns the packed record
   * ref (offset | pointCount << 24) for borderGeom[0].
   */
  setPolygonPoints(slot: number, points: number[] | null): number {
    return imagesImpl.setPolygonPoints(this, slot, points);
  }

  /** The 15.2 background-image record pool's backing array. */
  imageBlob(): Float32Array {
    return this.imagePool.data();
  }

  /** Floats in use in the image pool — the upload length. */
  imageBlobLength(): number {
    return this.imagePool.length();
  }

  /** The round-23 chart record pool's backing array. */
  chartBlob(): Float32Array {
    return this.chartPool.data();
  }

  /** Floats in use in the chart pool — the upload length. */
  chartBlobLength(): number {
    return this.chartPool.length();
  }

  /** Live charted nodes (round 23) — the renderer's pass-skip gate. */
  chartCount(): number {
    return this.chartedNodes;
  }

  /** live imaged-node count (the renderer's zero-cost gate, 15.3) @internal */
  imagedNodes = 0;

  /** Live nodes carrying background images (15.3) — the renderer's
   * pass-skip gate, so an imageless graph pays nothing. */
  imageCount(): number {
    return this.imagedNodes;
  }

  /**
   * Store a node's background-image records (round 15.2), or null to
   * clear.  Acquires the new urls' registry entries *before* releasing
   * the old ones, so a shared url surviving a restyle never transits
   * refcount 0.  Encoding per image (IMG_STRIDE floats): [entryId,
   * modeFlags (fit | repeat<<2 | clip<<4 | containment<<5 |
   * smoothing<<6 | sdf<<7), opacity, posX, posY, offX, offY, w, h,
   * unitFlags (posXPct | posYPct<<1 | offXPct<<2 | offYPct<<3 |
   * wMode<<4 | hMode<<6), tintRG (r + g×256), tintBA (b + a×256)].
   * Draw-only paint: no geoEpoch bump, no bb/pick involvement.
   *
   * @param slot — the node slot
   * @param specs — the styled images in paint order, or null/empty to
   * clear (clearing an already-imageless node is a no-op fast path)
   */
  setNodeImages(slot: number, specs: NodeImageSpec[] | null): void {
    imagesImpl.setNodeImages(this, slot, specs);
  }

  /**
   * Write (or clear) a node's chart record (round 23).  The blob layout
   * is CHART_HEADER floats — kind, size, hole, startAngle, direction,
   * n — then n × (value, r+g·256, b+a·256): colors split across two
   * small-integer floats (the image-record trick — packed u32 color
   * bits would risk NaN canonicalization through the f32 pool).
   * Colors arrive alpha-folded (chart-opacity, the B1 pattern).
   */
  setChart(
    slot: number,
    rec: {
      kind: number;
      size: number;
      hole: number;
      startAngle: number;
      direction: number;
      opacity: number;
      values: number[];
      colors: [number, number, number, number][];
    } | null,
  ): void {
    imagesImpl.setChart(this, slot, rec);
  }

  /** A node's decoded chart record, or null when chartless (round 23). */
  chartAt(slot: number): {
    kind: number;
    size: number;
    hole: number;
    startAngle: number;
    direction: number;
    opacity: number;
    values: number[];
    colors: [number, number, number, number][];
  } | null {
    return imagesImpl.chartAt(this, slot);
  }

  /** A node's decoded background-image records, or null when imageless. */
  nodeImagesAt(slot: number): NodeImageRecord[] | null {
    return imagesImpl.nodeImagesAt(this, slot);
  }

  /** A node's custom polygon points (unit pairs), or null. */
  polygonPointsAt(slot: number): Float64Array | null {
    return imagesImpl.polygonPointsAt(this, slot);
  }

  /**
   * Subscribe to "the model changed, a frame is needed".  Fires on the
   * clean -> dirty transition only (not per write), so it is safe to
   * hook a requestAnimationFrame schedule to it.
   *
   * @param cb — called when the store goes dirty
   * @returns an unsubscribe function
   */
  onInvalidate(cb: () => void): () => void {
    return this.dirty.onInvalidate(cb);
  }

  // -- mapper data-write spans (the GPU eval pass's dirty channel) --

  /**
   * Register the data keys whose writes feed GPU-evaluated mappers.
   * Replaces the group's whole set (the StyleEngine re-derives it per
   * sheet).  Writes to unwatched keys cost one Set lookup and nothing
   * else.
   */
  watchDataKeys(group: GroupName, keys: Iterable<string>): void {
    this.watchedKeys[group] = new Set(keys);
  }

  /**
   * Register the reserved state keys (`'::selected'`, `'::active'`, …)
   * the current sheet's `case` conditions read.  Flag writes outside
   * this set skip the change notification entirely, which is what makes
   * an unstyled state cost one mask test per flip.
   *
   * Separate from `watchDataKeys` because the two sets answer different
   * questions: that one is "which data writes feed the GPU eval kernel"
   * and excludes conditionals on principle, while a state condition is
   * always a conditional and may sit on any property.
   *
   * @param group — the element group the keys belong to
   * @param keys — the reserved keys; replaces the previous set
   */
  watchStateKeys(group: GroupName, keys: Iterable<string>): void {
    this.watchedStates[group] = new Set(keys);
  }

  /** Data write through the mapper-span choke point (the collection's data setter). */
  setData(group: GroupName, slot: number, key: string, value: unknown): void {
    this.data.set(group, slot, key, value);
    this.markDataWrite(group, key, slot, slot + 1);
  }

  /**
   * Coalesce a watched-key write span.  Schedules a frame via touch() —
   * deliberately not a column span, so paint-only data writes leave the
   * pick-tile cache valid.
   */
  markDataWrite(
    group: GroupName,
    key: string,
    start: number,
    end: number,
  ): void {
    mutationImpl.markDataWrite(this, group, key, start, end);
  }

  /** Pending watched-key write spans, returned and cleared. */
  takeMapperSpans(): MapperSpan[] {
    if (this.mapperSpans.size === 0) {
      return [];
    }

    const spans = [...this.mapperSpans.values()];

    this.mapperSpans.clear();

    return spans;
  }

  // -- refs --

  /**
   * Mint a ref for a slot: the (group, slot, gen) triple collections
   * hold instead of element objects.  The generation stamp is what
   * makes a recycled slot detectable — see isCurrent().  Cheap (one
   * object); no validity check, so minting a ref for a dead slot yields
   * a ref that immediately reads as stale.
   */
  ref(group: GroupName, slot: number): Ref {
    return { group, slot, gen: this.table(group).gen[slot] };
  }

  /**
   * Whether a ref still points at the live element it was created for.
   * Since round 19.3 a stale ref whose element merely *moved* in a slot
   * compaction is repaired **in place** through the forwarding chain
   * (fixing every holder of that ref object) and reads as current;
   * a removed element's ref stays dead — repair never resurrects.
   */
  isCurrent(ref: Ref): boolean {
    const table = this.table(ref.group);

    if (ref.slot < table.cap && table.gen[ref.slot] === ref.gen) {
      return true;
    }

    return this.repairStale(ref);
  }

  /** Bumped once per slot-moving compaction; collections use it to
   * invalidate cached packed-key membership sets (19.3). */
  get compactEpoch(): number {
    return this._compactEpoch;
  }

  /**
   * Chase a stale ref through the forwarding chain (each compaction a
   * moved element survives adds one link) and, on reaching a live
   * identity, rewrite the ref in place.  Entries persist and compose, so
   * repair is total for any ref whose element still exists.
   * @internal
   */
  repairStale(ref: Ref): boolean {
    return compactionImpl.repairStale(this, ref);
  }

  /**
   * Resolve an element id to a fresh ref (backs cy.getElementById).
   * Ids are unique across both groups, so no group argument is needed.
   *
   * @returns undefined when no live element carries the id
   */
  lookup(id: string): Ref | undefined {
    const entry = this.ids.get(id);

    return entry == null ? undefined : this.ref(entry.group, entry.slot);
  }

  /**
   * The allocation-free twin of `lookup()` (round 62.3): the id's packed
   * `(slot << 1) | groupBit` code, or −1.  For callers that only need to
   * reach the interned handle — `getElementById` — the two objects
   * `lookup()` allocates per call are pure cost.
   *
   * @param id — the element id
   * @returns the packed code (group bit 1 = edges), or −1 when absent
   */
  lookupCode(id: string): number {
    return this.ids.code(id);
  }

  /**
   * The id occupying a slot, or undefined when the slot is a hole.
   * The reverse of lookup(); ids are stored out of line, so this is the
   * only string the columnar hot paths ever touch.
   */
  idAt(group: GroupName, slot: number): string | undefined {
    return this.ids.idAt(group, slot);
  }

  // -- mutation --

  /**
   * Preallocate ahead of a bulk add: grows each table at most once for the
   * incoming element counts (net of reusable free slots), so the adds
   * themselves never hit the doubling cascade.
   */
  reserve(nodeCount: number, edgeCount: number): void {
    mutationImpl.reserve(this, nodeCount, edgeCount);
  }

  /**
   * Add one node at a model position, reusing a free slot when there is
   * one.  Only position and flags are written — every style column keeps
   * its zero default until the StyleEngine writes it.
   *
   * @param id — must be unused across both groups
   * @param opts — initial state bits; unset ones take v3's defaults
   * (visible, selectable, grabbable, unselected, unlocked, not pannable)
   * @returns the allocated slot
   * @throws when the id already exists
   */
  addNode(id: string, x: number, y: number, opts: AddElementOpts = {}): number {
    return mutationImpl.addNode(this, id, x, y, opts);
  }

  /**
   * Add one edge between two existing nodes, given by *id* (the def
   * path; the columnar path takes payload indices instead).  Registers
   * the edge with the adjacency index and the CurveIndex — the latter
   * makes it a member of its endpoint pair's bundle, so its siblings
   * re-fan lazily.
   *
   * @param opts — as addNode, except `pannable` defaults true (v3)
   * @returns the allocated slot
   * @throws when the id already exists, or either endpoint id is not a
   * live node
   */
  addEdge(
    id: string,
    sourceId: string,
    targetId: string,
    opts: AddElementOpts = {},
  ): number {
    return mutationImpl.addEdge(this, id, sourceId, targetId, opts);
  }

  /**
   * Columnar bulk node add: typed-array columns write straight into the
   * store (one memcpy for the contiguous fresh run), with no per-element
   * def objects.  Returns the allocated slots, index-aligned with the
   * payload arrays.  On error the graph may be partially mutated (as with
   * a mid-list throw in the def path).
   */
  addNodesColumnar(cols: ColumnarNodes, newId: () => string): Uint32Array {
    return mutationImpl.addNodesColumnar(this, cols, newId);
  }

  /**
   * Columnar bulk edge add: endpoints are indices into `nodeSlots` (the
   * same payload's nodes) — no id lookups per edge.
   */
  addEdgesColumnar(
    cols: ColumnarEdges,
    nodeSlots: Uint32Array,
    newId: () => string,
  ): Uint32Array {
    return mutationImpl.addEdgesColumnar(this, cols, nodeSlots, newId);
  }

  /**
   * Remove one edge: unlinks it from the adjacency index and its curve
   * bundle (siblings re-fan), then tombstones the slot for reuse.  The
   * slot's generation bumps, so every outstanding ref to it goes stale
   * — and stays stale, since ref repair never resurrects a removal.
   */
  removeEdge(slot: number): void {
    mutationImpl.removeEdge(this, slot);
  }

  /** Re-point an existing edge at new endpoint node slots (updates adjacency in place). */
  moveEdge(slot: number, source: number, target: number): void {
    mutationImpl.moveEdge(this, slot, source, target);
  }

  /** The node must have no incident edges or children left; the caller cascades removal of them first. */
  removeNode(slot: number): void {
    mutationImpl.removeNode(this, slot);
  }

  // -- compound hierarchy (round 14) --

  /**
   * Bring every lazily-derived structure up to date: stale parent
   * auto-bounds first (materialized into node.size/node.position), then
   * pending curve derivations — curve geometry reads the sizes and
   * positions the hierarchy flush writes.  Cheap when nothing is
   * pending; called from takeDelta, the bb/refsInBox scans, and the
   * geometry accessors.
   */
  flushDerived(): void {
    this.hierarchy.flush();
    this.curves.flush();
    this.refreshTaxiTracks();
  }

  /**
   * The taxi-track pass (round 124): assign every `taxi-turn: auto`
   * edge its px turn from live positions, into the params header's n
   * lane, which both `evalTaxi` and the WGSL twin read for a taxi
   * record whose turn mode is 2.  Lazy off the geo epoch — a drag fires
   * many pointermoves per frame and a layout writes positions in
   * several passes, so the sweep runs once per epoch, at frame start
   * (`takeDelta`) and on the CPU readers (`flushDerived`), and is a
   * single size check when no edge is `auto`.  It writes a column,
   * never the blob, and never bumps the epoch it is keyed on.
   * @internal
   */
  refreshTaxiTracks(): void {
    compoundImpl.refreshTaxiTracks(this);
  }

  /**
   * Open a bulk-load window on the derived indexes (round 67): the curve
   * index stops accumulating one pair mark per edge and takes their
   * union at `endBulkLoad`, which on a whole-graph load is the whole
   * pair map.  Must be paired in a `finally` — see `CurveIndex.beginBulk`
   * for what may not happen inside the window.
   */
  beginBulkLoad(): void {
    this.curves.beginBulk();
  }

  /** Close a bulk-load window and mark the derivations it implies. */
  endBulkLoad(): void {
    this.curves.endBulk();
  }

  /**
   * Copy every style-owned edge column from the run's first slot across
   * the rest of it (round 67.2), and mark each column's span once.
   *
   * The run must be contiguous and ascending — the caller checks, and a
   * bulk load's slots are exactly that.  Filling proceeds by doubling
   * (`copyWithin` over an ever-larger prefix), so a 464,657-slot run is
   * ~19 MB of `memmove` rather than 464,657 × 17 setter calls: measured
   * 0.1 ns per element against 26 ns for one `setScalar`, whose cost is
   * mostly the two string-keyed lookups behind `column( id )`.
   *
   * Safety rests entirely on {@link EDGE_PER_ELEMENT_COLUMNS} being the
   * complete list of edge columns a shared styled record does *not*
   * determine; a spec pins the two lists against `COLUMN_SPECS`.
   *
   * @param start — the run's first slot, which is also the template
   * @param count — how many slots the run covers, template included
   */
  replicateEdgeStyle(start: number, count: number): void {
    compoundImpl.replicateEdgeStyle(this, start, count);
  }

  /**
   * The hierarchy flush's write sink: derived parent geometry lands in
   * the real columns (position, size, outerHalf) with normal dirty
   * spans — but never re-marks the hierarchy, so a flush can not
   * re-trigger itself.  A size change re-anchors the parent's label
   * (the sidecar entry bakes anchors from the node extents) and feeds
   * the monotone cull-slack meter.
   * @internal
   */
  materializeParentGeom(
    slot: number,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    compoundImpl.materializeParentGeom(this, slot, x, y, w, h);
  }

  /** Mark a node's ancestor chain (and its own derived bounds when it is
   * a parent) stale; flushed lazily by flushDerived(). */
  markNodeGeo(slot: number): void {
    this.hierarchy.markGeo(slot);
  }

  /** Store a parent's compound style inputs (padding / min size); the
   * StyleEngine's write path in 14.6, and testable directly. */
  setCompoundStyle(slot: number, style: Partial<CompoundStyle>): void {
    this.hierarchy.setCompoundStyle(slot, style);
  }

  /** Partial compound-style update over the current record — the
   * padding tween's write (round 25.4; see HierarchyIndex). */
  updateCompoundStyle(slot: number, style: Partial<CompoundStyle>): void {
    this.hierarchy.updateCompoundStyle(slot, style);
  }

  /** The parent's resolved px padding (0 for leaves); flush first.
   * Always the uniform prop's value, per-side overrides or not (85.4). */
  paddingOf(slot: number): number {
    this.flushDerived();

    return this.hierarchy.paddingOf(slot);
  }

  /** The parent's per-axis padding sums [left+right, top+bottom]
   * (85.4) — what core-size readbacks subtract; flush first. */
  paddingSumsOf(slot: number): [number, number] {
    this.flushDerived();

    return this.hierarchy.paddingSumsOf(slot);
  }

  /** The declared compound style record (the style readbacks' truth). */
  compoundStyleOf(slot: number): CompoundStyle {
    return this.hierarchy.compoundStyleOf(slot);
  }

  /**
   * Link a node under a parent node slot (-1 to orphan).  Cycle-safe:
   * a link that would make the node its own ancestor warns and no-ops
   * (v3's dropped-ref rule).  Maintains FLAG_PARENT/FLAG_CHILD, depths
   * and the parent draw permutation.
   */
  setParent(slot: number, parentSlot: number): void {
    compoundImpl.setParent(this, slot, parentSlot);
  }

  /**
   * show()/hide() (round 14.4): FLAG_SELF_HIDDEN records the element's
   * own state; the effective FLAG_VISIBLE recomputes over affected node
   * subtrees (pruned — an unchanged effective bit means an unchanged
   * subtree).  Hidden children leave their ancestors' auto-bounds.
   * Returns the refs-array indices whose own state changed.
   */
  setVisibility(
    refs: readonly Ref[],
    visible: boolean,
    changedIdx: number[] | null = null,
  ): number {
    return compoundImpl.setVisibility(this, refs, visible, changedIdx);
  }

  /**
   * The `visibility` style prop (round 22): paint-only invisibility.
   * Sets the element's own FLAG_SELF_INVISIBLE and re-derives FLAG_DRAWN
   * (over the subtree for nodes — descendants of an invisible parent are
   * invisible, v3's rule).  Deliberately touches nothing else: space
   * consumers (bb, auto-bounds) and the curve bundles read FLAG_VISIBLE,
   * so an invisible element keeps its space and its bundle rank.
   */
  setInvisibility(group: GroupName, slot: number, invisible: boolean): void {
    compoundImpl.setInvisibility(this, group, slot, invisible);
  }

  /** Whether the element renders (round 22): the derived FLAG_DRAWN, with
   * edges additionally folding their endpoints (v3's visible() rule). */
  isDrawn(ref: Ref): boolean {
    return compoundImpl.isDrawn(this, ref);
  }

  // -- effective opacity (round 14.4) --

  /** Bases of nodes whose stored opacity carries an ancestor fold
   * (absent = the column holds the base).
   * @internal */
  opacityBase = new Map<number, number>();

  /** The node's declared (pre-fold) opacity — what style('opacity') reads. */
  baseOpacityOf(slot: number): number {
    return (
      this.opacityBase.get(slot) ??
      (this.nodes.column(COL.NODE_OPACITY) as Float32Array)[slot]
    );
  }

  /** The node's parent slot, or -1 for orphans. */
  parentOf(slot: number): number {
    return this.hierarchy.parentOf(slot);
  }

  /** The node's child slots in link order (read-only; empty for leaves). */
  childrenOf(slot: number): readonly number[] {
    return this.hierarchy.childrenOf(slot);
  }

  /** Nesting depth (0 = top-level). */
  depthOf(slot: number): number {
    return this.hierarchy.depthOf(slot);
  }

  /** True when `ancestor` is on `slot`'s parent chain (not reflexive). */
  isAncestorOf(ancestor: number, slot: number): boolean {
    return this.hierarchy.isAncestorOf(ancestor, slot);
  }

  /** Count of live parent nodes. */
  parentCount(): number {
    return this.hierarchy.parentCount();
  }

  /** Whether any compound parent exists (backs cy.hasCompoundNodes()). */
  hasCompounds(): boolean {
    return this.hierarchy.hasCompounds();
  }

  /** The parent draw permutation: live parents sorted (depth asc, slot asc). */
  parentOrder(): Uint32Array {
    return this.hierarchy.parentOrder();
  }

  // -- positions --

  /** A node's model x.  Raw column read: a parent's derived position may
   * be stale, so call flushDerived() first when that matters. */
  getX(slot: number): number {
    return (this.nodes.column(COL.NODE_POSITION) as Float32Array)[slot * 2];
  }

  /** A node's model y (raw column read; see getX on staleness). */
  getY(slot: number): number {
    return (this.nodes.column(COL.NODE_POSITION) as Float32Array)[slot * 2 + 1];
  }

  /**
   * Move one node.  Under compounds this carries v3's beforePositionSet
   * semantics: moving a parent translates its whole subtree by the
   * delta (so the parent's own auto-derived position then equals the
   * written one exactly), and moving a child marks its ancestor chain's
   * bounds stale.  Bumps the geometry epoch, invalidating the exact
   * curve-bb memo.
   */
  setPosition(slot: number, x: number, y: number): void {
    positionsImpl.setPosition(this, slot, x, y);
  }

  /** Bulk position write (e.g. from a layout): one coalesced dirty span.
   * With compounds, each slot takes the sequential setPosition semantics
   * (a parent's write shifts its subtree first — v3's per-element order). */
  setPositions(slots: number[], xy: number[] | Float32Array): void {
    positionsImpl.setPositions(this, slots, xy);
  }

  /**
   * Bulk constant/axis position write over node slots: sets x and/or y
   * (null leaves that axis unchanged) with one coalesced dirty span.
   */
  setPositionsConst(
    slots: ArrayLike<number>,
    x: number | null,
    y: number | null,
  ): void {
    positionsImpl.setPositionsConst(this, slots, x, y);
  }

  /** Bulk position offset over node slots: one coalesced dirty span.
   * With compounds, v3's shift dedupe applies: a slot whose ancestor is
   * also in the set is skipped (the ancestor's subtree shift moves it). */
  shiftPositions(slots: ArrayLike<number>, dx: number, dy: number): void {
    positionsImpl.shiftPositions(this, slots, dx, dy);
  }

  // -- flags --

  /** The whole flags word for a slot (see the FLAG_* bits in
   * contract.mts); 0 for a tombstoned slot. */
  flags(group: GroupName, slot: number): number {
    return group === GROUP_NODES
      ? this.hotNodeFlags()[slot]
      : this.hotEdgeFlags()[slot];
  }

  // -- the hot column caches (round 62.5) --
  //
  // An accessor like isParent()/selected()/position() pays the column
  // spec walk (two Map hops) on every call where v3 reads a bare field.
  // A column array's identity changes only when its table grows or
  // compacts, so the four hottest arrays cache against the table's
  // arraysVersion — bumped in the same call that swaps the arrays,
  // which is what makes this timing-safe where an epoch key is not.

  private hotNodeV = -1;
  private hotEdgeV = -1;
  private hotNFlags!: Uint32Array;
  private hotNPos!: Float32Array;
  private hotEFlags!: Uint32Array;
  private hotEEnds!: Uint32Array;

  /** The node flags column through the hot cache (round 62.5). */
  hotNodeFlags(): Uint32Array {
    if (this.hotNodeV !== this.nodes.arraysVersion) {
      this.hotNodeV = this.nodes.arraysVersion;
      this.hotNFlags = this.nodes.column(COL.NODE_FLAGS) as Uint32Array;
      this.hotNPos = this.nodes.column(COL.NODE_POSITION) as Float32Array;
    }

    return this.hotNFlags;
  }

  /** The edge flags column through the hot cache (round 62.5). */
  hotEdgeFlags(): Uint32Array {
    if (this.hotEdgeV !== this.edges.arraysVersion) {
      this.hotEdgeV = this.edges.arraysVersion;
      this.hotEFlags = this.edges.column(COL.EDGE_FLAGS) as Uint32Array;
      this.hotEEnds = this.edges.column(COL.EDGE_ENDPOINTS) as Uint32Array;
    }

    return this.hotEFlags;
  }

  /** Whether every bit of `bit` is set — the single-bit tests read as
   * a predicate, not a mask compare. */
  hasFlag(group: GroupName, slot: number, bit: number): boolean {
    return (this.flags(group, slot) & bit) !== 0;
  }

  /**
   * Set or clear flag bits on one slot, marking the flags column dirty
   * only when the word actually changes.  Raw: derived bits (VISIBLE,
   * DRAWN, PARENT, CHILD, CURVED) have owners that recompute them —
   * write those through setVisibility / setInvisibility / setParent /
   * the curve writers rather than here.
   */
  setFlag(group: GroupName, slot: number, bit: number, on: boolean): void {
    flagsImpl.setFlag(this, group, slot, bit, on);
  }

  /**
   * Bulk flag write over a refs array (a collection's _refs): sets or
   * clears `bit` on every live ref, with the flags/gen columns hoisted out
   * of the loop and one coalesced dirty span per touched group.  Refs
   * lacking `requireBit` (when non-zero) are skipped, as are refs already
   * in the target state.  When `changedIdx` is given, the refs-array index
   * of each changed ref is appended (for per-element restyle/emit).
   * Returns the changed count.
   */
  flagRefs(
    refs: readonly Ref[],
    bit: number,
    on: boolean,
    requireBit = 0,
    changedIdx: number[] | null = null,
  ): number {
    return flagsImpl.flagRefs(this, refs, bit, on, requireBit, changedIdx);
  }

  // -- style channel writers --

  /**
   * Write a single-component numeric column (the StyleEngine's scalar
   * channel).  No-ops when the value is unchanged, so an idempotent
   * restyle costs no upload.  Two columns carry a cascade: `node.opacity`
   * under compounds is a *base* (the column stores the ancestor-folded
   * product, and a parent's write refolds its subtree — round 14.4), and
   * `node.borderWidth` refreshes the derived outerHalf column, feeds the
   * monotone cull slack, and marks the ancestors' auto-bounds stale.
   * Bumps the geometry epoch: scalar channels can move geometry.
   */
  setScalar(id: ColumnId, slot: number, value: number): void {
    channelsImpl.setScalar(this, id, slot, value);
  }

  /**
   * Write a two-component numeric column (sizes, positions-like pairs).
   * No-ops on an unchanged pair.  `node.size` runs the size cascade:
   * the monotone node-half meter, the parent style-size stash (a parent's
   * column is owned by auto-bounds, so the declared size lives in the
   * stash — tracked before the no-op check so it can never go stale),
   * the derived outerHalf write, the label re-anchor (25.1) and the
   * ancestors' auto-bounds staleness.
   */
  setPair(id: ColumnId, slot: number, a: number, b: number): void {
    channelsImpl.setPair(this, id, slot, a, b);
  }

  /**
   * Write one component of a multi-lane column (round 25): the tween
   * executor's entry for lane writes.  `node.size` routes through
   * `setPair`, which runs the size cascade (outerHalf, label re-anchor,
   * compound auto-bounds staleness); other float columns write the lane
   * raw with a dirty mark.
   */
  setLane(id: ColumnId, slot: number, lane: number, value: number): void {
    channelsImpl.setLane(this, id, slot, lane, value);
  }

  /** `Uint32Array` alias of `edge.width`'s buffer, for the exact bit
   * copy below.  Re-derived when growth or compaction swaps the array.
   * @internal */
  widthBitsView: Uint32Array | null = null;

  /**
   * Write the packed arrow-shapes word, mirroring it bit-for-bit into
   * lane 1 of `edge.width` (round 56).
   *
   * The mirror exists because all four edge vertex stages already bind
   * `edge.width` and none has a spare storage-buffer slot, so this is how
   * the shape word — and with it v3's per-shape `gap` and `spacing` —
   * reaches the vertex stage that has to shorten the line.
   *
   * The copy goes through a `Uint32Array` view of the column's own
   * buffer rather than a bitcast via a JS number: an `arrow-scale` of
   * 7.94 or more sets bits 30..24, and with a mid-target shape ≥ 4
   * setting bit 23 the word *is* an f32 NaN pattern, whose payload a
   * round trip through a JS double would not preserve.
   *
   * @param slot — the edge slot
   * @param word — the packed word (see `edge.arrowShapes` in the contract)
   */
  setArrowShapes(slot: number, word: number): void {
    channelsImpl.setArrowShapes(this, slot, word);
  }

  // -- ghosts (round 13 A1) --

  /** live count of ghost-enabled nodes (the renderer skips the ghost
   * cull + draw entirely while this is 0)
   * @internal */
  ghosts = 0;

  /** Live ghost-enabled nodes (13 A1) — the renderer's pass-skip gate;
   * the bb scan also uses it to skip the ghost term. */
  ghostCount(): number {
    return this.ghosts;
  }

  /**
   * Write a node's ghost record [offsetX, offsetY, ghostOpacity,
   * enabled] (the StyleEngine's write path).  Offsets are geometry —
   * they grow the bb scans — so writes bump the geometry epoch.
   */
  setGhost(
    slot: number,
    offX: number,
    offY: number,
    opacity: number,
    enabled: boolean,
  ): void {
    layersImpl.setGhost(this, slot, offX, offY, opacity, enabled);
  }

  // -- overlay / underlay (round 13 A2) --

  /** live counts of nodes with a visible overlay / underlay (13 A2) @internal */
  overlays = 0;
  /** @internal */
  underlays = 0;

  /** Nodes with a visible overlay (13 A2) — the pass-skip gate. */
  overlayCount(): number {
    return this.overlays;
  }
  /** Nodes with a visible underlay (13 A2) — the pass-skip gate. */
  underlayCount(): number {
    return this.underlays;
  }

  /**
   * Write a node's overlay or underlay record (the StyleEngine's write
   * path): [rgba (opacity folded), padding×256, shape, radius×256 |
   * 0xffffffff = auto].  Padding is geometry (it grows the bb scans),
   * so writes bump the geometry epoch.
   */
  setNodeLayer(
    id: typeof COL.NODE_OVERLAY | typeof COL.NODE_UNDERLAY,
    slot: number,
    rgba: number,
    padding: number,
    shape: number,
    radius: number,
  ): void {
    layersImpl.setNodeLayer(this, id, slot, rgba, padding, shape, radius);
  }

  /** live counts of edges with a visible overlay / underlay / casing @internal */
  edgeOverlays = 0;
  /** @internal */
  edgeUnderlays = 0;
  /** @internal */
  casings = 0;

  /** Edges with a visible overlay (13 A2) — the pass-skip gate. */
  edgeOverlayCount(): number {
    return this.edgeOverlays;
  }
  /** Edges with a visible underlay (13 A2) — the pass-skip gate. */
  edgeUnderlayCount(): number {
    return this.edgeUnderlays;
  }
  /** Edges with a visible line casing — the pass-skip gate. */
  casingCount(): number {
    return this.casings;
  }

  /**
   * Write an edge's overlay or underlay record (round 13 A2):
   * [rgba (opacity folded), strokeWidth×256] — the stroke width is the
   * edge width + 2 × padding, derived at style-write time.
   */
  setEdgeLayer(
    id:
      | typeof COL.EDGE_OVERLAY
      | typeof COL.EDGE_UNDERLAY
      | typeof COL.EDGE_CASING,
    slot: number,
    rgba: number,
    strokeWidth: number,
  ): void {
    layersImpl.setEdgeLayer(this, id, slot, rgba, strokeWidth);
  }

  /** live count of edges with any visible mid arrow (round 13 C1) —
   * the renderer skips the mid draws entirely while 0
   * @internal */
  midArrows = 0;

  /** Edges with any visible mid arrow (13 C1) — the renderer skips the
   * mid-arrow draws entirely at 0. */
  midArrowCount(): number {
    return this.midArrows;
  }

  /** setColor wrapper for the mid-arrow columns that keeps the count. */
  setMidArrow(
    id: typeof COL.EDGE_MID_SOURCE_ARROW | typeof COL.EDGE_MID_TARGET_ARROW,
    slot: number,
    r: number,
    g: number,
    b: number,
    a: number,
    otherId:
      | typeof COL.EDGE_MID_SOURCE_ARROW
      | typeof COL.EDGE_MID_TARGET_ARROW,
  ): void {
    layersImpl.setMidArrow(this, id, slot, r, g, b, a, otherId);
  }

  /** monotone (round 13 B7): the largest arrow-scale any edge styles —
   * the arrow quads size for it and the FS renders the exact scale */
  private arrowScaleMaxV = 1;

  /** The largest arrow-scale any edge has styled (13 B7): the arrow
   * quads size for it and the FS renders the exact per-edge scale.
   * Monotone — never shrinks, which only costs quad area. */
  arrowScaleMax(): number {
    return this.arrowScaleMaxV;
  }

  /** Raise the monotone arrow-scale maximum (the style layer's report;
   * arrow scale is not a store column). */
  noteArrowScale(scale: number): void {
    if (scale > this.arrowScaleMaxV) {
      this.arrowScaleMaxV = scale;
    }
  }

  private arrowWidthMaxV = 0;

  /**
   * The largest hollow-arrow stroke width any edge has styled, model px
   * (round 56).
   *
   * A hollow head strokes its *outline*, so the ink reaches half a stroke
   * width **outside** the polygon — furthest out at the back corners,
   * where two edges meet at an acute angle.  The arrow vertex stage has
   * no spare storage binding for `edge.arrowWidths`, so the quad grows by
   * this frame-level maximum instead, exactly as it already does for
   * `arrowScaleMax`.  Monotone, and it only costs quad area.
   */
  arrowWidthMax(): number {
    return this.arrowWidthMaxV;
  }

  /** Raise the monotone hollow-stroke maximum (the style layer's
   * report, after 'match-line' and percent forms are resolved). */
  noteArrowWidth(width: number): void {
    if (width > this.arrowWidthMaxV) {
      this.arrowWidthMaxV = width;
    }
  }

  /** monotone (round 13 B5): the largest outline outward extent any
   * node has styled — the ghost cull grows by it (no binding left for
   * the packed geometry there)
   * @internal */
  outlineSlackMax = 0;

  /** The largest outward outline extent any node has styled (13 B5) —
   * the ghost cull grows its tests by this.  Monotone: never shrinks on
   * a restyle, which costs cull efficiency, never correctness. */
  outlineSlack(): number {
    return this.outlineSlackMax;
  }

  /**
   * Write a node's border/corner/outline record (rounds 13 B2/B5):
   * cornerRadius model px (-1 = auto), borderPosition id, the outline
   * rgba (opacity pre-folded), outline width/offset (model px,
   * u16 fixed-point), and — round 38 — the border/outline stroke-style
   * enums, packed into bits 8..11 of the position word (see the
   * contract's stroke style constants).  Corner radius and outline
   * extents are geometry (pick + bb read them), so writes bump the
   * geometry epoch.
   */
  setBorderGeom(
    slot: number,
    cornerRadius: number,
    borderPos: number,
    outlineRgba: number,
    outlineWidth: number,
    outlineOffset: number,
    shapeId: number = 0,
    polyRef: number = 0,
    borderStyle: number = 0,
    outlineStyle: number = 0,
  ): void {
    layersImpl.setBorderGeom(
      this,
      slot,
      cornerRadius,
      borderPos,
      outlineRgba,
      outlineWidth,
      outlineOffset,
      shapeId,
      polyRef,
      borderStyle,
      outlineStyle,
    );
  }

  /** live count of elements carrying a gradient record (13 C2) @internal */
  gradients = 0;

  /** Elements with a gradient fill (13 C2) — the pass-skip gate. */
  gradientCount(): number {
    return this.gradients;
  }

  /**
   * Write a gradient record (round 13 C2): kind 0 clears; stops are
   * [rgba, pos-fraction] pairs, capped at 5 by the style layer.
   */
  setGradient(
    id: typeof COL.NODE_GRADIENT | typeof COL.EDGE_GRADIENT,
    slot: number,
    kind: number,
    dir: number,
    stops: { rgba: number; pos: number }[],
  ): void {
    layersImpl.setGradient(this, id, slot, kind, dir, stops);
  }

  /** Four-component f32 write (dash patterns etc.). */
  setVec4(
    id: ColumnId,
    slot: number,
    a: number,
    b: number,
    c: number,
    d: number,
  ): void {
    layersImpl.setVec4(this, id, slot, a, b, c, d);
  }

  /** RGBA bytes on [0, 255]. */
  setColor(
    id: ColumnId,
    slot: number,
    r: number,
    g: number,
    b: number,
    a: number,
  ): void {
    layersImpl.setColor(this, id, slot, r, g, b, a);
  }

  // -- curves (round 12a; derivation in store/curve-index.mts) --

  /**
   * Store an edge's styled curve record (the StyleEngine's write path);
   * the derived edge.curveParams re-derive lazily via the CurveIndex.
   * `extras` carries the 12b family lists/params (null for
   * straight/bezier styles).
   */
  setCurveStyle(
    slot: number,
    style: number,
    stepSize: number,
    weight: number,
    loopDirection: number,
    loopSweep: number,
    extras: CurveStyleExtras | null = null,
    haystackRadius: number = 0,
    endpoints: EndpointSpec | null = null,
  ): void {
    curvesImpl.setCurveStyle(
      this,
      slot,
      style,
      stepSize,
      weight,
      loopDirection,
      loopSweep,
      extras,
      haystackRadius,
      endpoints,
    );
  }

  /** The styled curve record — the stored truth the style getters read. */
  curveStyleAt(slot: number): ReturnType<CurveIndex['styleAt']> {
    return this.curves.styleAt(slot);
  }

  /**
   * The derived curve params [p0, p1, p2, kind] for one edge, with any
   * pending derivation flushed first (the accessors' read path).
   */
  curveParamsAt(slot: number): [number, number, number, number] {
    this.flushDerived();

    const params = this.edges.column(COL.EDGE_CURVE_PARAMS) as Float32Array;
    const at = slot * 4;

    return [params[at], params[at + 1], params[at + 2], params[at + 3]];
  }

  /** scratch for `arrowTrimAt` — the geometry readers never allocate @internal */
  trimScratch: ArrowTrim = {
    srcGap: 0,
    tgtGap: 0,
    srcSpacing: 0,
    tgtSpacing: 0,
  };

  /**
   * v3's two per-end shortenings for one edge, resolved from the arrow
   * and width columns (round 56).
   *
   * This is the CPU side of what `edge.width` lane 1 carries to the
   * vertex stages: the same packed word, the same `arrowGap` /
   * `arrowSpacing`, so the drawn line and every accessor agree by
   * construction rather than by two hand-kept copies of v3's table.
   *
   * Haystack is the one exception, and it is v3's: haystack edges draw
   * no heads at all and route through a different path, so they take no
   * shortening.
   *
   * @param slot — the edge slot
   * @returns a shared scratch — consume it before the next call
   */
  arrowTrimAt(slot: number): ArrowTrim {
    return curvesImpl.arrowTrimAt(this, slot);
  }

  /**
   * Evaluate one curved edge's geometry from the live columns (null for
   * straight edges).  The returned object is a shared scratch unless
   * `out` is given — consume it before the next call.  This is the CPU
   * twin of the curve vertex shader: same params, same boundary math,
   * same frame (see curve-geometry.mts).
   */
  curveEvalAt(
    slot: number,
    out: CurveEval = this.curveScratch,
  ): CurveEval | null {
    return curvesImpl.curveEvalAt(this, slot, out);
  }

  /**
   * Evaluate a blob-backed curved edge's route from the live columns
   * (null for straight/bezier/loop edges — those use curveEvalAt).
   * The returned object is a shared scratch unless `out` is given.
   * The CPU twin of the 12b route vertex shader: same blob record,
   * same outerHalf frame, same routing (see curve-geometry.mts).
   */
  curveRouteAt(
    slot: number,
    out: CurveRoute = this.routeScratch,
  ): CurveRoute | null {
    return curvesImpl.curveRouteAt(this, slot, out);
  }

  /**
   * The same route evaluation at *hypothetical* endpoint centres —
   * `Collection.boundingBoxAt`'s taxi term (round 54).  Everything but
   * the two positions (blob record, outer halves, shapes, trim) reads
   * the live columns; the caller supplies where the nodes would be.
   *
   * @param slot — the edge slot
   * @param sx — hypothetical source centre x
   * @param sy — hypothetical source centre y
   * @param tx — hypothetical target centre x
   * @param ty — hypothetical target centre y
   * @param out — optional route to fill (the shared scratch otherwise)
   * @returns the route, or null for a non-blob-backed edge
   */
  curveRouteAtPositions(
    slot: number,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    out: CurveRoute = this.routeScratch,
  ): CurveRoute | null {
    return curvesImpl.curveRouteAtPositions(this, slot, sx, sy, tx, ty, out);
  }

  /**
   * The same curve evaluation as `curveEvalAt`, at *hypothetical*
   * endpoint centres (round 92) — `curveBBAtPositions`' eval-kind half,
   * the CurveEval twin of `curveRouteAtPositions`.  Everything but the
   * two positions (params, outer halves, shapes, trim) reads the live
   * columns; the caller supplies where the nodes would be.
   *
   * @param slot — the edge slot
   * @param sx — hypothetical source centre x
   * @param sy — hypothetical source centre y
   * @param tx — hypothetical target centre x
   * @param ty — hypothetical target centre y
   * @param out — optional eval to fill (the shared scratch otherwise)
   * @returns the eval, or null for a blob-backed or straight edge
   */
  curveEvalAtPositions(
    slot: number,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
    out: CurveEval = this.curveScratch,
  ): CurveEval | null {
    return curvesImpl.curveEvalAtPositions(this, slot, sx, sy, tx, ty, out);
  }

  /**
   * The haystack endpoint pair of an edge (12c; null unless the edge's
   * derived kind is CURVE_HAYSTACK): the hash-stable offset points
   * inside each node body, computed from the params column + live
   * positions/outer halves — the CPU twin of the straight edge
   * shader's haystack branch.
   */
  haystackPointsAt(
    slot: number,
  ): { sx: number; sy: number; tx: number; ty: number } | null {
    return curvesImpl.haystackPointsAt(this, slot);
  }

  /**
   * Where a **straight** edge meets a node's boundary, along the chord
   * between the two node centres (round 55).
   *
   * This is the CPU twin of the straight arrow shader's tip placement
   * (`tip = tipC - dir * boundaryOffset(...)`), so the accessor built on
   * it reports the point the renderer actually draws to.
   *
   * It exists because v4 previously answered the node *centre* here —
   * `Collection._endpointPoint` fell through to the raw positions for
   * every straight edge — which is off by a whole node radius from v3
   * and from what is on screen.
   *
   * @param slot — the edge's slot
   * @param which — 0 for the source end, 1 for the target end
   * @returns the boundary point in model space
   */
  straightEndpointAt(
    slot: number,
    which: 0 | 1,
    arrows: boolean = true,
  ): { x: number; y: number } {
    return curvesImpl.straightEndpointAt(this, slot, which, arrows);
  }

  /**
   * Where a straight edge's **drawn line** ends — `gap` behind the node
   * boundary, which is further back than the arrow point
   * `straightEndpointAt` answers (round 56).
   *
   * v3 keeps both (`rs.startX/Y` against `rs.arrowStartX/Y`) and its
   * straight midpoint is the mean of all four, which is the only public
   * caller of this today.
   *
   * @param slot — the edge slot
   * @param which — 0 for the source end, 1 for the target end
   * @returns the drawn line's end in model space
   */
  straightLineEndAt(slot: number, which: 0 | 1): { x: number; y: number } {
    return this.straightEndpointAt(slot, which, false);
  }

  /**
   * The exact bounding box of a curved edge (null for straight ones):
   * the flattened polyline at the drawn subdivision, memoized per slot
   * against the geometry epoch — the "exact lazy CPU eval" tier of the
   * expensive-geometry design (public `.bb()`, and since round 92 the
   * fit scan's box-bounded kinds, read this; the cull kernels keep
   * their conservative bounds).
   */
  curveBBAt(
    slot: number,
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    return curvesImpl.curveBBAt(this, slot);
  }

  /**
   * The exact bounding box of a curved edge at *hypothetical* endpoint
   * centres (round 92) — `Collection.boundingBoxAt`'s tier for the
   * box-bounded kinds, twinned with what `curveBBAt` answers at the
   * live centres.  Not memoized: hypothetical positions have no epoch,
   * and the caller (a layout's fit target) evaluates each edge once
   * per call anyway.
   *
   * @param slot — the edge slot
   * @param sx — hypothetical source centre x
   * @param sy — hypothetical source centre y
   * @param tx — hypothetical target centre x
   * @param ty — hypothetical target centre y
   * @returns the box, or null for a straight/haystack edge
   */
  curveBBAtPositions(
    slot: number,
    sx: number,
    sy: number,
    tx: number,
    ty: number,
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    return curvesImpl.curveBBAtPositions(this, slot, sx, sy, tx, ty);
  }

  /**
   * Conservative model-px bound on how far any curved edge strays from
   * the segment between its endpoint node centers — the cull kernels
   * grow their straight-chord tests by this (per-edge params can't bind
   * everywhere within the 8-storage-buffer budgets).  Monotone maxima:
   * never shrinks on removals/restyles, which only costs cull
   * efficiency, never correctness; 0 while nothing is curved.
   */
  curveSlack(): number {
    return curvesImpl.curveSlack(this);
  }

  /**
   * Whether any edge has ever entered the curved draw stream (FLAG_CURVED
   * — every kind but straight, haystack and triangle, which draw in the
   * straight pipeline).  The renderer gates its curved edge and curved
   * arrow pipelines on this, so a graph that never curves an edge never
   * compiles their shaders.
   *
   * Monotone on purpose: it never goes back to false when the last curved
   * edge is removed or restyled straight.  A pipeline that has been needed
   * once is far cheaper to keep than to compile again, and the flag is
   * read once per frame.
   *
   * @returns true once any edge has carried a curved-stream curve-style
   */
  hasCurvedEdges(): boolean {
    return this.curvedEver;
  }

  /**
   * The conservative model-px bound on how far a haystack endpoint can
   * sit from its node center (12c): radius × the largest outer half.
   * The *straight*-stream cull/pick-tile tests grow by this (haystack
   * rides the straight pipeline), and it stays 0 until some edge
   * styles haystack.  Monotone, like the curve slack.
   */
  haystackSlack(): number {
    return curvesImpl.haystackSlack(this);
  }

  // curveBoxMargin() (the global nodeHalfMax + borderMax/2 the fit
  // scans used to add per box-bounded edge) was removed in round 54:
  // both CPU call sites now read the edge's own endpoints' outer halves
  // instead, and nothing else consumed it.  The cull kernels never used
  // it — they carry frame.curveSlack, which keeps its global maxima
  // deliberately (over-inclusion in a cull costs efficiency, never
  // correctness).

  /** The CurveIndex's write sink: params column + FLAG_CURVED + dirty.
   * Fixed-kind writes (straight/bezier/loop) release any blob record
   * the slot held from a previous blob-backed style.
   * @internal */
  setCurveParams(
    slot: number,
    p0: number,
    p1: number,
    p2: number,
    kind: number,
  ): void {
    curvesImpl.setCurveParams(this, slot, p0, p1, p2, kind);
  }

  /**
   * The CurveIndex's write sink for blob-backed kinds (12b): store the
   * record in the blob, the header [offset, dev, n, kind] in the params
   * column, and the curved/box flags.  `dev` is the conservative chord
   * deviation (max|d|); `box` marks kinds no chord bound covers (taxi,
   * extrapolated weights) for the AABB cull branch.
   * @internal
   */
  setCurveParamsBlob(
    slot: number,
    kind: number,
    values: ArrayLike<number>,
    n: number,
    dev: number,
    box: boolean,
    endptPct: number = 0,
  ): void {
    curvesImpl.setCurveParamsBlob(
      this,
      slot,
      kind,
      values,
      n,
      dev,
      box,
      endptPct,
    );
  }

  // -- labels (model-only sidecar; see LabelEntry in contract.mts) --
  // Group-keyed since round 10: edges carry labels too (anchored at the
  // edge midpoint, which the renderer computes on-GPU).  The group param
  // defaults to 'nodes' so node-side call sites read unchanged.

  /**
   * The sidecar label entry for a slot in one stream, or undefined when
   * unlabelled.  The live object the store holds — treat it as
   * read-only and write changes back through setLabel(), which is what
   * marks the glyph run for rebuild.
   *
   * @param group — which of the four label streams; defaults 'nodes'
   * so the node-side call sites read unchanged (round 10)
   */
  labelAt(
    slot: number,
    group: LabelStream = GROUP_NODES,
  ): LabelEntry | undefined {
    return this.labels[group][slot];
  }

  /**
   * Set the global label font — family, style and weight (round 13
   * D1); one font per glyph atlas.  Every labelled element, in all four
   * streams, re-lays-out against the new font's metrics via the
   * label-dirty channel; the renderer's atlas resets when it observes
   * the change.
   */
  setLabelFont(
    font: string,
    style: string = 'normal',
    weight: string = 'normal',
  ): void {
    labelsImpl.setLabelFont(this, font, style, weight);
  }

  /** Queue every labelled slot (both groups) for a glyph-run rebuild. */
  markAllLabelsDirty(): void {
    labelsImpl.markAllLabelsDirty(this);
  }

  /** Set or clear (null) an element's label; no-ops when nothing changed. */
  setLabel(
    slot: number,
    entry: LabelEntry | null,
    group: LabelStream = GROUP_NODES,
  ): void {
    labelsImpl.setLabel(this, slot, entry, group);
  }

  /**
   * The font-size tween's per-tick write (round 25.5): patch the
   * sidecar entry's fontSize without an engine round trip (the
   * reanchorLabel pattern).  The edge streams' anchorY is
   * fontSize-derived (-fs/2 + marginY) and re-derives with it; node
   * anchors are size-derived, not font-derived.  One edge font-size
   * drives all three of its streams (mid + end labels).
   */
  setLabelFontSize(slot: number, group: GroupName, fontSize: number): void {
    labelsImpl.setLabelFontSize(this, slot, group, fontSize);
  }

  /** A label's laid (or headless-estimated) block dims, model px. */
  labelDimsAt(
    slot: number,
    group: LabelStream = GROUP_NODES,
  ): { w: number; h: number; exact: boolean } | null {
    return this.labelDims[group].get(slot) ?? null;
  }

  /**
   * The renderer's exact-dims feedback (16.2): the glyph build lays the
   * block with real atlas advances and reports the true extent.  Never
   * marks label-dirty (no rebuild loop) — only the bb consumers wake.
   */
  setLabelDims(slot: number, group: LabelStream, w: number, h: number): void {
    labelsImpl.setLabelDims(this, slot, group, w, h);
  }

  /**
   * Drain one stream's queue of slots needing a glyph-run rebuild.
   * Destructive (the set is cleared), so exactly one consumer — the
   * renderer's label layer — may call it per stream.
   *
   * @returns the queued slots; an empty array when nothing is pending
   */
  takeLabelDirty(group: LabelStream = GROUP_NODES): number[] {
    return labelsImpl.takeLabelDirty(this, group);
  }

  // -- iteration (insertion order) --

  /** Live elements in the group (holes excluded) — not highWater(). */
  count(group: GroupName): number {
    return this.table(group).count;
  }

  /**
   * Visit every live slot in insertion order, skipping tombstones by
   * generation compare.  A reused slot is visited at its *re-insertion*
   * position, not its original one.  The callback must not add or
   * remove elements in the group being walked.
   */
  forEachAlive(group: GroupName, cb: (slot: number) => void): void {
    scanImpl.forEachAlive(this, group, cb);
  }

  /**
   * The slot-only twin of `scanRefsInto` (round 34.2/34.4): the same
   * insertion-order walk with the same `(mask, want)` flag test, writing
   * bare slot numbers instead of allocating a `Ref` each.  Callers that
   * work in slot space — the layout contract's `nodeSlots()`/
   * `edgeSlots()` — used to reach them through element handles, which
   * cost a handle intern per element for information the order list
   * already has.
   *
   * Same order as `scanRefsInto`, which is what keeps layouts placing
   * elements where they placed them before.
   *
   * @param out — destination array, written from `at`
   * @param at — first index to write
   * @param group — which group to scan
   * @param mask — flag bits to test
   * @param want — the value those bits must have
   * @returns the index one past the last slot written
   */
  scanSlotsInto(
    out: number[],
    at: number,
    group: GroupName,
    mask: number,
    want: number,
  ): number {
    return scanImpl.scanSlotsInto(this, out, at, group, mask, want);
  }

  /**
   * Scan one group's flags column, writing a ref into `out` (from index
   * `at`) for every live slot (insertion order) whose flags satisfy
   * (flags & mask) === want.  Returns the index one past the last write —
   * the columnar scan behind the whole-graph materializers and structured
   * queries, callable back to back so `out` covers several groups.  The
   * caller preallocates `out` to the live count (the exact match count for
   * a mask-0 scan, an upper bound otherwise) and trims afterwards.
   */
  scanRefsInto(
    out: Ref[],
    at: number,
    group: GroupName,
    mask: number,
    want: number,
    dataTests?: { test: (v: unknown) => boolean; key: string }[],
  ): number {
    return scanImpl.scanRefsInto(this, out, at, group, mask, want, dataTests);
  }

  /**
   * Live, visible elements in the model-coordinate box — the
   * box-selection query, answered by one columnar scan.  Corners may be
   * given in any order.
   *
   * **'contain'** (the default, v3's): a node counts when its bounding
   * box (position ± size/2 ± border/2) lies fully inside the box; an edge
   * counts when both of its endpoints do.  Since 12b, curved edges test
   * their *curve* boundary endpoints (exactly v3's on-boundary rule — the
   * revisit deferred from 12a); straight edges keep the endpoint-center
   * approximation (a recorded deviation).  `includeLabels` **narrows**
   * this: the node's label box must be contained too.
   *
   * **'overlap'** (round 39.1): a node counts when its bounding box
   * *intersects* the box; an edge counts when any part of its drawn path
   * does — either endpoint inside, or a flattened segment crossing, by
   * the Liang-Barsky clip the cull pass runs per frame (`segmentHitsBox`
   * is its CPU twin).  `includeLabels` **widens** this instead: a node
   * whose body misses but whose label box overlaps counts.  The
   * asymmetry is v3's and is the only thing either mode can mean —
   * containment is an AND over parts, overlap an OR.
   */
  refsInBox(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    includeLabels: boolean = false,
    mode: BoxSelectionMode = 'contain',
  ): Ref[] {
    return scanImpl.refsInBox(this, x1, y1, x2, y2, includeLabels, mode);
  }

  /**
   * Does any part of an edge's drawn path lie in the model-space box?
   * The 'overlap' box-selection test (round 39.1), and the exact one:
   * a segment crossing the band counts even when neither endpoint is in
   * it, which is the case containment can never express.
   *
   * Curved edges take the **conservative-then-exact** shape the rest of
   * the curve geometry uses: the memoized exact bb rejects the common
   * miss for the price of a cached box, and only a survivor pays for the
   * flattened walk at the drawn subdivision — the same polyline the
   * renderer strips, so what the band catches is what the band crosses.
   *
   * @param slot — the edge slot
   * @param lx — the box's low x, in model coordinates
   * @param ly — the box's low y
   * @param hx — the box's high x
   * @param hy — the box's high y
   * @returns whether the drawn path meets the box
   */
  edgeHitsBox(
    slot: number,
    lx: number,
    ly: number,
    hx: number,
    hy: number,
  ): boolean {
    return scanImpl.edgeHitsBox(this, slot, lx, ly, hx, hy);
  }

  /** Live slots in insertion order (reused slots re-appear at their re-insertion position). */
  slotsOrdered(group: GroupName): number[] {
    const slots: number[] = [];

    this.forEachAlive(group, (slot) => slots.push(slot));

    return slots;
  }

  /**
   * A node label's box in node-local model px (round 16.4): the laid
   * (or headless-estimated) block at its D3 anchor, grown by the
   * text-background padding when a box draws.  Null when unlabelled.
   */
  nodeLabelBox(
    slot: number,
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    return scanImpl.nodeLabelBox(this, slot);
  }

  /**
   * The conservative edge-label slack (16.4): a radius covering the
   * label block wherever its anchor lands on the drawn path (mid or
   * end streams, rotation included), added to the edge term's growth.
   */
  edgeLabelSlack(slot: number): number {
    return scanImpl.edgeLabelSlack(this, slot);
  }

  /** true when any edge-stream label exists (the scan's cheap gate) */
  hasEdgeLabels(): boolean {
    return (
      this.labelDims.edges.size > 0 ||
      this.labelDims.edgeSource.size > 0 ||
      this.labelDims.edgeTarget.size > 0
    );
  }

  /** true when any node label exists (the scan's cheap gate) */
  hasNodeLabels(): boolean {
    return this.labelDims.nodes.size > 0;
  }

  /**
   * Whole-graph bounding box as a direct columnar scan — no element
   * handles (a no-arg fit() on a 500k-element graph is a fraction of a
   * millisecond instead of hundreds).  Nodes contribute position ±
   * (size/2 + border/2), grown by their outline, overlay/underlay
   * padding, ghost offset and label box where those apply.  Edges
   * contribute their own extent as a first-class term: the two endpoint
   * node centers, grown by the conservative hull deviation for
   * chord-bounded curved kinds (rounds 12a/12b), while the box-bounded
   * kinds — compound loops, taxi, extrapolated weights — read the
   * exact memoized curve bb (rounds 54/92: conservative margins for
   * them misframed compound fits).  Future edge geometry (arrow
   * heads, 12c endpoints) extends the edge term here and there
   * together.  Only the space tier counts (round 22): display-hidden
   * elements are excluded, `visibility: 'hidden'` ones still take
   * space.  Conservative by design — fit may over-fit, never under.
   *
   * @param includeLabels — whether label boxes join the box (v3's
   * default, on)
   * @returns null when nothing visible remains
   */
  boundingBox(includeLabels: boolean = true): {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    w: number;
    h: number;
  } | null {
    return scanImpl.boundingBox(this, includeLabels);
  }

  // -- internals --

  /** Sidecar data() values from a def's data object (id/source/target/parent stay first-class). */
  setDefData(
    group: GroupName,
    slot: number,
    data: Record<string, unknown> | undefined,
  ): void {
    mutationImpl.setDefData(this, group, slot, data);
  }

  /**
   * Slot-moving compaction (round 19.1, store core): move live elements
   * down to a dense slot prefix per group with a **monotone** remap —
   * relative slot order is preserved, so draw order, curve bundle ranks
   * and CSR incident order are all unchanged by construction (the
   * round-19 stable-draw-order call).  Shrinks `highWater` to the live
   * count (and column capacity with it), rewrites `edge.endpoints` when
   * nodes move, fuses the id index and the insertion-order list, rebuilds
   * CSR, and marks the compacted groups `resized` so the renderer's
   * existing realloc + full re-upload path takes over.  Returns each
   * group's remap (null where nothing needed doing) for the callers that
   * hold slots — 19.2 wires the dependent store indexes, 19.3 the ref
   * forwarding, 19.4 the renderer, 19.5 the triggers; until then nothing
   * calls this in production.
   */
  compact(): { nodes: GroupCompaction | null; edges: GroupCompaction | null } {
    return compactionImpl.compact(this);
  }
}

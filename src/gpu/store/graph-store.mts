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
import {
  CURVE_SEGS, curveDeviation, curvePointAt, emptyCurveEval, emptyCurveRoute, evalCurve,
  evalRoute, haystackPoint, headerDeviation, routeVertex
} from '../curve-geometry.mjs';
import type { CurveEval, CurveRoute } from '../curve-geometry.mjs';
import {
  columnSpec, columnSpecsForGroup,
  CURVE_BEZIER, CURVE_CMPD, CURVE_HAS_ENDPT, CURVE_HAYSTACK, CURVE_LOOP, CURVE_MULTI,
  CURVE_SEGMENTS,
  CURVE_STRAIGHT, CURVE_TAXI, CURVE_TRIANGLE,
  FLAG_ALIVE, FLAG_CHILD, FLAG_CURVED, FLAG_CURVED_BOX, FLAG_GRABBABLE, FLAG_LOCKED,
  FLAG_PANNABLE, FLAG_PARENT, FLAG_SELECTABLE, FLAG_SELECTED, FLAG_SELF_HIDDEN,
  FLAG_VISIBLE, LABEL_MARGIN, NO_SLOT
} from '../contract.mjs';
import type { LabelStream, ColumnArray, ColumnId, GroupName, LabelEntry, ModelView, Ref, StoreDelta } from '../contract.mjs';
import { NO_PARENT } from '../gpu-types.mjs';
import type { GpuColumnarEdges, GpuColumnarNodes, GpuDataColumn, GpuPackedIds } from '../gpu-types.mjs';
import { ImageRegistry, IMAGE_KIND_AUTO, IMAGE_KIND_SDF } from '../image-registry.mjs';
import { estimateBlock } from '../label-wrap.mjs';

/** floats per image record in the image pool (round 15.2) */
export const IMG_STRIDE = 12;

/** A percent-or-px value ({ v, pct }) as parsed by the style engine. */
export interface BgLen { v: number; pct: boolean; }
/** A background-width/-height value: mode 0 auto, 1 px, 2 percent. */
export interface BgSize { mode: number; v: number; }

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
  tint: [ number, number, number, number ];
}

/** A stored image record decoded back out of the pool (readback). */
export interface NodeImageRecord extends Omit<NodeImageSpec, 'url' | 'crossOrigin'> {
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

const emptyOrder = (): OrderList => ( { slots: [], gens: [], stale: 0 } );

/**
 * The CPU-canonical columnar model: NodeTable + EdgeTable + IdMap +
 * Adjacency, with per-column dirty spans for the renderer.  Synchronous API
 * reads always hit these typed-array columns; the store works headless (no
 * GPU, Node-testable).  The store itself never emits events — the core does.
 */
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

export class GraphStore implements ModelView {
  readonly nodes: ColumnTable;
  readonly edges: ColumnTable;
  readonly ids: IdMap;
  readonly adj: Adjacency;
  readonly data: DataStore;
  readonly dirty: DirtyTracker;
  readonly curves: CurveIndex;
  /** the compound hierarchy (round 14); reads go through the delegates below */
  private hierarchy: HierarchyIndex;
  /** per-parent stashed *style* size: the degenerate-children fallback,
   * restored to the column when the node becomes a leaf again (14.3) */
  private parentFallback = new Map<number, [ number, number ]>();
  /** fires on the compounds 0 <-> >0 transitions (the core re-configures
   * paint eval: the opacity fold demotes the GPU mapper, round 14.4) */
  onCompoundsToggled: ( () => void ) | null = null;
  /** fires when a node flips leaf <-> parent (the core restyles the slot
   * against the right sheet group, round 14.6) */
  onParentFlip: ( ( slot: number ) => void ) | null = null;
  /** fires when a node's parent changes (structural case conditions on
   * the moved node re-evaluate, round 14.7) */
  onReparented: ( ( slot: number ) => void ) | null = null;

  // conservative monotone maxima behind curveSlack() (see that doc)
  private curveDevMax = 0;
  private nodeHalfMax = 0;
  private borderMax = 0;
  /** monotone: some edge has carried a box-bounded curve kind (taxi /
   * extrapolated weights), so curveSlack() must stay engaged even when
   * curveDevMax is 0 */
  private hasBoxCurves = false;
  /** monotone (12c): the largest pct-endpoint magnitude in node-half
   * units — offsets past 1 exceed the slack's node-half term, so the
   * excess joins curveSlack() (see that doc) */
  private endptPctMax = 0;
  /** monotone (12c): the largest haystack-radius any edge has styled —
   * haystack offsets stray from the endpoint centers by at most
   * radius × outerHalf, and the straight-stream cull tests grow by
   * haystackSlack() to stay sound */
  private haystackRadiusMax = 0;

  /** the 12b variable-length curve param pool (see store/curve-blob.mts) */
  private blob: CurveBlob;
  /** the C3 custom-polygon unit-point pool */
  private polyPool!: CurveBlob;
  /** the 15.2 background-image record pool (IMG_STRIDE floats per image) */
  private imagePool!: CurveBlob;
  /** the unique-image registry (round 15.1); style writes acquire/release */
  readonly images = new ImageRegistry();

  // exact-curve-bb memo (see curveBBAt): any geometry write bumps the
  // epoch, invalidating every cached edge box at once — sound and cheap
  private geoEpoch = 1;
  private edgeBBEpoch = new Uint32Array( 0 );
  private edgeBB = new Float64Array( 0 );
  private curveScratch = emptyCurveEval();
  private routeScratch = emptyCurveRoute();

  private order: { nodes: OrderList; edges: OrderList };
  private labels: Record<LabelStream, ( LabelEntry | undefined )[]>;
  private labelDirty: Record<LabelStream, Set<number>>;
  /** laid (or estimated) label block dims per stream (round 16.2) */
  private labelDims: Record<LabelStream, Map<number, { w: number; h: number; exact: boolean }>> = {
    nodes: new Map(), edges: new Map(), edgeSource: new Map(), edgeTarget: new Map()
  };
  /** global label font-family (one font per glyph atlas); style-owned */
  labelFont: string;
  labelFontStyle: string;
  labelFontWeight: string;
  /** data keys whose writes feed GPU-evaluated mappers (registered by the StyleEngine) */
  private watchedKeys: Record<GroupName, ReadonlySet<string>>;
  /** coalesced watched-key write spans, keyed 'group:key' (consumed by the renderer) */
  private mapperSpans: Map<string, MapperSpan>;

  constructor(){
    this.nodes = new ColumnTable( 'nodes', columnSpecsForGroup( 'nodes' ) );
    this.edges = new ColumnTable( 'edges', columnSpecsForGroup( 'edges' ) );
    this.ids = new IdMap();
    this.adj = new Adjacency();
    this.data = new DataStore();
    this.dirty = new DirtyTracker();
    this.order = { nodes: emptyOrder(), edges: emptyOrder() };
    this.labels = { nodes: [], edges: [], edgeSource: [], edgeTarget: [] };
    this.labelDirty = {
      nodes: new Set(), edges: new Set(), edgeSource: new Set(), edgeTarget: new Set()
    };
    this.labelFont = 'sans-serif';
    this.labelFontStyle = 'normal';
    this.labelFontWeight = 'normal';
    this.watchedKeys = { nodes: new Set(), edges: new Set() };
    this.mapperSpans = new Map();

    // a dict compaction remaps every slot's stored index for that key:
    // a watched key must re-upload its whole column (and, via the bumped
    // dict epoch, repack the GPU ordinal LUT); unwatched keys no-op
    this.data.onDictRemap = ( group, key ) => {
      this.markDataWrite( group, key, 0, this.table( group ).highWater );
    };

    this.curves = new CurveIndex( {
      endpoints: () => this.edges.column( 'edge.endpoints' ) as Uint32Array,
      aliveEdgeSlots: () => this.slotsOrdered( 'edges' ),
      writeParams: ( slot, p0, p1, p2, kind ) => this.setCurveParams( slot, p0, p1, p2, kind ),
      writeBlobParams: ( slot, kind, values, n, dev, box, endptPct ) =>
        this.setCurveParamsBlob( slot, kind, values, n, dev, box, endptPct ),
      idHash: ( slot ) => this.ids.hashAt( 'edges', slot ),
      schedule: () => this.dirty.touch(),
      // compound relation (14.10): ancestor/descendant endpoints, or a
      // self-loop on a parent — such edges route around the outside
      relation: ( a, b ) => a === b
        ? this.hierarchy.childrenOf( a ).length > 0
        : ( this.hierarchy.isAncestorOf( a, b ) || this.hierarchy.isAncestorOf( b, a ) ),
      outerHalfW: ( slot ) => ( this.nodes.column( 'node.outerHalf' ) as Float32Array )[ slot * 2 ]
    } );

    this.hierarchy = new HierarchyIndex( {
      flags: () => this.nodes.column( 'node.flags' ) as Uint32Array,
      gen: () => this.nodes.gen,
      markFlag: ( slot ) => this.dirty.mark( 'node.flags', slot ),
      schedule: () => this.dirty.touch(),
      positions: () => this.nodes.column( 'node.position' ) as Float32Array,
      outerHalf: () => this.nodes.column( 'node.outerHalf' ) as Float32Array,
      readSize: ( slot ) => {
        const stashed = this.parentFallback.get( slot );

        if( stashed != null ){ return stashed; }

        const size = this.nodes.column( 'node.size' ) as Float32Array;

        return [ size[ slot * 2 ], size[ slot * 2 + 1 ] ];
      },
      onFlip: ( slot, becameParent ) => {
        if( becameParent ){
          // stash the style size: auto-bounds owns the column from here,
          // and the stash is both the degenerate fallback and what a
          // leaf-again node returns to
          const size = this.nodes.column( 'node.size' ) as Float32Array;

          this.parentFallback.set( slot, [ size[ slot * 2 ], size[ slot * 2 + 1 ] ] );
        } else {
          const stashed = this.parentFallback.get( slot );

          this.parentFallback.delete( slot );

          if( stashed != null ){ this.setPair( 'node.size', slot, stashed[ 0 ], stashed[ 1 ] ); }
        }

        // paint config depends on hasCompounds (the opacity-fold GPU
        // demotion, round 14.4): notify on the 0 <-> >0 transitions
        if( becameParent ? this.hierarchy.parentCount() === 1 : this.hierarchy.parentCount() === 0 ){
          this.onCompoundsToggled?.();
        }

        // a flipped node restyles against the right sheet group (14.6)
        this.onParentFlip?.( slot );

        // its self-loops flip between plain and compound routing (14.10)
        const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

        for( const edgeSlot of this.adj.connectedEdges( slot ) ){
          if( endpoints[ edgeSlot * 2 ] === endpoints[ edgeSlot * 2 + 1 ] ){
            this.curves.invalidateRelation( slot, slot );
          }
        }
      },
      materialize: ( slot, x, y, w, h ) => this.materializeParentGeom( slot, x, y, w, h )
    } );

    // a blob compaction moves records: rewrite the header offset (a
    // normal column write, so the renderer re-uploads it as a span).
    // Geometry is unchanged, so the bb memo epoch is left alone.
    this.blob = new CurveBlob( ( slot, offset ) => {
      const params = this.edges.column( 'edge.curveParams' ) as Float32Array;

      params[ slot * 4 ] = offset;
      this.dirty.mark( 'edge.curveParams', slot );
    } );

    // C3: the custom-polygon point pool (same slot-stable policy); a
    // relocation rewrites the borderGeom[0] ref in place
    this.polyPool = new CurveBlob( ( slot, offset ) => {
      const geom = this.nodes.column( 'node.borderGeom' ) as Uint32Array;
      const count = geom[ slot * 4 ] >>> 24;

      geom[ slot * 4 ] = ( offset | ( count << 24 ) ) >>> 0;
      this.dirty.mark( 'node.borderGeom', slot );
    } );

    // 15.2: the image-record pool; a relocation rewrites node.imageRef
    this.imagePool = new CurveBlob( ( slot, offset ) => {
      const refs = this.nodes.column( 'node.imageRef' ) as Uint32Array;
      const count = refs[ slot ] >>> 24;

      refs[ slot ] = ( offset | ( count << 24 ) ) >>> 0;
      this.dirty.mark( 'node.imageRef', slot );
    } );

    // an image decode landing (or an entry freeing) redraws the scene;
    // no column changes, so the pick-tile cache stays valid
    this.images.onChange = () => this.dirty.touch();
  }

  table( group: GroupName ): ColumnTable {
    return group === 'nodes' ? this.nodes : this.edges;
  }

  // -- ModelView (the renderer's read surface) --

  capacity( group: GroupName ): number {
    return this.table( group ).cap;
  }

  highWater( group: GroupName ): number {
    return this.table( group ).highWater;
  }

  column( id: ColumnId ): ColumnArray {
    return this.table( columnSpec( id ).group ).column( id );
  }

  hasDirty(): boolean {
    return this.dirty.hasDirty();
  }

  takeDelta(): StoreDelta {
    // pending curve derivations land as column writes in this delta
    this.flushDerived();

    const delta = this.dirty.take( this.nodes.highWater, this.edges.highWater );
    const blobDirty = this.blob.takeDirty();

    if( blobDirty != null ){ delta.curveBlob = blobDirty; }

    const polyDirty = this.polyPool.takeDirty();

    if( polyDirty != null ){ delta.polyBlob = polyDirty; }

    const imageDirty = this.imagePool.takeDirty();

    if( imageDirty != null ){ delta.imageBlob = imageDirty; }

    return delta;
  }

  curveBlob(): Float32Array {
    return this.blob.data();
  }

  curveBlobLength(): number {
    return this.blob.length();
  }

  polyBlob(): Float32Array {
    return this.polyPool.data();
  }

  polyBlobLength(): number {
    return this.polyPool.length();
  }

  /**
   * Store a node's custom polygon points (round 13 C3): flat unit
   * [x, y, ...] pairs, or null to clear.  Returns the packed record
   * ref (offset | pointCount << 24) for borderGeom[0].
   */
  setPolygonPoints( slot: number, points: number[] | null ): number {
    if( points == null || points.length === 0 ){
      this.polyPool.free( slot );

      return 0;
    }

    const offset = this.polyPool.write( slot, points );

    this.geoEpoch++;
    this.dirty.touch();

    return ( offset | ( ( points.length / 2 ) << 24 ) ) >>> 0;
  }

  imageBlob(): Float32Array {
    return this.imagePool.data();
  }

  imageBlobLength(): number {
    return this.imagePool.length();
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
   */
  /** live imaged-node count (the renderer's zero-cost gate, 15.3) */
  private imagedNodes = 0;

  imageCount(): number {
    return this.imagedNodes;
  }

  setNodeImages( slot: number, specs: NodeImageSpec[] | null ): void {
    const refs = this.nodes.column( 'node.imageRef' ) as Uint32Array;
    const oldRef = refs[ slot ];
    const clearing = specs == null || specs.length === 0;

    if( clearing && oldRef === 0 ){ return; } // the imageless fast path

    if( clearing ){ this.imagedNodes--; }
    else if( oldRef === 0 ){ this.imagedNodes++; }

    const oldIds: number[] = [];

    if( oldRef !== 0 ){
      const pool = this.imagePool.data();
      const off = oldRef & 0xffffff;
      const count = oldRef >>> 24;

      for( let i = 0; i < count; i++ ){ oldIds.push( pool[ off + i * IMG_STRIDE ] ); }
    }

    if( clearing ){
      this.imagePool.free( slot );
      refs[ slot ] = 0;
      this.dirty.mark( 'node.imageRef', slot );
    } else {
      const values = new Array<number>( specs.length * IMG_STRIDE );

      for( let i = 0; i < specs.length; i++ ){
        const s = specs[ i ];
        const id = this.images.acquire(
          s.url, s.sdf ? IMAGE_KIND_SDF : IMAGE_KIND_AUTO, s.crossOrigin );
        const base = i * IMG_STRIDE;

        values[ base ] = id;
        values[ base + 1 ] = s.fit | ( s.repeat << 2 ) | ( s.clip << 4 )
          | ( s.containment << 5 ) | ( ( s.smoothing ? 1 : 0 ) << 6 )
          | ( ( s.sdf ? 1 : 0 ) << 7 );
        values[ base + 2 ] = s.opacity;
        values[ base + 3 ] = s.posX.v;
        values[ base + 4 ] = s.posY.v;
        values[ base + 5 ] = s.offX.v;
        values[ base + 6 ] = s.offY.v;
        values[ base + 7 ] = s.w.v;
        values[ base + 8 ] = s.h.v;
        values[ base + 9 ] = ( s.posX.pct ? 1 : 0 ) | ( ( s.posY.pct ? 1 : 0 ) << 1 )
          | ( ( s.offX.pct ? 1 : 0 ) << 2 ) | ( ( s.offY.pct ? 1 : 0 ) << 3 )
          | ( s.w.mode << 4 ) | ( s.h.mode << 6 );
        values[ base + 10 ] = s.tint[ 0 ] + s.tint[ 1 ] * 256;
        values[ base + 11 ] = s.tint[ 2 ] + s.tint[ 3 ] * 256;
      }

      const offset = this.imagePool.write( slot, values );
      const ref = ( offset | ( specs.length << 24 ) ) >>> 0;

      if( refs[ slot ] !== ref ){
        refs[ slot ] = ref;
        this.dirty.mark( 'node.imageRef', slot );
      }
    }

    for( const id of oldIds ){ this.images.release( id ); }

    this.dirty.touch();
  }

  /** A node's decoded background-image records, or null when imageless. */
  nodeImagesAt( slot: number ): NodeImageRecord[] | null {
    const ref = ( this.nodes.column( 'node.imageRef' ) as Uint32Array )[ slot ];

    if( ref === 0 ){ return null; }

    const pool = this.imagePool.data();
    const off = ref & 0xffffff;
    const count = ref >>> 24;
    const out: NodeImageRecord[] = [];

    for( let i = 0; i < count; i++ ){
      const base = off + i * IMG_STRIDE;
      const entryId = pool[ base ];
      const flags = pool[ base + 1 ];
      const units = pool[ base + 9 ];
      const rg = pool[ base + 10 ];
      const ba = pool[ base + 11 ];

      out.push( {
        entryId,
        url: this.images.get( entryId )?.url ?? '',
        fit: flags & 3,
        repeat: ( flags >> 2 ) & 3,
        clip: ( flags >> 4 ) & 1,
        containment: ( flags >> 5 ) & 1,
        smoothing: ( ( flags >> 6 ) & 1 ) === 1,
        sdf: ( ( flags >> 7 ) & 1 ) === 1,
        opacity: pool[ base + 2 ],
        posX: { v: pool[ base + 3 ], pct: ( units & 1 ) === 1 },
        posY: { v: pool[ base + 4 ], pct: ( ( units >> 1 ) & 1 ) === 1 },
        offX: { v: pool[ base + 5 ], pct: ( ( units >> 2 ) & 1 ) === 1 },
        offY: { v: pool[ base + 6 ], pct: ( ( units >> 3 ) & 1 ) === 1 },
        w: { mode: ( units >> 4 ) & 3, v: pool[ base + 7 ] },
        h: { mode: ( units >> 6 ) & 3, v: pool[ base + 8 ] },
        tint: [ rg % 256, Math.floor( rg / 256 ), ba % 256, Math.floor( ba / 256 ) ]
      } );
    }

    return out;
  }

  /** A node's custom polygon points (unit pairs), or null. */
  polygonPointsAt( slot: number ): Float64Array | null {
    const geom = this.nodes.column( 'node.borderGeom' ) as Uint32Array;
    const shape = ( geom[ slot * 4 + 1 ] >>> 16 ) & 0xf;

    if( shape !== 14 ){ return null; }

    const ref = geom[ slot * 4 ];
    const off = ref & 0xffffff;
    const count = ref >>> 24;
    const pool = this.polyPool.data();
    const out = new Float64Array( count * 2 );

    for( let i = 0; i < count * 2; i++ ){ out[ i ] = pool[ off + i ]; }

    return out;
  }

  onInvalidate( cb: () => void ): () => void {
    return this.dirty.onInvalidate( cb );
  }

  // -- mapper data-write spans (the GPU eval pass's dirty channel) --

  /**
   * Register the data keys whose writes feed GPU-evaluated mappers.
   * Replaces the group's whole set (the StyleEngine re-derives it per
   * sheet).  Writes to unwatched keys cost one Set lookup and nothing
   * else.
   */
  watchDataKeys( group: GroupName, keys: Iterable<string> ): void {
    this.watchedKeys[ group ] = new Set( keys );
  }

  /** Data write through the mapper-span choke point (the collection's data setter). */
  setData( group: GroupName, slot: number, key: string, value: unknown ): void {
    this.data.set( group, slot, key, value );
    this.markDataWrite( group, key, slot, slot + 1 );
  }

  /**
   * Coalesce a watched-key write span.  Schedules a frame via touch() —
   * deliberately not a column span, so paint-only data writes leave the
   * pick-tile cache valid.
   */
  markDataWrite( group: GroupName, key: string, start: number, end: number ): void {
    if( !this.watchedKeys[ group ].has( key ) ){ return; }

    const id = `${group}:${key}`;
    const span = this.mapperSpans.get( id );

    if( span == null ){
      this.mapperSpans.set( id, { group, key, start, end } );
    } else {
      span.start = Math.min( span.start, start );
      span.end = Math.max( span.end, end );
    }

    this.dirty.touch();
  }

  /** Pending watched-key write spans, returned and cleared. */
  takeMapperSpans(): MapperSpan[] {
    if( this.mapperSpans.size === 0 ){ return []; }

    const spans = [ ...this.mapperSpans.values() ];

    this.mapperSpans.clear();

    return spans;
  }

  // -- refs --

  ref( group: GroupName, slot: number ): Ref {
    return { group, slot, gen: this.table( group ).gen[ slot ] };
  }

  /** Whether a ref still points at the live element it was created for. */
  isCurrent( ref: Ref ): boolean {
    const table = this.table( ref.group );

    return ref.slot < table.cap && table.gen[ ref.slot ] === ref.gen;
  }

  lookup( id: string ): Ref | undefined {
    const entry = this.ids.get( id );

    return entry == null ? undefined : this.ref( entry.group, entry.slot );
  }

  idAt( group: GroupName, slot: number ): string | undefined {
    return this.ids.idAt( group, slot );
  }

  // -- mutation --

  /**
   * Preallocate ahead of a bulk add: grows each table at most once for the
   * incoming element counts (net of reusable free slots), so the adds
   * themselves never hit the doubling cascade.
   */
  reserve( nodeCount: number, edgeCount: number ): void {
    const minCap = ( table: ColumnTable, adding: number ): number =>
      table.highWater + Math.max( 0, adding - table.freeCount );

    if( this.nodes.reserve( minCap( this.nodes, nodeCount ) ) ){
      this.dirty.markResized( 'nodes' );
    }

    if( this.edges.reserve( minCap( this.edges, edgeCount ) ) ){
      this.dirty.markResized( 'edges' );
    }
  }

  addNode( id: string, x: number, y: number, opts: AddElementOpts = {} ): number {
    const { slot, resized } = this.allocSlot( 'nodes', id );

    const pos = this.nodes.column( 'node.position' ) as Float32Array;

    pos[ slot * 2 ] = x;
    pos[ slot * 2 + 1 ] = y;
    this.geoEpoch++;

    ( this.nodes.column( 'node.flags' ) as Uint32Array )[ slot ] = initialFlags( opts, false );

    if( !resized ){ // resized already implies a full re-upload
      this.dirty.mark( 'node.position', slot );
      this.dirty.mark( 'node.flags', slot );
    }

    return slot;
  }

  addEdge( id: string, sourceId: string, targetId: string, opts: AddElementOpts = {} ): number {
    const source = this.ids.get( sourceId );
    const target = this.ids.get( targetId );

    if( source == null || source.group !== 'nodes' ){
      throw new Error( `Can not create edge '${id}' with nonexistant source '${sourceId}'` );
    }

    if( target == null || target.group !== 'nodes' ){
      throw new Error( `Can not create edge '${id}' with nonexistant target '${targetId}'` );
    }

    const { slot, resized } = this.allocSlot( 'edges', id );

    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

    endpoints[ slot * 2 ] = source.slot;
    endpoints[ slot * 2 + 1 ] = target.slot;

    ( this.edges.column( 'edge.flags' ) as Uint32Array )[ slot ] = initialFlags( opts, true );

    this.adj.addEdge( slot, source.slot, target.slot );
    this.maybeRebuildAdjacency();
    this.curves.onAddEdge( slot, source.slot, target.slot );

    if( !resized ){
      this.dirty.mark( 'edge.endpoints', slot );
      this.dirty.mark( 'edge.flags', slot );
    }

    return slot;
  }

  /**
   * Columnar bulk node add: typed-array columns write straight into the
   * store (one memcpy for the contiguous fresh run), with no per-element
   * def objects.  Returns the allocated slots, index-aligned with the
   * payload arrays.  On error the graph may be partially mutated (as with
   * a mid-list throw in the def path).
   */
  addNodesColumnar( cols: GpuColumnarNodes, newId: () => string ): Uint32Array {
    const count = cols.count;
    const { slots, resized, contiguousFrom } = this.nodes.allocBulk( count );

    if( resized ){ this.dirty.markResized( 'nodes' ); }

    this.registerBulk( 'nodes', slots, cols.ids, newId );

    const pos = this.nodes.column( 'node.position' ) as Float32Array;

    if( cols.positions != null ){
      if( cols.positions.length < count * 2 ){
        throw new Error( `Columnar node positions must hold ${count * 2} floats; got ${cols.positions.length}` );
      }

      if( contiguousFrom < count ){ // fresh run: one memcpy
        pos.set( cols.positions.subarray( contiguousFrom * 2, count * 2 ), slots[ contiguousFrom ] * 2 );
      }

      for( let i = 0; i < contiguousFrom; i++ ){ // reused slots: scattered
        pos[ slots[ i ] * 2 ] = cols.positions[ i * 2 ];
        pos[ slots[ i ] * 2 + 1 ] = cols.positions[ i * 2 + 1 ];
      }
    }

    this.geoEpoch++;
    this.writeBulkFlags( 'nodes', slots, contiguousFrom, cols );

    // parent column (round 14.8): payload indices, sentinel = orphan;
    // linked after the flags fill so the derived bits survive it
    if( cols.parent != null ){
      if( cols.parent.length < count ){
        throw new Error( `Columnar node parent column must hold ${count} entries; got ${cols.parent.length}` );
      }

      for( let i = 0; i < count; i++ ){
        const at = cols.parent[ i ];

        if( at === NO_PARENT ){ continue; }

        if( at >= count ){
          throw new Error(
            `Columnar node ${i} references parent index ${at} but the payload has ${count} nodes ` +
            `(columnar payloads are self-contained; use the definition form for cross-references)` );
        }

        this.setParent( slots[ i ], slots[ at ] ); // cycle-guarded (warn + drop)
      }
    }

    this.ingestDataColumns( 'nodes', slots, cols.data );

    if( !resized ){
      this.markBulk( 'node.position', slots );
      this.markBulk( 'node.flags', slots );
    }

    return slots;
  }

  /**
   * Columnar bulk edge add: endpoints are indices into `nodeSlots` (the
   * same payload's nodes) — no id lookups per edge.
   */
  addEdgesColumnar( cols: GpuColumnarEdges, nodeSlots: Uint32Array, newId: () => string ): Uint32Array {
    const count = cols.count;

    if( cols.sources == null || cols.targets == null || cols.sources.length < count || cols.targets.length < count ){
      throw new Error( `Columnar edges must provide ${count} sources and targets` );
    }

    for( let i = 0; i < count; i++ ){
      if( cols.sources[ i ] >= nodeSlots.length || cols.targets[ i ] >= nodeSlots.length ){
        throw new Error(
          `Columnar edge ${i} references node index ` +
          `${Math.max( cols.sources[ i ], cols.targets[ i ] )} but the payload has ${nodeSlots.length} nodes ` +
          `(columnar payloads are self-contained; use the definition form for cross-references)`
        );
      }
    }

    const { slots, resized, contiguousFrom } = this.edges.allocBulk( count );

    if( resized ){ this.dirty.markResized( 'edges' ); }

    this.registerBulk( 'edges', slots, cols.ids, newId );

    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

    for( let i = 0; i < count; i++ ){
      const slot = slots[ i ];
      const sourceSlot = nodeSlots[ cols.sources[ i ] ];
      const targetSlot = nodeSlots[ cols.targets[ i ] ];

      endpoints[ slot * 2 ] = sourceSlot;
      endpoints[ slot * 2 + 1 ] = targetSlot;

      // loop registration (and pair membership when the index is live)
      this.curves.onAddEdge( slot, sourceSlot, targetSlot );
    }

    // fresh index: builds CSR in two counting passes; otherwise overlays
    this.adj.addBulk( slots, endpoints, this.nodes.cap );
    this.maybeRebuildAdjacency();

    this.writeBulkFlags( 'edges', slots, contiguousFrom, cols );
    this.ingestDataColumns( 'edges', slots, cols.data );

    if( !resized ){
      this.markBulk( 'edge.endpoints', slots );
      this.markBulk( 'edge.flags', slots );
    }

    return slots;
  }

  removeEdge( slot: number ): void {
    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

    this.adj.removeEdge( slot, endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ] );
    this.curves.onRemoveEdge( slot, endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ] );
    this.freeSlot( 'edges', slot );
    this.maybeRebuildAdjacency();
  }

  /** Re-point an existing edge at new endpoint node slots (updates adjacency in place). */
  moveEdge( slot: number, source: number, target: number ): void {
    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;
    const oldSource = endpoints[ slot * 2 ];
    const oldTarget = endpoints[ slot * 2 + 1 ];

    if( oldSource === source && oldTarget === target ){ return; }

    this.adj.removeEdge( slot, oldSource, oldTarget );

    endpoints[ slot * 2 ] = source;
    endpoints[ slot * 2 + 1 ] = target;

    this.adj.addEdge( slot, source, target );
    this.maybeRebuildAdjacency();
    this.curves.onMoveEdge( slot, oldSource, oldTarget, source, target );
    this.geoEpoch++;
    this.dirty.mark( 'edge.endpoints', slot );
  }

  /** The node must have no incident edges or children left; the caller cascades removal of them first. */
  removeNode( slot: number ): void {
    if( this.adj.outDegree( slot ) > 0 || this.adj.inDegree( slot ) > 0 ){
      throw new Error( 'Can not remove a node before its incident edges' );
    }

    if( this.hierarchy.hasChildren( slot ) ){
      throw new Error( 'Can not remove a node before its children' );
    }

    this.hierarchy.onRemoveNode( slot );
    this.adj.clearNode( slot );
    this.polyPool.free( slot );
    this.setNodeImages( slot, null ); // releases registry refs too (15.2)
    this.freeSlot( 'nodes', slot );
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
  }

  /**
   * The hierarchy flush's write sink: derived parent geometry lands in
   * the real columns (position, size, outerHalf) with normal dirty
   * spans — but never re-marks the hierarchy, so a flush can not
   * re-trigger itself.  A size change re-anchors the parent's label
   * (the sidecar entry bakes anchors from the node extents) and feeds
   * the monotone cull-slack meter.
   */
  private materializeParentGeom( slot: number, x: number, y: number, w: number, h: number ): void {
    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    const size = this.nodes.column( 'node.size' ) as Float32Array;
    const posChanged = pos[ slot * 2 ] !== x || pos[ slot * 2 + 1 ] !== y;
    const sizeChanged = size[ slot * 2 ] !== w || size[ slot * 2 + 1 ] !== h;

    if( !posChanged && !sizeChanged ){ return; }

    if( posChanged ){
      pos[ slot * 2 ] = x;
      pos[ slot * 2 + 1 ] = y;
      this.dirty.mark( 'node.position', slot );
    }

    if( sizeChanged ){
      size[ slot * 2 ] = w;
      size[ slot * 2 + 1 ] = h;
      this.dirty.mark( 'node.size', slot );

      const half = Math.max( w, h ) / 2;

      if( half > this.nodeHalfMax ){ this.nodeHalfMax = half; }

      this.updateOuterHalf( slot );
      this.reanchorLabel( slot, w, h );

      // compound-loop excursion bounds are derivation-time (14.10):
      // refresh them for the resized parent's incident edges (the
      // geometry itself always evaluates from live sizes)
      const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;

      for( const edgeSlot of this.adj.connectedEdges( slot ) ){
        const a = endpoints[ edgeSlot * 2 ];
        const b = endpoints[ edgeSlot * 2 + 1 ];

        if( ( this.edges.column( 'edge.curveParams' ) as Float32Array )[ edgeSlot * 4 + 3 ] === CURVE_CMPD ){
          this.curves.invalidateRelation( a, b );
        }
      }
    }

    this.geoEpoch++;
  }

  /**
   * Re-derive a node label's anchor from new drawn extents.  The sidecar
   * entry carries enough to invert the StyleEngine's bake: halign/valign
   * reconstruct from the block-fraction shifts, and the anchor formulas
   * are the engine's own (see writeLabel) — no engine round trip needed.
   */
  private reanchorLabel( slot: number, w: number, h: number ): void {
    const entry = this.labels.nodes[ slot ];

    if( entry == null ){ return; }

    const halign = entry.halignShift * 2 + 1;
    const valign = entry.valignShift * 2 + 2;
    const anchorX = ( halign - 1 ) * w / 2;
    const anchorY = ( valign === 0 ? -h / 2 - LABEL_MARGIN
      : valign === 2 ? h / 2 + LABEL_MARGIN : 0 ) + entry.marginY;

    if( anchorX !== entry.anchorX || anchorY !== entry.anchorY ){
      this.setLabel( slot, { ...entry, anchorX, anchorY }, 'nodes' );
    }
  }

  /** Shift a parent's whole subtree by a delta (raw writes, one span). */
  private shiftSubtree( slot: number, dx: number, dy: number ): void {
    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    const stack: number[] = [];
    let min = Infinity;
    let max = -1;

    for( const kid of this.hierarchy.childrenOf( slot ) ){ stack.push( kid ); }

    while( stack.length > 0 ){
      const s = stack.pop() as number;

      pos[ s * 2 ] += dx;
      pos[ s * 2 + 1 ] += dy;

      if( s < min ){ min = s; }
      if( s > max ){ max = s; }

      for( const kid of this.hierarchy.childrenOf( s ) ){ stack.push( kid ); }
    }

    if( max >= 0 ){
      this.geoEpoch++;
      this.dirty.mark( 'node.position', min, max + 1 );
    }
  }

  /** Mark a node's ancestor chain (and its own derived bounds when it is
   * a parent) stale; flushed lazily by flushDerived(). */
  markNodeGeo( slot: number ): void {
    this.hierarchy.markGeo( slot );
  }

  /** Store a parent's compound style inputs (padding / min size); the
   * StyleEngine's write path in 14.6, and testable directly. */
  setCompoundStyle( slot: number, style: Partial<CompoundStyle> ): void {
    this.hierarchy.setCompoundStyle( slot, style );
  }

  /** The parent's resolved px padding (0 for leaves); flush first. */
  paddingOf( slot: number ): number {
    this.flushDerived();

    return this.hierarchy.paddingOf( slot );
  }

  /** The declared compound style record (the style readbacks' truth). */
  compoundStyleOf( slot: number ): CompoundStyle {
    return this.hierarchy.compoundStyleOf( slot );
  }

  /**
   * Link a node under a parent node slot (-1 to orphan).  Cycle-safe:
   * a link that would make the node its own ancestor warns and no-ops
   * (v3's dropped-ref rule).  Maintains FLAG_PARENT/FLAG_CHILD, depths
   * and the parent draw permutation.
   */
  setParent( slot: number, parentSlot: number ): void {
    const before = this.hierarchy.parentOf( slot );

    this.hierarchy.setParent( slot, parentSlot );

    if( this.hierarchy.parentOf( slot ) === before ){ return; } // no-op or cycle drop

    // the moved subtree's ancestor-derived state re-resolves against the
    // new chain (round 14.4): effective visibility and the opacity fold
    this.refreshEffectiveVisibility( slot );
    this.refoldOpacitySubtree( slot );

    // structural case conditions on the moved node re-evaluate (14.7)
    this.onReparented?.( slot );

    // compound-loop routing (14.10): the moved subtree's incident edges
    // may have entered or left an ancestor/descendant relation
    this.invalidateSubtreeEdgeRelations( slot );
  }

  /** Re-derive curve routing for every edge incident to a subtree (14.10). */
  private invalidateSubtreeEdgeRelations( root: number ): void {
    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;
    const stack: number[] = [ root ];

    while( stack.length > 0 ){
      const slot = stack.pop() as number;

      for( const edgeSlot of this.adj.connectedEdges( slot ) ){
        this.curves.invalidateRelation( endpoints[ edgeSlot * 2 ], endpoints[ edgeSlot * 2 + 1 ] );
      }

      for( const kid of this.hierarchy.childrenOf( slot ) ){ stack.push( kid ); }
    }
  }

  /**
   * show()/hide() (round 14.4): FLAG_SELF_HIDDEN records the element's
   * own state; the effective FLAG_VISIBLE recomputes over affected node
   * subtrees (pruned — an unchanged effective bit means an unchanged
   * subtree).  Hidden children leave their ancestors' auto-bounds.
   * Returns the refs-array indices whose own state changed.
   */
  setVisibility( refs: readonly Ref[], visible: boolean, changedIdx: number[] | null = null ): number {
    const changed: number[] = changedIdx ?? [];
    const n = this.flagRefs( refs, FLAG_SELF_HIDDEN, !visible, 0, changed );

    for( const i of changed ){
      const ref = refs[ i ];

      if( ref.group === 'edges' ){
        // edges have no ancestors: effective = own state
        this.setFlag( 'edges', ref.slot, FLAG_VISIBLE, visible );
      } else {
        this.refreshEffectiveVisibility( ref.slot );
      }
    }

    return n;
  }

  /**
   * Recompute effective FLAG_VISIBLE for a node subtree, top-down with
   * pruning: a node whose effective bit is unchanged has consistent
   * descendants (their inputs did not move).  A changed node marks its
   * ancestor chain's auto-bounds stale (it entered or left the bb).
   */
  private refreshEffectiveVisibility( root: number ): void {
    const flags = this.nodes.column( 'node.flags' ) as Uint32Array;
    const stack: number[] = [ root ];

    while( stack.length > 0 ){
      const slot = stack.pop() as number;
      const p = this.hierarchy.parentOf( slot );
      const parentEff = p < 0 || ( flags[ p ] & FLAG_VISIBLE ) !== 0;
      const eff = parentEff
        && ( flags[ slot ] & FLAG_SELF_HIDDEN ) === 0
        && ( flags[ slot ] & FLAG_ALIVE ) !== 0;
      const cur = ( flags[ slot ] & FLAG_VISIBLE ) !== 0;

      if( eff === cur ){ continue; }

      flags[ slot ] = eff ? ( flags[ slot ] | FLAG_VISIBLE ) : ( flags[ slot ] & ~FLAG_VISIBLE );
      this.dirty.mark( 'node.flags', slot );
      this.geoEpoch++;
      this.hierarchy.markGeo( slot );

      for( const kid of this.hierarchy.childrenOf( slot ) ){ stack.push( kid ); }
    }
  }

  // -- effective opacity (round 14.4) --

  /** Bases of nodes whose stored opacity carries an ancestor fold
   * (absent = the column holds the base). */
  private opacityBase = new Map<number, number>();

  /** The node's declared (pre-fold) opacity — what style('opacity') reads. */
  baseOpacityOf( slot: number ): number {
    return this.opacityBase.get( slot )
      ?? ( this.nodes.column( 'node.opacity' ) as Float32Array )[ slot ];
  }

  /** The product of the strict ancestors' bases. */
  private ancestorOpacityProduct( slot: number ): number {
    let product = 1;

    for( let p = this.hierarchy.parentOf( slot ); p >= 0; p = this.hierarchy.parentOf( p ) ){
      product *= this.baseOpacityOf( p );
    }

    return product;
  }

  /**
   * A node opacity write under compounds: `base` is the declared value;
   * the stored column takes base x the ancestor product (v3's rendered
   * effectiveOpacity), and a parent's write refolds its subtree.
   */
  private writeBaseOpacity( slot: number, base: number ): void {
    const col = this.nodes.column( 'node.opacity' ) as Float32Array;
    const product = this.ancestorOpacityProduct( slot );
    const folded = base * product;

    if( product !== 1 ){ this.opacityBase.set( slot, base ); }
    else { this.opacityBase.delete( slot ); }

    if( col[ slot ] !== folded ){
      col[ slot ] = folded;
      this.dirty.mark( 'node.opacity', slot );
    }

    if( this.hierarchy.childrenOf( slot ).length > 0 ){
      this.refoldChildren( slot, base * product );
    }
  }

  /** Refold a whole subtree against its (possibly new) ancestor chain. */
  private refoldOpacitySubtree( slot: number ): void {
    this.writeBaseOpacity( slot, this.baseOpacityOf( slot ) );
  }

  /** Recursive half of the fold: children of a node whose folded value is `parentFolded`. */
  private refoldChildren( slot: number, parentFolded: number ): void {
    const col = this.nodes.column( 'node.opacity' ) as Float32Array;

    for( const kid of this.hierarchy.childrenOf( slot ) ){
      const base = this.baseOpacityOf( kid );
      const folded = base * parentFolded;

      if( parentFolded !== 1 ){ this.opacityBase.set( kid, base ); }
      else { this.opacityBase.delete( kid ); }

      if( col[ kid ] !== folded ){
        col[ kid ] = folded;
        this.dirty.mark( 'node.opacity', kid );
      }

      this.refoldChildren( kid, folded );
    }
  }

  /** The node's parent slot, or -1 for orphans. */
  parentOf( slot: number ): number {
    return this.hierarchy.parentOf( slot );
  }

  /** The node's child slots in link order (read-only; empty for leaves). */
  childrenOf( slot: number ): readonly number[] {
    return this.hierarchy.childrenOf( slot );
  }

  /** Nesting depth (0 = top-level). */
  depthOf( slot: number ): number {
    return this.hierarchy.depthOf( slot );
  }

  /** True when `ancestor` is on `slot`'s parent chain (not reflexive). */
  isAncestorOf( ancestor: number, slot: number ): boolean {
    return this.hierarchy.isAncestorOf( ancestor, slot );
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

  getX( slot: number ): number {
    return ( this.nodes.column( 'node.position' ) as Float32Array )[ slot * 2 ];
  }

  getY( slot: number ): number {
    return ( this.nodes.column( 'node.position' ) as Float32Array )[ slot * 2 + 1 ];
  }

  setPosition( slot: number, x: number, y: number ): void {
    const pos = this.nodes.column( 'node.position' ) as Float32Array;

    if( this.hierarchy.hasCompounds() ){
      const flags = ( this.nodes.column( 'node.flags' ) as Uint32Array )[ slot ];

      if( ( flags & FLAG_PARENT ) !== 0 ){
        // the delta is against the parent's *derived* position, so any
        // pending auto-bounds settle first (materialize never re-enters
        // setPosition, so this can not recurse)
        this.hierarchy.flush();

        // v3's beforePositionSet: moving a parent shifts its subtree by
        // the delta; the parent's own derived value then equals the
        // written position exactly (uniform translation), so only its
        // ancestors re-derive
        const dx = x - pos[ slot * 2 ];
        const dy = y - pos[ slot * 2 + 1 ];

        if( dx !== 0 || dy !== 0 ){ this.shiftSubtree( slot, dx, dy ); }
      }

      if( ( flags & FLAG_CHILD ) !== 0 ){ this.hierarchy.markAncestors( slot ); }
    }

    pos[ slot * 2 ] = x;
    pos[ slot * 2 + 1 ] = y;
    this.geoEpoch++;

    this.dirty.mark( 'node.position', slot );
  }

  /** Bulk position write (e.g. from a layout): one coalesced dirty span.
   * With compounds, each slot takes the sequential setPosition semantics
   * (a parent's write shifts its subtree first — v3's per-element order). */
  setPositions( slots: number[], xy: number[] | Float32Array ): void {
    if( slots.length === 0 ){ return; }

    if( this.hierarchy.hasCompounds() ){
      for( let i = 0; i < slots.length; i++ ){
        this.setPosition( slots[ i ], xy[ i * 2 ], xy[ i * 2 + 1 ] );
      }

      return;
    }

    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    let min = Infinity;
    let max = -Infinity;

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];

      pos[ slot * 2 ] = xy[ i * 2 ];
      pos[ slot * 2 + 1 ] = xy[ i * 2 + 1 ];

      min = Math.min( min, slot );
      max = Math.max( max, slot );
    }

    this.geoEpoch++;
    this.dirty.mark( 'node.position', min, max + 1 );
  }

  /**
   * Bulk constant/axis position write over node slots: sets x and/or y
   * (null leaves that axis unchanged) with one coalesced dirty span.
   */
  setPositionsConst( slots: ArrayLike<number>, x: number | null, y: number | null ): void {
    if( slots.length === 0 || ( x == null && y == null ) ){ return; }

    const pos = this.nodes.column( 'node.position' ) as Float32Array;

    if( this.hierarchy.hasCompounds() ){
      this.hierarchy.flush(); // the kept axis reads derived parent positions

      for( let i = 0; i < slots.length; i++ ){
        const slot = slots[ i ];

        this.setPosition(
          slot,
          x ?? pos[ slot * 2 ],
          y ?? pos[ slot * 2 + 1 ]
        );
      }

      return;
    }
    let min = Infinity;
    let max = -1;

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];

      if( x != null ){ pos[ slot * 2 ] = x; }
      if( y != null ){ pos[ slot * 2 + 1 ] = y; }

      if( slot < min ){ min = slot; }
      if( slot > max ){ max = slot; }
    }

    this.geoEpoch++;
    this.dirty.mark( 'node.position', min, max + 1 );
  }

  /** Bulk position offset over node slots: one coalesced dirty span.
   * With compounds, v3's shift dedupe applies: a slot whose ancestor is
   * also in the set is skipped (the ancestor's subtree shift moves it). */
  shiftPositions( slots: ArrayLike<number>, dx: number, dy: number ): void {
    if( slots.length === 0 ){ return; }

    if( this.hierarchy.hasCompounds() ){
      this.hierarchy.flush(); // offsets apply to derived parent positions

      const inSet = new Set<number>();

      for( let i = 0; i < slots.length; i++ ){ inSet.add( slots[ i ] ); }

      const pos = this.nodes.column( 'node.position' ) as Float32Array;

      for( let i = 0; i < slots.length; i++ ){
        const slot = slots[ i ];
        let ancestorInSet = false;

        for( let p = this.hierarchy.parentOf( slot ); p >= 0; p = this.hierarchy.parentOf( p ) ){
          if( inSet.has( p ) ){ ancestorInSet = true; break; }
        }

        if( ancestorInSet ){ continue; }

        this.setPosition( slot, pos[ slot * 2 ] + dx, pos[ slot * 2 + 1 ] + dy );
      }

      return;
    }

    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    let min = Infinity;
    let max = -1;

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];

      pos[ slot * 2 ] += dx;
      pos[ slot * 2 + 1 ] += dy;

      if( slot < min ){ min = slot; }
      if( slot > max ){ max = slot; }
    }

    this.geoEpoch++;
    this.dirty.mark( 'node.position', min, max + 1 );
  }

  // -- flags --

  flags( group: GroupName, slot: number ): number {
    const id: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';

    return ( this.table( group ).column( id ) as Uint32Array )[ slot ];
  }

  hasFlag( group: GroupName, slot: number, bit: number ): boolean {
    return ( this.flags( group, slot ) & bit ) !== 0;
  }

  setFlag( group: GroupName, slot: number, bit: number, on: boolean ): void {
    const id: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';
    const arr = this.table( group ).column( id ) as Uint32Array;
    const prev = arr[ slot ];
    const next = on ? ( prev | bit ) : ( prev & ~bit );

    if( next === prev ){ return; }

    arr[ slot ] = next;
    this.dirty.mark( id, slot );
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
    refs: readonly Ref[], bit: number, on: boolean,
    requireBit = 0, changedIdx: number[] | null = null
  ): number {
    const nodeFlags = this.nodes.column( 'node.flags' ) as Uint32Array;
    const edgeFlags = this.edges.column( 'edge.flags' ) as Uint32Array;
    const nodeGen = this.nodes.gen;
    const edgeGen = this.edges.gen;
    let nMin = Infinity;
    let nMax = -1;
    let eMin = Infinity;
    let eMax = -1;
    let changed = 0;

    for( let i = 0; i < refs.length; i++ ){
      const ref = refs[ i ];
      const slot = ref.slot;
      const isNode = ref.group === 'nodes';
      const gen = isNode ? nodeGen : edgeGen;

      if( gen[ slot ] !== ref.gen ){ continue; }

      const flags = isNode ? nodeFlags : edgeFlags;
      const prev = flags[ slot ];

      if( requireBit !== 0 && ( prev & requireBit ) === 0 ){ continue; }

      const next = on ? ( prev | bit ) : ( prev & ~bit );

      if( next === prev ){ continue; }

      flags[ slot ] = next;
      changed++;

      if( isNode ){
        if( slot < nMin ){ nMin = slot; }
        if( slot > nMax ){ nMax = slot; }
      } else {
        if( slot < eMin ){ eMin = slot; }
        if( slot > eMax ){ eMax = slot; }
      }

      if( changedIdx != null ){ changedIdx.push( i ); }
    }

    if( nMax >= 0 ){ this.dirty.mark( 'node.flags', nMin, nMax + 1 ); }
    if( eMax >= 0 ){ this.dirty.mark( 'edge.flags', eMin, eMax + 1 ); }

    return changed;
  }

  // -- style channel writers --

  setScalar( id: ColumnId, slot: number, value: number ): void {
    // round 14.4: under compounds a node opacity write is a *base* —
    // the column stores the ancestor-folded product
    if( id === 'node.opacity' && this.hierarchy.hasCompounds() ){
      this.writeBaseOpacity( slot, value );

      return;
    }

    const spec = columnSpec( id );
    const arr = this.table( spec.group ).column( id ) as Float32Array | Uint32Array;

    if( id === 'node.borderWidth' && value > this.borderMax ){ this.borderMax = value; }

    if( arr[ slot ] === value ){ return; }

    arr[ slot ] = value;
    this.geoEpoch++;
    this.dirty.mark( id, slot );

    if( id === 'node.borderWidth' ){
      this.updateOuterHalf( slot );

      // a border write changes the node's outer extent: stale ancestors
      if( this.hierarchy.hasCompounds() ){ this.hierarchy.markGeo( slot ); }
    }
  }

  setPair( id: ColumnId, slot: number, a: number, b: number ): void {
    const spec = columnSpec( id );
    const arr = this.table( spec.group ).column( id ) as Float32Array | Uint32Array;

    if( id === 'node.size' ){
      const half = Math.max( a, b ) / 2;

      if( half > this.nodeHalfMax ){ this.nodeHalfMax = half; }

      // a style size write on a parent updates the stashed fallback
      // (auto-bounds owns the column and re-derives over the clobber);
      // tracked before the no-op check so the stash never goes stale
      if( this.parentFallback.has( slot ) ){ this.parentFallback.set( slot, [ a, b ] ); }
    }

    if( arr[ slot * 2 ] === a && arr[ slot * 2 + 1 ] === b ){ return; }

    arr[ slot * 2 ] = a;
    arr[ slot * 2 + 1 ] = b;
    this.geoEpoch++;
    this.dirty.mark( id, slot );

    if( id === 'node.size' ){
      this.updateOuterHalf( slot );

      // stale ancestors (and the parent's own derived size, if any)
      if( this.hierarchy.hasCompounds() ){ this.hierarchy.markGeo( slot ); }
    }
  }

  /**
   * Write-through for the derived node.outerHalf column (size/2 +
   * borderWidth/2 per axis — see the contract): follows every size/border
   * write, so the column is never stale.  The curve shaders and the CPU
   * curve evaluator both read this column, so the two sides agree on the
   * exact f32 half-extents by construction.
   */
  private updateOuterHalf( slot: number ): void {
    const size = this.nodes.column( 'node.size' ) as Float32Array;
    const border = this.nodes.column( 'node.borderWidth' ) as Float32Array;
    const outer = this.nodes.column( 'node.outerHalf' ) as Float32Array;
    const halfBorder = border[ slot ] / 2;

    outer[ slot * 2 ] = size[ slot * 2 ] / 2 + halfBorder;
    outer[ slot * 2 + 1 ] = size[ slot * 2 + 1 ] / 2 + halfBorder;
    this.dirty.mark( 'node.outerHalf', slot );
  }

  // -- ghosts (round 13 A1) --

  /** live count of ghost-enabled nodes (the renderer skips the ghost
   * cull + draw entirely while this is 0) */
  private ghosts = 0;

  ghostCount(): number {
    return this.ghosts;
  }

  /**
   * Write a node's ghost record [offsetX, offsetY, ghostOpacity,
   * enabled] (the StyleEngine's write path).  Offsets are geometry —
   * they grow the bb scans — so writes bump the geometry epoch.
   */
  setGhost( slot: number, offX: number, offY: number, opacity: number, enabled: boolean ): void {
    const arr = this.nodes.column( 'node.ghost' ) as Float32Array;
    const at = slot * 4;
    const en = enabled ? 1 : 0;

    if( arr[ at ] === offX && arr[ at + 1 ] === offY &&
        arr[ at + 2 ] === opacity && arr[ at + 3 ] === en ){ return; }

    if( en !== arr[ at + 3 ] ){ this.ghosts += en === 1 ? 1 : -1; }

    arr[ at ] = offX;
    arr[ at + 1 ] = offY;
    arr[ at + 2 ] = opacity;
    arr[ at + 3 ] = en;
    this.geoEpoch++;
    this.dirty.mark( 'node.ghost', slot );
  }

  // -- overlay / underlay (round 13 A2) --

  private overlays = 0;
  private underlays = 0;

  overlayCount(): number { return this.overlays; }
  underlayCount(): number { return this.underlays; }

  /**
   * Write a node's overlay or underlay record (the StyleEngine's write
   * path): [rgba (opacity folded), padding×256, shape, radius×256 |
   * 0xffffffff = auto].  Padding is geometry (it grows the bb scans),
   * so writes bump the geometry epoch.
   */
  setNodeLayer(
    id: 'node.overlay' | 'node.underlay', slot: number,
    rgba: number, padding: number, shape: number, radius: number
  ): void {
    const arr = this.nodes.column( id ) as Uint32Array;
    const at = slot * 4;
    const pad = Math.max( 0, Math.round( padding * 256 ) );
    const rad = radius < 0 ? 0xffffffff : Math.max( 0, Math.round( radius * 256 ) );

    if( arr[ at ] === rgba && arr[ at + 1 ] === pad &&
        arr[ at + 2 ] === shape && arr[ at + 3 ] === rad ){ return; }

    const wasOn = arr[ at ] >>> 24 !== 0;
    const isOn = rgba >>> 24 !== 0;

    if( wasOn !== isOn ){
      const d = isOn ? 1 : -1;

      if( id === 'node.overlay' ){ this.overlays += d; } else { this.underlays += d; }
    }

    arr[ at ] = rgba;
    arr[ at + 1 ] = pad;
    arr[ at + 2 ] = shape;
    arr[ at + 3 ] = rad;
    this.geoEpoch++;
    this.dirty.mark( id, slot );
  }

  private edgeOverlays = 0;
  private edgeUnderlays = 0;
  private casings = 0;

  edgeOverlayCount(): number { return this.edgeOverlays; }
  edgeUnderlayCount(): number { return this.edgeUnderlays; }
  casingCount(): number { return this.casings; }

  /**
   * Write an edge's overlay or underlay record (round 13 A2):
   * [rgba (opacity folded), strokeWidth×256] — the stroke width is the
   * edge width + 2 × padding, derived at style-write time.
   */
  setEdgeLayer(
    id: 'edge.overlay' | 'edge.underlay' | 'edge.casing', slot: number,
    rgba: number, strokeWidth: number
  ): void {
    const arr = this.edges.column( id ) as Uint32Array;
    const at = slot * 2;
    const sw = Math.max( 0, Math.round( strokeWidth * 256 ) );

    if( arr[ at ] === rgba && arr[ at + 1 ] === sw ){ return; }

    const wasOn = arr[ at ] >>> 24 !== 0;
    const isOn = rgba >>> 24 !== 0;

    if( wasOn !== isOn ){
      const d = isOn ? 1 : -1;

      if( id === 'edge.overlay' ){ this.edgeOverlays += d; }
      else if( id === 'edge.underlay' ){ this.edgeUnderlays += d; }
      else { this.casings += d; }
    }

    arr[ at ] = rgba;
    arr[ at + 1 ] = sw;
    this.dirty.mark( id, slot );
  }

  /** live count of edges with any visible mid arrow (round 13 C1) —
   * the renderer skips the mid draws entirely while 0 */
  private midArrows = 0;

  midArrowCount(): number {
    return this.midArrows;
  }

  /** setColor wrapper for the mid-arrow columns that keeps the count. */
  setMidArrow(
    id: 'edge.midSourceArrow' | 'edge.midTargetArrow', slot: number,
    r: number, g: number, b: number, a: number, otherId: 'edge.midSourceArrow' | 'edge.midTargetArrow'
  ): void {
    const arr = this.edges.column( id ) as Uint8Array;
    const other = this.edges.column( otherId ) as Uint8Array;
    const wasOn = arr[ slot * 4 + 3 ] > 0 || other[ slot * 4 + 3 ] > 0;

    this.setColor( id, slot, r, g, b, a );

    const isOn = a > 0 || other[ slot * 4 + 3 ] > 0;

    if( wasOn !== isOn ){ this.midArrows += isOn ? 1 : -1; }
  }

  /** monotone (round 13 B7): the largest arrow-scale any edge styles —
   * the arrow quads size for it and the FS renders the exact scale */
  private arrowScaleMaxV = 1;

  arrowScaleMax(): number {
    return this.arrowScaleMaxV;
  }

  noteArrowScale( scale: number ): void {
    if( scale > this.arrowScaleMaxV ){ this.arrowScaleMaxV = scale; }
  }

  /** monotone (round 13 B5): the largest outline outward extent any
   * node has styled — the ghost cull grows by it (no binding left for
   * the packed geometry there) */
  private outlineSlackMax = 0;

  outlineSlack(): number {
    return this.outlineSlackMax;
  }

  /**
   * Write a node's border/corner/outline record (rounds 13 B2/B5):
   * cornerRadius model px (-1 = auto), borderPosition id, the outline
   * rgba (opacity pre-folded) and outline width/offset (model px,
   * u16 fixed-point).  Corner radius and outline extents are geometry
   * (pick + bb read them), so writes bump the geometry epoch.
   */
  setBorderGeom(
    slot: number, cornerRadius: number, borderPos: number,
    outlineRgba: number, outlineWidth: number, outlineOffset: number,
    shapeId: number = 0, polyRef: number = 0
  ): void {
    const arr = this.nodes.column( 'node.borderGeom' ) as Uint32Array;
    const at = slot * 4;
    // C3: custom polygons carry their point-record ref (from
    // setPolygonPoints) in the radius word — the corner radius is
    // meaningless for polygons
    const rad = shapeId === 14
      ? polyRef >>> 0
      : cornerRadius < 0 ? 0xffffffff : Math.max( 0, Math.round( cornerRadius * 256 ) );
    // C2: the node FS reads the shape from bits 16..19 (its shapes
    // binding went to the gradient column)
    const posShape = ( borderPos | ( shapeId << 16 ) ) >>> 0;

    borderPos = posShape;
    const packedWO =
      ( Math.min( 0xffff, Math.max( 0, Math.round( outlineOffset * 256 ) ) ) << 16 ) |
      Math.min( 0xffff, Math.max( 0, Math.round( outlineWidth * 256 ) ) );

    if( outlineRgba >>> 24 !== 0 ){
      const slack = outlineOffset / 2 + outlineWidth;

      if( slack > this.outlineSlackMax ){ this.outlineSlackMax = slack; }
    }

    if( arr[ at ] === rad && arr[ at + 1 ] === borderPos &&
        arr[ at + 2 ] === outlineRgba && arr[ at + 3 ] === packedWO ){ return; }

    arr[ at ] = rad;
    arr[ at + 1 ] = borderPos;
    arr[ at + 2 ] = outlineRgba;
    arr[ at + 3 ] = packedWO;
    this.geoEpoch++;
    this.dirty.mark( 'node.borderGeom', slot );
  }

  private gradients = 0;

  gradientCount(): number {
    return this.gradients;
  }

  /**
   * Write a gradient record (round 13 C2): kind 0 clears; stops are
   * [rgba, pos-fraction] pairs, capped at 5 by the style layer.
   */
  setGradient(
    id: 'node.gradient' | 'edge.gradient', slot: number,
    kind: number, dir: number, stops: { rgba: number; pos: number }[]
  ): void {
    const arr = this.table( columnSpec( id ).group ).column( id ) as Uint32Array;
    const at = slot * 8;
    const count = Math.min( stops.length, 5 );
    const meta = kind === 0 ? 0 : ( kind | ( dir << 2 ) | ( count << 5 ) ) >>> 0;
    const words = [ meta, 0, 0, 0, 0, 0, 0, 0 ];

    for( let i = 0; i < count; i++ ){
      words[ 1 + i ] = stops[ i ].rgba;
    }

    let pos03 = 0;

    for( let i = 0; i < Math.min( count, 4 ); i++ ){
      pos03 |= Math.max( 0, Math.min( 255, Math.round( stops[ i ].pos * 255 ) ) ) << ( i * 8 );
    }

    words[ 6 ] = pos03 >>> 0;
    words[ 7 ] = count > 4 ? Math.max( 0, Math.min( 255, Math.round( stops[ 4 ].pos * 255 ) ) ) : 0;

    let changed = false;

    for( let i = 0; i < 8; i++ ){
      if( arr[ at + i ] !== words[ i ] ){ changed = true; break; }
    }

    if( !changed ){ return; }

    const wasOn = arr[ at ] !== 0;
    const isOn = meta !== 0;

    if( wasOn !== isOn ){ this.gradients += isOn ? 1 : -1; }

    for( let i = 0; i < 8; i++ ){ arr[ at + i ] = words[ i ]; }

    this.dirty.mark( id, slot );
  }

  /** Four-component f32 write (dash patterns etc.). */
  setVec4( id: ColumnId, slot: number, a: number, b: number, c: number, d: number ): void {
    const arr = this.table( columnSpec( id ).group ).column( id ) as Float32Array;
    const at = slot * 4;

    if( arr[ at ] === a && arr[ at + 1 ] === b && arr[ at + 2 ] === c && arr[ at + 3 ] === d ){
      return;
    }

    arr[ at ] = a;
    arr[ at + 1 ] = b;
    arr[ at + 2 ] = c;
    arr[ at + 3 ] = d;
    this.dirty.mark( id, slot );
  }

  /** RGBA bytes on [0, 255]. */
  setColor( id: ColumnId, slot: number, r: number, g: number, b: number, a: number ): void {
    const spec = columnSpec( id );
    const arr = this.table( spec.group ).column( id ) as Uint8Array;
    const at = slot * 4;

    if( arr[ at ] === r && arr[ at + 1 ] === g && arr[ at + 2 ] === b && arr[ at + 3 ] === a ){ return; }

    arr[ at ] = r;
    arr[ at + 1 ] = g;
    arr[ at + 2 ] = b;
    arr[ at + 3 ] = a;
    this.dirty.mark( id, slot );
  }

  // -- curves (round 12a; derivation in store/curve-index.mts) --

  /**
   * Store an edge's styled curve record (the StyleEngine's write path);
   * the derived edge.curveParams re-derive lazily via the CurveIndex.
   * `extras` carries the 12b family lists/params (null for
   * straight/bezier styles).
   */
  setCurveStyle(
    slot: number, style: number, stepSize: number, weight: number,
    loopDirection: number, loopSweep: number, extras: CurveStyleExtras | null = null,
    haystackRadius: number = 0, endpoints: EndpointSpec | null = null
  ): void {
    this.curves.setStyle(
      slot, style, stepSize, weight, loopDirection, loopSweep, extras, haystackRadius, endpoints );
  }

  /** The styled curve record — the stored truth the style getters read. */
  curveStyleAt( slot: number ): ReturnType<CurveIndex['styleAt']> {
    return this.curves.styleAt( slot );
  }

  /**
   * The derived curve params [p0, p1, p2, kind] for one edge, with any
   * pending derivation flushed first (the accessors' read path).
   */
  curveParamsAt( slot: number ): [ number, number, number, number ] {
    this.flushDerived();

    const params = this.edges.column( 'edge.curveParams' ) as Float32Array;
    const at = slot * 4;

    return [ params[ at ], params[ at + 1 ], params[ at + 2 ], params[ at + 3 ] ];
  }

  /**
   * Evaluate one curved edge's geometry from the live columns (null for
   * straight edges).  The returned object is a shared scratch unless
   * `out` is given — consume it before the next call.  This is the CPU
   * twin of the curve vertex shader: same params, same boundary math,
   * same frame (see curve-geometry.mts).
   */
  curveEvalAt( slot: number, out: CurveEval = this.curveScratch ): CurveEval | null {
    this.flushDerived();

    const params = this.edges.column( 'edge.curveParams' ) as Float32Array;
    const at = slot * 4;
    const kind = params[ at + 3 ];

    // blob-backed kinds evaluate as routes (curveRouteAt), not CurveEvals
    if( kind !== CURVE_BEZIER && kind !== CURVE_LOOP && kind !== CURVE_CMPD ){ return null; }

    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;
    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    const outer = this.nodes.column( 'node.outerHalf' ) as Float32Array;
    const shape = this.nodes.column( 'node.shape' ) as Uint32Array;
    const s = endpoints[ at / 2 ];
    const t = endpoints[ at / 2 + 1 ];

    // the derived outerHalf column (size/2 + border/2) is what the WGSL
    // twin binds, so both sides read the exact same f32 half-extents
    return evalCurve(
      out, kind, params[ at ], params[ at + 1 ], params[ at + 2 ],
      pos[ s * 2 ], pos[ s * 2 + 1 ],
      outer[ s * 2 ], outer[ s * 2 + 1 ], shape[ s ],
      pos[ t * 2 ], pos[ t * 2 + 1 ],
      outer[ t * 2 ], outer[ t * 2 + 1 ], shape[ t ]
    );
  }

  /**
   * Evaluate a blob-backed curved edge's route from the live columns
   * (null for straight/bezier/loop edges — those use curveEvalAt).
   * The returned object is a shared scratch unless `out` is given.
   * The CPU twin of the 12b route vertex shader: same blob record,
   * same outerHalf frame, same routing (see curve-geometry.mts).
   */
  curveRouteAt( slot: number, out: CurveRoute = this.routeScratch ): CurveRoute | null {
    this.flushDerived();

    const params = this.edges.column( 'edge.curveParams' ) as Float32Array;
    const at = slot * 4;
    const kind = params[ at + 3 ];
    const base = kind >= CURVE_HAS_ENDPT ? kind - CURVE_HAS_ENDPT : kind; // 12c endpoint blocks

    if( base !== CURVE_MULTI && base !== CURVE_SEGMENTS && base !== CURVE_TAXI ){ return null; }

    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;
    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    const outer = this.nodes.column( 'node.outerHalf' ) as Float32Array;
    const shape = this.nodes.column( 'node.shape' ) as Uint32Array;
    const s = endpoints[ at / 2 ];
    const t = endpoints[ at / 2 + 1 ];

    return evalRoute(
      out, kind, this.blob.data(), params[ at ], params[ at + 2 ],
      pos[ s * 2 ], pos[ s * 2 + 1 ], outer[ s * 2 ], outer[ s * 2 + 1 ], shape[ s ],
      pos[ t * 2 ], pos[ t * 2 + 1 ], outer[ t * 2 ], outer[ t * 2 + 1 ], shape[ t ]
    );
  }

  /**
   * The haystack endpoint pair of an edge (12c; null unless the edge's
   * derived kind is CURVE_HAYSTACK): the hash-stable offset points
   * inside each node body, computed from the params column + live
   * positions/outer halves — the CPU twin of the straight edge
   * shader's haystack branch.
   */
  haystackPointsAt(
    slot: number
  ): { sx: number; sy: number; tx: number; ty: number } | null {
    this.flushDerived();

    const params = this.edges.column( 'edge.curveParams' ) as Float32Array;
    const at = slot * 4;

    if( params[ at + 3 ] !== CURVE_HAYSTACK ){ return null; }

    const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;
    const pos = this.nodes.column( 'node.position' ) as Float32Array;
    const outer = this.nodes.column( 'node.outerHalf' ) as Float32Array;
    const sN = endpoints[ slot * 2 ];
    const tN = endpoints[ slot * 2 + 1 ];
    const radius = params[ at + 2 ];
    const p = { x: 0, y: 0 };

    haystackPoint(
      pos[ sN * 2 ], pos[ sN * 2 + 1 ], outer[ sN * 2 ], outer[ sN * 2 + 1 ],
      params[ at ], radius, p );

    const sx = p.x, sy = p.y;

    haystackPoint(
      pos[ tN * 2 ], pos[ tN * 2 + 1 ], outer[ tN * 2 ], outer[ tN * 2 + 1 ],
      params[ at + 1 ], radius, p );

    return { sx, sy, tx: p.x, ty: p.y };
  }

  /**
   * The exact bounding box of a curved edge (null for straight ones):
   * the flattened polyline at the drawn subdivision, memoized per slot
   * against the geometry epoch — the "exact lazy CPU eval" tier of the
   * expensive-geometry design (public `.bb()` reads this; fit and cull
   * use the conservative bounds instead).
   */
  curveBBAt( slot: number ): { x1: number; y1: number; x2: number; y2: number } | null {
    const ev = this.curveEvalAt( slot );
    const route = ev == null ? this.curveRouteAt( slot ) : null;

    if( ev == null && route == null ){ return null; }

    if( this.edgeBBEpoch.length < this.edges.cap ){
      const epochs = new Uint32Array( this.edges.cap );
      const boxes = new Float64Array( this.edges.cap * 4 );

      epochs.set( this.edgeBBEpoch );
      boxes.set( this.edgeBB );
      this.edgeBBEpoch = epochs;
      this.edgeBB = boxes;
    }

    const at = slot * 4;

    if( this.edgeBBEpoch[ slot ] === this.geoEpoch ){
      return {
        x1: this.edgeBB[ at ], y1: this.edgeBB[ at + 1 ],
        x2: this.edgeBB[ at + 2 ], y2: this.edgeBB[ at + 3 ]
      };
    }

    const p = { x: 0, y: 0 };
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

    for( let i = 0; i <= CURVE_SEGS; i++ ){
      if( ev != null ){
        curvePointAt( ev, i / CURVE_SEGS, p );
      } else {
        routeVertex( route as CurveRoute, i, p );
      }

      if( p.x < x1 ){ x1 = p.x; }
      if( p.y < y1 ){ y1 = p.y; }
      if( p.x > x2 ){ x2 = p.x; }
      if( p.y > y2 ){ y2 = p.y; }
    }

    this.edgeBBEpoch[ slot ] = this.geoEpoch;
    this.edgeBB[ at ] = x1;
    this.edgeBB[ at + 1 ] = y1;
    this.edgeBB[ at + 2 ] = x2;
    this.edgeBB[ at + 3 ] = y2;

    return { x1, y1, x2, y2 };
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
    if( this.curveDevMax === 0 && !this.hasBoxCurves ){ return 0; }

    // 12c: pct endpoints stray up to pctMag × node-half from the node
    // center; the base node-half term covers pctMag ≤ 1, the monotone
    // excess covers the rest
    const pctExcess = Math.max( 0, this.endptPctMax - 1 ) * ( this.nodeHalfMax + this.borderMax / 2 );

    return this.curveDevMax + this.nodeHalfMax + this.borderMax / 2 + pctExcess;
  }

  /**
   * The conservative model-px bound on how far a haystack endpoint can
   * sit from its node center (12c): radius × the largest outer half.
   * The *straight*-stream cull/pick-tile tests grow by this (haystack
   * rides the straight pipeline), and it stays 0 until some edge
   * styles haystack.  Monotone, like the curve slack.
   */
  haystackSlack(): number {
    if( this.haystackRadiusMax === 0 ){ return 0; }

    return this.haystackRadiusMax * ( this.nodeHalfMax + this.borderMax / 2 );
  }

  /** The conservative margin box-bounded routes (FLAG_CURVED_BOX) add
   * around their endpoint AABB: taxi legs launch a node-body offset
   * past the centers.  Global maxima — always current, never stale. */
  curveBoxMargin(): number {
    return this.nodeHalfMax + this.borderMax / 2;
  }

  /** The CurveIndex's write sink: params column + FLAG_CURVED + dirty.
   * Fixed-kind writes (straight/bezier/loop) release any blob record
   * the slot held from a previous blob-backed style. */
  private setCurveParams( slot: number, p0: number, p1: number, p2: number, kind: number ): void {
    const arr = this.edges.column( 'edge.curveParams' ) as Float32Array;
    const at = slot * 4;

    const dev = curveDeviation( kind, p0, p2 );

    if( dev > this.curveDevMax ){ this.curveDevMax = dev; }
    if( kind === CURVE_HAYSTACK && p2 > this.haystackRadiusMax ){ this.haystackRadiusMax = p2; }

    this.blob.free( slot );

    if( arr[ at ] === p0 && arr[ at + 1 ] === p1 && arr[ at + 2 ] === p2 && arr[ at + 3 ] === kind ){
      return;
    }

    arr[ at ] = p0;
    arr[ at + 1 ] = p1;
    arr[ at + 2 ] = p2;
    arr[ at + 3 ] = kind;
    this.geoEpoch++;

    this.dirty.mark( 'edge.curveParams', slot );
    // haystack/triangle are straight-stream kinds (12c): they draw in
    // the straight pipeline, so FLAG_CURVED stays clear
    const curvedStream = kind !== CURVE_STRAIGHT && kind !== CURVE_HAYSTACK && kind !== CURVE_TRIANGLE;

    this.setFlag( 'edges', slot, FLAG_CURVED, curvedStream );
    // compound loops (14.10) are box-bounded: their excursion tracks the
    // (live) node sizes, so no frame constant alone can bound the chord
    this.setFlag( 'edges', slot, FLAG_CURVED_BOX, kind === CURVE_CMPD );
  }

  /**
   * The CurveIndex's write sink for blob-backed kinds (12b): store the
   * record in the blob, the header [offset, dev, n, kind] in the params
   * column, and the curved/box flags.  `dev` is the conservative chord
   * deviation (max|d|); `box` marks kinds no chord bound covers (taxi,
   * extrapolated weights) for the AABB cull branch.
   */
  private setCurveParamsBlob(
    slot: number, kind: number, values: ArrayLike<number>, n: number, dev: number, box: boolean,
    endptPct: number = 0
  ): void {
    const arr = this.edges.column( 'edge.curveParams' ) as Float32Array;
    const at = slot * 4;
    const offset = this.blob.write( slot, values );

    if( dev > this.curveDevMax ){ this.curveDevMax = dev; }
    if( box ){ this.hasBoxCurves = true; }
    if( endptPct > this.endptPctMax ){ this.endptPctMax = endptPct; }

    arr[ at ] = offset;
    arr[ at + 1 ] = dev;
    arr[ at + 2 ] = n;
    arr[ at + 3 ] = kind;
    this.geoEpoch++;

    this.dirty.mark( 'edge.curveParams', slot );
    this.setFlag( 'edges', slot, FLAG_CURVED, true );
    this.setFlag( 'edges', slot, FLAG_CURVED_BOX, box );
  }

  // -- labels (model-only sidecar; see LabelEntry in contract.mts) --
  // Group-keyed since round 10: edges carry labels too (anchored at the
  // edge midpoint, which the renderer computes on-GPU).  The group param
  // defaults to 'nodes' so node-side call sites read unchanged.

  labelAt( slot: number, group: LabelStream = 'nodes' ): LabelEntry | undefined {
    return this.labels[ group ][ slot ];
  }

  /**
   * Set the global label font — family, style and weight (round 13
   * D1); one font per glyph atlas.  Every
   * labelled node re-lays-out against the new font's metrics via the
   * label-dirty channel; the renderer's atlas resets when it observes
   * the change.
   */
  setLabelFont( font: string, style: string = 'normal', weight: string = 'normal' ): void {
    if( font === this.labelFont && style === this.labelFontStyle
        && weight === this.labelFontWeight ){ return; }

    this.labelFont = font;
    this.labelFontStyle = style;
    this.labelFontWeight = weight;
    this.markAllLabelsDirty();
  }

  /** Queue every labelled slot (both groups) for a glyph-run rebuild. */
  markAllLabelsDirty(): void {
    for( const group of [ 'nodes', 'edges', 'edgeSource', 'edgeTarget' ] as LabelStream[] ){
      const labels = this.labels[ group ];
      const dirty = this.labelDirty[ group ];

      for( let slot = 0; slot < labels.length; slot++ ){
        if( labels[ slot ] != null ){ dirty.add( slot ); }
      }
    }

    this.dirty.touch();
  }

  /** Set or clear (null) an element's label; no-ops when nothing changed. */
  setLabel( slot: number, entry: LabelEntry | null, group: LabelStream = 'nodes' ): void {
    const labels = this.labels[ group ];
    const prev = labels[ slot ];

    if( entry == null ){
      if( prev == null ){ return; }

      labels[ slot ] = undefined;
    } else {
      if(
        prev != null && prev.text === entry.text && prev.fontSize === entry.fontSize &&
        prev.color === entry.color && prev.anchorY === entry.anchorY &&
        prev.marginX === entry.marginX && prev.marginY === entry.marginY &&
        prev.outlineWidth === entry.outlineWidth && prev.outlineColor === entry.outlineColor &&
        prev.bgColor === entry.bgColor && prev.bgPadding === entry.bgPadding &&
        prev.bgShape === entry.bgShape && prev.bgBorderColor === entry.bgBorderColor &&
        prev.bgBorderWidth === entry.bgBorderWidth &&
        prev.minZoomedFontSize === entry.minZoomedFontSize &&
        prev.anchorX === entry.anchorX && prev.halignShift === entry.halignShift &&
        prev.valignShift === entry.valignShift && prev.endOffset === entry.endOffset &&
        prev.rotate === entry.rotate &&
        prev.wrap === entry.wrap && prev.maxWidth === entry.maxWidth &&
        prev.lineHeight === entry.lineHeight && prev.overflowWrap === entry.overflowWrap &&
        prev.justification === entry.justification
      ){ return; }

      labels[ slot ] = entry;
    }

    // label dims (16.2): estimate immediately — the headless bb term —
    // and let the renderer's glyph build upgrade to exact laid dims.
    // Labels participate in bounding boxes (16.4), so dims changes
    // invalidate the bb memo like any geometry write.
    if( entry == null ){
      this.labelDims[ group ].delete( slot );
    } else {
      const est = estimateBlock( entry.text, entry.fontSize, {
        wrap: entry.wrap,
        maxWidth: entry.maxWidth,
        overflowWrap: entry.overflowWrap,
        justification: entry.justification,
        lineHeight: entry.lineHeight
      } );

      this.labelDims[ group ].set( slot, { w: est.width, h: est.height, exact: false } );
    }

    this.geoEpoch++;
    this.labelDirty[ group ].add( slot );
    this.dirty.touch();
  }

  /** A label's laid (or headless-estimated) block dims, model px. */
  labelDimsAt( slot: number, group: LabelStream = 'nodes' ): { w: number; h: number; exact: boolean } | null {
    return this.labelDims[ group ].get( slot ) ?? null;
  }

  /**
   * The renderer's exact-dims feedback (16.2): the glyph build lays the
   * block with real atlas advances and reports the true extent.  Never
   * marks label-dirty (no rebuild loop) — only the bb consumers wake.
   */
  setLabelDims( slot: number, group: LabelStream, w: number, h: number ): void {
    const prev = this.labelDims[ group ].get( slot );

    if( prev != null && prev.exact && prev.w === w && prev.h === h ){ return; }

    this.labelDims[ group ].set( slot, { w, h, exact: true } );
    this.geoEpoch++;
    this.dirty.touch();
  }

  takeLabelDirty( group: LabelStream = 'nodes' ): number[] {
    const dirty = this.labelDirty[ group ];

    if( dirty.size === 0 ){ return []; }

    const slots = [ ...dirty ];

    dirty.clear();

    return slots;
  }

  // -- iteration (insertion order) --

  count( group: GroupName ): number {
    return this.table( group ).count;
  }

  forEachAlive( group: GroupName, cb: ( slot: number ) => void ): void {
    const order = this.order[ group ];
    const gen = this.table( group ).gen;

    for( let i = 0; i < order.slots.length; i++ ){
      const slot = order.slots[ i ];

      if( gen[ slot ] === order.gens[ i ] ){
        cb( slot );
      }
    }
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
    out: Ref[], at: number, group: GroupName, mask: number, want: number,
    dataTests?: { test: ( v: unknown ) => boolean; key: string }[]
  ): number {
    const order = this.order[ group ];
    const slots = order.slots;
    const gens = order.gens;
    const gen = this.table( group ).gen;
    const flags = this.column( group === 'nodes' ? 'node.flags' : 'edge.flags' ) as Uint32Array;
    let n = at;

    // hoist a per-slot reader per condition key out of the scan loop
    const readers = dataTests == null || dataTests.length === 0
      ? null
      : dataTests.map( t => ( { test: t.test, read: this.data.reader( group, t.key ) } ) );

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];
      const g = gens[ i ];

      if( gen[ slot ] !== g || ( flags[ slot ] & mask ) !== want ){ continue; }

      if( readers != null ){
        let pass = true;

        for( let t = 0; t < readers.length; t++ ){
          if( !readers[ t ].test( readers[ t ].read( slot ) ) ){ pass = false; break; }
        }

        if( !pass ){ continue; }
      }

      out[ n++ ] = { group, slot, gen: g };
    }

    return n;
  }

  /**
   * Live, visible elements contained in the model-coordinate box — the
   * box-selection query, answered by one columnar scan.  v3's default
   * 'contain' semantics: a node counts when its bounding box (position ±
   * size/2 ± border/2) lies fully inside the box; an edge counts when
   * both of its endpoints do.  Since 12b, curved edges test their
   * *curve* boundary endpoints (exactly v3's on-boundary rule — the
   * revisit deferred from 12a); straight edges keep the endpoint-center
   * approximation (a recorded deviation).  Corners may be given in any
   * order.
   */
  refsInBox(
    x1: number, y1: number, x2: number, y2: number,
    includeLabels: boolean = false
  ): Ref[] {
    this.flushDerived(); // curved edges read derived params below
    const lx = Math.min( x1, x2 );
    const hx = Math.max( x1, x2 );
    const ly = Math.min( y1, y2 );
    const hy = Math.max( y1, y2 );
    const shown = FLAG_ALIVE | FLAG_VISIBLE;
    const out: Ref[] = [];

    const pos = this.column( 'node.position' ) as Float32Array;
    const size = this.column( 'node.size' ) as Float32Array;
    const border = this.column( 'node.borderWidth' ) as Float32Array;
    const nodeFlags = this.column( 'node.flags' ) as Uint32Array;
    const nodeOrder = this.order.nodes;
    const nodeGen = this.nodes.gen;

    for( let i = 0; i < nodeOrder.slots.length; i++ ){
      const slot = nodeOrder.slots[ i ];
      const g = nodeOrder.gens[ i ];

      if( nodeGen[ slot ] !== g || ( nodeFlags[ slot ] & shown ) !== shown ){ continue; }

      const hw = size[ slot * 2 ] / 2 + border[ slot ] / 2;
      const hh = size[ slot * 2 + 1 ] / 2 + border[ slot ] / 2;
      const x = pos[ slot * 2 ];
      const y = pos[ slot * 2 + 1 ];

      if( x - hw >= lx && x + hw <= hx && y - hh >= ly && y + hh <= hy ){
        // boxSelectionIncludesLabels (16.5, default off — v3's default):
        // the label box must be contained too
        if( includeLabels ){
          const lb = this.nodeLabelBox( slot );

          if( lb != null && !(
            x + lb.x1 >= lx && x + lb.x2 <= hx && y + lb.y1 >= ly && y + lb.y2 <= hy
          ) ){ continue; }
        }

        out.push( { group: 'nodes', slot, gen: g } );
      }
    }

    const endpoints = this.column( 'edge.endpoints' ) as Uint32Array;
    const edgeFlags = this.column( 'edge.flags' ) as Uint32Array;
    const edgeOrder = this.order.edges;
    const edgeGen = this.edges.gen;
    const centerIn = ( node: number ): boolean => {
      const x = pos[ node * 2 ];
      const y = pos[ node * 2 + 1 ];

      return x >= lx && x <= hx && y >= ly && y <= hy;
    };

    const pointIn = ( x: number, y: number ): boolean => {
      return x >= lx && x <= hx && y >= ly && y <= hy;
    };

    for( let i = 0; i < edgeOrder.slots.length; i++ ){
      const slot = edgeOrder.slots[ i ];
      const g = edgeOrder.gens[ i ];

      if( edgeGen[ slot ] !== g || ( edgeFlags[ slot ] & shown ) !== shown ){ continue; }

      // both endpoints must be shown — the drawn-edge rule the cull
      // kernels apply, which ancestor gating (round 14.4) also feeds
      if( ( nodeFlags[ endpoints[ slot * 2 ] ] & shown ) !== shown
        || ( nodeFlags[ endpoints[ slot * 2 + 1 ] ] & shown ) !== shown ){ continue; }

      let contained: boolean;

      if( ( edgeFlags[ slot ] & FLAG_CURVED ) !== 0 ){
        // the curve's boundary endpoints — v3's exact 'contain' rule
        const ev = this.curveEvalAt( slot );

        if( ev != null ){
          contained = pointIn( ev.sx, ev.sy ) && pointIn( ev.ex, ev.ey );
        } else {
          const route = this.curveRouteAt( slot ) as CurveRoute;

          contained = pointIn( route.qx[ 0 ], route.qy[ 0 ] ) &&
            pointIn( route.qx[ route.n + 1 ], route.qy[ route.n + 1 ] );
        }
      } else {
        const hay = this.haystackPointsAt( slot );

        // haystack edges (12c) test their offset endpoints — v3's
        // haystackPts; straight/triangle edges keep the
        // endpoint-center approximation (recorded deviation)
        contained = hay != null
          ? pointIn( hay.sx, hay.sy ) && pointIn( hay.tx, hay.ty )
          : centerIn( endpoints[ slot * 2 ] ) && centerIn( endpoints[ slot * 2 + 1 ] );
      }

      if( contained ){
        out.push( { group: 'edges', slot, gen: g } );
      }
    }

    return out;
  }

  /** Live slots in insertion order (reused slots re-appear at their re-insertion position). */
  slotsOrdered( group: GroupName ): number[] {
    const slots: number[] = [];

    this.forEachAlive( group, slot => slots.push( slot ) );

    return slots;
  }

  /**
   * Whole-graph bounding box as a direct columnar scan — no element
   * handles (a no-arg fit() on a 500k-element graph is a fraction of a
   * millisecond instead of hundreds).  Nodes contribute position ±
   * (size/2 + border/2).  Edges contribute their own extent as a
   * first-class term: the two endpoint node centers, grown by the
   * conservative curve deviation for curved edges — the hull bound for
   * chord-bounded kinds, plus the node-half margin (+ chord length for
   * extrapolated weights) for box-bounded ones (rounds 12a/12b; the
   * exact lazy curve bb is GpuCollection.boundingBox's tier).  Future
   * edge geometry (arrow heads, 12c endpoints) extends the edge term
   * here and there together.  Returns null when empty.
   */
  /**
   * A node label's box in node-local model px (round 16.4): the laid
   * (or headless-estimated) block at its D3 anchor, grown by the
   * text-background padding when a box draws.  Null when unlabelled.
   */
  nodeLabelBox( slot: number ): { x1: number; y1: number; x2: number; y2: number } | null {
    const entry = this.labels.nodes[ slot ];
    const dims = this.labelDims.nodes.get( slot );

    if( entry == null || dims == null ){ return null; }

    const pad = ( entry.bgColor >>> 24 ) > 0 ? entry.bgPadding : 0;
    const dx = entry.anchorX + entry.halignShift * dims.w + entry.marginX;
    const dy = entry.anchorY + entry.valignShift * dims.h;

    return {
      x1: dx - dims.w / 2 - pad,
      y1: dy - pad,
      x2: dx + dims.w / 2 + pad,
      y2: dy + dims.h + pad
    };
  }

  /**
   * The conservative edge-label slack (16.4): a radius covering the
   * label block wherever its anchor lands on the drawn path (mid or
   * end streams, rotation included), added to the edge term's growth.
   */
  edgeLabelSlack( slot: number ): number {
    let r = 0;

    for( const stream of [ 'edges', 'edgeSource', 'edgeTarget' ] as LabelStream[] ){
      const entry = this.labels[ stream ][ slot ];
      const dims = this.labelDims[ stream ].get( slot );

      if( entry == null || dims == null ){ continue; }

      const pad = ( entry.bgColor >>> 24 ) > 0 ? entry.bgPadding : 0;
      const vert = Math.max( Math.abs( entry.anchorY ), Math.abs( entry.anchorY + dims.h ) );
      const own = dims.w / 2 + Math.abs( entry.marginX ) + vert + pad + entry.endOffset;

      if( own > r ){ r = own; }
    }

    return r;
  }

  /** true when any edge-stream label exists (the scan's cheap gate) */
  hasEdgeLabels(): boolean {
    return this.labelDims.edges.size > 0
      || this.labelDims.edgeSource.size > 0 || this.labelDims.edgeTarget.size > 0;
  }

  hasNodeLabels(): boolean {
    return this.labelDims.nodes.size > 0;
  }

  boundingBox( includeLabels: boolean = true ): { x1: number; y1: number; x2: number; y2: number; w: number; h: number } | null {
    this.flushDerived(); // the edge term reads derived curve params

    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

    const pos = this.column( 'node.position' ) as Float32Array;
    const size = this.column( 'node.size' ) as Float32Array;
    const border = this.column( 'node.borderWidth' ) as Float32Array;

    const ghost = this.column( 'node.ghost' ) as Float32Array;
    const anyGhosts = this.ghosts > 0;
    const anyNodeLabels = includeLabels && this.hasNodeLabels();
    const anyEdgeLabels = includeLabels && this.hasEdgeLabels();
    const over = this.column( 'node.overlay' ) as Uint32Array;
    const under = this.column( 'node.underlay' ) as Uint32Array;
    const anyLayers = this.overlays > 0 || this.underlays > 0;
    const bGeom = this.column( 'node.borderGeom' ) as Uint32Array;
    const anyOutlines = this.outlineSlackMax > 0;

    this.forEachAlive( 'nodes', slot => {
      const x = pos[ slot * 2 ];
      const y = pos[ slot * 2 + 1 ];
      let hw = size[ slot * 2 ] / 2 + border[ slot ] / 2;
      let hh = size[ slot * 2 + 1 ] / 2 + border[ slot ] / 2;

      // an outline ring grows the body box (round 13 B5; conservative
      // for inside borders — the center convention, like the border term)
      if( anyOutlines && bGeom[ slot * 4 + 2 ] >>> 24 !== 0 ){
        const wo = bGeom[ slot * 4 + 3 ];
        const extra = ( wo >>> 16 ) / 256 / 2 + ( wo & 0xffff ) / 256;

        hw += extra;
        hh += extra;
      }

      // overlay/underlay pads grow the body box (round 13 A2; v3's
      // overlay sits on the inner size, so border-inclusive halves +
      // padding are conservative)
      if( anyLayers ){
        let pad = 0;

        if( over[ slot * 4 ] >>> 24 !== 0 ){ pad = over[ slot * 4 + 1 ] / 256; }
        if( under[ slot * 4 ] >>> 24 !== 0 ){ pad = Math.max( pad, under[ slot * 4 + 1 ] / 256 ); }

        hw += pad;
        hh += pad;
      }

      if( x - hw < x1 ){ x1 = x - hw; }
      if( y - hh < y1 ){ y1 = y - hh; }
      if( x + hw > x2 ){ x2 = x + hw; }
      if( y + hh > y2 ){ y2 = y + hh; }

      // a ghost duplicates the body at the offset (round 13 A1)
      if( anyGhosts && ghost[ slot * 4 + 3 ] !== 0 ){
        const gx = x + ghost[ slot * 4 ];
        const gy = y + ghost[ slot * 4 + 1 ];

        if( gx - hw < x1 ){ x1 = gx - hw; }
        if( gy - hh < y1 ){ y1 = gy - hh; }
        if( gx + hw > x2 ){ x2 = gx + hw; }
        if( gy + hh > y2 ){ y2 = gy + hh; }
      }

      // labels join the box by default (round 16.4): the laid (or
      // headless-estimated) block at its anchor
      if( anyNodeLabels ){
        const lb = this.nodeLabelBox( slot );

        if( lb != null ){
          if( x + lb.x1 < x1 ){ x1 = x + lb.x1; }
          if( y + lb.y1 < y1 ){ y1 = y + lb.y1; }
          if( x + lb.x2 > x2 ){ x2 = x + lb.x2; }
          if( y + lb.y2 > y2 ){ y2 = y + lb.y2; }
        }
      }
    } );

    const endpoints = this.column( 'edge.endpoints' ) as Uint32Array;
    const curveParams = this.column( 'edge.curveParams' ) as Float32Array;
    const edgeFlags = this.column( 'edge.flags' ) as Uint32Array;

    this.forEachAlive( 'edges', slot => {
      // curved edges: the conservative hull bound — the quadratic lies
      // within the endpoint/control hull, whose controls sit at most
      // the header deviation from the center segment (exact lazy bb is
      // the collection's job; fit may slightly over-fit, never under).
      // Box-bounded routes (taxi, extrapolated weights) get the
      // node-half margin — taxi legs launch a body offset past the
      // centers — plus the chord length for weight extrapolation.
      const at = slot * 4;
      const kind = curveParams[ at + 3 ];
      let dev = kind === CURVE_STRAIGHT
        ? 0
        : headerDeviation( kind, curveParams[ at ], curveParams[ at + 1 ], curveParams[ at + 2 ] );

      if( ( edgeFlags[ slot ] & FLAG_CURVED_BOX ) !== 0 ){
        dev += this.curveBoxMargin();

        if( kind !== CURVE_TAXI ){
          const s = endpoints[ slot * 2 ];
          const t = endpoints[ slot * 2 + 1 ];

          dev += Math.hypot( pos[ t * 2 ] - pos[ s * 2 ], pos[ t * 2 + 1 ] - pos[ s * 2 + 1 ] );
        }
      }

      // edge labels (16.4): conservative — the block-covering radius,
      // valid wherever the anchor lands along the drawn path
      if( anyEdgeLabels ){
        dev += this.edgeLabelSlack( slot );
      }

      for( let end = 0; end < 2; end++ ){
        const node = endpoints[ slot * 2 + end ];
        const x = pos[ node * 2 ];
        const y = pos[ node * 2 + 1 ];

        if( x - dev < x1 ){ x1 = x - dev; }
        if( y - dev < y1 ){ y1 = y - dev; }
        if( x + dev > x2 ){ x2 = x + dev; }
        if( y + dev > y2 ){ y2 = y + dev; }
      }
    } );

    if( x1 === Infinity ){ return null; }

    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  // -- internals --

  /** Sidecar data() values from a def's data object (id/source/target/parent stay first-class). */
  setDefData( group: GroupName, slot: number, data: Record<string, unknown> | undefined ): void {
    if( data == null ){ return; }

    for( const key of Object.keys( data ) ){
      if( key === 'id' || key === 'source' || key === 'target' ){ continue; }

      // round 14: a node def's parent resolves as hierarchy (in a second
      // pass, once the batch's nodes all exist), never as sidecar data
      if( key === 'parent' && group === 'nodes' ){ continue; }

      this.data.set( group, slot, key, data[ key ] );
      this.markDataWrite( group, key, slot, slot + 1 );
    }
  }

  private ingestDataColumns(
    group: GroupName, slots: Uint32Array,
    data: Record<string, GpuDataColumn> | undefined
  ): void {
    if( data == null ){ return; }

    let min = Infinity;
    let max = -Infinity;

    if( this.watchedKeys[ group ].size > 0 && slots.length > 0 ){
      for( let i = 0; i < slots.length; i++ ){
        if( slots[ i ] < min ){ min = slots[ i ]; }
        if( slots[ i ] > max ){ max = slots[ i ]; }
      }
    }

    for( const key of Object.keys( data ) ){
      this.data.ingestColumn( group, slots, key, data[ key ] );

      if( max >= 0 ){ this.markDataWrite( group, key, min, max + 1 ); }
    }
  }

  /** Register bulk-allocated slots: ids (auto-generated on holes) + insertion order. */
  private registerBulk(
    group: GroupName, slots: Uint32Array,
    ids: ( string | undefined )[] | GpuPackedIds | undefined, newId: () => string
  ): void {
    this.ids.setBulk( group, slots, ids, newId ); // throws on a duplicate id

    const order = this.order[ group ];
    const gen = this.table( group ).gen;

    for( let i = 0; i < slots.length; i++ ){
      const slot = slots[ i ];

      order.slots.push( slot );
      order.gens.push( gen[ slot ] );
    }
  }

  /** Default flags for the whole bulk, then per-element deviations. */
  private writeBulkFlags(
    group: GroupName, slots: Uint32Array, contiguousFrom: number,
    cols: { selected?: Uint8Array; selectable?: Uint8Array }
  ): void {
    const flagsId: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';
    const flags = this.table( group ).column( flagsId ) as Uint32Array;
    const defaults = FLAG_ALIVE | FLAG_VISIBLE | FLAG_SELECTABLE | FLAG_GRABBABLE
      | ( group === 'edges' ? FLAG_PANNABLE : 0 ); // edges default pannable, as in v3
    const count = slots.length;

    if( contiguousFrom < count ){ // fresh run: one fill
      flags.fill( defaults, slots[ contiguousFrom ], slots[ count - 1 ] + 1 );
    }

    for( let i = 0; i < contiguousFrom; i++ ){
      flags[ slots[ i ] ] = defaults;
    }

    if( cols.selected != null ){
      for( let i = 0; i < count; i++ ){
        if( cols.selected[ i ] !== 0 ){ flags[ slots[ i ] ] |= FLAG_SELECTED; }
      }
    }

    if( cols.selectable != null ){
      for( let i = 0; i < count; i++ ){
        if( cols.selectable[ i ] === 0 ){ flags[ slots[ i ] ] &= ~FLAG_SELECTABLE; }
      }
    }
  }

  /** One coalesced dirty span covering all of `slots`. */
  private markBulk( id: ColumnId, slots: Uint32Array ): void {
    if( slots.length === 0 ){ return; }

    let min = slots[ 0 ];
    let max = slots[ 0 ];

    for( let i = 1; i < slots.length; i++ ){
      const slot = slots[ i ];

      if( slot < min ){ min = slot; }
      if( slot > max ){ max = slot; }
    }

    this.dirty.mark( id, min, max + 1 );
  }

  private allocSlot( group: GroupName, id: string ): { slot: number; resized: boolean } {
    if( this.ids.has( id ) ){
      throw new Error( `Can not create second element with id '${id}'` );
    }

    const table = this.table( group );
    const { slot, resized } = table.alloc();

    if( resized ){
      this.dirty.markResized( group );
    }

    this.ids.set( id, group, slot );

    const order = this.order[ group ];

    order.slots.push( slot );
    order.gens.push( table.gen[ slot ] );

    return { slot, resized };
  }

  private freeSlot( group: GroupName, slot: number ): void {
    const id = this.ids.idAt( group, slot );

    if( id != null ){ this.ids.remove( id ); }

    if( group === 'nodes' ){ // recycled slots must not inherit compound state
      this.parentFallback.delete( slot );
      this.opacityBase.delete( slot );
    }

    this.data.clearSlot( group, slot );

    if( this.labels[ group ][ slot ] != null ){
      this.setLabel( slot, null, group );
    }

    if( group === 'edges' ){
      for( const stream of [ 'edgeSource', 'edgeTarget' ] as LabelStream[] ){
        if( this.labels[ stream ][ slot ] != null ){
          this.setLabel( slot, null, stream );
        }
      }
    }

    // tombstone: cleared flags (no ALIVE bit) collapse the instance to a degenerate quad
    const flagsId: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';

    ( this.table( group ).column( flagsId ) as Uint32Array )[ slot ] = 0;
    this.dirty.mark( flagsId, slot );

    this.table( group ).freeSlot( slot );

    const order = this.order[ group ];

    order.stale++;

    if( order.stale > order.slots.length / 2 ){
      this.compactOrder( group );
    }
  }

  /**
   * Rebuild the CSR adjacency when the waste meters cross the threshold:
   * stranded CSR entries (removals) plus overlay entries (post-build
   * adds) exceeding half the live entry count.  A rebuild walks the live
   * edges in insertion order — so it also folds a purely incremental
   * graph's overlay into the compact CSR shape — and O(edges) at a
   * proportional-growth threshold amortizes to O(1) per mutation.  The
   * floor keeps tiny graphs from rebuilding on every mutation.
   */
  private maybeRebuildAdjacency(): void {
    const waste = this.adj.csrStranded + this.adj.overlayEntries;

    // live entries = 2 × edge count, so waste > count is waste > live/2
    if( waste <= 64 || waste <= this.edges.count ){ return; }

    this.adj.rebuild(
      this.slotsOrdered( 'edges' ),
      this.edges.column( 'edge.endpoints' ) as Uint32Array,
      this.nodes.cap
    );
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
    this.flushDerived(); // settle derived geometry before anything moves

    const edgesRes = this.compactGroup( 'edges' );
    const nodesRes = this.compactGroup( 'nodes' );

    if( nodesRes != null ){
      // endpoints hold node slots — the one column with cross-group slots
      const endpoints = this.edges.column( 'edge.endpoints' ) as Uint32Array;
      const remap = nodesRes.remap;
      const hw = this.edges.highWater;

      for( let i = 0; i < hw * 2; i++ ){
        endpoints[ i ] = remap[ endpoints[ i ] ];
      }

      if( hw > 0 ){ this.dirty.mark( 'edge.endpoints', 0, hw ); }
    }

    if( nodesRes != null || edgesRes != null ){
      this.adj.rebuild(
        this.slotsOrdered( 'edges' ),
        this.edges.column( 'edge.endpoints' ) as Uint32Array,
        this.nodes.cap
      );
      this.geoEpoch++; // the slot-indexed edge-bb memo is stale wholesale
      this.dirty.touch();
    }

    // -- dependent store indexes (19.2) --

    if( edgesRes != null ){
      this.blob.remapSlots( edgesRes.remap );
      this.data.remapSlots( 'edges', edgesRes.remap );
      this.remapLabelStream( 'edges', edgesRes.remap );
      this.remapLabelStream( 'edgeSource', edgesRes.remap );
      this.remapLabelStream( 'edgeTarget', edgesRes.remap );
    }

    if( nodesRes != null ){
      this.polyPool.remapSlots( nodesRes.remap );
      this.imagePool.remapSlots( nodesRes.remap );
      this.data.remapSlots( 'nodes', nodesRes.remap );
      this.remapLabelStream( 'nodes', nodesRes.remap );
      this.hierarchy.remapSlots( nodesRes.remap, this.nodes.gen );
      this.opacityBase = rekeyMap( this.opacityBase, nodesRes.remap );
      this.parentFallback = rekeyMap( this.parentFallback, nodesRes.remap );
    }

    if( nodesRes != null || edgesRes != null ){
      // pair/loop keys are node slots and member lists edge slots — the
      // index rebuilds both from the rewritten endpoints; derived params
      // stay valid (the remap is monotone, so bundle order is unchanged)
      this.curves.remapSlots( edgesRes?.remap ?? null );

      // stale mapper spans carry old-coordinate ranges: replace them
      // with whole-column spans per watched key of a compacted group
      for( const group of [ 'nodes', 'edges' ] as GroupName[] ){
        const res = group === 'nodes' ? nodesRes : edgesRes;

        if( res == null ){ continue; }

        for( const key of Array.from( this.mapperSpans.keys() ) ){
          if( key.startsWith( `${group}:` ) ){ this.mapperSpans.delete( key ); }
        }

        for( const key of this.watchedKeys[ group ] ){
          this.markDataWrite( group, key, 0, this.table( group ).highWater );
        }
      }

      // owner slots are baked into the renderer's glyph instances; the
      // label-dirty channel is the existing rebuild path (19.4 consumes)
      this.markAllLabelsDirty();
    }

    return { nodes: nodesRes, edges: edgesRes };
  }

  /** Permute one label stream's entries, dims and dirty slots (19.2). */
  private remapLabelStream( stream: LabelStream, remap: Uint32Array ): void {
    const entries = this.labels[ stream ];
    const n = Math.min( remap.length, entries.length );

    for( let s = 0; s < n; s++ ){
      const d = remap[ s ];

      if( d === NO_SLOT || d === s ){ continue; }

      entries[ d ] = entries[ s ];
      entries[ s ] = undefined;
    }

    this.labelDims[ stream ] = rekeyMap( this.labelDims[ stream ], remap );

    const dirty = new Set<number>();

    for( const s of this.labelDirty[ stream ] ){
      const d = s < remap.length ? remap[ s ] : NO_SLOT;

      if( d !== NO_SLOT ){ dirty.add( d ); }
    }

    this.labelDirty[ stream ] = dirty;
  }

  private compactGroup( group: GroupName ): GroupCompaction | null {
    const table = this.table( group );
    const hw = table.highWater;
    const flagsId: ColumnId = group === 'nodes' ? 'node.flags' : 'edge.flags';
    const flags = table.column( flagsId ) as Uint32Array;
    const remap = new Uint32Array( hw );
    let next = 0;
    let moved = 0;

    for( let s = 0; s < hw; s++ ){
      if( ( flags[ s ] & FLAG_ALIVE ) !== 0 ){
        remap[ s ] = next;

        if( next !== s ){ moved++; }

        next++;
      } else {
        remap[ s ] = NO_SLOT;
      }
    }

    if( moved === 0 && next === hw ){ return null; } // already dense

    // table.compact swaps in a fresh gen array, so holding the old one
    // is the pre-move snapshot the order-list fusion validates against
    const oldGen = table.gen;

    table.compact( remap, next );

    const order = this.order[ group ];
    const slots: number[] = [];
    const gens: number[] = [];

    for( let i = 0; i < order.slots.length; i++ ){
      const s = order.slots[ i ];

      if( order.gens[ i ] !== oldGen[ s ] ){ continue; } // tombstoned entry

      const d = remap[ s ];

      if( d === NO_SLOT ){ continue; }

      slots.push( d );
      gens.push( table.gen[ d ] );
    }

    this.order[ group ] = { slots, gens, stale: 0 };

    this.ids.remapSlots( group, remap );
    this.dirty.markResized( group );

    return { remap, moved, oldHighWater: hw };
  }

  private compactOrder( group: GroupName ): void {
    const order = this.order[ group ];
    const gen = this.table( group ).gen;
    const slots: number[] = [];
    const gens: number[] = [];

    for( let i = 0; i < order.slots.length; i++ ){
      const slot = order.slots[ i ];

      if( gen[ slot ] === order.gens[ i ] ){
        slots.push( slot );
        gens.push( order.gens[ i ] );
      }
    }

    this.order[ group ] = { slots, gens, stale: 0 };
  }
}

/** Rebuild a slot-keyed map through a compaction remap (19.2). */
const rekeyMap = <V,>( map: Map<number, V>, remap: Uint32Array ): Map<number, V> => {
  const next = new Map<number, V>();

  for( const [ slot, value ] of map ){
    const d = slot < remap.length ? remap[ slot ] : NO_SLOT;

    if( d !== NO_SLOT ){ next.set( d, value ); }
  }

  return next;
};

const initialFlags = ( opts: AddElementOpts, pannableDefault: boolean ): number => {
  let flags = FLAG_ALIVE;

  if( opts.visible !== false ){ flags |= FLAG_VISIBLE; }
  else { flags |= FLAG_SELF_HIDDEN; }
  if( opts.selectable !== false ){ flags |= FLAG_SELECTABLE; }
  if( opts.selected === true ){ flags |= FLAG_SELECTED; }
  if( opts.grabbable !== false ){ flags |= FLAG_GRABBABLE; }
  if( opts.locked === true ){ flags |= FLAG_LOCKED; }
  if( opts.pannable ?? pannableDefault ){ flags |= FLAG_PANNABLE; }

  return flags;
};

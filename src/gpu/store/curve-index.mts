import {
  CURVE_BEZIER, CURVE_CMPD, CURVE_HAS_ENDPT, CURVE_HAYSTACK, CURVE_LOOP, CURVE_MULTI,
  CURVE_SEGMENTS, CURVE_STRAIGHT, CURVE_TAXI, CURVE_TRIANGLE, NO_SLOT
} from '../contract.mjs';
import {
  bundleOffset, haystackAngle, loopAngles, loopRadius,
  EDGE_DIST_ENDPOINTS, EDGE_DIST_INTERSECTION, ENDPT_ANGLE, ENDPT_PCT_Y,
  ENDPT_POINT, MAX_CURVE_PTS, MAX_MULTI_CTRL, TAXI_AUTO
} from '../curve-geometry.mjs';

/*
CurveIndex (rounds 12a/12b): bundle membership + curve-param derivation.

Owns the per-edge *styled* curve record (curve-style, step size, weight,
loop direction/sweep — and, for the 12b families, the CurveStyleExtras
lists/params — the stored truth the style getters read) and the
structural indexes that turn records into the derived edge.curveParams
column: the parallel-edge pair map (keyed on the unordered endpoint
pair; only built once some edge styles `bezier` — a straight-only graph
pays nothing but the loop check) and the per-node loop lists (always
maintained; loops render as loops under every curve style).

Derivation is v3's, verbatim (edge-control-points.mts):
- bundle = the pair's alive `bezier`-styled members in slot order;
  member i of n offsets by (0.5 − n/2 + i) × its own step size, sign
  flipped when the edge's direction opposes the pair's canonical
  (lower-slot-source) orientation — v3's swappedpairInfo invariant
  makes the canonical choice itself immaterial to the world-space
  result;
- the middle member of an odd bundle is straight (n = 1 ⇒ a lone
  `bezier` edge renders straight — the signed-off v3 rule);
- loops stagger a per-(direction, sweep) counter j over the node's
  loops in slot order: rays at loopDir − π/2 ∓ sweep/2, radius
  1.4 × step × (j/3 + 1); unbundled-family loops take
  control-point-distances[0] as the loop distance (12b, v3's rule),
  step-size fallback when unset.  (v4 deviation: *all* loops take this
  bundled-loop construction — v3 routes `straight`-styled loops
  through its unbundled path.)
- the 12b families (unbundled-bezier / segments / round-segments /
  taxi / round-taxi) never bundle: `deriveEdge` writes each edge's
  blob-backed record on its own (see that method's doc for the count
  rules, caps and box-bound marking), and bezier pair re-derivations
  skip blob-family members so the two paths can't clobber each other.

Recomputes are lazy: mutations and record writes mark pairs (and 12b
slots) pending, and `flush()` (called from takeDelta / boundingBox /
the accessors) recomputes only the pending work — a bulk load or style
apply pays each pair/edge once.
*/

export const CURVE_STYLE_STRAIGHT = 0;
export const CURVE_STYLE_BEZIER = 1;
// the 12b families (all "unbundled" in v3's sense: never pair-bundled)
export const CURVE_STYLE_UNBUNDLED = 2;
export const CURVE_STYLE_SEGMENTS = 3;
export const CURVE_STYLE_ROUND_SEGMENTS = 4;
export const CURVE_STYLE_TAXI = 5;
export const CURVE_STYLE_ROUND_TAXI = 6;
// 12c: per-edge straight-stream styles (never bundle, never blob)
export const CURVE_STYLE_HAYSTACK = 7;
export const CURVE_STYLE_TRIANGLE = 8;

/** styles whose derived params live in the curve param blob */
export const isBlobStyle = ( style: number ): boolean =>
  style >= CURVE_STYLE_UNBUNDLED && style <= CURVE_STYLE_ROUND_TAXI;

/** 12c straight-stream styles: derived per edge, FLAG_CURVED stays clear */
export const isStraightStreamStyle = ( style: number ): boolean =>
  style === CURVE_STYLE_HAYSTACK || style === CURVE_STYLE_TRIANGLE;

/**
 * The styled manual-endpoint record (12c): `source/target-endpoint` +
 * `source/target-distance-from-node`, parsed to the endpoint-block
 * float layout (see curve-geometry.mts).  Null means all-default (the
 * common case — no block is emitted and derivation is unchanged).
 */
export interface EndpointSpec {
  srcMode: number; srcA: number; srcB: number; srcPct: number; srcDist: number;
  tgtMode: number; tgtA: number; tgtB: number; tgtPct: number; tgtDist: number;
}

export const ENDPT_SPEC_DEFAULTS: EndpointSpec = {
  srcMode: 0, srcA: 0, srcB: 0, srcPct: 0, srcDist: 0,
  tgtMode: 0, tgtA: 0, tgtB: 0, tgtPct: 0, tgtDist: 0
};

export const isDefaultEndpt = ( e: EndpointSpec | null ): boolean => {
  if( e == null ){ return true; }

  return e.srcMode === 0 && e.srcDist === 0 && e.tgtMode === 0 && e.tgtDist === 0;
};

const endptEq = ( a: EndpointSpec | null, b: EndpointSpec | null ): boolean => {
  if( a === b ){ return true; }
  if( a == null || b == null ){ return false; }

  return a.srcMode === b.srcMode && a.srcA === b.srcA && a.srcB === b.srcB &&
    a.srcPct === b.srcPct && a.srcDist === b.srcDist &&
    a.tgtMode === b.tgtMode && a.tgtA === b.tgtA && a.tgtB === b.tgtB &&
    a.tgtPct === b.tgtPct && a.tgtDist === b.tgtDist;
};

/** the 10-float endpoint block (the WGSL twin reads the same layout) */
const endptBlock = ( e: EndpointSpec ): number[] => [
  e.srcMode, e.srcA, e.srcB, e.srcPct, e.srcDist,
  e.tgtMode, e.tgtA, e.tgtB, e.tgtPct, e.tgtDist
];

/** conservative px excursion of manual point endpoints past the node
 * centers (pct components are covered by the pct magnitude instead) */
const endptPxDev = ( e: EndpointSpec ): number => {
  const end = ( mode: number, a: number, b: number, pct: number ): number => {
    if( mode !== ENDPT_POINT ){ return 0; }

    const px = pct % 2 === 1 ? 0 : Math.abs( a );
    const py = pct >= ENDPT_PCT_Y ? 0 : Math.abs( b );

    return Math.hypot( px, py );
  };

  return Math.max(
    end( e.srcMode, e.srcA, e.srcB, e.srcPct ),
    end( e.tgtMode, e.tgtA, e.tgtB, e.tgtPct )
  );
};

/** pct endpoint magnitude in node-half units (2·|fraction|): ≤ 1 is
 * covered by the slack's node-half term; > 1 marks the edge box-bounded
 * and feeds the store's monotone pct slack */
const endptPctMag = ( e: EndpointSpec ): number => {
  const end = ( mode: number, a: number, b: number, pct: number ): number => {
    if( mode !== ENDPT_POINT ){ return 0; }

    const fx = pct % 2 === 1 ? Math.abs( a ) : 0;
    const fy = pct >= ENDPT_PCT_Y ? Math.abs( b ) : 0;

    return 2 * Math.max( fx, fy );
  };

  return Math.max(
    end( e.srcMode, e.srcA, e.srcB, e.srcPct ),
    end( e.tgtMode, e.tgtA, e.tgtB, e.tgtPct )
  );
};

/** the styled defaults (v3's): step 40, weight 0.5, loop -45deg/-90deg */
export const CURVE_DEFAULTS = {
  style: CURVE_STYLE_STRAIGHT,
  stepSize: 40,
  weight: 0.5,
  loopDirection: -Math.PI / 4,
  loopSweep: -Math.PI / 2
} as const;

/**
 * The 12b styled record (only stored for blob-family styles; readback
 * falls back to these defaults — v3's — when absent).  Lists are stored
 * as parsed (copies owned by the style layer, treated read-only here).
 */
export interface CurveStyleExtras {
  /** control-point-distances (null = unset; v3 has no default) */
  ctrlDists: number[] | null;
  /** control-point-weights (default [0.5]) */
  ctrlWeights: number[];
  segDists: number[];
  segWeights: number[];
  segRadii: number[];
  /** radius-type per point: 1 = arc-radius, 0 = influence-radius */
  radiusTypes: number[];
  /** EDGE_DIST_* */
  edgeDistances: number;
  taxiDir: number;
  /** percent turns store the fraction (v3's pfValue); px turns the px */
  taxiTurn: number;
  taxiTurnPercent: boolean;
  taxiTurnMinDist: number;
  taxiRadius: number;
}

export const CURVE_EXTRA_DEFAULTS: CurveStyleExtras = {
  ctrlDists: null,
  ctrlWeights: [ 0.5 ],
  segDists: [ 20 ],
  segWeights: [ 0.5 ],
  segRadii: [ 15 ],
  radiusTypes: [ 1 ],
  edgeDistances: EDGE_DIST_INTERSECTION,
  taxiDir: TAXI_AUTO,
  taxiTurn: 0.5,
  taxiTurnPercent: true,
  taxiTurnMinDist: 10,
  taxiRadius: 15
};

const listEq = ( a: number[] | null, b: number[] | null ): boolean => {
  if( a === b ){ return true; }
  if( a == null || b == null || a.length !== b.length ){ return false; }

  for( let i = 0; i < a.length; i++ ){
    if( a[ i ] !== b[ i ] ){ return false; }
  }

  return true;
};

const extrasEq = ( a: CurveStyleExtras | null, b: CurveStyleExtras | null ): boolean => {
  if( a === b ){ return true; }
  if( a == null || b == null ){ return false; }

  return listEq( a.ctrlDists, b.ctrlDists ) && listEq( a.ctrlWeights, b.ctrlWeights ) &&
    listEq( a.segDists, b.segDists ) && listEq( a.segWeights, b.segWeights ) &&
    listEq( a.segRadii, b.segRadii ) && listEq( a.radiusTypes, b.radiusTypes ) &&
    a.edgeDistances === b.edgeDistances && a.taxiDir === b.taxiDir &&
    a.taxiTurn === b.taxiTurn && a.taxiTurnPercent === b.taxiTurnPercent &&
    a.taxiTurnMinDist === b.taxiTurnMinDist && a.taxiRadius === b.taxiRadius;
};

/** What the index needs from the store (kept narrow for testability). */
export interface CurveHost {
  /** the edge.endpoints column (source, target node slots interleaved) */
  endpoints(): Uint32Array;
  /** live edge slots in insertion order (for the lazy pair-index build) */
  aliveEdgeSlots(): number[];
  /** write the derived params (column write + FLAG_CURVED + dirty span) */
  writeParams( slot: number, p0: number, p1: number, p2: number, kind: number ): void;
  /** write a blob-backed record + its header (12b families; endptPct
   * is the 12c pct-endpoint magnitude in node-half units, 0 when none) */
  writeBlobParams(
    slot: number, kind: number, values: ArrayLike<number>, n: number, dev: number, box: boolean,
    endptPct: number
  ): void;
  /** the edge's stable id hash (haystack angle seeding, 12c) */
  idHash( slot: number ): number;
  /** schedule a frame / mark non-column dirt (DirtyTracker.touch) */
  schedule(): void;
  /** display-tier shown state (round 22.3): hidden edges leave their
   * bundles and loop staggers; `visibility: 'hidden'` edges do NOT
   * (paint-only — ranks stay stable), so this reads FLAG_VISIBLE */
  edgeShown( slot: number ): boolean;
  /** compound relation (round 14.10): the two nodes are in an
   * ancestor/descendant relation, or a === b names a parent — such
   * edges route around the outside regardless of curve style */
  relation( a: number, b: number ): boolean;
  /** the node's outer half-width (the compound-loop stretch input) */
  outerHalfW( slot: number ): number;
}

const pairKey = ( a: number, b: number ): number => {
  return a < b ? a * 0x8000000 + b : b * 0x8000000 + a;
};

export class CurveIndex {
  private host: CurveHost;

  // styled records, slot-indexed (defaults for never/no-longer-styled slots)
  private style: Uint8Array;
  private step: Float32Array;
  private weight: Float32Array;
  private loopDir: Float32Array;
  private loopSweep: Float32Array;

  /** the 12b family record per slot (null for straight/bezier styles) */
  private extra: ( CurveStyleExtras | null )[];

  /** 12c styled records: haystack-radius and the manual-endpoint spec */
  private hayRadius: Float32Array;
  private endpt: ( EndpointSpec | null )[];

  /** unordered endpoint pair → member edge slots (non-loop edges only);
   * null until some edge styles bezier */
  private pairs: Map<number, number[]> | null;
  /** node slot → its loop edge slots (always maintained; loops are rare) */
  private loops: Map<number, number[]>;
  private pending: Set<number>;
  /** non-loop blob-family edges awaiting per-edge derivation */
  private pendingSlots: Set<number>;
  private warnedCap: boolean;
  private warnedEndptDist: boolean;

  constructor( host: CurveHost ){
    this.host = host;
    this.style = new Uint8Array( 0 );
    this.step = new Float32Array( 0 );
    this.weight = new Float32Array( 0 );
    this.loopDir = new Float32Array( 0 );
    this.loopSweep = new Float32Array( 0 );
    this.extra = [];
    this.hayRadius = new Float32Array( 0 );
    this.endpt = [];
    this.pairs = null;
    this.loops = new Map();
    this.pending = new Set();
    this.pendingSlots = new Set();
    this.warnedCap = false;
    this.warnedEndptDist = false;
  }

  // -- styled records --

  /**
   * Store an edge's styled curve record (the StyleEngine's write path).
   * A changed record marks the edge's pair for re-derivation; a bezier
   * record lazily builds the pair index on first use.
   */
  setStyle(
    slot: number, style: number, stepSize: number, weight: number,
    loopDirection: number, loopSweep: number, extras: CurveStyleExtras | null = null,
    haystackRadius: number = 0, endpoints_: EndpointSpec | null = null
  ): void {
    this.ensure( slot );

    // blob-family records keep their extras; others store none
    const nextExtra = isBlobStyle( style ) ? extras ?? CURVE_EXTRA_DEFAULTS : null;
    // an all-default endpoint spec stores as null (no block emitted)
    const nextEndpt = isDefaultEndpt( endpoints_ ) ? null : endpoints_;
    const changed = this.style[ slot ] !== style || this.step[ slot ] !== stepSize ||
      this.weight[ slot ] !== weight || this.loopDir[ slot ] !== loopDirection ||
      this.loopSweep[ slot ] !== loopSweep || !extrasEq( this.extra[ slot ], nextExtra ) ||
      this.hayRadius[ slot ] !== haystackRadius || !endptEq( this.endpt[ slot ], nextEndpt );

    if( !changed ){ return; }

    const oldStyle = this.style[ slot ];
    const hadEndpt = this.endpt[ slot ] != null;

    this.style[ slot ] = style;
    this.step[ slot ] = stepSize;
    this.weight[ slot ] = weight;
    this.loopDir[ slot ] = loopDirection;
    this.loopSweep[ slot ] = loopSweep;
    this.extra[ slot ] = nextExtra;
    this.hayRadius[ slot ] = haystackRadius;
    this.endpt[ slot ] = nextEndpt;

    if( style === CURVE_STYLE_BEZIER && this.pairs == null ){
      this.buildPairIndex();
    }

    const endpoints = this.host.endpoints();
    const source = endpoints[ slot * 2 ];
    const target = endpoints[ slot * 2 + 1 ];

    // the pair re-derives (bundle membership may change); a non-loop
    // blob-family edge also derives per-edge — as does a blob edge
    // restyled *away* (the pair map may not exist without any bezier,
    // so derivePair alone could never reset its params), a 12c
    // straight-stream style (haystack/triangle, per-edge by nature),
    // and any edge whose endpoint spec is (or was) non-default
    this.markPair( source, target );

    if( source !== target && (
      isBlobStyle( style ) || isBlobStyle( oldStyle ) ||
      isStraightStreamStyle( style ) || isStraightStreamStyle( oldStyle ) ||
      nextEndpt != null || hadEndpt
    ) ){
      this.pendingSlots.add( slot );
      this.host.schedule();
    }
  }

  /** The styled record (stored truth for the style getters).  `extras`
   * is null unless the style is a 12b family. */
  styleAt( slot: number ): {
    style: number; stepSize: number; weight: number; loopDirection: number; loopSweep: number;
    extras: CurveStyleExtras | null; haystackRadius: number; endpoints: EndpointSpec | null;
  } {
    if( slot >= this.style.length ){
      return { ...CURVE_DEFAULTS, extras: null, haystackRadius: 0, endpoints: null };
    }

    return {
      style: this.style[ slot ],
      stepSize: this.step[ slot ],
      weight: this.weight[ slot ],
      loopDirection: this.loopDir[ slot ],
      loopSweep: this.loopSweep[ slot ],
      extras: this.extra[ slot ] ?? null,
      haystackRadius: this.hayRadius[ slot ],
      endpoints: this.endpt[ slot ] ?? null
    };
  }

  // -- topology maintenance (the store's mutation hooks) --

  onAddEdge( slot: number, source: number, target: number ): void {
    if( source === target ){
      let list = this.loops.get( source );

      if( list == null ){
        list = [];
        this.loops.set( source, list );
      }

      list.push( slot );
      this.markPair( source, target );

      return;
    }

    if( this.pairs != null ){
      const key = pairKey( source, target );
      let list = this.pairs.get( key );

      if( list == null ){
        list = [];
        this.pairs.set( key, list );
      }

      list.push( slot );

      // a new straight edge doesn't change the bundle, but a recycled
      // slot may carry a stale record; it was cleared on remove, so only
      // a bezier record needs the pair re-derived (its own style apply
      // marks it then)
    }

    // compound relation (14.10): the edge routes around the outside
    // regardless of style — the pair derivation needs the bundle index,
    // so a relation is also a pair-map build trigger
    if( this.host.relation( source, target ) ){
      if( this.pairs == null ){ this.buildPairIndex(); }

      this.markPair( source, target );
    }
  }

  /** A hierarchy change moved the relation of this pair (round 14.10). */
  /**
   * A display-tier shown/hidden flip (round 22.3): the edge's bundle
   * membership (or loop stagger) changes, so its pair re-derives —
   * v3's display semantics, where siblings re-fan around a hidden
   * member.  Visibility flips never come here, so `visibility: hidden`
   * keeps every rank stable by construction.
   */
  onEdgeShownChanged( slot: number ): void {
    const endpoints = this.host.endpoints();
    const a = endpoints[ slot * 2 ];
    const b = endpoints[ slot * 2 + 1 ];

    // loops always re-stagger; non-loop pairs only matter once the
    // bezier pair index exists (straight-only graphs stay free)
    if( a === b || this.pairs != null || this.host.relation( a, b ) ){
      this.invalidateRelation( a, b );
    }
  }

  invalidateRelation( a: number, b: number ): void {
    if( a !== b && this.pairs == null && this.host.relation( a, b ) ){
      this.buildPairIndex(); // the compound derivation needs bundle indices
    }

    this.markPair( a, b );
  }

  onRemoveEdge( slot: number, source: number, target: number ): void {
    if( source === target ){
      const list = this.loops.get( source );

      if( list != null ){
        const i = list.indexOf( slot );

        if( i >= 0 ){ list.splice( i, 1 ); }
        if( list.length === 0 ){ this.loops.delete( source ); }
      }

      this.markPair( source, target );
    } else if( this.pairs != null ){
      const key = pairKey( source, target );
      const list = this.pairs.get( key );

      if( list != null ){
        const i = list.indexOf( slot );

        if( i >= 0 ){ list.splice( i, 1 ); }
        if( list.length === 0 ){ this.pairs.delete( key ); }
      }

      if( this.style[ slot ] === CURVE_STYLE_BEZIER ){
        this.markPair( source, target );
      }
    }

    // reset the record so a recycled slot reads benign defaults until
    // its own style applies
    if( slot < this.style.length ){
      this.style[ slot ] = CURVE_DEFAULTS.style;
      this.step[ slot ] = CURVE_DEFAULTS.stepSize;
      this.weight[ slot ] = CURVE_DEFAULTS.weight;
      this.loopDir[ slot ] = CURVE_DEFAULTS.loopDirection;
      this.loopSweep[ slot ] = CURVE_DEFAULTS.loopSweep;
      this.extra[ slot ] = null;
      this.hayRadius[ slot ] = 0;
      this.endpt[ slot ] = null;
    }

    this.pendingSlots.delete( slot );

    // the derived params reset too (removed slots must not read curved;
    // the straight write also frees any blob record)
    this.host.writeParams( slot, 0, 0, 0, CURVE_STRAIGHT );
  }

  onMoveEdge( slot: number, oldSource: number, oldTarget: number, source: number, target: number ): void {
    // the styled record survives a move (only the pair membership changes)
    const style = slot < this.style.length ? this.style[ slot ] : CURVE_STYLE_STRAIGHT;

    if( oldSource === oldTarget ){
      const list = this.loops.get( oldSource );

      if( list != null ){
        const i = list.indexOf( slot );

        if( i >= 0 ){ list.splice( i, 1 ); }
        if( list.length === 0 ){ this.loops.delete( oldSource ); }
      }

      this.markPair( oldSource, oldTarget );
    } else if( this.pairs != null ){
      const key = pairKey( oldSource, oldTarget );
      const list = this.pairs.get( key );

      if( list != null ){
        const i = list.indexOf( slot );

        if( i >= 0 ){ list.splice( i, 1 ); }
        if( list.length === 0 ){ this.pairs.delete( key ); }
      }

      if( style === CURVE_STYLE_BEZIER ){ this.markPair( oldSource, oldTarget ); }
    }

    this.onAddEdge( slot, source, target );

    if( source !== target && style === CURVE_STYLE_BEZIER ){
      this.markPair( source, target );
    }

    // an edge moved out of a loop (or bundle) must re-derive even when
    // its new pair needs nothing
    if( source !== target && oldSource === oldTarget ){
      this.host.writeParams( slot, 0, 0, 0, CURVE_STRAIGHT );

      if( style === CURVE_STYLE_BEZIER ){ this.markPair( source, target ); }

      if( isBlobStyle( style ) || isStraightStreamStyle( style ) || this.endpt[ slot ] != null ){
        this.pendingSlots.add( slot );
        this.host.schedule();
      }
    }
  }

  // -- derivation --

  hasPending(): boolean {
    return this.pending.size > 0 || this.pendingSlots.size > 0;
  }

  /** Re-derive the params of every pending pair and per-edge record
   * (lazy; see module doc). */
  flush(): void {
    // loops until settled: a per-edge derivation that discovers a
    // compound relation re-marks its pair (14.10), which must derive in
    // the same flush; derivations never re-mark themselves, so this
    // terminates
    while( this.pending.size > 0 || this.pendingSlots.size > 0 ){
      if( this.pending.size > 0 ){
        const pending = this.pending;

        this.pending = new Set();

        for( const key of pending ){
          const a = Math.floor( key / 0x8000000 );
          const b = key % 0x8000000;

          if( a === b ){
            this.deriveLoops( a );
          } else {
            this.derivePair( key, a );
          }
        }
      }

      if( this.pendingSlots.size > 0 ){
        const slots = this.pendingSlots;

        this.pendingSlots = new Set();

        for( const slot of slots ){
          this.deriveEdge( slot );
        }
      }
    }
  }

  /**
   * The compound-loop derivation (14.10): v3's findCompoundLoopPoints
   * params — the loop distance (unbundled styles take
   * control-point-distances[0], j = 0, v3's rule) and the bundle index.
   * p2 carries a conservative derivation-time excursion bound for the
   * cull slack (the geometry itself evaluates from live inputs): the
   * control offset x the current max stretch x 2 — stretch grows only
   * logarithmically with node size, so the margin outlasts any
   * realistic auto-bounds growth, and relation changes re-derive.
   */
  private writeCompoundDerived( slot: number, source: number, target: number, i: number ): void {
    this.ensure( slot );

    const extra = this.extra[ slot ];
    const unbundled = this.style[ slot ] === CURVE_STYLE_UNBUNDLED;
    const dist = unbundled && extra?.ctrlDists != null && extra.ctrlDists.length > 0
      ? extra.ctrlDists[ 0 ]
      : this.step[ slot ];
    const j = unbundled ? 0 : i;

    const factor = ( 1 + Math.pow( 50, 1.12 ) / 100 ) * dist * ( j / 3 + 1 );
    const stretch = Math.max(
      0.5,
      Math.log( 2 * this.host.outerHalfW( source ) * 0.01 ),
      Math.log( 2 * this.host.outerHalfW( target ) * 0.01 )
    );

    this.host.writeParams( slot, dist, j, factor * stretch * 2, CURVE_CMPD );
  }

  /**
   * Slot compaction (19.2).  The per-edge styled records permute through
   * `edgeRemap` (null when only nodes compacted); the pair/loop maps —
   * keyed on *node* slots — rebuild from the live endpoints either way.
   * The remap is monotone, so bundle rank, loop stagger and the σ
   * orientation all read identically through the new slots: derived
   * params in the curveParams column (already moved with the table) stay
   * valid with **no re-derivation**.  Call after the endpoints column is
   * rewritten, with derivations flushed.
   */
  remapSlots( edgeRemap: Uint32Array | null ): void {
    if( edgeRemap != null ){
      const n = Math.min( edgeRemap.length, this.style.length );

      for( let s = 0; s < n; s++ ){
        const d = edgeRemap[ s ];

        if( d === NO_SLOT || d === s ){ continue; }

        this.style[ d ] = this.style[ s ];
        this.step[ d ] = this.step[ s ];
        this.weight[ d ] = this.weight[ s ];
        this.loopDir[ d ] = this.loopDir[ s ];
        this.loopSweep[ d ] = this.loopSweep[ s ];
        this.hayRadius[ d ] = this.hayRadius[ s ];
        this.extra[ d ] = this.extra[ s ];
        this.endpt[ d ] = this.endpt[ s ];

        this.style[ s ] = CURVE_STYLE_STRAIGHT;
        this.step[ s ] = 0;
        this.weight[ s ] = 0;
        this.loopDir[ s ] = 0;
        this.loopSweep[ s ] = 0;
        this.hayRadius[ s ] = 0;
        this.extra[ s ] = null;
        this.endpt[ s ] = null;
      }
    }

    // node-keyed maps: every key may have moved — rebuild from the truth
    if( this.pairs != null ){ this.buildPairIndex(); }

    const loops = new Map<number, number[]>();
    const endpoints = this.host.endpoints();

    for( const slot of this.host.aliveEdgeSlots() ){
      const source = endpoints[ slot * 2 ];

      if( source !== endpoints[ slot * 2 + 1 ] ){ continue; }

      let list = loops.get( source );

      if( list == null ){
        list = [];
        loops.set( source, list );
      }

      list.push( slot );
    }

    this.loops = loops;

    // derivations were flushed before the move; stale keys must not leak
    this.pending.clear();
    this.pendingSlots.clear();
  }

  private markPair( a: number, b: number ): void {
    this.pending.add( pairKey( a, b ) );
    this.host.schedule();
  }

  /** Build the pair map from the live edges (first bezier record). */
  private buildPairIndex(): void {
    const pairs = new Map<number, number[]>();
    const endpoints = this.host.endpoints();

    for( const slot of this.host.aliveEdgeSlots() ){
      const source = endpoints[ slot * 2 ];
      const target = endpoints[ slot * 2 + 1 ];

      if( source === target ){ continue; } // loops live in their own lists

      const key = pairKey( source, target );
      let list = pairs.get( key );

      if( list == null ){
        list = [];
        pairs.set( key, list );
      }

      list.push( slot );
    }

    this.pairs = pairs;
  }

  private derivePair( key: number, canonicalSource: number ): void {
    const members = this.pairs?.get( key );

    if( members == null || members.length === 0 ){ return; }

    // compound relation (14.10): every member routes around the outside,
    // whatever its curve style (the sibling of the all-loops rule)
    const hi = Math.floor( key / 0x8000000 );
    const lo = key % 0x8000000;

    if( this.host.relation( hi, lo ) ){
      const endpoints = this.host.endpoints();
      let i = 0; // hidden members leave the stagger (22.3, display tier)

      for( const slot of members ){
        if( !this.host.edgeShown( slot ) ){ continue; }

        this.writeCompoundDerived( slot, endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ], i++ );
      }

      return;
    }

    // the bundle: *shown* bezier-styled members in slot order (v3 sorts
    // by pool index; slot order is the v4 analogue).  Display-hidden
    // members leave the bundle — siblings re-fan (22.3); invisible ones
    // never reach this code, so their ranks hold.
    const bundle: number[] = [];

    for( const slot of members ){
      if( slot < this.style.length && this.style[ slot ] === CURVE_STYLE_BEZIER
        && this.host.edgeShown( slot ) ){
        bundle.push( slot );
      }
    }

    bundle.sort( ( x, y ) => x - y );

    const n = bundle.length;
    const mid = n % 2 === 1 ? ( n - 1 ) / 2 : -1;
    const endpoints = this.host.endpoints();

    for( const slot of members ){
      // hidden members take no part (22.3): their params freeze until a
      // show() re-derives the pair
      if( !this.host.edgeShown( slot ) ){ continue; }

      // blob-family and 12c straight-stream members own their params
      // (per-edge derivation) — a pair re-derivation must not clobber
      const st = slot < this.style.length ? this.style[ slot ] : CURVE_STYLE_STRAIGHT;

      if( isBlobStyle( st ) || isStraightStreamStyle( st ) ){ continue; }

      const i = bundle.indexOf( slot );

      if( i < 0 || i === mid ){
        // straight-styled member, or the odd bundle's middle edge —
        // endpoint-aware (a manual-endpoint chord when a spec is set)
        this.writeStraightDerived( slot );
        continue;
      }

      // sign: +1 when the edge runs in the pair's canonical direction
      const sigma = endpoints[ slot * 2 ] === canonicalSource ? 1 : -1;
      const d = bundleOffset( n, i, this.step[ slot ] ) * sigma;

      this.writeBezierDerived( slot, d, this.weight[ slot ] );
    }
  }

  private deriveLoops( node: number ): void {
    const list = this.loops.get( node );

    if( list == null || list.length === 0 ){ return; }

    // hidden loops leave the stagger (22.3, display tier)
    const sorted = list.filter( slot => this.host.edgeShown( slot ) ).sort( ( x, y ) => x - y );

    // a self-loop on a compound parent routes around the outside (14.10)
    if( this.host.relation( node, node ) ){
      for( let i = 0; i < sorted.length; i++ ){
        this.writeCompoundDerived( sorted[ i ], node, node, i );
      }

      return;
    }

    const counts = new Map<string, number>();

    for( const slot of sorted ){
      this.ensure( slot );

      const dir = this.loopDir[ slot ];
      const sweep = this.loopSweep[ slot ];
      const dc = `${dir}_${sweep}`;
      const j = counts.get( dc ) ?? 0;

      counts.set( dc, j + 1 );

      // v3: unbundled-family loops take control-point-distances[0] as
      // the loop distance; v4 falls back to the step size when unset
      // (v3 yields NaN geometry there — a recorded deviation)
      const extra = this.extra[ slot ];
      const loopDist = extra?.ctrlDists != null && extra.ctrlDists.length > 0
        ? extra.ctrlDists[ 0 ]
        : this.step[ slot ];

      const { out, in: inn } = loopAngles( dir, sweep );
      const r = loopRadius( loopDist, j );

      this.host.writeParams( slot, out, inn, r, CURVE_LOOP );
    }
  }

  /**
   * Per-edge derivation for the 12b blob families.  Records are
   * position-independent (the frame is applied at eval time), so only
   * style changes re-derive — never drags or layouts.  Interior counts
   * cap at the strip subdivision's limits (a recorded deviation from
   * v3's unbounded lists); weights clamp to [-1, 2] so the box cull
   * bound stays sound, and any weight outside [0, 1] marks the edge
   * box-bounded (FLAG_CURVED_BOX via the host).
   */
  private deriveEdge( slot: number ): void {
    const endpoints = this.host.endpoints();

    if( endpoints[ slot * 2 ] === endpoints[ slot * 2 + 1 ] ){ return; } // loops derive per-node

    // compound relation (14.10): the pair derivation owns the routing
    // (it holds the bundle indices) — hand over instead of clobbering
    if( this.host.relation( endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ] ) ){
      this.invalidateRelation( endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ] );

      return;
    }

    const style = slot < this.style.length ? this.style[ slot ] : CURVE_STYLE_STRAIGHT;

    // 12c straight-stream styles: per-edge params, FLAG_CURVED clear
    if( style === CURVE_STYLE_HAYSTACK ){
      const h = this.host.idHash( slot );

      this.host.writeParams(
        slot, haystackAngle( h, false ), haystackAngle( h, true ),
        this.hayRadius[ slot ], CURVE_HAYSTACK );

      return;
    }

    if( style === CURVE_STYLE_TRIANGLE ){
      this.host.writeParams( slot, 0, 0, 0, CURVE_TRIANGLE );

      return;
    }

    if( !isBlobStyle( style ) ){
      // restyled away while pending: a bezier is the pair derivation's
      // job, but a straight edge must reset here — its pair may not
      // even have a map entry (the pair index is bezier-lazy)
      if( style === CURVE_STYLE_STRAIGHT ){
        this.writeStraightDerived( slot );
      }

      return;
    }

    const ex = this.extra[ slot ] ?? CURVE_EXTRA_DEFAULTS;

    if( style === CURVE_STYLE_UNBUNDLED ){
      const dists = ex.ctrlDists;
      const weights = ex.ctrlWeights;
      let n = dists == null ? 1 : Math.min( dists.length, weights.length );

      if( n <= 0 ){
        this.host.writeParams( slot, 0, 0, 0, CURVE_STRAIGHT );

        return;
      }

      n = this.capCount( n, MAX_MULTI_CTRL, 'control points' );

      const rec: number[] = [ this.resolveEdgeDistances( slot, ex ) ];
      let dev = 0;
      let box = false;

      for( let b = 0; b < n; b++ ){
        const d = dists == null ? this.step[ slot ] : dists[ b ];
        const w = this.clampWeight( weights[ b ] ?? CURVE_DEFAULTS.weight );

        rec.push( d, w );

        if( Math.abs( d ) > dev ){ dev = Math.abs( d ); }
        if( w < 0 || w > 1 ){ box = true; }
      }

      this.writeBlob( slot, CURVE_MULTI, rec, n, dev, box );

      return;
    }

    if( style === CURVE_STYLE_SEGMENTS || style === CURVE_STYLE_ROUND_SEGMENTS ){
      let n = Math.min( ex.segDists.length, ex.segWeights.length );

      if( n <= 0 ){
        this.host.writeParams( slot, 0, 0, 0, CURVE_STRAIGHT );

        return;
      }

      n = this.capCount( n, MAX_CURVE_PTS, 'segment points' );

      const round = style === CURVE_STYLE_ROUND_SEGMENTS;
      const rec: number[] = [ this.resolveEdgeDistances( slot, ex ), round ? 1 : 0 ];
      const lastRadius = ex.segRadii[ ex.segRadii.length - 1 ] ?? 15;
      const lastType = ex.radiusTypes[ ex.radiusTypes.length - 1 ] ?? 1;
      let dev = 0;
      let box = false;

      for( let s = 0; s < n; s++ ){
        const d = ex.segDists[ s ];
        const w = this.clampWeight( ex.segWeights[ s ] );

        rec.push( d, w, ex.segRadii[ s ] ?? lastRadius, ex.radiusTypes[ s ] ?? lastType );

        if( Math.abs( d ) > dev ){ dev = Math.abs( d ); }
        if( w < 0 || w > 1 ){ box = true; }
      }

      this.writeBlob( slot, CURVE_SEGMENTS, rec, n, dev, box );

      return;
    }

    // taxi / round-taxi: fixed 8-float record, always box-bounded.
    // v3 forces taxi endpoint *keywords* to outside-to-node (distances
    // still apply) — writeBlob's taxi=true drops the modes accordingly.
    const round = style === CURVE_STYLE_ROUND_TAXI;

    this.writeBlob( slot, CURVE_TAXI, [
      ex.taxiDir, ex.taxiTurn, ex.taxiTurnPercent ? 1 : 0, ex.taxiTurnMinDist,
      ex.edgeDistances, round ? 1 : 0, ex.taxiRadius, ex.radiusTypes[ 0 ] ?? 1
    ], 0, 0, true, true );
  }

  /**
   * v3's edge-distances: 'endpoints' rule (12c): the mode only holds
   * when *both* ends are manual (point or angle forms); otherwise warn
   * once — v3's message — and fall back to 'intersection'.
   */
  private resolveEdgeDistances( slot: number, ex: CurveStyleExtras ): number {
    if( ex.edgeDistances !== EDGE_DIST_ENDPOINTS ){ return ex.edgeDistances; }

    const e = this.endpt[ slot ];
    const manual = ( mode: number ): boolean => mode === ENDPT_POINT || mode === ENDPT_ANGLE;

    if( e != null && manual( e.srcMode ) && manual( e.tgtMode ) ){ return EDGE_DIST_ENDPOINTS; }

    if( !this.warnedEndptDist ){
      this.warnedEndptDist = true;
      console.warn(
        'cytoscape-gpu: an edge has edge-distances: endpoints without manual endpoints ' +
        'specified via source-endpoint and target-endpoint; falling back on ' +
        'edge-distances: intersection (default)'
      );
    }

    return EDGE_DIST_INTERSECTION;
  }

  /** Straight-styled derivation: plain straight params, or — with a
   * manual-endpoint spec — the CURVE_MULTI n = 0 chord record. */
  private writeStraightDerived( slot: number ): void {
    const e = this.endpt[ slot ];

    if( e == null ){
      this.host.writeParams( slot, 0, 0, 0, CURVE_STRAIGHT );

      return;
    }

    this.writeBlob( slot, CURVE_MULTI, [ EDGE_DIST_INTERSECTION ], 0, 0, false );
  }

  /** Bundled-bezier derivation: fixed-column params, or — with a
   * manual-endpoint spec — the promoted CURVE_MULTI n = 1 record (the
   * control formula is identical, so the curve is unchanged). */
  private writeBezierDerived( slot: number, d: number, w: number ): void {
    const e = this.endpt[ slot ];

    if( e == null ){
      this.host.writeParams( slot, d, w, 0, CURVE_BEZIER );

      return;
    }

    this.writeBlob(
      slot, CURVE_MULTI, [ EDGE_DIST_INTERSECTION, d, w ], 1,
      Math.abs( d ), w < 0 || w > 1 );
  }

  /**
   * Blob write with the 12c endpoint prefix: when the slot has a
   * manual-endpoint spec, the record is prefixed by the 10-float block
   * and the kind carries CURVE_HAS_ENDPT; px point offsets fold into
   * the header deviation, and pct offsets past the node half mark the
   * edge box-bounded and feed the store's monotone pct slack.  `taxi`
   * drops the endpoint *modes* (v3 forces outside-to-node for taxi)
   * while keeping the distances.
   */
  private writeBlob(
    slot: number, kind: number, recBody: number[], n: number, dev: number, box: boolean,
    taxi: boolean = false
  ): void {
    let e = this.endpt[ slot ];

    if( e != null && taxi && ( e.srcMode !== 0 || e.tgtMode !== 0 ) ){
      e = { ...e, srcMode: 0, srcA: 0, srcB: 0, srcPct: 0, tgtMode: 0, tgtA: 0, tgtB: 0, tgtPct: 0 };

      if( isDefaultEndpt( e ) ){ e = null; }
    }

    if( e == null ){
      this.host.writeBlobParams( slot, kind, recBody, n, dev, box, 0 );

      return;
    }

    const pct = endptPctMag( e );

    this.host.writeBlobParams(
      slot, kind + CURVE_HAS_ENDPT, [ ...endptBlock( e ), ...recBody ], n,
      dev + endptPxDev( e ), box || pct > 1, pct );
  }

  private capCount( n: number, max: number, what: string ): number {
    if( n <= max ){ return n; }

    if( !this.warnedCap ){
      this.warnedCap = true;
      console.warn(
        `cytoscape-gpu: a curved edge styles ${n} ${what}; the GPU prototype draws at most ` +
        `${max} per edge (the strip subdivision) — extra entries are ignored`
      );
    }

    return max;
  }

  private clampWeight( w: number ): number {
    return Math.max( -1, Math.min( 2, w ) );
  }

  private ensure( slot: number ): void {
    if( slot < this.style.length ){ return; }

    let cap = Math.max( 16, this.style.length );

    while( cap <= slot ){ cap *= 2; }

    const style = new Uint8Array( cap );
    const step = new Float32Array( cap );
    const weight = new Float32Array( cap );
    const loopDir = new Float32Array( cap );
    const loopSweep = new Float32Array( cap );
    const hayRadius = new Float32Array( cap );

    style.set( this.style );
    step.fill( CURVE_DEFAULTS.stepSize );
    step.set( this.step );
    weight.fill( CURVE_DEFAULTS.weight );
    weight.set( this.weight );
    loopDir.fill( CURVE_DEFAULTS.loopDirection );
    loopDir.set( this.loopDir );
    loopSweep.fill( CURVE_DEFAULTS.loopSweep );
    loopSweep.set( this.loopSweep );
    hayRadius.set( this.hayRadius );

    this.style = style;
    this.step = step;
    this.weight = weight;
    this.loopDir = loopDir;
    this.loopSweep = loopSweep;
    this.hayRadius = hayRadius;
  }
}

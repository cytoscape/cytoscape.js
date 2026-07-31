import {
  CURVE_BEZIER, CURVE_LOOP, CURVE_MULTI, CURVE_SEGMENTS, CURVE_STRAIGHT, CURVE_TAXI
} from '../contract.mjs';
import {
  bundleOffset, loopAngles, loopRadius,
  EDGE_DIST_INTERSECTION, MAX_CURVE_PTS, MAX_MULTI_CTRL, TAXI_AUTO
} from '../curve-geometry.mjs';

/*
CurveIndex (round 12a): bundle membership + curve-param derivation.

Owns the per-edge *styled* curve record (curve-style, step size, weight,
loop direction/sweep — the stored truth the style getters read) and the
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
  1.4 × step × (j/3 + 1).  (v4 deviation: *all* loops take this
  bundled-loop construction — v3 routes `straight`-styled loops
  through its unbundled path.)

Recomputes are lazy: mutations and record writes mark pairs pending,
and `flush()` (called from takeDelta / boundingBox / the accessors)
recomputes only the pending pairs — a bulk load or style apply pays
each pair once.
*/

export const CURVE_STYLE_STRAIGHT = 0;
export const CURVE_STYLE_BEZIER = 1;
// the 12b families (all "unbundled" in v3's sense: never pair-bundled)
export const CURVE_STYLE_UNBUNDLED = 2;
export const CURVE_STYLE_SEGMENTS = 3;
export const CURVE_STYLE_ROUND_SEGMENTS = 4;
export const CURVE_STYLE_TAXI = 5;
export const CURVE_STYLE_ROUND_TAXI = 6;

/** styles whose derived params live in the curve param blob */
export const isBlobStyle = ( style: number ): boolean => style >= CURVE_STYLE_UNBUNDLED;

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
  /** write a blob-backed record + its header (12b families) */
  writeBlobParams(
    slot: number, kind: number, values: ArrayLike<number>, n: number, dev: number, box: boolean
  ): void;
  /** schedule a frame / mark non-column dirt (DirtyTracker.touch) */
  schedule(): void;
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

  /** unordered endpoint pair → member edge slots (non-loop edges only);
   * null until some edge styles bezier */
  private pairs: Map<number, number[]> | null;
  /** node slot → its loop edge slots (always maintained; loops are rare) */
  private loops: Map<number, number[]>;
  private pending: Set<number>;
  /** non-loop blob-family edges awaiting per-edge derivation */
  private pendingSlots: Set<number>;
  private warnedCap: boolean;

  constructor( host: CurveHost ){
    this.host = host;
    this.style = new Uint8Array( 0 );
    this.step = new Float32Array( 0 );
    this.weight = new Float32Array( 0 );
    this.loopDir = new Float32Array( 0 );
    this.loopSweep = new Float32Array( 0 );
    this.extra = [];
    this.pairs = null;
    this.loops = new Map();
    this.pending = new Set();
    this.pendingSlots = new Set();
    this.warnedCap = false;
  }

  // -- styled records --

  /**
   * Store an edge's styled curve record (the StyleEngine's write path).
   * A changed record marks the edge's pair for re-derivation; a bezier
   * record lazily builds the pair index on first use.
   */
  setStyle(
    slot: number, style: number, stepSize: number, weight: number,
    loopDirection: number, loopSweep: number, extras: CurveStyleExtras | null = null
  ): void {
    this.ensure( slot );

    // blob-family records keep their extras; others store none
    const nextExtra = isBlobStyle( style ) ? extras ?? CURVE_EXTRA_DEFAULTS : null;
    const changed = this.style[ slot ] !== style || this.step[ slot ] !== stepSize ||
      this.weight[ slot ] !== weight || this.loopDir[ slot ] !== loopDirection ||
      this.loopSweep[ slot ] !== loopSweep || !extrasEq( this.extra[ slot ], nextExtra );

    if( !changed ){ return; }

    const oldStyle = this.style[ slot ];

    this.style[ slot ] = style;
    this.step[ slot ] = stepSize;
    this.weight[ slot ] = weight;
    this.loopDir[ slot ] = loopDirection;
    this.loopSweep[ slot ] = loopSweep;
    this.extra[ slot ] = nextExtra;

    if( style === CURVE_STYLE_BEZIER && this.pairs == null ){
      this.buildPairIndex();
    }

    const endpoints = this.host.endpoints();
    const source = endpoints[ slot * 2 ];
    const target = endpoints[ slot * 2 + 1 ];

    // the pair re-derives (bundle membership may change); a non-loop
    // blob-family edge also derives per-edge — as does a blob edge
    // restyled *away* (the pair map may not exist without any bezier,
    // so derivePair alone could never reset its params)
    this.markPair( source, target );

    if( source !== target && ( isBlobStyle( style ) || isBlobStyle( oldStyle ) ) ){
      this.pendingSlots.add( slot );
      this.host.schedule();
    }
  }

  /** The styled record (stored truth for the style getters).  `extras`
   * is null unless the style is a 12b family. */
  styleAt( slot: number ): {
    style: number; stepSize: number; weight: number; loopDirection: number; loopSweep: number;
    extras: CurveStyleExtras | null;
  } {
    if( slot >= this.style.length ){ return { ...CURVE_DEFAULTS, extras: null }; }

    return {
      style: this.style[ slot ],
      stepSize: this.step[ slot ],
      weight: this.weight[ slot ],
      loopDirection: this.loopDir[ slot ],
      loopSweep: this.loopSweep[ slot ],
      extras: this.extra[ slot ] ?? null
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

      if( isBlobStyle( style ) ){
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

    // the bundle: bezier-styled members in slot order (v3 sorts by pool
    // index; slot order is the v4 analogue)
    const bundle: number[] = [];

    for( const slot of members ){
      if( slot < this.style.length && this.style[ slot ] === CURVE_STYLE_BEZIER ){
        bundle.push( slot );
      }
    }

    bundle.sort( ( x, y ) => x - y );

    const n = bundle.length;
    const mid = n % 2 === 1 ? ( n - 1 ) / 2 : -1;
    const endpoints = this.host.endpoints();

    for( const slot of members ){
      // blob-family members own their params (per-edge derivation) —
      // a pair re-derivation must not clobber them
      if( slot < this.style.length && isBlobStyle( this.style[ slot ] ) ){ continue; }

      const i = bundle.indexOf( slot );

      if( i < 0 || i === mid ){
        // straight-styled member, or the odd bundle's middle edge
        this.host.writeParams( slot, 0, 0, 0, CURVE_STRAIGHT );
        continue;
      }

      // sign: +1 when the edge runs in the pair's canonical direction
      const sigma = endpoints[ slot * 2 ] === canonicalSource ? 1 : -1;
      const d = bundleOffset( n, i, this.step[ slot ] ) * sigma;

      this.host.writeParams( slot, d, this.weight[ slot ], 0, CURVE_BEZIER );
    }
  }

  private deriveLoops( node: number ): void {
    const list = this.loops.get( node );

    if( list == null || list.length === 0 ){ return; }

    const sorted = [ ...list ].sort( ( x, y ) => x - y );
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

    const style = slot < this.style.length ? this.style[ slot ] : CURVE_STYLE_STRAIGHT;

    if( !isBlobStyle( style ) ){
      // restyled away while pending: a bezier is the pair derivation's
      // job, but a straight edge must reset here — its pair may not
      // even have a map entry (the pair index is bezier-lazy)
      if( style === CURVE_STYLE_STRAIGHT ){
        this.host.writeParams( slot, 0, 0, 0, CURVE_STRAIGHT );
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

      const rec: number[] = [ ex.edgeDistances ];
      let dev = 0;
      let box = false;

      for( let b = 0; b < n; b++ ){
        const d = dists == null ? this.step[ slot ] : dists[ b ];
        const w = this.clampWeight( weights[ b ] ?? CURVE_DEFAULTS.weight );

        rec.push( d, w );

        if( Math.abs( d ) > dev ){ dev = Math.abs( d ); }
        if( w < 0 || w > 1 ){ box = true; }
      }

      this.host.writeBlobParams( slot, CURVE_MULTI, rec, n, dev, box );

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
      const rec: number[] = [ ex.edgeDistances, round ? 1 : 0 ];
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

      this.host.writeBlobParams( slot, CURVE_SEGMENTS, rec, n, dev, box );

      return;
    }

    // taxi / round-taxi: fixed 8-float record, always box-bounded
    const round = style === CURVE_STYLE_ROUND_TAXI;

    this.host.writeBlobParams( slot, CURVE_TAXI, [
      ex.taxiDir, ex.taxiTurn, ex.taxiTurnPercent ? 1 : 0, ex.taxiTurnMinDist,
      ex.edgeDistances, round ? 1 : 0, ex.taxiRadius, ex.radiusTypes[ 0 ] ?? 1
    ], 0, 0, true );
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

    style.set( this.style );
    step.fill( CURVE_DEFAULTS.stepSize );
    step.set( this.step );
    weight.fill( CURVE_DEFAULTS.weight );
    weight.set( this.weight );
    loopDir.fill( CURVE_DEFAULTS.loopDirection );
    loopDir.set( this.loopDir );
    loopSweep.fill( CURVE_DEFAULTS.loopSweep );
    loopSweep.set( this.loopSweep );

    this.style = style;
    this.step = step;
    this.weight = weight;
    this.loopDir = loopDir;
    this.loopSweep = loopSweep;
  }
}

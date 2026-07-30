import { CURVE_BEZIER, CURVE_LOOP, CURVE_STRAIGHT } from '../contract.mjs';
import { bundleOffset, loopAngles, loopRadius } from '../curve-geometry.mjs';

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

/** the styled defaults (v3's): step 40, weight 0.5, loop -45deg/-90deg */
export const CURVE_DEFAULTS = {
  style: CURVE_STYLE_STRAIGHT,
  stepSize: 40,
  weight: 0.5,
  loopDirection: -Math.PI / 4,
  loopSweep: -Math.PI / 2
} as const;

/** What the index needs from the store (kept narrow for testability). */
export interface CurveHost {
  /** the edge.endpoints column (source, target node slots interleaved) */
  endpoints(): Uint32Array;
  /** live edge slots in insertion order (for the lazy pair-index build) */
  aliveEdgeSlots(): number[];
  /** write the derived params (column write + FLAG_CURVED + dirty span) */
  writeParams( slot: number, p0: number, p1: number, p2: number, kind: number ): void;
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

  /** unordered endpoint pair → member edge slots (non-loop edges only);
   * null until some edge styles bezier */
  private pairs: Map<number, number[]> | null;
  /** node slot → its loop edge slots (always maintained; loops are rare) */
  private loops: Map<number, number[]>;
  private pending: Set<number>;

  constructor( host: CurveHost ){
    this.host = host;
    this.style = new Uint8Array( 0 );
    this.step = new Float32Array( 0 );
    this.weight = new Float32Array( 0 );
    this.loopDir = new Float32Array( 0 );
    this.loopSweep = new Float32Array( 0 );
    this.pairs = null;
    this.loops = new Map();
    this.pending = new Set();
  }

  // -- styled records --

  /**
   * Store an edge's styled curve record (the StyleEngine's write path).
   * A changed record marks the edge's pair for re-derivation; a bezier
   * record lazily builds the pair index on first use.
   */
  setStyle(
    slot: number, style: number, stepSize: number, weight: number,
    loopDirection: number, loopSweep: number
  ): void {
    this.ensure( slot );

    const changed = this.style[ slot ] !== style || this.step[ slot ] !== stepSize ||
      this.weight[ slot ] !== weight || this.loopDir[ slot ] !== loopDirection ||
      this.loopSweep[ slot ] !== loopSweep;

    if( !changed ){ return; }

    this.style[ slot ] = style;
    this.step[ slot ] = stepSize;
    this.weight[ slot ] = weight;
    this.loopDir[ slot ] = loopDirection;
    this.loopSweep[ slot ] = loopSweep;

    if( style === CURVE_STYLE_BEZIER && this.pairs == null ){
      this.buildPairIndex();
    }

    const endpoints = this.host.endpoints();

    this.markPair( endpoints[ slot * 2 ], endpoints[ slot * 2 + 1 ] );
  }

  /** The styled record (stored truth for the style getters). */
  styleAt( slot: number ): {
    style: number; stepSize: number; weight: number; loopDirection: number; loopSweep: number;
  } {
    if( slot >= this.style.length ){ return { ...CURVE_DEFAULTS }; }

    return {
      style: this.style[ slot ],
      stepSize: this.step[ slot ],
      weight: this.weight[ slot ],
      loopDirection: this.loopDir[ slot ],
      loopSweep: this.loopSweep[ slot ]
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
    }

    // the derived params reset too (removed slots must not read curved)
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
    }
  }

  // -- derivation --

  hasPending(): boolean {
    return this.pending.size > 0;
  }

  /** Re-derive the params of every pending pair (lazy; see module doc). */
  flush(): void {
    if( this.pending.size === 0 ){ return; }

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

      const { out, in: inn } = loopAngles( dir, sweep );
      const r = loopRadius( this.step[ slot ], j );

      this.host.writeParams( slot, out, inn, r, CURVE_LOOP );
    }
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

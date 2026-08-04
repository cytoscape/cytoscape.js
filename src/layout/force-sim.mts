/*
The force layout's reference simulation (round 18.1): spring–electric
over slots, CPU-canonical and fully deterministic — the spec the GPU
kernels (18.3) must match.

Model, per iteration (gather-only — every force on node i is computed
by iterating i's neighbors, never scattered from j — so a fixed loop
order gives a fixed FP reduction order and bitwise-deterministic runs
per executor):

- **Repulsion** via a uniform-grid cutoff: the grid rebuilds each
  iteration by counting sort (cell = the cutoff radius, so the 3×3
  neighborhood covers every pair within range); the force falls off as
  `repulsion · (1 − r/cutoff)²` along the separation.  The cutoff is
  the mean ideal edge length — repulsion vanishes exactly where a
  spring rests, so connected pairs settle at their edge length.  Coincident
  points separate along a deterministic index-hash direction (a seeded
  scatter makes this near-impossible, but degenerate inputs must not
  NaN).
- **Springs** along edges toward the per-edge ideal length:
  `stiffness · (r − L)`.
- **Gravity** toward the origin (`gravity · −p`), keeping disconnected
  components in frame.
- **Integration**: pure damped gradient stepping — each node moves by
  `F · alpha` per iteration (no velocity state: no ringing, one less
  GPU buffer, and displacement tracks force directly, which makes the
  threshold settle robust); `alpha` anneals toward zero by `decay`
  (the d3 shape).  Convergence: a fixed alpha floor, or the max
  per-node displacement stays under `threshold` for a few consecutive
  iterations.

Pinned nodes (locked, or outside a subset scope) take part in every
force pair but never move.
*/

export interface ForceParams {
  repulsion: number;
  stiffness: number;
  gravity: number;
  /** alpha annealing rate per iteration (d3's alphaDecay shape) */
  decay: number;
  /** convergence: max displacement (model px) that counts as settled */
  threshold: number;
  /** hard iteration cap */
  iterations: number;
}

/**
 * A fresh set of tuned defaults, one object per call so callers may
 * overwrite fields freely.  These constants are part of the CPU/GPU
 * contract: both executors must be driven with the same params to be
 * comparable at all (18.3).
 */
export const defaultForceParams = (): ForceParams => ( {
  repulsion: 200,
  stiffness: 0.1,
  gravity: 0.02,
  decay: 0.015,
  threshold: 0.1,
  iterations: 1000
} );

export interface ForceSimInputs extends ForceParams {
  /** node count; sim indices 0..n-1 (the caller maps slots ↔ indices) */
  n: number;
  /** edge endpoint pairs as sim indices */
  edges: Uint32Array;
  /** per-edge ideal length */
  edgeLength: Float32Array;
  /** in/out: 2n interleaved coordinates, seeded by the caller */
  positions: Float32Array;
  /** 1 = the node participates but never moves */
  pinned?: Uint8Array;
}

/** Deterministic seeded scatter (Knuth-hash polar): same (n, seed,
 * spread) → identical positions on every machine. */
export const seedPositions = (
  n: number, seed: number, spread: number, out: Float32Array
): void => {
  for( let i = 0; i < n; i++ ){
    const h = ( ( i + 1 ) * 2654435761 + seed * 40503 ) >>> 0;
    const angle = ( h & 0xffff ) / 0x10000 * Math.PI * 2;
    const radius = ( ( h >>> 16 ) / 0x10000 ) * spread + spread * 0.02 * ( i % 7 );

    out[ i * 2 ] = Math.cos( angle ) * radius;
    out[ i * 2 + 1 ] = Math.sin( angle ) * radius;
  }
};

const CONVERGE_RUNS = 3;

export class ForceSim {
  /** the live 2n interleaved coordinates — the caller's own seeded array,
   * mutated in place, so the caller reads results straight out of it */
  readonly positions: Float32Array;
  /** the last step's max per-node displacement */
  lastMaxDisp = Infinity;
  /** the annealing temperature, 1 at construction, decaying toward 0 */
  alpha = 1;
  /** iterations completed so far */
  iteration = 0;

  private n: number;
  private edges: Uint32Array;
  private edgeLength: Float32Array;
  private pinned: Uint8Array | null;
  private params: ForceParams;
  /** per-node force scratch (gather output; applied in a second pass) */
  private forces: Float32Array;
  /** per-node incident edge index lists (gather-side springs) */
  private incident: Int32Array;
  private incidentStart: Int32Array;
  private cutoff: number;
  /** grid scratch */
  private cellOf: Int32Array;
  private cellStart: Int32Array;
  private cellItems: Uint32Array;
  private gridCols = 0;
  private gridRows = 0;
  private gridX = 0;
  private gridY = 0;
  private settledRuns = 0;

  /**
   * Build a run.  Derives the repulsion cutoff (the mean ideal edge
   * length, floored at 40) and the CSR incident-edge lists once, so the
   * topology is fixed for the life of the sim — adding or removing edges
   * means a new `ForceSim`.
   *
   * @param inputs — the params plus the graph; `positions`, `edges`,
   *   `edgeLength`, and `pinned` are retained by reference, not copied,
   *   and `positions` is written in place on every `step`
   */
  constructor( inputs: ForceSimInputs ){
    this.n = inputs.n;
    this.edges = inputs.edges;
    this.edgeLength = inputs.edgeLength;
    this.positions = inputs.positions;
    this.pinned = inputs.pinned ?? null;
    this.params = inputs;
    this.forces = new Float32Array( inputs.n * 2 );

    // the repulsion cutoff is the mean ideal edge length: repulsion
    // vanishes exactly where a spring holds its rest length, so a
    // connected pair's equilibrium is L itself (not L inflated by
    // residual repulsion), and unconnected neighbors spread to ~L
    let sum = 0;

    for( let i = 0; i < inputs.edgeLength.length; i++ ){ sum += inputs.edgeLength[ i ]; }

    const meanL = inputs.edgeLength.length > 0 ? sum / inputs.edgeLength.length : 60;

    this.cutoff = Math.max( 40, meanL );

    // CSR-style incident lists from the edge pairs (counting pass)
    const counts = new Int32Array( inputs.n + 1 );
    const m = inputs.edges.length / 2;

    for( let e = 0; e < m; e++ ){
      counts[ inputs.edges[ e * 2 ] + 1 ]++;
      counts[ inputs.edges[ e * 2 + 1 ] + 1 ]++;
    }

    for( let i = 0; i < inputs.n; i++ ){ counts[ i + 1 ] += counts[ i ]; }

    this.incidentStart = counts;
    this.incident = new Int32Array( m * 2 );

    const cursor = counts.slice( 0, inputs.n );

    for( let e = 0; e < m; e++ ){
      this.incident[ cursor[ inputs.edges[ e * 2 ] ]++ ] = e;
      this.incident[ cursor[ inputs.edges[ e * 2 + 1 ] ]++ ] = e;
    }

    this.cellOf = new Int32Array( inputs.n );
    this.cellStart = new Int32Array( 0 );
    this.cellItems = new Uint32Array( inputs.n );
  }

  /**
   * Whether the run is finished.  True once any of three holds: the
   * iteration cap is reached, `alpha` has annealed below 0.001, or the max
   * per-node displacement has stayed under `threshold` for
   * `CONVERGE_RUNS` consecutive iterations.  This is one of the invariants
   * the GPU integrator must agree on — the two executors need not follow
   * the same trajectory, but they must stop under the same conditions.
   */
  converged(): boolean {
    return this.iteration >= this.params.iterations
      || this.alpha < 0.001
      || this.settledRuns >= CONVERGE_RUNS;
  }

  /** Advance k iterations (stops early on convergence). */
  step( k: number = 1 ): void {
    for( let i = 0; i < k && !this.converged(); i++ ){ this.iterate(); }
  }

  private buildGrid(): void {
    const n = this.n;
    const pos = this.positions;
    const cell = this.cutoff;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for( let i = 0; i < n; i++ ){
      const x = pos[ i * 2 ], y = pos[ i * 2 + 1 ];

      if( x < minX ){ minX = x; }
      if( y < minY ){ minY = y; }
      if( x > maxX ){ maxX = x; }
      if( y > maxY ){ maxY = y; }
    }

    this.gridX = minX;
    this.gridY = minY;
    this.gridCols = Math.max( 1, Math.min( 4096, Math.floor( ( maxX - minX ) / cell ) + 1 ) );
    this.gridRows = Math.max( 1, Math.min( 4096, Math.floor( ( maxY - minY ) / cell ) + 1 ) );

    const cells = this.gridCols * this.gridRows;

    if( this.cellStart.length < cells + 1 ){ this.cellStart = new Int32Array( cells + 1 ); }
    else { this.cellStart.fill( 0, 0, cells + 1 ); }

    const cellStart = this.cellStart;

    for( let i = 0; i < n; i++ ){
      const cx = Math.min( this.gridCols - 1, Math.floor( ( pos[ i * 2 ] - minX ) / cell ) );
      const cy = Math.min( this.gridRows - 1, Math.floor( ( pos[ i * 2 + 1 ] - minY ) / cell ) );
      const c = cy * this.gridCols + cx;

      this.cellOf[ i ] = c;
      cellStart[ c + 1 ]++;
    }

    for( let c = 0; c < cells; c++ ){ cellStart[ c + 1 ] += cellStart[ c ]; }

    // stable counting sort: ascending index within each cell (the
    // deterministic gather order both executors share)
    const cursor = cellStart.slice( 0, cells );

    for( let i = 0; i < n; i++ ){
      this.cellItems[ cursor[ this.cellOf[ i ] ]++ ] = i;
    }
  }

  private iterate(): void {
    const { repulsion, stiffness, gravity, decay, threshold } = this.params;
    const n = this.n;
    const pos = this.positions;
    const force = this.forces;
    const alpha = this.alpha;
    const cutoff = this.cutoff;
    const cutoff2 = cutoff * cutoff;

    this.buildGrid();

    let maxDisp = 0;

    for( let i = 0; i < n; i++ ){
      if( this.pinned != null && this.pinned[ i ] === 1 ){ continue; }

      const x = pos[ i * 2 ], y = pos[ i * 2 + 1 ];
      let fx = 0, fy = 0;

      // repulsion: gather over the 3x3 cell neighborhood
      const cx = this.cellOf[ i ] % this.gridCols;
      const cy = ( this.cellOf[ i ] / this.gridCols ) | 0;

      for( let gy = Math.max( 0, cy - 1 ); gy <= Math.min( this.gridRows - 1, cy + 1 ); gy++ ){
        for( let gx = Math.max( 0, cx - 1 ); gx <= Math.min( this.gridCols - 1, cx + 1 ); gx++ ){
          const c = gy * this.gridCols + gx;

          for( let at = this.cellStart[ c ]; at < this.cellStart[ c + 1 ]; at++ ){
            const j = this.cellItems[ at ];

            if( j === i ){ continue; }

            let dx = x - pos[ j * 2 ];
            let dy = y - pos[ j * 2 + 1 ];
            let d2 = dx * dx + dy * dy;

            if( d2 >= cutoff2 ){ continue; }

            if( d2 < 1e-8 ){
              // coincident: separate along a deterministic hash direction
              const h = ( ( i * 31 + j ) * 2654435761 ) >>> 0;
              const a = ( h & 0xffff ) / 0x10000 * Math.PI * 2;

              dx = Math.cos( a ) * 0.01;
              dy = Math.sin( a ) * 0.01;
              d2 = 1e-4;
            }

            const r = Math.sqrt( d2 );
            const fall = 1 - r / cutoff;
            const f = repulsion * fall * fall / r;

            fx += dx * f;
            fy += dy * f;
          }
        }
      }

      // springs along incident edges (gather side)
      for( let at = this.incidentStart[ i ]; at < this.incidentStart[ i + 1 ]; at++ ){
        const e = this.incident[ at ];
        const s = this.edges[ e * 2 ];
        const t = this.edges[ e * 2 + 1 ];
        const other = s === i ? t : s;
        const dx = pos[ other * 2 ] - x;
        const dy = pos[ other * 2 + 1 ] - y;
        const r = Math.max( 1e-4, Math.hypot( dx, dy ) );
        const f = stiffness * ( r - this.edgeLength[ e ] ) / r;

        fx += dx * f;
        fy += dy * f;
      }

      // centering gravity
      fx += -x * gravity;
      fy += -y * gravity;

      force[ i * 2 ] = fx * alpha;
      force[ i * 2 + 1 ] = fy * alpha;
    }

    // apply in a second pass: the gather above must read a consistent
    // snapshot (the GPU kernel has the same two-dispatch structure)
    for( let i = 0; i < n; i++ ){
      if( this.pinned != null && this.pinned[ i ] === 1 ){ continue; }

      const dx = force[ i * 2 ];
      const dy = force[ i * 2 + 1 ];

      pos[ i * 2 ] += dx;
      pos[ i * 2 + 1 ] += dy;

      const disp = Math.abs( dx ) + Math.abs( dy );

      if( disp > maxDisp ){ maxDisp = disp; }
    }

    this.alpha += ( 0 - this.alpha ) * decay;
    this.lastMaxDisp = maxDisp;
    this.settledRuns = maxDisp < threshold ? this.settledRuns + 1 : 0;
    this.iteration++;
  }
}

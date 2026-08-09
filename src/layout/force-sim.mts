/*
The force layout's reference simulation (round 18.1): spring–electric
over slots, CPU-canonical and fully deterministic — the spec the GPU
kernels (18.3) must match.

Model, per iteration (gather-only — every force on node i is computed
by iterating i's neighbors, never scattered from j — so a fixed loop
order gives a fixed FP reduction order and bitwise-deterministic runs
per executor):

- **Repulsion** (59.3): one smooth inverse-square law across all
  pairs — force `repulsion · (cutoff/d)²` per pair (sfdp's p = 2
  exponent, the default Hu chose to limit peripheral over-spread) —
  evaluated exactly for the near field and by monopole approximation
  for the far field.  The grid rebuilds each iteration by counting
  sort (cell = the cutoff, the mean ideal edge length floored at 40);
  the near field gathers the finest 3×3 exactly; a **pyramid** of
  per-cell monopoles (count, Σx, Σy — each level halving the grid)
  covers everything else: at each level the node gathers the aligned
  6×6 block refining its parent's 3×3, minus its own 3×3 — every
  region of space counted exactly once across levels (cosmos.gl v3's
  shipped scheme; the round-18 cutoff falloff, which zeroed all force
  past one edge length, is superseded — it had no long-range term at
  all, which is why chains curled and clusters never separated).
  Coincident points separate along a deterministic index-hash
  direction (a seeded scatter makes this near-impossible, but
  degenerate inputs must not NaN).
- **Springs** along edges toward the per-edge ideal length, under
  d3-force's degree-normalised rule (round 59.1): per edge
  `k = stiffness / min(deg(s), deg(t))`, and the end being gathered
  takes the share `bias_i = deg(other) / (deg(i) + deg(other))`, so a
  node's aggregate per-tick spring correction is bounded by
  `stiffness` regardless of its degree.  That bound is what makes the
  integrator stable by construction — the round-18 form
  (`stiffness · (r − L)` per edge, unnormalised) diverged
  exponentially once `alpha · stiffness · degree` passed 2, which the
  ndex fixtures (mean degree 47) sit well past.
- **Gravity** (59.2): a constant-magnitude pull toward the node's
  *anchor* — its component's packed centre, handed in per node — never
  decaying with distance (ForceAtlas2's containment rule: constant
  gravity always beats a decaying repulsion at some radius, so escape
  is impossible).  With no anchors handed in, the origin.  The round-18
  form was linear (`gravity · −p`), which is scale-dependent and was
  doing double duty as the only thing separating components.
- **Integration**: pure damped gradient stepping — each node moves by
  `F · alpha` per iteration (no velocity state: no ringing, one less
  GPU buffer, and displacement tracks force directly, which makes the
  threshold settle robust), with the step's magnitude **capped at an
  alpha-annealed multiple of the repulsion cutoff** (59.1 — v3 cose's
  `limitForce` discipline; the cap is the second stability guard, and
  the one that holds whatever a future force term does); `alpha`
  anneals toward zero by `decay` (the d3 shape).  Convergence: a fixed
  alpha floor, or the max per-node displacement stays under
  `threshold` for a few consecutive iterations — where a **non-finite
  displacement never counts as settled** (59.1: NaN compares false
  against every bound, so the round-18 check read a fully-NaN
  iteration as displacement 0 and converged on destroyed positions).

Pinned nodes (locked, or outside a subset scope) take part in every
force pair but never move.
*/

export interface ForceParams {
  /** the pairwise push, in px per tick, at exactly one cutoff length
   * (the force law is `repulsion · (cutoff/d)²`) */
  repulsion: number;
  /** the fraction of an edge's length residual corrected per tick,
   * before degree normalisation (dimensionless; stable ≤ ~1) */
  stiffness: number;
  /** constant-magnitude anchor pull in px per tick (alpha-scaled) */
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
export const defaultForceParams = (): ForceParams => ({
  // 59.3: repulsion is now the push at one cutoff length under the
  // inverse-square law (the old value belonged to the cutoff falloff)
  repulsion: 1,
  // 59.1: stiffness is now the *fraction of the residual* corrected per
  // tick (d3's semantics), bounded per node by the degree-normalised
  // rule — 0.6 provisionally; 59.6 finalises the set together
  stiffness: 0.6,
  // 59.2: gravity is now a constant-magnitude anchor pull (px/tick)
  gravity: 1,
  decay: 0.015,
  threshold: 0.1,
  iterations: 1000,
});

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
  /** per-node gravity anchors, 2n interleaved (59.2 — the component
   * anchor field); absent means everything anchors at the origin */
  anchors?: Float32Array;
}

/** Deterministic seeded scatter (Knuth-hash polar): same (n, seed,
 * spread) → identical positions on every machine. */
export const seedPositions = (
  n: number,
  seed: number,
  spread: number,
  out: Float32Array,
): void => {
  for (let i = 0; i < n; i++) {
    const h = ((i + 1) * 2654435761 + seed * 40503) >>> 0;
    const angle = ((h & 0xffff) / 0x10000) * Math.PI * 2;
    const radius = ((h >>> 16) / 0x10000) * spread + spread * 0.02 * (i % 7);

    out[i * 2] = Math.cos(angle) * radius;
    out[i * 2 + 1] = Math.sin(angle) * radius;
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
  private anchors: Float32Array | null;
  private params: ForceParams;
  /** per-node force scratch (gather output; applied in a second pass) */
  private forces: Float32Array;
  /** per-node incident edge index lists (gather-side springs) */
  private incident: Int32Array;
  private incidentStart: Int32Array;
  /** per-node degree over the sim edges (59.1's spring normalisation) */
  private degree: Int32Array;
  private cutoff: number;
  /** grid scratch */
  private cellOf: Int32Array;
  private cellStart: Int32Array;
  private cellItems: Uint32Array;
  private gridCols = 0;
  private gridRows = 0;
  private gridX = 0;
  private gridY = 0;
  /** the monopole pyramid (59.3): per level, per-cell count/Σx/Σy —
   * level 0 at the grid's own resolution, each level above halving it,
   * topping out once a level is ≤ 3 cells on its longer side */
  private pyr: {
    cols: number;
    rows: number;
    count: Float64Array;
    sx: Float64Array;
    sy: Float64Array;
  }[] = [];
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
  constructor(inputs: ForceSimInputs) {
    this.n = inputs.n;
    this.edges = inputs.edges;
    this.edgeLength = inputs.edgeLength;
    this.positions = inputs.positions;
    this.pinned = inputs.pinned ?? null;
    this.anchors = inputs.anchors ?? null;
    this.params = inputs;
    this.forces = new Float32Array(inputs.n * 2);

    // the repulsion cutoff is the mean ideal edge length: repulsion
    // vanishes exactly where a spring holds its rest length, so a
    // connected pair's equilibrium is L itself (not L inflated by
    // residual repulsion), and unconnected neighbors spread to ~L
    let sum = 0;

    for (let i = 0; i < inputs.edgeLength.length; i++) {
      sum += inputs.edgeLength[i];
    }

    const meanL =
      inputs.edgeLength.length > 0 ? sum / inputs.edgeLength.length : 60;

    this.cutoff = Math.max(40, meanL);

    // CSR-style incident lists from the edge pairs (counting pass)
    const counts = new Int32Array(inputs.n + 1);
    const m = inputs.edges.length / 2;

    for (let e = 0; e < m; e++) {
      counts[inputs.edges[e * 2] + 1]++;
      counts[inputs.edges[e * 2 + 1] + 1]++;
    }

    this.degree = new Int32Array(inputs.n);

    for (let i = 0; i < inputs.n; i++) {
      this.degree[i] = counts[i + 1];
    }

    for (let i = 0; i < inputs.n; i++) {
      counts[i + 1] += counts[i];
    }

    this.incidentStart = counts;
    this.incident = new Int32Array(m * 2);

    const cursor = counts.slice(0, inputs.n);

    for (let e = 0; e < m; e++) {
      this.incident[cursor[inputs.edges[e * 2]]++] = e;
      this.incident[cursor[inputs.edges[e * 2 + 1]]++] = e;
    }

    this.cellOf = new Int32Array(inputs.n);
    this.cellStart = new Int32Array(0);
    this.cellItems = new Uint32Array(inputs.n);
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
    return (
      this.iteration >= this.params.iterations ||
      this.alpha < 0.001 ||
      this.settledRuns >= CONVERGE_RUNS
    );
  }

  /** Advance k iterations (stops early on convergence). */
  step(k: number = 1): void {
    for (let i = 0; i < k && !this.converged(); i++) {
      this.iterate();
    }
  }

  private buildGrid(): void {
    const n = this.n;
    const pos = this.positions;
    const cell = this.cutoff;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    for (let i = 0; i < n; i++) {
      const x = pos[i * 2],
        y = pos[i * 2 + 1];

      if (x < minX) {
        minX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y > maxY) {
        maxY = y;
      }
    }

    this.gridX = minX;
    this.gridY = minY;
    this.gridCols = Math.max(
      1,
      Math.min(4096, Math.floor((maxX - minX) / cell) + 1),
    );
    this.gridRows = Math.max(
      1,
      Math.min(4096, Math.floor((maxY - minY) / cell) + 1),
    );

    const cells = this.gridCols * this.gridRows;

    if (this.cellStart.length < cells + 1) {
      this.cellStart = new Int32Array(cells + 1);
    } else {
      this.cellStart.fill(0, 0, cells + 1);
    }

    const cellStart = this.cellStart;

    for (let i = 0; i < n; i++) {
      const cx = Math.min(
        this.gridCols - 1,
        Math.floor((pos[i * 2] - minX) / cell),
      );
      const cy = Math.min(
        this.gridRows - 1,
        Math.floor((pos[i * 2 + 1] - minY) / cell),
      );
      const c = cy * this.gridCols + cx;

      this.cellOf[i] = c;
      cellStart[c + 1]++;
    }

    for (let c = 0; c < cells; c++) {
      cellStart[c + 1] += cellStart[c];
    }

    // stable counting sort: ascending index within each cell (the
    // deterministic gather order both executors share)
    const cursor = cellStart.slice(0, cells);

    for (let i = 0; i < n; i++) {
      this.cellItems[cursor[this.cellOf[i]]++] = i;
    }

    // the monopole pyramid (59.3).  Level 0 accumulates in ascending
    // node order — a fixed FP reduction order, so runs stay bitwise
    // deterministic; the level-above sums walk cells in ascending
    // order for the same reason.
    this.pyr.length = 0;

    let lvCols = this.gridCols;
    let lvRows = this.gridRows;
    let level = {
      cols: lvCols,
      rows: lvRows,
      count: new Float64Array(cells),
      sx: new Float64Array(cells),
      sy: new Float64Array(cells),
    };

    for (let i = 0; i < n; i++) {
      const c = this.cellOf[i];

      level.count[c]++;
      level.sx[c] += pos[i * 2];
      level.sy[c] += pos[i * 2 + 1];
    }

    this.pyr.push(level);

    while (Math.max(lvCols, lvRows) > 3) {
      const nc = Math.ceil(lvCols / 2);
      const nr = Math.ceil(lvRows / 2);
      const up = {
        cols: nc,
        rows: nr,
        count: new Float64Array(nc * nr),
        sx: new Float64Array(nc * nr),
        sy: new Float64Array(nc * nr),
      };

      for (let yy = 0; yy < lvRows; yy++) {
        for (let xx = 0; xx < lvCols; xx++) {
          const src = yy * lvCols + xx;
          const dst = (yy >> 1) * nc + (xx >> 1);

          up.count[dst] += level.count[src];
          up.sx[dst] += level.sx[src];
          up.sy[dst] += level.sy[src];
        }
      }

      this.pyr.push(up);
      level = up;
      lvCols = nc;
      lvRows = nr;
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

    for (let i = 0; i < n; i++) {
      if (this.pinned != null && this.pinned[i] === 1) {
        continue;
      }

      const x = pos[i * 2],
        y = pos[i * 2 + 1];
      let fx = 0,
        fy = 0;

      // repulsion: gather over the 3x3 cell neighborhood
      const cx = this.cellOf[i] % this.gridCols;
      const cy = (this.cellOf[i] / this.gridCols) | 0;

      for (
        let gy = Math.max(0, cy - 1);
        gy <= Math.min(this.gridRows - 1, cy + 1);
        gy++
      ) {
        for (
          let gx = Math.max(0, cx - 1);
          gx <= Math.min(this.gridCols - 1, cx + 1);
          gx++
        ) {
          const c = gy * this.gridCols + gx;

          for (let at = this.cellStart[c]; at < this.cellStart[c + 1]; at++) {
            const j = this.cellItems[at];

            if (j === i) {
              continue;
            }

            let dx = x - pos[j * 2];
            let dy = y - pos[j * 2 + 1];
            let d2 = dx * dx + dy * dy;

            if (d2 < 1e-8) {
              // coincident: separate along a deterministic hash direction
              const h = ((i * 31 + j) * 2654435761) >>> 0;
              const a = ((h & 0xffff) / 0x10000) * Math.PI * 2;

              dx = Math.cos(a) * 0.01;
              dy = Math.sin(a) * 0.01;
              d2 = 1e-4;
            }

            // the unified law: repulsion · cutoff² / d², softened
            // inside 1 px (the cap bounds it anyway)
            const d = Math.sqrt(d2);
            const f = (repulsion * cutoff2) / Math.max(1, d2) / d;

            fx += dx * f;
            fy += dy * f;
          }
        }
      }

      // the far field (59.3): per pyramid level, gather the ring — the
      // aligned 6×6 block refining the parent's 3×3, minus this
      // level's own 3×3 — as monopoles.  Fixed iteration order, so the
      // reduction stays deterministic.
      let cellX = cx;
      let cellY = cy;

      for (let lv = 0; lv < this.pyr.length; lv++) {
        const level = this.pyr[lv];
        const qx = cellX >> 1;
        const qy = cellY >> 1;
        const bx0 = Math.max(0, 2 * qx - 2);
        const bx1 = Math.min(level.cols - 1, 2 * qx + 3);
        const by0 = Math.max(0, 2 * qy - 2);
        const by1 = Math.min(level.rows - 1, 2 * qy + 3);

        for (let yy = by0; yy <= by1; yy++) {
          for (let xx = bx0; xx <= bx1; xx++) {
            if (Math.abs(xx - cellX) <= 1 && Math.abs(yy - cellY) <= 1) {
              continue;
            }

            const c = yy * level.cols + xx;
            const cnt = level.count[c];

            if (cnt === 0) {
              continue;
            }

            const dx = x - level.sx[c] / cnt;
            const dy = y - level.sy[c] / cnt;
            const d2 = Math.max(1, dx * dx + dy * dy);
            const d = Math.sqrt(d2);
            const f = (cnt * repulsion * cutoff2) / d2 / d;

            fx += dx * f;
            fy += dy * f;
          }
        }

        cellX = qx;
        cellY = qy;
      }

      // springs along incident edges (gather side), degree-normalised
      // (59.1): k = stiffness / min(deg), this end's share weighted by
      // the other end's degree — a hub's aggregate correction is
      // bounded by `stiffness`, which is the stability guarantee
      for (
        let at = this.incidentStart[i];
        at < this.incidentStart[i + 1];
        at++
      ) {
        const e = this.incident[at];
        const s = this.edges[e * 2];
        const t = this.edges[e * 2 + 1];
        const other = s === i ? t : s;
        const dx = pos[other * 2] - x;
        const dy = pos[other * 2 + 1] - y;
        const r = Math.max(1e-4, Math.hypot(dx, dy));
        const degI = this.degree[i];
        const degO = this.degree[other];
        const k = stiffness / Math.min(degI, degO);
        const bias = degO / (degI + degO);
        const f = (k * bias * (r - this.edgeLength[e])) / r;

        fx += dx * f;
        fy += dy * f;
      }

      // constant-magnitude gravity toward the node's anchor (59.2)
      const ax = this.anchors != null ? this.anchors[i * 2] : 0;
      const ay = this.anchors != null ? this.anchors[i * 2 + 1] : 0;
      const gx = ax - x;
      const gy = ay - y;
      const gd = Math.hypot(gx, gy);

      if (gd > 1) {
        fx += (gx / gd) * gravity;
        fy += (gy / gd) * gravity;
      }

      fx *= alpha;
      fy *= alpha;

      // the displacement cap (59.1): the step never exceeds an
      // alpha-annealed multiple of the repulsion range, whatever the
      // force sum said — v3 cose's limitForce, the guard that holds
      // even when a force term misbehaves
      const cap = cutoff * Math.max(alpha, 0.15);
      const stepLen = Math.hypot(fx, fy);

      if (stepLen > cap) {
        fx = (fx / stepLen) * cap;
        fy = (fy / stepLen) * cap;
      }

      force[i * 2] = fx;
      force[i * 2 + 1] = fy;
    }

    // apply in a second pass: the gather above must read a consistent
    // snapshot (the GPU kernel has the same two-dispatch structure)
    let sawNonFinite = false;

    for (let i = 0; i < n; i++) {
      if (this.pinned != null && this.pinned[i] === 1) {
        continue;
      }

      const dx = force[i * 2];
      const dy = force[i * 2 + 1];

      pos[i * 2] += dx;
      pos[i * 2 + 1] += dy;

      const disp = Math.abs(dx) + Math.abs(dy);

      if (!Number.isFinite(disp)) {
        // 59.1: NaN compares false against every bound, so without
        // this a destroyed iteration read as displacement 0 and the
        // settle counter converged on garbage
        sawNonFinite = true;
      } else if (disp > maxDisp) {
        maxDisp = disp;
      }
    }

    this.alpha += (0 - this.alpha) * decay;
    this.lastMaxDisp = sawNonFinite ? Infinity : maxDisp;
    this.settledRuns =
      !sawNonFinite && maxDisp < threshold ? this.settledRuns + 1 : 0;
    this.iteration++;
  }
}

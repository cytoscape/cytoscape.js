/*
Heat-kernel diffusion (round 70) — heat placed on seed nodes flows
along edges for `time` t, and where it pools measures proximity: the
kernel is the matrix exponential K = exp(−t·L) of the weighted
combinatorial Laplacian L = D − A, the HotNet-style propagation the
network-biology literature leans on.  Total heat is conserved (L's
rows sum to zero), so scores are comparable across runs.

Two public forms share this module.  `heatDiffusion` takes `seeds`
and answers the diffused vector exp(−tL)·h₀ — computed column-free by
sparse Taylor applications, O(E) per term, so it is CPU-only (an
explicit `executor: 'gpu'` rejects and points at the dense form).
`heatKernel` answers the *all-pairs* kernel via scaling-and-squaring —
a fixed chain of dense products, the GPU matmul tier.

Both executors share the same approximation, deliberately: scale so
‖tL/2^s‖∞ ≤ ½, sum `TAYLOR_TERMS` series terms, then square s times
(the CPU applies the same operator 2^s times per column instead of
squaring, which is the same power).  Edges are read undirected, with
positive weights — a Laplacian with a negative edge is not a heat
problem, so a non-positive weight throws.  Parallel edges sum, loops
drop.  No v3 counterpart.

`laplacian: 'normalized'` (round 72.4) swaps L for the symmetric
normalized Laplacian I − D^{-½}·A·D^{-½}: the same structure with
each arc weight scaled by 1/√(d_s·d_t) and a unit diagonal (zero on
an isolated node, whose heat stays put).  Its spectrum is bounded by
2 whatever the degrees, so the scaling exponent depends on t alone —
`squarings = ⌈log₂(4t)⌉⁺` — instead of on the heaviest weighted
degree; the price is that heat is no longer conserved (the rows of
L_norm do not sum to zero), which is the intended reading in a
hub-heavy network: a hub neither hoards nor floods.
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import {
  GPU_MIN_N,
  WORKERS_MIN_N,
  resolveExecutor,
  runAlgo,
} from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import type { AlgoWorkers } from './algo-workers.mjs';
import { seedDistribution } from './random-walk.mjs';
import { heatKernelGpu } from './algo-gpu-heat.mjs';
import { GROUP_EDGES } from '../contract.mjs';

/** Terms of the scaled Taylor series both executors sum: at operator
 * norm ≤ ½ the truncation error is under 0.5¹⁰/10! ≈ 3e-10. */
export const TAYLOR_TERMS = 10;

export interface HeatDiffusionOptions {
  /** the nodes the heat starts on (required for the seed form) */
  seeds?: Collection | null;
  /** how long the heat flows (default 0.1); must be positive */
  time?: number;
  weight?: WeightFn;
  /** which Laplacian drives the diffusion (default 'combinatorial',
   * L = D − A, heat-conserving); 'normalized' is I − D^{-½}AD^{-½},
   * whose spectrum is bounded by 2 so the scaling exponent depends on
   * `time` alone — heat is then not conserved (round 72.4) */
  laplacian?: HeatLaplacian;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * The seed form has no GPU path; the kernel form takes the GPU from
   * `GPU_MIN_N` nodes at any density (72.6). */
  executor?: AlgoExecutor;
}

/** The Laplacian a heat run diffuses over. */
export type HeatLaplacian = 'combinatorial' | 'normalized';

export interface HeatDiffusionResult {
  /** the node's share of the diffused heat, or undefined outside the
   * collection */
  score(node: Collection): number | undefined;
}

export interface HeatKernelResult {
  /** the heat at `to` after unit heat starts at `from` (symmetric),
   * or undefined when either node is outside the collection */
  heat(from: Collection, to: Collection): number | undefined;
}

/**
 * Validate `time` — called synchronously by both async entries.
 *
 * @param options — the caller's options
 * @returns the resolved diffusion time (0.1 when omitted)
 * @throws if the value is not a positive finite number
 */
export const resolveHeatTime = (options: HeatDiffusionOptions): number => {
  const t = options.time ?? 0.1;

  if (!(t > 0) || !Number.isFinite(t)) {
    throw new TypeError(
      '`time` must be a positive finite number — got ' + String(options.time),
    );
  }

  return t;
};

/**
 * Validate `laplacian` — called synchronously by both async entries.
 *
 * @param options — the caller's options
 * @returns the resolved Laplacian ('combinatorial' when omitted)
 * @throws if the value is not 'combinatorial' or 'normalized'
 */
export const resolveHeatLaplacian = (
  options: HeatDiffusionOptions,
): HeatLaplacian => {
  const laplacian = options.laplacian ?? 'combinatorial';

  if (laplacian !== 'combinatorial' && laplacian !== 'normalized') {
    throw new TypeError(
      "`laplacian` must be 'combinatorial' or 'normalized' — got " +
        String(options.laplacian),
    );
  }

  return laplacian;
};

/**
 * The undirected weighted adjacency the Laplacian is built from:
 * dense-index arcs in both directions with their (summed) positive
 * weights, per-node diagonal entries, and the scaling exponent s that
 * puts ‖tL/2^s‖∞ under ½.  Under `laplacian: 'normalized'` the arc
 * weights are scaled by 1/√(d_s·d_t) and the diagonal is 1 (0 on an
 * isolated node), so `degrees` reads as "the diagonal of L" on
 * either setting — which is all `diffuseVector` and the GPU build
 * consume.
 *
 * @param view — the subgraph view
 * @param options — the caller's options (weight, time, laplacian)
 * @returns arcs, the Laplacian's diagonal, and the scaling exponent
 * @throws if the weight function answers a non-positive or non-finite
 *   number for any edge, or `laplacian` is invalid
 */
export const buildHeatStructure = (
  view: SubgraphView,
  options: HeatDiffusionOptions,
): {
  srcs: Int32Array;
  dsts: Int32Array;
  ws: Float64Array;
  arcs: number;
  degrees: Float64Array;
  squarings: number;
} => {
  const time = resolveHeatTime(options);
  const normalized = resolveHeatLaplacian(options) === 'normalized';
  const { endpoints, index, cy } = view;
  const weight = options.weight;
  const n = view.nodeSlots.length;
  const m = view.edgeSlots.length * 2;
  const srcs = new Int32Array(m);
  const dsts = new Int32Array(m);
  const ws = new Float64Array(m);
  const degrees = new Float64Array(n);
  let arcs = 0;

  for (const e of view.edgeSlots) {
    const sSlot = endpoints[e * 2];
    const tSlot = endpoints[e * 2 + 1];

    if (sSlot === tSlot) {
      continue;
    } // exclude loops

    const s = index.get(sSlot);
    const t = index.get(tSlot);

    if (s == null || t == null) {
      continue;
    }

    const w = weight == null ? 1 : weight(cy._ele(GROUP_EDGES, e));

    if (!(w > 0) || !Number.isFinite(w)) {
      throw new TypeError(
        'heat diffusion needs positive finite edge weights — `weight` ' +
          `answered ${String(w)}`,
      );
    }

    srcs[arcs] = s;
    dsts[arcs] = t;
    ws[arcs] = w;
    arcs++;
    srcs[arcs] = t;
    dsts[arcs] = s;
    ws[arcs] = w;
    arcs++;
    degrees[s] += w;
    degrees[t] += w;
  }

  let maxDegree = 0;

  for (let i = 0; i < n; i++) {
    maxDegree = Math.max(maxDegree, degrees[i]);
  }

  if (normalized) {
    // w_st / √(d_s·d_t) per arc, then the diagonal: 1 where the node
    // has any weight, 0 where it is isolated (its heat stays put)
    for (let a = 0; a < arcs; a++) {
      ws[a] /= Math.sqrt(degrees[srcs[a]] * degrees[dsts[a]]);
    }

    for (let i = 0; i < n; i++) {
      degrees[i] = degrees[i] > 0 ? 1 : 0;
    }
  }

  // ‖L‖∞ ≤ 2·max weighted degree (combinatorial) or 2 (normalized);
  // scale until t·‖L‖/2^s ≤ ½
  const norm = 2 * (normalized ? 1 : maxDegree) * time;
  const squarings = norm <= 0.5 ? 0 : Math.ceil(Math.log2(norm / 0.5));

  return { srcs, dsts, ws, arcs, degrees, squarings };
};

/**
 * Apply the scaled Taylor operator exp(−tL/2^s) to one vector via
 * `TAYLOR_TERMS` sparse Laplacian products, then repeat 2^s times —
 * the column form of scaling-and-squaring, shared by the seed form
 * (once) and the CPU kernel reference (once per column).
 *
 * @param n — the node count
 * @param heat — from `buildHeatStructure`
 * @param time — the resolved diffusion time
 * @param v — diffused in place
 */
export const diffuseVector = (
  n: number,
  heat: ReturnType<typeof buildHeatStructure>,
  time: number,
  v: Float64Array,
): void => {
  const { srcs, dsts, ws, arcs, degrees, squarings } = heat;
  const step = -time / Math.pow(2, squarings);
  const applications = Math.pow(2, squarings);
  const u = new Float64Array(n);
  const lu = new Float64Array(n);

  for (let r = 0; r < applications; r++) {
    u.set(v);

    for (let k = 1; k <= TAYLOR_TERMS; k++) {
      // lu = L·u, sparsely: (D − A)·u
      for (let i = 0; i < n; i++) {
        lu[i] = degrees[i] * u[i];
      }

      for (let a = 0; a < arcs; a++) {
        lu[dsts[a]] -= ws[a] * u[srcs[a]];
      }

      const scale = step / k;

      for (let i = 0; i < n; i++) {
        u[i] = lu[i] * scale;
        v[i] += u[i];
      }
    }
  }
};

/**
 * The async seed-diffusion entry point behind `eles.heatDiffusion()`:
 * validates `executor`, `time` and `seeds` synchronously, then runs
 * the sparse CPU diffusion.  There is no GPU path — the vector form
 * is O(E) per term — so an explicit `executor: 'gpu'` rejects and
 * points at the kernel form.
 *
 * @param coll — the calling collection
 * @param options — `{ seeds, time, weight, laplacian, executor }`
 * @returns a promise of the `{ score }` accessor
 * @throws if `executor`, `time` or `laplacian` is invalid, if `seeds`
 *   holds no node of the collection, or if an edge weight is not
 *   positive
 */
export const heatDiffusionAsync = (
  coll: Collection,
  options: HeatDiffusionOptions = {},
): AlgoRun<HeatDiffusionResult> => {
  const executor = resolveExecutor(options.executor);
  const time = resolveHeatTime(options);

  resolveHeatLaplacian(options); // an invalid value throws at the call site

  const view = subgraph(coll);
  const n = view.nodeSlots.length;
  const p0 = seedDistribution(view, options.seeds);

  return runAlgo(
    executor,
    n,
    Infinity,
    () => {
      const heat = buildHeatStructure(view, options);

      diffuseVector(n, heat, time, p0);

      return {
        score(node: Collection): number | undefined {
          const slot = firstNodeSlot(view, node, 'node');
          const i = slot == null ? undefined : view.index.get(slot);

          return i == null ? undefined : p0[i];
        },
      };
    },
    null,
    'the seed form of heatDiffusion is O(E) per series term on the ' +
      'CPU and has no GPU path — use heatKernel for the dense ' +
      "all-pairs form, or executor 'cpu' or 'auto'",
  );
};

/**
 * The async all-pairs entry point behind `eles.heatKernel()`:
 * validates `executor` and `time` synchronously, then routes to the
 * CPU reference (the column diffusion, once per unit vector) or the
 * WGSL scaling-and-squaring chain.
 *
 * @param coll — the calling collection
 * @param options — `{ time, weight, laplacian, executor }`
 * @returns a promise of the `{ heat }` accessor
 * @throws if `executor`, `time` or `laplacian` is invalid, or if an
 *   edge weight is not positive
 */
export const heatKernelAsync = (
  coll: Collection,
  options: HeatDiffusionOptions = {},
): AlgoRun<HeatKernelResult> => {
  const executor = resolveExecutor(options.executor);

  resolveHeatTime(options); // an invalid time throws at the call site
  resolveHeatLaplacian(options);

  const view = subgraph(coll);
  const n = view.nodeSlots.length;

  // round 70 gated this on density like the triangle family; the
  // 72.6 sweep found the GPU ahead at *every* density — 2.1× / 2.9× /
  // 5.7× at n = 256 / 512 / 1024 on the sparsest fixture (E = n/2),
  // 219× / 1230× / 6000× on the densest — because the CPU pays
  // TAYLOR_TERMS·2^s sparse products per *column* and the GPU pays
  // them once as dense products.  So 'auto' takes the GPU on size
  // alone.
  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => heatKernel(view, options),
    (ctx) => heatKernelGpu(ctx, view, options),
    undefined,
    {
      minN: HEAT_WORKERS_MIN_N,
      run: (pool) => heatKernelWorkers(pool, view, options),
    },
  );
};

/**
 * The `'auto'` crossover to the worker pool for the kernel form
 * (74.5, i9-9900K, eight workers: 2.4× at n = 128, 4.2× at 256, 4.3×
 * at 512).  Behind the GPU's lane, which stays ahead of the pool at
 * every size (3.8 vs 3.3 ms at 256 — a tie — then 10.7 vs 12.6 at
 * 512 and 34 vs the pool's hundreds at 1024).
 */
export const HEAT_WORKERS_MIN_N = WORKERS_MIN_N;

/**
 * The workers lane (round 74): the CPU reference's per-column
 * diffusion, one contiguous column range per job; every column is
 * computed whole by one worker in `diffuseVector`'s operation order,
 * so the kernel is bit-identical to `'cpu'`.
 *
 * @param pool — the acquired worker pool
 * @param view — the subgraph view
 * @param options — the caller's options
 * @returns the `{ heat }` accessor
 * @throws if `time` or `laplacian` is invalid, or an edge weight is
 *   not positive
 */
export const heatKernelWorkers = async (
  pool: AlgoWorkers,
  view: SubgraphView,
  options: HeatDiffusionOptions,
): Promise<HeatKernelResult> => {
  const time = resolveHeatTime(options);
  const n = view.nodeSlots.length;
  const heat = buildHeatStructure(view, options);
  const parts = await pool.run(
    { kind: 'heat', n, ...heat, time, terms: TAYLOR_TERMS },
    n,
  );
  const matrix = new Float64Array(n * n);
  let s = 0;

  for (const part of parts) {
    const columns = part.length / n;

    for (let c = 0; c < columns; c++, s++) {
      for (let t = 0; t < n; t++) {
        matrix[t * n + s] = part[c * n + t];
      }
    }
  }

  return heatKernelResultFrom(view, matrix);
};

/**
 * Wrap a kernel matrix as the public `{ heat }` accessor — shared by
 * both executors.
 *
 * @param view — the subgraph view the kernel was computed from
 * @param matrix — the row-major kernel matrix
 * @returns the result object
 */
export const heatKernelResultFrom = (
  view: SubgraphView,
  matrix: ArrayLike<number>,
): HeatKernelResult => {
  const n = view.nodeSlots.length;

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : view.index.get(slot);
  };

  return {
    heat(from: Collection, to: Collection): number | undefined {
      const s = denseOf(from, 'from');
      const t = denseOf(to, 'to');

      return s == null || t == null ? undefined : matrix[t * n + s];
    },
  };
};

/**
 * The CPU kernel reference: diffuse each unit vector with the shared
 * column operator — O(n · 2^s · terms · E) overall, no dense product
 * anywhere.
 *
 * @param view — the subgraph view
 * @param options — the caller's options
 * @returns the `{ heat }` accessor
 * @throws if `time` or `laplacian` is invalid, or an edge weight is
 *   not positive
 */
export const heatKernel = (
  view: SubgraphView,
  options: HeatDiffusionOptions = {},
): HeatKernelResult => {
  const time = resolveHeatTime(options);
  const n = view.nodeSlots.length;
  const heat = buildHeatStructure(view, options);
  const matrix = new Float64Array(n * n);
  const v = new Float64Array(n);

  for (let s = 0; s < n; s++) {
    v.fill(0);
    v[s] = 1;
    diffuseVector(n, heat, time, v);

    for (let t = 0; t < n; t++) {
      matrix[t * n + s] = v[t];
    }
  }

  return heatKernelResultFrom(view, matrix);
};

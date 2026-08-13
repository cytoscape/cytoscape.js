/*
Random walk with restart (round 70) — network propagation, the
workhorse of the network-biology toolbox: a walker steps along edges
with probability 1−c and restarts at its seed distribution with
probability c, and the stationary distribution

  p = c · (I − (1−c)·W)⁻¹ · p₀      (W column-normalized by out-weight)

scores every node by its proximity to the seeds.

Two public forms share this module.  `randomWalkWithRestart` takes a
`seeds` collection and answers the propagation vector — an O(E)-per-
step sparse iteration, so it is CPU-only (the pageRank verdict; an
explicit `executor: 'gpu'` rejects and points at the dense form).
`randomWalkWithRestartProximity` answers the *all-pairs* proximity
matrix — column s is the walk restarting at s — which is the dense
Neumann iteration S′ = (1−c)·W·S + c·I, one matmul per step on the
GPU tier beside MCL.

Conventions: parallel edges sum their weights, loops are excluded,
and the undirected default walks each edge both ways.  A directed
node with no out-edges absorbs the walk (its column leaks — scores on
such graphs can sum below 1), documented rather than redistributed.
No v3 counterpart.
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { rwrProximityGpu } from './algo-gpu-rwr.mjs';

export interface RandomWalkWithRestartOptions {
  /** the nodes the walk restarts at (required for the seed form) */
  seeds?: Collection | null;
  /** the restart probability c (default 0.15); must sit in (0, 1) */
  restartProbability?: number;
  /** iteration cap when the tolerance is never met (default 200) */
  maxIterations?: number;
  /** stop once the L1 step drops under `tolerance` (default 1e-6) —
   * per column, for the proximity form */
  tolerance?: number;
  /** walk out-edges only */
  directed?: boolean;
  weight?: WeightFn;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * The seed form has no GPU path; the proximity form routes to the
   * GPU only on dense graphs (the CPU solves per column at O(E) per
   * step, so sparse graphs are its outright). */
  executor?: AlgoExecutor;
}

export interface RandomWalkWithRestartResult {
  /** the node's stationary probability, or undefined outside the
   * collection */
  score(node: Collection): number | undefined;
}

export interface RandomWalkWithRestartProximityResult {
  /** the stationary probability of `to` for the walk restarting at
   * `from`, or undefined when either node is outside the collection */
  proximity(from: Collection, to: Collection): number | undefined;
}

/**
 * Validate `restartProbability` — called synchronously by both async
 * entries, so a bad value throws at the call site rather than
 * surfacing later as a rejection.
 *
 * @param options — the caller's options
 * @returns the resolved restart probability (0.15 when omitted)
 * @throws if the value is not a number strictly between 0 and 1
 */
export const resolveRestartProbability = (
  options: RandomWalkWithRestartOptions,
): number => {
  const c = options.restartProbability ?? 0.15;

  if (!(c > 0 && c < 1)) {
    throw new TypeError(
      '`restartProbability` must sit strictly between 0 and 1 — got ' +
        String(options.restartProbability),
    );
  }

  return c;
};

/**
 * The column-normalized transition structure both executors walk:
 * sparse arc triplets with weights already divided by their source's
 * out-weight.  Parallel edges sum, loops drop, and the undirected
 * default emits each edge in both directions before normalizing.
 *
 * @param view — the subgraph view
 * @param options — the caller's options (weight, directed)
 * @returns dense-index arcs, normalized weights, and the arc count
 */
export const buildWalkArcs = (
  view: SubgraphView,
  options: RandomWalkWithRestartOptions,
): { srcs: Int32Array; dsts: Int32Array; ws: Float64Array; arcs: number } => {
  const directed = options.directed === true;
  const { endpoints, index } = view;
  const weightOf = weightAt(view, options.weight);
  const m = view.edgeSlots.length * (directed ? 1 : 2);
  const srcs = new Int32Array(m);
  const dsts = new Int32Array(m);
  const ws = new Float64Array(m);
  const outWeight = new Float64Array(view.nodeSlots.length);
  let arcs = 0;

  const push = (s: number, t: number, w: number): void => {
    srcs[arcs] = s;
    dsts[arcs] = t;
    ws[arcs] = w;
    outWeight[s] += w;
    arcs++;
  };

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

    const w = weightOf(e);

    push(s, t, w);

    if (!directed) {
      push(t, s, w);
    }
  }

  for (let a = 0; a < arcs; a++) {
    ws[a] /= outWeight[srcs[a]]; // sources always have outWeight > 0
  }

  return { srcs, dsts, ws, arcs };
};

/**
 * One seed-vector solve: iterate p′ = (1−c)·W·p + c·p₀ sparsely from
 * p = p₀ until the L1 step drops under `tolerance` or `maxIterations`
 * runs out.  Shared by the seed form (once) and the CPU proximity
 * reference (once per column).
 *
 * @param n — the node count
 * @param walk — from `buildWalkArcs`
 * @param p0 — the restart distribution (borrowed, not mutated)
 * @param c — the restart probability
 * @param maxIterations — the iteration cap
 * @param tolerance — the L1 stopping bound
 * @returns the stationary vector
 */
export const solveWalk = (
  n: number,
  walk: { srcs: Int32Array; dsts: Int32Array; ws: Float64Array; arcs: number },
  p0: Float64Array,
  c: number,
  maxIterations: number,
  tolerance: number,
): Float64Array => {
  const { srcs, dsts, ws, arcs } = walk;
  const follow = 1 - c;
  let p = Float64Array.from(p0);
  let next = new Float64Array(n);

  for (let iter = 0; iter < maxIterations; iter++) {
    for (let i = 0; i < n; i++) {
      next[i] = c * p0[i];
    }

    for (let a = 0; a < arcs; a++) {
      next[dsts[a]] += follow * ws[a] * p[srcs[a]];
    }

    let diff = 0;

    for (let i = 0; i < n; i++) {
      diff += Math.abs(next[i] - p[i]);
    }

    const previous = p;

    p = next;
    next = previous;

    if (diff < tolerance) {
      break;
    }
  }

  return p;
};

/**
 * The async seed-propagation entry point behind
 * `eles.randomWalkWithRestart()`: validates `executor`,
 * `restartProbability` and `seeds` synchronously, then runs the
 * sparse CPU iteration.  There is no GPU path — the vector form is
 * O(E) per step, the pageRank verdict — so an explicit
 * `executor: 'gpu'` rejects and points at the proximity form.
 *
 * @param coll — the calling collection
 * @param options — `{ seeds, restartProbability, maxIterations,
 *   tolerance, directed, weight, executor }`
 * @returns a promise of the `{ score }` accessor
 * @throws if `executor` or `restartProbability` is invalid, or if
 *   `seeds` holds no node of the collection
 */
export const randomWalkWithRestartAsync = (
  coll: Collection,
  options: RandomWalkWithRestartOptions = {},
): Promise<RandomWalkWithRestartResult> => {
  const executor = resolveExecutor(options.executor);
  const c = resolveRestartProbability(options);
  const view = subgraph(coll);
  const n = view.nodeSlots.length;
  const p0 = seedDistribution(view, options.seeds);

  return runAlgo(
    executor,
    n,
    Infinity,
    () => {
      const walk = buildWalkArcs(view, options);
      const p = solveWalk(
        n,
        walk,
        p0,
        c,
        options.maxIterations ?? 200,
        options.tolerance ?? 0.000001,
      );

      return {
        score(node: Collection): number | undefined {
          const slot = firstNodeSlot(view, node, 'node');
          const i = slot == null ? undefined : view.index.get(slot);

          return i == null ? undefined : p[i];
        },
      };
    },
    null,
    'the seed form of randomWalkWithRestart is O(E) per step on the ' +
      'CPU and has no GPU path — use randomWalkWithRestartProximity ' +
      "for the dense all-pairs form, or executor 'cpu' or 'auto'",
  );
};

/**
 * The uniform restart distribution over the seed nodes that are in
 * the collection.
 *
 * @param view — the subgraph view
 * @param seeds — the caller's seed collection
 * @returns the distribution vector
 * @throws if `seeds` holds no node of the collection (a propagation
 *   with nothing to propagate from is a caller error, not a zero
 *   vector)
 */
export const seedDistribution = (
  view: SubgraphView,
  seeds: Collection | null | undefined,
): Float64Array => {
  const n = view.nodeSlots.length;
  const p0 = new Float64Array(n);
  let count = 0;

  if (seeds != null && typeof seeds !== 'string' && seeds._liveRefs != null) {
    for (const ref of seeds._liveRefs()) {
      if (ref.group !== 'nodes') {
        continue;
      }

      const i = view.index.get(ref.slot);

      if (i != null && p0[i] === 0) {
        p0[i] = 1;
        count++;
      }
    }
  }

  if (count === 0) {
    throw new TypeError(
      'randomWalkWithRestart requires `seeds` — a collection holding ' +
        'at least one node of the calling collection',
    );
  }

  for (let i = 0; i < n; i++) {
    p0[i] /= count;
  }

  return p0;
};

/**
 * The async all-pairs entry point behind
 * `eles.randomWalkWithRestartProximity()`: validates `executor` and
 * `restartProbability` synchronously, then routes to the CPU
 * reference (one sparse solve per column) or the WGSL Neumann
 * iteration (one matmul per step over the whole matrix).
 *
 * @param coll — the calling collection
 * @param options — as the seed form, minus `seeds`
 * @returns a promise of the `{ proximity }` accessor
 * @throws if `executor` or `restartProbability` is invalid
 */
export const randomWalkWithRestartProximityAsync = (
  coll: Collection,
  options: RandomWalkWithRestartOptions = {},
): Promise<RandomWalkWithRestartProximityResult> => {
  const executor = resolveExecutor(options.executor);

  resolveRestartProbability(options); // an invalid restart throws here

  const view = subgraph(coll);
  const n = view.nodeSlots.length;
  const arcs = view.edgeSlots.length * (options.directed === true ? 1 : 2);

  // the CPU solves per column at O(E) per step where the matmul is
  // O(n³) regardless — the triangle family's density gate
  const dense = arcs >= (n * n) / 32;

  return runAlgo(
    executor,
    n,
    dense ? GPU_MIN_N : Infinity,
    () => rwrProximity(view, options),
    (ctx) => rwrProximityGpu(ctx, view, options),
  );
};

/**
 * Wrap a proximity matrix as the public accessor — shared by both
 * executors.  Column s holds the walk restarting at s, so the
 * accessor reads `matrix[to · n + from]`.
 *
 * @param view — the subgraph view the matrix was computed from
 * @param matrix — the row-major proximity matrix
 * @returns the result object
 */
export const rwrProximityResultFrom = (
  view: SubgraphView,
  matrix: ArrayLike<number>,
): RandomWalkWithRestartProximityResult => {
  const n = view.nodeSlots.length;

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : view.index.get(slot);
  };

  return {
    proximity(from: Collection, to: Collection): number | undefined {
      const s = denseOf(from, 'from');
      const t = denseOf(to, 'to');

      return s == null || t == null ? undefined : matrix[t * n + s];
    },
  };
};

/**
 * The CPU proximity reference: one sparse seed-vector solve per
 * column — O(n·E) per iteration sweep overall, no dense product
 * anywhere.
 *
 * @param view — the subgraph view
 * @param options — the caller's options
 * @returns the `{ proximity }` accessor
 * @throws if `restartProbability` is invalid
 */
export const rwrProximity = (
  view: SubgraphView,
  options: RandomWalkWithRestartOptions = {},
): RandomWalkWithRestartProximityResult => {
  const c = resolveRestartProbability(options);
  const maxIterations = options.maxIterations ?? 200;
  const tolerance = options.tolerance ?? 0.000001;
  const n = view.nodeSlots.length;
  const walk = buildWalkArcs(view, options);
  const matrix = new Float64Array(n * n);
  const p0 = new Float64Array(n);

  for (let s = 0; s < n; s++) {
    p0.fill(0);
    p0[s] = 1;

    const p = solveWalk(n, walk, p0, c, maxIterations, tolerance);

    for (let t = 0; t < n; t++) {
      matrix[t * n + s] = p[t];
    }
  }

  return rwrProximityResultFrom(view, matrix);
};

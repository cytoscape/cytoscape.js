/*
SimRank (round 70) — "two nodes are similar when their neighbors are
similar": the Jeh–Widom fixed point

  s(a, b) = C / (|I(a)|·|I(b)|) · Σ_{i∈I(a)} Σ_{j∈I(b)} s(i, j)

with s(a, a) = 1 and s = 0 where either neighborhood is empty.  In
matrix form one iteration is S′ = C·Q·S·Qᵀ with the diagonal pinned
to 1, where Q is the row-normalized neighborhood matrix — two dense
products per iteration, which is what puts the family on the GPU
matmul tier beside MCL.

Neighborhoods follow the library's family conventions: deduped simple
adjacency, loops excluded; the undirected default reads all neighbors,
`directed: true` reads the classic in-neighbors.  The result is
all-pairs (O(n²) memory, like `floydWarshall`).  No v3 counterpart.
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { simRankGpu } from './algo-gpu-simrank.mjs';

export interface SimRankOptions {
  /** the decay per neighborhood step (default 0.8); must sit in (0, 1) */
  dampingFactor?: number;
  /** iteration cap when the tolerance is never met (default 50) */
  maxIterations?: number;
  /** stop once max |Δs| ≤ tolerance (default 1e-4) */
  tolerance?: number;
  /** compare in-neighborhoods (the classic form) instead of undirected ones */
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * 'auto' routes to the GPU only on graphs dense enough that the
   * O(n³) products beat the CPU's O(n·m)-per-iteration sparse form. */
  executor?: AlgoExecutor;
}

export interface SimRankResult {
  /** the pair's SimRank score in [0, 1], or undefined when either
   * node is outside the collection */
  similarity(a: Collection, b: Collection): number | undefined;
}

/**
 * Validate `dampingFactor` — called synchronously by the async entry,
 * so a bad value throws at the call site rather than surfacing later
 * as a rejection.
 *
 * @param options — the caller's options
 * @returns the resolved damping factor (0.8 when omitted)
 * @throws if the value is not a number strictly between 0 and 1
 */
export const resolveSimRankDamping = (options: SimRankOptions): number => {
  const c = options.dampingFactor ?? 0.8;

  if (!(c > 0 && c < 1)) {
    throw new TypeError(
      '`dampingFactor` must sit strictly between 0 and 1 — got ' +
        String(options.dampingFactor),
    );
  }

  return c;
};

/**
 * The deduped neighborhoods both executors iterate over: per-node
 * dense-index lists (in-neighbors under `directed`, all neighbors
 * otherwise; parallel edges collapse, loops and out-of-collection
 * endpoints drop).
 *
 * @param view — the subgraph view
 * @param directed — use in-neighborhoods only
 * @returns the lists plus the total adjacency count the density gate
 *   reads
 */
export const buildSimRankNeighborhoods = (
  view: SubgraphView,
  directed: boolean,
): { inLists: Int32Array[]; adjacencies: number } => {
  const { endpoints, index, nodeSlots } = view;
  const n = nodeSlots.length;
  const sets: Set<number>[] = new Array(n);

  for (let i = 0; i < n; i++) {
    sets[i] = new Set();
  }

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

    sets[t].add(s); // s is an in-neighbor of t

    if (!directed) {
      sets[s].add(t);
    }
  }

  const inLists: Int32Array[] = new Array(n);
  let adjacencies = 0;

  for (let i = 0; i < n; i++) {
    inLists[i] = Int32Array.from(sets[i]);
    adjacencies += inLists[i].length;
  }

  return { inLists, adjacencies };
};

/**
 * Wrap a converged score matrix as the public `{ similarity }`
 * accessor — shared by both executors.
 *
 * @param view — the subgraph view the matrix was computed from
 * @param scores — the row-major SimRank matrix
 * @returns the result object
 */
export const simRankResultFrom = (
  view: SubgraphView,
  scores: ArrayLike<number>,
): SimRankResult => {
  const n = view.nodeSlots.length;

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : view.index.get(slot);
  };

  return {
    similarity(a: Collection, b: Collection): number | undefined {
      const i = denseOf(a, 'a');
      const j = denseOf(b, 'b');

      return i == null || j == null ? undefined : scores[i * n + j];
    },
  };
};

/**
 * The async SimRank entry point behind `eles.simRank()`: validates
 * `executor` and `dampingFactor` synchronously, then routes to the
 * CPU reference implementation or the WGSL matmul kernels.
 *
 * @param coll — the calling collection
 * @param options — `{ dampingFactor, maxIterations, tolerance,
 *   directed, executor }`
 * @returns a promise of the `{ similarity }` accessor
 * @throws if `executor` or `dampingFactor` is invalid
 */
export const simRankAsync = (
  coll: Collection,
  options: SimRankOptions = {},
): Promise<SimRankResult> => {
  const executor = resolveExecutor(options.executor);

  resolveSimRankDamping(options); // an invalid damping throws at the call site

  const directed = options.directed === true;
  const view = subgraph(coll);
  const hoods = buildSimRankNeighborhoods(view, directed);
  const n = view.nodeSlots.length;

  // the CPU iteration is O(n·m) per step where the two products are
  // O(n³) regardless — the triangle family's density gate, for the
  // triangle family's reason
  const dense = hoods.adjacencies >= (n * n) / 16;

  return runAlgo(
    executor,
    n,
    dense ? GPU_MIN_N : Infinity,
    () => simRank(view, hoods, options),
    (ctx) => simRankGpu(ctx, view, hoods, options),
  );
};

/**
 * The CPU reference: the same fixed point iterated sparsely — Q·S as
 * per-row neighbor sums, (Q·S)·Qᵀ as per-column neighbor sums, both
 * O(n·m) per iteration — from S⁰ = I, stopping once max |Δs| drops
 * under `tolerance` or `maxIterations` runs out.
 *
 * @param view — the subgraph view
 * @param hoods — from `buildSimRankNeighborhoods`
 * @param options — the caller's options
 * @returns the `{ similarity }` accessor
 * @throws if `dampingFactor` is invalid (see `resolveSimRankDamping`)
 */
export const simRank = (
  view: SubgraphView,
  hoods: { inLists: Int32Array[] },
  options: SimRankOptions = {},
): SimRankResult => {
  const c = resolveSimRankDamping(options);
  const maxIterations = options.maxIterations ?? 50;
  const tolerance = options.tolerance ?? 0.0001;
  const { inLists } = hoods;
  const n = inLists.length;

  let scores = new Float64Array(n * n);
  const t = new Float64Array(n * n);
  let u = new Float64Array(n * n);

  for (let i = 0; i < n; i++) {
    scores[i * n + i] = 1;
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // t = Q·S: row a averages the rows of a's neighbors
    for (let a = 0; a < n; a++) {
      const list = inLists[a];
      const row = a * n;

      t.fill(0, row, row + n);

      if (list.length === 0) {
        continue;
      }

      for (let k = 0; k < list.length; k++) {
        const src = list[k] * n;

        for (let j = 0; j < n; j++) {
          t[row + j] += scores[src + j];
        }
      }

      const inv = 1 / list.length;

      for (let j = 0; j < n; j++) {
        t[row + j] *= inv;
      }
    }

    // u = t·Qᵀ: column b averages the columns of b's neighbors
    for (let b = 0; b < n; b++) {
      const list = inLists[b];

      if (list.length === 0) {
        for (let a = 0; a < n; a++) {
          u[a * n + b] = 0;
        }

        continue;
      }

      const inv = 1 / list.length;

      for (let a = 0; a < n; a++) {
        const row = a * n;
        let sum = 0;

        for (let k = 0; k < list.length; k++) {
          sum += t[row + list[k]];
        }

        u[row + b] = sum * inv;
      }
    }

    // epilogue: decay, pin the diagonal, measure the step
    let maxDiff = 0;

    for (let a = 0; a < n; a++) {
      for (let b = 0; b < n; b++) {
        const i = a * n + b;
        const next = a === b ? 1 : c * u[i];
        const diff = Math.abs(next - scores[i]);

        if (diff > maxDiff) {
          maxDiff = diff;
        }

        u[i] = next;
      }
    }

    // u was fully rewritten this iteration, so the buffers swap
    const previous = scores;

    scores = u;
    u = previous;

    if (maxDiff <= tolerance) {
      break;
    }
  }

  return simRankResultFrom(view, scores);
};

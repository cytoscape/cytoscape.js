/*
The feature-space clusterers' offload kernels (round 134, ledger
item 70): k-means, k-medoids and fuzzy c-means as one kernel, and the
hierarchical merge chain as another, each over materialized attribute
vectors.  They join `ALGO_KERNELS` (`algo-kernels.mts`) and live under
the same rule as every kernel there — no imports, no outer references,
no class syntax, ES2018-plain — because the pool re-creates each from
its source text inside a worker.

Why the clusterers needed their own shape.  Their references called
the metric per iteration through per-node caches (`vecOf`,
`makeGetDist`), and the metric may be a caller's function, so the maths
was not a self-contained loop over a snapshot.  What these kernels take
instead is what every *named* metric needs — the attribute vectors,
evaluated once per node on the calling thread, and the metric as a code
(`namedMetricKind`, with euclidean over fewer than two attributes
folded to manhattan, the reference's own 1-D shortcut) — and the
in-thread reference runs the same function for the named metrics, so
the two sides answer identical bits by construction.  A custom metric
keeps the closure path in `k-clustering.mts` / `hierarchical-clustering.mts`,
on the calling thread, because it is called inside the loop.

The arithmetic is the closure path's, operation for operation — the
same visit order, `Math.abs(q − p)`, the same `<` / `<=` / `>` tests and
the same NaN readings (a NaN distance never wins a classification; a NaN
centroid step keeps k-means moving; a NaN membership step reads as
converged) — with one respelling: a square is `diff * diff` where the
closure path says `Math.pow(diff, 2)`.  fdlibm's `pow`, which V8's
`Math.pow` is, answers `x * x` for an exponent of exactly 2, so the two
round identically; `test/algorithms-offload-clustering.mjs` pins it by
running the closure path (a custom function that *is* the named metric)
against the kernel with `===` on every output.
*/

/** The k-clusterings' kernel input (the three modes share it). */
export interface KClusteringKernelInput {
  [key: string]: unknown;
  /** 0 k-means, 1 k-medoids, 2 fuzzy c-means */
  mode: number;
  n: number;
  /** the attribute count */
  d: number;
  /** the cluster count the result is sized by */
  k: number;
  /** the centres classified against: k-means' centroids, k-medoids'
   * medoids (k, or the test centres' length) */
  kc: number;
  /** row-major vectors: the n nodes, then (k-medoids) one row per
   * starting medoid */
  vecs: Float64Array;
  /** k-means' starting centroids, kc × d */
  centroids?: Float64Array;
  /** fuzzy c-means' starting memberships, n × k */
  U?: Float64Array;
  /** fuzzy c-means' exponent */
  m?: number;
  /** 0 euclidean, 1 squaredEuclidean, 2 manhattan (and euclidean in
   * fewer than two dimensions), 3 max */
  kind: number;
  sensitivityThreshold: number;
  maxIterations: number;
}

/**
 * k-means, k-medoids and fuzzy c-means over materialized vectors —
 * the reference of all three for a named metric, in this thread and on
 * a pool worker alike.
 *
 * k-means and k-medoids answer each cluster's members as a CSR pair,
 * and keep the reference's shape exactly: a cluster that emptied in the
 * last iteration answers the members it had when it last held any (the
 * reference assigned `clusters[c]` only for non-empty clusters), and
 * one that never held any answers none.  Fuzzy c-means answers its
 * membership matrix; the crisp clusters are the wrapper's arg-max, as
 * before.
 *
 * @param input — the vectors, the starting centres and the knobs
 * @returns `{ ptr, idx }` (the modes 0 and 1) or `{ U }` (mode 2), plus
 *   the iterations run
 */
export function kClusteringKernel(input: KClusteringKernelInput): {
  ptr?: Int32Array;
  idx?: Int32Array;
  U?: Float64Array;
  iterations: number;
} {
  const mode = input.mode;
  const n = input.n;
  const d = input.d;
  const k = input.k;
  const kc = input.kc;
  const vecs = input.vecs;
  const kind = input.kind;
  const threshold = input.sensitivityThreshold;
  const maxIterations = input.maxIterations;

  // the distance from the centre at P[pi..] to the node at vecs[qi..],
  // in the closure path's visit order (q − p per dimension)
  const dist = (P: Float64Array, pi: number, qi: number): number => {
    let acc = kind === 3 ? -Infinity : 0;

    for (let j = 0; j < d; j++) {
      const diff = vecs[qi + j] - P[pi + j];

      if (kind === 2) {
        acc = acc + Math.abs(diff);
      } else if (kind === 3) {
        acc = Math.max(acc, Math.abs(diff));
      } else {
        acc = acc + diff * diff;
      }
    }

    return kind === 0 ? Math.sqrt(acc) : acc;
  };

  let iterations = 0;
  let moving = true;

  if (mode === 2) {
    const m = input.m as number;
    const U = input.U as Float64Array;
    const prev = new Float64Array(n * k);
    const weight = new Float64Array(n * k);
    const cent = new Float64Array(k * d);
    const pow = 2 / (m - 1);

    while (moving && iterations < maxIterations) {
      moving = false;

      // the centroids from the weighted memberships
      for (let i = 0; i < n * k; i++) {
        weight[i] = Math.pow(U[i], m);
      }

      for (let c = 0; c < k; c++) {
        for (let j = 0; j < d; j++) {
          let numerator = 0;
          let denominator = 0;

          for (let i = 0; i < n; i++) {
            numerator += weight[i * k + c] * vecs[i * d + j];
            denominator += weight[i * k + c];
          }

          cent[c * d + j] = numerator / denominator;
        }
      }

      // the memberships from the centroids
      prev.set(U);

      for (let c = 0; c < k; c++) {
        for (let i = 0; i < n; i++) {
          let sum = 0;
          const numerator = dist(cent, c * d, i * d);

          for (let kk = 0; kk < k; kk++) {
            sum += Math.pow(numerator / dist(cent, kk * d, i * d), pow);
          }

          U[i * k + c] = 1 / sum;
        }
      }

      for (let i = 0; i < n * k; i++) {
        if (Math.abs(U[i] - prev[i]) > threshold) {
          moving = true;
          break;
        }
      }

      iterations++;
    }

    return { U, iterations };
  }

  // k-means / k-medoids: classify, bucket in node order, update
  const assignment = new Int32Array(n);
  const count = new Int32Array(Math.max(kc, 1));
  const start = new Int32Array(Math.max(kc, 1) + 1);
  const fill = new Int32Array(Math.max(kc, 1));
  const order = new Int32Array(n);
  // the clusters the result is read from: k-means updates the first k
  // centres; k-medoids every medoid it was given
  const slots = mode === 0 ? k : kc;
  const kept: Int32Array[] = [];
  const centroids = input.centroids as Float64Array;
  const medoids = new Int32Array(kc);
  // the centres' rows: k-means' own matrix, k-medoids' node vectors
  const centres = mode === 0 ? centroids : vecs;

  for (let c = 0; c < slots; c++) {
    kept.push(new Int32Array(0));
  }

  for (let c = 0; c < kc; c++) {
    medoids[c] = n + c;
  }

  // k-medoids' swap cost: Manhattan whatever the metric (v3's choice),
  // from the candidate to every member, in member order
  const cost = (row: number, s0: number, size: number): number => {
    let total = 0;

    for (let p = s0; p < s0 + size; p++) {
      const qi = order[p] * d;
      let acc = 0;

      for (let j = 0; j < d; j++) {
        acc = acc + Math.abs(vecs[qi + j] - vecs[row * d + j]);
      }

      total += acc;
    }

    return total;
  };

  while (moving && iterations < maxIterations) {
    for (let i = 0; i < n; i++) {
      let min = Infinity;
      let index = 0;

      for (let c = 0; c < kc; c++) {
        const dc = dist(centres, (mode === 0 ? c : medoids[c]) * d, i * d);

        if (dc < min) {
          min = dc;
          index = c;
        }
      }

      assignment[i] = index;
    }

    moving = false;

    // every cluster's members, in node order (the reference's
    // `buildCluster` order, without its k passes over the nodes)
    count.fill(0);

    for (let i = 0; i < n; i++) {
      count[assignment[i]]++;
    }

    for (let c = 0; c < kc; c++) {
      start[c + 1] = start[c] + count[c];
      fill[c] = start[c];
    }

    for (let i = 0; i < n; i++) {
      order[fill[assignment[i]]++] = i;
    }

    for (let c = 0; c < slots; c++) {
      const size = c < kc ? count[c] : 0;

      if (size === 0) {
        continue;
      }

      const s0 = start[c];

      if (mode === 0) {
        for (let j = 0; j < d; j++) {
          let sum = 0.0;

          for (let p = s0; p < s0 + size; p++) {
            sum += vecs[order[p] * d + j];
          }

          const next = sum / size;

          if (!(Math.abs(centroids[c * d + j] - next) <= threshold)) {
            moving = true;
          }

          centroids[c * d + j] = next;
        }
      } else {
        let minCost = cost(medoids[c], s0, size);

        for (let p = s0; p < s0 + size; p++) {
          const curCost = cost(order[p], s0, size);

          if (curCost < minCost) {
            minCost = curCost;
            medoids[c] = order[p];
            moving = true;
          }
        }
      }

      kept[c] = order.slice(s0, s0 + size);
    }

    iterations++;
  }

  const ptr = new Int32Array(slots + 1);

  for (let c = 0; c < slots; c++) {
    ptr[c + 1] = ptr[c] + kept[c].length;
  }

  const idx = new Int32Array(ptr[slots]);

  for (let c = 0; c < slots; c++) {
    idx.set(kept[c], ptr[c]);
  }

  return { ptr, idx, iterations };
}

/** The hierarchical merge chain's kernel input. */
export interface HierarchicalKernelInput {
  [key: string]: unknown;
  n: number;
  d: number;
  /** row-major attribute vectors, or null when `dist` is given */
  vecs: Float64Array | null;
  /** a pre-filled pair matrix (n × n, the lower triangle read) — the
   * GPU executor's read-back and a custom metric's in-thread fill — or
   * null to fill it here from `vecs` */
  dist: Float64Array | null;
  /** as `KClusteringKernelInput.kind` */
  kind: number;
  /** 0 min (single), 1 max (complete), 2 mean */
  linkage: number;
  dendrogram: boolean;
  threshold: number;
}

/**
 * Agglomerative clustering's flat merge engine (round 65.10), moved
 * here whole: the pair matrix, min pointers, active-key order and
 * cluster sizes in typed arrays, the merge structure as a log of (left,
 * right) tree-node ids — leaf i is node i, merge m is node n + m — that
 * the wrapper replays into the public shapes.  Semantics are the
 * object path's exactly (see `hierarchical-clustering.mts`): the same
 * lower-triangle min seeding, first-in-order ties, stale-min repair,
 * and members ordered by in-order traversal of the merge tree.
 *
 * One deliberate deviation, from a defect the 65.10 rewrite surfaced:
 * **v3's `mean` linkage never worked** — its `size` field is read in the
 * weighted-average formula but never assigned, so the first mean merge
 * wrote NaN distances and NaN comparisons made those rows unpickable
 * ever after.  Here sizes are tracked (leaves 1, merged sums), so
 * `mean` is the weighted-average linkage its documentation claims.
 * An unknown `mode` reads as threshold mode (the engine's own loop
 * never terminated on one before round 134).
 *
 * @param input — the vectors (or a filled matrix) and the options
 * @returns the merge log, each surviving key's tree node, and the
 *   surviving keys in order
 */
export function hierarchicalKernel(input: HierarchicalKernelInput): {
  left: Int32Array;
  right: Int32Array;
  merges: number;
  treeNode: Int32Array;
  active: Int32Array;
} {
  const n = input.n;
  const d = input.d;
  const vecs = input.vecs;
  const kind = input.kind;
  const linkage = input.linkage;
  const dendrogram = input.dendrogram;
  const threshold = input.threshold;
  const dist = input.dist === null ? new Float64Array(n * n) : input.dist;
  const minIdx = new Int32Array(n);
  const sizes = new Int32Array(n).fill(1);
  // active cluster keys, in the object path's array order (a merge
  // keeps the survivor in place and closes the gap left by the other)
  const active = new Int32Array(n);
  let activeCount = n;
  const treeNode = new Int32Array(n);
  const left = new Int32Array(Math.max(0, n - 1));
  const right = new Int32Array(Math.max(0, n - 1));
  let merges = 0;

  // the named metrics inline (the 65.10 AP-build treatment);
  // Math.pow(x, 2) and x·x round identically
  const pairDist = (i: number, j: number): number => {
    if (vecs === null) {
      return dist[i * n + j];
    }

    const pi = i * d;
    const qi = j * d;
    let acc = kind === 3 ? -Infinity : 0;

    for (let k = 0; k < d; k++) {
      const ad = Math.abs(vecs[pi + k] - vecs[qi + k]);

      if (kind === 2) {
        acc += ad;
      } else if (kind === 3) {
        acc = Math.max(acc, ad);
      } else {
        acc += ad * ad;
      }
    }

    return kind === 0 ? Math.sqrt(acc) : acc;
  };

  for (let i = 0; i < n; i++) {
    active[i] = i;
    treeNode[i] = i;
  }

  // the object path's exact init: symmetric fill, min pointers seeded
  // from the lower triangle only (row 0 starts at its Infinity
  // diagonal — its pairs are found through the higher-indexed rows)
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      const dij = i === j ? Infinity : pairDist(i, j);

      dist[i * n + j] = dij;
      dist[j * n + i] = dij;

      if (dij < dist[i * n + minIdx[i]]) {
        minIdx[i] = j;
      }
    }
  }

  while (n > 0) {
    // global min, first-in-order wins on ties (strict <)
    let minKey = active[0];
    let min = Infinity;

    for (let p = 0; p < activeCount; p++) {
      const key = active[p];
      const dk = dist[key * n + minIdx[key]];

      if (dk < min) {
        minKey = key;
        min = dk;
      }
    }

    if (
      (!dendrogram && min >= threshold) ||
      (dendrogram && activeCount === 1)
    ) {
      break;
    }

    const c1 = minKey;
    const c2 = minIdx[minKey];

    // record the merge and take c2 out of the active order
    left[merges] = treeNode[c1];
    right[merges] = treeNode[c2];
    treeNode[c1] = n + merges;
    merges++;

    let at = 0;

    while (active[at] !== c2) {
      at++;
    }

    active.copyWithin(at, at + 1, activeCount);
    activeCount--;

    // linkage update of the survivor's row/column (mean uses the
    // pre-merge sizes, then the survivor absorbs the other's)
    const s1 = sizes[c1];
    const s2 = sizes[c2];

    for (let p = 0; p < activeCount; p++) {
      const cur = active[p];
      let dc: number;

      if (cur === c1) {
        dc = Infinity;
      } else if (linkage === 0) {
        dc = Math.min(dist[c1 * n + cur], dist[c2 * n + cur]);
      } else if (linkage === 1) {
        dc = Math.max(dist[c1 * n + cur], dist[c2 * n + cur]);
      } else {
        dc = (dist[c1 * n + cur] * s1 + dist[c2 * n + cur] * s2) / (s1 + s2);
      }

      dist[c1 * n + cur] = dc;
      dist[cur * n + c1] = dc;
    }

    sizes[c1] = s1 + s2;

    // repair min pointers that referenced the merged pair (a linkage
    // value is never below the smaller of the two entries it replaces,
    // so only those pointers can be stale)
    for (let p = 0; p < activeCount; p++) {
      const key1 = active[p];

      if (minIdx[key1] === c1 || minIdx[key1] === c2) {
        let minK = key1;

        for (let q = 0; q < activeCount; q++) {
          const key2 = active[q];

          if (dist[key1 * n + key2] < dist[key1 * n + minK]) {
            minK = key2;
          }
        }

        minIdx[key1] = minK;
      }
    }
  }

  return {
    left,
    right,
    merges,
    treeNode,
    active: active.slice(0, activeCount),
  };
}

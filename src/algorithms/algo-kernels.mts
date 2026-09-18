/*
The offload lane's kernels (round 129.1): the reference maths of the
whole-graph families that have no pool lane, each as one self-contained
function over a snapshot of typed arrays and scalars.

Why they live here, apart from the families that own them: the same
function has to run on both sides of the worker boundary.  The
in-thread `'cpu'` path calls a kernel directly; the pool stringifies
each one beside `algoWorkerBody` and evaluates it inside a plain
worker, so a run on one worker answers the bits the reference answers
— bit-identical by construction, never a second copy of the maths.
That carriage is what shapes every line:

  - **No imports, no outer references, no class syntax.**  A kernel is
    re-created from its source text in a scope that holds nothing but
    the globals; a reference to anything outside it is a
    ReferenceError at the first job that reaches it.  Helpers a kernel
    needs (MCL's expand / inflate / convergence test, AP's exemplar
    scan) are inner functions.  `test/modules/algo-worker-body.mjs`
    evaluates the pool's complete source — body and kernels — in a
    bare scope from the built ESM, the built UMD and under tsx.
  - **ES2018-plain**, as the body: the bundles are transpiled to that
    target and a lowering helper would be an outer reference too.
  - **The arithmetic order is the reference's** — these *are* the
    references, moved.  Every loop keeps the operation order the
    family shipped with, so the tolerance specs of rounds 65–72 hold
    unchanged and the round-129 bit-equality specs hold trivially.

The user closures never reach here: a family's *builder* evaluates
`weight`, MCL's `attributes` and AP's `attributes` / `distance` on the
main thread into the snapshot (the round-74 rule for weights, applied
to every closure), which is exactly what makes a family
snapshot-runnable.  Inputs that the builders hold as arrays of typed
arrays (neighbor lists) cross as CSR pairs (`listsToCsr`), so a
snapshot is a handful of buffers rather than thousands of objects.
*/

/** A kernel's snapshot: typed arrays and scalars, structured-cloneable. */
export type KernelInput = Record<string, unknown>;

/** A kernel's answer: typed arrays (transferred back) and scalars. */
export type KernelOutput = Record<string, unknown>;

// -- pageRank: the sparse power method (65.10) ---------------------------

export interface PageRankKernelInput extends KernelInput {
  n: number;
  edges: number;
  srcs: Int32Array;
  dsts: Int32Array;
  ws: Float64Array;
  dangling: Int32Array;
  additionalProb: number;
  precision: number;
  iterations: number;
}

/**
 * PageRank's dominant eigenvector by the sparse power method: per
 * iteration an O(E) edge gather plus the two rank-1 terms (the damping
 * teleport over Σv and the dangling mass over Σ_dangling v) that are
 * constant per row.
 *
 * @param input — the sparse transition structure and the stopping rule
 * @returns the converged, sum-normalized ranks
 */
export function pageRankKernel(input: PageRankKernelInput): {
  ranks: Float64Array;
} {
  const n = input.n;
  const edges = input.edges;
  const srcs = input.srcs;
  const dsts = input.dsts;
  const ws = input.ws;
  const dangling = input.dangling;
  const additionalProb = input.additionalProb;
  const precision = input.precision;
  const iterations = input.iterations;

  let eigenvector = new Float64Array(n).fill(1);
  let temp = new Float64Array(n);

  for (let iter = 0; iter < iterations; iter++) {
    let vSum = 0;

    for (let i = 0; i < n; i++) {
      vSum += eigenvector[i];
    }

    let danglingSum = 0;

    for (let k = 0; k < dangling.length; k++) {
      danglingSum += eigenvector[dangling[k]];
    }

    const base = additionalProb * vSum + danglingSum / n;

    temp.fill(base);

    for (let e = 0; e < edges; e++) {
      temp[dsts[e]] += ws[e] * eigenvector[srcs[e]];
    }

    let sum = 0;

    for (let i = 0; i < n; i++) {
      sum += temp[i];
    }

    if (sum !== 0) {
      for (let i = 0; i < n; i++) {
        temp[i] /= sum;
      }
    }

    const previous = eigenvector;

    eigenvector = temp;
    temp = previous;

    let diff = 0;

    for (let i = 0; i < n; i++) {
      const delta = previous[i] - eigenvector[i];

      diff += delta * delta;
    }

    if (diff < precision) {
      break;
    }
  }

  return { ranks: eigenvector };
}

// -- Katz: the sparse fixed point (69.4) --------------------------------

export interface KatzKernelInput extends KernelInput {
  n: number;
  arcs: number;
  srcs: Int32Array;
  dsts: Int32Array;
  ws: Float64Array;
  beta: number;
  maxIterations: number;
  tolerance: number;
}

/**
 * Katz centrality by the sparse fixed point x' = α·Aᵀ·x + β, from
 * x = 0, until the L1 step drops under n·tolerance or the iteration
 * cap runs out (the un-converged vector is answered as-is).
 *
 * @param input — the attenuated arcs and the stopping rule
 * @returns the per-node walk sums
 */
export function katzKernel(input: KatzKernelInput): { x: Float64Array } {
  const n = input.n;
  const arcs = input.arcs;
  const srcs = input.srcs;
  const dsts = input.dsts;
  const ws = input.ws;
  const beta = input.beta;
  const maxIterations = input.maxIterations;
  const tolerance = input.tolerance;

  let x = new Float64Array(n);
  let next = new Float64Array(n);

  for (let iter = 0; iter < maxIterations; iter++) {
    next.fill(beta);

    for (let a = 0; a < arcs; a++) {
      next[dsts[a]] += ws[a] * x[srcs[a]];
    }

    let diff = 0;

    for (let i = 0; i < n; i++) {
      diff += Math.abs(next[i] - x[i]);
    }

    const previous = x;

    x = next;
    next = previous;

    if (diff < n * tolerance) {
      break;
    }
  }

  return { x };
}

// -- Floyd–Warshall: the dense relaxation (65; extracted in 69) ---------

export interface FloydWarshallKernelInput extends KernelInput {
  n: number;
  dist: Float64Array;
  next: Int32Array;
}

/**
 * Relax the distance and successor matrices in place over every
 * intermediate k: an unreachable (i, k) pair skips its whole j row,
 * the running ij/kj indices replace the per-iteration multiplies.
 *
 * @param input — the matrices from the family's builder
 * @returns the same matrices, relaxed
 */
export function floydWarshallKernel(input: FloydWarshallKernelInput): {
  dist: Float64Array;
  next: Int32Array;
} {
  const n = input.n;
  const dist = input.dist;
  const next = input.next;

  for (let k = 0; k < n; k++) {
    const kn = k * n;

    for (let i = 0; i < n; i++) {
      const rowI = i * n;
      const ik = rowI + k;
      const dik = dist[ik];

      if (dik === Infinity) {
        continue;
      }

      for (let j = 0, ij = rowI, kj = kn; j < n; j++, ij++, kj++) {
        const alt = dik + dist[kj];

        if (alt < dist[ij]) {
          dist[ij] = alt;
          next[ij] = next[ik];
        }
      }
    }
  }

  return { dist, next };
}

// -- triangles: the sorted-intersection walk (70) ----------------------

export interface TriangleKernelInput extends KernelInput {
  n: number;
  /** sorted, deduped undirected adjacency as CSR */
  rowPtr: Int32Array;
  colIdx: Int32Array;
}

/**
 * Triangles through each node: for every edge (u, v) with u < v, walk
 * the sorted neighbor lists' intersection counting the w > v that
 * close a triangle — each triangle found once, crediting all three
 * corners.
 *
 * @param input — the sorted CSR
 * @returns triangles per node
 */
export function triangleKernel(input: TriangleKernelInput): {
  triangles: Float64Array;
} {
  const n = input.n;
  const rowPtr = input.rowPtr;
  const colIdx = input.colIdx;
  const triangles = new Float64Array(n);

  for (let u = 0; u < n; u++) {
    const u0 = rowPtr[u];
    const u1 = rowPtr[u + 1];

    for (let vi = u0; vi < u1; vi++) {
      const v = colIdx[vi];

      if (v <= u) {
        continue;
      }

      const v0 = rowPtr[v];
      const v1 = rowPtr[v + 1];
      let a = u0;
      let b = v0;

      while (a < u1 && b < v1) {
        const x = colIdx[a];
        const y = colIdx[b];

        if (x <= v) {
          a++;
        } else if (y <= v) {
          b++;
        } else if (x < y) {
          a++;
        } else if (y < x) {
          b++;
        } else {
          triangles[u]++;
          triangles[v]++;
          triangles[x]++;
          a++;
          b++;
        }
      }
    }
  }

  return { triangles };
}

// -- neighborhood similarity: wedge counting (70) ----------------------

export interface SimilarityKernelInput extends KernelInput {
  n: number;
  /** the neighborhoods as CSR (out-neighborhoods when directed) */
  rowPtr: Int32Array;
  colIdx: Int32Array;
  directed: boolean;
}

/**
 * The shared-neighbor count matrix by wedge counting: every shared
 * neighbor w of a pair (u, v) is one wedge u–w–v, so walking w's
 * witness list and crediting each pair fills the matrix without any
 * per-pair set intersection; the diagonal is each node's own size.
 *
 * @param input — the neighborhoods as CSR
 * @returns the row-major count matrix
 */
export function similarityKernel(input: SimilarityKernelInput): {
  counts: Float64Array;
} {
  const n = input.n;
  const rowPtr = input.rowPtr;
  const colIdx = input.colIdx;
  const directed = input.directed;
  const counts = new Float64Array(n * n);

  // witness lists: rev[w] = the u with w ∈ N(u).  Undirected
  // neighborhoods are symmetric, so the CSR itself is the witness list
  let revPtr = rowPtr;
  let revIdx = colIdx;

  if (directed) {
    const revCounts = new Int32Array(n + 1);

    for (let k = 0; k < rowPtr[n]; k++) {
      revCounts[colIdx[k] + 1]++;
    }

    for (let w = 0; w < n; w++) {
      revCounts[w + 1] += revCounts[w];
    }

    revPtr = revCounts;
    revIdx = new Int32Array(rowPtr[n]);

    const fill = revCounts.slice(0, n);

    for (let u = 0; u < n; u++) {
      for (let k = rowPtr[u]; k < rowPtr[u + 1]; k++) {
        revIdx[fill[colIdx[k]]++] = u;
      }
    }
  }

  for (let w = 0; w < n; w++) {
    const w0 = revPtr[w];
    const w1 = revPtr[w + 1];

    for (let a = w0; a < w1; a++) {
      const u = revIdx[a];

      for (let b = a + 1; b < w1; b++) {
        const v = revIdx[b];

        counts[u * n + v]++;
        counts[v * n + u]++;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    counts[i * n + i] = rowPtr[i + 1] - rowPtr[i];
  }

  return { counts };
}

// -- the triad census: the seven traces by wedge walks (70) ------------

export interface MotifKernelInput extends KernelInput {
  n: number;
  /** asymmetric out-neighbors, in-neighbors and mutual neighbors, each
   * as CSR over dense indices */
  outPtr: Int32Array;
  outIdx: Int32Array;
  inPtr: Int32Array;
  inIdx: Int32Array;
  mutPtr: Int32Array;
  mutIdx: Int32Array;
}

/**
 * The seven traces S₁–S₇ of the census, accumulated by walking wedges
 * around every center — asymmetric in×out pairs for S₁–S₃, mutual
 * pairs for S₄–S₅, out×out and in×in pairs for S₆–S₇ — with O(1)
 * membership probes against per-node sets built from the CSRs.
 *
 * @param input — the three CSRs
 * @returns the traces, s[0..6] = S₁..S₇
 */
export function motifKernel(input: MotifKernelInput): { s: Float64Array } {
  const n = input.n;
  const outPtr = input.outPtr;
  const outIdx = input.outIdx;
  const inPtr = input.inPtr;
  const inIdx = input.inIdx;
  const mutPtr = input.mutPtr;
  const mutIdx = input.mutIdx;
  const outSets: Set<number>[] = new Array(n);
  const mutSets: Set<number>[] = new Array(n);

  for (let i = 0; i < n; i++) {
    outSets[i] = new Set(outIdx.subarray(outPtr[i], outPtr[i + 1]));
    mutSets[i] = new Set(mutIdx.subarray(mutPtr[i], mutPtr[i + 1]));
  }

  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  let s5 = 0;
  let s6 = 0;
  let s7 = 0;

  for (let j = 0; j < n; j++) {
    const in0 = inPtr[j];
    const in1 = inPtr[j + 1];
    const out0 = outPtr[j];
    const out1 = outPtr[j + 1];
    const mut0 = mutPtr[j];
    const mut1 = mutPtr[j + 1];

    // asymmetric paths i→j→k: (C²)_ik once each
    for (let a = in0; a < in1; a++) {
      const i = inIdx[a];

      for (let b = out0; b < out1; b++) {
        const k = outIdx[b];

        if (i === k) {
          continue;
        }

        if (outSets[i].has(k)) {
          s1++;
        }

        if (outSets[k].has(i)) {
          s2++;
        }

        if (mutSets[i].has(k)) {
          s3++;
        }
      }
    }

    // mutual wedges x−j−y: (M²)_xy over ordered pairs
    for (let a = mut0; a < mut1; a++) {
      const x = mutIdx[a];

      for (let b = mut0; b < mut1; b++) {
        const y = mutIdx[b];

        if (x === y) {
          continue;
        }

        if (mutSets[x].has(y)) {
          s4++;
        }

        if (outSets[x].has(y) && !mutSets[x].has(y)) {
          s5++;
        }
      }
    }

    // out-out wedges x←j→y for S₆, in-in wedges x→j←y for S₇
    for (let a = out0; a < out1; a++) {
      const x = outIdx[a];

      for (let b = out0; b < out1; b++) {
        const y = outIdx[b];

        if (x !== y && mutSets[x].has(y)) {
          s6++;
        }
      }
    }

    for (let a = in0; a < in1; a++) {
      const x = inIdx[a];

      for (let b = in0; b < in1; b++) {
        const y = inIdx[b];

        if (x !== y && mutSets[x].has(y)) {
          s7++;
        }
      }
    }
  }

  return { s: Float64Array.of(s1, s2, s3, s4, s5, s6, s7) };
}

// -- SimRank: the sparse fixed point (70) ------------------------------

export interface SimRankKernelInput extends KernelInput {
  n: number;
  /** in-neighborhoods as CSR */
  inPtr: Int32Array;
  inIdx: Int32Array;
  c: number;
  maxIterations: number;
  tolerance: number;
}

/**
 * The Jeh–Widom fixed point iterated sparsely — Q·S as per-row
 * neighbor sums, (Q·S)·Qᵀ as per-column neighbor sums — from S⁰ = I,
 * stopping once max |Δs| drops under `tolerance` or the cap runs out.
 *
 * @param input — the in-neighborhoods and the stopping rule
 * @returns the row-major score matrix
 */
export function simRankKernel(input: SimRankKernelInput): {
  scores: Float64Array;
} {
  const n = input.n;
  const inPtr = input.inPtr;
  const inIdx = input.inIdx;
  const c = input.c;
  const maxIterations = input.maxIterations;
  const tolerance = input.tolerance;

  let scores = new Float64Array(n * n);
  const t = new Float64Array(n * n);
  let u = new Float64Array(n * n);

  for (let i = 0; i < n; i++) {
    scores[i * n + i] = 1;
  }

  for (let iter = 0; iter < maxIterations; iter++) {
    // t = Q·S: row a averages the rows of a's neighbors
    for (let a = 0; a < n; a++) {
      const l0 = inPtr[a];
      const l1 = inPtr[a + 1];
      const row = a * n;

      t.fill(0, row, row + n);

      if (l1 === l0) {
        continue;
      }

      for (let k = l0; k < l1; k++) {
        const src = inIdx[k] * n;

        for (let j = 0; j < n; j++) {
          t[row + j] += scores[src + j];
        }
      }

      const inv = 1 / (l1 - l0);

      for (let j = 0; j < n; j++) {
        t[row + j] *= inv;
      }
    }

    // u = t·Qᵀ: column b averages the columns of b's neighbors
    for (let b = 0; b < n; b++) {
      const l0 = inPtr[b];
      const l1 = inPtr[b + 1];

      if (l1 === l0) {
        for (let a = 0; a < n; a++) {
          u[a * n + b] = 0;
        }

        continue;
      }

      const inv = 1 / (l1 - l0);

      for (let a = 0; a < n; a++) {
        const row = a * n;
        let sum = 0;

        for (let k = l0; k < l1; k++) {
          sum += t[row + inIdx[k]];
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

    const previous = scores;

    scores = u;
    u = previous;

    if (maxDiff <= tolerance) {
      break;
    }
  }

  return { scores };
}

// -- effective resistance: dense inversion (70) ------------------------

export interface ResistanceKernelInput extends KernelInput {
  n: number;
  /** the row-major system B, overwritten with its inverse */
  b: Float64Array;
}

/**
 * Invert a dense row-major matrix in place by Gauss–Jordan elimination
 * with partial pivoting — the f64 reference the GPU's f32 iteration is
 * judged against.
 *
 * @param input — the system
 * @returns the same buffer, holding B⁻¹
 */
export function resistanceKernel(input: ResistanceKernelInput): {
  inv: Float64Array;
} {
  const n = input.n;
  const a = input.b;
  const inv = new Float64Array(n * n);

  for (let i = 0; i < n; i++) {
    inv[i * n + i] = 1;
  }

  for (let col = 0; col < n; col++) {
    let pivot = col;

    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row * n + col]) > Math.abs(a[pivot * n + col])) {
        pivot = row;
      }
    }

    if (pivot !== col) {
      for (let j = 0; j < n; j++) {
        const t = a[col * n + j];

        a[col * n + j] = a[pivot * n + j];
        a[pivot * n + j] = t;

        const ti = inv[col * n + j];

        inv[col * n + j] = inv[pivot * n + j];
        inv[pivot * n + j] = ti;
      }
    }

    const scale = 1 / a[col * n + col];

    for (let j = 0; j < n; j++) {
      a[col * n + j] *= scale;
      inv[col * n + j] *= scale;
    }

    for (let row = 0; row < n; row++) {
      if (row === col) {
        continue;
      }

      const factor = a[row * n + col];

      if (factor === 0) {
        continue;
      }

      for (let j = 0; j < n; j++) {
        a[row * n + j] -= factor * a[col * n + j];
        inv[row * n + j] -= factor * inv[col * n + j];
      }
    }
  }

  a.set(inv);

  return { inv: a };
}

// -- Markov clustering: expand / inflate to a fixed point --------------

export interface MarkovKernelInput extends KernelInput {
  n: number;
  /** the column-stochastic start matrix, row-major */
  M: Float64Array;
  expandFactor: number;
  inflateFactor: number;
  maxIterations: number;
}

/**
 * MCL's alternation of expansion (a matrix power) and inflation (an
 * element-wise power, re-normalized) until the matrix stops changing
 * to four decimal places or the cap runs out.
 *
 * @param input — the start matrix and the knobs
 * @returns the converged matrix
 */
export function markovKernel(input: MarkovKernelInput): { M: Float64Array } {
  const n = input.n;
  const expandFactor = input.expandFactor;
  const inflateFactor = input.inflateFactor;
  const maxIterations = input.maxIterations;
  const n2 = n * n;
  let M = input.M;

  const normalize = (A: Float64Array): void => {
    for (let col = 0; col < n; col++) {
      let sum = 0;

      for (let row = 0; row < n; row++) {
        sum += A[row * n + col];
      }

      for (let row = 0; row < n; row++) {
        A[row * n + col] = A[row * n + col] / sum;
      }
    }
  };

  const mmult = (A: Float64Array, B: Float64Array): Float64Array => {
    const C = new Float64Array(n2);

    for (let i = 0; i < n; i++) {
      for (let k = 0; k < n; k++) {
        const a = A[i * n + k];

        for (let j = 0; j < n; j++) {
          C[i * n + j] += a * B[k * n + j];
        }
      }
    }

    return C;
  };

  const expand = (A: Float64Array): Float64Array => {
    const base = A.slice();

    for (let p = 1; p < expandFactor; p++) {
      A = mmult(A, base);
    }

    return A;
  };

  const inflate = (A: Float64Array): Float64Array => {
    const out = new Float64Array(n2);

    for (let i = 0; i < n2; i++) {
      out[i] = Math.pow(A[i], inflateFactor);
    }

    normalize(out);

    return out;
  };

  const hasConverged = (A: Float64Array, B: Float64Array): boolean => {
    const scale = Math.pow(10, 4);

    for (let i = 0; i < n2; i++) {
      if (
        Math.round(A[i] * scale) / scale !==
        Math.round(B[i] * scale) / scale
      ) {
        return false;
      }
    }

    return true;
  };

  let isStillMoving = true;
  let iterations = 0;

  while (isStillMoving && iterations < maxIterations) {
    isStillMoving = false;

    const expanded = expand(M);

    M = inflate(expanded);

    if (!hasConverged(M, expanded)) {
      isStillMoving = true;
    }

    iterations++;
  }

  return { M };
}

// -- affinity propagation: message passing to the exemplars ------------

export interface AffinityKernelInput extends KernelInput {
  n: number;
  /** the similarity matrix with the preference on its diagonal */
  S: Float64Array;
  damping: number;
  maxIterations: number;
  minIterations: number;
}

/**
 * Affinity propagation's responsibility / availability updates, damped,
 * until the exemplar set holds still for `minIterations` iterations or
 * the cap runs out; the exemplars are the rows with R + A > 0 on the
 * diagonal.
 *
 * @param input — the similarity matrix and the knobs
 * @returns the exemplar rows, ascending
 */
export function affinityKernel(input: AffinityKernelInput): {
  exemplars: Int32Array;
} {
  const n = input.n;
  const S = input.S;
  const damping = input.damping;
  const maxIterations = input.maxIterations;
  const minIterations = input.minIterations;
  const n2 = n * n;

  const R = new Float64Array(n2);
  const A = new Float64Array(n2);
  const old = new Float64Array(n);
  const Rp = new Float64Array(n);
  const se = new Float64Array(n);
  const e = new Float64Array(n * minIterations);

  for (let iter = 0; iter < maxIterations; iter++) {
    // update responsibilities
    for (let i = 0; i < n; i++) {
      let maxAS = -Infinity;
      let max2 = -Infinity;
      let maxI = -1;

      for (let j = 0; j < n; j++) {
        old[j] = R[i * n + j];

        const AS = A[i * n + j] + S[i * n + j];

        if (AS >= maxAS) {
          max2 = maxAS;
          maxAS = AS;
          maxI = j;
        } else if (AS > max2) {
          max2 = AS;
        }
      }

      for (let j = 0; j < n; j++) {
        R[i * n + j] =
          (1 - damping) * (S[i * n + j] - maxAS) + damping * old[j];
      }

      R[i * n + maxI] =
        (1 - damping) * (S[i * n + maxI] - max2) + damping * old[maxI];
    }

    // update availabilities
    for (let i = 0; i < n; i++) {
      let sum = 0;

      for (let j = 0; j < n; j++) {
        old[j] = A[j * n + i];
        Rp[j] = Math.max(0, R[j * n + i]);
        sum += Rp[j];
      }

      sum -= Rp[i];
      Rp[i] = R[i * n + i];
      sum += Rp[i];

      for (let j = 0; j < n; j++) {
        A[j * n + i] =
          (1 - damping) * Math.min(0, sum - Rp[j]) + damping * old[j];
      }

      A[i * n + i] = (1 - damping) * (sum - Rp[i]) + damping * old[i];
    }

    // convergence check
    let K = 0;

    for (let i = 0; i < n; i++) {
      const E = A[i * n + i] + R[i * n + i] > 0 ? 1 : 0;

      e[(iter % minIterations) * n + i] = E;
      K += E;
    }

    if (K > 0 && (iter >= minIterations - 1 || iter === maxIterations - 1)) {
      let sum = 0;

      for (let i = 0; i < n; i++) {
        se[i] = 0;

        for (let j = 0; j < minIterations; j++) {
          se[i] += e[j * n + i];
        }

        if (se[i] === 0 || se[i] === minIterations) {
          sum++;
        }
      }

      if (sum === n) {
        break;
      }
    }
  }

  let count = 0;

  for (let i = 0; i < n; i++) {
    if (R[i * n + i] + A[i * n + i] > 0) {
      count++;
    }
  }

  const exemplars = new Int32Array(count);

  for (let i = 0, k = 0; i < n; i++) {
    if (R[i * n + i] + A[i * n + i] > 0) {
      exemplars[k++] = i;
    }
  }

  return { exemplars };
}

// -- the registry, and the helpers the builders share ------------------

/** Every kernel by name — what the pool carries and the lane calls. */
export const ALGO_KERNELS = {
  pageRank: pageRankKernel,
  katz: katzKernel,
  floydWarshall: floydWarshallKernel,
  triangles: triangleKernel,
  similarity: similarityKernel,
  motifs: motifKernel,
  simRank: simRankKernel,
  resistance: resistanceKernel,
  markov: markovKernel,
  affinity: affinityKernel,
} as const;

/** A kernel's name in the registry. */
export type KernelName = keyof typeof ALGO_KERNELS;

/** A run of one kernel over one snapshot, as the lane carries it. */
export interface KernelSnapshot {
  kind: 'kernel';
  name: KernelName;
  input: KernelInput;
}

/**
 * Run a kernel in this thread — the `'cpu'` path of every offload
 * family, so that the reference and the worker run one function.
 *
 * @param snapshot — the kernel and its input
 * @returns the kernel's output
 */
export const runKernelInThread = (snapshot: KernelSnapshot): KernelOutput =>
  (
    ALGO_KERNELS[snapshot.name] as unknown as (
      input: KernelInput,
    ) => KernelOutput
  )(snapshot.input);

/**
 * Flatten per-node neighbor lists into a CSR pair, so a snapshot
 * crosses the worker boundary as two buffers rather than one object
 * per node.
 *
 * @param lists — one list per dense index
 * @returns the row pointers (length n + 1) and the concatenated indices
 */
export const listsToCsr = (
  lists: Int32Array[],
): { rowPtr: Int32Array; colIdx: Int32Array } => {
  const n = lists.length;
  const rowPtr = new Int32Array(n + 1);

  for (let i = 0; i < n; i++) {
    rowPtr[i + 1] = rowPtr[i] + lists[i].length;
  }

  const colIdx = new Int32Array(rowPtr[n]);

  for (let i = 0; i < n; i++) {
    colIdx.set(lists[i], rowPtr[i]);
  }

  return { rowPtr, colIdx };
};

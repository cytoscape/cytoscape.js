/*
Effective resistance and commute time (round 70) — the graph read as a
resistor network: every edge a conductor of its weight, and the
resistance between two nodes the voltage a unit current between them
would need.  Equivalently: commuteTime(a, b) — the expected steps a
random walk takes a→b→a — is the component's volume times the
resistance, which is what makes the measure useful for link
prediction and robustness work.

Both quantities read off the pseudo-inverse of the weighted Laplacian:
R(a, b) = L⁺aa + L⁺bb − 2·L⁺ab.  The executors invert B = L + J-blocks
(each connected component's block shifted by its own 1/n_c projector,
which makes B positive-definite while leaving *differences* of entries
— and so every resistance — untouched): the CPU by dense f64
Gauss–Jordan elimination, the GPU by Newton–Schulz iteration, which is
nothing but matmuls.  Either way the work is O(n³) — there is no
sparse shortcut to the whole inverse — so this family is the
MCL-shaped one: the GPU wins at every density.

Edges are undirected with positive weights (a non-positive
conductance throws); parallel edges sum, loops drop.  Pairs in
different components answer Infinity.  No v3 counterpart.
*/

import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot } from './algo-shared.mjs';
import type { SubgraphView, WeightFn } from './algo-shared.mjs';
import {
  GPU_MIN_N,
  OFFLOAD_MIN_N,
  inThread,
  resolveExecutor,
  runAlgo,
} from './executor.mjs';
import type { AlgoExecutor, OffloadLane } from './executor.mjs';
import type { AlgoRun } from './cancel.mjs';
import { effectiveResistanceGpu } from './algo-gpu-resistance.mjs';
import { resistanceKernel } from './algo-kernels.mjs';

/**
 * The node count from which `'auto'` inverts the system on one pool
 * worker rather than in-thread (129.1): a starting figure, stamped
 * from the `algorithms-workers` offload rows.
 */
export const RESISTANCE_OFFLOAD_MIN_N = OFFLOAD_MIN_N;
import { GROUP_EDGES } from '../contract.mjs';

export interface EffectiveResistanceOptions {
  weight?: WeightFn;
  /** where the run executes; see `AlgoExecutor` (default 'auto') */
  executor?: AlgoExecutor;
}

export interface EffectiveResistanceResult {
  /** the effective resistance between the nodes (Infinity across
   * components), or undefined when either node is outside the
   * collection */
  resistance(a: Collection, b: Collection): number | undefined;
  /** the expected round-trip steps of the random walk — the
   * component volume times the resistance */
  commuteTime(a: Collection, b: Collection): number | undefined;
}

/**
 * The shifted dense system both executors invert: B = L + J-blocks
 * over the deduped undirected conductances, plus the component id and
 * volume arrays the accessors read.
 *
 * @param view — the subgraph view
 * @param options — the caller's options (weight)
 * @returns the row-major B, per-node component ids, and per-component
 *   volumes (Σ weighted degrees)
 * @throws if the weight function answers a non-positive or
 *   non-finite number for any edge
 */
export const buildResistanceSystem = (
  view: SubgraphView,
  options: EffectiveResistanceOptions,
): { b: Float64Array; comp: Int32Array; volumes: Float64Array } => {
  const { endpoints, index, cy } = view;
  const weight = options.weight;
  const n = view.nodeSlots.length;
  const b = new Float64Array(n * n);
  const parent = new Int32Array(n);

  for (let i = 0; i < n; i++) {
    parent[i] = i;
  }

  const find = (i: number): number => {
    let root = i;

    while (parent[root] !== root) {
      root = parent[root];
    }

    while (parent[i] !== root) {
      const next = parent[i];

      parent[i] = root;
      i = next;
    }

    return root;
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

    const w = weight == null ? 1 : weight(cy._ele(GROUP_EDGES, e));

    if (!(w > 0) || !Number.isFinite(w)) {
      throw new TypeError(
        'effectiveResistance needs positive finite edge weights ' +
          `(conductances) — \`weight\` answered ${String(w)}`,
      );
    }

    // the weighted Laplacian: degrees on the diagonal, −w off it
    b[s * n + s] += w;
    b[t * n + t] += w;
    b[s * n + t] -= w;
    b[t * n + s] -= w;
    parent[find(s)] = find(t);
  }

  // dense component ids, then the J/n_c shift per block and the
  // component volumes (Σ weighted degrees = 2·Σ conductances)
  const comp = new Int32Array(n);
  const sizes: number[] = [];
  const roots = new Map<number, number>();

  for (let i = 0; i < n; i++) {
    const root = find(i);
    let id = roots.get(root);

    if (id == null) {
      id = sizes.length;
      roots.set(root, id);
      sizes.push(0);
    }

    comp[i] = id;
    sizes[id]++;
  }

  const volumes = new Float64Array(sizes.length);

  for (let i = 0; i < n; i++) {
    volumes[comp[i]] += b[i * n + i];

    for (let j = 0; j < n; j++) {
      if (comp[i] === comp[j]) {
        b[i * n + j] += 1 / sizes[comp[i]];
      }
    }
  }

  return { b, comp, volumes };
};

/**
 * Wrap an inverted system as the public accessors — shared by both
 * executors.  Resistances are entry differences of B⁻¹ (the J-shift
 * cancels out of them), clamped at zero against f32 round-off.
 *
 * @param view — the subgraph view the system was built from
 * @param inv — the row-major B⁻¹
 * @param comp — per-node component ids
 * @param volumes — per-component volumes
 * @returns the result object
 */
export const resistanceResultFrom = (
  view: SubgraphView,
  inv: ArrayLike<number>,
  comp: Int32Array,
  volumes: Float64Array,
): EffectiveResistanceResult => {
  const n = comp.length;

  const denseOf = (node: Collection, name: string): number | undefined => {
    const slot = firstNodeSlot(view, node, name);

    return slot == null ? undefined : view.index.get(slot);
  };

  const resistanceAt = (i: number, j: number): number => {
    if (comp[i] !== comp[j]) {
      return Infinity;
    }

    return Math.max(0, inv[i * n + i] + inv[j * n + j] - 2 * inv[i * n + j]);
  };

  return {
    resistance(a: Collection, b: Collection): number | undefined {
      const i = denseOf(a, 'a');
      const j = denseOf(b, 'b');

      return i == null || j == null ? undefined : resistanceAt(i, j);
    },

    commuteTime(a: Collection, b: Collection): number | undefined {
      const i = denseOf(a, 'a');
      const j = denseOf(b, 'b');

      if (i == null || j == null) {
        return undefined;
      }

      const r = resistanceAt(i, j);

      return r === Infinity ? Infinity : volumes[comp[i]] * r;
    },
  };
};

/**
 * The async entry point behind `eles.effectiveResistance()`:
 * validates `executor` synchronously, then routes to the CPU
 * reference (dense f64 elimination) or the WGSL Newton–Schulz
 * iteration.  Both are O(n³), so unlike the density-gated families
 * 'auto' takes the GPU on size alone.
 *
 * @param coll — the calling collection
 * @param options — `{ weight, executor }`
 * @returns a promise of the `{ resistance, commuteTime }` accessors
 * @throws if `executor` is invalid; rejects if an edge weight is not
 *   positive
 */
export const effectiveResistanceAsync = (
  coll: Collection,
  options: EffectiveResistanceOptions = {},
): AlgoRun<EffectiveResistanceResult> => {
  const executor = resolveExecutor(options.executor);
  const view = subgraph(coll);
  const n = view.nodeSlots.length;

  const lane = resistanceLane(view, options);

  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => inThread(lane),
    (ctx) => effectiveResistanceGpu(ctx, view, options),
    undefined,
    null,
    lane,
  );
};

/**
 * Effective resistance's offload lane (129.1): the snapshot built here — every
 * closure evaluated on this thread — the maths as `resistanceKernel`
 * (`algo-kernels.mts`), run in this thread under `'cpu'` and on one
 * pool worker under `'auto'` / `'workers'`, and the public result over
 * whichever answered.  One function on both sides, so the two agree
 * bit for bit.
 *
 * @param view — the subgraph view
 * @param options — the caller's options
 * @returns the lane
 * @throws if an edge weight is not positive (at the snapshot)
 */
export const resistanceLane = (
  view: SubgraphView,
  options: EffectiveResistanceOptions = {},
): OffloadLane<EffectiveResistanceResult> => {
  let built: ReturnType<typeof buildResistanceSystem> | null = null;

  return {
    minN: RESISTANCE_OFFLOAD_MIN_N,
    snapshot: () => {
      built = buildResistanceSystem(view, options);

      return {
        kind: 'kernel',
        name: 'resistance',
        input: { n: view.nodeSlots.length, b: built.b },
      };
    },
    wrap: (out) => {
      const { comp, volumes } = built as ReturnType<
        typeof buildResistanceSystem
      >;

      return resistanceResultFrom(view, out.inv as Float64Array, comp, volumes);
    },
  };
};

/**
 * Invert a dense row-major matrix in place by Gauss–Jordan
 * elimination with partial pivoting — the O(n³) f64 reference the
 * GPU's f32 iteration is judged against.
 *
 * @param n — the matrix edge
 * @param a — overwritten with its inverse
 */
export const invertDense = (n: number, a: Float64Array): void => {
  // the elimination is `resistanceKernel` (`algo-kernels.mts`) since
  // 129.1 — the one function the in-thread reference and the offload
  // lane run; this is its in-place spelling
  resistanceKernel({ n, b: a });
};

/**
 * The CPU reference: build B, invert it by elimination, wrap the
 * accessors.
 *
 * @param view — the subgraph view
 * @param options — the caller's options
 * @returns the `{ resistance, commuteTime }` accessors
 * @throws if an edge weight is not positive
 */
export const effectiveResistance = (
  view: SubgraphView,
  options: EffectiveResistanceOptions = {},
): EffectiveResistanceResult => inThread(resistanceLane(view, options));

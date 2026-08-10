import type { Collection } from '../collection.mjs';
import { subgraph, firstNodeSlot, weightAt, NodeHeap } from './algo-shared.mjs';
import type { WeightFn } from './algo-shared.mjs';
import { GPU_MIN_N, resolveExecutor, runAlgo } from './executor.mjs';
import type { AlgoExecutor } from './executor.mjs';
import { betweennessCentralityGpu } from './algo-gpu-brandes.mjs';

export interface BetweennessCentralityOptions {
  weight?: WeightFn | null;
  directed?: boolean;
  /** where the run executes; see `AlgoExecutor` (default 'auto').
   * Weighted runs have no GPU path: 'auto' quietly uses the CPU and an
   * explicit 'gpu' rejects. */
  executor?: AlgoExecutor;
}

export interface BetweennessCentralityResult {
  betweenness(node: Collection): number | undefined;
  betweennessNormalized(node: Collection): number;
  betweennessNormalised(node: Collection): number;
}

/**
 * The async betweenness entry point behind `eles.betweennessCentrality()`:
 * validates `executor` synchronously, then routes to the CPU reference
 * implementation or, in a later round, the WGSL kernels.  Weighted runs
 * (a `weight` fn given) have no GPU formulation here — Brandes over
 * weights needs a priority queue — so they always run on the CPU, and
 * an explicit `executor: 'gpu'` rejects rather than silently degrading.
 *
 * @param coll — the calling collection
 * @param options — as `betweennessCentrality`, plus `executor`
 * @returns a promise of the betweenness accessors
 * @throws if `executor` is not 'cpu', 'gpu' or 'auto'
 */
export const betweennessCentralityAsync = (
  coll: Collection,
  options: BetweennessCentralityOptions = {},
): Promise<BetweennessCentralityResult> => {
  const executor = resolveExecutor(options.executor);
  const n = subgraph(coll).nodeSlots.length;

  return runAlgo(
    executor,
    n,
    GPU_MIN_N,
    () => betweennessCentrality(coll, options),
    options.weight == null
      ? (ctx) => betweennessCentralityGpu(ctx, coll, options)
      : null,
    options.weight != null
      ? 'weighted betweennessCentrality has no GPU path — ' +
          "use executor 'cpu' or 'auto'"
      : undefined,
  );
};

/**
 * Build the deduped dense-index neighbor lists (plus one
 * representative edge slot per pair, for weights) both executors
 * traverse.  Directed: out-neighbors only; undirected: both sides.
 *
 * @param view — the subgraph view
 * @param directed — the traversal mode
 * @returns per-node neighbor and representative-edge lists
 */
export const buildBrandesNeighbors = (
  view: ReturnType<typeof subgraph>,
  directed: boolean,
): { neighbors: number[][]; neighborEdge: number[][] } => {
  const { store, endpoints, index, nodeSlots, edgeIn } = view;
  const n = nodeSlots.length;

  // deduped neighbor lists (dense indices) + one representative edge slot per pair
  const neighbors: number[][] = new Array(n);
  const neighborEdge: number[][] = new Array(n);

  for (let v = 0; v < n; v++) {
    const vSlot = nodeSlots[v];
    const seen = new Map<number, number>(); // dense neighbor -> list position
    const list: number[] = [];
    const eList: number[] = [];

    const consider = (
      e: number,
      otherSlot: number,
      isForward: boolean,
    ): void => {
      if (otherSlot === vSlot || !edgeIn.has(e)) {
        return;
      } // loops never traverse

      const w = index.get(otherSlot);

      if (w == null) {
        return;
      }

      const at = seen.get(w);

      if (at == null) {
        seen.set(w, list.length);
        list.push(w);
        eList.push(e);
      } else if (isForward && endpoints[eList[at] * 2] !== vSlot) {
        // prefer the first forward (v→w) edge over a backward one, as v3's
        // edgesTo(v, w)[0] does
        eList[at] = e;
      }
    };

    const out = store.adj.outEdges(vSlot);

    for (let i = 0; i < out.length; i++) {
      consider(out[i], endpoints[out[i] * 2 + 1], true);
    }

    if (!directed) {
      const inn = store.adj.inEdges(vSlot);

      for (let i = 0; i < inn.length; i++) {
        consider(inn[i], endpoints[inn[i] * 2], false);
      }
    }

    neighbors[v] = list;
    neighborEdge[v] = eList;
  }

  return { neighbors, neighborEdge };
};

/**
 * Wrap accumulated betweenness scores as the public accessors — shared
 * by both executors.
 *
 * @param view — the subgraph view
 * @param C — per-dense-index betweenness
 * @param max — the maximum score, for normalization
 * @returns the result object
 */
export const bcResultFrom = (
  view: ReturnType<typeof subgraph>,
  C: ArrayLike<number>,
  max: number,
): BetweennessCentralityResult => {
  const denseOf = (node: Collection): number | undefined => {
    const slot = firstNodeSlot(view, node, 'node');

    return slot == null ? undefined : view.index.get(slot);
  };

  const ret: BetweennessCentralityResult = {
    betweenness(node: Collection): number | undefined {
      const i = denseOf(node);

      return i == null ? undefined : C[i];
    },

    betweennessNormalized(node: Collection): number {
      if (max === 0) {
        return 0;
      }

      const i = denseOf(node);

      return i == null ? 0 : C[i] / max;
    },

    betweennessNormalised(node: Collection): number {
      return ret.betweennessNormalized(node);
    },
  };

  return ret;
};

/**
 * Brandes' betweenness centrality over the calling collection.  Neighbor
 * sets dedupe parallel edges; when weighted, the first subgraph edge between
 * the pair (v→w, else w→v) supplies the weight, as in v3.
 */
export const betweennessCentrality = (
  coll: Collection,
  options: BetweennessCentralityOptions = {},
): BetweennessCentralityResult => {
  const view = subgraph(coll);
  const { nodeSlots } = view;
  const directed = options.directed === true;
  const weighted = options.weight != null;
  const weightOf = weightAt(view, options.weight ?? undefined);
  const n = nodeSlots.length;

  const { neighbors, neighborEdge } = buildBrandesNeighbors(view, directed);

  const C = new Float64Array(n);
  let max = 0;

  const d = new Float64Array(n);
  const g = new Float64Array(n); // sigma: shortest-path counts
  const e = new Float64Array(n); // dependency accumulator
  const P: number[][] = new Array(n); // predecessor lists

  for (let s = 0; s < n; s++) {
    const S: number[] = []; // nodes in non-decreasing distance order

    d.fill(Infinity);
    g.fill(0);
    e.fill(0);

    for (let i = 0; i < n; i++) {
      P[i] = [];
    }

    g[s] = 1;
    d[s] = 0;

    const Q = new NodeHeap(n, d);

    Q.push(s);

    const settled = new Uint8Array(n);

    while (Q.size > 0) {
      const v = Q.pop();

      settled[v] = 1;
      S.push(v);

      const vNeighbors = neighbors[v];

      for (let j = 0; j < vNeighbors.length; j++) {
        const w = vNeighbors[j];
        const step = weighted ? weightOf(neighborEdge[v][j]) : 1;

        if (!settled[w] && d[v] + step < d[w]) {
          d[w] = d[v] + step;

          if (Q.has(w)) {
            Q.update(w);
          } else {
            Q.push(w);
          }

          g[w] = 0;
          P[w] = [];
        }

        if (d[w] === d[v] + step) {
          g[w] += g[v];
          P[w].push(v);
        }
      }
    }

    for (let i = S.length - 1; i >= 0; i--) {
      const w = S[i];
      const pw = P[w];

      for (let j = 0; j < pw.length; j++) {
        const v = pw[j];

        e[v] += (g[v] / g[w]) * (1 + e[w]);
      }

      if (w !== s) {
        C[w] += e[w];

        if (C[w] > max) {
          max = C[w];
        }
      }
    }
  }

  return bcResultFrom(view, C, max);
};

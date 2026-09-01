/*
The flow layout's ordering (round 112.2): dummy-chain normalization
and crossing minimization by bidirectional layer sweep.

An edge spanning more than one rank is broken into a chain of
unit-span edges through per-rank dummy nodes (ids continue past the
component's real nodes).  Round 112's plan names Eiglsperger segments
as the long-term shape; v1 materializes plain chains — linear in
span, which every fixture in the quality harness keeps small — and
records the segment container as the measured follow-up (112.4's
trigger is a benchmark showing chain volume matters).

Ordering is the classic sweep: initial order by BFS from the sources
in model order, then alternating down/up passes of barycenter sorting
(median as tie-break, current position as the final tie), a transpose
(adjacent-swap) pass after each sweep, scored by exact weighted
bilayer cross counting (Barth–Jünger–Mutzel 2002: count inversions
with an accumulator tree, O(E log V) per layer pair).  The best-seen
order is kept, and the sweep stops after `IDLE_SWEEPS` sweeps without
improvement or when the `thoroughness` budget runs out.
*/

import type { FlowComponent } from './flow-graph.mjs';

/** The layered, normalized form ordering and coordinates run on. */
export interface Layered {
  /** real node count (ids 0..n-1); dummies are n..nTotal-1 */
  n: number;
  /** total node count including dummies */
  nTotal: number;
  /** rank per node (real and dummy) */
  rank: Int32Array;
  /** layers[r] lists node ids in left-to-right order */
  layers: number[][];
  /** position of each node within its layer */
  pos: Int32Array;
  /** unit-span edges: source per edge (upper endpoint) */
  usrc: Uint32Array;
  /** unit-span edges: target per edge (lower endpoint) */
  utgt: Uint32Array;
  /** unit-span edge weights */
  uweight: Float64Array;
  /** 1 where a unit edge joins two dummies (an inner segment) */
  inner: Uint8Array;
  /** per simple edge: its dummy chain, upper to lower (empty if span 1) */
  chains: Uint32Array[];
  /** up-CSR: unit edges by lower endpoint */
  upOff: Uint32Array;
  upAdj: Uint32Array;
  /** down-CSR: unit edges by upper endpoint */
  downOff: Uint32Array;
  downAdj: Uint32Array;
}

/**
 * Normalize the component: break long edges into unit-span chains and
 * bucket every node (real and dummy) into layers.
 *
 * @param comp — the ranked component
 * @param rank — normalized ranks (0-based)
 * @param rankCount — number of ranks
 * @returns the layered form, with layers in model order (pre-sweep)
 */
export const buildLayers = (
  comp: FlowComponent,
  rank: Int32Array,
  rankCount: number,
): Layered => {
  const { n, m, src, tgt, weight } = comp;

  let nTotal = n;
  const usrc: number[] = [];
  const utgt: number[] = [];
  const uweight: number[] = [];
  const inner: number[] = [];
  const chains: Uint32Array[] = [];
  const fullRank: number[] = Array.from(rank);

  for (let e = 0; e < m; e++) {
    const span = rank[tgt[e]] - rank[src[e]];
    const chain: number[] = [];
    let prev = src[e];

    for (let r = rank[src[e]] + 1; r < rank[tgt[e]]; r++) {
      const d = nTotal++;

      fullRank.push(r);
      chain.push(d);
      usrc.push(prev);
      utgt.push(d);
      uweight.push(weight[e]);
      inner.push(prev >= n ? 1 : 0);
      prev = d;
    }

    usrc.push(prev);
    utgt.push(tgt[e]);
    uweight.push(weight[e]);
    inner.push(0);
    chains.push(Uint32Array.from(chain));

    if (span <= 0) {
      // ranking guarantees positive span; a zero-span edge here is a
      // defect upstream, not an input condition
      throw new Error(`The flow layout found a non-positive edge span`);
    }
  }

  const rankArr = Int32Array.from(fullRank);
  const layers: number[][] = Array.from({ length: rankCount }, () => []);
  const pos = new Int32Array(nTotal);

  for (let v = 0; v < nTotal; v++) {
    pos[v] = layers[rankArr[v]].length;
    layers[rankArr[v]].push(v);
  }

  // unit-edge CSRs
  const mu = usrc.length;
  const upOff = new Uint32Array(nTotal + 1);
  const downOff = new Uint32Array(nTotal + 1);

  for (let e = 0; e < mu; e++) {
    downOff[usrc[e] + 1]++;
    upOff[utgt[e] + 1]++;
  }

  for (let v = 0; v < nTotal; v++) {
    downOff[v + 1] += downOff[v];
    upOff[v + 1] += upOff[v];
  }

  const downAdj = new Uint32Array(mu);
  const upAdj = new Uint32Array(mu);
  const dc = downOff.slice(0, nTotal);
  const uc = upOff.slice(0, nTotal);

  for (let e = 0; e < mu; e++) {
    downAdj[dc[usrc[e]]++] = e;
    upAdj[uc[utgt[e]]++] = e;
  }

  return {
    n,
    nTotal,
    rank: rankArr,
    layers,
    pos,
    usrc: Uint32Array.from(usrc),
    utgt: Uint32Array.from(utgt),
    uweight: Float64Array.from(uweight),
    inner: Uint8Array.from(inner),
    chains,
    upOff,
    upAdj,
    downOff,
    downAdj,
  };
};

/**
 * Weighted bilayer cross count between ranks r-1 and r
 * (Barth–Jünger–Mutzel): edges sorted by (upper pos, lower pos), then
 * inversions of the lower sequence accumulate weight products in a
 * Fenwick tree.
 *
 * @param L — the layered form (positions current)
 * @param r — the lower rank of the pair (r ≥ 1)
 * @returns the weighted crossing count between ranks r-1 and r
 */
export const countBilayer = (L: Layered, r: number): number => {
  const lower = L.layers[r];
  const es: number[] = [];

  for (const v of lower) {
    for (let i = L.upOff[v]; i < L.upOff[v + 1]; i++) {
      es.push(L.upAdj[i]);
    }
  }

  if (es.length < 2) {
    return 0;
  }

  es.sort(
    (a, b) =>
      L.pos[L.usrc[a]] - L.pos[L.usrc[b]] ||
      L.pos[L.utgt[a]] - L.pos[L.utgt[b]],
  );

  const width = lower.length;
  const tree = new Float64Array(width + 1);
  let total = 0;
  let sumAll = 0;

  for (const e of es) {
    const p = L.pos[L.utgt[e]];
    const w = L.uweight[e];

    // weight already inserted at positions > p
    let below = 0;

    for (let i = p + 1; i > 0; i -= i & -i) {
      below += tree[i];
    }

    total += w * (sumAll - below);

    for (let i = p + 1; i <= width; i += i & -i) {
      tree[i] += w;
    }

    sumAll += w;
  }

  return total;
};

/**
 * Total weighted crossings over all adjacent layer pairs.
 *
 * @param L — the layered form
 * @returns the sum of `countBilayer` over every pair
 */
export const countTotalCrossings = (L: Layered): number => {
  let total = 0;

  for (let r = 1; r < L.layers.length; r++) {
    total += countBilayer(L, r);
  }

  return total;
};

/** Re-derive pos[] from the layer arrays. */
const refreshPos = (L: Layered): void => {
  for (const layer of L.layers) {
    for (let i = 0; i < layer.length; i++) {
      L.pos[layer[i]] = i;
    }
  }
};

/** Barycenter sort of one layer against fixed neighbour positions. */
const sortLayer = (
  L: Layered,
  r: number,
  useUp: boolean,
  bary: Float64Array,
  median: Float64Array,
): void => {
  const layer = L.layers[r];
  const off = useUp ? L.upOff : L.downOff;
  const adj = useUp ? L.upAdj : L.downAdj;
  const otherEnd = useUp ? L.usrc : L.utgt;
  const neighbours: number[] = [];

  for (const v of layer) {
    let sum = 0;
    let count = 0;

    neighbours.length = 0;

    for (let i = off[v]; i < off[v + 1]; i++) {
      const u = otherEnd[adj[i]];

      sum += L.pos[u];
      count++;
      neighbours.push(L.pos[u]);
    }

    if (count === 0) {
      // no neighbours on that side: hold position (bary = own pos)
      bary[v] = L.pos[v];
      median[v] = L.pos[v];
    } else {
      bary[v] = sum / count;
      neighbours.sort((a, b) => a - b);
      median[v] = neighbours[(neighbours.length - 1) >> 1];
    }
  }

  layer.sort(
    (a, b) => bary[a] - bary[b] || median[a] - median[b] || L.pos[a] - L.pos[b],
  );

  for (let i = 0; i < layer.length; i++) {
    L.pos[layer[i]] = i;
  }
};

/** Crossings contributed by the ordered pair (v, w) on one side. */
const pairCrossings = (
  L: Layered,
  v: number,
  w: number,
  useUp: boolean,
): number => {
  const off = useUp ? L.upOff : L.downOff;
  const adj = useUp ? L.upAdj : L.downAdj;
  const otherEnd = useUp ? L.usrc : L.utgt;
  let count = 0;

  for (let i = off[v]; i < off[v + 1]; i++) {
    const pv = L.pos[otherEnd[adj[i]]];
    const wv = L.uweight[adj[i]];

    for (let j = off[w]; j < off[w + 1]; j++) {
      const pw = L.pos[otherEnd[adj[j]]];

      if (pv > pw) {
        count += wv * L.uweight[adj[j]];
      }
    }
  }

  return count;
};

/** One transpose pass: adjacent swaps that reduce crossings, in place. */
const transpose = (L: Layered): boolean => {
  let improved = false;

  for (let r = 0; r < L.layers.length; r++) {
    const layer = L.layers[r];

    for (let i = 0; i + 1 < layer.length; i++) {
      const v = layer[i];
      const w = layer[i + 1];
      const before =
        pairCrossings(L, v, w, true) + pairCrossings(L, v, w, false);
      const after =
        pairCrossings(L, w, v, true) + pairCrossings(L, w, v, false);

      if (after < before - 1e-9) {
        layer[i] = w;
        layer[i + 1] = v;
        L.pos[w] = i;
        L.pos[v] = i + 1;
        improved = true;
      }
    }
  }

  return improved;
};

/** Initial order: BFS layers from the top, parents' order propagating. */
const initOrder = (L: Layered): void => {
  // model order within rank 0; each later rank ordered by mean parent
  // position, model order as the tie — one down pass of the sweep's
  // own comparator, cheap and deterministic
  const bary = new Float64Array(L.nTotal);
  const median = new Float64Array(L.nTotal);

  for (let r = 1; r < L.layers.length; r++) {
    sortLayer(L, r, true, bary, median);
  }
};

/** How many sweeps a thoroughness step buys. */
const sweepsFor = (thoroughness: number): number => 4 + 2 * thoroughness;

const IDLE_SWEEPS = 3;

/**
 * Crossing minimization: bidirectional barycenter sweeps with
 * transpose, best order kept by exact weighted count.
 *
 * @param L — the layered form; `layers`/`pos` are reordered in place
 * @param thoroughness — the effort dial (1..10): sweep budget
 *   `4 + 2·thoroughness`, early-out after 3 idle sweeps
 */
export const orderLayers = (L: Layered, thoroughness: number): void => {
  if (L.layers.length < 2) {
    return;
  }

  initOrder(L);
  transpose(L);

  let best = countTotalCrossings(L);
  let bestLayers = L.layers.map((l) => l.slice());
  let idle = 0;
  const sweeps = sweepsFor(thoroughness);
  const bary = new Float64Array(L.nTotal);
  const median = new Float64Array(L.nTotal);

  for (let s = 0; s < sweeps && best > 0; s++) {
    if (s % 2 === 0) {
      for (let r = 1; r < L.layers.length; r++) {
        sortLayer(L, r, true, bary, median);
      }
    } else {
      for (let r = L.layers.length - 2; r >= 0; r--) {
        sortLayer(L, r, false, bary, median);
      }
    }

    for (let t = 0; t < 4 && transpose(L); t++) {
      // greedy local swaps until stable, bounded
    }

    const count = countTotalCrossings(L);

    if (count < best - 1e-9) {
      best = count;
      bestLayers = L.layers.map((l) => l.slice());
      idle = 0;
    } else if (++idle >= IDLE_SWEEPS) {
      break;
    }
  }

  L.layers = bestLayers;
  refreshPos(L);
};

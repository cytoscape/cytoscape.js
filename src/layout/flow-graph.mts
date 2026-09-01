/*
The flow layout's internal graph (round 112.2): a compact, typed-array
view of the layout scope, split into weakly connected components, with
cycle removal.

The scope's node slots (unlocked leaves, `cy.nodes()` order) are
reindexed 0..n-1; scoped edges whose endpoints both survive the filter
become *simple* weighted edges — parallel edges collapse (weights sum,
min-lengths take the max) and self-loops drop, both restored by the
renderer's own edge machinery rather than by the layout.  Everything
downstream (ranking, ordering, coordinates) runs per component on
`FlowComponent`, whose node ids are component-local.

Cycle removal is Eades–Lin–Smyth's greedy FAS (1993) — O(V+E) with
bucket lists over outDeg−inDeg, reversing at most m/2 − n/6 arcs —
with ties broken by model (insertion) order so runs are deterministic.
A `dfs` variant (Graphviz/dagre's classic) is kept for callers that
want input order to dominate which arcs flip.  Reversal happens in
place: `src`/`tgt` swap and `reversed` records it, so the layout can
report direction-honest coordinates while the drawing still flows one
way.
*/

import { computeComponents } from './pack.mjs';

/** One weakly connected component of the scope, compact ids 0..n-1. */
export interface FlowComponent {
  /** node count */
  n: number;
  /** simple (collapsed) edge count */
  m: number;
  /** per-edge source, component-local (post-FAS orientation) */
  src: Uint32Array;
  /** per-edge target, component-local (post-FAS orientation) */
  tgt: Uint32Array;
  /** per-edge weight (collapsed multiplicity × edgeWeight) */
  weight: Float64Array;
  /** per-edge minimum rank span */
  minLen: Int32Array;
  /** 1 where FAS reversed the edge */
  reversed: Uint8Array;
  /** CSR: out-edge index offsets per node (length n+1) */
  outOff: Uint32Array;
  /** CSR: edge indices, grouped by source */
  outAdj: Uint32Array;
  /** CSR: in-edge index offsets per node (length n+1) */
  inOff: Uint32Array;
  /** CSR: edge indices, grouped by target */
  inAdj: Uint32Array;
  /** component-local node -> scope node index */
  scopeOf: Uint32Array;
  /** per-node half width (body + border) */
  halfW: Float64Array;
  /** per-node half height (body + border) */
  halfH: Float64Array;
}

/** The whole scope as simple edges over scope-node indices. */
export interface FlowScope {
  n: number;
  /** simple edges: scope-index pairs */
  src: Uint32Array;
  tgt: Uint32Array;
  weight: Float64Array;
  minLen: Int32Array;
  halfW: Float64Array;
  halfH: Float64Array;
  /** for each simple edge, the scoped edge slots it collapses */
  members: number[][];
}

/**
 * Collapse the scope's raw edges into simple weighted edges over the
 * given node indexing.
 *
 * @param n — scope node count
 * @param rawPairs — flat [src, tgt] scope-index pairs, one per scoped
 *   edge (self-loops included; they are dropped here)
 * @param rawSlots — the scoped edge slot per pair, for membership
 * @param rawWeight — per raw edge weight (resolved edgeWeight)
 * @param rawMinLen — per raw edge minimum rank span (resolved minLength)
 * @param halfW — per scope node half width
 * @param halfH — per scope node half height
 * @returns the simple-edge scope view
 */
export const buildScope = (
  n: number,
  rawPairs: Uint32Array,
  rawSlots: number[],
  rawWeight: Float64Array,
  rawMinLen: Int32Array,
  halfW: Float64Array,
  halfH: Float64Array,
): FlowScope => {
  const byPair = new Map<number, number>();
  const src: number[] = [];
  const tgt: number[] = [];
  const weight: number[] = [];
  const minLen: number[] = [];
  const members: number[][] = [];

  const mRaw = rawPairs.length / 2;

  for (let e = 0; e < mRaw; e++) {
    const s = rawPairs[e * 2];
    const t = rawPairs[e * 2 + 1];

    if (s === t) {
      continue; // self-loops play no part in layering
    }

    // undirected pair key: parallel and anti-parallel edges collapse
    // into one simple edge (the anti-parallel one keeps first-seen
    // direction; a 2-cycle would otherwise defeat every ranker)
    const key = s < t ? s * n + t : t * n + s;
    const at = byPair.get(key);

    if (at == null) {
      byPair.set(key, src.length);
      src.push(s);
      tgt.push(t);
      weight.push(rawWeight[e]);
      minLen.push(rawMinLen[e]);
      members.push([rawSlots[e]]);
    } else {
      weight[at] += rawWeight[e];
      minLen[at] = Math.max(minLen[at], rawMinLen[e]);
      members[at].push(rawSlots[e]);
    }
  }

  return {
    n,
    src: Uint32Array.from(src),
    tgt: Uint32Array.from(tgt),
    weight: Float64Array.from(weight),
    minLen: Int32Array.from(minLen),
    halfW,
    halfH,
    members,
  };
};

/** Build a component's CSR indices from its edge arrays (in place). */
const buildCsr = (comp: FlowComponent): void => {
  const { n, m, src, tgt } = comp;
  const outOff = new Uint32Array(n + 1);
  const inOff = new Uint32Array(n + 1);

  for (let e = 0; e < m; e++) {
    outOff[src[e] + 1]++;
    inOff[tgt[e] + 1]++;
  }

  for (let i = 0; i < n; i++) {
    outOff[i + 1] += outOff[i];
    inOff[i + 1] += inOff[i];
  }

  const outAdj = new Uint32Array(m);
  const inAdj = new Uint32Array(m);
  const outCursor = outOff.slice(0, n);
  const inCursor = inOff.slice(0, n);

  for (let e = 0; e < m; e++) {
    outAdj[outCursor[src[e]]++] = e;
    inAdj[inCursor[tgt[e]]++] = e;
  }

  comp.outOff = outOff;
  comp.outAdj = outAdj;
  comp.inOff = inOff;
  comp.inAdj = inAdj;
};

/**
 * Split the scope into weakly connected components with compact local
 * ids, preserving scope order within each component (determinism: the
 * i-th component is the one whose first node appears i-th in scope
 * order).
 *
 * @param scope — the simple-edge scope view
 * @param weldPairs — extra scope-index pairs that weld components
 *   together without adding edges (rank-constraint `same` groups whose
 *   members would otherwise land in different components)
 * @returns one FlowComponent per weak component, each edge's position
 *   in the scope edge list (for members lookups), and the component
 *   assignment per scope node
 */
export const splitComponents = (
  scope: FlowScope,
  weldPairs: number[] = [],
): {
  comps: FlowComponent[];
  scopeEdgeOf: Uint32Array[];
  compOf: Int32Array;
} => {
  const m = scope.src.length;
  const pairs = new Uint32Array(m * 2 + weldPairs.length);

  for (let e = 0; e < m; e++) {
    pairs[e * 2] = scope.src[e];
    pairs[e * 2 + 1] = scope.tgt[e];
  }

  pairs.set(weldPairs, m * 2);

  const { compOf, count } = computeComponents(scope.n, pairs);

  const localOf = new Uint32Array(scope.n);
  const counts = new Uint32Array(count);
  const edgeCounts = new Uint32Array(count);

  for (let i = 0; i < scope.n; i++) {
    localOf[i] = counts[compOf[i]]++;
  }

  for (let e = 0; e < m; e++) {
    edgeCounts[compOf[scope.src[e]]]++;
  }

  const comps: FlowComponent[] = [];
  const scopeEdgeOf: Uint32Array[] = [];

  for (let c = 0; c < count; c++) {
    const n = counts[c];
    const mc = edgeCounts[c];

    comps.push({
      n,
      m: mc,
      src: new Uint32Array(mc),
      tgt: new Uint32Array(mc),
      weight: new Float64Array(mc),
      minLen: new Int32Array(mc),
      reversed: new Uint8Array(mc),
      outOff: new Uint32Array(0),
      outAdj: new Uint32Array(0),
      inOff: new Uint32Array(0),
      inAdj: new Uint32Array(0),
      scopeOf: new Uint32Array(n),
      halfW: new Float64Array(n),
      halfH: new Float64Array(n),
    });
    scopeEdgeOf.push(new Uint32Array(mc));
  }

  for (let i = 0; i < scope.n; i++) {
    const comp = comps[compOf[i]];
    const local = localOf[i];

    comp.scopeOf[local] = i;
    comp.halfW[local] = scope.halfW[i];
    comp.halfH[local] = scope.halfH[i];
  }

  const cursor = new Uint32Array(count);

  for (let e = 0; e < m; e++) {
    const c = compOf[scope.src[e]];
    const comp = comps[c];
    const at = cursor[c]++;

    comp.src[at] = localOf[scope.src[e]];
    comp.tgt[at] = localOf[scope.tgt[e]];
    comp.weight[at] = scope.weight[e];
    comp.minLen[at] = scope.minLen[e];
    scopeEdgeOf[c][at] = e;
  }

  for (const comp of comps) {
    buildCsr(comp);
  }

  return { comps, scopeEdgeOf, compOf };
};

/** Reverse edge e in place (swap endpoints, flag it). */
const reverse = (comp: FlowComponent, e: number): void => {
  const s = comp.src[e];

  comp.src[e] = comp.tgt[e];
  comp.tgt[e] = s;
  comp.reversed[e] ^= 1;
};

/**
 * Greedy feedback arc set (Eades–Lin–Smyth 1993) with bucket lists:
 * repeatedly emit sinks (to the right), sources (to the left), else
 * the node maximizing outDeg − inDeg; edges from right of the
 * sequence to its left are the FAS and get reversed in place.  Ties
 * break on the smaller local id — model order — so the result is
 * deterministic.  O(V+E).
 *
 * @param comp — the component; `src`/`tgt`/`reversed` are updated in
 *   place and the CSR is rebuilt
 */
export const greedyFAS = (comp: FlowComponent): void => {
  const { n, m, src, tgt } = comp;

  if (m === 0) {
    return;
  }

  const outDeg = new Int32Array(n);
  const inDeg = new Int32Array(n);

  for (let e = 0; e < m; e++) {
    outDeg[src[e]]++;
    inDeg[tgt[e]]++;
  }

  // buckets over delta = outDeg - inDeg in [-(n-1), n-1]; sources and
  // sinks get dedicated treatment via the scan order below
  const removed = new Uint8Array(n);
  const seqOf = new Int32Array(n); // position in the vertex sequence
  let left = 0;
  let right = n - 1;

  // doubly linked bucket lists
  const bucketCount = 2 * n + 1; // delta + n in [1, 2n-1]; 0 = unused
  const head = new Int32Array(bucketCount).fill(-1);
  const next = new Int32Array(n).fill(-1);
  const prev = new Int32Array(n).fill(-1);
  const bucketOf = new Int32Array(n).fill(-1);

  const bucketFor = (v: number): number => {
    if (removed[v]) {
      return -1;
    }

    if (outDeg[v] === 0) {
      return 0; // sinks first
    }

    if (inDeg[v] === 0) {
      return bucketCount - 1; // sources next
    }

    return outDeg[v] - inDeg[v] + n;
  };

  const detach = (v: number): void => {
    const b = bucketOf[v];

    if (b < 0) {
      return;
    }

    if (prev[v] >= 0) {
      next[prev[v]] = next[v];
    } else {
      head[b] = next[v];
    }

    if (next[v] >= 0) {
      prev[next[v]] = prev[v];
    }

    next[v] = prev[v] = -1;
    bucketOf[v] = -1;
  };

  const attach = (v: number): void => {
    const b = bucketFor(v);

    if (b < 0) {
      return;
    }

    // push-front; ties then resolve by preferring the smallest id via
    // the pick scan below
    next[v] = head[b];

    if (head[b] >= 0) {
      prev[head[b]] = v;
    }

    prev[v] = -1;
    head[b] = v;
    bucketOf[v] = b;
  };

  for (let v = 0; v < n; v++) {
    attach(v);
  }

  const dropNode = (v: number, toLeft: boolean): void => {
    removed[v] = 1;
    detach(v);
    seqOf[v] = toLeft ? left++ : right--;

    // relax neighbours
    for (let i = comp.outOff[v]; i < comp.outOff[v + 1]; i++) {
      const w = tgt[comp.outAdj[i]];

      if (!removed[w]) {
        detach(w);
        inDeg[w]--;
        attach(w);
      }
    }

    for (let i = comp.inOff[v]; i < comp.inOff[v + 1]; i++) {
      const w = src[comp.inAdj[i]];

      if (!removed[w]) {
        detach(w);
        outDeg[w]--;
        attach(w);
      }
    }
  };

  let placed = 0;

  while (placed < n) {
    // sinks (bucket 0) go rightmost, sources (top bucket) leftmost,
    // then the max-delta bucket leftmost — scanning top-down finds
    // sources and max delta in one pass
    if (head[0] >= 0) {
      dropNode(head[0], false);
      placed++;
      continue;
    }

    let picked = -1;

    for (let b = bucketCount - 1; b > 0; b--) {
      if (head[b] >= 0) {
        // smallest id in the bucket, for determinism independent of
        // attach order
        let best = head[b];

        for (let v = next[best]; v >= 0; v = next[v]) {
          if (v < best) {
            best = v;
          }
        }

        picked = best;
        break;
      }
    }

    if (picked < 0) {
      break; // all placed
    }

    dropNode(picked, true);
    placed++;
  }

  for (let e = 0; e < m; e++) {
    if (seqOf[src[e]] > seqOf[tgt[e]]) {
      reverse(comp, e);
    }
  }

  buildCsr(comp);
};

/**
 * DFS cycle removal (the Graphviz/dagre classic): depth-first from
 * each unvisited node in model order; back edges reverse.  Keeps input
 * order dominant in which arcs flip, at the cost of the ELS bound.
 *
 * @param comp — the component; edges reverse in place, CSR rebuilt
 */
export const dfsFAS = (comp: FlowComponent): void => {
  const { n, m } = comp;

  if (m === 0) {
    return;
  }

  const state = new Uint8Array(n); // 0 unvisited, 1 on stack, 2 done
  const stack: number[] = [];
  const iter = new Int32Array(n);
  const flip: number[] = [];

  for (let start = 0; start < n; start++) {
    if (state[start] !== 0) {
      continue;
    }

    stack.push(start);
    state[start] = 1;
    iter[start] = comp.outOff[start];

    while (stack.length > 0) {
      const v = stack[stack.length - 1];

      if (iter[v] < comp.outOff[v + 1]) {
        const e = comp.outAdj[iter[v]++];
        const w = comp.tgt[e];

        if (state[w] === 0) {
          state[w] = 1;
          iter[w] = comp.outOff[w];
          stack.push(w);
        } else if (state[w] === 1) {
          flip.push(e); // back edge
        }
      } else {
        state[v] = 2;
        stack.pop();
      }
    }
  }

  for (const e of flip) {
    reverse(comp, e);
  }

  if (flip.length > 0) {
    buildCsr(comp);
  }
};

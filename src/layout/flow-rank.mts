/*
The flow layout's layering (round 112.2): rank assignment per
component, GKNV network simplex by default with longest-path as both
the seed and the large-graph fast path.

Longest-path is the O(V+E) floor: every node as low as its
predecessors force, minimum height, but long edges galore.  Network
simplex (Gansner–Koutsofios–North–Vo, TSE 1993) minimizes
Σ w(e)·(rank(tgt) − rank(src) − minLen(e)) exactly: a spanning tree of
tight edges is repeatedly improved by swapping a tree edge with
negative cut value for the minimum-slack crossing edge, until no
negative cut value remains.

One deviation from the paper's presentation, recorded because it is a
simplification rather than a shortcut: cut values are computed from
**subtree net weights**.  For a tree edge whose removal cuts off
subtree S, every edge internal to S cancels in the cut sum, so
cut(e) = ±Σ_{v∈S}(outW(v) − inW(v)) — one postorder accumulation per
iteration instead of the paper's per-edge incremental bookkeeping.
The iteration is capped (`maxIter`); the seed ranking is feasible at
every step, so a capped run is a valid layering, just not the proven
optimum.

`balance()` is GKNV's post-pass: a node with equal in- and out-weight
moves to the least-occupied rank in its feasible interval, which
spreads rank sizes without changing total edge length.
*/

import type { FlowComponent } from './flow-graph.mjs';

/**
 * Longest-path layering: rank(v) = max over in-edges of
 * rank(src) + minLen.  Requires the component to be acyclic (post-FAS).
 *
 * @param comp — the component
 * @returns per-node ranks, 0-based from the sources
 */
export const rankLongestPath = (comp: FlowComponent): Int32Array => {
  const { n, m, tgt, minLen } = comp;
  const rank = new Int32Array(n);
  const inLeft = new Int32Array(n);

  for (let e = 0; e < m; e++) {
    inLeft[tgt[e]]++;
  }

  // Kahn order; model order among simultaneously-free nodes
  const queue: number[] = [];

  for (let v = 0; v < n; v++) {
    if (inLeft[v] === 0) {
      queue.push(v);
    }
  }

  let qi = 0;

  while (qi < queue.length) {
    const v = queue[qi++];

    for (let i = comp.outOff[v]; i < comp.outOff[v + 1]; i++) {
      const e = comp.outAdj[i];
      const w = tgt[e];

      if (rank[v] + minLen[e] > rank[w]) {
        rank[w] = rank[v] + minLen[e];
      }

      if (--inLeft[w] === 0) {
        queue.push(w);
      }
    }
  }

  if (qi !== n) {
    // a cycle survived FAS — a defect, not an input condition
    throw new Error(`The flow layout's ranking found a residual cycle`);
  }

  return rank;
};

const slackOf = (comp: FlowComponent, rank: Int32Array, e: number): number =>
  rank[comp.tgt[e]] - rank[comp.src[e]] - comp.minLen[e];

/** Tree state rebuilt per simplex iteration. */
interface Tree {
  /** parent node per node (-1 at the root) */
  parent: Int32Array;
  /** the graph edge index connecting a node to its parent (-1 at root) */
  parentEdge: Int32Array;
  /** postorder number per node */
  lim: Int32Array;
  /** min postorder number in the node's subtree */
  low: Int32Array;
  /** postorder node sequence */
  order: Int32Array;
}

/** Root the tree at 0 and compute lim/low by iterative postorder. */
const rootTree = (
  n: number,
  treeAdj: number[][],
  treeEdgeOther: (e: number, v: number) => number,
): Tree => {
  const parent = new Int32Array(n).fill(-1);
  const parentEdge = new Int32Array(n).fill(-1);
  const lim = new Int32Array(n);
  const low = new Int32Array(n);
  const order = new Int32Array(n);
  const stack = [0];
  const iter = new Int32Array(n);
  const visited = new Uint8Array(n);
  let post = 0;

  visited[0] = 1;

  while (stack.length > 0) {
    const v = stack[stack.length - 1];

    if (iter[v] < treeAdj[v].length) {
      const e = treeAdj[v][iter[v]++];
      const w = treeEdgeOther(e, v);

      if (!visited[w]) {
        visited[w] = 1;
        parent[w] = v;
        parentEdge[w] = e;
        stack.push(w);
      }
    } else {
      stack.pop();
      order[post] = v;
      lim[v] = post++;
      low[v] = lim[v];

      for (const e of treeAdj[v]) {
        const w = treeEdgeOther(e, v);

        if (parent[w] === v && low[w] < low[v]) {
          low[v] = low[w];
        }
      }
    }
  }

  return { parent, parentEdge, lim, low, order };
};

/**
 * GKNV network simplex over a feasible seed ranking, in place.
 *
 * @param comp — a connected component (post-FAS)
 * @param rank — a feasible ranking (longest-path); improved in place
 * @param maxIter — the pivot budget; a capped run keeps the last
 *   (still feasible) ranking
 */
export const rankNetworkSimplex = (
  comp: FlowComponent,
  rank: Int32Array,
  maxIter: number,
): void => {
  const { n, m, src, tgt, weight } = comp;

  if (n < 2 || m === 0) {
    return;
  }

  // net weight per node: Σ w(out) − Σ w(in); subtree sums of this give
  // cut values directly (internal edges cancel)
  const netW = new Float64Array(n);

  for (let e = 0; e < m; e++) {
    netW[src[e]] += weight[e];
    netW[tgt[e]] -= weight[e];
  }

  const inTree = new Uint8Array(m);
  const treeAdj: number[][] = Array.from({ length: n }, () => []);
  const other = (e: number, v: number): number =>
    src[e] === v ? tgt[e] : src[e];

  // -- feasible tight tree ------------------------------------------------

  const inTreeNode = new Uint8Array(n);

  const growTight = (): number => {
    // (re)grow the tight forest component containing node 0
    inTreeNode.fill(0);

    for (let v = 0; v < n; v++) {
      treeAdj[v].length = 0;
    }

    let size = 1;

    inTreeNode[0] = 1;

    const stack = [0];

    while (stack.length > 0) {
      const v = stack.pop()!;

      const scan = (eList: Uint32Array, from: number, to: number): void => {
        for (let i = from; i < to; i++) {
          const e = eList[i];

          if (inTree[e]) {
            continue;
          }

          const w = other(e, v);

          if (!inTreeNode[w] && slackOf(comp, rank, e) === 0) {
            inTree[e] = 1;
            treeAdj[v].push(e);
            treeAdj[w].push(e);
            inTreeNode[w] = 1;
            size++;
            stack.push(w);
          }
        }
      };

      scan(comp.outAdj, comp.outOff[v], comp.outOff[v + 1]);
      scan(comp.inAdj, comp.inOff[v], comp.inOff[v + 1]);
    }

    return size;
  };

  inTree.fill(0);

  let treeSize = growTight();

  while (treeSize < n) {
    // minimum-slack edge with exactly one endpoint in the tree
    let bestE = -1;
    let bestSlack = Infinity;

    for (let e = 0; e < m; e++) {
      const sIn = inTreeNode[src[e]] === 1;
      const tIn = inTreeNode[tgt[e]] === 1;

      if (sIn !== tIn) {
        const s = slackOf(comp, rank, e);

        if (s < bestSlack) {
          bestSlack = s;
          bestE = e;
        }
      }
    }

    /* v8 ignore next 3 -- a weak component always has a crossing edge */
    if (bestE < 0) {
      break;
    }

    // shift the tree side so bestE becomes tight
    const delta = inTreeNode[src[bestE]] === 1 ? bestSlack : -bestSlack;

    for (let v = 0; v < n; v++) {
      if (inTreeNode[v] === 1) {
        rank[v] += delta;
      }
    }

    inTree.fill(0);
    treeSize = growTight();
  }

  // tree edges are now a spanning tree; pivot until no negative cut
  const subtreeNet = new Float64Array(n);

  for (let iterN = 0; iterN < maxIter; iterN++) {
    const tree = rootTree(n, treeAdj, other);

    // subtree net sums, postorder (children come before parents)
    for (let i = 0; i < n; i++) {
      const v = tree.order[i];

      subtreeNet[v] = netW[v];

      for (const e of treeAdj[v]) {
        const w = other(e, v);

        if (tree.parent[w] === v) {
          subtreeNet[v] += subtreeNet[w];
        }
      }
    }

    // leave edge: most negative cut value.  For tree edge with child c
    // (subtree S), cut = +subtreeNet(S) when the graph edge points out
    // of S, else −subtreeNet(S).
    let leaveChild = -1;
    let leaveCut = -1e-9;

    for (let c = 0; c < n; c++) {
      const e = tree.parentEdge[c];

      if (e < 0) {
        continue;
      }

      // childIsTail: the graph edge's source lies inside the child's
      // subtree (low/lim containment)
      const sInS =
        tree.low[c] <= tree.lim[src[e]] && tree.lim[src[e]] <= tree.lim[c];
      const value = sInS ? subtreeNet[c] : -subtreeNet[c];

      if (value < leaveCut) {
        leaveCut = value;
        leaveChild = c;
      }
    }

    if (leaveChild < 0) {
      break; // optimal
    }

    const eLeave = tree.parentEdge[leaveChild];
    const lo = tree.low[leaveChild];
    const hi = tree.lim[leaveChild];
    const inS = (v: number): boolean => lo <= tree.lim[v] && tree.lim[v] <= hi;
    const leaveTail = inS(src[eLeave]);

    // enter edge: crosses the cut opposite to eLeave with minimum slack
    let eEnter = -1;
    let enterSlack = Infinity;

    for (let e = 0; e < m; e++) {
      if (inTree[e]) {
        continue;
      }

      const sIn = inS(src[e]);
      const tIn = inS(tgt[e]);

      // opposite direction: into S when the leave edge leaves S, and
      // out of S when it enters it
      if (leaveTail ? !sIn && tIn : sIn && !tIn) {
        const s = slackOf(comp, rank, e);

        if (s < enterSlack) {
          enterSlack = s;
          eEnter = e;
        }
      }
    }

    /* v8 ignore next 3 -- a spanning tree cut always has a crossing edge */
    if (eEnter < 0) {
      break;
    }

    // exchange: shift S so the entering edge becomes tight
    const delta = leaveTail ? -enterSlack : enterSlack;

    if (delta !== 0) {
      for (let v = 0; v < n; v++) {
        if (inS(v)) {
          rank[v] += delta;
        }
      }
    }

    inTree[eLeave] = 0;
    inTree[eEnter] = 1;

    {
      const su = src[eLeave];
      const tu = tgt[eLeave];

      treeAdj[su].splice(treeAdj[su].indexOf(eLeave), 1);
      treeAdj[tu].splice(treeAdj[tu].indexOf(eLeave), 1);
      treeAdj[src[eEnter]].push(eEnter);
      treeAdj[tgt[eEnter]].push(eEnter);
    }
  }
};

/**
 * GKNV's balance pass: a node whose in- and out-weights match moves to
 * the least-occupied rank in its feasible interval.  Total weighted
 * edge length is unchanged; rank occupancy evens out.
 *
 * @param comp — the component
 * @param rank — the ranking, adjusted in place
 */
export const balanceRanks = (comp: FlowComponent, rank: Int32Array): void => {
  const { n, m, src, tgt, weight, minLen } = comp;

  if (n === 0) {
    return;
  }

  let maxRank = 0;

  for (let v = 0; v < n; v++) {
    if (rank[v] > maxRank) {
      maxRank = rank[v];
    }
  }

  const occupancy = new Int32Array(maxRank + 1);

  for (let v = 0; v < n; v++) {
    occupancy[rank[v]]++;
  }

  const inW = new Float64Array(n);
  const outW = new Float64Array(n);

  for (let e = 0; e < m; e++) {
    outW[src[e]] += weight[e];
    inW[tgt[e]] += weight[e];
  }

  for (let v = 0; v < n; v++) {
    if (inW[v] !== outW[v] || (inW[v] === 0 && outW[v] === 0)) {
      continue;
    }

    let lo = 0;
    let hi = maxRank;

    for (let i = comp.inOff[v]; i < comp.inOff[v + 1]; i++) {
      const e = comp.inAdj[i];

      lo = Math.max(lo, rank[src[e]] + minLen[e]);
    }

    for (let i = comp.outOff[v]; i < comp.outOff[v + 1]; i++) {
      const e = comp.outAdj[i];

      hi = Math.min(hi, rank[tgt[e]] - minLen[e]);
    }

    if (hi <= lo) {
      continue;
    }

    let best = rank[v];

    for (let r = lo; r <= hi; r++) {
      if (occupancy[r] < occupancy[best]) {
        best = r;
      }
    }

    if (best !== rank[v]) {
      occupancy[rank[v]]--;
      occupancy[best]++;
      rank[v] = best;
    }
  }
};

/**
 * Shift ranks so the smallest is 0.
 *
 * @param rank — the ranking, shifted in place
 * @returns the rank count (max + 1)
 */
export const normalizeRanks = (rank: Int32Array): number => {
  if (rank.length === 0) {
    return 0;
  }

  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < rank.length; i++) {
    if (rank[i] < min) {
      min = rank[i];
    }

    if (rank[i] > max) {
      max = rank[i];
    }
  }

  for (let i = 0; i < rank.length; i++) {
    rank[i] -= min;
  }

  return max - min + 1;
};

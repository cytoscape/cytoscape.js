/*
The flow layout's coordinate assignment (round 112.2): Brandes–Köpf
with size-aware separation, in four alignments, balanced.

The 2001 algorithm's *vertical alignment* is implemented as published
(median upper/lower neighbours, type-1 conflict marking so ordinary
edges never break an inner segment — a dummy-to-dummy edge — and the
strictly-increasing position guard).  The *horizontal compaction* is
deliberately not the paper's class/shift machinery: Brandes, Walter
and Zink's erratum (arXiv:2008.01252) documents two defects in it, one
of which no pre-2020 implementation had fixed (dagre still carries
it).  Instead, compaction here runs on the **block graph** — one node
per alignment block, one edge per adjacent pair in any layer, weighted
by the pair's separation — placed by longest path in topological
order.  Blocks never cross (alignment preserves layer order), so the
block graph is a DAG and the pass is O(V+E), gives every block its
leftmost (or rightmost, mirrored) feasible position, and has no
sink/shift bookkeeping to get wrong.  The erratum's *correctness*
concern is thereby avoided rather than patched; what is given up is
only the original's placement of totally unconstrained classes, which
the four-way balance step reintroduces.

Separation is size-aware (Rüegg): adjacent nodes u, v in a layer are
kept `halfW(u) + halfW(v) + gap` apart, where the gap is `nodeSep`
between real nodes and half that beside a dummy — edge corridors pack
tighter than node bodies.

Balance is the paper's: align the four assignments to the one of
minimum width (left-biased ones by min x, right-biased by max x), then
take the average of the two medians per node.
*/

import { runDepth } from '../taxi-tracks.mjs';
import type { Layered } from './flow-order.mjs';
import type { FlowComponent } from './flow-graph.mjs';

/** Per-node half width including dummies (dummy corridor half width). */
const DUMMY_HALF_W = 1;

export interface XOptions {
  /** gap between adjacent real nodes in a rank */
  nodeSep: number;
}

/** One alignment direction pair. */
interface Direction {
  /** sweep ranks bottom-up (align to lower neighbours) */
  up: boolean;
  /** right-biased horizontal sweep */
  right: boolean;
}

const DIRECTIONS: Direction[] = [
  { up: false, right: false },
  { up: false, right: true },
  { up: true, right: false },
  { up: true, right: true },
];

/**
 * Type-1 conflict marking (BK alg. 1): ordinary unit edges that cross
 * an inner segment are marked and never chosen for alignment.
 *
 * @param L — the layered form (ordered)
 * @returns per unit-edge marked flags
 */
const markConflicts = (L: Layered): Uint8Array => {
  const marked = new Uint8Array(L.usrc.length);

  for (let r = 1; r < L.layers.length - 1; r++) {
    // scan the lower layer of the pair (r, r+1); inner segments have a
    // dummy at both ends
    const lower = L.layers[r + 1];
    let k0 = 0;
    let l = 0;

    for (let l1 = 0; l1 < lower.length; l1++) {
      const v = lower[l1];
      let innerUpper = -1;

      // a dummy's inner up-edge, or (124.5) a real target's protected
      // last chain segment
      for (let i = L.upOff[v]; i < L.upOff[v + 1]; i++) {
        const e = L.upAdj[i];

        if (L.inner[e] === 1) {
          innerUpper = L.pos[L.usrc[e]];
          break;
        }
      }

      if (innerUpper >= 0 || l1 === lower.length - 1) {
        const k1 = innerUpper >= 0 ? innerUpper : L.layers[r].length - 1;

        while (l <= l1) {
          const w = lower[l];

          for (let i = L.upOff[w]; i < L.upOff[w + 1]; i++) {
            const e = L.upAdj[i];
            const k = L.pos[L.usrc[e]];

            if ((k < k0 || k > k1) && L.inner[e] === 0) {
              marked[e] = 1;
            }
          }

          l++;
        }

        k0 = k1;
      }
    }
  }

  return marked;
};

/**
 * Vertical alignment for one direction: median-neighbour blocks under
 * the marking and monotonicity guards.
 *
 * @returns `root` (block representative per node) and `align` (cyclic
 *   next-in-block), per BK
 */
const verticalAlignment = (
  L: Layered,
  marked: Uint8Array,
  dir: Direction,
): { root: Int32Array; align: Int32Array } => {
  const root = new Int32Array(L.nTotal);
  const align = new Int32Array(L.nTotal);

  for (let v = 0; v < L.nTotal; v++) {
    root[v] = v;
    align[v] = v;
  }

  const off = dir.up ? L.downOff : L.upOff;
  const adj = dir.up ? L.downAdj : L.upAdj;
  const otherEnd = dir.up ? L.utgt : L.usrc;

  const rStart = dir.up ? L.layers.length - 2 : 1;
  const rEnd = dir.up ? -1 : L.layers.length;
  const rStep = dir.up ? -1 : 1;

  const neigh: { p: number; e: number }[] = [];
  const innerP = new Map<number, number>();
  const bound: number[] = [];

  for (let r = rStart; r !== rEnd; r += rStep) {
    const layer = L.layers[r];
    const iStart = dir.right ? layer.length - 1 : 0;
    const iEnd = dir.right ? -1 : layer.length;
    const iStep = dir.right ? -1 : 1;
    const ahead = (p: number, g: number): boolean =>
      dir.right ? p < g : p > g;

    // 124.5, the pre-pass: protected (inner) edges align first — a
    // chain and its target form one block in every direction, and a
    // real parent competing for the target never wins it away from the
    // chain.  Among themselves they keep the usual monotonic guard.
    innerP.clear();

    let guard = dir.right ? Infinity : -Infinity;

    for (let i = iStart; i !== iEnd; i += iStep) {
      const v = layer[i];

      for (let k = off[v]; k < off[v + 1]; k++) {
        const e = adj[k];

        if (L.inner[e] !== 1) {
          continue;
        }

        const p = L.pos[otherEnd[e]];

        if (ahead(p, guard)) {
          const u = otherEnd[e];

          align[u] = v;
          root[v] = root[u];
          align[v] = root[v];
          guard = p;
          innerP.set(i, p);
        }

        break;
      }
    }

    // the bound the main pass must stay short of: the next inner
    // alignment ahead in iteration order (so an ordinary alignment
    // never crosses a protected one)
    bound.length = layer.length;

    let next = dir.right ? -Infinity : Infinity;

    for (let i = iEnd - iStep; i !== iStart - iStep; i -= iStep) {
      bound[i] = next;

      if (innerP.has(i)) {
        next = innerP.get(i) as number;
      }
    }

    guard = dir.right ? Infinity : -Infinity;

    for (let i = iStart; i !== iEnd; i += iStep) {
      const v = layer[i];

      if (innerP.has(i)) {
        guard = innerP.get(i) as number;
        continue;
      }

      // a dummy aligns only along its inner edge: the topmost dummy of a
      // merged chain, whose up-edges are the sources' joining first
      // segments, aligns to none of them, so the block anchors at the
      // target
      if (v >= L.n) {
        continue;
      }

      neigh.length = 0;

      for (let k = off[v]; k < off[v + 1]; k++) {
        const e = adj[k];

        if (L.inner[e] !== 1) {
          neigh.push({ p: L.pos[otherEnd[e]], e });
        }
      }

      if (neigh.length === 0) {
        continue;
      }

      neigh.sort((a, b) => a.p - b.p);

      // the two medians; left-biased tries the lower first, right-biased
      // the upper
      const d = neigh.length;
      const mLo = (d - 1) >> 1;
      const mHi = d >> 1;
      const tryOrder = dir.right ? [mHi, mLo] : [mLo, mHi];

      for (const mi of tryOrder) {
        if (align[v] !== v) {
          break;
        }

        const { p, e } = neigh[mi];

        if (marked[e] === 1) {
          continue;
        }

        if (ahead(p, guard) && ahead(bound[i], p)) {
          const u = otherEnd[e];

          // align v under u's block
          align[u] = v;
          root[v] = root[u];
          align[v] = root[v];
          guard = p;
        }
      }
    }
  }

  return { root, align };
};

/**
 * Block-graph compaction: longest path over blocks, left-biased
 * (mirrored input gives the right-biased variants).
 *
 * @returns per-node x for this alignment
 */
const compact = (
  L: Layered,
  root: Int32Array,
  halfW: Float64Array,
  opts: XOptions,
): Float64Array => {
  // block ids = root node ids; collect constraints from every layer's
  // adjacent pairs
  const xBlock = new Map<number, number>();
  const indeg = new Map<number, number>();
  const out = new Map<number, { to: number; sep: number }[]>();

  const ensure = (b: number): void => {
    if (!indeg.has(b)) {
      indeg.set(b, 0);
      out.set(b, []);
    }
  };

  for (const layer of L.layers) {
    for (let i = 0; i + 1 < layer.length; i++) {
      const u = layer[i];
      const v = layer[i + 1];
      const bu = root[u];
      const bv = root[v];

      ensure(bu);
      ensure(bv);

      const bothReal = u < L.n && v < L.n;
      const gap = bothReal ? opts.nodeSep : opts.nodeSep / 2;
      const sep = halfW[u] + halfW[v] + gap;

      if (bu !== bv) {
        out.get(bu)!.push({ to: bv, sep });
        indeg.set(bv, indeg.get(bv)! + 1);
      }
    }
  }

  for (let v = 0; v < L.nTotal; v++) {
    ensure(root[v]);
  }

  // longest path in topological order: every block leftmost-feasible
  const queue: number[] = [];

  for (const [b, d] of indeg) {
    if (d === 0) {
      queue.push(b);
      xBlock.set(b, 0);
    }
  }

  let qi = 0;

  while (qi < queue.length) {
    const b = queue[qi++];
    const xb = xBlock.get(b)!;

    for (const { to, sep } of out.get(b)!) {
      const cur = xBlock.get(to);

      if (cur == null || xb + sep > cur) {
        xBlock.set(to, xb + sep);
      }

      const d = indeg.get(to)! - 1;

      indeg.set(to, d);

      if (d === 0) {
        queue.push(to);
      }
    }
  }

  const x = new Float64Array(L.nTotal);

  for (let v = 0; v < L.nTotal; v++) {
    x[v] = xBlock.get(root[v])!;
  }

  return x;
};

/** Mirror the layered form's orders in place (for right-biased runs). */
const mirror = (L: Layered): void => {
  for (const layer of L.layers) {
    layer.reverse();

    for (let i = 0; i < layer.length; i++) {
      L.pos[layer[i]] = i;
    }
  }
};

/**
 * Brandes–Köpf x-assignment: four alignments, size-aware block-graph
 * compaction, aligned-to-min-width balance, average of the two
 * medians.
 *
 * @param L — the ordered layered form
 * @param realHalfW — per real node half width; a full `nTotal`-length
 *   array assigns every dummy too (compound walls carry their group's
 *   padding as half-width this way — 112.3)
 * @param opts — separation options
 * @returns x per node (real and dummy), centred per balance
 */
export const assignX = (
  L: Layered,
  realHalfW: Float64Array,
  opts: XOptions,
): Float64Array => {
  const halfW = new Float64Array(L.nTotal).fill(DUMMY_HALF_W);

  if (realHalfW.length >= L.nTotal) {
    halfW.set(realHalfW.subarray(0, L.nTotal));
  } else {
    halfW.set(realHalfW.subarray(0, L.n));
  }

  const marked = markConflicts(L);
  const candidates: Float64Array[] = [];

  for (const dir of DIRECTIONS) {
    if (dir.right) {
      mirror(L);
    }

    const { root } = verticalAlignment(L, marked, dir);
    const x = compact(L, root, halfW, opts);

    if (dir.right) {
      // unmirror both the form and the coordinates
      mirror(L);

      for (let v = 0; v < L.nTotal; v++) {
        x[v] = -x[v];
      }
    }

    candidates.push(x);
  }

  // widths, and alignment to the narrowest
  let bestWidth = Infinity;
  let bestI = 0;
  const mins = new Float64Array(4).fill(Infinity);
  const maxs = new Float64Array(4).fill(-Infinity);

  for (let i = 0; i < 4; i++) {
    const x = candidates[i];

    for (let v = 0; v < L.nTotal; v++) {
      const lo = x[v] - halfW[v];
      const hi = x[v] + halfW[v];

      if (lo < mins[i]) {
        mins[i] = lo;
      }

      if (hi > maxs[i]) {
        maxs[i] = hi;
      }
    }

    const width = maxs[i] - mins[i];

    if (width < bestWidth) {
      bestWidth = width;
      bestI = i;
    }
  }

  for (let i = 0; i < 4; i++) {
    const x = candidates[i];
    // left-biased runs align by min, right-biased by max (BK's balance)
    const shift =
      DIRECTIONS[i].right === false
        ? mins[bestI] - mins[i]
        : maxs[bestI] - maxs[i];

    if (shift !== 0) {
      for (let v = 0; v < L.nTotal; v++) {
        x[v] += shift;
      }
    }
  }

  const x = new Float64Array(L.nTotal);
  const four = new Float64Array(4);

  for (let v = 0; v < L.nTotal; v++) {
    for (let i = 0; i < 4; i++) {
      four[i] = candidates[i][v];
    }

    four.sort();
    x[v] = (four[1] + four[2]) / 2;
  }

  return x;
};

/**
 * Rank rows from cumulative half-heights: each rank's row is as tall
 * as its tallest node and `rankSep` from its neighbours — or, per gap,
 * the entry of a `rankSep` array (124.5: a gap grows for the taxi
 * tracks it has to hold).
 *
 * @param L — the layered form
 * @param realHalfH — per real node half height
 * @param rankSep — the gap between rank rows, one number or one per gap
 * @param margins — compound mode (112.3): per-rank extra top/bottom
 *   space reserving group vertical padding at interval boundaries
 * @returns y per node (all members of a rank share it)
 */
export const assignY = (
  L: Layered,
  realHalfH: Float64Array,
  rankSep: number | ArrayLike<number>,
  margins: { top: Float64Array; bottom: Float64Array } | null = null,
): Float64Array => {
  const y = new Float64Array(L.nTotal);
  let cursor = 0;

  for (let r = 0; r < L.layers.length; r++) {
    let maxHalf = 0;

    for (const v of L.layers[r]) {
      if (v < L.n && realHalfH[v] > maxHalf) {
        maxHalf = realHalfH[v];
      }
    }

    if (margins != null) {
      cursor += margins.top[r];
    }

    const center = cursor + maxHalf;

    for (const v of L.layers[r]) {
      y[v] = center;
    }

    cursor =
      center + maxHalf + (typeof rankSep === 'number' ? rankSep : rankSep[r]);

    if (margins != null) {
      cursor += margins.bottom[r];
    }
  }

  return y;
};

/**
 * Per-gap separations for the taxi tracks (124.5): in the gap below
 * rank r, the runs of rank r's real sources — each from its x to its
 * farthest target's x, long edges included, since the track pass puts
 * a long edge's run in the first gap — need `runDepth` slots on
 * distinct lines, so the gap is `max(rankSep, slots × edgeSep + 2 ×
 * minTurn)`.  Positions only: the style's track pass draws the lines.
 *
 * @param L — the layered form
 * @param x — x per node (real and dummy)
 * @param comp — the component (its simple edges)
 * @param rankSep — the configured gap
 * @param edgeSep — px per track
 * @param minTurn — the turn clearance at both ends (the style default)
 * @returns the gap below each rank
 */
export const gapSeparations = (
  L: Layered,
  x: Float64Array,
  comp: FlowComponent,
  rankSep: number,
  edgeSep: number,
  minTurn: number,
): Float64Array => {
  const gaps = new Float64Array(L.layers.length).fill(rankSep);

  if (!(edgeSep > 0)) {
    return gaps;
  }

  // per real source: its run on the cross axis
  const lo = new Float64Array(L.n).fill(Infinity);
  const hi = new Float64Array(L.n).fill(-Infinity);

  for (let e = 0; e < comp.m; e++) {
    const s = comp.src[e];
    const t = comp.tgt[e];

    lo[s] = Math.min(lo[s], x[s], x[t]);
    hi[s] = Math.max(hi[s], x[s], x[t]);
  }

  for (let r = 0; r < L.layers.length - 1; r++) {
    const runLo: number[] = [];
    const runHi: number[] = [];

    for (const v of L.layers[r]) {
      if (v < L.n && lo[v] !== Infinity) {
        runLo.push(lo[v]);
        runHi.push(hi[v]);
      }
    }

    const slots = runDepth(runLo, runHi);

    gaps[r] = Math.max(rankSep, slots * edgeSep + 2 * minTurn);
  }

  return gaps;
};

/**
 * Map canonical downward coordinates to the requested direction.
 *
 * @param x — canonical x (breadth axis)
 * @param y — canonical y (depth axis, increasing downward)
 * @param direction — the drawing direction
 * @returns `[outX, outY]` in model coordinates
 */
export const applyDirection = (
  x: Float64Array,
  y: Float64Array,
  direction: 'downward' | 'upward' | 'leftward' | 'rightward',
): [Float64Array, Float64Array] => {
  switch (direction) {
    case 'downward':
      return [x, y];
    case 'upward': {
      const ny = new Float64Array(y.length);

      for (let i = 0; i < y.length; i++) {
        ny[i] = -y[i];
      }

      return [x, ny];
    }
    case 'rightward':
      return [y, x];
    case 'leftward': {
      const nx = new Float64Array(y.length);

      for (let i = 0; i < y.length; i++) {
        nx[i] = -y[i];
      }

      return [nx, x];
    }
  }
};

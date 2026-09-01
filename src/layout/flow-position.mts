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

import type { Layered } from './flow-order.mjs';

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

      if (v >= L.n) {
        for (let i = L.upOff[v]; i < L.upOff[v + 1]; i++) {
          const e = L.upAdj[i];

          if (L.inner[e] === 1) {
            innerUpper = L.pos[L.usrc[e]];
            break;
          }
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

  for (let r = rStart; r !== rEnd; r += rStep) {
    const layer = L.layers[r];
    let guard = dir.right ? Infinity : -Infinity;

    const iStart = dir.right ? layer.length - 1 : 0;
    const iEnd = dir.right ? -1 : layer.length;
    const iStep = dir.right ? -1 : 1;

    for (let i = iStart; i !== iEnd; i += iStep) {
      const v = layer[i];

      neigh.length = 0;

      for (let k = off[v]; k < off[v + 1]; k++) {
        const e = adj[k];

        neigh.push({ p: L.pos[otherEnd[e]], e });
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

        if (dir.right ? p < guard : p > guard) {
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
 * as its tallest node and `rankSep` from its neighbours.
 *
 * @param L — the layered form
 * @param realHalfH — per real node half height
 * @param rankSep — the gap between rank rows
 * @param margins — compound mode (112.3): per-rank extra top/bottom
 *   space reserving group vertical padding at interval boundaries
 * @returns y per node (all members of a rank share it)
 */
export const assignY = (
  L: Layered,
  realHalfH: Float64Array,
  rankSep: number,
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

    cursor = center + maxHalf + rankSep;

    if (margins != null) {
      cursor += margins.bottom[r];
    }
  }

  return y;
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

/*
Taxi tracks (round 124): automatic turn distances per bundle.

With `taxi-turn: '50%'` every edge out of a rank turns on the same line,
so the horizontal runs of different sources are collinear and a reader
cannot follow an edge through the gap.  This module assigns each
`taxi-turn: auto` edge a px turn from a *track* — a line in the gap that
its bundle owns — so the runs of conflicting bundles sit on distinct
lines.  It is the general form of GeneaQuilts' per-family trunk and of
Sander's hyperedge routing slots (ELK's orthogonal router assigns them
per layer gap); dagre has nothing like it.

The pass is pure and position-driven: node centres and outer halves in,
one px turn per edge out, so it runs from live positions under every
layout and after every drag (the store refreshes it lazily off the geo
epoch — `GraphStore.refreshTaxiTracks`) and flow can run the same
counter over its own coordinates to size a rank gap.

The rules, in order:

1. Per edge, the taxi axis, sign and ideal band are derived exactly as
   `evalTaxi` derives them (body-subtracted deltas, the auto-axis
   choice, `taxi-turn-min-distance` at both ends).  An edge whose band
   is empty — too short for an ideal route, a zero delta — keeps the
   50 % turn, which draws what it draws today (the Z-/L-fallback).
2. A bundle is the edges sharing a key: the source (`source`, the
   default — ELK's hyperedge), the target (`target`, the mirror for
   fan-in drawings) or the target's parent set (`family` — the
   GeneaQuilts key, which draws k sources and m children on one
   trunk), always per axis and direction.  A bundle's band is the
   intersection of its members' bands; members whose bands do not
   intersect split into sub-bundles (interval clique partition), so a
   family whose parents sit at very different heights still routes.
3. The band is cut by the node bodies a run would cross (the bundle's
   own endpoints never lie in it): the run keeps the free stretch
   nearest the source (`target` bundles: nearest the target).  In a
   layered drawing this is what puts a long edge's run in the first
   gap and its leg at the target's x — flow's corridor (124.5).
4. Two bundles conflict when both their runs (cross axis) and their
   bands (taxi axis) overlap.  Conflicting bundles are ordered by
   ELK's pairwise rule (`order: 'crossings'`, the default): for a
   conflicting pair, count the legs each order makes cross the other
   bundle's runs — per edge run, never against an edge sharing an
   endpoint, the way a crossing counter sees them — orient the pair
   the cheaper way, ties to the staircase, keep orientations by
   decreasing margin unless one closes a cycle, and colour greedily in
   the topological order with every bundle above its predecessors.
   `order: 'staircase'` colours by the source's cross position alone,
   near to far, the ordering a metro map draws.  124.1 measured both
   on deps, workflow-1k, reactome and the Greek-gods genealogy: the
   run-overlap count falls to 0 (3 on workflow-1k) under either, and
   the crossing rule beats the staircase on crossings on all four
   (4259 vs 4515, 23176 vs 29266, 59 vs 62, 134 vs 144), so it is the
   default and the staircase stays as the control.
5. Slot s of k in a band of length b lands at `mid + sgn × (s − (k −
   1) / 2) × spacing`, `spacing = min(taxi-track-spacing, b / (k +
   1))`, so a crowded gap compresses rather than falling into the
   fallback; a lone bundle sits at the band's middle — an `auto` edge
   with nothing to disambiguate draws exactly what `'50%'` draws.
*/

import {
  TAXI_AUTO,
  TAXI_VERTICAL,
  TAXI_UPWARD,
  TAXI_DOWNWARD,
} from './curve-geometry.mjs';

/** `taxi-track: source` — the edges out of one node share a track. */
export const TRACK_SOURCE = 0;
/** `taxi-track: target` — the edges into one node share a track. */
export const TRACK_TARGET = 1;
/** `taxi-track: family` — the edges into the targets that share a
 * parent set share one track (the genealogy key). */
export const TRACK_FAMILY = 2;

/** One `taxi-turn: auto` edge, as the store or a layout describes it. */
export interface TrackEdge {
  /** source node slot (indexes `pos` / `half`) */
  src: number;
  /** target node slot */
  tgt: number;
  /** the TAXI_* direction id (`taxi-direction`) */
  dir: number;
  /** `taxi-turn-min-distance` */
  minDist: number;
  /** whether `edge-distances` measures from the node body (not
   * `node-position`) */
  body: boolean;
  /** TRACK_SOURCE | TRACK_TARGET | TRACK_FAMILY */
  group: number;
  /** `taxi-track-spacing`: the ideal distance between neighbouring tracks */
  spacing: number;
}

/** The pass's inputs. */
export interface TrackInput {
  edges: readonly TrackEdge[];
  /** node centres, [x, y] per slot */
  pos: ArrayLike<number>;
  /** node outer half extents, [hx, hy] per slot */
  half: ArrayLike<number>;
  /** node slots whose bodies a run must not cross (visible leaves) */
  obstacles?: ArrayLike<number>;
  /** the slot order among conflicting bundles (default 'crossings') */
  order?: 'staircase' | 'crossings';
}

/** One bundle after assignment (the harness and flow read these). */
export interface TrackBundle {
  /** edge indices into `input.edges` */
  members: number[];
  /** taxi axis: true = vertical (the run is horizontal) */
  vert: boolean;
  /** direction of travel along the axis, +1 or -1 */
  sgn: number;
  /** the band on the taxi axis (absolute coordinates, lo ≤ hi) */
  lo: number;
  hi: number;
  /** the run on the cross axis (absolute coordinates) */
  c0: number;
  c1: number;
  /** the slot this bundle took, 0 = nearest the source */
  slot: number;
  /** the slot count of its conflict component */
  k: number;
  /** the track line's axis coordinate */
  x: number;
}

/** The pass's result. */
export interface TrackResult {
  /** px turn per edge (index-aligned with `input.edges`) */
  turn: Float64Array;
  bundles: TrackBundle[];
}

const subDWH = (dxy: number, dwh: number): number => {
  return dxy > 0 ? Math.max(dxy - dwh, 0) : Math.min(dxy + dwh, 0);
};

interface EdgeGeom {
  vert: boolean;
  sgn: number;
  /** the source's far boundary on the axis (or centre without body) */
  aS: number;
  /** ideal band, absolute axis coordinates */
  lo: number;
  hi: number;
  /** source / target cross coordinates */
  cS: number;
  cT: number;
  /** the 50 % turn, for edges the pass excludes */
  half: number;
  ok: boolean;
}

/** `evalTaxi`'s axis, sign and ideal band, per edge. */
const edgeGeom = (
  e: TrackEdge,
  pos: ArrayLike<number>,
  half: ArrayLike<number>,
): EdgeGeom => {
  const sx = pos[e.src * 2];
  const sy = pos[e.src * 2 + 1];
  const tx = pos[e.tgt * 2];
  const ty = pos[e.tgt * 2 + 1];
  const sHW = half[e.src * 2];
  const sHH = half[e.src * 2 + 1];
  const tHW = half[e.tgt * 2];
  const tHH = half[e.tgt * 2 + 1];
  const dw = e.body ? sHW + tHW : 0;
  const dh = e.body ? sHH + tHH : 0;
  const pdx = tx - sx;
  const pdy = ty - sy;
  const dx = subDWH(pdx, dw);
  const dy = subDWH(pdy, dh);

  let vert: boolean;

  if (e.dir === TAXI_AUTO) {
    vert = !(Math.abs(dx) > Math.abs(dy));
  } else {
    vert =
      e.dir === TAXI_VERTICAL ||
      e.dir === TAXI_UPWARD ||
      e.dir === TAXI_DOWNWARD;
  }

  const l = vert ? dy : dx;
  const pl = vert ? pdy : pdx;
  const sgn = Math.sign(pl);
  const sHalf = vert ? sHH : sHW;
  const tHalf = vert ? tHH : tHW;
  const aS = (vert ? sy : sx) + (e.body ? sHalf * sgn : 0);
  const aT = (vert ? ty : tx) - (e.body ? tHalf * sgn : 0);
  const absL = Math.abs(l);
  const near = aS + e.minDist * sgn;
  const far = aT - e.minDist * sgn;

  return {
    vert,
    sgn,
    aS,
    lo: Math.min(near, far),
    hi: Math.max(near, far),
    cS: vert ? sx : sy,
    cT: vert ? tx : ty,
    half: 0.5 * absL,
    ok: sgn !== 0 && absL >= 2 * e.minDist && Number.isFinite(l),
  };
};

interface Proto {
  members: number[];
  vert: boolean;
  sgn: number;
  group: number;
  lo: number;
  hi: number;
  c0: number;
  c1: number;
  /** the ordering anchor on the cross axis */
  anchor: number;
  spacing: number;
}

/** Group the ideal edges into bundles by key, then split each key's
 * members into sub-bundles whose bands intersect. */
const buildBundles = (
  edges: readonly TrackEdge[],
  geom: EdgeGeom[],
): Proto[] => {
  // family keys: the sorted parent set of each target, over these edges
  let parentsOf: Map<number, string> | null = null;

  for (let i = 0; i < edges.length; i++) {
    if (edges[i].group === TRACK_FAMILY) {
      parentsOf = new Map();
      break;
    }
  }

  if (parentsOf != null) {
    const sets = new Map<number, number[]>();

    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      let s = sets.get(e.tgt);

      if (s == null) {
        s = [];
        sets.set(e.tgt, s);
      }

      s.push(e.src);
    }

    for (const [tgt, s] of sets) {
      s.sort((a, b) => a - b);
      parentsOf.set(tgt, s.join(','));
    }
  }

  const byKey = new Map<string, number[]>();

  for (let i = 0; i < edges.length; i++) {
    const g = geom[i];

    if (!g.ok) {
      continue;
    }

    const e = edges[i];
    const head =
      e.group === TRACK_TARGET
        ? `t${e.tgt}`
        : e.group === TRACK_FAMILY
          ? `f${parentsOf!.get(e.tgt)}`
          : `s${e.src}`;
    const key = `${head}|${g.vert ? 'v' : 'h'}${g.sgn > 0 ? '+' : '-'}`;
    let list = byKey.get(key);

    if (list == null) {
      list = [];
      byKey.set(key, list);
    }

    list.push(i);
  }

  const protos: Proto[] = [];

  for (const list of byKey.values()) {
    // interval clique partition: members sorted by band start, greedily
    // gathered while the running intersection stays non-empty
    list.sort((a, b) => geom[a].lo - geom[b].lo || a - b);

    let cur: Proto | null = null;

    for (const i of list) {
      const g = geom[i];
      const e = edges[i];

      if (cur == null || g.lo > cur.hi) {
        cur = {
          members: [],
          vert: g.vert,
          sgn: g.sgn,
          group: e.group,
          lo: g.lo,
          hi: g.hi,
          c0: Infinity,
          c1: -Infinity,
          anchor: Infinity,
          spacing: e.spacing,
        };
        protos.push(cur);
      }

      cur.members.push(i);
      cur.hi = Math.min(cur.hi, g.hi);
      cur.lo = Math.max(cur.lo, g.lo);
      cur.c0 = Math.min(cur.c0, g.cS, g.cT);
      cur.c1 = Math.max(cur.c1, g.cS, g.cT);
      cur.spacing = Math.min(cur.spacing, e.spacing);

      const anchor = e.group === TRACK_TARGET ? g.cT : g.cS;

      if (anchor < cur.anchor) {
        cur.anchor = anchor;
      }
    }
  }

  return protos;
};

/**
 * Cut the band by the obstacle bodies the run would cross and keep the
 * free stretch nearest the source (nearest the target for `target`
 * bundles).  A band with no free stretch is left whole.
 */
const cutByObstacles = (
  p: Proto,
  obstacles: ArrayLike<number>,
  pos: ArrayLike<number>,
  half: ArrayLike<number>,
  ownNodes: Set<number>,
): void => {
  const axis = p.vert ? 1 : 0;
  const cross = p.vert ? 0 : 1;
  const blocks: number[] = []; // [lo, hi, lo, hi, ...] along the axis

  for (let i = 0; i < obstacles.length; i++) {
    const n = obstacles[i];

    if (ownNodes.has(n)) {
      continue;
    }

    const c = pos[n * 2 + cross];
    const hc = half[n * 2 + cross];

    if (c + hc <= p.c0 || c - hc >= p.c1) {
      continue;
    }

    const a = pos[n * 2 + axis];
    const ha = half[n * 2 + axis];

    if (a + ha <= p.lo || a - ha >= p.hi) {
      continue;
    }

    blocks.push(a - ha, a + ha);
  }

  if (blocks.length === 0) {
    return;
  }

  // merge the blocks, then walk the free stretches
  const order: number[] = [];

  for (let i = 0; i < blocks.length; i += 2) {
    order.push(i);
  }

  order.sort((a, b) => blocks[a] - blocks[b]);

  const free: number[] = [];
  let cursor = p.lo;

  for (const i of order) {
    const bLo = blocks[i];
    const bHi = blocks[i + 1];

    if (bLo > cursor) {
      free.push(cursor, Math.min(bLo, p.hi));
    }

    if (bHi > cursor) {
      cursor = bHi;
    }
  }

  if (cursor < p.hi) {
    free.push(cursor, p.hi);
  }

  if (free.length === 0) {
    return;
  }

  // nearest the source: the lowest stretch when travelling +, the
  // highest when travelling −; `target` bundles take the other end
  const fromLow = p.sgn > 0 !== (p.group === TRACK_TARGET);
  const at = fromLow ? 0 : free.length - 2;

  p.lo = free[at];
  p.hi = free[at + 1];
};

/**
 * Assign every `taxi-turn: auto` edge its px turn.
 *
 * @param input — the edges, node geometry and obstacle list
 * @returns the px turn per edge and the bundles behind them
 */
export const assignTaxiTracks = (input: TrackInput): TrackResult => {
  const { edges, pos, half } = input;
  const turn = new Float64Array(edges.length);
  const geom: EdgeGeom[] = new Array(edges.length);

  for (let i = 0; i < edges.length; i++) {
    geom[i] = edgeGeom(edges[i], pos, half);
    turn[i] = geom[i].half;
  }

  const protos = buildBundles(edges, geom);

  if (input.obstacles != null && input.obstacles.length > 0) {
    const own = new Set<number>();

    for (const p of protos) {
      own.clear();

      for (const i of p.members) {
        own.add(edges[i].src);
        own.add(edges[i].tgt);
      }

      cutByObstacles(p, input.obstacles, pos, half, own);
    }
  }

  const B = protos.length;
  const slot = new Int32Array(B).fill(-1);
  const comp = new Int32Array(B);
  const kOf = new Int32Array(B);

  // conflicts: a sweep along the taxi axis per axis, an active list of
  // bands still open, cross-run overlap tested against the actives
  const adj: number[][] = new Array(B);

  for (let b = 0; b < B; b++) {
    adj[b] = [];
  }

  const byLo = Array.from({ length: B }, (_, b) => b).sort(
    (a, b) => protos[a].lo - protos[b].lo || a - b,
  );

  for (const vert of [true, false]) {
    const active: number[] = [];

    for (const b of byLo) {
      const p = protos[b];

      if (p.vert !== vert) {
        continue;
      }

      // drop closed bands
      let w = 0;

      for (let i = 0; i < active.length; i++) {
        if (protos[active[i]].hi >= p.lo) {
          active[w++] = active[i];
        }
      }

      active.length = w;

      for (const a of active) {
        const q = protos[a];

        if (q.c0 <= p.c1 && p.c0 <= q.c1) {
          adj[a].push(b);
          adj[b].push(a);
        }
      }

      active.push(b);
    }
  }

  // union-find over conflicts → components
  const parent = new Int32Array(B);

  for (let b = 0; b < B; b++) {
    parent[b] = b;
  }

  const find = (b: number): number => {
    while (parent[b] !== b) {
      parent[b] = parent[parent[b]];
      b = parent[b];
    }

    return b;
  };

  for (let b = 0; b < B; b++) {
    for (const a of adj[b]) {
      const ra = find(a);
      const rb = find(b);

      if (ra !== rb) {
        parent[ra] = rb;
      }
    }
  }

  for (let b = 0; b < B; b++) {
    comp[b] = find(b);
  }

  // the colouring order
  const staircase = (a: number, b: number): number =>
    protos[a].anchor - protos[b].anchor || a - b;
  let order = Array.from({ length: B }, (_, b) => b).sort(staircase);
  const pred: number[][] = new Array(B);

  for (let b = 0; b < B; b++) {
    pred[b] = [];
  }

  if (input.order !== 'staircase') {
    order = crossingOrder(protos, edges, geom, adj, staircase, pred);
  }

  const used = new Set<number>();

  for (const b of order) {
    used.clear();

    let floor = 0;

    for (const a of adj[b]) {
      if (slot[a] >= 0) {
        used.add(slot[a]);
      }
    }

    for (const a of pred[b]) {
      if (slot[a] + 1 > floor) {
        floor = slot[a] + 1;
      }
    }

    let s = floor;

    while (used.has(s)) {
      s++;
    }

    slot[b] = s;
  }

  for (let b = 0; b < B; b++) {
    const c = comp[b];

    if (slot[b] + 1 > kOf[c]) {
      kOf[c] = slot[b] + 1;
    }
  }

  const bundles: TrackBundle[] = new Array(B);

  for (let b = 0; b < B; b++) {
    const p = protos[b];
    const k = kOf[comp[b]];
    const len = p.hi - p.lo;
    const spacing = Math.min(p.spacing, len / (k + 1));
    const mid = (p.lo + p.hi) / 2;
    let x = mid + p.sgn * (slot[b] - (k - 1) / 2) * spacing;

    x = Math.max(p.lo, Math.min(p.hi, x));

    for (const i of p.members) {
      turn[i] = (x - geom[i].aS) * geom[i].sgn;
    }

    bundles[b] = {
      members: p.members,
      vert: p.vert,
      sgn: p.sgn,
      lo: p.lo,
      hi: p.hi,
      c0: p.c0,
      c1: p.c1,
      slot: slot[b],
      k,
      x,
    };
  }

  return { turn, bundles };
};

/**
 * ELK's pairwise rule over the conflict graph: for each conflicting
 * pair, the crossings each order costs (the nearer bundle's target
 * legs through the farther run, the farther bundle's source legs
 * through the nearer run); orient the pair the cheaper way, ties to
 * the staircase; add orientations by decreasing margin, skipping any
 * that would close a cycle; the topological order (ties to the
 * staircase) is the colouring order, and `pred` carries the kept
 * orientations so a bundle's slot stays above its predecessors'.
 */
const crossingOrder = (
  protos: Proto[],
  edges: readonly TrackEdge[],
  geom: EdgeGeom[],
  adj: number[][],
  staircase: (a: number, b: number) => number,
  pred: number[][],
): number[] => {
  const B = protos.length;
  const legsIn = (p: Proto, q: Proto, fromSource: boolean): number => {
    // p's legs (source or target ends) against q's members' own runs —
    // per edge, the way a crossing counter sees them, and never against
    // a member sharing an endpoint node (those pairs meet, not cross)
    let n = 0;

    for (const i of p.members) {
      const c = fromSource ? geom[i].cS : geom[i].cT;
      const ei = edges[i];

      for (const j of q.members) {
        const ej = edges[j];

        if (
          ei.src === ej.src ||
          ei.tgt === ej.tgt ||
          ei.src === ej.tgt ||
          ei.tgt === ej.src
        ) {
          continue;
        }

        const lo = Math.min(geom[j].cS, geom[j].cT);
        const hi = Math.max(geom[j].cS, geom[j].cT);

        if (c > lo && c < hi) {
          n++;
        }
      }
    }

    return n;
  };
  const pairs: { a: number; b: number; margin: number }[] = [];

  for (let a = 0; a < B; a++) {
    for (const b of adj[a]) {
      if (b <= a) {
        continue;
      }

      const p = protos[a];
      const q = protos[b];
      // a nearer the source than b
      const costAB = legsIn(q, p, true) + legsIn(p, q, false);
      const costBA = legsIn(p, q, true) + legsIn(q, p, false);

      if (costAB < costBA || (costAB === costBA && staircase(a, b) < 0)) {
        pairs.push({ a, b, margin: costBA - costAB });
      } else {
        pairs.push({ a: b, b: a, margin: costAB - costBA });
      }
    }
  }

  pairs.sort(
    (x, y) => y.margin - x.margin || staircase(x.a, y.a) || staircase(x.b, y.b),
  );

  const succ: number[][] = new Array(B);

  for (let b = 0; b < B; b++) {
    succ[b] = [];
  }

  const reaches = (from: number, to: number): boolean => {
    const stack = [from];
    const seen = new Set<number>([from]);

    while (stack.length > 0) {
      const v = stack.pop() as number;

      if (v === to) {
        return true;
      }

      for (const w of succ[v]) {
        if (!seen.has(w)) {
          seen.add(w);
          stack.push(w);
        }
      }
    }

    return false;
  };

  for (const { a, b } of pairs) {
    if (!reaches(b, a)) {
      succ[a].push(b);
      pred[b].push(a);
    }
  }

  // Kahn's order, ties to the staircase
  const indeg = new Int32Array(B);

  for (let b = 0; b < B; b++) {
    indeg[b] = pred[b].length;
  }

  const ready: number[] = [];

  for (let b = 0; b < B; b++) {
    if (indeg[b] === 0) {
      ready.push(b);
    }
  }

  const out: number[] = [];

  while (ready.length > 0) {
    ready.sort(staircase);

    const v = ready.shift() as number;

    out.push(v);

    for (const w of succ[v]) {
      if (--indeg[w] === 0) {
        ready.push(w);
      }
    }
  }

  return out;
};

/**
 * The slot count a set of runs needs on one line: the greedy colouring
 * of their interval-overlap graph (optimal for intervals — the maximum
 * overlap depth).  Flow sizes a rank gap with it (124.5).
 *
 * @param lo — run starts on the cross axis
 * @param hi — run ends (index-aligned with `lo`)
 * @returns the slot count
 */
export const runDepth = (
  lo: ArrayLike<number>,
  hi: ArrayLike<number>,
): number => {
  const n = lo.length;
  const ev: number[] = [];

  for (let i = 0; i < n; i++) {
    ev.push(i, i + n);
  }

  // starts before ends at equal coordinates: touching runs conflict
  ev.sort((a, b) => {
    const ca = a < n ? lo[a] : hi[a - n];
    const cb = b < n ? lo[b] : hi[b - n];

    return ca - cb || (a < n ? 0 : 1) - (b < n ? 0 : 1);
  });

  let depth = 0;
  let best = 0;

  for (const e of ev) {
    if (e < n) {
      depth++;

      if (depth > best) {
        best = depth;
      }
    } else {
      depth--;
    }
  }

  return best;
};

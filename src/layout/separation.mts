/*
Exact pairwise separation for layouts (round 115).

Round 114 gave every layout one reading of node dimensions, and every
layout then spaced by the *largest* footprint in scope — circle and
breadthfirst by `max(w, h)` over every node, concentric and radial by
the longest diagonal — applied to every pair alike.  One long label
therefore pushed every node on a ring or in a rank apart by that
label's diagonal, whichever way its neighbours actually lay.  That is
the over-separation the maintainer saw: overlap-free, and several
times more spread than v3 with labels on.

Two boxes only need to clear each other on *one* axis, and which axis
is cheaper depends on the direction between them.  A wide label beside
another wide label needs their widths; the same two labels stacked
need only their heights.  `separationAlong` is that rule, exact for
axis-aligned boxes, and the ring solvers here apply it to each pair
that can actually meet — the angular neighbours on a ring, the ring
inside it — so a ring's radius is the smallest that clears its own
nodes, not the largest node's diagonal times the node count.
*/

import type { LayoutNodeDims } from './dims.mjs';

/** Boxes can be any four parallel node-local extents. */
export type Extents = Pick<LayoutNodeDims, 'x1' | 'y1' | 'x2' | 'y2'>;

/** Boxes with their largest width and height — what a grid over them
 * is hashed by (118.2: the force sim's `extents` and the settle's dims
 * are both this shape). */
export type Boxes = Extents & Pick<LayoutNodeDims, 'maxW' | 'maxH'>;

/** the sim's own grid bound, so a destroyed field cannot allocate one */
const MAX_GRID_SIDE = 4096;

/**
 * Push two overlapping boxes apart in place along the axis of smaller
 * overlap, a hair past touching — half each when both move, all of it
 * onto the free node when one is pinned, nothing when both are.  The
 * lower index goes to the negative side on a tie.  The settle's push
 * since 114.5, shared with the sim's per-tick sweep since 118.2.
 *
 * @param pos — 2n interleaved positions, moved in place
 * @param pinned — per-node 1 when the node must not move
 * @param i — the lower index of the pair
 * @param j — the higher
 * @param ox — the pair's overlap along x (positive)
 * @param oy — the pair's overlap along y (positive)
 * @returns the distance the pair was opened by (0 when both pinned)
 */
export const pushApart = (
  pos: Float32Array,
  pinned: Uint8Array | null,
  i: number,
  j: number,
  ox: number,
  oy: number,
): number => {
  const pi = pinned != null && pinned[i] === 1;
  const pj = pinned != null && pinned[j] === 1;

  if (pi && pj) {
    return 0;
  }

  const alongX = ox <= oy;
  const axis = alongX ? 0 : 1;
  const amount = (alongX ? ox : oy) + 0.5;
  const ca = pos[i * 2 + axis];
  const cb = pos[j * 2 + axis];
  const sign = ca < cb || (ca === cb && i < j) ? -1 : 1;
  const shareA = pi ? 0 : pj ? 1 : 0.5;

  pos[i * 2 + axis] += sign * amount * shareA;
  pos[j * 2 + axis] -= sign * amount * (1 - shareA);

  return amount;
};

/**
 * A uniform grid over node boxes, hashed by the largest box so any
 * two overlapping boxes share a 3 × 3 cell neighbourhood (118.2 —
 * lifted out of the settle's separation so the sim's per-tick sweep
 * and the settle run one primitive).  The scratch is allocated once
 * per instance and the grid is rebuilt from the positions on every
 * pass, so a caller that moves nodes between passes is always read
 * fresh.
 */
export class OverlapGrid {
  private readonly n: number;
  private readonly dims: Extents;
  private readonly cell: number;
  private readonly cellOf: Int32Array;
  private readonly order: Int32Array;
  private start = new Int32Array(0);
  private fill = new Int32Array(0);

  /**
   * @param n — how many boxes
   * @param dims — the node-local boxes with their largest width and
   *   height
   */
  constructor(n: number, dims: Boxes) {
    this.n = n;
    this.dims = dims;
    this.cell = Math.max(dims.maxW, dims.maxH, 1);
    this.cellOf = new Int32Array(n);
    this.order = new Int32Array(n);
  }

  /**
   * Visit every pair (j > i) sharing a 3 × 3 cell neighbourhood once,
   * over a grid built from the positions as they stand at the call,
   * with the pair's overlap on each axis (non-positive when clear).
   * `visit` may move nodes.
   *
   * @param pos — 2n interleaved positions
   * @param visit — called per pair with the indices and the overlaps
   * @param overlappingOnly — skip the clear pairs
   * @returns whether any pair overlapped
   */
  forEach(
    pos: Float32Array,
    visit: (i: number, j: number, ox: number, oy: number) => void,
    overlappingOnly: boolean,
  ): boolean {
    const n = this.n;
    const dims = this.dims;
    const cell = this.cell;
    const cellOf = this.cellOf;
    const order = this.order;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < n; i++) {
      const x = pos[i * 2];
      const y = pos[i * 2 + 1];

      if (x < minX) {
        minX = x;
      }
      if (x > maxX) {
        maxX = x;
      }
      if (y < minY) {
        minY = y;
      }
      if (y > maxY) {
        maxY = y;
      }
    }

    if (!Number.isFinite(minX + maxX + minY + maxY)) {
      return false; // a destroyed field has no pairs worth a grid
    }

    const cols = Math.max(
      1,
      Math.min(MAX_GRID_SIDE, Math.floor((maxX - minX) / cell) + 1),
    );
    const rows = Math.max(
      1,
      Math.min(MAX_GRID_SIDE, Math.floor((maxY - minY) / cell) + 1),
    );
    const cells = cols * rows;

    if (this.start.length < cells + 1) {
      this.start = new Int32Array(cells + 1);
      this.fill = new Int32Array(cells);
    } else {
      this.start.fill(0, 0, cells + 1);
    }

    const start = this.start;
    const fill = this.fill;

    for (let i = 0; i < n; i++) {
      const cx = Math.min(cols - 1, Math.floor((pos[i * 2] - minX) / cell));
      const cy = Math.min(rows - 1, Math.floor((pos[i * 2 + 1] - minY) / cell));

      cellOf[i] = cy * cols + cx;
      start[cellOf[i] + 1]++;
    }

    for (let c = 0; c < cells; c++) {
      start[c + 1] += start[c];
      fill[c] = start[c];
    }

    for (let i = 0; i < n; i++) {
      order[fill[cellOf[i]]++] = i;
    }

    let found = false;

    for (let i = 0; i < n; i++) {
      const ci = cellOf[i];
      const cx = ci % cols;
      const cy = (ci - cx) / cols;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;

        if (ny < 0 || ny >= rows) {
          continue;
        }

        for (let dx = -1; dx <= 1; dx++) {
          const nx = cx + dx;

          if (nx < 0 || nx >= cols) {
            continue;
          }

          const c = ny * cols + nx;

          for (let k = start[c]; k < start[c + 1]; k++) {
            const j = order[k];

            if (j <= i) {
              continue;
            }

            const ax = pos[i * 2];
            const ay = pos[i * 2 + 1];
            const bx = pos[j * 2];
            const by = pos[j * 2 + 1];
            const ox =
              Math.min(ax + dims.x2[i], bx + dims.x2[j]) -
              Math.max(ax + dims.x1[i], bx + dims.x1[j]);
            const oy =
              Math.min(ay + dims.y2[i], by + dims.y2[j]) -
              Math.max(ay + dims.y1[i], by + dims.y1[j]);
            const overlapping = ox > 0 && oy > 0;

            if (overlapping) {
              found = true;
            } else if (overlappingOnly) {
              continue;
            }

            visit(i, j, ox, oy);
          }
        }
      }
    }

    return found;
  }

  /**
   * One Gauss–Seidel sweep: every overlapping pair, in index order, is
   * pushed apart (`pushApart`) as the sweep finds it — so a pair the
   * sweep has already moved is read at its new position by the next.
   * The settle's sparse case clears in one or two; the sim runs one
   * after every tick (118.2).
   *
   * @param pos — 2n interleaved positions, moved in place
   * @param pinned — per-node 1 when the node must not move, or null
   * @returns the largest distance any pair was opened by — 0 when no
   *   pair overlapped (or every overlapping pair was pinned at both
   *   ends), so a caller folding it into a settle test reads a quiet
   *   sweep as quiet
   */
  sweep(pos: Float32Array, pinned: Uint8Array | null): number {
    let largest = 0;

    this.forEach(
      pos,
      (i, j, ox, oy) => {
        largest = Math.max(largest, pushApart(pos, pinned, i, j, ox, oy));
      },
      true,
    );

    return largest;
  }
}

/**
 * The smallest centre distance from box `i` to box `j` along the unit
 * direction `(ux, uy)` at which the two stop overlapping.  Exact for
 * axis-aligned boxes: the pair is clear once separated on either axis,
 * so the answer is the cheaper axis's distance.  Asymmetric boxes (a
 * label below the body) are honoured — the far side of `i` against the
 * near side of `j`.
 *
 * @param dims — the node-local boxes
 * @param i — the box that stays
 * @param j — the box placed at `p_i + d · u`
 * @param ux — the direction's x component (unit length with `uy`)
 * @param uy — the direction's y component
 * @returns the distance `d`, never negative
 */
export const separationAlong = (
  dims: Extents,
  i: number,
  j: number,
  ux: number,
  uy: number,
): number => {
  let dx = Infinity;
  let dy = Infinity;

  if (ux > 1e-9) {
    dx = (dims.x2[i] - dims.x1[j]) / ux;
  } else if (ux < -1e-9) {
    dx = (dims.x1[i] - dims.x2[j]) / ux;
  }

  if (uy > 1e-9) {
    dy = (dims.y2[i] - dims.y1[j]) / uy;
  } else if (uy < -1e-9) {
    dy = (dims.y1[i] - dims.y2[j]) / uy;
  }

  return Math.max(0, Math.min(dx, dy));
};

/**
 * A box's half extent along the direction at angle `theta` — the
 * support function of the box, taking the larger side of an asymmetric
 * box.  A ring's radial band is this at each node's own angle.
 *
 * @param dims — the node-local boxes
 * @param i — which box
 * @param theta — the direction, radians
 * @returns the half extent in px
 */
export const halfExtentAlong = (
  dims: Extents,
  i: number,
  theta: number,
): number => {
  const hw = Math.max(-dims.x1[i], dims.x2[i]);
  const hh = Math.max(-dims.y1[i], dims.y2[i]);

  return Math.abs(Math.cos(theta)) * hw + Math.abs(Math.sin(theta)) * hh;
};

/** The diagonal of box `i` — its circumscribed circle's diameter. */
const diagonal = (dims: Extents, i: number): number =>
  Math.hypot(dims.x2[i] - dims.x1[i], dims.y2[i] - dims.y1[i]);

/** One ring of nodes: dims indices with the angle each sits at. */
export interface Ring {
  /** indices into the dims arrays */
  members: ArrayLike<number>;
  /** the angle of each member, radians, parallel to `members` */
  angles: ArrayLike<number>;
}

/**
 * The smallest radius at which no two nodes of `ring` overlap, given
 * that every member sits at its angle on a circle of that radius.
 * Exact per pair — each pair is separated along its own chord — and
 * only pairs that can meet are examined: members are visited in angle
 * order and the scan past each one stops as soon as the chord at the
 * running radius exceeds the pair's diagonals.
 *
 * The scan wraps past the last member — a pair across the wrap is a
 * real chord whatever the sweep, and the far side of the ring is
 * reached from the other member's scan.
 *
 * @param dims — the node-local boxes
 * @param ring — the members and their angles
 * @returns the radius, or 0 for a ring of fewer than two nodes
 */
export const ringTangentialRadius = (dims: Extents, ring: Ring): number => {
  const n = ring.members.length;

  if (n < 2) {
    return 0;
  }

  const order = new Array<number>(n);

  for (let k = 0; k < n; k++) {
    order[k] = k;
  }

  order.sort((a, b) => ring.angles[a] - ring.angles[b]);

  const diag = new Float64Array(n);
  let maxDiag = 0;

  for (let k = 0; k < n; k++) {
    diag[k] = diagonal(dims, ring.members[k]);
    maxDiag = Math.max(maxDiag, diag[k]);
  }

  let r = 0;

  for (let a = 0; a < n; a++) {
    const ka = order[a];
    const ia = ring.members[ka];
    const ta = ring.angles[ka];

    for (let step = 1; step < n; step++) {
      const b = a + step;
      const kb = order[b % n];
      const ib = ring.members[kb];
      let dTheta = ring.angles[kb] - ta;

      if (b >= n) {
        dTheta += 2 * Math.PI;
      }

      if (dTheta > Math.PI + 1e-9) {
        break; // the far side: reached from the other member's scan
      }

      // the chord between the two, as a fraction of the radius
      const cx = Math.cos(ring.angles[kb]) - Math.cos(ta);
      const cy = Math.sin(ring.angles[kb]) - Math.sin(ta);
      const chord = Math.hypot(cx, cy);

      if (chord < 1e-9) {
        continue; // coincident angles: no radius separates them
      }

      // beyond reach at the radius so far?  every later pair on this
      // scan is further around still, and r only grows — so the scan
      // ends here (the immediate neighbour is always examined)
      if (step > 1 && r * chord >= (diag[ka] + maxDiag) / 2) {
        break;
      }

      const need = separationAlong(dims, ia, ib, cx / chord, cy / chord);

      r = Math.max(r, need / chord);
    }
  }

  return r;
};

/**
 * The smallest radius `r >= rMin` at which no node of `outer`, placed
 * at its angle on a circle of radius `r`, overlaps any node of `inner`
 * placed at its angle on the circle of radius `innerR`.  Each outer
 * node's ray is intersected with the Minkowski box of every inner node
 * it can reach, giving the radius intervals where the pair overlaps;
 * the answer is the first radius past `rMin` inside none of them.
 *
 * @param dims — the node-local boxes
 * @param outer — the ring being placed
 * @param inner — the ring already placed
 * @param innerR — the inner ring's radius (0 for a centre node)
 * @param rMin — the floor
 * @returns the radius
 */
export const ringClearanceRadius = (
  dims: Extents,
  outer: Ring,
  inner: Ring,
  innerR: number,
  rMin: number,
): number => {
  const no = outer.members.length;
  const ni = inner.members.length;

  if (no === 0 || ni === 0) {
    return rMin;
  }

  // inner nodes in angle order, with their positions and reach
  const order = new Array<number>(ni);
  let maxInnerDiag = 0;

  for (let k = 0; k < ni; k++) {
    order[k] = k;
    maxInnerDiag = Math.max(maxInnerDiag, diagonal(dims, inner.members[k]));
  }

  order.sort((a, b) => inner.angles[a] - inner.angles[b]);

  const innerTheta = new Float64Array(ni);

  for (let k = 0; k < ni; k++) {
    innerTheta[k] = inner.angles[order[k]];
  }

  const lo: number[] = [];
  const hi: number[] = [];

  for (let a = 0; a < no; a++) {
    const ia = outer.members[a];
    const ta = outer.angles[a];
    const ux = Math.cos(ta);
    const uy = Math.sin(ta);
    const reach = (diagonal(dims, ia) + maxInnerDiag) / 2;

    // which inner nodes the ray passes near enough to touch: within
    // `reach` of the ray, which for a node at angular offset phi is
    // innerR · sin|phi| (or innerR itself past a right angle)
    const all = innerR <= reach;
    const window = all
      ? Math.PI
      : Math.asin(Math.min(1, reach / innerR)) + 1e-6;

    for (let k = 0; k < ni; k++) {
      let phi = innerTheta[k] - ta;

      phi =
        ((((phi + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
        Math.PI;

      if (!all && Math.abs(phi) > window) {
        continue;
      }

      const ij = inner.members[order[k]];
      const px = innerR * Math.cos(innerTheta[k]);
      const py = innerR * Math.sin(innerTheta[k]);

      // the Minkowski box: where the outer centre overlaps the inner box
      const mx1 = px + dims.x1[ij] - dims.x2[ia];
      const mx2 = px + dims.x2[ij] - dims.x1[ia];
      const my1 = py + dims.y1[ij] - dims.y2[ia];
      const my2 = py + dims.y2[ij] - dims.y1[ia];

      let tIn = -Infinity;
      let tOut = Infinity;

      if (Math.abs(ux) > 1e-9) {
        const t1 = mx1 / ux;
        const t2 = mx2 / ux;

        tIn = Math.max(tIn, Math.min(t1, t2));
        tOut = Math.min(tOut, Math.max(t1, t2));
      } else if (mx1 >= 0 || mx2 <= 0) {
        continue;
      }

      if (Math.abs(uy) > 1e-9) {
        const t1 = my1 / uy;
        const t2 = my2 / uy;

        tIn = Math.max(tIn, Math.min(t1, t2));
        tOut = Math.min(tOut, Math.max(t1, t2));
      } else if (my1 >= 0 || my2 <= 0) {
        continue;
      }

      if (tIn < tOut && tOut > rMin) {
        lo.push(tIn);
        hi.push(tOut);
      }
    }
  }

  // the first radius past rMin inside no interval
  const idx = lo.map((_v, k) => k).sort((a, b) => lo[a] - lo[b]);
  let r = rMin;

  for (const k of idx) {
    if (lo[k] < r && r < hi[k]) {
      r = hi[k];
    }
  }

  return r;
};

/**
 * The radial band an outer ring must start past: the inner ring's
 * radius plus the largest radial half extent on each ring, each node
 * measured along its own angle.  Keeps rings as rings — without it an
 * outer node whose ray misses every inner box could sit at the inner
 * radius — and, being direction-aware, a wide label at the top of a
 * ring contributes its height, not its width.
 *
 * @param dims — the node-local boxes
 * @param outer — the ring being placed
 * @param inner — the ring already placed
 * @param innerR — the inner ring's radius
 * @returns the least radius for `outer`
 */
export const ringBandRadius = (
  dims: Extents,
  outer: Ring,
  inner: Ring,
  innerR: number,
): number => {
  let eIn = 0;
  let eOut = 0;

  for (let k = 0; k < inner.members.length; k++) {
    eIn = Math.max(
      eIn,
      halfExtentAlong(dims, inner.members[k], inner.angles[k]),
    );
  }

  for (let k = 0; k < outer.members.length; k++) {
    eOut = Math.max(
      eOut,
      halfExtentAlong(dims, outer.members[k], outer.angles[k]),
    );
  }

  return innerR + eIn + eOut;
};

/**
 * The radius of a ring outside another: the largest of the tangential
 * requirement, the radial band, and the exact clearance from the inner
 * ring's boxes — the one call the ring layouts make per ring.
 *
 * @param dims — the node-local boxes
 * @param outer — the ring being placed
 * @param inner — the ring inside it, or null for the innermost ring
 * @param innerR — the inner ring's radius
 * @param rMin — the floor (a layout's own spacing rule)
 * @returns the radius
 */
export const ringRadius = (
  dims: Extents,
  outer: Ring,
  inner: Ring | null,
  innerR: number,
  rMin: number,
): number => {
  let r = Math.max(rMin, ringTangentialRadius(dims, outer));

  if (inner != null && inner.members.length > 0) {
    r = Math.max(r, ringBandRadius(dims, outer, inner, innerR));
    r = ringClearanceRadius(dims, outer, inner, innerR, r);
  }

  return r;
};

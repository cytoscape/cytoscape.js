import {
  SHAPE_ROUND_CONVEX_HULL,
  SHAPE_CONVEX_HULL,
  SHAPE_CONCAVE_HULL,
} from './contract.mjs';
import { insideShape } from './cpu-pick.mjs';
import { insideUnitPolygon } from './shape-points.mjs';

export interface Point {
  x: number;
  y: number;
}

const EPS = 1e-7;
export const MAX_HULL_VERTICES = 120;

/** Whether a style shape uses geometry synthesized from compound children.
 *
 * @param shape — the shape identifier
 * @returns whether the identifier selects one of the hull algorithms
 */
export const isHullShape = (shape: number): boolean =>
  shape === SHAPE_CONVEX_HULL ||
  shape === SHAPE_ROUND_CONVEX_HULL ||
  shape === SHAPE_CONCAVE_HULL;

/** Sample a node's actual model-space outer body contour. */
export function sampleNodeOutline(
  shape: number,
  halfW: number,
  halfH: number,
  radius: number,
  polygon: ArrayLike<number> | null,
  count = 48,
): Point[] {
  if (polygon != null && polygon.length >= 6) {
    const points: Point[] = [];

    for (let i = 0; i + 1 < polygon.length; i += 2) {
      points.push({ x: polygon[i] * halfW, y: polygon[i + 1] * halfH });
    }

    return points;
  }

  const out: Point[] = [];
  const rx = Math.max(halfW, 1e-4);
  const ry = Math.max(halfH, 1e-4);

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let lo = 0;
    let hi = Math.hypot(rx, ry) * 1.5;

    for (let j = 0; j < 24; j++) {
      const mid = (lo + hi) / 2;

      if (insideShape(shape, dx * mid, dy * mid, rx, ry, radius, 1)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    // The parent hull must contain the sampled child. A small radial
    // allowance covers the chord error between adjacent contour samples.
    const pad = Math.max(rx, ry) * (1 - Math.cos(Math.PI / count));
    out.push({ x: dx * (lo + pad), y: dy * (lo + pad) });
  }

  return out;
}

/** Compute the monotone-chain convex hull of a point set.
 *
 * @param input — the world-space points to enclose
 * @returns a counter-clockwise contour with duplicate and interior points removed
 */
export function convexHull(input: readonly Point[]): Point[] {
  return monotoneChain(dedupe(input));
}

/** Build a monotone-chain hull from points that are already unique. */
function monotoneChain(
  points: Point[],
  maxVertices = MAX_HULL_VERTICES,
): Point[] {
  points.sort((a, b) => a.x - b.x || a.y - b.y);

  if (points.length <= 2) {
    return points;
  }

  const lower: Point[] = [];

  for (const point of points) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= EPS
    ) {
      lower.pop();
    }

    lower.push(point);
  }

  const upper: Point[] = [];

  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];

    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= EPS
    ) {
      upper.pop();
    }

    upper.push(point);
  }

  lower.pop();
  upper.pop();

  return capConvexVertices(lower.concat(upper), maxVertices);
}

/** A deterministic, connected concave outline with convex fallback. */
export function concaveHull(input: readonly Point[]): Point[] {
  const points = dedupe(input);
  // Reserve two contour slots before capping the convex seed. Otherwise a
  // capped contour would exceed the GPU limit on its first inward dent and
  // fall back to convex geometry.
  const maxDents = 2;
  let hull = monotoneChain(points, MAX_HULL_VERTICES - maxDents);

  if (hull.length < 4) {
    return hull;
  }

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const span = Math.max(
    Math.max(...xs) - Math.min(...xs),
    Math.max(...ys) - Math.min(...ys),
  );
  const minDent = span * 0.015;
  // A handful of well-placed notches carries the useful concavity. Repeatedly
  // testing every possible cut after each one grows into a costly search on a
  // parent with many members, while extra notches quickly approach the GPU
  // contour cap anyway.
  let guard = Math.min(hull.length, maxDents);

  // A concave outline may bend inward only into empty space. For each long
  // edge, find the deepest notch that contains no input point and leaves one
  // simple loop. Short polygon steps already describe the children.
  while (guard-- > 0) {
    let best: { edge: number; point: Point; depth: number } | null = null;

    for (let i = 0; i < hull.length; i++) {
      const a = hull[i];
      const b = hull[(i + 1) % hull.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.hypot(dx, dy);

      if (length < span * 0.25) {
        continue;
      }

      const maxDepth = Math.min(length * 0.35, span * 0.2);
      const limit = Math.min(
        maxDepth,
        maxSafeDentDepth(a, b, length, maxDepth, points),
      );

      if (limit <= minDent) {
        continue;
      }

      let lo = 0;
      let hi = limit;
      let safe: Point | null = null;

      for (let step = 0; step < 12; step++) {
        const depth = (lo + hi) / 2;
        const point = {
          x: (a.x + b.x) / 2 - (dy / length) * depth,
          y: (a.y + b.y) / 2 + (dx / length) * depth,
        };
        if (safeInwardDent(hull, i, point)) {
          safe = point;
          lo = depth;
        } else {
          hi = depth;
        }
      }

      if (lo > minDent && (best == null || lo > best.depth)) {
        best = {
          edge: i,
          point: safe as Point,
          depth: lo,
        };
      }
    }

    if (best == null) {
      break;
    }

    hull = [
      ...hull.slice(0, best.edge + 1),
      best.point,
      ...hull.slice(best.edge + 1),
    ];
  }

  return hull.length > MAX_HULL_VERTICES ? monotoneChain(points) : hull;
}

/** Round a convex polygon outward so its contour still contains the input. */
export function roundConvexHull(
  input: readonly Point[],
  radius: number,
): Point[] {
  const hull = convexHull(input);

  if (hull.length < 3 || !(radius > 0)) {
    return hull;
  }

  const out: Point[] = [];

  for (let i = 0; i < hull.length; i++) {
    const prev = hull[(i + hull.length - 1) % hull.length];
    const curr = hull[i];
    const next = hull[(i + 1) % hull.length];
    const prevLength = distance(prev, curr);
    const nextLength = distance(curr, next);
    const r = Math.min(radius, prevLength * 0.45, nextLength * 0.45);
    const prevNormal = {
      x: (curr.y - prev.y) / prevLength,
      y: -(curr.x - prev.x) / prevLength,
    };
    const nextNormal = {
      x: (next.y - curr.y) / nextLength,
      y: -(next.x - curr.x) / nextLength,
    };
    const start = Math.atan2(prevNormal.y, prevNormal.x);
    let end = Math.atan2(nextNormal.y, nextNormal.x);

    while (end <= start) end += Math.PI * 2;

    for (let step = 0; step <= 4; step++) {
      const angle = start + ((end - start) * step) / 4;

      out.push({
        x: curr.x + Math.cos(angle) * r,
        y: curr.y + Math.sin(angle) * r,
      });
    }
  }

  return capConvexVertices(out);
}

/** A rounded rectangle contour whose extents match the styled dimensions. */
export function roundedRectangleContour(
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
): Point[] {
  const r = Math.min(radius, width / 2, height / 2);
  const coreW = Math.max(0, width - 2 * r);
  const coreH = Math.max(0, height - 2 * r);
  const corners = [
    { x: cx - coreW / 2, y: cy - coreH / 2 },
    { x: cx + coreW / 2, y: cy - coreH / 2 },
    { x: cx + coreW / 2, y: cy + coreH / 2 },
    { x: cx - coreW / 2, y: cy + coreH / 2 },
  ];

  return roundConvexHull(corners, r);
}

/** Return the selected automatic hull for a world-space point cloud. */
export function compoundHull(
  shape: number,
  points: readonly Point[],
  cornerRadius = 8,
): Point[] {
  switch (shape) {
    case SHAPE_ROUND_CONVEX_HULL:
      return roundConvexHull(points, cornerRadius);
    case SHAPE_CONCAVE_HULL:
      return concaveHull(points);
    default:
      return convexHull(points);
  }
}

/** Convert a world-space contour to unit coordinates around its center. */
export function normalizeContour(
  points: readonly Point[],
  halfW: number,
  halfH: number,
): number[] {
  const out: number[] = [];

  for (const point of points) {
    out.push(point.x / halfW, point.y / halfH);
  }

  // Point coordinates are passed in parent-local coordinates by caller.
  return out;
}

/** True for points inside the dynamic unit contour, including its edge. */
export function insideContour(
  points: ArrayLike<number>,
  x: number,
  y: number,
): boolean {
  if (points.length < 6) {
    return false;
  }

  if (insideUnitPolygon(points, x, y)) {
    return true;
  }

  // Even-odd tests can miss exact edges; treat a 1e-6 unit band as ink.
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    if (
      segmentDistanceSq(
        x,
        y,
        points[j],
        points[j + 1],
        points[i],
        points[i + 1],
      ) <= 1e-12
    ) {
      return true;
    }
  }

  return false;
}

/** Check only the two new segments of a proposed inward edge bend.
 *
 * The current contour is already simple. The analytic depth bound from
 * `maxSafeDentDepth()` preserves input containment; only the two replacement
 * segments can introduce a crossing.
 */
function safeInwardDent(
  hull: readonly Point[],
  edge: number,
  point: Point,
): boolean {
  const a = hull[edge];
  const b = hull[(edge + 1) % hull.length];
  const previous = (edge + hull.length - 1) % hull.length;
  const next = (edge + 2) % hull.length;

  for (let i = 0; i < hull.length; i++) {
    if (i === previous || i === edge || i === next) continue;

    const c = hull[i];
    const d = hull[(i + 1) % hull.length];

    if (
      segmentsIntersect(a, point, c, d) ||
      segmentsIntersect(point, b, c, d)
    ) {
      return false;
    }
  }

  return true;
}

/** Find the deepest inward dent whose removed triangle holds no input point.
 *
 * A point at inward distance `t` and along-edge distance `s` first enters the
 * removed triangle at depth `t / (1 - 2 * abs(s) / length)`. The triangles
 * grow monotonically with depth, so the nearest such point bounds every
 * deeper candidate without rescanning all inputs during the segment checks.
 */
function maxSafeDentDepth(
  a: Point,
  b: Point,
  length: number,
  maxDepth: number,
  points: readonly Point[],
): number {
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const midX = (a.x + b.x) / 2;
  const midY = (a.y + b.y) / 2;
  let safeDepth = maxDepth;

  for (const point of points) {
    const dx = point.x - midX;
    const dy = point.y - midY;
    const along = dx * ux + dy * uy;

    if (Math.abs(along) >= length / 2 - EPS) continue;

    const inward = ux * dy - uy * dx;

    if (inward <= EPS) {
      return 0;
    }

    if (inward > safeDepth) continue;

    const widthAtPoint = 1 - (2 * Math.abs(along)) / length;
    const pointDepth = inward / widthAtPoint;

    if (pointDepth < safeDepth) {
      safeDepth = pointDepth;
    }
  }

  return safeDepth;
}

function capConvexVertices(
  points: Point[],
  maxVertices = MAX_HULL_VERTICES,
): Point[] {
  if (points.length <= maxVertices) {
    return points;
  }

  const step = points.length / maxVertices;
  const indices = Array.from({ length: maxVertices }, (_, i) =>
    Math.floor(i * step),
  );
  const selected = indices.map((index) => points[index]);
  let maxInset = 0;

  // Evenly retain contour points, then measure how far each skipped
  // point lies inside its new chord. The offset below restores that
  // sagitta, keeping the bounded contour conservative.
  for (let i = 0; i < indices.length; i++) {
    const start = indices[i];
    const end = i + 1 < indices.length ? indices[i + 1] : points.length;
    const a = selected[i];
    const b = selected[(i + 1) % selected.length];
    const length = distance(a, b);

    for (let j = start + 1; j < end; j++) {
      maxInset = Math.max(maxInset, -cross(a, b, points[j]) / length);
    }
  }

  if (!(maxInset > EPS)) {
    return selected;
  }

  return selected.map((point, i) => {
    const previous = selected[(i + selected.length - 1) % selected.length];
    const next = selected[(i + 1) % selected.length];
    const prevLength = distance(previous, point);
    const nextLength = distance(point, next);
    const n1 = {
      x: (point.y - previous.y) / prevLength,
      y: -(point.x - previous.x) / prevLength,
    };
    const n2 = {
      x: (next.y - point.y) / nextLength,
      y: -(next.x - point.x) / nextLength,
    };
    const det = n1.x * n2.y - n1.y * n2.x;

    if (Math.abs(det) < 1e-8) {
      const nx = n1.x + n2.x;
      const ny = n1.y + n2.y;
      const norm = Math.hypot(nx, ny) || 1;

      return {
        x: point.x + (nx / norm) * maxInset,
        y: point.y + (ny / norm) * maxInset,
      };
    }

    const dx = (maxInset * (n2.y - n1.y)) / det;
    const dy = (maxInset * (n1.x - n2.x)) / det;

    return { x: point.x + dx, y: point.y + dy };
  });
}

function dedupe(points: readonly Point[]): Point[] {
  const seen = new Set<string>();
  const out: Point[] = [];

  for (const p of points) {
    const key = `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)}`;

    if (!seen.has(key) && Number.isFinite(p.x) && Number.isFinite(p.y)) {
      seen.add(key);
      out.push(p);
    }
  }

  return out;
}

function cross(a: Point, b: Point, c: Point): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);

  return abC * abD < -EPS && cdA * cdB < -EPS;
}

function segmentDistanceSq(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  const t =
    denom > 0
      ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / denom))
      : 0;
  const x = px - (ax + dx * t);
  const y = py - (ay + dy * t);

  return x * x + y * y;
}

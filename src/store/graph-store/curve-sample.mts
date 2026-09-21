// The store's exact curved-edge bounds sampling (round 130 split), shared
// by `curveBBAt` and `curveBBAtPositions` in ./curves.mts.

import {
  CURVE_SEGS,
  curvePointAt,
  routeVertex,
} from '../../curve-geometry.mjs';
import type { CurveEval, CurveRoute } from '../../curve-geometry.mjs';

/** scratch for the straight-endpoint shortenings — the geometry readers
 * never allocate on the hot path */
export const shortenScratch = { x: 0, y: 0 };

/** scratch point for the exact-curve-bb sampling below */
const sampleScratch = { x: 0, y: 0 };

/** Hull of a curved edge's flattened polyline at the drawn subdivision —
 * the sampling shared by `curveBBAt` (live centres, memoized by its
 * caller) and `curveBBAtPositions` (hypothetical centres, unmemoized).
 * Exactly one of `ev`/`route` is non-null. */
export const sampleCurveBB = (
  ev: CurveEval | null,
  route: CurveRoute | null,
): { x1: number; y1: number; x2: number; y2: number } => {
  const p = sampleScratch;
  let x1 = Infinity,
    y1 = Infinity,
    x2 = -Infinity,
    y2 = -Infinity;

  for (let i = 0; i <= CURVE_SEGS; i++) {
    if (ev != null) {
      curvePointAt(ev, i / CURVE_SEGS, p);
    } else {
      routeVertex(route as CurveRoute, i, p);
    }

    if (p.x < x1) {
      x1 = p.x;
    }
    if (p.y < y1) {
      y1 = p.y;
    }
    if (p.x > x2) {
      x2 = p.x;
    }
    if (p.y > y2) {
      y2 = p.y;
    }
  }

  return { x1, y1, x2, y2 };
};

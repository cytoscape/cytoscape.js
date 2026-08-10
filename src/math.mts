// Generic geometry/number helpers.
//
// Round 42 copied these from v3's `src/math.mts` when v4 became the package
// and v3 moved to `v3/`. Only the members v4 actually imports travelled —
// v3's file is 1500 lines of canvas-renderer intersection maths that v4
// answers on the GPU or in `curve-geometry.mts`, and carrying it wholesale
// would have put a thousand undocumented lines inside the audits' scope.
// Every function below is byte-identical to its v3 original.

import type { BoundingBox } from './types.mjs';

/**
 * An implicit, partial bounding box spec: `x1`/`y1` plus either `x2`/`y2`
 * or `w`/`h` (as accepted by `makeBoundingBox()`).
 */
export interface InputBoundingBox {
  x1?: number | null;
  y1?: number | null;
  x2?: number | null;
  y2?: number | null;
  w?: number | null;
  h?: number | null;
}

/** The numeric-range shape the stats helpers accept (round 65.8:
 * affinity propagation hands a Float64Array similarity matrix). */
export type NumericArray = number[] | Float64Array;

/**
 * The smallest finite value in a numeric range; non-finite entries are
 * skipped rather than poisoning the result.
 *
 * @param arr — the values
 * @param begin — first index to consider (default 0)
 * @param end — index to stop before (default `arr.length`)
 * @returns the minimum, or `Infinity` when the range holds no finite value
 */
export const min = (
  arr: NumericArray,
  begin: number = 0,
  end: number = arr.length,
): number => {
  let min = Infinity;

  for (let i = begin; i < end; i++) {
    let val = arr[i];

    if (isFinite(val)) {
      min = Math.min(val, min);
    }
  }

  return min;
};

/**
 * The largest finite value in a numeric range; non-finite entries are
 * skipped rather than poisoning the result.
 *
 * @param arr — the values
 * @param begin — first index to consider (default 0)
 * @param end — index to stop before (default `arr.length`)
 * @returns the maximum, or `-Infinity` when the range holds no finite value
 */
export const max = (
  arr: NumericArray,
  begin: number = 0,
  end: number = arr.length,
): number => {
  let max = -Infinity;

  for (let i = begin; i < end; i++) {
    let val = arr[i];

    if (isFinite(val)) {
      max = Math.max(val, max);
    }
  }

  return max;
};

/**
 * The arithmetic mean of the finite values in a numeric range.
 *
 * @param arr — the values
 * @param begin — first index to consider (default 0)
 * @param end — index to stop before (default `arr.length`)
 * @returns the mean, or `NaN` when the range holds no finite value
 */
export const mean = (
  arr: NumericArray,
  begin: number = 0,
  end: number = arr.length,
): number => {
  let total = 0;
  let n = 0;

  for (let i = begin; i < end; i++) {
    let val = arr[i];

    if (isFinite(val)) {
      total += val;
      n++;
    }
  }

  return total / n;
};

/**
 * The median of a numeric range, with v3's hole handling: non-finite entries
 * either sort to the front and are excluded from the middle (`includeHoles`)
 * or are removed outright.
 *
 * @param arr — the values
 * @param begin — first index to consider (default 0)
 * @param end — index to stop before (default `arr.length`)
 * @param copy — work on a copy, leaving the caller's array untouched (default true)
 * @param sort — sort before taking the middle; pass false for pre-sorted input
 * @param includeHoles — keep non-finite entries as `-Infinity` at the front
 *   instead of splicing them out
 * @returns the median value
 */
export const median = (
  arr: NumericArray,
  begin: number = 0,
  end: number = arr.length,
  copy: boolean = true,
  sort: boolean = true,
  includeHoles: boolean = true,
): number => {
  if (copy) {
    arr = arr.slice(begin, end) as NumericArray;
  } else {
    // in-place trimming needs a real array; typed callers must keep
    // the default copy = true
    (arr as number[]).splice(end, arr.length - end);

    if (begin > 0) {
      (arr as number[]).splice(0, begin);
    }
  }

  // all non finite (e.g. Infinity, NaN) elements must be -Infinity so they go to the start
  let off = 0; // offset from non-finite values
  for (let i = arr.length - 1; i >= 0; i--) {
    let v = arr[i];

    if (includeHoles) {
      if (!isFinite(v)) {
        arr[i] = -Infinity;
        off++;
      }
    } else {
      // just remove it if we don't want to consider holes (needs a
      // real array; typed callers must keep includeHoles = true)
      (arr as number[]).splice(i, 1);
    }
  }

  if (sort) {
    // requires copy = true if you don't want to change the orig.  A
    // typed array sorts numerically without a comparator — and an
    // order of magnitude faster (no JS call per comparison), which
    // matters at affinity propagation's n² input (round 65.8).  Any
    // non-finites were rewritten to -Infinity above, so the two paths
    // order identically.
    if (ArrayBuffer.isView(arr)) {
      arr.sort();
    } else {
      arr.sort((a, b) => a - b);
    }
  }

  let len = arr.length;
  let mid = Math.floor(len / 2);

  if (len % 2 !== 0) {
    return arr[mid + 1 + off];
  } else {
    return (arr[mid - 1 + off] + arr[mid + off]) / 2;
  }
};

/** Called with no (or nullish) input, returns a default (cleared) bb; otherwise full bb or undefined for invalid input. */
interface MakeBoundingBoxFn {
  (): BoundingBox;
  (bb: InputBoundingBox | null | undefined): BoundingBox | undefined;
}

/**
 * Expand an implicit box spec into a full `{ x1, y1, x2, y2, w, h }` box.
 *
 * @param bb — `x1`/`y1` plus either `x2`/`y2` or `w`/`h`; nullish yields a
 *   cleared box (infinite extents, zero size) ready to be expanded into
 * @returns the full box, or `undefined` when the spec is neither form
 */
export const makeBoundingBox = ((
  bb?: InputBoundingBox | null,
): BoundingBox | undefined => {
  if (bb == null) {
    return {
      x1: Infinity,
      y1: Infinity,
      x2: -Infinity,
      y2: -Infinity,
      w: 0,
      h: 0,
    };
  } else if (bb.x1 != null && bb.y1 != null) {
    if (bb.x2 != null && bb.y2 != null && bb.x2 >= bb.x1 && bb.y2 >= bb.y1) {
      return {
        x1: bb.x1,
        y1: bb.y1,
        x2: bb.x2,
        y2: bb.y2,
        w: bb.x2 - bb.x1,
        h: bb.y2 - bb.y1,
      };
    } else if (bb.w != null && bb.h != null && bb.w >= 0 && bb.h >= 0) {
      return {
        x1: bb.x1,
        y1: bb.y1,
        x2: bb.x1 + bb.w,
        y2: bb.y1 + bb.h,
        w: bb.w,
        h: bb.h,
      };
    }
  }
}) as MakeBoundingBoxFn;

/**
 * Grow a box in place so it contains a point, keeping `w`/`h` consistent.
 *
 * @param bb — the box, mutated
 * @param x — the point's x
 * @param y — the point's y
 * @returns nothing; the box is updated in place
 */
export const expandBoundingBoxByPoint = (
  bb: BoundingBox,
  x: number,
  y: number,
): void => {
  bb.x1 = Math.min(bb.x1, x);
  bb.x2 = Math.max(bb.x2, x);
  bb.w = bb.x2 - bb.x1;

  bb.y1 = Math.min(bb.y1, y);
  bb.y2 = Math.max(bb.y2, y);
  bb.h = bb.y2 - bb.y1;
};

/**
 * Unit polygon points stretched to fill the [-1, 1] square — the form node
 * shapes are stored in.
 *
 * @param sides — number of sides
 * @param rotationRadians — rotation applied before fitting
 * @returns flat `[x0, y0, x1, y1, ...]` pairs
 */
export const generateUnitNgonPointsFitToSquare = (
  sides: number,
  rotationRadians: number,
): number[] => {
  let points = generateUnitNgonPoints(sides, rotationRadians);
  points = fitPolygonToSquare(points);

  return points;
};

/**
 * Stretch a point list in place so its extents fill the [-1, 1] square,
 * shifting up if the fit pushed the bottom below -1.
 *
 * @param points — flat `[x0, y0, ...]` pairs, mutated
 * @returns the same array, for chaining
 */
export const fitPolygonToSquare = (points: number[]): number[] => {
  let x: number, y: number;
  let sides = points.length / 2;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0; i < sides; i++) {
    x = points[2 * i];
    y = points[2 * i + 1];

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  // stretch factors
  let sx = 2 / (maxX - minX);
  let sy = 2 / (maxY - minY);

  for (let i = 0; i < sides; i++) {
    x = points[2 * i] = points[2 * i] * sx;
    y = points[2 * i + 1] = points[2 * i + 1] * sy;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  if (minY < -1) {
    for (let i = 0; i < sides; i++) {
      points[2 * i + 1] = points[2 * i + 1] + (-1 - minY);
    }
  }

  return points;
};

/**
 * The vertices of a regular polygon on the unit circle, starting at the top
 * and running clockwise in screen coordinates (y down).
 *
 * @param sides — number of sides
 * @param rotationRadians — rotation added to the start angle
 * @returns flat `[x0, y0, x1, y1, ...]` pairs
 */
export const generateUnitNgonPoints = (
  sides: number,
  rotationRadians: number,
): number[] => {
  let increment = (1.0 / sides) * 2 * Math.PI;
  let startAngle =
    sides % 2 === 0 ? Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;

  startAngle += rotationRadians;

  let points: number[] = new Array(sides * 2);

  let currentAngle: number;
  for (let i = 0; i < sides; i++) {
    currentAngle = i * increment + startAngle;

    points[2 * i] = Math.cos(currentAngle); // x
    points[2 * i + 1] = Math.sin(-currentAngle); // y
  }

  return points;
};

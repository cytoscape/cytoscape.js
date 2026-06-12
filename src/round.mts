/**
 * Explained by Blindman67 at https://stackoverflow.com/a/44856925/11028828
 */

import type { Position } from './types.mjs';

/** A path point, optionally with a per-point corner radius */
export interface RoundCornerPoint extends Position {
  radius?: number;
}

/** A round corner computed by {@link getRoundCorner} */
export interface RoundCorner {
  cx: number;
  cy: number;
  radius: number;
  startX: number;
  startY: number;
  stopX: number;
  stopY: number;
  startAngle: number | undefined;
  endAngle: number | undefined;
  counterClockwise: boolean | undefined;
}

// 2D vector in cartesian, polar, and normalised forms; fields are filled in by asVec()
interface Vec {
  x: number;
  y: number;
  len: number;
  nx: number;
  ny: number;
  ang: number;
}

// Declare reused variable to avoid reallocating variables every time the function is called
let x: number, y: number, v1 = {} as Vec, v2 = {} as Vec, sinA: number, sinA90: number, radDirection: number, drawDirection: boolean, angle: number, halfAngle: number, cRadius: number, lenOut: number, radius: number, limit: number;
let startX: number, startY: number, stopX: number, stopY: number;
let lastPoint: RoundCornerPoint | undefined;

// convert 2 points into vector form, polar form, and normalised
const asVec = function (p: Position, pp: Position, v: Vec): void {
  v.x = pp.x - p.x;
  v.y = pp.y - p.y;
  v.len = Math.sqrt(v.x * v.x + v.y * v.y);
  v.nx = v.x / v.len;
  v.ny = v.y / v.len;
  v.ang = Math.atan2(v.ny, v.nx);
};

const invertVec = function (originalV: Vec, invertedV: Vec): void {
  invertedV.x = originalV.x * -1;
  invertedV.y = originalV.y * -1;
  invertedV.nx = originalV.nx * -1;
  invertedV.ny = originalV.ny * -1;
  invertedV.ang = originalV.ang > 0 ? -(Math.PI - originalV.ang) : Math.PI + originalV.ang;
};

const calcCornerArc = (previousPoint: RoundCornerPoint, currentPoint: RoundCornerPoint, nextPoint: RoundCornerPoint, radiusMax: number, isArcRadius: boolean): void => {
  //-----------------------------------------
  // Part 1
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions -- original code uses a bare ternary for the conditional call
  previousPoint !== lastPoint ? asVec(currentPoint, previousPoint, v1) : invertVec(v2, v1); // Avoid recalculating vec if it is the invert of the last one calculated
  asVec(currentPoint, nextPoint, v2);
  sinA = v1.nx * v2.ny - v1.ny * v2.nx;
  sinA90 = v1.nx * v2.nx - v1.ny * -v2.ny;
  angle = Math.asin(Math.max(-1, Math.min(1, sinA)));
  if (Math.abs(angle) < 1e-6) {
    x = currentPoint.x;
    y = currentPoint.y;
    cRadius = radius = 0;
    return;
  }
  //-----------------------------------------
  radDirection = 1;
  drawDirection = false;
  if (sinA90 < 0) {
    if (angle < 0) {
      angle = Math.PI + angle;
    } else {
      angle = Math.PI - angle;
      radDirection = -1;
      drawDirection = true;
    }
  } else {
    if (angle > 0) {
      radDirection = -1;
      drawDirection = true;
    }
  }
  if (currentPoint.radius !== undefined) {
    radius = currentPoint.radius;
  } else {
    radius = radiusMax;
  }
  //-----------------------------------------
  // Part 2
  halfAngle = angle / 2;
  //-----------------------------------------


  limit = Math.min(v1.len / 2, v2.len / 2);

  if (isArcRadius) {
    //-----------------------------------------
    // Part 3
    lenOut = Math.abs(Math.cos(halfAngle) * radius / Math.sin(halfAngle));

    //-----------------------------------------
    // Special part A
    if (lenOut > limit) {
      lenOut = limit;
      cRadius = Math.abs(lenOut * Math.sin(halfAngle) / Math.cos(halfAngle));
    } else {
      cRadius = radius;
    }
  } else {
    lenOut = Math.min(limit, radius);
    cRadius = Math.abs(lenOut * Math.sin(halfAngle) / Math.cos(halfAngle));
  }
  //-----------------------------------------



  //-----------------------------------------
  // Part 4
  stopX = currentPoint.x + v2.nx * lenOut;
  stopY = currentPoint.y + v2.ny * lenOut;
  //-----------------------------------------
  // Part 5
  x = stopX - v2.ny * cRadius * radDirection;
  y = stopY + v2.nx * cRadius * radDirection;
  //-----------------------------------------
  // Additional Part : calculate start point E
  startX = currentPoint.x + v1.nx * lenOut;
  startY = currentPoint.y + v1.ny * lenOut;

  // Save last point to avoid recalculating vector when not needed
  lastPoint = currentPoint;
};


/**
 * Draw round corner from a point and its previous and next neighbours in a path
 *
 * @param ctx :CanvasRenderingContext2D
 * @param previousPoint {{x: number, y:number, radius: number?}}
 * @param currentPoint {{x: number, y:number, radius: number?}}
 * @param nextPoint {{x: number, y:number, radius: number?}}
 * @param radiusMax :number
 * @param isArcRadius :boolean
 */
export function drawRoundCorner(ctx: CanvasRenderingContext2D, previousPoint: RoundCornerPoint, currentPoint: RoundCornerPoint, nextPoint: RoundCornerPoint, radiusMax: number, isArcRadius: boolean): void {
  calcCornerArc(previousPoint, currentPoint, nextPoint, radiusMax, isArcRadius);
  if (cRadius === 0) ctx.lineTo(currentPoint.x, currentPoint.y);
  else ctx.arc(x, y, cRadius, v1.ang + Math.PI / 2 * radDirection, v2.ang - Math.PI / 2 * radDirection, drawDirection);

}

/**
 * Draw corner provided by {@link getRoundCorner}
 *
 * @param ctx :CanvasRenderingContext2D
 * @param roundCorner {{cx:number, cy:number, radius:number, endAngle: number, startAngle: number, counterClockwise: boolean}}
 */
export function drawPreparedRoundCorner(ctx: CanvasRenderingContext2D, roundCorner: RoundCorner): void {
  if (roundCorner.radius === 0) ctx.lineTo(roundCorner.cx, roundCorner.cy);
  else ctx.arc(roundCorner.cx, roundCorner.cy, roundCorner.radius, roundCorner.startAngle!, roundCorner.endAngle!, roundCorner.counterClockwise); // angles are always set when radius > 0
}

/**
 * Get round corner from a point and its previous and next neighbours in a path
 *
 * @param previousPoint {{x: number, y:number, radius: number?}}
 * @param currentPoint {{x: number, y:number, radius: number?}}
 * @param nextPoint {{x: number, y:number, radius: number?}}
 * @param radiusMax :number
 * @param isArcRadius :boolean
 * @return {{
 * cx:number, cy:number, radius:number,
 * startX:number, startY:number,
 * stopX:number, stopY: number,
 * endAngle: number, startAngle: number, counterClockwise: boolean
 * }}
 */
export function getRoundCorner(previousPoint: RoundCornerPoint, currentPoint: RoundCornerPoint, nextPoint: RoundCornerPoint, radiusMax: number, isArcRadius = true): RoundCorner {
  if (radiusMax === 0 || currentPoint.radius === 0) return {
    cx: currentPoint.x,
    cy: currentPoint.y,
    radius: 0,
    startX: currentPoint.x,
    startY: currentPoint.y,
    stopX: currentPoint.x,
    stopY: currentPoint.y,
    startAngle: undefined,
    endAngle: undefined,
    counterClockwise: undefined
  };

  calcCornerArc(previousPoint, currentPoint, nextPoint, radiusMax, isArcRadius);
  return {
    cx: x, cy: y, radius: cRadius,
    startX, startY,
    stopX, stopY,
    startAngle: v1.ang + Math.PI / 2 * radDirection,
    endAngle: v2.ang - Math.PI / 2 * radDirection,
    counterClockwise: drawDirection
  };
}

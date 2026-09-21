import { boundaryOffset } from './bezier.mjs';
import {
  EDGE_DIST_NODE_POSITION,
  TAXI_AUTO,
  TAXI_VERTICAL,
  TAXI_UPWARD,
  TAXI_DOWNWARD,
  TAXI_LEFTWARD,
  TAXI_RIGHTWARD,
  subDWH,
} from './route.mjs';
import type { CurveRoute } from './route.mjs';

const boundaryScratch = { x: 0, y: 0 };

/**
 * The point where a route leaving the node centre `(cx, cy)` toward
 * `(towardX, towardY)` crosses the node's boundary, written into the
 * module scratch (the evaluators never allocate on the hot path).  Used by
 * `evalRoute` and `evalTaxi`, so exported across the round-130 split.
 */
export const setRouteBoundary = (
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  shape: number,
  towardX: number,
  towardY: number,
): { x: number; y: number } => {
  let dx = towardX - cx;
  let dy = towardY - cy;
  const l = Math.sqrt(dx * dx + dy * dy);

  if (l < 1e-6) {
    dx = 1;
    dy = 0;
  } else {
    dx /= l;
    dy /= l;
  }

  const off = boundaryOffset(shape, halfW, halfH, dx, dy);

  boundaryScratch.x = cx + dx * off;
  boundaryScratch.y = cy + dy * off;

  return boundaryScratch;
};

/** v3's findTaxiPoints, verbatim (blob record: dir, turn, turnMode,
 * minD, bodyMode, round, radius, arcMode).  `turnMode` is 0 for a px
 * turn, 1 for a percent turn and 2 for `taxi-turn: auto` (round 124),
 * where the px turn is `track` — the params header's n lane, written by
 * the store's track pass from live positions. */
export const evalTaxi = (
  out: CurveRoute,
  blob: ArrayLike<number>,
  off: number,
  track: number,
  sxC: number,
  syC: number,
  sHalfW: number,
  sHalfH: number,
  txC: number,
  tyC: number,
  tHalfW: number,
  tHalfH: number,
): void => {
  const rawDir = blob[off];
  const turnMode = blob[off + 2];
  const turnIsAuto = turnMode === 2;
  const turnIsPercent = turnMode === 1;
  const turnVal = turnIsAuto ? track : blob[off + 1];
  const minD = blob[off + 3];
  const dIncludesNodeBody = blob[off + 4] !== EDGE_DIST_NODE_POSITION;
  const round = blob[off + 5] !== 0;
  const radiusVal = blob[off + 6];
  const arcFlag = blob[off + 7] !== 0 ? 1 : 0;

  const srcW = sHalfW * 2;
  const srcH = sHalfH * 2;
  const tgtW = tHalfW * 2;
  const tgtH = tHalfH * 2;

  const turnIsNegative = turnVal < 0;
  const dw = dIncludesNodeBody ? (srcW + tgtW) / 2 : 0;
  const dh = dIncludesNodeBody ? (srcH + tgtH) / 2 : 0;
  const pdx = txC - sxC;
  const pdy = tyC - syC;
  const dx = subDWH(pdx, dw);
  const dy = subDWH(pdy, dh);

  let isVert: boolean;
  let isExplicitDir = false;

  if (rawDir === TAXI_AUTO) {
    isVert = !(Math.abs(dx) > Math.abs(dy));
  } else if (rawDir === TAXI_UPWARD || rawDir === TAXI_DOWNWARD) {
    isVert = true;
    isExplicitDir = true;
  } else if (rawDir === TAXI_LEFTWARD || rawDir === TAXI_RIGHTWARD) {
    isVert = false;
    isExplicitDir = true;
  } else {
    isVert = rawDir === TAXI_VERTICAL;
  }

  let l = isVert ? dy : dx;
  const pl = isVert ? pdy : pdx;
  let sgnL = Math.sign(pl);

  let forcedDir = false;

  // an auto turn routes toward the target like a percent turn: the
  // forced-direction rule never applies to it
  if (
    !(isExplicitDir && (turnIsPercent || turnIsNegative || turnIsAuto)) &&
    ((rawDir === TAXI_DOWNWARD && pl < 0) ||
      (rawDir === TAXI_UPWARD && pl > 0) ||
      (rawDir === TAXI_LEFTWARD && pl > 0) ||
      (rawDir === TAXI_RIGHTWARD && pl < 0))
  ) {
    sgnL *= -1;
    l = sgnL * Math.abs(l);
    forcedDir = true;
  }

  let d: number;

  if (turnIsPercent) {
    const p = turnVal < 0 ? 1 + turnVal : turnVal;

    d = p * l;
  } else {
    const k = turnVal < 0 ? l : 0;

    d = k + turnVal * sgnL;
  }

  const isTooClose = (v: number): boolean =>
    Math.abs(v) < minD || Math.abs(v) >= Math.abs(l);
  const tooClose = isTooClose(d) || isTooClose(Math.abs(l) - Math.abs(d));

  if (tooClose && !forcedDir) {
    // non-ideal routing: Z- and L-shape fallbacks
    if (isVert) {
      const lShapeInsideSrc = Math.abs(pl) <= srcH / 2;
      const lShapeInsideTgt = Math.abs(pdx) <= tgtW / 2;

      if (lShapeInsideSrc) {
        // horizontal Z-shape
        const x = (sxC + txC) / 2;

        out.n = 2;
        out.qx[1] = x;
        out.qy[1] = syC;
        out.qx[2] = x;
        out.qy[2] = tyC;
      } else if (lShapeInsideTgt) {
        // vertical Z-shape
        const y = (syC + tyC) / 2;

        out.n = 2;
        out.qx[1] = sxC;
        out.qy[1] = y;
        out.qx[2] = txC;
        out.qy[2] = y;
      } else {
        // L-shape
        out.n = 1;
        out.qx[1] = sxC;
        out.qy[1] = tyC;
      }
    } else {
      const lShapeInsideSrc = Math.abs(pl) <= srcW / 2;
      const lShapeInsideTgt = Math.abs(pdy) <= tgtH / 2;

      if (lShapeInsideSrc) {
        // vertical Z-shape
        const y = (syC + tyC) / 2;

        out.n = 2;
        out.qx[1] = sxC;
        out.qy[1] = y;
        out.qx[2] = txC;
        out.qy[2] = y;
      } else if (lShapeInsideTgt) {
        // horizontal Z-shape
        const x = (sxC + txC) / 2;

        out.n = 2;
        out.qx[1] = x;
        out.qy[1] = syC;
        out.qx[2] = x;
        out.qy[2] = tyC;
      } else {
        // L-shape
        out.n = 1;
        out.qx[1] = txC;
        out.qy[1] = syC;
      }
    }
  } else {
    // ideal routing
    if (isVert) {
      const y = syC + d + (dIncludesNodeBody ? (srcH / 2) * sgnL : 0);

      out.n = 2;
      out.qx[1] = sxC;
      out.qy[1] = y;
      out.qx[2] = txC;
      out.qy[2] = y;
    } else {
      const x = sxC + d + (dIncludesNodeBody ? (srcW / 2) * sgnL : 0);

      out.n = 2;
      out.qx[1] = x;
      out.qy[1] = syC;
      out.qx[2] = x;
      out.qy[2] = tyC;
    }
  }

  out.round = round;

  if (round) {
    for (let i = 0; i < out.n; i++) {
      out.radius[i] = radiusVal;
      out.arcMode[i] = arcFlag;
    }
  }
};

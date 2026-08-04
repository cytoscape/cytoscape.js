import type { Position, BoundingBox } from '../types.mjs';

/**
 * Rotate a point about a centre.
 *
 * @param x — the point's x
 * @param y — the point's y
 * @param centerX — centre of rotation, x
 * @param centerY — centre of rotation, y
 * @param angleDegrees — rotation angle in degrees
 * @returns the rotated position
 */
export function rotatePoint(x: number, y: number, centerX: number, centerY: number, angleDegrees: number): Position {
  const angleRadians = (angleDegrees * Math.PI) / 180;
  const rotatedX =
    Math.cos(angleRadians) * (x - centerX) -
    Math.sin(angleRadians) * (y - centerY) +
    centerX;
  const rotatedY =
    Math.sin(angleRadians) * (x - centerX) +
    Math.cos(angleRadians) * (y - centerY) +
    centerY;
  return { x: rotatedX, y: rotatedY };
}

/**
 * Scale a point away from a centre by a per-axis factor — the skew half of
 * rotating within a non-square box.
 *
 * @param x — the point's x
 * @param y — the point's y
 * @param boxX — centre x
 * @param boxY — centre y
 * @param skewX — x scale factor
 * @param skewY — y scale factor
 * @returns the moved position
 */
export const movePointByBoxAspect = (x: number, y: number, boxX: number, boxY: number, skewX: number, skewY: number): Position => ({
  x: (x - boxX) * skewX + boxX,
  y: (y - boxY) * skewY + boxY
});

/**
 * Rotate a position about a box's centre and re-skew it by the box's aspect
 * ratio, so the box's proportions survive the rotation.
 *
 * @param pos — the position to transform
 * @param box — the reference box (its centre and aspect ratio are used)
 * @param angleDegrees — rotation angle in degrees; 0 returns `pos` unchanged
 * @returns the transformed position
 */
export function rotatePosAndSkewByBox(pos: Position, box: BoundingBox, angleDegrees: number): Position {
  if (angleDegrees === 0) return pos;
  const centerX = (box.x1 + box.x2) / 2;
  const centerY = (box.y1 + box.y2) / 2;
  const skewX = box.w / box.h;
  const skewY = 1 / skewX;

  const rotated = rotatePoint(pos.x, pos.y, centerX, centerY, angleDegrees);
  const skewed = movePointByBoxAspect(rotated.x, rotated.y, centerX, centerY, skewX, skewY);

  return {
    x: skewed.x,
    y: skewed.y,
  };
};
export function rotatePoint(x, y, centerX, centerY, angleDegrees) {
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

export const skewPointInBox = (x, y, boxX, boxY, skewX, skewY) => ({
  x: (x - boxX) * skewX + boxX,
  y: (y - boxY) * skewY + boxY
});

export const rotatePos90LeftAndSkewByBox = function( pos, box ) {
  const centerX = (box.x1 + box.x2) / 2;
  const centerY = (box.y1 + box.y2) / 2;
  const skewX = box.w / box.h;
  const skewY = 1 / skewX;
  const angleDegrees = -90;

  const rotated = rotatePoint(pos.x, pos.y, centerX, centerY, angleDegrees);
  const skewed = skewPointInBox(rotated.x, rotated.y, centerX, centerY, skewX, skewY);
  
  return {
    x: skewed.x,
    y: skewed.y,
  };
};
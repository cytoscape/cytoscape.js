import { expect } from 'chai';
import {
  concaveHull,
  convexHull,
  insideContour,
  MAX_HULL_VERTICES,
  normalizeContour,
  roundConvexHull,
} from '../../src/compound-hulls.mjs';

const area = (points) => {
  let twice = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];

    twice += a.x * b.y - b.x * a.y;
  }

  return Math.abs(twice) / 2;
};

const isInside = (points, point) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x1 = Math.min(...xs);
  const y1 = Math.min(...ys);
  const halfW = (Math.max(...xs) - x1) / 2;
  const halfH = (Math.max(...ys) - y1) / 2;
  const centerX = x1 + halfW;
  const centerY = y1 + halfH;
  const normalized = normalizeContour(
    points.map((p) => ({ x: p.x - centerX, y: p.y - centerY })),
    halfW,
    halfH,
  );

  return insideContour(
    normalized,
    (point.x - centerX) / halfW,
    (point.y - centerY) / halfH,
  );
};

const circleSamples = (cx, cy, radius, count = 48) =>
  Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count;

    return {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    };
  });

describe('compound hull geometry', function () {
  it('makes a single concave loop that contains the three child outlines and trims the L-shaped gap', function () {
    const points = [
      ...circleSamples(0, 0, 4),
      ...circleSamples(100, 0, 4),
      ...circleSamples(0, 100, 4),
    ];
    const convex = convexHull(points);
    const concave = concaveHull(points);

    expect(concave.length).to.be.at.most(MAX_HULL_VERTICES);
    expect(area(concave)).to.be.lessThan(area(convex) * 0.95);
    expect(isInside(convex, { x: 52, y: 52 })).to.equal(true);
    expect(isInside(concave, { x: 52, y: 52 })).to.equal(false);

    for (const point of points) {
      expect(isInside(concave, point)).to.equal(true);
    }
  });

  it('bounds a dense convex outline conservatively when the GPU contour cap applies', function () {
    const points = circleSamples(0, 0, 40, 512);
    const hull = convexHull(points);
    const rounded = roundConvexHull(points, 6);
    const concave = concaveHull(points);

    expect(hull.length).to.equal(MAX_HULL_VERTICES);
    expect(rounded.length).to.be.at.most(MAX_HULL_VERTICES);
    expect(concave.length).to.be.at.most(MAX_HULL_VERTICES);

    for (const point of points) {
      expect(isInside(hull, point)).to.equal(true);
      expect(isInside(rounded, point)).to.equal(true);
      expect(isInside(concave, point)).to.equal(true);
    }
  });
});

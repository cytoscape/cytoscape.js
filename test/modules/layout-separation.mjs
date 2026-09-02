import { expect } from 'chai';
import {
  separationAlong,
  halfExtentAlong,
  ringTangentialRadius,
  ringClearanceRadius,
  ringBandRadius,
  ringRadius,
} from '../../src/layout/separation.mjs';

// Round 115: exact pairwise separation.  Two axis-aligned boxes are clear
// once separated on *either* axis, so the distance a pair needs along a
// direction is the cheaper axis's — a wide label beside a wide label
// needs their widths, the same two stacked need only their heights.
// The ring solvers apply that rule to the pairs that can actually meet.

/** node-local boxes from [w, h] pairs (symmetric) or [x1, y1, x2, y2] */
const boxes = (...list) => {
  const n = list.length;
  const d = {
    x1: new Float32Array(n),
    y1: new Float32Array(n),
    x2: new Float32Array(n),
    y2: new Float32Array(n),
  };

  list.forEach((b, i) => {
    if (b.length === 2) {
      d.x1[i] = -b[0] / 2;
      d.y1[i] = -b[1] / 2;
      d.x2[i] = b[0] / 2;
      d.y2[i] = b[1] / 2;
    } else {
      [d.x1[i], d.y1[i], d.x2[i], d.y2[i]] = b;
    }
  });

  return d;
};

const overlapsAt = (d, i, j, dx, dy) =>
  d.x1[i] < dx + d.x2[j] &&
  dx + d.x1[j] < d.x2[i] &&
  d.y1[i] < dy + d.y2[j] &&
  dy + d.y1[j] < d.y2[i];

const uniformRing = (dims, n, start = 0) => {
  const members = new Int32Array(n);
  const angles = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    members[i] = i;
    angles[i] = start + (i * 2 * Math.PI) / n;
  }

  return { members, angles };
};

const ringOverlaps = (dims, ring, r, inner = null, innerR = 0) => {
  const at = (ring, radius) =>
    Array.from(ring.members, (m, k) => ({
      m,
      x: radius * Math.cos(ring.angles[k]),
      y: radius * Math.sin(ring.angles[k]),
    }));
  const outer = at(ring, r);
  const pairs = [];

  for (let a = 0; a < outer.length; a++) {
    for (let b = a + 1; b < outer.length; b++) {
      const A = outer[a];
      const B = outer[b];

      if (overlapsAt(dims, A.m, B.m, B.x - A.x, B.y - A.y)) {
        pairs.push([A.m, B.m]);
      }
    }
  }

  if (inner != null) {
    for (const A of outer) {
      for (const B of at(inner, innerR)) {
        if (overlapsAt(dims, A.m, B.m, B.x - A.x, B.y - A.y)) {
          pairs.push([A.m, B.m]);
        }
      }
    }
  }

  return pairs;
};

describe('layout/separation: separationAlong (115)', () => {
  it('two 40 x 20 boxes side by side need their widths, stacked their heights', () => {
    const d = boxes([40, 20], [40, 20]);

    expect(separationAlong(d, 0, 1, 1, 0)).to.equal(40);
    expect(separationAlong(d, 0, 1, -1, 0)).to.equal(40);
    expect(separationAlong(d, 0, 1, 0, 1)).to.equal(20);
    expect(separationAlong(d, 0, 1, 0, -1)).to.equal(20);
  });

  it('along a diagonal takes the cheaper axis — the vertical one for wide boxes', () => {
    const d = boxes([40, 20], [40, 20]);
    const s = Math.SQRT1_2;

    // 20 / sin 45° = 28.28, against 40 / cos 45° = 56.57
    expect(separationAlong(d, 0, 1, s, s)).to.be.closeTo(20 / s, 1e-9);

    // and the answer is exactly the touching distance: a hair less
    // overlaps, a hair more does not
    const need = separationAlong(d, 0, 1, s, s);

    expect(overlapsAt(d, 0, 1, (need - 0.01) * s, (need - 0.01) * s)).to.equal(
      true,
    );
    expect(overlapsAt(d, 0, 1, (need + 0.01) * s, (need + 0.01) * s)).to.equal(
      false,
    );
  });

  it('two squares along their diagonal need the diagonal (the corner-on case)', () => {
    const d = boxes([30, 30], [30, 30]);
    const s = Math.SQRT1_2;

    expect(separationAlong(d, 0, 1, s, s)).to.be.closeTo(30 * Math.SQRT2, 1e-9);
  });

  it('honours asymmetric boxes: a label below the body counts downward only', () => {
    // body 20 tall, label hanging 30 below: y from -10 to 40
    const d = boxes([-10, -10, 10, 40], [-10, -10, 10, 40]);

    // j below i: i's far bottom (40) against j's near top (-10)
    expect(separationAlong(d, 0, 1, 0, 1)).to.equal(50);
    // j above i: i's top (-10) against j's bottom (40) — the same 50
    expect(separationAlong(d, 0, 1, 0, -1)).to.equal(50);
    // side by side: widths alone
    expect(separationAlong(d, 0, 1, 1, 0)).to.equal(20);
  });

  it('is never negative and mixes sizes exactly', () => {
    const d = boxes([100, 10], [10, 100]);

    expect(separationAlong(d, 0, 1, 1, 0)).to.equal(55);
    expect(separationAlong(d, 0, 1, 0, 1)).to.equal(55);
  });
});

describe('layout/separation: halfExtentAlong', () => {
  it('is the support function: width across, height up, both on a diagonal', () => {
    const d = boxes([40, 20]);

    expect(halfExtentAlong(d, 0, 0)).to.be.closeTo(20, 1e-9);
    expect(halfExtentAlong(d, 0, Math.PI / 2)).to.be.closeTo(10, 1e-9);
    expect(halfExtentAlong(d, 0, Math.PI / 4)).to.be.closeTo(
      (20 + 10) * Math.SQRT1_2,
      1e-9,
    );
  });
});

describe('layout/separation: ringTangentialRadius', () => {
  it('four 30 px squares at the compass points: the chord is 30 (side by side)', () => {
    // neighbours at 90° apart lie on a 45° chord: separation along it is
    // the diagonal 30√2, and the chord at radius r is r√2 — so r = 30
    const d = boxes([30, 30], [30, 30], [30, 30], [30, 30]);
    const r = ringTangentialRadius(d, uniformRing(d, 4));

    expect(r).to.be.closeTo(30, 1e-9);
  });

  it('is the smallest radius that clears the ring: a hair less overlaps', () => {
    const d = boxes([60, 20], [20, 60], [40, 40], [80, 10], [10, 80], [30, 30]);
    const ring = uniformRing(d, 6, 0.3);
    const r = ringTangentialRadius(d, ring);

    expect(ringOverlaps(d, ring, r + 1e-6)).to.deep.equal([]);
    expect(ringOverlaps(d, ring, r - 0.5).length).to.be.greaterThan(0);
  });

  it("spaces a crowded ring of wide boxes by far less than v3's largest-diagonal chord", () => {
    // 24 boxes 120 x 20: v3 spaced every pair by the longest side
    // (times 1.75); 114.6's ring rule by the diagonal.  The exact
    // answer is the pair whose chord runs closest to atan(20 / 120)
    // — the 7.5° chord, needing 120 / cos 7.5° — under the diagonal
    const list = [];

    for (let i = 0; i < 24; i++) {
      list.push([120, 20]);
    }

    const d = boxes(...list);
    const ring = uniformRing(d, 24);
    const r = ringTangentialRadius(d, ring);
    const chord = 2 * r * Math.sin(Math.PI / 24);
    const diagonal = Math.hypot(120, 20);

    expect(ringOverlaps(d, ring, r + 1e-6)).to.deep.equal([]);
    expect(chord).to.be.lessThan(diagonal);
    expect(chord).to.be.closeTo(120 / Math.cos((7.5 * Math.PI) / 180), 1e-6);
    expect(chord).to.be.lessThan(1.75 * 120);
  });

  it('checks pairs beyond the immediate neighbour: a wide box two places from another', () => {
    // wide, narrow, wide: the two wide boxes are two steps apart and
    // must not meet across the narrow one
    const d = boxes([100, 10], [4, 4], [100, 10], [4, 4]);
    const ring = uniformRing(d, 4);
    const r = ringTangentialRadius(d, ring);

    expect(ringOverlaps(d, ring, r + 1e-6)).to.deep.equal([]);
    // the wide pair sits across the ring's diameter: 2r ≥ 10 (heights)
    expect(2 * r).to.be.at.least(10 - 1e-9);
  });

  it('returns 0 for fewer than two members', () => {
    const d = boxes([30, 30]);

    expect(ringTangentialRadius(d, uniformRing(d, 1))).to.equal(0);
  });
});

describe('layout/separation: ringClearanceRadius and ringBandRadius', () => {
  it('a ring outside a centre node clears it exactly', () => {
    // centre 40 x 40 at index 0; four 20 x 20 on the ring
    const d = boxes([40, 40], [20, 20], [20, 20], [20, 20], [20, 20]);
    const inner = { members: [0], angles: [0] };
    const outer = {
      members: [1, 2, 3, 4],
      angles: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
    };
    const r = ringClearanceRadius(d, outer, inner, 0, 0);

    // along an axis: 20 + 10 = 30
    expect(r).to.be.closeTo(30, 1e-9);
    expect(ringOverlaps(d, outer, r + 1e-6, inner, 0)).to.deep.equal([]);
    expect(ringOverlaps(d, outer, r - 0.5, inner, 0).length).to.be.greaterThan(
      0,
    );
  });

  it('the band keeps a ring a ring: inner radius plus both radial extents', () => {
    const d = boxes([40, 20], [40, 20]);
    const inner = { members: [0], angles: [0] }; // radial direction = x
    const outer = { members: [1], angles: [0] };

    expect(ringBandRadius(d, outer, inner, 100)).to.be.closeTo(140, 1e-9);

    // at the top of the ring the radial direction is y: heights count
    const top = Math.PI / 2;

    expect(
      ringBandRadius(
        d,
        { members: [1], angles: [top] },
        { members: [0], angles: [top] },
        100,
      ),
    ).to.be.closeTo(120, 1e-9);
  });

  it('ringRadius: the floor, the band and the clearance together, and it clears', () => {
    const list = [[50, 50]];

    for (let i = 0; i < 9; i++) {
      list.push([70, 24]);
    }

    for (let i = 0; i < 20; i++) {
      list.push([30, 30]);
    }

    const d = boxes(...list);
    const centre = { members: [0], angles: [0] };
    const ring1 = {
      members: Array.from({ length: 9 }, (_v, i) => 1 + i),
      angles: Array.from({ length: 9 }, (_v, i) => (i * 2 * Math.PI) / 9),
    };
    const ring2 = {
      members: Array.from({ length: 20 }, (_v, i) => 10 + i),
      angles: Array.from(
        { length: 20 },
        (_v, i) => 0.1 + (i * 2 * Math.PI) / 20,
      ),
    };

    const r1 = ringRadius(d, ring1, centre, 0, 0);
    const r2 = ringRadius(d, ring2, ring1, r1, r1 + 1);

    expect(ringOverlaps(d, ring1, r1 + 1e-6, centre, 0)).to.deep.equal([]);
    expect(ringOverlaps(d, ring2, r2 + 1e-6, ring1, r1)).to.deep.equal([]);
    expect(r2).to.be.greaterThan(r1);

    // the floor holds when it is the largest term
    expect(ringRadius(d, ring2, ring1, r1, 10000)).to.equal(10000);
  });
});

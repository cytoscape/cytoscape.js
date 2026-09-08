import { expect } from 'chai';
import {
  computeComponents,
  tidySmallComponents,
} from '../../src/layout/pack.mjs';

// Round 120: the smallest components take canonical shapes at the
// settle — a vertical barbell, a point-up triangle, a diamond — so the
// packed rows of small components read as order rather than as the
// sim's leftover angles.  Pure, sim-indexed.  Control: with the
// function returning 0 before it moves anything, every case fails.

const dist = (p, a, b) =>
  Math.hypot(p[a * 2] - p[b * 2], p[a * 2 + 1] - p[b * 2 + 1]);

describe('layout/pack: canonical shapes for the smallest components (120)', () => {
  it('stands a pair vertically at the edge length, centred where it was', () => {
    const edges = Uint32Array.from([0, 1]);
    const p = Float32Array.from([100, 100, 160, 130]);
    const shaped = tidySmallComponents(
      2,
      edges,
      [80],
      computeComponents(2, edges),
      p,
      null,
      10,
      null,
    );

    expect(shaped).to.equal(1);
    expect(p[0]).to.be.closeTo(130, 1e-6);
    expect(p[2]).to.be.closeTo(130, 1e-6);
    expect(p[1]).to.be.closeTo(115 - 40, 1e-6);
    expect(p[3]).to.be.closeTo(115 + 40, 1e-6);
  });

  it('makes three an equilateral triangle, point up, and four a diamond', () => {
    const tri = Uint32Array.from([0, 1, 1, 2, 2, 0]);
    const p3 = new Float32Array([0, 0, 50, 0, 0, 50]);

    tidySmallComponents(
      3,
      tri,
      [60, 60, 60],
      computeComponents(3, tri),
      p3,
      null,
      10,
      null,
    );

    expect(dist(p3, 0, 1)).to.be.closeTo(60, 1e-4);
    expect(dist(p3, 1, 2)).to.be.closeTo(60, 1e-4);
    expect(dist(p3, 2, 0)).to.be.closeTo(60, 1e-4);
    // the apex is above the base, and the base pair is level
    expect(p3[1]).to.be.lessThan(p3[3]);
    expect(p3[3]).to.be.closeTo(p3[5], 1e-4);

    const cyc = Uint32Array.from([0, 1, 1, 2, 2, 3, 3, 0]);
    const p4 = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);

    tidySmallComponents(
      4,
      cyc,
      [60, 60, 60, 60],
      computeComponents(4, cyc),
      p4,
      null,
      10,
      null,
    );

    // every side is the edge length, and the diagonals are axis-aligned
    for (const [a, b] of [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
    ]) {
      expect(dist(p4, a, b)).to.be.closeTo(60, 1e-4);
    }

    expect(p4[0]).to.be.closeTo(p4[4], 1e-4); // top and bottom share x
    expect(p4[3]).to.be.closeTo(p4[7], 1e-4); // left and right share y
  });

  it("puts a star's hub at the top, and grows a shape for its bodies", () => {
    const star = Uint32Array.from([2, 0, 2, 1, 2, 3]);
    const p = new Float32Array(8);
    const dims = {
      x1: Float32Array.from([-40, -40, -40, -40]),
      y1: Float32Array.from([-15, -15, -15, -15]),
      x2: Float32Array.from([40, 40, 40, 40]),
      y2: Float32Array.from([15, 15, 15, 15]),
    };

    tidySmallComponents(
      4,
      star,
      [30, 30, 30],
      computeComponents(4, star),
      p,
      dims,
      10,
      null,
    );

    // the hub (index 2, degree 3) took the top of the diamond
    const ys = [p[1], p[3], p[5], p[7]];

    expect(p[5]).to.equal(Math.min(...ys));
    // 80 px wide bodies with a 10 px gap: left and right sit 90 apart,
    // not the 30 the edges asked for
    const left = [0, 1, 3].find((i) => p[i * 2] < p[4] - 1);
    const right = [0, 1, 3].find((i) => p[i * 2] > p[4] + 1);

    expect(p[right * 2] - p[left * 2]).to.be.closeTo(90, 1e-4);
  });

  it('leaves singletons, larger components and a pinned component alone', () => {
    // a singleton, a 5-cycle and a pinned pair
    const edges = Uint32Array.from([1, 2, 2, 3, 3, 4, 4, 5, 5, 1, 6, 7]);
    const p = new Float32Array(16);

    for (let i = 0; i < 8; i++) {
      p[i * 2] = i * 10;
      p[i * 2 + 1] = i;
    }

    const before = Float32Array.from(p);
    const pinned = new Uint8Array(8);

    pinned[6] = 1;

    const shaped = tidySmallComponents(
      8,
      edges,
      new Float32Array(6).fill(50),
      computeComponents(8, edges),
      p,
      null,
      10,
      pinned,
    );

    expect(shaped).to.equal(0);
    expect(Array.from(p)).to.deep.equal(Array.from(before));
  });
});

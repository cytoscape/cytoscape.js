import { expect } from 'chai';
import {
  computeComponents,
  packAnchors,
  estimateComponentRadius,
  seedAroundAnchors,
  packComponentsExact,
} from '../../src/layout/force-init.mjs';

// round 59.2: the force layout's component machinery — union-find over
// the sim edges, deterministic anchor packing (v3 separateComponents'
// row shape, up front), seeding around anchors, and the exact settle
// re-pack.  Pure and slot-free: everything is sim-index space.

const edgesOf = (pairs) => Uint32Array.from(pairs.flat());

describe('gpu/modules: force-init (round 59.2)', function () {
  it('computes components by union-find over the sim edges', function () {
    // 0-1-2 chained, 3-4 paired, 5 isolated
    const { compOf, sizes, count } = computeComponents(
      6,
      edgesOf([
        [0, 1],
        [1, 2],
        [3, 4],
      ]),
    );

    expect(count).to.equal(3);
    expect(compOf[0]).to.equal(compOf[1]);
    expect(compOf[1]).to.equal(compOf[2]);
    expect(compOf[3]).to.equal(compOf[4]);
    expect(compOf[0]).to.not.equal(compOf[3]);
    expect(compOf[5]).to.not.equal(compOf[0]);
    expect(compOf[5]).to.not.equal(compOf[3]);

    const bySize = [...sizes].sort((a, b) => b - a);

    expect(bySize).to.deep.equal([3, 2, 1]);
  });

  it('packs anchors so no two component discs overlap', function () {
    const sizes = new Int32Array([500, 40, 40, 3, 1, 1, 1, 1]);
    const anchors = packAnchors(sizes, 60, 40);

    expect(anchors.length).to.equal(sizes.length * 2);

    for (let a = 0; a < sizes.length; a++) {
      for (let b = a + 1; b < sizes.length; b++) {
        const d = Math.hypot(
          anchors[a * 2] - anchors[b * 2],
          anchors[a * 2 + 1] - anchors[b * 2 + 1],
        );
        const rA = estimateComponentRadius(sizes[a], 60);
        const rB = estimateComponentRadius(sizes[b], 60);

        // disc centres at least the two radii apart (spacing is the
        // packer's own margin; the assertion is non-overlap)
        expect(d, `${a} vs ${b}`).to.be.at.least(rA + rB - 1e-6);
      }
    }
  });

  it('packs deterministically', function () {
    const sizes = new Int32Array([7, 100, 1, 12, 12, 3]);
    const a = packAnchors(sizes, 60, 40);
    const b = packAnchors(sizes, 60, 40);

    expect([...a]).to.deep.equal([...b]);
  });

  it('a single component anchors at the origin', function () {
    const anchors = packAnchors(new Int32Array([250]), 60, 40);

    expect(anchors[0]).to.equal(0);
    expect(anchors[1]).to.equal(0);
  });

  it('seeds every node inside its own component disc', function () {
    const n = 40;
    const edges = [];

    for (let i = 1; i < 20; i++) {
      edges.push([0, i]);
    }
    for (let i = 21; i < 40; i++) {
      edges.push([20, i]);
    }

    const { compOf, sizes } = computeComponents(n, edgesOf(edges));
    const anchors = packAnchors(sizes, 60, 40);
    const positions = new Float32Array(n * 2);

    seedAroundAnchors(n, 1, compOf, sizes, anchors, 60, positions);

    for (let i = 0; i < n; i++) {
      const c = compOf[i];
      const d = Math.hypot(
        positions[i * 2] - anchors[c * 2],
        positions[i * 2 + 1] - anchors[c * 2 + 1],
      );

      expect(d, `node ${i}`).to.be.lessThan(
        estimateComponentRadius(sizes[c], 60) * 1.5,
      );
    }

    // deterministic under the seed
    const again = new Float32Array(n * 2);

    seedAroundAnchors(n, 1, compOf, sizes, anchors, 60, again);
    expect([...again]).to.deep.equal([...positions]);
  });

  it('the exact re-pack separates settled component boxes', function () {
    // two 3-node components laid out overlapping, plus a stray point
    // far away: the re-pack translates whole components (no
    // distortion) into non-overlapping boxes with the given spacing
    const n = 7;
    const edges = edgesOf([
      [0, 1],
      [1, 2],
      [3, 4],
      [4, 5],
    ]);
    const { compOf, sizes } = computeComponents(n, edges);
    const positions = new Float32Array([
      0,
      0,
      50,
      0,
      25,
      40, // comp A
      10,
      5,
      60,
      5,
      35,
      45, // comp B — overlaps A
      5000,
      5000, // the stray singleton
    ]);
    const before = {
      a: [positions[2] - positions[0], positions[3] - positions[1]],
    };

    packComponentsExact(n, compOf, sizes.length, positions, 40);

    // intra-component geometry is untouched (pure translation)
    expect(positions[2] - positions[0]).to.be.closeTo(before.a[0], 1e-4);
    expect(positions[3] - positions[1]).to.be.closeTo(before.a[1], 1e-4);

    // boxes no longer overlap
    const box = (members) => {
      let x1 = Infinity,
        y1 = Infinity,
        x2 = -Infinity,
        y2 = -Infinity;

      for (const i of members) {
        x1 = Math.min(x1, positions[i * 2]);
        x2 = Math.max(x2, positions[i * 2]);
        y1 = Math.min(y1, positions[i * 2 + 1]);
        y2 = Math.max(y2, positions[i * 2 + 1]);
      }

      return { x1, y1, x2, y2 };
    };
    const A = box([0, 1, 2]);
    const B = box([3, 4, 5]);
    const disjoint = A.x2 < B.x1 || B.x2 < A.x1 || A.y2 < B.y1 || B.y2 < A.y1;

    expect(disjoint).to.equal(true);

    // and the stray singleton was brought into the packing rather than
    // left 5000 px out
    expect(Math.abs(positions[12])).to.be.lessThan(1000);
    expect(Math.abs(positions[13])).to.be.lessThan(1000);
  });
});

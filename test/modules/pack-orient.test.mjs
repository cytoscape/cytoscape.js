import { expect } from 'chai';
import { computeComponents, orientComponents } from '../../src/layout/pack.mjs';

// Round 121.2: the larger components take a canonical orientation at the
// settle — a component with a principal axis lies flat, an isotropic
// one turns its farthest member to the top — so a component packs at a
// chosen angle rather than the one it landed at.  A rotation about the
// centroid, so every pairwise distance holds.  Pure, sim-indexed.
// Control: with the function returning 0 before it moves anything,
// every case but the last fails.

const dist = (p, a, b) =>
  Math.hypot(p[a * 2] - p[b * 2], p[a * 2 + 1] - p[b * 2 + 1]);

// a 5-path along a 30° line, 50 apart
const tiltedPath = () => {
  const p = new Float64Array(10);
  const c = Math.cos(Math.PI / 6);
  const s = Math.sin(Math.PI / 6);

  for (let i = 0; i < 5; i++) {
    p[i * 2] = 100 + i * 50 * c;
    p[i * 2 + 1] = 100 + i * 50 * s;
  }

  const edges = Uint32Array.from([0, 1, 1, 2, 2, 3, 3, 4]);

  return { p, edges, comps: computeComponents(5, edges) };
};

// a 6-ring of radius 40, its first node at 20° — no node on top
const ring = () => {
  const p = new Float64Array(12);
  const edges = [];

  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 9 + (i * Math.PI) / 3;

    p[i * 2] = 200 + 40 * Math.cos(a);
    p[i * 2 + 1] = 200 + 40 * Math.sin(a);
    edges.push(i, (i + 1) % 6);
  }

  return {
    p,
    edges: Uint32Array.from(edges),
    comps: computeComponents(6, Uint32Array.from(edges)),
  };
};

describe('layout/pack: the larger components take a canonical orientation (121.2)', () => {
  it('lays a tilted path flat about its centroid, every distance kept', () => {
    const { p, comps } = tiltedPath();
    const before = Float64Array.from(p);
    const turned = orientComponents(5, comps, p, null);

    expect(turned).to.equal(1);

    // flat: every node at the centroid's y
    for (let i = 0; i < 5; i++) {
      expect(p[i * 2 + 1]).to.be.closeTo(p[1], 1e-6);
    }
    // the same shape
    for (let a = 0; a < 5; a++) {
      for (let b = a + 1; b < 5; b++) {
        expect(dist(p, a, b)).to.be.closeTo(dist(before, a, b), 1e-6);
      }
    }
    // about the centroid, by the smaller turn (30°, not 150°): the
    // first node stays on the left
    expect(p[0]).to.be.lessThan(p[8]);
    expect((p[0] + p[8]) / 2).to.be.closeTo((before[0] + before[8]) / 2, 1e-6);
  });

  it('turns an isotropic ring so its farthest member sits on top', () => {
    const { p, comps } = ring();
    const turned = orientComponents(6, comps, p, null);

    expect(turned).to.equal(1);

    // one node is at the top — straight above the centre, at the
    // radius — and no node is higher
    let top = 0;

    for (let i = 1; i < 6; i++) {
      if (p[i * 2 + 1] < p[top * 2 + 1]) {
        top = i;
      }
    }

    expect(p[top * 2]).to.be.closeTo(200, 1e-6);
    expect(p[top * 2 + 1]).to.be.closeTo(160, 1e-6);
  });

  it('leaves the small components to the shapes, and a pinned component as it is', () => {
    const { p, comps } = tiltedPath();
    const before = Float64Array.from(p);

    // below the size floor
    expect(orientComponents(5, comps, p, null, 6)).to.equal(0);
    expect(Array.from(p)).to.deep.equal(Array.from(before));

    // pinned
    expect(orientComponents(5, comps, p, [0, 0, 1, 0, 0])).to.equal(0);
    expect(Array.from(p)).to.deep.equal(Array.from(before));
  });
});

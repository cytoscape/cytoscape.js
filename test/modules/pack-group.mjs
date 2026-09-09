import { expect } from 'chai';
import {
  componentBoxes,
  computeComponents,
  packComponentBodies,
} from '../../src/layout/pack.mjs';

// Round 121.1: the settle's re-pack takes a grouping and an order — each
// group's components shelf-pack on their own and the group boxes stand
// in a row, and a comparator over component ids comes before the area
// order.  Pure, sim-indexed.  Control: with `grouping` ignored, every
// case but the first fails.

// four singleton components in a row at x = 0, 100, 200, 300, as boxes
// of growing width: 10, 20, 30, 40 wide, 10 high
const four = () => {
  const n = 4;
  const p = new Float64Array([0, 0, 100, 0, 200, 0, 300, 0]);
  const comps = computeComponents(n, new Uint32Array(0));
  const w = [10, 20, 30, 40];
  const extents = {
    x1: w.map((x) => -x / 2),
    x2: w.map((x) => x / 2),
    y1: [-5, -5, -5, -5],
    y2: [5, 5, 5, 5],
  };

  return { n, p, comps, extents };
};

const boxOf = (p, extents, i) => ({
  x1: p[i * 2] + extents.x1[i],
  x2: p[i * 2] + extents.x2[i],
  y1: p[i * 2 + 1] + extents.y1[i],
  y2: p[i * 2 + 1] + extents.y2[i],
});

describe('layout/pack: the grouped and ordered re-pack (121.1)', () => {
  it('describes each component by its body box', () => {
    const { n, p, comps, extents } = four();
    const b = componentBoxes(n, comps.compOf, comps.count, p, extents);

    expect(Array.from(b.x1)).to.deep.equal([-5, 90, 185, 280]);
    expect(Array.from(b.x2)).to.deep.equal([5, 110, 215, 320]);
    expect(Array.from(b.y1)).to.deep.equal([-5, -5, -5, -5]);

    const pts = componentBoxes(n, comps.compOf, comps.count, p, null);

    expect(Array.from(pts.x1)).to.deep.equal([0, 100, 200, 300]);
    expect(Array.from(pts.x2)).to.deep.equal([0, 100, 200, 300]);
  });

  it('packs each group on its own and stands the groups in a row, by index, a groupSpacing apart', () => {
    const { n, p, comps, extents } = four();

    // components 0 and 2 in group 1, 1 and 3 in group 0
    packComponentBodies(n, comps.compOf, comps.count, p, extents, 10, false, {
      groupOf: Int32Array.from([1, 0, 1, 0]),
      groupCount: 2,
      groupSpacing: 50,
    });

    const b = [0, 1, 2, 3].map((i) => boxOf(p, extents, i));

    // group 0: the 40-wide box first (largest), then the 20-wide on
    // the next shelf (the row wraps at ~sqrt(area) × 1.25 = 50)
    expect(b[3].x1).to.be.closeTo(0, 1e-9);
    expect(b[3].y1).to.be.closeTo(0, 1e-9);
    expect(b[1].x1).to.be.closeTo(0, 1e-9);
    expect(b[1].y1).to.be.closeTo(20, 1e-9);
    // group 1 starts a groupSpacing past group 0's right edge (40),
    // top-aligned with it
    expect(b[2].x1).to.be.closeTo(90, 1e-9);
    expect(b[2].y1).to.be.closeTo(0, 1e-9);
    expect(b[0].x1).to.be.closeTo(90, 1e-9);
    expect(b[0].y1).to.be.closeTo(20, 1e-9);
  });

  // the components in the packed field's reading order: by shelf, then
  // left to right
  const reading = (p, extents, ids) =>
    ids
      .map((i) => ({ i, ...boxOf(p, extents, i) }))
      .sort((a, b) => a.y1 - b.y1 || a.x1 - b.x1)
      .map((b) => b.i);

  it('lets a comparator order the components ahead of the area order', () => {
    const { n, p, comps, extents } = four();

    // smallest first, against the packer's largest-first default
    packComponentBodies(n, comps.compOf, comps.count, p, extents, 10, false, {
      compare: (a, b) => a - b,
    });

    expect(reading(p, extents, [0, 1, 2, 3])).to.deep.equal([0, 1, 2, 3]);

    // the area order breaks the comparator's ties: a comparator that
    // says nothing is the default order
    const again = four();

    packComponentBodies(
      again.n,
      again.comps.compOf,
      again.comps.count,
      again.p,
      again.extents,
      10,
      false,
      { compare: () => 0 },
    );

    expect(reading(again.p, again.extents, [0, 1, 2, 3])).to.deep.equal([
      3, 2, 1, 0,
    ]);
  });

  it('holds the largest component’s centre through a grouped re-pack', () => {
    const { n, p, comps, extents } = four();
    const before = p[6];

    packComponentBodies(n, comps.compOf, comps.count, p, extents, 10, true, {
      groupOf: Int32Array.from([0, 0, 1, 1]),
      groupCount: 2,
    });

    expect(p[6]).to.be.closeTo(before, 1e-9);
  });
});

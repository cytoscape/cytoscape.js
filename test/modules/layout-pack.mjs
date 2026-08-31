import { expect } from 'chai';
import { shelfPack } from '../../src/layout/pack.mjs';

// round 87.1: the shelf packer, extracted from the force layout's
// init and exported — unit-testable against hand-computed fixtures
// for the first time.  The higher-level users (packAnchors,
// packComponentsExact, computeComponents) keep their specs in
// force-init.mjs.

const box = (id, w, h) => ({ id, w, h, x: 0, y: 0 });

describe('layout pack: shelfPack', function () {
  it('places area-descending into rows, wrapping at the row width', function () {
    // areas 16, 9, 4 → order id1, id2, id0.  spacing 0: total padded
    // area 29, rowW = max(widest 4, sqrt(29)*1.25 ≈ 6.73) = 6.73.
    // id1 fills (0,0)..(4,4); id2 would end at x=7 > 6.73 so it wraps
    // to the second row at y=4; id0 (2 wide) fits beside it at x=3.
    const boxes = [box(0, 2, 2), box(1, 4, 4), box(2, 3, 3)];

    shelfPack(boxes, 0);

    expect({ x: boxes[1].x, y: boxes[1].y }).to.deep.equal({ x: 0, y: 0 });
    expect({ x: boxes[2].x, y: boxes[2].y }).to.deep.equal({ x: 0, y: 4 });
    expect({ x: boxes[0].x, y: boxes[0].y }).to.deep.equal({ x: 3, y: 4 });
  });

  it('breaks area ties on the id, ascending', function () {
    // equal 2x2 areas, ids deliberately unsorted in the input: id3
    // must be placed first (at the origin), id5 beside it.
    const boxes = [box(5, 2, 2), box(3, 2, 2)];

    shelfPack(boxes, 1);

    expect({ x: boxes[1].x, y: boxes[1].y }).to.deep.equal({ x: 0, y: 0 });
    expect({ x: boxes[0].x, y: boxes[0].y }).to.deep.equal({ x: 3, y: 0 });
  });

  it('never lets the row width fall below the widest box', function () {
    // sqrt(total)*1.25 ≈ 6.37, but the 10-wide box forces rowW = 10 —
    // so all four 2x2s share the second row (the last at x = 6, which
    // a 6.37-wide row would have wrapped to a third row instead).
    const boxes = [
      box(0, 10, 1),
      box(1, 2, 2),
      box(2, 2, 2),
      box(3, 2, 2),
      box(4, 2, 2),
    ];

    shelfPack(boxes, 0);

    expect({ x: boxes[0].x, y: boxes[0].y }).to.deep.equal({ x: 0, y: 0 });
    expect({ x: boxes[4].x, y: boxes[4].y }).to.deep.equal({ x: 6, y: 1 });
    expect(boxes.slice(1).every((b) => b.y === 1)).to.equal(true);
  });

  it('spaces boxes within a row and rows apart by `spacing`', function () {
    // three 2x2 at spacing 3: padded total 75 → rowW ≈ 10.8, so two
    // fit per row (x = 0, 5) and the third wraps to y = rowH 2 +
    // spacing 3 = 5.
    const boxes = [box(0, 2, 2), box(1, 2, 2), box(2, 2, 2)];

    shelfPack(boxes, 3);

    expect({ x: boxes[0].x, y: boxes[0].y }).to.deep.equal({ x: 0, y: 0 });
    expect({ x: boxes[1].x, y: boxes[1].y }).to.deep.equal({ x: 5, y: 0 });
    expect({ x: boxes[2].x, y: boxes[2].y }).to.deep.equal({ x: 0, y: 5 });
    // control: the in-row gap really is the spacing, not incidental
    expect(boxes[1].x - (boxes[0].x + boxes[0].w)).to.equal(3);
  });

  it('mutates (x, y) in place and leaves the input order alone', function () {
    const boxes = [box(0, 1, 1), box(1, 6, 6)];
    const before = [...boxes];

    shelfPack(boxes, 2);

    // the sort works on a copy: the caller's array order is untouched,
    // which packAnchors and packComponentsExact index by id through
    expect(boxes[0]).to.equal(before[0]);
    expect(boxes[1]).to.equal(before[1]);
    expect({ x: boxes[1].x, y: boxes[1].y }).to.deep.equal({ x: 0, y: 0 });
  });
});

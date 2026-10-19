import { expect } from 'chai';
import {
  shelfPack,
  packComponentBodies,
  packComponentsExact,
} from '../../src/layout/pack.mjs';

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

  // Round 125.9: a row's slack is filled by stacking — the shelf's
  // waste the maintainer found on em-web (the 78-node component's
  // column two thirds empty under the 187-node disc's row).
  describe('stacking (125.9)', function () {
    // a tall box, a medium one beside it, then boxes that fit under
    // the medium one: spacing 0 keeps the arithmetic exact.  areas
    // 100, 20, 4, 4 → rowW = max(10, sqrt(128)*1.25 ≈ 14.1), so the
    // 4-wide box fits beside the 10 (x 10..14) and a 2x2 at x 14
    // would not
    const mixed = () => [
      box(0, 10, 10),
      box(1, 4, 5),
      box(2, 2, 2),
      box(3, 2, 2),
    ];

    it('a box shorter than the room under an earlier column goes there', function () {
      const boxes = mixed();

      shelfPack(boxes, 0);

      expect({ x: boxes[0].x, y: boxes[0].y }).to.deep.equal({ x: 0, y: 0 });
      expect({ x: boxes[1].x, y: boxes[1].y }).to.deep.equal({ x: 10, y: 0 });
      // under the 4x5: y = 5, then y = 7
      expect({ x: boxes[2].x, y: boxes[2].y }).to.deep.equal({ x: 10, y: 5 });
      expect({ x: boxes[3].x, y: boxes[3].y }).to.deep.equal({ x: 10, y: 7 });
    });

    it('control: the packed height is the tallest box, not the rows the shelf alone would stack', function () {
      // the shelf alone: 10x10 and 4x5 on row one, the 2x2s at x 14 >
      // 14.1 wrap to a second row at y 10 — a height of 12
      const boxes = mixed();

      shelfPack(boxes, 0);

      const height = Math.max(...boxes.map((b) => b.y + b.h));
      const rowsAlone = 10 + 2;

      expect(height).to.equal(10);
      expect(height).to.be.lessThan(rowsAlone);
    });

    it('stacks under the leftmost column with the room, respecting the spacing', function () {
      // beside a 10-tall box at spacing 1 (rowW ≈ 16.6): a 3x6 column
      // at x 11; the 3x3 (area 9, before the 3x2's 6) fits under it
      // exactly — 6 filled + 1 spacing + 3 = the row's 10 — at y 7;
      // the 3x2 then has no room under either column (10 + 1 + 2 > 10)
      // and no room in the row (x 15 + 3 > 16.6), so it wraps
      const boxes = [box(0, 10, 10), box(1, 3, 6), box(2, 3, 2), box(3, 3, 3)];

      shelfPack(boxes, 1);

      expect({ x: boxes[1].x, y: boxes[1].y }).to.deep.equal({ x: 11, y: 0 });
      expect({ x: boxes[3].x, y: boxes[3].y }).to.deep.equal({ x: 11, y: 7 });
      expect({ x: boxes[2].x, y: boxes[2].y }).to.deep.equal({ x: 0, y: 11 });
    });

    it('does not stack a box wider than the column, or one the room cannot hold', function () {
      // beside the 10x10: a 4x6 column with 4 of room; the 4x5 is
      // taller than that room and the 5x2 is wider than the column —
      // neither stacks, both open new columns (on the next row, since
      // rowW ≈ 15.5 has no room past x 14)
      const boxes = [box(0, 10, 10), box(1, 4, 6), box(2, 4, 5), box(3, 5, 2)];

      shelfPack(boxes, 0);

      expect({ x: boxes[1].x, y: boxes[1].y }).to.deep.equal({ x: 10, y: 0 });
      expect({ x: boxes[2].x, y: boxes[2].y }).to.deep.equal({ x: 0, y: 10 });
      expect({ x: boxes[3].x, y: boxes[3].y }).to.deep.equal({ x: 4, y: 10 });
    });

    it('boxes of one size never stack: the rows of singletons read as before', function () {
      // four 2x2 at spacing 1: rowW ≈ 7.5, two per row, no room under
      // a box of the row's own height
      const boxes = [box(0, 2, 2), box(1, 2, 2), box(2, 2, 2), box(3, 2, 2)];

      shelfPack(boxes, 1);

      expect(boxes.map((b) => [b.x, b.y])).to.deep.equal([
        [0, 0],
        [3, 0],
        [0, 3],
        [3, 3],
      ]);
    });

    it('a comparator turns stacking off: the order is read along rows', function () {
      const boxes = mixed();

      shelfPack(boxes, 0, (a, b) => a - b);

      // the shelf alone: the 2x2s wrap to the second row
      expect(boxes[2].y).to.equal(10);
      expect(boxes[3].y).to.equal(10);
    });

    it('stack: true under a comparator keeps the order column-major', function () {
      const boxes = mixed();

      shelfPack(boxes, 0, (a, b) => a - b, true);

      // rows top to bottom, columns left to right, top to bottom in a
      // column: 0 (col 0), then 1, 2, 3 down column 1
      const reading = [...boxes].sort((a, b) => a.x - b.x || a.y - b.y);

      expect(reading.map((b) => b.id)).to.deep.equal([0, 1, 2, 3]);
    });
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

// round 114.4: the exact re-pack over component *body* boxes, moved out
// of flow (112.2) so every layout packs the same way.
describe('layout pack: packComponentBodies', function () {
  // two singleton components at the same point, 40 px wide bodies
  const two = () => ({
    compOf: Int32Array.from([0, 1]),
    positions: Float64Array.from([0, 0, 0, 0]),
    extents: {
      x1: [-20, -20],
      y1: [-10, -10],
      x2: [20, 20],
      y2: [10, 10],
    },
  });

  it('keeps bodies `spacing` apart, not centres', function () {
    const { compOf, positions, extents } = two();

    packComponentBodies(2, compOf, 2, positions, extents, 10, true);

    // both boxes are 40 x 20 at spacing 10: the shelf row is ~68 wide
    // (sqrt of the padded area x 1.25), so the second wraps below the
    // first — bottom edge of a to top edge of b is the spacing
    const gap = positions[3] - 10 - (positions[1] + 10);

    expect(gap).to.be.closeTo(10, 1e-9);
    expect(positions[2]).to.be.closeTo(positions[0], 1e-9);
    // and the largest (first, on the tie) held its centre
    expect([positions[0], positions[1]]).to.deep.equal([0, 0]);
  });

  it('control: with no extents the boxes are points and the centres are `spacing` apart', function () {
    const { compOf, positions } = two();

    packComponentBodies(2, compOf, 2, positions, null, 10, true);

    // a point box is 1 px wide (the packer's floor), so the centres end
    // up spacing + 1 apart — the 87.1 shape, 40 px bodies overlapping
    expect(positions[2] - positions[0]).to.be.closeTo(11, 1e-9);
  });

  it('packComponentsExact is the point-box, hold-largest wrapper', function () {
    const a = two();
    const b = two();
    const pa = Float32Array.from(a.positions);
    const pb = Float32Array.from(b.positions);

    packComponentsExact(2, a.compOf, 2, pa, 10);
    packComponentBodies(2, b.compOf, 2, pb, null, 10, true);

    expect(Array.from(pa)).to.deep.equal(Array.from(pb));
  });

  it('holdLargest: false leaves the packed field at the origin', function () {
    const { compOf, positions, extents } = two();

    packComponentBodies(2, compOf, 2, positions, extents, 10, false);

    // the first box's top-left is the origin: its centre is (20, 10)
    expect([positions[0], positions[1]]).to.deep.equal([20, 10]);
  });
});

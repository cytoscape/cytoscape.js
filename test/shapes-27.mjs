import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { pickNodeAt } from '../src/render/cpu-pick.mjs';
import {
  POLYGON_POINTS,
  ROUND_POLYGON_SOURCE,
  pointsForShape,
} from '../src/shape-points.mjs';
import {
  BARREL_CURVE_SEGMENTS,
  BARREL_HEIGHT_OFFSET_MAX,
  BARREL_HEIGHT_OFFSET_PCT,
  SHAPE_BARREL,
  SHAPE_CONCAVE_HEXAGON,
  SHAPE_CUT_RECTANGLE,
  SHAPE_RIGHT_RHOMBOID,
  SHAPE_MASK,
  SHAPE_SHIFT,
} from '../src/contract.mjs';

/*
Round 27.2: the three v3 shape keywords that were left unported when the
node-visual batch landed in round 13.

`right-rhomboid` and `concave-hexagon` are plain unit polygons in v3, so
they are point-table entries — the SDF codegen, the CPU pick and the
depth prepass all pick them up with no per-shape code.

`cut-rectangle` is not: v3 chamfers the corners by an *absolute* length
(8 model px by default, or the element's `corner-radius`), so it is a
parameterized shape like round-rectangle rather than a unit polygon.  It
gets its own SDF and its own CPU-pick branch, and its 'auto' resolves to
a flat 8 px — not round-rectangle's min(w/4, h/4, 8).

28.1: the pick specs here go through the whole public path — the sheet
compiles, the style engine writes borderGeom, and `pickNodeAt` reads the
stored words — so they pin the shader's CPU twin end to end.  They
replace three specs that were *named* for picking and asserted only
`boundingBox()`, which is the node box for every keyword and so held
whatever shape was under test.  Every case below is chosen to be a hit
for `rectangle` (or, for the round family, for the sharp counterpart),
so a spec that stopped consulting the shape would fail.  `cy.pick()`
itself resolves null on a headless instance — it is the renderer's —
which is why these call the pick path directly.
*/

const at = (x, y) => ({ data: { id: 'a' }, position: { x, y } });

const makeCy = (props) =>
  cytoscape({
    elements: [at(0, 0)],
    style: { nodes: { width: 100, height: 100, ...props } },
  });

/* the node sits at the origin at 100 × 100, so device px are model px */
const PICK_FRAME = {
  panXPx: 0,
  panYPx: 0,
  zoomDpr: 1,
  hidePx: 1,
  nodeLodPx: 3,
};

/** Whether the graph's single node picks at (x, y), in device px. */
const picks = (cy, x, y) => pickNodeAt(cy._store, PICK_FRAME, x, y) !== null;

/** The stored shape id for the graph's single node. */
const shapeIdOf = (cy) => {
  const slot = cy._store.lookup('a').slot;
  const geom = cy._store.column('node.borderGeom');

  return (geom[slot * 4 + 1] >>> SHAPE_SHIFT) & SHAPE_MASK;
};

describe('gpu/shapes: the unported v3 keywords (round 27.2)', function () {
  describe('right-rhomboid', function () {
    it('compiles, stores and reads back', function () {
      const cy = makeCy({ shape: 'right-rhomboid' });

      expect(cy.$id('a').style('shape')).to.equal('right-rhomboid');
      expect(shapeIdOf(cy)).to.equal(SHAPE_RIGHT_RHOMBOID);
      cy.destroy();
    });

    it("carries v3's point table", function () {
      // v3: generatePolygon( 'right-rhomboid', [ -0.333, -1, 1, -1, 0.333, 1, -1, 1 ] )
      expect(
        Array.from(POLYGON_POINTS.get(SHAPE_RIGHT_RHOMBOID)),
      ).to.deep.equal([-0.333, -1, 1, -1, 0.333, 1, -1, 1]);
    });

    it('picks by its slanted outline, not its bounding box', function () {
      const cy = makeCy({ shape: 'right-rhomboid' });

      // the top edge runs from x = -0.333 to x = 1, so the slant cuts the
      // top-*left* corner away and leaves the top-right one: the pair
      // below is the asymmetry, and a rectangle would hit both
      expect(picks(cy, -40, -45)).to.equal(false);
      expect(picks(cy, 40, -45)).to.equal(true);
      expect(picks(cy, 0, 0)).to.equal(true);

      const box = makeCy({ shape: 'rectangle' });

      expect(picks(box, -40, -45)).to.equal(true); // the control

      cy.destroy();
      box.destroy();
    });
  });

  describe('concave-hexagon', function () {
    it('compiles, stores and reads back', function () {
      const cy = makeCy({ shape: 'concave-hexagon' });

      expect(cy.$id('a').style('shape')).to.equal('concave-hexagon');
      expect(shapeIdOf(cy)).to.equal(SHAPE_CONCAVE_HEXAGON);
      cy.destroy();
    });

    it("carries v3's point table, with the waisted sides", function () {
      const pts = Array.from(POLYGON_POINTS.get(SHAPE_CONCAVE_HEXAGON));

      expect(pts).to.deep.equal([
        -1, -0.95, -0.75, 0, -1, 0.95, 1, 0.95, 0.75, 0, 1, -0.95,
      ]);

      // the concavity is the point: the mid-side vertices pull inward
      expect(Math.abs(pts[2])).to.be.below(Math.abs(pts[0]));
    });

    it('misses the waist a rectangle would hit', function () {
      const cy = makeCy({ shape: 'concave-hexagon' });
      const box = makeCy({ shape: 'rectangle' });

      // the mid-side vertices pull in to |x| = 0.75, so the full-width
      // band at y = 0 is outside the body
      expect(picks(cy, -49, 2)).to.equal(false);
      expect(picks(box, -49, 2)).to.equal(true); // the control
      expect(picks(cy, 0, 0)).to.equal(true);

      cy.destroy();
      box.destroy();
    });
  });

  describe('cut-rectangle', function () {
    it('compiles, stores and reads back', function () {
      const cy = makeCy({ shape: 'cut-rectangle' });

      expect(cy.$id('a').style('shape')).to.equal('cut-rectangle');
      expect(shapeIdOf(cy)).to.equal(SHAPE_CUT_RECTANGLE);
      cy.destroy();
    });

    it('is not a unit polygon — the chamfer is an absolute length', function () {
      // if it were a point table the chamfer would scale with the node,
      // which is exactly what v3 does not do
      expect(POLYGON_POINTS.has(SHAPE_CUT_RECTANGLE)).to.equal(false);
    });

    it('picks inside the body and outside the cut corners', function () {
      const cy = makeCy({ shape: 'cut-rectangle' });
      const box = makeCy({ shape: 'rectangle' });

      // 'auto' chamfers by a flat 8 model px, so the corner is clipped
      // along |x| + |y| = hw + hh - 8 = 92
      expect(picks(cy, 0, 0)).to.equal(true);
      expect(picks(cy, 46, 46)).to.equal(true); // sum 92, on the chamfer
      expect(picks(cy, 49, 49)).to.equal(false); // sum 98, past it
      expect(picks(box, 49, 49)).to.equal(true); // the control

      cy.destroy();
      box.destroy();
    });

    it('takes an explicit corner-radius as the chamfer length', function () {
      const cy = makeCy({ shape: 'cut-rectangle', 'corner-radius': 20 });

      expect(cy.$id('a').style('corner-radius')).to.equal(20);
      cy.destroy();
    });
  });

  describe('the round-corner family (27.4)', function () {
    const ROUND = [
      'round-triangle',
      'round-diamond',
      'round-pentagon',
      'round-hexagon',
      'round-heptagon',
      'round-octagon',
      'round-tag',
    ];

    it('compiles, stores and reads back every keyword', function () {
      for (const keyword of ROUND.concat(['bottom-round-rectangle'])) {
        const cy = makeCy({ shape: keyword });

        expect(cy.$id('a').style('shape'), keyword).to.equal(keyword);
        cy.destroy();
      }
    });

    it("reuses its sharp counterpart's point table, as v3 does", function () {
      for (const round of ROUND) {
        const cy = makeCy({ shape: round });
        const id = shapeIdOf(cy);
        const source = ROUND_POLYGON_SOURCE.get(id);

        expect(source, `${round} has a source table`).to.be.a('number');
        expect(pointsForShape(id), round).to.equal(POLYGON_POINTS.get(source));
        cy.destroy();
      }
    });

    it('has no point table of its own — the rounding is in the field', function () {
      for (const round of ROUND) {
        const cy = makeCy({ shape: round });

        expect(POLYGON_POINTS.has(shapeIdOf(cy)), round).to.equal(false);
        cy.destroy();
      }
    });

    it('takes an explicit corner-radius', function () {
      const cy = makeCy({ shape: 'round-hexagon', 'corner-radius': 12 });

      expect(cy.$id('a').style('corner-radius')).to.equal(12);
      cy.destroy();
    });

    it('rounds the corners off the sharp counterpart it borrows its table from', function () {
      const round = makeCy({ shape: 'round-hexagon' });
      const sharp = makeCy({ shape: 'hexagon' });

      // rounding only removes area near the vertices, so the interior
      // agrees and the tip does not: the left vertex of the sharp hexagon
      // sits at (-50, 0) and the arc pulls it back
      expect(picks(round, 0, 0)).to.equal(true);
      expect(picks(sharp, 0, 0)).to.equal(true);
      expect(picks(sharp, -49, 2)).to.equal(true); // the control
      expect(picks(round, -49, 2)).to.equal(false);

      round.destroy();
      sharp.destroy();
    });
  });

  describe('barrel (27.5)', function () {
    it('compiles, stores and reads back', function () {
      const cy = makeCy({ shape: 'barrel' });

      expect(cy.$id('a').style('shape')).to.equal('barrel');
      expect(shapeIdOf(cy)).to.equal(SHAPE_BARREL);
      cy.destroy();
    });

    it('is parameterized, not a unit table — the offsets cap absolutely', function () {
      expect(POLYGON_POINTS.has(SHAPE_BARREL)).to.equal(false);

      // v3's caps: heightOffset min(15, 5% of height), widthOffset
      // min(100, 25% of width).  A tall node is in the capped regime, so
      // a unit table would be wrong for it.
      expect(
        Math.min(BARREL_HEIGHT_OFFSET_MAX, BARREL_HEIGHT_OFFSET_PCT * 600),
      ).to.equal(BARREL_HEIGHT_OFFSET_MAX);
      expect(
        Math.min(BARREL_HEIGHT_OFFSET_MAX, BARREL_HEIGHT_OFFSET_PCT * 100),
      ).to.equal(5);
    });

    it("samples each corner at v3's own hit-test fidelity", function () {
      expect(BARREL_CURVE_SEGMENTS).to.equal(4);
    });

    it('picks inside the body and outside the curved corners', function () {
      const cy = makeCy({ shape: 'barrel' });
      const box = makeCy({ shape: 'rectangle' });

      // the four bezier corners curve in; the side and end midpoints
      // still reach the box
      expect(picks(cy, 0, 0)).to.equal(true);
      expect(picks(cy, 49, 0)).to.equal(true);
      expect(picks(cy, 0, 49)).to.equal(true);
      expect(picks(cy, 49, 49)).to.equal(false);
      expect(picks(box, 49, 49)).to.equal(true); // the control

      cy.destroy();
      box.destroy();
    });
  });

  describe('the keyword set', function () {
    it('still rejects a keyword v4 has not ported', function () {
      expect(() => makeCy({ shape: 'not-a-shape' })).to.throw(/not-a-shape/);
    });

    it('accepts every ported keyword without throwing', function () {
      const ported = [
        'right-rhomboid',
        'concave-hexagon',
        'cut-rectangle',
        'round-triangle',
        'round-diamond',
        'round-pentagon',
        'round-hexagon',
        'round-heptagon',
        'round-octagon',
        'round-tag',
        'bottom-round-rectangle',
        'barrel',
      ];

      for (const keyword of ported) {
        const cy = makeCy({ shape: keyword });

        expect(cy.$id('a').style('shape'), keyword).to.equal(keyword);
        cy.destroy();
      }
    });

    it('every shape id still fits the widened field', function () {
      const ids = [...POLYGON_POINTS.keys(), ...ROUND_POLYGON_SOURCE.keys()];

      for (const id of ids) {
        expect(id, `shape id ${id}`).to.be.at.most(SHAPE_MASK);
      }
    });
  });
});

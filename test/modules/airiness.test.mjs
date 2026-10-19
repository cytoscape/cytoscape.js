import { expect } from 'chai';
import { createRequire } from 'node:module';
import cytoscape from '../../src/index.mjs';

// Round 125.10: the airiness probe (debug/airiness.js) — the page's
// readout and the quality suite's "too airy" columns share it, so its
// numbers are pinned here against a brute-force twin and against
// hand-placed boxes, with the controls docs/agents/testing.md asks
// for: a probe that cannot tell a spread field from a tight one is no
// probe.  The page module also carries the live spacing slider's pure
// half, `layoutConfig.scaledPositions`, pinned below it.

const require = createRequire(import.meta.url);
const airiness = require('../../debug/airiness.js');
const layoutConfig = require('../../debug/layout-config.js');

const box = (x, y, w = 10, h = 10) => ({ x1: x, y1: y, x2: x + w, y2: y + h });

/** a seeded LCG so the random fields are the same every run */
const lcg = (seed) => {
  let s = seed >>> 0;

  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;

    return s / 4294967296;
  };
};

const randomBoxes = (n, seed, spread = 1000) => {
  const rnd = lcg(seed);
  const out = [];

  for (let i = 0; i < n; i++) {
    out.push(
      box(rnd() * spread, rnd() * spread, 5 + rnd() * 30, 5 + rnd() * 30),
    );
  }

  return out;
};

describe('debug/airiness: the airiness probe (round 125.10)', function () {
  describe('boxGap', function () {
    it('is the larger axis separation, and 0 when boxes touch or overlap', function () {
      expect(airiness.boxGap(box(0, 0), box(30, 0))).to.equal(20);
      expect(airiness.boxGap(box(0, 0), box(0, 25))).to.equal(15);
      expect(airiness.boxGap(box(0, 0), box(30, 25))).to.equal(20);
      expect(airiness.boxGap(box(0, 0), box(10, 0))).to.equal(0);
      expect(airiness.boxGap(box(0, 0), box(5, 5))).to.equal(0);
    });
  });

  describe('nearestGaps', function () {
    it('matches the brute-force twin on a random field', function () {
      for (const [n, seed] of [
        [3, 1],
        [50, 2],
        [500, 3],
        [2000, 4],
      ]) {
        const boxes = randomBoxes(n, seed);
        const fast = airiness.nearestGaps(boxes);
        const slow = airiness.nearestGapsSlow(boxes);

        expect(fast.length).to.equal(n);

        for (let i = 0; i < n; i++) {
          expect(fast[i].gap, `${n} boxes, seed ${seed}, box ${i}`).to.equal(
            slow[i].gap,
          );
          // the neighbour is pinned where the gap is unique; a tie can
          // legitimately name either
          const tied = slow.filter(
            (s, j) =>
              j !== i && airiness.boxGap(boxes[i], boxes[j]) === slow[i].gap,
          ).length;

          if (tied === 1) {
            expect(fast[i].to).to.equal(slow[i].to);
          }
        }
      }
    });

    it('handles a coincident pile and a lone box', function () {
      const pile = [box(0, 0), box(0, 0), box(0, 0)];

      for (const g of airiness.nearestGaps(pile)) {
        expect(g.gap).to.equal(0);
      }

      expect(airiness.nearestGaps([box(0, 0)])).to.deep.equal([
        { gap: Infinity, to: -1 },
      ]);
      expect(airiness.nearestGaps([])).to.deep.equal([]);
    });

    it('control: a field scaled 3x about its centre reads 3x the gap', function () {
      const boxes = randomBoxes(200, 5);
      const before = airiness.summary(
        airiness.nearestGaps(boxes).map((g) => g.gap),
      );
      const spread = boxes.map((b) => {
        const cx = (b.x1 + b.x2) / 2;
        const cy = (b.y1 + b.y2) / 2;
        const w = b.x2 - b.x1;
        const h = b.y2 - b.y1;
        // centres scaled, sizes kept, as the live slider does
        const nx = 500 + (cx - 500) * 3;
        const ny = 500 + (cy - 500) * 3;

        return {
          x1: nx - w / 2,
          y1: ny - h / 2,
          x2: nx + w / 2,
          y2: ny + h / 2,
        };
      });
      const after = airiness.summary(
        airiness.nearestGaps(spread).map((g) => g.gap),
      );

      expect(before.median).to.be.greaterThan(0);
      expect(after.median).to.be.greaterThan(2 * before.median);
    });
  });

  describe('summary', function () {
    it('median, p90 and max, with the non-finite left out', function () {
      const s = airiness.summary([5, 1, 3, Infinity, NaN, 2, 4]);

      expect(s.n).to.equal(5);
      expect(s.median).to.equal(3);
      expect(s.p90).to.be.closeTo(4.6, 1e-9);
      expect(s.max).to.equal(5);
      expect(Number.isNaN(airiness.summary([]).median)).to.equal(true);
    });
  });

  describe('airiness(cy)', function () {
    const mk = (positions, edges = []) =>
      cytoscape({
        headless: true,
        elements: [
          ...positions.map((p, i) => ({
            data: { id: 'n' + i },
            position: { x: p[0], y: p[1] },
          })),
          ...edges.map(([s, t]) => ({
            data: { id: `e${s}-${t}`, source: 'n' + s, target: 'n' + t },
          })),
        ],
        style: { nodes: { width: 20, height: 20 } },
      });

    it('reads a lattice: nearest gap is the pitch minus the size, in node sizes', function () {
      const cy = mk([
        [0, 0],
        [100, 0],
        [200, 0],
        [0, 100],
        [100, 100],
        [200, 100],
      ]);
      const a = airiness.airiness(cy);

      expect(a.nodes).to.equal(6);
      expect(a.size).to.equal(20);
      expect(a.nodeGap.median).to.equal(80);
      expect(a.ratio).to.equal(4);
    });

    it('edge gaps: a long edge stands out on max while the median stays', function () {
      const cy = mk(
        [
          [0, 0],
          [50, 0],
          [100, 0],
          [1000, 0],
        ],
        [
          [0, 1],
          [1, 2],
          [2, 3],
        ],
      );
      const a = airiness.airiness(cy);

      expect(a.edgeGap.median).to.equal(30);
      expect(a.edgeGap.max).to.equal(880);
    });

    it('control: the same graph scaled 2x reads twice the ratio', function () {
      const tight = mk([
        [0, 0],
        [60, 0],
        [120, 0],
      ]);
      const loose = mk([
        [0, 0],
        [120, 0],
        [240, 0],
      ]);

      expect(airiness.airiness(loose).ratio).to.equal(
        airiness.airiness(tight).ratio * 2 + 1,
      );
    });

    it('format: one line with the four numbers', function () {
      const cy = mk([
        [0, 0],
        [100, 0],
      ]);
      const line = airiness.format(airiness.airiness(cy));

      expect(line).to.match(/nearest gap median 80 px/);
      expect(line).to.match(/4\.00× node size/);
    });
  });
});

describe('debug/layout-config: scaledPositions (round 125.10)', function () {
  const base = { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, c: { x: 100, y: 50 } };

  it('scales about the centre of the bounding box', function () {
    const out = layoutConfig.scaledPositions(base, 2);

    // centre (50, 25): a at (0,0) -> (-50, -25)
    expect(out.a).to.deep.equal({ x: -50, y: -25 });
    expect(out.b).to.deep.equal({ x: 150, y: -25 });
    expect(out.c).to.deep.equal({ x: 150, y: 75 });
  });

  it('is the identity at 1 and on a bad factor, and empty on an empty base', function () {
    expect(layoutConfig.scaledPositions(base, 1)).to.deep.equal(base);
    expect(layoutConfig.scaledPositions(base, '0')).to.deep.equal(base);
    expect(layoutConfig.scaledPositions(base, 'x')).to.deep.equal(base);
    expect(layoutConfig.scaledPositions({}, 2)).to.deep.equal({});
  });

  it('does not touch the base', function () {
    const copy = JSON.parse(JSON.stringify(base));

    layoutConfig.scaledPositions(base, 3);
    expect(base).to.deep.equal(copy);
  });
});

import { expect } from 'chai';
import { boxes, mkSim, probe } from './lib/force-sim-fixtures.mjs';

// Split from test/force-sim.test.mjs: this one case is a 3,000-node run of
// ~650 ticks, 6 s alone and 30 s under the coverage that test:throws
// collects, so in its own file it runs beside the rest rather than after
// them.  The describe names match the original, so the test keeps its
// identity.

describe('gpu/layout: the force reference sim (round 18.1)', function () {
  describe('the boxes keep apart in the sim: one separation sweep per tick (116.1; projection since 118.2)', function () {
    it(
      'a field denser than its boxes allow rests on the floor budget: a sweep cannot open it, so the run does not sweep forever (118.4)',
      { timeout: 15000 },
      function () {
        // the 118.1 regime: a 3k random graph at the default ideal
        // length settles with most of its padded 12 px boxes inside a
        // neighbour's, and the local passes cannot open it — the 25k
        // scene on the page under 'sim' alone.  Without the budget the
        // largest push never drops under the threshold and an infinite
        // run never rests
        const n = 3000;
        const list = [];
        let a = 42;
        const rand = () => {
          a = (a + 0x6d2b79f5) >>> 0;

          let t = a;

          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };

        for (let e = 0; e < n * 2; e++) {
          list.push(Math.floor(rand() * n), Math.floor(rand() * n));
        }

        const ext = boxes(n, 12);
        const sim = mkSim(n, Uint32Array.from(list), {
          seed: 1,
          extents: ext,
          infinite: true,
        });
        let ticks = 0;

        while (!sim.idle() && ticks < 3000) {
          sim.step(1);
          ticks++;
        }

        expect(sim.idle()).to.equal(true);
        // ~460 ticks to the floor, then the budget
        expect(ticks).to.be.within(600, 700);
        // and it rested with overlap left: the field a sweep cannot open
        expect(probe(sim.positions, n, ext).overlaps).to.be.greaterThan(100);
      },
    );
  });
});

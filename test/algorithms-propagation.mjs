import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 70: the propagation and pairwise-measure families — random
// walk with restart, heat diffusion, effective resistance, SimRank.
// Every expected value is a closed form on a fixture small enough to
// verify by eye (circuit identities, the matrix exponential of a pair
// and a triangle, SimRank's fixed point on a 4-cycle), so a defect in
// either executor's shared maths moves a number rather than slipping
// under a tolerance.
describe('algorithms: the propagation families (round 70)', function () {
  describe('eles.randomWalkWithRestart()', function () {
    var cy;

    beforeEach(function () {
      // a—b: with restart c at seed a, p(a) = c/(1−(1−c)²)
      cy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });
    });

    it('matches the closed form on a pair, and conserves probability', async function () {
      var r = await cy.elements().randomWalkWithRestart({
        seeds: cy.$id('a'),
        restartProbability: 0.5,
        tolerance: 1e-12,
      });

      expect(r.score(cy.$id('a'))).to.be.closeTo(2 / 3, 1e-9);
      expect(r.score(cy.$id('b'))).to.be.closeTo(1 / 3, 1e-9);
      expect(r.score(cy.$id('a')) + r.score(cy.$id('b'))).to.be.closeTo(
        1,
        1e-9,
      );
    });

    it('spreads restart mass uniformly over multiple seeds', async function () {
      var r = await cy.elements().randomWalkWithRestart({
        seeds: cy.nodes(),
        restartProbability: 0.5,
      });

      // symmetric seeds on a symmetric graph: exactly half each
      expect(r.score(cy.$id('a'))).to.be.closeTo(0.5, 1e-9);
      expect(r.score(cy.$id('b'))).to.be.closeTo(0.5, 1e-9);
    });

    it('a directed sink absorbs the walk (documented leak)', async function () {
      var r = await cy.elements().randomWalkWithRestart({
        seeds: cy.$id('a'),
        restartProbability: 0.5,
        directed: true,
        tolerance: 1e-12,
      });

      // only the restart feeds a; b receives and never returns
      expect(r.score(cy.$id('a'))).to.be.closeTo(0.5, 1e-9);
      expect(r.score(cy.$id('b'))).to.be.closeTo(0.25, 1e-9);
    });

    it('validates seeds, restartProbability and executor synchronously', function () {
      expect(() => cy.elements().randomWalkWithRestart({})).to.throw(
        TypeError,
        /seeds/,
      );
      expect(() =>
        cy
          .elements()
          .randomWalkWithRestart({ seeds: cy.$id('a'), restartProbability: 2 }),
      ).to.throw(TypeError, /restartProbability/);
      expect(() =>
        cy
          .elements()
          .randomWalkWithRestart({ seeds: cy.$id('a'), executor: 'tpu' }),
      ).to.throw(TypeError, /executor/);
    });

    it('the proximity form agrees with the seed form column by column', async function () {
      var seedRun = await cy.elements().randomWalkWithRestart({
        seeds: cy.$id('a'),
        restartProbability: 0.5,
        tolerance: 1e-12,
      });
      var prox = await cy.elements().randomWalkWithRestartProximity({
        restartProbability: 0.5,
        tolerance: 1e-12,
      });

      expect(prox.proximity(cy.$id('a'), cy.$id('a'))).to.be.closeTo(
        seedRun.score(cy.$id('a')),
        1e-9,
      );
      expect(prox.proximity(cy.$id('a'), cy.$id('b'))).to.be.closeTo(
        seedRun.score(cy.$id('b')),
        1e-9,
      );
    });
  });

  describe('eles.heatDiffusion() and eles.heatKernel()', function () {
    // exp(−tL) on a unit pair: ½(1 ± e^(−2t))
    var pair;
    var t = 0.5;
    var e2 = Math.exp(-2 * t);

    beforeEach(function () {
      pair = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'ab', source: 'a', target: 'b' } },
        ],
      });
    });

    it('matches the matrix exponential of a pair', async function () {
      var k = await pair.elements().heatKernel({ time: t });

      expect(k.heat(pair.$id('a'), pair.$id('a'))).to.be.closeTo(
        (1 + e2) / 2,
        1e-9,
      );
      expect(k.heat(pair.$id('a'), pair.$id('b'))).to.be.closeTo(
        (1 - e2) / 2,
        1e-9,
      );
    });

    it('matches the matrix exponential of a triangle', async function () {
      var tri = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { source: 'a', target: 'b' } },
          { data: { source: 'b', target: 'c' } },
          { data: { source: 'c', target: 'a' } },
        ],
      });
      var e3 = Math.exp(-3 * t);
      var k = await tri.elements().heatKernel({ time: t });

      expect(k.heat(tri.$id('a'), tri.$id('a'))).to.be.closeTo(
        (1 + 2 * e3) / 3,
        1e-9,
      );
      expect(k.heat(tri.$id('a'), tri.$id('b'))).to.be.closeTo(
        (1 - e3) / 3,
        1e-9,
      );
    });

    it('conserves heat, including through the scaling path at large time', async function () {
      // t=10 forces several squarings (2^s operator applications), so
      // this pins the scaling machinery, not just the raw series
      var d = await pair.elements().heatDiffusion({
        seeds: pair.$id('a'),
        time: 10,
      });
      var sum = d.score(pair.$id('a')) + d.score(pair.$id('b'));

      expect(sum).to.be.closeTo(1, 1e-9);
      // at t=10 the pair has fully mixed
      expect(d.score(pair.$id('b'))).to.be.closeTo(0.5, 1e-6);
    });

    it('doubled weights at halved time is the identity', async function () {
      var k = await pair.elements().heatKernel({
        time: t / 2,
        weight: () => 2,
      });

      expect(k.heat(pair.$id('a'), pair.$id('b'))).to.be.closeTo(
        (1 - e2) / 2,
        1e-9,
      );
    });

    it('validates time, weights, seeds and executor', async function () {
      expect(() => pair.elements().heatKernel({ time: -1 })).to.throw(
        TypeError,
        /time/,
      );
      expect(() => pair.elements().heatDiffusion({ time: 1 })).to.throw(
        TypeError,
        /seeds/,
      );
      expect(() => pair.elements().heatKernel({ executor: 'tpu' })).to.throw(
        TypeError,
        /executor/,
      );

      // the weight guard fires inside the routed run, so it rejects
      var err = await pair
        .elements()
        .heatKernel({ weight: () => -1 })
        .then(
          () => null,
          (e) => e,
        );

      expect(err).to.be.instanceOf(TypeError);
      expect(err.message).to.match(/positive finite edge weights/);
    });
  });

  describe('eles.effectiveResistance()', function () {
    var g = (els) => cytoscape({ elements: els });

    it('answers the series, parallel and triangle circuit identities', async function () {
      var path = g([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'b', target: 'c' } },
      ]);
      var r = await path.elements().effectiveResistance();

      // two unit resistors in series
      expect(r.resistance(path.$id('a'), path.$id('c'))).to.be.closeTo(2, 1e-9);
      // commute time = volume · R = 4 · 2
      expect(r.commuteTime(path.$id('a'), path.$id('c'))).to.be.closeTo(
        8,
        1e-9,
      );
      expect(r.resistance(path.$id('a'), path.$id('a'))).to.equal(0);

      var tri = g([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'b', target: 'c' } },
        { data: { source: 'c', target: 'a' } },
      ]);

      r = await tri.elements().effectiveResistance();

      // 1Ω in parallel with 2Ω
      expect(r.resistance(tri.$id('a'), tri.$id('b'))).to.be.closeTo(
        2 / 3,
        1e-9,
      );
      expect(r.commuteTime(tri.$id('a'), tri.$id('b'))).to.be.closeTo(4, 1e-9);

      var par = g([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { source: 'a', target: 'b' } },
        { data: { source: 'a', target: 'b' } },
      ]);

      r = await par.elements().effectiveResistance();

      // parallel edges sum their conductances
      expect(r.resistance(par.$id('a'), par.$id('b'))).to.be.closeTo(0.5, 1e-9);
    });

    it('reads weights as conductances', async function () {
      var pair = g([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { source: 'a', target: 'b' } },
      ]);
      var r = await pair.elements().effectiveResistance({ weight: () => 4 });

      expect(r.resistance(pair.$id('a'), pair.$id('b'))).to.be.closeTo(
        0.25,
        1e-9,
      );
    });

    it('answers Infinity across components', async function () {
      var disc = g([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'z' } },
        { data: { source: 'a', target: 'b' } },
      ]);
      var r = await disc.elements().effectiveResistance();

      expect(r.resistance(disc.$id('a'), disc.$id('z'))).to.equal(Infinity);
      expect(r.commuteTime(disc.$id('a'), disc.$id('z'))).to.equal(Infinity);
    });

    it('rejects a non-positive conductance', async function () {
      var pair = g([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { source: 'a', target: 'b' } },
      ]);
      var err = await pair
        .elements()
        .effectiveResistance({ weight: () => 0 })
        .then(
          () => null,
          (e) => e,
        );

      expect(err).to.be.instanceOf(TypeError);
      expect(err.message).to.match(/conductances/);
    });
  });

  describe('eles.simRank()', function () {
    it('reaches the 4-cycle fixed point s(a,c) = C(1+x)/2', async function () {
      // opposite corners of a 4-cycle have identical neighborhoods:
      // x = C(1+x)/2 → x = 2/3 at C = 0.8; adjacent corners stay 0
      var cy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'd' } },
          { data: { source: 'a', target: 'b' } },
          { data: { source: 'b', target: 'c' } },
          { data: { source: 'c', target: 'd' } },
          { data: { source: 'd', target: 'a' } },
        ],
      });
      var r = await cy.elements().simRank({
        tolerance: 1e-10,
        maxIterations: 500,
      });

      expect(r.similarity(cy.$id('a'), cy.$id('c'))).to.be.closeTo(2 / 3, 1e-6);
      expect(r.similarity(cy.$id('a'), cy.$id('b'))).to.equal(0);
      expect(r.similarity(cy.$id('a'), cy.$id('a'))).to.equal(1);
    });

    it('directed: co-cited nodes score C, sources score 0', async function () {
      // c→a, c→b: a and b share the in-neighbor c → s = C·s(c,c) = C
      var cited = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { source: 'c', target: 'a' } },
          { data: { source: 'c', target: 'b' } },
        ],
      });
      var r = await cited.elements().simRank({ directed: true });

      expect(r.similarity(cited.$id('a'), cited.$id('b'))).to.be.closeTo(
        0.8,
        1e-9,
      );

      // a→c, b→c: a and b have empty in-neighborhoods → 0
      var citing = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { source: 'a', target: 'c' } },
          { data: { source: 'b', target: 'c' } },
        ],
      });

      r = await citing.elements().simRank({ directed: true });
      expect(r.similarity(citing.$id('a'), citing.$id('b'))).to.equal(0);
    });

    it('validates dampingFactor and executor synchronously', function () {
      var cy = cytoscape({ elements: [{ data: { id: 'a' } }] });

      expect(() => cy.elements().simRank({ dampingFactor: 1.5 })).to.throw(
        TypeError,
        /dampingFactor/,
      );
      expect(() => cy.elements().simRank({ dampingFactor: 0 })).to.throw(
        TypeError,
        /dampingFactor/,
      );
      expect(() => cy.elements().simRank({ executor: 'tpu' })).to.throw(
        TypeError,
        /executor/,
      );
    });
  });
});

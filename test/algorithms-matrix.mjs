import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// Round 69: the matmul-first algorithm families — triangle counting,
// neighborhood similarity, Katz centrality — plus the closeness
// family's move onto the executor tier.  Every expected value here is
// hand-computed on a fixture small enough to verify by eye, so a
// defect in either executor's shared maths moves a number rather than
// slipping under a tolerance.
describe('algorithms: the matrix families (round 69)', function () {
  var cy;
  var id = (x) => cy.$id(x);

  // K4 minus the c–d edge: triangles abc and abd, and c/d have
  // identical neighborhoods {a, b}
  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'ac', source: 'a', target: 'c' } },
        { data: { id: 'ad', source: 'a', target: 'd' } },
        { data: { id: 'bc', source: 'b', target: 'c' } },
        { data: { id: 'bd', source: 'b', target: 'd' } },
      ],
    });
  });

  describe('eles.triangleCount()', function () {
    it('counts per-node triangles, the total, and the coefficients', async function () {
      var res = await cy.elements().triangleCount();

      expect(res.triangles(id('a'))).to.equal(2); // abc, abd
      expect(res.triangles(id('b'))).to.equal(2);
      expect(res.triangles(id('c'))).to.equal(1); // abc
      expect(res.triangles(id('d'))).to.equal(1);
      expect(res.totalTriangles).to.equal(2);

      // a: 2 triangles over C(3,2) = 3 neighbor pairs
      expect(res.clusteringCoefficient(id('a'))).to.equal(2 / 3);
      // c: 1 triangle over C(2,2) = 1 pair
      expect(res.clusteringCoefficient(id('c'))).to.equal(1);

      // triples: 3 + 3 + 1 + 1 = 8; transitivity = 3·2 / 8
      expect(res.transitivity).to.equal(0.75);
    });

    it('ignores direction, parallel edges and loops', async function () {
      // a parallel ab edge, a reversed ba edge and a loop must change
      // nothing — the family reads the simple undirected graph
      cy.add([
        { data: { id: 'ab2', source: 'a', target: 'b' } },
        { data: { id: 'ba', source: 'b', target: 'a' } },
        { data: { id: 'aa', source: 'a', target: 'a' } },
      ]);

      var res = await cy.elements().triangleCount();

      expect(res.triangles(id('a'))).to.equal(2);
      expect(res.totalTriangles).to.equal(2);
      expect(res.transitivity).to.equal(0.75);
    });

    it('answers zero on a triangle-free graph', async function () {
      cy.$id('ab').remove(); // the chord both triangles share

      var res = await cy.elements().triangleCount();

      expect(res.totalTriangles).to.equal(0);
      expect(res.transitivity).to.equal(0);
      expect(res.clusteringCoefficient(id('a'))).to.equal(0);
    });

    it('answers undefined for a node outside the collection', async function () {
      var sub = cy.elements().difference(id('d'));
      var res = await sub.triangleCount();

      expect(res.triangles(id('d'))).to.equal(undefined);
      expect(res.clusteringCoefficient(id('d'))).to.equal(undefined);
      expect(res.totalTriangles).to.equal(1); // only abc survives
    });

    it('handles an empty collection', async function () {
      var res = await cy.collection().triangleCount();

      expect(res.totalTriangles).to.equal(0);
      expect(res.transitivity).to.equal(0);
    });

    it('validates `executor` synchronously', function () {
      expect(() => cy.elements().triangleCount({ executor: 'tpu' })).to.throw(
        TypeError,
        /executor/,
      );
    });
  });

  describe('eles.neighborhoodSimilarity()', function () {
    it('jaccard: shared neighbors over the union', async function () {
      var res = await cy.elements().neighborhoodSimilarity();

      // N(a) = {b,c,d}, N(b) = {a,c,d}: 2 shared, 4 in the union
      expect(res.similarity(id('a'), id('b'))).to.equal(0.5);
      // N(c) = N(d) = {a,b}
      expect(res.similarity(id('c'), id('d'))).to.equal(1);
      // symmetric, and a node matches itself
      expect(res.similarity(id('b'), id('a'))).to.equal(0.5);
      expect(res.similarity(id('a'), id('a'))).to.equal(1);
    });

    it('cosine and overlap re-normalize the same counts', async function () {
      var cos = await cy
        .elements()
        .neighborhoodSimilarity({ metric: 'cosine' });
      var over = await cy
        .elements()
        .neighborhoodSimilarity({ metric: 'overlap' });

      // a,b: 2 shared over √(3·3) = 3, and over min(3,3) = 3
      expect(cos.similarity(id('a'), id('b'))).to.equal(2 / 3);
      expect(over.similarity(id('a'), id('b'))).to.equal(2 / 3);
      // a,c: 1 shared (b) over √(3·2) and over min(3,2) = 2
      expect(cos.similarity(id('a'), id('c'))).to.equal(1 / Math.sqrt(6));
      expect(over.similarity(id('a'), id('c'))).to.equal(0.5);
    });

    it('directed: compares out-neighborhoods', async function () {
      // a→b, a→c, d→b, d→c: a and d share both out-neighbors while
      // undirected reading would also give b and c neighborhoods
      var dcy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'd' } },
          { data: { source: 'a', target: 'b' } },
          { data: { source: 'a', target: 'c' } },
          { data: { source: 'd', target: 'b' } },
          { data: { source: 'd', target: 'c' } },
        ],
      });
      var res = await dcy.elements().neighborhoodSimilarity({ directed: true });

      expect(res.similarity(dcy.$id('a'), dcy.$id('d'))).to.equal(1);
      // b has no out-neighbors: any pair with an empty side answers 0
      expect(res.similarity(dcy.$id('a'), dcy.$id('b'))).to.equal(0);
      expect(res.similarity(dcy.$id('b'), dcy.$id('c'))).to.equal(0);
    });

    it('answers undefined outside the collection and 0 on empty sets', async function () {
      var lone = cy.add({ data: { id: 'z' } });
      var res = await cy.elements().neighborhoodSimilarity();

      expect(res.similarity(id('z'), id('a'))).to.equal(0); // N(z) = ∅
      expect(res.similarity(id('z'), id('z'))).to.equal(0); // 0/0 → 0

      var sub = cy.elements().difference(lone);
      var out = await sub.neighborhoodSimilarity();

      expect(out.similarity(id('z'), id('a'))).to.equal(undefined);
    });

    it('validates `metric` and `executor` synchronously', function () {
      expect(() =>
        cy.elements().neighborhoodSimilarity({ metric: 'dice' }),
      ).to.throw(TypeError, /metric/);
      expect(() =>
        cy.elements().neighborhoodSimilarity({ executor: 'tpu' }),
      ).to.throw(TypeError, /executor/);
    });
  });

  describe('eles.katzCentrality()', function () {
    it('matches the closed form on a star', async function () {
      // star a–b, a–c, a–d: x_a = α·3·x_b + β and x_b = α·x_a + β, so
      // x_a = (1 + 3α)β / (1 − 3α²)
      var scy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { id: 'd' } },
          { data: { source: 'a', target: 'b' } },
          { data: { source: 'a', target: 'c' } },
          { data: { source: 'a', target: 'd' } },
        ],
      });
      var alpha = 0.1;
      var res = await scy.elements().katzCentrality({ alpha });
      var center = (1 + 3 * alpha) / (1 - 3 * alpha * alpha);

      expect(res.katz(scy.$id('a'))).to.be.closeTo(center, 1e-6);
      expect(res.katz(scy.$id('b'))).to.be.closeTo(1 + alpha * center, 1e-6);
      expect(res.katzNormalized(scy.$id('a'))).to.equal(1);
      expect(res.katzNormalized(scy.$id('b'))).to.be.below(1);
      // the British spelling answers identically
      expect(res.katzNormalised(scy.$id('b'))).to.equal(
        res.katzNormalized(scy.$id('b')),
      );
    });

    it('directed: counts incoming walks only', async function () {
      // a→b→c: x_a = β, x_b = β + α·x_a, x_c = β + α·x_b
      var dcy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'c' } },
          { data: { source: 'a', target: 'b' } },
          { data: { source: 'b', target: 'c' } },
        ],
      });
      var alpha = 0.25;
      var res = await dcy.elements().katzCentrality({ alpha, directed: true });

      expect(res.katz(dcy.$id('a'))).to.be.closeTo(1, 1e-6);
      expect(res.katz(dcy.$id('b'))).to.be.closeTo(1 + alpha, 1e-6);
      expect(res.katz(dcy.$id('c'))).to.be.closeTo(
        1 + alpha * (1 + alpha),
        1e-6,
      );
    });

    it('weights attenuate per edge', async function () {
      // doubling every weight at half the alpha is the identity
      var opts = { alpha: 0.05, weight: (e) => 2 };
      var base = await cy.elements().katzCentrality({ alpha: 0.1 });
      var scaled = await cy.elements().katzCentrality(opts);

      cy.nodes().forEach((n) => {
        expect(scaled.katz(n)).to.be.closeTo(base.katz(n), 1e-6);
      });
    });

    it('validates `alpha`, `beta` and `executor` synchronously', function () {
      expect(() => cy.elements().katzCentrality({ alpha: 0 })).to.throw(
        TypeError,
        /alpha/,
      );
      expect(() => cy.elements().katzCentrality({ alpha: -1 })).to.throw(
        TypeError,
        /alpha/,
      );
      expect(() => cy.elements().katzCentrality({ alpha: Infinity })).to.throw(
        TypeError,
        /alpha/,
      );
      expect(() => cy.elements().katzCentrality({ beta: NaN })).to.throw(
        TypeError,
        /beta/,
      );
      expect(() => cy.elements().katzCentrality({ executor: 'tpu' })).to.throw(
        TypeError,
        /executor/,
      );
    });

    it('answers undefined outside the collection, 0 normalized', async function () {
      var lone = cy.add({ data: { id: 'z' } });
      var sub = cy.elements().difference(lone);
      var res = await sub.katzCentrality();

      expect(res.katz(id('z'))).to.equal(undefined);
      expect(res.katzNormalized(id('z'))).to.equal(0);
    });
  });

  describe('eles.closenessCentralityNormalized() on the executor tier', function () {
    it('validates `executor` synchronously', function () {
      expect(() =>
        cy.elements().closenessCentralityNormalized({ executor: 'tpu' }),
      ).to.throw(TypeError, /executor/);
    });

    it('harmonic tolerates disconnection where plain answers 0', async function () {
      var dcy = cytoscape({
        elements: [
          { data: { id: 'a' } },
          { data: { id: 'b' } },
          { data: { id: 'z' } }, // its own component
          { data: { source: 'a', target: 'b' } },
        ],
      });
      var harmonic = await dcy.elements().closenessCentralityNormalized({});

      // a: 1/1 + 1/∞ = 1 — the max; z: 0
      expect(harmonic.closeness(dcy.$id('a'))).to.equal(1);
      expect(harmonic.closeness(dcy.$id('z'))).to.equal(0);

      var plain = await dcy
        .elements()
        .closenessCentralityNormalized({ harmonic: false });

      // every node has an unreachable peer, so every sum is infinite,
      // every score 0, and the accessor's max-of-zero guard answers 0
      expect(plain.closeness(dcy.$id('a'))).to.equal(0);
      expect(plain.closeness(dcy.$id('z'))).to.equal(0);
    });
  });
});

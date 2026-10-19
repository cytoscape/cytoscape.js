import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// ported from the centrality/pageRank assertions of test/collection-algorithms.mjs
describe('gpu/algorithms: pageRank + centralities', function () {
  var cy;
  var a, b, c, d, e;
  var weight = (ele) => ele.data('weight');

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'e' } },
        { data: { id: 'f' } },
        { data: { id: 'ae', weight: 1, source: 'a', target: 'e' } },
        { data: { id: 'ab', weight: 3, source: 'a', target: 'b' } },
        { data: { id: 'be', weight: 4, source: 'b', target: 'e' } },
        { data: { id: 'bc', weight: 5, source: 'b', target: 'c' } },
        { data: { id: 'ce', weight: 6, source: 'c', target: 'e' } },
        { data: { id: 'cd', weight: 2, source: 'c', target: 'd' } },
        { data: { id: 'cf', weight: 1, source: 'c', target: 'f' } },
        { data: { id: 'de', weight: 7, source: 'd', target: 'e' } },
        { data: { id: 'df', weight: 8, source: 'd', target: 'f' } },
      ],
    });

    a = cy.$id('a');
    b = cy.$id('b');
    c = cy.$id('c');
    d = cy.$id('d');
    e = cy.$id('e');
  });

  var dcOf = (opts) => {
    var res = {};

    cy.nodes().forEach((ele) => {
      res[ele.id()] = cy.elements().degreeCentrality({ root: ele, ...opts });
    });

    return res;
  };

  var ccOf = (opts) => {
    var res = {};

    cy.nodes().forEach((ele) => {
      res[ele.id()] = cy.elements().closenessCentrality({ root: ele, ...opts });
    });

    return res;
  };

  it('eles.pageRank(): ranks sum to 1', async function () {
    var res = await cy.elements().pageRank({ iterations: 20 });
    var sum = 0;

    cy.nodes().forEach((node) => {
      sum += res.rank(node);
    });

    expect(Math.abs(sum - 1)).to.be.below(0.0001);
  });

  it('eles.degreeCentrality() unweighted undirected (alpha 0 and 1 agree)', function () {
    for (var alpha of [0, 1]) {
      var res = dcOf({ directed: false, alpha });

      expect(res.a.degree).to.equal(2);
      expect(res.b.degree).to.equal(3);
      expect(res.c.degree).to.equal(4);
      expect(res.d.degree).to.equal(3);
      expect(res.e.degree).to.equal(4);
    }
  });

  it('eles.degreeCentrality() weighted undirected alpha = 0', function () {
    var res = dcOf({ weight, directed: false, alpha: 0 });

    expect(res.a.degree).to.equal(2);
    expect(res.b.degree).to.equal(3);
    expect(res.c.degree).to.equal(4);
    expect(res.d.degree).to.equal(3);
    expect(res.e.degree).to.equal(4);
  });

  it('eles.degreeCentrality() weighted undirected alpha = 1', function () {
    var res = dcOf({ weight, directed: false, alpha: 1 });

    expect(res.a.degree).to.equal(4);
    expect(res.b.degree).to.equal(12);
    expect(res.c.degree).to.equal(14);
    expect(res.d.degree).to.equal(17);
    expect(res.e.degree).to.equal(18);
  });

  it('eles.degreeCentrality() unweighted directed (alpha 0 and 1 agree)', function () {
    for (var alpha of [0, 1]) {
      var res = dcOf({ directed: true, alpha });

      expect(res.a.indegree).to.equal(0);
      expect(res.b.indegree).to.equal(1);
      expect(res.c.indegree).to.equal(1);
      expect(res.d.indegree).to.equal(1);
      expect(res.e.indegree).to.equal(4);

      expect(res.a.outdegree).to.equal(2);
      expect(res.b.outdegree).to.equal(2);
      expect(res.c.outdegree).to.equal(3);
      expect(res.d.outdegree).to.equal(2);
      expect(res.e.outdegree).to.equal(0);
    }
  });

  it('eles.degreeCentrality() weighted directed alpha = 1', function () {
    var res = dcOf({ weight, directed: true, alpha: 1 });

    expect(res.a.indegree).to.equal(0);
    expect(res.b.indegree).to.equal(3);
    expect(res.c.indegree).to.equal(5);
    expect(res.d.indegree).to.equal(2);
    expect(res.e.indegree).to.equal(18);

    expect(res.a.outdegree).to.equal(4);
    expect(res.b.outdegree).to.equal(9);
    expect(res.c.outdegree).to.equal(9);
    expect(res.d.outdegree).to.equal(15);
    expect(res.e.outdegree).to.equal(0);
  });

  it('eles.degreeCentralityNormalized() undirected', function () {
    var res = cy.elements().degreeCentralityNormalized({ directed: false });

    expect(res.degree(c)).to.equal(1); // max degree 4
    expect(res.degree(a)).to.equal(0.5);
  });

  it('eles.closenessCentrality() unweighted undirected', function () {
    var res = ccOf({});

    expect(res.a.toFixed(2)).to.equal('3.33');
    expect(res.b).to.equal(4);
    expect(res.c).to.equal(4.5);
    expect(res.d).to.equal(4);
    expect(res.e).to.equal(4.5);
  });

  it('eles.closenessCentrality() unweighted directed', function () {
    var res = ccOf({ directed: true });

    expect(+res.a.toFixed(2)).to.equal(3.17);
    expect(res.b).to.equal(3);
    expect(res.c).to.equal(3);
    expect(res.d).to.equal(2);
    expect(res.e).to.equal(0);
  });

  it('eles.closenessCentrality() weighted undirected', function () {
    var res = ccOf({ weight });

    expect(+res.a.toFixed(2)).to.equal(1.73);
    expect(+res.b.toFixed(2)).to.equal(1.09);
    expect(+res.c.toFixed(2)).to.equal(2.01);
    expect(+res.d.toFixed(2)).to.equal(1.24);
    expect(+res.e.toFixed(2)).to.equal(1.7);
  });

  it('eles.closenessCentrality() weighted directed', function () {
    var res = ccOf({ weight, directed: true });

    expect(+res.a.toFixed(2)).to.equal(1.67);
    expect(+res.b.toFixed(2)).to.equal(0.76);
    expect(+res.c.toFixed(2)).to.equal(1.67);
    expect(+res.d.toFixed(2)).to.equal(0.27);
    expect(res.e).to.equal(0);
  });

  it('eles.closenessCentralityNormalized()', async function () {
    // async since round 69: the whole-collection form is the O(n³)
    // all-pairs tier, so it routes through the executor like
    // floydWarshall
    var res = await cy.elements().closenessCentralityNormalized({});

    expect(res.closeness(c)).to.equal(1); // c and e share the max
    expect(res.closeness(e)).to.equal(1);
    expect(res.closeness(a)).to.be.within(0.7, 0.8); // 3.33 / 4.5
  });

  it('closenessCentralityNormalized: the unweighted BFS path agrees with the FW route (72.3)', async function () {
    // an unweighted call walks a BFS per source; `weight: () => 1`
    // forces the Floyd–Warshall route over unit weights, whose
    // distances are the same hop counts — so plain-mode scores are
    // bit-identical (integer sums) and harmonic scores agree to f64
    // summation order.  Ring + chords at n=60 leaves real distances;
    // a second component checks the unreachable rule on both paths.
    var els = [];
    var n = 60;

    for (var i = 0; i < n; i++) {
      els.push({ data: { id: 'n' + i } });
    }

    for (var i = 0; i < n; i++) {
      var half = i < 40 ? 0 : 40;
      var span = i < 40 ? 40 : 20;

      els.push({
        data: {
          source: 'n' + i,
          target: 'n' + (half + ((i - half + 1) % span)),
        },
      });

      if (i % 5 === 0 && i < 40) {
        els.push({
          data: { source: 'n' + i, target: 'n' + ((i * 13 + 7) % 40) },
        });
      }
    }

    var g = cytoscape({ elements: els });
    var unit = () => 1;

    for (var directed of [false, true]) {
      for (var harmonic of [true, false]) {
        var bfs = await g
          .elements()
          .closenessCentralityNormalized({ directed, harmonic });
        var fw = await g
          .elements()
          .closenessCentralityNormalized({ directed, harmonic, weight: unit });
        var maxDelta = 0;
        var nonZero = 0;

        g.nodes().forEach((node) => {
          var b = bfs.closeness(node);

          maxDelta = Math.max(maxDelta, Math.abs(b - fw.closeness(node)));
          nonZero += b > 0 ? 1 : 0;
        });

        if (harmonic) {
          expect(maxDelta, `harmonic directed=${directed}`).to.be.below(1e-12);
          expect(nonZero).to.equal(n); // harmonic survives disconnection
        } else {
          expect(maxDelta, `plain directed=${directed}`).to.equal(0);
          expect(nonZero).to.equal(0); // every node has an unreachable peer
        }
      }
    }

    // the plain rule discriminates on a connected graph too: drop the
    // second component and plain scores are positive and still bit-equal
    var one = cytoscape({
      elements: els.filter((e) => {
        var ids = [e.data.id, e.data.source, e.data.target].filter(Boolean);

        return ids.every((id) => Number(id.slice(1)) < 40);
      }),
    });
    var pb = await one
      .elements()
      .closenessCentralityNormalized({ harmonic: false });
    var pf = await one
      .elements()
      .closenessCentralityNormalized({ harmonic: false, weight: unit });
    var maxPlain = 0;
    var positive = 0;

    one.nodes().forEach((node) => {
      maxPlain = Math.max(
        maxPlain,
        Math.abs(pb.closeness(node) - pf.closeness(node)),
      );
      positive += pb.closeness(node) > 0 ? 1 : 0;
    });

    expect(maxPlain).to.equal(0);
    expect(positive).to.equal(40);
  });

  it('eles.betweennessCentrality() unweighted undirected', async function () {
    var res = await cy.elements().betweennessCentrality();

    expect(res.betweenness(a)).to.equal(0);
    expect(res.betweenness(b).toFixed(2)).to.equal('1.67');
    expect(res.betweenness(c).toFixed(2)).to.equal('5.33');
    expect(res.betweenness(d).toFixed(2)).to.equal('1.67');
    expect(res.betweenness(e).toFixed(2)).to.equal('5.33');
  });

  it('eles.betweennessCentrality() unweighted directed', async function () {
    var res = await cy.elements().betweennessCentrality({ directed: true });

    expect(res.betweenness(a)).to.equal(0);
    expect(res.betweenness(b)).to.equal(3);
    expect(res.betweenness(c)).to.equal(4);
    expect(res.betweenness(d)).to.equal(0);
    expect(res.betweenness(e)).to.equal(0);
  });

  it('eles.betweennessCentrality() weighted undirected', async function () {
    var res = await cy.elements().betweennessCentrality({ weight });

    expect(res.betweenness(a)).to.equal(1);
    expect(res.betweenness(b)).to.equal(0);
    expect(res.betweenness(c)).to.equal(10);
    expect(res.betweenness(d)).to.equal(0);
    expect(res.betweenness(e)).to.equal(6);
  });

  it('eles.betweennessCentrality() weighted directed', async function () {
    var res = await cy
      .elements()
      .betweennessCentrality({ weight, directed: true });

    expect(res.betweenness(a)).to.equal(0);
    expect(res.betweenness(b)).to.equal(3);
    expect(res.betweenness(c)).to.equal(4);
    expect(res.betweenness(d)).to.equal(0);
    expect(res.betweenness(e)).to.equal(0);
  });

  it('eles.betweennessCentrality() unweighted directed: multiple shortest paths', async function () {
    cy.remove(cy.$id('ae'));
    cy.remove(cy.$id('bc'));
    cy.remove(cy.$id('cd'));
    cy.remove(cy.$id('ce'));
    cy.add([
      { group: 'edges', data: { id: 'ad', source: 'a', target: 'd' } },
      { group: 'edges', data: { id: 'ec', source: 'e', target: 'c' } },
    ]);

    var res = await cy.elements().betweennessCentrality({ directed: true });

    expect(res.betweenness(a)).to.equal(0);
    expect(res.betweenness(b)).to.equal(1);
    expect(res.betweenness(c)).to.equal(2);
    expect(res.betweenness(d)).to.equal(2);
    expect(res.betweenness(e)).to.equal(4);
  });

  it('betweennessNormalized divides by the max', async function () {
    var res = await cy.elements().betweennessCentrality();

    expect(res.betweennessNormalized(c)).to.equal(1);
    expect(res.betweennessNormalised(e)).to.equal(1);
    expect(res.betweennessNormalized(a)).to.equal(0);
  });

  // round 30.1: the two single-root centralities require a root, and
  // said so in a throw nothing had ever taken.  aStar/bellmanFord/
  // dijkstra have had root specs since round 10; these two were the
  // siblings without one, so a missing root was unmeasured — and the
  // edge-only case matters because it reaches the same guard by a
  // different route (a collection with no node in it).
  it('degreeCentrality and closenessCentrality require a root', function () {
    expect(() => cy.elements().degreeCentrality()).to.throw(
      /degreeCentrality requires a `root` node/,
    );
    expect(() => cy.elements().closenessCentrality({})).to.throw(
      /closenessCentrality requires a `root` node/,
    );

    // a collection holding no node reaches the same guard
    expect(() => cy.edges().degreeCentrality({ root: cy.edges() })).to.throw(
      /requires a `root` node/,
    );

    // control: with a root, both answer
    expect(cy.elements().degreeCentrality({ root: a }).degree).to.equal(2);
    expect(cy.elements().closenessCentrality({ root: b })).to.equal(4);
  });

  it('aliases resolve', async function () {
    expect(cy.elements().dc({ root: a }).degree).to.equal(2);
    expect(cy.elements().dcn({}).degree(c)).to.equal(1);
    expect(cy.elements().cc({ root: b })).to.equal(4);
    expect((await cy.elements().ccn({})).closeness(c)).to.equal(1);
    expect((await cy.elements().bc()).betweenness(a)).to.equal(0);
  });
});

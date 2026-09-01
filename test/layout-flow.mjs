import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 112.2: the flow layout — the Sugiyama-class layered built-in.
// The discriminating properties: edges advance monotonically along the
// flow axis (shuffled ranks go red), network simplex beats longest-path
// on the pulled-chain fixture (forcing layering: 'longest-path' goes
// red on the simplex spec — both are asserted, so the pair is its own
// control), the crossing sweep untangles the crossed bipartite fixture
// (skipping transpose/sweeps reproduces the crossing), and BK aligns a
// chain to one x (rank-centering would spread it).  Controls beyond
// those pairs (round 27, run once by hand): with `orderLayers` stubbed
// to identity the crossing spec goes red; with `assignX` returning
// per-layer centering the chain spec goes red.

describe('gpu/layout: flow (round 112)', function () {
  var cy;

  var mk = (elements) =>
    (cy = cytoscape({
      headlessWidth: 400,
      headlessHeight: 400,
      elements,
    }));

  var posOf = (id) => cy.$id(id).position();

  var nodes = (...ids) => ids.map((id) => ({ data: { id } }));
  var edges = (...pairs) =>
    pairs.map(([s, t]) => ({
      data: { id: `${s}->${t}`, source: s, target: t },
    }));

  var run = (opts) => cy.layout({ name: 'flow', fit: false, ...opts }).run();

  var diamond = () => ({
    nodes: nodes('a', 'b', 'c', 'd'),
    edges: edges(['a', 'b'], ['a', 'c'], ['b', 'd'], ['c', 'd']),
  });

  // chain a->b->c->d plus x->d: longest-path pins x to the top rank,
  // network simplex pulls it to one rank above d
  var pulledChain = () => ({
    nodes: nodes('a', 'b', 'c', 'd', 'x'),
    edges: edges(['a', 'b'], ['b', 'c'], ['c', 'd'], ['x', 'd']),
  });

  it('every edge advances along the flow axis', function () {
    mk(diamond());
    run();

    cy.edges().forEach((e) => {
      expect(e.target().position().y, e.id()).to.be.greaterThan(
        e.source().position().y,
      );
    });
  });

  it('ranks are rows: same-rank nodes share y, ranks are rankSep-separated', function () {
    mk(diamond());
    run({ rankSep: 80 });

    expect(posOf('b').y).to.equal(posOf('c').y);
    // 30px default node height: consecutive rank centres sit 30 + 80 apart
    expect(posOf('b').y - posOf('a').y).to.be.closeTo(110, 1e-6);
    expect(posOf('d').y - posOf('b').y).to.be.closeTo(110, 1e-6);
  });

  it('network simplex pulls a leaf chain tight (one rank above its target)', function () {
    mk(pulledChain());
    run();

    expect(posOf('x').y).to.equal(posOf('c').y);
  });

  it("layering: 'longest-path' leaves the pulled chain at the top (the control)", function () {
    mk(pulledChain());
    run({ layering: 'longest-path' });

    expect(posOf('x').y).to.equal(posOf('a').y);
  });

  it('crossing minimization untangles the crossed bipartite fixture', function () {
    // u1->v2, u2->v1 cross under input order; the sweep reorders one layer
    mk({
      nodes: nodes('r', 'u1', 'u2', 'v1', 'v2'),
      edges: edges(['r', 'u1'], ['r', 'u2'], ['u1', 'v2'], ['u2', 'v1']),
    });
    run();

    // the two child edges must not cross: the x-order of the parents
    // matches the x-order of their children
    var parentOrder = Math.sign(posOf('u1').x - posOf('u2').x);
    var childOrder = Math.sign(posOf('v2').x - posOf('v1').x);

    expect(parentOrder).to.not.equal(0);
    expect(parentOrder).to.equal(childOrder);
  });

  it('BK aligns a chain to a single x', function () {
    mk({
      nodes: nodes('a', 'b', 'c', 'd'),
      edges: edges(['a', 'b'], ['b', 'c'], ['c', 'd']),
    });
    run();

    expect(posOf('b').x).to.equal(posOf('a').x);
    expect(posOf('c').x).to.equal(posOf('a').x);
    expect(posOf('d').x).to.equal(posOf('a').x);
  });

  it('nodes in a rank respect size-aware separation', function () {
    mk({
      nodes: nodes('r', 'p', 'q', 's'),
      edges: edges(['r', 'p'], ['r', 'q'], ['r', 's']),
    });
    cy.nodes().style({ width: 40, height: 20 });
    run({ nodeSep: 25 });

    var xs = ['p', 'q', 's'].map((id) => posOf(id).x).sort((a, b) => a - b);

    expect(xs[1] - xs[0]).to.be.at.least(40 + 25 - 1e-6);
    expect(xs[2] - xs[1]).to.be.at.least(40 + 25 - 1e-6);
  });

  it('cycles terminate and still stratify', function () {
    mk({
      nodes: nodes('a', 'b', 'c'),
      edges: edges(['a', 'b'], ['b', 'c'], ['c', 'a']),
    });
    run();

    var ys = new Set(['a', 'b', 'c'].map((id) => posOf(id).y));

    expect(ys.size).to.equal(3); // one reversed edge, three ranks
  });

  it('two runs are bit-identical (determinism)', function () {
    mk(diamond());
    run();

    var first = cy.nodes().map((n) => ({ ...n.position() }));

    run();
    cy.nodes().forEach((n, i) => {
      expect(n.position().x, n.id()).to.equal(first[i].x);
      expect(n.position().y, n.id()).to.equal(first[i].y);
    });
  });

  it('directions map the flow axis', function () {
    mk({ nodes: nodes('a', 'b'), edges: edges(['a', 'b']) });

    run({ direction: 'rightward' });
    expect(posOf('b').x).to.be.greaterThan(posOf('a').x);
    expect(posOf('b').y).to.equal(posOf('a').y);

    run({ direction: 'upward' });
    expect(posOf('b').y).to.be.lessThan(posOf('a').y);

    run({ direction: 'leftward' });
    expect(posOf('b').x).to.be.lessThan(posOf('a').x);
  });

  it('disconnected components pack without overlap', function () {
    mk({
      nodes: nodes('a1', 'b1', 'a2', 'b2'),
      edges: edges(['a1', 'b1'], ['a2', 'b2']),
    });
    run();

    var bb1 = cy.$id('a1').union(cy.$id('b1')).boundingBox();
    var bb2 = cy.$id('a2').union(cy.$id('b2')).boundingBox();
    var disjoint =
      bb1.x2 <= bb2.x1 ||
      bb2.x2 <= bb1.x1 ||
      bb1.y2 <= bb2.y1 ||
      bb2.y2 <= bb1.y1;

    expect(disjoint, 'component boxes overlap').to.equal(true);
  });

  it('minLength stretches an edge across extra ranks', function () {
    mk({ nodes: nodes('a', 'b', 'c'), edges: edges(['a', 'b'], ['b', 'c']) });
    run({ minLength: 1 });

    var oneSpan = posOf('b').y - posOf('a').y; // 30px node + 60 rankSep

    run({
      minLength: (edge) => (edge.id() === 'a->b' ? 3 : 1),
    });
    // the two intermediate ranks hold only the dummy chain, so each
    // contributes rankSep alone (empty ranks have no row height)
    expect(posOf('b').y - posOf('a').y).to.be.closeTo(oneSpan + 2 * 60, 1e-6);
  });

  it('minLength takes the { data } score-mapping spelling', function () {
    mk({ nodes: nodes('a', 'b'), edges: edges(['a', 'b']) });
    cy.$id('a->b').data('stretch', 2);
    run({ minLength: { data: 'stretch' } });

    mk({ nodes: nodes('a', 'b'), edges: edges(['a', 'b']) });
    run();

    // rebuilt control: span 1; the mapped run spans 2 (one dummy rank,
    // contributing rankSep alone)
    var oneSpan = posOf('b').y - posOf('a').y;

    mk({ nodes: nodes('a', 'b'), edges: edges(['a', 'b']) });
    cy.$id('a->b').data('stretch', 2);
    run({ minLength: { data: 'stretch' } });
    expect(posOf('b').y - posOf('a').y).to.be.closeTo(oneSpan + 60, 1e-6);
  });

  it('locked nodes hold their place and drop out of the flow', function () {
    mk(diamond());
    cy.$id('d').position({ x: 777, y: 777 }).lock();
    run();

    expect(posOf('d')).to.deep.equal({ x: 777, y: 777 });
    expect(posOf('b').y).to.be.greaterThan(posOf('a').y);
  });

  it('eles.layout() scopes the run', function () {
    mk({
      nodes: nodes('a', 'b', 'out'),
      edges: edges(['a', 'b']),
    });
    cy.$id('out').position({ x: 555, y: 555 });
    cy.$id('a')
      .union(cy.$id('b'))
      .union(cy.$id('a->b'))
      .layout({
        name: 'flow',
        fit: false,
      })
      .run();

    expect(posOf('out')).to.deep.equal({ x: 555, y: 555 });
    expect(posOf('b').y).to.be.greaterThan(posOf('a').y);
  });

  it('boundingBox contains the drawing', function () {
    mk(diamond());
    run({ boundingBox: { x1: 100, y1: 100, w: 120, h: 90 } });

    cy.nodes().forEach((n) => {
      var p = n.position();

      expect(p.x).to.be.within(100, 220);
      expect(p.y).to.be.within(100, 190);
    });
  });

  describe('rank constraints', function () {
    it("'same' shares a rank across the graph", function () {
      mk(pulledChain());
      run({ rankConstraints: { same: [['b', 'x']] } });

      expect(posOf('x').y).to.equal(posOf('b').y);
    });

    it("'same' welds disconnected components onto one rank", function () {
      mk({
        nodes: nodes('a1', 'b1', 'a2', 'b2'),
        edges: edges(['a1', 'b1'], ['a2', 'b2']),
      });
      run({ rankConstraints: { same: [['b1', 'a2']] } });

      expect(posOf('a2').y).to.equal(posOf('b1').y);
    });

    it("'min' pins to the first rank, 'max' to the last", function () {
      mk({
        nodes: nodes('a', 'b', 'c', 'free'),
        edges: edges(['a', 'b'], ['b', 'c'], ['a', 'free']),
      });
      run({ rankConstraints: { max: ['free'] } });
      expect(posOf('free').y).to.equal(posOf('c').y);

      mk({
        nodes: nodes('a', 'b', 'c', 'lone'),
        edges: edges(['a', 'b'], ['b', 'c']),
      });
      run({ rankConstraints: { min: ['lone'] } });
      expect(posOf('lone').y).to.equal(posOf('a').y);
    });

    it('contradictory constraints throw', function () {
      mk({ nodes: nodes('a', 'b'), edges: edges(['a', 'b']) });
      expect(() => run({ rankConstraints: { same: [['a', 'b']] } })).to.throw(
        /contradictory/i,
      );

      mk({ nodes: nodes('a', 'b', 'c'), edges: edges(['a', 'b'], ['b', 'c']) });
      expect(() => run({ rankConstraints: { min: ['c'] } })).to.throw(
        /contradictory/i,
      );
    });

    it('unknown ids, selectors and non-arrays throw', function () {
      mk(diamond());
      expect(() => run({ rankConstraints: { min: ['nope'] } })).to.throw(
        /does not exist/,
      );
      expect(() => run({ rankConstraints: { min: ['#a'] } })).to.throw(
        /not selectors/,
      );
      expect(() => run({ rankConstraints: { min: 'a' } })).to.throw(
        /array of node ids/,
      );
      expect(() => run({ rankConstraints: { min: [7] } })).to.throw(
        /node ids \(strings\)/,
      );
      expect(() => run({ rankConstraints: { same: 'ab' } })).to.throw(
        /array of id arrays/,
      );
    });

    it('a constrained node outside the scope throws', function () {
      mk(diamond());
      cy.$id('d').lock();
      expect(() => run({ rankConstraints: { min: ['d'] } })).to.throw(
        /outside the layout scope/,
      );
    });
  });

  describe('option validation', function () {
    it('throws on a bad direction', function () {
      mk(diamond());
      expect(() => run({ direction: 'sideways' })).to.throw(
        /direction must be one of/,
      );
    });

    it('throws on a bad layering', function () {
      mk(diamond());
      expect(() => run({ layering: 'best' })).to.throw(/layering must be/);
    });

    it('throws on a bad cycleRemoval', function () {
      mk(diamond());
      expect(() => run({ cycleRemoval: 'magic' })).to.throw(
        /cycleRemoval must be/,
      );
    });

    it('throws on non-positive separations', function () {
      mk(diamond());
      expect(() => run({ nodeSep: 0 })).to.throw(/must be positive/);
      expect(() => run({ rankSep: -5 })).to.throw(/must be positive/);
    });

    it('throws on an out-of-range thoroughness', function () {
      mk(diamond());
      expect(() => run({ thoroughness: 0 })).to.throw(/between 1 and 10/);
      expect(() => run({ thoroughness: 11 })).to.throw(/between 1 and 10/);
    });

    it('throws on a malformed per-edge option', function () {
      mk(diamond());
      expect(() => run({ edgeWeight: 'heavy' })).to.throw(/number, a \{ data/);
    });
  });

  describe('finisher plumbing', function () {
    it('animate tweens to the same final positions', async function () {
      mk(diamond());
      run();

      var want = cy.nodes().map((n) => ({ ...n.position() }));

      mk(diamond());

      var layout = cy
        .layout({
          name: 'flow',
          fit: false,
          animate: true,
          animationDuration: 40,
        })
        .run();

      await layout.promise();
      cy.nodes().forEach((n, i) => {
        expect(n.position().x, n.id()).to.be.closeTo(want[i].x, 1e-3);
        expect(n.position().y, n.id()).to.be.closeTo(want[i].y, 1e-3);
      });
    });

    it('transform applies after placement', function () {
      mk({ nodes: nodes('a', 'b'), edges: edges(['a', 'b']) });
      run({ transform: (node, pos) => ({ x: pos.x + 1000, y: pos.y }) });

      expect(posOf('a').x).to.be.at.least(1000);
      expect(posOf('b').x).to.be.at.least(1000);
    });

    it('spacingFactor scales about the drawing centre', function () {
      mk({ nodes: nodes('a', 'b'), edges: edges(['a', 'b']) });
      run();

      var gap = posOf('b').y - posOf('a').y;

      run({ spacingFactor: 2 });
      expect(posOf('b').y - posOf('a').y).to.be.closeTo(2 * gap, 1e-3);
    });

    it('fit: false applies zoom and pan', function () {
      mk(diamond());
      run({ zoom: 2, pan: { x: 11, y: 22 } });

      expect(cy.zoom()).to.equal(2);
      expect(cy.pan()).to.deep.equal({ x: 11, y: 22 });
    });
  });

  describe('compound graphs (112.3, global mode)', function () {
    // controls (run once by hand): with the chain comparator removed
    // from sortLayer the contiguity spec goes red; with the border
    // walls skipped the exclusion spec goes red on wider fixtures.
    var compoundEls = () => ({
      nodes: [
        ...nodes('p1', 'p2', 'x', 'y'),
        { data: { id: 'a', parent: 'p1' } },
        { data: { id: 'b', parent: 'p1' } },
        { data: { id: 'c', parent: 'p2' } },
        { data: { id: 'd', parent: 'p2' } },
      ],
      edges: edges(['a', 'b'], ['c', 'd'], ['x', 'a'], ['b', 'y'], ['a', 'c']),
    });

    it('sibling parent boxes are disjoint', function () {
      mk(compoundEls());
      run();

      var bb1 = cy.$id('p1').boundingBox();
      var bb2 = cy.$id('p2').boundingBox();
      var disjoint =
        bb1.x2 <= bb2.x1 ||
        bb2.x2 <= bb1.x1 ||
        bb1.y2 <= bb2.y1 ||
        bb2.y2 <= bb1.y1;

      expect(disjoint, 'sibling boxes overlap').to.equal(true);
    });

    it('outsiders stay outside the parent box', function () {
      mk(compoundEls());
      run();

      for (const outsider of ['x', 'y']) {
        for (const parent of ['p1', 'p2']) {
          var bb = cy.$id(parent).boundingBox();
          var p = posOf(outsider);
          var inside = p.x > bb.x1 && p.x < bb.x2 && p.y > bb.y1 && p.y < bb.y2;

          expect(inside, `${outsider} inside ${parent}`).to.equal(false);
        }
      }
    });

    it('group members are contiguous within a rank', function () {
      // p1 holds three same-rank children beside two outsiders
      mk({
        nodes: [
          ...nodes('p1', 'r', 'o1', 'o2'),
          { data: { id: 'm1', parent: 'p1' } },
          { data: { id: 'm2', parent: 'p1' } },
          { data: { id: 'm3', parent: 'p1' } },
        ],
        edges: edges(
          ['r', 'm1'],
          ['r', 'm2'],
          ['r', 'm3'],
          ['r', 'o1'],
          ['r', 'o2'],
        ),
      });
      run();

      var xs = ['m1', 'm2', 'm3'].map((id) => posOf(id).x);
      var lo = Math.min(...xs);
      var hi = Math.max(...xs);

      for (const outsider of ['o1', 'o2']) {
        var x = posOf(outsider).x;

        expect(x < lo || x > hi, `${outsider} between members`).to.equal(true);
      }
    });

    it('an edge on a parent node places the other endpoint past the box', function () {
      mk(compoundEls());
      cy.add({ data: { id: 'below' } });
      cy.add({ data: { id: 'pe', source: 'p1', target: 'below' } });
      run();

      var bb = cy.$id('p1').boundingBox();

      expect(posOf('below').y).to.be.greaterThan(bb.y2);
    });

    it('a nested parent box sits inside its outer box', function () {
      mk({
        nodes: [
          ...nodes('outer'),
          { data: { id: 'inner', parent: 'outer' } },
          { data: { id: 'a', parent: 'inner' } },
          { data: { id: 'b', parent: 'inner' } },
          { data: { id: 'c', parent: 'outer' } },
        ],
        edges: edges(['a', 'b'], ['c', 'a']),
      });
      run();

      var out = cy.$id('outer').boundingBox();
      var inn = cy.$id('inner').boundingBox();

      expect(inn.x1).to.be.at.least(out.x1);
      expect(inn.x2).to.be.at.most(out.x2);
      expect(inn.y1).to.be.at.least(out.y1);
      expect(inn.y2).to.be.at.most(out.y2);
    });

    it('a parent split across otherwise-disconnected members stays one box', function () {
      mk({
        nodes: [
          ...nodes('p'),
          { data: { id: 'a', parent: 'p' } },
          { data: { id: 'b', parent: 'p' } },
          ...nodes('solo'),
        ],
        edges: [],
      });
      run();

      // a and b were welded into one component: the derived box is a
      // single tile, and solo is packed clear of it
      var bb = cy.$id('p').boundingBox();
      var p = posOf('solo');
      var inside = p.x > bb.x1 && p.x < bb.x2 && p.y > bb.y1 && p.y < bb.y2;

      expect(inside, 'solo inside the parent box').to.equal(false);
    });
  });

  it('lifecycle events fire once, in order', async function () {
    mk(diamond());

    var seen = [];

    cy.on('layoutstart', () => seen.push('start'));
    cy.on('layoutready', () => seen.push('ready'));
    cy.on('layoutstop', () => seen.push('stop'));

    var layout = run();

    await layout.promise();
    expect(seen).to.deep.equal(['start', 'ready', 'stop']);
  });

  it('the dispatch throw names flow among the built-ins', function () {
    mk(diamond());
    expect(() => cy.layout({ name: 'cose' })).to.throw(/'flow'/);
  });
});

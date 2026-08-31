import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// circle / concentric / breadthfirst / random layouts + eles.layout() /
// layoutPositions(), ported against v3 semantics
describe('gpu/layouts', function () {
  var cy;
  var center = { x: 400, y: 300 }; // headless 800x600 default bb center

  var dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  var posOf = (id) => cy.$id(id).position();

  var makeCy = (elements) => cytoscape({ elements });

  var star = () =>
    makeCy([
      { data: { id: 'hub' } },
      { data: { id: 'l1' } },
      { data: { id: 'l2' } },
      { data: { id: 'l3' } },
      { data: { id: 'l4' } },
      { data: { id: 'l5' } },
      { data: { id: 'e1', source: 'hub', target: 'l1' } },
      { data: { id: 'e2', source: 'hub', target: 'l2' } },
      { data: { id: 'e3', source: 'hub', target: 'l3' } },
      { data: { id: 'e4', source: 'hub', target: 'l4' } },
      { data: { id: 'e5', source: 'hub', target: 'l5' } },
    ]);

  describe('circle', function () {
    beforeEach(function () {
      cy = star();
    });

    it('places all nodes equidistant from the center', function () {
      cy.layout({ name: 'circle', fit: false }).run();

      var r0 = dist(posOf('hub'), center);

      expect(r0).to.be.above(0);

      cy.nodes().forEach((node) => {
        expect(dist(node.position(), center)).to.be.closeTo(r0, 1e-3);
      });
    });

    it('honors a fixed radius', function () {
      cy.layout({
        name: 'circle',
        fit: false,
        radius: 500,
        avoidOverlap: false,
      }).run();

      cy.nodes().forEach((node) => {
        expect(dist(node.position(), center)).to.be.closeTo(500, 1e-3);
      });
    });

    it('starts at startAngle', function () {
      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
      }).run();

      // first node (insertion order) at angle 0: to the right of center
      expect(posOf('hub').x).to.be.closeTo(center.x + 100, 1e-3);
      expect(posOf('hub').y).to.be.closeTo(center.y, 1e-3);
    });

    it('sort orders nodes around the circle', function () {
      // reverse-id sort puts l5 first (at startAngle 0)
      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
        sort: (a, b) => b.id().localeCompare(a.id()),
      }).run();

      expect(posOf('l5').x).to.be.closeTo(center.x + 100, 1e-3);
      expect(posOf('l5').y).to.be.closeTo(center.y, 1e-3);
    });

    it('clockwise vs counterclockwise mirror', function () {
      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
      }).run();

      var cwSecond = { ...posOf('l1') };

      cy.layout({
        name: 'circle',
        fit: false,
        startAngle: 0,
        radius: 100,
        avoidOverlap: false,
        counterclockwise: true,
      }).run();

      var ccwSecond = posOf('l1');

      expect(ccwSecond.y - center.y).to.be.closeTo(
        -(cwSecond.y - center.y),
        1e-3,
      );
      expect(ccwSecond.x).to.be.closeTo(cwSecond.x, 1e-3);
    });

    it('spacingFactor scales about the layout center', function () {
      cy.layout({
        name: 'circle',
        fit: false,
        radius: 100,
        avoidOverlap: false,
      }).run();

      var r1 = dist(posOf('hub'), center);

      cy.layout({
        name: 'circle',
        fit: false,
        radius: 100,
        avoidOverlap: false,
        spacingFactor: 2,
      }).run();

      var r2 = dist(posOf('hub'), center);

      expect(r2).to.be.closeTo(r1 * 2, 1e-4);
    });

    it('transform remaps positions', function () {
      cy.layout({
        name: 'circle',
        fit: false,
        radius: 100,
        avoidOverlap: false,
        transform: (node, pos) => ({ x: pos.x + 1000, y: pos.y }),
      }).run();

      expect(posOf('hub').x).to.be.above(1000);
    });
  });

  describe('concentric', function () {
    beforeEach(function () {
      cy = star();
    });

    it('puts the highest-degree node in the center', function () {
      cy.layout({ name: 'concentric', fit: false }).run();

      expect(dist(posOf('hub'), center)).to.be.closeTo(0, 1e-3);

      var leafR = dist(posOf('l1'), center);

      expect(leafR).to.be.above(0);

      for (var id of ['l2', 'l3', 'l4', 'l5']) {
        expect(dist(posOf(id), center)).to.be.closeTo(leafR, 1e-3);
      }
    });

    it('honors a custom concentric function', function () {
      cy.layout({
        name: 'concentric',
        fit: false,
        concentric: (node) => (node.id() === 'l3' ? 100 : 1),
        levelWidth: () => 10,
      }).run();

      expect(dist(posOf('l3'), center)).to.be.closeTo(0, 1e-3);
      expect(dist(posOf('hub'), center)).to.be.above(0);
    });

    it('records the concentric value in scratch', function () {
      cy.layout({ name: 'concentric', fit: false }).run();

      expect(cy.$id('hub').scratch('concentric')).to.equal(5);
      expect(cy.$id('l1').scratch('concentric')).to.equal(1);
    });
  });

  describe('breadthfirst', function () {
    var tree = () =>
      makeCy([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'e' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'ac', source: 'a', target: 'c' } },
        { data: { id: 'bd', source: 'b', target: 'd' } },
        { data: { id: 'be', source: 'b', target: 'e' } },
      ]);

    it('directed tree: depths increase downward', function () {
      cy = tree();
      cy.layout({
        name: 'breadthfirst',
        fit: false,
        directed: true,
        roots: cy.$id('a'),
      }).run();

      expect(posOf('a').y).to.be.below(posOf('b').y);
      expect(posOf('b').y).to.be.closeTo(posOf('c').y, 1e-3);
      expect(posOf('b').y).to.be.below(posOf('d').y);
      expect(posOf('d').y).to.be.closeTo(posOf('e').y, 1e-3);
    });

    it('roots as an array of ids', function () {
      cy = tree();
      cy.layout({
        name: 'breadthfirst',
        fit: false,
        directed: true,
        roots: ['a'],
      }).run();

      expect(posOf('a').y).to.be.below(posOf('d').y);
    });

    it('direction rightward advances depth along x', function () {
      cy = tree();
      cy.layout({
        name: 'breadthfirst',
        fit: false,
        directed: true,
        roots: cy.$id('a'),
        direction: 'rightward',
      }).run();

      expect(posOf('a').x).to.be.below(posOf('b').x);
      expect(posOf('b').x).to.be.below(posOf('d').x);
    });

    it('throws on an invalid direction', function () {
      cy = tree();

      expect(() =>
        cy.layout({ name: 'breadthfirst', direction: 'sideways' }).run(),
      ).to.throw(/Invalid direction/);
    });

    it('circle mode puts the root near the center', function () {
      cy = tree();
      cy.layout({
        name: 'breadthfirst',
        fit: false,
        directed: true,
        roots: cy.$id('a'),
        circle: true,
      }).run();

      var rootR = dist(posOf('a'), center);
      var leafR = dist(posOf('d'), center);

      expect(rootR).to.be.below(leafR);
    });

    it('maximal shifts nodes to their deepest position (DAG)', function () {
      cy = makeCy([
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'c' } },
        { data: { id: 'd' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'ac', source: 'a', target: 'c' } },
        { data: { id: 'ad', source: 'a', target: 'd' } }, // shortcut: bfs finds d at depth 1
        { data: { id: 'bd', source: 'b', target: 'd' } },
      ]);

      cy.layout({
        name: 'breadthfirst',
        fit: false,
        directed: true,
        roots: cy.$id('a'),
        maximal: true,
      }).run();

      expect(posOf('d').y).to.be.above(posOf('b').y);
    });

    it('undirected with derived roots covers all nodes', function () {
      cy = tree();
      cy.layout({ name: 'breadthfirst', fit: false }).run();

      // all placed: no NaN, distinct depths exist
      cy.nodes().forEach((node) => {
        expect(Number.isFinite(node.position().x)).to.be.true;
        expect(Number.isFinite(node.position().y)).to.be.true;
      });
    });
  });

  describe('random', function () {
    it('scatters nodes within the viewport box', function () {
      cy = star();
      cy.layout({ name: 'random', fit: false }).run();

      var allAtSame = true;
      var first = posOf('hub');

      cy.nodes().forEach((node) => {
        var p = node.position();

        expect(p.x).to.be.within(0, 800);
        expect(p.y).to.be.within(0, 600);

        if (p.x !== first.x || p.y !== first.y) {
          allAtSame = false;
        }
      });

      expect(allAtSame).to.be.false;
    });
  });

  describe('eles.layout() scoping', function () {
    beforeEach(function () {
      cy = makeCy([
        { data: { id: 'a' }, position: { x: 10, y: 10 } },
        { data: { id: 'b' }, position: { x: 20, y: 20 } },
        { data: { id: 'x' }, position: { x: 1000, y: 1000 } },
        { data: { id: 'y' }, position: { x: 1010, y: 1010 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'xy', source: 'x', target: 'y' } },
      ]);
    });

    it('lays out only the calling collection (circle)', function () {
      var sub = cy.$id('a').union(cy.$id('b')).union(cy.$id('ab'));

      sub.layout({ name: 'circle', fit: false }).run();

      expect(posOf('x')).to.deep.equal({ x: 1000, y: 1000 });
      expect(posOf('y')).to.deep.equal({ x: 1010, y: 1010 });
      expect(posOf('a')).to.not.deep.equal({ x: 10, y: 10 });
    });

    it('lays out only the calling collection (grid)', function () {
      var sub = cy.$id('a').union(cy.$id('b'));

      sub.layout({ name: 'grid', fit: false }).run();

      expect(posOf('x')).to.deep.equal({ x: 1000, y: 1000 });
      expect(posOf('a')).to.not.deep.equal({ x: 10, y: 10 });
    });

    it('makeLayout/createLayout aliases resolve', function () {
      var sub = cy.$id('a').union(cy.$id('b'));

      expect(typeof sub.makeLayout({ name: 'random' }).run).to.equal(
        'function',
      );
      expect(typeof sub.createLayout({ name: 'random' }).run).to.equal(
        'function',
      );
    });
  });

  describe('layoutPositions plumbing', function () {
    beforeEach(function () {
      cy = star();
    });

    it('emits layoutstart/layoutready/layoutstop in order with callbacks', function () {
      var events = [];

      cy.on('layoutstart', () => events.push('start'));
      cy.on('layoutready', () => events.push('ready'));
      cy.on('layoutstop', () => events.push('stop'));

      cy.layout({
        name: 'circle',
        fit: false,
        ready: () => events.push('readyCb'),
        stop: () => events.push('stopCb'),
      }).run();

      expect(events).to.deep.equal([
        'start',
        'readyCb',
        'ready',
        'stopCb',
        'stop',
      ]);
    });

    it('applies zoom/pan when fit is false', function () {
      cy.layout({
        name: 'circle',
        fit: false,
        zoom: 2,
        pan: { x: 11, y: 22 },
      }).run();

      expect(cy.zoom()).to.equal(2);
      expect(cy.pan()).to.deep.equal({ x: 11, y: 22 });
    });

    it('fits to the laid-out elements by default', function () {
      var zoomBefore = cy.zoom();

      cy.layout({ name: 'circle' }).run();

      expect(cy.zoom()).to.not.equal(zoomBefore);
    });

    it('animate: true tweens to the same final positions', async function () {
      // reference run without animation
      cy.layout({
        name: 'circle',
        fit: false,
        radius: 150,
        avoidOverlap: false,
      }).run();

      var want = {};

      cy.nodes().forEach((node) => {
        want[node.id()] = { ...node.position() };
      });

      // scatter, then animate back into the circle
      cy.layout({ name: 'random', fit: false }).run();

      var stopped = cy.promiseOn('layoutstop');

      cy.layout({
        name: 'circle',
        fit: false,
        radius: 150,
        avoidOverlap: false,
        animate: true,
        animationDuration: 40,
      }).run();

      await stopped;

      cy.nodes().forEach((node) => {
        expect(node.position().x).to.be.closeTo(want[node.id()].x, 1e-3);
        expect(node.position().y).to.be.closeTo(want[node.id()].y, 1e-3);
      });
    });

    it('animateFilter exempts nodes from tweening', async function () {
      cy.layout({ name: 'random', fit: false }).run();

      var stopped = cy.promiseOn('layoutstop');

      cy.layout({
        name: 'circle',
        fit: false,
        radius: 150,
        avoidOverlap: false,
        animate: true,
        animationDuration: 40,
        animateFilter: (node) => node.id() !== 'hub',
      }).run();

      // the exempted node is placed synchronously
      var hubR = dist(posOf('hub'), center);

      expect(hubR).to.be.closeTo(150, 1e-3);

      await stopped;
    });
  });

  describe('layoutDimensions', function () {
    it('returns outer dimensions, sanitised against zero', function () {
      cy = star();

      var dims = cy.$id('hub').layoutDimensions();

      expect(dims.w).to.equal(cy.$id('hub').outerWidth());
      expect(dims.h).to.equal(cy.$id('hub').outerHeight());
      expect(dims.w).to.be.above(0);
    });
  });

  it('cy.layout still throws on unknown names', function () {
    cy = star();

    expect(() => cy.layout({ name: 'cose' })).to.throw(/built-in name/);
  });

  // 87.3: grid and preset used to ignore animate/animateFilter/
  // transform and never call the ready/stop callbacks, while their doc
  // comments claimed tween support.  Both now route through the shared
  // layoutPositions finisher whenever one of those options is present;
  // the bare call keeps the synchronous bulk path.
  describe('grid and preset animate (87.3)', function () {
    var quad = () =>
      cytoscape({
        headlessWidth: 400,
        headlessHeight: 400,
        elements: [
          { data: { id: 'n0' } },
          { data: { id: 'n1' } },
          { data: { id: 'n2' } },
          { data: { id: 'n3' } },
        ],
      });

    var scatter = (positions) => {
      cy.layout({ name: 'preset', fit: false, positions }).run();
    };

    var AT_5 = {
      n0: { x: 5, y: 5 },
      n1: { x: 6, y: 5 },
      n2: { x: 7, y: 5 },
      n3: { x: 8, y: 5 },
    };

    beforeEach(function () {
      cy = quad();
    });

    it('grid animate tweens to the discrete finals and runs the callbacks', async function () {
      cy.layout({ name: 'grid', fit: false }).run();

      var want = {};

      cy.nodes().forEach((node) => {
        want[node.id()] = { ...node.position() };
      });

      scatter(AT_5);

      var ready = false;
      var stop = false;
      var stopped = cy.promiseOn('layoutstop');

      cy.layout({
        name: 'grid',
        fit: false,
        animate: true,
        animationDuration: 40,
        ready: () => (ready = true),
        stop: () => (stop = true),
      }).run();

      // the run is a tween now, not a synchronous write: nothing has
      // moved yet (this is what a disabled finisher branch fails)
      expect(posOf('n0')).to.deep.equal(AT_5.n0);
      expect(ready).to.equal(true);
      expect(stop).to.equal(false);

      await stopped;

      expect(stop).to.equal(true);
      cy.nodes().forEach((node) => {
        expect(node.position().x).to.be.closeTo(want[node.id()].x, 1e-3);
        expect(node.position().y).to.be.closeTo(want[node.id()].y, 1e-3);
      });
    });

    it('grid animateFilter exempts nodes from tweening', async function () {
      cy.layout({ name: 'grid', fit: false }).run();

      var wantN1 = { ...posOf('n1') };

      scatter(AT_5);

      var stopped = cy.promiseOn('layoutstop');

      cy.layout({
        name: 'grid',
        fit: false,
        animate: true,
        animationDuration: 40,
        animateFilter: (node) => node.id() !== 'n1',
      }).run();

      // the exempted node is placed synchronously; the rest still tween
      expect(posOf('n1').x).to.be.closeTo(wantN1.x, 1e-3);
      expect(posOf('n1').y).to.be.closeTo(wantN1.y, 1e-3);
      expect(posOf('n0')).to.deep.equal(AT_5.n0);

      await stopped;
    });

    it('grid honors transform (without animate)', function () {
      cy.layout({ name: 'grid', fit: false }).run();

      var want = {};

      cy.nodes().forEach((node) => {
        want[node.id()] = { ...node.position() };
      });

      cy.layout({
        name: 'grid',
        fit: false,
        transform: (node, pos) => ({ x: pos.x + 1000, y: pos.y }),
      }).run();

      cy.nodes().forEach((node) => {
        expect(node.position().x).to.be.closeTo(want[node.id()].x + 1000, 1e-3);
        expect(node.position().y).to.be.closeTo(want[node.id()].y, 1e-3);
      });
    });

    it('preset animate tweens to the map positions, unmentioned nodes stay', async function () {
      scatter(AT_5);

      var ready = false;
      var stop = false;
      var stopped = cy.promiseOn('layoutstop');

      cy.layout({
        name: 'preset',
        fit: false,
        animate: true,
        animationDuration: 40,
        positions: { n0: { x: 100, y: 120 }, n1: { x: 200, y: 220 } },
        ready: () => (ready = true),
        stop: () => (stop = true),
      }).run();

      // a tween, not a write — and the callbacks actually run (the old
      // preset called neither)
      expect(posOf('n0')).to.deep.equal(AT_5.n0);
      expect(ready).to.equal(true);

      await stopped;

      expect(stop).to.equal(true);
      expect(posOf('n0').x).to.be.closeTo(100, 1e-3);
      expect(posOf('n0').y).to.be.closeTo(120, 1e-3);
      expect(posOf('n1').x).to.be.closeTo(200, 1e-3);
      expect(posOf('n1').y).to.be.closeTo(220, 1e-3);
      // no entry in the map: keeps its position through the tween
      expect(posOf('n2')).to.deep.equal(AT_5.n2);
    });

    it('preset honors transform (without animate)', function () {
      scatter(AT_5);

      cy.layout({
        name: 'preset',
        fit: false,
        positions: { n0: { x: 100, y: 120 } },
        transform: (node, pos) => ({ x: pos.x, y: pos.y + 50 }),
      }).run();

      expect(posOf('n0')).to.deep.equal({ x: 100, y: 170 });
      // transform applies to kept positions too (every node goes
      // through the finisher on this path)
      expect(posOf('n2')).to.deep.equal({ x: 7, y: 55 });
    });

    it('bare grid and preset calls stay synchronous (the bulk path)', function () {
      scatter(AT_5);
      cy.layout({ name: 'grid', fit: false }).run();

      // positions land during run() — no tween, no await
      expect(posOf('n0')).to.not.deep.equal(AT_5.n0);

      var events = [];

      cy.on('layoutstart layoutready layoutstop', (e) => events.push(e.type));
      cy.layout({ name: 'preset', fit: false, positions: AT_5 }).run();

      expect(posOf('n0')).to.deep.equal(AT_5.n0);
      expect(events).to.deep.equal([
        'layoutstart',
        'layoutready',
        'layoutstop',
      ]);
    });
  });
});

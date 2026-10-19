import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// viewport animation targets: cy.animate({ fit }) / ({ center }), cy.animation(),
// boundingBoxAt, and the animated layout fit
describe('gpu/viewport animation targets', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 50 } },
        { data: { id: 'c' }, position: { x: 300, y: 200 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });
  });

  it('cy.animate({ fit }) animates to the fitting viewport', async function () {
    var want = cy.getFitViewport(undefined, 20);

    cy.animate({ fit: { padding: 20 }, duration: 40 });

    await cy.promiseOn('viewport'); // starts moving

    // wait for the queue to drain
    while (cy.animated()) {
      await new Promise((r) => setTimeout(r, 10));
    }

    expect(cy.zoom()).to.be.closeTo(want.zoom, 1e-9);
    expect(cy.pan().x).to.be.closeTo(want.pan.x, 1e-9);
    expect(cy.pan().y).to.be.closeTo(want.pan.y, 1e-9);
  });

  it('cy.animation({ fit: { eles } }) resolves through the handle promise', async function () {
    var sub = cy.$id('a').union(cy.$id('b'));
    var want = cy.getFitViewport(sub, 0);

    await cy.animation({ fit: { eles: sub }, duration: 40 }).play();

    expect(cy.zoom()).to.be.closeTo(want.zoom, 1e-9);
    expect(cy.pan().x).to.be.closeTo(want.pan.x, 1e-9);
  });

  it('cy.animation({ fit: { boundingBox } }) fits an explicit box', async function () {
    await cy
      .animation({
        fit: { boundingBox: { x1: 0, y1: 0, w: 100, h: 100 }, padding: 0 },
        duration: 40,
      })
      .play();

    // 800x600 viewport fitting a 100x100 box: zoom limited by height
    expect(cy.zoom()).to.be.closeTo(6, 1e-9);
  });

  it('cy.animate({ center }) animates the centering pan at the current zoom', async function () {
    cy.zoom(2);

    var want = cy.getCenterPan(cy.$id('c'), 2);

    await cy.animation({ center: { eles: cy.$id('c') }, duration: 40 }).play();

    expect(cy.zoom()).to.equal(2);
    expect(cy.pan().x).to.be.closeTo(want.x, 1e-9);
    expect(cy.pan().y).to.be.closeTo(want.y, 1e-9);
  });

  it('fit targets resolve when the animation is created, as v3', async function () {
    var want = cy.getFitViewport(undefined, 0);
    var ani = cy.animation({ fit: {}, duration: 40 });

    // moving a node afterwards must not change the resolved target
    cy.$id('c').position({ x: 5000, y: 5000 });

    await ani.play();

    expect(cy.zoom()).to.be.closeTo(want.zoom, 1e-9);
  });

  describe('cy.animate({ panBy }) (28.2)', function () {
    it('animates to the pan plus the delta', async function () {
      cy.pan({ x: 30, y: -10 });

      await cy.animation({ panBy: { x: 100, y: 50 }, duration: 40 }).play();

      expect(cy.pan().x).to.be.closeTo(130, 1e-9);
      expect(cy.pan().y).to.be.closeTo(40, 1e-9);
    });

    it('resolves against the pan at creation, as v3 does', async function () {
      cy.pan({ x: 0, y: 0 });

      var ani = cy.animation({ panBy: { x: 100, y: 0 }, duration: 40 });

      // panning afterwards must not move the resolved target: the delta
      // was taken when the animation was created, not per tick
      cy.pan({ x: 500, y: 0 });

      await ani.play();

      expect(cy.pan().x).to.be.closeTo(100, 1e-9);
    });

    it('is gated by panningEnabled, like an absolute pan target', function () {
      cy.pan({ x: 0, y: 0 });
      cy.panningEnabled(false);

      cy.animate({ panBy: { x: 100, y: 0 }, duration: 40 });

      expect(cy.animated()).to.equal(false);
      expect(cy.pan().x).to.equal(0);
    });

    it('rejects panBy alongside an absolute pan — the two spell one channel', function () {
      expect(() =>
        cy.animate({
          panBy: { x: 1, y: 1 },
          pan: { x: 0, y: 0 },
          duration: 40,
        }),
      ).to.throw(/panBy/);
    });

    it('yields to fit and center, as v3 orders them', async function () {
      var want = cy.getFitViewport(undefined, 0);

      await cy
        .animation({ panBy: { x: 999, y: 999 }, fit: {}, duration: 40 })
        .play();

      expect(cy.pan().x).to.be.closeTo(want.pan.x, 1e-9);
    });
  });

  describe('eles.boundingBoxAt()', function () {
    it('computes the box at hypothetical positions without moving nodes', function () {
      var before = { ...cy.$id('a').position() };

      var bb = cy.nodes().boundingBoxAt((node, i) => ({ x: i * 100, y: 0 }));
      var w = cy.$id('a').outerWidth();
      var h = cy.$id('a').outerHeight();

      expect(bb.x1).to.equal(0 - w / 2);
      expect(bb.x2).to.equal(200 + w / 2);
      expect(bb.y1).to.equal(0 - h / 2);
      expect(bb.y2).to.equal(0 + h / 2);

      expect(cy.$id('a').position()).to.deep.equal(before); // untouched
    });

    it('accepts one shared position', function () {
      var bb = cy.nodes().boundingBoxAt({ x: 10, y: 10 });
      var w = cy.$id('a').outerWidth();

      expect(bb.w).to.equal(w);
      expect(bb.x1).to.equal(10 - w / 2);
    });

    it('edges span endpoints outside the collection at their current positions', function () {
      // only node a + edge ab in the collection; b stays at (100, 50)
      var sub = cy.$id('a').union(cy.$id('ab'));
      var bb = sub.boundingBoxAt(() => ({ x: -500, y: 0 }));

      expect(bb.x2).to.be.at.least(100); // b's current x
      expect(bb.x1).to.be.below(-500 + 1);
    });
  });

  it('layout animate: true animates the fit to the final arrangement', async function () {
    // reference: non-animated layout with fit
    cy.layout({
      name: 'circle',
      radius: 100,
      avoidOverlap: false,
      padding: 30,
    }).run();

    var wantZoom = cy.zoom();
    var wantPan = { ...cy.pan() };

    // scatter + dezoom, then animate back
    cy.layout({ name: 'random', fit: false }).run();
    cy.zoom(0.1);

    var stopped = cy.promiseOn('layoutstop');

    cy.layout({
      name: 'circle',
      radius: 100,
      avoidOverlap: false,
      padding: 30,
      animate: true,
      animationDuration: 40,
    }).run();

    await stopped;

    expect(cy.zoom()).to.be.closeTo(wantZoom, 1e-3);
    expect(cy.pan().x).to.be.closeTo(wantPan.x, 1e-1);
    expect(cy.pan().y).to.be.closeTo(wantPan.y, 1e-1);
  });

  // round 30.3: `cy.stop()` is public API that no spec had ever called
  // — `ani.stop()` and `ele.stop()` were tested, its core sibling was
  // not.  Both arms matter: the default freezes where the tween is, and
  // `jumpToEnd` applies the final values, which is the whole difference
  // between the two calls.
  describe('cy.stop()', function () {
    // the first viewport tick can land at t = 0, so wait for movement
    var untilMoved = async () => {
      for (var i = 0; i < 100 && cy.zoom() === 1; i++) {
        await new Promise((r) => setTimeout(r, 5));
      }
    };

    it('freezes a running viewport animation in place', async function () {
      cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
      cy.animate({ zoom: 4, pan: { x: 400, y: 400 }, duration: 400 });

      await untilMoved();

      expect(cy.animated()).to.equal(true);

      var mid = { zoom: cy.zoom(), pan: { ...cy.pan() } };

      expect(mid.zoom).to.be.above(1).and.below(4);
      expect(cy.stop()).to.equal(cy); // chainable, as v3

      expect(cy.animated()).to.equal(false);

      // and it stays where it stopped rather than drifting on
      await new Promise((r) => setTimeout(r, 60));

      expect(cy.zoom()).to.be.closeTo(mid.zoom, 1e-9);
      expect(cy.pan().x).to.be.closeTo(mid.pan.x, 1e-9);
    });

    it('stop( true ) applies the final values instead', async function () {
      cy.viewport({ zoom: 1, pan: { x: 0, y: 0 } });
      cy.animate({ zoom: 4, pan: { x: 400, y: 400 }, duration: 400 });

      await cy.promiseOn('viewport');

      cy.stop(true);

      expect(cy.animated()).to.equal(false);
      expect(cy.zoom()).to.be.closeTo(4, 1e-9);
      expect(cy.pan().x).to.be.closeTo(400, 1e-9);
      expect(cy.pan().y).to.be.closeTo(400, 1e-9);
    });

    it('resolves the animation promise and is a no-op when idle', async function () {
      var settled = false;
      var ani = cy.animation({ zoom: 3, duration: 400 });

      ani.play();
      ani.promise().then(() => {
        settled = true;
      });

      await untilMoved();
      cy.stop();
      await new Promise((r) => setTimeout(r, 0));

      expect(settled).to.equal(true);

      // idle: nothing to stop, nothing thrown, viewport untouched
      var z = cy.zoom();

      expect(() => cy.stop()).to.not.throw();
      expect(cy.zoom()).to.equal(z);
    });
  });
});

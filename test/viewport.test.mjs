import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

describe('gpu/viewport', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({
      headlessWidth: 800,
      headlessHeight: 600,
      elements: [
        { data: { id: 'a' }, position: { x: 0, y: 0 } },
        { data: { id: 'b' }, position: { x: 100, y: 50 } },
      ],
    });
  });

  describe('zoom', function () {
    it('defaults to 1', function () {
      expect(cy.zoom()).to.equal(1);
    });

    it('gets and sets', function () {
      cy.zoom(2);

      expect(cy.zoom()).to.equal(2);
    });

    it('honours the initial option', function () {
      var zoomed = cytoscape({ zoom: 3 });

      expect(zoomed.zoom()).to.equal(3);
    });

    it('clamps to minZoom and maxZoom', function () {
      var clamped = cytoscape({ minZoom: 0.5, maxZoom: 2 });

      clamped.zoom(10);
      expect(clamped.zoom()).to.equal(2);

      clamped.zoom(0.01);
      expect(clamped.zoom()).to.equal(0.5);
    });

    it('ignores invalid zoom values', function () {
      cy.zoom(NaN);
      cy.zoom(-1);

      expect(cy.zoom()).to.equal(1);
    });

    it('zooms about a rendered position, keeping the point fixed', function () {
      var node = cy.$id('b');
      var before = node.renderedPosition();

      cy.zoom({ level: 2, renderedPosition: before });

      var after = node.renderedPosition();

      expect(after.x).to.be.closeTo(before.x, 1e-9);
      expect(after.y).to.be.closeTo(before.y, 1e-9);
      expect(cy.zoom()).to.equal(2);
    });

    it('zooms about a model position', function () {
      cy.zoom({ level: 4, position: { x: 100, y: 50 } });

      expect(cy.$id('b').renderedPosition()).to.deep.equal({ x: 100, y: 50 });
    });
  });

  describe('pan', function () {
    it('defaults to (0,0)', function () {
      expect(cy.pan()).to.deep.equal({ x: 0, y: 0 });
    });

    it('gets and sets', function () {
      cy.pan({ x: 10, y: -5 });

      expect(cy.pan()).to.deep.equal({ x: 10, y: -5 });
    });

    it('returns the live pan object (v3 parity, allocation-free get)', function () {
      var pan = cy.pan();

      expect(cy.pan()).to.equal(pan); // same object while pan is unchanged

      cy.pan({ x: 10, y: -5 });

      expect(cy.pan()).to.not.equal(pan); // setters swap in a fresh object
      expect(pan).to.deep.equal({ x: 0, y: 0 }); // held references keep the old value
    });

    it('pans by a delta', function () {
      cy.pan({ x: 10, y: 10 });
      cy.panBy({ x: 5, y: -5 });

      expect(cy.pan()).to.deep.equal({ x: 15, y: 5 });
    });
  });

  describe('fit and center', function () {
    it('fits the graph with padding', function () {
      cy.fit(undefined, 50);

      // graph bb incl. 30×30 node dims: (-15,-15)-(115,65) ⇒ 130×80;
      // fit into 700×500 ⇒ zoom = 700/130
      var zoom = 700 / 130;

      expect(cy.zoom()).to.be.closeTo(zoom, 1e-9);

      // bb center maps to viewport center
      var center = { x: 50 * zoom + cy.pan().x, y: 25 * zoom + cy.pan().y };

      expect(center.x).to.be.closeTo(400, 1e-9);
      expect(center.y).to.be.closeTo(300, 1e-9);
    });

    it('fits to a sub-collection', function () {
      cy.fit(cy.$id('a')); // 30×30 bb about (0,0) ⇒ zoom = 600/30 = 20, centered

      expect(cy.zoom()).to.equal(20);
      expect(cy.$id('a').renderedPosition()).to.deep.equal({ x: 400, y: 300 });
    });

    it('centers without changing zoom', function () {
      cy.zoom(2);
      cy.center();

      expect(cy.zoom()).to.equal(2);

      var mid = { x: 50, y: 25 };
      var rendered = { x: mid.x * 2 + cy.pan().x, y: mid.y * 2 + cy.pan().y };

      expect(rendered.x).to.be.closeTo(400, 1e-9);
      expect(rendered.y).to.be.closeTo(300, 1e-9);
    });
  });

  describe('extent', function () {
    it('reports the visible model rectangle', function () {
      cy.zoom(2);
      cy.pan({ x: 100, y: 100 });

      var extent = cy.extent();

      expect(extent.x1).to.equal(-50);
      expect(extent.y1).to.equal(-50);
      expect(extent.x2).to.equal(350);
      expect(extent.y2).to.equal(250);
      expect(extent.w).to.equal(400);
      expect(extent.h).to.equal(300);
    });
  });

  describe('events', function () {
    it('emits zoom and viewport on zoom', function () {
      var events = [];

      cy.on('zoom pan viewport fit', function (e) {
        events.push(e.type);
      });

      cy.zoom(2);

      expect(events).to.deep.equal(['zoom', 'viewport']);
    });

    it('emits pan and viewport on pan', function () {
      var events = [];

      cy.on('zoom pan viewport', function (e) {
        events.push(e.type);
      });

      cy.pan({ x: 1, y: 1 });

      expect(events).to.deep.equal(['pan', 'viewport']);
    });

    it('does not emit when nothing changed', function () {
      var events = 0;

      cy.on('zoom pan viewport', function () {
        events++;
      });

      cy.zoom(1); // unchanged
      cy.pan({ x: 0, y: 0 }); // unchanged

      expect(events).to.equal(0);
    });

    it('emits fit', function () {
      var events = [];

      cy.on('zoom pan viewport fit', function (e) {
        events.push(e.type);
      });

      cy.fit();

      expect(events).to.contain('fit');
      expect(events).to.contain('viewport');
    });
  });
});

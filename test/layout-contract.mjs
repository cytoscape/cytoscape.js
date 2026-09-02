import { expect } from 'chai';
import cytoscape from '../src/index.mjs';

// round 17.5: the layout extension contract — direct objects, no
// registry.  cy.layout({ impl }) runs a user-supplied class/object
// against a columnar-first LayoutContext; the discrete finisher
// (ctx.layoutPositions) and the direct bulk path (ctx.setPositions)
// both drive the standard core lifecycle events exactly once.

const mk = (elements, opts = {}) =>
  cytoscape({
    elements: elements ?? [
      { data: { id: 'a' } },
      { data: { id: 'b' } },
      { data: { id: 'c' } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
    ],
    ...opts,
  });

const eventLog = (cy) => {
  const log = [];

  for (const type of ['layoutstart', 'layoutready', 'layoutstop']) {
    cy.on(type, () => log.push(type));
  }

  return log;
};

describe('gpu/layout: the extension contract (round 17.5)', function () {
  it('runs an object impl over the columnar context', async function () {
    const cy = mk();
    const log = eventLog(cy);
    let seen = null;

    const layout = cy.layout({
      impl: {
        run(ctx) {
          seen = {
            slots: [...ctx.nodeSlots()],
            width: ctx.width(),
            options: ctx.options,
          };

          const xy = [];

          ctx.nodeSlots().forEach((slot, i) => {
            xy.push(i * 100, 42);
          });
          ctx.setPositions(ctx.nodeSlots(), xy);
        },
      },
      spacing: 7,
    });

    layout.run();
    await layout.promise();

    expect(seen.slots.length).to.equal(3);
    expect(seen.width).to.equal(800); // headless default
    expect(seen.options.spacing).to.equal(7); // custom knobs pass through
    expect(cy.$id('b').position()).to.deep.equal({ x: 100, y: 42 });
    expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
  });

  it('instantiates a class impl', async function () {
    const cy = mk();

    class Diagonal {
      run(ctx) {
        const slots = ctx.nodeSlots();
        const xy = [];

        slots.forEach((slot, i) => xy.push(i * 10, i * 10));
        ctx.setPositions(slots, xy);
      }
    }

    const layout = cy.layout({ impl: Diagonal }).run();

    await layout.promise();
    expect(cy.$id('c').position()).to.deep.equal({ x: 20, y: 20 });
  });

  it('drives the discrete finisher with one lifecycle', async function () {
    const cy = mk();
    const log = eventLog(cy);

    const layout = cy
      .layout({
        impl: {
          run(ctx) {
            ctx.layoutPositions((node, i) => ({ x: i * 10, y: 5 }));
          },
        },
        transform: (node, pos) => ({ x: pos.x, y: -pos.y }),
        fit: false,
      })
      .run();

    await layout.promise();

    expect(cy.$id('a').position()).to.deep.equal({ x: 0, y: -5 });
    expect(cy.$id('b').position()).to.deep.equal({ x: 10, y: -5 });
    // exactly one lifecycle — the finisher's start is folded into the
    // wrapper's
    expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
  });

  it("merges an impl's defaults into the finisher, keeping the wrapper's stop (114.2)", async function () {
    const cy = mk();
    let stopped = 0;

    const layout = cy
      .layout({
        impl: {
          run(ctx) {
            ctx.layoutPositions((node, i) => ({ x: i * 10, y: 5 }), {
              fit: false,
              zoom: 2,
              stop: () => {
                throw new Error('an impl default must not replace stop');
              },
            });
          },
        },
        stop: () => {
          stopped++;
        },
      })
      .run();

    // resolves only through the wrapper's stop — the one an override
    // must never displace
    await layout.promise();

    expect(stopped).to.equal(1);
    expect(cy.zoom()).to.equal(2);
    expect(cy.$id('b').position()).to.deep.equal({ x: 10, y: 5 });
  });

  it('finish() lands bare runs by the bulk path and asks for the finisher on demand (114.2)', async function () {
    const cy = mk();
    const log = eventLog(cy);
    const impl = {
      run(ctx) {
        const slots = ctx.nodeSlots();

        ctx.finish(
          slots,
          slots.flatMap((s, i) => [i * 100, 7]),
          { fit: false },
        );
      },
    };

    // bare: the bulk path, fit: false honoured, no zoom or pan applied
    await cy.layout({ impl }).run().promise();
    expect(cy.$id('c').position()).to.deep.equal({ x: 200, y: 7 });
    expect(cy.zoom()).to.equal(1);
    expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);

    // transform asks for the finisher: the same finals, transformed
    await cy
      .layout({ impl, transform: (n, p) => ({ x: p.x, y: -p.y }) })
      .run()
      .promise();
    expect(cy.$id('c').position()).to.deep.equal({ x: 200, y: -7 });

    // the bulk path with fit left at its default fits (v3's default)
    const fitted = mk();

    await fitted
      .layout({
        impl: {
          run(ctx) {
            const slots = ctx.nodeSlots();

            ctx.finish(
              slots,
              slots.flatMap((s, i) => [i * 100, 7]),
            );
          },
        },
      })
      .run()
      .promise();
    expect(fitted.zoom()).to.not.equal(1);
  });

  it('animates a lone zoom or pan (114.2)', async function () {
    const cy = mk();

    await cy
      .layout({
        impl: {
          run(ctx) {
            ctx.layoutPositions((node, i) => ({ x: i * 10, y: 5 }));
          },
        },
        fit: false,
        animate: true,
        animationDuration: 20,
        zoom: 2,
      })
      .run()
      .promise();

    // before 114.2 the animated branch required zoom *and* pan together
    expect(cy.zoom()).to.be.closeTo(2, 1e-6);
    expect(cy.pan()).to.deep.equal({ x: 0, y: 0 });
  });

  it('supports async run (the GPU-layout shape)', async function () {
    const cy = mk();
    const log = eventLog(cy);

    const layout = cy
      .layout({
        impl: {
          async run(ctx) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            ctx.setPositions(
              ctx.nodeSlots(),
              ctx.nodeSlots().flatMap(() => [1, 2]),
            );
          },
        },
      })
      .run();

    expect(log).to.deep.equal(['layoutstart']); // still running

    await layout.promise();

    expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
    expect(cy.$id('a').position()).to.deep.equal({ x: 1, y: 2 });
  });

  it('scopes to the collection via eles.layout', async function () {
    const cy = mk();
    const scope = cy.$id('a').union(cy.$id('b'));
    let slots = null;

    const layout = scope
      .layout({
        impl: {
          run(ctx) {
            slots = [...ctx.nodeSlots()];
            expect(ctx.eles.length).to.equal(2);
          },
        },
      })
      .run();

    await layout.promise();
    expect(slots.length).to.equal(2);
  });

  it('pre-filters parents and locked nodes from nodeSlots', async function () {
    const cy = mk([
      { data: { id: 'p' } },
      { data: { id: 'kid', parent: 'p' } },
      { data: { id: 'locked' }, locked: true },
      { data: { id: 'free' } },
    ]);
    let ids = null;

    await cy
      .layout({
        impl: {
          run(ctx) {
            ids = ctx.nodeSlots().map((slot) => cy._store.idAt('nodes', slot));
          },
        },
      })
      .run()
      .promise();

    expect(ids.sort()).to.deep.equal(['free', 'kid']);
  });

  it('reads the columnar edge and degree surface', async function () {
    const cy = mk();
    let read = null;

    await cy
      .layout({
        impl: {
          run(ctx) {
            const endpoints = ctx.endpoints();
            const e = ctx.edgeSlots()[0];

            read = {
              edges: ctx.edgeSlots().length,
              source: cy._store.idAt('nodes', endpoints[e * 2]),
              degreeA: ctx.degreeOf(cy._store.lookup('a').slot),
              degreeC: ctx.degreeOf(cy._store.lookup('c').slot),
              bb: ctx.boundingBox(),
            };
          },
        },
      })
      .run()
      .promise();

    expect(read.edges).to.equal(1);
    expect(read.source).to.equal('a');
    expect(read.degreeA).to.equal(1);
    expect(read.degreeC).to.equal(0);
    expect(read.bb.w).to.be.a('number');
  });

  it('exposes stop() through the wrapper', function () {
    const cy = mk();
    let stopped = false;

    const layout = cy.layout({
      impl: {
        run() {
          /* never settles on its own */
        },
        stop() {
          stopped = true;
        },
      },
    });

    layout.run();
    layout.stop();
    expect(stopped).to.equal(true);
  });

  it('re-expresses the random builtin through the public contract', async function () {
    // the conformance shape external authors can crib: the same
    // plumbing the builtin uses (bounding box scope + the finisher),
    // pinned behaviorally (random coordinates land inside the box)
    const cy = mk();

    class RandomViaContract {
      run(ctx) {
        const bb = { x1: 0, y1: 0, w: ctx.width(), h: ctx.height() };

        ctx.layoutPositions(() => ({
          x: bb.x1 + Math.round(Math.random() * bb.w),
          y: bb.y1 + Math.round(Math.random() * bb.h),
        }));
      }
    }

    await cy.layout({ impl: RandomViaContract, fit: false }).run().promise();

    const nodes = cy.nodes();

    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i].position();

      expect(p.x).to.be.within(0, 800);
      expect(p.y).to.be.within(0, 600);
    }
  });

  it('rejects malformed layouts', function () {
    const cy = mk();

    expect(() => cy.layout({})).to.throw(/name|impl/);
    expect(() => cy.layout({ impl: {} })).to.throw(/run/);
    expect(() => cy.layout({ name: 'nope' })).to.throw(/nope/);
  });

  // Round 34.4: nodeSlots()/edgeSlots() read the store's insertion-order
  // list instead of walking element handles.  The order is the part that
  // can silently break -- grid and circle place by index, so a different
  // order is a different layout -- and `eles`/`nodes` are now lazy, so
  // an impl that never touches them must still see the same slots.
  describe('slot enumeration (34.4)', function () {
    it('nodeSlots() is cy.nodes() order, exactly', function () {
      const cy = mk();
      let slots = null;

      cy.layout({
        impl: class {
          run(ctx) {
            slots = ctx.nodeSlots();
          }
        },
        fit: false,
      }).run();

      const expected = cy.nodes().map((n) => n._eventRef().slot);

      expect(slots).to.deep.equal(expected);
    });

    it('nodeSlots() still excludes locked nodes and parents', function () {
      const cy = mk();

      cy.$id('a').lock();

      let slots = null;

      cy.layout({
        impl: class {
          run(ctx) {
            slots = ctx.nodeSlots();
          }
        },
        fit: false,
      }).run();

      expect(slots).to.not.include(cy.$id('a')._eventRef().slot);
      expect(slots).to.include(cy.$id('b')._eventRef().slot);
    });

    it('edgeSlots() is cy.edges() order, exactly', function () {
      const cy = mk();
      let slots = null;

      cy.layout({
        impl: class {
          run(ctx) {
            slots = ctx.edgeSlots();
          }
        },
        fit: false,
      }).run();

      expect(slots).to.deep.equal(cy.edges().map((e) => e._eventRef().slot));
    });

    it('a subset scope enumerates only its own nodes, in its order', function () {
      const cy = mk();
      const scope = cy.nodes().slice(0, 2);
      let slots = null;

      scope
        .layout({
          impl: class {
            run(ctx) {
              slots = ctx.nodeSlots();
            }
          },
          fit: false,
        })
        .run();

      expect(slots).to.deep.equal(scope.map((n) => n._eventRef().slot));
    });

    it('ctx.eles and ctx.nodes still answer when an impl does ask', function () {
      const cy = mk();
      let elesLen = -1;
      let nodesLen = -1;

      cy.layout({
        impl: class {
          run(ctx) {
            elesLen = ctx.eles.length;
            nodesLen = ctx.nodes.length;
          }
        },
        fit: false,
      }).run();

      expect(elesLen).to.equal(cy.elements().length);
      expect(nodesLen).to.equal(cy.nodes().length);
    });
  });

  describe('ctx.packComponents (87.1)', function () {
    // two disjoint K3s, placed by the impl at identical coordinates —
    // deliberately overlapping so the pack has real work to do
    const twoK3s = () => {
      const elements = [];

      for (const comp of ['a', 'b']) {
        for (let i = 0; i < 3; i++) {
          elements.push({ data: { id: comp + i } });
        }

        elements.push(
          { data: { id: comp + 'e0', source: comp + '0', target: comp + '1' } },
          { data: { id: comp + 'e1', source: comp + '1', target: comp + '2' } },
          { data: { id: comp + 'e2', source: comp + '2', target: comp + '0' } },
        );
      }

      return mk(elements, { headlessWidth: 400, headlessHeight: 400 });
    };

    const TRIANGLE = [
      [0, 0],
      [100, 0],
      [50, 80],
    ];

    const overlapImpl = (pack) =>
      class {
        run(ctx) {
          const slots = ctx.nodeSlots();
          const xy = [];

          // both triangles at the same coordinates (slot order is
          // a0 a1 a2 b0 b1 b2 — insertion order)
          for (let i = 0; i < slots.length; i++) {
            xy.push(TRIANGLE[i % 3][0], TRIANGLE[i % 3][1]);
          }

          ctx.setPositions(slots, xy);

          if (pack) {
            ctx.packComponents(50);
          }
        }
      };

    const bboxOf = (cy, ids) => {
      const xs = ids.map((id) => cy.$id(id).position().x);
      const ys = ids.map((id) => cy.$id(id).position().y);

      return {
        x1: Math.min(...xs),
        x2: Math.max(...xs),
        y1: Math.min(...ys),
        y2: Math.max(...ys),
      };
    };

    const A = ['a0', 'a1', 'a2'];
    const B = ['b0', 'b1', 'b2'];

    it('separates overlapping components by the given spacing', async function () {
      const cy = twoK3s();
      const layout = cy.layout({ impl: overlapImpl(true), fit: false }).run();

      await layout.promise();

      const a = bboxOf(cy, A);
      const b = bboxOf(cy, B);
      // translation-only: each triangle keeps its own shape
      expect(a.x2 - a.x1).to.be.closeTo(100, 1e-3);
      expect(b.x2 - b.x1).to.be.closeTo(100, 1e-3);
      // the largest component's centre is the fixed point (equal
      // areas: the first) — a stays exactly where the impl put it
      expect(a).to.deep.equal({ x1: 0, x2: 100, y1: 0, y2: 80 });
      // b lands below (the two 100-wide boxes at spacing 50 wrap the
      // ~247-wide shelf row): zero overlap, gap exactly the spacing
      expect(b.y1 - a.y2).to.be.closeTo(50, 1e-3);
      expect(b.x1).to.be.closeTo(a.x1, 1e-3);
    });

    it('control: without the call the components stay overlapped', async function () {
      const cy = twoK3s();
      const layout = cy.layout({ impl: overlapImpl(false), fit: false }).run();

      await layout.promise();

      const a = bboxOf(cy, A);
      const b = bboxOf(cy, B);

      expect(a).to.deep.equal(b); // coincident — the pack was the fix
    });
  });
});

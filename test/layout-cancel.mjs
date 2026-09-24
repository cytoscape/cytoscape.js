import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { CancelledError } from '../src/algorithms/cancel.mjs';

/*
Round 128: `layout.cancel()` beside `stop()`, and `destroy()` as the
last cancel.

`stop()` keeps its meaning (end here, keep what stands — pinned below
so the round changes nothing there).  `cancel()` abandons the run: a
tween under way is dropped where it is, the scope's nodes go back to
where `run()` found them (bit-exact — the snapshot is a copy of the
column), the viewport is left as it is, `layoutstop` still fires,
once, carrying `cancelled: true`, the caller's `stop` callback still
runs, and a custom layout's `promise()` rejects with `CancelledError`
while a caller who never awaits it sees no unhandled rejection.

What each shape of run does with a cancel: the eight built-ins have
only a tween to abandon (their bare call is synchronous and has
finished by the time anything can be cancelled); a custom impl is
asked to `cancel()`, or `stop()` when it has no `cancel`, and one with
neither runs to completion before the wrapper closes the cancelled
run; the force layout exits its loop and lands no settle.

Controls run while writing this file (2026-09-18), each restored:
skipping the restore in `LayoutRun.close` turned every position
assertion red; dropping the `cancelled` guard in the finisher's tween
completion fired a second `layoutstop`; dropping the `!this.cancelled`
around the force layout's settle landed the settle over the snapshot.
*/

const RING = (n = 12) => {
  const elements = [];

  for (let i = 0; i < n; i++) {
    elements.push({
      data: { id: 'n' + i },
      position: { x: 17 * i + 3, y: 100 - 5 * i },
    });
    elements.push({
      data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % n) },
    });
  }

  return elements;
};

const mk = (opts = {}) =>
  cytoscape({
    elements: RING(),
    headlessWidth: 800,
    headlessHeight: 600,
    ...opts,
  });

const positionsOf = (cy) => cy.nodes().map((n) => ({ ...n.position() }));

const same = (a, b) => {
  expect(a.length).to.equal(b.length);

  for (let i = 0; i < a.length; i++) {
    expect(a[i].x, `x of ${i}`).to.equal(b[i].x);
    expect(a[i].y, `y of ${i}`).to.equal(b[i].y);
  }
};

const anyMoved = (a, b) => {
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) {
      return true;
    }
  }

  return false;
};

const moved = (a, b) => {
  expect(anyMoved(a, b), 'expected at least one node to have moved').to.equal(
    true,
  );
};

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

const until = async (test, limit = 5000) => {
  const start = Date.now();

  while (!test()) {
    if (Date.now() - start > limit) {
      throw new Error('until: the condition did not hold within the limit');
    }

    await tick(5);
  }
};

const eventLog = (cy) => {
  const log = [];

  cy.on('layoutstart layoutready layoutstop', (e) => {
    log.push(e.cancelled === true ? `${e.type}:cancelled` : e.type);
  });

  return log;
};

const rejection = (promise) =>
  promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (err) => err,
  );

describe('layouts: cancel() (round 128)', function () {
  describe('the built-ins under animate: true', function () {
    for (const name of [
      'grid',
      'circle',
      'concentric',
      'breadthfirst',
      'random',
      'radial',
      'pack',
      'preset',
    ]) {
      it(`${name}: a cancel mid-tween restores the snapshot, drops the tween and closes once with cancelled: true`, async function () {
        // pack re-packs components where they stand: one ring would
        // not move, so it gets two chains
        const cy =
          name === 'pack'
            ? mk({
                elements: RING().filter(
                  (e) => e.data.id !== 'e5' && e.data.id !== 'e11',
                ),
              })
            : mk();
        const before = positionsOf(cy);
        const log = eventLog(cy);
        let stopCb = 0;
        const options = {
          name,
          animate: true,
          animationDuration: 200,
          stop: () => stopCb++,
        };

        if (name === 'preset') {
          options.positions = (node) => ({
            x: 500 + Number(node.id().slice(1)) * 20,
            y: 400,
          });
        }
        if (name === 'radial' || name === 'breadthfirst') {
          options.roots = cy.$id('n0');
        }

        const layout = cy.layout(options);

        layout.run();
        // headless frames are 16 ms timeouts and a tween's first frame only
        // stamps its start, so the first movement is the second frame; a
        // fixed 40 ms wait lost that race under the full suite's load
        await until(() => anyMoved(before, positionsOf(cy)));

        // mid-tween: something has moved off the snapshot
        moved(before, positionsOf(cy));

        layout.cancel();

        same(before, positionsOf(cy));
        expect(log).to.deep.equal([
          'layoutstart',
          'layoutready',
          'layoutstop:cancelled',
        ]);
        expect(stopCb).to.equal(1);

        // the dropped tween's completion fires nothing more, and the
        // positions stay put
        await tick(260);
        same(before, positionsOf(cy));
        expect(log.length).to.equal(3);
        expect(stopCb).to.equal(1);
        expect(cy._inflight.size).to.equal(0);
        expect(cy._layoutRuns.size).to.equal(0);
      });
    }

    it('the viewport is left where the cancel found it', async function () {
      const cy = mk();
      const layout = cy.layout({
        name: 'circle',
        animate: true,
        animationDuration: 200,
        padding: 5,
      });

      layout.run();
      await tick(60);

      const zoomAtCancel = cy.zoom();
      const panAtCancel = { ...cy.pan() };

      layout.cancel();
      await tick(30);

      expect(cy.zoom()).to.equal(zoomAtCancel);
      expect(cy.pan()).to.deep.equal(panAtCancel);
    });

    it('a subset scope restores only its own nodes and leaves the rest', async function () {
      const cy = mk();
      const scope = cy.nodes().filter((n) => Number(n.id().slice(1)) < 6);
      const before = positionsOf(cy);
      const layout = scope.layout({
        name: 'grid',
        animate: true,
        animationDuration: 200,
        fit: false,
      });

      layout.run();
      await tick(40);
      layout.cancel();

      same(before, positionsOf(cy));
    });
  });

  describe('the no-ops', function () {
    it('cancel() before run() and after a synchronous run change nothing', function () {
      const cy = mk();
      const log = eventLog(cy);
      const layout = cy.layout({ name: 'grid' });

      layout.cancel();
      expect(log).to.deep.equal([]);

      layout.run();

      const laidOut = positionsOf(cy);

      layout.cancel();
      layout.cancel();

      same(laidOut, positionsOf(cy));
      expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
      expect(cy._layoutRuns.size).to.equal(0);
    });

    it('a normal layoutstop carries no cancelled flag', function () {
      const cy = mk();
      let flag = 'unset';

      cy.on('layoutstop', (e) => {
        flag = e.cancelled;
      });
      cy.layout({ name: 'circle' }).run();

      expect(flag).to.equal(undefined);
    });
  });

  describe('custom layouts', function () {
    /** an impl that walks its nodes rightwards, one write per tick,
     * until told to stop or cancel */
    const walker = (shape) => {
      const calls = { stop: 0, cancel: 0 };
      const impl = {
        run(ctx) {
          const slots = ctx.nodeSlots();
          let step = 0;

          return new Promise((resolve) => {
            const frame = () => {
              if (impl.ended || step >= 50) {
                resolve();

                return;
              }

              step++;

              const xy = [];

              for (const slot of slots) {
                xy.push(1000 + step * 10, slot);
              }

              ctx.setPositions(slots, xy);
              setTimeout(frame, 5);
            };

            frame();
          });
        },
        ended: false,
      };

      if (shape === 'cancel' || shape === 'both') {
        impl.cancel = () => {
          calls.cancel++;
          impl.ended = true;
        };
      }
      if (shape === 'stop' || shape === 'both') {
        impl.stop = () => {
          calls.stop++;
          impl.ended = true;
        };
      }

      return { impl, calls };
    };

    it('an impl with cancel(): the impl is asked, the promise rejects, the snapshot returns once the impl settles', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const log = eventLog(cy);
      const { impl, calls } = walker('both');
      const layout = cy.layout({ impl, fit: false });

      layout.run();
      await tick(30);
      moved(before, positionsOf(cy));

      layout.cancel();

      expect(calls).to.deep.equal({ stop: 0, cancel: 1 });

      const err = await rejection(layout.promise());

      expect(err).to.be.instanceOf(CancelledError);
      expect(err).to.be.instanceOf(cytoscape.CancelledError);
      same(before, positionsOf(cy));
      expect(log).to.deep.equal(['layoutstart', 'layoutstop:cancelled']);
      expect(cy._inflight.size).to.equal(0);

      // a second cancel is a no-op
      layout.cancel();
      expect(calls.cancel).to.equal(1);
    });

    it('an impl with only stop(): cancel asks stop() and still abandons the run', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const { impl, calls } = walker('stop');
      const layout = cy.layout({ impl, fit: false });

      layout.run();
      await tick(30);
      layout.cancel();

      expect(calls).to.deep.equal({ stop: 1, cancel: 0 });
      await rejection(layout.promise());
      same(before, positionsOf(cy));
    });

    it('an impl with neither: runs to completion, then the run closes as cancelled', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const log = eventLog(cy);
      const { impl } = walker('none');
      const layout = cy.layout({ impl, fit: false });

      layout.run();
      await tick(30);
      layout.cancel();

      const t = Date.now();
      const err = await rejection(layout.promise());

      // the walker's 50 steps at 5 ms ran out first
      expect(Date.now() - t).to.be.greaterThan(50);
      expect(err).to.be.instanceOf(CancelledError);
      same(before, positionsOf(cy));
      expect(log).to.deep.equal(['layoutstart', 'layoutstop:cancelled']);
    });

    it('a synchronous impl cancelled right after run(): the microtask close restores the write', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const layout = cy.layout({
        impl: {
          run(ctx) {
            const slots = ctx.nodeSlots();
            const xy = [];

            for (const slot of slots) {
              xy.push(5000, slot);
            }

            ctx.setPositions(slots, xy);
          },
        },
        fit: false,
      });

      layout.run();
      moved(before, positionsOf(cy));
      layout.cancel();
      await rejection(layout.promise());
      same(before, positionsOf(cy));
    });

    it('a finisher-driven impl cancelled mid-tween: the finisher fires nothing more', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const log = eventLog(cy);
      const layout = cy.layout({
        impl: {
          run(ctx) {
            ctx.layoutPositions((node) => ({
              x: 3000 + Number(node.id().slice(1)),
              y: 0,
            }));
          },
        },
        animate: true,
        animationDuration: 200,
        fit: false,
      });

      layout.run();
      await until(() => anyMoved(before, positionsOf(cy)));
      moved(before, positionsOf(cy));
      layout.cancel();

      // the wrapper closes on the impl's (already settled) promise
      await rejection(layout.promise());
      same(before, positionsOf(cy));
      await tick(260);
      expect(log).to.deep.equal([
        'layoutstart',
        'layoutready',
        'layoutstop:cancelled',
      ]);
    });

    it('promise() rejects, but a caller who never awaits it sees no unhandled rejection', async function () {
      const cy = mk();
      const { impl } = walker('cancel');
      const layout = cy.layout({ impl, fit: false });

      layout.run();
      await tick(20);
      layout.cancel();
      // node:test fails this spec on an unhandled rejection: reaching
      // the assertion is the proof
      await tick(40);
      expect(cy._inflight.size).to.equal(0);
    });

    it('a node removed during the run is skipped by the restore', async function () {
      const cy = mk();
      const { impl } = walker('cancel');
      const layout = cy.layout({ impl, fit: false });

      layout.run();
      await tick(20);
      cy.$id('n3').remove();
      layout.cancel();
      await rejection(layout.promise());
      expect(cy.nodes().length).to.equal(11);
      expect(cy.$id('n4').position()).to.deep.equal({ x: 71, y: 80 });
    });
  });

  describe('the force layout', function () {
    it('stop() is unchanged: the run lands where it stands, resolves, and layoutstop carries no flag', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const log = eventLog(cy);
      const layout = cy.layout({
        name: 'force',
        seed: 3,
        fit: false,
        animateLive: true,
        stepsPerFrame: 1,
        iterations: 100000,
        threshold: 0,
        decay: 0.0005,
      });

      layout.run();
      await until(() => anyMoved(before, positionsOf(cy)));
      layout.stop();
      await layout.promise();

      moved(before, positionsOf(cy));
      expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
    });

    it('cancel() on a live CPU run: the loop exits, no settle lands, the snapshot returns', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const log = eventLog(cy);
      const layout = cy.layout({
        name: 'force',
        seed: 3,
        fit: false,
        animateLive: true,
        stepsPerFrame: 1,
        iterations: 100000,
        threshold: 0,
        decay: 0.0005,
      });

      layout.run();
      await until(() => anyMoved(before, positionsOf(cy)));
      moved(before, positionsOf(cy));
      layout.cancel();

      const err = await rejection(layout.promise());

      expect(err).to.be.instanceOf(CancelledError);
      same(before, positionsOf(cy));
      expect(log).to.deep.equal(['layoutstart', 'layoutstop:cancelled']);
      // nothing ticks on afterwards
      await tick(40);
      same(before, positionsOf(cy));
    });

    it('cancel() mid-tween under animate: true restores the snapshot', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const layout = cy.layout({
        name: 'force',
        seed: 3,
        fit: false,
        animate: true,
        animationDuration: 200,
      });

      layout.run();
      // the sim runs on the worker (129.3 / 131), so the tween starts
      // when it answers — wait for the first tweened frame, not a clock
      await until(() => anyMoved(before, positionsOf(cy)));
      layout.cancel();
      await rejection(layout.promise());
      same(before, positionsOf(cy));
      await tick(220);
      same(before, positionsOf(cy));
    });

    it('cancel() on an infinite run ends it', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const layout = cy.layout({
        name: 'force',
        seed: 3,
        fit: false,
        infinite: true,
        stepsPerFrame: 1,
      });

      layout.run();
      await tick(30);
      layout.cancel();
      await rejection(layout.promise());
      same(before, positionsOf(cy));
    });
  });

  describe('destroy() is the last cancel', function () {
    it('a tweening built-in across destroy: layoutstop reaches the listeners with cancelled: true, then destroy', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const log = eventLog(cy);

      cy.on('destroy', () => log.push('destroy'));
      cy.layout({
        name: 'circle',
        animate: true,
        animationDuration: 200,
      }).run();
      await tick(40);
      cy.destroy();

      expect(log).to.deep.equal([
        'layoutstart',
        'layoutready',
        'layoutstop:cancelled',
        'destroy',
      ]);
      same(before, positionsOf(cy));
      expect(cy._inflight.size).to.equal(0);
      expect(cy._layoutRuns.size).to.equal(0);
    });

    it('a custom layout across destroy: the impl is asked to cancel and promise() rejects', async function () {
      const cy = mk();
      let cancels = 0;
      let ended = false;
      const layout = cy.layout({
        impl: {
          run() {
            return new Promise((resolve) => {
              const spin = () => (ended ? resolve() : setTimeout(spin, 5));

              spin();
            });
          },
          cancel() {
            cancels++;
            ended = true;
          },
        },
      });

      layout.run();
      await tick(20);
      cy.destroy();

      const err = await rejection(layout.promise());

      expect(err).to.be.instanceOf(CancelledError);
      expect(cancels).to.equal(1);
    });

    it('a live force run across destroy stops writing and throws nothing', async function () {
      const cy = mk();
      const before = positionsOf(cy);
      const layout = cy.layout({
        name: 'force',
        seed: 3,
        fit: false,
        animateLive: true,
        stepsPerFrame: 1,
        iterations: 100000,
        threshold: 0,
        decay: 0.0005,
      });

      layout.run();
      await tick(40);
      cy.destroy();

      await rejection(layout.promise());
      same(before, positionsOf(cy));
      await tick(60);
      same(before, positionsOf(cy));
    });
  });
});

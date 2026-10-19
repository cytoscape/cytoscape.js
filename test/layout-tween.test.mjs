import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import { canDragImpl } from '../src/interact/pointer-press.mjs';

/*
Round 144 (PLAN.md item 68): an animated layout's tween is one column
animation — every node's start and end in one write, one registration
and one upload on the device — where it was one animation per node,
which at 20k nodes drew two frames a second on the same-thread host.
Per-node observability during the tween is part of the contract, and
each answer is pinned here on both executors: the CPU path (headless,
as the worker host's main thread ran it before this round) and the GPU
lease (a mock sink, as the same-thread renderer holds it — the CPU
column keeps the start until the settle).

The answers, v3's wherever it was cheap:

- `node.animated()` is true for every tweening node, false for one the
  `animateFilter` passed over, one locked before the run, and one
  stopped or removed since.
- `node.position()` reads the tween's value as of the last frame, on
  both executors (the lease used to read the start).
- `node.stop()` detaches that node alone — it holds where it got to,
  or lands with `jumpToEnd` — and the rest run on; `layoutstop` fires
  once, when the tween ends.  Stopping every node ends the tween.
- a per-node `animate({ position })` evicts that node alone.
- `lock()` mid-tween holds the node where it got to (v3's step skips a
  locked node; v4 does not resume on `unlock()`); `cy.autolock( true )`
  holds them all.
- `remove()` and `cy.patch()` drop a node from the tween before the
  store frees its slot — the device stops writing it, so an `add()`
  reusing the slot is not tweened.
- a node mid-tween cannot be grabbed (v4's rule for any animating
  element); a stopped one can.
- `layoutready` fires in `run()`; `layoutstop` when the tween ends.
- `layout.stop()` ends the tween where it stands and fires
  `layoutstop` now, once, without the flag; `layout.cancel()` (round
  128) releases the device's batch as well as restoring the snapshot.
- a reparent mid-tween demotes the batch to the CPU, and the tween
  runs on to its targets.

Controls run while writing this file (2026-09-29), each restored: the
finisher building one `node.animation()` per node turned the
one-registration spec red (twelve batches); dropping the `off` skip in
`apply` moved the stopped node on to its target; the handle's `stop()`
calling the animation directly (the pre-144 body) left the cancelled
batch registered; skipping `dropRefs` in `_removeClosure` left the
removed node's entry live on the device; reading the column in
`position()` read the start under the lease.
*/

const N = 12;

const RING = () => {
  const elements = [];

  for (let i = 0; i < N; i++) {
    elements.push({
      data: { id: 'n' + i },
      position: { x: 17 * i + 3, y: 100 - 5 * i },
    });
    elements.push({
      data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % N) },
    });
  }

  return elements;
};

/** A mock GPU sink: what the manager registers, detaches and releases. */
const mockSink = () => {
  const sink = {
    registered: [],
    unregistered: [],
    detached: [],
    live: new Map(),
    register(id, writes, start, duration) {
      sink.registered.push({ id, writes, start, duration });
      sink.live.set(id, writes);
    },
    unregister(id) {
      sink.unregistered.push(id);
      sink.live.delete(id);
    },
    detach(id, column, indices) {
      sink.detached.push({ id, column, indices: [...indices] });
    },
  };

  return sink;
};

/**
 * A graph on one of the two executors.  `gpu` attaches a mock sink as
 * the renderer does (it takes the clock, so ticks are the spec's own).
 */
const mk = (gpu) => {
  const cy = cytoscape({
    elements: RING(),
    headlessWidth: 800,
    headlessHeight: 600,
  });
  const sink = gpu ? mockSink() : null;

  if (sink != null) {
    cy._animations.attachDriver(sink);
  }

  return { cy, sink };
};

const tick = (cy, t) => cy._animations.tick(t);
const pos = (cy, id) => ({ ...cy.$id(id).position() });
const col = (cy, id) => {
  const slot = cy.$id(id)._refs[0].slot;
  const xy = cy._store.column('node.position');

  return { x: xy[slot * 2], y: xy[slot * 2 + 1] };
};
const near = (a, b, eps = 1e-3) => {
  expect(a.x).to.be.closeTo(b.x, eps);
  expect(a.y).to.be.closeTo(b.y, eps);
};
const between = (p, a, b) => {
  const t = (p.x - a.x) / (b.x - a.x);

  expect(t).to.be.greaterThan(0.01).and.lessThan(0.99);
};

/** The grid's own targets, from a synchronous run on a twin graph. */
const targets = () => {
  const twin = cytoscape({
    elements: RING(),
    headlessWidth: 800,
    headlessHeight: 600,
  });

  twin.layout({ name: 'grid', fit: false }).run();

  const out = {};

  twin.nodes().forEach((n) => {
    out[n.id()] = { ...n.position() };
  });
  twin.destroy();

  return out;
};

const run = (cy, extra = {}) => {
  const log = [];

  cy.on('layoutstart layoutready layoutstop', (e) => {
    log.push(e.cancelled === true ? `${e.type}:cancelled` : e.type);
  });

  const layout = cy.layout({
    name: 'grid',
    animate: true,
    animationDuration: 100,
    animationEasing: 'linear',
    fit: false,
    ...extra,
  });

  layout.run();

  return { layout, log };
};

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('layouts: the animated tween is one column animation (round 144)', function () {
  it('registers one animation, one position write spanning every node', function () {
    const { cy, sink } = mk(true);

    run(cy);
    tick(cy, 0);

    expect(sink.registered).to.have.length(1);
    expect(sink.registered[0].writes).to.have.length(1);
    expect(sink.registered[0].writes[0].column).to.equal('node.position');
    expect(sink.registered[0].writes[0].slots).to.have.length(N);
  });

  for (const gpu of [false, true]) {
    const on = gpu ? 'the GPU lease' : 'the CPU path';

    describe(on, function () {
      it('ends every node on the layout’s own positions; layoutready in run(), layoutstop at the end', async function () {
        const { cy, sink } = mk(gpu);
        const want = targets();
        const { log } = run(cy);

        expect(log).to.deep.equal(['layoutstart', 'layoutready']);

        tick(cy, 0);
        tick(cy, 50);
        await flush();
        expect(log).to.deep.equal(['layoutstart', 'layoutready']);

        tick(cy, 100);
        await flush();
        expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);

        cy.nodes().forEach((n) => near(n.position(), want[n.id()]));

        if (gpu) {
          expect(sink.unregistered).to.have.length(1);
          expect(sink.live.size).to.equal(0);
        }
      });

      it('animated() is true for every tweening node, false for the filtered and the pre-locked', function () {
        const { cy } = mk(gpu);

        cy.$id('n1').lock();
        run(cy, { animateFilter: (node) => node.id() !== 'n2' });
        tick(cy, 0);
        tick(cy, 50);

        expect(cy.$id('n0').animated()).to.equal(true);
        expect(cy.$id('n5').animated()).to.equal(true);
        expect(cy.$id('n1').animated()).to.equal(false); // locked: excluded
        expect(cy.$id('n2').animated()).to.equal(false); // filtered: placed

        tick(cy, 100);
        expect(cy.nodes().animated()).to.equal(false);
      });

      it('position() reads the value the last frame reached', function () {
        const { cy } = mk(gpu);
        const start = pos(cy, 'n3');
        const want = targets().n3;

        run(cy);
        tick(cy, 0);
        tick(cy, 50);

        const mid = pos(cy, 'n3');

        near(mid, {
          x: start.x + (want.x - start.x) * 0.5,
          y: start.y + (want.y - start.y) * 0.5,
        });

        if (gpu) {
          // the column is the device's until the settle
          near(col(cy, 'n3'), start);
        }
      });

      it('node.stop() holds that node where it got to; the rest run on', async function () {
        const { cy, sink } = mk(gpu);
        const start = pos(cy, 'n3');
        const want = targets();
        const { log } = run(cy);

        tick(cy, 0);
        tick(cy, 50);

        const frozen = pos(cy, 'n3');

        cy.$id('n3').stop();

        expect(cy.$id('n3').animated()).to.equal(false);
        expect(cy.$id('n4').animated()).to.equal(true);
        near(pos(cy, 'n3'), frozen);
        near(col(cy, 'n3'), frozen); // on the column, both executors
        between(frozen, start, want.n3);

        if (gpu) {
          const i = sink.registered[0].writes[0].refs.findIndex(
            (r) => r.slot === cy.$id('n3')._refs[0].slot,
          );

          expect(sink.detached).to.deep.equal([
            {
              id: sink.registered[0].id,
              column: 'node.position',
              indices: [i],
            },
          ]);
        }

        tick(cy, 75);
        near(pos(cy, 'n3'), frozen);
        tick(cy, 100);
        await flush();

        near(pos(cy, 'n3'), frozen); // the settle skips it
        near(pos(cy, 'n4'), want.n4);
        expect(log.filter((e) => e === 'layoutstop')).to.have.length(1);
      });

      it('node.stop( true ) lands that node on its target at once', function () {
        const { cy } = mk(gpu);
        const want = targets();

        run(cy);
        tick(cy, 0);
        tick(cy, 30);
        cy.$id('n7').stop(true);

        near(pos(cy, 'n7'), want.n7);
        near(col(cy, 'n7'), want.n7);
        expect(cy.$id('n0').animated()).to.equal(true);
      });

      it('stopping every node ends the tween, and layoutstop fires once', async function () {
        const { cy, sink } = mk(gpu);
        const { log } = run(cy);

        tick(cy, 0);
        tick(cy, 40);

        const frozen = pos(cy, 'n5');

        cy.nodes().stop();
        await flush();

        expect(cy._animations.active()).to.equal(false);
        expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
        near(pos(cy, 'n5'), frozen);

        if (gpu) {
          expect(sink.live.size).to.equal(0);
        }
      });

      it('a per-node animate() evicts that node alone', function () {
        const { cy } = mk(gpu);
        const want = targets();

        run(cy);
        tick(cy, 0);
        tick(cy, 50);
        cy.$id('n2').animate({
          position: { x: 999, y: 999 },
          duration: 100,
          easing: 'linear',
        });

        expect(cy.$id('n4').animated()).to.equal(true);
        tick(cy, 100);
        near(pos(cy, 'n4'), want.n4); // the layout tween ran on
        // n2 is its own now: its clock starts at its first tick (100)
        expect(pos(cy, 'n2').x).to.be.lessThan(999);
        tick(cy, 200);
        near(pos(cy, 'n2'), { x: 999, y: 999 });
      });

      it('lock() mid-tween holds the node; unlock() does not resume it', function () {
        const { cy, sink } = mk(gpu);
        const want = targets();

        run(cy);
        tick(cy, 0);
        tick(cy, 50);

        const frozen = pos(cy, 'n6');

        cy.$id('n6').lock();
        expect(cy.$id('n6').animated()).to.equal(false);
        tick(cy, 70);
        cy.$id('n6').unlock();
        tick(cy, 100);

        near(pos(cy, 'n6'), frozen);
        near(pos(cy, 'n8'), want.n8);

        if (gpu) {
          expect(sink.detached).to.have.length(1);
        }
      });

      it('cy.autolock( true ) mid-tween holds every node', function () {
        const { cy } = mk(gpu);

        run(cy);
        tick(cy, 0);
        tick(cy, 50);

        const frozen = cy.nodes().map((n) => ({ ...n.position() }));

        cy.autolock(true);
        expect(cy._animations.active()).to.equal(false);
        tick(cy, 100);
        cy.nodes().forEach((n, i) => near(n.position(), frozen[i]));
      });

      it('remove() drops the node from the tween; a node reusing its slot is not tweened', function () {
        const { cy, sink } = mk(gpu);
        const want = targets();

        run(cy);
        tick(cy, 0);
        tick(cy, 50);

        const slot = cy.$id('n3')._refs[0].slot;

        cy.$id('n3').remove();

        if (gpu) {
          expect(sink.detached.map((d) => d.indices.length)).to.deep.equal([1]);
        }

        cy.add({ data: { id: 'z' }, position: { x: -50, y: -60 } });
        expect(cy.$id('z')._refs[0].slot).to.equal(slot); // the reuse
        expect(cy.$id('z').animated()).to.equal(false);

        tick(cy, 100);
        near(pos(cy, 'z'), { x: -50, y: -60 });
        near(col(cy, 'z'), { x: -50, y: -60 });
        near(pos(cy, 'n4'), want.n4);
      });

      it('cy.patch() removing a node mid-tween drops it; the survivors land', function () {
        const { cy } = mk(gpu);
        const want = targets();

        run(cy);
        tick(cy, 0);
        tick(cy, 50);

        const next = RING().filter(
          (e) =>
            e.data.id !== 'n9' &&
            e.data.source !== 'n9' &&
            e.data.target !== 'n9',
        );

        // positions the payload carries would be survivors' writes; the
        // payload here carries none for them
        cy.patch(next.map((e) => ({ data: e.data })));
        expect(cy.$id('n9').length).to.equal(0);
        tick(cy, 100);
        near(pos(cy, 'n4'), want.n4);
        expect(cy._animations.active()).to.equal(false);
      });

      it('a tweening node cannot be grabbed; a stopped one can', function () {
        const { cy } = mk(gpu);

        run(cy);
        tick(cy, 0);
        tick(cy, 50);

        expect(canDragImpl({ cy }, cy.$id('n2'))).to.equal(false);
        cy.$id('n2').stop();
        expect(canDragImpl({ cy }, cy.$id('n2'))).to.equal(true);
        expect(canDragImpl({ cy }, cy.$id('n3'))).to.equal(false);
      });

      it('layout.stop() ends the tween where it stands; layoutstop fires now, once, without the flag', async function () {
        const { cy, sink } = mk(gpu);
        const { layout, log } = run(cy);

        tick(cy, 0);
        tick(cy, 50);

        const frozen = pos(cy, 'n5');

        layout.stop();
        expect(log).to.deep.equal(['layoutstart', 'layoutready', 'layoutstop']);
        await flush();
        expect(log).to.have.length(3);
        near(pos(cy, 'n5'), frozen);
        expect(cy._animations.active()).to.equal(false);
        expect(cy._layoutRuns.size).to.equal(0);

        if (gpu) {
          expect(sink.live.size).to.equal(0);
        }
      });

      it('layout.cancel() restores the snapshot and releases the batch', async function () {
        const { cy, sink } = mk(gpu);
        const start = pos(cy, 'n5');
        const { layout, log } = run(cy);

        tick(cy, 0);
        tick(cy, 50);
        layout.cancel();
        await flush();

        near(pos(cy, 'n5'), start);
        near(col(cy, 'n5'), start);
        expect(log).to.deep.equal([
          'layoutstart',
          'layoutready',
          'layoutstop:cancelled',
        ]);

        if (gpu) {
          // the handle's stop() went round the manager before 144, and
          // the batch stayed registered with the column leased
          expect(sink.live.size).to.equal(0);
        }
      });
    });
  }

  it('a reparent mid-tween demotes the batch; the tween runs on to its targets', function () {
    const { cy, sink } = mk(true);
    const want = targets();

    cy.add({ data: { id: 'p' }, position: { x: 0, y: 0 } });
    cy.$id('p').remove(); // a compound-free graph again, the store warmed

    run(cy);
    tick(cy, 0);
    tick(cy, 50);
    expect(sink.live.size).to.equal(1);

    cy.add({ data: { id: 'q' } });
    cy.$id('n11').move({ parent: 'q' });

    expect(sink.live.size).to.equal(0); // off the device
    expect(cy.$id('n4').animated()).to.equal(true);
    tick(cy, 100);
    near(pos(cy, 'n4'), want.n4);
  });

  it('a handle stopped under a sink releases its batch (any animation)', function () {
    const { cy, sink } = mk(true);
    const ani = cy.$id('n0').animation({
      position: { x: 50, y: 50 },
      duration: 100,
    });

    ani.play();
    tick(cy, 0);
    expect(sink.live.size).to.equal(1);
    ani.stop();
    expect(sink.live.size).to.equal(0);
    expect(cy._animations.active()).to.equal(false);
  });
});

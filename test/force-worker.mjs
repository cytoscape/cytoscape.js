import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  _forceWorkerStats,
  _resetForceWorker,
  acquireForceWorker,
  forceWorkerSupported,
} from '../src/layout/force-remote.mjs';
import { resolveForceExecutor } from '../src/layout/force.mjs';
import { CancelledError } from '../src/algorithms/cancel.mjs';

/*
Round 129.3: the CPU force simulation on a worker.

What is pinned, and how tightly: **bit-identical trajectories** — a
run under `executor: 'workers'` answers every position the in-thread
`'cpu'` run answers, asserted with `===`, on the plain ring, on a
compound graph (owner gravity), and on a constrained run (the
projection).  Not a tolerance: the worker loaded the same bundle and
ran the same `ForceSim`, so a difference of one ulp would mean two
simulations exist.

The run's shape through the worker: a live run streams (the column
changes between samples), `stop()` lands the positions where they
stand, `cancel()` restores the snapshot and rejects `promise()`, an
infinite run reheats through a drag and its grabbed node holds where
the pointer put it (118.3's spec, word for word, on the worker), and
`destroy()` closes an open run.  The placement under `'auto'` (131
revisited 129.3: the worker headless too, since a Node process wants
its event loop free): a headless run takes the worker, is asynchronous
and answers `'cpu'`'s bits, `'cpu'` is the synchronous spelling (the
worker's counters do not move), a second concurrent run while the
worker is busy runs in-thread, and the three start-time throws fire
where they should.

Controls run while writing this file (2026-09-18), each restored:
posting the worker's final positions with one coordinate nudged by
1e-6 turned all three bit-equality specs red; dropping the `stopped`
test from the remote `wake` left the infinite run's `stop()` pending
(the spec's 5 s guard fired); skipping `sim.project()` before the
worker's first tick turned the constrained spec red.
*/

const RING = (n = 12) => {
  const elements = [];

  for (let i = 0; i < n; i++) {
    elements.push({ data: { id: 'n' + i } });
    elements.push({
      data: { id: 'e' + i, source: 'n' + i, target: 'n' + ((i + 1) % n) },
    });
  }

  return elements;
};

const COMPOUND = () => [
  { data: { id: 'p' } },
  { data: { id: 'q' } },
  ...['a', 'b', 'c', 'd'].map((id) => ({ data: { id, parent: 'p' } })),
  ...['e', 'f', 'g', 'h'].map((id) => ({ data: { id, parent: 'q' } })),
  { data: { id: 'ab', source: 'a', target: 'b' } },
  { data: { id: 'bc', source: 'b', target: 'c' } },
  { data: { id: 'cd', source: 'c', target: 'd' } },
  { data: { id: 'ef', source: 'e', target: 'f' } },
  { data: { id: 'fg', source: 'f', target: 'g' } },
  { data: { id: 'gh', source: 'g', target: 'h' } },
  { data: { id: 'de', source: 'd', target: 'e' } },
];

const positionsOf = (cy) =>
  cy
    .nodes()
    .filter((n) => !n.isParent())
    .map((n) => [n.id(), n.position().x, n.position().y]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const rejection = (promise) =>
  promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (err) => err,
  );

describe('layout: the force simulation on a worker (round 129.3)', function () {
  after(function () {
    _resetForceWorker();
  });

  describe('bit-identical to the in-thread simulation', function () {
    const cases = [
      ['a ring', () => RING(16), {}],
      ['a compound graph (owner gravity, leaves only)', COMPOUND, {}],
      [
        'a constrained run (alignment and relative placement, projected)',
        () => RING(10),
        {
          alignment: { horizontal: [['n0', 'n3', 'n6']] },
          relativePlacement: [{ left: 'n1', right: 'n5', gap: 80 }],
        },
      ],
    ];

    for (const [name, elements, extra] of cases) {
      it(name, async function () {
        const cpu = cytoscape({ elements: elements() });

        cpu
          .layout({
            name: 'force',
            seed: 4,
            fit: false,
            executor: 'cpu',
            ...extra,
          })
          .run();

        const reference = positionsOf(cpu);

        const remote = cytoscape({ elements: elements() });
        const before = _forceWorkerStats();
        const layout = remote.layout({
          name: 'force',
          seed: 4,
          fit: false,
          executor: 'workers',
          ...extra,
        });

        layout.run();
        await layout.promise();

        expect(_forceWorkerStats().runs).to.equal(before.runs + 1);
        expect(positionsOf(remote)).to.deep.equal(reference);
        expect(reference.length).to.be.greaterThan(3);

        cpu.destroy();
        remote.destroy();
      });
    }

    it("'workers' is asynchronous: the positions land at layoutstop, not inside run()", async function () {
      const cy = cytoscape({ elements: RING() });
      const before = positionsOf(cy);
      const layout = cy.layout({
        name: 'force',
        seed: 4,
        fit: false,
        executor: 'workers',
      });

      layout.run();
      expect(positionsOf(cy)).to.deep.equal(before);

      await layout.promise();
      expect(positionsOf(cy)).to.not.deep.equal(before);
      cy.destroy();
    });
  });

  describe('the run through the worker', function () {
    it('a live run streams: the column changes between samples, and stop() lands it', async function () {
      const cy = cytoscape({ elements: RING() });
      const layout = cy.layout({
        name: 'force',
        seed: 4,
        animateLive: true,
        fit: false,
        executor: 'workers',
      });
      const before = _forceWorkerStats();
      const snapshots = [];

      layout.run();

      for (let i = 0; i < 6; i++) {
        await wait(40);
        snapshots.push(cy.$id('n0').position().x);
      }

      expect(new Set(snapshots).size).to.be.greaterThan(1);

      layout.stop();
      await layout.promise();

      expect(_forceWorkerStats().ticks).to.be.greaterThan(before.ticks);
      expect(_forceWorkerStats().runs).to.equal(before.runs + 1);
      cy.destroy();
    });

    it('cancel() on a worker run: the snapshot returns, promise() rejects, the worker stands', async function () {
      const cy = cytoscape({ elements: RING() });
      const before = positionsOf(cy);
      const layout = cy.layout({
        name: 'force',
        seed: 4,
        animateLive: true,
        fit: false,
        executor: 'workers',
        iterations: 100000,
        threshold: 0,
        decay: 0.0005,
      });
      const spawns = _forceWorkerStats().spawns;

      layout.run();
      await wait(150);
      expect(positionsOf(cy)).to.not.deep.equal(before);

      layout.cancel();

      const err = await rejection(layout.promise());

      expect(err).to.be.instanceOf(CancelledError);
      expect(positionsOf(cy)).to.deep.equal(before);
      expect(_forceWorkerStats().spawns).to.equal(spawns);

      // and the next run on the same worker answers the reference
      const cpu = cytoscape({ elements: RING() });

      cpu.layout({ name: 'force', seed: 4, fit: false, executor: 'cpu' }).run();

      const again = cy.layout({
        name: 'force',
        seed: 4,
        fit: false,
        executor: 'workers',
      });

      again.run();
      await again.promise();
      expect(positionsOf(cy)).to.deep.equal(positionsOf(cpu));
      cpu.destroy();
      cy.destroy();
    });

    it('an infinite run reheats through the worker: the grabbed node holds where it is put, its neighbours follow (118.3 on the worker)', async function () {
      this.timeout?.(10000);

      const cy = cytoscape({ elements: RING() });
      const layout = cy.layout({
        name: 'force',
        seed: 4,
        fit: false,
        infinite: true,
        stepsPerFrame: 6,
        executor: 'workers',
      });
      let settled = false;

      layout.run();
      layout.promise().then(() => {
        settled = true;
      });

      await wait(1200);

      const snapshot = () =>
        Object.fromEntries(
          cy.nodes().map((n) => [n.id(), { ...n.position() }]),
        );
      const before = snapshot();
      const n0 = cy.$id('n0');
      const target = { x: before.n0.x + 400, y: before.n0.y };

      n0.emit('grab');
      n0.position({ x: before.n0.x + 200, y: before.n0.y });
      n0.position(target);

      await wait(600);

      expect(cy.$id('n0').position().x).to.be.closeTo(target.x, 0.01);
      for (const id of ['n1', 'n11']) {
        expect(cy.$id(id).position().x, id).to.be.greaterThan(
          before[id].x + 50,
        );
      }

      n0.emit('free');
      await wait(600);

      const after = cy.$id('n0').position().x;

      expect(after).to.be.lessThan(target.x - 20);
      expect(after).to.be.greaterThan(before.n0.x + 20);
      expect(settled).to.equal(false);

      // stop() ends the run: the promise resolves within a frame
      layout.stop();
      await Promise.race([
        layout.promise(),
        wait(5000).then(() => {
          throw new Error('stop() left the worker run pending');
        }),
      ]);
      cy.destroy();
    });

    it('destroy() under a worker run closes it: promise() rejects, the worker stands', async function () {
      const cy = cytoscape({ elements: RING() });
      const layout = cy.layout({
        name: 'force',
        seed: 4,
        animateLive: true,
        fit: false,
        executor: 'workers',
        iterations: 100000,
        threshold: 0,
        decay: 0.0005,
      });
      const spawns = _forceWorkerStats().spawns;

      layout.run();
      await wait(100);
      cy.destroy();

      const err = await rejection(layout.promise());

      expect(err).to.be.instanceOf(CancelledError);
      expect(_forceWorkerStats().spawns).to.equal(spawns);
    });

    it('a second run while the worker is busy runs in-thread, and answers the same bits', async function () {
      const a = cytoscape({ elements: RING(16) });
      const b = cytoscape({ elements: RING(16) });
      const cpu = cytoscape({ elements: RING(16) });

      cpu.layout({ name: 'force', seed: 4, fit: false, executor: 'cpu' }).run();

      const worker = await acquireForceWorker();

      // the previous spec's destroy stopped a run whose `done` may still
      // be in flight: wait for the worker to be free before the check
      for (let i = 0; i < 100 && worker.busy; i++) {
        await wait(10);
      }

      expect(worker.busy).to.equal(false);

      const first = a.layout({
        name: 'force',
        seed: 4,
        fit: false,
        executor: 'workers',
        animateLive: true,
      });

      first.run();
      await wait(30);
      expect(worker.busy).to.equal(true);

      const runsBefore = _forceWorkerStats().runs;
      const second = b.layout({
        name: 'force',
        seed: 4,
        fit: false,
        executor: 'workers',
      });

      second.run();
      await second.promise();
      // the fallback ran in-thread: the worker counted no second run
      expect(_forceWorkerStats().runs).to.equal(runsBefore);
      expect(positionsOf(b)).to.deep.equal(positionsOf(cpu));

      first.stop();
      await first.promise();
      a.destroy();
      b.destroy();
      cpu.destroy();
    });
  });

  describe("where 'auto' puts the simulation", function () {
    // 131 revisited 129.3's deviation: a Node process wants its main
    // thread free for the event loop as a page wants its UI thread
    // free, so 'auto' takes the worker headless too — the run is then
    // asynchronous, and 'cpu' is the synchronous spelling
    it('a headless run takes the worker, is asynchronous, and answers the in-thread bits', async function () {
      const cy = cytoscape({ elements: RING() });
      const before = _forceWorkerStats();
      const seed = positionsOf(cy);
      const layout = cy.layout({ name: 'force', seed: 4, fit: false });

      layout.run();
      expect(positionsOf(cy)).to.deep.equal(seed); // nothing landed yet
      await layout.promise();
      expect(positionsOf(cy)).to.not.deep.equal(seed);
      expect(_forceWorkerStats().runs).to.equal(before.runs + 1);

      const cpu = cytoscape({ elements: RING() });

      cpu.layout({ name: 'force', seed: 4, fit: false, executor: 'cpu' }).run();
      expect(positionsOf(cpu)).to.deep.equal(positionsOf(cy));
      cy.destroy();
      cpu.destroy();
    });

    it('a headless live run streams from the worker too', async function () {
      const cy = cytoscape({ elements: RING() });
      const before = _forceWorkerStats();
      const layout = cy.layout({
        name: 'force',
        seed: 4,
        fit: false,
        animateLive: true,
      });

      layout.run();
      await layout.promise();
      expect(_forceWorkerStats().runs).to.equal(before.runs + 1);
      cy.destroy();
    });

    it("'cpu' is the synchronous spelling: the worker is never asked", function () {
      const cy = cytoscape({ elements: RING() });
      const before = _forceWorkerStats();
      const seed = positionsOf(cy);

      cy.layout({ name: 'force', seed: 4, fit: false, executor: 'cpu' }).run();

      expect(positionsOf(cy)).to.not.deep.equal(seed);
      expect(_forceWorkerStats()).to.deep.equal(before);
      cy.destroy();
    });
  });

  describe('the guards', function () {
    it('resolves the executor, and any other value throws at start', function () {
      expect(resolveForceExecutor(undefined)).to.equal('auto');
      expect(resolveForceExecutor('workers')).to.equal('workers');

      const cy = cytoscape({ elements: RING() });

      expect(() =>
        cy.layout({ name: 'force', executor: 'threads' }).run(),
      ).to.throw(/executor must be 'auto', 'cpu', 'gpu' or 'workers'/);
      cy.destroy();
    });

    it("'gpu' throws at start where no integrator is available (headless)", function () {
      const cy = cytoscape({ elements: RING() });

      expect(() =>
        cy.layout({ name: 'force', executor: 'gpu' }).run(),
      ).to.throw(/executor 'gpu' needs the GPU integrator/);
      cy.destroy();
    });

    describe('with no worker platform', function () {
      let realGetBuiltin;

      beforeEach(function () {
        realGetBuiltin = process.getBuiltinModule;
        process.getBuiltinModule = () => null;
      });

      afterEach(function () {
        process.getBuiltinModule = realGetBuiltin;
      });

      it("'workers' throws at start, 'auto' runs in-thread", function () {
        expect(forceWorkerSupported()).to.equal(false);

        const cy = cytoscape({ elements: RING() });

        expect(() =>
          cy.layout({ name: 'force', executor: 'workers' }).run(),
        ).to.throw(/executor 'workers' needs a worker platform/);

        const before = positionsOf(cy);

        cy.layout({ name: 'force', seed: 4, fit: false }).run();
        expect(positionsOf(cy)).to.not.deep.equal(before);
        cy.destroy();
      });

      it('acquisition rejects loudly', async function () {
        _resetForceWorker();

        const err = await rejection(acquireForceWorker());

        expect(err.message).to.match(/needs a worker platform/);
      });
    });

    it('a worker that fails to start rejects acquisition, and is not cached', async function () {
      const realGetBuiltin = process.getBuiltinModule;

      _resetForceWorker();
      process.getBuiltinModule = (id) => {
        if (id === 'node:worker_threads') {
          return {
            Worker: class {
              on(event, handler) {
                if (event === 'error') {
                  setTimeout(() => handler(new Error('bundle refused')), 0);
                }
              }
              ref() {}
              unref() {}
              terminate() {
                return Promise.resolve(0);
              }
              postMessage() {}
            },
          };
        }

        return realGetBuiltin.call(process, id);
      };

      try {
        const err = await rejection(acquireForceWorker());

        expect(err.message).to.match(/failed to start: bundle refused/);
      } finally {
        process.getBuiltinModule = realGetBuiltin;
        _resetForceWorker();
      }

      // not cached: the real platform spawns on the next call
      const worker = await acquireForceWorker();

      expect(worker.busy).to.equal(false);
    });
  });
});

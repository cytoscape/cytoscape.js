import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  _algoWorkersStats,
  _resetAlgoWorkers,
} from '../src/algorithms/algo-workers.mjs';
import { _resetAlgoGpu } from '../src/algorithms/algo-gpu.mjs';
import { runAlgo } from '../src/algorithms/executor.mjs';
import { CancelledError } from '../src/algorithms/cancel.mjs';

/*
Round 128: cancellation on the async algorithm tier.

The contract these specs pin, per executor: a `'cpu'` run completes
inside the call, so `cancel()` answers false and the result stands; a
run still pending rejects with `CancelledError` the moment `cancel()`
is called and answers true once (false afterwards); the lanes poll the
token after each await, so a cancel that lands during acquisition
starts no lane at all (the spy GPU lane below is never called, the
pool never receives a snapshot); a cancel that lands mid-run on the
pool stops the ranges being posted and leaves the pool standing for
the next run, which answers the reference bits; and `cy.destroy()` is
the last cancel.  The unhandled-rejection behaviour is pinned both
ways: the caller's handle is theirs to catch, and the router's own
late rejection never surfaces.

Controls run while writing this file (2026-09-18), each restored:
dropping the `throwIfCancelled` after the GPU acquisition turned the
spy-never-called spec red (the lane ran on a cancelled token); dropping
`token.done` turned the `'cpu'` spec red (a completed run answered
true); dropping the token from the pool's drain loop turned the
mid-run spec red (every range ran).
*/

const ring = (n, chords = 3) => {
  const els = [];

  for (let i = 0; i < n; i++) {
    els.push({ data: { id: 'n' + i } });
  }

  for (let i = 0; i < n; i++) {
    els.push({
      data: {
        id: 'r' + i,
        source: 'n' + i,
        target: 'n' + ((i + 1) % n),
        w: 1 + ((i * 31) % 7),
      },
    });

    if (i % chords === 0) {
      els.push({
        data: {
          id: 'c' + i,
          source: 'n' + i,
          target: 'n' + ((i * 13 + 29) % n),
          w: 1 + ((i * 17) % 5),
        },
      });
    }
  }

  return els;
};

const weight = (e) => e.data('w');

const rejection = (promise) =>
  promise.then(
    () => {
      throw new Error('expected the promise to reject');
    },
    (err) => err,
  );

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** a fake `navigator.gpu` whose adapter resolves after `delayMs` */
const stubGpu = (delayMs) => {
  const device = { lost: new Promise(() => {}), limits: {} };
  const adapter = { requestDevice: async () => device };
  const gpu = {
    requestAdapter: () =>
      new Promise((resolve) => setTimeout(() => resolve(adapter), delayMs)),
  };
  const had = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  Object.defineProperty(globalThis, 'navigator', {
    value: { gpu },
    configurable: true,
  });
  _resetAlgoGpu();

  return () => {
    if (had != null) {
      Object.defineProperty(globalThis, 'navigator', had);
    } else {
      delete globalThis.navigator;
    }

    _resetAlgoGpu();
  };
};

describe('algorithms: cancellation (round 128)', function () {
  var cy;

  beforeEach(function () {
    cy = cytoscape({ elements: ring(64) });
  });

  after(function () {
    _resetAlgoWorkers();
  });

  describe('the handle', function () {
    it('every async entry returns a promise carrying cancel()', async function () {
      const eles = cy.elements();
      const runs = [
        eles.pageRank({ executor: 'cpu' }),
        eles.floydWarshall({ executor: 'cpu' }),
        eles.betweennessCentrality({ executor: 'cpu' }),
        eles.closenessCentralityNormalized({ executor: 'cpu' }),
        eles.heatKernel({ executor: 'cpu' }),
      ];

      for (const run of runs) {
        expect(run).to.be.instanceOf(Promise);
        expect(run.cancel).to.be.a('function');
        await run;
      }
    });

    it("a 'cpu' run has completed inside the call: cancel() answers false and the result stands", async function () {
      const run = cy.elements().pageRank({ executor: 'cpu' });

      expect(run.cancel()).to.equal(false);
      expect(run.cancel()).to.equal(false);

      const result = await run;

      expect(result.rank(cy.$id('n0'))).to.be.a('number');
    });

    it('a pending run rejects with CancelledError once cancel() is called, and answers true exactly once', async function () {
      const run = cy
        .elements()
        .betweennessCentrality({ weight, executor: 'workers' });

      expect(run.cancel()).to.equal(true);
      expect(run.cancel()).to.equal(false);

      const err = await rejection(run);

      expect(err).to.be.instanceOf(CancelledError);
      expect(err).to.be.instanceOf(cytoscape.CancelledError);
      expect(err).to.be.instanceOf(Error);
      expect(err.name).to.equal('CancelledError');
      expect(err.message).to.match(/cancelled/);
    });

    it('cancel() after the run settled answers false', async function () {
      const run = cy
        .elements()
        .betweennessCentrality({ weight, executor: 'workers' });
      const result = await run;

      expect(run.cancel()).to.equal(false);
      expect(result.betweenness(cy.$id('n0'))).to.be.a('number');
    });

    it('the static is the class the rejection carries', function () {
      expect(cytoscape.CancelledError).to.equal(CancelledError);
      expect(new cytoscape.CancelledError().name).to.equal('CancelledError');
    });
  });

  describe('a cancel during acquisition starts no lane', function () {
    it("executor 'gpu': the kernel lane is never called on a cancelled token", async function () {
      const restore = stubGpu(10);

      try {
        let gpuCalls = 0;
        const run = runAlgo(
          'gpu',
          64,
          0,
          () => 'cpu',
          async () => {
            gpuCalls++;

            return 'gpu';
          },
        );

        expect(run.cancel()).to.equal(true);

        const err = await rejection(run);

        expect(err).to.be.instanceOf(CancelledError);

        // let the routed promise reach its check after the adapter lands
        await tick(30);
        expect(gpuCalls).to.equal(0);
      } finally {
        restore();
      }
    });

    it("executor 'auto' with a stub adapter: cancelled after acquisition, neither the kernel nor the CPU runs", async function () {
      const restore = stubGpu(10);

      try {
        let gpuCalls = 0;
        let cpuCalls = 0;
        const run = runAlgo(
          'auto',
          64,
          0,
          () => {
            cpuCalls++;

            return 'cpu';
          },
          async () => {
            gpuCalls++;

            return 'gpu';
          },
        );

        expect(run.cancel()).to.equal(true);
        await rejection(run);
        await tick(30);
        expect(gpuCalls).to.equal(0);
        expect(cpuCalls).to.equal(0);
      } finally {
        restore();
      }
    });

    it("executor 'workers': the pool never receives the snapshot", async function () {
      _resetAlgoWorkers(1);

      // warm the pool so the acquisition below is the only await
      await cy
        .elements()
        .closenessCentralityNormalized({ executor: 'workers' });

      const before = _algoWorkersStats();
      const run = cy
        .elements()
        .betweennessCentrality({ weight, executor: 'workers' });

      expect(run.cancel()).to.equal(true);
      await rejection(run);
      await tick(20);

      const after = _algoWorkersStats();

      expect(after.runs).to.equal(before.runs);
      expect(after.jobs).to.equal(before.jobs);
      expect(after.workers).to.equal(1);
      _resetAlgoWorkers();
    });
  });

  describe('a cancel mid-run on the pool', function () {
    it('stops posting ranges, leaves the pool standing, and the next run answers the reference bits', async function () {
      _resetAlgoWorkers(1);

      const big = cytoscape({ elements: ring(1024) });
      const eles = big.elements();

      // warm the pool
      await eles.closenessCentralityNormalized({ executor: 'workers' });

      const before = _algoWorkersStats();
      const run = eles.betweennessCentrality({ weight, executor: 'workers' });

      // let the snapshot land and the first ranges start
      await tick(15);
      expect(run.cancel()).to.equal(true);

      const err = await rejection(run);

      expect(err).to.be.instanceOf(CancelledError);

      // the in-flight range answers, the rest are never posted: with
      // one worker at most one job completes after the cancel
      const drained = await eles.closenessCentralityNormalized({
        executor: 'workers',
      });
      const after = _algoWorkersStats();
      const jobsRan = after.jobs - before.jobs;
      const ranges = 64; // rangeCount(1024)

      // the cancelled run's jobs plus the closeness run's own ranges
      expect(jobsRan).to.be.below(ranges * 2);
      expect(after.workers).to.equal(1);
      expect(after.spawns).to.equal(before.spawns);

      const reference = await eles.closenessCentralityNormalized({
        executor: 'cpu',
      });

      big.nodes().forEach((node) => {
        expect(drained.closeness(node)).to.equal(reference.closeness(node));
      });

      big.destroy();
      _resetAlgoWorkers();
    });
  });

  describe('the registry and destroy()', function () {
    it('a pending run is registered and leaves on settle', async function () {
      const run = cy
        .elements()
        .betweennessCentrality({ weight, executor: 'workers' });

      expect(cy._inflight.has(run)).to.equal(true);
      await run;
      expect(cy._inflight.size).to.equal(0);
    });

    it("a 'cpu' run leaves the registry on its own microtask", async function () {
      const run = cy.elements().pageRank({ executor: 'cpu' });

      await run;
      expect(cy._inflight.size).to.equal(0);
    });

    it('destroy() cancels a pending run: the await rejects with CancelledError', async function () {
      const run = cy
        .elements()
        .betweennessCentrality({ weight, executor: 'workers' });

      cy.destroy();

      const err = await rejection(run);

      expect(err).to.be.instanceOf(CancelledError);
      expect(cy._inflight.size).to.equal(0);
      expect(run.cancel()).to.equal(false);
    });
  });

  describe('unhandled rejections', function () {
    it("the registry never attaches a handler to the caller's handle", async function () {
      // node:test fails a spec on any unhandled rejection, so the
      // property is pinned at its cause: `_trackRun` observes the settle
      // through the handle's own promise, and a `.then` on the handle
      // would be the one thing that marks a caller's rejection handled
      const run = runAlgo('cpu', 4, 0, () => 'cpu', null);
      let thens = 0;
      const then = run.then.bind(run);

      run.then = (...args) => {
        thens++;

        return then(...args);
      };

      cy._trackRun(run);
      await then();
      await tick();

      expect(thens).to.equal(0);
      expect(cy._inflight.size).to.equal(0);
    });

    it("the router's late rejection never surfaces once the caller caught the handle", async function () {
      const seen = [];
      const onUnhandled = (err) => seen.push(err);

      process.on('unhandledRejection', onUnhandled);

      try {
        const run = cy
          .elements()
          .betweennessCentrality({ weight, executor: 'workers' });

        run.cancel();
        run.catch(() => undefined);
        // the routed promise reaches its throw after the pool acquisition
        await tick(30);

        expect(seen).to.deep.equal([]);
      } finally {
        process.off('unhandledRejection', onUnhandled);
      }
    });
  });
});

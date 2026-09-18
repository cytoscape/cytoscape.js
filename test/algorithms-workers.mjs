import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  _algoWorkersStats,
  _resetAlgoWorkers,
  acquireAlgoWorkers,
  algoWorkersSupported,
  algoWorkersSize,
  rangesOf,
  WORKERS_MAX,
} from '../src/algorithms/algo-workers.mjs';
import { algoWorkerBody } from '../src/algorithms/algo-worker-body.mjs';
import { runAlgo } from '../src/algorithms/executor.mjs';
import {
  BETWEENNESS_GPU_MIN_N,
  BETWEENNESS_GPU_MIN_N_WITH_POOL,
  BETWEENNESS_WEIGHTED_WORKERS_MIN_N,
} from '../src/algorithms/betweenness-centrality.mjs';
import { _resetAlgoGpu, GpuUnfitError } from '../src/algorithms/algo-gpu.mjs';

/*
Round 74: the `'workers'` executor — parity, determinism and the guards.

What is pinned, and how tightly (the round's fact 5, derived rather
than asserted):

- **Betweenness** agrees with the CPU reference to f64 rounding, not to
  the bit: each source range's partial is exact, but summing partials in
  range order groups the additions differently from the sequential
  loop.  So the parity here is a relative tolerance at 1e-12 — a
  hundred times tighter than anything a kernel defect leaves standing
  (dropping one range moves scores by whole units; the control runs
  below prove it) and a thousand times looser than the rounding.
- **Closeness, heat and RWR** are bit-identical to the reference: each
  element is computed whole by one worker in the reference's own
  operation order.  Asserted with `===`, deliberately.
- **Pool-size independence** is exact: the partition is a function of
  n, so pools of 1, 2 and 3 workers answer identical bits.

Controls run while writing this file (2026-09-18), each restored:
skewing one range's partial by +1 turned both betweenness parity specs
red; dropping a range (parts.pop()) turned them red too — and left the
pool-size spec green, since every pool size dropped the same range,
which is why independence and parity are separate specs; flipping
`harmonic` in the closeness snapshot turned all three closeness
bit-equality specs red.  A spec that cannot go red pins nothing.

The guards are pinned here rather than in test/modules because the
throw gate reads only test/: the invalid-executor message, the
no-workers-path rejection, the unsupported-environment rejection under
a stubbed platform, and the worker body's own before-snapshot error
through a fake port.
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

const maxRelError = (a, b) => {
  let worst = 0;

  for (let i = 0; i < a.length; i++) {
    const scale = Math.max(1, Math.abs(b[i]));

    worst = Math.max(worst, Math.abs(a[i] - b[i]) / scale);
  }

  return worst;
};

describe('algorithms: the workers executor (round 74)', function () {
  var cy;
  var nodes;

  before(function () {
    // above WORKERS_MIN_N so 'auto' has a decision to make
    cy = cytoscape({ elements: ring(320) });
    nodes = cy.nodes();
  });

  after(function () {
    cy.destroy();
    _resetAlgoWorkers();
  });

  beforeEach(function () {
    // a small forced pool: the suite runs beside the runner's own
    // parallelism (the Playwright half-cores lesson in Node form)
    _resetAlgoWorkers(2);
  });

  it('Node can host the pool, and sizes it from the cores', function () {
    expect(algoWorkersSupported()).to.be.true;
    _resetAlgoWorkers();
    expect(algoWorkersSize()).to.be.within(1, WORKERS_MAX);
    _resetAlgoWorkers(3);
    expect(algoWorkersSize()).to.equal(3);
  });

  it('partitions by n alone, contiguously and completely', function () {
    for (const n of [1, 5, 63, 64, 65, 1000]) {
      const ranges = rangesOf(n);

      expect(ranges.length).to.equal(Math.min(n, 64));
      expect(ranges[0][0]).to.equal(0);
      expect(ranges[ranges.length - 1][1]).to.equal(n);

      for (let r = 1; r < ranges.length; r++) {
        expect(ranges[r][0]).to.equal(ranges[r - 1][1]);
        expect(ranges[r][1]).to.be.above(ranges[r][0]);
      }
    }
  });

  it('weighted betweenness: f64-tight to the reference, and it ran on the pool', async function () {
    const before = _algoWorkersStats();
    const cpu = await cy
      .elements()
      .betweennessCentrality({ weight, executor: 'cpu' });
    const workers = await cy
      .elements()
      .betweennessCentrality({ weight, executor: 'workers' });
    const after = _algoWorkersStats();

    expect(after.runs).to.equal(before.runs + 1);
    expect(after.workers).to.equal(2);

    const a = nodes.map((n) => workers.betweenness(n));
    const b = nodes.map((n) => cpu.betweenness(n));

    expect(maxRelError(a, b)).to.be.below(1e-12);
    expect(nodes.map((n) => workers.betweennessNormalized(n))).to.satisfy(
      (xs) => xs.every((x) => x >= 0 && x <= 1),
    );
    // the normalization is the merged maximum, so the top node reads 1
    expect(
      Math.max(...nodes.map((n) => workers.betweennessNormalized(n))),
    ).to.equal(1);
  });

  it('unweighted and directed betweenness: the same tolerance', async function () {
    for (const options of [
      {},
      { directed: true },
      { directed: true, weight },
    ]) {
      const cpu = await cy
        .elements()
        .betweennessCentrality({ ...options, executor: 'cpu' });
      const workers = await cy
        .elements()
        .betweennessCentrality({ ...options, executor: 'workers' });

      expect(
        maxRelError(
          nodes.map((n) => workers.betweenness(n)),
          nodes.map((n) => cpu.betweenness(n)),
        ),
        JSON.stringify(options),
      ).to.be.below(1e-12);
    }
  });

  it('closeness: bit-identical to the reference, harmonic and plain', async function () {
    for (const options of [{}, { harmonic: false }, { directed: true }]) {
      const cpu = await cy
        .elements()
        .closenessCentralityNormalized({ ...options, executor: 'cpu' });
      const workers = await cy
        .elements()
        .closenessCentralityNormalized({ ...options, executor: 'workers' });

      nodes.forEach((n) => {
        expect(workers.closeness(n), n.id()).to.equal(cpu.closeness(n));
      });
    }
  });

  it('closeness: a disconnected graph — plain mode zeros, harmonic partial sums — identically', async function () {
    const two = cytoscape({ elements: [...ring(300), ...ring(0)] });

    two.add([
      { data: { id: 'lonely' } },
      { data: { id: 'x' } },
      { data: { id: 'y' } },
      { data: { id: 'xy', source: 'x', target: 'y' } },
    ]);

    for (const harmonic of [true, false]) {
      const cpu = await two
        .elements()
        .closenessCentralityNormalized({ harmonic, executor: 'cpu' });
      const workers = await two
        .elements()
        .closenessCentralityNormalized({ harmonic, executor: 'workers' });

      two.nodes().forEach((n) => {
        expect(workers.closeness(n), n.id()).to.equal(cpu.closeness(n));
      });
    }

    two.destroy();
  });

  it('heatKernel: bit-identical to the reference, both Laplacians', async function () {
    for (const laplacian of ['combinatorial', 'normalized']) {
      const cpu = await cy
        .elements()
        .heatKernel({ weight, laplacian, time: 0.3, executor: 'cpu' });
      const workers = await cy
        .elements()
        .heatKernel({ weight, laplacian, time: 0.3, executor: 'workers' });

      for (let i = 0; i < 40; i++) {
        for (let j = 0; j < 40; j++) {
          expect(workers.heat(nodes[i], nodes[j])).to.equal(
            cpu.heat(nodes[i], nodes[j]),
          );
        }
      }
    }
  });

  it('randomWalkWithRestartProximity: bit-identical to the reference', async function () {
    const cpu = await cy
      .elements()
      .randomWalkWithRestartProximity({ weight, executor: 'cpu' });
    const workers = await cy
      .elements()
      .randomWalkWithRestartProximity({ weight, executor: 'workers' });

    for (let i = 0; i < 40; i++) {
      for (let j = 0; j < 40; j++) {
        expect(workers.proximity(nodes[i], nodes[j])).to.equal(
          cpu.proximity(nodes[i], nodes[j]),
        );
      }
    }
  });

  it('pools of 1, 2 and 3 workers answer identical bits', async function () {
    const runs = [];

    for (const size of [1, 2, 3]) {
      _resetAlgoWorkers(size);

      const r = await cy
        .elements()
        .betweennessCentrality({ weight, executor: 'workers' });

      expect(_algoWorkersStats().workers).to.equal(size);
      runs.push(nodes.map((n) => r.betweenness(n)));
    }

    for (const run of runs) {
      expect(run).to.deep.equal(runs[0]);
    }
  });

  it("'auto' takes the pool from the family's crossover where the GPU is absent, the CPU below", async function () {
    const before = _algoWorkersStats();

    await cy.elements().betweennessCentrality({ weight }); // n = 320 ≥ 128
    expect(_algoWorkersStats().runs).to.equal(before.runs + 1);

    const small = cytoscape({
      elements: ring(BETWEENNESS_WEIGHTED_WORKERS_MIN_N - 1),
    });

    await small.elements().betweennessCentrality({ weight });
    expect(_algoWorkersStats().runs).to.equal(before.runs + 1);
    small.destroy();
  });

  it("'auto' answers the same bits as 'workers' for the pool's families", async function () {
    const auto = await cy.elements().closenessCentralityNormalized();
    const workers = await cy
      .elements()
      .closenessCentralityNormalized({ executor: 'workers' });

    nodes.forEach((n) => {
      expect(auto.closeness(n)).to.equal(workers.closeness(n));
    });
  });

  it('a subset collection runs on the pool over its own subgraph', async function () {
    const sub = cy.nodes().slice(0, 280).closedNeighborhood();
    const cpu = await sub.closenessCentralityNormalized({ executor: 'cpu' });
    const workers = await sub.closenessCentralityNormalized({
      executor: 'workers',
    });

    sub.nodes().forEach((n) => {
      expect(workers.closeness(n)).to.equal(cpu.closeness(n));
    });
  });

  describe('the guards', function () {
    it("'workers' is a valid executor value and anything else still throws synchronously", function () {
      expect(() => cy.elements().pageRank({ executor: 'threads' })).to.throw(
        TypeError,
        /'cpu', 'gpu', 'workers' or 'auto'/,
      );
    });

    it("a family with no workers path rejects an explicit 'workers'", async function () {
      const err = await rejection(
        cy.elements().pageRank({ executor: 'workers' }),
      );

      expect(err.message).to.match(/no workers path/);

      // weighted closeness keeps Floyd–Warshall and has no lane either
      const weighted = await rejection(
        cy.elements().closenessCentralityNormalized({
          weight,
          executor: 'workers',
        }),
      );

      expect(weighted.message).to.match(/no workers path/);
    });

    it("the no-GPU-path message for weighted betweenness now names 'workers'", async function () {
      const realDescriptor = Object.getOwnPropertyDescriptor(
        globalThis,
        'navigator',
      );

      Object.defineProperty(globalThis, 'navigator', {
        value: { gpu: { requestAdapter: async () => null } },
        configurable: true,
      });

      try {
        const err = await rejection(
          cy.elements().betweennessCentrality({ weight, executor: 'gpu' }),
        );

        expect(err.message).to.match(
          /no GPU path — use executor 'cpu', 'workers' or 'auto'/,
        );
      } finally {
        if (realDescriptor != null) {
          Object.defineProperty(globalThis, 'navigator', realDescriptor);
        } else {
          delete globalThis.navigator;
        }
      }
    });

    describe('with a stubbed worker platform', function () {
      var realGetBuiltin;

      beforeEach(function () {
        realGetBuiltin = process.getBuiltinModule;
        _resetAlgoWorkers(1);
      });

      afterEach(function () {
        process.getBuiltinModule = realGetBuiltin;
        _resetAlgoWorkers();
      });

      /** A fake `worker_threads` whose Worker answers by `script`. */
      const stubPlatform = (script) => {
        process.getBuiltinModule = (id) => {
          if (id === 'node:worker_threads') {
            return {
              Worker: class {
                constructor() {
                  this.handlers = {};
                }
                on(event, handler) {
                  this.handlers[event] = handler;
                }
                ref() {}
                unref() {}
                terminate() {
                  return Promise.resolve(0);
                }
                postMessage(msg) {
                  const reply = script(msg);

                  if (reply != null) {
                    setTimeout(() => this.handlers.message?.(reply), 0);
                  }
                }
              },
            };
          }

          return realGetBuiltin.call(process, id);
        };
      };

      it("no worker platform: 'workers' rejects loudly, 'auto' runs the CPU", async function () {
        process.getBuiltinModule = () => null;
        // no browser Worker in Node either
        expect(algoWorkersSupported()).to.be.false;

        const err = await rejection(
          cy.elements().betweennessCentrality({ weight, executor: 'workers' }),
        );

        expect(err.message).to.match(/requires worker threads/);

        const before = _algoWorkersStats();
        const auto = await cy.elements().betweennessCentrality({ weight });
        const cpu = await cy
          .elements()
          .betweennessCentrality({ weight, executor: 'cpu' });

        expect(_algoWorkersStats().runs).to.equal(before.runs);

        nodes.forEach((n) => {
          expect(auto.betweenness(n)).to.equal(cpu.betweenness(n));
        });
      });

      it('a body that fails to start rejects acquisition, and is not cached', async function () {
        let pings = 0;

        stubPlatform((msg) => {
          if (msg.type === 'ping') {
            pings++;

            return { type: 'error', id: msg.id, message: 'boom at eval' };
          }

          return null;
        });

        const err = await rejection(acquireAlgoWorkers());

        expect(err.message).to.match(/failed to start: boom at eval/);

        await rejection(acquireAlgoWorkers());
        expect(pings).to.equal(2);

        // and 'auto' treats it as no pool at all: the CPU answers
        const auto = await cy.elements().betweennessCentrality({ weight });

        expect(auto.betweenness(nodes[0])).to.be.a('number');
      });

      it('a snapshot the worker rejects fails the run loudly', async function () {
        stubPlatform((msg) => {
          if (msg.type === 'ping') {
            return { type: 'pong', id: msg.id };
          }

          if (msg.type === 'snapshot') {
            return { type: 'error', id: msg.id, message: 'clone refused' };
          }

          return null;
        });

        const err = await rejection(
          cy.elements().betweennessCentrality({ weight, executor: 'workers' }),
        );

        expect(err.message).to.match(/rejected its snapshot: clone refused/);
      });

      it("a job the worker fails propagates — under 'auto' too, no silent reroute", async function () {
        stubPlatform((msg) => {
          if (msg.type === 'ping') {
            return { type: 'pong', id: msg.id };
          }

          if (msg.type === 'snapshot') {
            return { type: 'ready', id: msg.id };
          }

          return { type: 'error', id: msg.id, message: 'range exploded' };
        });

        const explicit = await rejection(
          cy.elements().betweennessCentrality({ weight, executor: 'workers' }),
        );

        expect(explicit.message).to.match(/failed a job: range exploded/);

        const auto = await rejection(
          cy.elements().betweennessCentrality({ weight }),
        );

        expect(auto.message).to.match(/failed a job/);
      });

      it('a worker error event fails the pending requests', async function () {
        process.getBuiltinModule = (id) => {
          if (id === 'node:worker_threads') {
            return {
              Worker: class {
                on(event, handler) {
                  if (event === 'error') {
                    setTimeout(() => handler(new Error('thread died')), 0);
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

        const err = await rejection(acquireAlgoWorkers());

        expect(err.message).to.match(/failed to start: thread died/);
      });
    });

    describe("the three-way 'auto' ordering, with a stubbed adapter", function () {
      var realDescriptor;

      beforeEach(function () {
        realDescriptor = Object.getOwnPropertyDescriptor(
          globalThis,
          'navigator',
        );
        _resetAlgoGpu();
        // a working adapter, as test/algorithms-executor.mjs stubs it
        Object.defineProperty(globalThis, 'navigator', {
          value: {
            gpu: {
              requestAdapter: async () => ({
                requestDevice: async () => ({ lost: new Promise(() => {}) }),
              }),
            },
          },
          configurable: true,
        });
      });

      afterEach(function () {
        if (realDescriptor != null) {
          Object.defineProperty(globalThis, 'navigator', realDescriptor);
        } else {
          delete globalThis.navigator;
        }

        _resetAlgoGpu();
      });

      const lanes = (first) => [
        () => 'cpu',
        async () => 'gpu',
        undefined,
        { minN: 256, first, run: async () => 'workers' },
      ];

      it('the GPU precedes the pool by default', async function () {
        expect(await runAlgo('auto', 1000, 256, ...lanes(false))).to.equal(
          'gpu',
        );
        expect(await runAlgo('auto', 1000, 256, ...lanes(undefined))).to.equal(
          'gpu',
        );
      });

      it('a `first` lane precedes a present GPU (the sparse closeness BFS)', async function () {
        expect(await runAlgo('auto', 1000, 256, ...lanes(true))).to.equal(
          'workers',
        );
      });

      it('a `first` lane below its crossover leaves the GPU in place', async function () {
        expect(await runAlgo('auto', 100, 50, ...lanes(true))).to.equal('gpu');
      });

      it('a `first` lane whose pool cannot spawn falls to the GPU, not the CPU', async function () {
        const realGetBuiltin = process.getBuiltinModule;

        process.getBuiltinModule = () => null;

        try {
          expect(await runAlgo('auto', 1000, 256, ...lanes(true))).to.equal(
            'gpu',
          );
        } finally {
          process.getBuiltinModule = realGetBuiltin;
        }
      });

      it('the pool takes over where the GPU lane is unfit', async function () {
        const out = await runAlgo(
          'auto',
          1000,
          256,
          () => 'cpu',
          async () => {
            throw new GpuUnfitError('too big');
          },
          undefined,
          { minN: 256, run: async () => 'workers' },
        );

        expect(out).to.equal('workers');
      });

      it('unweighted betweenness: the GPU crossover moves to 1024 where a pool can exist', function () {
        expect(BETWEENNESS_GPU_MIN_N).to.equal(512);
        expect(BETWEENNESS_GPU_MIN_N_WITH_POOL).to.equal(1024);
        expect(algoWorkersSupported()).to.be.true;
      });
    });

    it('runAlgo: an explicit workers lane answers through the pool', async function () {
      const out = await runAlgo(
        'workers',
        10,
        Infinity,
        () => 'cpu',
        null,
        undefined,
        { minN: Infinity, run: async (pool) => `pool of ${pool.size}` },
      );

      expect(out).to.equal('pool of 2');
    });

    it('the body refuses a job before its snapshot, through the port', function () {
      const replies = [];

      algoWorkerBody({
        on(handler) {
          handler({ type: 'ping', id: 1 });
          handler({ type: 'job', id: 2, s0: 0, s1: 1 });
        },
        post(msg) {
          replies.push(msg);
        },
      });

      expect(replies[0]).to.deep.equal({ type: 'pong', id: 1 });
      expect(replies[1].type).to.equal('error');
      expect(replies[1].message).to.match(/before its snapshot/);
    });

    it('the body refuses a snapshot kind it does not know, through the port', function () {
      const replies = [];

      algoWorkerBody({
        on(handler) {
          handler({
            type: 'snapshot',
            id: 1,
            snapshot: { kind: 'nope', n: 1 },
          });
          handler({ type: 'job', id: 2, s0: 0, s1: 1 });
        },
        post(msg) {
          replies.push(msg);
        },
      });

      expect(replies[0]).to.deep.equal({ type: 'ready', id: 1 });
      expect(replies[1].type).to.equal('error');
      expect(replies[1].message).to.match(/unknown snapshot kind: nope/);
    });
  });
});

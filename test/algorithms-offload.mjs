import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  _algoWorkersStats,
  _resetAlgoWorkers,
  acquireAlgoWorkers,
} from '../src/algorithms/algo-workers.mjs';
import { CancelledError } from '../src/algorithms/cancel.mjs';
import {
  PAGE_RANK_OFFLOAD_MIN_N,
  pageRankLane,
} from '../src/algorithms/page-rank.mjs';
import { KATZ_OFFLOAD_MIN_N } from '../src/algorithms/katz-centrality.mjs';
import { FLOYD_WARSHALL_OFFLOAD_MIN_N } from '../src/algorithms/floyd-warshall.mjs';
import {
  ALGO_KERNELS,
  runKernelInThread,
} from '../src/algorithms/algo-kernels.mjs';
import { algoWorkerBody } from '../src/algorithms/algo-worker-body.mjs';

/*
Round 129.1: the offload lane — one pool worker for the whole-graph
families the pool cannot partition, so the calling thread stays free.

What is pinned, and how tightly: **bit-identical**, asserted with
`===` on every score for every family.  Not a tolerance: the in-thread
`'cpu'` path and the worker run the very same kernel function (the
pool carries its source text), so a difference of one ulp would mean
two implementations exist, which is the thing the design forbids.

The lane's placement is pinned through the pool's counters: a `'cpu'`
run leaves the pool untouched, an `'auto'` run at or above the
family's `offloadMinN` adds one `offloads`, a run below it adds none,
and an explicit `'workers'` on such a family runs the lane (it
rejected through round 128).  Lazy spawn (129.1): an offload-only
session holds one worker, and the first whole-pool run grows it.

Controls run while writing this file (2026-09-18), each restored:
scaling the pageRank kernel's ranks by 1 + 1e-15 turned the pageRank
bit-equality spec red (and left the round-65 tolerance specs green —
which is why `===` is the assertion here); dropping `stats.offloads++`
turned every placement spec red; posting the kernel job without the
`throwIfCancelled` before it turned the cancel-while-queued spec red.
*/

const ring = (n, chords = 3, directedWeights = false) => {
  const els = [];

  for (let i = 0; i < n; i++) {
    els.push({ data: { id: 'n' + i, a: (i * 7) % 11, b: (i * 3) % 5 } });
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

    for (let c = 1; c <= chords; c++) {
      if (i % (c + 2) === 0) {
        els.push({
          data: {
            id: `c${c}_${i}`,
            source: 'n' + i,
            target: 'n' + ((i * 13 + 29 * c) % n),
            w: 2 + ((i + c) % 3),
          },
        });
      }
    }
  }

  void directedWeights;

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

describe('algorithms: the offload lane (round 129.1)', function () {
  let cy;
  let nodes;

  before(function () {
    _resetAlgoWorkers(2);
  });

  after(function () {
    _resetAlgoWorkers();
  });

  beforeEach(function () {
    cy = cytoscape({ elements: ring(160) });
    nodes = cy.nodes().toArray();
  });

  afterEach(function () {
    cy.destroy();
  });

  /** every score of `cpu` equals `workers`, bit for bit */
  const same = (read, cpu, workers) => {
    let compared = 0;

    for (const a of nodes) {
      for (const b of nodes.slice(0, 12)) {
        const x = read(cpu, a, b);
        const y = read(workers, a, b);

        expect(y, `${a.id()} ${b.id()}`).to.equal(x);
        compared++;
      }
    }

    expect(compared).to.be.greaterThan(0);
  };

  describe('bit-identical to the in-thread reference, per family', function () {
    const families = [
      [
        'pageRank',
        (o) => cy.elements().pageRank({ weight, ...o }),
        (r, a) => r.rank(a),
      ],
      [
        'katzCentrality',
        (o) => cy.elements().katzCentrality({ weight, alpha: 0.05, ...o }),
        (r, a) => r.katz(a),
      ],
      [
        'floydWarshall',
        (o) => cy.elements().floydWarshall({ weight, ...o }),
        (r, a, b) => r.distance(a, b),
      ],
      [
        'closenessCentralityNormalized (weighted)',
        (o) => cy.elements().closenessCentralityNormalized({ weight, ...o }),
        (r, a) => r.closeness(a),
      ],
      [
        'triangleCount',
        (o) => cy.elements().triangleCount(o),
        (r, a) => r.clusteringCoefficient(a),
      ],
      [
        'neighborhoodSimilarity',
        (o) =>
          cy.elements().neighborhoodSimilarity({ metric: 'jaccard', ...o }),
        (r, a, b) => r.similarity(a, b),
      ],
      [
        'motifCensus',
        (o) => cy.elements().motifCensus(o),
        (r, a, b) => r.counts['030T'] + r.counts['300'] * 1e6 + r.counts['012'],
      ],
      [
        'simRank',
        (o) =>
          cy.elements().simRank({ dampingFactor: 0.7, maxIterations: 8, ...o }),
        (r, a, b) => r.similarity(a, b),
      ],
      [
        'effectiveResistance',
        (o) => cy.elements().effectiveResistance({ weight, ...o }),
        (r, a, b) => r.resistance(a, b),
      ],
    ];

    for (const [name, run, read] of families) {
      it(name, async function () {
        const cpu = await run({ executor: 'cpu' });
        const before = _algoWorkersStats();
        const workers = await run({ executor: 'workers' });

        expect(_algoWorkersStats().offloads).to.equal(before.offloads + 1);
        same(read, cpu, workers);
      });
    }

    it('markovClustering: the same partition', async function () {
      const key = (clusters) =>
        clusters
          .map((c) =>
            c
              .map((n) => n.id())
              .sort()
              .join(','),
          )
          .sort();
      const cpu = await cy
        .elements()
        .markovClustering({ attributes: [weight], executor: 'cpu' });
      const workers = await cy
        .elements()
        .markovClustering({ attributes: [weight], executor: 'workers' });

      expect(key(workers)).to.deep.equal(key(cpu));
      expect(cpu.length).to.be.greaterThan(1);
    });

    it('affinityPropagation: the same exemplars, with a custom distance evaluated on this thread', async function () {
      const key = (clusters) =>
        clusters
          .map((c) =>
            c
              .map((n) => n.id())
              .sort()
              .join(','),
          )
          .sort();
      const options = {
        damping: 0.8,
        preference: 'median',
        attributes: [(n) => n.data('a'), (n) => n.data('b')],
        distance: (len, getP, getQ) => {
          let d = 0;

          for (let k = 0; k < len; k++) {
            d += Math.abs(getP(k) - getQ(k)) * (k + 1);
          }

          return d;
        },
      };
      const cpu = await cy
        .nodes()
        .affinityPropagation({ ...options, executor: 'cpu' });
      const workers = await cy
        .nodes()
        .affinityPropagation({ ...options, executor: 'workers' });

      expect(key(workers)).to.deep.equal(key(cpu));
      expect(cpu.length).to.be.greaterThan(1);
    });
  });

  describe("where 'auto' puts the lane", function () {
    it("a 'cpu' run leaves the pool untouched", async function () {
      const before = _algoWorkersStats();

      await cy.elements().floydWarshall({ executor: 'cpu' });

      expect(_algoWorkersStats()).to.deep.equal(before);
    });

    it("'auto' offloads at the family's crossover and stays in-thread below it", async function () {
      expect(nodes.length).to.be.at.least(FLOYD_WARSHALL_OFFLOAD_MIN_N);

      const before = _algoWorkersStats();

      await cy.elements().floydWarshall();
      expect(_algoWorkersStats().offloads).to.equal(before.offloads + 1);

      // a subset below the crossover runs in-thread — and completes
      // inside the call, the round-128 contract
      const small = cy.nodes().slice(0, FLOYD_WARSHALL_OFFLOAD_MIN_N - 1);
      const run = small.floydWarshall();

      expect(run.cancel()).to.equal(false);
      await run;
      expect(_algoWorkersStats().offloads).to.equal(before.offloads + 1);
    });

    it('pageRank and Katz open the lane late: in-thread at this size', async function () {
      expect(nodes.length).to.be.below(PAGE_RANK_OFFLOAD_MIN_N);
      expect(nodes.length).to.be.below(KATZ_OFFLOAD_MIN_N);

      const before = _algoWorkersStats();

      await cy.elements().pageRank();
      await cy.elements().katzCentrality({ alpha: 0.05 });
      expect(_algoWorkersStats().offloads).to.equal(before.offloads);
    });

    it("an explicit 'workers' on an offload family runs the lane, with the same bits as 'auto'", async function () {
      const explicit = await cy.elements().simRank({ executor: 'workers' });
      const auto = await cy.elements().simRank();

      same((r, a, b) => r.similarity(a, b), explicit, auto);
    });

    it('the pool spawns lazily: one worker for offloads, the size for a whole-pool run', async function () {
      _resetAlgoWorkers(2);
      expect(_algoWorkersStats().workers).to.equal(0);

      await cy.elements().floydWarshall({ executor: 'workers' });
      expect(_algoWorkersStats().workers).to.equal(1);

      await cy
        .elements()
        .closenessCentralityNormalized({ executor: 'workers' });
      expect(_algoWorkersStats().workers).to.equal(2);
    });

    it('two offloads in flight take two workers, and interleave', async function () {
      _resetAlgoWorkers(2);

      const before = _algoWorkersStats();
      const [a, b] = await Promise.all([
        cy.elements().floydWarshall({ executor: 'workers' }),
        cy.elements().simRank({ executor: 'workers', maxIterations: 8 }),
      ]);

      expect(a.distance(nodes[0], nodes[3])).to.be.a('number');
      expect(b.similarity(nodes[0], nodes[3])).to.be.a('number');
      expect(_algoWorkersStats().offloads).to.equal(before.offloads + 2);
      expect(_algoWorkersStats().workers).to.equal(2);
    });
  });

  describe('cancellation (round 128) through the lane', function () {
    it('cancelled while queued: the kernel never posts, the pool stands', async function () {
      const before = _algoWorkersStats();
      const run = cy.elements().floydWarshall({ executor: 'workers' });

      expect(run.cancel()).to.equal(true);

      const err = await rejection(run);

      expect(err).to.be.instanceOf(CancelledError);

      const after = _algoWorkersStats();

      expect(after.offloads).to.equal(before.offloads);
      expect(after.spawns).to.equal(before.spawns);
    });

    it('cancelled mid-run: the answer is dropped, and the next run answers the reference bits', async function () {
      const pool = await acquireAlgoWorkers();

      void pool;

      const run = cy.elements().floydWarshall({ executor: 'workers' });

      // past the acquisition and the queue: the snapshot is on its way
      await new Promise((r) => setTimeout(r, 2));
      expect(run.cancel()).to.equal(true);

      const err = await rejection(run);

      expect(err).to.be.instanceOf(CancelledError);

      const cpu = await cy.elements().floydWarshall({ executor: 'cpu' });
      const again = await cy.elements().floydWarshall({ executor: 'workers' });

      same((r, a, b) => r.distance(a, b), cpu, again);
    });
  });

  describe('the guards, through the port and a stubbed platform', function () {
    /** drive the body with `kernels` through a fake port */
    const drive = (messages, kernels = ALGO_KERNELS) => {
      const replies = [];

      algoWorkerBody(
        {
          on(handler) {
            for (const msg of messages) {
              handler(msg);
            }
          },
          post(msg) {
            replies.push(msg);
          },
        },
        kernels,
      );

      return replies;
    };
    const kernelSnapshot = {
      kind: 'kernel',
      name: 'resistance',
      input: { n: 1, b: Float64Array.from([2]) },
    };

    it('a kernel job before its snapshot', function () {
      const replies = drive([{ type: 'kernel', id: 1 }]);

      expect(replies[0].type).to.equal('error');
      expect(replies[0].message).to.match(
        /kernel job arrived before its snapshot/,
      );
    });

    it('a kernel job on a range snapshot, and a range job on a kernel snapshot', function () {
      const rowPtr = Int32Array.from([0, 0]);
      const colIdx = new Int32Array(0);
      const replies = drive([
        {
          type: 'snapshot',
          id: 1,
          snapshot: { kind: 'closeness', n: 1, rowPtr, colIdx, harmonic: true },
        },
        { type: 'kernel', id: 2 },
        { type: 'snapshot', id: 3, snapshot: kernelSnapshot },
        { type: 'job', id: 4, s0: 0, s1: 1 },
      ]);

      expect(replies[1].type).to.equal('error');
      expect(replies[1].message).to.match(
        /kernel job arrived on a range snapshot/,
      );
      expect(replies[3].type).to.equal('error');
      expect(replies[3].message).to.match(
        /range job arrived on a kernel snapshot/,
      );
    });

    it('a kernel the registry lacks', function () {
      const replies = drive([
        {
          type: 'snapshot',
          id: 1,
          snapshot: { kind: 'kernel', name: 'nope', input: {} },
        },
        { type: 'kernel', id: 2 },
      ]);

      expect(replies[1].type).to.equal('error');
      expect(replies[1].message).to.match(/unknown kernel: nope/);
    });

    it('a kernel run answers with every typed array transferred', function () {
      const transfers = [];
      const replies = [];

      algoWorkerBody(
        {
          on(handler) {
            handler({ type: 'snapshot', id: 1, snapshot: kernelSnapshot });
            handler({ type: 'kernel', id: 2 });
          },
          post(msg, transfer) {
            replies.push(msg);
            transfers.push(transfer);
          },
        },
        ALGO_KERNELS,
      );

      expect(replies[1].type).to.equal('result');
      expect(Array.from(replies[1].out.inv)).to.deep.equal([0.5]);
      expect(transfers[1]).to.have.length(1);
      expect(transfers[1][0]).to.equal(replies[1].out.inv.buffer);
    });

    describe('with a stubbed worker platform', function () {
      let realGetBuiltin;

      beforeEach(function () {
        realGetBuiltin = process.getBuiltinModule;
        _resetAlgoWorkers(1);
      });

      afterEach(function () {
        process.getBuiltinModule = realGetBuiltin;
        _resetAlgoWorkers(2);
      });

      /** a fake `worker_threads` whose Worker answers by `script` */
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

      it('a snapshot the worker rejects fails the offload loudly', async function () {
        stubPlatform((msg) =>
          msg.type === 'ping'
            ? { type: 'pong', id: msg.id }
            : { type: 'error', id: msg.id, message: 'clone refused' },
        );

        const err = await rejection(
          cy.elements().floydWarshall({ executor: 'workers' }),
        );

        expect(err.message).to.match(/rejected its snapshot: clone refused/);
      });

      it("a kernel the worker fails propagates — under 'auto' too, no silent reroute", async function () {
        stubPlatform((msg) => {
          if (msg.type === 'ping') {
            return { type: 'pong', id: msg.id };
          }

          if (msg.type === 'snapshot') {
            return { type: 'ready', id: msg.id };
          }

          return { type: 'error', id: msg.id, message: 'kernel exploded' };
        });

        const explicit = await rejection(
          cy.elements().floydWarshall({ executor: 'workers' }),
        );

        expect(explicit.message).to.match(/failed a kernel: kernel exploded/);

        const auto = await rejection(cy.elements().floydWarshall());

        expect(auto.message).to.match(/failed a kernel/);
      });
    });
  });

  describe('the lane is the reference', function () {
    it("a family's lane answers the same object shape in-thread as its kernel does", function () {
      const lane = pageRankLane(cy.elements(), { weight });
      const out = runKernelInThread(lane.snapshot());

      expect(out.ranks).to.be.instanceOf(Float64Array);
      expect(out.ranks.length).to.equal(nodes.length);

      const result = lane.wrap(out);

      expect(result.rank(nodes[0])).to.equal(out.ranks[0]);
    });
  });
});

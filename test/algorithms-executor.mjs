import { expect } from 'chai';
import cytoscape from '../src/index.mjs';
import {
  acquireAlgoGpu,
  algoGpuSupported,
  assertFits,
  GpuUnfitError,
  _resetAlgoGpu,
} from '../src/algorithms/algo-gpu.mjs';
import { runAlgo } from '../src/algorithms/executor.mjs';
import { kMedoidsGpu } from '../src/algorithms/algo-gpu-cluster.mjs';

// Round 65: the expensive whole-graph algorithms are async, with an
// `executor` option ('cpu' | 'gpu' | 'auto').  These specs pin the
// routing contract in Node — where WebGPU never exists — plus the
// stubbed-navigator paths, so every executor guard fires
// deterministically in the Node tier (the throw gate's requirement).
describe('gpu/algorithms: the executor contract', function () {
  var cy;
  var kOptions = () => ({
    k: 2,
    maxIterations: 10,
    attributes: [(node) => node.data('v')],
    testMode: true,
    testCentroids: [[0], [10]],
  });

  var rejection = (promise) =>
    promise.then(
      () => {
        throw new Error('expected the promise to reject');
      },
      (err) => err,
    );

  beforeEach(function () {
    cy = cytoscape({
      elements: [
        { data: { id: 'a', v: 0 } },
        { data: { id: 'b', v: 1 } },
        { data: { id: 'c', v: 9 } },
        { data: { id: 'd', v: 10 } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
        { data: { id: 'cd', source: 'c', target: 'd' } },
      ],
    });
  });

  it('an invalid executor throws synchronously, not as a rejection', function () {
    // the one validation that happens before the promise exists: the
    // call site gets a TypeError, not an unhandled rejection later
    expect(() =>
      cy.elements().kMeans({ ...kOptions(), executor: 'tpu' }),
    ).to.throw(TypeError, /executor/);
    expect(() => cy.elements().pageRank({ executor: 42 })).to.throw(
      TypeError,
      /executor/,
    );
  });

  it("executor 'cpu' resolves with the reference result", async function () {
    var clusters = await cy
      .elements()
      .kMeans({ ...kOptions(), executor: 'cpu' });

    expect(clusters.length).to.equal(2);
    expect(clusters[0].map((n) => n.id())).to.deep.equal(['a', 'b']);
    expect(clusters[1].map((n) => n.id())).to.deep.equal(['c', 'd']);
  });

  it("executor 'auto' matches 'cpu' where WebGPU is absent", async function () {
    var auto = await cy.elements().kMeans({ ...kOptions(), executor: 'auto' });
    var cpu = await cy.elements().kMeans({ ...kOptions(), executor: 'cpu' });

    expect(auto.length).to.equal(cpu.length);

    for (var i = 0; i < auto.length; i++) {
      expect(auto[i].same(cpu[i])).to.be.true;
    }
  });

  it("executor 'gpu' rejects where WebGPU is absent", async function () {
    expect(algoGpuSupported()).to.be.false; // the Node tier's invariant

    var err = await rejection(cy.elements().pageRank({ executor: 'gpu' }));

    expect(err.message).to.match(/requires WebGPU/);
  });

  it('every async algorithm rejects the same way in Node', async function () {
    var eles = cy.elements();
    var calls = [
      eles.markovClustering({ executor: 'gpu' }),
      eles.affinityPropagation({
        executor: 'gpu',
        damping: 0.8,
        preference: 'median',
        attributes: [(n) => n.data('v')],
      }),
      eles.floydWarshall({ executor: 'gpu' }),
      eles.betweennessCentrality({ executor: 'gpu' }),
      eles.kMedoids({ ...kOptions(), executor: 'gpu' }),
      eles.fuzzyCMeans({ ...kOptions(), executor: 'gpu' }),
      eles.hierarchicalClustering({
        executor: 'gpu',
        attributes: [(n) => n.data('v')],
      }),
    ];

    for (var call of calls) {
      expect((await rejection(call)).message).to.match(/requires WebGPU/);
    }
  });

  describe('with a stubbed `navigator.gpu`', function () {
    var realDescriptor;

    beforeEach(function () {
      realDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
      _resetAlgoGpu();
    });

    afterEach(function () {
      if (realDescriptor != null) {
        Object.defineProperty(globalThis, 'navigator', realDescriptor);
      } else {
        delete globalThis.navigator;
      }

      _resetAlgoGpu();
    });

    var stubNavigator = (gpu) => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { gpu },
        configurable: true,
      });
    };

    it('a null adapter rejects acquisition with a clear message', async function () {
      stubNavigator({ requestAdapter: async () => null });

      var err = await rejection(acquireAlgoGpu());

      expect(err.message).to.match(/no adapter could be acquired/);
    });

    it('acquisition failure is not cached: a later attempt retries', async function () {
      var calls = 0;

      stubNavigator({
        requestAdapter: async () => {
          calls++;
          return null;
        },
      });

      await rejection(acquireAlgoGpu());
      await rejection(acquireAlgoGpu());

      expect(calls).to.equal(2);
    });

    it("an option combination with no GPU path rejects under executor 'gpu'", async function () {
      stubNavigator({ requestAdapter: async () => null });

      // weighted betweenness never has a kernel path; the no-path guard
      // fires before any adapter is requested
      var err = await rejection(
        cy.elements().betweennessCentrality({
          executor: 'gpu',
          weight: () => 1,
        }),
      );

      expect(err.message).to.match(/no GPU path/);
    });

    it("executor 'auto' falls back to the CPU when no adapter is acquirable", async function () {
      stubNavigator({ requestAdapter: async () => null });

      // above the size threshold, with a GPU path, but no adapter: the
      // router must answer via the reference implementation
      var ran = await runAlgo(
        'auto',
        10_000,
        256,
        () => 'cpu',
        async () => 'gpu',
      );

      expect(ran).to.equal('cpu');
    });

    var workingStub = () =>
      stubNavigator({
        requestAdapter: async () => ({
          requestDevice: async () => ({ lost: new Promise(() => {}) }),
        }),
      });

    it("executor 'auto' routes to the GPU above the size threshold", async function () {
      workingStub();

      var ran = await runAlgo(
        'auto',
        10_000,
        256,
        () => 'cpu',
        async (ctx) => (ctx.device != null ? 'gpu' : 'gpu-no-device'),
      );

      expect(ran).to.equal('gpu');
    });

    it("executor 'auto' stays on the CPU below the size threshold", async function () {
      workingStub();

      var ran = await runAlgo(
        'auto',
        10,
        256,
        () => 'cpu',
        async () => 'gpu',
      );

      expect(ran).to.equal('cpu');
    });

    it("an explicit 'gpu' ignores the size threshold", async function () {
      workingStub();

      var ran = await runAlgo(
        'gpu',
        10,
        256,
        () => 'cpu',
        async () => 'gpu',
      );

      expect(ran).to.equal('gpu');
    });

    it("a kernel failure under 'auto' propagates — no silent reroute", async function () {
      workingStub();

      var err = await rejection(
        runAlgo(
          'auto',
          10_000,
          256,
          () => 'cpu',
          async () => {
            throw new Error('kernel defect');
          },
        ),
      );

      expect(err.message).to.equal('kernel defect');
    });

    it('acquireAlgoGpu rejects where `navigator.gpu` is missing', async function () {
      stubNavigator(undefined);

      var err = await rejection(acquireAlgoGpu());

      expect(err.message).to.match(/WebGPU is required/);
    });

    // a ctx whose device admits only tiny storage bindings
    var tinyCtx = () => ({
      device: { limits: { maxStorageBufferBindingSize: 1024 } },
      pipelines: new Map(),
    });

    it('assertFits throws GpuUnfitError past the binding limit', function () {
      expect(() => assertFits(tinyCtx(), 4096, 'markovClustering')).to.throw(
        GpuUnfitError,
        /exceeds this device/,
      );

      // control: a fitting size passes
      assertFits(tinyCtx(), 512, 'markovClustering');
    });

    it("an unfit input under 'auto' falls back to the CPU; under 'gpu' it propagates", async function () {
      workingStub(); // 'auto' must actually reach the GPU branch

      var unfitGpu = async () => {
        throw new GpuUnfitError('too big');
      };

      var auto = await runAlgo('auto', 10_000, 256, () => 'cpu', unfitGpu);

      expect(auto).to.equal('cpu');

      var err = await rejection(
        runAlgo('gpu', 10_000, 256, () => 'cpu', unfitGpu),
      );

      expect(err).to.be.instanceOf(GpuUnfitError);
    });

    it('the GPU k-medoids guard rejects k past the node count before any device work', async function () {
      // the k > n guard fires before the ctx is touched, so it is
      // Node-reachable with no device at all
      var err = await rejection(
        kMedoidsGpu(tinyCtx(), cy.elements(), {
          k: 99,
          attributes: [(n) => n.data('v')],
        }),
      );

      expect(err.message).to.match(/cannot exceed the number of nodes/);
    });
  });
});

import { expect } from 'chai';
import cytoscape from '../src/headless.mjs';
import { gpuRuntime } from '../src/algorithms/gpu-registry.mjs';

// Round 131: the `cytoscape/headless` entry, from source.  This file
// imports that entry and nothing that registers a GPU runtime, so the
// process sees exactly the build's registry (node:test runs each spec
// file in its own process).  The built bundle gets the same checks from
// the runtime smoke and the isolate smoke.
describe('cytoscape/headless (round 131)', function () {
  var rejection = (promise) =>
    promise.then(
      () => {
        throw new Error('expected the promise to reject');
      },
      (err) => err,
    );

  var NO_RENDERER = "this build has no renderer — import 'cytoscape'";
  var NO_GPU =
    "this build has no GPU executors — import 'cytoscape/headless-gpu' or " +
    "'cytoscape'";

  it('builds a working headless core', async function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
      layout: { name: 'grid' },
    });

    expect(cy.headless()).to.equal(true);
    expect(cy.nodes().length).to.equal(2);

    var ranks = await cy.elements().pageRank({ iterations: 5 });

    expect(ranks.rank(cy.$id('b'))).to.be.greaterThan(ranks.rank(cy.$id('a')));
  });

  it('carries the statics, but not the render worker entry', function () {
    expect(cytoscape.serializeElements).to.be.a('function');
    expect(cytoscape.deserializeElements).to.be.a('function');
    expect(cytoscape.toColumnarElements).to.be.a('function');
    expect(cytoscape.CancelledError).to.be.a('function');
    expect(cytoscape.__runForceSimWorker__).to.be.a('function');
    expect(cytoscape.__algoWorkerSource__).to.be.a('function');
    expect(cytoscape.__runRenderWorker__).to.equal(undefined);
  });

  it('registers no GPU runtime', function () {
    expect(gpuRuntime()).to.equal(null);
  });

  it("a container throws the build's message before any work", function () {
    // before any work: a payload that would itself throw during ingest
    // must not win over the container error (the full build's rule,
    // test/core-api.mjs)
    var badEdge = [{ group: 'edges', data: { id: 'e' } }];

    expect(() => cytoscape({ container: {}, elements: badEdge })).to.throw(
      NO_RENDERER,
    );

    // control: with no container the same payload reaches ingest
    expect(() => cytoscape({ elements: badEdge })).to.throw(
      /without a source and target/,
    );
  });

  it("mount() throws the build's message and leaves the instance headless", function () {
    var cy = cytoscape({});

    expect(() => cy.mount({})).to.throw(NO_RENDERER);
    expect(cy.headless()).to.equal(true);
    expect(cy.container()).to.equal(null);
  });

  it("an explicit 'gpu' algorithm rejects with the build's message; 'auto' runs", async function () {
    var cy = cytoscape({
      elements: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
    });
    var err = await rejection(cy.elements().pageRank({ executor: 'gpu' }));

    expect(err.message).to.equal(NO_GPU);

    var ranks = await cy.elements().pageRank({ executor: 'auto' });

    expect(ranks.rank(cy.$id('a'))).to.be.closeTo(0.5, 1e-9);
  });

  it("an explicit force 'gpu' names the build", function () {
    var cy = cytoscape({
      elements: [
        { data: { id: 'a' } },
        { data: { id: 'b' } },
        { data: { id: 'ab', source: 'a', target: 'b' } },
      ],
    });

    expect(() => cy.layout({ name: 'force', executor: 'gpu' }).run()).to.throw(
      "force layout: executor 'gpu' needs the GPU integrator — " + NO_GPU,
    );
    expect(cy._forceHost).to.equal(null);
    cy.destroy();
  });
});

import { expect } from 'chai';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import cytoscape from '../src/headless.mjs';

// Round 131: the `cytoscape/headless` entry, from source.  The registry
// checks run in a child process (test/lib/headless-registry-probe.mjs)
// that imports this entry and nothing else: a runner that shares one
// process between spec files — plain `bun test` does — has the full
// build's GPU runtime registered by then.  The built bundle gets the same
// checks from the runtime smoke and the isolate smoke.
const PROBE = fileURLToPath(
  new URL('./lib/headless-registry-probe.mjs', import.meta.url),
);
const probe = () =>
  JSON.parse(
    execFileSync(
      process.execPath,
      process.versions.bun == null ? ['--import', 'tsx', PROBE] : [PROBE],
      { encoding: 'utf8' },
    ),
  );
describe('cytoscape/headless (round 131)', function () {
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
    expect(cytoscape.GpuUnfitError).to.be.a('function');
    expect(cytoscape.__runForceSimWorker__).to.be.a('function');
    expect(cytoscape.__algoWorkerSource__).to.be.a('function');
    expect(cytoscape.__runRenderWorker__).to.equal(undefined);
  });

  it('registers no GPU runtime', function () {
    expect(probe().gpuRuntime).to.equal(null);
  });

  it("a container throws the build's message before any work", function () {
    // before any work: a payload that would itself throw during ingest
    // must not win over the container error (the full build's rule,
    // test/core-api.test.mjs)
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

  it("an explicit 'gpu' algorithm rejects with the build's message; 'auto' runs", function () {
    var result = probe();

    expect(result.gpuMessage).to.equal(NO_GPU);
    expect(result.autoRank).to.be.closeTo(0.5, 1e-9);
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

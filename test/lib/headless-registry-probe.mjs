// Run in a fresh process by test/headless-entry.test.mjs: imports the
// `cytoscape/headless` entry and nothing that registers a GPU runtime, so
// the registry it reports is exactly the build's — whatever else the
// spawning runner has loaded into its own process.
import cytoscape from '../../src/headless.mjs';
import { gpuRuntime } from '../../src/algorithms/gpu-registry.mjs';

const cy = cytoscape({
  elements: [{ data: { id: 'a' } }, { data: { id: 'b' } }],
});
let gpuMessage = null;

try {
  await cy.elements().pageRank({ executor: 'gpu' });
} catch (err) {
  gpuMessage = err.message;
}

const auto = await cy.elements().pageRank({ executor: 'auto' });

process.stdout.write(
  JSON.stringify({
    gpuRuntime: gpuRuntime(),
    gpuMessage,
    autoRank: auto.rank(cy.$id('a')),
  }),
);

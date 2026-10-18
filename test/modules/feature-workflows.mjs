import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createContext, runInContext } from 'node:vm';
import { EASING_NAMES } from '../../src/easing.mjs';
import cytoscape from '../../src/index.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const nodeRequire = createRequire(import.meta.url);
const commonJSWorkflows = nodeRequire('../../debug/feature-workflows.js');
const sources = [
  'workflow-ui.js',
  'workflow-algorithms.js',
  'workflow-panels.js',
  'workflow-visual-panels.js',
  'workflow-runtime-panels.js',
  'feature-workflows.js',
].map((name) => readFileSync(join(ROOT, 'debug', name), 'utf8'));
const fixtureSource = readFileSync(join(ROOT, 'debug/fixtures.js'), 'utf8');
const context = createContext({
  module: { exports: {} },
  cytoscape,
  URL,
  clearInterval,
  clearTimeout,
  console,
  setInterval,
  setTimeout,
});

sources.forEach((source) => runInContext(source, context));

const workflows = context.module.exports;
const fixtureContext = createContext({
  module: { exports: {} },
  TextDecoder,
  console,
});

runInContext(fixtureSource, fixtureContext);

const fixtureGenerator = fixtureContext.module.exports;
const workflowFixture = fixtureGenerator.generate('workflow-demo', '200x400');
const makeCy = () =>
  cytoscape({
    headless: true,
    elements: {
      nodes: workflowFixture.nodes,
      edges: workflowFixture.edges,
    },
  });

const run = async (cy, operation, selections = { root: 'b', goal: 'd' }) => {
  const execution = workflows.runAlgorithm(cy, operation, 'cpu', selections);

  if (execution.result != null && typeof execution.result.then === 'function') {
    execution.result = await execution.result;
  }

  return execution;
};

const normalize = (value) => {
  if (ArrayBuffer.isView(value)) return Array.from(value, normalize);
  if (Array.isArray(value)) return value.map(normalize);
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalize(value[key])]),
    );
  }

  return value;
};

describe('debug stateful and numeric workflow module (round 149)', function () {
  it('gives workflow fields an explicit accessible name matching the visible label', function () {
    const control = {
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
    };
    const document = {
      createElement(tagName) {
        return {
          tagName,
          append() {},
          setAttribute(name, value) {
            this[name] = value;
          },
        };
      },
    };

    context.featureWorkflowUI.field(document, 'Workflow', control);

    expect(control.attributes['aria-label']).to.equal('Workflow');
  });

  it('exports stable scene metadata and a non-empty coverage row for each audited family', function () {
    expect(workflows.scenes.map((scene) => scene.id)).to.deep.equal([
      'algorithms',
      'layouts',
      'inspector',
      'mutation',
      'animation',
      'gestures',
      'export',
      'runtime',
    ]);
    expect(
      workflows.scenes.every(
        (scene) => scene.label && scene.purpose && scene.expected,
      ),
    ).to.equal(true);
    expect(workflows.coverage.map((row) => row.family)).to.include.members([
      'algorithms-search-paths',
      'algorithms-topology',
      'algorithms-centrality',
      'algorithms-clustering',
      'algorithms-similarity-diffusion-motifs',
      'async-executor-comparison-cancellation',
      'query-selection-topology-inspection',
      'animation-transitions',
      'patch-data-reparent-batch',
      'serialize-load-cancel',
      'clone-follow-dirty-stream',
      'gesture-picking-events',
      'image-export',
      'renderer-host-lifecycle',
      'headless-runtimes',
      'type-declarations',
      'style-schemas',
      'distribution-packaging',
      'benchmark-recipes',
      'layout-callback-recipes',
      'model-dirty-consumers',
      'device-loss-diagnostic',
      'undo-history',
    ]);
    expect(workflows.coverage.every((row) => row.evidence)).to.equal(true);
    expect(workflows.propertyEvidence).to.have.length(25);
    expect(workflows.timingFunctions).to.deep.equal(EASING_NAMES);
    expect(workflows.keywordEvidence).to.have.length(
      EASING_NAMES.length * 2 + 6,
    );
    expect(
      workflows.keywordEvidence
        .filter(
          (row) =>
            row.group === 'nodes' &&
            row.property === 'transition-timing-function',
        )
        .map((row) => row.value),
    ).to.deep.equal(EASING_NAMES);
    expect(
      workflows.keywordEvidence
        .filter(
          (row) =>
            row.group === 'edges' &&
            row.property === 'transition-timing-function',
        )
        .map((row) => row.value),
    ).to.deep.equal(EASING_NAMES);
    expect(
      workflows.propertyEvidence.every(
        (row) =>
          row.group &&
          row.property &&
          row.target &&
          row.value !== undefined &&
          Array.isArray(row.values) &&
          row.values.length > 0 &&
          row.route &&
          row.widget &&
          row.behaviorSpec,
      ),
    ).to.equal(true);
    expect(
      workflows.propertyEvidence.find(
        (row) => row.group === 'edges' && row.property === 'events',
      ),
    ).to.include({ target: 'edge ab', widget: 'Toggle edge ab.events no/yes' });
    expect(
      workflows.keywordEvidence.some(
        (row) =>
          row.group === 'edges' &&
          row.property === 'events' &&
          row.value === 'no',
      ),
    ).to.equal(true);
    expect(
      workflows.keywordEvidence.some(
        (row) =>
          row.group === 'edges' &&
          row.property === 'events' &&
          row.value === 'yes',
      ),
    ).to.equal(true);
    for (const group of ['nodes', 'edges']) {
      expect(
        workflows.propertyEvidence.find(
          (row) =>
            row.group === group && row.property === 'transition-property',
        ).values,
      ).to.include('none');
      expect(
        workflows.keywordEvidence.some(
          (row) =>
            row.group === group &&
            row.property === 'transition-property' &&
            row.value === 'none',
        ),
      ).to.equal(true);
    }
    expect(
      workflows.keywordEvidence.some(
        (row) =>
          row.group === 'core' &&
          row.property === 'label-declutter' &&
          row.value === 'none',
      ),
    ).to.equal(true);
    expect(commonJSWorkflows.scenes.map((scene) => scene.id)).to.deep.equal(
      workflows.scenes.map((scene) => scene.id),
    );
    expect(commonJSWorkflows.algorithms.map((entry) => entry.id)).to.deep.equal(
      workflows.algorithms.map((entry) => entry.id),
    );
  });

  it('executes every advertised collection algorithm on the labelled deterministic graph', async function () {
    for (const algorithm of workflows.algorithms) {
      const cy = makeCy();

      try {
        const execution = await run(cy, algorithm.id);
        const summary = workflows.describeAlgorithm(algorithm.id, execution);
        const result = execution.result;
        const nodes = execution.input.nodes;
        const byID = (id) => cy.getElementById(id);
        const allLeafIds = ['a', 'b', 'c', 'd', 'e', 'x', 'y'];
        const clusterIds = (clusters) =>
          clusters.flatMap((cluster) =>
            (cluster.nodes ? cluster.nodes() : cluster).map((ele) => ele.id()),
          );
        const finiteMetrics = (read) =>
          nodes.forEach(
            (ele) =>
              expect(read(ele), `${algorithm.id}(${ele.id()})`).to.be.finite,
          );

        switch (algorithm.id) {
          case 'bfs':
          case 'dfs':
            expect(result.found.id()).to.equal('d');
            expect(
              result.path.nodes().map((ele) => ele.id()),
            ).to.include.members(['b', 'd']);
            break;
          case 'dijkstra':
          case 'bellmanFord':
            expect(result.distanceTo(byID('d'))).to.be.finite;
            expect(
              result
                .pathTo(byID('d'))
                .nodes()
                .map((ele) => ele.id()),
            ).to.include.members(['b', 'd']);
            break;
          case 'aStar':
            expect(result.found).to.equal(true);
            expect(result.distance).to.be.finite;
            expect(
              result.path.nodes().map((ele) => ele.id()),
            ).to.include.members(['b', 'd']);
            break;
          case 'floydWarshall':
            expect(result.distance(byID('b'), byID('d'))).to.be.finite;
            expect(
              result
                .path(byID('b'), byID('d'))
                .nodes()
                .map((ele) => ele.id()),
            ).to.include.members(['b', 'd']);
            break;
          case 'kruskal':
            expect(result.nodes().length).to.equal(5);
            expect(result.edges().length).to.equal(4);
            break;
          case 'tarjanStronglyConnected':
            expect(result.components.length).to.be.greaterThan(0);
            expect(clusterIds(result.components)).to.include.members([
              'a',
              'b',
              'c',
              'x',
              'y',
            ]);
            break;
          case 'hopcroftTarjanBiconnected':
            expect(result.components.length).to.be.greaterThan(0);
            expect(result.cut.nodes().length).to.be.greaterThan(0);
            expect(clusterIds(result.components)).to.include.members([
              'a',
              'b',
              'c',
              'd',
              'e',
            ]);
            break;
          case 'hierholzer':
            expect(result.found).to.equal(true);
            expect(result.trail.length).to.be.greaterThan(0);
            break;
          case 'kargerStein':
            expect(
              result.partition1.nodes().length +
                result.partition2.nodes().length,
            ).to.equal(5);
            expect(result.cut.edges().length).to.be.greaterThan(0);
            break;
          case 'pageRank':
            finiteMetrics((ele) => result.rank(ele));
            break;
          case 'degreeCentrality':
            expect(result.indegree).to.be.finite;
            expect(result.outdegree).to.be.finite;
            break;
          case 'degreeCentralityNormalized':
            finiteMetrics(
              (ele) => result.indegree(ele) + result.outdegree(ele),
            );
            break;
          case 'closenessCentrality':
            expect(result).to.be.finite;
            break;
          case 'closenessCentralityNormalized':
            finiteMetrics((ele) => result.closeness(ele));
            break;
          case 'betweennessCentrality':
            finiteMetrics((ele) => result.betweenness(ele));
            break;
          case 'katzCentrality':
            finiteMetrics((ele) => result.katz(ele));
            break;
          case 'triangleCount':
            expect(result.totalTriangles).to.be.greaterThan(0);
            finiteMetrics((ele) => result.triangles(ele));
            break;
          case 'motifCensus':
            expect(
              Object.values(result.counts).some((count) => count > 0),
            ).to.equal(true);
            break;
          case 'kMeans':
          case 'kMedoids':
          case 'hierarchicalClustering':
          case 'markovClustering':
          case 'affinityPropagation':
            expect(clusterIds(result).sort()).to.deep.equal(
              allLeafIds.slice().sort(),
            );
            break;
          case 'fuzzyCMeans':
            expect(clusterIds(result.clusters).sort()).to.deep.equal(
              allLeafIds.slice().sort(),
            );
            expect(result.degreeOfMembership).to.have.length(nodes.length);
            result.degreeOfMembership.forEach((membership) =>
              expect(
                membership.reduce((sum, value) => sum + value, 0),
              ).to.be.closeTo(1, 1e-5),
            );
            break;
          case 'neighborhoodSimilarity':
          case 'simRank':
            expect(result.similarity(byID('b'), byID('d'))).to.be.within(0, 1);
            break;
          case 'randomWalkWithRestart':
          case 'heatDiffusion':
            finiteMetrics((ele) => result.score(ele));
            break;
          case 'randomWalkWithRestartProximity':
            expect(result.proximity(byID('b'), byID('d'))).to.be.within(0, 1);
            break;
          case 'heatKernel':
            expect(result.heat(byID('b'), byID('d'))).to.be.finite;
            break;
          case 'effectiveResistance':
            expect(result.resistance(byID('b'), byID('d'))).to.be.at.least(0);
            expect(result.commuteTime(byID('b'), byID('d'))).to.be.at.least(0);
            break;
        }

        expect(
          summary.detail,
          `${algorithm.id} did not produce a result summary`,
        )
          .to.be.a('string')
          .and.not.equal('');
      } finally {
        cy.destroy();
      }
    }
  });

  it('uses selected root and goal in actual paths and labels, with a control pair that differs', async function () {
    const cy = makeCy();

    try {
      const main = workflows.describeAlgorithm(
        'dijkstra',
        await run(cy, 'dijkstra', { root: 'a', goal: 'e' }),
      );
      const disconnected = workflows.describeAlgorithm(
        'dijkstra',
        await run(cy, 'dijkstra', { root: 'x', goal: 'y' }),
      );

      expect(main.detail).to.include('distance a→e:');
      expect(main.detail).to.include('a → ab → b');
      expect(disconnected.detail).to.include('distance x→y: 3');
      expect(disconnected.detail).to.include('x → xy → y');
      expect(disconnected.detail).not.to.equal(main.detail);

      const searchExecution = await run(cy, 'bfs', {
        root: 'b',
        goal: 'd',
      });
      const search = workflows.describeAlgorithm('bfs', searchExecution);
      expect(
        searchExecution.visits.map(({ id, depth }) => `${id}(d${depth})`),
      ).to.deep.equal(['b(d0)', 'c(d1)', 'd(d1)']);
      expect(searchExecution.result.found.id()).to.equal('d');
      expect(
        searchExecution.result.path.nodes().map((ele) => ele.id()),
      ).to.deep.equal(['b', 'c', 'd', 'a']);
      expect(search.detail).to.include('found: d');
      expect(search.detail).to.include('path: b → bc → c → bd → d → ca → a');
    } finally {
      cy.destroy();
    }
  });

  it('keeps empty clustering results in their reported positions', function () {
    const cy = makeCy();

    try {
      const summary = workflows.describeAlgorithm('kMeans', {
        result: [cy.getElementById('a'), undefined, cy.getElementById('b')],
        input: { cy, nodes: cy.collection(), pair: [] },
      });

      expect(summary.rows).to.deep.equal([
        ['cluster 1', 'a'],
        ['cluster 2', ''],
        ['cluster 3', 'b'],
      ]);
      expect(summary.highlight.nodes().map((node) => node.id())).to.deep.equal([
        'a',
        'b',
      ]);
    } finally {
      cy.destroy();
    }
  });

  it('executes actual layout transform, ready, and stop callbacks', async function () {
    const cy = makeCy();

    try {
      const order = [];
      let transforms = 0;
      let unshiftedA = null;
      const layout = cy.layout({
        name: 'circle',
        animate: false,
        fit: false,
        transform(node, position) {
          transforms++;
          if (node.id() === 'a') unshiftedA = position.x;
          return { x: position.x + 31, y: position.y };
        },
        ready() {
          order.push('ready');
        },
        stop() {
          order.push('stop');
        },
      });
      const layoutStopped = new Promise((resolve) =>
        cy.one('layoutstop', resolve),
      );

      layout.run();
      await layoutStopped;

      expect(transforms).to.equal(
        cy.nodes().filter((node) => !node.isParent()).length,
      );
      expect(order).to.deep.equal(['ready', 'stop']);
      expect(cy.getElementById('a').position().x).to.be.closeTo(
        unshiftedA + 31,
        1e-9,
      );
    } finally {
      cy.destroy();
    }
  });

  it('reports numeric values for every leaf, including the disconnected x/y component', async function () {
    const cy = makeCy();

    try {
      const execution = await run(cy, 'pageRank');
      const summary = workflows.describeAlgorithm('pageRank', execution);
      const reported = summary.rows.map(([id]) => id);

      expect(reported).to.deep.equal(['a', 'b', 'c', 'd', 'e', 'x', 'y']);
      expect(
        summary.rows.every(([, value]) => Number.isFinite(value)),
      ).to.equal(true);
    } finally {
      cy.destroy();
    }
  });

  it('extracts comparable numeric output and applies an explicit tolerance', async function () {
    const cy = makeCy();

    try {
      const execution = await run(cy, 'pageRank');
      const values = workflows.numericAlgorithmValues('pageRank', execution);
      const keys = Object.keys(values).sort();

      expect(keys).to.deep.equal([
        'rank.a',
        'rank.b',
        'rank.c',
        'rank.d',
        'rank.e',
        'rank.x',
        'rank.y',
      ]);
      expect(Object.values(values).every(Number.isFinite)).to.equal(true);

      const close = workflows.compareNumericValues(
        values,
        { ...values, 'rank.a': values['rank.a'] + 0.0005 },
        { absolute: 0.001, relative: 0.001 },
      );
      const far = workflows.compareNumericValues(
        values,
        { ...values, 'rank.a': values['rank.a'] + 0.01 },
        { absolute: 0.001, relative: 0.001 },
      );

      expect(close.withinTolerance).to.equal(true);
      expect(close.maxKey).to.equal('rank.a');
      expect(far.withinTolerance).to.equal(false);
      expect(far.maxAbsoluteDifference).to.be.closeTo(0.01, 1e-9);
      const nanResult = Object.create(execution.result);
      nanResult.rank = () => Number.NaN;
      const nanValues = workflows.numericAlgorithmValues('pageRank', {
        ...execution,
        result: nanResult,
      });
      expect(Object.keys(nanValues).sort()).to.deep.equal(keys);
      expect(Object.values(nanValues).every(Number.isNaN)).to.equal(true);
      expect(
        workflows.compareNumericValues(nanValues, nanValues, {
          absolute: 1e-4,
          relative: 1e-4,
        }).withinTolerance,
      ).to.equal(false);
      expect(
        workflows.compareNumericValues(
          { 'rank.a': values['rank.a'] },
          { 'rank.a': null },
          { absolute: 1e-4, relative: 1e-4 },
        ).withinTolerance,
      ).to.equal(false);
      expect(
        workflows.compareNumericValues(
          { 'rank.a': values['rank.a'] },
          {},
          { absolute: 1e-4, relative: 1e-4 },
        ).withinTolerance,
      ).to.equal(false);
      expect(() =>
        workflows.numericAlgorithmValues('pageRank', {
          ...execution,
          result: Object.assign(Object.create(execution.result), {
            rank: () => undefined,
          }),
        }),
      ).to.throw(/rank\.a.*number/);
      expect(workflows.comparisonTolerance('pageRank', 'gpu')).to.deep.equal({
        absolute: 1e-4,
        relative: 1e-4,
      });
      expect(
        workflows.comparisonTolerance('effectiveResistance', 'gpu'),
      ).to.deep.equal({ absolute: 0, relative: 5e-3, relativeFloor: 0.01 });
      const equalInfinity = workflows.compareNumericValues(
        { unreachable: Infinity },
        { unreachable: Infinity },
        { absolute: 1e-4, relative: 1e-4 },
      );
      const differentInfinity = workflows.compareNumericValues(
        { unreachable: Infinity },
        { unreachable: 3 },
        { absolute: 1e-4, relative: 1e-4 },
      );
      expect(equalInfinity.withinTolerance).to.equal(true);
      expect(equalInfinity.maxAbsoluteDifference).to.equal(0);
      expect(differentInfinity.withinTolerance).to.equal(false);

      const unreachable = await run(cy, 'floydWarshall', {
        root: 'a',
        goal: 'x',
      });
      const unreachableValues = workflows.numericAlgorithmValues(
        'floydWarshall',
        unreachable,
      );
      expect(unreachableValues['distance.a→x']).to.equal(Infinity);
    } finally {
      cy.destroy();
    }
  });

  it('round-trips every wire-persisted field and detects a changed score (mutation control)', async function () {
    const cy = makeCy();
    const original = normalize(cytoscape.deserializeElements(cy.serialize()));
    const baseline = cy.json().elements;
    const a = cy.getElementById('a');
    const originalPosition = a.position();

    try {
      a.data('score', 11);
      a.position({ x: originalPosition.x + 13, y: originalPosition.y - 7 });
      a.select();

      const changed = normalize(cytoscape.deserializeElements(cy.serialize()));
      expect(
        JSON.stringify(changed),
        'control: changed persisted data was not detected',
      ).not.to.equal(JSON.stringify(original));

      const restored = cytoscape({ headless: true });
      try {
        await restored.load([cy.serialize()], { fit: false });
        const loaded = normalize(
          cytoscape.deserializeElements(restored.serialize()),
        );
        expect(loaded).to.deep.equal(changed);
        expect(restored.getElementById('a').position()).to.deep.equal(
          a.position(),
        );
        expect(restored.getElementById('a').selected()).to.equal(true);
      } finally {
        restored.destroy();
      }

      cy.patch(baseline);
      a.position(originalPosition);
      a.unselect();
      const reset = normalize(cytoscape.deserializeElements(cy.serialize()));
      expect(reset).to.deep.equal(original);
    } finally {
      cy.destroy();
    }
  });
});

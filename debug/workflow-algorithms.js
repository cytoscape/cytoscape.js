/* Algorithm adapters and controls for the workflow debug network. */
(function (root) {
  'use strict';

  const {
    node,
    button,
    select,
    field,
    output,
    panel,
    param,
    numericParam,
    saveParams,
    clear,
  } = root.featureWorkflowUI;

  const ALGORITHMS = [
    {
      id: 'bfs',
      label: 'Breadth-first search',
      family: 'Search',
      executors: ['cpu'],
    },
    {
      id: 'dfs',
      label: 'Depth-first search',
      family: 'Search',
      executors: ['cpu'],
    },
    {
      id: 'dijkstra',
      label: 'Dijkstra shortest path',
      family: 'Paths',
      executors: ['cpu'],
    },
    {
      id: 'aStar',
      label: 'A* shortest path',
      family: 'Paths',
      executors: ['cpu'],
    },
    {
      id: 'bellmanFord',
      label: 'Bellman–Ford shortest path',
      family: 'Paths',
      executors: ['cpu'],
    },
    {
      id: 'floydWarshall',
      label: 'Floyd–Warshall all pairs',
      family: 'Paths',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'kruskal',
      label: 'Kruskal minimum spanning forest',
      family: 'Topology',
      executors: ['cpu'],
    },
    {
      id: 'tarjanStronglyConnected',
      label: 'Tarjan strongly connected components',
      family: 'Topology',
      executors: ['cpu'],
    },
    {
      id: 'hopcroftTarjanBiconnected',
      label: 'Hopcroft–Tarjan biconnected components',
      family: 'Topology',
      executors: ['cpu'],
    },
    {
      id: 'hierholzer',
      label: 'Hierholzer Euler trail',
      family: 'Topology',
      executors: ['cpu'],
    },
    {
      id: 'kargerStein',
      label: 'Karger–Stein minimum cut',
      family: 'Topology',
      executors: ['cpu'],
    },
    {
      id: 'pageRank',
      label: 'PageRank',
      family: 'Centrality',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'degreeCentrality',
      label: 'Degree centrality',
      family: 'Centrality',
      executors: ['cpu'],
    },
    {
      id: 'degreeCentralityNormalized',
      label: 'Normalized degree centrality',
      family: 'Centrality',
      executors: ['cpu'],
    },
    {
      id: 'closenessCentrality',
      label: 'Single-node closeness',
      family: 'Centrality',
      executors: ['cpu'],
    },
    {
      id: 'closenessCentralityNormalized',
      label: 'Normalized closeness, all nodes',
      family: 'Centrality',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'betweennessCentrality',
      label: 'Betweenness centrality',
      family: 'Centrality',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'katzCentrality',
      label: 'Katz centrality',
      family: 'Centrality',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'triangleCount',
      label: 'Triangle counts and coefficients',
      family: 'Motifs',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'motifCensus',
      label: 'Directed triad census',
      family: 'Motifs',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'kMeans',
      label: 'k-means (x/y attributes)',
      family: 'Clustering',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'kMedoids',
      label: 'k-medoids (x/y attributes)',
      family: 'Clustering',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'fuzzyCMeans',
      label: 'Fuzzy c-means (x/y attributes)',
      family: 'Clustering',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'hierarchicalClustering',
      label: 'Hierarchical clustering (x/y attributes)',
      family: 'Clustering',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'markovClustering',
      label: 'Markov clustering',
      family: 'Clustering',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'affinityPropagation',
      label: 'Affinity propagation (x/y attributes)',
      family: 'Clustering',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'neighborhoodSimilarity',
      label: 'Neighborhood similarity',
      family: 'Similarity',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'simRank',
      label: 'SimRank',
      family: 'Similarity',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'randomWalkWithRestart',
      label: 'Random walk with restart',
      family: 'Diffusion',
      executors: ['cpu', 'auto'],
    },
    {
      id: 'randomWalkWithRestartProximity',
      label: 'Random-walk all-pairs proximity',
      family: 'Diffusion',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'heatDiffusion',
      label: 'Seeded heat diffusion',
      family: 'Diffusion',
      executors: ['cpu', 'auto'],
    },
    {
      id: 'heatKernel',
      label: 'All-pairs heat kernel',
      family: 'Diffusion',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
    {
      id: 'effectiveResistance',
      label: 'Effective resistance and commute time',
      family: 'Diffusion',
      executors: ['cpu', 'auto', 'gpu', 'workers'],
    },
  ];

  const byId = Object.fromEntries(ALGORITHMS.map((entry) => [entry.id, entry]));
  const NUMERIC_COMPARISONS = new Set([
    'floydWarshall',
    'pageRank',
    'closenessCentralityNormalized',
    'betweennessCentrality',
    'katzCentrality',
    'triangleCount',
    'motifCensus',
    'neighborhoodSimilarity',
    'simRank',
    'randomWalkWithRestart',
    'randomWalkWithRestartProximity',
    'heatDiffusion',
    'heatKernel',
    'effectiveResistance',
  ]);
  const ASYNC_ALGORITHMS = new Set(
    ALGORITHMS.filter((entry) => entry.executors.length > 1).map(
      (entry) => entry.id,
    ),
  );

  function ids(eles) {
    return eles.map((ele) => ele.id());
  }

  function algorithmInput(cy, selections = {}) {
    const nodes = cy.nodes({ parent: false });
    const nodeIds = new Set(ids(nodes));
    const edges = cy.edges().filter((edge) => {
      return nodeIds.has(edge.source().id()) && nodeIds.has(edge.target().id());
    });
    const graph = nodes.union(edges);
    const node = (id) => {
      const found = cy.getElementById(id);

      return found.length ? found : nodes[0];
    };
    const weight = (edge) => Number(edge.data('weight') || 1);
    const connectedIds = new Set(['a', 'b', 'c', 'd', 'e']);
    const connectedNodes = nodes.filter((ele) => connectedIds.has(ele.id()));
    const connectedEdges = edges.filter((edge) => {
      return (
        connectedIds.has(edge.source().id()) &&
        connectedIds.has(edge.target().id())
      );
    });
    const cycleNodes = nodes.filter((ele) =>
      ['a', 'b', 'c'].includes(ele.id()),
    );
    const cycleEdges = edges.filter((edge) => {
      return (
        ['a', 'b', 'c'].includes(edge.source().id()) &&
        ['a', 'b', 'c'].includes(edge.target().id())
      );
    });

    return {
      cy,
      nodes,
      edges,
      graph,
      root: node(selections.root || 'a'),
      goal: node(selections.goal || 'e'),
      pair: [node(selections.root || 'a'), node(selections.goal || 'e')],
      weight,
      connected: connectedNodes.union(connectedEdges),
      cycle: cycleNodes.union(cycleEdges),
      attributes: [
        (ele) => Number(ele.data('x') || 0),
        (ele) => Number(ele.data('y') || 0),
      ],
    };
  }

  function runAlgorithm(cy, operation, executor = 'cpu', selections = {}) {
    const input = algorithmInput(cy, selections);
    const exec = byId[operation];

    if (exec == null) {
      throw new Error(`Unknown algorithm '${operation}'`);
    }

    if (!exec.executors.includes(executor)) {
      throw new Error(`${operation} does not support executor '${executor}'`);
    }

    const asyncOptions = { executor };

    switch (operation) {
      case 'bfs':
      case 'dfs': {
        const visits = [];
        const result = input.graph[operation]({
          roots: input.root,
          directed: true,
          visit(node, edge, previous, index, depth) {
            visits.push({ id: node.id(), depth });

            if (node.id() === input.goal.id()) return true;
          },
        });

        return { result, visits, input };
      }
      case 'dijkstra':
        return {
          result: input.graph.dijkstra({
            root: input.root,
            weight: input.weight,
            directed: true,
          }),
          input,
        };
      case 'aStar':
        return {
          result: input.graph.aStar({
            root: input.root,
            goal: input.goal,
            weight: input.weight,
            directed: true,
          }),
          input,
        };
      case 'bellmanFord':
        return {
          result: input.graph.bellmanFord({
            root: input.root,
            weight: input.weight,
            directed: true,
          }),
          input,
        };
      case 'floydWarshall':
        return {
          result: input.graph.floydWarshall({
            ...asyncOptions,
            weight: input.weight,
            directed: true,
          }),
          input,
        };
      case 'kruskal':
        return { result: input.connected.kruskal(input.weight), input };
      case 'tarjanStronglyConnected':
        return { result: input.graph.tarjanStronglyConnected(), input };
      case 'hopcroftTarjanBiconnected':
        return { result: input.connected.hopcroftTarjanBiconnected(), input };
      case 'hierholzer':
        return {
          result: input.cycle.hierholzer({ root: input.root, directed: true }),
          input,
        };
      case 'kargerStein':
        return { result: input.connected.kargerStein(), input };
      case 'pageRank':
        return {
          result: input.graph.pageRank({ ...asyncOptions, iterations: 100 }),
          input,
        };
      case 'degreeCentrality':
        return {
          result: input.graph.degreeCentrality({
            root: input.root,
            weight: input.weight,
            directed: true,
            alpha: 0.5,
          }),
          input,
        };
      case 'degreeCentralityNormalized':
        return {
          result: input.graph.degreeCentralityNormalized({
            weight: input.weight,
            directed: true,
            alpha: 0.5,
          }),
          input,
        };
      case 'closenessCentrality':
        return {
          result: input.graph.closenessCentrality({
            root: input.root,
            weight: input.weight,
            directed: true,
            harmonic: true,
          }),
          input,
        };
      case 'closenessCentralityNormalized':
        return {
          result: input.graph.closenessCentralityNormalized({
            ...asyncOptions,
            weight: input.weight,
            directed: true,
            harmonic: true,
          }),
          input,
        };
      case 'betweennessCentrality':
        return {
          result: input.graph.betweennessCentrality({
            ...asyncOptions,
            directed: true,
          }),
          input,
        };
      case 'katzCentrality':
        return {
          result: input.graph.katzCentrality({
            ...asyncOptions,
            alpha: 0.1,
            maxIterations: 100,
            directed: true,
          }),
          input,
        };
      case 'triangleCount':
        return { result: input.graph.triangleCount(asyncOptions), input };
      case 'motifCensus':
        return {
          result: input.graph.motifCensus({ ...asyncOptions, directed: true }),
          input,
        };
      case 'kMeans':
        return {
          result: input.nodes.kMeans({
            ...asyncOptions,
            k: 2,
            attributes: input.attributes,
            distance: 'euclidean',
            maxIterations: 40,
          }),
          input,
        };
      case 'kMedoids':
        return {
          result: input.nodes.kMedoids({
            ...asyncOptions,
            k: 2,
            attributes: input.attributes,
            distance: 'euclidean',
            maxIterations: 40,
          }),
          input,
        };
      case 'fuzzyCMeans':
        return {
          result: input.nodes.fuzzyCMeans({
            ...asyncOptions,
            k: 2,
            m: 2,
            attributes: input.attributes,
            distance: 'euclidean',
            maxIterations: 40,
          }),
          input,
        };
      case 'hierarchicalClustering':
        return {
          result: input.nodes.hierarchicalClustering({
            ...asyncOptions,
            attributes: input.attributes,
            distance: 'euclidean',
            linkage: 'mean',
            mode: 'threshold',
            threshold: 45,
          }),
          input,
        };
      case 'markovClustering':
        return {
          result: input.graph.markovClustering({
            ...asyncOptions,
            maxIterations: 40,
          }),
          input,
        };
      case 'affinityPropagation':
        return {
          result: input.nodes.affinityPropagation({
            ...asyncOptions,
            attributes: input.attributes,
            distance: 'euclidean',
            preference: 'median',
            damping: 0.8,
            maxIterations: 60,
            minIterations: 10,
          }),
          input,
        };
      case 'neighborhoodSimilarity':
        return {
          result: input.graph.neighborhoodSimilarity({
            ...asyncOptions,
            metric: 'jaccard',
            directed: true,
          }),
          input,
        };
      case 'simRank':
        return {
          result: input.graph.simRank({
            ...asyncOptions,
            maxIterations: 40,
            directed: true,
          }),
          input,
        };
      case 'randomWalkWithRestart':
        return {
          result: input.graph.randomWalkWithRestart({
            ...asyncOptions,
            seeds: input.root,
            directed: true,
            maxIterations: 100,
          }),
          input,
        };
      case 'randomWalkWithRestartProximity':
        return {
          result: input.graph.randomWalkWithRestartProximity({
            ...asyncOptions,
            directed: true,
            maxIterations: 100,
          }),
          input,
        };
      case 'heatDiffusion':
        return {
          result: input.graph.heatDiffusion({
            ...asyncOptions,
            seeds: input.root,
            time: 0.5,
            laplacian: 'normalized',
          }),
          input,
        };
      case 'heatKernel':
        return {
          result: input.graph.heatKernel({
            ...asyncOptions,
            time: 0.5,
            laplacian: 'normalized',
          }),
          input,
        };
      case 'effectiveResistance':
        return { result: input.graph.effectiveResistance(asyncOptions), input };
      default:
        throw new Error(`No invocation is wired for '${operation}'`);
    }
  }

  function describeAlgorithm(operation, execution) {
    const { result, input, visits } = execution;
    const resultRows = [];
    let highlight = input.cy.collection();
    // Report every leaf, including the isolated x/y component.  Keeping those
    // rows visible is useful for noticing how disconnected inputs affect an
    // algorithm's numeric output.
    const sample = input.nodes;
    const pairs = input.pair;
    const addCollection = (collection) => {
      if (collection != null && typeof collection.union === 'function') {
        highlight = highlight.union(collection);
      }
    };
    const metricRows = (getter) => {
      addCollection(sample);
      sample.forEach((node) => resultRows.push([node.id(), getter(node)]));
    };
    const summarizeClusters = (clusters) => {
      const sets = clusters.map((cluster) =>
        cluster == null ? [] : ids(cluster.nodes ? cluster.nodes() : cluster),
      );

      sets.forEach((members, index) =>
        resultRows.push([`cluster ${index + 1}`, members.join(', ')]),
      );
      clusters.forEach((cluster) => {
        if (cluster != null) addCollection(cluster);
      });
      return `clusters: ${sets.length}`;
    };
    let heading = operation;
    let detail = '';

    switch (operation) {
      case 'bfs':
      case 'dfs':
        detail = `visit order: ${visits.map((visit) => `${visit.id}(d${visit.depth})`).join(' → ')}; path: ${ids(result.path).join(' → ')}; found: ${ids(result.found).join(', ') || 'none'}`;
        addCollection(result.path);
        break;
      case 'dijkstra':
      case 'bellmanFord': {
        const path = result.pathTo(input.goal);
        detail = `distance ${input.root.id()}→${input.goal.id()}: ${result.distanceTo(input.goal)}; path: ${ids(path).join(' → ')}`;
        addCollection(path);

        if (operation === 'bellmanFord') {
          detail += `; negative cycle: ${result.hasNegativeWeightCycle}`;
        }

        break;
      }
      case 'aStar':
        detail = `found: ${result.found}; distance: ${result.distance}; steps: ${result.steps}; path: ${result.path ? ids(result.path).join(' → ') : 'none'}`;
        addCollection(result.path);
        break;
      case 'floydWarshall': {
        const path = result.path(...pairs);
        detail = `distance ${pairs[0].id()}→${pairs[1].id()}: ${result.distance(...pairs)}; path: ${ids(path).join(' → ')}`;
        addCollection(path);
        break;
      }
      case 'kruskal':
        detail = `forest contains ${result.nodes().length} nodes and ${result.edges().length} accepted edges`;
        addCollection(result);
        resultRows.push(['accepted edges', ids(result.edges()).join(', ')]);
        break;
      case 'tarjanStronglyConnected':
      case 'hopcroftTarjanBiconnected':
        detail = `components: ${result.components.length}; cut nodes: ${ids(result.cut.nodes()).join(', ') || 'none'}`;
        result.components.forEach((collection, index) => {
          resultRows.push([
            `component ${index + 1}`,
            ids(collection.nodes()).join(', '),
          ]);
          addCollection(collection);
        });
        addCollection(result.cut);
        break;
      case 'hierholzer':
        detail = `Euler trail found: ${result.found}; trail: ${result.trail ? ids(result.trail).join(' → ') : 'none'}`;
        addCollection(result.trail);
        break;
      case 'kargerStein':
        detail = `randomized cut size: ${result.cut.edges().length}; partition sizes: ${result.partition1.nodes().length} / ${result.partition2.nodes().length}`;
        addCollection(result.cut);
        addCollection(result.partition1);
        addCollection(result.partition2);
        break;
      case 'pageRank':
        detail = 'rank by node';
        metricRows((node) => result.rank(node));
        break;
      case 'degreeCentrality':
        detail = `root ${input.root.id()}: ${JSON.stringify(result)}`;
        resultRows.push([input.root.id(), JSON.stringify(result)]);
        break;
      case 'degreeCentralityNormalized':
        detail = 'normalized in/out degree by node';
        metricRows((node) => ({
          in: result.indegree ? result.indegree(node) : result.degree(node),
          out: result.outdegree ? result.outdegree(node) : result.degree(node),
        }));
        break;
      case 'closenessCentrality':
        detail = `root ${input.root.id()} harmonic closeness: ${result}`;
        break;
      case 'closenessCentralityNormalized':
        detail = 'normalized closeness by node';
        metricRows((node) => result.closeness(node));
        break;
      case 'betweennessCentrality':
        detail = 'betweenness by node';
        metricRows((node) => ({
          raw: result.betweenness(node),
          normalized: result.betweennessNormalized(node),
        }));
        break;
      case 'katzCentrality':
        detail = 'Katz score by node';
        metricRows((node) => ({
          raw: result.katz(node),
          normalized: result.katzNormalized(node),
        }));
        break;
      case 'triangleCount':
        detail = `total triangles: ${result.totalTriangles}; transitivity: ${result.transitivity}`;
        metricRows((node) => ({
          triangles: result.triangles(node),
          coefficient: result.clusteringCoefficient(node),
        }));
        break;
      case 'motifCensus':
        detail = 'non-zero triad classes';
        Object.entries(result.counts)
          .filter(([, count]) => count > 0)
          .forEach(([kind, count]) => resultRows.push([kind, count]));
        break;
      case 'kMeans':
      case 'kMedoids':
      case 'hierarchicalClustering':
      case 'markovClustering':
      case 'affinityPropagation':
        detail = summarizeClusters(result);
        break;
      case 'fuzzyCMeans':
        detail = summarizeClusters(result.clusters);
        result.degreeOfMembership.forEach((membership, index) =>
          resultRows.push([
            sample[index]?.id() ?? `node ${index}`,
            membership.map((value) => Number(value.toFixed(4))),
          ]),
        );
        break;
      case 'neighborhoodSimilarity':
      case 'simRank':
        detail = `${operation === 'simRank' ? 'SimRank' : 'Jaccard'} similarity ${pairs[0].id()}↔${pairs[1].id()}: ${result.similarity(...pairs)}`;
        break;
      case 'randomWalkWithRestart':
      case 'heatDiffusion':
        detail = 'score by node';
        metricRows((node) => result.score(node));
        break;
      case 'randomWalkWithRestartProximity':
        detail = `proximity ${pairs[0].id()}→${pairs[1].id()}: ${result.proximity(...pairs)}`;
        break;
      case 'heatKernel':
        detail = `heat ${pairs[0].id()}→${pairs[1].id()}: ${result.heat(...pairs)}`;
        break;
      case 'effectiveResistance':
        detail = `resistance ${pairs[0].id()}↔${pairs[1].id()}: ${result.resistance(...pairs)}; commute time: ${result.commuteTime(...pairs)}`;
        break;
    }

    return { heading, detail, rows: resultRows, highlight };
  }

  function numericAlgorithmValues(operation, execution) {
    const { result, input } = execution;
    const values = {};
    const add = (key, value) => {
      if (typeof value !== 'number') {
        throw new TypeError(
          `Numeric result '${key}' must be a number; received ${value === null ? 'null' : typeof value}`,
        );
      }

      values[key] = value;
    };
    const metric = (name, read) =>
      input.nodes.forEach((node) => add(`${name}.${node.id()}`, read(node)));
    const [root, goal] = input.pair;

    switch (operation) {
      case 'floydWarshall':
        add(`distance.${root.id()}→${goal.id()}`, result.distance(root, goal));
        break;
      case 'pageRank':
        metric('rank', (node) => result.rank(node));
        break;
      case 'closenessCentralityNormalized':
        metric('closeness', (node) => result.closeness(node));
        break;
      case 'betweennessCentrality':
        metric('betweenness.raw', (node) => result.betweenness(node));
        metric('betweenness.normalized', (node) =>
          result.betweennessNormalized(node),
        );
        break;
      case 'katzCentrality':
        metric('katz.raw', (node) => result.katz(node));
        metric('katz.normalized', (node) => result.katzNormalized(node));
        break;
      case 'triangleCount':
        add('totalTriangles', result.totalTriangles);
        add('transitivity', result.transitivity);
        metric('triangles', (node) => result.triangles(node));
        metric('clusteringCoefficient', (node) =>
          result.clusteringCoefficient(node),
        );
        break;
      case 'motifCensus':
        Object.entries(result.counts).forEach(([name, count]) =>
          add(`motif.${name}`, count),
        );
        break;
      case 'neighborhoodSimilarity':
      case 'simRank':
        add(
          `similarity.${root.id()}↔${goal.id()}`,
          result.similarity(root, goal),
        );
        break;
      case 'randomWalkWithRestart':
      case 'heatDiffusion':
        metric('score', (node) => result.score(node));
        break;
      case 'randomWalkWithRestartProximity':
        add(
          `proximity.${root.id()}→${goal.id()}`,
          result.proximity(root, goal),
        );
        break;
      case 'heatKernel':
        add(`heat.${root.id()}→${goal.id()}`, result.heat(root, goal));
        break;
      case 'effectiveResistance':
        add(
          `resistance.${root.id()}↔${goal.id()}`,
          result.resistance(root, goal),
        );
        add(
          `commuteTime.${root.id()}↔${goal.id()}`,
          result.commuteTime(root, goal),
        );
        break;
      default:
        throw new Error(`'${operation}' has no numeric comparison recipe`);
    }

    return values;
  }

  function compareNumericValues(reference, candidate, tolerance) {
    const keys = [
      ...new Set([...Object.keys(reference), ...Object.keys(candidate)]),
    ].sort();
    let maxAbsoluteDifference = 0;
    let maxRelativeDifference = 0;
    let maxKey = null;
    let withinTolerance = keys.length > 0;

    for (const key of keys) {
      const left = reference[key];
      const right = candidate[key];

      if (
        typeof left !== 'number' ||
        typeof right !== 'number' ||
        Number.isNaN(left) ||
        Number.isNaN(right)
      ) {
        withinTolerance = false;
        maxAbsoluteDifference = Infinity;
        maxRelativeDifference = Infinity;
        maxKey = key;
        continue;
      }

      if (left === right) continue;

      if (!Number.isFinite(left) || !Number.isFinite(right)) {
        withinTolerance = false;
        maxAbsoluteDifference = Infinity;
        maxRelativeDifference = Infinity;
        maxKey = key;
        continue;
      }

      const difference = Math.abs(left - right);
      const scale = Math.max(
        Math.abs(left),
        tolerance.relativeFloor || Number.MIN_VALUE,
      );
      const relativeDifference = difference / scale;

      if (difference > maxAbsoluteDifference) {
        maxAbsoluteDifference = difference;
        maxKey = key;
      }
      maxRelativeDifference = Math.max(
        maxRelativeDifference,
        relativeDifference,
      );

      if (difference > tolerance.absolute + tolerance.relative * scale) {
        withinTolerance = false;
      }
    }

    return {
      keys,
      maxAbsoluteDifference,
      maxRelativeDifference,
      maxKey,
      withinTolerance,
    };
  }

  function comparisonTolerance(operation, executor) {
    if (executor === 'workers') {
      return { absolute: 1e-12, relative: 1e-12 };
    }

    if (
      ['triangleCount', 'motifCensus', 'neighborhoodSimilarity'].includes(
        operation,
      )
    ) {
      return { absolute: 0, relative: 0 };
    }

    if (operation === 'effectiveResistance') {
      return { absolute: 0, relative: 5e-3, relativeFloor: 0.01 };
    }

    // The GPU parity suite measures PageRank, Floyd–Warshall, centrality,
    // SimRank, random-walk proximity, and heat kernels to 1e-4 on f32.
    // 'auto' gets the same bound because it may select that GPU lane.
    return { absolute: 1e-4, relative: 1e-4 };
  }

  function compactNumber(value) {
    if (!Number.isFinite(value)) return String(value);
    if (value === 0) return '0';

    return Number(value.toPrecision(5)).toString();
  }

  function formatResult(info) {
    const rows = info.rows.length
      ? `\n${info.rows.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`).join('\n')}`
      : '';

    return `${info.heading}\n${info.detail}${rows}`;
  }

  function mountAlgorithms({ cy, container, params }) {
    const document = panel(
      container,
      'Algorithm explorer',
      'Choose an operation, executor, root, and goal. Numeric methods can compare the chosen executor with CPU; async methods can repeat up to 100 times for an observable cancellation recipe. Paths and components highlight actual graph elements.',
    );
    const randomnessNote = node(document, 'p', {
      className: 'feature-workflow-note',
      text: 'The fixture has a connected A–E subset for Kruskal, biconnected components, and Karger–Stein; Hierholzer uses the A–B–C cycle. Root and goal selections affect only methods that use them. Karger–Stein and k-means, k-medoids, and fuzzy c-means use randomized initialization, so repeated results may differ. Executor comparison is for deterministic numeric methods.',
    });
    const operation = select(
      document,
      ALGORITHMS.map((entry) => [entry.id, `${entry.family} — ${entry.label}`]),
      param(
        params,
        'workflowAlgorithm',
        'dijkstra',
        ALGORITHMS.map((entry) => entry.id),
      ),
    );
    const executor = select(
      document,
      byId[operation.value].executors,
      param(params, 'workflowExecutor', 'cpu', byId[operation.value].executors),
    );
    const from = select(
      document,
      ['a', 'b', 'c', 'd', 'e', 'x', 'y'].map((id) => [id, id]),
      param(params, 'workflowRoot', 'a', ['a', 'b', 'c', 'd', 'e', 'x', 'y']),
    );
    const to = select(
      document,
      ['a', 'b', 'c', 'd', 'e', 'x', 'y'].map((id) => [id, id]),
      param(params, 'workflowGoal', 'e', ['a', 'b', 'c', 'd', 'e', 'x', 'y']),
    );
    const repeats = node(document, 'input', {
      type: 'number',
      min: '1',
      max: '100',
      step: '1',
      value: String(numericParam(params, 'workflowRepeats', 1, 1, 100)),
      'aria-label': 'Async repeat count',
    });
    const status = output(document, 'Ready.');
    const detail = node(document, 'pre', {
      className: 'feature-workflow-output',
    });
    const comparison = output(
      document,
      'Choose an async numeric method and executor to compare against CPU.',
    );
    comparison.classList.add('feature-workflow-compare-summary');
    const comparisonTable = node(document, 'table', {
      className: 'feature-workflow-table',
    });
    const comparisonHead = node(document, 'thead');
    const comparisonBody = node(document, 'tbody');
    const comparisonCell = (tag, text, numeric = false, scope = null) => {
      const cell = node(document, tag, {
        text,
        ...(scope == null ? {} : { scope }),
      });

      cell.style.padding = '0.15em 0.25em';
      if (numeric) {
        cell.style.textAlign = 'right';
        cell.style.fontVariantNumeric = 'tabular-nums';
      }

      return cell;
    };
    const exactComparison = node(document, 'details', {
      className: 'feature-workflow-exact-comparison',
    });
    const exactComparisonSummary = node(document, 'summary', {
      text: 'Full-precision per-value results',
    });
    const exactComparisonValues = node(document, 'pre', {
      className: 'feature-workflow-exact-values',
    });
    exactComparison.append(exactComparisonSummary, exactComparisonValues);
    comparisonTable.append(comparisonHead, comparisonBody);
    const comparisonReport = node(
      document,
      'div',
      { className: 'feature-workflow-compare-report' },
      [comparison, comparisonTable, exactComparison],
    );
    const cancel = button(
      document,
      'Cancel run',
      () => {
        if (!busy) return;
        cancelRequested = true;
        const cancelled = activeRun?.cancel?.();
        status.textContent = cancelled
          ? 'Cancellation requested; the active run will reject with CancelledError.'
          : 'Cancellation requested; the active run will settle before the repeat sequence stops.';
      },
      { disabled: true },
    );
    let activeRun = null;
    let runToken = 0;
    let disposed = false;
    let busy = false;
    let cancelRequested = false;
    let compareButton;
    const setInputsDisabled = (disabled) => {
      [
        operation,
        executor,
        from,
        to,
        repeats,
        runButton,
        compareButton,
      ].forEach((control) => {
        control.disabled = disabled;
      });
    };
    const saveAlgorithmInputs = () =>
      saveParams({
        workflowAlgorithm: operation.value,
        workflowExecutor: executor.value,
        workflowRoot: from.value,
        workflowGoal: to.value,
        workflowRepeats: repeats.value,
      });
    const selectedInputs = () => ({ root: from.value, goal: to.value });
    const resolveRun = async (selectedOperation, selectedExecutor) => {
      const execution = runAlgorithm(
        cy,
        selectedOperation,
        selectedExecutor,
        selectedInputs(),
      );
      const run = execution.result;

      if (run && typeof run.then === 'function') {
        activeRun = run;
        cancel.disabled = typeof run.cancel !== 'function';
        execution.result = await run;
        activeRun = null;
      }

      return execution;
    };
    const finishControls = (token) => {
      if (token !== runToken) return;

      activeRun = null;
      busy = false;
      cancelRequested = false;
      cancel.disabled = true;
      setInputsDisabled(false);
      updateCompareEnabled();
    };
    const updateCompareEnabled = () => {
      const selected = byId[operation.value];
      const canCompare =
        selected != null &&
        NUMERIC_COMPARISONS.has(selected.id) &&
        selected.executors.includes(executor.value) &&
        executor.value !== 'cpu';

      if (compareButton != null) compareButton.disabled = busy || !canCompare;
      repeats.disabled = busy || !ASYNC_ALGORITHMS.has(operation.value);
    };
    const runButton = button(document, 'Run algorithm', async () => {
      if (busy || disposed) return;

      if (!byId[operation.value].executors.includes(executor.value)) {
        status.textContent = `${operation.value} does not support ${executor.value}`;
        return;
      }

      const token = ++runToken;
      const selectedOperation = operation.value;
      const selectedExecutor = executor.value;
      const requestedRepeats = ASYNC_ALGORITHMS.has(selectedOperation)
        ? Number(repeats.value)
        : 1;
      const repeatCount = Number.isFinite(requestedRepeats)
        ? Math.max(1, Math.min(100, Math.floor(requestedRepeats)))
        : 1;
      busy = true;
      cancelRequested = false;
      setInputsDisabled(true);
      cancel.disabled = !ASYNC_ALGORITHMS.has(selectedOperation);
      cy.unemphasize();
      detail.textContent = '';
      status.textContent = `Running ${selectedOperation} on ${selectedExecutor} (${from.value} → ${to.value}), 1/${repeatCount}…`;

      try {
        let lastExecution = null;

        for (let index = 0; index < repeatCount; index++) {
          if (cancelRequested || disposed || token !== runToken) break;
          status.textContent = `Running ${selectedOperation} on ${selectedExecutor} (${from.value} → ${to.value}), ${index + 1}/${repeatCount}…`;
          lastExecution = await resolveRun(selectedOperation, selectedExecutor);

          if (cancelRequested || disposed || token !== runToken) break;
          if (index + 1 < repeatCount) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
        }

        if (disposed || token !== runToken) return;
        if (cancelRequested) {
          status.textContent = `Cancelled after ${lastExecution == null ? '0' : 'a settled run'}; ${selectedOperation} repeated ${repeatCount}× recipe stopped.`;
          return;
        }

        const info = describeAlgorithm(selectedOperation, lastExecution);

        cy.emphasize(info.highlight);
        status.textContent = `${selectedOperation} completed with executor '${selectedExecutor}' (${repeatCount} run${repeatCount === 1 ? '' : 's'}).`;
        detail.textContent = `Last run · ${selectedOperation} / executor '${selectedExecutor}'\n${formatResult(info)}`;
      } catch (error) {
        if (!disposed && token === runToken) {
          status.textContent = `${error?.name || 'Error'}: ${error?.message || error}`;
        }
      } finally {
        finishControls(token);
      }
    });

    compareButton = button(
      document,
      'Compare chosen executor with CPU',
      async () => {
        if (busy || disposed) return;

        if (
          !NUMERIC_COMPARISONS.has(operation.value) ||
          executor.value === 'cpu'
        ) {
          comparison.textContent =
            'Choose a supported async numeric method and non-CPU executor.';
          return;
        }

        const token = ++runToken;
        const selectedOperation = operation.value;
        const selectedExecutor = executor.value;
        const selection = selectedInputs();
        const tolerance = comparisonTolerance(
          selectedOperation,
          selectedExecutor,
        );
        const toleranceText = `abs ${tolerance.absolute} + rel ${tolerance.relative}×max(|CPU|, ${tolerance.relativeFloor || 0})`;
        busy = true;
        cancelRequested = false;
        setInputsDisabled(true);
        cancel.disabled = !ASYNC_ALGORITHMS.has(selectedOperation);
        comparison.textContent = `Running CPU and ${selectedExecutor} for ${selectedOperation} (${selection.root} → ${selection.goal})…`;
        clear(comparisonHead);
        clear(comparisonBody);
        exactComparisonValues.textContent = '';

        try {
          const cpu = await resolveRun(selectedOperation, 'cpu');

          if (cancelRequested || disposed || token !== runToken) return;
          const chosen = await resolveRun(selectedOperation, selectedExecutor);

          if (cancelRequested || disposed || token !== runToken) return;
          const cpuValues = numericAlgorithmValues(selectedOperation, cpu);
          const chosenValues = numericAlgorithmValues(
            selectedOperation,
            chosen,
          );
          const outcome = compareNumericValues(
            cpuValues,
            chosenValues,
            tolerance,
          );
          const rows = outcome.keys.map((key) => {
            const cpuValue = cpuValues[key];
            const chosenValue = chosenValues[key];
            const difference =
              cpuValue === chosenValue ? 0 : Math.abs(cpuValue - chosenValue);

            return {
              key,
              cpuValue,
              chosenValue,
              difference,
              exact: `${key}: CPU=${cpuValue}; ${selectedExecutor}=${chosenValue}; |Δ|=${difference}`,
            };
          });

          comparison.textContent = [
            `${selectedOperation}: CPU vs ${selectedExecutor} — ${outcome.withinTolerance ? 'within' : 'outside'} tolerance`,
            `Compared ${outcome.keys.length} values · max |Δ| ${compactNumber(outcome.maxAbsoluteDifference)}${outcome.maxKey ? ` at ${outcome.maxKey}` : ''} · max relative Δ ${compactNumber(outcome.maxRelativeDifference)} · ${toleranceText}.`,
          ].join('\n');
          clear(comparisonHead);
          clear(comparisonBody);
          comparisonHead.append(
            node(document, 'tr', {}, [
              comparisonCell('th', 'Value', false, 'col'),
              comparisonCell('th', 'CPU', true, 'col'),
              comparisonCell('th', selectedExecutor, true, 'col'),
              comparisonCell('th', '|Δ|', true, 'col'),
            ]),
          );
          rows.forEach((row) => {
            comparisonBody.append(
              node(document, 'tr', {}, [
                comparisonCell('th', row.key, false, 'row'),
                comparisonCell('td', compactNumber(row.cpuValue), true),
                comparisonCell('td', compactNumber(row.chosenValue), true),
                comparisonCell('td', compactNumber(row.difference), true),
              ]),
            );
          });
          exactComparisonValues.textContent = [
            `Tolerance: absolute ${tolerance.absolute}; relative ${tolerance.relative}; relative floor ${tolerance.relativeFloor || 0}`,
            `Compared ${outcome.keys.length} values; max absolute difference ${outcome.maxAbsoluteDifference}; max relative difference ${outcome.maxRelativeDifference}${outcome.maxKey ? ` at ${outcome.maxKey}` : ''}; within tolerance ${outcome.withinTolerance}.`,
            ...rows.map((row) => row.exact),
          ].join('\n');
          const info = describeAlgorithm(selectedOperation, chosen);
          cy.emphasize(info.highlight);
          status.textContent = `${selectedOperation} CPU vs ${selectedExecutor} comparison completed: ${outcome.withinTolerance ? 'within' : 'outside'} tolerance across ${outcome.keys.length} values.`;
        } catch (error) {
          if (!disposed && token === runToken) {
            comparison.textContent = `${error?.name || 'Error'}: ${error?.message || error}`;
            status.textContent = `CPU vs ${selectedExecutor} comparison failed: ${error?.name || 'Error'}: ${error?.message || error}`;
          }
        } finally {
          finishControls(token);
        }
      },
    );

    function updateExecutors() {
      const supported = byId[operation.value].executors;
      const previous = param(
        new URLSearchParams(root.window?.location?.search || ''),
        'workflowExecutor',
        'cpu',
        supported,
      );

      clear(executor);
      supported.forEach((name) =>
        executor.append(node(document, 'option', { value: name, text: name })),
      );
      executor.value =
        previous || (supported.includes('cpu') ? 'cpu' : supported[0]);
      updateCompareEnabled();
      saveAlgorithmInputs();
    }

    operation.addEventListener('change', updateExecutors);
    executor.addEventListener('change', () => {
      saveAlgorithmInputs();
      updateCompareEnabled();
    });
    from.addEventListener('change', saveAlgorithmInputs);
    to.addEventListener('change', saveAlgorithmInputs);
    repeats.addEventListener('change', saveAlgorithmInputs);
    repeats.addEventListener('input', saveAlgorithmInputs);
    saveAlgorithmInputs();
    updateCompareEnabled();
    container.append(
      randomnessNote,
      node(document, 'div', { className: 'feature-workflow-controls' }, [
        field(document, 'Operation', operation),
        field(document, 'Executor', executor),
        field(document, 'Root example', from),
        field(document, 'Goal example', to),
        field(document, 'Async repeat count (cancel recipe)', repeats),
        runButton,
        compareButton,
        cancel,
        button(document, 'Clear result highlight', () => cy.unemphasize()),
      ]),
      status,
      detail,
      comparisonReport,
    );

    return () => {
      disposed = true;
      runToken++;
      activeRun?.cancel?.();
      activeRun = null;
      operation.removeEventListener('change', updateExecutors);
      executor.removeEventListener('change', saveAlgorithmInputs);
      from.removeEventListener('change', saveAlgorithmInputs);
      to.removeEventListener('change', saveAlgorithmInputs);
      repeats.removeEventListener('change', saveAlgorithmInputs);
      repeats.removeEventListener('input', saveAlgorithmInputs);
      cy.unemphasize();
    };
  }

  const api = {
    algorithms: ALGORITHMS,
    numericComparisons: [...NUMERIC_COMPARISONS],
    runAlgorithm,
    describeAlgorithm,
    numericAlgorithmValues,
    compareNumericValues,
    comparisonTolerance,
    mountControls: mountAlgorithms,
  };
  root.featureWorkflowAlgorithms = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);

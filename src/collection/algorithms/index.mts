import * as util from '../../util/index.mjs';
import bfsDfs from './bfs-dfs.mjs';
import dijkstra from './dijkstra.mjs';
import kruskal from './kruskal.mjs';
import aStar from './a-star.mjs';
import floydWarshall from './floyd-warshall.mjs';
import bellmanFord from './bellman-ford.mjs';
import kargerStein from './karger-stein.mjs';
import pageRank from './page-rank.mjs';
import degreeCentrality from './degree-centrality.mjs';
import closenessCentrality from './closeness-centrality.mjs';
import betweennessCentrality from './betweenness-centrality.mjs';
import markovClustering from './markov-clustering.mjs';
import kClustering from './k-clustering.mjs';
import hierarchicalClustering from './hierarchical-clustering.mjs';
import affinityPropagation from './affinity-propagation.mjs';
import hierholzer from './hierholzer.mjs';
import hopcroftTarjanBiconnected from './hopcroft-tarjan-biconnected.mjs';
import tarjanStronglyConnected from './tarjan-strongly-connected.mjs';

import type { AlgorithmsBfsDfs } from './bfs-dfs.mjs';
import type { AlgorithmsDijkstra } from './dijkstra.mjs';
import type { AlgorithmsKruskal } from './kruskal.mjs';
import type { AlgorithmsAStar } from './a-star.mjs';
import type { AlgorithmsFloydWarshall } from './floyd-warshall.mjs';
import type { AlgorithmsBellmanFord } from './bellman-ford.mjs';
import type { AlgorithmsKargerStein } from './karger-stein.mjs';
import type { AlgorithmsPageRank } from './page-rank.mjs';
import type { AlgorithmsDegreeCentrality } from './degree-centrality.mjs';
import type { AlgorithmsClosenessCentrality } from './closeness-centrality.mjs';
import type { AlgorithmsBetweennessCentrality } from './betweenness-centrality.mjs';
import type { AlgorithmsMarkovClustering } from './markov-clustering.mjs';
import type { AlgorithmsKClustering } from './k-clustering.mjs';
import type { AlgorithmsHierarchicalClustering } from './hierarchical-clustering.mjs';
import type { AlgorithmsAffinityPropagation } from './affinity-propagation.mjs';
import type { AlgorithmsHierholzer } from './hierholzer.mjs';
import type { AlgorithmsHopcroftTarjanBiconnected } from './hopcroft-tarjan-biconnected.mjs';
import type { AlgorithmsTarjanStronglyConnected } from './tarjan-strongly-connected.mjs';

/** All graph-algorithm methods contributed to the collection prototype. */
export interface CollectionAlgorithms extends
  AlgorithmsBfsDfs,
  AlgorithmsDijkstra,
  AlgorithmsKruskal,
  AlgorithmsAStar,
  AlgorithmsFloydWarshall,
  AlgorithmsBellmanFord,
  AlgorithmsKargerStein,
  AlgorithmsPageRank,
  AlgorithmsDegreeCentrality,
  AlgorithmsClosenessCentrality,
  AlgorithmsBetweennessCentrality,
  AlgorithmsMarkovClustering,
  AlgorithmsKClustering,
  AlgorithmsHierarchicalClustering,
  AlgorithmsAffinityPropagation,
  AlgorithmsHierholzer,
  AlgorithmsHopcroftTarjanBiconnected,
  AlgorithmsTarjanStronglyConnected {}

let elesfn = {} as CollectionAlgorithms;

[
  bfsDfs,
  dijkstra,
  kruskal,
  aStar,
  floydWarshall,
  bellmanFord,
  kargerStein,
  pageRank,
  degreeCentrality,
  closenessCentrality,
  betweennessCentrality,
  markovClustering,
  kClustering,
  hierarchicalClustering,
  affinityPropagation,
  hierholzer,
  hopcroftTarjanBiconnected,
  tarjanStronglyConnected
].forEach(function(props) {
  util.extend(elesfn, props);
});

export default elesfn;

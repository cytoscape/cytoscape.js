import * as util from '../../util';
import bfsDfs from './bfs-dfs';
import dijkstra from './dijkstra';
import kruskal from './kruskal';
import aStar from './a-star';
import floydWarshall from './floyd-warshall';
import bellmanFord from './bellman-ford';
import kergerStein from './kerger-stein';
import pageRank from './page-rank';
import degreeCentrality from './degree-centrality';
import closenessCentrality from './closeness-centrality';
import betweennessCentrality from './betweenness-centrality';

var elesfn = {};

[
  bfsDfs,
  dijkstra,
  kruskal,
  aStar,
  floydWarshall,
  bellmanFord,
  kergerStein,
  pageRank,
  degreeCentrality,
  closenessCentrality,
  betweennessCentrality
].forEach( function( props ){
  util.extend( elesfn, props );
} );

export default elesfn;

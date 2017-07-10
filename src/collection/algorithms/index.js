var util = require( '../../util' );

var elesfn = {};

[
  require( './bfs-dfs' ),
  require( './dijkstra' ),
  require( './kruskal' ),
  require( './a-star' ),
  require( './floyd-warshall' ),
  require( './bellman-ford' ),
  require( './kerger-stein' ),
  require( './page-rank' ),
  require( './degree-centrality' ),
  require( './closeness-centrality' ),
  require( './betweenness-centrality' )
].forEach( function( props ){
  util.extend( elesfn, props );
} );

module.exports = elesfn;

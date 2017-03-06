var def = function( specdVal, defVal ){
  return specdVal !== undefined ? specdVal : defVal;
};

module.exports = function( opts ){
  opts = opts || {};

  var nNodes = def( opts.nodes, 2 );
  var nEdges = def( opts.edges, 1 );

  var generateNode = def( opts.generateNode, function(){
    return {};
  } );

  var generateEdge = def( opts.generateEdge, function( src, tgt ){
    return {
      data: { source: src.data.id, target: tgt.data.id }
    };
  } );

  var nodes = [];
  var edges = [];

  var i;
  var src, tgt;

  var randNode = function(){
    var index = Math.round( Math.random() * ( nNodes - 1 ) );

    return nodes[ index ];
  };

  for( i = 0; i < nNodes; i++ ){
    nodes.push( generateNode() );
  }

  for( i = 0; i < nEdges; i++ ){
    src = randNode();
    tgt = randNode();

    edges.push( generateEdge( src, tgt ) );
  }

  return {
    nodes: nodes,
    edges: edges
  };
};

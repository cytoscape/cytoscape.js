var is = require( '../../is' );

var defineSearch = function( params ){
  params = {
    bfs: params.bfs || !params.dfs,
    dfs: params.dfs || !params.bfs
  };

  // from pseudocode on wikipedia
  return function searchFn( roots, fn, directed ){
    var options;
    if( is.plainObject( roots ) && !is.elementOrCollection( roots ) ){
      options = roots;
      roots = options.roots || options.root;
      fn = options.visit;
      directed = options.directed;
    }

    directed = arguments.length === 2 && !is.fn( fn ) ? fn : directed;
    fn = is.fn( fn ) ? fn : function(){};

    var cy = this._private.cy;
    var v = roots = is.string( roots ) ? this.filter( roots ) : roots;
    var Q = [];
    var connectedNodes = [];
    var connectedBy = {};
    var id2depth = {};
    var V = {};
    var j = 0;
    var found;
    var nodes = this.nodes();
    var edges = this.edges();

    // enqueue v
    for( var i = 0; i < v.length; i++ ){
      if( v[ i ].isNode() ){
        Q.unshift( v[ i ] );

        if( params.bfs ){
          V[ v[ i ].id() ] = true;

          connectedNodes.push( v[ i ] );
        }

        id2depth[ v[ i ].id() ] = 0;
      }
    }

    while( Q.length !== 0 ){
      var v = params.bfs ? Q.shift() : Q.pop();

      if( params.dfs ){
        if( V[ v.id() ] ){ continue; }

        V[ v.id() ] = true;

        connectedNodes.push( v );
      }

      var depth = id2depth[ v.id() ];
      var prevEdge = connectedBy[ v.id() ];
      var prevNode = prevEdge == null ? undefined : prevEdge.connectedNodes().not( v )[0];
      var ret;

      ret = fn( v, prevEdge, prevNode, j++, depth );

      if( ret === true ){
        found = v;
        break;
      }

      if( ret === false ){
        break;
      }

      var vwEdges = v.connectedEdges( directed ? function( ele ){ return ele.data( 'source' ) === v.id(); } : undefined ).intersect( edges );
      for( var i = 0; i < vwEdges.length; i++ ){
        var e = vwEdges[ i ];
        var w = e.connectedNodes( function( n ){ return n.id() !== v.id(); } ).intersect( nodes );

        if( w.length !== 0 && !V[ w.id() ] ){
          w = w[0];

          Q.push( w );

          if( params.bfs ){
            V[ w.id() ] = true;

            connectedNodes.push( w );
          }

          connectedBy[ w.id() ] = e;

          id2depth[ w.id() ] = id2depth[ v.id() ] + 1;
        }
      }

    }

    var connectedEles = [];

    for( var i = 0; i < connectedNodes.length; i++ ){
      var node = connectedNodes[ i ];
      var edge = connectedBy[ node.id() ];

      if( edge ){
        connectedEles.push( edge );
      }

      connectedEles.push( node );
    }

    return {
      path: cy.collection( connectedEles, { unique: true } ),
      found: cy.collection( found )
    };
  };
};

// search, spanning trees, etc
var elesfn = ({
  breadthFirstSearch: defineSearch( { bfs: true } ),
  depthFirstSearch: defineSearch( { dfs: true } )
});

// nice, short mathemathical alias
elesfn.bfs = elesfn.breadthFirstSearch;
elesfn.dfs = elesfn.depthFirstSearch;

module.exports = elesfn;

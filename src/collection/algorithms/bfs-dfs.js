'use strict';

var is = require( '../../is' );
var Heap = require( '../../heap' );

var defineSearch = function( params ){
  params = {
    bfs: params.bfs || !params.dfs,
    dfs: params.dfs || !params.bfs
  };

  // from pseudocode on wikipedia
  return function searchFn( roots, fn, directed ){
    var options;
    var std;
    var thisArg;
    if( is.plainObject( roots ) && !is.elementOrCollection( roots ) ){
      options = roots;
      roots = options.roots || options.root;
      fn = options.visit;
      directed = options.directed;
      std = options.std;
      thisArg = options.thisArg;
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

      if( std ){
        ret = fn.call( thisArg, v, prevEdge, prevNode, j++, depth );
      } else {
        ret = fn.call( v, j++, depth, v, prevEdge, prevNode );
      }

      if( ret === true ){
        found = v;
        break;
      }

      if( ret === false ){
        break;
      }

      var vwEdges = v.connectedEdges( directed ? function(){ return this.data( 'source' ) === v.id(); } : undefined ).intersect( edges );
      for( var i = 0; i < vwEdges.length; i++ ){
        var e = vwEdges[ i ];
        var w = e.connectedNodes( function(){ return this.id() !== v.id(); } ).intersect( nodes );

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
  depthFirstSearch: defineSearch( { dfs: true } ),

  // kruskal's algorithm (finds min spanning tree, assuming undirected graph)
  // implemented from pseudocode from wikipedia
  kruskal: function( weightFn ){
    var cy = this.cy();

    weightFn = is.fn( weightFn ) ? weightFn : function(){ return 1; }; // if not specified, assume each edge has equal weight (1)

    function findSet( ele ){
      for( var i = 0; i < forest.length; i++ ){
        var eles = forest[ i ];

        if( eles.anySame( ele ) ){
          return {
            eles: eles,
            index: i
          };
        }
      }
    }

    var A = cy.collection( cy, [] );
    var forest = [];
    var nodes = this.nodes();

    for( var i = 0; i < nodes.length; i++ ){
      forest.push( nodes[ i ].collection() );
    }

    var edges = this.edges();
    var S = edges.toArray().sort( function( a, b ){
      var weightA = weightFn.call( a, a );
      var weightB = weightFn.call( b, b );

      return weightA - weightB;
    } );

    for( var i = 0; i < S.length; i++ ){
      var edge = S[ i ];
      var u = edge.source()[0];
      var v = edge.target()[0];
      var setU = findSet( u );
      var setV = findSet( v );

      if( setU.index !== setV.index ){
        A = A.add( edge );

        // combine forests for u and v
        forest[ setU.index ] = setU.eles.add( setV.eles );
        forest.splice( setV.index, 1 );
      }
    }

    return nodes.add( A );

  },

  dijkstra: function( root, weightFn, directed ){
    var options;
    if( is.plainObject( root ) && !is.elementOrCollection( root ) ){
      options = root;
      root = options.root;
      weightFn = options.weight;
      directed = options.directed;
    }

    var cy = this._private.cy;
    weightFn = is.fn( weightFn ) ? weightFn : function(){ return 1; }; // if not specified, assume each edge has equal weight (1)

    var source = is.string( root ) ? this.filter( root )[0] : root[0];
    var dist = {};
    var prev = {};
    var knownDist = {};

    var edges = this.edges().filter( function(){ return !this.isLoop(); } );
    var nodes = this.nodes();

    var getDist = function( node ){
      return dist[ node.id() ];
    };

    var setDist = function( node, d ){
      dist[ node.id() ] = d;

      Q.updateItem( node );
    };

    var Q = new Heap( function( a, b ){
      return getDist( a ) - getDist( b );
    } );

    for( var i = 0; i < nodes.length; i++ ){
      var node = nodes[ i ];

      dist[ node.id() ] = node.same( source ) ? 0 : Infinity;
      Q.push( node );
    }

    var distBetween = function( u, v ){
      var uvs = ( directed ? u.edgesTo( v ) : u.edgesWith( v ) ).intersect( edges );
      var smallestDistance = Infinity;
      var smallestEdge;

      for( var i = 0; i < uvs.length; i++ ){
        var edge = uvs[ i ];
        var weight = weightFn.apply( edge, [ edge ] );

        if( weight < smallestDistance || !smallestEdge ){
          smallestDistance = weight;
          smallestEdge = edge;
        }
      }

      return {
        edge: smallestEdge,
        dist: smallestDistance
      };
    };

    while( Q.size() > 0 ){
      var u = Q.pop();
      var smalletsDist = getDist( u );
      var uid = u.id();

      knownDist[ uid ] = smalletsDist;

      if( smalletsDist === Math.Infinite ){
        break;
      }

      var neighbors = u.neighborhood().intersect( nodes );
      for( var i = 0; i < neighbors.length; i++ ){
        var v = neighbors[ i ];
        var vid = v.id();
        var vDist = distBetween( u, v );

        var alt = smalletsDist + vDist.dist;

        if( alt < getDist( v ) ){
          setDist( v, alt );

          prev[ vid ] = {
            node: u,
            edge: vDist.edge
          };
        }
      } // for
    } // while

    return {
      distanceTo: function( node ){
        var target = is.string( node ) ? nodes.filter( node )[0] : node[0];

        return knownDist[ target.id() ];
      },

      pathTo: function( node ){
        var target = is.string( node ) ? nodes.filter( node )[0] : node[0];
        var S = [];
        var u = target;

        if( target.length > 0 ){
          S.unshift( target );

          while( prev[ u.id() ] ){
            var p = prev[ u.id() ];

            S.unshift( p.edge );
            S.unshift( p.node );

            u = p.node;
          }
        }

        return cy.collection( S );
      }
    };
  }
});

// nice, short mathemathical alias
elesfn.bfs = elesfn.breadthFirstSearch;
elesfn.dfs = elesfn.depthFirstSearch;

module.exports = elesfn;

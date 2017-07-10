var is = require( '../../is' );
var Heap = require( '../../heap' );

var elesfn = ({

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

    var edges = this.edges().filter( function( ele ){ return !ele.isLoop(); } );
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
        var weight = weightFn( edge );

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

      if( smalletsDist === Infinity ){
        continue;
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

module.exports = elesfn;

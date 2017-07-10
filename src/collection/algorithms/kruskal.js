var is = require( '../../is' );

// search, spanning trees, etc
var elesfn = ({

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
      var weightA = weightFn( a );
      var weightB = weightFn( b );

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
  }
});

module.exports = elesfn;

'use strict';

var is = require( '../../is' );
var Heap = require( '../../heap' );

var elesfn = ({

  // Implemented from the algorithm in the paper "On Variants of Shortest-Path Betweenness Centrality and their Generic Computation" by Ulrik Brandes
  betweennessCentrality: function( options ){
    options = options || {};

    // Weight - optional
    var weighted, weightFn;
    if( is.fn( options.weight ) ){
      weightFn = options.weight;
      weighted = true;
    } else {
      weighted = false;
    }

    // Directed - default false
    var directed = options.directed != null ? options.directed : false;

    var cy = this._private.cy;

    // starting
    var V = this.nodes();
    var A = {};
    var _C = {};
    var max;
    var C = {
      set: function( key, val ){
        _C[ key ] = val;

        if( val > max ){ max = val; }
      },

      get: function( key ){ return _C[ key ]; }
    };

    // A contains the neighborhoods of every node
    for( var i = 0; i < V.length; i++ ){
      var v = V[ i ];
      var vid = v.id();

      if( directed ){
        A[ vid ] = v.outgoers().nodes(); // get outgoers of every node
      } else {
        A[ vid ] = v.openNeighborhood().nodes(); // get neighbors of every node
      }

      C.set( vid, 0 );
    }

    for( var s = 0; s < V.length; s++ ){
      var sid = V[s].id();
      var S = []; // stack
      var P = {};
      var g = {};
      var d = {};
      var Q = new Heap(function( a, b ){
        return d[a] - d[b];
      }); // queue

      // init dictionaries
      for( var i = 0; i < V.length; i++ ){
        var vid = V[ i ].id();

        P[ vid ] = [];
        g[ vid ] = 0;
        d[ vid ] = Infinity;
      }

      g[ sid ] = 1; // sigma
      d[ sid ] = 0; // distance to s

      Q.push( sid );

      while( !Q.empty() ){
        var v = Q.pop();

        S.push( v );

        if( weighted ){
          for( var j = 0; j < A[v].length; j++ ){
            var w = A[v][j];
            var vEle = cy.getElementById( v );

            var edge;
            if( vEle.edgesTo( w ).length > 0 ){
              edge = vEle.edgesTo( w )[0];
            } else {
              edge = w.edgesTo( vEle )[0];
            }

            var edgeWeight = weightFn.apply( edge, [ edge ] );

            w = w.id();

            if( d[w] > d[v] + edgeWeight ){
              d[w] = d[v] + edgeWeight;

              if( Q.nodes.indexOf( w ) < 0 ){ //if w is not in Q
                Q.push( w );
              } else { // update position if w is in Q
                Q.updateItem( w );
              }

              g[w] = 0;
              P[w] = [];
            }

            if( d[w] == d[v] + edgeWeight ){
              g[w] = g[w] + g[v];
              P[w].push( v );
            }
          }
        } else {
          for( var j = 0; j < A[v].length; j++ ){
            var w = A[v][j].id();

            if( d[w] == Infinity ){
              Q.push( w );

              d[w] = d[v] + 1;
            }

            if( d[w] == d[v] + 1 ){
              g[w] = g[w] + g[v];
              P[w].push( v );
            }
          }
        }
      }

      var e = {};
      for( var i = 0; i < V.length; i++ ){
        e[ V[ i ].id() ] = 0;
      }

      while( S.length > 0 ){
        var w = S.pop();

        for( var j = 0; j < P[w].length; j++ ){
          var v = P[w][j];

          e[v] = e[v] + (g[v] / g[w]) * (1 + e[w]);

          if( w != V[s].id() ){
            C.set( w, C.get( w ) + e[w] );
          }
        }
      }
    }

    var ret = {
      betweenness: function( node ){
        if( is.string( node ) ){
          var node = cy.filter( node ).id();
        } else {
          var node = node.id();
        }

        return C.get( node );
      },

      betweennessNormalized: function( node ){
        if( is.string( node ) ){
          var node = cy.filter( node ).id();
        } else {
          var node = node.id();
        }

        return C.get( node ) / max;
      }
    };

    // alias
    ret.betweennessNormalised = ret.betweennessNormalized;

    return ret;
  } // betweennessCentrality

}); // elesfn

// nice, short mathemathical alias
elesfn.bc = elesfn.betweennessCentrality;

module.exports = elesfn;

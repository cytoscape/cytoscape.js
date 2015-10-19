'use strict';

var is = require('../../is');
var util = require('../../util');

var elesfn = ({

  // Implemented from the algorithm in the paper "On Variants of Shortest-Path Betweenness Centrality and their Generic Computation" by Ulrik Brandes
  betweennessCentrality: function (options) {
    options = options || {};

    // Weight - optional
    if (options.weight != null && is.fn(options.weight)) {
      var weightFn = options.weight;
      var weighted = true;
    } else {
      var weighted = false;
    }

    // Directed - default false
    if (options.directed != null && is.bool(options.directed)) {
      var directed = options.directed;
    } else {
      var directed = false;
    }

    var priorityInsert = function (queue, ele) {
      queue.unshift(ele);
      for (var i = 0; d[queue[i]] < d[queue[i + 1]] && i < queue.length - 1; i++) {
        var tmp = queue[i];
        queue[i] = queue[i + 1];
        queue[i + 1] = tmp;
      }
    };

    var cy = this._private.cy;

    // starting
    var V = this.nodes();
    var A = {};
    var C = {};

    // A contains the neighborhoods of every node
    for (var i = 0; i < V.length; i++) {
      if (directed) {
        A[V[i].id()] = V[i].outgoers("node"); // get outgoers of every node
      } else {
        A[V[i].id()] = V[i].openNeighborhood("node"); // get neighbors of every node
      }
    }

    // C contains the betweenness values
    for (var i = 0; i < V.length; i++) {
      C[V[i].id()] = 0;
    }

    for (var s = 0; s < V.length; s++) {
      var S = []; // stack
      var P = {};
      var g = {};
      var d = {};
      var Q = []; // queue

      // init dictionaries
      for (var i = 0; i < V.length; i++) {
        P[V[i].id()] = [];
        g[V[i].id()] = 0;
        d[V[i].id()] = Number.POSITIVE_INFINITY;
      }

      g[V[s].id()] = 1; // sigma
      d[V[s].id()] = 0; // distance to s

      Q.unshift(V[s].id());

      while (Q.length > 0) {
        var v = Q.pop();
        S.push(v);
        if (weighted) {
          A[v].forEach(function (w) {
            if (cy.$('#' + v).edgesTo(w).length > 0) {
              var edge = cy.$('#' + v).edgesTo(w)[0];
            } else {
              var edge = w.edgesTo('#' + v)[0];
            }

            var edgeWeight = weightFn.apply(edge, [edge]);

            if (d[w.id()] > d[v] + edgeWeight) {
              d[w.id()] = d[v] + edgeWeight;
              if (Q.indexOf(w.id()) < 0) { //if w is not in Q
                priorityInsert(Q, w.id());
              } else { // update position if w is in Q
                Q.splice(Q.indexOf(w.id()), 1);
                priorityInsert(Q, w.id());
              }
              g[w.id()] = 0;
              P[w.id()] = [];
            }
            if (d[w.id()] == d[v] + edgeWeight) {
              g[w.id()] = g[w.id()] + g[v];
              P[w.id()].push(v);
            }
          });
        } else {
          A[v].forEach(function (w) {
            if (d[w.id()] == Number.POSITIVE_INFINITY) {
              Q.unshift(w.id());
              d[w.id()] = d[v] + 1;
            }
            if (d[w.id()] == d[v] + 1) {
              g[w.id()] = g[w.id()] + g[v];
              P[w.id()].push(v);
            }
          });
        }
      }

      var e = {};
      for (var i = 0; i < V.length; i++) {
        e[V[i].id()] = 0;
      }

      while (S.length > 0) {
        var w = S.pop();
        P[w].forEach(function (v) {
          e[v] = e[v] + (g[v] / g[w]) * (1 + e[w]);
          if (w != V[s].id())
            C[w] = C[w] + e[w];
        });
      }
    }

    var max = 0;
    for (var key in C) {
      if (max < C[key])
        max = C[key];
    }

    var ret = {
      betweenness: function (node) {
        if (is.string(node)) {
          var node = (cy.filter(node)[0]).id();
        } else {
          var node = node.id();
        }

        return C[node];
      },

      betweennessNormalized: function (node) {
        if (is.string(node)) {
          var node = (cy.filter(node)[0]).id();
        } else {
          var node = node.id();
        }

        return C[node] / max;
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

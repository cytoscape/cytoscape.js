;(function($$){ 'use strict';

  // search, spanning trees, etc
  $$.fn.eles({

    // do a breadth first search from the nodes in the collection
    // from pseudocode on wikipedia
    breadthFirstSearch: function( roots, fn, directed ){
      directed = arguments.length === 1 && !$$.is.fn(fn) ? fn : directed;
      fn = $$.is.fn(fn) ? fn : function(){};
      var cy = this._private.cy;
      var v = $$.is.string(roots) ? this.filter(roots) : roots;
      var Q = [];
      var connectedEles = [];
      var connectedFrom = {};
      var id2depth = {};
      var V = {};
      var j = 0;
      var found;
      var nodes = this.nodes();
      var edges = this.edges();

      // enqueue v
      for( var i = 0; i < v.length; i++ ){
        if( v[i].isNode() ){
          Q.unshift( v[i] );
          V[ v[i].id() ] = true; 

          connectedEles.push( v[i] );
          id2depth[ v[i].id() ] = 0;
        }
      }

      while( Q.length !== 0 ){
        var v = Q.shift();
        var depth = id2depth[ v.id() ];
        var ret = fn.call(v, j++, depth);

        if( ret === true ){
          found = v;
          break;
        }

        if( ret === false ){
          break;
        }

        var vwEdges = v.connectedEdges(directed ? '[source = "' + v.id() + '"]' : undefined).intersect( edges );
        for( var i = 0; i < vwEdges.length; i++ ){
          var e = vwEdges[i];
          var w = e.connectedNodes('[id != "' + v.id() + '"]').intersect( nodes );

          if( w.length !== 0 && !V[ w.id() ] ){
            w = w[0];

            Q.push( w );
            V[ w.id() ] = true;

            id2depth[ w.id() ] = id2depth[ v.id() ] + 1;

            connectedEles.push( w );
            connectedEles.push( e );
          }
        }
        
      }

      return {
        path: new $$.Collection( cy, connectedEles ),
        found: new $$.Collection( cy, found )
      };
    },

    // do a depth first search on the nodes in the collection
    // from pseudocode on wikipedia (iterative impl)
    depthFirstSearch: function( roots, fn, directed ){
      directed = arguments.length === 1 && !$$.is.fn(fn) ? fn : directed;
      fn = $$.is.fn(fn) ? fn : function(){};
      var cy = this._private.cy;
      var v = $$.is.string(roots) ? this.filter(roots) : roots;
      var S = [];
      var connectedNodes = [];
      var connectedBy = {};
      var id2depth = {};
      var discovered = {};
      var j = 0;
      var found;
      var edges = this.edges();
      var nodes = this.nodes();

      // push v
      for( var i = 0; i < v.length; i++ ){
        if( v[i].isNode() ){
          S.push( v[i] );

          connectedNodes.push( v[i] );
          id2depth[ v[i].id() ] = 0;
        }
      }

      while( S.length !== 0 ){
        var v = S.pop();

        if( !discovered[ v.id() ] ){
          discovered[ v.id() ] = true;

          var depth = id2depth[ v.id() ];

          var ret = fn.call(v, j++, depth);

          if( ret === true ){
            found = v;
            break;
          }

          if( ret === false ){
            break;
          }

          var vwEdges = v.connectedEdges(directed ? '[source = "' + v.id() + '"]' : undefined).intersect( edges );
          
          for( var i = 0; i < vwEdges.length; i++ ){
            var e = vwEdges[i];
            var w = e.connectedNodes('[id != "' + v.id() + '"]').intersect( nodes );

            if( w.length !== 0 && !discovered[ w.id() ] ){
              w = w[0];

              S.push( w );

              id2depth[ w.id() ] = id2depth[ v.id() ] + 1;

              connectedNodes.push( w );
              connectedBy[ w.id() ] = e;
            }
          }
        }
      }

      var connectedEles = [];

      for( var i = 0; i < connectedNodes.length; i++ ){
        var node = connectedNodes[i];
        var edge = connectedBy[ node.id() ];

        if( edge ){
          connectedEles.push( edge );
        }

        connectedEles.push( node );
      }

      return {
        path: new $$.Collection( cy, connectedEles ),
        found: new $$.Collection( cy, found )
      }
    },

    // kruskal's algorithm (finds min spanning tree, assuming undirected graph)
    // implemented from pseudocode from wikipedia
    kruskal: function( weightFn ){
      weightFn = $$.is.fn(weightFn) ? weightFn : function(){ return 1; }; // if not specified, assume each edge has equal weight (1)

      function findSet(ele){
        for( var i = 0; i < forest.length; i++ ){
          var eles = forest[i];

          if( eles.anySame(ele) ){
            return {
              eles: eles,
              index: i
            };
          }
        }
      }

      var A = new $$.Collection(this._private.cy, []);
      var forest = [];
      var nodes = this.nodes();

      for( var i = 0; i < nodes.length; i++ ){
        forest.push( nodes[i].collection() );
      }

      var edges = this.edges();
      var S = edges.toArray().sort(function(a, b){
        var weightA = weightFn.call(a);
        var weightB = weightFn.call(b);

        return weightA - weightB;
      });

      for(var i = 0; i < S.length; i++){
        var edge = S[i];
        var u = edge.source()[0];
        var v = edge.target()[0];
        var setU = findSet(u);
        var setV = findSet(v);

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
      var cy = this._private.cy;
      directed = !$$.is.fn(weightFn) ? weightFn : directed;
      weightFn = $$.is.fn(weightFn) ? weightFn : function(){ return 1; }; // if not specified, assume each edge has equal weight (1)

      var source = $$.is.string(root) ? this.filter(root)[0] : root[0];
      var dist = {};
      var prev = {};

      var edges = this.edges().not(':loop');
      var nodes = this.nodes();
      var Q = [];
      for( var i = 0; i < nodes.length; i++ ){
        dist[ nodes[i].id() ] = Infinity;
        Q.push( nodes[i] );
      }

      dist[ source.id() ] = 0;

      var remove = function(Q, node){
        for( var i = 0; i < Q.length; i++ ){
          var n = Q[i];

          if( n.id() === node.id() ){
            Q.splice(i, 1);
            return;
          }
        }
      };

      var smallestDistNode = function(Q){
        var smallest = Infinity;
        var index;
        var node;

        for( var i = 0; i < Q.length; i++ ){
          var n = Q[i];
          var id = n.id();
          var d = dist[ id ];

          if( d < smallest || !node ){
            smallest = d;
            index = i;
            node = n;
          }
        }

        return {
          index: index,
          node: node,
          dist: smallest
        };
      };

      var distBetween = function(u, v){
        var uvs = ( directed ? u.edgesTo(v) : u.edgesWith(v) ).intersect(edges);
        var smallestDistance = Infinity;
        var smallestEdge;

        for( var i = 0; i < uvs.length; i++ ){
          var edge = uvs[i];
          var weight = weightFn.call(edge);

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

      var decreaseKey = function(Q, v){
        for( var i = 0; i < Q.length; i++ ){
          var q = Q[i];

          if( q.id() === v.id() ){
            if( i > 0 ){
              Q.splice(i, 1);
              Q.splice(i - 1, 0, v);
            }
            break;
          }
        }
      };

      while( Q.length !== 0 ){
        var smallestDist = smallestDistNode(Q);
        var u = smallestDist.node;
        var uid = u.id();

        remove(Q, u);

        if( dist[uid] === Math.Infinite ){
          break;
        }

        var neighbors = u.neighborhood().intersect(nodes);
        for( var i = 0; i < neighbors.length; i++ ){
          var v = neighbors[i];
          var vid = v.id();
          var vDist = distBetween(u, v);

          var alt = dist[ uid ] + vDist.dist;

          if( alt < dist[vid] ){
            dist[vid] = alt;
            prev[ vid ] = {
              node: u,
              edge: vDist.edge
            };
            decreaseKey(Q, v);
          }
        }
      }

      return {
        distanceTo: function(node){
          var target = $$.is.string(node) ? nodes.filter(node)[0] : node[0];

          return dist[ target.id() ];
        },

        pathTo: function(node){
          var target = $$.is.string(node) ? nodes.filter(node)[0] : node[0];
          var S = [];
          var u = target;

          S.unshift( target );

          while( prev[ u.id() ] ){
            var p = prev[ u.id() ];

            S.unshift( p.edge );
            S.unshift( p.node );

            u = p.node;
          }

          return new $$.Collection( cy, S );
        }
      };
    }  
  });

  // nice, short mathemathical alias
  $$.elesfn.bfs = $$.elesfn.breadthFirstSearch;
  $$.elesfn.dfs = $$.elesfn.depthFirstSearch;
  
})( cytoscape );
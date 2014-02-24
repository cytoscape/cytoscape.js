;(function($$){ 'use strict';
  
  $$.fn.eles({
    nodes: function(selector){
      return this.filter(function(i, element){
        return element.isNode();
      }).filter(selector);
    },

    edges: function(selector){
      return this.filter(function(i, element){
        return element.isEdge();
      }).filter(selector);
    },

    filter: function(filter){
      var cy = this._private.cy;
      
      if( $$.is.fn(filter) ){
        var elements = [];

        for( var i = 0; i < this.length; i++ ){
          var ele = this[i];

          if( filter.apply(ele, [i, ele]) ){
            elements.push(ele);
          }
        }
        
        return new $$.Collection(cy, elements);
      
      } else if( $$.is.string(filter) || $$.is.elementOrCollection(filter) ){
        return new $$.Selector(filter).filter(this);
      
      } else if( filter === undefined ){
        return this;
      }

      return new $$.Collection( cy ); // if not handled by above, give 'em an empty collection
    },

    not: function(toRemove){
      var cy = this._private.cy;

      if( !toRemove ){
        return this;
      } else {
      
        if( $$.is.string( toRemove ) ){
          toRemove = this.filter( toRemove );
        }
        
        var elements = [];
        
        for( var i = 0; i < this.length; i++ ){
          var element = this[i];

          var remove = toRemove._private.ids[ element.id() ];
          if( !remove ){
            elements.push( element );
          }
        }
        
        return new $$.Collection( cy, elements );
      }
      
    },

    intersect: function( other ){
      var self = this;
      var cy = this._private.cy;
      
      // if a selector is specified, then filter by it
      if( $$.is.string(other) ){
        var selector = other;
        return this.filter( selector );
      }
      
      var elements = [];
      var col1 = this;
      var col2 = other;
      var col1Smaller = this.length < other.length;
      var ids1 = col1Smaller ? col1._private.ids : col2._private.ids;
      var ids2 = col1Smaller ? col2._private.ids : col1._private.ids;
      
      for( var id in ids1 ){
        var ele = ids2[ id ];

        if( ele ){
          elements.push( ele );
        }
      }
      
      return new $$.Collection( cy, elements );
    },

    add: function(toAdd){
      var self = this;
      var cy = this._private.cy;    
      
      if( !toAdd ){
        return this;
      }
      
      if( $$.is.string(toAdd) ){
        var selector = toAdd;
        toAdd = cy.elements(selector);
      }
      
      var elements = [];
      var ids = {};
    
      function add(element){
        if( !element ){
          return;
        }
        
        if( !ids[ element.id() ] ){
          elements.push( element );
          ids[ element.id() ] = true;
        }
      }
      
      // add own
      for( var i = 0; i < self.length; i++ ){
        var element = self[i];
        add(element);
      }
      
      // add toAdd
      for( var i = 0; i < toAdd.length; i++ ){
        var element = toAdd[i];
        add(element);
      }
      
      return new $$.Collection(cy, elements);
    }
  });

  $$.fn.eles({
    // get the root nodes in the DAG
    roots: function( selector ){
      var eles = this;
      var roots = [];
      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        if( !ele.isNode() ){
          continue;
        }

        var hasEdgesPointingIn = ele.connectedEdges('[target = "' + ele.id() + '"][source != "' + ele.id() + '"]').length > 0;

        if( !hasEdgesPointingIn ){
          roots.push( ele );
        }
      }

      return new $$.Collection( this._private.cy, roots ).filter( selector );
    },

    // normally called children in graph theory
    // these nodes =edges=> forward nodes
    forwardNodes: function( selector ){
      var eles = this;
      var fNodes = [];

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var eleId = ele.id();

        if( !ele.isNode() ){ continue; }

        var edges = ele._private.edges;
        for( var j = 0; j < edges.length; j++ ){
          var edge = edges[j];
          var srcId = edge._private.data.source;
          var tgtId = edge._private.data.target;

          if( srcId === eleId && tgtId !== eleId ){
            fNodes.push( edge.target()[0] );
          }
        }
      }

      return new $$.Collection( this._private.cy, fNodes ).filter( selector );
    },

    // normally called parents in graph theory
    // these nodes <=edges= backward nodes
    backwardNodes: function( selector ){
      var eles = this;
      var bNodes = [];

      for( var i = 0; i < eles.length; i++ ){
        var ele = eles[i];
        var eleId = ele.id();

        if( !ele.isNode() ){ continue; }

        var edges = ele._private.edges;
        for( var j = 0; j < edges.length; j++ ){
          var edge = edges[j];
          var srcId = edge._private.data.source;
          var tgtId = edge._private.data.target;

          if( tgtId === eleId && srcId !== eleId ){
            bNodes.push( edge.source()[0] );
          }
        }
      }

      return new $$.Collection( this._private.cy, bNodes ).filter( selector );
    }
  });

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



  // Neighbourhood functions
  //////////////////////////

  $$.fn.eles({
    neighborhood: function(selector){
      var elements = [];
      var cy = this._private.cy;
      var nodes = this.nodes();

      for( var i = 0; i < nodes.length; i++ ){ // for all nodes
        var node = nodes[i];
        var connectedEdges = node.connectedEdges();

        // for each connected edge, add the edge and the other node
        for( var j = 0; j < connectedEdges.length; j++ ){
          var edge = connectedEdges[j];
          var otherNode = edge.connectedNodes().not(node);

          // need check in case of loop
          if( otherNode.length > 0 ){
            elements.push( otherNode[0] ); // add node 1 hop away
          }
          
          // add connected edge
          elements.push( edge[0] );
        }

      }
      
      return ( new $$.Collection( cy, elements ) ).filter( selector );
    },

    closedNeighborhood: function(selector){
      return this.neighborhood().add(this).filter(selector);
    },

    openNeighborhood: function(selector){
      return this.neighborhood(selector);
    }
  });  


  // Edge functions
  /////////////////

  $$.fn.eles({
    source: function( selector ){
      var ele = this[0];
      var src;

      if( ele ){
        src = ele._private.source;
      }

      return new $$.Collection( this.cy(), src ).filter( selector );
    },

    target: function( selector ){
      var ele = this[0];
      var tgt;

      if( ele ){
        tgt = ele._private.target;
      }

      return new $$.Collection( this.cy(), tgt ).filter( selector );
    },

    sources: defineSourceFunction({
      attr: 'source'
    }),

    targets: defineSourceFunction({
      attr: 'target'
    })
  });
  
  function defineSourceFunction( params ){
    return function( selector ){
      var sources = [];
      var cy = this._private.cy;

      for( var i = 0; i < this.length; i++ ){
        var ele = this[i];
        var source = ele._private[ params.attr ];

        if( src ){
          sources.push( src );
        }
      }
      
      return new $$.Collection( cy, sources ).filter( selector );
    }
  }

  $$.fn.eles({
    edgesWith: defineEdgesWithFunction(),

    edgesTo: defineEdgesWithFunction({
      thisIs: 'source'
    })
  });
  
  function defineEdgesWithFunction( params ){
    
    return function(otherNodes){
      var elements = [];
      var cy = this._private.cy;
      var p = params || {};

      // get elements if a selector is specified
      if( $$.is.string(otherNodes) ){
        otherNodes = cy.$( otherNodes );
      }
      
      var edges = otherNodes.connectedEdges();
      var thisIds = this._private.ids;
      
      for( var i = 0; i < edges.length; i++ ){
        var edge = edges[i];
        var foundId;
        var edgeData = edge._private.data;

        if( p.thisIs ){
          var idToFind = edgeData[ p.thisIs ];
          foundId = thisIds[ idToFind ];
        } else {
          foundId = thisIds[ edgeData.source ] || thisIds[ edgeData.target ];
        }
        
        if( foundId ){
          elements.push( edge );
        }
      }
      
      return new $$.Collection( cy, elements );
    };
  }
  
  $$.fn.eles({
    connectedEdges: function( selector ){
      var retEles = [];
      var cy = this._private.cy;
      
      var eles = this;
      for( var i = 0; i < eles.length; i++ ){
        var node = eles[i];
        if( !node.isNode() ){ continue; }

        var edges = node._private.edges;

        for( var j = 0; j < edges.length; j++ ){
          var edge = edges[j];          
          retEles.push( edge );
        }
      }
      
      return new $$.Collection( cy, retEles ).filter( selector );
    },

    connectedNodes: function( selector ){
      var retEles = [];
      var cy = this._private.cy;

      var eles = this;
      for( var i = 0; i < eles.length; i++ ){
        var edge = eles[i];
        if( !edge.isEdge() ){ continue; }

        retEles.push( edge.source()[0] );
        retEles.push( edge.target()[0] );
      }

      return new $$.Collection( cy, retEles ).filter( selector );
    },

    parallelEdges: defineParallelEdgesFunction(),

    codirectedEdges: defineParallelEdgesFunction({
      codirected: true
    })
  });
  
  function defineParallelEdgesFunction(params){
    var defaults = {
      codirected: false
    };
    params = $$.util.extend({}, defaults, params);
    
    return function( selector ){
      var cy = this._private.cy;
      var elements = [];
      var edges = this.edges();
      var p = params;

      // look at all the edges in the collection
      for( var i = 0; i < edges.length; i++ ){
        var edge1 = edges[i];
        var src1 = edge1.source()[0];
        var srcid1 = src1.id();
        var tgt1 = edge1.target()[0];
        var tgtid1 = tgt1.id();
        var srcEdges1 = src1._private.edges;

        // look at edges connected to the src node of this edge
        for( var j = 0; j < srcEdges1.length; j++ ){
          var edge2 = srcEdges1[j];
          var edge2data = edge2._private.data;
          var tgtid2 = edge2data.target;
          var srcid2 = edge2data.source;

          var codirected = tgtid2 === tgtid1 && srcid2 === srcid1;
          var oppdirected = srcid1 === tgtid2 && tgtid1 === srcid2;
          
          if( (p.codirected && codirected)
          || (!p.codirected && (codirected || oppdirected)) ){
            elements.push( edge2 );
          }
        }
      }
      
      return new $$.Collection( cy, elements ).filter( selector );
    };
  
  }


  // Compound functions
  /////////////////////

  $$.fn.eles({
    parent: function( selector ){
      var parents = [];
      var cy = this._private.cy;

      for( var i = 0; i < this.length; i++ ){
        var ele = this[i];
        var parent = cy.getElementById( ele._private.data.parent );

        if( parent.size() > 0 ){
          parents.push( parent );
        }
      }
      
      return new $$.Collection( cy, parents ).filter( selector );
    },

    parents: function( selector ){
      var parents = [];

      var eles = this.parent();
      while( eles.nonempty() ){
        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[i];
          parents.push( ele );
        }

        eles = eles.parent();
      }

      return new $$.Collection( this.cy(), parents ).filter( selector );
    },

    children: function( selector ){
      var children = [];

      for( var i = 0; i < this.length; i++ ){
        var ele = this[i];
        children = children.concat( ele._private.children );
      }

      return new $$.Collection( this.cy(), children ).filter( selector );
    },

    siblings: function( selector ){
      return this.parent().children().not( this ).filter( selector );
    },

    isParent: function(){
      var ele = this[0];

      if( ele ){
        return ele._private.children.length !== 0;
      }
    },

    isChild: function(){
      var ele = this[0];

      if( ele ){
        return ele._private.data.parent !== undefined && ele.parent().length !== 0;
      }
    },

    descendants: function( selector ){
      var elements = [];

      function add( eles ){
        for( var i = 0; i < eles.length; i++ ){
          var ele = eles[i];

          elements.push( ele );

          if( ele.children().nonempty() ){
            add( ele.children() );
          }
        }
      }

      add( this.children() );

      return new $$.Collection( this.cy(), elements ).filter( selector );
    }
  });

  // aliases
  $$.fn.eles.ancestors = $$.fn.eles.parents;

  
})( cytoscape );
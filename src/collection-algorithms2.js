;(function($$) { 
  'use strict';

  // Additional graph analysis algorithms
  $$.fn.eles({

    // Implemented from pseudocode from wikipedia

    // options => options object
    //   root // starting node (either element or selector string)
    //   weight: function( edge ){} // specifies weight to use for `edge`/`this`. If not present, it will be asumed a weight of 1 for all edges
    //   heuristic: function( node ){} // specifies heuristic value for `node`/`this`
    //   directed // default false
    //   goal // target node (either element or selector string). Mandatory.

    // retObj => returned object by function
    //   found : true/false // whether a path from root to goal has been found
    //   distance // Distance for the shortest path from root to goal
    //   path // Array of ids of nodes in shortest path
    aStar: function(options) {
      options = options || {};

      var logDebug = function() {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Reconstructs the path from Start to End, acumulating the result in pathAcum
      var reconstructPath = function(start, end, cameFromMap, pathAcum) {
        // Base case
        if (start == end) {
          pathAcum.push( cy.getElementById(end) );
          return pathAcum;
        }
        
        if (end in cameFromMap) {
          // We know which node is before the last one
          var previous = cameFromMap[end];
          var previousEdge = cameFromEdge[end];

          pathAcum.push( cy.getElementById(end) );
          pathAcum.push( cy.getElementById(previousEdge) );


          return reconstructPath(start, 
                       previous, 
                       cameFromMap, 
                       pathAcum);
        }

        // We should not reach here!
        return undefined;       
      };

      // Returns the index of the element in openSet which has minimum fScore
      var findMin = function(openSet, fScore) {
        if (openSet.length === 0) {
          // Should never be the case
          return undefined;
        }
        var minPos = 0;
        var tempScore = fScore[openSet[0]];
        for (var i = 1; i < openSet.length; i++) {
          var s = fScore[openSet[i]];
          if (s < tempScore) {
            tempScore = s;
            minPos = i;
          }
        }
        return minPos;
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }

      logDebug("Starting aStar..."); 
      var cy = this._private.cy;

      // root - mandatory!
      if (options != null && options.root != null) {        
        var source = $$.is.string(options.root) ? 
          // use it as a selector, e.g. "#rootID
          this.filter(options.root)[0] : 
          options.root[0];
        logDebug("Source node: %s", source.id()); 
      } else {
        return undefined;
      }
      
      // goal - mandatory!
      if (options.goal != null) {       
        var target = $$.is.string(options.goal) ? 
          // use it as a selector, e.g. "#goalID
          this.filter(options.goal)[0] : 
          options.goal[0];
        logDebug("Target node: %s", target.id()); 
      } else {
        return undefined;
      }

      // Heuristic function - optional
      if (options.heuristic != null && $$.is.fn(options.heuristic)) {       
        var heuristic = options.heuristic;
      } else {
        var heuristic = function(){ return 0; }; // use constant if unspecified
        // $$.util.error("Missing required parameter (heuristic)! Aborting.");
        // return;
      }

      // Weight function - optional
      if (options.weight != null && $$.is.fn(options.weight)) {       
        var weightFn = options.weight;
      } else {
        // If not specified, assume each edge has equal weight (1)
        var weightFn = function(e) {return 1;};
      }

      // directed - optional
      if (options.directed != null) {       
        var directed = options.directed;
      } else {
        var directed = false;
      }

      var closedSet = [];
      var openSet = [source.id()];
      var cameFrom = {};
      var cameFromEdge = {};
      var gScore = {};
      var fScore = {};

      gScore[source.id()] = 0;
      fScore[source.id()] = heuristic(source);
      
      var edges = this.edges().not(':loop');
      var nodes = this.nodes();

      // Counter
      var steps = 0;

      // Main loop 
      while (openSet.length > 0) {
        var minPos = findMin(openSet, fScore);
        var cMin = this.filter("#" + openSet[minPos])[0];
        steps++;

        logDebug("\nStep: %s", steps);
        logDebug("Processing node: %s, fScore = %s", cMin.id(), fScore[cMin.id()]);
        
        // If we've found our goal, then we are done
        if (cMin.id() == target.id()) {
          logDebug("Found goal node!");
          var rPath = reconstructPath(source.id(), target.id(), cameFrom, []);
          rPath.reverse();
          logDebug("Path: %s", rPath);
          return {
            found : true,
            distance : gScore[cMin.id()],
            path : new $$.Collection(cy, rPath),
            steps : steps
          };          
        }
        
        // Add cMin to processed nodes
        closedSet.push(cMin.id());
        // Remove cMin from boundary nodes
        openSet.splice(minPos, 1);
        logDebug("Added node to closedSet, removed from openSet.");
        logDebug("Processing neighbors...");

        // Update scores for neighbors of cMin
        // Take into account if graph is directed or not
        var vwEdges = cMin.connectedEdges(directed ? '[source = "' + cMin.id() + '"]' 
                         : undefined).intersect(edges);         
        for (var i = 0; i < vwEdges.length; i++) {
          var e = vwEdges[i];
          var w = e.connectedNodes('[id != "' + cMin.id() + '"]').intersect(nodes);

          logDebug("   processing neighbor: %s", w.id());
          // if node is in closedSet, ignore it
          if (closedSet.indexOf(w.id()) != -1) {
            logDebug("   already in closedSet, ignoring it.");
            continue;
          }
          
          // New tentative score for node w
          var tempScore = gScore[cMin.id()] + weightFn.apply(e, [e]);
          logDebug("   tentative gScore: %d", tempScore);

          // Update gScore for node w if:
          //   w not present in openSet
          // OR
          //   tentative gScore is less than previous value

          // w not in openSet
          if (openSet.indexOf(w.id()) == -1) {
            gScore[w.id()] = tempScore;
            fScore[w.id()] = tempScore + heuristic(w);
            openSet.push(w.id()); // Add node to openSet
            cameFrom[w.id()] = cMin.id();
            cameFromEdge[w.id()] = e.id();
            logDebug("   not in openSet, adding it. ");
            logDebug("   fScore(%s) = %s", w.id(), tempScore);
            continue;
          }
          // w already in openSet, but with greater gScore
          if (tempScore < gScore[w.id()]) {
            gScore[w.id()] = tempScore;
            fScore[w.id()] = tempScore + heuristic(w);
            cameFrom[w.id()] = cMin.id();
            logDebug("   better score, replacing gScore. ");
            logDebug("   fScore(%s) = %s", w.id(), tempScore);
          }

        } // End of neighbors update

      } // End of main loop

      // If we've reached here, then we've not reached our goal
      logDebug("Reached end of computation without finding our goal");
      return {
        found : false,
        distance : undefined,
        path : undefined,
        steps : steps
      };
    }, // aStar()


    // Implemented from pseudocode from wikipedia
    // options => options object
    //   weight: function( edge ){} // specifies weight to use for `edge`/`this`. If not present, it will be asumed a weight of 1 for all edges
    //   directed // default false
    // retObj => returned object by function
    //   pathTo : function(fromId, toId) // Returns the shortest path from node with ID "fromID" to node with ID "toId", as an array of node IDs
    //   distanceTo: function(fromId, toId) // Returns the distance of the shortest path from node with ID "fromID" to node with ID "toId"
    floydWarshall: function(options) {
      options = options || {};

      var logDebug = function() {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }
      logDebug("Starting floydWarshall..."); 

      var cy = this._private.cy;

      // Weight function - optional
      if (options.weight != null && $$.is.fn(options.weight)) {       
        var weightFn = options.weight;
      } else {
        // If not specified, assume each edge has equal weight (1)
        var weightFn = function(e) {return 1;};
      }

      // directed - optional
      if (options.directed != null) {       
        var directed = options.directed;
      } else {
        var directed = false;
      }

      var edges = this.edges().not(':loop');
      var nodes = this.nodes();
      var numNodes = nodes.length;

      // mapping: node id -> position in nodes array
      var id2position = {};
      for (var i = 0; i < numNodes; i++) {
        id2position[nodes[i].id()] = i;
      }     

      // Initialize distance matrix
      var dist = [];
      for (var i = 0; i < numNodes; i++) {
        var newRow = new Array(numNodes);
        for (var j = 0; j < numNodes; j++) {
          if (i == j) {
            newRow[j] = 0;
          } else {
            newRow[j] = Infinity;
          }
        }
        dist.push(newRow);
      }           

      // Initialize matrix used for path reconstruction
      // Initialize distance matrix
      var next = [];
      var edgeNext = [];

      var initMatrix = function(next){
        for (var i = 0; i < numNodes; i++) {
          var newRow = new Array(numNodes);
          for (var j = 0; j < numNodes; j++) {
            newRow[j] = undefined;
          }
          next.push(newRow);
        }
      };

      initMatrix(next);
      initMatrix(edgeNext);
      
      // Process edges
      for (var i = 0; i < edges.length ; i++) {     
        var sourceIndex = id2position[edges[i].source().id()];
        var targetIndex = id2position[edges[i].target().id()];    
        var weight = weightFn.apply(edges[i], [edges[i]]);
        
        // Check if already process another edge between same 2 nodes
        if (dist[sourceIndex][targetIndex] > weight) {
          dist[sourceIndex][targetIndex] = weight;
          next[sourceIndex][targetIndex] = targetIndex;
          edgeNext[sourceIndex][targetIndex] = edges[i];
        }
      }

      // If undirected graph, process 'reversed' edges
      if (!directed) {
        for (var i = 0; i < edges.length ; i++) {     
          var sourceIndex = id2position[edges[i].target().id()];    
          var targetIndex = id2position[edges[i].source().id()];
          var weight = weightFn.apply(edges[i], [edges[i]]);
          
          // Check if already process another edge between same 2 nodes
          if (dist[sourceIndex][targetIndex] > weight) {
            dist[sourceIndex][targetIndex] = weight;
            next[sourceIndex][targetIndex] = targetIndex;
            edgeNext[sourceIndex][targetIndex] = edges[i];
          }
        }
      }

      // Main loop
      for (var k = 0; k < numNodes; k++) {
        for (var i = 0; i < numNodes; i++) {
          for (var j = 0; j < numNodes; j++) {            
            if (dist[i][k] + dist[k][j] < dist[i][j]) {
              dist[i][j] = dist[i][k] + dist[k][j];
              next[i][j] = next[i][k];
            }
          }
        }
      }

      // Build result object       
      var position2id = [];
      for (var i = 0; i < numNodes; i++) {
        position2id.push(nodes[i].id());
      }

      var res = {
        distance: function(from, to) {
          if ($$.is.string(from)) {
            // from is a selector string
            var fromId = (cy.filter(from)[0]).id();
          } else {
            // from is a node
            var fromId = from.id();
          }

          if ($$.is.string(to)) {
            // to is a selector string
            var toId = (cy.filter(to)[0]).id();
          } else {
            // to is a node
            var toId = to.id();
          }

          return dist[id2position[fromId]][id2position[toId]];
        },

        path: function(from, to) {
          var reconstructPathAux = function(from, to, next, position2id, edgeNext) {
            if (from === to) {
              return cy.getElementById( position2id[from] );
            }
            if (next[from][to] === undefined) {
              return undefined;
            }

            var path = [ cy.getElementById(position2id[from]) ];
            var prev = from;
            while (from !== to) {
              prev = from;
              from = next[from][to];

              var edge = edgeNext[prev][from];
              path.push( edge );

              path.push( cy.getElementById(position2id[from]) );
            }
            return path;
          };

          if ($$.is.string(from)) {
            // from is a selector string
            var fromId = (cy.filter(from)[0]).id();
          } else {
            // from is a node
            var fromId = from.id();
          }

          if ($$.is.string(to)) {
            // to is a selector string
            var toId = (cy.filter(to)[0]).id();
          } else {
            // to is a node
            var toId = to.id();
          }
          
          var pathArr = reconstructPathAux(id2position[fromId], 
                        id2position[toId], 
                        next,
                        position2id,
                        edgeNext);

          return new $$.Collection( cy, pathArr );
        },
      };

      return res;

    }, // floydWarshall


    // Implemented from pseudocode from wikipedia
    // options => options object
    //   root: starting node (either element or selector string)
    //   weight: function( edge ){} // specifies weight to use for `edge`/`this`. If not present, it will be asumed a weight of 1 for all edges
    //   directed // default false
    // retObj => returned object by function
    //   pathTo : function(toId) // Returns the shortest path from root node to node with ID "toId", as an array of node IDs
    //   distanceTo: function(toId) // Returns the distance of the shortest path from root node to node with ID "toId"
    //   hasNegativeWeightCycle: true/false (if true, pathTo and distanceTo will be undefined)
    bellmanFord: function(options) {
      options = options || {};

      var logDebug = function() {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }
      logDebug("Starting bellmanFord..."); 

      // Weight function - optional
      if (options.weight != null && $$.is.fn(options.weight)) {       
        var weightFn = options.weight;
      } else {
        // If not specified, assume each edge has equal weight (1)
        var weightFn = function(e) {return 1;};
      }

      // directed - optional
      if (options.directed != null) {       
        var directed = options.directed;
      } else {
        var directed = false;
      }

      // root - mandatory!
      if (options.root != null) {       
        if ($$.is.string(options.root)) {
          // use it as a selector, e.g. "#rootID
          var source = this.filter(options.root)[0];
        } else {
          var source = options.root[0];
        }
        logDebug("Source node: %s", source.id()); 
      } else {
        $$.util.error("options.root required");
        return undefined;
      }

      var cy = this._private.cy;
      var edges = this.edges().not(':loop');
      var nodes = this.nodes();
      var numNodes = nodes.length;

      // mapping: node id -> position in nodes array
      var id2position = {};
      for (var i = 0; i < numNodes; i++) {
        id2position[nodes[i].id()] = i;
      }     

      // Initializations
      var cost = [];
      var predecessor = [];
      var predEdge = [];
      
      for (var i = 0; i < numNodes; i++) {
        if (nodes[i].id() === source.id()) {
          cost[i] = 0;
        } else {
          cost[i] = Infinity;
        } 
        predecessor[i] = undefined;
      }
      
      // Edges relaxation      
      var flag = false;
      for (var i = 1; i < numNodes; i++) {
        flag = false;
        for (var e = 0; e < edges.length; e++) {
          var sourceIndex = id2position[edges[e].source().id()];
          var targetIndex = id2position[edges[e].target().id()];    
          var weight = weightFn.apply(edges[e], [edges[e]]);
          
          var temp = cost[sourceIndex] + weight;
          if (temp < cost[targetIndex]) {
            cost[targetIndex] = temp;
            predecessor[targetIndex] = sourceIndex;
            predEdge[targetIndex] = edges[e];
            flag = true;
          }

          // If undirected graph, we need to take into account the 'reverse' edge
          if (!directed) {
            var temp = cost[targetIndex] + weight;
            if (temp < cost[sourceIndex]) {
              cost[sourceIndex] = temp;
              predecessor[sourceIndex] = targetIndex;
              predEdge[sourceIndex] = edges[e];
              flag = true;
            }
          }
        }

        if (!flag) {
          break;
        }
      }      
            
      if (flag) {
        // Check for negative weight cycles
        for (var e = 0; e < edges.length; e++) {
          var sourceIndex = id2position[edges[e].source().id()];
          var targetIndex = id2position[edges[e].target().id()];    
          var weight = weightFn.apply(edges[e], [edges[e]]);
          
          if (cost[sourceIndex] + weight < cost[targetIndex]) {
            $$.util.error("Error: graph contains a negative weigth cycle!"); 
            return { pathTo: undefined,
                 distanceTo: undefined,
                 hasNegativeWeightCycle: true};
          }
        }     
      }

      // Build result object       
      var position2id = [];
      for (var i = 0; i < numNodes; i++) {
        position2id.push(nodes[i].id());
      }
      
      
      var res = {       
        distanceTo : function(to) {
          if ($$.is.string(to)) {
            // to is a selector string
            var toId = (cy.filter(to)[0]).id();
          } else {
            // to is a node
            var toId = to.id();
          }

          return cost[id2position[toId]];
        }, 

        pathTo : function(to) {

          var reconstructPathAux = function(predecessor, fromPos, toPos, position2id, acumPath, predEdge) {
            for(;;){
              // Add toId to path
              acumPath.push( cy.getElementById(position2id[toPos]) );
              acumPath.push( predEdge[toPos] );

              if (fromPos === toPos) {
                // reached starting node
                return acumPath;
              }

              // If no path exists, discart acumulated path and return undefined
              var predPos = predecessor[toPos];
              if (typeof predPos === "undefined") {
                return undefined;
              }

              toPos = predPos;
            }

          };

          if ($$.is.string(to)) {
            // to is a selector string
            var toId = (cy.filter(to)[0]).id();
          } else {
            // to is a node
            var toId = to.id();
          }
          var path = [];

          // This returns a reversed path 
          var res =  reconstructPathAux(predecessor, 
                        id2position[source.id()],
                        id2position[toId], 
                        position2id, 
                        path,
                        predEdge);

          // Get it in the correct order and return it
          if (res != null) {
            res.reverse();
          }

          return new $$.Collection(cy, res);                       
        }, 

        hasNegativeWeightCycle: false
      };

      return res;

    }, // bellmanFord


    // Computes the minimum cut of an undirected graph
    // Returns the correct answer with high probability
    // options => options object
    // 
    // retObj => returned object by function
    //   cut : list of IDs of edges in the cut,
    //   partition1: list of IDs of nodes in one partition
    //   partition2: list of IDs of nodes in the other partition
    kargerStein: function(options) {
      options = options || {};
      
      var logDebug = function() {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Function which colapses 2 (meta) nodes into one
      // Updates the remaining edge lists
      // Receives as a paramater the edge which causes the collapse
      var colapse = function(edgeIndex, nodeMap, remainingEdges) {
        var edgeInfo = remainingEdges[edgeIndex];
        var sourceIn = edgeInfo[1];
        var targetIn = edgeInfo[2];
        var partition1 = nodeMap[sourceIn];
        var partition2 = nodeMap[targetIn];

        // Delete all edges between partition1 and partition2
        var newEdges = remainingEdges.filter(function(edge) {
          if (nodeMap[edge[1]] === partition1 && nodeMap[edge[2]] === partition2) {
            return false;
          }
          if (nodeMap[edge[1]] === partition2 && nodeMap[edge[2]] === partition1) {
            return false;
          }
          return true;
        });
        
        // All edges pointing to partition2 should now point to partition1
        for (var i = 0; i < newEdges.length; i++) {
          var edge = newEdges[i];
          if (edge[1] === partition2) { // Check source
            newEdges[i] = edge.slice(0);
            newEdges[i][1] = partition1;
          } else if (edge[2] === partition2) { // Check target
            newEdges[i] = edge.slice(0);
            newEdges[i][2] = partition1;
          }
        } 
        
        // Move all nodes from partition2 to partition1
        for (var i = 0; i < nodeMap.length; i++) {
          if (nodeMap[i] === partition2) {
            nodeMap[i] = partition1;
          }
        }
        
        return newEdges;
      };


      // Contracts a graph until we reach a certain number of meta nodes
      var contractUntil = function(metaNodeMap, 
                     remainingEdges,
                     size, 
                     sizeLimit) {
        // Stop condition
        if (size <= sizeLimit) {
          return remainingEdges;
        }
        
        // Choose an edge randomly
        var edgeIndex = Math.floor((Math.random() * remainingEdges.length));

        // Colapse graph based on edge
        var newEdges = colapse(edgeIndex, metaNodeMap, remainingEdges);
        
        return contractUntil(metaNodeMap, 
                   newEdges, 
                   size - 1, 
                   sizeLimit);        
      };


      // Parse options
      // debug - optional
      if (options != null && options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }
      logDebug("Starting kargerStein..."); 

      var cy = this._private.cy;
      var edges = this.edges().not(':loop');
      var nodes = this.nodes();
      var numNodes = nodes.length;
      var numEdges = edges.length;
      var numIter = Math.ceil(Math.pow(Math.log(numNodes) / Math.LN2, 2));
      var stopSize = Math.floor(numNodes / Math.sqrt(2));

      if (numNodes < 2) {
        $$.util.error("At least 2 nodes are required for KargerSteing algorithm!"); 
        return undefined;
      }

      // Create numerical identifiers for each node
      // mapping: node id -> position in nodes array
      // for reverse mapping, simply use nodes array
      var id2position = {};
      for (var i = 0; i < numNodes; i++) {
        id2position[nodes[i].id()] = i;
      }

      // Now store edge destination as indexes
      // Format for each edge (edge index, source node index, target node index)
      var edgeIndexes = [];
      for (var i = 0; i < numEdges; i++) {
        var e = edges[i];
        edgeIndexes.push([i, id2position[e.source().id()], id2position[e.target().id()]]);
      }

      // We will store the best cut found here
      var minCutSize = Infinity;
      var minCut;     

      // Initial meta node partition
      var originalMetaNode = [];
      for (var i = 0; i < numNodes; i++) {
        originalMetaNode.push(i);
      }

      // Main loop
      for (var iter = 0; iter <= numIter; iter++) {
        // Create new meta node partition
        var metaNodeMap = originalMetaNode.slice(0);

        // Contract until stop point (stopSize nodes)
        var edgesState = contractUntil(metaNodeMap, edgeIndexes, numNodes, stopSize);
        
        // Create a copy of the colapsed nodes state
        var metaNodeMap2 = metaNodeMap.slice(0);

        // Run 2 iterations starting in the stop state
        var res1 = contractUntil(metaNodeMap, edgesState, stopSize, 2);
        var res2 = contractUntil(metaNodeMap2, edgesState, stopSize, 2);

        // Is any of the 2 results the best cut so far?
        if (res1.length <= res2.length && res1.length < minCutSize) {
          minCutSize = res1.length;
          minCut = [res1, metaNodeMap];
        } else if (res2.length <= res1.length && res2.length < minCutSize) {
          minCutSize = res2.length;
          minCut = [res2, metaNodeMap2];
        }
      } // end of main loop

      
      // Construct result
      var resEdges = (minCut[0]).map(function(e){ return edges[e[0]]; });
      var partition1 = [];
      var partition2 = [];

      // traverse metaNodeMap for best cut
      var witnessNodePartition = minCut[1][0];
      for (var i = 0; i < minCut[1].length; i++) { 
        var partitionId = minCut[1][i]; 
        if (partitionId === witnessNodePartition) {
          partition1.push(nodes[i]);
        } else {
          partition2.push(nodes[i]);
        }       
      }
      
      var ret = {
        cut: new $$.Collection(cy, resEdges),
        partition1: new $$.Collection(cy, partition1),
        partition2: new $$.Collection(cy, partition2)
      };
      
      return ret;
    },


    // 
    // options => options object
    //   dampingFactor: optional
    //   precision: optional
    //   iterations : optional
    // retObj => returned object by function
    //  rank : function that returns the pageRank of a given node (object or selector string)
    pageRank: function(options) {
      options = options || {};
      
      var normalizeVector = function(vector) {
        var length = vector.length;

        // First, get sum of all elements
        var total = 0; 
        for (var i = 0; i < length; i++) {
          total += vector[i];
        }

        // Now, divide each by the sum of all elements
        for (var i = 0; i < length; i++) {
          vector[i] = vector[i] / total;
        }
      };
      
      var logDebug = function() {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };
      
      // Parse options
      // debug - optional
      if (options != null && 
        options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }
      logDebug("Starting pageRank..."); 

      // dampingFactor - optional
      if (options != null && 
        options.dampingfactor != null) {
        var dampingFactor = options.dampingFactor;
      } else {
        var dampingFactor = 0.8; // Default damping factor
      }

      // desired precision - optional
      if (options != null && 
        options.precision != null) {
        var epsilon = options.precision;
      } else {
        var epsilon = 0.000001; // Default precision
      }

      // Max number of iterations - optional
      if (options != null && 
        options.iterations != null) {
        var numIter = options.iterations;
      } else {
        var numIter = 200; // Default number of iterations
      }

      // Weight function - optional
      if (options != null && 
        options.weight != null && 
        $$.is.fn(options.weight)) {       
        var weightFn = options.weight;
      } else {
        // If not specified, assume each edge has equal weight (1)
        var weightFn = function(e) {return 1;}; 
      }

      var cy = this._private.cy;
      var edges = this.edges().not(':loop');
      var nodes = this.nodes();
      var numNodes = nodes.length;
      var numEdges = edges.length;

      // Create numerical identifiers for each node
      // mapping: node id -> position in nodes array
      // for reverse mapping, simply use nodes array
      var id2position = {};
      for (var i = 0; i < numNodes; i++) {
        id2position[nodes[i].id()] = i;
      }

      // Construct transposed adjacency matrix
      // First lets have a zeroed matrix of the right size
      // We'll also keep track of the sum of each column
      var matrix = [];
      var columnSum = [];
      var additionalProb = (1 - dampingFactor) / numNodes;

      // Create null matric
      for (var i = 0; i < numNodes; i++) { 
        var newRow = [];
        for (var j = 0; j < numNodes; j++) {
          newRow.push(0.0);
        }
        matrix.push(newRow);
        columnSum.push(0.0);
      }

      // Now, process edges
      for (var i = 0; i < numEdges; i++) {
        var edge = edges[i];
        var s = id2position[edge.source().id()];
        var t = id2position[edge.target().id()];
        var w = weightFn.apply(edge, [edge]);
        
        // Update matrix
        matrix[t][s] += w;

        // Update column sum
        columnSum[s] += w; 
      }

      // Add additional probability based on damping factor
      // Also, take into account columns that have sum = 0
      var p = 1.0 / numNodes + additionalProb; // Shorthand
      // Traverse matrix, column by column
      for (var j = 0; j < numNodes; j++) { 
        if (columnSum[j] === 0) {
          // No 'links' out from node jth, assume equal probability for each possible node
          for (var i = 0; i < numNodes; i++) {
            matrix[i][j] = p;
          }
        } else {
          // Node jth has outgoing link, compute normalized probabilities
          for (var i = 0; i < numNodes; i++) {
            matrix[i][j] = matrix[i][j] / columnSum[j] + additionalProb;
          }         
        }
      }

      // Compute dominant eigenvector using power method
      var eigenvector = [];
      var nullVector = [];
      var previous;

      // Start with a vector of all 1's
      // Also, initialize a null vector which will be used as shorthand
      for (var i = 0; i < numNodes; i++) {
        eigenvector.push(1.0);
        nullVector.push(0.0);
      }
            
      for (var iter = 0; iter < numIter; iter++) {
        // New array with all 0's
        var temp = nullVector.slice(0);
        
        // Multiply matrix with previous result
        for (var i = 0; i < numNodes; i++) {
          for (var j = 0; j < numNodes; j++) {        
            temp[i] += matrix[i][j] * eigenvector[j];
          }
        }

        normalizeVector(temp);
        previous = eigenvector;
        eigenvector = temp;

        var diff = 0;
        // Compute difference (squared module) of both vectors
        for (var i = 0; i < numNodes; i++) {
          diff += Math.pow(previous[i] - eigenvector[i], 2);
        }
        
        // If difference is less than the desired threshold, stop iterating
        if (diff < epsilon) {
          logDebug("Stoped at iteration %s", iter);
          break;
        }
      }
            
      logDebug("Result:\n" + eigenvector);

      // Construct result
      var res = {
        rank : function(node) {
          if ($$.is.string(node)) {
            // is a selector string
            var nodeId = (cy.filter(node)[0]).id();
          } else {
            // is a node object
            var nodeId = node.id();
          }
          return eigenvector[id2position[nodeId]];
        }
      };


      return res;
    }, // pageRank


    // options => options object
    //   weight: function( edge ){} // specifies weight to use for `edge`/`this`. If not present, it will be asumed a weight of 1 for all edges
    //   directed // default false
    // retObj => returned object by function
    // if directed
    //   indegree_n : function(node) // Returns the normalized indegree of the given node
    //   outdegree_n: function(node) // Returns the normalized outdegree of the given node
    // if undirected
    //   degree_n : function(node) // Returns the normalized degree of the given node
    degreeCentralityNormalized: function (options) {
      options = options || {};

      var logDebug = function () {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }

      // directed - optional
      if (options.directed != null) {
        var directed = options.directed;
      } else {
        var directed = false;
      }

      logDebug("Starting degree centrality...");
      var nodes = this.nodes();
      var numNodes = nodes.length;

      if (!directed) {
        var degrees = {};
        var maxDegree = 0;

        for (var i = 0; i < numNodes; i++) {
          var node = nodes[i];
          // add current node to the current options object and call degreeCentrality 
          var currDegree = this.degreeCentrality($$.util.extend({}, options, {root: node}));
          if (maxDegree < currDegree.degree)
            maxDegree = currDegree.degree;

          degrees[node.id()] = currDegree.degree;
        }

        return {
          degree_n: function (node) {
            if ($$.is.string(node)) {
              // from is a selector string
              var node = (cy.filter(node)[0]).id();
            } else {
              // from is a node
              var node = node.id();
            }

            return degrees[node] / maxDegree;
          }
        }
      } else {
        var indegrees = {};
        var outdegrees = {};
        var maxIndegree = 0;
        var maxOutdegree = 0;

        for (var i = 0; i < numNodes; i++) {
          var node = nodes[i];
          // add current node to the current options object and call degreeCentrality 
          var currDegree = this.degreeCentrality($$.util.extend({}, options, {root: node}));

          if (maxIndegree < currDegree.indegree)
            maxIndegree = currDegree.indegree;

          if (maxOutdegree < currDegree.outdegree)
            maxOutdegree = currDegree.outdegree;

          indegrees[node.id()] = currDegree.indegree;
          outdegrees[node.id()] = currDegree.outdegree;
        }

        return {
          indegree_n: function (node) {
            if ($$.is.string(node)) {
              // from is a selector string
              var node = (cy.filter(node)[0]).id();
            } else {
              // from is a node
              var node = node.id();
            }

            return indegrees[node] / maxIndegree;
          },
          outdegree_n: function (node) {
            if ($$.is.string(node)) {
              // from is a selector string
              var node = (cy.filter(node)[0]).id();
            } else {
              // from is a node
              var node = node.id();
            }

            return outdegrees[node] / maxOutdegree;
          }

        }
      }

    }, // degreeCentralityNormalized

    // Implemented from the algorithm in Opsahl's paper "Node centrality in weighted networks: Generalizing degree and shortest paths" check the heading 2 "Degree"
    // options => options object
    //   node : focal node
    //   weight: function( edge ){} // specifies weight to use for `edge`/`this`. If not present, it will be asumed a weight of 1 for all edges
    //   alpha : alpha value for the algorithm (Benchmark values of alpha: 0 -> disregards the weights focuses on number of edges
    //                                                                     1 -> disregards the number of edges focuses on total amount of weight 
    //   directed // default false
    // retObj => returned object by function
    // if directed
    //   indegree : indegree of the given node
    //   outdegree: outdegree of the given node
    // if undirected
    //   degree : degree of the given node
    degreeCentrality: function (options) {
      options = options || {};

      var logDebug = function () {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }

      logDebug("Starting degree centrality...");

      // root - mandatory!
      if (options != null && options.root != null) {
        var root = $$.is.string(options.root) ? this.filter(options.root)[0] : options.root[0];
        logDebug("Source node: %s", root.id());
      } else {
        return undefined;
      }

      // weight - optional
      if (options.weight != null && $$.is.fn(options.weight)) {
        var weightFn = options.weight;
      } else {
        // If not specified, assume each edge has equal weight (1)
        var weightFn = function (e) {
          return 1;
        };
      }

      // directed - optional
      if (options.directed != null) {
        var directed = options.directed;
      } else {
        var directed = false;
      }

      // alpha - optional
      if (options.alpha != null && $$.is.number(options.alpha)) {
        var alpha = options.alpha
      } else {
        alpha = 0;
      }


      if (!directed) {
        var connEdges = root.connectedEdges();
        var k = connEdges.length;
        var s = 0;

        // Now, sum edge weights
        for (var i = 0; i < connEdges.length; i++) {
          var edge = connEdges[i];
          s += weightFn.apply(edge, [edge]);
        }

        return {
          degree: Math.pow(k, 1 - alpha) * Math.pow(s, alpha)
        };
      } else {
        var incoming = root.connectedEdges('edge[target = "' + root.id() + '"]');
        var outgoing = root.connectedEdges('edge[source = "' + root.id() + '"]');
        var k_in = incoming.length;
        var k_out = outgoing.length;
        var s_in = 0;
        var s_out = 0;

        // Now, sum incoming edge weights
        for (var i = 0; i < incoming.length; i++) {
          var edge = incoming[i];
          s_in += weightFn.apply(edge, [edge]);
        }

        // Now, sum outgoing edge weights
        for (var i = 0; i < outgoing.length; i++) {
          var edge = outgoing[i];
          s_out += weightFn.apply(edge, [edge]);
        }

        return {
          indegree: Math.pow(k_in, 1 - alpha) * Math.pow(s_in, alpha),
          outdegree: Math.pow(k_out, 1 - alpha) * Math.pow(s_out, alpha)
        };
      }
    }, // degreeCentrality

    // options => options object
    // weight: function( edge ){} // specifies weight to use for `edge`/`this`. If not present, it will be asumed a weight of 1 for all edges
    // retObj => returned object by function
    //   closeness_n : function(node) // Returns the normalized closeness of the given node
    closenessCentralityNormalized: function (options) {
      options = options || {};

      var logDebug = function () {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }

      logDebug("Starting closeness centrality...");

      var closenesses = {};
      var maxCloseness = 0;
      var nodes = this.nodes();
      var fw = this.floydWarshall({weight: options.weight, directed: options.directed});

      // Compute closeness for every node and find the maximum closeness
      for(var i = 0; i < nodes.length; i++){
        var currCloseness = 0;
        for (var j = 0; j < nodes.length; j++) {
          if (i != j) {
            currCloseness += 1 / fw.distance(nodes[i], nodes[j]);
          }
        }

        if (maxCloseness < currCloseness)
          maxCloseness = currCloseness;

        closenesses[nodes[i].id()] = currCloseness;
      }

      return {
        closeness_n: function (node) {
          if ($$.is.string(node)) {
            // from is a selector string
            var node = (cy.filter(node)[0]).id();
          } else {
            // from is a node
            var node = node.id();
          }

          return closenesses[node] / maxCloseness;
        }
      }
    },
    // Implemented from pseudocode from wikipedia
    // Assumes undirected graph
    // options => options object
    //   node : focal node
    //   weight: function( edge ){} // specifies weight to use for `edge`/`this`. If not present, it will be asumed a weight of 1 for all edges
    //   directed // default false
    // closeness => returned value by the function. Closeness value of the given node.
    closenessCentrality: function (options) {
      options = options || {};

      var logDebug = function () {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }

      logDebug("Starting closeness centrality...");

      // root - mandatory!
      if (options.root != null) {
        if ($$.is.string(options.root)) {
          // use it as a selector, e.g. "#rootID
          var root = this.filter(options.root)[0];
        } else {
          var root = options.root[0];
        }
        logDebug("Source node: %s", root.id());
      } else {
        $$.util.error("options.root required");
        return undefined;
      }

      // weight - optional
      if (options.weight != null && $$.is.fn(options.weight)) {
        var weight = options.weight;
      } else {
        var weight = function(){return 1;};
      }

      // directed - optional
      if (options.directed != null && $$.is.bool(options.directed)) {
        var directed = options.directed;
      } else {
        var directed = false;
      }

      // we need distance from this node to every other node
      var dijkstra = this.dijkstra({
        root: root,
        weight: weight,
        directed: directed
      });
      var totalDistance = 0;

      var nodes = this.nodes();
      for (var i = 0; i < nodes.length; i++)
        if (nodes[i].id() != root.id())
          totalDistance += 1 / dijkstra.distanceTo(nodes[i]);

      return totalDistance;
    }, // closenessCentrality

    // Implemented from the algorithm in the paper "On Variants of Shortest-Path Betweenness Centrality and their Generic Computation" by Ulrik Brandes
    // retObj => returned object by function
    //   betweenness : function(node) // Returns the betweenness centrality of the given node
    //   betweenness_n : function(node) // Returns the normalized betweenness centrality of the given node
    betweennessCentrality: function (options) {
      options = options || {};

      var logDebug = function () {
        if (debug) {
          console.log.apply(console, arguments);
        }
      };

      // Parse options
      // debug - optional
      if (options.debug != null) {
        var debug = options.debug;
      } else {
        var debug = false;
      }

      logDebug("Starting betweenness centrality...");

      // Weight - optional
      if (options.weight != null && $$.is.fn(options.weight)) {
        var weightFn = options.weight;
        var weighted = true;
      } else {
        var weighted = false;
      }

      // Directed - default false
      if (options.directed != null && $$.is.bool(options.directed)) {
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
              if (cy.$('#' + v).outgoers('edge[target = "' + w.id() + '"]').length > 0) {
                var edge = cy.$('#' + v).outgoers('edge[target = "' + w.id() + '"]')[0];
              } else {
                var edge = w.outgoers('edge[target = "' + v + '"]')[0];
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

      return {
        betweenness: function (node) {
          if ($$.is.string(node)) {
            var node = (cy.filter(node)[0]).id();
          } else {
            var node = node.id();
          }

          return C[node];
        },
        betweenness_n: function (node) {
          if ($$.is.string(node)) {
            var node = (cy.filter(node)[0]).id();
          } else {
            var node = node.id();
          }

          return C[node] / max;
        }
      }
    } // betweennessCentrality
  }); // $$.fn.eles
}) (cytoscape);
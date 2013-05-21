;(function($$){
	
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
		// do a breadth first search from the nodes in the collection
		// from pseudocode on wikipedia
		breadthFirstSearch: function( fn, directed ){
			fn = fn || function(){};
			var cy = this._private.cy;
			var v = this;
			var Q = [];
			var marked = {};
			var id2depth = {};
			var connectedFrom = {};
			var connectedEles = [];

			// enqueue v
			for( var i = 0; i < v.length; i++ ){
				if( v[i].isNode() ){
					Q.unshift( v[i] );

					// and mark v
					marked[ v[i].id() ] = true;

					id2depth[ v[i].id() ] = 0;

					connectedEles.push( v[i] );
				}
			}

			i = 0;
			while( Q.length !== 0 ){ // while Q not empty
				var t = Q.shift();
				var depth = 0;

				var fromNodeId = connectedFrom[ t.id() ];
				while( fromNodeId ){
					depth++;
					fromNodeId = connectedFrom[ fromNodeId ];
				}

				id2depth[ t.id() ] = depth;
				var ret = fn.call(t, i, depth);
				i++;

				// on return true, return the result
				if( ret === true ){
					return new $$.Collection( cy, [ t ] );
				} 

				// on return false, stop iteration
				else if( ret === false ){
					break;
				}

				var adjacentEdges = t.connectedEdges(directed ? '[source = "' + t.id() + '"]' : undefined);

				for( var j = 0; j < adjacentEdges.length; j++ ){
					var e = adjacentEdges[j];
					var u = e.connectedNodes('[id != "' + t.id() + '"]');

					if( u.length !== 0 ){
						u = u[0];

						if( !marked[ u.id() ] ){
							marked[ u.id() ] = true; // mark u
							Q.unshift( u ); // enqueue u onto Q
							
							connectedFrom[ u.id() ] = t.id();
							
							connectedEles.push( u );
							connectedEles.push( e );
						}
					}
				}
			}

			return new $$.Collection( cy, connectedEles ); // return none
		},

		// do a depth first search on the nodes in the collection
		// from pseudocode on wikipedia (iterative impl)
		depthFirstSearch: function( fn, directed ){
			fn = fn || function(){};
			var cy = this._private.cy;
			var v = this;
			var S = [];
			var discovered = [];
			var forwardEdge = {};
			var backEdge = {};
			var crossEdge = {};
			var treeEdge = {};
			var explored = {};

			function labelled(e){
				var id = e.id();
				return forwardEdge[id] || backEdge[id] || crossEdge[id] || treeEdge[id];
			}

			// push v
			for( var i = 0; i < v.length; i++ ){
				if( v[i].isNode() ){
					S.push( v[i] );

					// and mark discovered
					discovered[ v[i].id() ] = true;
				}
			}

			while( S.length !== 0 ){
				var t = S[ S.length - 1 ];
				var ret = fn.call(t);
				var breaked = false;

				if( ret === true ){
					return new $$.Collection( cy, [t] );
				}

				var adjacentEdges = t.connectedEdges(directed ? '[source = "' + t.id() + '"]' : undefined);
				for( var i = 0; i < adjacentEdges.length; i++ ){
					var e = adjacentEdges[i];

					if( labelled(e) ){
						continue;
					}

					var w = e.connectedNodes('[id != "' + t.id() + '"]');
					if( w.length !== 0 ){
						w = w[0];
						var wid = w.id();

						if( !discovered[wid] && !explored[wid] ){
							treeEdge[wid] = true;
							discovered[wid] = true;
							S.push(w);
							breaked = true;
							break;
						} else if( discovered[wid] ){
							backEdge[wid] = true;
						} else {
							crossEdge[wid] = true;
						}	
					}
				}

				if( !breaked ){
					explored[ t.id() ] = true;
					S.pop();
				}
			}
		},

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

		// kruskal's algorithm (finds min spanning tree, assuming undirected graph)
		// implemented from pseudocode from wikipedia
		kruskal: function( weightFn ){
			weightFn = weightFn || function(){ return 1; }; // if not specified, assume each edge has equal weight (1)

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

				if( setU.eles !== setV.eles ){
					A = A.add( edge );

					forest[ setU.index ] = setU.eles.add( setV.eles );
					forest.splice( setV.index, 1 );
				}
			}

			return nodes.add( A );

		},

		dijkstra: function( target, weightFn, directed ){
			var cy = this._private.cy;
			directed = !$$.is.fn(weightFn) ? weightFn : directed;
			directed = directed === undefined || directed;
			weightFn = $$.is.fn(weightFn) ? weightFn : function(){ return 1; }; // if not specified, assume each edge has equal weight (1)

			if( this.length === 0 || !target || !$$.is.elementOrCollection(target) || target.length === 0 ){
				return new $$.Collection(cy, []);
			}

			var source = this[0];
			target = target[0];
			var dist = {};
			var prev = {};

			var nodes = cy.nodes();
			for( var i = 0; i < nodes.length; i++ ){
				dist[ nodes[i].id() ] = Infinity;
			}

			dist[ source.id() ] = 0;
			var Q = nodes;

			var smallestDist = function(Q){
				var smallest = Infinity;
				var index;
				for(var i in dist){
					if( dist[i] < smallest && Q.$('#' + i).length !== 0 ){
						smallest = dist[i];
						index = i;
					}
				}

				return index;
			};

			var distBetween = function(u, v){
				var edges = u.edgesWith(v);
				var smallestDistance = Infinity;
				var smallestEdge;

				for( var i = 0; i < edges.length; i++ ){
					var edge = edges[i];
					var weight = weightFn.call(edge);

					if( weight < smallestDistance ){
						smallestDistance = weight;
						smallestEdge = edge;
					}
				}

				return {
					edge: smallestEdge,
					dist: smallestDistance
				};
			};

			while( Q.length !== 0 ){
				var uid = smallestDist(Q);
				var u = Q.filter('#' + uid);

				if( u.length === 0 ){
					continue;
				}

				//debugger;

				Q = Q.not( u );

				if( u.same(target) ){
					break;
				}

				if( dist[uid] === Math.Infinite ){
					break;
				}

				var neighbors = u.neighborhood().nodes();
				for( var i = 0; i < neighbors.length; i++ ){
					var v = neighbors[i];
					var vid = v.id()

					var duv = distBetween(u, v);
					var alt = dist[uid] + duv.dist;
					if( alt < dist[vid] ){
						dist[vid] = alt;
						prev[vid] = {
							node: v,
							edge: duv.edge
						};
						// TODO decrease-key v in Q
					}
				}
			}
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
		source: defineSourceFunction({
			attr: "source"
		}),

		target: defineSourceFunction({
			attr: "target"
		})
	});
	
	function defineSourceFunction( params ){
		return function( selector ){
			var sources = [];
			var edges = this.edges();
			var cy = this._private.cy;

			for( var i = 0; i < edges.length; i++ ){
				var edge = edges[i];
				var id = edge._private.data[params.attr];
				var src = cy.getElementById( id );

				if( src.length > 0 ){
					sources.push( src );
				}
			}
			
			return new $$.Collection( cy, sources ).filter( selector );
		}
	}

	$$.fn.eles({
		edgesWith: defineEdgesWithFunction(),

		edgesTo: defineEdgesWithFunction({
			thisIs: "source"
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
			var elements = [];
			var cy = this._private.cy;
			
			var nodes = this.nodes();
			for( var i = 0; i < nodes.length; i++ ){
				var node = nodes[i];
				var edges = node._private.edges;

				for( var j = 0; j < edges.length; j++ ){
					var edge = edges[j];					
					elements.push( edge );
				}
			}
			
			return new $$.Collection( cy, elements ).filter( selector );
		},

		connectedNodes: function( selector ){
			var elements = [];
			var cy = this._private.cy;

			var edges = this.edges();
			for( var i = 0; i < edges.length; i++ ){
				var edge = edges[i];

				elements.push( edge.source()[0] );
				elements.push( edge.target()[0] );
			}

			return new $$.Collection( cy, elements ).filter( selector );
		},

		parallelEdges: defineParallelEdgesFunction(),

		codirectedEdges: defineParallelEdgesFunction({
			codirected: true
		}),

		parallelIndex: function(){
			var edge = this[0];

			if( edge.isEdge() ){
				var src = edge.source()[0];
				var srcEdges = src._private.edges;
				var index = 0;

				for( var i = 0; i < srcEdges.length; i++ ){
					var srcEdge = srcEdges[i];
					var thisIsTheIndex = srcEdge === edge;

					if( thisIsTheIndex ){
						return index;
					}

					var codirected = edge._private.data.source === srcEdge._private.data.source
						&& edge._private.data.target === srcEdge._private.data.target;
					var opdirected = edge._private.data.source === srcEdge._private.data.target
						&& edge._private.data.target === srcEdge._private.data.source;
					var parallel = codirected || opdirected;

					if( parallel ){ // then increase the count
						index++;
					}
				}
			}
		},

		parallelSize: function(){
			var edge = this[0];

			if( edge.isEdge() ){
				var src = edge.source()[0];
				var srcEdges = src._private.edges;
				var numEdges = 0;

				for( var i = 0; i < srcEdges.length; i++ ){
					var srcEdge = srcEdges[i];
					var codirected = edge._private.data.source === srcEdge._private.data.source
						&& edge._private.data.target === srcEdge._private.data.target;
					var opdirected = edge._private.data.source === srcEdge._private.data.target
						&& edge._private.data.target === srcEdge._private.data.source;
					var parallel = codirected || opdirected;

					if( parallel ){ // then increase the count
						numEdges++;
					}
				}

				return numEdges;
			}
		}
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

	
})( cytoscape );
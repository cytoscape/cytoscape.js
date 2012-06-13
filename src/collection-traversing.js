;(function($, $$){
	
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
				return new $$.CySelector(cy, filter).filter(this);
			
			} else if( filter === undefined ){
				return this;
			}

			return new $$.Collection( cy );
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
		var defaults = {
		};
		params = $.extend(true, {}, defaults, params);
		
		return function(otherNodes){
			var elements = [];
			var cy = this._private.cy;
			var p = params;

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
		})
	});
	
	function defineParallelEdgesFunction(params){
		var defaults = {
			codirected: false
		};
		params = $.extend(true, {}, defaults, params);
		
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

	
})(jQuery, jQuery.cytoscape);
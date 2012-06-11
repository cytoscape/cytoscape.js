;(function($, $$){
	
	$$.fn.collection({
		nodes: function(selector){
			return this.filter(function(i, element){
				return element.isNode();
			}).filter(selector);
		}
	});

	$$.fn.collection({
		edges: function(selector){
			return this.filter(function(i, element){
				return element.isEdge();
			}).filter(selector);
		}
	});

	$$.fn.collection({
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
				
				return new $$.CyCollection(cy, elements);
			
			} else if( $$.is.string(filter) || $$.is.elementOrCollection(filter) ){
				return new $$.CySelector(cy, filter).filter(this);
			
			} else if( filter === undefined ){
				return this;
			}

			return new $$.CyCollection( cy );
		}
	});

	$$.fn.collection({	
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
				
				return new $$.CyCollection( cy, elements );
			}
			
		}
	});
	
	$$.fn.collection({
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
			
			return new $$.CyCollection( cy, elements );
		}
	});
	
	$$.fn.collection({
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
			
			return new $$.CyCollection(cy, elements);
		}
	});



	// Neighbourhood functions
	//////////////////////////

	$$.fn.collection({
		neighborhood: function(selector){
			var elements = [];
			
			this.nodes().each(function(i, node){
				node.connectedEdges().each(function(j, edge){
					var otherNode = edge.connectedNodes().not(node);

					// need check in case of loop
					if( otherNode.size() > 0 ){
						elements.push( otherNode.element() ); // add node 1 hop away
					}
					
					// add connected edge
					elements.push( edge.element() );
				});
			});
			
			return this.connectedNodes().add( new $$.CyCollection( this.cy(), elements ) ).filter( selector );
		}
	});
	$$.fn.collection({ neighbourhood: function(selector){ return this.neighborhood(selector); } });
	
	$$.fn.collection({
		closedNeighborhood: function(selector){
			return new $$.CySelector(this.cy(), selector).filter( this.neighborhood().add(this) );
		}
	});
	$$.fn.collection({ closedNeighbourhood: function(selector){ return this.closedNeighborhood(selector); } });
	
	$$.fn.collection({
		openNeighborhood: function(selector){
			return this.neighborhood(selector);
		}
	});
	$$.fn.collection({ openNeighbourhood: function(selector){ return this.openNeighborhood(selector); } });
	


	// Edge functions
	/////////////////

	$$.fn.collection({
		source: defineSourceFunction({
			attr: "source"
		})
	});
	
	$$.fn.collection({
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
				var src = cy.getElementById( edge.data(params.attr) );
				sources.push( src );
			}
			
			return new $$.CyCollection( cy, sources ).filter( selector );
		}
	}

	$$.fn.collection({
		edgesWith: defineEdgesWithFunction()
	});
	
	$$.fn.collection({
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

				if( p.thisIs ){
					var idToFind = edge._private.data[ p.thisIs ];
					foundId = thisIds[ idToFind ];
				} else {
					foundId = thisIds[ edge._private.data.source ] || thisIds[ edge._private.data.target ];
				}
				
				if( foundId ){
					elements.push( edge );
				}
			}
			
			return new $$.CyCollection( cy, elements );
		};
	}
	
	$$.fn.collection({
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
			
			return new $$.CyCollection( cy, elements ).filter( selector );
		}
	});
	
	$$.fn.collection({
		connectedNodes: function( selector ){
			var elements = [];
			var cy = this._private.cy;

			var edges = this.edges();
			for( var i = 0; i < edges.length; i++ ){
				var edge = edges[i];

				elements.push( edge.source() );
				elements.push( edge.target() );
			}

			return new $$.CyCollection( cy, elements ).filter( selector );
		}
	});
	
	$$.fn.collection({
		parallelEdges: defineParallelEdgesFunction()
	});
	
	$$.fn.collection({
		codirectedEdges: defineParallelEdgesFunction({
			include: function( source, target, edgeStruct ){
				return edgeStruct.source.same( source ) &&
					edgeStruct.target.same( target );
			}
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

			for( var i = 0; i < edges.length; i++ ){
				var edge = edges[i];
				var src = edge.source();
				var srcid = src.id();
				var tgt = edge.target();
				var tgtid = tgt.id();

				var srcEdges = src._private.edges;
				for( var j = 0; j < srcEdges.length; j++ ){
					var srcEdge = srcEdges[j];
					var srcEdgeData = srcEdge._private.data;
					var codirected = srcEdgeData.target === tgtid && srcEdgeData.source === srcid;
					var oppdirected = srcEdgeData.source === tgtid && srcEdgeData.target === srcid;
					
					if( (p.codirected && codirected) || (codirected || oppdirected) ){
						elements.push( srcEdge );
					}
				}
			}
			
			return new $$.CyCollection( cy, elements ).filter( selector );
		};
	
	}


	// Compound functions
	/////////////////////

	$$.fn.collection({
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
			
			return new $$.CyCollection( cy, parents ).filter( selector );
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

			return new $$.CyCollection( this.cy(), parents ).filter( selector );
		},

		children: function( selector ){
			var children = [];

			for( var i = 0; i < this.length; i++ ){
				var ele = this[i];
				children = children.concat( ele._private.children );
			}

			return new $$.CyCollection( this.cy(), children ).filter( selector );
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

			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		}
	});

	
})(jQuery, jQuery.cytoscape);
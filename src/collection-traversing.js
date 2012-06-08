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
			var cy = this.cy();
			
			if( $$.is.fn(filter) ){
				var elements = [];
				this.each(function(i, element){
					element = element.element();
					
					if( filter.apply(element, [i, element]) ){
						elements.push(element);
					}
				});
				
				return new $$.CyCollection(this.cy(), elements);
			
			} else if( $$.is.string(filter) || $$.is.elementOrCollection(filter) ){
				return new $$.CySelector(this.cy(), filter).filter(this);
			
			} else if( filter === undefined ){
				return this;
			}

			return new $$.CyCollection( this.cy() );
		}
	});

	$$.fn.collection({	
		not: function(toRemove){
			
			if( toRemove == null ){
				return this;
			} else {
			
				if( $$.is.string(toRemove) ){
					toRemove = this.filter(toRemove);
				}
				
				var elements = [];
				toRemove = toRemove.collection();
				
				this.forEach(function(i, element){
					
					var remove = toRemove._private.ids[ element.id() ];
					if( !remove ){
						elements.push( element );
					}
					
				});
				
				return new $$.CyCollection(this.cy(), elements);
			}
			
		}
	});
	
	$$.fn.collection({
		intersect: function( other ){
			var self = this;
			
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
			
			$.each(ids1, function(id){
				if( ids2[ id ] ){
					var ele = ids2[ id ];
					elements.push( ele );
				}
			});
			
			return new $$.CyCollection( this.cy(), elements );
		}
	});
	
	$$.fn.collection({
		add: function(toAdd){
			var self = this;			
			
			if( toAdd == null ){
				return this;
			}
			
			if( $$.is.string(toAdd) ){
				var selector = toAdd;
				toAdd = this.cy().elements(selector);
			}
			toAdd = toAdd.collection();
			
			var elements = [];
			var ids = {};
		
			function add(element){
				if( element == null ){
					return;
				}
				
				if( ids[ element.id() ] == null ){
					elements.push(element);
					ids[ element.id() ] = true;
				}
			}
			
			// add own
			this.each(function(i, element){
				add(element);
			});
			
			// add toAdd
			var collection = toAdd.collection();
			collection.each(function(i, element){
				add(element);
			});
			
			return new $$.CyCollection(this.cy(), elements);
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

			this.edges().each(function(){
				var src = this.cy().getElementById( this.data(params.attr) ).element();
				sources.push( src );
			});
			
			return new $$.CyCollection( this.cy(), sources ).filter( selector );
		}
	}

	$$.fn.collection({
		edgesWith: defineEdgesWithFunction()
	});
	
	$$.fn.collection({
		edgesTo: defineEdgesWithFunction({
			include: function( node, otherNode, edgeStruct ){
				return edgeStruct.target.same( otherNode );
			}
		})
	});
	
	function defineEdgesWithFunction( params ){
		var defaults = {
			include: function( node, otherNode, edgeStruct ){
				return true;
			}
		};
		params = $.extend(true, {}, defaults, params);
		
		return function(otherNodes){
			var elements = [];

			// get elements if a selector is specified
			if( $$.is.string(otherNodes) ){
				otherNodes = this.cy().$( otherNodes );
			}
			
			this.nodes().each(function(i, node){
				otherNodes.nodes().each(function(j, otherNode){
					var edgesMap = node.element()._private.edges[ otherNode.id() ];
					
					if( edgesMap != null ){
						$.each(edgesMap, function(edgeId, edgeStruct){
							if( params.include( node, otherNode, edgeStruct ) ){
								elements.push( edgeStruct.edge );
							}
						} );
					}
				});
			});
			
			return new $$.CyCollection( this.cy(), elements );
		};
	}
	
	$$.fn.collection({
		connectedEdges: function( selector ){
			var elements = [];
			
			this.nodes().each(function(i, node){
				$.each(node.element()._private.edges, function(otherNodeId, edgesById){
					$.each(edgesById, function(edgeId, edgeStruct){
						elements.push( edgeStruct.edge );
					});
				});
			});
			
			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		}
	});
	
	$$.fn.collection({
		connectedNodes: function( selector ){
			return this.source().add( this.target() ).filter( selector );
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
			include: function( source, target, edgeStruct ){
				return true;
			}
		};
		params = $.extend(true, {}, defaults, params);
		
		return function( selector ){
			var elements = [];
			
			this.edges().each(function(i, edge){
				var src = edge.source().element();
				var tgt = edge.target().element();
				
				// look at edges between src and tgt
				$.each( src._private.edges[ tgt.id() ], function(id, edgeStruct){
					if( params.include(src, tgt, edgeStruct) ){
						elements.push( edgeStruct.edge );
					}
				});
			});
			
			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		};
	
	}




	// Compound functions
	/////////////////////

	$$.fn.collection({
		parent: function( selector ){
			var parents = [];

			this.forEach(function(i, ele){
				var parent = ele.cy().getElementById( ele.data("parent") );

				if( parent.size() > 0 ){
					parents.push( parent.element() );
				}
			});
			
			return new $$.CyCollection( this.cy(), parents ).filter( selector );
		},

		parents: function( selector ){
			var parents = [];

			var eles = this.parent();
			while( eles.nonempty() ){
				eles.forEach(function(i, ele){
					parents.push( ele );
				});

				eles = eles.parent();
			}

			return new $$.CyCollection( this.cy(), parents ).filter( selector );
		},

		children: function( selector ){
			var children = [];

			this.each(function(){
				var ele = this.element();

				$$.util.each(ele._private.children, function(id, child){
					children.push( child );
				});
			});

			return new $$.CyCollection( this.cy(), children ).filter( selector );
		},

		siblings: function( selector ){
			return this.parent().children().not( this ).filter( selector );
		},

		descendants: function( selector ){
			var elements = [];

			function add( eles ){
				eles.forEach(function(i, ele){
					elements.push( ele );

					if( ele.children().nonempty() ){
						add( ele.children() );
					}
				});
			}

			add( this.children() );

			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		}
	});

	
})(jQuery, jQuery.cytoscape);
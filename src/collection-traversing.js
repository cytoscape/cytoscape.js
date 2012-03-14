;(function($, $$){

	$$.fn.collection({
		name: "nodes",
		impl: function(selector){
			return this.filter(function(i, element){
				return element.isNode();
			});
		}
	});

	$$.fn.collection({
		name: "edges",
		impl: function(selector){
			return this.filter(function(i, element){
				return element.isEdge();
			});
		}
	});

	$$.fn.collection({
		name: "filter",
		impl: function(filter){
			var cy = this.cy();
			
			if( $$.is.fn(filter) ){
				var elements = [];
				this.each(function(i, element){
					if( filter.apply(element, [i, element]) ){
						elements.push(element);
					}
				});
				
				return new $$.CyCollection(this.cy(), elements);
			} else if( $$.is.string(filter) ){
				return new $$.CySelector(this.cy(), filter).filter(this);
			} else if( filter === undefined ){
				return this;
			}

			$$.console.warn("You must pass a function or a selector to `filter`");
			return new $$.CyCollection( this.cy() );
		}
	});

	$$.fn.collection({
		name: "not",
		impl: function(toRemove){
			
			if( toRemove == null ){
				return this;
			} else {
			
				if( $$.is.string(toRemove) ){
					toRemove = this.filter(toRemove);
				}
				
				var elements = [];
				var collection = toRemove.collection();
				
				this.each(function(i, element){
					
					var remove = false;
					for(var j = 0; j < collection.size(); j++){
						var c = collection.eq(j);
						
						if( c.same(element) ){
							remove = true;
							break;
						}
					}
					
					if(!remove){
						elements.push(element);
					}
					
				});
				
				return new $$.CyCollection(this.cy(), elements);
			} 
		}
	});
	
	$$.fn.collection({
		name: "intersect",
		impl: function( other ){
			var self = this;
			
			// if a selector is specified, then filter by it
			if( $$.is.string(other) ){
				var selector = other;
				return this.filter( selector );
			}
			
			if( $$.is.element(other) ){
				other = other.collection();
			}
			
			var elements = [];
			var col1 = this;
			var col2 = other;
			var col1Smaller = this.size() < other.size();
			var ids1 = col1Smaller ? col1._private.ids : col2._private.ids;
			var ids2 = col1Smaller ? col2._private.ids : col1._private.ids;
			
			$.each(ids1, function(id){
				if( ids2[ id ] ){
					elements.push( self.cy().getElementById(id) );
				}
			});
			
			return new $$.CyCollection( this.cy(), elements );
		}
	});
	
	$$.fn.collection({
		name: "add",
		impl: function(toAdd){
			
			if(toAdd == null){
				return this;
			}
			
			if( $$.is.string(toAdd) ){
				var selector = toAdd;
				toAdd = this.cy().elements(selector);
			}
			
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

	$$.fn.collection({
		name: "neighborhood",
		impl: function(selector){
			var elements = [];
			
			this.nodes().each(function(i, node){
				node.connectedEdges().each(function(j, edge){
					var otherNode = edge.connectedNodes().not(node).element();
					elements.push( otherNode ); // add node 1 hop away
					
					// add connected edge
					elements.push( edge.element() );
				});
			});
			
			return this.connectedNodes().add( new $$.CyCollection( this.cy(), elements ) ).filter( selector );
		}
	});
	
	$$.fn.collection({
		name: "closedNeighborhood",
		impl: function(selector){
			return new $$.CySelector(this.cy(), selector).filter( this.neighborhood().add(this) );
		}
	});
	$$.fn.collection({ name: "closedNeighbourhood", impl: function(selector){ return this.closedNeighborhood(selector); } });
	
	$$.fn.collection({
		name: "openNeighborhood",
		impl: function(selector){
			return this.neighborhood(selector);
		}
	});
	$$.fn.collection({ name: "openNeighbourhood", impl: function(selector){ return this.openNeighborhood(selector); } });
	
	$$.fn.collection({
		name: "source",
		impl: function(){
			var ele = this.element();

			if( ele.isNode() ){
				$$.console.warn("Can call `source()` only on edges---tried to call on node `%s`", ele._private.data.id);
				return new $$.CyCollection( ele.cy() );
			}
			
			return ele.cy().getElementById( ele._private.data.source ).collection();
		}
	});
	
	$$.fn.collection({
		name: "target",
		impl: function(){
			var ele = this.element();
			
			if( ele.isNode() ){
				$$.console.warn("Can call `target()` only on edges---tried to call on node `%s`", ele._private.data.id);
				return new $$.CyCollection( ele.cy() );
			}
			
			return ele.cy().getElementById( ele._private.data.target ).collection();
		}
	});
	
	$$.fn.collection({
		name: "edgesWith",
		impl: defineEdgesWithFunction()
	});
	
	$$.fn.collection({
		name: "edgesTo",
		impl: defineEdgesWithFunction({
			include: function( node, otherNode, edgeStruct ){
				return edgeStruct.source;
			}
		})
	});
	
	$$.fn.collection({
		name: "edgesFrom",
		impl: defineEdgesWithFunction({
			include: function( node, otherNode, edgeStruct ){
				return edgeStruct.target;
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
			
			this.nodes().each(function(i, node){
				otherNodes.nodes().each(function(j, otherNode){
					$.each( node.element()._private.edges[ otherNode.id() ], function(edgeId, edgeStruct){
						if( params.include( node, otherNode, edgeStruct ) ){
							elements.push( otherNode.element() );
						}
					} );
				});
			});
			
			return new $$.CyCollection( this.cy(), elements );
		};
	}
	
	$$.fn.collection({
		name: "connectedEdges",
		impl: function( selector ){
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
		name: "connectedNodes",
		impl: function( selector ){
			var elements = [];
			
			this.edges().each(function(i, edge){
				elements.push( edge.source().element() );
				elements.push( edge.target().element() );
			});
			
			return new $$.CyCollection( this.cy(), elements ).filter( selector );
		}
	});
	
	$$.fn.collection({
		name: "parallelEdges",
		impl: defineParallelEdgesFunction()
	});
	
	$$.fn.collection({
		name: "codirectedEdges",
		impl: defineParallelEdgesFunction({
			include: function( source, target, edgeStruct ){
				return edgeStruct.source;
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
	
})(jQuery, jQuery.cytoscapeweb);
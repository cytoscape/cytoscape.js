CyCollection.prototype.nodes = function(selector){
		return this.filter(function(i, element){
			return element.group() == "nodes";
		});
	};
	
	CyCollection.prototype.edges = function(selector){
		return this.filter(function(i, element){
			return element.group() == "edges";
		});
	};
	
	CyCollection.prototype.filter = function(filter){
		var cy = this.cy();
		
		if( $$.is.fn(filter) ){
			var elements = [];
			this.each(function(i, element){
				if( !$$.is.fn(filter) || filter.apply(element, [i, element]) ){
					elements.push(element);
				}
			});
			
			return new CyCollection(this.cy(), elements);
		} else if( $$.is.string(filter) ){
			return new $$.CySelector(this.cy(), filter).filter(this);
		} 

		$$.console.error("You must pass a function or a selector to `filter`");
	};
	
CyCollection.prototype.not = function(toRemove){
		
		if(toRemove == null){
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
					
					if( c.element() == element.element() ){
						remove = true;
						break;
					}
				}
				
				if(!remove){
					elements.push(element);
				}
				
			});
			
			return new CyCollection(this.cy(), elements);
		} 
	};
	
CyCollection.prototype.add = function(toAdd){
		
		if(toAdd == null){
			return this;
		}
		
		if( $$.is.string(toAdd) ){
			var selector = toAdd;
			toAdd = elementsCollection({ selector: selector });
		}
		
		var elements = [];
		var ids = {
			nodes: {},
			edges: {}
		};
	
		function add(element){
			if( element == null ){
				return;
			}
			
			if( ids[element._private.group][element._private.data.id] == null ){
				elements.push(element);
				ids[element._private.group][element._private.data.id] = true;
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
		
		return new CyCollection(this.cy(), elements);
	};
	
	
	CyElement.prototype.neighbourhood = CyElement.prototype.neighborhood = function(selector){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		var collection;
		
		if( this.group() == "nodes" ) {
			var node = this;
			var neighbors = [];
			var nodes = {};
			$.each(structs.nodeToEdges[ this._private.data.id ], function(id, edge){
				neighbors.push(edge);
				
				$.each([ edge._private.data.source, edge._private.data.target ], function(i, nodeId){
					
					if( nodes[nodeId] == null ){
						if( (nodeId != node._private.data.id) ){
							nodes[nodeId] = true;
							neighbors.push( structs.nodes[nodeId] );
						}
					}
					
				});
			});
			collection = new CyCollection(this.cy(), neighbors);
			
		} else if( this.group() == "edges" ){
			
			var neighbors = [];
			var nodes = {};
			var edge = this;
			$.each([ edge._private.data.source, edge._private.data.target ], function(i, nodeId){
				
				if( nodes[nodeId] == null ){
					nodes[nodeId] = true;
					
					neighbors.push( structs.nodes[nodeId] );
				}
				
			});
			collection = new CyCollection(this.cy(), neighbors);
			
		}
		
		collection = new $$.CySelector(this.cy(), selector).filter(collection);
		
		return collection;
	};
	
	
	CyElement.prototype.closedNeighbourhood = CyElement.prototype.closedNeighborhood = function(selector){
		return new $$.CySelector(this.cy(), selector).filter( this.neighborhood().add(this) );
	};
	
	CyElement.prototype.openNeighbourhood = CyElement.prototype.openNeighborhood = function(selector){
		return this.neighborhood(selector);
	};
	
	
	CyElement.prototype.source = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this._private.group == "nodes" ){
			$$.console.error("Can call `source` only on edges---tried to call on node `%s`", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.source ];
	};
	
	CyElement.prototype.target = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this._private.group == "nodes" ){
			$$.console.error("Can call `target` only on edges---tried to call on node `%s`", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.target ];
	};
	
	CyElement.prototype.edgesWith = function(otherNode){
		if( otherNode.isEdge() ){
			$$.console.error("Can not call `edgesWith` on edge `%s`; only nodes have edges", this._private.data.id);
			return this;
		}
		
		var nodes = otherNode.collection();
		var elements = [];
		
		for(var i = 0; i < nodes.size(); i++){
			var map = this.cy().getEdgesBetweenNodes(this, nodes[i]);
			for(var i in map){
				var element = map[i];
				elements.push(element);
			}
		}
		
		
		return new CyCollection(this.cy(), elements);
	}
	
	CyElement.prototype.parallelEdges = function(selector){
		if( this.isNode() ){
			$$.console.error("Can not call `parallelEdges` on node `%s`; only edges have sources", this._private.data.id);
			return this;
		}
		
		var map = this.cy().getParallelEdgesForEdge(this);
		var elements = [];
		for(var i in map){
			var element = map[i];
			elements.push(element);
		}
		
		var collection = new CyCollection(this.cy(), elements);
		
		if( $$.is.string(selector) ){
			collection = collection.filter(selector);
		}
		
		return collection;
	};
	
	CyElement.prototype.target = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this.isNode() ){
			$$.console.error("Can not call `target` on node `%s`; only edges have targets", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.target ];
	};
	
	CyElement.prototype.source = function(){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this.isNode() ){
			$$.console.error("Can not call `source` on node `%s`; only edges have sources", this._private.data.id);
			return this;
		}
		
		return structs.nodes[ this._private.data.source ];
	};
	
	CyElement.prototype.connectedNodes = function( selector ){
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( this.isNode() ){
			$$.console.error("Can not call `connectedNodes` on node `%s`; only edges have a source and target", this._private.data.id);
			return this;
		}
		
		var source = structs.nodes[ this._private.data.source ];
		var target = structs.nodes[ this._private.data.target ];
		
		return source.collection().add(target).filter( selector );
	};
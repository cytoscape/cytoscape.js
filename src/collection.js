;(function($, $$){
	
	// Use this interface to define functions for collections/elements.
	// This interface is good, because it forces you to think in terms
	// of the collections case (more than 1 element), so we don't need
	// notification blocking nonsense everywhere.
	//
	// Other collection-*.js files depend on this being defined first.
	// It's a trade off: It simplifies the code for CyCollection and 
	// CyElement integration so much that it's worth it to create the
	// JS dependency.
	//
	// Having this integration guarantees that we can call any
	// collection function on an element and vice versa.
	$$.fn.collection = function( impl, options ){
		for(var name in impl){
			
			// When adding a function, write it from the perspective of a
			// collection -- it's more generic.
			$$.CyCollection.prototype[ name ] = impl[name];
			
			// The element version of the function is then the trivial
			// case of a collection of size 1.
			$$.CyElement.prototype[ name ] = function(){
				var self = this.collection();
				return self[ name ].apply(self, arguments);
			};
			
		}
	};
	
	// factory for generating edge ids when no id is specified for a new element
	var idFactory = {
		prefix: {
			nodes: "n",
			edges: "e"
		},
		id: {
			nodes: 0,
			edges: 0
		},
		generate: function(element, tryThisId){
			var group = element._private.group;
			var structs = element._private.cy._private;
			var id = tryThisId != null ? tryThisId : this.prefix[group] + this.id[group];
			
			while( structs[group][id] != null ){
				id = this.prefix[group] + ( ++this.id[group] );
			}
			
			return id;
		}
	};
	
	// CyElement
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a node or an edge
	function CyElement(cy, params){
		var self = this;
		
		if( cy === undefined || params === undefined || cy.$ == null ){
			$$.console.error("An element must have a core reference and parameters set");
			return;
		}
		
		// validate group
		if( params.group != "nodes" && params.group != "edges" ){
			$$.console.error("An element must be of type `nodes` or `edges`; you specified `%s`", params.group);
			return;
		}
		
		this.length = 1;
		this[0] = this;
		
		this._private = {
			cy: cy,
			data: $$.util.copy( params.data ) || {}, // data object
			position: $$.util.copy( params.position ) || {}, // fields x, y, etc (could be 3d or radial coords; renderer decides)
			listeners: {}, // map ( type => array of function spec objects )
			group: params.group, // string; "nodes" or "edges"
			bypass: $$.util.copy( params.bypass ) || {}, // the bypass object
			style: {}, // the rendered style populated by the renderer
			removed: true, // whether it's inside the vis; true if removed (set true here since we call restore)
			selected: params.selected ? true : false, // whether it's selected
			selectable: params.selectable || params.selectable === undefined ? true : false, // whether it's selectable
			locked: params.locked ? true : false, // whether the element is locked (cannot be moved)
			grabbed: false, // whether the element is grabbed by the mouse; renderer sets this privately
			grabbable: params.grabbable || params.grabbable === undefined ? true : false, // whether the element can be grabbed
			classes: {}, // map ( className => true )
			animation: { // object for currently-running animations
				current: [],
				queue: []
			},
			renderer: {}, // object in which the renderer can store information
			scratch: {}, // scratch objects
			edges: {} // map of connected edges ( otherNodeId: { edgeId: { source: true|false, target: true|false, edge: edgeRef } } )
		};
		
		// renderedPosition overrides if specified
		// you shouldn't and can't use this option with cy.load() since we don't have access to the renderer yet
		// AND the initial state of the graph is such that renderedPosition and position are the same
		if( params.renderedPosition != null ){
			this._private.position = this.cy().renderer().modelPoint(params.renderedPosition);
		}
		
		if( $$.is.string(params.classes) ){
			$.each(params.classes.split(/\s+/), function(i, cls){
				if( cls != "" ){
					self._private.classes[cls] = true;
				}
			});
		}
		
		this.restore();
	}
	$$.CyElement = CyElement; // expose
	
	CyElement.prototype.cy = function(){
		return this._private.cy;
	};
	
	CyElement.prototype.element = function(){
		return this;
	};
	
	CyElement.prototype.collection = function(){
		return new CyCollection(this.cy(), [ this ]);
	};

	
	// CyCollection
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a set of nodes, edges, or both together
	function CyCollection(cy, elements){
		
		if( cy === undefined || cy.$ == null ){
			$$.console.error("A collection must have a reference to the core");
			return;
		}
		
		var ids = {};
		var uniqueElements = [];
		
		if( elements == null ){
			elements = [];
		}
		
		$.each(elements, function(i, element){
			if( element == null ){
				return;
			}
			
			var id = element.element()._private.data.id;
			
			if( ids[ id ] == null ){
				ids[ id ] = true;
				uniqueElements.push( element );
			}
		});
		
		for(var i = 0; i < uniqueElements.length; i++){
			this[i] = uniqueElements[i];
		}
		this.length = uniqueElements.length;
		
		this._private = {
			cy: cy,
			ids: ids
		};
	}
	$$.CyCollection = CyCollection; // expose

	CyCollection.prototype.cy = function(){
		return this._private.cy;
	};
	
	CyCollection.prototype.element = function(){
		return this[0];
	};
	
	CyCollection.prototype.collection = function(){
		return this;
	};

	
	
	// Functions
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$$.fn.collection({
		restore: function( notifyRenderer ){
			var restored = new CyCollection(this.cy());
			
			if( notifyRenderer === undefined ){
				notifyRenderer = true;
			}
			
			this.each(function(){
				if( !this.removed() ){
					// don't need to do anything
					return;
				}
				
				var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
				
				// set id and validate
				if( this._private.data.id == null ){
					this._private.data.id = idFactory.generate( this );
				} else if( this.cy().getElementById( this._private.data.id ).size() != 0 ){
					$$.console.error("Can not create element: an element in the visualisation already has ID `%s`", this.element()._private.data.id);
					return this;
				}
				
				// validate source and target for edges
				if( this.isEdge() ){
					
					var fields = ["source", "target"];
					for(var i = 0; i < fields.length; i++){
						
						var field = fields[i];
						var val = this._private.data[field];
						
						if( val == null || val == "" ){
							$$.console.error("Can not create edge with id `%s` since it has no `%s` attribute set in `data` (must be non-empty value)", this._private.data.id, field);
							return;
						} else if( structs.nodes[val] == null ){ 
							$$.console.error("Can not create edge with id `%s` since it specifies non-existant node as its `%s` attribute with id `%s`",  this._private.data.id, field, val);
							return;
						}
					}
					
					var src = this.cy().getElementById( this._private.data.source );
					var tgt = this.cy().getElementById( this._private.data.target );
					
					function connect( node, otherNode, edge ){
						var otherId = otherNode.element()._private.data.id;
						var edgeId = edge.element()._private.data.id;
						
						if( node._private.edges[ otherId ] == null ){
							 node._private.edges[ otherId ] = {};
						}
						
						node._private.edges[ otherId ][ edgeId ] = {
							edge: edge,
							source: src,
							target: tgt
						};
					}
					
					// connect reference to source
					connect( src, tgt, this );
					
					// connect reference to target
					connect( tgt, src, this );
				} 
				 
				this._private.removed = false;
				structs[ this._private.group ][ this._private.data.id ] = this;
				
				// update mapper structs
				var self = this;
				$.each(this._private.data, function(name, val){
					self.cy().addContinuousMapperBounds(self, name, val);
				});
				
				restored = restored.add(this);
			});
			
			if( restored.size() > 0 ){
				if( notifyRenderer ){
					restored.rtrigger("add");
				} else {
					restored.trigger("add");
				}
				
			}
			
			return this;
		}
	});
	
	$$.fn.collection({
		removed: function(){
			return this.element()._private.removed;
		}
	});
	
	$$.fn.collection({
		remove: function( notifyRenderer ){
			var removed = [];
			var edges = {};
			var nodes = {};
			
			if( notifyRenderer === undefined ){
				notifyRenderer = true;
			}
			
			this.each(function(){
				if( this.isNode() ){
					var node = this.element();
					nodes[ node.id() ] = this;
					
					$.each(node._private.edges, function(otherNodeId, map){
						$.each(map, function(edgeId, struct){
							edges[ edgeId ] = struct.edge;
						});
					});
				}
				
				if( this.isEdge() ){
					edges[ this.id() ] = this;
				}
			});
			
			$.each( [edges, nodes], function(i, elements){
				$.each(elements, function(id, element){
					var ele = element.element();
					var group = ele._private.group;
					
					// mark self as removed via flag
					ele._private.removed = true;
					
					// remove reference from core
					delete ele.cy()._private[ ele.group() ][ ele.id() ];
					
					// remove mapper bounds for all data removed
					$.each(ele._private.data, function(attr, val){
						ele.cy().removeContinuousMapperBounds(ele, attr, val);
					});
					
					// add to list of removed elements
					removed.push( ele );
					
					// if edge, delete references in nodes
					if( ele.isEdge() ){
						var src = ele.source().element();
						var tgt = ele.target().element();
						
						delete src._private.edges[ tgt.id() ][ ele.id() ];
						delete tgt._private.edges[ src.id() ][ ele.id() ];
					}
				});
			} );
			
			var removedElements = new $$.CyCollection( this.cy(), removed );
			if( removedElements.size() > 0 ){
				// must manually notify since trigger won't do this automatically once removed
				
				if( notifyRenderer ){
					this.cy().notify({
						type: "remove",
						collection: removedElements
					});
				}
				
				removedElements.trigger("remove");
			}
			
			return this;
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);


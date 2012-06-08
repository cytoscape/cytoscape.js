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
		$.each(impl, function(name, fn){
			
			// When adding a function, write it from the perspective of a
			// collection -- it's more generic.
			$$.CyCollection.prototype[ name ] = fn;
			
			// The element version of the function is now just the same as
			// that for the collection, since an element should have all
			// the facilities of a collection.
			$$.CyElement.prototype[ name ] = fn;
			
		});
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
		generate: function(cy, element, tryThisId){
			var json = $$.is.element( element ) ? element._private : element;
			var group = json.group;
			var id = tryThisId != null ? tryThisId : this.prefix[group] + this.id[group];
			
			if( cy.getElementById(id).empty() ){
				this.id[group]++; // we've used the current id, so move it up
			} else { // otherwise keep trying successive unused ids
				while( !cy.getElementById(id).empty() ){
					id = this.prefix[group] + ( ++this.id[group] );
				}
			}
			
			return id;
		}
	};
	
	// CyElement
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a node or an edge
	function CyElement(cy, params, restore){
		var self = this;
		restore = (restore === undefined || restore ? true : false);
		
		if( cy === undefined || params === undefined || !(cy instanceof $$.CyCore) ){
			$.error("An element must have a core reference and parameters set");
			return;
		}
		
		// validate group
		if( params.group != "nodes" && params.group != "edges" ){
			$.error("An element must be of type `nodes` or `edges`; you specified `%s`", params.group);
			return;
		}
		
		// make the element array-like, just like a collection
		this.length = 1;
		this[0] = this;
		
		// NOTE: when something is added here, add also to ele.json()
		this._private = {
			cy: cy,
			data: $$.util.copy( params.data ) || {}, // data object
			position: $$.util.copy( params.position ) || {}, // fields x, y, etc (could be 3d or radial coords; renderer decides)
			listeners: {}, // map ( type => array of function spec objects )
			group: params.group, // string; "nodes" or "edges"
			bypass: $$.util.copy( params.bypass ) || {}, // the bypass object
			style: {}, // the calculated style
			removed: true, // whether it's inside the vis; true if removed (set true here since we call restore)
			selected: params.selected ? true : false, // whether it's selected
			selectable: params.selectable === undefined ? true : ( params.selectable ? true : false ), // whether it's selectable
			locked: params.locked ? true : false, // whether the element is locked (cannot be moved)
			grabbed: false, // whether the element is grabbed by the mouse; renderer sets this privately
			grabbable: params.grabbable === undefined ? true : ( params.grabbable ? true : false ), // whether the element can be grabbed
			classes: {}, // map ( className => true )
			animation: { // object for currently-running animations
				current: [],
				queue: []
			},
			renscratch: {}, // object in which the renderer can store information
			scratch: {}, // scratch objects
			edges: {}, // map of connected edges ( otherNodeId: { edgeId: { source: true|false, target: true|false, edge: edgeRef } } )
			children: {} // map of children ( otherNodeId: otherNodeRef )
		};
		
		// renderedPosition overrides if specified
		// you shouldn't and can't use this option with cy.load() since we don't have access to the renderer yet
		// AND the initial state of the graph is such that renderedPosition and position are the same
		if( params.renderedPosition != null ){
			this._private.position = this.cy().renderer().modelPoint(params.renderedPosition);
		}
		
		if( $$.is.string(params.classes) ){
			var classes = params.classes.split(/\s+/);
			for( var i = 0, l = classes.length; i < l; i++ ){
				var cls = classes[i];
				if( !cls || cls === "" ){ continue; }

				self._private.classes[cls] = true;
			}
		}
		
		if( restore === undefined || restore ){
			this.restore();
		}
		
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
		
		if( cy === undefined || !(cy instanceof $$.CyCore) ){
			$.error("A collection must have a reference to the core");
			return;
		}
		
		var ids = {};
		var uniqueElements = [];
		var createdElements = false;
		
		if( elements == null ){
			elements = [];
		} else if( elements.length > 0 && $$.is.plainObject( elements[0] ) && !$$.is.element( elements[0] ) ){
			createdElements = true;

			// make elements from json and restore all at once later
			var eles = [];
			var elesIds = {};

			for( var i = 0, l = elements.length; i < l; i++ ){
				var json = elements[i];

				if( json.data == null ){
					json.data = {};
				}
				
				var data = json.data;

				// make sure newly created elements have valid ids
				if( data.id == null ){
					data.id = idFactory.generate( cy, json );
				} else if( cy.getElementById( data.id ).size() != 0 || elesIds[ data.id ] ){
					$.error("Can not create element: an element in the visualisation already has ID `" + data.id + "`");
					return;
				}

				var ele = new $$.CyElement( cy, json, false );
				eles.push( ele );
				elesIds[ data.id ] = true;
			}

			elements = eles;
		}
		
		for( var i = 0, l = elements.length; i < l; i++ ){
			var element = elements[i];
			if( !element ){	continue; }
			
			var id = element._private.data.id;
			
			if( !ids[ id ] ){
				ids[ id ] = element;
				uniqueElements.push( element );
			}
		}
		
		for(var i = 0, l = uniqueElements.length; i < l; i++){
			this[i] = uniqueElements[i];
		}
		this.length = uniqueElements.length;
		
		this._private = {
			cy: cy,
			ids: ids
		};

		// restore the elements if we created them from json
		if( createdElements ){
			this.restore();
		}
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
		json: function(){
			var ele = this.element();
			if( ele == null ){ return undefined }

			var p = ele._private;
			
			var json = $$.util.copy({
				data: p.data,
				position: p.position,
				group: p.group,
				bypass: p.bypass,
				removed: p.removed,
				selected: p.selected,
				selectable: p.selectable,
				locked: p.locked,
				grabbed: p.grabbed,
				grabbable: p.grabbable,
				classes: "",
				scratch: p.scratch
			});
			
			var classes = [];
			$.each(p.classes, function(cls, bool){
				classes.push(cls);
			});
			
			$.each(classes, function(i, cls){
				json.classes += cls + ( i < classes.length - 1 ? " " : "" );
			});
			
			return json;
		}
	});

	$$.fn.collection({
		restore: function( notifyRenderer ){
			var self = this;
			var restored = [];
			var cy = self.cy();
			
			if( notifyRenderer === undefined ){
				notifyRenderer = true;
			}

			// create arrays of nodes and edges, since we need to
			// restore the nodes first
			var elements = [];
			var numNodes = 0;
			var numEdges = 0;
			for( var i = 0, l = self.length; i < l; i++ ){
				var ele = self[i];
				
				// keep nodes first in the array and edges after
				if( ele.isNode() ){ // put to front of array if node
					elements.unshift( ele );
					numNodes++;
				} else { // put to end of array if edge
					elements.push( ele );
					numEdges++;
				}
			}

			// now, restore each element
			for( var i = 0, l = elements.length; i < l; i++ ){
				var ele = elements[i];

				if( !ele.removed() ){
					// don't need to do anything
					return;
				}
				
				var _private = ele._private;
				var structs = cy._private; // TODO remove ref to `structs`
				var data = _private.data;
				
				// set id and validate
				if( data.id === undefined ){
					data.id = idFactory.generate( cy, ele );
				} else if( data.id === "" || !$$.is.string(data.id) ){
					// can't create element if it has empty string as id or non-string id
					continue;
				} else if( cy.getElementById( data.id ).length != 0 ){
					// can't create element if one already has that id
					continue;
				}

				var id = data.id; // id is finalised, now let's keep a ref
				
				if( ele.isEdge() ){ // extra checks for edges
					
					var fields = ["source", "target"];
					var fieldsLength = fields.length;
					for(var j = 0; j < fieldsLength; j++){
						
						var field = fields[j];
						var val = data[field];
						
						if( val == null || val === "" ){
							// can't create if source or target is not defined properly
							continue;
						} else if( cy.getElementById(val).empty() ){ 
							// can't create edge if one of its nodes doesn't exist
							continue;
						}
					}
					
					var src = cy.getElementById( data.source );
					var tgt = cy.getElementById( data.target );
					var srcid = src.id();
					var tgtid = tgt.id();
					var srcmap = src._private.edges;
					var tgtmap = tgt._private.edges;
					
					// connect references in the nodes
					var edgeRef = {
						source: src,
						target: tgt,
						edge: ele
					};

					if( !srcmap[ tgtid ] ){
						srcmap[ tgtid ] = {};
					}
					srcmap[ tgtid ][ id ] = edgeRef;

					if( !tgtmap[ srcid ] ){
						tgtmap[ srcid ] = {};
					}
					tgtmap[ srcid ][ id ] = edgeRef;

				} // if is edge
				 
				// create mock ids map for element so it can be used like collections
				_private.ids = {};
				_private.ids[ data.id ] = ele;

				_private.removed = false;
				structs[ _private.group ][ data.id ] = ele;
				
				restored.push( ele );
			} // for each element

			// do compound node sanity checks
			for( var i = 0; i < numNodes; i++ ){ // each node 
				var node = elements[i];
				var data = node._private.data;
				var id = data.id;

				var parentId = node._private.data.parent;
				var specifiedParent = parentId != null;

				if( specifiedParent ){
					var parent = cy.getElementById( parentId );

					if( parent.empty() ){
						$.error("Node with id `" + id + "` specifies non-existant parent `" + parentId + "`");
					} else {

						var selfAsParent = false;
						var ancestor = parent;
						while( !ancestor.empty() ){
							if( node.same(ancestor) ){
								$.error("Node with id `" + id + "` has self as ancestor");
								
								// mark self as parent and remove from data
								selfAsParent = true;
								delete node.element()._private.data.parent;

								// exit or we loop forever
								break;
							}

							ancestor = ancestor.parent();
						}

						if( !selfAsParent ){
							// connect with children
							parent.element()._private.children[ id ] = node;
						}
					} // else
				} // if specified parent
			} // for each node
			
			restored = new $$.CyCollection( cy, restored );
			if( restored.length > 0 ){
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
			var ele = this[0];
			return ele && ele._private.removed;
		},

		inside: function(){
			return !this.removed();
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
			
			// make the list of elements to remove
			// (may be removing more than specified due to connected edges etc)
			this.each(function(){
				if( this.isNode() ){
					var node = this.element();
					nodes[ node.id() ] = this;
					
					// add connected edges
					function removeConnectedEdges(node){
						$.each(node._private.edges, function(otherNodeId, map){
							$.each(map, function(edgeId, struct){
								edges[ edgeId ] = struct.edge;
							});
						});
					}
					removeConnectedEdges( node );

					// add descendant nodes
					function addChildren(node){
						if( node.children().nonempty() ){
							$.each(node._private.children, function(childId, child){
								nodes[ childId ] = child;

								// also need to remove connected edges
								removeConnectedEdges( child );

								if( child.children().nonempty() ){
									addChildren( child );
								}
							});
						}
					}
					addChildren( node );
				}
				
				if( this.isEdge() ){
					edges[ this.id() ] = this;
				}
			});
			
			// now actually remove the elements
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
	
})(jQuery, jQuery.cytoscape);


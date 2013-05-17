;(function($$){
	
	// Use this interface to define functions for collections/elements.
	// This interface is good, because it forces you to think in terms
	// of the collections case (more than 1 element), so we don't need
	// notification blocking nonsense everywhere.
	//
	// Other collection-*.js files depend on this being defined first.
	// It's a trade off: It simplifies the code for Collection and 
	// Element integration so much that it's worth it to create the
	// JS dependency.
	//
	// Having this integration guarantees that we can call any
	// collection function on an element and vice versa.
	$$.fn.collection = $$.fn.eles = function( fnMap, options ){
		for( var name in fnMap ){
			var fn = fnMap[name];

			$$.Collection.prototype[ name ] = fn;
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
	
	// Element
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a node or an edge
	$$.Element = function(cy, params, restore){
		if( !(this instanceof $$.Element) ){
			return new $$.Element(cy, params, restore);
		}

		var self = this;
		restore = (restore === undefined || restore ? true : false);
		
		if( cy === undefined || params === undefined || !$$.is.core(cy) ){
			$$.util.error("An element must have a core reference and parameters set");
			return;
		}
		
		// validate group
		if( params.group !== "nodes" && params.group !== "edges" ){
			$$.util.error("An element must be of type `nodes` or `edges`; you specified `" + params.group + "`");
			return;
		}
		
		// make the element array-like, just like a collection
		this.length = 1;
		this[0] = this;
		
		// NOTE: when something is added here, add also to ele.json()
		this._private = {
			cy: cy,
			single: true, // indicates this is an element
			data: params.data || {}, // data object
			position: params.position || {}, // fields x, y, etc (could be 3d or radial coords; renderer decides)
			autoWidth: undefined, // width and height of nodes calculated by the renderer when set to special "auto" value
			autoHeight: undefined, 
			listeners: [], // array of bound listeners
			group: params.group, // string; "nodes" or "edges"
			style: {}, // properties as set by the style
			rstyle: {}, // properties for style sent from the renderer to the core
			styleCxts: [], // applied style contexts from the styler
			removed: true, // whether it's inside the vis; true if removed (set true here since we call restore)
			selected: params.selected ? true : false, // whether it's selected
			selectable: params.selectable === undefined ? true : ( params.selectable ? true : false ), // whether it's selectable
			locked: params.locked ? true : false, // whether the element is locked (cannot be moved)
			grabbed: false, // whether the element is grabbed by the mouse; renderer sets this privately
			grabbable: params.grabbable === undefined ? true : ( params.grabbable ? true : false ), // whether the element can be grabbed
			active: false, // whether the element is active from user interaction
			classes: {}, // map ( className => true )
			animation: { // object for currently-running animations
				current: [],
				queue: []
			},
			rscratch: {}, // object in which the renderer can store information
			scratch: {}, // scratch objects
			edges: [], // array of connected edges
			children: [] // array of children
		};
		
		// renderedPosition overrides if specified
		if( params.renderedPosition ){
			var rpos = params.renderedPosition;
			var pan = cy.pan();
			var zoom = cy.zoom();

			this._private.position = {
				x: (rpos.x - pan.x)/zoom,
				y: (rpos.y - pan.y)/zoom
			};
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
		
	};

	
	// Collection
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// represents a set of nodes, edges, or both together
	$$.Collection = function(cy, elements){
		if( !(this instanceof $$.Collection) ){
			return new $$.Collection(cy, elements);
		}

		if( cy === undefined || !$$.is.core(cy) ){
			$$.util.error("A collection must have a reference to the core");
			return;
		}
		
		var ids = {};
		var uniqueElements = [];
		var createdElements = false;
		
		if( !elements ){
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
				} else if( cy.getElementById( data.id ).length != 0 || elesIds[ data.id ] ){
					continue; // can't create element
				}

				var ele = new $$.Element( cy, json, false );
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
	};
	
	
	// Functions
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	// keep the prototypes in sync (an element has the same functions as a collection)
	// and use $$.elefn and $$.elesfn as shorthands to the prototypes
	$$.elefn = $$.elesfn = $$.Element.prototype = $$.Collection.prototype;

	$$.elesfn.cy = function(){
		return this._private.cy;
	};
	
	$$.elesfn.element = function(){
		return this[0];
	};
	
	$$.elesfn.collection = function(){
		if( $$.is.collection(this) ){
			return this;
		} else { // an element
			return new $$.Collection( this._private.cy, [this] );
		}
	};

	$$.elesfn.json = function(){
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
			classes: ""
		});
		
		var classes = [];
		for( var cls in p.classes ){
			classes.push(cls);
		}
		
		for( var i = 0; i < classes.length; i++ ){
			var cls = classes[i];
			json.classes += cls + ( i < classes.length - 1 ? " " : "" );
		}
		
		return json;
	};

	$$.elesfn.restore = function( notifyRenderer ){
		var self = this;
		var restored = [];
		var cy = self.cy();
		
		if( notifyRenderer === undefined ){
			notifyRenderer = true;
		}

		// create arrays of nodes and edges, since we need to
		// restore the nodes first
		var elements = [];
		var nodes = [], edges = [];
		var numNodes = 0;
		var numEdges = 0;
		for( var i = 0, l = self.length; i < l; i++ ){
			var ele = self[i];
			
			// keep nodes first in the array and edges after
			if( ele.isNode() ){ // put to front of array if node
				nodes.push( ele );
				numNodes++;
			} else { // put to end of array if edge
				edges.push( ele );
				numEdges++;
			}
		}

		elements = nodes.concat( edges );

		// now, restore each element
		for( var i = 0, l = elements.length; i < l; i++ ){
			var ele = elements[i];

			if( !ele.removed() ){
				// don't need to do anything
				continue;
			}
			
			var _private = ele._private;
			var data = _private.data;
			
			// set id and validate
			if( data.id === undefined ){
				data.id = idFactory.generate( cy, ele );
			} else if( $$.is.emptyString(data.id) || !$$.is.string(data.id) ){
				// can't create element if it has empty string as id or non-string id
				continue;
			} else if( cy.getElementById( data.id ).length != 0 ){
				// can't create element if one already has that id
				continue;
			}

			var id = data.id; // id is finalised, now let's keep a ref
			
			if( ele.isEdge() ){ // extra checks for edges
				
				var edge = ele;
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

				src._private.edges.push( edge );
				tgt._private.edges.push( edge );

			} // if is edge
			 
			// create mock ids map for element so it can be used like collections
			_private.ids = {};
			_private.ids[ data.id ] = ele;

			_private.removed = false;
			cy.addToPool( ele );
			
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
					// non-existant parent; just remove it
					delete data.parent;
				} else {
					var selfAsParent = false;
					var ancestor = parent;
					while( !ancestor.empty() ){
						if( node.same(ancestor) ){
							// mark self as parent and remove from data
							selfAsParent = true;
							delete data.parent; // remove parent reference

							// exit or we loop forever
							break;
						}

						ancestor = ancestor.parent();
					}

					if( !selfAsParent ){
						// connect with children
						parent[0]._private.children.push( node );

						// let the core know we have a compound graph
						cy._private.hasCompoundNodes = true;
					}
				} // else
			} // if specified parent
		} // for each node
		
		restored = new $$.Collection( cy, restored );
		if( restored.length > 0 ){

			var toUpdateStyle = restored.add( restored.connectedNodes() ).add( restored.parent() );
			toUpdateStyle.updateStyle( notifyRenderer );

			if( notifyRenderer ){
				restored.rtrigger("add");
			} else {
				restored.trigger("add");
			}
		}
		
		return self; // chainability
	};
	
	$$.elesfn.removed = function(){
		var ele = this[0];
		return ele && ele._private.removed;
	};

	$$.elesfn.inside = function(){
		var ele = this[0];
		return ele && !ele._private.removed;
	};

	$$.elesfn.remove = function( notifyRenderer ){
		var self = this;
		var removed = [];
		var elesToRemove = [];
		var elesToRemoveIds = {};
		var cy = self._private.cy;
		
		if( notifyRenderer === undefined ){
			notifyRenderer = true;
		}
		
		// add connected edges
		function addConnectedEdges(node){
			var edges = node._private.edges; 
			for( var i = 0; i < edges.length; i++ ){
				add( edges[i] );
			}
		}
		

		// add descendant nodes
		function addChildren(node){
			var children = node._private.children;
			
			for( var i = 0; i < children.length; i++ ){
				add( children[i] );
			}
		}

		function add( ele ){
			var alreadyAdded =  elesToRemoveIds[ ele.id() ];
			if( alreadyAdded ){
				return;
			} else {
				elesToRemoveIds[ ele.id() ] = true;
			}

			if( ele.isNode() ){
				elesToRemove.push( ele ); // nodes are removed last

				addConnectedEdges( ele );
				addChildren( ele );
			} else {
				elesToRemove.unshift( ele ); // edges are removed first
			}
		}

		// make the list of elements to remove
		// (may be removing more than specified due to connected edges etc)

		for( var i = 0, l = self.length; i < l; i++ ){
			var ele = self[i];

			add( ele );
		}
		
		function removeEdgeRef(node, edge){
			var connectedEdges = node._private.edges;
			for( var j = 0; j < connectedEdges.length; j++ ){
				var connectedEdge = connectedEdges[j];
				
				if( edge === connectedEdge ){
					connectedEdges.splice( j, 1 );
					break;
				}
			}
		}

		function removeChildRef(parent, ele){
			ele = ele[0];
			parent = parent[0];
			var children = parent._private.children;

			for( var j = 0; j < children.length; j++ ){
				if( children[j][0] === ele[0] ){
					children.splice(j, 1);
					break;
				}
			}
		}

		for( var i = 0; i < elesToRemove.length; i++ ){
			var ele = elesToRemove[i];

			// mark as removed
			ele._private.removed = true;

			// remove from core pool
			cy.removeFromPool( ele );

			// add to list of removed elements
			removed.push( ele );

			if( ele.isEdge() ){ // remove references to this edge in its connected nodes
				var src = ele.source()[0];
				var tgt = ele.target()[0];

				removeEdgeRef( src, ele );
				removeEdgeRef( tgt, ele );

			} else { // remove reference to parent 
				var parent = ele.parent();

				if( parent.length !== 0 ){
					removeChildRef(parent, ele);
				}
			}
		}

		// check to see if we have a compound graph or not
		var elesStillInside = cy._private.elements;
		cy._private.hasCompoundNodes = false;
		for( var i = 0; i < elesStillInside.length; i++ ){
			var ele = elesStillInside[i];

			if( ele.isParent() ){
				cy._private.hasCompoundNodes = true;
				break;
			}
		}

		var removedElements = new $$.Collection( this.cy(), removed );
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

		// check for empty remaining parent nodes
		var checkedParentId = {};
		for( var i = 0; i < elesToRemove.length; i++ ){
			var ele = elesToRemove[i];
			var isNode = ele._private.group === "nodes";
			var parentId = ele._private.data.parent;

			if( isNode && parentId !== undefined && !checkedParentId[ parentId ] ){
				checkedParentId[ parentId ] = true;
				var parent = cy.getElementById( parentId );

				if( parent && parent.length !== 0 && !parent._private.removed && parent.children().length === 0 ){
					parent.updateStyle();
				}
			}
		}

		return this;
	};
	
})( cytoscape );


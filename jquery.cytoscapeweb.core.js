;(function($){

	// registered modules to cytoweb, indexed by name
	var reg = {
		format: {},
		renderer: {},
		layout: {},
		exporter: {}
	};

	var quiet = false;
	var debug = false;
	var console = {
		debug: function(){
			if( quiet || !debug || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.debug != null ){
				window.console.debug.apply(window.console, arguments);
			} else if( window.console != null && window.console.log != null ){
				window.console.log.apply(window.console, arguments);
			}
		},
			
		log: function(){
			if( quiet || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.log != null ){
				window.console.log.apply(window.console, arguments);
			}
		},
		
		warn: function(){
			if( quiet || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.warn != null ){
				window.console.warn.apply(window.console, arguments);
			} else {
				console.log.apply(window.console, arguments);
			}
		},
		
		error: function(){
			if( quiet || $.browser.msie ){ return; }
			
			if( window.console != null && window.console.error != null ){
				window.console.error.apply(window.console, arguments);
				
				if( window.console.trace != null ){
					window.console.trace();
				}
				
			} else {
				console.log.apply(window.console, arguments);
				throw "Cytoscape Web encountered the previously logged error";
				
				if( window.console.trace != null ){
					window.console.trace();
				}
			}
		}
	};
	
	function isString(obj){
		return obj != null && typeof obj == typeof "";
	}
	
	function isFunction(obj){
		return obj != null && typeof obj == typeof function(){};
	}
	
	function isArray(obj){
		return obj != null && obj instanceof Array;
	}
	
	function isPlainObject(obj){
		return obj != null && typeof obj == typeof {} && !isArray(obj);
	}
	
	function isNumber(obj){
		return obj != null && typeof obj == typeof 1 && !isNaN(obj);
	}
	
	function isColor(obj){
		return obj != null && typeof obj == typeof "" && $.Color(obj).toString != "";
	}
	
	// allow calls on a jQuery selector by proxying calls to $.cytoscapeweb
	// e.g. $("#foo").cytoscapeweb(options) => $.cytoscapeweb(options) on #foo
	$.fn.cytoscapeweb = function(opts){
		
		// get object
		if( opts == "get" ){
			var cy = $(this).data("cytoscapeweb");
			return cy;
		}
		
		// proxy to create instance
		else if( isPlainObject(opts) ){
			return $(this).each(function(){
				var options = $.extend({}, opts, {
					selector: $(this)
				});
			
				$.cytoscapeweb(options);
			});
		}
		
		// proxy a function call
		else {
			var rets = [];
			var args = [];
			for(var i = 1; i < arguments.length; i++){
				args[i - 1] = arguments[i];
			}
			
			$(this).each(function(){
				var cy = $(this).data("cytoscapeweb");
				var fnName = opts;
				
				if( cy != null && isFunction( cy[fnName] ) ){
					var ret = cy[fnName].apply(cy, args);
					rets.push(ret);
				}
			});
			
			// if only one instance, don't need to return array
			if( rets.length == 1 ){
				rets = rets[0];
			} else if( rets.length == 0 ){
				rets = $(this);
			}
			
			return rets;
		}

	};

	// allow functional access to cytoweb
	// e.g. var cytoweb = $.cytoscapeweb({ selector: "#foo", ... });
	//      var nodes = cytoweb.nodes();
	$.cytoscapeweb = function(opts){
		
		// create instance
		if( isPlainObject(opts) ){
			var defaults = {
				layout: {
					name: "forcedirected"
				},
				renderer: {
					name: "svg"
				},
				style: { // actual default style later specified by renderer
					global: {},
					nodes: {},
					edges: {}
				}
			};
			
			var options = $.extend(true, {}, defaults, opts);
			
			if( options.selector == null ){
				console.error("Cytoscape Web must be called on an element; specify `selector` in options or call on selector directly with jQuery, e.g. $('#foo').cy({...});");
				return;
			} else if( $(options.selector).size() > 1 ){
				console.error("Cytoscape Web can not be called on multiple elements in the functional call style; use the jQuery selector style instead, e.g. $('.foo').cy({...});");
				return;
			}
			
			options.layout.selector = options.selector;
			options.renderer.selector = options.selector;
			
			// structs to hold internal cytoweb model
			var structs = {
				style: options.style,
				nodes: {}, // id => node object
				edges: {}, // id => edge object
				nodeToEdges: {}, // id => array of edges
				edgeSiblings: {}, // id => array of edges
				continuousMapperBounds: { // data attr name => { min, max }
					nodes: {},
					edges: {}
				},
				live: {}, // event name => selector string => array of callbacks
				selectors: {}, // selector string => selector for live
				listeners: {} // cy || background => event name => array of callback functions
			};
			
			function parallelEdgeIds(node1Id, node2Id){				
				var id1 = node1Id < node2Id ? node1Id : node2Id;
				var id2 = id1 == node1Id ? node2Id : node1Id;
				
				return {
					id1: id1,
					id2: id2
				};
			}
			
			function addParallelEdgeToMap(element){
				var ids = parallelEdgeIds(element._private.data.source, element._private.data.target);
				var id1 = ids.id1;
				var id2 = ids.id2;
				
				if( structs.edgeSiblings[id1] == null ){
					structs.edgeSiblings[id1] = {};
				}
				
				if( structs.edgeSiblings[id1][id2] == null ){
					structs.edgeSiblings[id1][id2] = {};
				}
				
				var siblings = structs.edgeSiblings[id1][id2];
				siblings[element._private.data.id] = element;
				
				var length = 0;
				for(var i in siblings){
					length++;
				}
				
				element._private.index = length - 1;
			}
			
			function removeParallelEdgeFromMap(element){
				var ids = parallelEdgeIds(element._private.data.source, element._private.data.target);
				var id1 = ids.id1;
				var id2 = ids.id2;
				
				if( structs.edgeSiblings[id1] != null && structs.edgeSiblings[id1][id2] != null ){
					delete structs.edgeSiblings[id1][id2][element._private.data.id];
				}
			}
			
			function getParallelEdgesForEdge(element){
				var ids = parallelEdgeIds(element._private.data.source, element._private.data.target);
				var id1 = ids.id1;
				var id2 = ids.id2;
				
				return structs.edgeSiblings[id1][id2];
			}
			
			function getEdgesBetweenNodes(node1, node2){
				var ids = parallelEdgeIds(node1._private.data.id, node2._private.data.id);
				var id1 = ids.id1;
				var id2 = ids.id2;
				
				return structs.edgeSiblings[id1][id2];
			}
			
			// return a deep copy of an object
			function copy(obj){
				if( isArray(obj) ){
					return $.extend(true, [], obj);
				} else {
					return $.extend(true, {}, obj);
				}
			}
			
			function updateContinuousMapperBounds(group, name, val){
				if( isNumber(val) ){
					
					if( structs.continuousMapperBounds[ group ][ name ] == null ){
						structs.continuousMapperBounds[ group ][ name ] = {
							min: val,
							max: val
						};
					}
					
					if( val < structs.continuousMapperBounds[ group ][ name ].min ){
						structs.continuousMapperBounds[ group ][ name ].min = val;
					}
					
					if( val > structs.continuousMapperBounds[ group ][ name ].max ){
						structs.continuousMapperBounds[ group ][ name ].max = val;
					}
				}
			}
			
			var idFactory = {
				prefix: {
					nodes: "n",
					edges: "e"
				},
				id: {
					nodes: 0,
					edges: 0
				},
				generate: function(group, tryThisId){
					var id = tryThisId != null ? tryThisId : this.prefix[group] + this.id[group];
					
					while( structs[group][id] != null ){
						id = this.prefix[group] + ( ++this.id[group] );
					}
					
					return id;
				}
			};
			
			function isElementOrCollection(e){
				return e instanceof CyElement || e instanceof CyCollection;
			};
			
			// CyElement
			////////////////////////////////////////////////////////////////////////////////////////////////////
			
			// represents a node or an edge
			var CyElement = function(params){
				
				// validate group
				if( params.group != "nodes" && params.group != "edges" ){
					console.error("An element must be of type `nodes` or `edges`; you specified `%s`", params.group);
					return;
				}
				
				this._private = {
					data: copy( params.data ), // data object
					position: copy( params.position ), // fields x, y, etc (could be 3d or radial coords; renderer decides)
					listeners: {}, // map ( type => array of functions )
					group: params.group, // string; "nodes" or "edges"
					bypass: copy( params.bypass ),
					style: {}, // the rendered style populated by the renderer
					removed: false, // whether it's inside the vis; true if removed
					selected: params.selected ? true : false, // whether it's selected
					locked: params.locked ? true : false, // whether the element is locked (cannot be moved)
					grabbed: false // whether the element is grabbed by the mouse; renderer sets this privately
				};
				
				// set id and validate
				if( this._private.data.id == null ){
					this._private.data.id = idFactory.generate( this._private.group );
				} else if( structs[ this._private.group ][ this._private.data.id ] != null ){
					console.error("Can not create element: an element in the visualisation in group `%s` already has ID `%s`", this._private.group, this._private.data.id);
					return;
				}
				
				// validate source and target for edges
				if( this.isEdge() ){
					
					var fields = ["source", "target"];
					for(var i = 0; i < fields.length; i++){
						
						var field = fields[i];
						var val = this._private.data[field];
						
						if( val == null || val == "" ){
							console.error("Can not create edge with id `%s` since it has no `%s` attribute set in `data` (must be non-empty value)", this._private.data.id, field);
							return;
						} else if( structs.nodes[val] == null ){ 
							console.error("Can not create edge with id `%s` since it specifies non-existant node as its `%s` attribute with id `%s`",  this._private.data.id, field, val);
							return;
						} 
					}
					
					addParallelEdgeToMap(this);
					
				} 
				  
				structs[ this._private.group ][ this._private.data.id ] = this;
				
				// add to map of edges belonging to nodes
				if( this._private.group == "edges" ){
					if( structs.nodeToEdges[ this._private.data.source ] == null ){
						structs.nodeToEdges[this._private.data.source ] = {};
					}
					
					if( structs.nodeToEdges[ this._private.data.target ] == null ){
						structs.nodeToEdges[this._private.data.target ] = {};
					}
					
					structs.nodeToEdges[ this._private.data.source ][ this._private.data.id ] = this;
					structs.nodeToEdges[ this._private.data.target ][ this._private.data.id ] = this;
				} else if( this._private.group == "nodes" ){
					structs.nodeToEdges[ this._private.data.id ] = {};
				}
				
				// update mapper structs
				var self = this;
				$.each(this._private.data, function(name, val){
					updateContinuousMapperBounds(self._private.group, name, val);
				});
				
				this.trigger("add");
			};
			
			CyElement.prototype.collection = function(){
				return new CyCollection([ this ]);
			};
			
			CyElement.prototype.grabbed = function(){
				return this._private.grabbed;
			};
			
			CyElement.prototype.group = function(){
				return this._private.group;
			}
			
			CyElement.prototype.removed = function(){
				return this._private.removed;
			};
			
			// remove from cytoweb
			CyElement.prototype.remove = function(){
				if( !this._private.removed ){
					delete structs[ this._private.group ][ this._private.data.id ];
					this._private.removed = true;
					
					// remove from map of edges belonging to nodes
					if( this._private.group == "edges" ){
						delete structs.nodeToEdges[ this._private.data.source ][ this._private.data.id ];
						delete structs.nodeToEdges[ this._private.data.target ][ this._private.data.id ];
					} 
					
					// remove connected edges
					else if( this._private.group == "nodes" ){
						$.each(structs.nodeToEdges[ this._private.data.id ], function(id, edge){
							edge.remove();
						});
						
						structs.nodeToEdges[ this._private.data.id ] = {};
					}
					
					// must manually notify since trigger won't do this automatically once removed
					notify({
						type: "remove",
						collection: [ this ]
					});
					this.trigger("remove");
					
				} else {
					console.warn("Can not remove already removed element with group `%s` and ID `%s`", this.group(), this.data("id"));
				}
				
				return this;
			};

			function switchFunction(params){
				return function(fn){
					if( isFunction(fn) ){
						this.bind(params.event, fn);
					} else if( this._private[params.field] != params.value ) {
						this._private[params.field] = params.value;
						
						this.trigger(params.event);
					}
					
					return this;
				}
			}
			
			CyElement.prototype.locked = function(){
				return this._private.locked;
			};
			
			CyElement.prototype.lock = switchFunction({ event: "lock", field: "locked", value: true });
			
			CyElement.prototype.unlock = switchFunction({ event: "unlock", field: "locked", value: false });
							
			CyElement.prototype.bypass = function(newBypass, newBypassVal){
				
				if( newBypassVal === undefined ){
					// set whole object
					
					if( newBypass === undefined ){
						return copy( this._private.bypass );
					} else {
						this._private.bypass = copy( newBypass );
						this.trigger("bypass");
						return this;
					}
				
				} else {
					// set only one
					this._private.bypass[newBypass] = copy(newBypassVal);
					this.trigger("bypass");
					return this;
				}
			};
						
			CyElement.prototype.data = function(attr, val){
				var ret;
				
				// get whole field
				if( attr === undefined ){
					return copy( this._private.data );
				} 
				
				if( attr == "id" && val !== undefined ){
					console.error("Can not change ID of element with group `%s` and ID `%s`", this._private.group, this._private.data.id);
					return;
				}
				
				// set whole field from obj
				else if( isPlainObject(attr) ){
					var newValObj = attr;
					
					// update map of node => { edge id => edge }
					if( this._private.group == "edges" ){
						
						if( newValObj.source === null ){
							console.error("Can not change source of edge with ID `%s` to null --- source must be non-null", this._private.data.id);
							return;
						}
						
						if( newValObj.target === null ){
							console.error("Can not change target of edge with ID `%s` to null --- target must be non-null", this._private.data.id);
							return;
						}
						
						var edgeId = this._private.data.id;
						
						if( newValObj.source != null ){
							delete structs.nodeToEdges[ this._private.data.source ][ edgeId ];
							structs.nodeToEdges[ newValObj.source ][ edgeId ] = this;
						}
						
						if( newValObj.target != null ){
							delete structs.nodeToEdges[ this._private.data.target ][ edgeId ];
							structs.nodeToEdges[ newValObj.target ][ edgeId ] = this;
						}
						
					}
					
					$.each(newValObject, function(name, val){
						updateContinuousMapperBounds(this._private.group, name, val);
					});
					
					this._private.data = copy( newValObj );
					this.trigger("data");
					ret = this;
				} 
				
				// get attr val by name
				else if( val === undefined ){
					ret = this._private.data[ attr ];
					ret =  ( typeof ret == "object" ? copy(ret) : ret );
				}
				
				// set attr val by name
				else {
					if( this._private.group == "edges" ){
						if( attr == "source" || attr == "target" ){
							
							if( val === null ){
								console.error("Can not change `%s` of edge with ID `%s` to null --- `%s` must be non-null", attr, this._private.data.id, attr);
								return;
							}
							
							var oldNodeId = this._private.data[attr];
							var newNodeId = val;
							var edgeId = this._private.data.id;
							
							delete structs.nodeToEdges[ oldNodeId ][ edgeId ];
							structs.nodeToEdges[ newNodeId ][ edgeId ] = this;
						}
					}
					
					this._private.data[ attr ] = ( typeof val == "object" ? copy(val) : val );
					ret = this;
					
					updateContinuousMapperBounds(this._private.group, attr, val);
					
					this.trigger("data");
				}		
				
				return ret;
			};
			
			CyElement.prototype.target = function(){
				if( this.isNode() ){
					console.error("Can not call `target` on node `%s`; only edges have targets", this._private.data.id);
					return;
				}
				
				return structs.nodes[ this._private.data.target ];
			};
			
			CyElement.prototype.source = function(){
				if( this.isNode() ){
					console.error("Can not call `source` on node `%s`; only edges have sources", this._private.data.id);
					return;
				}
				
				return structs.nodes[ this._private.data.source ];
			};
			
			CyElement.prototype.edgesWith = function(otherNode){
				if( otherNode.isEdge() ){
					console.error("Can not call `edgesWith` on edge `%s`; only nodes have edges", this._private.data.id);
					return;
				}
				
				var map = getEdgesBetweenNodes(this, otherNode);
				var elements = [];
				for(var i in map){
					var element = map[i];
					elements.push(element);
				}
				
				return new CyCollection(elements);
			}
			
			CyElement.prototype.parallelEdges = function(selector){
				if( this.isNode() ){
					console.error("Can not call `parallelEdges` on node `%s`; only edges have sources", this._private.data.id);
					return;
				}
				
				var map = getParallelEdgesForEdge(this);
				var elements = [];
				for(var i in map){
					var element = map[i];
					elements.push(element);
				}
				
				var collection = new CyCollection(elements);
				
				if( isString(selector) ){
					collection = new CySelector(selector).filter(collection);
				}
				
				return collection;
			};
			
			CyElement.prototype.position = function(val){
				
				if( val === undefined ){
					if( this.isNode() ){
						return copy( this._private.position );
					} else {
						console.warn("Can not get position for edge with ID `%s`; edges have no position", this._private.data.id);
						return null;
					}
				} else if( isFunction(val) ){
					var fn = val;
					this.bind("position", fn);
				} else if( this.isEdge() ){
					console.warn("Can not move edge with ID `%s`; edges can not be moved", this._private.data.id);
				} else if( this.locked() ) {
					console.warn("Can not move locked node with ID `%s`", this._private.data.id);
				} else if( isString(val) ) {
					var param = arguments[0];
					var value = arguments[1];
					
					if( value === undefined ){
						 return this._private.position[param];
					} else {
						this._private.position[param] = copy(value);
					}
				} else if( isPlainObject(val) ) {
					this._private.position = copy( val );									
					this.trigger("position");
				} else {
					console.error("Can not set position on node `%s` with non-object `%o`", this._private.data.id, val);
				}
				
				return this;
				
			};
			
			CyElement.prototype.show = function(){
				renderer.showElements(this.collection());
				
				return this;
			};
			
			CyElement.prototype.hide = function(){
				renderer.hideElements(this.collection());
				
				return this;
			};
			
			CyElement.prototype.visible = function(){
				return renderer.elementIsVisible(this);
			};
			
			CyElement.prototype.renderedPosition = function(){
				if( this.isEdge() ){
					$.cytoscapeweb("warn", "Can not get rendered position for edge `" + element._private.data.id + "`; edges have no position");
					return null;
				}
				
				return renderer.renderedPosition(this);
			};
			
			CyElement.prototype.renderedDimensions = function(){
				return renderer.renderedDimensions(this);
			};
			
			CyElement.prototype.style = function(){
				// the renderer should populate this field and keep it up-to-date
				return copy( this._private.style );
			};
			
			CyElement.prototype.bind = function(events, callback){
				var self = this;
				
				$.each(events.split(/\s+/), function(i, event){
					if(event == "") return;
					
					if( self._private.listeners[event] == null ){
						self._private.listeners[event] = [];
					}				
					self._private.listeners[event].push(callback);
				});
				
				return this;
			};
			
			CyElement.prototype.unbind = function(events, callback){
				var self = this;
				
				$.each(events.split(/\s+/), function(j, event){
					if(event == "") return;
				
					var listeners = self._private.listeners[event];
					
					if( listeners != null ){
						$.each(listeners, function(i, listener){
							if( callback == null || callback == listener ){
								listeners[i] = undefined;
							}
						});
					}
				
				});
				
				return this;
			};
			
			CyElement.prototype.trigger = function(event, data){
				var self = this;
				var type = isPlainObject(event) ? event.type : event;
				
				// notify renderer unless removed
				if( !this.removed() ){
					notify({
						type: type,
						collection: [ this ]
					});
				}
				
				var listeners = this._private.listeners[type];
				
				function fire(listener, eventData, data){
					if( $.isFunction(listener) ){
						var args = [eventData, data];
						listener.apply(self, args);
					}
				}
				
				var eventData = isPlainObject(event) ? event : { type: type }; 
				if( listeners != null ){
					$.each(listeners, function(i, listener){
						fire(listener, eventData, data);
					});
				}
				
				if( structs.live[type] != null ){
					$.each(structs.live[type], function(key, callbacks){
						
						var selector = structs.selectors[key];
						if( selector.filter( self.collection() ).size() > 0 ){
							$.each(callbacks, function(i, listener){
								fire(listener, eventData, data);
							});
						}
					});
				}
				
				return this;
			};
			
			CyElement.prototype.selected = function(){
				return this._private.selected;
			};
			
			CyElement.prototype.select = switchFunction({ event: "select", field: "selected", value: true });
			
			CyElement.prototype.unselect = switchFunction({ event: "unselect", field: "selected", value: false });
			
			CyElement.prototype.source = function(){
				if( this._private.group == "nodes" ){
					console.error("Can call `source` only on edges---tried to call on node `%s`", this._private.data.id);
					return;
				}
				
				return structs.nodes[ this._private.data.source ];
			};
			
			CyElement.prototype.target = function(){
				if( this._private.group == "nodes" ){
					console.error("Can call `target` only on edges---tried to call on node `%s`", this._private.data.id);
					return;
				}
				
				return structs.nodes[ this._private.data.target ];
			};
			
			CyElement.prototype.isNode = function(){
				return this._private.group == "nodes";
			};
			
			CyElement.prototype.isEdge = function(){
				return this._private.group == "edges";
			};
			
			CyElement.prototype.same = function(element){
				return this == element;
			};
			
			CyElement.prototype.allAreNeighbors = function(collection){
				collection = collection.collection();
				var adjacents = this.neighbors();
				
				if( this.isNode() ){
					var self = this;
					adjacents.edges().each(function(i, edge){
						if( edge._private.data.source == edge._private.data.target ){
							adjacents = adjacents.add(self);
						}
					});
				}
				
				var ret = true;
				
				for(var i = 0; i < collection.size(); i++){
					var element = collection[i];
					var inCollection = false;
					
					for(var j = 0; j < adjacents.size(); j++){
						var adjacent = adjacents[j];
						
						if( element.group() == adjacent.group() && element._private.data.id == adjacent._private.data.id ){
							inCollection = true;
							break;
						}
					}
					
					ret = ret && inCollection;
					if(ret == false){
						break;
					}
				}
				
				return ret;
			};
			
			CyElement.prototype.closedNeighborhood = function(selector){
				return new CySelector(selector).filter( this.neighborhood().add(this) );
			};
			
			CyElement.prototype.openNeighborhood = function(selector){
				return this.neighborhood(selector);
			};
			
			CyElement.prototype.neighborhood = function(selector){
				
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
					collection = new CyCollection(neighbors);
					
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
					collection = new CyCollection(neighbors);
					
				}
				
				if( isString(selector) ){
					collection = CySelector(selector).filter(collection);
				} 
				
				return collection;
			};
		
			function degreeFunction(callback){
				return function(){
					if( this._private.group == "nodes" && !this._private.removed ){
						var degree = 0;
						var edges = structs.nodeToEdges[this._private.data.id];
						var node = this;
						
						if( edges != null ){
							$.each(edges, function(i, edge){
								degree += callback(node, edge);
							});
						}
						
						return degree;
					} else {
						return null;
					}
				};
			}
			
			CyElement.prototype.degree = degreeFunction(function(node, edge){
				if( edge._private.data.source == edge._private.data.target ){
					return 2;
				} else {
					return 1;
				}
			});
			
			CyElement.prototype.indegree = degreeFunction(function(node, edge){
				if( node._private.data.id == edge._private.data.target ){
					return 1;
				} else {
					return 0;
				}
			});
			
			CyElement.prototype.outdegree = degreeFunction(function(node, edge){
				if( node._private.data.id == edge._private.data.source ){
					return 1;
				} else {
					return 0;
				}
			});
			
			function listenerAlias(params){
				return function(callback){
					if( isFunction(callback) ){
						return this.bind(params.name, callback);
					} else {
						var opts = callback;
						return this.trigger(params.name, opts);
					}
				};
			}
			
			// aliases to listeners, e.g. node.click(fn) => node.bind("click", fn)
			// TODO add more
			CyElement.prototype.mousedown = listenerAlias({ name : "mousedown"});
			CyElement.prototype.mouseup = listenerAlias({ name : "mouseup"});
			CyElement.prototype.mouseover = listenerAlias({ name : "mouseover"});
			CyElement.prototype.mouseout = listenerAlias({ name : "mouseout"});
			CyElement.prototype.mousemove = listenerAlias({ name : "mousemove"});
			CyElement.prototype.click = listenerAlias({ name : "click"});
			
			
			// CyCollection
			////////////////////////////////////////////////////////////////////////////////////////////////////
						
			// represents a set of nodes, edges, or both together
			var CyCollection = function(elements){
				
				if( elements == null ){
					elements = [];
				}
				
				for(var i = 0; i < elements.length; i++){
					this[i] = elements[i];
				}
				
				this.length = elements.length;
			};

			CyCollection.prototype.toArray = function(){
				var array = [];
				
				for(var i = 0; i < this.size(); i++){
					array.push( this.eq(i) );
				}
				
				return array;
			};
			
			CyCollection.prototype.slice = function(start, end){
				var array = [];
				
				if( end == null ){
					end = this.size();
				}
				
				if( start < 0 ){
					start = this.size() + start;
				}
				
				for(var i = start; i >= 0 && i < end && i < this.size(); i++){
					array.push( this.eq(i) );
				}
				
				return new CyCollection(array);
			};
			
			CyCollection.prototype.size = function(){
				return this.length;
			};
			
			CyCollection.prototype.eq = function(i){
				return this[i];
			};
			
			CyCollection.prototype.empty = function(){
				return this.size() == 0;
			};
			
			CyCollection.prototype.live = function(){
				console.error("`live` can be called only on collections made from top-level selectors");
			};
			
			CyCollection.prototype.die = function(){
				console.error("`die` can be called only on collections made from top-level selectors");
			};
			
			CyCollection.prototype.each = function(fn){
				for(var i = 0; i < this.size(); i++){
					if( isFunction(fn) ){
						fn.apply( this.eq(i), [ i, this.eq(i) ] );
					}
				}
				return this;
			};
			
			CyCollection.prototype.add = function(toAdd){
				
				if(toAdd == null){
					return this;
				}
				
				if( isString(toAdd) ){
					var selector = toAdd;
					toAdd = elementsCollection({ selector: selector });
				}
				
				var elements = [];
				var ids = {
					nodes: {},
					edges: {}
				};
			
				function add(element){
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
				
				return new CyCollection(elements);
			};
			
			CyCollection.prototype.not = function(toRemove){
				
				if(toRemove == null){
					return this;
				} else {
				
					if( isString(toRemove) ){
						toRemove = new CySelector(toRemove).filter(this);
					}
					
					var elements = [];
					var collection = toRemove.collection();
					
					this.each(function(i, element){
						
						var remove = false;
						for(var j = 0; j < collection.size(); j++){
							var c = collection.eq(j);
							
							if( c._private.group == element._private.group && c._private.data.id == element._private.data.id ){
								remove = true;
								break;
							}
						}
						
						if(!remove){
							elements.push(element);
						}
						
					});
					
					return new CyCollection(elements);
				} 
			};
			
			CyCollection.prototype.filter = function(filterFn){
				if( isFunction(filterFn) ){
					var elements = [];
					this.each(function(i, element){
						if( !$.isFunction(filterFn) || filterFn.apply(element, [i, element]) ){
							elements.push(element);
						}
					});
					
					return new CyCollection(elements);
				} else if( isString(filterFn) ){
					return new CySelector(filterFn).filter(this);
				}

				console.error("You must pass a function or a selector to `filter`");
			};
			
			CyCollection.prototype.nodes = function(selector){
				var nodes = this.filter(function(i, element){
					return element.group() == "nodes";
				});
				
				return new CySelector(selector).filter(nodes);
			};
			
			CyCollection.prototype.edges = function(selector){
				var edges = this.filter(function(i, element){
					return element.group() == "edges";
				});
				
				return new CySelector(selector).filter(edges);
			};
			
			CyCollection.prototype.positions = function(fn){
				
				var collection = this;
				
				noNotifications(function(){
					collection.each(function(i, element){
						var positionOpts = fn.apply(element, [i, element]);
						
						if( isPlainObject(positionOpts) ){
							element.position(positionOpts);
						}
					});
				});

				notify({
					type: "position",
					collection: this
				});
			};
			
			CyCollection.prototype.allSame = function(collection){
				collection = collection.collection();
				
				var ret = true;
				for(var i = 0; i < collection.size(); i++){
					var collectionElement = collection.eq(i);
					
					hasCollectionElement = false;
					for(var j = 0; j < this.size(); j++){
						var thisElement = this.eq(j);
						
						hasCollectionElement = thisElement.same(collectionElement);
						if(hasCollectionElement) break;
					}
					
					ret = ret && hasCollectionElement;
					if(!ret) break;
				}
				
				return ret;
			};
			
			CyCollection.prototype.anySame = function(collection){
				collection = collection.collection();
				
				var ret = false;
				for(var i = 0; i < collection.size(); i++){
					var collectionElement = collection.eq(i);
					
					for(var j = 0; j < this.size(); j++){
						var thisElement = this.eq(j);
						
						ret = ret || thisElement.same(collectionElement);
						if(ret) break;
					}
					if(ret) break;
				}
				
				return ret;
			};
			
			// what functions in CyElement update the renderer
			var rendererFunctions = [ "remove", "data", "bypass", "position", "select", "unselect", "lock", "unlock", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "click" ];
			var getters = [ "data", "bypass", "position" ];
			
			// functions in element can also be used on collections
			$.each(CyElement.prototype, function(name, func){
				CyCollection.prototype[name] = function(){
					
					var rets = [];
					var returnsSelf = true; // whether the function returns itself
					var returnsCollection = true; // whether the function returns a collection
					var collection = new CyCollection();
				
					// disable renderer notifications during loop
					// just notify at the end of the loop with the whole collection
					var isRendererFn = $.inArray(name, rendererFunctions) >= 0;
					var isListener = isFunction(arguments[0]);
					var isGetter = $.inArray(name, getters) >= 0 && arguments[0] == null || arguments[1] == null;
					
					if( isRendererFn && !isListener && !isGetter ){
						notificationsEnabled(false);
					}
				
					for(var i = 0; i < this.size(); i++){
						var element = this[i];
						var ret = func.apply(element, arguments);
						
						if( ret !== undefined ){
							rets.push(ret);
						}
						
						returnsSelf = returnsSelf && (ret == element);
						returnsCollection = returnsCollection && (ret instanceof CyCollection || ret instanceof CyElement);
						
						if(returnsCollection){
							collection = collection.add(ret);
						}
					}
					
					// notify the renderer of the call on the whole collection
					// (more efficient than sending each in a row---may have flicker?)
					if( isRendererFn && !isListener && !isGetter ){
						notificationsEnabled(true);
						notify({
							type: name,
							collection: this
						});
					}
					
					if( returnsSelf || rets.length == 0 ) {
						return this; // if fn returns the element, then return the same collection
					} else if( returnsCollection ){
						return collection;
					}
					
					return rets;
				};
			});
			
			// NOTE: any functions with the same name in element and collection must go here for collection
			//       if the implementation differs
			
			
			CyCollection.prototype.show = function(){
				renderer.showElements(this);
				
				return this;
			};
			
			CyCollection.prototype.hide = function(){
				renderer.hideElements(this);
				
				return this;
			};
			
			CyCollection.prototype.trigger = function(event, data){
				
				var collection = this;
				
				noNotifications(function(){
					collection.each(function(i, element){
						element.trigger(event, data);
					});
				});

				notify({
					type: event,
					collection: this
				});
				
			};
			
			CyCollection.prototype.collection = function(){
				return this;
			};
			
			function degreeBoundsFunction(degreeFn, callback){
				return function(){
					var ret = null;
					var degrees = this[degreeFn]();
					$.each(degrees, function(i, degree){
						if( degree != null && (ret == null || callback(degree, ret)) ){
							ret = degree;
						}
					});
					return ret;
				};
			}
			
			CyCollection.prototype.minDegree = degreeBoundsFunction("degree", function(degree, min){
				return degree < min;
			});
			
			CyCollection.prototype.maxDegree = degreeBoundsFunction("degree", function(degree, max){
				return degree > max;
			});

			CyCollection.prototype.minIndegree = degreeBoundsFunction("indegree", function(indegree, min){
				return indegree < min;
			});
			
			CyCollection.prototype.maxIndegree = degreeBoundsFunction("indegree", function(indegree, max){
				return indegree > max;
			});
			
			CyCollection.prototype.minOutdegree = degreeBoundsFunction("outdegree", function(outdegree, min){
				return outdegree < min;
			});
			
			CyCollection.prototype.maxOutdegree = degreeBoundsFunction("outdegree", function(outdegree, max){
				return outdegree > max;
			});
			
			CyCollection.prototype.totalDegree = function(){
				return 2 * this.edges().size();
			};
			
			CyCollection.prototype.allAreNeighbors = function(collection){
				collection = collection.collection();
				var ret = true;
				
				for(var i = 0; i < this.size(); i++){
					var element = this.eq(i);
					ret = ret && element.allAreNeighbors(collection);
					
					if( ret == false ){
						break;
					}
				}
				
				return ret;
			};
						
			CyCollection.prototype.allAre = function(selector){
				return new CySelector(selector).filter(this).size() == this.size();
			};
			
			CyCollection.prototype.is = function(selector){
				return new CySelector(selector).filter(this).size() > 0;
			};
			
			// CySelector
			////////////////////////////////////////////////////////////////////////////////////////////////////
			
			var CySelector = function(onlyThisGroup, selector){
				
				if( selector === undefined && onlyThisGroup !== undefined ){
					selector = onlyThisGroup;
					onlyThisGroup = undefined;
				}
				
				var self = this;
				
				self._private = {
					selectorText: null
				}
				
				if( selector == null ){
					// ignore
					self.length = 0;					
				} else if( isString(selector) ){
				
					var str = selector;
					self._private.selectorText = selector;
					
					var queries = str.split(/,\s*/);
					
					self.length = queries.length;
					for(var i = 0; i < queries.length; i++){
						var query = queries[i];
						var q = query.match(/^(node|edge|)(:[a-z]+)*(\[.+\])*(:[a-z]+)*$/);
						self[i] = {};
						
						if( q == null ){
							console.error("Invalid selector `%s` in parent selector `%s`", query, str);
							return;
						}
						
						var group = q[1] == "" ? undefined : q[1] + "s";
						self[i].group = group;
						
						if( onlyThisGroup == null ){
							// valid
						} else if( onlyThisGroup != null && (group == null || group == onlyThisGroup) ){
							// valid
							self[i].group = onlyThisGroup.substring();
						} else {
							console.error("Invalid group `%s` in selector `%s` in parent selector `%s` with implicit group `%s`", group, query, str, onlyThisGroup);
							return;
						}
						
						var colonSelectors = [];
						$.each([ q[2], q[4] ], function(i, selectors){
							if( selectors == null ) return;
							
							$.each(selectors.split(":"), function(i, sel){
								if(sel == "") return;
									
								colonSelectors.push(":" + sel);
							});
						});
						
						for(var j = 0; j < colonSelectors.length; j++){
							var selector = colonSelectors[j];
							if( selector.match(/^:selected|:unselected|:locked|:unlocked|:visible|:hidden|:grabbed|:free$/) ){
								// valid
							} else {
								console.error("Invalid colon style selector `%s` in parent selector `%s`", selector, str);
							}
						}
						self[i].colonSelectors = colonSelectors;
						
						var bracketsText = q[3];
						self[i].data = [];
						
						if( bracketsText != null ){
							var brackets = bracketsText.split("][");
							
							for(var j = 0; j < brackets.length; j++){
								var bracket = brackets[j];
								var b = bracket.replace("[", "").replace("]", "");
								
								var match = b.match(/^\s*(\w+)\s*(=|!=||>=||<=|<|>){0,1}\s*([\w._-]+|'.+'|".+"){0,1}?\s*$/);
								
								if(match == null){
									console.error("Invalid attribute selector `%s` in parent selector `%s`", bracket, str);
									return;
								}
								
								var field = match[1];
								var operator = match[2];
								var value = match[3];
								
								if( operator == null && value != null ){
									console.error("Invalid selector `%s`; operator must be specified for value `%s`", str, value);
									return;
								}
								
								if( value == null && operator != null ){
									console.error("Invalid selector `%s`; value must be specified for operator `%s`", str, operator);
									return;
								}
								
								if( value != null && operator != null ){
									for(var s = 0; s < value.length; s++){
										var ch = value.charAt(s);
										
										if( ch == "'" || ch == '"' ){
											if( (s == 0 || s == value.length - 1) && value.charAt(s) == value.charAt(0) && value.length > 1 ){
												// matching beginning & end quotes
											} else if( ch == '"' && value.charAt(0) == "'" && value.charAt(value.length - 1) == "'" ){
												// enclosed like 'foo"bar'
											} else if( s >= 1 && value.charAt(s - 1) == "\\" ){
												// escaped like "foo\"bar"
											} else if( ch == "'" && value.charAt(0) == '"' && value.charAt(value.length - 1) == '"' ){
												// enclosed like "foo'bar"
											} else {
												console.error("Invalid selector `%s`; quotation mark in child selector data comparator ``", str, b);
												return;
											}
										}
									}
								}
																
								self[i].data.push({
									field: field,
									operator: operator,
									value: value
								});
							} // each bracket text
						} // brackets text populated
					} // each query
				} else {
					console.error("A selector must be created from a string; found %o", selector);
				}
			};
			
			CySelector.prototype.size = function(){
				return this.length;
			};
			
			CySelector.prototype.eq = function(i){
				return this[i];
			};
			
			CySelector.prototype.filter = function(collection, addLiveFunction){
				var self = this;
				
				var selectorFunction = function(i, element){
					for(var j = 0; j < self.length; j++){
						var query = self[j];
						
						if( query.group != null && query.group != element._private.group ){
							continue;
						}
						
						var allColonSelectorsMatch = true;
						for(var k = 0; k < query.colonSelectors.length; k++){
							var sel = query.colonSelectors[k];
							
							switch(sel){
							case ":selected":
								allColonSelectorsMatch = element.selected();
								break;
							case ":unselected":
								allColonSelectorsMatch = !element.selected();
								break;
							case ":locked":
								allColonSelectorsMatch = element.locked();
								break;
							case ":unlocked":
								allColonSelectorsMatch = !element.locked();
								break;
							case ":visible":
								allColonSelectorsMatch = renderer.isElementVisible(element); // TODO add function to renderer
								break;
							case ":hidden":
								allColonSelectorsMatch = !renderer.isElementVisible(element);
								break;
							case "grabbed":
								allColonSelectorsMatch = element.grabbed();
								break;
							case "free":
								allColonSelectorsMatch = !element.grabbed();
								break;
							}
							
							if( !allColonSelectorsMatch ){
								break;
							}
						}
						
						if( !allColonSelectorsMatch ){
							continue;
						}
						
						var allDataMatches = true;
						for(var k = 0; k < query.data.length; k++){
							var data = query.data[k];
							
							var operator = data.operator;
							if( operator == "=" ){
								operator = "==";
							}
							
							var value = data.value;
							if( !isNaN( parseFloat(value) ) ){
								// got a number
							} else if( isString(value) ){
								var firstChar = value.charAt(0);
								var lastChar = value.charAt(value.length - 1);
								
								if( value.length > 1 && firstChar == lastChar && (firstChar == '"' || firstChar == "'") ){
									value = value;
								} else {
									value = '"' + value + '"';
								}
							}
							
							var field = data.field;
							
							var matches;
							
							if( operator != null && value != null ){
								var expr = "element._private.data." + field + " " + operator + " " + value;
								matches = eval(expr);
							} else {
								matches = element._private.data[field] !== undefined;
							}
							
							if( !matches ){
								allDataMatches = false;
								break;
							}
						}
						
						if( allDataMatches ){
							return true;
						}
					}
					
					return false;
				};
				
				if( self._private.selectorText == null ){
					selectorFunction = function(){ return true; };
				}
				
				var filteredCollection = collection.filter(selectorFunction);
				
				if(addLiveFunction){
					
					var key = self.selector();
					structs.selectors[key] = self;
					
					filteredCollection.live = function(event, callback){
						if( structs.live[event] == null ){
							structs.live[event] = {};
						}
						
						if( structs.live[event][key] == null ){
							structs.live[event][key] = [];
						}
						
						structs.live[event][key].push(callback);
					};
					
					filteredCollection.die = function(event, callback){
						if( event == null ){
							if( structs.live[event] != null ){
								$.each(structs.live[event], function(k, selector){
									if( k == key ){
										delete structs.live[event][k];
									}
								});
							}
						} else if( callback == null ){
							if( structs.live[event] != null ){
								delete structs.live[event][key];
							}
						} else if( structs.live[event] != null && structs.live[event][key] != null ) {
							for(var i = 0; i < structs.live[event][key].length; i++){
								if( structs.live[event][key][i] == callback ){
									structs.live[event][key].splice(i, 1);
									i--;
								}
							}
						}
					};
				}
				
				return filteredCollection;
			};
			
			// ith query to string
			CySelector.prototype.selector = function(){
				
				var str = "";
				
				function clean(obj){
					if( isString(obj) ){
						return obj;
					} 
					return "";
				}
				
				for(var i = 0; i < this.length; i++){
					var query = this[i];
					str += clean(query.group);
					
					for(var j = 0; j < query.data.length; j++){
						var data = query.data[j];
						str += "[" + data.field + clean(data.operator) + clean(data.value) + "]"
					}
					
					if( this.length > 1 && i < this.length - 1 ){
						str += ", ";
					}
				}
				
				return str;
			};
			
			// Cytoscape Web object and helper functions
			////////////////////////////////////////////////////////////////////////////////////////////////////

			var enableNotifications = true;
			
			function noNotifications(fn){
				notificationsEnabled(false);
				fn();
				notificationsEnabled(true);
			}
			
			function notificationsEnabled(enabled){
				enableNotifications = enabled;
			}
			
			function notify(params){
				
				
				if( params.collection instanceof CyElement ){
					var element = params.collection;
					params.collection = new CyCollection([ element ]);	
				} else if( params.collection instanceof Array ){
					var elements = params.collection;
					params.collection = new CyCollection(elements);	
				}
			
				enableNotifications && renderer.notify(params);
			}
			
			// getting nodes/edges with a filter function to select which ones to include
			function elementsCollection(params){
				var elements = [];
				
				var p = $.extend({}, {
					group: null,
					selector: null,
					addLiveFunction: false
				}, params);
				
				var group = p.group;
				var selector = p.selector;
				var addLiveFunction = p.addLiveFunction;
				
				if( group == "nodes" || group == "edges" ){
					$.each(structs[group], function(id, element){
						elements.push(element);
					});
					
					var collection = new CyCollection(elements);
					return new CySelector(group, selector).filter(collection, addLiveFunction);
				} else {
					$.each(structs["nodes"], function(id, element){
						elements.push(element);
					});
					$.each(structs["edges"], function(id, element){
						elements.push(element);
					});
					var collection = new CyCollection(elements);
					return new CySelector(selector).filter(collection, addLiveFunction);
				}
			}
			
			// add node/edge to cytoweb
			function addElement(params){
				return function(opts){
				
					var elements = [];
					
					noNotifications(function(){
						
						// add the element
						if( opts instanceof CyElement ){
							var element = opts;
							
							if( structs[ element._private.group ][ element._private.data.id ] == null ){							
								elements.push( element );
								element._private.removed = false;
								structs[ element._private.group ][ element._private.data.id ] = element;
							} else {
								console.error("Can not create element: an element in the visualisation in group `%s` already has ID `%s`", element.group(), element.data("id"));
							}
						} 
						
						// add the collection
						else if( opts instanceof CyCollection ){
							var collection = opts;
							collection.each(function(i, element){
							
								if( structs[ element._private.group ][ element._private.data.id ] == null ){
									elements.push( element );
									element._private.removed = false;
									structs[ element._private.group ][ element._private.data.id ] = element;
								} else {
									console.error("Can not create element: an element in the visualisation in group `%s` already has ID `%s`", element.group(), element.data("id"));
								}
							});
						} 
						
						// specify an array of options
						else if( isArray(opts) ){
							$.each(opts, function(i, elementParams){
								if( params != null && params.group != null ){
									elements.push(new CyElement( $.extend({}, elementParams, { group: params.group }) ));
								} else {
									elements.push(new CyElement( elementParams ));
								}
							});
						} 
						
						// specify options for one element
						else {
							if( params != null && params.group != null ){
								elements.push(new CyElement( $.extend({}, opts, { group: params.group }) ));
							} else {
								elements.push(new CyElement( opts ));
							}
						}
					});
					
					notify({
						type: "add",
						collection: elements
					});
				}
			}
			
			var prevLayoutName = options.layout.name;
			
			function cybind(target, events, handler){
				if( structs.listeners[target] == null ){
					structs.listeners[target] = {};
				}
				
				$.each(events.split(/\s+/), function(j, event){
					if(event == "") return;
					
					if( structs.listeners[target][event] == null ){
						structs.listeners[target][event] = [];
					}
					
					structs.listeners[target][event].push(handler);
				});
			}
			
			function cyunbind(target, events, handler){
				if( structs.listeners[target] == null ){
					return;
				}
				
				if( events == null ){
					if( structs.listeners[target] == null ){
						return;
					}
					
					delete structs.listeners[target];
					return;
				}
				
				$.each(events.split(/\s+/), function(j, event){
					if(event == "") return;
					
					if( handler == null ){
						if( structs.listeners[target][event] == null ){
							return;
						}
						
						delete structs.listeners[target][event];
						return;
					}
					
					for(var i = 0; i < structs.listeners[target][event].length; i++){
						var listener = structs.listeners[target][event][i];
						
						if( listener == handler ){
							structs.listeners[target][event].splice(i, 1);
							i--;
						}
					}
				});

			}
			
			function cytrigger(target, event, data){
				
				var eventObj;
				if( isPlainObject(event) ){
					eventObj = event;
					event = eventObj.type;
				} else {
					eventObj = {
						type: event
					};
				}
				
				if( structs.listeners[target] == null || structs.listeners[target][event] == null ){
					return;
				}
				
				$.each(structs.listeners[target][event], function(i, handler){
					handler.apply(cy, [ eventObj, data ]);
				});
			}
			
			var background = {
				bind: function(event, handler){
					cybind("background", event, handler);
				},
				
				unbind: function(event, handler){
					cyunbind("background", event, handler);
				},
				
				trigger: function(event){
					cytrigger("background", event);
				}
			};
			
			// this is the cytoweb object
			var cy = {
				
				bind: function(event, handler){
					cybind("cy", event, handler);
				},
				
				unbind: function(event, handler){
					cyunbind("cy", event, handler);
				},
				
				trigger: function(event){
					cytrigger("cy", event);
				},
					
				style: function(val){
					var ret;
					
					if( val === undefined ){
						ret = copy( structs.style );
					} else {
						structs.structs.style = copy( val );
						ret = this;
						
						notify({
							type: "style",
							style: style
						});
					}
					
					return ret;
				},
				
				background: function(){
					return background;
				},
				
				add: addElement(),
				
				remove: function(collection){
					collection.remove();
				},
				
				addNode: addElement({ group: "nodes" }),
				
				addEdge: addElement({ group: "edges" }),
				
				node: function(id){
					return structs.nodes[id];
				},
				
				edge: function(id){
					return structs.edges[id];
				},
				
				nodes: function(selector){
					return elementsCollection({ group: "nodes", selector: selector, addLiveFunction: true });
				},
				
				edges: function(selector){
					return elementsCollection({ group: "edges", selector: selector, addLiveFunction: true });
				},
				
				elements: function(selector){
					return elementsCollection({ selector: selector, addLiveFunction: true });
				},
				
				filter: function(selector){
					if( isString(selector) ){
						return elementsCollection({ selector: selector, addLiveFunction: true });
					} else if( isFunction(selector) ) {
						return elementsCollection().filter(selector);
					}
				},
				
				collection: function(){
					return new CyCollection();
				},
				
				layout: function(params){
					if( params == null ){
						params = options.layout;
					}
					
					var name = params.name != null ? params.name : options.layout.name;
					var name = name.toLowerCase();
					
					if( reg.layout[ name ] == null ){
						console.error("Can not apply layout: No such layout `%s` found; did you include its JS file?", name);
						return;
					}
					
					if( prevLayoutName != name ){
						layout = new reg.layout[name]($.extend({}, params, { 
							selector: options.selector,
							name: name
						}));
						prevLayoutName = name;
					}
					
					layout.run( $.extend({}, params, {
						nodes: cy.nodes(),
						edges: cy.edges(),
						renderer: renderer,
						selector: options.selector
					}) );
					
				},
				
				pan: function(params){
					return renderer.pan(params);
				},
				
				zoom: function(params){
					return renderer.zoom(params);
				},
				
				load: function(elements){
					// TODO delete old elements?
				
					if( elements != null ){
						
						noNotifications(function(){
							$.each(["nodes", "edges"], function(i, group){
								
								var elementsInGroup = elements[group];								
								if( elementsInGroup != null ){
									$.each(elementsInGroup, function(i, params){
										
										var data = params.data;
										var position = params.position;
										var bypass = params.bypass;
										var selected = params.selected;
										var locked = params.locked;
										
										// add element
										var element = new CyElement( {
											group: group,
											data: data,
											bypass: bypass,
											position: position,
											selected: selected,
											locked: locked
										} );
									});
								}
							});
						});
						
					}
					
					notify({
						type: "load", // TODO should this be a different type?
						collection: cy.elements(),
						style: structs.style
					});
				},
				
				toFormat: function(format){
					var exporterDefn = reg.exporter[format];
					
					if( exporterDefn == null ){
						console.error("No exporter with name `%s` found; did you remember to register it?");
					} else {
						var exporter = new exporterDefn({
							selector: options.selector,
							cytoscapeweb: cy,
						});
						
						return exporter.run();
					}
				}
				
			};
			$(options.selector).data("cytoscapeweb", cy);
			
			if( reg.layout[ options.layout.name.toLowerCase() ] == null ){
				console.error("Can not initialise: No such layout `%s` found; did you include its JS file?",  options.layout.name);
				return;
			}
			
			var layout = new reg.layout[ options.layout.name.toLowerCase() ]( options.layout );
			
			
			if( reg.renderer[ options.renderer.name.toLowerCase() ] == null ){
				console.error("Can not initialise: No such renderer `$s` found; did you include its JS file?", options.renderer.name);
				return;
			}
			
			var renderer = new reg.renderer[ options.renderer.name.toLowerCase() ]( $.extend({}, options.renderer, {
				
				selector: $(options.selector),
				cytoscapeweb: cy,
				style: options.style,
				
				styleCalculator: {
					calculate: function(element, styleVal){

						if( isPlainObject(styleVal) ){
							
							var ret;
							
							if( styleVal.customMapper != null ){
								
								ret = styleVal.customMapper( element._private.data );
								
							} else if( styleVal.passthroughMapper != null ){
								
								var attrName = styleVal.passthroughMapper;
								ret = element._private.data[attrName];
								
							} else if( styleVal.discreteMapper != null ){
								
								var attrName = styleVal.discreteMapper.attr;
								var entries = styleVal.discreteMapper.entries;
								var elementVal = element.data(attrName);
								
								$.each(entries, function(i, entry){
									var attrVal = entry.attrVal;
									var mappedVal = entry.mappedVal;
									
									if( attrVal == elementVal ){
										ret = mappedVal;
									}
								});
								
							} else if( styleVal.continuousMapper != null ){
								
								var map = styleVal.continuousMapper;
								
								if( map.attr.name == null || typeof map.attr.name != typeof "" ){
									console.error("For style.%s.%s, `attr.name` must be defined as a string since it's a continuous mapper", element.group(), styleName);
									return;
								}
								
								var attrBounds = structs.continuousMapperBounds[element._private.group][map.attr.name];
								attrBounds = {
									min: attrBounds == null ? 0 : attrBounds.min,
									max: attrBounds == null ? 0 : attrBounds.max
								};
								
								// use defined attr min & max if set in mapper
								if( map.attr.min != null ){
									attrBounds.min = map.attr.min;
								}
								if( map.attr.max != null ){
									attrBounds.max = map.attr.max;
								}
								
								if( attrBounds != null ){
								
									var data = element.data(map.attr.name);
									var percent = ( data - attrBounds.min ) / (attrBounds.max - attrBounds.min);
									
									if( attrBounds.max == attrBounds.min ){
										percent = 1;
									}
									
									if( percent > 1 ){
										percent = 1;
									} else if( percent < 0 || data == null || isNaN(percent) ){
										percent = 0;
									}
									
									if( data == null && styleVal.defaultValue != null ){
										ret = styleVal.defaultValue;
									} else if( isNumber(map.mapped.min) && isNumber(map.mapped.max) ){
										ret = percent * (map.mapped.max - map.mapped.min) + map.mapped.min;
									} else if( isColor(map.mapped.min) && isColor(map.mapped.max) ){
										
										var cmin = $.Color(map.mapped.min).fix().toRGB();
										var cmax = $.Color(map.mapped.max).fix().toRGB();

										var red = Math.round( cmin.red() * (1 - percent) + cmax.red() * percent );
										var green  = Math.round( cmin.green() * (1 - percent) + cmax.green() * percent );
										var blue  = Math.round( cmin.blue() * (1 - percent) + cmax.blue() * percent );

										ret = $.Color([red, green, blue], "RGB").toHEX().toString();
									} else {
										console.error("Unsupported value used in mapper for `style.%s.%s` with min mapped value `%o` and max `%o` (neither number nor colour)", element.group(), map.styleName, map.mapped.min, map.mapped.max);
										return;
									}
								} else {
									console.error("Attribute values for `%s.%s` must be numeric for continuous mapper `style.%s.%s` (offending %s: `%s`)", element.group(), map.attr.name, element.group(), styleName, element.group(), element.data("id"));
									return;
								}
								
							} // end if
							
							var defaultValue = styleVal.defaultValue;
							if( ret == null ){
								ret = defaultValue;
							}
							
						} else {
							ret = styleVal;
						} // end if
						
						return ret;
					} // end calculate
				} // end styleCalculator
			}) );
			
			cy.load(options.elements);
			cy.layout();
			return cy;
		} 
		
		// logging functions
		else if( typeof opts == typeof "" && isFunction(console[opts]) ){
			var args = [];
			for(var i = 1; i < arguments.length; i++){
				args.push( arguments[i] );
			}
			
			console[opts].apply(console, args);
		}
		
		// turn on/off logging
		else if( opts == "quiet" ){
			quiet = ( arguments[1] != null && arguments[1] != false );
		}
		
		// turn on/off logging for debug statements
		else if( opts == "debugging" ){
			debug = ( arguments[1] != null && arguments[1] != false );
		}
		
		// allow for registration of extensions
		// e.g. $.cytoscapeweb("renderer", "svg", { ... });
		else if( typeof opts == typeof "" ) {
			var registrant = arguments[0].toLowerCase(); // what to register (e.g. "renderer")
			var name = arguments[1].toLowerCase(); // name of the module (e.g. "svg")
			var module = arguments[2]; // the module object
			
			if( module == null ){
				// get the module by name; e.g. $.cytoscapeweb("renderer", "svg");
				return reg[registrant][name];
			} else {
				// set the module; e.g. $.cytoscapeweb("renderer", "svg", { ... });
				reg[registrant][name] = module;
			}
		}
	};
	
	// use short alias (cy) if not already defined
	if( $.fn.cy == null && $.cy == null ){
		$.fn.cy = $.fn.cytoscapeweb;
		$.cy = $.cytoscapeweb;
	}
	
})(jQuery);

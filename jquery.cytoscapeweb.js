;(function($){

	// registered modules to cytoweb, indexed by name
	var reg = {
		format: {},
		renderer: {},
		layout: {}
	};

	var quiet = false;
	var debug = false;
	var console = {
		debug: function(){
			if( quiet || !debug ){ return; }
			
			if( window.console != null && window.console.debug != null ){
				window.console.debug.apply(window.console, arguments);
			} else if( window.console != null && window.console.log != null ){
				window.console.log.apply(window.console, arguments);
			}
		},
			
		log: function(){
			if( quiet ){ return; }
			
			if( window.console != null && window.console.log != null ){
				window.console.log.apply(window.console, arguments);
			}
		},
		
		warn: function(){
			if( quiet ){ return; }
			
			if( window.console != null && window.console.warn != null ){
				window.console.warn.apply(window.console, arguments);
			} else {
				console.log(arguments);
			}
		},
		
		error: function(){
			if( quiet ){ return; }
			
			if( window.console != null && window.console.error != null ){
				window.console.error.apply(window.console, arguments);
			} else {
				console.log(arguments);
				throw "Cytoscape Web encountered the previously logged error";
			}
		}
	};
	
	function isFunction(obj){
		return typeof obj == typeof function(){};
	}
	
	function isArray(obj){
		return obj instanceof Array;
	}
	
	function isPlainObject(obj){
		return typeof obj == typeof {} && !isArray(obj);
	}
	
	// allow calls on a jQuery selector by proxying calls to $.cytoscapeweb
	// e.g. $("#foo").cytoscapeweb(options) => $.cytoscapeweb(options) on #foo
	$.fn.cytoscapeweb = function(opts){
		
		// get object
		if( opts == "object" ){
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
			
			$(this).each(function(){
				var cy = $(this).data("cytoscapeweb");
				var fnName = opts;
				var args = Array.prototype.slice.call( arguments, 1 );
				
				if( cy != null && $.isFunction( cy[fnName] ) ){
					var ret = cy[fnName].apply(cy, args);
					rets.push(ret);
				}
			});
			
			// if only one instance, don't need to return array
			if( rets.length == 1 ){
				rets = rets[0];
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
			
			// structs to hold internal cytoweb model
			var structs = {
				style: options.style,
				nodes: {}, // id => node object
				edges: {}  // id => edge object
			};
			
			// return a deep copy of an object
			function copy(obj){
				if( isArray(obj) ){
					return $.extend(true, [], obj);
				} else {
					return $.extend(true, {}, obj);
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
			
			
			// CyElement
			////////////////////////////////////////////////////////////////////////////////////////////////////
			
			// represents a node or an edge
			var CyElement = function(params){
				
				// validate group
				if( params.group != "nodes" && params.group != "edges" ){
					console.error("An element must be of type `nodes` or `edges`; you specified `" + params.group + "`");
					return;
				}
				
				this._private = {
					data: copy( params.data ), // data object
					position: copy( params.position ), // fields x, y, etc (could be 3d or radial coords; renderer decides)
					listeners: {}, // map ( type => array of functions )
					group: params.group, // string; "nodes" or "edges"
					bypass: copy( params.bypass ),
					removed: false, // whether it's inside the vis; true if removed
					selected: false, // whether it's selected
					locked: false, // whether the element is locked (cannot be moved)
					grabbed: false // whether the element is grabbed by the mouse; renderer sets this privately
				};
				
				// set id and validate
				if( this._private.data.id == null ){
					this._private.data.id = idFactory.generate( this._private.group );
				} else if( structs[ this._private.group ][ this._private.data.id ] != null ){
					console.error("Can not create element: an element in the visualisation in group `" + this._private.group + "` already has ID `" + this._private.data.id + "`");
					return;
				}
				
				// validate source and target for edges
				if( this._private.group == "edges" ){
					
					var fields = ["source", "target"];
					for(var i = 0; i < fields.length; i++){
						
						var field = fields[i];
						var val = this._private.data[field];
						
						if( val == null || val == "" ){
							console.error("Can not create edge with id `" + this._private.data.id + "` since it has no `" + field + "` attribute set in `data` (must be non-empty value)");
							return;
						} else if( structs.nodes[val] == null ){ 
							console.error("Can not create edge with id `" + this._private.data.id + "` since it specifies non-existant node as its `" + field + "` attribute with id `" + val + "`");
							return;
						} 
					}
					
				}
				  
				structs[ this._private.group ][ this._private.data.id ] = this;
				
				notify({
					type: "add",
					elements: [ this ]
				});
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
										
					this.trigger("remove");
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
			
			// proxy to the bypass object				
			CyElement.prototype.bypass = function(newBypass){	
				if( newBypass === undefined ){
					return copy( this._private.bypass );
				} else {
					this._private.bypass = copy( newBypass );
					this.trigger("bypass");
				}
			};
			
			function attrGetterSetter(params){
				return function(attr, val){
					var ret;
					
					// get whole field
					if( attr === undefined ){
						return copy( this._private[ params.name ] );
					}
					
					// set whole field from obj
					else if( isPlainObject(attr) ){
						var newValObj = attr;
						this._private[ params.name ] = copy( newValObj );
						
						this.trigger(params.name);
					} 
					
					// get attr val by name
					else if( val === undefined ){
						ret = this._private[ params.name ][ attr ];
						ret =  ( typeof ret == "object" ? copy(ret) : ret );
					}
					
					// set attr val by name
					else {
						this._private[ params.name ][ attr ] = ( typeof val == "object" ? copy(val) : val );
						ret = this;
						
						this.trigger(params.name);
					}		
					
					return ret;
				};
			}
			
			CyElement.prototype.data = attrGetterSetter({ name: "data" });
			
			CyElement.prototype.position = function(val){
				
				if( val === undefined ){
					return copy( this._private.position );
				} else if( isFunction(val) ){
					var fn = val;
					this.bind("position", fn);
				} else if( this._private.group == "edges" ){
					console.warn("Can not move edge with ID `" + this._private.data.id + "`; edges can not be moved");
				} else if( this.locked() ) {
					console.warn("Can not move locked node with ID " + this._private.data.id);
				} else {
					this._private.position = copy( val );
									
					this.trigger("position");
				}
				
			};
			
			CyElement.prototype.style = function(){
				// ask renderer for computed style
				return copy( renderer.style(this) );
			};
			
			CyElement.prototype.bind = function(event, callback){
				if( this._private.listeners[event] == null ){
					this._private.listeners[event] = [];
				}				
				this._private.listeners[event].push(callback);
				
				return this;
			};
			
			CyElement.prototype.unbind = function(event, callback){
				var listeners = this._private.listeners[event];
				
				if( listeners != null ){
					$.each(listeners, function(i, listener){
						if( callback == null || callback == listener ){
							listeners[i] = undefined;
						}
					});
				}
				
				return this;
			};
			
			CyElement.prototype.trigger = function(event, data){
				// notify renderer unless removed
				if( !this.removed() ){
					notify({
						type: event,
						collection: [ this ]
					});
				}
				
				var listeners = this._private.listeners[event];
				
				var eventData = data; 
				if( listeners != null ){
					$.each(listeners, function(i, listener){
						if( $.isFunction(listener) ){
							listener(eventData);
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
			
			CyElement.prototype.firstNeighbors = function(){
				// TODO
				// note must check group()
			};
		
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
			function CyCollection(elements){
				for(var i = 0; i < elements.length; i++){
					this[i] = elements[i];
				}
				
				this.length = elements.length;
				this.size = function(){
					return this.length;
				}
			}

			CyCollection.prototype.toArray = function(){
				var array = [];
				
				for(var i = 0; i < this.size(); i++){
					array.push( this.eq(i) );
				}
				
				return array;
			};
			
			CyCollection.prototype.eq = function(i){
				return this[i];
			};
			
			CyCollection.prototype.each = function(fn){
				for(var i = 0; i < this.size(); i++){
					fn.apply( this.eq(i), [ i, this.eq(i) ] );
				}
				return this;
			};
			
			CyCollection.prototype.add = function(toAdd){
				var elements = [];
			
				// add own
				this.each(function(i, element){
					elements.push(element);
				});
			
				// add toAdd
				if( $isFunction(toAdd.size) ){
					// we have a collection
					var collection = toAdd;
					collection.each(function(i, element){
						elements.push(element);
					});
				} else {
					// we have one element
					var element = toAdd;
					elements.push(element);
				}
				
				return new CyCollection(elements);
			};
			
			CyCollection.prototype.filter = function(filterFn){
				var elements = [];
				this.each(function(i, element){
					if( !$.isFunction(filterFn) || filterFn.apply(element, [i, element]) ){
						elements.push(element);
					}
				});

				return new CyCollection(elements);
			};
			
			
			CyCollection.prototype.positions = function(fn){
				
				var collection = this;
				
				noNotifications(function(){
					collection.each(function(i, element){
						var positionOpts = fn.apply(element, [i, element]);
						element.position(positionOpts);
					});
				});

				notify({
					type: "position",
					collection: this
				});
			};
			
			// what functions in CyElement update the renderer
			var rendererFunctions = [ "remove", "data", "bypass", "position", "select", "unselect", "lock", "unlock", "mouseover", "mouseout", "mousemove", "mousedown", "mouseup", "click" ];
			
			// functions in element can also be used on collections
			$.each(CyElement.prototype, function(name, func){
				CyCollection.prototype[name] = function(){
					var rets = [];
					var collection = false; // whether the function returns the element itself
				
					// disable renderer notifications during loop
					// just notify at the end of the loop with the whole collection
					var isRendererFn = $.inArray(name, rendererFunctions) >= 0;
					if( isRendererFn ){
						notificationsEnabled(false);
					}
				
					for(var i = 0; i < this.size(); i++){
						var element = this[i];
						var ret = func.apply(element, arguments);
						
						if( ret !== undefined ){
							rets.push(ret);
						}
						
						if( ret == element ){
							collection = true;
						}
					}
					
					// notify the renderer of the call on the whole collection
					// (more efficient than sending each in a row---may have flicker?)
					if( isRendererFn ){
						notificationsEnabled(true);
						notify({
							type: name,
							collection: this
						});
					}
					
					if( collection ) {
						rets = this; // if fn returns the element, then return the same collection
					}
					
					if( rets.length == 0 ){
						rets = this; // if function doesn't return a value, return this for chaining
					} 
					
					return rets;
				};
			});
			
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
			
			// Cytoscape Web object and helper functions
			////////////////////////////////////////////////////////////////////////////////////////////////////

			var layout = new reg.layout[ options.layout.name.toLowerCase() ]( options.layout );
			
			var renderer = new reg.renderer[ options.renderer.name.toLowerCase() ]( $.extend({}, options.renderer, { selector: $(options.selector) }) );
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
				enableNotifications && renderer.notify(params);
			}
			
			function jsonGetterSetter(params){
				return function(val){
					var ret;
					
					if( val === undefined ){
						ret = copy( structs[params.struct] );
					} else {
						structs[params.struct] = copy( val );
						ret = this;
					}
					
					$.isFunction(params.after) && params.after();
					return ret;
				};
			}
			
			// getting nodes/edges with a filter function to select which ones to include
			function elementsCollection(params){
				return function(filterFn){
					var elements = [];
					
					function filter(element){
						if( !$.isFunction(filterFn) || filterFn.apply(element, [element]) ){
							elements.push(element);
						}
					}
					
					if( params != null && params.group != null ){
						$.each(structs[params.group], function(id, element){
							filter(element);
						});
					} else {
						$.each(structs["nodes"], function(id, element){
							filter(element);
						});
						$.each(structs["edges"], function(id, element){
							filter(element);
						});
					}
					
					var collection = new CyCollection(elements);
					return collection;
				};
			}
			
			// add node/edge to cytoweb
			function addElement(params){
				return function(opts){
				
					var elements = [];
					
					noNotifications(function(){
						
						// add the element
						if( opts instanceof CyElement ){
							var element = opts;
							
							elements.push( new CyElement({
								group: element._private.group,
								data: element._private.data,
								bypass: element._private.bypass
							}) );
						} 
						
						// add the collection
						else if( opts instanceof CyCollection ){
							var collection = opts;
							collection.each(function(i, element){
								
								elements.push( new CyElement({
									group: element._private.group,
									data: element._private.data,
									bypass: element._private.bypass
								}) );
								
							});
						} 
						
						// specify an array of options
						else if( isArray(opts) ){
							$.each(opts, function(i, elementParams){
								var element = new CyElement(elementParams);
								elements.push(element);
							});
							
						} 
						
						// specify options for one element
						else {
							elements.push( new CyElement({
								group: params.group,
								data: opts.data,
								bypass: opts.bypass
							}) );
						}
					});
					
					notify({
						type: "add",
						collection: elements
					});
				}
			}
			
			// this is the cytoweb object
			var cy = {
				
				style: jsonGetterSetter({ struct: "style", after: function(){
					notify({
						style: structs.style
					});
				} }),
				
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
				
				nodes: elementsCollection({ group: "nodes" }),
				
				edges: elementsCollection({ group: "edges" }),
				
				elements: elementsCollection(),
				
				layout: function(params){
				
					if( params == null ){
						params = options.layout;
					}
					
					var name = params.name != null ? params.name : options.layout.name;
				
					if( ! layout instanceof reg.layout[name] ){
						layout = new reg.layout[name](params);
					}
					
					layout.run( $.extend({}, params, {
						nodes: cy.nodes(),
						edges: cy.edges(),
						renderer: renderer
					}) );
					
				},
				
				pan: function(params){
					renderer.pan(params);
				},
				
				load: function(data){
					// TODO delete old elements?
				
					if( data != null ){
						
						noNotifications(function(){
							$.each(["nodes", "edges"], function(i, group){
								
								var elements = options.data[group];								
								if( elements != null ){
									$.each(elements, function(i, params){
										// add element
										var element = new CyElement( {
											group: group,
											data: params
										} );
									});
								}
							});
						});
						
					}
					
					notify({
						type: "add", // TODO should this be a different type?
						collection: cy.elements(),
						style: structs.style,
						bypass: structs.bypass
					});
				}
				
			};
			$(options.selector).data("cytoscapeweb", cy);
			
			cy.load(options.data);
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


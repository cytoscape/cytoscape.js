;(function($){

	// registered modules to cytoweb, indexed by name
	var reg = {
		formats: {},
		renderers: {},
		layouts: {}
	};

	// allow calls on a jQuery selector by proxing calls to $.cytoscapeweb
	// e.g. $("#foo").cytoscapeweb(options) => $.cytoscapeweb(options) on #foo
	$.fn.cytoscapeweb = function(opts){

		// proxy to create instance
		if( $.isPlainObject(opts) ){
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
			
			$(this).each({
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
		if( typeof opts == typeof {} ){
			var defaults = {
				layout: "forcedirected",
				renderer: "svg",
				style: { // actual default style later specified by renderer
					global: {},
					nodes: {},
					edges: {}
				},
				bypass: {
					nodes: {},
					edges: {}
				} 
			};
			
			var options = $.extend(true, {}, defaults, opts);
			
			// structs to hold internal cytoweb model
			var structs = {
				style: options.style,
				bypass: options.bypass,
				nodes: {}, // id => node object
				edges: {}  // id => edge object
			};
			
			// return a deep copy of an object
			function copy(obj){
				if( $.isArray(obj) ){
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
			
			// represents a node or an edge
			var CyElement = function(){
			
				var _private = {
					data: null, // data object
					position: null, // fields x, y, etc (could be 3d or radial coords; renderer decides)
					listeners: null, // map ( type => array of functions )
					group: null, // string; "nodes" or "edges"
					active: null; // whether it's inside the vis; false if removed
				};
			
				function Element(params){
					_private.listeners = {};
					_private.position = copy( params.position );
					_private.group = params.group;
					
					_private.data = copy( data );
					_private.data.id = idFactory.generate( _private.group, _private.data.id );
					
					_private.bypass = copy( params.bypass );
					structs.bypass[ _private.group ][ _private.data.id ] = _private.bypass;
					
					structs[ _private.group ][ _private.data.id ] = this;
					
					notifyRenderer({
						type: "add",
						elements: new CyCollection([ this ])
					});
				}
			
				Element.prototype.group = function(){
					return _private.group;
				}
				
				Element.prototype.active = function(){
					return _private.active;
				};
				
				// remove from cytoweb
				Element.prototype.remove = function(){
					if( _private.active ){
						structs[ _private.group ][ _private.data.id ] = undefined;
						_private.active = false;
						
						notifyRenderer({
							type: "remove",
							elements: new CyCollection([ this ])
						});
					}
					
					return this;
				};

				Element.prototype.restore = function(){
					if( !_private.active ){
						structs[ _private.group ][ _private.data.id ] = this;
						_private.active = true;
						
						notifyRenderer({
							type: "restore",
							elements: new CyCollection([ this ])
						});
					}
					
					return this;
				};

				// proxy to the bypass object				
				Element.prototype.bypass = function(newBypass){	
					if( newBypass === undefined ){
						return copy( structs.bypass[ _private.group ][ _private.data.id ] );
					} else {
						structs.bypass[ _private.group ][ _private.data.id ] = copy( newBypass );
					}
				};
				
				function attrGetterSetter(params){
					return function(attr, val){
						var ret;
						
						if( val === undefined ){
							ret = _private.[ params.name ][ attr ];
							ret =  ( typeof ret == "object" ? copy(ret) : ret );
						} else {
							_private.[ params.name ][ attr ] = ( typeof val == "object" ? copy(val) : val );
							ret = this;
						}
						
						$.isFunction(params.callback) && params.callback();
						return ret;
					};
				}
				
				Element.prototype.data = attrGetterSetter({ name: "data", callback: function(){
					notifyRenderer({
						type: "data",
						elements: new CyCollection([ this ])
					});
				} });
				
				Element.prototype.position = attrGetterSetter({ name: "position", callback: function(){
					notifyRenderer({
						type: "position",
						elements: new CyCollection([ this ])
					});
				} });
				
				Element.prototype.style = function(){
					// ask renderer for computed style
					return renderer.style(this);
				};
				
				Element.prototype.bind = function(event, callback){
					if( _private.listeners[event] == null ){
						_private.listeners[event] = [];
					}				
					_private.listeners[event].push(callback);
					
					return this;
				};
				
				Element.prototype.unbind = function(event, callback){
					var listeners = _private.listeners[event];
					
					if( listeners != null ){
						$.each(listeners, function(i, listener){
							if( callback == null || callback == listener ){
								listeners[i] = undefined;
							}
						});
					}
					
					return this;
				};
				
				Element.prototype.trigger = function(event, data){
					var listeners = _private.listeners[event];
					
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
				
				Element.prototype.select = function(){
					_private.selected = true;
					
					notifyRenderer({
						type: "select",
						elements: new CyCollection([ this ])
					});
				};
				
				Element.prototype.unselect = function(){
					_private.selected = false;
					
					notifyRenderer({
						type: "unselect",
						elements: new CyCollection([ this ])
					});
				};
				
				Element.prototype.firstNeighbors = function(){
					// TODO
					// note must check group()
				};
			
				function listenerAlias(params){
					return function(callback){
						return this.bind(params.name, callback);
					};
				}
				
				// aliases to listeners, e.g. node.click(fn) => node.bind("click", fn)
				// TODO add more
				Element.prototype.mousedown = listenerAlias("mousedown");
				Element.prototype.mouseup = listenerAlias("mouseup");
				Element.prototype.mousemove = listenerAlias("mousemove");
				Element.prototype.click = listenerAlias("click");
				Element.prototype.select = listenerAlias("select");
				Element.prototype.unselect = listenerAlias("unselect");
				
				return Element;
			}();
			
			// represents a set of nodes, edges, or both together
			var CyCollection = function(){
			
				function Collection(elements){
					$.each(elements, function(i, element){
						this[i] = element;
					});
					
					this.length = elements.length;
					this.size = function(){
						return this.length;
					}
				}

				Collection.prototype.toArray = function(){
					var array = [];
					
					for(var i = 0; i < this.size(); i++){
						array.push( this.eq(i) );
					}
					
					return array;
				};
				
				Collection.prototype.eq = function(i){
					return this[i];
				};
				
				Collection.prototype.each = function(fn){
					for(var i = 0; i < this.size(); i++){
						fn.apply( this.eq(i), [ i, this.eq(i) ] );
					}
					return this;
				};
				
				Collection.prototype.add = function(toAdd){
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
					
					return new Collection(elements);
				};
				
				Collection.prototype.filter = function(filterFn){
					var elements = [];
					this.each(function(i, element){
						if( !$.isFunction(filterFn) || filterFn(element) ){
							elements.push(element);
						}
					});
	
					return new Collection(elements);
				};
				
				
				Collection.prototype.positions = function(fn){
					rendererNotificationsEnabled(false);
					this.each(function(i, element){
						var positionOpts = fn(i, element);
						element.position(positionOpts);
					});
					rendererNotificationsEnabled(true);
					
					notifyRenderer({
						type: "position",
						collection: this
					});
				};
				
				// what functions in CyElement update the renderer
				var rendererFunctions = [ "data", "select", "unselect", "position", "restore" ];
				
				// functions in element can also be used on collections
				$.each(CyElement.prototype, function(name, func){
					Collection.prototype[name] = function(){
						var rets = [];
					
						// disable renderer notifications during loop
						// just notify at the end of the loop with the whole collection
						var notifyRenderer = $.inArray(name, rendererFunctions) >= 0;
						if( notifyRenderer ){
							rendererNotificationsEnabled(false);
						}
					
						for(var i = 0; i < this.size(); i++){
							var element = this[i];
							var ret = func.apply(element, arguments);
							
							if( ret !== undefined ){
								rets.push(ret);
							}
						}
						
						// notify the renderer of the call on the whole collection
						// (more efficient than sending each in a row---may have flicker?)
						if( notifyRenderer ){
							rendererNotificationsEnabled(true);
							notifyRenderer({
								type: name,
								collection: this;
							});
						}
						
						if( rets.length == 0 ){
							rets = this; // if function doesn't return a value, return this for chaining
						}
						
						return rets;
					};
				});

				return Collection;
			}();
			
			var renderer = reg.renderers[ options.renderer.toLowerCase() ];
			var rendererNotifications = true;
			
			function rendererNotificationsEnabled(enabled){
				rendererNotificationsEnabled = enabled;
			}
			
			function notifyRenderer(params){
				rendererNotifications && renderer.notify(params);
			}
			
			funciton jsonGetterSetter(params){
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
						if( !$.isFunction(filterFn) || filterFn(element) ){
							elements.push(element);
						}
					}
					
					if( params.group != null ){
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
				
					// restore the element
					if( opts instanceof CyElement ){
						var element = opts;
						element.restore();
					} 
					
					// restore the collection
					else if( opts instanceof CyCollection ){
						var elements = opts;
						elements.restore();
					} 
					
					// specify an array of options
					else if( $.isArray(opts) ){
						rendererNotificationsEnabled(false);
						var elements = [];
						
						$.each(opts, function(i, elementParams){
							var element = new CyElement(elementParams);
							elements.push(element);
						});
						
						var collection = new CyCollection(elements);
						rendererNotificationsEnabled(true);
						
						notifyRenderer({
							type: "add",
							collection: collection
						});
					} 
					
					// specify options for one element
					else {
						return new CyElement({
							group: params.group,
							data: opts.data.
							bypass: opts.bypass
						});
					}
				}
			}
			
			// this is the cytoweb object
			var cy = {
				
				style: jsonGetterSetter({ struct: "style", after: function(){
					notifyRenderer({
						style: structs.style
					});
				} }),
				
				bypass: jsonGetterSetter({ struct: "bypass", after: function(){
					notifyRenderer({
						bypass: structs.bypass
					});
				} }),
				
				add: addElement(),
				
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
				
					var name = params.name != null ? params.name : options.layout;
				
					reg.layout[name].run($.extend({}, params, {
						nodes: cy.nodes(),
						edges: cy.edges(),
						renderer: renderer
					});
				},
				
				pan: function(params){
					renderer.pan(params);
				},
				
				load: function(data){
					// TODO delete old elements?
				
					if( data != null ){
						
						rendererNotificationsEnabled(false);
						$.each(options.data, function(group, elements){
							$.each(elements, function(i, params){
								// add element
								var element = new CyElement( $.extend({}, params, { group: group }) );
							});
						});
						rendererNotificationsEnabled(true);
						
					}
					
					notifyRenderer({
						type: "add", // TODO should this be a different type?
						collection: cy.elements(),
						style: structs.style,
						bypass: structs.bypass
					});
				}
				
			};
			
			cy.load(options.data);
			return cy;
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


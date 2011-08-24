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
		if( typeof opts == typeof {} ){
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
			
			// reusable functions for use in defining api functions w/o typing very similar code
			// over and over agaim
			var functions = {
			
				element: {

					attrGetterSetter: function(params){
						return function(attr, val){
							var ret;
							
							if( val === undefined ){
								ret = this._private.[ params.name ][ attr ];
								ret =  ( typeof ret == "object" ? copy(ret) : ret );
							} else {
								this._private.[ params.name ][ attr ] = ( typeof val == "object" ? copy(val) : val );
								ret = this;
							}
							
							$.isFunction(params.callback) && params.callback();
							return ret;
						};
					},

					listenerAlias: function(params){
						return function(callback){
							return this.bind(params.name, callback);
						};
					}
				
				},
				
				api: {
					// for getting/setting top-level object properties
					jsonGetterSetter: function (params){
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
					},
					
					// getting nodes/edges with a filter function to select which ones to include
					elementsCollection: function(params){
						return function(filterFn){
							var elements = [];
							$.each(structs[params.group], function(id, element){
								if( !$.isFunction(filterFn) || filterFn(element) ){
									elements.push(element);
								}
							});
							var collection = new CyCollection(elements);
							return collection;
						};
					},
					
					// add node/edge to cytoweb
					addElement: function(params){
						return function(opts){
							return new CyElement({
								group: params.group,
								data: opts.data.
								bypass: opts.bypass
							});
						}
					}
				}	
				
				
			};
			
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
			function CyElement(params){
				var group = params.group;
				this.group = function(){
					return group;
				}
				
				this.active = function(){
					return true;
				};
				
				this._private.data = copy( data );
				this._private.data.id = idFactory.generate( group(), this._private.data.id );
				this.id = function(){
					 return this._private.data.id;
				};
				
				this._private.bypass = copy( params.bypass );
				this._private.listeners = {};
				this._private.position = copy( params.position );

				structs.bypass[ group() ][ id() ] = this._private.bypass;
				structs[ group() ][ id() ] = this;
			}
			
			// remove from cytoweb
			CyElement.prototype.remove = function(){
				structs.bypass[ group() ][ id() ] = undefined;
				structs[ group() ][ id() ] = undefined;
				
				this.active = function(){
					return false;
				};
				
				return this;
			}
			
			CyElement.prototype.bypass = function(newBypass){								
				if( newBypass === undefined ){
					return copy( this._private.bypass );
				} else {
					this._private.bypass = copy( newBypass );
					
				}
			};
			
			CyElement.prototype.data = functions.element.attrGetterSetter({ name: "data", callback: function(){
				notifyRenderer({
					type: "data",
					elements: new CyCollection([ this ])
				});
			} });
			
			CyElement.prototype.position = functions.element.attrGetterSetter({ name: "position", callback: function(){
				notifyRenderer({
					type: "position",
					elements: new CyCollection([ this ])
				});
			} });
			
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
			
			CyElement.prototype.select = function(){
				this.selected = function(){
					return true;
				};
				
				notifyRenderer({
					type: "select",
					elements: new CyCollection([ this ])
				});
			};
			
			CyElement.prototype.unselect = function(){
				this.selected = function(){
					return false;
				};
				
				notifyRenderer({
					type: "unselect",
					elements: new CyCollection([ this ])
				});
			};
			
			CyElement.prototype.firstNeighbors = function(){
				// TODO
			};
			
			// aliases to listeners, e.g. node.click(fn) => node.bind("click", fn)
			// TODO add more
			CyElement.prototype.mousedown = functions.element.listenerAlias("mousedown");
			CyElement.prototype.mouseup = functions.element.listenerAlias("mouseup");
			CyElement.prototype.mousemove = functions.element.listenerAlias("mousemove");
			CyElement.prototype.click = functions.element.listenerAlias("click");
			CyElement.prototype.select = functions.element.listenerAlias("select");
			CyElement.prototype.unselect = functions.element.listenerAlias("unselect");
			
			// represents a set of nodes, edges, or both together
			function CyCollection(elements){
				$.each(elements, function(i, element){
					this[i] = element;
				});
				
				var length = elements.length;
				this.size = function(){
					return length;
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
					fn( i, this.eq(i) );
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
					if( !$.isFunction(filterFn) || filterFn(element) ){
						elements.push(element);
					}
				});

				return new CyCollection(elements);
			};
			
			// functions in element can also be used on collections
			var rendererFunctions = [ "data", "select", "unselect", "position" ];
			$.each(CyElement.prototype, function(name, func){
				CyCollection.prototype[name] = function(){
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
							collection = this;
						});
					}
					
					if( rets.length == 0 ){
						rets = this; // if function doesn't return a value, return this for chaining
					}
					
					return rets;
				};
			});
			
			var renderer = reg.renderers[ options.renderer.toLowerCase() ];
			var rendererNotifications = true;
			
			function rendererNotificationsEnabled(enabled){
				rendererNotificationsEnabled = enabled;
			}
			
			function notifyRenderer(params){
				rendererNotifications && renderer.notify(params);
			}
			
			// this is the cytoweb object
			var cy = {
				
				style: functions.api.jsonGetterSetter({ struct: "style", after: function(){
					notifyRenderer({
						style: structs.style
					});
				} }),
				
				bypass: functions.api.jsonGetterSetter({ struct: "bypass", after: function(){
					notifyRenderer({
						bypass: structs.bypass
					});
				} }),
				
				addNode: functions.api.addElement({ group: "nodes" }),
				
				addEdge: functions.api.addElement({ group: "edges" }),
				
				node: function(id){
					return structs.nodes[id];
				},
				
				edge: function(id){
					return structs.edges[id];
				},
				
				nodes: functions.api.elementsCollection({ group: "nodes" }),
				
				edges: functions.api.elementsCollection({ group: "edges" }),
				
				layout: function(params){
					reg.layout[name].run($.extend({}, params, {
						nodes: cy.nodes(),
						edges: cy.edges()
					});
				},
				
				pan: function(options){
					renderer.pan(options);
				}
				
			};
			
			renderer.draw({
				nodes: nodes,
				edges: edges,
				style: style,
				bypass: bypass
			});
			
			return cy;
		} 
		
		// allow for registration of extensions
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


;(function($, $$){
	
	$$.fn.core = function( options ){
		CyCore.prototype[ options.name ] = options.impl;
	};
	
	function CyCore(){
		this._private = {};
	}
	$.cytoscapeweb.CyCore = CyCore; // expose
	
	// allow functional access to cytoweb
	// e.g. var cytoweb = $.cytoscapeweb({ selector: "#foo", ... });
	//      var nodes = cytoweb.nodes();
	$.cytoscapeweb.init = function(opts){
		
		// create instance
		if( $$.is.plainObject(opts) ){
			var defaults = {
				layout: {
					name: "grid"
				},
				renderer: {
					name: "svg"
				},
				style: { // actual default style later specified by renderer
				}
			};
			
			var options = $.extend(true, {}, defaults, opts);
			
			if( options.container == null ){
				$$.console.error("Cytoscape Web must be called on an element; specify `container` in options or call on selector directly with jQuery, e.g. $('#foo').cy({...});");
				return;
			} else if( $(options.container).size() > 1 ){
				$$.console.error("Cytoscape Web can not be called on multiple elements in the functional call style; use the jQuery selector style instead, e.g. $('.foo').cy({...});");
				return;
			}
			
			// structs to hold internal cytoweb model
			var structs = {
				renderer: null, // populated on creation
				style: options.style,
				nodes: {}, // id => node object
				edges: {}, // id => edge object
				continuousMapperBounds: { // data attr name => { min, max }
					nodes: {},
					edges: {}
				},
				continuousMapperUpdates: [],
				live: {}, // event name => array of callback defns
				selectors: {}, // selector string => selector for live
				listeners: {}, // cy || background => event name => array of callback functions
				animation: { 
					// normally shouldn't use collections here, but animation is not related
					// to the functioning of CySelectors, so it's ok
					elements: null // elements queued or currently animated
				},
				scratch: {} // scratch object for core
			};
			
						
			function getContinuousMapperUpdates(){
				return structs.continuousMapperUpdates;
			}
			
			function clearContinuousMapperUpdates(){
				structs.continuousMapperUpdates = [];
			}
			
			// update continuous mapper bounds when new data is added
			function addContinuousMapperBounds(element, name, val){
				var group = element._private.group;
				
				if( $$.is.number(val) ){
					if( structs.continuousMapperBounds[ group ][ name ] == null ){
						structs.continuousMapperBounds[ group ][ name ] = {
							min: val,
							max: val,
							vals: []
						};
					}
					
					var bounds = structs.continuousMapperBounds[ group ][ name ];
					var vals = bounds.vals;
					var inserted = false;
					var oldMin = null, oldMax = null;
					
					if( vals.length > 0 ){
						oldMin = vals[0];
						oldMax = vals[ vals.length - 1 ];
					}
					
					for(var i = 0; i < vals.length; i++){
						if( val <= vals[i] ){
							vals.splice(i, 0, val);
							inserted = true;
							break;
						}
					}
					
					if(!inserted){
						vals.push(val);
					}
					
					bounds.min = vals[0];
					bounds.max = vals[vals.length - 1];
					
					if( oldMin != bounds.min || oldMax != bounds.max ){
						structs.continuousMapperUpdates.push({
							group: element.group(),
							element: element
						});
					}
				}
			}
			
			// update continuous mapper bounds for a change in data value
			function updateContinuousMapperBounds(element, name, oldVal, newVal){
				var group = element._private.group;
				var bounds = structs.continuousMapperBounds[ group ][ name ];
				
				if( bounds == null ){
					addContinuousMapperBounds(element, name, newVal);
					return;
				}
				
				var vals = bounds.vals;
				var oldMin = null, oldMax = null;
				
				if( vals.length > 0 ){
					oldMin = vals[0];
					oldMax = vals[ vals.length - 1 ];
				}
				
				removeContinuousMapperBounds(element, name, oldVal);
				addContinuousMapperBounds(element, name, newVal);
				
				if( oldMin != bounds.min || oldMax != bounds.max ){
					structs.continuousMapperUpdates.push({
						group: element.group(),
						element: element
					});
				}
			}
			
			// update the continuous mapper bounds for a removal of data
			function removeContinuousMapperBounds(element, name, val){
				var group = element._private.group;
				var bounds = structs.continuousMapperBounds[ group ][ name ];
				
				if( bounds == null ){
					return;
				}
				
				var oldMin = null, oldMax = null;
				var vals = bounds.vals;
				
				if( vals.length > 0 ){
					oldMin = vals[0];
					oldMax = vals[ vals.length - 1 ];
				}
				
				
				for(var i = 0; i < vals.length; i++){
					if( val == vals[i] ){
						vals.splice(i, 1);
						break;
					}
				}
				
				if( vals.length > 0 ){
					bounds.min = vals[0];
					bounds.max = vals[vals.length - 1];
				} else {
					bounds.min = null;
					bounds.max = null;
				}
			
				if( oldMin != bounds.min || oldMax != bounds.max ){
					structs.continuousMapperUpdates.push({
						group: element.group(),
						element: element
					});
				}
			}		
			
			function startAnimationLoop(){
				var stepDelay = 10;
				var useTimeout = false;
				var useRequestAnimationFrame = true;
				
				// initialise the list
				structs.animation.elements = new CyCollection( cy );
				
				// TODO change this when standardised
				var requestAnimationFrame = window.requestAnimationFrame || window.mozRequestAnimationFrame ||  
					window.webkitRequestAnimationFrame || window.msRequestAnimationFrame;
				
				if( requestAnimationFrame == null || !useRequestAnimationFrame ){
					requestAnimationFrame = function(fn){
						window.setTimeout(function(){
							fn(+new Date);
						}, stepDelay);
					};
				}
				
				var containerDom = cy.container()[0];
				
				function globalAnimationStep(){
					function exec(){
						requestAnimationFrame(function(now){
							handleElements(now);
							globalAnimationStep();
						}, containerDom);
					}
					
					if( useTimeout ){
						setTimeout(function(){
							exec();
						}, stepDelay);
					} else {
						exec();
					}
					
				}
				
				globalAnimationStep(); // first call
				
				function handleElements(now){
					
					structs.animation.elements.each(function(i, ele){
						
						// we might have errors if we edit animation.queue and animation.current
						// for ele (i.e. by stopping)
						try{
							ele = ele.element(); // make sure we've actually got a CyElement
							var current = ele._private.animation.current;
							var queue = ele._private.animation.queue;
							
							// if nothing currently animating, get something from the queue
							if( current.length == 0 ){
								var q = queue;
								var next = q.length > 0 ? q.shift() : null;
								
								if( next != null ){
									next.callTime = +new Date; // was queued, so update call time
									current.push( next );
								}
							}
							
							// step all currently running anis
							$.each(current, function(i, ani){
								step( ele, ani, now );
							});
							
							// remove done anis in current
							var completes = [];
							for(var i = 0; i < current.length; i++){
								if( current[i].done ){
									completes.push( current[i].params.complete );
									
									current.splice(i, 1);
									i--;
								}
							}
							
							// call complete callbacks
							$.each(completes, function(i, fn){
								if( $$.is.fn(complete) ){
									complete.apply( ele );
								}
							});
							
						} catch(e){
							// do nothing
						}
						
					}); // each element
					
					
					// notify renderer
					if( structs.animation.elements.size() > 0 ){
						notify({
							type: "draw",
							collection: structs.animation.elements
						});
					}
					
					// remove elements from list of currently animating if its queues are empty
					structs.animation.elements = structs.animation.elements.filter(function(){
						var ele = this;
						var queue = ele._private.animation.queue;
						var current = ele._private.animation.current;
						
						return current.length > 0 || queue.length > 0;
					});
				} // handleElements
					
				function step( self, animation, now ){
					var properties = animation.properties;
					var params = animation.params;
					var startTime = animation.callTime;
					var percent;
					
					if( params.duration == 0 ){
						percent = 1;
					} else {
						percent = Math.min(1, (now - startTime)/params.duration);
					}
					
					function update(p){
						if( p.end != null ){
							var start = p.start;
							var end = p.end;
							
							// for each field in end, update the current value
							$.each(end, function(name, val){
								if( valid(start[name], end[name]) ){
									self._private[p.field][name] = ease( start[name], end[name], percent );
								}
							});					
						}
					}
					
					if( properties.delay == null ){
						update({
							end: properties.position,
							start: animation.startPosition,
							field: "position"
						});
						
						update({
							end: properties.bypass,
							start: animation.startStyle,
							field: "bypass"
						});
					}
					
					if( $$.is.fn(params.step) ){
						params.step.apply( self, [ now ] );
					}
					
					if( percent >= 1 ){
						animation.done = true;
					}
					
					return percent;
				}
				
				function valid(start, end){
					if( start == null || end == null ){
						return false;
					}
					
					if( $$.is.number(start) && $$.is.number(end) ){
						return true;
					} else if( (start) && (end) ){
						return true;
					}
					
					return false;
				}
				
				function ease(start, end, percent){
					if( $$.is.number(start) && $$.is.number(end) ){
						return start + (end - start) * percent;
					} else if( (start) && (end) ){
						var c1 = $.Color(start).fix().toRGB();
						var c2 = $.Color(end).fix().toRGB();

						function ch(ch1, ch2){
							var diff = ch2 - ch1;
							var min = ch1;
							return Math.round( percent * diff + min );
						}
						
						var r = ch( c1.red(), c2.red() );
						var g = ch( c1.green(), c2.green() );
						var b = ch( c1.blue(), c2.blue() );
						
						return $.Color([r, g, b], "RGB").toHEX().toString();
					}
					
					return undefined;
				}
				
			}
			
			
			// Cytoscape Web object and helper functions
			////////////////////////////////////////////////////////////////////////////////////////////////////

			var enableNotifications = 0;
			var batchingNotifications = 0;
			var batchedNotifications = [];
			var batchedNotificationsTypeToIndex = {};
			
			// Use this to batch notifications of events together into a collection.
			// This makes rendering more efficient.
			function batchNotifications(fn){
				batchingNotifications++;
				fn();
				batchingNotifications--;
				
				if( batchingNotifications == 0 ){
					$.each(batchedNotifications, function(i, params){
						renderer.notify(params);
					});
					
					batchedNotifications = [];
					batchedNotificationsTypeToIndex = {};
				}
			}
			
			// Use only in special cases like the load event where we definitely don't
			// want any other events in parallel.  This could kill some events if they
			// come in on another thread.
			function noNotifications(fn){
				notificationsEnabled(false);
				fn();
				notificationsEnabled(true);
			}
			
			function notificationsEnabled(enabled){
				enableNotifications += enabled ? 1 : -1;
			}
			
			function notify(params){				
				if( params.collection instanceof CyElement ){
					var element = params.collection;
					params.collection = new CyCollection(cy, [ element ]);	
				} else if( params.collection instanceof Array ){
					var elements = params.collection;
					params.collection = new CyCollection(cy, elements);	
				}
				
				if( enableNotifications != 0 ){
					return;
				} else if( batchingNotifications > 0 ){
					
					if( batchedNotificationsTypeToIndex[params.type] != null ){
						// merge the notifications
						
						var index = batchedNotificationsTypeToIndex[params.type];
						var batchedParams = batchedNotifications[index];
						var batchedCollection = batchedParams.collection;
						
						if( batchedCollection != null ){
							batchedCollection = batchedCollection.add( params.collection );
						}
						
						batchedParams = $.extend({}, batchedParams, params);
						batchedParams.collection = batchedCollection;
						batchedNotifications[index] = batchedParams;
					} else {
						// put the notification in the array
						
						var index = batchedNotifications.length;
						batchedNotifications.push(params);
						batchedNotificationsTypeToIndex[params.type] = index;
					}
					
				} else {
					
					if( getContinuousMapperUpdates().length != 0 ){
						params.updateMappers = true;
						clearContinuousMapperUpdates();
					}
					
					renderer.notify(params);
				}
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
					
					if( selector == null ){
						selector = "";
					}
					
					var collection = new CyCollection(cy, elements);
					return new CySelector(cy, group, selector).filter(collection, addLiveFunction);
				} else {
					$.each(structs["nodes"], function(id, element){
						elements.push(element);
					});
					$.each(structs["edges"], function(id, element){
						elements.push(element);
					});
					var collection = new CyCollection(cy, elements);
					return new CySelector(cy, selector).filter(collection, addLiveFunction);
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
							elements.push(element);
							
							element.restore();
						} 
						
						// add the collection
						else if( opts instanceof CyCollection ){
							var collection = opts;
							collection.each(function(i, ele){
								elements.push(ele);
							});
							
							collection.restore();
						} 
						
						// specify an array of options
						else if( $$.is.array(opts) ){
							$.each(opts, function(i, elementParams){
								if( params != null && params.group != null ){
									elements.push(new CyElement( cy, $.extend({}, elementParams, { group: params.group }) ));
								} else {
									elements.push(new CyElement( cy, elementParams ));
								}
							});
						} 
						
						// specify via opts.nodes and opts.edges
						else if( $$.is.plainObject(opts) && ($$.is.array(opts.nodes) || $$.is.array(opts.edges)) ){
							$.each(["nodes", "edges"], function(i, group){
								if( $$.is.array(opts[group]) ){
									$.each(opts[group], function(i, eleOpts){
										elements.push(new CyElement( cy, $.extend({}, eleOpts, { group: group }) ));
									});
								} 
							});
						}
						
						// specify options for one element
						else {
							if( params != null && params.group != null ){
								elements.push(new CyElement( cy, $.extend({}, opts, { group: params.group }) ));
							} else {
								elements.push(new CyElement( cy, opts ));
							}
						}
					});
					
					notify({
						type: "add",
						collection: elements
					});
					
					
					return new CyCollection( cy, elements );
				}
			}
			
			var prevLayoutOptions = options.layout;
						
			function cybind(target, events, data, handler){
				
				var one;
				if( $$.is.plainObject(target) ){
					one = target.one;
					target = target.target;
				}
				
				if( handler === undefined ){
					handler = data;
					data = undefined;
				}
				
				if( structs.listeners[target] == null ){
					structs.listeners[target] = {};
				}
				
				$.each(events.split(/\s+/), function(j, event){
					if(event == "") return;
					
					if( structs.listeners[target][event] == null ){
						structs.listeners[target][event] = [];
					}
					
					structs.listeners[target][event].push({
						callback: handler,
						data: data,
						one: one
					});
				});
			}
			
			function cyunbind(target, events, handler){
				if( structs.listeners[target] == null ){
					return;
				}
				
				if( events === undefined ){
					structs.listeners[target] = {};
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
						
						if( listener.callback == handler ){
							structs.listeners[target][event].splice(i, 1);
							i--;
						}
					}
				});

			}
			
			function cytrigger(target, event, data){
				var type = $$.is.string(event) ? event : event.type;
				
				if( structs.listeners[target] == null || structs.listeners[target][type] == null ){
					return;
				}
				
				for(var i = 0; i < structs.listeners[target][type].length; i++){
					var listener = structs.listeners[target][type][i];
					
					var eventObj;
					if( $$.is.plainObject(event) ){
						eventObj = event;
						event = eventObj.type;
					} else {
						eventObj = jQuery.Event(event);
					}
					eventObj.data = listener.data;
					eventObj.cy = eventObj.cytoscapeweb = cy;
					
					var args = [ eventObj ];
					
					if( data != null ){
						$.each(data, function(i, arg){
							args.push(arg);
						});
					}
					
					if( listener.one ){
						structs.listeners[target][type].splice(i, 1);
						i--;
					}
					
					listener.callback.apply(cy, args);
				}
			}
			
			var background = {
				one: function(event, data, handler){
					cybind({ one: true, target: "background" }, event, data, handler);
					return this;
				},
					
				bind: function(event, data, handler){
					cybind("background", event, data, handler);
					return this;
				},
				
				unbind: function(event, handler){
					cyunbind("background", event, handler);
					return this;
				},
				
				trigger: function(event, data){
					cytrigger("background", event, data);
					return this;
				}
			};
			
			// shortcuts to types
			var CyElement = $.cytoscapeweb.CyElement;
			var CyCollection = $.cytoscapeweb.CyCollection;
			var CySelector = $.cytoscapeweb.CySelector;
			
			var zoomEnabled = true;
			var panEnabled = true;
			
			// this is the cytoweb object
			var cy = {
				
				_private: structs,
					
				container: function(){
					return $(options.container);
				},
				
				getElementById: function(id){
					return structs.nodes[id] || structs.edges[id];
				},
				
				// TODO refactor this
				notify: notify,
				noNotifications: noNotifications,
				notificationsEnabled: notificationsEnabled,
				addContinuousMapperBounds: addContinuousMapperBounds,
				renderer: function(){ return renderer; },
				removeContinuousMapperBounds: removeContinuousMapperBounds,
				updateContinuousMapperBounds: updateContinuousMapperBounds,
				
				one: function(event, data, handler){
					cybind({ one: true, target: "cy" }, event, data, handler);
					
					return this;
				},
				
				bind: function(event, data, handler){
					cybind("cy", event, data, handler);
					
					return this;
				},
				
				unbind: function(event, handler){
					cyunbind("cy", event, handler);
					
					return this;
				},
				
				trigger: function(event, data){
					cytrigger("cy", event, data);
					
					return this;
				},
				
				delegate: function(selector, event, data, handler){
					this.elements(selector).live(event, data, handler);
					
					return this;
				},
				
				undelegate: function(selector, event, handler){
					this.elements(selector).die(event, handler);
					
					return this;
				},
				
				on: function(event, selector, data, handler){
					if( data === undefined && handler === undefined ){
						cybind("cy", event, data, handler);
					} else {
						this.elements(selector).live(event, data, handler);
					}
						
					return this;
				},
				
				off: function(event, selector, handler){
					if( selector === undefined && handler === undefined ){
						cyunbind("cy", event);
					} else if( handler === undefined ){
						if( $$.is.fn(selector) ){
							handler = selector;
							selector = undefined;
							cyunbind("cy", event, handler);
						} else {
							cy.elements(selector).die(event);
						}
					} else {
						cy.elements(selector).die(event, handler);
					}
						
					return this;
				},
				
				style: function(val){
					var ret;
					
					if( val === undefined ){
						ret = $$.util.copy( structs.style );
					} else {
						structs.style = $$.util.copy( val );
						ret = this;
						
						notify({
							type: "style",
							style: structs.style
						});
					}
					
					return ret;
				},
				
				background: function(){
					return background;
				},
				
				add: addElement(),
				
				remove: function(collection){
					if( typeof collection == typeof "" ){
						var selector = collection;
						var elements = elementsCollection({ selector: selector, addLiveFunction: false });
						return elements.remove();
					} else {
						return collection.remove();
					}
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
				
				$: function(){
					return cy.filter.apply( cy, arguments );
				},
				
				filter: function(selector){
					if( $$.is.string(selector) ){
						return elementsCollection({ selector: selector, addLiveFunction: true });
					} else if( $$.is.fn(selector) ) {
						return elementsCollection().filter(selector);
					}
				},
				
				collection: function(){
					return new CyCollection( cy );
				},
				
				layout: function(params){
					if( params == null ){
						$$.console.error("Layout options must be specified to run a layout");
						return;
					}
					
					if( params.name == null ){
						$$.console.error("A `name` must be specified to run a layout");
						return;
					}
					
					var name = params.name.toLowerCase();
					var layoutProto = $$.extension("layout", name);
					
					if( layoutProto == null ){
						$$.console.error("Can not apply layout: No such layout `%s` found; did you include its JS file?", name);
						return;
					}
					
					if( prevLayoutOptions.name != name || layout == null ){
						layout = new layoutProto();						
						prevLayoutOptions = params;
					}
					
					if( $$.is.fn( params.start ) ){
						cy.one();
					}
					cy.trigger("layoutstart");		
					
					layout.run( $.extend({}, params, {
						renderer: renderer,
						cy: cy
					}) );
					
					return this;
					
				},
				
				panning: function(bool){
					if( bool !== undefined ){
						panEnabled = bool ? true : false;
					} else {
						return panEnabled;
					}
					
					return cy;
				},
				
				zooming: function(bool){
					if( bool !== undefined ){
						zoomEnabled = bool ? true : false;
					} else {
						return zoomEnabled;
					}
					
					return cy;
				},
				
				pan: function(params){
					var ret = renderer.pan(params);
					
					if( ret == null ){
						cy.trigger("pan");
						return cy;
					}
					
					return ret;
				},
				
				panBy: function(params){
					var ret = renderer.panBy(params);
					
					if( ret == null ){
						cy.trigger("pan");
						return cy;
					}
					
					return ret;
				},
				
				fit: function(elements){
					var ret = renderer.fit({
						elements: elements,
						zoom: true
					});
					
					if( ret == null ){
						cy.trigger("zoom");
						cy.trigger("pan");
						return cy;
					}
					
					return ret;
				},
				
				zoom: function(params){
					var ret = renderer.zoom(params);
					
					if( ret != null ){
						return ret;
					} else {
						cy.trigger("zoom");
						return cy;
					}
				},
				
				center: function(elements){
					renderer.fit({
						elements: elements,
						zoom: false
					});
					
					cy.trigger("pan");
					return cy;
				},
				
				centre: function(){ // alias to center
					return cy.center.apply(cy, arguments); 
				},
				
				reset: function(){
					renderer.pan({ x: 0, y: 0 });
					renderer.zoom(1);
					
					cy.trigger("zoom");
					cy.trigger("pan");
					
					return this;
				},
				
				load: function(elements, onload, ondone){
					// remove old elements
					cy.elements().remove();
					
					if( elements != null ){
						
						noNotifications(function(){
							
							if( $$.is.plainObject(elements) ){
								$.each(["nodes", "edges"], function(i, group){
									
									var elementsInGroup = elements[group];
									if( elementsInGroup != null ){
										$.each(elementsInGroup, function(i, params){
											var element = new CyElement( cy, $.extend({}, params, { group: group }) );
										});
									}
								});
							} else if( $$.is.array(elements) ){
								$.each(elements, function(i, params){
									var element = new CyElement( cy, params );
								});
							}
							
						});
						
					}
					
					notificationsEnabled(false);
					
					function callback(){
						cy.layout({
							name: options.layout.name,
							ready: function(){
								notificationsEnabled(true);
								
								notify({
									type: "load", // TODO should this be a different type?
									collection: cy.elements(),
									style: structs.style
								});
								
								if( $$.is.fn(onload) ){
									onload.apply(cy, [cy]);
								}
								cy.trigger("load");
								cy.trigger("layoutready");
							},
							stop: function(){
								if( $$.is.fn(ondone) ){
									ondone.apply(cy, [cy]);
								}
								cy.trigger("layoutdone");
							}
						});
						
						
					}
					
					// TODO remove timeout when chrome reports dimensions onload properly
					// only affects when loading the html from localhost, i think...
					if( window.chrome ){
						setTimeout(function(){
							callback();
						}, 30);
					} else {
						callback();
					}
					
					return this;
				},
				
				exportTo: function(params){
					var format = params.name;
					var exporterDefn = reg.exporter[format];
					
					if( exporterDefn == null ){
						$$.console.error("No exporter with name `%s` found; did you remember to register it?", format);
					} else {
						var exporter = new exporterDefn({
							cy: cy,
							renderer: renderer
						});
						
						return exporter.run();
					}
				},
				
				scratch: function( name, value ){
					if( value === undefined ){
						return structs.scratch[name];
					} else {
						structs.scratch[name] = value;
						return this;
					}
				},
				
				removeScratch: function( name ){
					if( name === undefined ){
						structs.scratch = {};
					} else {
						eval( "delete structs.scratch." + name + ";" );
					}
					
					return this;
				}
				
			};
			
			if( $$.extensions.core != null ){
				$.each($$.extensions.core, function(name, func){
					if( cy[name] == null ){
						cy[name] = func;
					} else {
						$$.console.error("Can not override core function `%s`; already has default implementation", name);
					}
				});
			}
			
			var rendererProto = $$.extension("renderer", options.renderer.name);
			if( rendererProto == null ){
				$$.console.error("Can not initialise: No such renderer `$s` found; did you include its JS file?", options.renderer.name);
				return;
			}
			
			var renderer = new rendererProto( $.extend({}, options.renderer, {
				
				cy: cy,
				style: options.style,
				
				styleCalculator: {
					calculate: function(element, styleVal){

						if( $$.is.plainObject(styleVal) ){
							
							var ret;
							
							if( styleVal.customMapper != null ){
								
								ret = styleVal.customMapper.apply( element, [ element.data() ] );
								
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
									$$.console.error("For style.%s.%s, `attr.name` must be defined as a string since it's a continuous mapper", element.group(), styleName);
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
									} else if( $$.is.number(map.mapped.min) && $$.is.number(map.mapped.max) ){
										ret = percent * (map.mapped.max - map.mapped.min) + map.mapped.min;
									} else if( (map.mapped.min) && (map.mapped.max) ){
										
										var cmin = $.Color(map.mapped.min).fix().toRGB();
										var cmax = $.Color(map.mapped.max).fix().toRGB();

										var red = Math.round( cmin.red() * (1 - percent) + cmax.red() * percent );
										var green  = Math.round( cmin.green() * (1 - percent) + cmax.green() * percent );
										var blue  = Math.round( cmin.blue() * (1 - percent) + cmax.blue() * percent );

										ret = $.Color([red, green, blue], "RGB").toHEX().toString();
									} else {
										$$.console.error("Unsupported value used in mapper for `style.%s.%s` with min mapped value `%o` and max `%o` (neither number nor colour)", element.group(), map.styleName, map.mapped.min, map.mapped.max);
										return;
									}
								} else {
									$$.console.error("Attribute values for `%s.%s` must be numeric for continuous mapper `style.%s.%s` (offending %s: `%s`)", element.group(), map.attr.name, element.group(), styleName, element.group(), element.data("id"));
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
			
			var layout;
			
			// initial load
			cy.load(options.elements, function(){ // onready
				var data = $(options.container).data("cytoscapeweb");
				
				if( data == null ){
					data = {};
				}
				data.cy = cy;
				data.ready = true;
				
				if( data.readies != null ){
					$.each(data.readies, function(i, ready){
						cy.bind("ready", ready);
					});
					
					data.readies = [];
				}
				
				$(options.container).data("cytoscapeweb", data);
				
				startAnimationLoop();
				
				if( $$.is.fn( options.ready ) ){
					options.ready.apply(cy, [cy]);
				}
				
				cy.trigger("ready");
			}, function(){ // ondone
				if( $$.is.fn( options.done ) ){
					options.done.apply(cy, [cy]);
				}
				
				cy.trigger("done");
			});
			
			return cy; // return cytoscape web from jquery lib call
		} 
		
		// allow for registration of extensions
		// e.g. $.cytoscapeweb("renderer", "svg", SvgRenderer);
		// e.g. $.cytoscapeweb("renderer", "svg", "nodeshape", "ellipse", SvgEllipseNodeShape);
		// e.g. $.cytoscapeweb("core", "doSomething", function(){ /* doSomething code */ });
		// e.g. $.cytoscapeweb("collection", "doSomething", function(){ /* doSomething code */ });
		else if( $$.is.string(opts) ) {
			return $$.extension.apply($$.extension, arguments);
		}
	};
	
	
})(jQuery, jQuery.cytoscapeweb);

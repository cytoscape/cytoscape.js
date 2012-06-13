;(function($, $$){
	
	// metaprogramming makes me happy

	// use this module to cherry pick functions into your prototype
	// (useful for functions shared between the core and collections, for example)

	// e.g.
	// $$.fn.collection({
	//   foo: $$.define.foo({ /* params... */ })
	// });

	var eventRegex = /(\w+)(\.\w+)?/; // regex for matching event strings (e.g. "click.namespace")
	var eventOptionalTypeRegex = /(\w+)?(\.\w+)?/;

	function generateEventId(){
		return [ "cyevent", +new Date(), "rand", Math.round(Math.random() * 1000000) ].join("-");
	}

	$$.define = {

		// access data field
		// requires .pdata()
		data: function( params ){
			var defaults = { 
				field: "data",
				bindingEvent: "data",
				allowBinding: false,
				allowSetting: false,
				allowGetting: false,
				settingEvent: "data",
				settingTriggersEvent: false,
				triggerFnName: "trigger",
				immutableKeys: {}, // key => true if immutable
			};
			params = $$.util.extend({}, defaults, params);

			return function( name, value ){
				var p = params;
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;

				// .data("foo", ...)
				if( $$.is.string(name) ){ // set or get property

					// .data("foo")
					if( p.allowGetting && value === undefined ){ // get

						var ret;
						if( single ){
							ret = single._private[ p.field ][ name ];
						}
						return ret;
					
					// .data("foo", "bar")
					} else if( p.allowSetting && value !== undefined ) { // set
						var valid = !p.immutableKeys[name];
						if( valid ){

							for( var i = 0, l = all.length; i < l; i++ ){
								all[i]._private[ p.field ][ name ] = value;
							}

							if( p.settingTriggersEvent ){
								self[ p.triggerFnName ]( p.settingEvent );
							}
						}
					}

				// .data({ "foo": "bar" })
				} else if( p.allowSetting && $$.is.plainObject(name) ){ // extend
					var obj = name;
					var k, v;

					for( k in obj ){
						v = obj[ k ];

						var valid = !p.immutableKeys[k];
						if( valid ){
							for( var i = 0, l = all.length; i < l; i++ ){
								all[i]._private[ p.field ][ k ] = v;
							}
						}
					}
					
					if( p.settingTriggersEvent ){
						self[ p.triggerFnName ]( p.settingEvent );
					}
				
				// .data(function(){ ... })
				} else if( p.allowBinding && $$.is.fn(name) ){ // bind to event
					var fn = name;
					self.bind( p.bindingEvent, fn );
				
				// .data()
				} else if( p.allowGetting && name === undefined ){ // get whole object
					var ret;
					if( single ){
						ret = single._private[ p.field ];
					}
					return ret;
				}

				return self; // maintain chainability
			}; // function
		}, // data

		// remove data field
		// requires .pdata()
		removeData: function( params ){
			var defaults = { 
				field: "data",
				event: "data",
				triggerFnName: "trigger",
				triggerEvent: false,
				immutableKeys: {} // key => true if immutable
			};
			params = $$.util.extend({}, defaults, params);

			return function( names ){
				var p = params;
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				
				// .removeData("foo bar")
				if( $$.is.string(names) ){ // then get the list of keys, and delete them
					var keys = names.split(/\s+/);
					var l = keys.length;

					for( var i = 0; i < l; i++ ){ // delete each non-empty key
						var key = keys[i];
						if( $$.is.emptyString(key) ){ continue; }

						var valid = !p.immutableKeys[ key ]; // not valid if immutable
						if( valid ){
							for( var i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
								delete all[ i_a ]._private[ p.field ][ key ];
							}
						}
					}

					if( p.triggerEvent ){
						self[ p.triggerFnName ]( p.event );
					}

				// .removeData()
				} else if( names === undefined ){ // then delete all keys

					for( var i_a = 0, l_a = all.length; i_a < l_a; i_a++ ){
						var _privateFields = all[ i_a ]._private[ p.field ];
						
						for( var key in _privateFields ){
							var validKeyToDelete = !p.immutableKeys[ key ];

							if( validKeyToDelete ){
								delete _privateFields[ key ];
							}
						}
					}

					if( p.triggerEvent ){
						self[ p.triggerFnName ]( p.event );
					}
				}

				return self; // maintain chaining
			}; // function
		}, // removeData

		// event binding (requires pdata)
		on: function( params ){
			var defaults = {
				unbindSelfOnTrigger: false,
				unbindAllBindersOnTrigger: false
			};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, selector, data, callback){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var p = params;

				if( $$.is.plainObject(selector) ){ // selector is actually data
					callback = data;
					data = selector;
				} else if( $$.is.fn(selector) ){ // selector is actually callback
					callback = selector;
					data = undefined;
					selector = undefined;
				}

				if( $$.is.fn(data) ){ // data is actually callback
					callback = data;
					data = undefined;
				}

				// if there isn't a callback, we can't really do anything
				// (can't speak for mapped events arg version)
				if( !$$.is.fn(callback) && eventsIsString ){
					return self; // maintain chaining
				}

				if( eventsIsString ){ // then convert to map
					var map = {};
					map[ events ] = callback;
					events = map;
				}

				for( var evts in events ){
					callback = events[evts];
					if( !$$.is.fn(callback) ){ continue; }

					evts = evts.split(/\s+/);
					for( var i = 0; i < evts.length; i++ ){
						var evt = evts[i];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match(eventRegex); // type[.namespace]

						if( match ){
							var type = match[1];
							var namespace = match[2] ? match[2] : undefined;

							var listener = {
								id: generateEventId(),
								callback: callback, // callback to run
								data: data, // extra data in eventObj.data
								delegated: selector !== undefined, // whether the evt is delegated
								selector: selector, // the selector to match for delegated events
								type: type, // the event type (e.g. "click")
								namespace: namespace, // the event namespace (e.g. ".foo")
								unbindSelfOnTrigger: p.unbindSelfOnTrigger,
								unbindAllBindersOnTrigger: p.unbindAllBindersOnTrigger,
								binders: all // who bound together
							};

							for( var j = 0; j < all.length; j++ ){
								all[j]._private.listeners.push( listener );
							}
						}
					} // for events array
				} // for events map
				
				return self; // maintain chaining
			}; // function
		}, // on

		off: function( params ){
			var defaults = {
			};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, selector, callback){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var p = params;

				if( $$.is.fn(selector) ){ // selector is actually callback
					callback = selector;
					selector = undefined;
				}

				if( eventsIsString ){ // then convert to map
					var map = {};
					map[ events ] = callback;
					events = map;
				}

				for( var evts in events ){
					callback = events[evts];

					evts = evts.split(/\s+/);
					for( var h = 0; h < evts.length; h++ ){
						var evt = evts[h];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match(eventOptionalTypeRegex); // [type][.namespace]
						if( match ){
							var type = match[1] ? match[1] : undefined;
							var namespace = match[2] ? match[2] : undefined;

							for( var i = 0; i < all.length; i++ ){ //
								var listeners = all[i]._private.listeners;

								for( var j = 0; j < listeners.length; j++ ){
									var listener = listeners[j];
									var nsMatches = !namespace || namespace === listener.namespace;
									var typeMatches = !type || listener.type === type;
									var cbMatches = !callback || callback === listener.callback;
									var listenerMatches = nsMatches && typeMatches && cbMatches;

									// delete listener if it matches
									if( listenerMatches ){
										listeners.splice(j, 1);
										j--;
									}
								} // for listeners
							} // for all
						} // if match
					} // for events array

					
				} // for events map
				
				return self; // maintain chaining
			}; // function
		}, // off

		trigger: function( params ){
			var defaults = {};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, extraParams){
				var self = this;
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var eventsIsString = $$.is.string(events);
				var eventsIsObject = $$.is.plainObject(events);
				var eventsIsEvent = $$.is.event( events );
				var p = params;
				var cy = this._private.cy || this;

				if( eventsIsString ){ // then make an array of event objects
					var evts = events.split(/\s+/);
					events = [];

					for( var i = 0; i < evts.length; i++ ){
						var evt = evts[i];
						if( $$.is.emptyString(evt) ){ continue; }

						var match = evt.match(eventRegex); // type[.namespace]
						var type = match[1];
						var namespace = match[2] ? match[2] : undefined;

						events.push( new $$.Event(type, {
							cy: cy,
							cytarget: all,
							namespace: namespace
						}) );
					}
				} else if( eventsIsObject ){ // put in length 1 array
					if( eventsIsEvent ){ // just wrap
						events = [ events ];
					} else { // wrap normal event obj

						events = [ new $$.Event(events, {
							cy: cy,
							cytarget: all
						}) ];

					}
				}

				if( !$$.is.array(extraParams) ){ // make sure extra params are in an array
					extraParams = [ extraParams ];
				}

				for( var i = 0; i < events.length; i++ ){ // trigger each event in order
					var evt = events[i];
					var cytarget = evt.cytarget;
					var cytargetIsElement = $$.is.element( cytarget );

					for( var j = 0; j < all.length; j++ ){ // for each
						var target = all[j];
						var listeners = target._private.listeners;
						var targetIsElement = $$.is.element(target);

						for( var k = 0; k < listeners.length; k++ ){ // check each listener
							var lis = listeners[k];
							var nsMatches = !lis.namespace || lis.namespace === evt.namespace;
							var typeMatches = lis.type === evt.namespace;
							var targetMatches = lis.delegated ? ( cytarget !== target && cytargetIsElement && cytarget.is(lis.selector) ) : (true);
							var listenerMatches = nsMatches && typeMatches && targetMatches;

							if( listenerMatches ){ // then trigger it
								var args = [ evt ];
								args = args.concat( extraParams );

								if( lis.data ){ // add on data plugged into binding
									evt.data = lis.data;
								} else { // or clear it in case the event obj is reused
									evt.data = undefined;
								}

								if( lis.unbindSelfOnTrigger || lis.unbindAllBindersOnTrigger ){ // then remove listener
									listeners.splice(k, 1);
									k--;
								}

								if( lis.unbindAllBindersOnTrigger ){ // then delete the listener for all binders
									var binders = lis.binders;
									for( var l = 0; l < binders.length; l++ ){
										var binder = binders[l];
										if( !binder || binder === target ){ continue; } // already handled target or we can't handle it

										var binderListeners = binder._private.listeners;
										for( var m = 0; m < binderListeners.length; m++ ){
											var binderListener = binderListeners[m];

											if( binderListener === lis ){ // delete listener from list
												binderListeners.splice(m, 1);
												m--;
											}
										}
									}
								}

								// run the callback
								var ret = lis.callback.apply( target, args );

								if( ret === false || e.isPropagationStopped() ){
									// then don't bubble
								} else {
									// bubble up event for elements
									if( targetIsElement ){
										var parent = target.parent();
										var hasParent = parent.length !== 0;

										if( hasParent ){ // then bubble up to parent
											parent = parent[0];
											parent.trigger(evt);
										} else { // otherwise, bubble up to the core
											cy.trigger(evt);
										}
									}
								}
							} // if listener matches
						} // for each listener
					} // for each of all
				} // for each event
				
				return self; // maintain chaining
			}; // function
		} // trigger

	}; // define

	// window.foo = function(){ return {

	// 	_private: {
	// 		listeners: [],
	// 		cy: window.cy
	// 	},

	// 	on: $$.define.on(),

	// 	one: $$.define.on({ unbindSelfOnTrigger: true }),

	// 	once: $$.define.on({ unbindAllBindersOnTrigger: true }),

	// 	off: $$.define.off(),

	// 	trigger: $$.define.trigger(),

	// } };

	// setTimeout(function(){
	// 	window.f = foo();
	// }, 1000);
	
})(jQuery, jQuery.cytoscape);

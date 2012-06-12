;(function($, $$){
	
	// metaprogramming what what

	// use this module to cherry pick functions into your prototype
	// (useful for functions shared between the core and collections, for example)

	// e.g.
	// $$.fn.collection({
	//   foo: $$.define.foo({ /* params... */ })
	// });

	var eventRegex = /(\w+)(\.\w+)?/;

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
			}
		},

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
			};
		},

		// event binding (requires pdata)
		on: function( params ){
			var defaults = {
				one: false, // trigger once per element
				once: false // trigger once per element set (e.g. collection)
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
				if( callback == null && eventsIsString ){
					return self; // maintain chaining
				}

				if( eventsIsString ){ // then convert to map
					var evtstr = events;
					events = {};

					var eventsArray = evtstr.split(/\s+/);
					var l = eventsArray.length;
					for( var i = 0; i < l; i++ ){
						var event = eventsArray[i];
						if( $$.is.emptyString(event) ){ continue; }

						events[event] = callback;
					}
				}

				for( var event in events ){
					var callback = events[event];
					var match = event.match(eventRegex); // type[.namespace]

					if( match ){
						var type = match[1];
						var namespace = match[2] ? match[2] : null;

						var listener = {
							callback: callback,
							data: data,
							delegated: selector !== undefined,
							selector: selector,
							type: type,
							namespace: namespace,
							one: p.one,
							once: p.once,
							self: self
						};

						for( var i = 0; i < all.length; i++ ){
							all[i]._private.listeners.push( listener );
						}
					}
				}
				
				return self; // maintain chaining
			};
		},
/*
		off: function( params ){
			var defaults = {
				one: false, // trigger once per element
				once: false // trigger once per element set (e.g. collection)
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

				if( eventsIsString ){ // then make a map
					var evtstr = events;
					events = {};

					var eventsArray = evtstr.split(/\s+/);
					var l = eventsArray.length;
					for( var i = 0; i < l; i++ ){
						var event = eventsArray[i];
						if( $$.is.emptyString(event) ){ continue; }

						events[event] = callback;
					}
				}

				for( var event in events ){
					var callback = events[event];
					var match = event.match(eventRegex); // type[.namespace]

					if( match ){
						var type = match[1];
						var namespace = match[2] ? match[2] : null;

						for( var i = 0; i < all.length; i++ ){
							var listeners = all[i]._private.listeners;

							for( var j = 0; j < listeners.length; j++ ){
								var listener = listeners[j];

								// delete listener if it matches
								if( listener.type === type 
								&& (!namespace || namespace === listener.namespace)
								&& (!callback || callback === listener.callback) ){
									listener.splice(j, 1);
									j--;
								}
							}
						}
					}
				}
				
				return self; // maintain chaining
			};
		}, 

		trigger: function( params ){
			var defaults = {};
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

				if( eventsIsString ){ // then make a map
					var evtstr = events;
					events = {};

					var eventsArray = evtstr.split(/\s+/);
					var l = eventsArray.length;
					for( var i = 0; i < l; i++ ){
						var event = eventsArray[i];
						if( $$.is.emptyString(event) ){ continue; }

						events[event] = callback;
					}
				}

				for( var event in events ){
					var callback = events[event];
					var match = event.match(eventRegex); // type[.namespace]

					if( match ){
						var type = match[1];
						var namespace = match[2] ? match[2] : null;

						for( var i = 0; i < all.length; i++ ){
							var listeners = all[i]._private.listeners;

							for( var j = 0; j < listeners.length; j++ ){
								var listener = listeners[j];

								// delete listener if it matches
								if( listener.type === type 
								&& (!namespace || namespace === listener.namespace)
								&& (!callback) || callback === listener.callback) ){
									listener.splice(j, 1);
									j--;
								}
							}
						}
					}
				}
				
				return self; // maintain chaining
			};
		} */

	};
	
})(jQuery, jQuery.cytoscape);

;(function($, $$){
	
	// metaprogramming what what

	// use this module to cherry pick functions into your prototype
	// (useful for functions shared between the core and collections, for example)

	// e.g.
	// $$.fn.collection({
	//   foo: $$.define.foo({ /* params... */ })
	// });

	$$.define = {

		// access to _private in a convenient way that abstracts away handling array-like prototypes
		
		// in other words, you can use .pdata() to access _private for CyCollections without worrying
		// about whether the collection is empty, whether the collection is actually just an element, etc

		pdata: function( params ){
			var defaults = {
			};
			params = $$.util.extend({}, defaults, params);

			return function( name, value ){
				var self = this;
				var p = params; // put in local scope
				var selfIsArrayLike = self.length !== undefined;
				var all = selfIsArrayLike ? self : [self]; // put in array if not array-like
				var single = selfIsArrayLike ? self[0] : self;
				var ret;
				var l;
				var i;

				// .pdata(true, ...)
				if( name === true ){ // treat as a map
					var command = value;
					var args = [];

					l = arguments.length;
					for( i = 2; i < l; i++ ){
						args.push( arguments[i] );
					}

					var keepChildren;
					if( $$.is.plainObject(command) ){ // an object lets us have more options
						var options = command;
						keepChildren = options.keepChildren;
						command = options.command;
					}

					switch( command ){

					// .pdata(true, "get", ...)
					case "get":

						if( single ){
							ret = $$.util.getMap({
								map: single._private,
								keys: args
							});
						}
						return ret;

						break;

					// .pdata(true, "set", ...)	
					case "set":
						value = args.pop();

						l = all.length;
						for( i = 0; i < l; i++ ){
							$$.util.setMap({
								map: all[i]._private,
								keys: args,
								value: value
							});
						}
						break;

					// .pdata(true, "push", ...)	
					case "push":
						value = args.pop();

						l = all.length;
						for( i = 0; i < l; i++ ){
							$$.util.pushMap({
								map: all[i]._private,
								keys: args,
								value: value
							});
						}
						break;

					// .pdata(true, "delete", ...)
					case "delete":

						l = all.length;
						for( i = 0; i < l; i++ ){
							$$.util.deleteMap({
								map: all[i]._private,
								keys: args,
								keepChildren: keepChildren
							});
						}
						break;

					default:
						break;
					}

				// .pdata({ ... })
				} else if( $$.is.plainObject(name) ){ // extend _private
					var map = name;

					l = all.length;
					for( i = 0; i < l; i++ ){
						$$.util.extend( all[i]._private, map );
					}

				// .pdata("foo", ...)
				} else if( $$.is.string(name) ){ // get or set specific field

					// .pdata("foo")
					if( value === undefined ){ // get
						var ret;

						if( single ){
							ret = single._private[name];
						}

						return ret;

					// .pdata("foo", "bar")
					} else { // set

						l = all.length;
						for( i = 0; i < l; i++ ){
							all[i]._private[name] = value;
						}
					}

				// .pdata()
				} else if( name === undefined ) { // get whole _private
					var ret;

					if( single ){
						ret = single._private;
					}	

					return ret;
				}

				return self; // maintain chainability
			}
		},

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
						return self.pdata( true, "get", p.field, name );
					
					// .data("foo", "bar")
					} else if( p.allowSetting && value !== undefined ) { // set
						var valid = !p.immutableKeys[name];
						if( valid ){
							self.pdata( true, "set", p.field, name, value );

							if( p.settingTriggersEvent ){
								self[ p.triggerFnName ]( p.settingEvent );
							}
						}
					}

				// .data({ "foo": "bar" })
				} else if( p.allowSetting && $$.is.plainObject(name) ){ // extend
					var obj = name;
					var k, v;

					for(k in obj){
						v = obj[k];

						var valid = !p.immutableKeys[k];
						if( valid ){
							self.pdata( true, "set", p.field, k, v );
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
					return self.pdata( p.field );
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
				
				// .removeData("foo bar")
				if( $$.is.string(names) ){ // then get the list of keys, and delete them
					var keys = names.split(/\s+/);
					var l = keys.length;

					for( var i = 0; i < l; i++ ){ // delete each non-empty key
						var key = keys[i];
						if( $$.is.emptyString(key) ){ continue; }

						var valid = !p.immutableKeys[ key ]; // not valid if immutable
						if( valid ){
							self.pdata( true, "delete", p.field, key );

							if( p.triggerEvent ){
								self[ p.triggerFnName ]( p.event );
							}
						}
					}

				// .removeData()
				} else if( names === undefined ){ // then delete all keys

					self.pdata( true, {
						command: "delete",
						keepChildren: p.immutableKeys // keep immutable keys
					}, p.field );

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
				listenerObj: null, //function(self){ return {}; }
			};
			params = $$.util.extend({}, defaults, params);
			
			return function(events, selector, data, callback){
				var self = this;
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
					var match = event.match(/(\w+)(\.\w+)?/); // type[.namespace]

					if( match ){
						var type = match[1];
						var namespace = match[2] ? match[2] : null;

						var listener = {
							callback: callback,
							data: data,
							delegated: selector !== undefined,
							selector: selector
						};

						if( p.listenerObj ){
							$$.util.extend( listener, p.listenerObj([ self ]) );
						}
						
						self.pdata( true, "set", "listeners", type, namespace, listener );
					}
				}
				
				return self; // maintain chaining
			};
		},

		off: function( params ){

		},

		trigger: function( params ){

		}

	};
	
})(jQuery, jQuery.cytoscape);

;(function($, $$){
	
	// use this module to cherry pick functions into your prototype

	$$.define = {

		// access to _private in a convenient way
		pdata: function( params ){
			var defaults = {
				each: function(self, callback){ return callback.apply(self, []); },
				single: function(self, callback){ return callback.apply(self, []); }
			};
			params = $.extend({}, defaults, params);

			return function( name, value ){
				var self = this;

				if( name === true ){ // treat as a map
					var command = value;
					var args = [];
					var ret;

					for(var i = 2; i < arguments.length; i++){
						args.push( arguments[i] );
					}

					switch( command ){
					case "get":

						params.single(self, function(){
							ret = $$.util.getMap({
								map: this._private,
								keys: args
							});
						});
						return ret;

						break;

					case "set":
						value = args.pop();

						params.each(self, function(){
							$$.util.setMap({
								map: this._private,
								keys: args,
								value: value
							});
						});
						break;

					case "push":
						value = args.pop();

						params.each(self, function(){
							$$.util.pushMap({
								map: this._private,
								keys: args,
								value: value
							});
						});
						break;

					case "delete":
						params.each(self, function(){
							$$.util.deleteMap({
								map: this._private,
								keys: args
							});
						});
						break;

					default:
						break;
					}

				} else if( $$.is.plainObject(name) ){ // extend _private
					var map = name;
					params.each(self, function(){
						$.extend(this._private, map);
					});
				} else if( $$.is.string(name) ){ // get or set specific field
					if( value === undefined ){ // get
						var ret;

						params.single(self, function(){
							ret = this._private[name];
						});

						return ret;
					} else { // set
						params.each(self, function(){
							this._private[name] = value;
						});
					}
				} else { // get whole _private
					var ret;

					params.single(self, function(){
						ret = this._private;
					});

					return ret;
				}

				return self; // maintain chainability
			}
		},

		data: function( params ){
			var defaults = {
				field: "data",
				event: "data"
			};
			params = $.extend({}, defaults, params);

			return function( name, value ){
				var self = this;

				if( $$.is.string(name) ){ // set or get property

					if( value === undefined ){ // get
						return self.pdata( params.field )[name];
					} else { // set
						self.pdata( params.field )[name] = value;
					}

				} else if( $$.is.plainObject(name) ){ // extend
					var obj = name;
					$.extend( self.pdata( params.field ), obj );
				
				} else if( $$.is.fn(name) ){ // bind to event
					var fn = name;
					self.on(params.event, fn);
				}

				return self; // maintain chainability
			}
		},

		// event binding (requires pdata)
		on: function( params ){
			var defaults = {
				listenerObj: function(self, single){ return {}; }
			};
			params = $.extend({}, defaults, params);
			
			return function(events, selector, data, callback){
				var self = this;
				var eventsIsString = $$.is.string(events);

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
					return this;
				}

				if( eventsIsString ){ // then convert to map
					var evtstr = events;
					events = {};

					$.each(evtstr.split(/\s+/), function(i, event){
						if( $$.is.emptyString(event) ){ return; }

						events[event] = callback;
					});
				}

				$.each(events, function(event, callback){
					var match = event.match(/(\w+)(\.\w+)?/);

					if( match ){
						var type = match[1];
						var namespace = match[2] ? match[2] : null;

						var listener = params.listenerObj.apply(this, [ self, this ]);
							
						listener.callback = callback; // add the callback
						listener.data = data; // add the data
						listener.delegated = selector !== undefined;
						listener.selector = selector;
						
						self.pdata(true, "set", "listeners", type, namespace, listener);
					}
				});
				
				return this;
			};
		},

		off: function( params ){

		}

	};
	
})(jQuery, jQuery.cytoscape);

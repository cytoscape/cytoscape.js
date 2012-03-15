;(function($, $$){
	
	$$.fn.collection({
		name: "trigger",
		impl: function(event, data){
			this.each(function(){
				var self = this;
				var type = $$.is.plainObject(event) ? event.type : event;
				var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
				
				var listeners = this._private.listeners[type];
				
				function fire(listener, eventData){
					if( listener != null && $$.is.fn(listener.callback) ){
						var eventData = $$.is.plainObject(event) ? event : jQuery.Event(type);
						eventData.data = listener.data;
						eventData.cy = eventData.cytoscapeweb = cy;
						
						var args = [eventData];
						
						if( data != null ){
							$.each(data, function(i, arg){
								args.push(arg);
							});
						}
						
						listener.callback.apply(self, args);
					}
				}
				
				// trigger regularly bound listeners
				if( listeners != null ){
					$.each(listeners, function(i, listener){
						fire(listener);
					});
					
					for(var i = 0; i < listeners.length; i++){
						function remove(){
							listeners.splice(i, 1);
							i--;
						}
						
						if( listeners[i].one ){
							remove();
						} else if( listeners[i].once ){
							var listener = listeners[i];
							
							// remove listener for other elements
							listener.collection.each(function(j, ele){
								if( !ele.same(self) ){
									ele.unbind(type, listener.callback);
								}
							});
							
							// remove listener for self
							remove();
						}
					}
				}
				
				// trigger element live events
				if( structs.live[type] != null ){
					$.each(structs.live[type], function(key, callbackDefns){
						
						var selector = new $$.CySelector( self.cy(), key );
						var filtered = selector.filter( self.collection() );
						
						if( filtered.size() > 0 ){
							$.each(callbackDefns, function(i, listener){
								fire(listener);
							});
						}
					});
				}
				
				// bubble up element events to the core
				self.cy().trigger(event, data);
				
			});
			
			return this;
		}
	});
	
	$$.fn.collection({
		name: "rtrigger",
		impl: function(event, data){
			// notify renderer unless removed
			this.cy().notify({
				type: event,
				collection: this.filter(function(){
					return !this.removed();
				})
			});
			
			this.trigger(event, data);
		}
	});
	
	$$.fn.collection({
		name: "live",
		impl: function(){
			$$.console.warn("`live()` can be called only on collections made from top-level selectors");
			return this;
		}
	});
	
	$$.fn.collection({
		name: "die",
		impl: function(){
			$$.console.warn("`die()` can be called only on collections made from top-level selectors");
			return this;
		}
	});
	
	$$.fn.collection({
		name: "bind",
		impl: defineBinder({
			listener: function(){
				return {};
			}
		})
	});
	
	$$.fn.collection({
		name: "one",
		impl: defineBinder({
			listener: function(){
				return { one: true };
			}
		})
	});
	
	$$.fn.collection({
		name: "once",
		impl: defineBinder({
			listener: function( collection, element ){
				return {
					once: true,
					collection: collection
				}
			},
			after: function( collection, callback, data ){
				// do nothing
			}
		})
	});
	
	$$.fn.collection({
		name: "on",
		impl: function(events, data, callback){
			return this.bind(events, data, callback);
		}
	});
	
	$$.fn.collection({
		name: "off",
		impl: function(events, callback){
			return this.unbind(events, callback);
		}
	});
	
	$$.fn.collection({
		name: "unbind",
		impl: function(events, callback){
			var eventsArray = (events || "").split(/\s+/);
			
			this.each(function(){
				var self = this;
				
				if( events === undefined ){
					self._private.listeners = {};
					return;
				}
				
				$.each(eventsArray, function(j, event){
					if( $$.is.emptyString(event) ) return this;
				
					var listeners = self._private.listeners[event];
					
					if( listeners != null ){
						for(var i = 0; i < listeners.length; i++){
							var listener = listeners[i];
							
							if( callback == null || callback == listener.callback ){
								listeners.splice(i, 1);
								i--;
							}
						}
					}
				
				});
			});
			
			return this;
		}
	});
	
	// add events to the list here IF AND ONLY IF there is no corresponding getter/setter function
	// e.g. it doesn't make sense to have `data` here, since it's also a getter/setter
	var aliases = "mousedown mouseup click mouseover mouseout mousemove touchstart touchmove touchend grab drag free";
	
	$.each(aliases.split(/\s+/), function(i, alias){
		$$.fn.collection({
			name: alias,
			impl: defineBindAlias({
				event: alias
			})
		});
	});
	
	function defineBindAlias( params ){
		var defaults = {
			event: ""
		};
		
		params = $.extend({}, defaults, params);
		
		return function(data, callback){
			if( $$.is.fn(callback) ){
				return this.bind(params.event, data, callback);
			} else if( $$.is.fn(data) ){
				var handler = data;
				return this.bind(params.event, handler);						
			} else {
				return this.rtrigger(params.event, data);
			}
		};
	}
	
	function defineBinder( params ){
		var defaults = {
			listener: function(){},
			after: function(){}
		};
		params = $.extend({}, defaults, params);
		
		return function(events, data, callback){
			var self = this;
			
			if( callback === undefined ){
				callback = data;
				data = undefined;
			}
			
			$.each(events.split(/\s+/), function(i, event){
				if( $$.is.emptyString(event) ) return;
				
				self.each(function(){
					if( this._private.listeners[event] == null ){
						this._private.listeners[event] = [];
					}
					
					var listener = params.listener.apply(this, [ self, this ]);
					
					listener.callback = callback; // add the callback
					listener.data = data; // add the data
					this._private.listeners[event].push( listener );
				});
				
				params.after.apply(self, [self, callback, data]);
			});
			
			return this;
		};
	}
	
	
	
})(jQuery, jQuery.cytoscapeweb);

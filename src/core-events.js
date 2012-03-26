;(function($, $$){
	
	$$.fn.core({	
		one: defineBind({
			target: "cy",
			one: true
		}),
		
		bind: defineBind({
			target: "cy"
		}),
		
		unbind: defineUnbind({
			target: "cy"
		}),
		
		trigger: defineTrigger({
			target: "cy"
		}),
		
		delegate: function(selector, events, data, handler){
			this.$(selector).live(events, data, handler);
			
			return this;
		},
		
		undelegate: function(selector, events, handler){
			this.$(selector).die(events, handler);
			
			return this;
		},
		
		on: function( events, selector, data, handler ){
			if( $$.is.string(selector) ){
				this.$(selector).live(events, data, handler);
			} else {
				selector = undefined;
				data = selector;
				handler = data;
				
				this.bind(events, data, handler);
			}
			
			return this;
		},
		
		off: function(event, selector, handler){
			
			if( $$.is.string(selector) ){
				this.$(selector).live(events, handler);
			} else {
				handler = selector;
				selector = undefined;
				
				this.unbind(events, handler);
			}
				
			return this;
		},
		
		background: function(){
			var cy = this;
			
			if( cy._private.background == null ){
				var fns = ["on", "off", "bind", "unbind", "one", "trigger"];
				
				cy._private.background = {};
				$.each(fns, function(i, fnName){
					cy._private.background[fnName] = function(){
						return cy["bg" + $$.util.capitalize(fnName)].apply(cy, arguments);
					};
				});
			}
			
			return cy._private.background;
		},
		
		bgOne: defineBind({
			target: "bg",
			one: true
		}),
		
		bgOn: defineBind({
			target: "bg"
		}),
		
		bgOff: defineUnbind({
			target: "bg"
		}),
		
		bgBind: defineBind({
			target: "bg"
		}),
		
		bgUnbind: defineUnbind({
			target: "bg"
		}),
		
		bgTrigger: defineTrigger({
			target: "bg"
		})
		
	});
	
	function defineBind( params ){
		var defaults = {
			target: "cy",
			one: false
		};
		params = $.extend( {}, defaults, params );
		
		return function(events, data, handler){
			var cy = this;
			var listeners = cy._private.listeners;
			
			if( handler === undefined ){
				handler = data;
				data = undefined;
			}
			
			events = events.split(/\s+/);
			$.each(events, function(i, event){
				if( $$.is.emptyString(event) ){ return; }
				
				if( listeners[ params.target ] == null ){
					listeners[ params.target ] = {};
				}
				
				if( listeners[ params.target ][ event ] == null ){
					listeners[ params.target ][ event ] = [];
				}
				
				listeners[ params.target ][ event ].push({
					callback: handler,
					data: data,
					one: params.one
				});
			});
			
			return cy;
		};
	};

	function defineUnbind( params ){
		var defaults = {
			target: "cy"
		};
		params = $.extend({}, defaults, params);
		
		return function(events, handler){
			var cy = this;
			var listeners = cy._private.listeners;
			
			if( listeners[ params.target ] == null ){
				return;
			}
			
			events = events.split(/\s+/);
			$.each(events, function(i, event){
				if( $$.is.emptyString(event) ){ return; }
				
				// unbind all
				if( handler === undefined ){
					delete listeners[ params.target ][ event ];
					return;
				}
				
				// unbind specific handler
				else {
					for(var i = 0; i < listeners[params.target][event].length; i++){
						var listener = listeners[params.target][event][i];
						
						if( listener.callback == handler ){
							listeners[params.target][event].splice(i, 1);
							i--;
						}
					}
				}
			});
			
			return cy;
		}
	}
	
	function defineTrigger( params ){
		var defaults = {
			target: "cy"
		};
		params = $.extend( {}, defaults, params );
		
		return function( event, data ){
			var cy = this;
			var listeners = cy._private.listeners;
			var types;
			var target = params.target;
			
			if( $$.is.plainObject(event) ){
				types = [ event.type ];
			} else {
				types = event.split(/\s+/);
			}
			
			$.each(types, function(t, type){
				if( listeners[target] == null || listeners[target][type] == null ){
					return;
				}
				
				for(var i = 0; i < listeners[target][type].length; i++){
					var listener = listeners[target][type][i];
					
					var eventObj;
					if( $$.is.plainObject(event) ){
						eventObj = event;
						event = eventObj.type;
					} else {
						eventObj = $.Event(event);
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
						listeners[target][type].splice(i, 1);
						i--;
					}
					
					listener.callback.apply(cy, args);
				}
			});
		}
	}
		
})(jQuery, jQuery.cytoscapeweb);

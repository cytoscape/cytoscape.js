CyCollection.prototype.once = function(event, data, handler){
		var self = this;
		var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
		
		if( handler === undefined ){
			handler = data;
			data = undefined;
		}
		
		var events = event.split(/\s+/);
		$.each(events, function(i, type){
			var listener = {
				once: true,
				callback: handler,
				collection: new CyCollection( self.cy() )
			};
			
			structs.once.push(listener);
			
			self.each(function(i, ele){
				if( ele._private.listeners[type] == null ){
					ele._private.listeners[type] = [];
				}
				
				ele._private.listeners[type].push(listener);
				listener.collection = listener.collection.add(ele);
			});
		});
		
		return this;
	};
	
	
	CyCollection.prototype.live = function(){
		$$.console.error("`live` can be called only on collections made from top-level selectors");
	};
	
	CyCollection.prototype.die = function(){
		$$.console.error("`die` can be called only on collections made from top-level selectors");
	};
	
	

	function listenerAlias(params){
		return function(data, callback){
			if( $$.is.fn(callback) ){
				return this.bind(params.name, data, callback);
			} else if( $$.is.fn(data) ){
				var handler = data;
				return this.bind(params.name, handler);						
			} else {
				return this.rtrigger(params.name, data);
			}
		};
	}
	
	// aliases to listeners, e.g. node.click(fn) => node.bind("click", fn)
	// TODO add more
	CyElement.prototype.mousedown = listenerAlias({ name : "mousedown" });
	CyElement.prototype.mouseup = listenerAlias({ name : "mouseup" });
	CyElement.prototype.mouseover = listenerAlias({ name : "mouseover" });
	CyElement.prototype.mouseout = listenerAlias({ name : "mouseout" });
	CyElement.prototype.mousemove = listenerAlias({ name : "mousemove" });
	CyElement.prototype.click = listenerAlias({ name : "click" });
	CyElement.prototype.touchstart = listenerAlias({ name : "touchstart" });
	CyElement.prototype.touchmove = listenerAlias({ name : "touchmove" });
	CyElement.prototype.touchend = listenerAlias({ name : "touchend" });
	CyElement.prototype.grab = listenerAlias({ name : "grab" });
	CyElement.prototype.drag = listenerAlias({ name : "drag" });
	CyElement.prototype.free = listenerAlias({ name : "free" });
	
	
	CyElement.prototype.trigger = function(event, data){
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
				if( listeners[i].one ){
					listeners.splice(i, 1);
					i--;
				} else if( listeners[i].once ){
					var listener = listeners[i];
					
					// remove listener for other elements
					listener.collection.each(function(j, ele){
						if( !ele.same(self) ){
							ele.unbind(type, listener.callback);
						}
					});
					
					// remove listener from global once struct
					for(var j = 0; j < structs.once.length; j++){
						if( listener == structs.once[j] ){
							structs.once.splice(j, 1);
							j--;
						}
					}
					
					// remove listener for self
					listeners.splice(i, 1);
					i--;
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
		
		return this;
	};
	
	
	function bind(opts){
		return function(events, data, callback){
			var self = this;
			
			if( callback === undefined ){
				callback = data;
				data = undefined;
			}
			
			var defaults = {
				one: false,
				data: data
			};
			var options = $.extend({}, defaults, opts);
			
			$.each(events.split(/\s+/), function(i, event){
				if(event == "") return this;
				
				if( self._private.listeners[event] == null ){
					self._private.listeners[event] = [];
				}				
				
				options.callback = callback;
				self._private.listeners[event].push(options);
			});
			
			return this;
		};
	}
	
	CyElement.prototype.bind = bind({ one: false });
	CyElement.prototype.one = bind({ one: true });
	
	CyElement.prototype.live = function(){
		$$.console.error("You can not call `live` on an element");
		return this;
	};
	
	CyElement.prototype.die = function(){
		$$.console.error("You can not call `die` on an element");
		return this;
	};
	
	CyElement.prototype.on = function(events, data, callback){
		return this.bind(events, data, callback);
	};
	
	CyElement.prototype.off = function(events, callback){
		return this.unbind(events, callback);
	};
	
	CyElement.prototype.unbind = function(events, callback){
		var self = this;
		
		if( events === undefined ){
			self._private.listeners = {};
			return this;
		}
		
		$.each(events.split(/\s+/), function(j, event){
			if(event == "") return this;
		
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
		
		return this;
	};
	
	CyElement.prototype.rtrigger = function(event, data){
		// notify renderer unless removed
		if( !this.removed() ){
			this.cy().notify({
				type: event,
				collection: [ this ]
			});
		}
		
		this.trigger(event, data);
	};
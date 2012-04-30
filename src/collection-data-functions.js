;(function($, $$){
	
	$$.fn.collection({
		data: defineAccessor({ // defaults serve as example (data)
			attr: "data",
			allowBinding: true,
			bindingEvent: "data",
			settingTriggersEvent: true, 
			settingEvent: "data",
			validKey: { // already guaranteed that key is a string; `this` refers to the element
				forSet: function( key ){
					switch( key ){
					case "id":
					case "source":
					case "target":
						return false;
					default:
						return true;
					}
				}
			},
			onSet: function( key, oldVal, newVal ){ // callback function to call when setting for an element
				this.cy().updateContinuousMapperBounds(this, key, oldVal, newVal);
			}
		}) 
	});
	
	$$.fn.collection({
		removeData: defineRemover({
			attr: "data",
			event: "data",
			triggerEvent: true,
			onRemove: function( key, val ){ // callback after removing; `this` refers to the element
				this.cy().removeContinuousMapperBounds(this, key, val);
			},
			validKey: function( key ){
				switch(key){
				case "id":
				case "source":
				case "target":
					return false;
				default:
					return true;
				}
			},
			essentialKeys: [ "id", "source", "target" ] // keys that remain even when deleting all
		}) 
	});
	
	$$.fn.collection({
		id: function(){
			return this.element()._private.data.id;
		}
	});
	
	$$.fn.collection({
		position: defineAccessor({
			attr: "position",
			allowBinding: true,
			bindingEvent: "position",
			settingTriggersEvent: true, 
			settingEvent: "position",
			validKey: {
				forSet: function( key ){
					return this.isNode();
				},
				forGet: function( key ){
					return this.isNode();
				}
			},
			validValue: function( key, val ){
				return true;
			},
			onSet: function( key, oldVal, newVal ){
				// do nothing
			},
			onGet: function( key, val ){
				// do nothing
			}
		})
	});
	
	$$.fn.collection({
		positions: function(pos){
			if( $$.is.plainObject(pos) ){
				
				this.each(function(i, ele){
					$.each(pos, function(key, val){
						ele._private.position[ key ] = val;
					});
				});
				
				this.rtrigger("position");
				
			} else if( $$.is.fn(pos) ){
				var fn = pos;
				
				this.each(function(i, ele){
					var pos = fn.apply(ele, [i, ele]);
					
					$.each(pos, function(key, val){
						ele._private.position[ key ] = val;
					});
				});
				
				this.rtrigger("position");
			}
		}
	});
	
	$$.fn.collection({
		renderedPosition: defineAccessor({
			attr: "position",
			allowBinding: false,
			settingTriggersEvent: true, 
			settingEvent: "position",
			validKey: {
				forSet: function( key ){
					return this.isNode();
				},
				forGet: function( key ){
					return this.isNode();
				}
			},
			validValue: function( key, val ){
				return true;
			},
			override: {
				forSet: function( key, val ){ 
					var rpos = {};
					rpos[ key ] = val;
					
					var mpos = this.cy().renderer().modelPoint( rpos );
					this.element()._private.position[key] = mpos[key];
				},
				forGet: function( key ){
					var mpos = this.position(false);
					var rpos = this.cy().renderer().renderedPoint( mpos );
					return rpos[ key ];
				},
				forObjectGet: function(){
					return this.cy().renderer().renderedPosition( this.element() );
				}
			}
		})
	});
	
	$$.fn.collection({
		renderedDimensions: function( dimension ){
			var ele = this.element();
			var renderer = ele.cy().renderer(); // TODO remove reference after refactoring
			var dim = renderer.renderedDimensions(ele);
			
			if( dimension === undefined ){
				return dim;
			} else {
				return dim[dimension];
			}
		}
	});
	
	$$.fn.collection({
		style: function( key ){
			var ele = this.element();
			
			if( key === undefined ){
				return $$.util.copy( ele._private.style );
			}
			
			// on false, return whole obj but w/o copying
			else if( key === false ){
				return ele._private.style;
			}
			
			else if( $$.is.string(key) ){
				return $$.util.copy( ele._private.style[key] );
			}
		}
	});
	
	$$.fn.collection({
		bypass: defineAccessor({
			attr: "bypass",
			allowBinding: true,
			bindingEvent: "bypass",
			settingTriggersEvent: true, 
			settingEvent: "bypass"
		})
	});
	
	$$.fn.collection({
		removeBypass: defineRemover({
			attr: "bypass",
			event: "bypass",
			triggerEvent: true
		})
	});
	
	// Generic metacode for defining data function behaviour follows
	//////////////////////////////////////////////////////////////////////////////////////
	
	function defineAccessor( opts ){
		var defaults = { // defaults serve as example (data)
			attr: "foo",
			allowBinding: false,
			bindingEvent: "foo",
			settingTriggersEvent: false, 
			settingEvent: "foo",
			validKey: { // already guaranteed that key is a string; `this` refers to the element
				forGet: function( key ){
					return true;
				},
				forSet: function( key ){
					return true;
				}
			},
			override: {
				forSet: null, // function(key, val){ return val; },
				forGet: null, // function(key){ return val; },
				forObjectGet: null // function( obj ){ return obj; }
			},
			validValue: function( key, val ){
				return true;
			},
			onSet: null, // function( key, oldVal, newVal ){},
			onGet: null, // function( key, val ){}
		};
		var params = $.extend(true, {}, defaults, opts);
				
		return function(key, val){
			var ele = this.element();
			var eles = this;
			
			function getter(key){
				if( params.validKey.forGet.apply(ele, [key]) ){
					var ret;
					
					if( $$.is.fn( params.override.forGet ) ){
						ret = params.override.forGet.apply( ele, [ key ] );
					} else {
						ret = $$.util.copy(  ele._private[ params.attr ] [ key ] );
					}
					
					if( $$.is.fn(params.onGet) ){
						params.onGet.apply( ele, [key, ret] );
					}
					
					return ret;
				} else {
					//$$.console.warn( "Can not access field `%s` for `%s` for collection with element `%s`", key, params.attr, ele._private.data.id );
				}
			}
			
			function setter(key, val){
				eles.each(function(){
					if( params.validKey.forSet.apply(this, [key]) && params.validValue.apply(this, [key, val]) ){
						var oldVal = this.element()._private[ params.attr ][ key ];
						
						if( $$.is.fn( params.override.forSet ) ){
							params.override.forSet.apply( this, [ key, val ] );
						} else {
							this.element()._private[ params.attr ][ key ] = $$.util.copy( val );
						}
						
						if( $$.is.fn(params.onSet) ){
							params.onSet.apply( ele, [key, oldVal, val] );
						}
					} else {
						//$$.console.warn( "Can not set field `%s` for `%s` for element `%s` to value `%o` : invalid value", key, params.attr, ele._private.data.id );
					}
				});
			}
			
			function bind(fn, data){
				if( data === undefined ){
					eles.bind( params.bindingEvent, fn );
				} else {
					eles.bind( params.bindingEvent, data, fn );
				}
			}
			
			function trigger(){
				if( params.settingTriggersEvent ){
					eles.rtrigger( params.settingEvent );
				}
			}
			
			function objGetter( copy ){
				var ret;
				var obj = ele._private[ params.attr ];
				
				if( $$.is.fn( params.override.forObjectGet ) ){
					ret = params.override.forObjectGet.apply( ele, [ ] );
				} else {
					ret = obj;
				}
				
				if( copy || copy === undefined ){
					ret = $$.util.copy( ret );
				}
				
				return ret;
			}
			
			// CASE: no parameters
			// get whole attribute object
			if( key === undefined ){
				return objGetter();
			}
			
			// if passed false, just get the whole object without copying
			else if( key === false ){
				return objGetter(false);
			}
			
			// CASE: single parameter
			else if( val === undefined ){
				
				// get attribute with specified key
				if( $$.is.string(key) ){
					return getter(key);
				}
				
				// set fields with an object
				else if( $$.is.plainObject(key) ) {
					var obj = key;
					
					$.each(obj, function(key, val){
						setter(key, val);
					});
					
					trigger();
				}
				
				// bind with a handler function
				else if( params.allowBinding && $$.is.fn(key) ){
					var fn = key;
					
					bind(fn);
				}
				
				else {
					$$.console.warn("Invalid first parameter for `%s()` for collection with element `%s` : expect a key string or an object" + ( params.allowBinding ?  " or a handler function for binding" : "" ), params.attr, ele._private.data.id);
				}

			}
			
			// CASE: two parameters
			else {
				
				// bind to event with data object
				if( params.allowBinding && $$.is.plainObject(key) && $$.is.fn(val) ){
					var data = key;
					var fn = val;
					
					bind(fn, data);
				}
				
				// set field with key to val
				else if( $$.is.string(key) ){
					setter(key, val);
					trigger();
				}
				
				else {
					$$.console.warn("Invalid parameters for `%s()` for collection with element `%s` : expect a key string and a value" + ( params.allowBinding ?  " or a data object and a handler function for binding" : "" ), params.attr, ele._private.data.id);
				}
				
			}
			
			return this; // chaining
		};
	}
	
	function defineRemover( opts ){
		var defaults = {
			attr: "foo",
			event: "foo",
			triggerEvent: false,
			onRemove: function( key, val ){ // callback after removing; `this` refers to the element
				// do nothing
			},
			validKey: function( key ){
				return true;
			},
			essentialKeys: [  ] // keys that remain even when deleting all
		};
		
		var params = $.extend(true, {}, defaults, opts);
		
		return function(keys){
			var ele = this.element();
			var eles = this;
			
			function removeAll(){
				eles.each(function(){
					var ele = this.element();
					var oldObj = ele._private[ params.attr ];
					var newObj = {};
					
					// copy essential keys to new obj
					$.each( params.essentialKeys, function(i, key){
						if( oldObj[ key ] !== undefined ){
							newObj[ key ] = oldObj[ key ];
						}
					} );
					
					ele._private[ params.attr ] = newObj;
				});
			}
			
			function remove( key ){
				eles.each(function(){
					var ele = this.element();
					
					if( params.validKey.apply(ele, [key]) ){
						var val = ele._private[ params.attr ][ key ];
						delete ele._private[ params.attr ][ key ];
						
						if( $$.is.fn( params.onRemove ) ){
							params.onRemove.apply(ele, [key, val]);
						}
					}
				});
			}
			
			function trigger(){
				if( params.triggerEvent ){
					eles.rtrigger( params.event );
				}
			}
			
			// remove all 
			if( keys === undefined ){
				removeAll();
				trigger();
			}
			
			else if( $$.is.string(keys) ){
				var keysArray = keys.split(/\s+/);
				
				$.each( keysArray, function(i, key){
					if( $$.is.emptyString(key) ) return; // ignore empty keys
					remove( key );
				} );
				
				trigger();
			} 
			
			else {
				$$.console.warn("Invalid parameters to `%s()` for collection with element `%s` : %o", params.attr, ele._private.data.id, arguments);
			}
			
			return this; // chaining
		};
	}

	
})(jQuery, jQuery.cytoscapeweb);

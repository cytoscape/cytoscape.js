;(function($, $$){
	
	$$.fn.collection({

		data: $$.define.data({
			field: "data",
			bindingEvent: "data",
			allowBinding: true,
			allowSetting: true,
			settingEvent: "data",
			settingTriggersEvent: true,
			triggerFnName: "rtrigger",
			allowGetting: true,
			immutableKeys: {
				"id": true,
				"source": true,
				"target": true,
				"parent": true
			}
		}),

		removeData: $$.define.removeData({
			field: "data",
			event: "data",
			triggerFnName: "rtrigger",
			triggerEvent: true,
			immutableKeys: {
				"id": true,
				"source": true,
				"target": true,
				"parent": true
			}
		}),

		scratch: $$.define.data({
			field: "scratch",
			allowBinding: false,
			allowSetting: true,
			settingTriggersEvent: false,
			allowGetting: true
		}),

		renscratch: $$.define.data({
			field: "renscratch",
			allowBinding: false,
			allowSetting: true,
			settingTriggersEvent: false,
			allowGetting: true
		}),

		id: function(){
			if( this[0] ){
				return this[0]._private.data.id;
			}
		},

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
		}),

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
		},

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
					var ele = this.element();
					if( ele != null ){
						ele._private.position[key] = mpos[key];
					}
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
		}),

		renderedStyle: function( property ){
			var ele = this.element();
			if( ele == null ){ return undefined }

			var renderer = ele.cy().renderer(); // TODO remove reference after refactoring
			var rstyle = renderer.renderedStyle( ele );
			
			if( property === undefined ){
				return rstyle;
			} else {
				return rstyle[property];
			}
		},

		style: $$.define.data({
			field: "style",
			allowBinding: false,
			allowSetting: false,
			allowGetting: true
		}),

		bypass: $$.define.data({
			field: "bypass",
			bindingEvent: "bypass",
			allowBinding: true,
			allowSetting: true,
			settingEvent: "bypass",
			settingTriggersEvent: true,
			triggerFnName: "rtrigger",
			allowGetting: true
		}),

		removeBypass: $$.define.removeData({
			field: "bypass",
			event: "bypass",
			triggerFnName: "rtrigger",
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
				if( ele == null ){ return undefined }

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
					//$.error( "Can not access field `%s` for `%s` for collection with element `%s`", key, params.attr, ele._private.data.id );
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
						//$.error( "Can not set field `%s` for `%s` for element `%s` to value `%o` : invalid value", key, params.attr, ele._private.data.id );
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
				if( ele == null ){
					return undefined; // empty collection doesn't return anything
				}

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
					$.error("Invalid first parameter for `%s()` for collection with element `%s` : expect a key string or an object" + ( params.allowBinding ?  " or a handler function for binding" : "" ), params.attr, ele._private.data.id);
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
					$.error("Invalid parameters for `%s()` for collection with element `%s` : expect a key string and a value" + ( params.allowBinding ?  " or a data object and a handler function for binding" : "" ), params.attr, ele._private.data.id);
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
				$.error("Invalid parameters to `%s()` for collection with element `%s` : %o", params.attr, ele._private.data.id, arguments);
			}
			
			return this; // chaining
		};
	}

	
})(jQuery, jQuery.cytoscape);

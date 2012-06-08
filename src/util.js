;(function($, $$){
	
	// utility functions only for internal use

	$$.util = {

		extend: $.extend,
		error: $.error,
		each: $.each,

		clone: function( obj ){
			var target = {};
			for (var i in obj) {
				if ( obj.hasOwnProperty(i) ) {
					target[i] = obj[i];
				}
			}
			return target;
		},

		// gets a shallow copy of the argument
		copy: function( obj ){
			if( obj == null ){
				return obj;
			} if( $$.is.array(obj) ){
				return $.extend([], obj);
			} else if( $$.is.plainObject(obj) ){
				return $.extend({}, obj);
			} else {
				return obj;
			}
		},
		
		// has anything been set in the map
		mapEmpty: function( map ){
			var empty = true;

			if( map != null ){
				for(var i in map){
					empty = false;
					break;
				}
			}

			return empty;
		},

		// pushes to the array at the end of a map (map may not be built)
		pushMap: function( options ){
			var array = $$.util.getMap(options);

			if( array == null ){ // if empty, put initial array
				$$.util.setMap( $.extend({}, options, {
					value: [ options.value ]
				}) );
			} else {
				array.push( options.value );
			}
		},

		// sets the value in a map (map may not be built)
		setMap: function( options ){
			var obj = options.map;
			var key;
			var keys = options.keys;
			var l = keys.length;

			for(var i = 0; i < l; i++){
				var key = keys[i];

				if( $$.is.plainObject( key ) ){
					$$.util.error("Tried to set map with object key");
				}

				if( i < keys.length - 1 ){
					
					// extend the map if necessary
					if( obj[key] == null ){
						obj[key] = {};
					}
					
					obj = obj[key];
				} else {
					// set the value
					obj[key] = options.value;
				}
			}
		},
		
		// gets the value in a map even if it's not built in places
		getMap: function( options ){
			var obj = options.map;
			var keys = options.keys;
			var l = keys.length;
			
			for(var i = 0; i < l; i++){
				var key = keys[i];

				if( $$.is.plainObject( key ) ){
					$$.util.error("Tried to get map with object key");
				}

				obj = obj[key];
				
				if( obj == null ){
					return obj;
				}
			}
			
			return obj;
		},

		// deletes the entry in the map
		deleteMap: function( options ){
			var obj = options.map;
			var keys = options.keys;
			var l = keys.length;
			var keepChildren = options.keepChildren;
			
			for(var i = 0; i < l; i++){
				var key = keys[i];

				if( $$.is.plainObject( key ) ){
					$$.util.error("Tried to delete map with object key");
				}

				var lastKey = i === options.keys.length - 1;
				if( lastKey ){
					
					if( keepChildren ){ // then only delete child fields not in keepChildren
						for( var child in obj ){
							if( !keepChildren[child] ){
								delete obj[child];
							}
						}
					} else {
						delete obj[key];
					}

				} else {
					obj = obj[key];
				}
			}
		},
		
		capitalize: function(str){
			if( $$.is.emptyString(str) ){
				return str;
			}
			
			return str.charAt(0).toUpperCase() + str.substring(1);
		}
			
	};
	
})(jQuery, jQuery.cytoscape);

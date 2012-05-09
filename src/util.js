;(function($, $$){
	
	$$.util = {
			
		// gets a deep copy of the argument
		copy: function( obj ){
			if( obj == null ){
				return obj;
			} if( $$.is.array(obj) ){
				return $.extend(true, [], obj);
			} else if( $$.is.plainObject(obj) ){
				return $.extend(true, {}, obj);
			} else {
				return obj;
			}
		},
		
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

		// sets the value in a map (map may not be built)
		setMap: function( options ){
			var obj = options.map;
			
			$.each(options.keys, function(i, key){
				if( i < options.keys.length - 1 ){
					
					// extend the map if necessary
					if( obj[key] == null ){
						obj[key] = {};
					}
					
					obj = obj[key];
				} else {
					// set the value
					obj[key] = options.value;
				}
			});
		},
		
		// gets the value in a map even if it's not built in places
		getMap: function( options ){
			var obj = options.map;
			
			for(var i = 0; i < options.keys.length; i++){
				var key = options.keys[i];
				obj = obj[key];
				
				if( obj == null ){
					return obj;
				}
			}
			
			return obj;
		},
		
		capitalize: function(str){
			if( $$.is.emptyString(str) ){
				return str;
			}
			
			return str.charAt(0).toUpperCase() + str.substring(1);
		}
			
	};
	
})(jQuery, jQuery.cytoscapeweb);

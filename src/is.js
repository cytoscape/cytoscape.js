;(function($, $$){
	
	$$.is = {
		string: function(obj){
			return obj != null && typeof obj == typeof "";
		},
		
		fn: function(obj){
			return obj != null && typeof obj == typeof function(){};
		},
		
		array: function(obj){
			return obj != null && obj instanceof Array;
		},
		
		plainObject: function(obj){
			return obj != null && typeof obj == typeof {} && !$$.is.array(obj);
		},
		
		number: function(obj){
			return obj != null && typeof obj == typeof 1 && !isNaN(obj);
		},
		
		color: function(obj){
			return obj != null && typeof obj == typeof "" && $.Color(obj).toString() != "";
		},
		
		bool: function(obj){
			return obj != null && typeof obj == typeof true;
		},
		
		elementOrCollection: function(obj){
			return $$.is.element(obj) || $$.is.collection(obj);
		},
		
		element: function(obj){
			return obj instanceof $$.CyElement;
		},
		
		collection: function(obj){
			return obj instanceof $$.CyCollection;
		},
		
		emptyString: function(obj){
			if( obj == null ){ // null is empty
				return true; 
			} else if( $$.is.string(obj) ){
				return obj.match(/^\s+$/) != null; // all whitespace is empty
			}
			
			return false; // otherwise, we don't know what we've got
		},
		
		nonemptyString: function(obj){
			return obj != null && $$.is.string(obj) && obj.match(/^\s+$/) == null;
		}
	};	
	
})(jQuery, jQuery.cytoscapeweb);

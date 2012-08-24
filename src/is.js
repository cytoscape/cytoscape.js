// type testing utility functions

;(function($$){
	
	$$.is = {
		string: function(obj){
			return obj != null && typeof obj == typeof "";
		},
		
		fn: function(obj){
			return obj != null && typeof obj === typeof function(){};
		},
		
		array: function(obj){
			return obj != null && obj instanceof Array;
		},
		
		plainObject: function(obj){
			return obj != null && typeof obj === typeof {} && !$$.is.array(obj) && obj.constructor === Object;
		},
		
		number: function(obj){
			return obj != null && typeof obj === typeof 1 && !isNaN(obj);
		},

		integer: function( obj ){
			return $$.is.number(obj) && Math.floor(obj) === obj;
		},
		
		color: function(obj){
			return obj != null && typeof obj === typeof "" && $.Color(obj).toString() !== "";
		},
		
		bool: function(obj){
			return obj != null && typeof obj === typeof true;
		},
		
		elementOrCollection: function(obj){
			return $$.is.element(obj) || $$.is.collection(obj);
		},
		
		element: function(obj){
			return obj instanceof $$.Element && obj._private.single;
		},
		
		collection: function(obj){
			return obj instanceof $$.Collection && !obj._private.single;
		},
		
		core: function(obj){
			return obj instanceof $$.Core;
		},

		style: function(obj){
			return obj instanceof $$.Style;
		},

		stylesheet: function(obj){
			return obj instanceof $$.Stylesheet;
		},

		event: function(obj){
			return obj instanceof $$.Event;
		},

		emptyString: function(obj){
			if( !obj ){ // null is empty
				return true; 
			} else if( $$.is.string(obj) ){
				if( obj === "" || obj.match(/^\s+$/) ){
					return true; // empty string is empty
				}
			}
			
			return false; // otherwise, we don't know what we've got
		},
		
		nonemptyString: function(obj){
			if( obj && $$.is.string(obj) && obj !== "" && !obj.match(/^\s+$/) ){
				return true;
			}

			return false;
		},

		domElement: function(obj){
			return obj instanceof HTMLElement;
		}
	};	
	
})( cytoscape );

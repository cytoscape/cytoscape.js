;(function($){
	
	$.cytoscapeweb.is = {
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
			return obj != null && typeof obj == typeof {} && !$.cytoscapeweb.is.array(obj);
		},
		
		number: function(obj){
			return obj != null && typeof obj == typeof 1 && !isNaN(obj);
		},
		
		color: function(obj){
			return obj != null && typeof obj == typeof "" && $.Color(obj).toString() != "";
		},
		
		boolean: function(obj){
			return obj != null && typeof obj == typeof true;
		},
		
		elementOrCollection: function(obj){
			return obj instanceof $.cytoscapeweb.CyElement || obj instanceof $.cytoscapeweb.CyCollection;
		}
	};	
	
})(jQuery);

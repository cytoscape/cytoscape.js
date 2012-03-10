;(function($){
	
	$.cytoscapeweb.util = {
		copy: function(obj){
			if( obj == null ){
				return obj;
			} if( $.cytoscapeweb.is.array(obj) ){
				return $.extend(true, [], obj);
			} else if( $.cytoscapeweb.is.plainObject(obj) ){
				return $.extend(true, {}, obj);
			} else {
				return obj;
			}
		}
			
	};
	
})(jQuery);

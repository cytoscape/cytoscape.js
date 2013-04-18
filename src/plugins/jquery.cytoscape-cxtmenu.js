;(function($){
	
	var defaults = {
		menuRadius: 200
	};
	
	$.fn.cytoscapeCxtmenu = function(params){
		var options = $.extend(true, {}, defaults, params);
		var fn = params;
		
		var functions = {
			destroy: function(){
				
			},
				
			init: function(){
				
			}
		};
		
		if( functions[fn] ){
			return functions[fn].apply(this, Array.prototype.slice.call( arguments, 1 ));
		} else if( typeof fn == 'object' || !fn ) {
			return functions.init.apply( this, arguments );
		} else {
			$.error("No such function `"+ fn +"` for jquery.cyCxtmenu");
		}
		
		return $(this);
	};

	$.fn.cyCxtmenu = $.fn.cytoscapeCxtmenu;
	
})(jQuery);
;(function($){
	
	// make the jQuery plugin grab what we define init to be later
	$.cytoscape = function(){
		return $.cytoscape.init.apply(this, arguments);
	};
	
	// define the function namespace here, since it has members in many places
	$.cytoscape.fn = {};
	
})(jQuery);

$(function(){
	
	var defaults = {
		
	};
	
	function RandomLayout(options){
		$.cytoscapeweb("debug", "Creating random layout with options (%o)", options);
		
		this.options = $.extend({}, defaults, options);
	}
	
	RandomLayout.prototype.run = function(params){
		var nodes = params.nodes;
		var edges = params.edges;
		var renderer = params.renderer;
		var options = this.options;
		var container = $(options.selector);
		
		$.cytoscapeweb("debug", "Running random layout with options (%o)", params);
		
		var width = container.width();
		var height = container.height();
			
		nodes.positions(function(){
			return {
				x: Math.round( Math.random() * width ),
				y: Math.round( Math.random() * height );
			};
		});
	};
	
	$.cytoscapeweb("layout", "random", RandomLayout);
	
});
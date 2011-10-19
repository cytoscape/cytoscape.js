$(function(){
	
	var defaults = {
		fit: true
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
		var cy = options.cy;
		
		$.cytoscapeweb("debug", "Running random layout with options (%o)", params);
		
		var width = container.width();
		var height = container.height();
			
		$.cytoscapeweb("debug", "Random layout found (w, h, d) = (%i, %i)", width, height);
		
		if( renderer.coordinateSystem() != "cartesian" ){
			$.cytoscapeweb("error", "Random layout supports only Cartesian coordinates");
		} else {
			nodes.positions(function(i, element){
				
				if( element.locked() ){
					return false;
				}

				return {
					x: Math.round( Math.random() * width ),
					y: Math.round( Math.random() * height )
				};
			});
			
			if( options.fit ){
				cy.fit();
			}
		}
	};
	
	$.cytoscapeweb("layout", "random", RandomLayout);
	
});
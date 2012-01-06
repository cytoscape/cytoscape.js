$(function(){
	
	var defaults = {
		fit: true
	};
	
	function RandomLayout(){
		$.cytoscapeweb("debug", "Creating random layout with options");
	}
	
	RandomLayout.prototype.run = function(params){
		var options = $.extend(true, {}, defaults, params);
		var cy = params.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		
		$.cytoscapeweb("debug", "Running random layout with options (%o)", params);
		
		var width = container.width();
		var height = container.height();
			
		$.cytoscapeweb("debug", "Random layout found (w, h, d) = (%i, %i)", width, height);
		
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

		function exec(fn){
			if( fn != null && typeof fn == typeof function(){} ){
				fn();
			}
		}
		
		exec( params.ready );
		exec( params.done );
	};
	
	$.cytoscapeweb("layout", "random", RandomLayout);
	
});
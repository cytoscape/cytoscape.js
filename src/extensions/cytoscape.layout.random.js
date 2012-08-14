;(function($, $$){
	
	var defaults = {
		ready: undefined, // callback on layoutready
		stop: undefined, // callback on layoutstop
		fit: true // whether to fit to viewport
	};
	
	function RandomLayout( options ){
		this.options = $.extend(true, {}, defaults, options);
	}
	
	RandomLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var $container = cy.container(); // the container div for cytoscapeweb
		
		var width = $container.width();
		var height = $container.height();
		

		nodes.positions(function(i, element){
			
			if( element.locked() ){
				return false;
			}

			return {
				x: Math.round( Math.random() * width ),
				y: Math.round( Math.random() * height )
			};
		});
		
		// layoutready should be triggered when the layout has set each node's
		// position at least once
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		if( options.fit ){
			cy.fit();
		}
		
		// layoutstop should be triggered when the layout stops running
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};
	
	RandomLayout.prototype.stop = function(){
		// stop the layout if it were running continuously
	};

	// register the layout
	$$(
		"layout", // we're registering a layout
		"random", // the layout name
		RandomLayout // the layout prototype
	);
	
})(jQuery, cytoscape);

;(function($$){
		
	var defaults = {};

	function NullLayout( options ){
		this.options = $$.util.extend(true, {}, defaults, options); 
	}
	
	// puts all nodes at (0, 0)
	NullLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		
		cy.nodes().positions(function(){
			return {
				x: 0,
				y: 0
			};
		});
		
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};

	NullLayout.prototype.stop = function(){
		// not a continuous layout
	};
	
	$$("layout", "null", NullLayout);
	
})(cytoscape);

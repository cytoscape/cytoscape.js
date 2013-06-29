;(function($$){

	// default layout options
	var defaults = {
		ready: function(){},
		stop: function(){}
	};

	// constructor
	// options : object containing layout options
	function CoseLayout( options ){
		this.options = $$.util.extend(true, {}, defaults, options); 
	}

	// runs the layout
	CoseLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy; // cy is automatically populated for us in the constructor

		// puts all nodes at (0, 0)
		cy.nodes().positions(function(){
			return {
				x: 0,
				y: 0
			};
		});

		// trigger layoutready when each node has had its position set at least once
		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");

		// trigger layoutstop when the layout stops (e.g. finishes)
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};

	// called on continuous layouts to stop them before they finish
	CoseLayout.prototype.stop = function(){
		var options = this.options;

		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};

	// register the layout
	$$("layout", "cose", CoseLayout);

})(cytoscape);
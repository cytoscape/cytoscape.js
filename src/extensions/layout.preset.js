;(function($$){
	
	var defaults = {
		fit: true, // whether to fit to viewport
		ready: undefined, // callback on layoutready
		stop: undefined, // callback on layoutstop
		positions: undefined, // map of (node id) => (position obj)
		zoom: undefined, // the zoom level to set (prob want fit = false if set)
		pan: undefined, // the pan level to set (prob want fit = false if set)
		padding: 30 // padding on fit
	};
	
	function PresetLayout( options ){
		this.options = $$.util.extend(true, {}, defaults, options);
	}
	
	PresetLayout.prototype.run = function(){
		var options = this.options;
		var cy = options.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		
		function getPosition(node){
			if( options.positions == null ){
				return null;
			}
			
			if( options.positions[node._private.data.id] == null ){
				return null;
			}
			
			return options.positions[node._private.data.id];
		}
		
		nodes.positions(function(i, node){
			var position = getPosition(node);
			
			if( node.locked() || position == null ){
				return false;
			}
			
			return position;
		});
		
		if( options.pan != null ){
			cy.pan( options.pan );
		}

		if( options.zoom != null ){
			cy.zoom( options.zoom );
		}

		cy.one("layoutready", options.ready);
		cy.trigger("layoutready");
		
		if( options.fit ){
			cy.fit( options.padding );
		}
		
		cy.one("layoutstop", options.stop);
		cy.trigger("layoutstop");
	};
	
	$$("layout", "preset", PresetLayout);
	
	$$("core", "presetLayout", function(){
		var cy = this;
		var layout = {};
		var elements = {};
		
		cy.nodes().each(function(i, ele){
			elements[ ele.data("id") ] = ele.position();
		});
		
		layout.positions = elements;
		layout.name = "preset";
		layout.zoom = cy.zoom();
		layout.pan = cy.pan();

		return layout;
	});
	
})(cytoscape);

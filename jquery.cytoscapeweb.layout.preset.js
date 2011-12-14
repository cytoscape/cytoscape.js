$(function(){
	
	var defaults = {
		
	};
	
	function PresetLayout(){
		$.cytoscapeweb("debug", "Creating preset layout with options");
	}
	
	PresetLayout.prototype.run = function(params){
		var options = $.extend(true, {}, defaults, params);
		$.cytoscapeweb("debug", "Running preset layout with options (%o)", options);

		var cy = params.cy;
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
		
		if( params.ready != null && typeof params.ready == typeof function(){} ){
			params.ready();
		}
	};
	
	$.cytoscapeweb("layout", "preset", PresetLayout);
	
});
$(function(){
	
	var defaults = {
		
	};
	
	function PresetLayout(options){
		$.cytoscapeweb("debug", "Creating preset layout with options (%o)", options);
		
		this.options = $.extend({}, defaults, options);
	}
	
	PresetLayout.prototype.run = function(params){
		$.cytoscapeweb("debug", "Running preset layout with options (%o)", params);
		
		var nodes = params.nodes;
		var edges = params.edges;
		var renderer = params.renderer;
		var options = this.options;
		var container = $(options.selector);
		
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
	};
	
	$.cytoscapeweb("layout", "preset", PresetLayout);
	
});
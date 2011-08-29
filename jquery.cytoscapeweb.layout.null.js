$(function(){
		
	function NullLayout(options){
		$.cytoscapeweb("debug", "Creating null layout with options (%o)", options);
	}
	
	// puts all nodes at (0, 0)
	NullLayout.prototype.run = function(params){
		$.cytoscapeweb("debug", "Running null layout with options (%o)", params);
		params.nodes.positions(function(){
			return {
				x: 0,
				y: 0
			};
		});
	};
	
	$.cytoscapeweb("layout", "null", NullLayout);
	
});
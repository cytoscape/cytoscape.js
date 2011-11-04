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
		
		if( params.ready != null && typeof params.ready == typeof function(){} ){
			params.ready();
		}
	};
	
	$.cytoscapeweb("layout", "null", NullLayout);
	
});
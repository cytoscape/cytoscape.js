$(function(){
		
	function NullLayout(){
		$.cytoscapeweb("debug", "Creating null layout");
	}
	
	// puts all nodes at (0, 0)
	NullLayout.prototype.run = function(params){
		$.cytoscapeweb("debug", "Running null layout with options (%o)", params);
		params.cy.nodes().positions(function(){
			return {
				x: 0,
				y: 0
			};
		});
		
		function exec(fn){
			if( fn != null && typeof fn == typeof function(){} ){
				fn();
			}
		}
		
		exec( params.ready );
		exec( params.done );
	};
	
	$.cytoscapeweb("layout", "null", NullLayout);
	
});
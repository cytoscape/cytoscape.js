// type testing utility functions

;(function($$){
	
	// list of ids with other metadata assoc'd with it
	$$.ids = [];

	$$.registerInstance = function( cy ){
		var id = $$.ids.length;

		$$.ids.push({
			cy: cy,
			readies: [],

		});
	};
	
})( cytoscape );

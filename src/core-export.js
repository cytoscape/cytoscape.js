;(function($$){
	
	$$.fn.core({
		
		png: function( options ){
			var cy = this;
			var renderer = this._private.renderer;

			return renderer.png( options );			
		}
		
	});
	
})( cytoscape );
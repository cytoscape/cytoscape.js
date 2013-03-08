;(function($$){
	
	$$.fn.core({
		
		png: function(){
			var cy = this;
			var renderer = this._private.renderer;

			return renderer.png();			
		}
		
	});
	
})( cytoscape );
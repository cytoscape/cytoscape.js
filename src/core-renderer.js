;(function($$){
	
	$$.fn.core({
		
		renderer: function(){
			return this._private.renderer;
		},
		
		initRenderer: function( options ){
			var cy = this;

			var rendererProto = $$.extension("renderer", options.name);
			if( rendererProto == null ){
				$$.util.error("Can not initialise: No such renderer `%s` found; did you include its JS file?", options.name);
				return;
			}
			
			this._private.renderer = new rendererProto(
				$$.util.extend({}, options, {
					cy: cy,
					style: cy._private.style
				})
			);
			
			
		}
		
	});	
	
})( cytoscape );
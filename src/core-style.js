;(function($, $$){
	
	$$.fn.core({
		
		style: function(val){
			var ret;
			
			if( val === undefined ){
				ret = $$.util.copy( this._private.style );
			} else {
				this._private.style = $$.util.copy( val );
				ret = this;
				
				this.notify({
					type: "style",
					style: this._private.style
				});
			}
			
			return ret;
		}
	});
	
})(jQuery, jQuery.cytoscape);


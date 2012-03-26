;(function($, $$){
	
	$$.fn.core({
		
		exportTo: function(params){
			var format = params.name;
			var exporterDefn = $$.extension("exporter", format);
			
			if( exporterDefn == null ){
				$$.console.error("No exporter with name `%s` found; did you remember to register it?", format);
			} else {
				var exporter = new exporterDefn({
					cy: cy,
					renderer: this.renderer()
				});
				
				return exporter.run();
			}
		}
		
	});	
	
})(jQuery, jQuery.cytoscapeweb);
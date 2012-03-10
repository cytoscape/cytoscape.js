;(function($){
	
	// define the json exporter
	function JsonExporter(options){
		this.options = options;
		this.cy = options.cy;
		this.renderer = options.renderer;
	}
	
	JsonExporter.prototype.run = function(){
		var elements = {};
		
		this.cy.elements().each(function(i, ele){
			var group = ele.group();
			
			if( elements[group] == null ){
				elements[group] = [];
			}
			
			elements[group].push( ele.json() );
		});
		
		return elements;
	};
	
	$.cytoscapeweb("exporter", "json", JsonExporter);
	
})(jQuery);

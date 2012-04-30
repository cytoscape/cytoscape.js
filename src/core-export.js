;(function($, $$){
	
	$$.fn.core({
		
		json: function(params){
			var json = {};
			var cy = this;
			
			console.log(this);

			json.elements = {};
			cy.elements().each(function(i, ele){
				var group = ele.group();
				
				if( json.elements[group] == null ){
					json.elements[group] = [];
				}
				
				elements[group].push( ele.json() );
			});

			json.style = cy.style();
			json.scratch = $$.util.copy( cy.scratch() );
			json.zoomEnabled = cy._private.zoomEnabled;
			json.panEnabled = cy._private.panEnabled;
			json.layout = $$.util.copy( cy._private.options.layout );
			json.renderer = $$.util.copy( cy._private.options.renderer );
			
			return json;
		}
		
	});	
	
})(jQuery, jQuery.cytoscapeweb);
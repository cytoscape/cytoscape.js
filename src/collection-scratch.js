;(function($, $$){

	// Functions for scratchpad data for extensions & plugins
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$$.fn.collection({
		removeScratch: defineRemover({ attr: "scratch" })
	});

	$$.fn.collection({
		removeRenscratch: defineRemover({ attr: "renscratch" })
	});

	function defineAccessor( params ){
		var defaults = {
			attr: "scratch"
		};
		params = $.extend(true, {}, defaults, params);
		
		return function( name, val ){
			var self = this;
			
			if( name === undefined ){
				return self.element()._private[ params.attr ];
			}
			
			var fields = name.split(".");
			
			function set(){
				self.each(function(){
					var self = this;
					
					var obj = self._private[ params.attr ];
					$.each(fields, function(i, field){
						if( i == fields.length - 1 ){ return; }
						
						obj = obj[field];
					});
					
					var lastField = fields[ fields.length - 1 ];
					obj[ lastField ] = val;
				});
			}
			
			function get(){
				var obj = self.element()._private[ params.attr ];
				$.each(fields, function(i, field){
					obj = obj[field];
				});
				
				return obj;
			}
			
			if( val === undefined ){
				return get(); 
			} else {
				set();
			}
			
			return this;
		};
	}
	
	function defineRemover( params ){
		var defaults = {
			attr: "scratch"
		};
		params = $.extend(true, {}, defaults, params);
		
		return function( name ){
			var self = this;
			
			// remove all
			if( name === undefined ){
				self.each(function(){
					this._private[ params.attr ] = {};
				});
			} 
			
			// remove specific
			else {
				var names = name.split(/\s+/);
				$.each(names, function(i, name){
					self.each(function(){
						eval( "delete this._private." + params.attr + "." + name + ";" );
					});
				});
			}
			
			return this;
		};
	}
	
})(jQuery, jQuery.cytoscape);

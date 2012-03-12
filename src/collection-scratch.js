;(function($, $$){

	$$.fn.collection({
		name: "scratch",
		
		impl: function( name, val ){
			var self = this;
			
			if( name === undefined ){
				return self.element()._private.scratch;
			}
			
			var fields = name.split(".");
			
			function set(){
				self.each(function(){
					var self = this;
					
					var obj = self._private.scratch;
					$.each(fields, function(i, field){
						if( i == fields.length - 1 ){ return; }
						
						obj = obj[field];
					});
					
					var lastField = fields[ fields.length - 1 ];
					obj[ lastField ] = val;
				});
			}
			
			function get(){
				var obj = self.element()._private.scratch;
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
		}
	});
	
	$$.fn.collection({
		name: "removeScratch",
		
		impl: function( name ){
			var self = this;
			
			// remove all
			if( name === undefined ){
				self.each(function(){
					this._private.scratch = {};
				});
			} 
			
			// remove specific
			else {
				var names = name.split(/\s+/);
				$.each(names, function(i, name){
					self.each(function(){
						eval( "delete this._private.scratch." + name + ";" );
					});
				});
			}
			
			return this;
		}
	});

	
})(jQuery, jQuery.cytoscapeweb);

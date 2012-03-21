;(function($, $$){
	
	$$.fn.core({
		
		scratch: function( name, value ){
			if( value === undefined ){
				return eval( "this._private.scratch." + name );
			} else {
				eval( "this._private.scratch." + name + " = " + value + ";" );
				return this;
			}
		},
		
		removeScratch: function( name ){
			if( name === undefined ){
				structs.scratch = {};
			} else {
				eval( "delete this._private.scratch." + name + ";" );
			}
			
			return this;
		}
		
	});	
	
})(jQuery, jQuery.cytoscapeweb);
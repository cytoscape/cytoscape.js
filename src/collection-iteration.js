;(function($, $$){
	
	// Functions for iterating over collections
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$$.fn.eles({
		each: function(fn){
			if( $$.is.fn(fn) ){
				for(var i = 0; i < this.length; i++){
					var ele = this[i];
					var ret = fn.apply( ele, [ i, ele ] );

					if( ret === false ){ break; } // exit each early on return false
				}
			}
			return this;
		},

		toArray: function(){
			var array = [];
			
			for(var i = 0; i < this.length; i++){
				array.push( this[i] );
			}
			
			return array;
		},

		slice: function(start, end){
			var array = [];
			var thisSize = this.length;
			
			if( end == null ){
				end = thisSize;
			}
			
			if( start < 0 ){
				start = thisSize + start;
			}
			
			for(var i = start; i >= 0 && i < end && i < thisSize; i++){
				array.push( this[i] );
			}
			
			return new $$.Collection(this.cy(), array);
		},

		size: function(){
			return this.length;
		},

		eq: function(i){
			return this[i];
		},

		empty: function(){
			return this.length === 0;
		},

		nonempty: function(){
			return !this.empty();
		}
	});
	
})(jQuery, jQuery.cytoscape);

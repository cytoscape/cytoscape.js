;(function($, $$){
	
	// Functions for iterating over collections
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$$.fn.collection({
		each: function(fn){
			if( $$.is.fn(fn) ){
				for(var i = 0; i < this.size(); i++){
					var ele = this.eq(i).element();
					var ret = fn.apply( ele, [ i, ele ] );

					if( ret === false ){ break; } // exit each early on return false
				}
			}
			return this;
		},

		toArray: function(){
			var array = [];
			
			for(var i = 0; i < this.size(); i++){
				array.push( this.eq(i).element() );
			}
			
			return array;
		},

		slice: function(start, end){
			var array = [];
			
			if( end == null ){
				end = this.size();
			}
			
			if( start < 0 ){
				start = this.size() + start;
			}
			
			for(var i = start; i >= 0 && i < end && i < this.size(); i++){
				array.push( this.eq(i) );
			}
			
			return new $$.CyCollection(this.cy(), array);
		},

		size: function(){
			return this.length;
		},

		eq: function(i){
			return this[i];
		},

		empty: function(){
			return this.size() == 0;
		},

		nonempty: function(){
			return !this.empty();
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);

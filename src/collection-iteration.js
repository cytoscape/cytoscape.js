;(function($, $$){
	
	// Functions for iterating over collections
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	$$.fn.collection({
		each: function(fn){
			if( $$.is.fn(fn) ){
				for(var i = 0; i < this.size(); i++){
					var ele = this.eq(i).element();
					fn.apply( ele, [ i, ele ] );				
				}
			}
			return this;
		}
	});
	
	
	$$.fn.collection({
		toArray: function(){
			var array = [];
			
			for(var i = 0; i < this.size(); i++){
				array.push( this.eq(i).element() );
			}
			
			return array;
		}
	});
	
	$$.fn.collection({
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
		}
	});
	
	$$.fn.collection({
		size: function(){
			return this.length;
		}
	});
	
	$$.fn.collection({
		eq: function(i){
			return this[i];
		}
	});
	
	$$.fn.collection({
		empty: function(){
			return this.size() == 0;
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);

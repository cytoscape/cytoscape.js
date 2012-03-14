;(function($, $$){
	
	$$.fn.collection({
		name: "each",
		impl: function(fn){
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
		name: "toArray",
		impl: function(){
			var array = [];
			
			for(var i = 0; i < this.size(); i++){
				array.push( this.eq(i).element() );
			}
			
			return array;
		}
	});
	
	$$.fn.collection({
		name: "slice",
		impl: function(start, end){
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
		name: "size",
		impl: function(){
			return this.length;
		}
	});
	
	$$.fn.collection({
		name: "eq",
		impl: function(i){
			return this[i];
		}
	});
	
	$$.fn.collection({
		name: "empty",
		impl: function(){
			return this.size() == 0;
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);

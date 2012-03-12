;(function($, $$){
	
	$$.fn.collection({
		name: ""
	});
	
	CyCollection.prototype.each = function(fn){
		for(var i = 0; i < this.size(); i++){
			if( $$.is.fn(fn) ){
				fn.apply( this.eq(i), [ i, this.eq(i) ] );
			}
		}
		return this;
	};
	
	
	CyCollection.prototype.toArray = function(){
		var array = [];
		
		for(var i = 0; i < this.size(); i++){
			array.push( this.eq(i) );
		}
		
		return array;
	};
	
	CyCollection.prototype.slice = function(start, end){
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
		
		return new CyCollection(this.cy(), array);
	};
	
	CyCollection.prototype.size = function(){
		return this.length;
	};
	
	CyCollection.prototype.eq = function(i){
		return this[i];
	};
	
	CyCollection.prototype.empty = function(){
		return this.size() == 0;
	};
	
})(jQuery, jQuery.cytoscapeweb);
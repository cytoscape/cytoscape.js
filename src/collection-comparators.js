;(function($, $$){

	$$.fn.collection({
		allAre: function(selector){
			return this.filter(selector).size() == this.size();
		},

		is: function(selector){
			return new $$.CySelector(this.cy(), selector).filter(this).size() > 0;
		},

		same: function( collection ){
			collection = this.cy().collection( collection );

			// cheap extra check
			if( this.size() != collection.size() ){
				return false;
			}

			return this.intersect( collection ).size() == this.size();
		},

		allSame: function( collection ){ // just an alias of same
			return this.same.apply( this, arguments );
		},

		anySame: function(collection){
			collection = this.cy().collection( collection );

			return this.intersect( collection ).size() > 0;
		},

		allAreNeighbors: function(collection){
			collection = this.cy().collection( collection );

			return this.neighborhood().intersect( collection ).size() == collection.size();
		},

		allAreNeighbours: function(){ // english spelling variant
			return this.allAreNeighbors.apply( this, arguments );
		}
	});


	
})(jQuery, jQuery.cytoscapeweb);

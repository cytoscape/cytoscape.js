;(function($, $$){

	$$.fn.collection({
		name: "allAre",
		impl: function(selector){
			return this.filter(selector).size() == this.size();
		}
	});
	
	$$.fn.collection({
		name: "is",
		impl: function(selector){
			return new $$.CySelector(this.cy(), selector).filter(this).size() > 0;
		}
	});

	$$.fn.collection({
		name: "same",
		impl: function( other ){
			return this.element() === other.element();
		}
	});
	
	$$.fn.collection({
		name: "anySame",
		impl: function(collection){
			collection = collection.collection();
			
			var ret = false;
			for(var i = 0; i < collection.size(); i++){
				var collectionElement = collection.eq(i).element();
				
				for(var j = 0; j < this.size(); j++){
					var thisElement = this.eq(j);
					
					ret = ret || thisElement.same(collectionElement);
					if(ret) break;
				}
				if(ret) break;
			}
			
			return ret;
		}
	});

	$$.fn.collection({
		name: "allSame",
		impl: function(collection){
			collection = collection.collection();
			
			// cheap check to make sure A.allSame(B) == B.allSame(A)
			if( collection.size() != this.size() ){
				return false;
			}
			
			var ret = true;
			for(var i = 0; i < collection.size(); i++){
				var collectionElement = collection.eq(i);
				
				var hasCollectionElement = false;
				for(var j = 0; j < this.size(); j++){
					var thisElement = this.eq(j);
					
					hasCollectionElement = thisElement.same(collectionElement);
					if(hasCollectionElement) break;
				}
				
				ret = ret && hasCollectionElement;
				if(!ret) break;
			}
			
			return ret;
		}
	});
	
	$$.fn.collection({
		name: "allAreNeighbors",
		impl: function(collection){
			collection = collection.collection();
			
			var neighborhood = this.neighborhood();
			for(var i = 0; i < collection.size(); i++){
				var element = collection.eq(i);
				
				if( element.intersect(neighborhood).size() == 0 ){
					return false;
				}
			}
			
			return true;
		}
	});
	$$.fn.collection({ // English spelling variant
		name: "allAreNeighbours",
		impl: function(){
			return this.allAreNeighbors.apply(this, [arguments]);
		}
	});


	
})(jQuery, jQuery.cytoscapeweb);

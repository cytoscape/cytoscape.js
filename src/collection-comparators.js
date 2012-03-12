CyCollection.prototype.allAre = function(selector){
		return this.filter(selector).size() == this.size();
	};
	
	CyCollection.prototype.is = function(selector){
		return this.filter(selector).size() > 0;
	};
	
	
	CyCollection.prototype.anySame = function(collection){
		collection = collection.collection();
		
		var ret = false;
		for(var i = 0; i < collection.size(); i++){
			var collectionElement = collection.eq(i);
			
			for(var j = 0; j < this.size(); j++){
				var thisElement = this.eq(j);
				
				ret = ret || thisElement.same(collectionElement);
				if(ret) break;
			}
			if(ret) break;
		}
		
		return ret;
	};
	
	CyCollection.prototype.allSame = function(collection){
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
	};
	
	
	CyElement.prototype.is = function(selector){
		return new $$.CySelector(this.cy(), selector).filter(this.collection()).size() > 0;
	};
	
	CyElement.prototype.allAre = function(selector){
		return this.is(selector);
	};
	
	CyElement.prototype.allAreNeighbours = CyElement.prototype.allAreNeighbors = function(collection){
		collection = collection.collection();
		var adjacents = this.neighborhood();
		
		if( this.isNode() ){
			var self = this;
			adjacents.edges().each(function(i, edge){
				if( edge._private.data.source == edge._private.data.target ){
					adjacents = adjacents.add(self);
				}
			});
		}
		
		var ret = true;
		
		for(var i = 0; i < collection.size(); i++){
			var element = collection[i];
			var inCollection = false;
			
			for(var j = 0; j < adjacents.size(); j++){
				var adjacent = adjacents[j];
				
				if( element == adjacent){
					inCollection = true;
					break;
				}
			}
			
			ret = ret && inCollection;
			if(ret == false){
				break;
			}
		}
		
		return ret;
	};
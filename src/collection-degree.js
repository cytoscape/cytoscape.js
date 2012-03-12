function degreeBoundsFunction(degreeFn, callback){
		return function(){
			var ret = null;
			var degrees = this[degreeFn]();
			this.each(function(i, ele){
				var degree = ele[degreeFn]();
				if( degree != null && (ret == null || callback(degree, ret)) ){
					ret = degree;
				}
			});
			return ret;
		};
	}
	
	CyCollection.prototype.minDegree = degreeBoundsFunction("degree", function(degree, min){
		return degree < min;
	});
	
	CyCollection.prototype.maxDegree = degreeBoundsFunction("degree", function(degree, max){
		return degree > max;
	});

	CyCollection.prototype.minIndegree = degreeBoundsFunction("indegree", function(indegree, min){
		return indegree < min;
	});
	
	CyCollection.prototype.maxIndegree = degreeBoundsFunction("indegree", function(indegree, max){
		return indegree > max;
	});
	
	CyCollection.prototype.minOutdegree = degreeBoundsFunction("outdegree", function(outdegree, min){
		return outdegree < min;
	});
	
	CyCollection.prototype.maxOutdegree = degreeBoundsFunction("outdegree", function(outdegree, max){
		return outdegree > max;
	});
	
	CyCollection.prototype.totalDegree = function(){
		var total = 0;
		
		this.each(function(i, ele){
			if( ele.isNode() ){
				total += ele.degree();
			}
		});

		return total;
	};
	
	
	function degreeFunction(callback){
		return function(){
			var structs = this.cy()._private; // TODO remove ref to `structs` after refactoring
			
			if( this._private.group == "nodes" && !this._private.removed ){
				var degree = 0;
				var edges = structs.nodeToEdges[this._private.data.id];
				var node = this;
				
				if( edges != null ){
					$.each(edges, function(i, edge){
						degree += callback(node, edge);
					});
				}
				
				return degree;
			} else {
				return undefined;
			}
		};
	}
	
	CyElement.prototype.degree = degreeFunction(function(node, edge){
		if( edge._private.data.source == edge._private.data.target ){
			return 2;
		} else {
			return 1;
		}
	});
	
	CyElement.prototype.indegree = degreeFunction(function(node, edge){
		if( node._private.data.id == edge._private.data.target ){
			return 1;
		} else {
			return 0;
		}
	});
	
	CyElement.prototype.outdegree = degreeFunction(function(node, edge){
		if( node._private.data.id == edge._private.data.source ){
			return 1;
		} else {
			return 0;
		}
	});
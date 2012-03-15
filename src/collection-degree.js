;(function($, $$){
	
	// Regular degree functions (works on single element)
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	function defineDegreeFunction(callback){
		return function(){
			var self = this.element();
			
			if( self.isNode() && !self.removed() ){
				var degree = 0;
				var node = this;
				
				node.connectedEdges().each(function(i, edge){
					degree += callback( node, edge );
				});
				
				return degree;
			} else {
				return undefined;
			}
		};
	}
	
	$$.fn.collection({
		degree: defineDegreeFunction(function(node, edge){
			if( edge.source().same( edge.target() ) ){
				return 2;
			} else {
				return 1;
			}
		})
	});
	
	$$.fn.collection({
		indegree: defineDegreeFunction(function(node, edge){
			if( edge.target().same(node) ){
				return 1;
			} else {
				return 0;
			}
		})
	});
	
	$$.fn.collection({
		outdegree: defineDegreeFunction(function(node, edge){
			if( edge.source().same(node) ){
				return 1;
			} else {
				return 0;
			}
		})
	});
	
	
	// Collection degree stats
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	function defineDegreeBoundsFunction(degreeFn, callback){
		return function(){
			var ret = null;
			
			this.nodes().each(function(i, ele){
				var degree = ele[degreeFn]();
				if( degree != null && (ret == null || callback(degree, ret)) ){
					ret = degree;
				}
			});
			
			return ret;
		};
	}
	
	$$.fn.collection({
		minDegree: defineDegreeBoundsFunction("degree", function(degree, min){
			return degree < min;
		})
	});
	
	$$.fn.collection({
		maxDegree: defineDegreeBoundsFunction("degree", function(degree, max){
			return degree > max;
		})
	});
	
	$$.fn.collection({
		minIndegree: defineDegreeBoundsFunction("indegree", function(degree, min){
			return degree < min;
		})
	});
	
	$$.fn.collection({
		maxIndegree: defineDegreeBoundsFunction("indegree", function(degree, max){
			return degree > max;
		})
	});
	
	$$.fn.collection({
		minOutdegree: defineDegreeBoundsFunction("outdegree", function(degree, min){
			return degree < min;
		})
	});
	
	$$.fn.collection({
		maxOutdegree: defineDegreeBoundsFunction("outdegree", function(degree, max){
			return degree > max;
		})
	});
	
	$$.fn.collection({
		totalDegree: function(){
			var total = 0;
			
			this.nodes().each(function(i, ele){
				total += ele.degree();
			});

			return total;
		}
	});
	
})(jQuery, jQuery.cytoscapeweb);

	
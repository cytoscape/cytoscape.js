;(function($, $$){
	
	// Regular degree functions (works on single element)
	////////////////////////////////////////////////////////////////////////////////////////////////////
	
	function defineDegreeFunction(callback){
		return function(){
			var self = this;
			
			if( self.length === 0 ){ return; }

			if( self.isNode() && !self.removed() ){
				var degree = 0;
				var node = self[0];
				var connectedEdges = node._private.edges;

				for( var i = 0; i < connectedEdges.length; i++ ){
					var edge = connectedEdges[i];
					degree += callback( node, edge );
				}
				
				return degree;
			} else {
				return;
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
			var ret = undefined;
			var nodes = this.nodes();

			for( var i = 0; i < nodes.length; i++ ){
				var ele = nodes[i];
				var degree = ele[degreeFn]();
				if( degree !== undefined && (ret === undefined || callback(degree, ret)) ){
					ret = degree;
				}
			}
			
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
			var nodes = this.nodes();

			for( var i = 0; i < nodes.length; i++ ){
				total += nodes[i].degree();
			}

			return total;
		}
	});
	
})(jQuery, jQuery.cytoscape);

	
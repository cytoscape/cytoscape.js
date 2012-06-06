;(function($, $$){

	$$.fn.collection({
		isNode: function(){
			return this.group() == "nodes";
		}
	});
	
	$$.fn.collection({
		isEdge: function(){
			return this.group() == "edges";
		}
	});

	$$.fn.collection({
		isLoop: function(){
			return this.isEdge() && this.source().id() == this.target().id();
		}
	});
	
	$$.fn.collection({
		group: function(){
			var ele = this.element();

			if( ele != null ){
				return ele._private.group;
			}
		}
	});

	
})(jQuery, jQuery.cytoscape);

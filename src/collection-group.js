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
		group: function(){
			return this.element()._private.group;
		}
	});

	
})(jQuery, jQuery.cytoscapeweb);

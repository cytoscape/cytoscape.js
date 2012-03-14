;(function($, $$){

	$$.fn.collection({
		name: "isNode",
		impl: function(){
			return this.group() == "nodes";
		}
	});
	
	$$.fn.collection({
		name: "isEdge",
		impl: function(){
			return this.group() == "edges";
		}
	});
	
	$$.fn.collection({
		name: "group",
		impl: function(){
			return this.element()._private.group;
		}
	});

	
})(jQuery, jQuery.cytoscapeweb);

(function($, $$){

	// TODO put default options here
	var defaults = {

	};

	function CanvasRenderer( options ){
		this.options = $.extend(true, {}, defaults, options);
	}

	CanvasRenderer.prototype.notify = function(params){
		
	};
	
	CanvasRenderer.prototype.zoom = function(params){
		
	};
	
	CanvasRenderer.prototype.fit = function(params){
		
	};
	
	CanvasRenderer.prototype.pan = function(params){
		
	};
	
	CanvasRenderer.prototype.panBy = function(params){
		
	};
	
	CanvasRenderer.prototype.showElements = function(element){
		
	};
	
	CanvasRenderer.prototype.hideElements = function(element){
		
	};
	
	CanvasRenderer.prototype.elementIsVisible = function(element){
		
	};
	
	CanvasRenderer.prototype.renderedDimensions = function(){
		
	};

	$$("renderer", "canvas", CanvasRenderer);

})( jQuery, jQuery.cytoscape );
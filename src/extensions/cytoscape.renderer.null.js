;(function($, $$){
		
	function NullRenderer(options){
	}
	
	NullRenderer.prototype.notify = function(params){
	};
	
	NullRenderer.prototype.zoom = function(params){
	};
	
	NullRenderer.prototype.fit = function(params){
	};
	
	NullRenderer.prototype.pan = function(params){
	};
	
	NullRenderer.prototype.panBy = function(params){
	};
	
	NullRenderer.prototype.showElements = function(element){
	};
	
	NullRenderer.prototype.hideElements = function(element){
	};
	
	NullRenderer.prototype.elementIsVisible = function(element){
		return element._private.visible;
	};
	
	NullRenderer.prototype.renderedDimensions = function(){
		return {};
	};

	NullRenderer.prototype.dimensions = function(){
		return {};
	};
	
	$$("renderer", "null", NullRenderer);
	
})(jQuery, jQuery.cytoscape);

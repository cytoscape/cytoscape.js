;(function($, $$){
		
	function NullRenderer(options){
		$.cytoscapeweb("debug", "Creating null renderer with options (%o)", options);
	}
	
	NullRenderer.prototype.notify = function(params){
		$.cytoscapeweb("debug", "Notify null renderer with params (%o)", params);
	};
	
	NullRenderer.prototype.zoom = function(params){
		$.cytoscapeweb("debug", "Zoom null renderer with params (%o)", params);
	};
	
	NullRenderer.prototype.fit = function(params){
		$.cytoscapeweb("debug", "Fit null renderer with params (%o)", params);
	};
	
	NullRenderer.prototype.pan = function(params){
		$.cytoscapeweb("debug", "Pan null renderer with params (%o)", params);
	};
	
	NullRenderer.prototype.panBy = function(params){
		$.cytoscapeweb("debug", "Relative pan null renderer with params (%o)", params);
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
	
	$.cytoscapeweb("renderer", "null", NullRenderer);
	
})(jQuery, jQuery.cytoscape);

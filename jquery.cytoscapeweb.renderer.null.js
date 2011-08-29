$(function(){
		
	function NullRenderer(options){
		$.cytoscapeweb("debug", "Creating null renderer with options (%o)", options);
	}
	
	NullRenderer.prototype.notify = function(params){
		$.cytoscapeweb("debug", "Notify null renderer with params (%o)", params);
	};
	
	NullRenderer.prototype.pan = function(params){
		$.cytoscapeweb("debug", "Pan null renderer with params (%o)", params);
	};
	
	NullRenderer.prototype.style = function(element){
		return {};
	};
	
	$.cytoscapeweb("renderer", "null", NullRenderer);
	
});
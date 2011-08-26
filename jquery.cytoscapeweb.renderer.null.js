$(function(){
		
	function NullRenderer(options){
		$.cytoscapeweb("log", "Creating null renderer with options (%o)", options);
	}
	
	NullRenderer.prototype.notify = function(params){
		$.cytoscapeweb("log", "Notify null renderer with params (%o)", params);
	};
	
	NullRenderer.prototype.pan = function(params){
		$.cytoscapeweb("log", "Pan null renderer with params (%o)", params);
	};
	
	$.cytoscapeweb("renderer", "null", NullRenderer);
	
});
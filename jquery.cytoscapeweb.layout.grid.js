$(function(){
	
	var defaults = {
		
	};
	
	function GridLayout(options){
		$.cytoscapeweb("debug", "Creating grid layout with options (%o)", options);
		
		this.options = $.extend({}, defaults, options);
	}
	
	GridLayout.prototype.run = function(params){
		var nodes = params.nodes;
		var edges = params.edges;
		var renderer = params.renderer;
		var options = this.options;
		var container = $(options.selector);
		
		$.cytoscapeweb("debug", "Running grid layout with options (%o)", params);
		
		var width = container.width();
		var height = container.height();
		
		if( height == 0 || width == 0){
			$.cytoscapeweb("warn", "Running grid layout on container of size 0");
			
			nodes.positions(function(){
				return { x: 0, y: 0 };
			});
			
			return;
		}
		
		// width/height * splits^2 = nodes.size() where splits is number of times to split width
		var splits = Math.sqrt( nodes.size() * height/width );
		var rows = Math.ceil( splits );
		var cols = Math.ceil( height/width * splits );
		
		var cellWidth = width / rows;
		var cellHeight = width / cols;
		
		var row = 0;
		var col = 0;
		nodes.positions(function(){
			
			var x = row * cellWidth + cellWidth/2;
			var y = col * cellHeight + cellHeight/2;
			
			row++;
			if( row > rows ){
				row = 0;
				col++;
			}
			
			return { x: x, y: y };
		});
	};
	
	$.cytoscapeweb("layout", "grid", GridLayout);
	
});
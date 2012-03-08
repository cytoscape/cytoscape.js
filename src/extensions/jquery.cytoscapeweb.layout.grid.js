$(function(){
	
	var defaults = {
		fit: true,
		rows: undefined,
		columns: undefined
	};
	
	function GridLayout(){
		$.cytoscapeweb("debug", "Creating grid layout");
	}
	
	GridLayout.prototype.run = function(params){
		var options = $.extend(true, {}, defaults, params);
		
		var cy = params.cy;
		var nodes = cy.nodes();
		var edges = cy.edges();
		var container = cy.container();
		
		$.cytoscapeweb("debug", "Running grid layout with options (%o)", options);
		
		var width = container.width();
		var height = container.height();

		$.cytoscapeweb("debug", "Running grid layout on container of size (w, h) = (%i, %i) with %i nodes", width, height, nodes.size());
		
		if( height == 0 || width == 0){
			$.cytoscapeweb("warn", "Running grid layout on container of size 0");
			
			nodes.positions(function(){
				return { x: 0, y: 0 };
			});
			
		} else {
			
			// width/height * splits^2 = cells where splits is number of times to split width
			var cells = nodes.size();
			var splits = Math.sqrt( cells * height/width );
			var rows = Math.round( splits );
			var cols = Math.round( width/height * splits );
			
			$.cytoscapeweb("debug", "Grid layout decided on initial (cols, rows) = (%i, %i)", cols, rows);
			
			function small(val){
				if( val == undefined ){
					return Math.min(rows, cols);
				} else {
					var min = Math.min(rows, cols);
					if( min == rows ){
						rows = val;
						$.cytoscapeweb("debug", "Grid layout set small number of rows to %i", rows);
					} else {
						cols = val;
						$.cytoscapeweb("debug", "Grid layout set small number of columns to %i", cols);
					}
				}
			}
			
			function large(val){
				if( val == undefined ){
					return Math.max(rows, cols);
				} else {
					var max = Math.max(rows, cols);
					if( max == rows ){
						rows = val;
						$.cytoscapeweb("debug", "Grid layout set large number of rows to %i", rows);
					} else {
						cols = val;
						$.cytoscapeweb("debug", "Grid layout set large number of columns to %i", cols);
					}
				}
			}
			
			// if rows or columns were set in options, use those values
			if( options.rows != null && options.columns != null ){
				rows = options.rows;
				cols = options.columns;
			} else if( options.rows != null && options.columns == null ){
				rows = options.rows;
				cols = Math.ceil( cells / rows );
			} else if( options.rows == null && options.columns != null ){
				cols = options.columns;
				rows = Math.ceil( cells / cols );
			}
			
			// otherwise use the automatic values and adjust accordingly
			
			// if rounding was up, see if we can reduce rows or columns
			else if( cols * rows > cells ){
				var sm = small();
				var lg = large();
				
				$.cytoscapeweb("debug", "Grid layout is looking to make a reduction");
				
				// reducing the small side takes away the most cells, so try it first
				if( (sm - 1) * lg >= cells ){
					small(sm - 1);
				} else if( (lg - 1) * sm >= cells ){
					large(lg - 1);
				} 
			} else {
				
				$.cytoscapeweb("debug", "Grid layout is looking to make an increase");
				
				// if rounding was too low, add rows or columns
				while( cols * rows < cells ){
					var sm = small();
					var lg = large();
					
					// try to add to larger side first (adds less in multiplication)
					if( (lg + 1) * sm >= cells ){
						large(lg + 1);
					} else {
						small(sm + 1);
					}
				}
			}
			
			$.cytoscapeweb("debug", "Grid layout split area into cells (cols, rows) = (%i, %i)", cols, rows);
			
			var cellWidth = width / cols;
			var cellHeight = height / rows;
			
			var row = 0;
			var col = 0;
			nodes.positions(function(i, element){
				
				if( element.locked() ){
					return false;
				}
				
				var x = col * cellWidth + cellWidth/2;
				var y = row * cellHeight + cellHeight/2;
				
				col++;
				if( col >= cols ){
					col = 0;
					row++;
				}
				
				return { x: x, y: y };
				
			});
		}
		
		if( options.fit ){
			cy.reset();
		} 
		
		function exec(fn){
			if( fn != null && typeof fn == typeof function(){} ){
				fn();
			}
		}
		
		cy.trigger("layoutready");
		exec( params.ready );
		
		cy.trigger("layoutstop");
		exec( params.stop );
	};
	
	$.cytoscapeweb("layout", "grid", GridLayout);
	
});
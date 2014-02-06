;(function($$){ "use strict";

	var CanvasRenderer = $$('renderer', 'canvas');

// @O Polygon drawing
	CanvasRenderer.prototype.drawPolygonPath = function(
		context, x, y, width, height, points) {

		//context.save();
		

		context.translate(x, y);
		context.scale(width / 2, height / 2);

		context.beginPath();

		context.moveTo(points[0], points[1]);

		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		
		context.scale(2/width, 2/height);
		context.translate(-x, -y);
		// context.restore();
	}
	
	CanvasRenderer.prototype.drawPolygon = function(
		context, x, y, width, height, points) {

		// Draw path
		this.drawPolygonPath(context, x, y, width, height, points);
		
		// Fill path
		context.fill();
	}
	
	// Round rectangle drawing
	CanvasRenderer.prototype.drawRoundRectanglePath = function(
		context, x, y, width, height, radius) {
		
		var halfWidth = width / 2;
		var halfHeight = height / 2;
		var cornerRadius = $$.math.getRoundRectangleRadius(width, height);
		context.translate(x, y);
		
		context.beginPath();
		
		// Start at top middle
		context.moveTo(0, -halfHeight);
		// Arc from middle top to right side
		context.arcTo(halfWidth, -halfHeight, halfWidth, 0, cornerRadius);
		// Arc from right side to bottom
		context.arcTo(halfWidth, halfHeight, 0, halfHeight, cornerRadius);
		// Arc from bottom to left side
		context.arcTo(-halfWidth, halfHeight, -halfWidth, 0, cornerRadius);
		// Arc from left side to topBorder
		context.arcTo(-halfWidth, -halfHeight, 0, -halfHeight, cornerRadius);
		// Join line
		context.lineTo(0, -halfHeight);
		
		/*
		void arc(unrestricted double x, 
				 unrestricted double y, 
				 unrestricted double radius, 
				 unrestricted double startAngle, 
				 unrestricted double endAngle, 
				 optional boolean anticlockwise = false);
		*/
		/*
		context.arc(-width / 2 + cornerRadius,
					-height / 2 + cornerRadius,
					cornerRadius,
					0,
					Math.PI * 2 * 0.999);
		*/
		
		context.closePath();
		
		context.translate(-x, -y);
	}
	
	CanvasRenderer.prototype.drawRoundRectangle = function(
		context, x, y, width, height, radius) {
		
		this.drawRoundRectanglePath(context, x, y, width, height, radius);
		
		context.fill();
	}


})( cytoscape );

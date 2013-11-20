/*
  The canvas renderer was written by Yue Dong.

  Modifications tracked on Github.
*/

(function($$) {

	function CanvasRenderer(options) {
		
		CanvasRenderer.CANVAS_LAYERS = 5;
		CanvasRenderer.SELECT_BOX = 0;
		CanvasRenderer.DRAG = 2;
		CanvasRenderer.OVERLAY = 3;
		CanvasRenderer.NODE = 4;
		CanvasRenderer.BUFFER_COUNT = 2;

		this.options = options;

		this.data = {
				
			select: [undefined, undefined, undefined, undefined, 0], // Coordinates for selection box, plus enabled flag 
			renderer: this, cy: options.cy, container: options.cy.container(),
			
			canvases: new Array(CanvasRenderer.CANVAS_LAYERS),
			canvasRedrawReason: new Array(CanvasRenderer.CANVAS_LAYERS),
			canvasNeedsRedraw: new Array(CanvasRenderer.CANVAS_LAYERS),
			
			bufferCanvases: new Array(CanvasRenderer.BUFFER_COUNT)

		};
		
		//--Pointer-related data
		this.hoverData = {down: null, last: null, 
				downTime: null, triggerMode: null, 
				dragging: false, 
				initialPan: [null, null], capture: false};
		
		this.timeoutData = {panTimeout: null};
		
		this.dragData = {possibleDragElements: []};
		
		this.touchData = {start: null, capture: false,
				// These 3 fields related to tap, taphold events
				startPosition: [null, null, null, null, null, null],
				singleTouchStartTime: null,
				singleTouchMoved: true,
				
				
				now: [null, null, null, null, null, null], 
				earlier: [null, null, null, null, null, null] };
		//--
		
		//--Wheel-related data 
		this.zoomData = {freeToZoom: false, lastPointerX: null};
		//--
		
		this.redraws = 0;

		this.bindings = [];
		
		for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {
			this.data.canvases[i] = document.createElement("canvas");
			this.data.canvases[i].style.position = "absolute";
			this.data.canvases[i].setAttribute("data-id", "layer" + i);
			this.data.canvases[i].style.zIndex = String(CanvasRenderer.CANVAS_LAYERS - i);
			this.data.container.appendChild(this.data.canvases[i]);
			
			this.data.canvasRedrawReason[i] = new Array();
			this.data.canvasNeedsRedraw[i] = false;
		}

		this.data.canvases[CanvasRenderer.NODE].setAttribute("data-id", "layer" + CanvasRenderer.NODE + '-node');
		this.data.canvases[CanvasRenderer.SELECT_BOX].setAttribute("data-id", "layer" + CanvasRenderer.SELECT_BOX + '-selectbox');
		this.data.canvases[CanvasRenderer.DRAG].setAttribute("data-id", "layer" + CanvasRenderer.DRAG + '-drag');
		this.data.canvases[CanvasRenderer.OVERLAY].setAttribute("data-id", "layer" + CanvasRenderer.OVERLAY + '-overlay');
		
		for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
			this.data.bufferCanvases[i] = document.createElement("canvas");
			this.data.bufferCanvases[i].style.position = "absolute";
			this.data.bufferCanvases[i].setAttribute("data-id", "buffer" + i);
			this.data.bufferCanvases[i].style.zIndex = String(-i - 1);
			this.data.bufferCanvases[i].style.visibility = "hidden";
			this.data.container.appendChild(this.data.bufferCanvases[i]);
		}

		var overlay = document.createElement('div');
		this.data.container.appendChild( overlay );
		this.data.overlay = overlay;
		overlay.style.position = 'absolute';
		overlay.style.zIndex = 1000;

		if( options.showOverlay ){

			var link = document.createElement('a');
			overlay.appendChild( link );
			this.data.link = link;

			link.innerHTML = 'cytoscape.js';
			link.style.font = '14px helvetica';
			link.style.position = 'absolute';
			link.style.right = 0;
			link.style.bottom = 0;
			link.style.padding = '1px 3px';
			link.style.paddingLeft = '5px';
			link.style.paddingTop = '5px';
			link.style.opacity = 0;
			link.style['-webkit-tap-highlight-color'] = 'transparent';
			link.style.background = 'red';

			link.href = 'http://cytoscape.github.io/cytoscape.js/';
			link.target = '_blank';

		}

		this.hideEdgesOnViewport = options.hideEdgesOnViewport;

		this.load();
	}

	CanvasRenderer.panOrBoxSelectDelay = 400;
	CanvasRenderer.isTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;

	CanvasRenderer.prototype.notify = function(params) {
		if ( params.type == "destroy" ){
			this.destroy();
			return;

		} else if (params.type == "add"
			|| params.type == "remove"
			|| params.type == "load"
		) {
			
			this.updateNodesCache();
			this.updateEdgesCache();
		}

		if (params.type == "viewport") {
			this.data.canvasNeedsRedraw[CanvasRenderer.SELECT_BOX] = true;
			this.data.canvasRedrawReason[CanvasRenderer.SELECT_BOX].push("viewchange");
		}
		
		this.data.canvasNeedsRedraw[CanvasRenderer.DRAG] = true; this.data.canvasRedrawReason[CanvasRenderer.DRAG].push("notify");
		this.data.canvasNeedsRedraw[CanvasRenderer.NODE] = true; this.data.canvasRedrawReason[CanvasRenderer.NODE].push("notify");

		this.redraws++;
		this.redraw();
	};

	CanvasRenderer.prototype.registerBinding = function(target, event, handler, useCapture){
		this.bindings.push({
			target: target,
			event: event,
			handler: handler,
			useCapture: useCapture
		});

		target.addEventListener(event, handler, useCapture);
	};

	CanvasRenderer.prototype.destroy = function(){
		this.destroyed = true;

		for( var i = 0; i < this.bindings.length; i++ ){
			var binding = this.bindings[i];
			var b = binding;

			b.target.removeEventListener(b.event, b.handler, b.useCapture);
		}
	};
	



	
	// @O Drawing functions
	{
	
	// Resize canvas
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var data = this.data; var width = container.clientWidth; var height = container.clientHeight;
		
		var canvas, canvasWidth = width, canvasHeight = height;

		if ('devicePixelRatio' in window) {
			canvasWidth *= devicePixelRatio;
			canvasHeight *= devicePixelRatio;
		}

		for (var i = 0; i < CanvasRenderer.CANVAS_LAYERS; i++) {

			canvas = data.canvases[i];
			
			if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
				
				canvas.width = canvasWidth;
				canvas.height = canvasHeight;

				canvas.style.width = width + 'px';
				canvas.style.height = height + 'px';
			}
		}
		
		for (var i = 0; i < CanvasRenderer.BUFFER_COUNT; i++) {
			
			canvas = data.bufferCanvases[i];
			
			if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
				
				canvas.width = canvasWidth;
				canvas.height = canvasHeight;
			}
		}

		this.data.overlay.style.width = width + 'px';
		this.data.overlay.style.height = height + 'px';
	}


	CanvasRenderer.prototype.createBuffer = function(w, h) {
		var buffer = document.createElement("canvas");
		buffer.width = w;
		buffer.height = h;
		
		return [buffer, buffer.getContext("2d")];
	}
	

	CanvasRenderer.prototype.drawBackground = function(context, color1, color2, 
			startPosition, endPosition) {
	
		
	}


	// @O Graph traversal functions
	{
	
	// Find adjacent edges
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = this.getCachedEdges();
		
		var hashTable = {};
		var adjacentEdges = [];
		
		for (var i = 0; i < nodeSet.length; i++) {
			hashTable[nodeSet[i]._private.data.id] = nodeSet[i];
		}
		
		for (var i = 0; i < edges.length; i++) {
			if (hashTable[edges[i]._private.data.source]
				|| hashTable[edges[i]._private.data.target]) {
				
				adjacentEdges.push(edges[i]);
			}
		}
		
		return adjacentEdges;
	}
	
	}
	
	// @O Arrow shapes
	{
	
	
	
	// @O Arrow shape sizing (w + l)
	{
	
	CanvasRenderer.prototype.getArrowWidth = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	CanvasRenderer.prototype.getArrowHeight = function(edgeWidth) {
		return Math.max(Math.pow(edgeWidth * 13.37, 0.9), 29);
	}
	
	}
	
	// @O Arrow shape drawing
	
	// Draw arrowheads on edge
	CanvasRenderer.prototype.drawArrowheads = function(context, edge, drawOverlayInstead) {
		if( drawOverlayInstead ){ return; } // don't do anything for overlays 

		// Displacement gives direction for arrowhead orientation
		var dispX, dispY;

		var startX = edge._private.rscratch.arrowStartX;
		var startY = edge._private.rscratch.arrowStartY;
		
		dispX = startX - edge.source().position().x;
		dispY = startY - edge.source().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["source-arrow-color"].value[0] + ","
			+ edge._private.style["source-arrow-color"].value[1] + ","
			+ edge._private.style["source-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["source-arrow-shape"].value, 
			startX, startY, dispX, dispY);
		
		var endX = edge._private.rscratch.arrowEndX;
		var endY = edge._private.rscratch.arrowEndY;
		
		dispX = endX - edge.target().position().x;
		dispY = endY - edge.target().position().y;
		
		//this.context.strokeStyle = "rgba("
		context.fillStyle = "rgba("
			+ edge._private.style["target-arrow-color"].value[0] + ","
			+ edge._private.style["target-arrow-color"].value[1] + ","
			+ edge._private.style["target-arrow-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.drawArrowShape(context, edge._private.style["target-arrow-shape"].value,
			endX, endY, dispX, dispY);
	}
	
	// Draw arrowshape
	CanvasRenderer.prototype.drawArrowShape = function(context, shape, x, y, dispX, dispY) {
	
		// Negative of the angle
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
	
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		//context.save();
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = this.getArrowWidth(context.lineWidth);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		CanvasRenderer.arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();

		context.scale(1/size, 1/size);
		context.rotate(angle);
		context.translate(-x, -y);
		//context.restore();
	}

	}
	
	
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

	
	}

	// copy the math functions into the renderer prototype
	// unfortunately these functions are used interspersed t/o the code
	// and this makes sure things work just in case a ref was missed in refactoring
	// TODO remove this eventually
	for( var fnName in $$.math ){
		CanvasRenderer.prototype[ fnName ] = $$.math[ fnName ];
	}
	
	
	var debug = function(){};
	$$("renderer", "canvas", CanvasRenderer);
	
})( cytoscape );

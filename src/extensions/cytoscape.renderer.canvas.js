(function($, $$){

	// TODO put default options here
	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true,
		
		defaultNodeStyle: {
			shape: "ellipse",
			height: 10,
			width: 10,
			selected: false
		},
		
		defaultEdgeStyle: {
		}
	};
	
	function CanvasRenderer(options) {
		this.options = $.extend(true, {}, defaults, options);
		this.cy = options.cy;
		
		this.init();
	}

	CanvasRenderer.prototype.notify = function(params) {
		console.log("notify call: " + params);
		console.log(params);
		
		switch (params.type) {
			case "load":
				break;
			case "draw":
				console.log("draw call");
				break;
			default:
				console.log("event: " + params.type);
		}
		
		this.redraw();
	};
	
	CanvasRenderer.prototype.init = function() {
		this.initStyle();
		
		var container = this.options.cy.container();
		var canvas2d = document.createElement("canvas");
		canvas2d.width = container.width();
		canvas2d.height = container.height();
		
		this.canvas = canvas2d;
		this.context = canvas2d.getContext("2d");
		
		container.append(canvas2d);

		this.center = [container.width() / 2, container.height() / 2];
		this.scale = [1, 1];
		this.zoomCenter = [container.width() / 2, container.height() / 2];
		
		var startX, startY;
		var initialCenter;
		
		$(window).bind("mousedown", function(mouseDownEvent) {
			if (mouseDownEvent.button != 0) {
				return;
			}
			
			if (mouseDownEvent.target != canvas2d) {
				return;
			}
			
			startX = mouseDownEvent.clientX;
			startY = mouseDownEvent.clientY;
			initialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			//console.log("mouse down");
			$(window).bind("mousemove", dragHandler);
			
			console.log(mouseDownEvent);
		});
		
		var dragHandler = function(mouseMoveEvent) {
			//console.log("mouseDrag");
			//console.log(mouseMoveEvent);
			//console.log("start: (" + startX + ", " + startY + ")");
			
			var offsetX = mouseMoveEvent.clientX - startX;
			var offsetY = mouseMoveEvent.clientY - startY;
			
			cy.renderer().center[0] = initialCenter[0] - offsetX / cy.renderer().scale[0];
			cy.renderer().center[1] = initialCenter[1] - offsetY / cy.renderer().scale[1];	
			cy.renderer().redraw();
		};
		
		$(window).bind("mouseup", function(mouseUpEvent) {
			/*
			console.log("mouse up");
			console.log(mouseUpEvent);
			*/
			$(window).unbind("mousemove", dragHandler);
		});
		
		$(window).bind("mousewheel", function(event, delta, deltaX, deltaY){
			
			/*
			console.log("mousewheel");
			console.log(event);
			console.log(delta);
			console.log(deltaX);
			console.log(deltaY);
			*/
			
			// self.zoomAboutPoint(point, zoom);
			/*
			self.cy.trigger("zoom");
			self.cy.trigger("pan");
			*/
		});
	}

	CanvasRenderer.prototype.distanceToQuadraticBezier = function(x, y, 
		x1, y1, x2, y2, x3, y3) {
		
		// Calculate coefficients of derivative of square distance function
		
		// The plan is to find the minima of the distance function.
		
		
		// Note this gives actual coefficients divided by 4 for simplification,
		// and we don't need the 4 as equation is 0 on right side
		var a = x1*x1 - 4*x1*x2 + 2*x1*x3 + 4*x2*x2 - 4*x2*x3 + x3*x3
			+ y1*y1 - 4*y1*y2 + 2*y1*y3 + 4*y2*y2 - 4*y2*y3 + y3*y3;
		
		var b = 9*x1*x2 - 3*x1*x1 - 3*x1*x3 - 6*x2*x2 + 3*x2*x3
			+ 9*y1*y2 - 3*y1*y1 - 3*y1*y3 - 6*y2*y2 + 3*y2*y3;
		
		var c = 3*x1*x1 - 6*x1*x2 + x1*x3 - x1*x + 2*x2*y2 + 2*x2*x - x3*x
			+ 3*y1*y1 - 6*y1*y2 + y1*y3 - y1*y + 2*y2*y2 + 2*y2*y - y3*y;
			
		var d = x1*x2 - x1*x1 + x1*x - x2*x
			+ y1*y2 - y1*y1 + y1*y - y2*y;
		
		var root1, root2, root3;
		
		var zeroThreshold = 0.0000000001;
		
		var qArgument, qRealComponent, qImaginaryComponent;
		var bSquareMinus3ac = b * b - 3 * a * c;
		qArgument = Math.pow(2 * Math.pow(b, 3) - 9 * a * b * c + 27 * a * a * d)
				- 4 * Math.pow(bSquareMinus3ac, 3);
			
		if (qArgument < 0) {
			qImaginaryComponent = 0;
			qRealComponent = Math.sqrt(-qArgument);
		} else {
			qImaginaryComponent = Math.sqrt(qArgument);
			qRealComponent = 0;
		}
		
		var cArgumentReal, cArgumentImaginary, cRealComponent, cImaginaryComponent;
		cArgumentReal = 2 * Math.pow(b, 3) - 9 * a * b * c + 27 * a * a * d;
		cArgumentReal += qRealComponent;
		cArgumentImaginary += qImaginaryComponent;
		
		
		
		if (Math.abs(bSquareMinus3ac) < zeroThreshold) {
			
		} else {
			
			
			// cArgument = 
		}
		
		// Calculate the discriminant of the cubic
		var discriminant = 18 * a * b * c * d
			- 4 * Math.pow(b, 3) * d
			+ b * b * c * c - 4 * a * Math.pow(c, 3)
			- 27 * a * a * d * d;

		if (discriminant < 0) {
			// In this case, only 1 real root
			
					
		}
		
		// var root1 = 
	}

	CanvasRenderer.prototype.initStyle = function() {
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var node;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			node._private.style = defaults.defaultNodeStyle;
			
			node.boundingRadiusSquared = 6;
		}
		
		var edge;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			edge._private.style = defaults.defaultEdgeStyle;
		}
	}
	
	CanvasRenderer.prototype.redraw = function() {
		var context = this.context;
		
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, this.options.cy.container().width(),
			this.options.cy.container().height());
		
		context.translate(this.zoomCenter[0], 
			this.zoomCenter[1]);
		
		context.scale(this.scale[0], this.scale[1])
		context.translate(-this.center[0], -this.center[1])
		
		/*
		context.transform(this.transform[0], this.transform[1], this.transform[2],
			this.transform[3], this.transform[4] * this.transform[0], 
			this.transform[5] * this.transform[3]);
		*/
		
		//console.log("draw called");
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var edge;
		
		context.strokeStyle = "#CDCDCD";
		
		var startNode, endNode;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			startNode = edge.source()[0];
			endNode = edge.target()[0];
			
			context.lineWidth = edge._private.data.weight / 16.0;
			context.beginPath();
			
			context.moveTo(startNode._private.position.x, startNode._private.position.y);
			
			context.quadraticCurveTo(startNode._private.position.x * 2 / 3, 
				endNode._private.position.y, endNode._private.position.x, 
				endNode._private.position.y);
			
			//context.lineTo(endNode._private.position.x, endNode._private.position.y);
			
			context.stroke();
		}
		
		var node;
		context.fillStyle = "#AAAAAA";
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			context.beginPath();
			context.arc(node._private.position.x, node._private.position.y,
				node._private.data.weight / 5.0, 0, Math.PI * 2, false);
			context.closePath();
			context.fill();
		}
	};
	
	CanvasRenderer.prototype.zoom = function(params){
		// console.log(params);
		if (params != undefined && params.level != undefined) {
		
			this.scale[0] = params.level;
			this.scale[1] = params.level;
			
			/*
			this.transform[4] = this.transform[4] - 300 * params.level;
			this.transform[5] = this.transform[5] - 300 * params.level;
			*/
		}
		
		this.redraw();
	};
	
	CanvasRenderer.prototype.fit = function(params){
	
	};
	
	CanvasRenderer.prototype.pan = function(params){
		//console.log("pan called:");
		//console.log(params);
		
		if (this.context != undefined) {
			
		}
	};
	
	CanvasRenderer.prototype.panBy = function(params){
		// this.transform[4] += params.x;
		// this.transform[5] += params.y;
		
		this.center[0] -= params.x;
		this.center[1] -= params.y;
		
		this.redraw();
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
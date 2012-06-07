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
			width: 10
		},
		
		defaultEdgeStyle: {
		}
	};
	
	function CanvasRenderer(options) {
		this.options = $.extend(true, {}, defaults, options);
		this.cy = options.cy;
		
		this.initStyle();
		this.transform = [1, 0, 0, 1, 0, 0];
		
		var container = this.options.cy.container();
		var canvas2d = document.createElement("canvas");
		canvas2d.width = container.width();
		canvas2d.height = container.height();
		
		this.context = canvas2d.getContext("2d");
		
		container.append(canvas2d);
	}

	CanvasRenderer.prototype.notify = function(params) {
		// console.log("notify call: " + params);
		// console.log(params);
		
		switch (params.type) {
			case "load":
				break;
			case "draw":
				console.log("draw call");
			default:
				console.log("event: " + params.type);
		}
		
		this.redraw();
	};

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
		context.setTransform(this.transform[0], this.transform[1], this.transform[2],
			this.transform[3], this.transform[4], this.transform[5]);

		
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
		if (params != undefined) {
			this.transform[0] = params.level;
			this.transform[3] = params.level;
			
			/*
			this.transform[4] -= params.level;
			this.transform[5] -= params.level;
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
		this.transform[4] += params.x;
		this.transform[5] += params.y;
		
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
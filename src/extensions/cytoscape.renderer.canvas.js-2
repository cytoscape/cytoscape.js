(function($$){

	var arrowShapes = {};
	var nodeShapes = {};
	var currentShape = "";
	
	function CanvasRenderer(options) {
	
		this.data = {select: [0, 0, 0, 0, 0], minDistanceNode: null, minDistanceEdge: null, renderer: this, cy: options.cy, container: options.cy.container(),
			curTouch: [null, null, null, null, 0], prevTouch: [null, null, null, null, 0], mouseX: [undefined, undefined],
			canvases: [null, null, null, null, null, false, false, false, false, false], banvases: [null, null], };
		
		this.init();
	
		for (var i = 0; i < 5; i++) { this.data.canvases[i] = document.createElement("canvas"); this.data.canvases[i].position = "absolute"; this.data.canvases[i].id = "layer" + i; this.data.canvases[i].style.zIndex = String(-i); this.data.canvases[i].style.visibility = "hidden";  this.data.container.appendChild(this.rendererData.canvases[i]); }
		for (var i = 0; i < 2; i++) { this.data.banvases[i] = document.createElement("canvas"); this.data.canvases[i].position = "absolute"; this.data.canvases[i].id = "buffr" + i; this.data.canvases[i].style.zIndex = String(-i); this.data.canvases[i].style.visibility = "visible"; this.data.container.appendChild(this.rendererData.canvases[i]); }
	}

	CanvasRenderer.prototype.notify = function(params) { this.data.canvasNeedsRedraw[2] = true; this.data.redrawReason[2].push("Load"); this.data.canvasNeedsRedraw[4] = true; this.data.redrawReason[4].push("Load"); this.redraw(); };
	
	CanvasRenderer.prototype.projectMouse = function(mouseEvent) {
		
		var x, y; var offsetLeft = 0; var offsetTop = 0; var n; n = this.rendererData.cy.container();
		
		while (n != null) {
			if (typeof(n.offsetLeft) == "number") {offsetLeft += n.offsetLeft; offsetTop += n.offsetTop;} n = n.parentNode;
		}
		
		x = mouseEvent.pageX - offsetLeft; y = mouseEvent.pageY - offsetTop; x -= this.rendererData.cy.pan().x; y -= this.rendererData.cy.pan().y; x /= this.rendererData.cy.zoom(); y /= this.rendererData.cy.zoom();
		return [x, y];
	}
	
	CanvasRenderer.prototype.mouseDown = function(r, e) {
		var cy = r.data.cy; var pos = r.projectMouse(e); var select = r.data.select;
		
		// Drag select
		r.data.select[0] = pos[0]; r.data.select[1] = pos[1]; r.data.select[4] = 1;
	}
	
	CanvasRenderer.prototype.mouseMove = function(r, e) {
		var cy = r.data.cy; var pos = r.projectMouse(e); var select = r.data.select;
		
		// Drag select
		r.data.select[2] = pos[0]; r.data.select[3] = pos[1];
	}
	
	CanvasRenderer.prototype.mouseUp = function(r, e) {
		var cy = r.data.cy; var pos = r.projectMouse(e); var select = r.data.select;
		
		r.datat.select[4] = 0;
	}
	
	CanvasRenderer.prototype.load = function() {};
	
	CanvasRenderer.prototype.init = function() {};
	
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var width = container.clientWidth;
		var height = container.clientHeight;
		
		var canvas;
		for (var i = 0; i < this.canvases.length + this.bufferCanvases.length; i++) {
			
			if (i < this.canvases.length) {
				canvas = this.canvases[i];
			} else {
				canvas = this.bufferCanvases[i - this.canvases.length];
			}
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
			
			}
		}
	}
	
	CanvasRenderer.prototype.redraw = function(singleRedraw) {
		
		var cy = this.data.cy; var data = this.data; var nodes = cy.nodes(); var edges = cy.edges();
		
		renderer.matchCanvasSize(data.container);
		
		var elements = cy.elements().toArray();
		var elementsLayer2 = [];
		var elementsLayer4 = [];
		
		if (this.canvasNeedsRedraw[2] || this.canvasNeedsRedraw[4]) {
		
			this.findEdgeControlPoints(edges);
			
			elements.sort(function(a, b) {
				var result = a._private.style["z-index"].value
					- b._private.style["z-index"].value;
				
				if (result == 0) {
					if (a._private.group == "nodes"
						&& b._private.group == "edges") {
						
						return 1;
					} else if (a._private.group == "edges"
						&& b._private.group == "nodes") {
						
						return -1;
					}
				}
				
				return 0;
			});
		}
		
		if (this.canvasNeedsRedraw[2]) {
			var context = data.canvases[2].getContext("2d");
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(cy.pan().x, cy.pan().y);
			context.scale(cy.zoom(), cy.zoom());
			
			var element;

			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[2] = false;
			this.redrawReason[2] = [];
		}
		
		if (this.canvasNeedsRedraw[4]) {
			var context = data.canvases[4].getContext("2d");

			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());
		
			var element;
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(element);
					} else if (element._private.group == "edges") {
						this.drawEdge(element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(element);
					}
				}
			}
			
			this.canvasNeedsRedraw[4] = false;
			this.redrawReason[4] = [];
		}
		
		if (this.canvasNeedsRedraw[0]) {
			var context = data.canvases[0].getContext("2d");
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		
			context.translate(this.cy.pan().x, this.cy.pan().y);
			context.scale(this.cy.zoom(), this.cy.zoom());			
			
			if (daat.select[4] == 1) {
				var coreStyle = cy.style()._private.coreStyle;
				var borderWidth = coreStyle["selection-box-border-width"].value
					/ this.cy.zoom();
				
				context.lineWidth = borderWidth;
				context.fillStyle = "rgba(" 
					+ coreStyle["selection-box-color"].value[0] + ","
					+ coreStyle["selection-box-color"].value[1] + ","
					+ coreStyle["selection-box-color"].value[2] + ","
					+ coreStyle["selection-box-opacity"].value + ")";
				
				context.fillRect(
					selectBox[0],
					selectBox[1],
					selectBox[2] - selectBox[0],
					selectBox[3] - selectBox[1]);
				
				if (borderWidth > 0) {
					context.strokeStyle = "rgba(" 
						+ coreStyle["selection-box-border-color"].value[0] + ","
						+ coreStyle["selection-box-border-color"].value[1] + ","
						+ coreStyle["selection-box-border-color"].value[2] + ","
						+ coreStyle["selection-box-opacity"].value + ")";
					
					context.strokeRect(
						selectBox[0],
						selectBox[1],
						selectBox[2] - selectBox[0],
						selectBox[3] - selectBox[1]);
				}
				
//				console.log(selectBox);
			}
			
			this.canvasNeedsRedraw[0] = false;
			this.redrawReason[0] = [];
		}
		
		// Rasterize the layers
		this.bufferCanvasContexts[1].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[1].drawImage(this.canvases[4], 0, 0);
		this.bufferCanvasContexts[1].globalCompositeOperation = "source-over";
		this.bufferCanvasContexts[1].drawImage(this.canvases[2], 0, 0);
		this.bufferCanvasContexts[1].drawImage(this.canvases[0], 0, 0);

		this.bufferCanvasContexts[0].globalCompositeOperation = "copy";
		this.bufferCanvasContexts[0].drawImage(this.bufferCanvases[1], 0, 0);
	};
	
	CanvasRenderer.prototype.drawEdge = function(context, edge) {
	
		var startNode, endNode;

		startNode = edge.source()[0];
		endNode = edge.target()[0];
		
		if (edge._private.style["visibility"].value != "visible"
			|| startNode._private.style["visibility"].value != "visible"
			|| endNode._private.style["visibility"].value != "visible") {
			return;
		}
		
		// Edge color & opacity
		context.strokeStyle = "rgba(" 
			+ edge._private.style["line-color"].value[0] + ","
			+ edge._private.style["line-color"].value[1] + ","
			+ edge._private.style["line-color"].value[2] + ","
			+ edge._private.style.opacity.value + ")";
		
		// Edge line width
		if (edge._private.style["width"].value <= 0) {
			return;
		}
		
		context.lineWidth = edge._private.style["width"].value;
		
		this.findEndpoints(edge);
		
		if (edge._private.rscratch.isSelfEdge) {
		
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY)
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2ax,
				edge._private.rscratch.cp2ay,
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.moveTo(
				edge._private.rscratch.selfEdgeMidX,
				edge._private.rscratch.selfEdgeMidY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2cx,
				edge._private.rscratch.cp2cy,
				edge._private.rscratch.endX,
				edge._private.rscratch.endY);
			
			context.stroke();
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			// Check if the edge is inverted due to close node proximity
			var nodeDirectionX = endNode._private.position.x - startNode._private.position.x;
			var nodeDirectionY = endNode._private.position.y - startNode._private.position.y;
			
			var edgeDirectionX = edge._private.rscratch.endX - edge._private.rscratch.startX;
			var edgeDirectionY = edge._private.rscratch.endY - edge._private.rscratch.startY;
			
			if (nodeDirectionX * edgeDirectionX
				+ nodeDirectionY * edgeDirectionY < 0) {
				
				edge._private.rscratch.straightEdgeTooShort = true;	
			} else {			
				context.beginPath();
				context.moveTo(
					edge._private.rscratch.startX,
					edge._private.rscratch.startY);
	
				context.lineTo(edge._private.rscratch.endX, 
					edge._private.rscratch.endY);
				context.stroke();
				
				edge._private.rscratch.straightEdgeTooShort = false;	
			}	
		} else {
			
			context.beginPath();
			context.moveTo(
				edge._private.rscratch.startX,
				edge._private.rscratch.startY);
			
			context.quadraticCurveTo(
				edge._private.rscratch.cp2x, 
				edge._private.rscratch.cp2y, 
				edge._private.rscratch.endX, 
				edge._private.rscratch.endY);
			context.stroke();
			
		}
		
		if (edge._private.rscratch.noArrowPlacement !== true
				&& edge._private.rscratch.startX !== undefined) {
			this.drawArrowheads(edge);
		}
	}
	
	CanvasRenderer.prototype.drawEdgeText = function(context, edge) {
	
		if (edge._private.style["visibility"].value != "visible") {
			return;
		}
	
		// Calculate text draw position
		
		context.textAlign = "center";
		context.textBaseline = "middle";
		
		var textX, textY;	
		var edgeCenterX, edgeCenterY;
		
		if (edge._private.rscratch.isSelfEdge) {
			edgeCenterX = edge._private.rscratch.selfEdgeMidX;
			edgeCenterY = edge._private.rscratch.selfEdgeMidY;
		} else if (edge._private.rscratch.isStraightEdge) {
			edgeCenterX = (edge._private.rscratch.startX
				+ edge._private.rscratch.endX) / 2;
			edgeCenterY = (edge._private.rscratch.startY
				+ edge._private.rscratch.endY) / 2;
		} else if (edge._private.rscratch.isBezierEdge) {
			edgeCenterX = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startX
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2x
				+ (0.5 * 0.5) * edge._private.rscratch.endX;
			
			edgeCenterY = Math.pow(1 - 0.5, 2) * edge._private.rscratch.startY
				+ 2 * (1 - 0.5) * 0.5 * edge._private.rscratch.cp2y
				+ (0.5 * 0.5) * edge._private.rscratch.endY;
		}
		
		textX = edgeCenterX;
		textY = edgeCenterY;
		
		this.drawText(edge, textX, textY);
	}
	
	CanvasRenderer.prototype.drawNode = function(context, node) {
	
		var nodeWidth, nodeHeight;
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}
		
		// Node color & opacity
		context.fillStyle = "rgba(" 
			+ node._private.style["background-color"].value[0] + ","
			+ node._private.style["background-color"].value[1] + ","
			+ node._private.style["background-color"].value[2] + ","
			+ (node._private.style["background-opacity"].value 
			* node._private.style["opacity"].value) + ")";
		
		// Node border color & opacity
		context.strokeStyle = "rgba(" 
			+ node._private.style["border-color"].value[0] + ","
			+ node._private.style["border-color"].value[1] + ","
			+ node._private.style["border-color"].value[2] + ","
			+ (node._private.style["border-opacity"].value 
			* node._private.style["opacity"].value) + ")";
		
		nodeWidth = node._private.style["width"].value;
		nodeHeight = node._private.style["height"].value;
		
		// Draw node
		nodeShapes[node._private.style["shape"].value].draw(
			node,
			nodeWidth,
			nodeHeight); //node._private.data.weight / 5.0
		
		// Border width, draw border
		context.lineWidth = node._private.style["border-width"].value;
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
	}
	
	CanvasRenderer.prototype.drawNodeText = function(context, node) {
		
		if (node._private.style["visibility"].value != "visible") {
			return;
		}
	
		var textX, textY;
		
		var nodeWidth = node._private.style["width"].value;
		var nodeHeight = node._private.style["height"].value;
	
		// Find text position
		var textHalign = node._private.style["text-halign"].strValue;
		if (textHalign == "left") {
			// Align right boundary of text with left boundary of node
			context.textAlign = "right";
			textX = node._private.position.x - nodeWidth / 2;
		} else if (textHalign == "right") {
			// Align left boundary of text with right boundary of node
			context.textAlign = "left";
			textX = node._private.position.x + nodeWidth / 2;
		} else if (textHalign == "center") {
			context.textAlign = "center";
			textX = node._private.position.x;
		} else {
			// Same as center
			context.textAlign = "center";
			textX = node._private.position.x;
		}
		
		var textValign = node._private.style["text-valign"].strValue;
		if (textValign == "top") {
			context.textBaseline = "bottom";
			textY = node._private.position.y - nodeHeight / 2;
		} else if (textValign == "bottom") {
			context.textBaseline = "top";
			textY = node._private.position.y + nodeHeight / 2;
		} else if (textValign == "middle" || textValign == "center") {
			context.textBaseline = "middle";
			textY = node._private.position.y;
		} else {
			// same as center
			context.textBaseline = "middle";
			textY = node._private.position.y;
		}
		
		this.drawText(node, textX, textY);
	}
	
	CanvasRenderer.prototype.drawText = function(context, element, textX, textY) {
	
		// Font style
		var labelStyle = element._private.style["font-style"].strValue;
		var labelSize = element._private.style["font-size"].strValue;
		var labelFamily = element._private.style["font-family"].strValue;
		var labelVariant = element._private.style["font-variant"].strValue;
		var labelWeight = element._private.style["font-weight"].strValue;
					
		context.font = labelStyle + " " + labelVariant + " " + labelWeight + " " 
			+ labelSize + " " + labelFamily;
					
		var text = String(element._private.style["content"].value);
		var textTransform = element._private.style["text-transform"].value;
		
		if (textTransform == "none") {
		} else if (textTransform == "uppercase") {
			text = text.toUpperCase();
		} else if (textTransform == "lowercase") {
			text = text.toLowerCase();
		}
		
		// Calculate text draw position based on text alignment
		
		context.fillStyle = "rgba(" 
			+ element._private.style["color"].value[0] + ","
			+ element._private.style["color"].value[1] + ","
			+ element._private.style["color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value) + ")";
		
		context.strokeStyle = "rgba(" 
			+ element._private.style["text-outline-color"].value[0] + ","
			+ element._private.style["text-outline-color"].value[1] + ","
			+ element._private.style["text-outline-color"].value[2] + ","
			+ (element._private.style["text-opacity"].value
			* element._private.style["opacity"].value) + ")";
		
		if (text != undefined) {
			context.fillText("" + text, textX, textY);
		}
		
		var lineWidth = element._private.style["text-outline-width"].value;
		
		if (lineWidth > 0) {
			context.lineWidth = lineWidth;
			context.strokeText(text, textX, textY);
		}
	}

})( cytoscape );

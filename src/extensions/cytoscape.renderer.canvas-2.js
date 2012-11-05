(function($$){

	var arrowShapes = {};
	var nodeShapes = {};
	var rendFunc = CanvasRenderer.prototype;

	function CanvasRenderer(options) {
		
		this.data = {select: [0, 0, 0, 0, 0], minDistanceNode: null, minDistanceEdge: null, renderer: this, cy: options.cy, container: options.cy.container(),
			curTouch: [null, null, null, null, 0], prevTouch: [null, null, null, null, 0], mouseX: [undefined, undefined],
			canvases: [null, null, null, null, null, [], [], [], [], [], false, false, false, false, false], banvases: [null, null], };
		
		this.init();
		
		for (var i = 0; i < 5; i++) { this.data.canvases[i] = document.createElement("canvas"); this.data.canvases[i].style.position = "absolute"; this.data.canvases[i].id = "layer" + i; this.data.canvases[i].style.zIndex = String(-i); this.data.canvases[i].style.visibility = "hidden";  this.data.container.appendChild(this.data.canvases[i]); }
		for (var i = 0; i < 2; i++) { this.data.banvases[i] = document.createElement("canvas"); this.data.banvases[i].style.position = "absolute"; this.data.banvases[i].id = "buffr" + i; this.data.banvases[i].style.zIndex = String(-i); this.data.banvases[i].style.visibility = "visible"; this.data.container.appendChild(this.data.banvases[i]); }
	}

	CanvasRenderer.prototype.notify = function(params) {
		if (params.type == "add"
			|| params.type == "remove") {
			
			this.updateNodesCache();
			this.updateEdgesCache();
		}
	
		this.data.canvases[10+2] = true; this.data.canvases[5+2].push("Load");
		this.data.canvases[10+4] = true; this.data.canvases[5+4].push("Load");
		this.redraw();
	};
	
	// @O Initialization functions
	{
	
	CanvasRenderer.prototype.load = function() {
		var r = this;
	
		window.addEventListener("mousedown", function(e) {
			var cy = r.data.cy; var pos = r.projectMouse(e); var select = r.data.select;
		
			// Drag select
			r.data.select[0] = pos[0]; r.data.select[1] = pos[1]; r.data.select[4] = 1;
			
			// Check under mouse
			
			
			
		}, false);
		
		window.addEventListener("mousemove", function(e) {
			var cy = r.data.cy; var pos = r.projectMouse(e); var select = r.data.select;
		
			// Drag select
			r.data.select[2] = pos[0]; r.data.select[3] = pos[1];
			
			// Check under mouse
			
			
			
		}, false);
		
		window.addEventListener("mouseup", function(e) {
			var cy = r.data.cy; var pos = r.projectMouse(e); var select = r.data.select;
		
			r.data.select[4] = 0;
			
			// Check under mouse
			
			
			
		}, false);
		
		window.addEventListener("touchstart", function(e) {
			
		}, true);
		
		window.addEventListener("touchmove", function(e) {
			
		}, true);
		
		window.addEventListener("touchend", function(e) {
		
		}, true);
	};
	
	CanvasRenderer.prototype.init = function() {
//		console.log(this);
	};
	
	}
	
	// @O Caching functions
	{
	CanvasRenderer.prototype.getCachedNodes = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		if (data.cache.cachedNodes == undefined) {
			data.cache.cachedNodes = cy.nodes();
		}
		
		return data.cache.cachedNodes;
	}
	
	CanvasRenderer.prototype.updateNodesCache = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		data.cache.cachedNodes = cy.nodes();
	}
	
	CanvasRenderer.prototype.getCachedEdges = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		if (data.cache.cachedEdges == undefined) {
			data.cache.cachedEdges = cy.nodes();
		}
		
		return data.cache.cachedNodes;
	}
	
	CanvasRenderer.prototype.updateEdgesCache = function() {
		var data = this.data; var cy = this.data.cy;
		
		if (data.cache == undefined) {
			data.cache = {};
		}
		
		data.cache.cachedEdges = cy.edges();
	}
	}
	
	// @O Mouse / touch functions

	// Project mouse
	CanvasRenderer.prototype.projectMouse = function(mouseEvent) {
		
		var x, y; var offsetLeft = 0; var offsetTop = 0; var n; n = this.rendererData.cy.container();
		
		while (n != null) {
			if (typeof(n.offsetLeft) == "number") {offsetLeft += n.offsetLeft; offsetTop += n.offsetTop;} n = n.parentNode;
		}
		
		x = mouseEvent.pageX - offsetLeft; y = mouseEvent.pageY - offsetTop; x -= this.rendererData.cy.pan().x; y -= this.rendererData.cy.pan().y; x /= this.rendererData.cy.zoom(); y /= this.rendererData.cy.zoom();
		return [x, y];
	}
	
	// Find nearest element
	CanvasRenderer.prototype.findNearestElement = function(x, y) {
		var data = this.data; var nodes = data.cy.nodes(); var edges = data.cy.edges();
		
		// Check nodes
		
		
		// Check edges
		
			
	}
	
	
	
	// @O Keyboard functions
	{
	}
	
	// @O Drawing functions
	{
	
	// Resize canvas
	CanvasRenderer.prototype.matchCanvasSize = function(container) {
		var data = this.data; var width = container.clientWidth; var height = container.clientHeight;
		
		var canvas;
		for (var i = 0; i < 5; i++) {
			
			canvas = data.canvases[i];
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
			
			}
		}
		
		for (var i = 0; i < 2; i++) {
			
			canvas = data.banvases[i];
			
			if (canvas.width !== width || canvas.height !== height) {
				
				canvas.width = width;
				canvas.height = height;
				
			}
		}
	}
	
	// Redraw frame
	CanvasRenderer.prototype.redraw = function() {
		console.log("redrawing");
		var cy = this.data.cy; var data = this.data; var nodes = cy.nodes(); var edges = cy.edges();
		
		this.matchCanvasSize(data.container);
		
		var elements = cy.elements().toArray();
		var elementsLayer2 = [];
		var elementsLayer4 = [];
		
		if (data.canvases[10+2] || data.canvases[10+4]) {
		
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
		
		if (data.canvases[10+2]) {
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
						this.drawNode(context, element);
					} else if (element._private.group == "edges") {
						this.drawEdge(context, element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(context, element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(context, element);
					}
				}
			}
			
			data.canvases[10+2] = false;
		}
		
		if (data.canvases[10+4]) {
			var context = data.canvases[4].getContext("2d");

			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
			
			context.translate(cy.pan().x, cy.pan().y);
			context.scale(cy.zoom(), cy.zoom());
		
			var element;
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNode(context, element);
						
					} else if (element._private.group == "edges") {
						this.drawEdge(context, element);
					}
				}
			}
			
			for (var index = 0; index < elements.length; index++) {
				element = elements[index];
				
				if (!element._private.rscratch.layer2) {
					if (element._private.group == "nodes") {
						this.drawNodeText(context, element);
					} else if (element._private.group == "edges") {
						this.drawEdgeText(context, element);
					}
				}
			}
			
			data.canvases[10+4] = false;
		}
		
		if (data.canvases[10+0]) {
			var context = data.canvases[0].getContext("2d");
			
			context.setTransform(1, 0, 0, 1, 0, 0);
			context.clearRect(0, 0, context.canvas.width, context.canvas.height);
		
			context.translate(cy.pan().x, cy.pan().y);
			context.scale(cy.zoom(), cy.zoom());			
			
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
			}
			
			data.canvases[10+0] = false;
		}

		{
			var context;
					
			// Rasterize the layers
			context = data.banvases[1].getContext("2d");
			context.globalCompositeOperation = "copy";
			context.drawImage(data.canvases[4], 0, 0);
			context.globalCompositeOperation = "source-over";
			context.drawImage(data.canvases[2], 0, 0);
			context.drawImage(data.canvases[0], 0, 0);
//			context.fillStyle = "rgba(0,0,0,1)";
//			context.fillRect(50, 50, 400, 400);
			
			context = data.banvases[0].getContext("2d");
			context.globalCompositeOperation = "copy";
			context.drawImage(data.banvases[1], 0, 0);
//			context.fillStyle = "rgba(0,0,0,1)";
//			context.fillRect(50, 50, 400, 400);
		}
	};
	
	// Draw edge
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
			this.drawArrowheads(context, edge);
		}
	}
	
	// Draw edge text
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
		
		this.drawText(context, edge, textX, textY);
	}
	
	// Draw node
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
			context,
			node,
			nodeWidth,
			nodeHeight); //node._private.data.weight / 5.0
		
		// Border width, draw border
		context.lineWidth = node._private.style["border-width"].value;
		if (node._private.style["border-width"].value > 0) {
			context.stroke();
		}
	}
	
	// Draw node text
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
		
		this.drawText(context, node, textX, textY);
	}
	
	// Draw text
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

	}
	
	// @O Edge calculation functions
	{
	
	// Find edge control points
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var hashTable = {}; var cy = this.data.cy;
		
		var pairId;
		for (var i = 0; i < edges.length; i++) {
			
			pairId = edges[i]._private.data.source > edges[i]._private.data.target ?
				edges[i]._private.data.target + edges[i]._private.data.source :
				edges[i]._private.data.source + edges[i]._private.data.target;

			if (hashTable[pairId] == undefined) {
				hashTable[pairId] = [];
			}
			
			hashTable[pairId].push(edges[i]);
		}
	
		var src, tgt;
	
		// Nested for loop is OK; total number of iterations for both loops = edgeCount	
		for (var pairId in hashTable) {
		
			src = cy.getElementById(hashTable[pairId][0]._private.data.source);
			tgt = cy.getElementById(hashTable[pairId][0]._private.data.target);
			
			var midPointX = (src._private.position.x + tgt._private.position.x) / 2;
			var midPointY = (src._private.position.y + tgt._private.position.y) / 2;
			
			var displacementX, displacementY;
			
			if (hashTable[pairId].length > 1) {
				displacementX = tgt._private.position.y - src._private.position.y;
				displacementY = src._private.position.x - tgt._private.position.x;
				
				var displacementLength = Math.sqrt(displacementX * displacementX
					+ displacementY * displacementY);
				
				displacementX /= displacementLength;
				displacementY /= displacementLength;
			}
			
			var edge;
			
			for (var i = 0; i < hashTable[pairId].length; i++) {
				edge = hashTable[pairId][i];
							
				// Self-edge
				if (src._private.data.id == tgt._private.data.id) {
					var stepSize = edge._private.style["control-point-step-size"].pxValue;
						
					edge._private.rscratch.isSelfEdge = true;
					
					edge._private.rscratch.cp2ax = src._private.position.x;
					edge._private.rscratch.cp2ay = src._private.position.y
						- 1.3 * stepSize * (i / 3 + 1);
					
					edge._private.rscratch.cp2cx = src._private.position.x
						- 1.3 * stepSize * (i / 3 + 1);
					edge._private.rscratch.cp2cy = src._private.position.y;
					
					edge._private.rscratch.selfEdgeMidX =
						(edge._private.rscratch.cp2ax + edge._private.rscratch.cp2cx) / 2.0;
				
					edge._private.rscratch.selfEdgeMidY =
						(edge._private.rscratch.cp2ay + edge._private.rscratch.cp2cy) / 2.0;
						
				// Straight edge	
				} else if (hashTable[pairId].length % 2 == 1
					&& i == Math.floor(hashTable[pairId].length / 2)) {
					
					edge._private.rscratch.isStraightEdge = true;
					
				// Bezier edge
				} else {
					var stepSize = edge._private.style["control-point-step-size"].value;
					var distanceFromMidpoint = (0.5 - hashTable[pairId].length / 2 + i) * stepSize;
					
					edge._private.rscratch.isBezierEdge = true;
					
					edge._private.rscratch.cp2x = midPointX
						+ displacementX * distanceFromMidpoint;
					edge._private.rscratch.cp2y = midPointY
						+ displacementY * distanceFromMidpoint;
					
					// console.log(edge, midPointX, displacementX, distanceFromMidpoint);
				}
			}
		}
		
		return hashTable;
	}

	// Finds new endpoints for a bezier edge based on desired source and target radii
	CanvasRenderer.prototype.findNewEndPoints 
		= function(startX, startY, cp2x, cp2y, endX, endY, radius1, radius2) {
		
		var startNearPt = this.findCircleNearPoint(startX, startY, radius1, cp2x, cp2y);
		var endNearPt = this.findCircleNearPoint(endX, endY, radius2, cp2x, cp2y);
		
		return [startNearPt[0], startNearPt[1], endNearPt[0], endNearPt[1]];
	}

	// Calculates new endpoints for all bezier edges based on desired source and 
	// target radii
	CanvasRenderer.prototype.calculateNewEndPoints = function() {
		
		var edges = cy.edges();
		var source, target;
		var endpoints;
		
		for (var i = 0; i < edges.length; i++) {
			source = edges[i].source()[0];
			target = edges[i].target()[0];
			
			if (edges[i]._private.rscratch.isStraightEdge) {
				continue;
			}
			
			endpoints = this.findNewEndPoints(
				source.position().x,
				source.position().y,
				edges[i]._private.rscratch.controlPointX,
				edges[i]._private.rscratch.controlPointY,
				target.position().x,
				target.position().y
			);
				
			edges[i]._private.rscratch.updatedStartX = endpoints[0];
			edges[i]._private.rscratch.updatedStartY = endpoints[1];
			edges[i]._private.rscratch.updatedEndX = endpoints[2];
			edges[i]._private.rscratch.updatedEndY = endpoints[3];
		}
		
	}

	CanvasRenderer.prototype.findEndpoints = function(edge) {
		var intersect;

		var source = edge.source()[0];
		var target = edge.target()[0];
		
		var sourceRadius = Math.max(edge.source()[0]._private.style["width"].value,
			edge.source()[0]._private.style["height"].value);
		
		var targetRadius = Math.max(edge.target()[0]._private.style["width"].value,
			edge.target()[0]._private.style["height"].value);
		
		sourceRadius = 0;
		targetRadius /= 2;
		
		var start = [edge.source().position().x, edge.source().position().y];
		var end = [edge.target().position().x, edge.target().position().y];
		
		if (edge._private.rscratch.isSelfEdge) {
			
			var cp = [edge._private.rscratch.cp2cx, edge._private.rscratch.cp2cy];
			
			intersect = nodeShapes[target._private.style["shape"].value].intersectLine(
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			var cp = [edge._private.rscratch.cp2ax, edge._private.rscratch.cp2ay];

			intersect = nodeShapes[source._private.style["shape"].value].intersectLine(
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isStraightEdge) {
			
			intersect = nodeShapes[target._private.style["shape"].value].intersectLine(
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				source.position().x,
				source.position().y);
				
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			var arrowEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect,
				[source.position().x, source.position().y],
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));

			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
		
			intersect = nodeShapes[source._private.style["shape"].value].intersectLine(
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				target.position().x,
				target.position().y);
			
			if (intersect.length == 0) {
				edge._private.rscratch.noArrowPlacement = true;
	//			return;
			} else {
				edge._private.rscratch.noArrowPlacement = false;
			}
			
			/*
			console.log("1: "
				+ arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect,
				[target.position().x, target.position().y],
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));

			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
						
		} else if (edge._private.rscratch.isBezierEdge) {
			
			var cp = [edge._private.rscratch.cp2x, edge._private.rscratch.cp2y];
			
			// Point at middle of Bezier
			var halfPointX = start[0] * 0.25 + end[0] * 0.25 + cp[0] * 0.5;
			var halfPointY = start[1] * 0.25 + end[1] * 0.25 + cp[1] * 0.5;
			
			intersect = nodeShapes[
				target._private.style["shape"].value].intersectLine(
				target,
				target._private.style["width"].value,
				target._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			/*
			console.log("2: "
				+ arrowShapes[edge._private.style["source-arrow-shape"].value],
					edge._private.style["source-arrow-shape"].value);
			*/
			var arrowEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].spacing(edge));
			var edgeEnd = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["target-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.endX = edgeEnd[0];
			edge._private.rscratch.endY = edgeEnd[1];
			
			edge._private.rscratch.arrowEndX = arrowEnd[0];
			edge._private.rscratch.arrowEndY = arrowEnd[1];
			
			intersect = nodeShapes[
				source._private.style["shape"].value].intersectLine(
				source,
				source._private.style["width"].value,
				source._private.style["height"].value,
				cp[0], //halfPointX,
				cp[1] //halfPointY
			);
			
			var arrowStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].spacing(edge));
			var edgeStart = this.shortenIntersection(intersect, cp,
				arrowShapes[edge._private.style["source-arrow-shape"].value].gap(edge));
			
			edge._private.rscratch.startX = edgeStart[0];
			edge._private.rscratch.startY = edgeStart[1];
			
			edge._private.rscratch.arrowStartX = arrowStart[0];
			edge._private.rscratch.arrowStartY = arrowStart[1];
			
		} else if (edge._private.rscratch.isArcEdge) {
			return;
		}
	}

	}

	// @O Graph traversal functions
	{
	
	// Find adjacent edges
	CanvasRenderer.prototype.findEdges = function(nodeSet) {
		
		var edges = this.data.cy.edges();
		
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
	
	// @O Intersection functions
	{
	CanvasRenderer.prototype.intersectLineEllipse = function(
		x, y, centerX, centerY, ellipseWradius, ellipseHradius) {
		
		var dispX = centerX - x;
		var dispY = centerY - y;
		
		dispX /= ellipseWradius;
		dispY /= ellipseHradius;
		
		var len = Math.sqrt(dispX * dispX + dispY * dispY);
		
		var newLength = len - 1;
		
		if (newLength < 0) {
			return [];
		}
		
		var lenProportion = newLength / len;
		
		return [(centerX - x) * lenProportion + x, (centerY - y) * lenProportion + y];
	}
	
	CanvasRenderer.prototype.findCircleNearPoint = function(centerX, centerY, 
		radius, farX, farY) {
		
		var displacementX = farX - centerX;
		var displacementY = farY - centerY;
		var distance = Math.sqrt(displacementX * displacementX 
			+ displacementY * displacementY);
		
		var unitDisplacementX = displacementX / distance;
		var unitDisplacementY = displacementY / distance;
		
		return [centerX + unitDisplacementX * radius, 
			centerY + unitDisplacementY * radius];
	}
	
	CanvasRenderer.prototype.findMaxSqDistanceToOrigin = function(points) {
		var maxSqDistance = 0.000001;
		var sqDistance;
		
		for (var i = 0; i < points.length / 2; i++) {
			
			sqDistance = points[i * 2] * points[i * 2] 
				+ points[i * 2 + 1] * points[i * 2 + 1];
			
			if (sqDistance > maxSqDistance) {
				maxSqDistance = sqDistance;
			}
		}
		
		return maxSqDistance;
	}
	
	CanvasRenderer.prototype.finiteLinesIntersect = function(
		x1, y1, x2, y2, x3, y3, x4, y4, infiniteLines) {
		
		var ua_t = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
		var ub_t = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
		var u_b = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

		if (u_b != 0) {
			var ua = ua_t / u_b;
			var ub = ub_t / u_b;
			
			if (0 <= ua && ua <= 1 && 0 <= ub && ub <= 1) {	
				return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
				
			} else {
				if (!infiniteLines) {
					return [];
				} else {
					return [x1 + ua * (x2 - x1), y1 + ua * (y2 - y1)];
				}
			}
		} else {
			if (ua_t == 0 || ub_t == 0) {

				// Parallel, coincident lines. Check if overlap

				// Check endpoint of second line
				if ([x1, x2, x4].sort()[1] == x4) {
					return [x4, y4];
				}
				
				// Check start point of second line
				if ([x1, x2, x3].sort()[1] == x3) {
					return [x3, y3];
				}
				
				// Endpoint of first line
				if ([x3, x4, x2].sort()[1] == x2) {
					return [x2, y2];
				}
				
				return [];
			} else {
			
				// Parallel, non-coincident
				return [];
			}
		}
	}
	
	CanvasRenderer.prototype.boxIntersectEllipse = function(
		x1, y1, x2, y2, padding, width, height, centerX, centerY) {
		
		if (x2 < x1) {
			var oldX1 = x1;
			x1 = x2;
			x2 = oldX1;
		}
		
		if (y2 < y1) {
			var oldY1 = y1;
			y1 = y2;
			y2 = oldY1;
		}
		
		// 4 ortho extreme points
		var east = [centerX - width / 2 - padding, centerY];
		var west = [centerX + width / 2 + padding, centerY];
		var north = [centerX, centerY + height / 2 + padding];
		var south = [centerX, centerY - height / 2 - padding];
		
		// out of bounds: return false
		if (x2 < east[0]) {
			return false;
		}
		
		if (x1 > west[0]) {
			return false;
		}
		
		if (y2 < south[1]) {
			return false;
		}
		
		if (y1 > north[1]) {
			return false;
		}
		
		// 1 of 4 ortho extreme points in box: return true
		if (x1 <= east[0] && east[0] <= x2
				&& y1 <= east[1] && east[1] <= y2) {
			return true;
		}
		
		if (x1 <= west[0] && west[0] <= x2
				&& y1 <= west[1] && west[1] <= y2) {
			return true;
		}
		
		if (x1 <= north[0] && north[0] <= x2
				&& y1 <= north[1] && north[1] <= y2) {
			return true;
		}
		
		if (x1 <= south[0] && south[0] <= x2
				&& y1 <= south[1] && south[1] <= y2) {
			return true;
		}
		
		// box corner in ellipse: return true		
		x1 = (x1 - centerX) / (width + padding);
		x2 = (x2 - centerX) / (width + padding);
		
		y1 = (y1 - centerY) / (height + padding);
		y2 = (y2 - centerY) / (height + padding);
		
		if (x1 * x1 + y1 * y1 <= 1) {
			return true;
		}
		
		if (x2 * x2 + y1 * y1 <= 1) {
			return true;
		}
		
		if (x2 * x2 + y2 * y2 <= 1) {
			return true;
		}
		
		if (x1 * x1 + y2 * y2 <= 1) {
			return true;
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.boxIntersectPolygon = function(
		x1, y1, x2, y2, basePoints, width, height, centerX, centerY, direction, padding) {
		
//		console.log(arguments);
		
		if (x2 < x1) {
			var oldX1 = x1;
			x1 = x2;
			x2 = oldX1;
		}
		
		if (y2 < y1) {
			var oldY1 = y1;
			y1 = y2;
			y2 = oldY1;
		}
		
		var transformedPoints = new Array(basePoints.length)
		
		// Gives negative of angle
		var angle = Math.asin(direction[1] / (Math.sqrt(direction[0] * direction[0] 
			+ direction[1] * direction[1])));
		
		if (direction[0] < 0) {
			angle = angle + Math.PI / 2;
		} else {
			angle = -angle - Math.PI / 2;
		}
		
		var cos = Math.cos(-angle);
		var sin = Math.sin(-angle);
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				width * (basePoints[i * 2] * cos
					- basePoints[i * 2 + 1] * sin);
			
			transformedPoints[i * 2 + 1] = 
				height * (basePoints[i * 2 + 1] * cos 
					+ basePoints[i * 2] * sin);
			
			transformedPoints[i * 2] += centerX;
			transformedPoints[i * 2 + 1] += centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		
		// Check if a point is in box
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			if (x1 <= transformedPoints[i * 2]
					&& transformedPoints[i * 2] <= x2) {
				
				if (y1 <= transformedPoints[i * 2 + 1]
						&& transformedPoints[i * 2 + 1] <= y2) {
					
					return true;
				}
			}
		}
		
		// Check if box corner in the polygon
		if (renderer.pointInsidePolygon(
			x1, y1, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x1, y2, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x2, y2, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		} else if (renderer.pointInsidePolygon(
			x2, y1, points, 0, 0, 1, 1, 0, direction)) {
			
			return true;
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.polygonIntersectLine = function(
		x, y, basePoints, centerX, centerY, width, height, padding) {
		
		var intersections = [];
		var intersection;
		
		var transformedPoints = new Array(basePoints.length);
		
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = basePoints[i * 2] * width + centerX;
			transformedPoints[i * 2 + 1] = basePoints[i * 2 + 1] * height + centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		// var points = transformedPoints;
		
		var currentX, currentY, nextX, nextY;
		
		for (var i = 0; i < points.length / 2; i++) {
		
			currentX = points[i * 2];
			currentY = points[i * 2 + 1];

			if (i < points.length / 2 - 1) {
				nextX = points[(i + 1) * 2];
				nextY = points[(i + 1) * 2 + 1];
			} else {
				nextX = points[0]; 
				nextY = points[1];
			}
			
			intersection = this.finiteLinesIntersect(
				x, y, centerX, centerY,
				currentX, currentY,
				nextX, nextY);
			
			if (intersection.length != 0) {
				intersections.push(intersection[0], intersection[1]);
			}
		}
		
		return intersections;
	}
	
	CanvasRenderer.prototype.shortenIntersection = function(
		intersection, offset, amount) {
		
		var disp = [intersection[0] - offset[0], intersection[1] - offset[1]];
		
		var length = Math.sqrt(disp[0] * disp[0] + disp[1] * disp[1]);
		
		var lenRatio = (length - amount) / length;
		
		if (lenRatio < 0) {
			return [];
		} else {
			return [offset[0] + lenRatio * disp[0], offset[1] + lenRatio * disp[1]];
		}
	}
	}
	
	// @O Arrow shapes
	{
	// Contract for arrow shapes:
	{
	// 0, 0 is arrow tip
	// (0, 1) is direction towards node
	// (1, 0) is right
	//
	// functional api:
	// collide: check x, y in shape
	// roughCollide: called before collide, no false negatives
	// draw: draw
	// spacing: dist(arrowTip, nodeBoundary)
	// gap: dist(edgeTip, nodeBoundary), edgeTip may != arrowTip
	}
	
	// Declarations
	{
	arrowShapes["arrow"] = {
		_points: [
			-0.15, -0.3,
			0, 0,
			0.15, -0.3
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["arrow"]._points;
			
//			console.log("collide(): " + direction);
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["arrow"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["arrow"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["arrow"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["arrow"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["arrow"]._points;
		
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["triangle"] = arrowShapes["arrow"];
	
	arrowShapes["none"] = {
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return false;
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return false;
		},
		draw: function(context) {
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return 0;
		}
	}
	
	arrowShapes["circle"] = {
		_baseRadius: 0.15,
		
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			// Transform x, y to get non-rotated ellipse
			
			if (width != height) {
				// This gives negative of the angle
				var angle = Math.asin(direction[1] / 
					(Math.sqrt(direction[0] * direction[0] 
						+ direction[1] * direction[1])));
			
				var cos = Math.cos(-angle);
				var sin = Math.sin(-angle);
				
				var rotatedPoint = 
					[x * cos - y * sin,
						y * cos + x * sin];
				
				var aspectRatio = (height + padding) / (width + padding);
				y /= aspectRatio;
				centerY /= aspectRatio;
				
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow((width + padding)
						* arrowShapes["circle"]._baseRadius, 2));
			} else {
				return (Math.pow(centerX - x, 2) 
					+ Math.pow(centerY - y, 2) <= Math.pow((width + padding)
						* arrowShapes["circle"]._baseRadius, 2));
			}
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			return true;
		},
		draw: function(context) {
			context.arc(0, 0, arrowShapes["circle"]._baseRadius, 0, Math.PI * 2, false);
		},
		spacing: function(edge) {
			return rendFunc.getArrowWidth(edge._private.style["width"].value)
				* arrowShapes["circle"]._baseRadius;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["inhibitor"] = {
		_points: [
			-0.25, 0,
			-0.25, -0.1,
			0.25, -0.1,
			0.25, 0
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["inhibitor"]._points;
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["inhibitor"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["inhibitor"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["inhibitor"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["inhibitor"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["inhibitor"]._points;
			
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 4;
		},
		gap: function(edge) {
			return 4;
		}
	}
	
	arrowShapes["square"] = {
		_points: [
			-0.12, 0.00,
			0.12, 0.00,
			0.12, -0.24,
			-0.12, -0.24
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["square"]._points;
			
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["square"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["square"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["square"]._points);
			}
		
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["square"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
			var points = arrowShapes["square"]._points;
		
			for (var i = 0; i < points.length / 2; i++) {
				context.lineTo(points[i * 2], points[i * 2 + 1]);
			}
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["diamond"] = {
		_points: [
			-0.14, -0.14,
			0, -0.28,
			0.14, -0.14,
			0, 0
		],
		collide: function(x, y, centerX, centerY, width, height, direction, padding) {
			var points = arrowShapes["diamond"]._points;
					
			return rendFunc.pointInsidePolygon(
				x, y, points, centerX, centerY, width, height, direction, padding);
		},
		roughCollide: function(x, y, centerX, centerY, width, height, direction, padding) {
			if (typeof(arrowShapes["diamond"]._farthestPointSqDistance) == "undefined") {
				arrowShapes["diamond"]._farthestPointSqDistance = 
					rendFunc.findMaxSqDistanceToOrigin(arrowShapes["diamond"]._points);
			}
				
			return rendFunc.checkInBoundingCircle(
				x, y, arrowShapes["diamond"]._farthestPointSqDistance,
				0, width, height, centerX, centerY);
		},
		draw: function(context) {
//			context.translate(0, 0.16);
			context.lineTo(-0.14, -0.14);
			context.lineTo(0, -0.28);
			context.lineTo(0.14, -0.14);
			context.lineTo(0, 0.0);
		},
		spacing: function(edge) {
			return 0;
		},
		gap: function(edge) {
			return edge._private.style["width"].value * 2;
		}
	}
	
	arrowShapes["tee"] = arrowShapes["inhibitor"];
	}
	
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
	CanvasRenderer.prototype.drawArrowheads = function(context, edge) {
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
		
		context.save();
		
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		
		var size = this.getArrowWidth(context.lineWidth);
		/// size = 100;
		context.scale(size, size);
		
		context.beginPath();
		
		arrowShapes[shape].draw(context);
		
		context.closePath();
		
//		context.stroke();
		context.fill();
		context.restore();
	}
	}
	
	// @O Node shapes
	{
	
	// Generate polygon points
	var generateUnitNgonPoints = function(sides, rotationRadians) {
		
		var increment = 1.0 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0 ? 
			Math.PI / 2.0 + increment / 2.0 : Math.PI / 2.0;
		
		startAngle += rotationRadians;
		
		var points = new Array(sides * 2);
		
		var currentAngle;
		for (var i = 0; i < sides; i++) {
			currentAngle = i * increment + startAngle;
			
			points[2 * i] = Math.cos(currentAngle);// * (1 + i/2);
			points[2 * i + 1] = Math.sin(-currentAngle);//  * (1 + i/2);
		}
		
		return points;
	}
	
	// Node shape declarations
	
	// Contract for node shapes:
	{
	// Node shape contract:
	//
	// draw: draw
	// intersectLine: report intersection from x, y, to node center
	// checkPointRough: heuristic check x, y in node, no false negatives
	// checkPoint: check x, y in node
	}
	
	// Declarations
	{
	nodeShapes["ellipse"] = {
		draw: function(context, node, width, height) {
			context.beginPath();
			context.save();
			context.translate(node._private.position.x, node._private.position.y);
			context.scale(width / 2, height / 2);
			// At origin, radius 1, 0 to 2pi
			context.arc(0, 0, 1, 0, Math.PI * 2, false);
			context.closePath();
			context.restore();
			context.fill();
			
//			console.log("drawing ellipse");
//			console.log(arguments);
			
		},
		
		intersectLine: function(node, width, height, x, y) {
			var intersect = rendFunc.intersectLineEllipse(
			x, y,
			node.position().x,
			node.position().y,
			width / 2 + node._private.style["border-width"].value / 2,
			height / 2 + node._private.style["border-width"].value / 2);
			
			return intersect;
		},
		
		intersectBox: function(
			x1, y1, x2, y2, padding, width, height, centerX, centerY) {
			
			return CanvasRenderer.prototype.boxIntersectEllipse(
				x1, y1, x2, y2, padding, width, height, centerX, centerY);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return true;
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
//			console.log(arguments);
			
			x -= centerX;
			y -= centerY;
			
			x /= (width + padding);
			y /= (height + padding);
			
			return (Math.pow(x, 2) + Math.pow(y, 2) <= 1);
		}
	}
	
	nodeShapes["triangle"] = {
		points: generateUnitNgonPoints(3, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["triangle"].points);
		},
		
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["triangle"].points);
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["triangle"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["triangle"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["triangle"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["square"] = {
		points: generateUnitNgonPoints(4, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["square"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["square"].points);
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["square"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["square"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["square"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["rectangle"] = nodeShapes["square"];
	
	nodeShapes["roundrectangle"] = nodeShapes["square"];
	
	nodeShapes["pentagon"] = {
		points: generateUnitNgonPoints(5, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["pentagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["pentagon"].points);
		},
		
		intersectBox: function(
			x1, y1, x2, y2, width, height, centerX, centerY, padding) {
			
			var points = nodeShapes["pentagon"].points;
			
			return renderer.boxIntersectPolygon(
				x1, y1, x2, y2,
				points, width, height, centerX, centerY, [0, -1], padding);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["pentagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["pentagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["hexagon"] = {
		points: generateUnitNgonPoints(6, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["hexagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["hexagon"].points);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return renderer.checkInBoundingBox(
				x, y, nodeShapes["hexagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return renderer.pointInsidePolygon(x, y, nodeShapes["hexagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["heptagon"] = {
		points: generateUnitNgonPoints(7, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["heptagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["heptagon"].points);
		},
		
		checkPointRough: function(
			x, y, padding, width, height, centerX, centerY) {
		
			return checkInBoundingBox(
				x, y, nodeShapes["heptagon"].points, 
					padding, width, height, centerX, centerY);
		},
		
		checkPoint: function(
			x, y, padding, width, height, centerX, centerY) {
			
			return pointInsidePolygon(x, y, nodeShapes["heptagon"].points,
				centerX, centerY, width, height, [0, -1], padding);
		}
	}
	
	nodeShapes["octogon"] = {
		points: generateUnitNgonPoints(8, 0),
		
		draw: function(node, width, height) {
			renderer.drawPolygon(node._private.position.x,
				node._private.position.y, width, height, nodeShapes["octagon"].points);
		},
		intersectLine: function(node, width, height, x, y) {
			return renderer.findPolygonIntersection(
				node, width, height, x, y, nodeShapes["octagon"].points);
		}
	}
	}

	}
	
	// @O Polygon calculations
	
	CanvasRenderer.prototype.expandPolygon = function(points, pad) {
		
		var expandedLineSet = new Array(points.length * 2);
		
		var currentPointX, currentPointY, nextPointX, nextPointY;
		
		for (var i = 0; i < points.length / 2; i++) {
			currentPointX = points[i * 2];
			currentPointY = points[i * 2 + 1];
			
			if (i < points.length / 2 - 1) {
				nextPointX = points[(i + 1) * 2];
				nextPointY = points[(i + 1) * 2 + 1];
			} else {
				nextPointX = points[0];
				nextPointY = points[1];
			}
			
			// Current line: [currentPointX, currentPointY] to [nextPointX, nextPointY]
			
			// Assume CCW polygon winding
			
			var offsetX = (nextPointY - currentPointY);
			var offsetY = -(nextPointX - currentPointX);
			
			// Normalize
			var offsetLength = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
			var normalizedOffsetX = offsetX / offsetLength;
			var normalizedOffsetY = offsetY / offsetLength;
			
			expandedLineSet[i * 4] = currentPointX + normalizedOffsetX * pad;
			expandedLineSet[i * 4 + 1] = currentPointY + normalizedOffsetY * pad;
			expandedLineSet[i * 4 + 2] = nextPointX + normalizedOffsetX * pad;
			expandedLineSet[i * 4 + 3] = nextPointY + normalizedOffsetY * pad;
		}
		
		return expandedLineSet;
	}
	
	CanvasRenderer.prototype.joinLines = function(lineSet) {
		
		var vertices = new Array(lineSet.length / 2);
		
		var currentLineStartX, currentLineStartY, currentLineEndX, currentLineEndY;
		var nextLineStartX, nextLineStartY, nextLineEndX, nextLineEndY;
		
		for (var i = 0; i < lineSet.length / 4; i++) {
			currentLineStartX = lineSet[i * 4];
			currentLineStartY = lineSet[i * 4 + 1];
			currentLineEndX = lineSet[i * 4 + 2];
			currentLineEndY = lineSet[i * 4 + 3];
			
			if (i < lineSet.length / 4 - 1) {
				nextLineStartX = lineSet[(i + 1) * 4];
				nextLineStartY = lineSet[(i + 1) * 4 + 1];
				nextLineEndX = lineSet[(i + 1) * 4 + 2];
				nextLineEndY = lineSet[(i + 1) * 4 + 3];
			} else {
				nextLineStartX = lineSet[0];
				nextLineStartY = lineSet[1];
				nextLineEndX = lineSet[2];
				nextLineEndY = lineSet[3];
			}
			
			var intersection = this.finiteLinesIntersect(
				currentLineStartX, currentLineStartY,
				currentLineEndX, currentLineEndY,
				nextLineStartX, nextLineStartY,
				nextLineEndX, nextLineEndY,
				true);
			
			vertices[i * 2] = intersection[0];
			vertices[i * 2 + 1] = intersection[1];
		}
		
		return vertices;
	}
	
	CanvasRenderer.prototype.pointInsidePolygon = function(
		x, y, basePoints, centerX, centerY, width, height, direction, padding) {

		//var direction = arguments[6];
		var transformedPoints = new Array(basePoints.length)

		// Gives negative angle
		var angle = Math.asin(direction[1] / (Math.sqrt(direction[0] * direction[0] 
			+ direction[1] * direction[1])));
		
		if (direction[0] < 0) {
			angle = angle + Math.PI / 2;
		} else {
			angle = -angle - Math.PI / 2;
		}
				
		var cos = Math.cos(-angle);
		var sin = Math.sin(-angle);
		
//		console.log("base: " + basePoints);
		for (var i = 0; i < transformedPoints.length / 2; i++) {
			transformedPoints[i * 2] = 
				width * (basePoints[i * 2] * cos
					- basePoints[i * 2 + 1] * sin);
			
			transformedPoints[i * 2 + 1] = 
				height * (basePoints[i * 2 + 1] * cos 
					+ basePoints[i * 2] * sin);

			transformedPoints[i * 2] += centerX;
			transformedPoints[i * 2 + 1] += centerY;
		}
		
		var points;
		
		if (padding > 0) {
			var expandedLineSet = renderer.expandPolygon(
				transformedPoints,
				-padding);
			
			points = renderer.joinLines(expandedLineSet);
		} else {
			points = transformedPoints;
		}
		
		var x1, y1, x2, y2;
		var y3;
		
		// Intersect with vertical line through (x, y)
		var up = 0;
		var down = 0;
		for (var i = 0; i < points.length / 2; i++) {
			
			x1 = points[i * 2];
			y1 = points[i * 2 + 1];
			
			if (i + 1 < points.length / 2) {
				x2 = points[(i + 1) * 2];
				y2 = points[(i + 1) * 2 + 1];
			} else {
				x2 = points[(i + 1 - points.length / 2) * 2];
				y2 = points[(i + 1 - points.length / 2) * 2 + 1];
			}
			
//*			console.log("line from (" + x1 + ", " + y1 + ") to (" + x2 + ", " + y2 + ")");

//&			console.log(x1, x, x2);

			if (x1 == x && x2 == x) {
				
			} else if ((x1 >= x && x >= x2)
				|| (x1 <= x && x <= x2)) {
				
				y3 = (x - x1) / (x2 - x1) * (y2 - y1) + y1;
				
				if (y3 > y) {
					up++;
				}
				
				if (y3 < y) {
					down++;
				}
				
//*				console.log(y3, y);
				
			} else {
//*				console.log("22");
				continue;
			}
			
		}
		
//*		console.log("up: " + up + ", down: " + down);
		
		if (up % 2 == 0) {
			return false;
		} else {
			return true;
		}
	}
	
	// @O Polygon drawing
	CanvasRenderer.prototype.drawPolygon = function(
		x, y, width, height, points) {

		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		context.scale(width / 2, height / 2);
		context.moveTo(points[0], points[1]);
		
		for (var i = 1; i < points.length / 2; i++) {
			context.lineTo(points[i * 2], points[i * 2 + 1]);
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}
	
	
	// @O Approximate collision functions
	CanvasRenderer.prototype.checkInBoundingCircle = function(
		x, y, farthestPointSqDistance, padding, width, height, centerX, centerY) {
		
		x = (x - centerX) / (width + padding);
		y = (y - centerY) / (height + padding);
		
		return (x * x + y * y) <= farthestPointSqDistance;
	}
	
	CanvasRenderer.prototype.checkInBoundingBox = function(
		x, y, points, padding, width, height, centerX, centerY) {
		
		// Assumes width, height >= 0, points.length > 0
		
		var minX = points[0], minY = points[1];
		var maxX = points[0], maxY = points[1];
		
		for (var i = 1; i < points.length / 2; i++) {
			
			if (points[i * 2] < minX) {
				minX = points[i * 2];
			} else if (points[i * 2] > maxX) {
				maxX = points[i * 2];
			}
			
			if (points[i * 2 + 1] < minY) {
				minY = points[i * 2 + 1];
			} else if (points[i * 2 + 1] > maxY) {
				maxY = points[i * 2 + 1];
			}
		}
		
		x -= centerX;
		y -= centerY;
		
		x /= width;
		y /= height;
		
		if (x < minX) {
			return false;
		} else if (x > maxX) {
			return false;
		}
		
		if (y < minY) {
			return false;
		} else if (y > maxY) {
			return false;
		}
		
		return true;
	}
	
	$$("renderer", "canvas", CanvasRenderer);
	
})( cytoscape );

(function($, $$){


	var debug = function(o) {
		if (false) {
			console.log(o);
		}
	}

	// TODO put default options here
	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true,
	};
	
	var defaultNode = {
		shape: "ellipse",
		sizeFactor: 0.2,
		selectedColor: "#AADDAA",
		hoveredColor: "#AAAAFF",
		regularColor: "#AAAAAA",
	
		borderWidth: 6,
		selectedBorderColor: "#BBDDBB",
		hoveredBorderColor: "#BBBBFF",
		regularBorderColor: "#BBBBBB",
		
		labelFontStyle: "normal",
		labelFontSize: "12px",
		labelFontFamily: "Arial",
		
		labelTextAlign: "center",
		labelTextColor: "#666666",
	};
	
	var defaultEdge = {
		selectedColor: "#AADDAA",
		hoveredColor: "#CDCDFF",
		regularColor: "#CDCDCD",
		
		/*
		[ [ ‘font-style’ || ‘font-variant’ || ‘font-weight’ ]? 
			‘font-size’ [ / ‘line-height’ ]? font-family ] 
			| caption | icon | menu | message-box | small-caption | status-bar | inherit
		*/
		
		endShape: "arrow",
		
		widthFactor: 1 / 26.0,
	};
	
	var debugStats = {};
	
	// The 5th element in the array can be used to indicate whether 
	// the box should be drawn (0=hide)
	var selectBox = [0, 0, 0, 0, 0];
	
	var dragPanStartX;
	var dragPanStartY;
	var dragPanInitialCenter;
	var dragPanMode = false;
	
	var shiftDown = false;
	
	var nodeHovered = false;
	
	var minDistanceEdge;
	var minDistanceEdgeValue = 999;
	
	var minDistanceNode;
	var minDistanceNodeValue = 999;
	
	var arrowShapeDrawers = {};
	var nodeShapeDrawers = {};
	
	// Timeout variable used to prevent mouseMove events from being triggered too often
	var mouseMoveTimeout = 0;
	
	function CanvasRenderer(options) {
		this.options = $.extend(true, {}, defaults, options);
		this.cy = options.cy;
		
		this.init();
		
		// Information about the number of edges between each pair of nodes
		// used to find different curvatures for the edges
		this.nodePairEdgeData = {};		
	}

	CanvasRenderer.prototype.notify = function(params) {
		debug("notify call: " + params);
		debug(params);
		
		switch (params.type) {
			case "load":
				debug("load call");
				this.load();
				this.initStyle();
				break;
			case "draw":
				debug("draw call");
				break;
			default:
				debug("event: " + params.type);
		}
		
		// this.redraw();
	};
	
	CanvasRenderer.prototype.projectMouse = function(self, mouseX, mouseY, xOffset, yOffset) {
		var x = mouseX - xOffset;
		var y = mouseY - yOffset;
		
		x -= self.options.cy.container().width() / 2;
		y -= self.options.cy.container().height() / 2;
		
		x /= self.scale[0];
		y /= self.scale[1];
		
		x += self.center[0];
		y += self.center[1];
		
		return [x, y];
	}
	
	CanvasRenderer.prototype.findEdgeMetrics = function(edges) {
		this.nodePairEdgeData = {};
		
		var edge, nodePairId;
		for (var i = 0; i < edges.length; i++) {
			edge = edges[i];
			nodePairId = edge._private.data.source <= edge._private.data.target?
				edge._private.data.source + edge._private.data.target
				: edge._private.data.target + edge._private.data.source;
				
			if (this.nodePairEdgeData[nodePairId] == undefined) {
				this.nodePairEdgeData[nodePairId] = 1;
			} else {
				this.nodePairEdgeData[nodePairId]++;
			}
			
			edge._private.rscratch.nodePairId = nodePairId;
			edge._private.rscratch.nodePairEdgeNum = this.nodePairEdgeData[nodePairId];
		}
		
		// console.log(this.nodePairEdgeData);
	}
	
	CanvasRenderer.prototype.findEdgeControlPoints = function(edges) {
		var visitedEdges = {};
		
		var parallelEdges;
		for (var i = 0; i < edges.length; i++) {
			if (visitedEdges[edges[i]._private.data.id] == undefined) {
				parallelEdges = edges[i].parallelEdges();
				
				for (var j = 0; j < edges.length; j++) {
					visitedEdges[edges[i]._private.data.id] = true;
				}
				
				$$.styfn.calculateControlPoints(parallelEdges);
			}
		}
	}
	
	CanvasRenderer.prototype.mouseMoveHandler = function(e) {
		if (mouseMoveTimeout) {return;}
		
		mouseMoveTimeout = setTimeout(function(){
			mouseMoveTimeout = null;		
		}, 1000/80);
		
		var renderer = cy.renderer();
		
		// Get references to helper functions
		var dragHandler = renderer.mouseMoveHelper.dragHandler;
		var checkEdgeHover = renderer.mouseMoveHelper.checkEdgeHover;
		var checkStraightEdgeHover = renderer.mouseMoveHelper.checkStraightEdgeHover;
		var checkNodeHover = renderer.mouseMoveHelper.checkNodeHover;
		var hoverHandler = renderer.mouseMoveHelper.hoverHandler;
		
		
		// Offset for Cytoscape container
		var mouseOffsetX = cy.container().offset().left + 2;
		var mouseOffsetY = cy.container().offset().top + 2;
		
		var edges = self.cy.edges();
		var nodes = self.cy.nodes();
		
		
		// Drag pan
		if (dragPanMode) {
			dragHandler(e);
		}

		var current = cy.renderer().projectMouse(cy.renderer(),
			e.clientX,
			e.clientY,
			mouseOffsetX,
			mouseOffsetY);
		
		// Update selection box
		selectBox[2] = current[0];
		selectBox[3] = current[1];
		
		if (shiftDown && selectBox[4] == 1) {
			for (var index = 0; index < nodes.length; index++) {
				if (nodes[index]._private.rscratch.selected) {
					nodes[index]._private.position.x = 
						nodes[index]._private.rscratch.dragStartX
						+ (selectBox[2] - selectBox[0]);
					nodes[index]._private.position.y = 
						nodes[index]._private.rscratch.dragStartY
						+ (selectBox[3] - selectBox[1]);
				}
			}
		}
					
		if (!shiftDown && selectBox[4] == 1
			&& Math.abs(selectBox[2] - selectBox[0]) 
				+ Math.abs(selectBox[3] - selectBox[1]) > 2) {
			var padding = 5;
			
			for (var index = 0; index < edges.length; index++) {
			
				var boxInBezierVicinity = $$.math.boxInBezierVicinity(
					selectBox[0], selectBox[1],
					selectBox[2], selectBox[3],
					edges[index].source().position().x,
					edges[index].source().position().y,
					edges[index]._private.rscratch.cp2x,
					edges[index]._private.rscratch.cp2y,
					edges[index].target().position().x,
					edges[index].target().position().y, padding);
					
				if (boxInBezierVicinity == 2) {
					edges[index]._private.rscratch.selected = true;
				} else if (boxInBezierVicinity == 1) {
					
					if (edges[index]._private.rscratch.straightEdge) {
						
						edges[index]._private.rscratch.selected = 
							$$.math.checkStraightEdgeCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index].source().position().x,
								edges[index].source().position().y,
								edges[index].target().position().x,
								edges[index].target().position().y, padding);
						
					} else {
						
						edges[index]._private.rscratch.selected = 
							$$.math.checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index].source().position().x,
								edges[index].source().position().y,
								edges[index]._private.rscratch.cp2x,
								edges[index]._private.rscratch.cp2y,
								edges[index].target().position().x,
								edges[index].target().position().y, padding);
						
					}
				} else {
					edges[index]._private.rscratch.selected = false;
				}
			}
			
			var boxMinX = Math.min(selectBox[0], selectBox[2]);
			var boxMinY = Math.min(selectBox[1], selectBox[3]);
			var boxMaxX = Math.max(selectBox[0], selectBox[2]);
			var boxMaxY = Math.max(selectBox[1], selectBox[3]);
			
			var nodePosition, boundingRadius;
			for (var index = 0; index < nodes.length; index++) {
				nodePosition = nodes[index].position();
				boundingRadius = nodes[index]._private.data.weight / 5.0;
				
				if (nodePosition.x > boxMinX
						- boundingRadius
					&& nodePosition.x < boxMaxX 
						+ boundingRadius
					&& nodePosition.y > boxMinY 
						- boundingRadius
					&& nodePosition.y < boxMaxY 
						+ boundingRadius) {
						
					nodes[index]._private.rscratch.selected = true;		
				} else {
					nodes[index]._private.rscratch.selected = false;
				}
			}
		}
		
		hoverHandler(e);
		
		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.mouseDownHandler = function(event) {
		var mouseDownEvent = event;
	
		// Process middle button panning
		if (mouseDownEvent.button == 1
				&& mouseDownEvent.target == cy.renderer().canvas) {
		
			dragPanStartX = mouseDownEvent.clientX;
			dragPanStartY = mouseDownEvent.clientY;
			
			dragPanInitialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			//debug("mouse down");
			//$(window).bind("mousemove", dragHandler);
			
			dragPanMode = true;
		}
		
		// Left button drag selection
		if (mouseDownEvent.button == 0
				&& mouseDownEvent.target == cy.renderer().canvas) {
			
			var start = cy.renderer().projectMouse(cy.renderer(),
				mouseDownEvent.clientX,
				mouseDownEvent.clientY,
				cy.container().offset().left + 2, // container offsets
				cy.container().offset().top + 2);
			
			var nodes = cy.nodes();
			var edges = cy.edges();
			
			
			if (!shiftDown) {
				for (var index = 0; index < nodes.length; index++) {
					nodes[index]._private.rscratch.selected = false;
				}
				
				for (var index = 0; index < edges.length; index++) {
					edges[index]._private.rscratch.selected = false;
				}
			
				if (minDistanceNode != undefined) {
					minDistanceNode._private.rscratch.hovered = false;
					minDistanceNode._private.rscratch.selected = true;		
				} else if (minDistanceEdge != undefined) {
					minDistanceEdge._private.rscratch.hovered = false;
					minDistanceEdge._private.rscratch.selected = true;
				}
			}
			
			selectBox[0] = start[0];
			selectBox[1] = start[1];
			selectBox[4] = 1;
			
			if (shiftDown) {
				for (var index = 0; index < nodes.length; index++) {
					if (nodes[index]._private.rscratch.selected) {
						nodes[index]._private.rscratch.dragStartX = 
							nodes[index]._private.position.x;
						nodes[index]._private.rscratch.dragStartY =
							nodes[index]._private.position.y;
					}
				}
			}
			
			cy.renderer().redraw();
		}
	}
	
	CanvasRenderer.prototype.mouseUpHandler = function(event) {
	
		// Stop drag panning on mouseup
		dragPanMode = false;
		
		selectBox[4] = 0;
		cy.renderer().redraw();
	}
	
	CanvasRenderer.prototype.mouseWheelHandler = function(event) {
		
		event.preventDefault();
		
		console.log(event);
		
		var deltaY = event.wheelDeltaY;
		
		cy.renderer().zoomLevel -= deltaY / 5.0 / 500;
		
		//console.log("zoomLevel: " + cy.renderer().zoomLevel);
		cy.renderer().scale[0] = Math.pow(10, -cy.renderer().zoomLevel);
		cy.renderer().scale[1] = Math.pow(10, -cy.renderer().zoomLevel);
		
		
		cy.renderer().redraw();
		
		
	}
	
	CanvasRenderer.prototype.keyDownHandler = function(event) {
		if (event.keyCode == 16 && selectBox[4] != 1) {
			shiftDown = true;
		}
	}
	
	CanvasRenderer.prototype.keyUpHandler = function(event) {
		if (event.keyCode == 16) {
			selectBox[4] = 0;
			shiftDown = false;
		}
	}
	
	CanvasRenderer.prototype.mouseMoveHelper = function() {
		var dragHandler = function(mouseMoveEvent) {
			var offsetX = mouseMoveEvent.clientX - dragPanStartX;
			var offsetY = mouseMoveEvent.clientY - dragPanStartY;
			
			cy.renderer().center[0] = dragPanInitialCenter[0] - offsetX / cy.renderer().scale[0];
			cy.renderer().center[1] = dragPanInitialCenter[1] - offsetY / cy.renderer().scale[1];
		};
		
		var checkEdgeHover = function(mouseX, mouseY, edge) {
		
			var squaredDistanceLimit = 40;
		
			if ($$.math.inBezierVicinity(
					mouseX, mouseY,
					edge.source().position().x,
					edge.source().position().y,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge.target().position().x,
					edge.target().position().y,
					squaredDistanceLimit)) {
				
				//console.log("in vicinity")
				
				// edge._private.rscratch.selected = true;
				
				var squaredDistance = $$.math.sqDistanceToQuadraticBezier(
					mouseX,
					mouseY,
					edge.source().position().x,
					edge.source().position().y,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge.target().position().x,
					edge.target().position().y);

				// debug(distance);
				if (squaredDistance < squaredDistanceLimit) {
					
					if (squaredDistance < minDistanceEdgeValue) {
						minDistanceEdge = edge;
						minDistanceEdgeValue = squaredDistance;
					}
				}	
			}
		}
		
		var checkStraightEdgeHover = function(mouseX, mouseY, edge, x1, y1, x2, y2) {
			
			var squaredDistanceLimit = 40;
			
			var nearEndOffsetX = mouseX - x1;
			var nearEndOffsetY = mouseY - y1;
			
			var farEndOffsetX = mouseX - x2;
			var farEndOffsetY = mouseY - y2;
			
			var displacementX = x2 - x1;
			var displacementY = y2 - y1;
			
			var distanceSquared;
			
			if (nearEndOffsetX * displacementX 
				+ nearEndOffsetY * displacementY <= 0) {
				
					distanceSquared = (Math.pow(x1 - mouseX, 2)
						+ Math.pow(y1 - mouseY, 2));
						
			} else if (farEndOffsetX * displacementX 
				+ farEndOffsetY * displacementY >= 0) {
				
					distanceSquared = (Math.pow(x2 - mouseX, 2)
						+ Math.pow(y2 - mouseY, 2));
						
			} else {
				var rotatedX = displacementY;
				var rotatedY = -displacementX;
			
				// Use projection on rotated vector
				distanceSquared = Math.pow(nearEndOffsetX * rotatedX 
					+ nearEndOffsetY * rotatedY, 2)
					/ (rotatedX * rotatedX + rotatedY * rotatedY);
			}
			
			if (distanceSquared <= squaredDistanceLimit) {
				if (distanceSquared < minDistanceEdgeValue) {
					minDistanceEdge = edge;
					minDistanceEdgeValue = distanceSquared;
				}
			}
		}
		
		var checkNodeHover = function(mouseX, mouseY, node) {
			var dX = mouseX - node.position().x;
			var dY = mouseY - node.position().y;
			
			/*
			console.log(node._private.rscratch.boundingRadiusSquared);
			console.log(dX * dX + dY * dY);
			*/
			
			var boundingRadiusSquared = node._private.data.weight / 5.0;
			boundingRadiusSquared *= boundingRadiusSquared;
			
			var distanceSquared = dX * dX + dY * dY;
			
			if (boundingRadiusSquared > distanceSquared) {
				
				if (distanceSquared < minDistanceNodeValue) {
					minDistanceNode = node;
					minDistanceNodeValue = distanceSquared;
					
					nodeHovered = true;
				}
			}
		}
		
		// Offset for Cytoscape container
		var mouseOffsetX = this.cy.container().offset().left + 2;
		var mouseOffsetY = this.cy.container().offset().top + 2;
		
		var edges = this.cy.edges();
		var nodes = this.cy.nodes();
		var hoverHandler = function(mouseMoveEvent) {
			
			// Project mouse coordinates to world absolute coordinates
			var projected = cy.renderer().projectMouse(cy.renderer(), 
				mouseMoveEvent.clientX,
				mouseMoveEvent.clientY,
				mouseOffsetX,
				mouseOffsetY); 
			
			var mouseX = projected[0];
			var mouseY = projected[1];
			
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = false;
				minDistanceNode = undefined;
				minDistanceNodeValue = 99999;
		
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = false;
				minDistanceEdge = undefined;
				minDistanceEdgeValue = 99999;
			}
			
			nodeHovered = false;
			
			for (var index = 0; index < nodes.length; index++) {
				checkNodeHover(mouseX, mouseY, nodes[index]);
			}
			
			for (var index = 0; index < edges.length; index++) {
				if (nodeHovered) {
				
				} else if (edges[index]._private.rscratch.straightEdge) {
					checkStraightEdgeHover(mouseX, mouseY, edges[index],
						edges[index].source().position().x,
						edges[index].source().position().y,
						edges[index].target().position().x,
						edges[index].target().position().y);
						
				} else {
					checkEdgeHover(mouseX, mouseY, edges[index]);
				}
			}
			
			if (minDistanceNode != undefined) {
				minDistanceNode._private.rscratch.hovered = true;
			} else if (minDistanceEdge != undefined) {
				minDistanceEdge._private.rscratch.hovered = true;
			}
		}
		
		// Make these related functions (they reference each other) available
		this.mouseMoveHelper.dragHandler = dragHandler;
		this.mouseMoveHelper.checkEdgeHover = checkEdgeHover;
		this.mouseMoveHelper.checkStraightEdgeHover = checkStraightEdgeHover;
		this.mouseMoveHelper.checkNodeHover = checkNodeHover;
		this.mouseMoveHelper.hoverHandler = hoverHandler;
	}
	
	CanvasRenderer.prototype.load = function() {
		var self = this;
		
		this.mouseMoveHelper();
		
		document.addEventListener("keydown", this.keyDownHandler, false);
		document.addEventListener("keyup", this.keyUpHandler, false);
	
		this.canvas.addEventListener("mousedown", this.mouseDownHandler, false);
		this.canvas.addEventListener("mouseup", this.mouseUpHandler, false);
	
		this.canvas.addEventListener("mousemove", this.mouseMoveHandler, false);
		this.canvas.addEventListener("mousewheel", this.mouseWheelHandler, false);
		
		
	}
	
	CanvasRenderer.prototype.init = function() {
		
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
		this.zoomLevel = 0;
		
		
		
		
		var test1 = function(a) {
			a /= 2;
			debug(a);
		}
		
		var test2 = 3.0;
		debug(test2);
		debug(test1(test2));
		debug(test2);
		
		
				
		
	}

	CanvasRenderer.prototype.complexSqrt = function(real, imaginary, zeroThreshold) {
		var hyp = Math.sqrt(real * real 
			+ imaginary * imaginary)
	
		var gamma = Math.sqrt(0.5 * (real + hyp));
			
		var sigma = Math.sqrt(0.5 * (hyp - real));
		if (imaginary < -zeroThreshold) {
			sigma = -sigma;
		} else if (imaginary < zeroThreshold) {
			sigma = 0;
		}
		
		return [gamma, sigma];
	}

	
	

	CanvasRenderer.prototype.initStyle = function() {
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		console.log("initStyle call");
		console.log(nodes);
		
		var node;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			/*
			node._private.rscratch.boundingRadiusSquared = 
				Math.pow(node._private.style.size, 2);
				*/
			node._private.rscratch.override = {};
			
			// console.log(node._private.rscratch.override);
			
			var color = Math.max(Math.random(), 0.6);
			node._private.rscratch.override.regularColor = "rgba(" 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," 
				+ String(Math.floor(color * 100 + 125)) + "," + 255 + ")"; 
			
			//String(color * 16777215);
			node._private.rscratch.override.regularBorderColor = "rgba(" 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," 
				+ String(Math.floor(color * 70 + 160)) + "," + 255 + ")"; 
			
			var shape = Math.random();
			if (shape < 0.35) {
				node._private.rscratch.override.shape = "ellipse";
			} else if (shape < 0.49) {
				node._private.rscratch.override.shape = "hexagon";
			} else if (shape < 0.76) {
				node._private.rscratch.override.shape = "square";
			} else if (shape < 0.91) {
				node._private.rscratch.override.shape = "pentagon";
			} else {
				node._private.rscratch.override.shape = "octogon";
			}
			
			
			node._private.rscratch.canvas = document.createElement('canvas');
		}
		
		var edge;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			edge._private.rscratch.cp2x = Math.random() 
				* this.options.cy.container().width();
			edge._private.rscratch.cp2y = Math.random() 
				* this.options.cy.container().height();
			
			edge._private.rscratch.override = {};
			
			if (Math.random() < 0.45) {
				edge._private.rscratch.override.endShape = "inhibitor";
			}
			
			edge._private.rscratch.override.regularColor = 
				edge.source()[0]._private.rscratch.override.regularBorderColor
				|| defaultNode.regularColor;
		}
	}
	
	CanvasRenderer.prototype.findBezierIntersection = function(edge, targetRadius) {
		
		var x1 = edge.source().position().x;
		var x3 = edge.target().position().x;
		var y1 = edge.source().position().y;
		var y3 = edge.target().position().y;
		
		//targetRadius = 19;
		var approxParam;
		
		var cp2x = edge._private.rscratch.cp2x;
		var cp2y = edge._private.rscratch.cp2y;
		
		approxParam = 0.5 + (0.5 - 0.5 * targetRadius / Math.sqrt(
			Math.pow(cp2x - x3, 2) + Math.pow(cp2y - y3, 2)));
		
		// console.log("approxParam: " + approxParam);
		
		var aX = x1 - 2 * cp2x + x3;
		var bX = -2 * x1 + 2 * cp2x;
		var cX = x1;

		var aY = y1 - 2 * cp2y + y3;
		var bY = -2 * y1 + 2 * cp2y;
		var cY = y1;
		
		var newEndPointX = aX * approxParam * approxParam + bX * approxParam + cX;
		var newEndPointY = aY * approxParam * approxParam + bY * approxParam + cY;
		
		var tan1ax = cp2x - x1;
		var tan1bx = x1;
		
		var tan1ay = cp2y - y1;
		var tan1by = y1;
		
		
		var tan2ax = newEndPointX - x3;
		var tan2bx = x3;
		
		var tan2ay = newEndPointY - y3;
		var tan2by = y3;
		
		
		var k;
		if (Math.abs(tan1ax) > 0.0001) {
			k = (tan1ay / tan1ax * (tan2bx - tan1bx) + tan1by - tan2by)
				/ (tan2ay - (tan1ay / tan1ax) * tan2ax);
		} else {
			k = (tan1bx - tan2bx) / (tan2ax);
		}
		
		// console.log("k: " + k);
		
		var newCp2x = tan2ax * k + tan2bx;
		var newCp2y = tan2ay * k + tan2by;

		edge._private.rscratch.newCp2x = newCp2x;
		edge._private.rscratch.newCp2y = newCp2y;
		
		edge._private.rscratch.newEndPointX = newEndPointX;
		edge._private.rscratch.newEndPointY = newEndPointY;
		
		/*
		console.log(newCp2x + ", " + newCp2y);
		console.log(newEndPointX + ", " + newEndPointY);
		*/
	}
	
	CanvasRenderer.prototype.findStraightIntersection = function(edge, targetRadius) {
		var dispX = edge.target().position().x - edge.source().position().x;
		var dispY = edge.target().position().y - edge.source().position().y;
		
		var len = Math.sqrt(dispX * dispX + dispY * dispY);
		
		var newLength = len - targetRadius;
		
		if (newLength < 0) {
			newLength = 0;
		}
		
		edge._private.rscratch.newStraightEndX = 
			(newLength / len) * dispX + edge.source().position().x;
		edge._private.rscratch.newStraightEndY = 
			(newLength / len) * dispY + edge.source().position().y;
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
			
			endpoints = this.findNewEndPOints(
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
	
	arrowShapeDrawers["arrow"] = function(context) {
		context.lineTo(-0.2, 0);
		context.lineTo(0, -0.4);
		context.lineTo(0.2, 0);
	} 
	
	arrowShapeDrawers["inhibitor"] = function(context) {
		context.scale(1, 0.5);
		context.lineTo(-1.5, 0);
		context.lineTo(-1.5, -0.1);
		context.lineTo(1.5, -0.1);
		context.lineTo(1.5, 0);
	}
	
	CanvasRenderer.prototype.drawArrowShape = function(edge, x, y, dispX, dispY) {
		var angle = Math.asin(dispY / (Math.sqrt(dispX * dispX + dispY * dispY)));
		
		// console.log(angle);
				
		
		if (dispX < 0) {
			//context.strokeStyle = "AA99AA";
			angle = angle + Math.PI / 2;
		} else {
			//context.strokeStyle = "AAAA99";
			angle = - (Math.PI / 2 + angle);
		}
		
		var context = this.context;
		
		context.save();
		
		context.translate(x, y);
		
		context.moveTo(0, 0);
		context.rotate(-angle);
		context.scale(2, 2.1);
		context.beginPath();
		
		arrowShapeDrawers[
			edge._private.rscratch.override.endShape || defaultEdge.endShape](context);
		
		context.closePath();
		
		context.stroke();
		context.restore();
	}
	
	CanvasRenderer.prototype.drawArrowhead = function(edge) {
		
		var endShape = edge._private.rscratch.override.endShape;
		endShape = endShape ? endShape : defaultEdge.endShape;
		
		/*
		var dispX = edge.target().position().x - edge._private.rscratch.newEndPointX;
		var dispY = edge.target().position().y - edge._private.rscratch.newEndPointY;
		*/
				
		this.drawArrowShape(edge, edge._private.rscratch.newEndPointX, 
			edge._private.rscratch.newEndPointY, dispX, dispY);
	}
	
	CanvasRenderer.prototype.drawStraightArrowhead = function(edge) {
		
		var dispX = edge.target().position().x 
			- edge._private.rscratch.newStraightEndX;
		var dispY = edge.target().position().y 
			- edge._private.rscratch.newStraightEndY;
		
		this.drawArrowShape(edge, edge._private.rscratch.newStraightEndX,
			edge._private.rscratch.newStraightEndY,
			dispX, dispY);
	}
	
	
	CanvasRenderer.prototype.calculateEdgeMetrics = function(edge) {
		if (edge._private.data.source == edge._private.data.target) {
			edge._private.rscratch.selfEdge = true;
			return;
		}
		
		// Calculate the 2nd control point
		var startNode = edge._private.data.source < edge._private.data.target ?
			edge.source()[0] : edge.target()[0];
		var endNode = edge._private.data.target < edge._private.data.source ? 
			edge.source()[0] : edge.target()[0];
		
		var middlePointX = 0.5 * (startNode._private.position.x + endNode._private.position.x);
		var middlePointY = 0.5 * (startNode._private.position.y + endNode._private.position.y);
		
		if (this.nodePairEdgeData[edge._private.rscratch.nodePairId] == 1) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			//console.log(edge._private.rscratch.cp2x + ", " + edge._private.rscratch.cp2y);
			return;
		}
	
		/*
		console.log(startNode._private);
		console.log(endNode._private);
		*/
		
		var numerator = edge._private.rscratch.nodePairEdgeNum - 1;
		var denominator = this.nodePairEdgeData[edge._private.rscratch.nodePairId] - 1;
		var offsetFactor = (numerator / denominator - 0.5);
		
		if (Math.abs(offsetFactor) < 0.0001) {
			edge._private.rscratch.straightEdge = true;
			edge._private.rscratch.cp2x = middlePointX;
			edge._private.rscratch.cp2y = middlePointY;
			//console.log(edge._private.rscratch.cp2x + ", " + edge._private.rscratch.cp2y);
			return;
		}
		
			
		var displacementX = endNode._private.position.x - startNode._private.position.x;
		var displacementY = endNode._private.position.y - startNode._private.position.y;
		
		var offsetX = displacementY * offsetFactor;
		var offsetY = -displacementX * offsetFactor;
		
		edge._private.rscratch.cp2x = middlePointX + offsetX;
		edge._private.rscratch.cp2y = middlePointY + offsetY;
	}
	
	nodeShapeDrawers["ellipse"] = function(node, size) {
		var context = cy.renderer().context;
	
		context.beginPath();
		context.arc(node._private.position.x, node._private.position.y,
			size, 0, Math.PI * 2, false);
		context.closePath();
		context.fill();
		
	}
	
	nodeShapeDrawers["triangle"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 3, width, height);
	}
	
	nodeShapeDrawers["square"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 4, width, height);
	}
	
	nodeShapeDrawers["pentagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 5, width, height);
	}
	
	nodeShapeDrawers["hexagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 6, width, height);
	}
	
	nodeShapeDrawers["heptagon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 7, width, height);
	}
	
	nodeShapeDrawers["octogon"] = function(node, width, height) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 8, width, height);
	}
	
	CanvasRenderer.prototype.drawNgon = function(x, y, sides, width, height) {
		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		var increment = 1 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0? Math.PI / 2 + increment / 2 : Math.PI / 2;
		
		context.scale(width / 2, height / 2);
		
		context.moveTo(Math.cos(startAngle), -Math.sin(startAngle));
		for (var angle = startAngle; 
			angle < startAngle + 2 * Math.PI; angle += increment) {
		
			context.lineTo(Math.cos(angle), -Math.sin(angle));
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}
	
	CanvasRenderer.prototype.redraw = function() {
		// console.log("draw call");
		// this.initStyle();
		//this.findEdgeMetrics(this.options.cy.edges());
		this.findEdgeControlPoints(this.options.cy.edges());
	
		var context = this.context;
		
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, this.options.cy.container().width(),
			this.options.cy.container().height());
		
		context.translate(this.zoomCenter[0], 
			this.zoomCenter[1]);
		
		context.scale(this.scale[0], this.scale[1])
		context.translate(-this.center[0], -this.center[1])
		
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var edge;
		var styleValue;
				
		var startNode, endNode;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			if (edge._private.style["visibility"].value != "visible") {
				continue;
			}
			
			startNode = edge.source()[0];
			endNode = edge.target()[0];
			
			if (edge._private.rscratch.selected) {
				styleValue = edge._private.rscratch.override.selectedColor;
				context.strokeStyle = styleValue != undefined ? styleValue 
					: defaultEdge.selectedColor;
			} else {
				if (edge._private.rscratch.hovered) {
					styleValue = edge._private.rscratch.override.hoveredColor;
					context.strokeStyle = styleValue != undefined ? styleValue 
						: defaultEdge.hoveredColor;
				} else {
					// Edge color & opacity
					styleValue = "rgba(" + edge._private.style.color.value[0] + ","
						+ edge._private.style.color.value[1] + ","
						+ edge._private.style.color.value[2] + ","
						+ edge._private.style.opacity.value + ")";
					
					context.strokeStyle = styleValue != undefined ? styleValue 
						: defaultEdge.regularColor;
				}
			}
			
			// Edge line width
			context.lineWidth = edge._private.style.width.value * 3.5;
			context.beginPath();
			
			context.moveTo(startNode._private.position.x, startNode._private.position.y);

			this.calculateEdgeMetrics(edge);
			
			if (edge._private.rscratch.isStraightEdge) {
				this.findStraightIntersection(edge, 
					endNode._private.data.weight / 5.0 + 12);
				
				context.lineTo(edge._private.rscratch.newStraightEndX, 
					edge._private.rscratch.newStraightEndY);
				context.stroke();
				
				// ***
				// this.drawStraightArrowhead(edge);
				
			} else if (edge._private.rscratch.selfEdge) {
				
			} else {
				this.findBezierIntersection(edge, endNode._private.data.weight / 5.0 + 12);
			
				/*
				context.quadraticCurveTo(edge._private.rscratch.newCp2x, 
					edge._private.rscratch.newCp2y, edge._private.rscratch.newEndPointX, 
					edge._private.rscratch.newEndPointY);
				*/
				
				context.quadraticCurveTo(edge._private.rscratch.controlPointX, 
					edge._private.rscratch.controlPointY, endNode._private.position.x, 
					endNode._private.position.y);
				context.stroke();
				
				// ***
				// this.drawArrowhead(edge);
			}
		}
		
		var node;
		var labelStyle, labelSize, labelFamily, labelVariant, labelWeight;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			if (node._private.style["visibility"].value != "visible") {
				continue;
			}
			
			if (node._private.rscratch.selected == true) {
				styleValue = node._private.rscratch.override.selectedColor;
				context.fillStyle = styleValue != undefined ? styleValue : defaultNode.selectedColor;
				
				styleValue = node._private.rscratch.override.selectedBorderColor;
				context.strokeStyle = styleValue != undefined? styleValue : defaultNode.selectedBorderColor;
			} else {
				if (node._private.rscratch.hovered == true) {
					styleValue = node._private.rscratch.override.hoveredColor;
					context.fillStyle = styleValue != undefined ? styleValue : defaultNode.hoveredColor;
					
					styleValue = node._private.rscratch.override.hoveredBorderColor;
					context.strokeStyle = styleValue != undefined? styleValue : defaultNode.hoveredBorderColor;
				} else {
					// Node color & opacity
					styleValue = "rgba(" + node._private.style["background-color"].value[0] + ","
						+ node._private.style["background-color"].value[1] + ","
						+ node._private.style["background-color"].value[2] + ","
						+ (node._private.style["background-opacity"].value 
						* node._private.style["opacity"].value) + ")";
						
					context.fillStyle = styleValue != undefined ? styleValue : defaultNode.regularColor;
					
					// Node border color & opacity
					styleValue = "rgba(" + node._private.style["border-color"].value[0] + ","
						+ node._private.style["border-color"].value[1] + ","
						+ node._private.style["border-color"].value[2] + ","
						+ (node._private.style["border-opacity"].value 
						* node._private.style["opacity"].value) + ")";	
					context.strokeStyle = styleValue != undefined? styleValue : defaultNode.regularBorderColor;
			
				}
			}
			
			nodeShapeDrawers[node._private.rscratch.override.shape|| defaultNode.shape](
				node, 
				node._private.style["width"].value, 
				node._private.style["height"].value); //node._private.data.weight / 5.0
			
			// console.log(node._private.style["shape"].value);
			
			// Node border width			
			styleValue = node._private.style["border-width"].value;
			context.lineWidth = styleValue != undefined? styleValue : defaultNode.borderWidth;
			context.stroke();
			
			// Node font style
			styleValue = node._private.rscratch.override.labelFontStyle;
			labelStyle = node._private.style["font-style"].strValue || defaultNode.labelFontStyle;
			labelSize = node._private.style["font-size"].strValue || defaultNode.labelFontSize;
			labelFamily = node._private.style["font-family"].strValue || defaultNode.labelFontFamily;
			labelVariant = node._private.style["font-variant"].strValue;
			labelWeight = node._private.style["font-weight"].strValue;
						
			//console.log(labelStyle + " " + labelSize + " " + labelFamily);
			context.font = labelStyle + " " + labelVariant + " " + labelWeight + " " 
				+ labelSize + " " + labelFamily;
			context.textAlign = node._private.rscratch.override.labelTextAlign || defaultNode.labelTextAlign;
			
			context.fillStyle = "rgba(" + node._private.style["color"].value[0] + ","
						+ node._private.style["color"].value[1] + ","
						+ node._private.style["color"].value[2] + ","
						+ node._private.style["opacity"].value + ")";
						
			var text = String(node._private.style["content"].value);
			var textTransform = node._private.style["text-transform"].value;
			
			if (textTransform == "none") {
			} else if (textTransform == "uppercase") {
				text = text.toUpperCase();
			} else if (textTransform == "lowercase") {
				text = text.toLowerCase();
			}
			
			context.fillText(text, node._private.position.x, 
				node._private.position.y - node._private.data.weight / 5.0 - 4);
			
		}
		
		if (!shiftDown && selectBox[4] == 1) {
			context.lineWidth = 0.001;
		
			context.strokeStyle = "rgba(15,15,15,0.5)";
			context.strokeRect(selectBox[0],
				selectBox[1],
				selectBox[2] - selectBox[0],
				selectBox[3] - selectBox[1]);
				
			context.fillStyle = "rgba(155,255,155,0.1)";
			context.fillRect(selectBox[0],
				selectBox[1],
				selectBox[2] - selectBox[0],
				selectBox[3] - selectBox[1]);
		}
	};
	
	CanvasRenderer.prototype.zoom = function(params){
		// debug(params);
		if (params != undefined && params.level != undefined) {
		
			this.scale[0] = params.level;
			this.scale[1] = params.level;
		}
	};
	
	CanvasRenderer.prototype.fit = function(params){
	
	};
	
	CanvasRenderer.prototype.pan = function(params){
		//debug("pan called:");
		//debug(params);
		
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
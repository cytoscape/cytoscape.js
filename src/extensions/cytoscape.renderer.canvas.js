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
	var selectBox = [0, 0, 0, 0, 0];
	var dragPanMode = false;
	
	var shiftDown = false;
	
	var nodeHovered = false;
	
	var minDistanceEdge;
	var minDistanceEdgeValue = 999;
	
	var minDistanceNode;
	var minDistanceNodeValue = 999;
	
	var arrowShapeDrawers = {};
	var nodeShapeDrawers = {};
	
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
	
	
	CanvasRenderer.prototype.checkStraightEdgeCrossesBox2 = function(x1box, 
		y1box, x2box, y2box, x1, y1, x2, y2, tolerance) {
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		// Check left + right bounds
		var aX = x2 - x1;
		var bX = x1;
		
		if (Math.abs(aX) < 0.0001) {
			return false;
		}
		
		var tLeft = (boxMinX - bX) / aX;
		if (tLeft > 0 && tLeft <= 1) {
			//return true;
		}
		
		var tRight = (boxMaxX - bX) / aX;
		if (tRight > 0 && tRight <= 1) {
			//return true;
		}
		
		// Top and bottom
		var aY = y2 - y1;
		var bY = y1;
		
		if (Math.abs(aY) < 0.0001) {
			return false;
		}
		
		
		var tTop = (boxMinY - bY) / aY;
		if (tTop > 0 && tTop <= 1) {
			//return true;
		}
		
		var tBottom = (boxMaxY - bY) / aY;
		if (tBottom > 0 && tBottom <= 1) {
			//return true;
		}
		
		if (((tLeft > 0 && tLeft <= 1) || (tRight > 0 && tRight <= 1))
			&& ((tTop > 0 && tTop <= 1) || (tBottom > 0 && tBottom <= 1))) {
			
			return true;
		}
		
		return false;
	}
	
		
	CanvasRenderer.prototype.load = function() {
		var self = this;
	
		$(window).keydown(function(e) { 
			if (e.keyCode == 16 && selectBox[4] != 1) {
				shiftDown = true;
			}
		});
		
		$(window).keyup(function(e) { 
			if (e.keyCode == 16) {
				selectBox[4] = 0;
				shiftDown = false;
			}
		});
	
		var startX, startY;
		var initialCenter = [this.center[0], this.center[1]];
		
		$(window).bind("mousedown", function(mouseDownEvent) {
			if (mouseDownEvent.button != 1) {
				return;
			}
			
			if (mouseDownEvent.target != cy.renderer().canvas) {
				return;
			}
			
			startX = mouseDownEvent.clientX;
			startY = mouseDownEvent.clientY;
			
			initialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			//debug("mouse down");
			//$(window).bind("mousemove", dragHandler);
			
			dragPanMode = true;
		
			debug(mouseDownEvent);
		});

		var dragHandler = function(mouseMoveEvent) {
			//debug("mouseDrag");
			//debug(mouseMoveEvent);
			//debug("start: (" + startX + ", " + startY + ")");
			
			var offsetX = mouseMoveEvent.clientX - startX;
			var offsetY = mouseMoveEvent.clientY - startY;
			
			cy.renderer().center[0] = initialCenter[0] - offsetX / cy.renderer().scale[0];
			cy.renderer().center[1] = initialCenter[1] - offsetY / cy.renderer().scale[1];	
			// cy.renderer().redraw();
		};
		
		$(window).bind("mouseup", function(mouseUpEvent) {
			/*
			debug("mouse up");
			debug(mouseUpEvent);
			*/
			//$(window).unbind("mousemove", dragHandler);
			
			dragPanMode = false;
		});
		
		$(window).bind("mousewheel", function(event, delta, deltaX, deltaY){
			
			/*
			console.log("mousewheel");
			console.log(event);
			console.log(delta);
			console.log(deltaX);
			console.log(deltaY);
			*/
			
			event.preventDefault();
			
			cy.renderer().zoomLevel -= deltaY / 5.0;
			
			//console.log("zoomLevel: " + cy.renderer().zoomLevel);
			cy.renderer().scale[0] = Math.pow(10, -cy.renderer().zoomLevel);
			cy.renderer().scale[1] = Math.pow(10, -cy.renderer().zoomLevel);
			
			
			cy.renderer().redraw();
			// self.zoomAboutPoint(point, zoom);
			/*
			self.cy.trigger("zoom");
			self.cy.trigger("pan");
			*/
		});
	
		var checkEdgeHover = function(mouseX, mouseY, edge) {
		
			var squaredDistanceLimit = 40;
		
			if (self.inBezierVicinity(
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
				
				var squaredDistance = cy.renderer().sqDistanceToQuadraticBezier(
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
		
		
		
		var edges = self.cy.edges();
		var nodes = self.cy.nodes();
		var hoverHandler = function(mouseMoveEvent) {
			/*
			var mouseX = mouseMoveEvent.clientX - mouseOffsetX;
			var mouseY = mouseMoveEvent.clientY - mouseOffsetY;
			*/
			
			// Project mouse coordinates to world absolute coordinates
			var projected = self.projectMouse(self, 
				mouseMoveEvent.clientX,
				mouseMoveEvent.clientY,
				mouseOffsetX,
				mouseOffsetY); 
			
			var mouseX = projected[0];
			var mouseY = projected[1];
			
			/*
			mouseX -= self.options.cy.container().width() / 2;
			mouseY -= self.options.cy.container().height() / 2;
			
			mouseX /= self.scale[0];
			mouseY /= self.scale[1];
			
			mouseX += self.center[0];
			mouseY += self.center[1];
			*/
			
			/*
			var xOffsetFromCenter = mouseX - self.options.cy.container().width() / 2;
			var yOffsetFromCenter = mouseY - self.options.cy.container().height() / 2;
			
			//console.log(self.scale[0]);
			xOffsetFromCenter /= self.scale[0];
			yOffsetFromCenter /= self.scale[1];
			
			mouseX = self.options.cy.container().width() / 2 + xOffsetFromCenter;
			mouseY = self.options.cy.container().height() / 2 + yOffsetFromCenter;
			*/
			
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
		
		var timeout;
		$(window).bind("mousemove", function(e){
			if( timeout ){ return }
		
			timeout = setTimeout(function(){
				timeout = null;		
			}, 1000/80);
			
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
				
					var boxInBezierVicinity = cy.renderer().boxInBezierVicinity(
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
								cy.renderer().checkStraightEdgeCrossesBox(
									selectBox[0], selectBox[1],
									selectBox[2], selectBox[3],
									edges[index].source().position().x,
									edges[index].source().position().y,
									edges[index].target().position().x,
									edges[index].target().position().y, padding);
							
						} else {
							
							edges[index]._private.rscratch.selected = 
								cy.renderer().checkBezierCrossesBox(
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
			
			self.redraw();
		});
		
		/*
		// Offset for Cytoscape container
		var mouseOffsetX = this.cy.container().offset().left + 2;
		var mouseOffsetY = this.cy.container().offset().top + 2;
		*/
		
		/*
		//var startX = mouseDownEvent.
		var selectHandler = function(mouseMoveEvent) {
			var current = cy.renderer().projectMouse(cy.renderer(),
				mouseMoveEvent.clientX,
				mouseMoveEvent.clientY,
				mouseOffsetX,
				mouseOffsetY);
			
			selectBox[2] = current[0];
			selectBox[3] = current[1];
		};
		*/
		
		$(window).bind("mousedown", function(mouseDownEvent) {
			if (mouseDownEvent.button != 0) {
				return;
			}
			
			if (mouseDownEvent.target != cy.renderer().canvas) {
				return;
			}
			
			var start = cy.renderer().projectMouse(cy.renderer(),
				mouseDownEvent.clientX,
				mouseDownEvent.clientY,
				mouseOffsetX,
				mouseOffsetY);
			
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
		});
		
		$(window).bind("mouseup", function(e) {
			//$(window).unbind("mousemove", selectHandler);
			selectBox[4] = 0;
			
			dragPanMode = false;
			
			
			cy.renderer().redraw();
		});
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
		
		/*
		var tan2ax = cp2x - x3;
		var tan2bx = x3;
		
		var tan2ay = cp2y - y3;
		var tan2by = y3;
		*/
		
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
		
		var dispX = edge.target().position().x - edge._private.rscratch.newEndPointX;
		var dispY = edge.target().position().y - edge._private.rscratch.newEndPointY;
		
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
	
	nodeShapeDrawers["triangle"] = function(node, size) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 3, size);
	}
	
	nodeShapeDrawers["square"] = function(node, size) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 4, size);
	}
	
	nodeShapeDrawers["pentagon"] = function(node, size) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 5, size);
	}
	
	nodeShapeDrawers["hexagon"] = function(node, size) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 6, size);
	}
	
	nodeShapeDrawers["heptagon"] = function(node, size) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 7, size);
	}
	
	nodeShapeDrawers["octogon"] = function(node, size) {
		cy.renderer().drawNgon(node._private.position.x,
			node._private.position.y, 8, size);
	}
	
	CanvasRenderer.prototype.drawNgon = function(x, y, sides, size) {
		var context = cy.renderer().context;
		context.save();
		context.translate(x, y);
		context.beginPath();
		
		var increment = 1 / sides * 2 * Math.PI;
		var startAngle = sides % 2 == 0? Math.PI / 2 + increment / 2 : Math.PI / 2;
		
		context.moveTo(Math.cos(startAngle) * size, -Math.sin(startAngle) * size);
		for (var angle = startAngle; 
			angle < startAngle + 2 * Math.PI; angle += increment) {
		
			context.lineTo(Math.cos(angle) * size, -Math.sin(angle) * size);
		}
		
		context.closePath();
		context.fill();
		
		context.restore();
	}
	
	CanvasRenderer.prototype.redraw = function() {
		// console.log("draw call");
		// this.initStyle();
		this.findEdgeMetrics(this.options.cy.edges());
	
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
		
		//debug("draw called");
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var edge;
		var styleValue;
		
		
		var startNode, endNode;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
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
					styleValue = edge._private.rscratch.override.regularColor;
					context.strokeStyle = styleValue != undefined ? styleValue 
						: defaultEdge.regularColor;
				}
			}
			
			context.lineWidth = edge._private.data.weight / 26.0;
			context.beginPath();
			
			context.moveTo(startNode._private.position.x, startNode._private.position.y);
			

			this.calculateEdgeMetrics(edge);
			
			if (edge._private.rscratch.straightEdge) {
				this.findStraightIntersection(edge, 
					endNode._private.data.weight / 5.0 + 12);
				
				context.lineTo(edge._private.rscratch.newStraightEndX, 
					edge._private.rscratch.newStraightEndY);
				context.stroke();
				
				this.drawStraightArrowhead(edge);
				
			} else if (edge._private.rscratch.selfEdge) {
				
			} else {
				this.findBezierIntersection(edge, endNode._private.data.weight / 5.0 + 12);
			
				context.quadraticCurveTo(edge._private.rscratch.newCp2x, 
					edge._private.rscratch.newCp2y, edge._private.rscratch.newEndPointX, 
					edge._private.rscratch.newEndPointY);
				context.stroke();
				
				this.drawArrowhead(edge);
			}
			
			
			//context.lineTo(endNode._private.position.x, endNode._private.position.y);
			
		}
		
		
		var node, labelStyle, labelSize, labelFamily;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
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
					styleValue = node._private.rscratch.override.regularColor;
					context.fillStyle = styleValue != undefined ? styleValue : defaultNode.regularColor;
					
					styleValue = node._private.rscratch.override.regularBorderColor;
					context.strokeStyle = styleValue != undefined? styleValue : defaultNode.regularBorderColor;
			
				}
			}
			
			nodeShapeDrawers[node._private.rscratch.override.shape || defaultNode.shape](node, node._private.data.weight / 5.0);
			
			/*
			context.beginPath();
			context.arc(node._private.position.x, node._private.position.y,
				node._private.data.weight / 5.0, 0, Math.PI * 2, false);
			context.closePath();
			context.fill();
			
			styleValue = node._private.rscratch.override.borderWidth;
			context.lineWidth = styleValue != undefined? styleValue : defaultNode.borderWidth;
			
			context.stroke();
			*/
			
			styleValue = node._private.rscratch.override.borderWidth;
			context.lineWidth = styleValue != undefined? styleValue : defaultNode.borderWidth;
			context.stroke();
			
			styleValue = node._private.rscratch.override.labelFontStyle;
			
			labelStyle = node._private.rscratch.override.labelFontStyle || defaultNode.labelFontStyle;
			labelSize = node._private.rscratch.override.labelFontSize || defaultNode.labelFontSize;
			labelFamily = node._private.rscratch.override.labelFontFamily || defaultNode.labelFontFamily;
			
			context.font = labelStyle + " " + labelSize + " " + labelFamily;
			context.textAlign = node._private.rscratch.override.labelTextAlign || defaultNode.labelTextAlign;
			
			context.fillStyle = node._private.rscratch.override.labelTextColor || defaultNode.labelTextColor;
			context.fillText(String(node.id()), 
				node._private.position.x, node._private.position.y - node._private.data.weight / 5.0 - 4);
			
		}
		
		
		/*
		context.fillStyle = "#5555AA";
		context.beginPath();
		context.arc(debugStats.clickX, debugStats.clickY,
			5.0, 0, Math.PI * 2, false);
		context.closePath();
		context.fill();
		*/
		
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
		
		/*
		context.fillStyle = "#775555";
		context.beginPath();
		context.arc(debugStats.closestX, debugStats.closestY,
			5.0, 0, Math.PI * 2, false);
		context.closePath();
		context.fill();
		*/
	};
	
	CanvasRenderer.prototype.zoom = function(params){
		// debug(params);
		if (params != undefined && params.level != undefined) {
		
			this.scale[0] = params.level;
			this.scale[1] = params.level;
			
			/*
			this.transform[4] = this.transform[4] - 300 * params.level;
			this.transform[5] = this.transform[5] - 300 * params.level;
			*/
		}
		
		// this.redraw();
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
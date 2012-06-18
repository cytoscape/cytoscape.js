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
		
		widthFactor: 1 / 26.0,
	};
	
	var debugStats = {};
	var selectBox = [0, 0, 0, 0, 0];
	var dragPanMode = false;
	
	var shiftDown = false;
	
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
	
	CanvasRenderer.prototype.boxInBezierVicinity = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) {
			return 2;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) {
			return 2;
		} else if (x2 >= boxMinX && x2 <= boxMaxX && y2 >= boxMinY && y2 <= boxMaxY) { 
			return 1;
		}
		
		var curveMinX = Math.min(x1, x2, x3);
		var curveMinY = Math.min(y1, y2, y3);
		var curveMaxX = Math.max(x1, x2, x3);
		var curveMaxY = Math.max(y1, y2, y3);
		
		if (curveMinX > boxMaxX
			|| curveMaxX < boxMinX
			|| curveMinY > boxMaxY
			|| curveMaxY < boxMinY) {
			
			return 0;	
		}
		
		return 1;
	}
	
	CanvasRenderer.prototype.checkBezierCrossesBox = function(
		x1box, y1box, x2box, y2box, x1, y1, x2, y2, x3, y3, tolerance) {
		
		var boxMinX = Math.min(x1box, x2box) - tolerance;
		var boxMinY = Math.min(y1box, y2box) - tolerance;
		var boxMaxX = Math.max(x1box, x2box) + tolerance;
		var boxMaxY = Math.max(y1box, y2box) + tolerance;
		
		if (x1 >= boxMinX && x1 <= boxMaxX && y1 >= boxMinY && y1 <= boxMaxY) {
			return true;
		} else if (x3 >= boxMinX && x3 <= boxMaxX && y3 >= boxMinY && y3 <= boxMaxY) {
			return true;
		}
		
		var aX = x1 - 2 * x2 + x3;
		var bX = -2 * x1 + 2 * x2;
		var cX = x1;

		var xIntervals = [];
		
		// Find when x coordinate of the curve crosses the left side of the box
		var discriminantX1 = bX * bX - 4 * aX * (cX - boxMinX);
		var tX1, tX2;
		if (discriminantX1 > 0) {
			var sqrt = Math.sqrt(discriminantX1);
			tX1 = (-bX + sqrt) / (2 * aX);
			tX2 = (-bX - sqrt) / (2 * aX);
			
			xIntervals.push(tX1, tX2);
		}
		
		var discriminantX2 = bX * bX - 4 * aX * (cX - boxMaxX);
		var tX3, tX4;
		if (discriminantX2 > 0) {
			var sqrt = Math.sqrt(discriminantX2);
			tX3 = (-bX + sqrt) / (2 * aX);
			tX4 = (-bX - sqrt) / (2 * aX);
			
			xIntervals.push(tX3, tX4);
		}
		
		xIntervals.sort(function(a, b) { return a - b; });

		
		var aY = y1 - 2 * y2 + y3;
		var bY = -2 * y1 + 2 * y2;
		var cY = y1;
		
		var discriminantY1 = bY * bY - 4 * aY * (cY - boxMinY);
		var yIntervals = [];
		
		var tY1, tY2;
		if (discriminantY1 > 0) {
			var sqrt = Math.sqrt(discriminantY1);
			tY1 = (-bY + sqrt) / (2 * aY);
			tY2 = (-bY - sqrt) / (2 * aY);
			
			yIntervals.push(tY1, tY2);
		}
		
		var discriminantY2 = bY * bY - 4 * aY * (cY - boxMaxY);
		
		var tY3, tY4;
		if (discriminantY2 > 0) {
			var sqrt = Math.sqrt(discriminantY2);
			tY3 = (-bY + sqrt) / (2 * aY);
			tY4 = (-bY - sqrt) / (2 * aY);
			
			yIntervals.push(tY3, tY4);
		}
		
		yIntervals.sort(function(a, b) { return a - b; });

		for (var index = 0; index < xIntervals.length; index += 2) {
			for (var yIndex = 1; yIndex < yIntervals.length; yIndex += 2) {
				
				// Check if there exists values for the Bezier curve
				// parameter between 0 and 1 where both the curve's
				// x and y coordinates are within the bounds specified by the box
				if (xIntervals[index] < yIntervals[yIndex]
					&& yIntervals[yIndex] >= 0.0
					&& xIntervals[index] <= 1.0
					&& xIntervals[index + 1] > yIntervals[yIndex - 1]
					&& yIntervals[yIndex - 1] <= 1.0
					&& xIntervals[index + 1] >= 0.0) {
					
					return true;
				}
			}
		}
		
		return false;
	}
	
	CanvasRenderer.prototype.inBezierVicinity = function(
		x, y, x1, y1, x2, y2, x3, y3, toleranceSquared) {
		
		// Middle point occurs when t = 0.5, this is when the Bezier
		// is closest to (x2, y2)
		var middlePointX = 0.25 * x1 + 0.5 * x2 + 0.25 * x3;
		var middlePointY = 0.25 * y1 + 0.5 * y2 + 0.25 * y3;
		
		var displacementX, displacementY, offsetX, offsetY;
		var dotProduct, dotSquared, hypSquared;
		var outside = function(x, y, startX, startY, endX, endY,
				toleranceSquared, counterClockwise) {

			dotProduct = (endY - startY) * (x - startX) + (startX - endX) * (y - startY);
			dotSquared = dotProduct * dotProduct;
			sideSquared = (endY - startY) * (endY - startY) 
				+ (startX - endX) * (startX - endX);

			if (counterClockwise) {
				if (dotProduct > 0) {
					return false;
				}
			} else {
				if (dotProduct < 0) {
					return false;
				}
			}
			
			return (dotSquared / sideSquared > toleranceSquared);
		};
		
		// Used to check if the test polygon winding is clockwise or counterclockwise
		var testPointX = (middlePointX + x2) / 2.0;
		var testPointY = (middlePointY + y2) / 2.0;
		
		var counterClockwise = true;
		
		// The test point is always inside
		if (outside(testPointX, testPointY, x1, y1, x2, y2, 0, counterClockwise)) {
			counterClockwise = !counterClockwise;
		}
		
		/*
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, middlePointX, middlePointY, toleranceSquared,
				counterClockwise)
			&& !outside(x, y, middlePointX, middlePointY, x1, y1, toleranceSquared,
				counterClockwise)
		);
		*/
		
		return (!outside(x, y, x1, y1, x2, y2, toleranceSquared, counterClockwise)
			&& !outside(x, y, x2, y2, x3, y3, toleranceSquared, counterClockwise)
			&& !outside(x, y, x3, y3, x1, y1, toleranceSquared,
				counterClockwise)
		);
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
				
				var distance = cy.renderer().sqDistanceToQuadraticBezier(
					mouseX,
					mouseY,
					edge.source().position().x,
					edge.source().position().y,
					edge._private.rscratch.cp2x,
					edge._private.rscratch.cp2y,
					edge.target().position().x,
					edge.target().position().y);

				// debug(distance);
				if (distance < squaredDistanceLimit) {
					edge._private.rscratch.hovered = true;
				} else {
					edge._private.rscratch.hovered = false;
				}	
			} else {
		
				edge._private.rscratch.hovered = false;
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
			
			if (boundingRadiusSquared > (dX * dX + dY * dY)) {
				
				node._private.rscratch.hovered = true;	
			} else {
				node._private.rscratch.hovered = false;
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
			
			for (var index = 0; index < edges.length; index++) {
				checkEdgeHover(mouseX, mouseY, edges[index]);
			}
			
			for (var index = 0; index < nodes.length; index++) {
				checkNodeHover(mouseX, mouseY, nodes[index]);
			}
			
			// self.redraw();
			// debug("hover");
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
						
			if (!shiftDown && selectBox[4] == 1) {
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
						
					if (boxInBezierVicinity != 0 
						&& (boxInBezierVicinity == 2
							|| cy.renderer().checkBezierCrossesBox(
								selectBox[0], selectBox[1],
								selectBox[2], selectBox[3],
								edges[index].source().position().x,
								edges[index].source().position().y,
								edges[index]._private.rscratch.cp2x,
								edges[index]._private.rscratch.cp2y,
								edges[index].target().position().x,
								edges[index].target().position().y, padding))) {
							
						edges[index]._private.rscratch.selected = true;	
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
					boundingRadius = Math.sqrt(nodes[index]._private.data.weight / 5.0);
					
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
			//$(window).bind("mousemove", selectHandler);
			
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

	// Solves a cubic function, returns root in form [r1, i1, r2, i2, r3, i3], where
	// r is the real component, i is the imaginary component
	CanvasRenderer.prototype.solveCubic = function(a, b, c, d, result) {
		// Routines from: http://www3.telus.net/thothworks/Quad3Deg.html
		//
		// Seems to be an implementation of the Cardano method at 
		// http://en.wikipedia.org/wiki/Cubic_function#The_nature_of_the_roots
		
		// Get rid of a
		b /= a;
		c /= a;
		d /= a;
		
		var discrim, q, r, dum1, s, t, term1, r13;

		q = (3.0*c - (b*b))/9.0;
		r = -(27.0*d) + b*(9.0*c - 2.0*(b*b));
		r /= 54.0;
		
		discrim = q*q*q + r*r;
		result[1] = 0; //The first root is always real.
		term1 = (b/3.0);
		
		if (discrim > 0) { // one root real, two are complex
			s = r + Math.sqrt(discrim);
			s = ((s < 0) ? -Math.pow(-s, (1.0/3.0)) : Math.pow(s, (1.0/3.0)));
			t = r - Math.sqrt(discrim);
			t = ((t < 0) ? -Math.pow(-t, (1.0/3.0)) : Math.pow(t, (1.0/3.0)));
			result[0] = -term1 + s + t;
			term1 += (s + t)/2.0;
			result[4] = result[2] = -term1;
			term1 = Math.sqrt(3.0)*(-t + s)/2;
			result[3] = term1;
			result[5] = -term1;
			return;
		} // End if (discrim > 0)
		
		// The remaining options are all real
		result[5] = result[3] = 0;
		
		if (discrim == 0){ // All roots real, at least two are equal.
			r13 = ((r < 0) ? -Math.pow(-r,(1.0/3.0)) : Math.pow(r,(1.0/3.0)));
			result[0] = -term1 + 2.0*r13;
			result[4] = result[2] = -(r13 + term1);
			return;
		} // End if (discrim == 0)
		
		// Only option left is that all roots are real and unequal (to get here, q < 0)
		q = -q;
		dum1 = q*q*q;
		dum1 = Math.acos(r/Math.sqrt(dum1));
		r13 = 2.0*Math.sqrt(q);
		result[0] = -term1 + r13*Math.cos(dum1/3.0);
		result[2] = -term1 + r13*Math.cos((dum1 + 2.0*Math.PI)/3.0);
		result[4] = -term1 + r13*Math.cos((dum1 + 4.0*Math.PI)/3.0);
		return;
	}

	CanvasRenderer.prototype.sqDistanceToQuadraticBezier = function(x, y, 
		x1, y1, x2, y2, x3, y3) {
		
		// Calculate coefficients of derivative of square distance function
		
		// The plan is to find the minima of the distance function.
		
		
		// Note this gives actual coefficients divided by 4 for simplification,
		// and we don't need the 4 as equation is 0 on right side
		
		var a = 1.0 * x1*x1 - 4*x1*x2 + 2*x1*x3 + 4*x2*x2 - 4*x2*x3 + x3*x3
			+ y1*y1 - 4*y1*y2 + 2*y1*y3 + 4*y2*y2 - 4*y2*y3 + y3*y3;
		
		var b = 1.0 * 9*x1*x2 - 3*x1*x1 - 3*x1*x3 - 6*x2*x2 + 3*x2*x3
			+ 9*y1*y2 - 3*y1*y1 - 3*y1*y3 - 6*y2*y2 + 3*y2*y3;
		
		var c = 1.0 * 3*x1*x1 - 6*x1*x2 + x1*x3 - x1*x + 2*x2*x2 + 2*x2*x - x3*x
			+ 3*y1*y1 - 6*y1*y2 + y1*y3 - y1*y + 2*y2*y2 + 2*y2*y - y3*y;
			
		var d = 1.0 * x1*x2 - x1*x1 + x1*x - x2*x
			+ y1*y2 - y1*y1 + y1*y - y2*y;
		
		debug("coefficients: " + a / a + ", " + b / a + ", " + c / a + ", " + d / a);
		
		var roots = [];
		
		// Use the cubic solving algorithm
		this.solveCubic(a, b, c, d, roots);
		
		var zeroThreshold = 0.0000001;
		
		var params = [];
		
		for (var index = 0; index < 6; index += 2) {
			if (Math.abs(roots[index + 1]) < zeroThreshold
					&& roots[index] >= 0
					&& roots[index] <= 1.0) {
				params.push(roots[index]);
			}
		}
		
		params.push(1.0);
		params.push(0.0);
		
		var minDistanceSquared = -1;
		var closestParam;
		
		var curX, curY, distSquared;
		for (var i = 0; i < params.length; i++) {
			curX = Math.pow(1.0 - params[i], 2.0) * x1
				+ 2.0 * (1 - params[i]) * params[i] * x2
				+ params[i] * params[i] * x3;
				
			curY = Math.pow(1 - params[i], 2.0) * y1
				+ 2 * (1.0 - params[i]) * params[i] * y2
				+ params[i] * params[i] * y3;
				
			distSquared = Math.pow(curX - x, 2) + Math.pow(curY - y, 2);
			debug("distance for param " + params[i] + ": " + Math.sqrt(distSquared));
			if (minDistanceSquared >= 0) {
				if (distSquared < minDistanceSquared) {
					minDistanceSquared = distSquared;
					closestParam = params[i];
				}
			} else {
				minDistanceSquared = distSquared;
				closestParam = params[i];
			}
		}
		
		debugStats.clickX = x;
		debugStats.clickY = y;
		
		debugStats.closestX = Math.pow(1.0 - closestParam, 2.0) * x1
				+ 2.0 * (1.0 - closestParam) * closestParam * x2
				+ closestParam * closestParam * x3;
				
		debugStats.closestY = Math.pow(1.0 - closestParam, 2.0) * y1
				+ 2.0 * (1.0 - closestParam) * closestParam * y2
				+ closestParam * closestParam * y3;
		
		debug("given: " 
			+ "( " + x + ", " + y + "), " 
			+ "( " + x1 + ", " + y1 + "), " 
			+ "( " + x2 + ", " + y2 + "), "
			+ "( " + x3 + ", " + y3 + ")");
		
		
		debug("roots: " + roots);
		debug("params: " + params);
		debug("closest param: " + closestParam);
		return minDistanceSquared;
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
		}
		
		var edge;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			edge._private.rscratch.cp2x = Math.random() 
				* this.options.cy.container().width();
			edge._private.rscratch.cp2y = Math.random() 
				* this.options.cy.container().height();
			
			edge._private.rscratch.override = {};
		}
	}
	
	CanvasRenderer.prototype.calculateEdgeMetrics = function(edge) {
		if (edge._private.data.source == edge._private.data.target) {
			edge._private.rscratch.selfEdge = true;
			return;
		}
		
		if (this.nodePairEdgeData[edge._private.rscratch.nodePairId] == 1) {
			edge._private.rscratch.straightEdge = true;
			return;
		}
		
		// Calculate the 2nd control point
		var startNode = edge._private.data.source < edge._private.data.target ?
			edge.source()[0] : edge.target()[0];
		var endNode = edge._private.data.target < edge._private.data.source ? 
			edge.source()[0] : edge.target()[0];
		
		/*
		console.log(startNode._private);
		console.log(endNode._private);
		*/
		
		var numerator = edge._private.rscratch.nodePairEdgeNum - 1;
		var denominator = this.nodePairEdgeData[edge._private.rscratch.nodePairId] - 1;
		var offsetFactor = (numerator / denominator - 0.5);
		
		if (Math.abs(offsetFactor) < 0.0001) {
			edge._private.rscratch.straightEdge = true;
			return;
		}
		
		var middlePointX = 0.5 * (startNode._private.position.x + endNode._private.position.x);
		var middlePointY = 0.5 * (startNode._private.position.y + endNode._private.position.y);
			
		var displacementX = endNode._private.position.x - startNode._private.position.x;
		var displacementY = endNode._private.position.y - startNode._private.position.y;
		
		var offsetX = displacementY * offsetFactor;
		var offsetY = -displacementX * offsetFactor;
		
		edge._private.rscratch.cp2x = middlePointX + offsetX;
		edge._private.rscratch.cp2y = middlePointY + offsetY;
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
				styleValue = edge._private.rscratch.override.regularColor;
				context.strokeStyle = styleValue != undefined ? styleValue : defaultEdge.selectedColor;
			} else {
				if (edge._private.rscratch.hovered) {
					styleValue = edge._private.rscratch.override.hoveredColor;
					context.strokeStyle = styleValue != undefined ? styleValue : defaultEdge.hoveredColor;
				} else {
					styleValue = edge._private.rscratch.override.regularColor;
					context.strokeStyle = styleValue != undefined ? styleValue : defaultEdge.regularColor;
				}
			}
			
			context.lineWidth = edge._private.data.weight / 26.0;
			context.beginPath();
			
			context.moveTo(startNode._private.position.x, startNode._private.position.y);
			

			this.calculateEdgeMetrics(edge);
			
			if (edge._private.rscratch.straightEdge) {
				context.lineTo(endNode._private.position.x, endNode._private.position.y);
			} else if (edge._private.rscratch.selfEdge) {
				
			} else {
				context.quadraticCurveTo(edge._private.rscratch.cp2x, 
					edge._private.rscratch.cp2y, endNode._private.position.x, 
					endNode._private.position.y);
			}
			
			
			//context.lineTo(endNode._private.position.x, endNode._private.position.y);
			context.stroke();
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
						
			context.beginPath();
			context.arc(node._private.position.x, node._private.position.y,
				node._private.data.weight / 5.0, 0, Math.PI * 2, false);
			context.closePath();
			context.fill();
			
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
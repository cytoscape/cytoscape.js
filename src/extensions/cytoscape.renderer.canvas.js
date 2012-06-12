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
		
		defaultNodeStyle: {
			shape: "ellipse",
			size: 10,
			height: 10,
			width: 10,
			selected: false
		},
		
		defaultEdgeStyle: {
		}
	};
	
	var debugStats = {};
	
	function CanvasRenderer(options) {
		this.options = $.extend(true, {}, defaults, options);
		this.cy = options.cy;
		
		this.init();
	}

	CanvasRenderer.prototype.notify = function(params) {
		debug("notify call: " + params);
		debug(params);
		
		switch (params.type) {
			case "load":
				debug("load call");
				this.initStyle();
				this.load();
				break;
			case "draw":
				debug("draw call");
				break;
			default:
				debug("event: " + params.type);
		}
		
		this.redraw();
	};
	
	
	CanvasRenderer.prototype.load = function() {
		var self = this;
	
		var checkEdgeHover = function(mouseX, mouseY, edge) {
			var distance = cy.renderer().sqDistanceToQuadraticBezier(
				mouseX,
				mouseY,
				edge.source().position().x,
				edge.source().position().y,
				edge._private.renscratch.cp2x,
				edge._private.renscratch.cp2y,
				edge.target().position().x,
				edge.target().position().y
			);
			
			// debug(distance);
			if (distance < 40) {
				edge._private.renscratch.selected = true;
			} else {
				edge._private.renscratch.selected = false;
			}
		}
		
		var checkNodeHover = function(mouseX, mouseY, node) {
			var dX = mouseX - node.position().x;
			var dY = mouseY - node.position().y;
			
			/*
			console.log(node._private.renscratch.boundingRadiusSquared);
			console.log(dX * dX + dY * dY);
			*/
			
			var boundingRadiusSquared = node._private.data.weight / 5.0;
			boundingRadiusSquared *= boundingRadiusSquared;
			
			if (boundingRadiusSquared > (dX * dX + dY * dY)) {
				
				node._private.renscratch.hovered = true;	
			} else {
				node._private.renscratch.hovered = false;
			}
		}
		
		// Offset for Cytoscape container
		var mouseOffsetX = this.cy.container().offset().left + 2;
		var mouseOffsetY = this.cy.container().offset().top + 2;
		
		var edges = self.cy.edges();
		var nodes = self.cy.nodes();
		var hoverHandler = function(mouseMoveEvent) {
			var mouseX = mouseMoveEvent.clientX - mouseOffsetX;
			var mouseY = mouseMoveEvent.clientY - mouseOffsetY;
			
	
			// Project mouse coordinates to world absolute coordinates

			mouseX -= self.options.cy.container().width() / 2;
			mouseY -= self.options.cy.container().height() / 2;
			
			mouseX /= self.scale[0];
			mouseY /= self.scale[1];
			
			mouseX += self.center[0];
			mouseY += self.center[1];
			
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
			
			self.redraw();
			// debug("hover");
		}
		
		var timeout;
		$(window).bind("mousemove", function(e){
			if( timeout ){ return }
		
			timeout = setTimeout(function(){
				timeout = null;		
			}, 1000/60);
			
			hoverHandler(e);
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
		
		var startX, startY;
		var initialCenter;
		
		

		
		
		$(window).bind("mousedown", function(mouseDownEvent) {
			if (mouseDownEvent.button != 1) {
				return;
			}
			
			if (mouseDownEvent.target != canvas2d) {
				return;
			}
			
			startX = mouseDownEvent.clientX;
			startY = mouseDownEvent.clientY;
			initialCenter = [cy.renderer().center[0], cy.renderer().center[1]];
			
			//debug("mouse down");
			$(window).bind("mousemove", dragHandler);
		
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
			cy.renderer().redraw();
		};
		
		$(window).bind("mouseup", function(mouseUpEvent) {
			/*
			debug("mouse up");
			debug(mouseUpEvent);
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
			
			event.preventDefault();
			
			cy.renderer().zoomLevel -= deltaY / 10.0;
			
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
		
		if (true) {
			params.push(1.0);
			params.push(0.0);
		}
		
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
		
		var node;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			node._private.style = defaults.defaultNodeStyle;
			
			node._private.renscratch.boundingRadiusSquared = 
				Math.pow(node._private.style.size, 2);
		}
		
		var edge;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			
			edge._private.style = defaults.defaultEdgeStyle;
			
			edge._private.renscratch.cp2x = Math.random() 
				* this.options.cy.container().width();
			edge._private.renscratch.cp2y = Math.random() 
				* this.options.cy.container().height();
			
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
		
		//debug("draw called");
		var nodes = this.options.cy.nodes();
		var edges = this.options.cy.edges();
		
		var edge;
		
		
		
		var startNode, endNode;
		for (var index = 0; index < edges.length; index++) {
			edge = edges[index];
			startNode = edge.source()[0];
			endNode = edge.target()[0];
			
			if (edge._private.renscratch.selected) {
				context.strokeStyle = "#CDFFCD";
			} else {
				context.strokeStyle = "#CDCDCD";
			}
			
			context.lineWidth = edge._private.data.weight / 26.0;
			context.beginPath();
			
			context.moveTo(startNode._private.position.x, startNode._private.position.y);
			
			/*
			context.quadraticCurveTo(startNode._private.position.x * 2 / 3, 
				endNode._private.position.y, endNode._private.position.x, 
				endNode._private.position.y);
			*/
			context.quadraticCurveTo(edge._private.renscratch.cp2x, 
				edge._private.renscratch.cp2y, endNode._private.position.x, 
				endNode._private.position.y);
			
			
			//context.lineTo(endNode._private.position.x, endNode._private.position.y);
			
			context.stroke();
		}
		
		var node;
		for (var index = 0; index < nodes.length; index++) {
			node = nodes[index];
			
			if (node._private.renscratch.hovered == true) {
				context.fillStyle = "#AAAAFF";
			} else {
				context.fillStyle = "#AAAAAA";
			}
			
			context.beginPath();
			context.arc(node._private.position.x, node._private.position.y,
				node._private.data.weight / 5.0, 0, Math.PI * 2, false);
			context.closePath();
			context.fill();
		}
		
		
		context.fillStyle = "#5555AA";
		context.beginPath();
		context.arc(debugStats.clickX, debugStats.clickY,
			5.0, 0, Math.PI * 2, false);
		context.closePath();
		context.fill();
		
		
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
		
		this.redraw();
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
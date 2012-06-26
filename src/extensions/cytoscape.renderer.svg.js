(function($, $$){

	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true
	};
	
	var lineStyles = {};
	
	var registerLineStyle = function(style){
		$.cytoscape("renderer", "svg", "linestyle", style.name, style);
		delete style.name;
	};
	
	registerLineStyle({
		name: "solid",
		array: undefined
	});
	
	registerLineStyle({
		name: "dot",
		array: [1, 5]
	});
	
	registerLineStyle({
		name: "longdash",
		array: [10, 2]
	});
	
	registerLineStyle({
		name: "dash",
		array: [5, 5]
	});
	
	var registerEdgeArrowShape = function(shape){
		$.cytoscape("renderer", "svg", "edgearrowshape", shape.name, shape);
		delete shape.name;
	};
	
	registerEdgeArrowShape({
		name: "triangle",
		
		// generate the shape svg
		// the top points towards the node
		svg: function(svg, parent, edge, position, style){
			return svg.polygon(parent, [[0, 1], [0.5, 0], [1, 1]]);
		},
		
		// the point within the 1x1 box to line up with the center point at the
		// end of the edge
		centerPoint: {
			x: 0.5,
			y: 0.5
		}
	});
	
	registerEdgeArrowShape({
		name: "square",
		
		// generate the shape svg
		svg: function(svg, parent, edge, position, style){
			return svg.polygon(parent, [[0, 0], [0, 1], [1, 1], [1, 0]]);
		},
		
		centerPoint: {
			x: 0.5,
			y: 0.5
		}
	});
	
	registerEdgeArrowShape({
		name: "circle",
		
		// generate the shape svg
		svg: function(svg, parent, edge, position, style){
			return svg.circle(parent, 0.5, 0.5, 0.5);
		},
		
		centerPoint: {
			x: 0.5,
			y: 0.5
		}
	});

	registerEdgeArrowShape({
		name: "diamond",
		
		// generate the shape svg
		svg: function(svg, parent, edge, position, style){
			return svg.polygon(parent, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]);
		},
		
		centerPoint: {
			x: 0.5,
			y: 0.5
		}
	});

	registerEdgeArrowShape({
		name: "tee",
		
		// generate the shape svg
		svg: function(svg, parent, edge, position, style){
			return svg.rect(parent, 0, 0, 1, 0.5);
		},
		
		centerPoint: {
			x: 0.5,
			y: 0.5
		}
	});
	
	var registerNodeShape = function(shape){
		$.cytoscape("renderer", "svg", "nodeshape", shape.name, shape);
		delete shape.name;
	};
	
	// use this as an example for adding more node shapes
	registerNodeShape({
		// name of the shape
		name: "ellipse",
		
		// generate the shape svg
		svg: function(svg, parent, node, position, style){
			return svg.ellipse(parent, position.x, position.y, style.width.pxValue, style.height.pxValue);
		},
		
		// update unique style attributes for this shape
		// see http://keith-wood.name/svgRef.html for api reference
		update: function(svg, parent, node, position, style){
			svg.change(node.rscratch("svg"), {
				cx: position.x,
				cy: position.y,
				rx: style.width.pxValue / 2,
				ry: style.height.pxValue / 2
			});
		},
		
		// 2D shape in intersection lib
		intersectionShape: Ellipse
	});
	
	registerNodeShape({
		name: "rectangle",
		svg: function(svg, parent, node, position, style){
			return svg.rect(parent, position.x - style.width.pxValue/2, position.y - style.height.pxValue/2, style.width.pxValue, style.height.pxValue);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node.rscratch("svg"), {
				x: position.x - style.width.pxValue/2,
				y: position.y - style.height.pxValue/2,
				width: style.width.pxValue,
				height: style.height.pxValue
			});
		},
		
		intersectionShape: Rectangle
	});
	
	registerNodeShape({
		name: "roundrectangle",
		svg: function(svg, parent, node, position, style){
			return svg.rect(parent, position.x - style.width.pxValue/2, position.y - style.height.pxValue/2, style.width.pxValue, style.height.pxValue, style.width.pxValue/4, style.height.pxValue/4);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node.rscratch("svg"), {
				x: position.x - style.width/2,
				y: position.y - style.height/2,
				width: style.width.pxValue,
				height: style.height.pxValue
			});
		},
		
		intersectionShape: Rectangle
	});
	
	registerNodeShape({
		name: "triangle",
		svg: function(svg, parent, node, position, style){
			return svg.polygon(parent,
					           [ 
					             [position.x,                 position.y - style.height.pxValue/2], 
					             [position.x + style.width.pxValue/2, position.y + style.height.pxValue/2],
					             [position.x - style.width.pxValue/2, position.y + style.height.pxValue/2]
					           ]);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node.rscratch("svg"), {
				points: [ 
			             [position.x,                 position.y - style.height.pxValue/2], 
			             [position.x + style.width.pxValue/2, position.y + style.height.pxValue/2],
			             [position.x - style.width.pxValue/2, position.y + style.height.pxValue/2]
			           ]
			});
		},
		
		intersectionShape: Polygon
	});
	
	function visibility(v){
		if( v != null && typeof v == typeof "" && ( v == "hidden" || v == "visible" ) ){
			return v;
		} else {
			$.error("SVG renderer does not recognise %o as a valid visibility", v);
		}
	};
	
	function percent(p){
		if( p != null && typeof p == typeof 1 && !isNaN(p) &&  0 <= p && p <= 1 ){
			return p;
		} else {
			$.error("SVG renderer does not recognise %o as a valid percent (should be between 0 and 1)", p);
		}
	}
	
	function color(c){
		if( c != null && typeof c == typeof "" && $.Color(c) != "" ){
			return $.Color(c).toHEX();
		} else {
			$.error("SVG renderer does not recognise %o as a valid colour", c);
		}
	}
	
	function number(n){
		if( n != null && typeof n == typeof 1 && !isNaN(n) ){
			return n;
		} else {
			$.error("SVG renderer does not recognise %o as a valid number", n);
		}
	}
	
	function nodeShape(name){
		var ret = $.cytoscape("renderer", "svg", "nodeshape", name);
		
		if( ret == null ){
			$.error("SVG renderer does not recognise %s as a valid node shape", name);
		}
		
		return ret;
	}
	
	function lineStyle(name){
		var ret = $.cytoscape("renderer", "svg", "linestyle", name);
		
		if( ret == null ){
			$.error("SVG renderer does not recognise %s as a valid line style", name);
		}
		
		return ret;
	}
	
	function edgeArrowShape(name){
		if( name == "none" || name == null ){
			return null;
		}
		
		return $.cytoscape("renderer", "svg", "edgearrowshape", name);
	}
	
	function labelHalign(a){
		if( a != null && typeof a == typeof "" && ( a == "left" || a == "right" || a == "middle" ) ){
			return a;
		} else {
			$.error("SVG renderer does not recognise %o as a valid label horizonal alignment", a);
		}	
	}
	
	function labelValign(a){
		if( a != null && typeof a == typeof "" && ( a == "top" || a == "bottom" || a == "middle" ) ){
			return a;
		} else {
			$.error("SVG renderer does not recognise %o as a valid label vertical alignment", a);
		}	
	}
	
	function cursor(name){
		if( name == "grab" ){
			if( $.browser.webkit ){
				return "-webkit-grab";
			} else if( $.browser.mozilla ){
				return "-moz-grab";
			} else {
				return "move";
			}
		} else if( name == "grabbing" ){
			if( $.browser.webkit ){
				return "-webkit-grabbing";
			} else if( $.browser.mozilla ){
				return "-moz-grabbing";
			} else {
				return "move";
			}
		} else {
			return name;
		}
	}
	
	function SvgRenderer(options){
		
		this.options = $.extend({}, defaults, options);
		this.setStyle(options.style);
		this.cy = options.cy;
		
		
		
	}
	
	SvgRenderer.prototype.init = function(callback){
		var self = this;
		this.cy = this.options.cy;
		var container = this.cy.container();
		var svg = container.svg('get'); 
		
		this.container = container;
		this.svg = svg;
		
		if( svg != null ){
			container.svg('destroy');
		} 
		
		container.css({
			padding: "0 !important"
		});
		
		container.svg({
			onLoad: function(s){
				
				if( self.scale == null ){
					self.scale = 1;
				}
				if( self.translation == null ){
					self.translation = { x: 0, y: 0 };
				}
				
				container.find("svg").css("overflow", "hidden"); // fixes ie overflow
				
				svg = s;
				self.svg = svg;
				
				self.svg.change();
				
				self.svgBg = svg.rect(0, 0, "100%", "100%", {
					fill: "white", // any arbitrary colour
					opacity: 0 // don't show the bg rect but let it bubble up events
				});
				
				self.edgesGroup = svg.group();
				self.nodesGroup = svg.group();
				self.svgRoot = $(self.nodesGroup).parents("svg:first")[0];
				
				
				self.selectedElements = self.cy.collection();
				self.touchingNodes = self.cy.collection();
				
				self.defs = self.svg.defs();
				
				self.makeBackgroundInteractive();
				
				callback();
			},
			settings: {
				height: "100%",
				width: "100%"
			}
		});
		
	};
	
	SvgRenderer.prototype.offsetFix = function(e){
		var self = this;
		
		// firefox fix :(
		if( e.offsetX == null || e.offsetY == null ){
			e.offsetX = e.pageX - self.cy.container().offset().left;
			e.offsetY = e.pageY - self.cy.container().offset().top;
		}
	};
	
	SvgRenderer.prototype.makeBackgroundInteractive = function(){
		
		var self = this;
		
		var svgDomElement = self.svgRoot;
		var panDelay = self.options.selectionToPanDelay;
		var mover = false;
		var moverThenMoved = false;
		var mmovedScreenPos = {
			x: null,
			y: null
		};
		var mmovedScreenTolerance = 0;
		
		self.shiftDown = false;
		$(window).bind("keydown keyup", function(e){
			self.shiftDown = e.shiftKey;
		});
		
		function backgroundIsTarget(e){
			return e.target == svgDomElement 
				|| $(e.target).parents("g:last")[0] == self.edgesGroup
				|| $(e.target)[0] == self.svgBg;
		}
		
		$(window).bind("blur", function(){
			mover = false;
			moverThenMoved = false;
		}).bind("mousemove", function(e){
			var diffScreenPos = false;
			if( Math.abs(e.screenX - mmovedScreenPos.x) > mmovedScreenTolerance
			|| Math.abs(e.screenY - mmovedScreenPos.y) > mmovedScreenTolerance ){
				diffScreenPos = true;
			}
			
			mmovedScreenPos = {
				x: e.screenX,
				y: e.screenY
			};

			if( mover && diffScreenPos ){
				moverThenMoved = true;
			}
		});

		$(svgDomElement).bind("mousedown", function(mousedownEvent){

			// ignore right clicks
			if( mousedownEvent.button != 0 ){
				return;
			}
			
			if( backgroundIsTarget(mousedownEvent) ){
				
				mousedownEvent.preventDefault();
				
				self.offsetFix(mousedownEvent);
				
				var selectionSquare = null;
				var selectionBounds = {};
				
				var panning = true;
				var selecting = true;
				
				if( !self.options.dragToSelect ){
					selecting = false;
				}
				
				if( !self.options.dragToPan ){
					panning = false;
				}
				
				if( panning && selecting ){
					panning = false;
					selecting = true;
				}
				
				var originX = mousedownEvent.pageX;
				var originY = mousedownEvent.pageY;
				
				var selectOriginX = mousedownEvent.offsetX;
				var selectOriginY = mousedownEvent.offsetY;
				var selectDx = 0;
				var selectDy = 0;
				
				var _setPanCursor = false;
				function setPanCursor(){
					var coreStyle = self.cy.style().core();
					if( _setPanCursor ){ return; }
					
					_setPanCursor = true;
					self.svg.change(svgDomElement, {
						cursor: coreStyle["panning-cursor"].value
					});
				}
				
				if( self.options.dragToPan ){
					var panDelayTimeout = setTimeout(function(){
						if( !self.cy.panningEnabled() ){
							return;
						}
						
						panning = true;
						selecting = false;
						
					}, panDelay);
				}
				
				var dragHandler = function(dragEvent){
					clearTimeout(panDelayTimeout);
					var coreStyle = self.cy.style().core();
					
					var dx = dragEvent.pageX - originX;
					var dy = dragEvent.pageY - originY;
					
					// new origin each event
					originX = dragEvent.pageX;
					originY = dragEvent.pageY;
					
					selectDx += dx;
					selectDy += dy;
					
					if( panning ){	
						var newPan = {
							x: self.translation.x + dx,
							y: self.translation.y + dy
						};

						setPanCursor();
						
						self.pan(newPan);
					}
					
					if( selecting ){
						if( selectionSquare == null ){
							selectionSquare = self.svg.rect(selectOriginX, selectOriginY, 0, 0, {
								fill: coreStyle["selection-box-color"].strValue,
								opacity: coreStyle["selection-box-opacity"].value,
								stroke: coreStyle["selection-box-border-color"].strValue,
								strokeWidth: coreStyle["selection-box-border-width"].value
							});
						} else {
							
							var width = Math.abs(selectDx);
							var height = Math.abs(selectDy);
							var x = selectDx >= 0 ? selectOriginX : selectOriginX + selectDx;
							var y = selectDy >= 0 ? selectOriginY : selectOriginY + selectDy;
							
							selectionBounds = {
								x1: x,
								y1: y,
								x2: x + width,
								y2: y + height
							};
							
							self.svg.change(selectionSquare, {
								x: x,
								y: y,
								width: width,
								height: height
							});
						}
					}
				};
				
				$(window).bind("mousemove", dragHandler);
				
				var endHandler = function(mouseupEvent){
					
					// ignore right clicks
					if( mouseupEvent.type == "mouseup" && mouseupEvent.button != 0 ){
						return;
					}
					
					clearTimeout(panDelayTimeout);
					
					$(window).unbind("mousemove", dragHandler);
	
					$(window).unbind("mouseup", endHandler);
					$(window).unbind("blur", endHandler);
					$(svgDomElement).unbind("mouseup", endHandler);
					
					if( panning ){
						self.svg.change(svgDomElement, {
							cursor: null
						});
					}
					
					if( selecting ){
						if( selectionSquare != null && selectionBounds.x1 != null && !isNaN(selectionBounds.x1) ){
							self.selectElementsFromIntersection(selectionSquare, selectionBounds);
							self.svgRemove(selectionSquare);
						} else if( !self.shiftDown ) {
							self.unselectAll();
						}
					}
					
				};
				
				$(window).bind("mouseup", endHandler);
				$(window).bind("blur", endHandler);
				$(svgDomElement).bind("mouseup", endHandler);
			}
		}).bind("mouseover", function(){
			mover = true;
			moverThenMoved = false;
		}).bind("mouseout", function(){
			mover = false;
			moverThenMoved = false;
		}).bind("mousewheel", function(e, delta, deltaX, deltaY){
			if( !self.cy.panningEnabled() || !self.cy.zoomingEnabled() || !moverThenMoved ){
				return;
			}

			self.offsetFix(e.originalEvent);

			var point = {
				x: e.originalEvent.offsetX,
				y: e.originalEvent.offsetY
			};
			
			var deltaFactor = 0.5;
			
			if( $.browser.mozilla || $.browser.msie ){
				deltaFactor = 0.167;
			}
			
			var zoom = self.zoom() * (1 + deltaY * deltaFactor);
			
			self.zoomAboutPoint(point, zoom);
			self.cy.trigger("zoom");
			self.cy.trigger("pan");
			
			e.preventDefault();
		});
		
		// touch functions (& touch support)
		//       |
		//       v
		
		function point(e, i){
			var x, y;
			var offset = self.cy.container().offset();
			var touches = e.originalEvent.touches;
			var touch = touches[ i ];
			
			x = touch.pageX - offset.left;
			y = touch.pageY - offset.top;
			
			return { x: x, y: y };
		}
		
		function centerPoint(e){
			var p1 = point(e, 0);
			var p2 = point(e, 1);
			
			return {
				x: (p1.x + p2.x)/2,
				y: (p1.y + p2.y)/2
			};
		}
		
		function distance(e){
			var p1 = point(e, 0);
			var p2 = point(e, 1);
			
			return self.getDistance(p1, p2);
		}
		
		function numEventPoints(e){
			return e.originalEvent.touches == null ? 0 : e.originalEvent.touches.length;
		}
		
		function pointsAtLeast(e, n){
			return numEventPoints(e) >= n;
		}
		
		function fingers(n){
			if( n >= 2 ){
				twoFingers = true;
				inTwoFingerDelay = true;
				
				clearTimeout(twoFingersTimeout);
				twoFingersTimeout = setTimeout(function(){
					inTwoFingerDelay = false;
				}, delayFrom2FingersTo1);
			} else {
				twoFingers = false;
			}
		}
		
		var delayFrom2FingersTo1 = 100;
		var twoFingers = false;
		var inTwoFingerDelay = false;
		var twoFingersTimeout = null;
		var touchendUnselects = true;
		var center, modelCenter, distance1, point11, point12, point21, point22, movedAfterTouchStart;
		$(svgDomElement).bind("touchstart", function(tsEvent){
			if( !backgroundIsTarget(tsEvent) || self.touchingNodes.size() > 0 ){
				return;	
			}
			
			tsEvent.preventDefault();
			point11 = point(tsEvent, 0);
			
			if( pointsAtLeast(tsEvent, 2) ){
				center = centerPoint(tsEvent);
				modelCenter = self.modelPoint(center);
				distance1 = distance(tsEvent);
				point12 = point(tsEvent, 1);
				fingers(2);
			} else {
				fingers(1);
				touchendUnselects = true;
			}
			
			movedAfterTouchStart = false;
			
		}).bind("touchmove", function(tmEvent){
			if( !backgroundIsTarget(tmEvent) || self.touchingNodes.size() > 0 ){
				return;	
			}
			
			touchendUnselects = false;
			
			if( pointsAtLeast(tmEvent, 2) ){
				fingers(2);
				point22 = point(tmEvent, 1);
			} else {
				fingers(1);
			}
			
			tmEvent.preventDefault();

			var translation = {
				x: 0,
				y: 0
			};
			
			if( pointsAtLeast(tmEvent, 1) && self.cy.panningEnabled() ){
				point21 = point(tmEvent, 0);
				
				if( pointsAtLeast(tmEvent, 2) && self.cy.zoomingEnabled() ){
					var distance2 = distance(tmEvent);
					//center = self.renderedPoint(modelCenter);
					var factor = distance2 / distance1;
					center = self.renderedPoint(modelCenter);
					
					if( factor != 1 ){
						var speed = 1.5;
						
						// delta finger 1
						var d1 = {
							x: point21.x - point11.x,
							y: point21.y - point11.y
						};
						
						// delta finger 2
						var d2 = {
							x: point22.x - point12.x,
							y: point22.y - point12.y
						};
						
						// translation is the normalised vector of the two fingers movement
						// i.e. so pinching cancels out and moving together pans
						translation = {
							x: (d1.x + d2.x) / 2,
							y: (d1.y + d2.y) / 2
						};
						
						if( factor > 1 ){
							factor = (factor - 1) * speed + 1;
						} else {
							factor = 1 - (1 - factor) * speed;
						}
						
						var zoom = self.zoom() * factor;
						
						self.zoomAboutPoint(center, zoom, translation);
						distance1 = distance2;
					}
				} else if( !inTwoFingerDelay ){
					translation = {
						x: point21.x - point11.x,
						y: point21.y - point11.y
					};
					
					self.panBy(translation);
				}
				
				point11 = point21;
				point12 = point22;
			}
		}).bind("touchend", function(teEvent){
			if( touchendUnselects && backgroundIsTarget(teEvent) ){
				self.unselectAll();
			}
		});
		
		$(svgDomElement).bind("mousedown mouseup click mouseover mouseout mousemove touchstart touchmove touchend", function(e){
			
			// only pass along if bg is the target: when an element gets an event, it automatically bubbles up to
			// core and bg via the core (Element) logic
			if( backgroundIsTarget(e) ){
				var event = e;
				self.cy.trigger(event);
			}
		});
		
	};
	
	SvgRenderer.prototype.zoomAboutPoint = function(point, zoom, translation){
		var self = this;
		var cy = self.cy;
		
		if( !cy.panningEnabled() || !cy.zoomingEnabled() ){
			return;
		}
		
		var pan1 = self.pan();
		var zoom1 = self.zoom();
		var zoom2 = zoom;
		
		if( translation == null ){
			translation = {
				x: 0,
				y: 0
			};
		}
		
		var pan2 = {
			x: -zoom2/zoom1 * (point.x - pan1.x - translation.x) + point.x,
			y: -zoom2/zoom1 * (point.y - pan1.y - translation.y) + point.y
		};
		
		self.transform({
			translation: pan2,
			scale: zoom2
		});
	};
	
	SvgRenderer.prototype.zoom = function(scale){
		
		var cy = this.cy;
		
		if( !cy.zoomingEnabled() ){
			return;
		}
		
		if( scale === undefined ){
			return this.scale;
		} else if( typeof scale == typeof {} ){
			var options = scale;
			var rposition;
			
			if( options.position !== undefined ){
				rposition = this.renderedPoint(options.position);
			} else {
				rposition = options.renderedPosition;
			}
			
			if( rposition !== undefined ){
				this.zoomAboutPoint(rposition, scale.level);
			} else {
				this.transform({
					scale: options.level
				});
			}
			
		} else {
			this.transform({
				scale: scale
			});
		} 

	};
	
	SvgRenderer.prototype.fit = function(params){
		var elements = params.elements;
		var zoom = params.zoom;
		var cy = this.cy;
		
		if( !cy.panningEnabled() || (zoom !== undefined && !cy.zoomingEnabled()) ){
			return;
		}
		
		if( elements == null || elements.size() == 0 ){
			elements = this.cy.elements();
		}
		
		if( elements.is(":removed") ){
			
			elements = elements.filter(":inside");
		}
		
		
		
		var n = this.nodesGroup.getBBox();
		//var e = this.edgesGroup.getBBox();
		
		var x1, y1, x2, y2;
		
		function update(bb){
			if( bb.height == 0 || bb.width == 0 ){ return; }

			var left = bb.x;
			var right = left + bb.width;
			var top = bb.y;
			var bottom = top + bb.height;
			
			if( left < x1 || x1 == null ){
				x1 = left;
			}
			
			if( right > x2 || x2 == null ){
				x2 = right;
			}
			
			if( top < y1 || y1 == null ){
				y1 = top;
			}
			
			if( bottom > y2 || y2 == null ){
				y2 = bottom;
			} 
		}

		elements.nodes().each(function(){
			var bb = this.rscratch("svg").getBBox();
			var bbLabel = this.rscratch("svgLabel").getBBox();

			update(bb);
			update(bbLabel);
		});

		// fix for loop edges (their bounding boxes are approx 2x width and height of path
		// they push the bb up and left
		elements.edges().each(function(){
			var src = this.source().id();
			var tgt = this.target().id();
			var loopFactor = lf = 0.4;
			
			if( src == tgt ){
				var bb = this.rscratch("svg").getBBox();
				bb.x2 = bb.x + bb.width;
				bb.y2 = bb.y + bb.height;
				bb.x1 = bb.x;
				bb.y1 = bb.y;

				var bbAdjusted = {};
				bbAdjusted.x = bb.x1 + bb.width * lf;
				bbAdjusted.y = bb.y1 + bb.height * lf;
				bbAdjusted.width = bb.x2 - bbAdjusted.x;
				bbAdjusted.height = bb.y2 - bbAdjusted.y;

				var bbLabel = this.rscratch("svgLabel").getBBox();

				update(bbAdjusted);
				update(bbLabel);
			} else {
				var bb = this.rscratch("svg").getBBox();
				var bbLabel = this.rscratch("svgLabel").getBBox();

				update(bb);
				update(bbLabel);
			}
		});
		
		var w = x2 - x1;
		var h = y2 - y1;

		var width = this.cy.container().width();
		var height = this.cy.container().height();
		
		var scale = Math.min( width/w, height/h );
		
		if( zoom ){
			this.transform({
				translation: {
					x: -x1 * scale - (w*scale - width)/2,
					y: -y1 * scale - (h*scale - height)/2
				},
				scale: scale
			});
		} else {
			var z = this.scale;
			
			this.transform({
				translation: {
					x: -x1*z + width/2 - (x2-x1)/2*z,
					y: -y1*z + height/2 - (y2-y1)/2*z
				}
			});
		}
		
	};
	
	SvgRenderer.prototype.panBy = function(position){
		if( !this.cy.panningEnabled() ){
			return;
		}
		
		this.transform({
			translation: {
				x: this.translation.x + number(position.x),
				y: this.translation.y + number(position.y)
			}
		});
	};
	
	SvgRenderer.prototype.pan = function(position){
		if( !this.cy.panningEnabled() ){
			return;
		}
		
		if( position === undefined ){
			return {
				x: this.translation.x,
				y: this.translation.y
			};
		}
		
		if( position == null || typeof position != typeof {} ){
			$.error("You can not pan without specifying a proper position object; `%o` is invalid", position);
			return;
		}
		
		this.transform({
			translation: {
				x: number(position.x),
				y: number(position.y)
			}
		});
	};
	
	SvgRenderer.prototype.capTransformation = function(params){
		var translation = params.translation;
		var scale = params.scale;
		var self = this;
		
		var maxScale = self.options.maxZoom;
		var minScale = self.options.minZoom;
		var minTranslation = self.options.minPan;
		var maxTranslation = self.options.maxPan;
		var validScale = true;
		var validTranslation = true;
		
		if( translation != null ){
			if( translation.x < minTranslation ){
				translation.x = minTranslation;
				validTranslation = false;
			} else if( translation.x > maxTranslation ){
				translation.x = maxTranslation;
				validTranslation = false;
			}
			
			if( translation.y < minTranslation ){
				translation.y = minTranslation;
				validTranslation = false;
			} else if( translation.y > maxTranslation ){
				translation.y = maxTranslation;
				validTranslation = false;
			}

		} else {
			translation = self.translation;
		}
		
		if( scale != null ){
			if( scale > maxScale ){
				scale = maxScale;
				validScale = false;
			} else if( scale < minScale ){
				scale = minScale;
				validScale = false;
			}
		} else {
			scale = self.scale;
		}
		
		return {
			scale: scale,
			translation: translation,
			valid: validScale && validTranslation,
			validScale: validScale,
			validTranslation: validTranslation
		};
	};
	
	SvgRenderer.prototype.transform = function(params){
		var self = this;
		
		var capped = self.capTransformation(params);
		
		var oldScale = self.scale;
		var oldTranslation = {
			x: self.translation ? self.translation.x : undefined,
			y: self.translation ? self.translation.y : undefined
		};

		if( capped.valid ){
			self.translation = capped.translation;
			self.scale = capped.scale;
		} else {
		
			if( params.capScale ){
				
				self.scale = capped.scale;
			}
			
			if( params.capTranslation ){
				
				self.translation = capped.translation;
			}
		}
		
		function transform(svgElement){
			if( self.svg == null || svgElement == null ){
				return;
			}
			
			self.svg.change(svgElement, {
				transform: "translate(" + self.translation.x + "," + self.translation.y + ") scale(" + self.scale + ")"
			});
		}
		
		transform(self.nodesGroup);
		transform(self.edgesGroup);

		if( self.scale === undefined || oldScale !== self.scale ){
			cy._private.zoom = self.scale;
			self.cy.trigger("zoom");
		}

		if( self.translation === undefined || oldTranslation.x !== self.translation.x || oldTranslation.y !== self.translation.y ){
			cy._private.pan = self.translation;
			self.cy.trigger("pan");
		}
	};

	// update viewport when core sends us updates
	SvgRenderer.prototype.updateViewport = function(){
		var zoom = this.cy.zoom();
		var pan = this.cy.pan();

		this.transform({
			scale: zoom,
			translation: pan
		});
	};
	
	SvgRenderer.prototype.calculateStyleField = function(element, fieldName){
		var self = this;
		var styleCalculator = self.options.styleCalculator;
		var selectors = self.style.selectors;
		
		var field = undefined;
		var bypassField = element.bypass()[fieldName];
		
		if( bypassField !== undefined ){
			field = bypassField;
		} else {
			$.each(selectors, function(selector, selStyle){
				var selField = selStyle[fieldName];
				
				if( selField != null && element.is(selector) ){
					field = selField;
				}
			});
		}
		
		return styleCalculator.calculate(element, field);
	};
	
	SvgRenderer.prototype.calculateStyle = function(element){
		var self = this;
		var styleCalculator = self.options.styleCalculator;
		var selectors = self.style.selectors;
		var style = {};
		
		// iteratively set style based on matching selectors
		$.each(selectors, function(selector, selStyle){
			if( element.is(selector) ){
				style = $.extend(style, selStyle);
			}
		});
		
		// apply the bypass
		style = $.extend(style, element.bypass());
		
		// compute the individual values (i.e. flatten mappers to actual values)
		$.each(style, function(styleName, styleVal){
			style[styleName] = styleCalculator.calculate(element, styleVal);
		});
		
		// assign to computed style field
		element._private.style = style;
		
		if( element.isEdge() ){
			var source = element.source();
			var target = element.target();
			
			function calculateVisibility(){
				if( source.style("visibility") == "visible" && target.style("visibility") == "visible" ){
					return visibility(style.visibility);
				} else {
					return "hidden";
				}
			}
			
			style.visibility = calculateVisibility();
		}
		
		return style;
	};
	
	SvgRenderer.prototype.svgRemove = function(svg){
		var $svg = $(svg);
		var $container = $(this.svgRoot);
		
		function svgIsInCy( svgDomElement ){
			var $ele = $(svgDomElement);
			var inside = false;
			
			if( $ele.parent().size() == 0 ){
				return false; // more efficient :)
			}
			
			$ele.parents().each(function(){
				if( this == $container[0] ){
					inside = true;
				}
			});
			
			return inside;
		}
		
		if( svg == null || !svgIsInCy(svg) ){
			return;
		}
		
		this.svg.remove( svg );
	};
	
	SvgRenderer.prototype.updateNodePositionFromShape = function(element){
		var style = element._private.style;
		var parent = element.rscratch("svgGroup");
		var position = element.position();
		
		nodeShape(style.shape.strValue).update(this.svg, parent, element, position, style);
	};
	
	SvgRenderer.prototype.makeSvgEdgeInteractive = function(element){
		var svgDomElement = element.rscratch("svg");
		var targetArrow = element.rscratch("svgTargetArrow");
		var sourceArrow = element.rscratch("svgSourceArrow");
		var svgCanvas = $(svgDomElement).parents("svg:first")[0];
		var self = this;
		
		$(svgDomElement).add(targetArrow).add(sourceArrow).bind("mouseup mousedown click touchstart touchmove touchend mouseover mousemove mouseout", function(e){
			if( self.edgeEventIsValid(element, e) ){
				element.trigger(e);
			}
		}).bind("click touchend", function(e){
			self.selectElement(element);
		});
	};
	
	SvgRenderer.prototype.makeSvgNodeLabelInteractive = function(element){
	};
	

	SvgRenderer.prototype.makeSvgNodeInteractive = function(element){
		var svgDomElement = element.rscratch("svg");
		var svgCanvas = $(svgDomElement).parents("svg:first")[0];
		var self = this;
		var draggedAfterMouseDown = null;
		
		// you need to prevent default event handling to 
		// prevent built-in browser drag-and-drop etc
		
		$(svgDomElement).bind("mousedown touchstart", function(mousedownEvent){
			draggedAfterMouseDown = false;
			
			element.trigger(mousedownEvent);
			
			if( element.grabbed() || element.locked() || !element.grabbable() ){
				mousedownEvent.preventDefault();
				return;
			}
			
			if( mousedownEvent.type == "touchstart" && mousedownEvent.originalEvent.touches.length > 1 ){
				return;
			}
			 
			element._private.grabbed = true;
			element.trigger($.extend({}, mousedownEvent, { type: "grab" }));
			self.touchingNodes = self.touchingNodes.add(element);
			
			var originX, originY;
			
			if( mousedownEvent.type == "touchstart" ){
				var touches = mousedownEvent.originalEvent.touches;
				var touch = touches[touches.length - 1];
				
				originX = touch.pageX;
				originY = touch.pageY;
			} else {
				originX = mousedownEvent.pageX;
				originY = mousedownEvent.pageY;
			}
			
			var elements;
				
			if( element.selected() ){
				elements = self.selectedElements.add(element).filter(":grabbable");
			} else {
				elements = element.collection();
			}

			var justStartedDragging = true;
			var dragHandler = function(dragEvent){
				
				draggedAfterMouseDown = true;
				
				var dragX, dragY;
				
				if( dragEvent.type == "touchmove" ){
					var touches = mousedownEvent.originalEvent.touches;
					var touch = touches[touches.length - 1];
					
					dragX = touch.pageX;
					dragY = touch.pageY;
				} else {
					dragX = dragEvent.pageX;
					dragY = dragEvent.pageY;
				}
				
				var dx = (dragX - originX) / self.zoom();
				var dy = (dragY - originY) / self.zoom();
				
				// new origin each event
				originX = dragX;
				originY = dragY;
				
				elements.each(function(i, e){
					e.element()._private.position.x += dx;
					e.element()._private.position.y += dy;
				});			
				
				self.updatePosition( elements );
				
				if( justStartedDragging ){
					
					// TODO we should be able to do this on iOS too
					if( dragEvent.type != "touchmove" ){
						self.moveToFront(element);
					}
					
					justStartedDragging = false;
					
				} else {
					element.trigger($.extend({}, dragEvent, { type: "position" }));
					element.trigger($.extend({}, dragEvent, { type: "drag" }));
				}
				
				
			};
			
			$(window).bind("mousemove touchmove", dragHandler);
			
			var finishedDragging = false;
			var touchEndCount = 0;
			var endHandler = function(mouseupEvent){
				if( mouseupEvent.type == "touchend" && mouseupEvent.originalEvent.touches.length != 0 ){
					return;
				}
				
				if( !finishedDragging ){
					finishedDragging = true;
				} else {
					return;
				}
				
				$(window).unbind("mousemove touchmove", dragHandler);

				$(window).unbind("mouseup touchend blur", endHandler);
				$(svgDomElement).unbind("mouseup touchend", endHandler);
				
				element._private.grabbed = false;
				self.touchingNodes = self.touchingNodes.not(element);
				
				element.trigger($.extend({}, mouseupEvent, { type: "free" }));
			};
			
			$(window).bind("mouseup touchend blur", endHandler);
			$(svgDomElement).bind("mouseup touchend", endHandler);
			
			mousedownEvent.preventDefault();
		}).bind("mouseup touchend", function(e){
			element.trigger($.extend({}, e));
			
			if( draggedAfterMouseDown == false ){
				draggedAfterMouseDown = null;
				element.trigger($.extend({}, e, { type: "click" }));
				self.selectElement(element);
			}
		}).bind("mouseover mouseout mousemove", function(e){
			// ignore events created falsely for recreated elements
			if( self.nodeEventIsValid(element, e) ){
				element.trigger($.extend({}, e));
			}
		});
		
	};
	

	SvgRenderer.prototype.edgeEventIsValid = function(element, event){
		var $rt = $(event.relatedTarget);
		var self = this;
		
		switch( event.type ){
		case "mouseover":
		case "mouseout":
			return $rt.parent().parent().size() > 0; // don't count when elements were removed
		default:
			return true;
		}		
	};
	
	SvgRenderer.prototype.nodeEventIsValid = function(element, event){
		var $rt = $(event.relatedTarget);
		var self = this;

		switch( event.type ){
		case "mouseover":
		case "mouseout":
			return $rt.parent().parent().size() > 0; // don't count when elements were removed
		default:
			return true;
		}		
	};
	
	SvgRenderer.prototype.modelPoint = function(screenPoint){
		var self = this;
		var mpos = {};

		if( screenPoint.x !== undefined ){
			mpos.x = (screenPoint.x - self.pan().x) / self.zoom();
		}
		
		if( screenPoint.y !== undefined ){
			mpos.y = (screenPoint.y - self.pan().y) / self.zoom();
		}
		
		return mpos;
	};
	
	SvgRenderer.prototype.renderedPoint = function(modelPoint){
		var self = this;
		var rpos = {};
		
		if( modelPoint.x !== undefined ){
			rpos.x = modelPoint.x * self.zoom() + self.pan().x;
		}
		
		if( modelPoint.y !== undefined ){
			rpos.y = modelPoint.y * self.zoom() + self.pan().y;
		}
		
		return rpos;
	};
	
	SvgRenderer.prototype.unselectElements = function(collection){
		collection = collection.collection();
		
		collection.unselect();
		this.selectedElements = this.selectedElements.not(collection);
	};
	
	// by drag select
	SvgRenderer.prototype.selectElementsFromIntersection = function(svgSelectionShape, selectionBounds){
		var self = this;
		var toSelect = this.cy.collection();
		var toUnselect = this.cy.collection();
		
		function nodeInside(element){

			if( !element.visible() ){
				return false;
			}
			
			// intersect rectangle in the model with the actual node shape in the model
			var shape = nodeShape( element._private.style["shape"].strValue ).intersectionShape;
			var modelRectangleP1 = self.modelPoint({ x: selectionBounds.x1, y: selectionBounds.y1 });
			var modelRectangleP2 = self.modelPoint({ x: selectionBounds.x2, y: selectionBounds.y2 });
			var modelRectangle = self.svg.rect(modelRectangleP1.x, modelRectangleP1.y, modelRectangleP2.x - modelRectangleP1.x, modelRectangleP2.y - modelRectangleP1.y);
			var intersection = Intersection.intersectShapes(new Rectangle(modelRectangle), new shape( element.rscratch("svg") ));
			self.svgRemove(modelRectangle);
			
			// rendered node
			var zoom = self.zoom();
			var x = element.renderedPosition().x;
			var y = element.renderedPosition().y;
			var w = element.renderedOuterWidth();
			var h = element.renderedOuterHeight();
			
			// rendered selection square
			var x1 = selectionBounds.x1;
			var y1 = selectionBounds.y1;
			var x2 = selectionBounds.x2;
			var y2 = selectionBounds.y2;
			
			var centerPointInside = x1 <= x && x <= x2 && y1 <= y && y <= y2;
			var intersects = intersection.points.length > 0;
			
			return centerPointInside || intersects;
		}
		
		this.cy.elements().each(function(i, element){
			if( element.isNode() ){
				if( nodeInside(element) ){
					toSelect = toSelect.add(element);
				}
			} else {
				// if both node center points are inside, then the edge is inside
				if( element.visible() &&
					nodeInside( element.source()[0] ) &&
					nodeInside( element.target()[0] ) ){
					
					toSelect = toSelect.add(element);
				}
				
			}
		});
		
		if( !self.shiftDown ){
			toUnselect = toUnselect.add(
				this.cy.elements().filter(function(i, e){
					return e.selected() && !toSelect.same(e);
				})
			);
		}
		
		toUnselect.unselect();
		toSelect.select();
		
		self.selectedElements = self.selectedElements.not(toUnselect);
		self.selectedElements = self.selectedElements.add(toSelect);
		
		// TODO do we need this?
		//self.moveToFront(toSelect.nodes());
		
	};
	
	// by clicking
	SvgRenderer.prototype.selectElement = function(element){
		var self = this;
		
		var toUnselect = self.cy.collection();
		var toSelect = self.cy.collection();
		
		if( !self.shiftDown ){
			toUnselect = toUnselect.add(
				self.cy.elements().filter(function(i, e){
					return e.selected() && !element.same(e);
				})
			);
		}
		
		if( self.shiftDown ){
			if( element.selected() ){
				toUnselect = toUnselect.add(element);
			} else {
				toSelect = toSelect.add(element);
			}
		} else if( !element.selected() ){
			toSelect = toSelect.add(element);
		}
		
		toUnselect.unselect();
		toSelect.select();
		
		self.selectedElements = self.selectedElements.not(toUnselect);
		self.selectedElements = self.selectedElements.add(toSelect);
		self.moveToFront(toSelect);
	};
	
	SvgRenderer.prototype.moveToFront = function(collection){
		collection = collection.collection();
		var self = this;
		
		collection.each(function(i, element){
			self.svgRemove( element.rscratch("svgGroup") );
			self.makeSvgElement(element);
			self.updatePosition( collection.closedNeighborhood().edges() );
		});
	};
	
	SvgRenderer.prototype.unselectAll = function(){
		this.unselectElements(this.cy.elements());
	};
	
	SvgRenderer.prototype.makeSvgNode = function(element){		
		var p = element.position();
		var self = this;
		
		if( p.x == null || p.y == null ){
			
			return;
		}
		
		var svgDomElement;
		var style = element._private.style;
		
		var svgDomGroup = this.svg.group(this.nodesGroup);
		element.rscratch("svgGroup", svgDomGroup);
		
		svgDomElement = nodeShape(style.shape.strValue).svg(this.svg, svgDomGroup, element, p, style);
		element.rscratch().oldShape = style.shape.strValue;
		element.rscratch("svg", svgDomElement);
		this.makeSvgNodeLabel(element);
		
		element.rscratch("svg", svgDomElement);
		
		
		this.makeSvgNodeInteractive(element);
		this.updateElementStyle(element, style);
		return svgDomElement;
	};
	
	SvgRenderer.prototype.makeSvgNodeLabel = function(element){
		var self = this;
		
		var x = element.position("x");
		var y = element.position("y");
		
		element.rscratch().svgLabelGroup = self.svg.group(element.rscratch().svgGroup);
		element.rscratch().svgLabelOutline = self.svg.text(element.rscratch().svgLabelGroup, x, y, "label init");
		element.rscratch().svgLabel = self.svg.text(element.rscratch().svgLabelGroup, x, y, "label init");
	};
	
	SvgRenderer.prototype.positionSvgNodeLabel = function(element){
		var self = this;

		var x = element.position("x");
		var y = element.position("y");
		
		self.svg.change(element.rscratch().svgLabel, {
			x: x,
			y: y
		});
		
		self.svg.change(element.rscratch().svgLabelOutline, {
			x: x,
			y: y
		});
	};
	
	SvgRenderer.prototype.makeSvgEdgePath = function(element){ 
		var self = this;
		var tgt = element.target()[0];
		var src = element.source()[0];
		var loop = tgt.data("id") == src.data("id");
		var svgPath;
		
		var x1 = src.position("x");
		var y1 = src.position("y");
		var x2 = tgt.position("x");
		var y2 = tgt.position("y");
		
		// if the nodes are directly on top of each other, just make a small difference
		// so we don't get bad calculation states (e.g. divide by zero)
		if( x1 == x2 && y1 == y2 ){
			x2++;
			y2++;
		}
		
		var parallelEdges = element.parallelEdges();
		var size = parallelEdges.size();
		var index;
		var curveIndex;
		var curveDistance = 20;
		var betweenLoopsDistance = 20;
		var cp, cp1, cp2;
		var pDistance = self.getDistance({ x: x1, y: y1 }, { x: x2, y: y2 });
		var maxCurveDistance = 200;
		
		if( !loop && curved ){
			curveDistance = Math.min(20 + 4000/pDistance, maxCurveDistance);
		}
	
		parallelEdges.each(function(i, e){
			if( e == element ){
				index = i;
			}
		});
		
		function makePath(){
			var curved = curveIndex != 0;
			var path = self.svg.createPath();
			
			if( svgPath != null ){
				self.svgRemove(svgPath);
			}
			
			if( loop ){
				svgPath = self.svg.path( element.rscratch("svgGroup"), path.move(x1, y1).curveC(cp1.x, cp1.y, cp2.x, cp2.y, x2, y2) );
			} else if( curved ){
				svgPath = self.svg.path( element.rscratch("svgGroup"), path.move(x1, y1).curveQ(cp.x, cp.y, x2, y2) );
			} else {
				svgPath = self.svg.path( element.rscratch("svgGroup"), path.move(x1, y1).line(x2, y2) );
			}
		}
		
		if( loop ){
			var sh = src.height()
			var sw = src.width()
			curveDistance += Math.max(sw, sh);
			
			curveIndex = index;
			curveDistance += betweenLoopsDistance * (curveIndex);
			
			var h = curveDistance;
	        cp1 = { x: x1, y: y1 - sh/2 - h };
	        cp2 = { x: x1 - sw/2 - h, y: y1 };
			
			makePath();
		} else {
			// edge between 2 nodes
			
			var even = size % 2 == 0;
			if( even ){
				// even
				curveIndex = index - size/2 + (index < size/2 ? 0 : 1); // add one if on positive size (skip 0)
				
				if( curveIndex > 0 ){
					curveIndex -= 0.5;
				} else {
					curveIndex += 0.5;
				}
			} else {
				// odd
				curveIndex = index - Math.floor(size/2);
			}
			
			var curved = curveIndex != 0;
			
			if( src.id() > tgt.id() ){
				curveIndex *= -1;
			}
			
			if(curved){
				cp = cp1 = cp2 = self.getOrthogonalPoint({ x: x1, y: y1 }, { x: x2, y: y2 }, curveDistance * curveIndex);
			} else {
				cp = cp1 = {
					x: x2,
					y: y2
				};
				
				cp2 = {
					x: x1,
					y: y1
				};
			}
			
			makePath();
		}
		
		var edgeWidth = element._private.style.width.pxValue;
		var targetShape = tgt._private.style["shape"].value;
		var sourceShape = src._private.style["shape"].value;
		var targetArrowShape = element._private.style["target-arrow-shape"].value;
		var sourceArrowShape = element._private.style["source-arrow-shape"].value;
		var markerFactor = 3;
		var minArrowSize = 10;
		
		while(markerFactor * edgeWidth < minArrowSize){
			markerFactor++;
		}
		
		var f = markerFactor;
		var markerHeight = f * edgeWidth;
		var targetShape = nodeShape(targetShape).intersectionShape;
		var sourceShape = nodeShape(sourceShape).intersectionShape;
		
		var intersection = Intersection.intersectShapes(new Path(svgPath), new targetShape( tgt.rscratch("svg") ));
		var tgtInt = intersection.points[ intersection.points.length - 1 ];
		
		intersection = Intersection.intersectShapes(new Path(svgPath), new sourceShape( src.rscratch("svg") ));
		var srcInt = intersection.points[0];
		
		var scale = f * edgeWidth;
		var sourceRotation = -1*(this.getAngle(cp1, { x: x1, y: y1 }) - 90);
		var targetRotation = -1*(this.getAngle(cp2, { x: x2, y: y2 }) - 90);
		
		if( tgtInt != null ){
			if( targetArrowShape != "none" ){
				var end = self.getPointAlong(tgtInt, cp2, markerHeight/2, tgtInt);
				x2 = end.x;
				y2 = end.y;
			} else if( tgtInt != null ){
				x2 = tgtInt.x;
				y2 = tgtInt.y;
			}
		}
		
		if( srcInt != null ){
			if( sourceArrowShape != "none" ){
				var start = self.getPointAlong(srcInt, cp1, markerHeight/2, srcInt);
				x1 = start.x;
				y1 = start.y;
			} else {
				x1 = srcInt.x;
				y1 = srcInt.y;
			}
		}
		
		makePath();
		
		if( element.rscratch("svgTargetArrow") != null ){
			this.svgRemove( element.rscratch("svgTargetArrow") );
		}
		
		if( targetArrowShape != "none" ){
			var tgtShapeObj = edgeArrowShape(targetArrowShape);
			var tgtArrowTranslation = {
				x: x2 - tgtShapeObj.centerPoint.x * scale,
				y: y2 - tgtShapeObj.centerPoint.y * scale,
			};
			var targetCenter = tgtShapeObj.centerPoint;
			var targetArrow = tgtShapeObj == null ? null : tgtShapeObj.svg( this.svg, element.rscratch("svgGroup"), element, element.position(), element._private.style );
			element.rscratch("svgTargetArrow", targetArrow);

			this.svg.change(targetArrow, {
				transform: "translate(" + tgtArrowTranslation.x + " " + tgtArrowTranslation.y + ") scale(" + scale + ") rotate(" + targetRotation + " " + targetCenter.x + " " + targetCenter.y + ")"
			});
		}
		
		if( element.rscratch("svgSourceArrow") != null ){
			this.svgRemove( element.rscratch("svgSourceArrow") );
		}
		
		if( sourceArrowShape != "none" ){		
			var srcShapeObj = edgeArrowShape(sourceArrowShape);
			var srcArrowTranslation = {
				x: x1 - srcShapeObj.centerPoint.x * scale,
				y: y1 - srcShapeObj.centerPoint.y * scale,
			};
			var sourceCenter = srcShapeObj.centerPoint;
			var sourceArrow = srcShapeObj == null ? null : srcShapeObj.svg(this.svg, element.rscratch("svgGroup"), element, element.position(), element._private.style );
			element.rscratch().svgSourceArrow = sourceArrow;
			
			this.svg.change(sourceArrow, {
				transform: "translate(" + srcArrowTranslation.x + " " + srcArrowTranslation.y + ") scale(" + scale + ") rotate(" + sourceRotation + " " + sourceCenter.x + " " + sourceCenter.y + ")"
			});
		}
		
		var labelPosition;
		if( loop ){
			labelPosition = {
				x: (cp1.x + cp2.x)/2*0.85 + tgt.position("x")*0.15,
				y: (cp1.y + cp2.y)/2*0.85 + tgt.position("y")*0.15
			};
		} else if( curved ) {
			labelPosition = {
				x: ( cp.x + (x1+x2)/2 )/2,
				y: ( cp.y + (y1+y2)/2 )/2
			};
		} else {
			labelPosition = {
				x: (x1 + x2)/2,
				y: (y1 + y2)/2
			};
		}
		
		element.rscratch("svgLabelGroup", self.svg.group(element.rscratch().svgGroup) );
		element.rscratch("svgLabelOutline", self.svg.text(element.rscratch().svgLabelGroup, labelPosition.x, labelPosition.y, "label init") );
		element.rscratch("svgLabel", self.svg.text(element.rscratch().svgLabelGroup, labelPosition.x, labelPosition.y, "label init") );
		
		element.rscratch().svg = svgPath;
		return svgPath;
	};
	
	
	SvgRenderer.prototype.markerDrawFix = function(){
		this.forceRedraw();
	};
	
	window.redraw = SvgRenderer.prototype.forceRedraw = function(){
		this.svg.change(this.svgRoot, {
			opacity: 0
		});
		
		this.svg.change(this.svgRoot, {
			opacity: Math.random()
		});
		
		this.svg.change(this.svgRoot, {
			opacity: 1
		});
		
		var rect = this.svg.rect(0, 0, this.cy.container().width(), this.cy.container().height());
		this.svgRemove(rect);
	};
	
	SvgRenderer.prototype.getAngle = function(p1, p2){
		var rad2deg = function(rad){
			return rad * 180/Math.PI;
		};
		
		var h = this.getDistance(p1, p2);
		var dx = p2.x - p1.x;
		var dy = -1*(p2.y - p1.y);
		var acos = rad2deg( Math.acos( dx/h ) );
		
		if( dy < 0 ){
			return 360 - acos;
		} else {
			return acos;
		}

	};
	
	SvgRenderer.prototype.getOrthogonalPoint = function(p1, p2, h){
		var diff = { x: p1.x-p2.x, y: p1.y-p2.y };
	    var normal = this.getNormalizedPoint({ x: diff.y, y: -diff.x }, 1);
	    
	    var mid = { x: (p1.x + p2.x)/2, y: (p1.y + p2.y)/2 };
	    
	    return {x: mid.x + normal.x * h, y: mid.y + normal.y * h};
	};
	
	SvgRenderer.prototype.getPointAlong = function(p1, p2, h, p0){
		var slope = { x: p2.x-p1.x, y: p2.y-p1.y };
	    var normalSlope = this.getNormalizedPoint({ x: slope.x, y: slope.y }, 1);
	    
	    if( p0 == null ){
	    	p0 = p2;
	    }
	    
	    return {
	    	x: p0.x + normalSlope.x * h,
	    	y: p0.y + normalSlope.y * h
	    };
	};
	
	SvgRenderer.prototype.getNormalizedPoint = function(p, newLength){
		var currentLength = Math.sqrt(p.x*p.x + p.y*p.y);
		var factor = newLength / currentLength;
		
		return {
			x: p.x * factor,
			y: p.y * factor
		};
	};
	
	SvgRenderer.prototype.getDistance = function(p1, p2){
		return Math.sqrt( (p2.x - p1.x)*(p2.x - p1.x) + (p2.y - p1.y)*(p2.y - p1.y) );
	};
	
	SvgRenderer.prototype.makeSvgEdge = function(element){
		var self = this;
		var source = element.source().element();
		var target = element.target().element();
					
		if( source == null || target == null ){
			
			return;
		}
		
		self.svgRemove(  element._private.rscratch.svgGroup );

		var ps = source.position();
		var pt = target.position();
		
		if( ps.x == null || ps.y == null || pt.x == null || pt.y == null ){
			
			return;
		}
		
		var style = element._private.style;
		
		var svgDomGroup = this.svg.group(this.edgesGroup);
		element.rscratch().svgGroup = svgDomGroup;
		this.svg.change(svgDomGroup);
		
		// notation: (x1, y1, x2, y2) = (source.x, source.y, target.x, target.y)
		this.makeSvgEdgePath(element);
		
		
		this.makeSvgEdgeInteractive(element);
		this.updateElementStyle(element, style);
		return element.rscratch().svg;
	};
	
	SvgRenderer.prototype.makeSvgElement = function(element){
		var svgDomElement;
		
		if( element.group() == "nodes" ){
			svgDomElement = this.makeSvgNode(element);
		} else if( element.group() == "edges" ){
			svgDomElement = this.makeSvgEdge(element);
		}
		
		return svgDomElement;
	};
	
	SvgRenderer.prototype.getSvgElement = function(element){
		if( element.rscratch().svg != null ){
			return element.rscratch().svg;
		} else {
			return this.makeSvgElement(element);
		}
	};
	
	SvgRenderer.prototype.updateSelection = function(collection){
		this.updateElementsStyle(collection);
	};
	
	SvgRenderer.prototype.updateClass = function(collection){
		this.updateElementsStyle(collection);
	};
	
	SvgRenderer.prototype.updateData = function(collection, updateMappers){
		this.updateElementsStyle(collection);
		
		if( updateMappers ){
			this.updateMapperBounds( collection );
		}
	};
	
	SvgRenderer.prototype.updateMapperBounds = function(collection){
		var elements = this.cy.elements();
		
		if( collection.nodes().size() > 0 && collection.edges().size() > 0 ){
			// update both nodes & edges
		} else {
			// update only the group in the collection
			elements = elements.filter(function(){
				return this.group() == collection.eq(0).group();
			});
		}
		
		elements = elements.not(collection);
		this.updateElementsStyle( elements );
	};
	
	SvgRenderer.prototype.updateElementsStyle = function(collection){
		var self = this;
		collection = collection;
		
		// update nodes
		var nodes = collection.nodes();
		for( var i = 0; i < nodes.length; i++ ){
			var node = nodes[i];
			self.updateElementStyle(node);
		}

		var edges = collection.edges();
		for( var i = 0; i < edges.length; i++ ){
			var edge = edges[i];

			self.makeSvgElement(edge);
		}
		
		var connectedEdges = collection.connectedEdges().not(edges);
		for( var i = 0; i < connectedEdges.length; i++ ){
			var edge = connectedEdges[i];
			self.makeSvgElement(edge);
		}
	};
	
	SvgRenderer.prototype.setStyle = function(style){
		this.style = $.extend(true, {}, defaults.style, style);
	};
	
	SvgRenderer.prototype.updateStyle = function(eles){
		this.updateElementsStyle(eles);
	};
	
	SvgRenderer.prototype.updateBypass = function(collection){
		var self = this;
		collection = collection.collection();
		
		// update nodes
		collection.nodes().each(function(i, element){
			self.updateElementStyle(element);
		});
		
		// update connected edges
		collection.edges().add( collection.closedNeighborhood().edges() ).each(function(i, edge){
			self.updateElementStyle(edge);
		});
	};
	
	SvgRenderer.prototype.updateElementStyle = function(element, newStyle){ 
		if( element.isNode() ){
			this.updateNodeStyle(element, newStyle);
		} else if( element.isEdge() ){
			this.updateEdgeStyle(element, newStyle);
		}
	};
	
	SvgRenderer.prototype.updateNodeStyle = function(element, newStyle){
		
		
		var style = element._private.style;
		
		var newShape = element._private.style.shape.strValue;
		var oldShape = element.rscratch().oldShape;
		
		if( element.rscratch().svg == null ){
			$.error("SVG renderer can not update style for node `%s` since it has no SVG element", element.id());
			return;
		}
		
		if( oldShape != undefined && newShape != oldShape ){
			this.svgRemove(element.rscratch().svgGroup);
			this.makeSvgNode(element);
			return;
		}
			
		var visible = element.visible();

		// TODO add more as more styles are added
		// generic styles go here
		this.svg.change(element.rscratch().svg, {
			"pointer-events": "visible", // if visibility:hidden, no events
			fill: style["background-color"].strValue,
			fillOpacity: style["background-opacity"].strValue,
			stroke: style["border-width"].value > 0 ? style["border-color"].strValue : "none",
			strokeWidth: style["border-width"].value,
			strokeDashArray: lineStyle( style["border-style"].strValue ).array,
			strokeOpacity: style["border-opacity"].value,
			cursor: style["cursor"].strValue,
			"visibility": visible ? "visible" : "hidden",
		});
		
		this.svg.change(element.rscratch().svgGroup, {
			opacity: style["opacity"].value
		});
		
		// styles for label		
		var labelOptions = {
			"visibility": visible ? "visible" : "hidden",
			"pointer-events": "none",
			fill: style["color"].strValue,
			"font-family": style["font-family"].strValue,
			"font-weight": style["font-weight"].strValue,
			"font-style": style["font-style"].strValue,
			"text-decoration": style["text-decoration"].strValue,
			"font-variant": style["font-variant"].strValue,
			"font-size": style["font-size"].strValue,
			"text-rendering": "geometricPrecision"
		};
		
		this.svg.change(element.rscratch().svgLabelGroup, {
			opacity: style["text-opacity"].value
		});
		
		this.svg.change(element.rscratch().svgLabelOutline, {
			stroke: style["text-opacity"].value,
			strokeWidth: style["text-outline-width"].value * 2,
			fill: "none",
			opacity: style["text-opacity"].value
		});
		
		this.svg.change(element.rscratch().svgLabelOutline, labelOptions);
		this.svg.change(element.rscratch().svgLabel, labelOptions);
		
		var labelText = style["content"] ? style["content"].value : "";
		element.rscratch().svgLabel.textContent = labelText;
		element.rscratch().svgLabelOutline.textContent = labelText;
		
		var valign = style["text-valign"].strValue;
		var halign = style["text-halign"].strValue;
		
		// styles to the group
		this.svg.change(element.rscratch().svgGroup, {
			fillOpacity: style["opacity"].value
		});
		
		// update shape specific stuff like position
		nodeShape(style.shape.strValue).update(this.svg, this.nodesGroup, element, element.position(), style);
		
		// update label position after the node itself
		this.updateLabelPosition(element, valign, halign);	
		
	};
	
	SvgRenderer.prototype.updateLabelPosition = function(element, valign, halign){
		var spacing = 3;
		var dx = 0;
		var dy = 0;
		var height = 0;
		var width = 0;
		var text = element.rscratch().svgLabel.textContent;
		
		// update node label x, y
		if( element.isNode() ){
			this.positionSvgNodeLabel(element);
		}
		
		var textAnchor;
		var styleAttr;
		var transform;
		
		if( text == null || text == "" ){
			return;
		}
		
		if( element.isNode() ){
			height = element.height();
			width = element.width();
		}
		
		if( halign == "center" ){
			textAnchor =  {
				"text-anchor": "middle"
			};
		} else if( halign == "right" ){
			textAnchor =  {
				"text-anchor": "start"
			};
			dx = width/2 + spacing;
		} else if( halign == "left" ){
			textAnchor =  {
				"text-anchor": "end"
			};
			dx = -width/2 - spacing;
		}
		
		// TODO remove this hack to fix IE when it supports baseline properties properly
		var fontSize = parseInt(window.getComputedStyle(element.rscratch().svgLabel)["fontSize"]);
		var ieFix = $.browser.msie ? fontSize/3 : 0;
	
		if( valign == "center" ){
			styleAttr = {
				"style": "alignment-baseline: central; dominant-baseline: central;"
			};
			dy = 0 + ieFix;
		} else if( valign == "top" ){
			styleAttr = {
				"style": "alignment-baseline: normal; dominant-baseline: normal;"	
			};
			dy = -height/2 - spacing;
		} else if( valign == "bottom" ){
			styleAttr = {
				"style": "alignment-baseline: normal; dominant-baseline: normal;"
			};
			dy = height/2 + fontSize;
		}
		
		transform = {
			transform: "translate("+ dx +","+ dy +")"
		};
		
		var labelOptions = $.extend({}, textAnchor, styleAttr, transform);
		
		this.svg.change(element.rscratch().svgLabelOutline, labelOptions);
		this.svg.change(element.rscratch().svgLabel, labelOptions);
	};
	
	SvgRenderer.prototype.updateEdgeStyle = function(element, newStyle){
		var style = element._private.style;
		
		var visible = element.visible();

		// TODO add more as more styles are added
		// generic edge styles go here
		this.svg.change(element.rscratch().svg, {
			"pointer-events": "visibleStroke", // on visibility:hidden, no events
			stroke: style["line-color"].strValue,
			strokeWidth: style["width"].pxValue,
			strokeDashArray: style["line-style"].strValue,
			"stroke-linecap": "butt", // disable for now for markers to line up nicely
			cursor: style["cursor"].value,
			fill: "none",
			visibility: visible ? "visible" : "hidden"
		});
		
		this.svg.change(element.rscratch().svgGroup, {
			opacity: style["opacity"].value
		});
		
		this.svg.change(element.rscratch().svgTargetArrow, {
			fill: style["target-arrow-color"].strValue,
			cursor: style["cursor"].value,
			visibility: visible ? "visible" : "hidden"
		});
		
		this.svg.change(element.rscratch().svgSourceArrow, {
			fill: style["source-arrow-color"].strValue,
			cursor: style["cursor"].value,
			visibility: visible ? "visible" : "hidden"
		});
		
		var labelOptions = {
			"visibility": visible ? "visible" : "hidden",
			"pointer-events": "none",
			fill: style["color"].strValue,
			"font-family": style["font-family"].strValue,
			"font-weight": style["font-weight"].strValue,
			"font-style": style["font-style"].strValue,
			"text-decoration": style["text-decoration"].strValue,
			"font-variant": style["font-variant"].strValue,
			"font-size": style["font-size"].pxValue,
			"text-rendering": "geometricPrecision"
		};
		
		this.svg.change(element.rscratch().svgLabel, labelOptions);
		this.svg.change(element.rscratch().svgLabelOutline, $.extend({}, labelOptions, {
			fill: "none",
			stroke: style["text-outline-color"].strValue,
			strokeWidth: style["text-outline-width"].pxValue * 2,
			opacity: style["text-outline-opacity"].value
		}) );
		
		this.svg.change(element.rscratch().svgLabelGroup, {
			opacity: style["text-opacity"].value
		});
		
		var labelText = style.labelText == null ? "" : style.labelText;
		element.rscratch().svgLabel.textContent = labelText;
		element.rscratch().svgLabelOutline.textContent = labelText;
		this.updateLabelPosition(element, "middle", "middle");
		
		
	};
	
	SvgRenderer.prototype.addElements = function(collection, updateMappers){
		
		var self = this;
		var cy = this.cy;
		
		collection.nodes().each(function(i, element){
			self.makeSvgElement(element);
		});
		
		collection.edges().each(function(i, element){
			self.makeSvgElement(element);
		});
		
		self.positionEdges( collection.edges().parallelEdges() );

		if( updateMappers ){
			self.updateMapperBounds( collection );
		}
	};
	
	SvgRenderer.prototype.updatePosition = function(collection){
		
		
		
		collection = collection.collection();
		var container = this.cy.container();
		var svg = container.svg('get');
		var self = this;
		var cy = this.options.cy;
		
		// update nodes
		collection.nodes().each(function(i, element){
			var svgEle = self.getSvgElement(element);			
			var p = element.position();
			
			self.updateNodePositionFromShape(element);
			self.positionSvgNodeLabel(element);

			
		});
		
		// update connected edges
		self.positionEdges( collection.closedNeighborhood().edges() );
		
	};
	
	SvgRenderer.prototype.positionEdges = function(edges){
		var self = this;
		
		edges.each(function(i, edge){
			if( edge.rscratch().svgGroup != null ){
				self.svgRemove(edge.rscratch().svgGroup);
			}
			self.makeSvgEdge(edge);
			
			var ps = edge.source().position();
			var pt = edge.target().position();
			
			
		});
	};
	
	SvgRenderer.prototype.drawElements = function(collection){
		var self = this;
		
		self.updateElementsStyle( collection );
	};
	
	SvgRenderer.prototype.removeElements = function(collection, updateMappers){
		
		
		var container = this.cy.container();
		var svg = container.svg('get');
		var cy = this.options.cy;
		var self = this;
		
		collection.each(function(i, element){
			
			if( element.rscratch().svgGroup != null ){
				// remove the svg element from the dom
				svg.remove( element.rscratch().svgGroup );
				
				element.removerscratch("svg");
				element.removerscratch("svgGroup");
				element.removerscratch("svgSourceArrow");
				element.removerscratch("svgTargetArrow");
				element.removerscratch("svgLabel");
			} else {
				
			}
		});
		
		if( self.selectedElements != null ){
			self.selectedElements = self.selectedElements.not(collection);
		}

		var edgesToReposition = self.cy.collection();
		collection.edges().each(function(i, edge){
			var src = edge.source();
			var tgt = edge.target();

			edgesToReposition = edgesToReposition.add( src.edgesWith( tgt ) );
		});

		self.updatePosition( edgesToReposition );
		
		if( updateMappers ){
			this.updateMapperBounds( collection );
		}
	};
	
	SvgRenderer.prototype.notify = function(params){
		var container = this.options.cy.container();
	
		
		
		if( params.type == null ){
			$.error("The SVG renderer should be notified with a `type` field");
			return;
		}
		
		var self = this;
		switch( params.type ){
			case "load":
				self.init(function(){
					self.addElements( params.collection );
				});
				break;
		
			case "add":
				this.addElements( params.collection, params.updateMappers );
				break;
			
			case "remove":
				this.removeElements( params.collection, params.updateMappers );
				break;
			
			case "position":
				this.updatePosition( params.collection );
				break;
			
			case "style":
				this.updateStyle( params.collection );
				break;
				
			case "draw":
				this.drawElements( params.collection );
				break;

			case "viewport":
				this.updateViewport();
				break;
				
			default:
				
				break;
		}
	};

	function SvgExporter(options){
		this.options = options;
		this.cy = options.cy;
		this.renderer = options.renderer;
		
		if( this.renderer.name() != "svg" ){
			$.error("The SVG exporter can be used only if the SVG renderer is used");
		}
	}
	
	SvgExporter.prototype.run = function(){
		return this.options.cy.container().svg("get").toSVG();
	};
	
	$.cytoscape("renderer", "svg", SvgRenderer);
	$.cytoscape("exporter", "svg", SvgExporter);
	
})( jQuery, jQuery.cytoscape );
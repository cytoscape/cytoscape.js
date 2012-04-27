(function($, $$){

	var defaults = {
		minZoom: 0.001,
		maxZoom: 1000,
		maxPan: -1 >>> 1,
		minPan: (-(-1>>>1)-1),
		selectionToPanDelay: 500,
		dragToSelect: true,
		dragToPan: true,
			
		style: {
			selectors: {
				"node": {
					fillColor: "#888",
					fillOpacity: 1,
					borderColor: "#666",
					borderOpacity: 1,
					opacity: 1,
					borderWidth: 0,
					borderStyle: "solid",
					height: 10,
					width: 10,
					shape: "ellipse",
					cursor: "pointer",
					visibility: "visible",
					labelValign: "top",
					labelHalign: "middle",
					labelText: {
						defaultValue: "",
						passthroughMapper: "label"
					},
					labelFillColor: "#000",
					labelOutlineColor: "#666",
					labelOutlineWidth: 0,
					labelFontSize: "inherit",
					labelFontStyle: "normal",
					labelFontDecoration: "none", 
					labelFontVariant: "italic", 
					labelFontFamily: "Arial",
					labelFontWeight: "bold",
					labelOpacity: 1,
					labelOutlineOpacity: 1
				},
				"edge": {
					lineColor: "#ccc",
					targetArrowColor: "#ccc",
					sourceArrowColor: "#ccc",
					targetArrowShape: "none",
					sourceArrowShape: "none",
					opacity: 1,
					width: 1,
					style: "solid",
					cursor: "pointer",
					visibility: "visible",
					labelText: {
						defaultValue: "",
						passthroughMapper: "label"
					},
					labelFillColor: "#000",
					labelOutlineColor: "#666",
					labelOutlineWidth: 0,
					labelFontSize: "inherit",
					labelFontStyle: "normal",
					labelFontDecoration: "none", 
					labelFontVariant: "italic", 
					labelFontFamily: "Arial",
					labelFontWeight: "bold",
					labelOutlineOpacity: 1,
					labelOpacity: 1
				}
			},
			global: {
				panCursor: "grabbing",
				selectionFillColor: "#ccc",
				selectionOpacity: 0.5,
				selectionBorderColor: "#888",
				selectionBorderWidth: 1
			}
		}
	};
	
	var lineStyles = {};
	
	var registerLineStyle = function(style){
		$.cytoscapeweb("renderer", "svg", "linestyle", style.name, style);
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
		$.cytoscapeweb("renderer", "svg", "edgearrowshape", shape.name, shape);
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
	
	var registerNodeShape = function(shape){
		$.cytoscapeweb("renderer", "svg", "nodeshape", shape.name, shape);
		delete shape.name;
	};
	
	// use this as an example for adding more node shapes
	registerNodeShape({
		// name of the shape
		name: "ellipse",
		
		// generate the shape svg
		svg: function(svg, parent, node, position, style){
			return svg.ellipse(parent, position.x, position.y, style.width, style.height);
		},
		
		// update unique style attributes for this shape
		// see http://keith-wood.name/svgRef.html for api reference
		update: function(svg, parent, node, position, style){
			svg.change(node.renscratch("svg"), {
				cx: position.x,
				cy: position.y,
				rx: style.width / 2,
				ry: style.height / 2
			});
		},
		
		// 2D shape in intersection lib
		intersectionShape: Ellipse
	});
	
	registerNodeShape({
		name: "rectangle",
		svg: function(svg, parent, node, position, style){
			return svg.rect(parent, position.x - style.width/2, position.y - style.height/2, style.width, style.height);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node.renscratch("svg"), {
				x: position.x - style.width/2,
				y: position.y - style.height/2,
				width: style.width,
				height: style.height
			});
		},
		
		intersectionShape: Rectangle
	});
	
	registerNodeShape({
		name: "roundrectangle",
		svg: function(svg, parent, node, position, style){
			return svg.rect(parent, position.x - style.width/2, position.y - style.height/2, style.width, style.height, style.width/4, style.height/4);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node.renscratch("svg"), {
				x: position.x - style.width/2,
				y: position.y - style.height/2,
				width: style.width,
				height: style.height
			});
		},
		
		intersectionShape: Rectangle
	});
	
	registerNodeShape({
		name: "triangle",
		svg: function(svg, parent, node, position, style){
			return svg.polygon(parent,
					           [ 
					             [position.x,                 position.y - style.height/2], 
					             [position.x + style.width/2, position.y + style.height/2],
					             [position.x - style.width/2, position.y + style.height/2]
					           ]);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node.renscratch("svg"), {
				points: [ 
			             [position.x,                 position.y - style.height/2], 
			             [position.x + style.width/2, position.y + style.height/2],
			             [position.x - style.width/2, position.y + style.height/2]
			           ]
			});
		},
		
		intersectionShape: Polygon
	});
	
	function visibility(v){
		if( v != null && typeof v == typeof "" && ( v == "hidden" || v == "visible" ) ){
			return v;
		} else {
			$$.console.error("SVG renderer does not recognise %o as a valid visibility", v);
		}
	};
	
	function percent(p){
		if( p != null && typeof p == typeof 1 && !isNaN(p) &&  0 <= p && p <= 1 ){
			return p;
		} else {
			$$.console.error("SVG renderer does not recognise %o as a valid percent (should be between 0 and 1)", p);
		}
	}
	
	function color(c){
		if( c != null && typeof c == typeof "" && $.Color(c) != "" ){
			return $.Color(c).toHEX();
		} else {
			$$.console.error("SVG renderer does not recognise %o as a valid colour", c);
		}
	}
	
	function number(n){
		if( n != null && typeof n == typeof 1 && !isNaN(n) ){
			return n;
		} else {
			$$.console.error("SVG renderer does not recognise %o as a valid number", n);
		}
	}
	
	function nodeShape(name){
		var ret = $.cytoscapeweb("renderer", "svg", "nodeshape", name);
		
		if( ret == null ){
			$$.console.error("SVG renderer does not recognise %s as a valid node shape", name);
		}
		
		return ret;
	}
	
	function lineStyle(name){
		var ret = $.cytoscapeweb("renderer", "svg", "linestyle", name);
		
		if( ret == null ){
			$$.console.error("SVG renderer does not recognise %s as a valid line style", name);
		}
		
		return ret;
	}
	
	function edgeArrowShape(name){
		if( name == "none" || name == null ){
			return null;
		}
		
		return $.cytoscapeweb("renderer", "svg", "edgearrowshape", name);
	}
	
	function labelHalign(a){
		if( a != null && typeof a == typeof "" && ( a == "left" || a == "right" || a == "middle" ) ){
			return a;
		} else {
			$$.console.error("SVG renderer does not recognise %o as a valid label horizonal alignment", a);
		}	
	}
	
	function labelValign(a){
		if( a != null && typeof a == typeof "" && ( a == "top" || a == "bottom" || a == "middle" ) ){
			return a;
		} else {
			$$.console.error("SVG renderer does not recognise %o as a valid label vertical alignment", a);
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
		$$.console.debug("Creating SVG renderer with options (%o)", options);
		this.options = $.extend({}, defaults, options);
		this.setStyle(options.style);
		this.cy = options.cy;
		
		
		$$.console.debug("SVG renderer is using style (%o)", this.style);
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
			e.offsetX = e.clientX - self.cy.container().offset().left;
			e.offsetY = e.clientY - self.cy.container().offset().top;
		}
	};
	
	SvgRenderer.prototype.makeBackgroundInteractive = function(){
		
		var self = this;
		
		var svgDomElement = self.svgRoot;
		var panDelay = self.options.selectionToPanDelay;
		
		self.shiftDown = false;
		$(window).bind("keydown keyup", function(e){
			self.shiftDown = e.shiftKey;
		});
		
		function backgroundIsTarget(e){
			return e.target == svgDomElement 
				|| $(e.target).parents("g:last")[0] == self.edgesGroup
				|| $(e.target)[0] == self.svgBg;
		}
		
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
					if( _setPanCursor ){ return; }
					
					_setPanCursor = true;
					self.svg.change(svgDomElement, {
						cursor: cursor(self.style.global.panCursor)
					});
				}
				
				if( self.options.dragToPan ){
					var panDelayTimeout = setTimeout(function(){
						if( !self.cy.panning() ){
							return;
						}
						
						panning = true;
						selecting = false;
						
					}, panDelay);
				}
				
				var dragHandler = function(dragEvent){
					clearTimeout(panDelayTimeout);
					
					var dx = dragEvent.pageX - originX;
					var dy = dragEvent.pageY - originY;
					
					// new origin each event
					originX = dragEvent.pageX;
					originY = dragEvent.pageY;
					
					selectDx += dx;
					selectDy += dy;
					
					if( panning ){	
						self.translation.x += dx;
						self.translation.y += dy;
						
						setPanCursor();
						
						self.pan(self.translation);
					}
					
					if( selecting ){
						if( selectionSquare == null ){
							selectionSquare = self.svg.rect(selectOriginX, selectOriginY, 0, 0, {
								fill: color(self.style.global.selectionFillColor),
								opacity: percent(self.style.global.selectionOpacity),
								stroke: color(self.style.global.selectionBorderColor),
								strokeWidth: number(self.style.global.selectionBorderWidth)
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
		}).bind("mousewheel", function(e, delta, deltaX, deltaY){
			if( !self.cy.panning() || !self.cy.zooming() ){
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
			
			if( pointsAtLeast(tmEvent, 1) && self.cy.panning() ){
				point21 = point(tmEvent, 0);
				
				if( pointsAtLeast(tmEvent, 2) && self.cy.zooming() ){
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
			// core and bg via the core (CyElement) logic
			if( backgroundIsTarget(e) ){
				var event = $.extend({}, e, { cyTarget: self.cy });
				self.cy.background().trigger(event);
				self.cy.trigger(event);
			}
		});
		
	};
	
	SvgRenderer.prototype.zoomAboutPoint = function(point, zoom, translation){
		var self = this;
		var cy = self.cy;
		
		if( !cy.panning() || !cy.zooming() ){
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
		
		if( !cy.zooming() ){
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
		
		if( !cy.panning() || (zoom !== undefined && !cy.zooming()) ){
			return;
		}
		
		if( elements == null || elements.size() == 0 ){
			elements = this.cy.elements();
		}
		
		if( elements.is(":removed") ){
			$$.console.debug("SVG renderer does not take into account removed elements when fitting");
			elements = elements.filter(":inside");
		}
		
		$$.console.debug("Fit SVG renderer to view bounds");
		
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

		update(n);

		// fix for loop edges (their bounding boxes are approx 2x width and height of path
		// they push the bb up and left
		elements.edges().each(function(){
			var src = this.source().id();
			var tgt = this.target().id();
			var loopFactor = lf = 0.4;
			
			if( src == tgt ){
				var bb = this.renscratch("svg").getBBox();
				bb.x2 = bb.x + bb.width;
				bb.y2 = bb.y + bb.height;
				bb.x1 = bb.x;
				bb.y1 = bb.y;

				var bbAdjusted = {};
				bbAdjusted.x = bb.x1 + bb.width * lf;
				bbAdjusted.y = bb.y1 + bb.height * lf;
				bbAdjusted.width = bb.x2 - bbAdjusted.x;
				bbAdjusted.height = bb.y2 - bbAdjusted.y;

				var bbLabel = this.renscratch("svgLabel").getBBox();

				update(bbAdjusted);
				update(bbLabel);
			} else {
				var bb = this.renscratch("svg").getBBox();
				var bbLabel = this.renscratch("svgLabel").getBBox();

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
		if( !this.cy.panning() ){
			return;
		}
		
		$$.console.debug("Relatively pan SVG renderer with position (%o)", position);
		
		this.transform({
			translation: {
				x: this.translation.x + number(position.x),
				y: this.translation.y + number(position.y)
			}
		});
	};
	
	SvgRenderer.prototype.pan = function(position){
		if( !this.cy.panning() ){
			return;
		}
		
		$$.console.debug("Pan SVG renderer with position (%o)", position);
		
		if( position === undefined ){
			return {
				x: this.translation.x,
				y: this.translation.y
			};
		}
		
		if( position == null || typeof position != typeof {} ){
			$$.console.error("You can not pan without specifying a proper position object; `%o` is invalid", position);
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
		
		if( capped.valid ){
			self.translation = capped.translation;
			self.scale = capped.scale;
		} else {
		
			if( params.capScale ){
				$$.console.debug("Capping zoom level %o to %o", self.scale, capped.scale);
				self.scale = capped.scale;
			}
			
			if( params.capTranslation ){
				$$.console.debug("Capping translation %o to %o", self.translation, capped.translation);
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
	};
	
	SvgRenderer.prototype.calculateStyleField = function(element, fieldName){
		var self = this;
		var styleCalculator = self.options.styleCalculator;
		var selectors = self.style.selectors;
		
		var field = undefined;
		var bypassField = element.bypass(false)[fieldName];
		
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
		style = $.extend(style, element.bypass(false));
		
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
		var style = element.style(false);
		var parent = element.renscratch("svgGroup");
		var position = element.position(false);
		
		nodeShape(style.shape).update(this.svg, parent, element, position, style);
	};
	
	SvgRenderer.prototype.makeSvgEdgeInteractive = function(element){
		var svgDomElement = element.renscratch("svg");
		var targetArrow = element.renscratch("svgTargetArrow");
		var sourceArrow = element.renscratch("svgSourceArrow");
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
		var svgDomElement = element.renscratch("svg");
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
				
				var elements;
				
				if( element.selected() ){
					elements = self.selectedElements.add(element);
				} else {
					elements = element.collection();
				}
				
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
	
	SvgRenderer.prototype.renderedPosition = function(element){
		var self = this;
		
		return self.renderedPoint( element.position(false) );
	};
	
	SvgRenderer.prototype.hideElements = function(collection){
		collection.each(function(i, element){
			element.bypass(false).visibility = "hidden";
		});
		
		this.updateBypass(collection);
	};
	
	SvgRenderer.prototype.showElements = function(collection){
		var self = this;
		var updated = this.cy.collection();
		
		collection.each(function(i, element){
			element.bypass(false).visibility = "visible";
		});
		
		this.updateBypass(collection);
	};
	
	SvgRenderer.prototype.elementIsVisible = function(element){
		return element.style(false).visibility != "hidden";
	};
	
	SvgRenderer.prototype.renderedDimensions = function(element){
		var self = this;
		
		if( element.isNode() ){
			return {
				height: element.style("height") * self.zoom(),
				width: element.style("width") * self.zoom()
			};
		} else {
			return {
				width: element.style("width") * self.zoom()
			};
		}
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

			if( !self.elementIsVisible(element) ){
				return false;
			}
			
			// intersect rectangle in the model with the actual node shape in the model
			var shape = nodeShape( element.style("shape") ).intersectionShape;
			var modelRectangleP1 = self.modelPoint({ x: selectionBounds.x1, y: selectionBounds.y1 });
			var modelRectangleP2 = self.modelPoint({ x: selectionBounds.x2, y: selectionBounds.y2 });
			var modelRectangle = self.svg.rect(modelRectangleP1.x, modelRectangleP1.y, modelRectangleP2.x - modelRectangleP1.x, modelRectangleP2.y - modelRectangleP1.y);
			var intersection = Intersection.intersectShapes(new Rectangle(modelRectangle), new shape( element.renscratch("svg") ));
			self.svgRemove(modelRectangle);
			
			// rendered node
			var zoom = self.zoom();
			var x = element.renderedPosition().x;
			var y = element.renderedPosition().y;
			var w = element.renderedDimensions().width + element.style("borderWidth") * zoom;
			var h = element.renderedDimensions().height + element.style("borderWidth") * zoom;
			
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
				if( self.elementIsVisible(element) &&
					nodeInside( element.source() ) &&
					nodeInside( element.target() ) ){
					
					toSelect = toSelect.add(element);
				}
				
			}
		});
		
		if( !self.shiftDown ){
			toUnselect = toUnselect.add(
				this.cy.elements().filter(function(i, e){
					return e.selected() && !toSelect.allSame(e);
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
			self.svgRemove( element.renscratch("svgGroup") );
			self.makeSvgElement(element);
			self.updatePosition( collection.closedNeighborhood().edges() );
		});
	};
	
	SvgRenderer.prototype.unselectAll = function(){
		this.unselectElements(this.cy.elements());
	};
	
	SvgRenderer.prototype.makeSvgNode = function(element){		
		var p = element.position(false);
		var self = this;
		
		if( p.x == null || p.y == null ){
			$$.console.debug("SVG renderer is ignoring creating of node `%s` with position (%o, %o)", element.id(), p.x, p.y);
			return;
		}
		
		var svgDomElement;
		var style = this.calculateStyle(element);
		
		var svgDomGroup = this.svg.group(this.nodesGroup);
		element.renscratch("svgGroup", svgDomGroup);
		
		svgDomElement = nodeShape(style.shape).svg(this.svg, svgDomGroup, element, p, style);
		element.renscratch("svg", svgDomElement);
		this.makeSvgNodeLabel(element);
		
		element.renscratch("svg", svgDomElement);
		$$.console.debug("SVG renderer made node `%s` with position (%i, %i)", element.id(), p.x, p.y);
		
		this.makeSvgNodeInteractive(element);
		this.updateElementStyle(element, style);
		return svgDomElement;
	};
	
	SvgRenderer.prototype.makeSvgNodeLabel = function(element){
		var self = this;
		
		var x = element.position("x");
		var y = element.position("y");
		
		element.renscratch().svgLabelGroup = self.svg.group(element.renscratch().svgGroup);
		element.renscratch().svgLabelOutline = self.svg.text(element.renscratch().svgLabelGroup, x, y, "label init");
		element.renscratch().svgLabel = self.svg.text(element.renscratch().svgLabelGroup, x, y, "label init");
	};
	
	SvgRenderer.prototype.positionSvgNodeLabel = function(element){
		var self = this;

		var x = element.position("x");
		var y = element.position("y");
		
		self.svg.change(element.renscratch().svgLabel, {
			x: x,
			y: y
		});
		
		self.svg.change(element.renscratch().svgLabelOutline, {
			x: x,
			y: y
		});
	};
	
	SvgRenderer.prototype.makeSvgEdgePath = function(element){
		var self = this;
		var tgt = element.target();
		var src = element.source();
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
				svgPath = self.svg.path( element.renscratch("svgGroup"), path.move(x1, y1).curveC(cp1.x, cp1.y, cp2.x, cp2.y, x2, y2) );
			} else if( curved ){
				svgPath = self.svg.path( element.renscratch("svgGroup"), path.move(x1, y1).curveQ(cp.x, cp.y, x2, y2) );
			} else {
				svgPath = self.svg.path( element.renscratch("svgGroup"), path.move(x1, y1).line(x2, y2) );
			}
		}
		
		if( loop ){
			var sh = src.style("height");
			var sw = src.style("width");
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
		
		var edgeWidth = self.calculateStyleField(element, "width");
		var targetShape = self.calculateStyleField(tgt, "shape");
		var sourceShape = self.calculateStyleField(src, "shape");
		var targetArrowShape = self.calculateStyleField(element, "targetArrowShape");
		var sourceArrowShape = self.calculateStyleField(element, "sourceArrowShape");
		var markerFactor = 3;
		var minArrowSize = 10;
		
		while(markerFactor * edgeWidth < minArrowSize){
			markerFactor++;
		}
		
		var f = markerFactor;
		var markerHeight = f * edgeWidth;
		var targetShape = nodeShape(targetShape).intersectionShape;
		var sourceShape = nodeShape(sourceShape).intersectionShape;
		
		var intersection = Intersection.intersectShapes(new Path(svgPath), new targetShape( tgt.renscratch("svg") ));
		var tgtInt = intersection.points[ intersection.points.length - 1 ];
		
		intersection = Intersection.intersectShapes(new Path(svgPath), new sourceShape( src.renscratch("svg") ));
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
		
		if( element.renscratch("svgTargetArrow") != null ){
			this.svgRemove( element.renscratch("svgTargetArrow") );
		}
		
		if( targetArrowShape != "none" ){
			var tgtShapeObj = edgeArrowShape(targetArrowShape);
			var tgtArrowTranslation = {
				x: x2 - tgtShapeObj.centerPoint.x * scale,
				y: y2 - tgtShapeObj.centerPoint.y * scale,
			};
			var targetCenter = tgtShapeObj.centerPoint;
			var targetArrow = tgtShapeObj == null ? null : tgtShapeObj.svg( this.svg, element.renscratch("svgGroup"), element, element.position(false), element.style(false) );
			element.renscratch("svgTargetArrow", targetArrow);

			this.svg.change(targetArrow, {
				transform: "translate(" + tgtArrowTranslation.x + " " + tgtArrowTranslation.y + ") scale(" + scale + ") rotate(" + targetRotation + " " + targetCenter.x + " " + targetCenter.y + ")"
			});
		}
		
		if( element.renscratch("svgSourceArrow") != null ){
			this.svgRemove( element.renscratch("svgSourceArrow") );
		}
		
		if( sourceArrowShape != "none" ){		
			var srcShapeObj = edgeArrowShape(sourceArrowShape);
			var srcArrowTranslation = {
				x: x1 - srcShapeObj.centerPoint.x * scale,
				y: y1 - srcShapeObj.centerPoint.y * scale,
			};
			var sourceCenter = srcShapeObj.centerPoint;
			var sourceArrow = srcShapeObj == null ? null : srcShapeObj.svg(this.svg, element.renscratch("svgGroup"), element, element.position(false), element.style(false) );
			element.renscratch().svgSourceArrow = sourceArrow;
			
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
		
		element.renscratch("svgLabelGroup", self.svg.group(element.renscratch().svgGroup) );
		element.renscratch("svgLabelOutline", self.svg.text(element.renscratch().svgLabelGroup, labelPosition.x, labelPosition.y, "label init") );
		element.renscratch("svgLabel", self.svg.text(element.renscratch().svgLabelGroup, labelPosition.x, labelPosition.y, "label init") );
		
		element.renscratch().svg = svgPath;
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
			$$.console.debug("SVG renderer is ignoring creating of edge `%s` with missing nodes");
			return;
		}
		
		var ps = source.position(false);
		var pt = target.position(false);
		
		if( ps.x == null || ps.y == null || pt.x == null || pt.y == null ){
			$$.console.debug("SVG renderer is ignoring creating of edge `%s` with position (%o, %o, %o, %o)", element.id(), ps.x, ps.y, pt.x, pt.y);
			return;
		}
		
		var style = this.calculateStyle(element);
		
		var svgDomGroup = this.svg.group(this.edgesGroup);
		element.renscratch().svgGroup = svgDomGroup;
		this.svg.change(svgDomGroup);
		
		// notation: (x1, y1, x2, y2) = (source.x, source.y, target.x, target.y)
		this.makeSvgEdgePath(element);
		
		$$.console.debug("SVG renderer made edge `%s` with position (%i, %i, %i, %i)", element.id(), ps.x, ps.y, pt.x, pt.y);
		
		this.makeSvgEdgeInteractive(element);
		this.updateElementStyle(element, style);
		return element.renscratch().svg;
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
		if( element.renscratch().svg != null ){
			return element.renscratch().svg;
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
		collection = collection.collection();
		
		// update nodes
		collection.nodes().each(function(i, element){
			self.updateElementStyle(element);
		});
		
		// update edges
		collection.edges().each(function(i, element){
			self.updateElementStyle(element);
		});
		
		// update positions of connected edges but not those already covered by the update for edges above
		collection.nodes().neighborhood().edges().not( collection.edges() ).each(function(i, element){
			self.updatePosition(element);
		});
	};
	
	SvgRenderer.prototype.setStyle = function(style){
		this.style = $.extend(true, {}, defaults.style, style);
	};
	
	SvgRenderer.prototype.updateStyle = function(style){
		var collection = this.cy.elements();
		
		this.setStyle(style);
		
		this.updateElementsStyle(collection);
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
		var oldShape = element.style(false).shape;
		
		element._private.style = newStyle != null ? newStyle : this.calculateStyle(element);
		var style = element.style(false);
		
		var newShape = element.style(false).shape;
		
		if( element.renscratch().svg == null ){
			$$.console.error("SVG renderer can not update style for node `%s` since it has no SVG element", element.id());
			return;
		}
		
		if( newShape != oldShape ){
			this.svgRemove(element.renscratch().svgGroup);
			this.makeSvgNode(element);
			return;
		}
			
		// TODO add more as more styles are added
		// generic styles go here
		this.svg.change(element.renscratch().svg, {
			"pointer-events": "visible", // if visibility:hidden, no events
			fill: color(style.fillColor),
			fillOpacity: percent(style.fillOpacity),
			stroke: number(style.borderWidth) > 0 ? color(style.borderColor) : "none",
			strokeWidth: number(style.borderWidth),
			strokeDashArray: lineStyle(style.borderStyle).array,
			strokeOpacity: percent(style.borderOpacity),
			cursor: cursor(style.cursor),
			"visibility": visibility(style.visibility)
		});
		
		this.svg.change(element.renscratch().svgGroup, {
			opacity: percent(style.opacity)
		});
		
		// styles for label		
		var labelOptions = {
			"visibility": visibility(style.visibility),
			"pointer-events": "none",
			fill: color(style.labelFillColor),
			"font-family": style.labelFontFamily,
			"font-weight": style.labelFontWeight,
			"font-style": style.labelFontStyle,
			"text-decoration": style.labelFontDecoration,
			"font-variant": style.labelFontVariant,
			"font-size": style.labelFontSize,
			"text-rendering": "geometricPrecision"
		};
		
		this.svg.change(element.renscratch().svgLabelGroup, {
			opacity: percent(style.labelOpacity)
		});
		
		this.svg.change(element.renscratch().svgLabelOutline, {
			stroke: color(style.labelOutlineColor),
			strokeWidth: number(style.labelOutlineWidth) * 2,
			fill: "none",
			opacity: percent(style.labelOutlineOpacity)
		});
		
		this.svg.change(element.renscratch().svgLabelOutline, labelOptions);
		this.svg.change(element.renscratch().svgLabel, labelOptions);
		
		var labelText = style.labelText == null ? "" : style.labelText;
		element.renscratch().svgLabel.textContent = labelText;
		element.renscratch().svgLabelOutline.textContent = labelText;
		
		var valign = labelValign(style.labelValign);
		var halign = labelHalign(style.labelHalign);
		
		// styles to the group
		this.svg.change(element.renscratch().svgGroup, {
			fillOpacity: percent(style.fillOpacity)
		});
		
		// update shape specific stuff like position
		nodeShape(style.shape).update(this.svg, this.nodesGroup, element, element.position(false), style);
		
		// update label position after the node itself
		this.updateLabelPosition(element, valign, halign);
		
		$$.console.debug("SVG renderer collapsed mappers and updated style for node `%s` to %o", element.id(), style);
	};
	
	SvgRenderer.prototype.updateLabelPosition = function(element, valign, halign){
		var spacing = 3;
		var dx = 0;
		var dy = 0;
		var height = 0;
		var width = 0;
		var text = element.renscratch().svgLabel.textContent;
		
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
			height = element.style(false).height;
			width = element.style(false).width;
		}
		
		if( halign == "middle" ){
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
		var fontSize = parseInt(window.getComputedStyle(element.renscratch().svgLabel)["fontSize"]);
		var ieFix = $.browser.msie ? fontSize/3 : 0;
	
		if( valign == "middle" ){
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
		
		this.svg.change(element.renscratch().svgLabelOutline, labelOptions);
		this.svg.change(element.renscratch().svgLabel, labelOptions);
	};
	
	SvgRenderer.prototype.updateEdgeStyle = function(element, newStyle){
		var oldTargetShape = element.style(false).targetArrowShape;
		var oldSourceShape = element.style(false).sourceArrowShape;
		
		element._private.style = newStyle != null ? newStyle : this.calculateStyle(element);
		var style = element.style(false);
		
		if( element.renscratch().svg == null ){
			$$.console.error("SVG renderer can not update style for edge `%s` since it has no SVG element", element.id());
			return;
		}
		
		var newSrcStyle = element.source().style();
		var oldSrcStyle = element.renscratch().oldSourceStyle || newSrcStyle;
		
		var newTgtStyle = element.target().style();
		var oldTgtStyle = element.renscratch().oldTargetStyle || newTgtStyle;
		
		var newTargetShape = element.style(false).targetArrowShape;
		var newSourceShape = element.style(false).sourceArrowShape;
		
		var nodesStyleChanged = newSrcStyle.height != oldSrcStyle.height || newSrcStyle.width != oldSrcStyle.width ||
			newTgtStyle.height != oldTgtStyle.height || newTgtStyle.width != oldTgtStyle.width ||
			newSrcStyle.shape != oldSrcStyle.shape || newTgtStyle.shape != oldTgtStyle.shape ||
			newSrcStyle.borderWidth != oldSrcStyle.borderWidth || newTgtStyle.borderWidth != oldTgtStyle.borderWidth;
		
		var widthChanged = element.renscratch().oldStyle == null || element.renscratch().oldStyle.width != style.width;
		
		element.renscratch().oldSourceStyle = newSrcStyle;
		element.renscratch().oldTargetStyle = newTgtStyle;
		element.renscratch().oldStyle = style;
		
		if( newTargetShape != oldTargetShape || newSourceShape != oldSourceShape || nodesStyleChanged || widthChanged ){
			this.svgRemove(element.renscratch().svgGroup);
			this.makeSvgEdge(element);
			
			return;
		}
		
		// TODO add more as more styles are added
		// generic edge styles go here
		this.svg.change(element.renscratch().svg, {
			"pointer-events": "visibleStroke", // on visibility:hidden, no events
			stroke: color(style.lineColor),
			strokeWidth: number(style.width),
			strokeDashArray: lineStyle(style.style).array,
			"stroke-linecap": "butt", // disable for now for markers to line up nicely
			cursor: cursor(style.cursor),
			fill: "none",
			visibility: visibility(style.visibility)
		});
		
		this.svg.change(element.renscratch().svgGroup, {
			opacity: percent(style.opacity)
		});
		
		this.svg.change(element.renscratch().svgTargetArrow, {
			fill: color(style.targetArrowColor),
			cursor: cursor(style.cursor),
			visibility: visibility(style.visibility)
		});
		
		this.svg.change(element.renscratch().svgSourceArrow, {
			fill: color(style.sourceArrowColor),
			cursor: cursor(style.cursor),
			visibility: visibility(style.visibility)
		});
		
		var labelOptions = {
			"visibility": visibility(style.visibility),
			"pointer-events": "none",
			fill: color(style.labelFillColor),
			"font-family": style.labelFontFamily,
			"font-weight": style.labelFontWeight,
			"font-style": style.labelFontStyle,
			"text-decoration": style.labelFontDecoration,
			"font-variant": style.labelFontVariant,
			"font-size": style.labelFontSize,
			"text-rendering": "geometricPrecision"
		};
		
		this.svg.change(element.renscratch().svgLabel, labelOptions);
		this.svg.change(element.renscratch().svgLabelOutline, $.extend({}, labelOptions, {
			fill: "none",
			stroke: color(style.labelOutlineColor),
			strokeWidth: number(style.labelOutlineWidth) * 2,
			opacity: percent(style.labelOutlineOpacity),
		}) );
		
		this.svg.change(element.renscratch().svgLabelGroup, {
			opacity: percent(style.labelOpacity)
		});
		
		var labelText = style.labelText == null ? "" : style.labelText;
		element.renscratch().svgLabel.textContent = labelText;
		element.renscratch().svgLabelOutline.textContent = labelText;
		this.updateLabelPosition(element, "middle", "middle");
		
		$$.console.debug("SVG renderer collapsed mappers and updated style for edge `%s` to %o", element.id(), style);
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
		
		$$.console.debug("SVG renderer is updating node positions");
		
		collection = collection.collection();
		var container = this.cy.container();
		var svg = container.svg('get');
		var self = this;
		var cy = this.options.cy;
		
		// update nodes
		collection.nodes().each(function(i, element){
			var svgEle = self.getSvgElement(element);			
			var p = element.position(false);
			
			self.updateNodePositionFromShape(element);
			self.positionSvgNodeLabel(element);

			$$.console.debug("SVG renderer is moving node `%s` to position (%o, %o)", element.id(), p.x, p.y);
		});
		
		// update connected edges
		self.positionEdges( collection.closedNeighborhood().edges() );
		
	};
	
	SvgRenderer.prototype.positionEdges = function(edges){
		var self = this;
		
		edges.each(function(i, edge){
			if( edge.renscratch().svgGroup != null ){
				self.svgRemove(edge.renscratch().svgGroup);
			}
			self.makeSvgEdge(edge);
			
			var ps = edge.source().position(false);
			var pt = edge.target().position(false);
			
			$$.console.debug("SVG renderer is moving edge `%s` to position (%o, %o, %o, %o)", edge.id(), ps.x, ps.y, pt.x, pt.y);
		});
	};
	
	SvgRenderer.prototype.drawElements = function(collection){
		var self = this;
		
		self.updateElementsStyle( collection );
	};
	
	SvgRenderer.prototype.removeElements = function(collection, updateMappers){
		$$.console.debug("SVG renderer is removing elements");
		
		var container = this.cy.container();
		var svg = container.svg('get');
		var cy = this.options.cy;
		var self = this;
		
		collection.each(function(i, element){
			
			if( element.renscratch().svgGroup != null ){
				// remove the svg element from the dom
				svg.remove( element.renscratch().svgGroup );
				
				element.removeRenscratch("svg");
				element.removeRenscratch("svgGroup");
				element.removeRenscratch("svgSourceArrow");
				element.removeRenscratch("svgTargetArrow");
				// TODO add delete other svg children like labels
			} else {
				$$.console.debug("Element with group `%s` and ID `%s` has no associated SVG element", element.group(), element.id());
			}
		});
		
		if( self.selectedElements != null ){
			self.selectedElements = self.selectedElements.not(collection);
		}
		
		if( updateMappers ){
			this.updateMapperBounds( collection );
		}
	};
	
	SvgRenderer.prototype.notify = function(params){
		var container = this.options.cy.container();
	
		$$.console.debug("Notify SVG renderer with params (%o)", params);
		
		if( params.type == null ){
			$$.console.error("The SVG renderer should be notified with a `type` field");
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
				this.updateStyle( params.style );
				break;
				
			case "bypass":
				this.updateBypass( params.collection );
				break;
				
			case "class":
				this.updateClass( params.collection );
				break;
				
			case "data":
				this.updateData( params.collection, params.updateMappers );
				break;
				
			case "select":
			case "unselect":
				this.updateSelection( params.collection );
				break;
				
			case "draw":
				this.drawElements( params.collection );
				break;
				
			default:
				$$.console.debug("The SVG renderer doesn't consider the `%s` event", params.type);
				break;
		}
	};

	function SvgExporter(options){
		this.options = options;
		this.cy = options.cy;
		this.renderer = options.renderer;
		
		if( this.renderer.name() != "svg" ){
			$$.console.error("The SVG exporter can be used only if the SVG renderer is used");
		}
	}
	
	SvgExporter.prototype.run = function(){
		return this.options.cy.container().svg("get").toSVG();
	};
	
	$.cytoscapeweb("renderer", "svg", SvgRenderer);
	$.cytoscapeweb("exporter", "svg", SvgExporter);
	
})( jQuery, jQuery.cytoscapeweb );
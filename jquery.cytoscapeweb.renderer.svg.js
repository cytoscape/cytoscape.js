(function($){
	
	$.fn.svgattr = function(attrName, val){
		
		var container = $(this).parents("svg:first").parent();
		var svg = container.svg('get'); 
		
		if( val !== undefined ){
			// set
			var obj = {};
			obj[attrName] = val;
			svg.change( $(this)[0], obj );
		}
		
	};
	
})(jQuery);

$(function(){
	
	// TODO add more styles
	var defaults = {
		nodes: {
			fillColor: "#888",
			borderColor: "#666",
			borderWidth: 1,
			borderStyle: "solid",
			opacity: 1,
			size: 10,
			shape: "ellipse",
			cursor: "pointer",
			selected: {
				borderWidth: 3,
				borderColor: "#000"
			}
		},
		edges: {
			color: "#ccc",
			opacity: 1,
			width: 1,
			style: "solid",
			cursor: "pointer"
		},
		global: {
			panCursor: "grabbing",
			selectionFillColor: "#ccc",
			selectionOpacity: 0.5,
			selectionBorderColor: "#888",
			selectionBorderWidth: 1
		}
	};
	
	var lineStyles = {};
	
	var registerLineStyle = SvgRenderer.prototype.registerLineStyle = function(style){
		lineStyles[ style.name.toLowerCase() ] = style;
		style.name = style.name.toLowerCase();
		
		$.cytoscapeweb("debug", "SVG renderer registered line style with name `%s` and definition %o", style.name, style);
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
	
	var nodeShapes = {};
	
	var registerNodeShape = SvgRenderer.prototype.registerNodeShape = function(shape){
		nodeShapes[ shape.name.toLowerCase() ] = shape;
		shape.name = shape.name.toLowerCase();
		
		$.cytoscapeweb("debug", "SVG renderer registered shape with name `%s` and definition %o", shape.name, shape);
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
			svg.change(node._private.svg, {
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
			svg.change(node._private.svg, {
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
			svg.change(node._private.svg, {
				x: position.x - style.width/2,
				y: position.y - style.height/2,
				width: style.width,
				height: style.height
			});
		},
		
		intersectionShape: Rectangle
	});
	
	function percent(p){
		if( number(p) && 0 <= p && p <= 1 ){
			return p;
		} else {
			$.cytoscapeweb("error", "SVG renderer does not recognise %o as a valid percent (should be between 0 and 1)", p);
		}
	}
	
	function color(c){
		if( c != null && typeof c == typeof "" && $.Color(c) != "" ){
			return $.Color(c).toHEX();
		} else {
			$.cytoscapeweb("error", "SVG renderer does not recognise %o as a valid colour", c);
		}
	}
	
	function number(n){
		if( n != null && typeof n == typeof 1 && !isNaN(n) ){
			return n;
		} else {
			$.cytoscapeweb("error", "SVG renderer does not recognise %o as a valid number", n);
		}
	}
	
	function nodeShape(name){
		var ret = nodeShapes[ name.toLowerCase() ];
		
		if( ret == null ){
			$.cytoscapeweb("error", "SVG renderer does not recognise %s as a valid node shape", name);
		}
		
		return ret;
	}
	
	function lineStyle(name){
		var ret = lineStyles[ name.toLowerCase() ];
		
		if( ret == null ){
			$.cytoscapeweb("error", "SVG renderer does not recognise %s as a valid line style", name);
		}
		
		return ret;
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
		$.cytoscapeweb("debug", "Creating SVG renderer with options (%o)", options);
		this.options = options;
		this.style = $.extend(true, {}, defaults, options.style);
		
		$.cytoscapeweb("debug", "SVG renderer is using style (%o)", this.style);
	}
	
	SvgRenderer.prototype.init = function(callback){
		var container = $(this.options.selector);
		var svg = container.svg('get'); 
		var self = this;
		
		this.container = container;
		this.svg = svg;
		this.cy = this.options.cytoscapeweb;
		
		if( svg != null ){
			svg.clear(true);	
		} else {
			container.css({
				padding: "0 !important"
			});
			
			container.svg({
				onLoad: function(s){
					
					self.scale = 1;
					self.translation = { x: 0, y: 0 };
					
					container.find("svg").css("overflow", "hidden"); // fixes ie overflow
					
					self.transformTouchEvent(window, "touchmove", "mousemove");
					
					svg = s;
					self.svg = svg;
					
					self.edgesGroup = svg.group();
					self.nodesGroup = svg.group();
					self.svgRoot = $(self.nodesGroup).parents("svg:first")[0];
					
					self.selectedElements = self.cy.collection();
					
					$(self.edgesGroup).svgattr("class", "cw-edges");
					$(self.nodesGroup).svgattr("class", "cw-nodes");
					
					self.defs = self.svg.defs();
					
					
					self.makeBackgroundInteractive();
					
					callback();
				}
			});
		}
	};
	
	SvgRenderer.prototype.offsetFix = function(e){
		var self = this;
		
		// firefox fix :(
		if( e.offsetX == null || e.offsetY == null ){
			e.offsetX = e.clientX - $(self.options.selector).offset().left;
			e.offsetY = e.clientY - $(self.options.selector).offset().top;
		}
	};
	
	SvgRenderer.prototype.makeBackgroundInteractive = function(){
		
		var self = this;
		
		var svgDomElement = self.svgRoot;
		var panDelay = 150;
		
		self.shiftDown = false;
		$(window).bind("keydown keyup", function(e){
			self.shiftDown = e.shiftKey;
		});
		
		$(svgDomElement).bind("mousedown", function(mousedownEvent){

			if( mousedownEvent.target == svgDomElement || $(mousedownEvent.target).parents("g:last")[0] == self.edgesGroup ){
				mousedownEvent.preventDefault();
				
				self.offsetFix(mousedownEvent);
				
				var selectionSquare = null;
				var selectionBounds = {};
				
				var panning = false;
				var selecting = true;
				
				var originX = mousedownEvent.pageX;
				var originY = mousedownEvent.pageY;
				
				var selectOriginX = mousedownEvent.offsetX;
				var selectOriginY = mousedownEvent.offsetY;
				var selectDx = 0;
				var selectDy = 0;
				
				var panDelayTimeout = setTimeout(function(){
					panning = true;
					selecting = false;
					
					self.svg.change(svgDomElement, {
						cursor: cursor(self.style.global.panCursor)
					});
					
					$(self.options.selector).scrollLeft(100);
					
				}, panDelay);
				
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
						if( selectionSquare != null ){
							self.selectElementsFromIntersection(selectionSquare, selectionBounds);
							self.svg.remove(selectionSquare);
						} else if( mouseupEvent.target == svgDomElement ){
							self.unselectAll();
						}
					}
					
				};
				
				$(window).bind("mouseup", endHandler);
				$(window).bind("blur", endHandler);
				$(svgDomElement).bind("mouseup", endHandler);
			}
		}).bind("mousewheel", function(e, delta, deltaX, deltaY){
			
			self.offsetFix(e);
			
			var point = {
				x: e.offsetX,
				y: e.offsetY
			};
			
			var pan1 = self.pan();
			var zoom1 = self.zoom();
			var zoom2 = zoom1 * (1 + delta);
			
			var pan2 = {
				x: -zoom2/zoom1 * (point.x - pan1.x) + point.x,
				y: -zoom2/zoom1 * (point.y - pan1.y) + point.y
			};
			
			self.transform({
				translation: pan2,
				scale: zoom2
			});	
			
			e.preventDefault();
		});
		
	};
	
	SvgRenderer.prototype.zoom = function(scale){
		
		if( scale === undefined ){
			return this.scale;
		}
		
		this.transform({
			scale: scale
		});
	};
	
	SvgRenderer.prototype.panBy = function(position){
		$.cytoscapeweb("debug", "Relatively pan SVG renderer with position (%o)", position);
		
		this.transform({
			translation: {
				x: this.translation.x + number(position.x),
				y: this.translation.y + number(position.y)
			}
		});
	};
	
	SvgRenderer.prototype.pan = function(position){
		$.cytoscapeweb("debug", "Pan SVG renderer with position (%o)", position);
		
		if( position === undefined ){
			return {
				x: this.translation.x,
				y: this.translation.y
			};
		}
		
		if( position == null || typeof position != typeof {} ){
			$.cytoscapeweb("error", "You can not pan without specifying a proper position object; `%o` is invalid", position);
			return;
		}
		
		this.transform({
			translation: {
				x: number(position.x),
				y: number(position.y)
			}
		});
	};
	
	SvgRenderer.prototype.transform = function(params){
		var translation = params.translation;
		var scale = params.scale;
		var self = this;
		
		if( translation != null ){
			self.translation = {
				x: translation.x,
				y: translation.y
			};
		}
		
		if( scale != null ){
			self.scale = scale;
		}
		
		function transform(svgElement){
			self.svg.change(svgElement, {
				transform: "translate(" + self.translation.x + "," + self.translation.y + ") scale(" + self.scale + ")"
			});
		}
		
		transform(self.nodesGroup);
		transform(self.edgesGroup);
	};
	
	SvgRenderer.prototype.calculateStyle = function(element){
		var self = this;
		var styleCalculator = self.options.styleCalculator;
		var style = $.extend({}, this.style[element.group()], element._private.bypass);
		
		if( element.selected() ){
			var selected = style.selected;
			delete style.selected;
			
			style = $.extend({}, style, selected);
		} else {
			delete style.selected;
		}
		
		$.each(style, function(styleName, styleVal){
			style[styleName] = styleCalculator.calculate(element, styleVal);
		});
		
		element._private.style = style;
		
		if( element._private.group == "nodes" ){
			// width and height are size unless at least one is defined
			if( style.width == null && style.height == null ){
				style.width = style.size;
				style.height = style.size;
			} else {
				
				// use the size for undefined other field
				
				if( style.height != null ){
					if( style.width == null ){
						style.width = style.size;
					}
				}
				
				if( style.width != null ){
					if( style.height == null ){
						style.height = style.size;
					}
				}
			}
			
			// opacity defaults to overall opacity if not set
			if( style.borderOpacity == null ){
				style.borderOpacity = style.opacity;
			}
			if( style.fillOpacity == null ){
				style.fillOpacity = style.opacity;
			}
		}
		
		return style;
	};
	
	SvgRenderer.prototype.updateNodePositionFromShape = function(element){
		var style = element._private.style;
		var parent = element._private.svgGroup;
		var position = element._private.position;
		
		nodeShape(style.shape).update(this.svg, parent, element, position, style);
	};
	
	SvgRenderer.prototype.transformTouchEvent = function(domElement, fromEvent, toEvent){
		domElement.addEventListener(fromEvent, function(e){
			var evt = $.extend({}, e);
			evt.type = toEvent;
			
			if( e.touches != null && e.touches[0] != null ){
				evt.pageX = e.touches[0].pageX;
				evt.pageY = e.touches[0].pageY;
				evt.clientX = e.touches[0].clientX;
				evt.clientY = e.touches[0].clientY;
				evt.screenX = e.touches[0].screenX;
				evt.screenY = e.touches[0].screenY;
				evt.layerX = e.touches[0].layerX;
				evt.layerY = e.touches[0].layerY;
			}
			
			e.preventDefault();
			$(domElement).trigger(evt);
			return false;
		});
	};
	
	SvgRenderer.prototype.makeSvgEdgeInteractive = function(element){
		var svgDomElement = element._private.svg;
		var svgCanvas = $(svgDomElement).parents("svg:first")[0];
		var self = this;
		
		$(svgDomElement).bind("mouseup mousedown click", function(e){
			element.trigger(e);
		}).bind("click", function(e){
			element.select();
		});
	};
	
	SvgRenderer.prototype.makeSvgNodeInteractive = function(element){
		var svgDomElement = element._private.svg;
		var svgCanvas = $(svgDomElement).parents("svg:first")[0];
		var self = this;
		var draggedAfterMouseDown = null;
		
		// you need to prevent default event handling to 
		// prevent built-in browser drag-and-drop etc
		
		$(svgDomElement).bind("mousedown", function(mousedownEvent){
			draggedAfterMouseDown = false;
			
			element.trigger(mousedownEvent);
			
			if( element._private.grabbed || element._private.locked ){
				mousedownEvent.preventDefault();
				return;
			}
			 
			element._private.grabbed = true;
			
			var originX = mousedownEvent.pageX;
			var originY = mousedownEvent.pageY;
			
			var justStartedDragging = true;
			var dragHandler = function(dragEvent){
				
				self.moveToFront(element);
				draggedAfterMouseDown = true;
				
				var dx = (dragEvent.pageX - originX) / self.zoom();
				var dy = (dragEvent.pageY - originY) / self.zoom();
				
				// new origin each event
				originX = dragEvent.pageX;
				originY = dragEvent.pageY;
				
				var elements;
				
				if( element.selected() ){
					elements = self.selectedElements.add(element);
				} else {
					elements = element.collection();
				}
				
				elements.each(function(i, e){
					e._private.position.x += dx;
					e._private.position.y += dy;
				});			
				
				self.updatePosition( elements );
				
				if( justStartedDragging ){
					justStartedDragging = false;
					element.trigger($.extend({}, dragEvent, { type: "dragstart" }));
				} else {
					element.trigger($.extend({}, dragEvent, { type: "drag" }));
				}
				
			};
			
			$(window).bind("mousemove", dragHandler);
			
			var finishedDragging = false;
			var endHandler = function(mouseupEvent){
				
				if( !finishedDragging ){
					finishedDragging = true;
				} else {
					return;
				}
				
				$(window).unbind("mousemove", dragHandler);

				$(window).unbind("mouseup", endHandler);
				$(window).unbind("blur", endHandler);
				$(svgDomElement).unbind("mouseup", endHandler);
				
				element._private.grabbed = false;
				
				element.trigger($.extend({}, mouseupEvent, { type: "dragstop" }));
			};
			
			$(window).bind("mouseup", endHandler);
			$(window).bind("blur", endHandler);
			$(svgDomElement).bind("mouseup", endHandler);
			
			mousedownEvent.preventDefault();
		}).bind("mouseup", function(e){
			element.trigger($.extend({}, e));
			
			if( draggedAfterMouseDown == false ){
				draggedAfterMouseDown = null;
				element.trigger($.extend({}, e, { type: "click" }));
				self.selectElement(element);
			}
		}).bind("mouseover mouseout mousemove", function(e){
			element.trigger($.extend({}, e));
		});
		
	};
	
	SvgRenderer.prototype.modelPoint = function(screenPoint){
		var self = this;
		return {
			x: (screenPoint.x - self.pan().x) / self.zoom(),
			y: (screenPoint.y - self.pan().y) / self.zoom()
		};
	}
	
	SvgRenderer.prototype.renderedPoint = function(modelPoint){
		var self = this;
		return {
			x: modelPoint.x * self.zoom() + self.pan().x,
			y: modelPoint.y * self.zoom() + self.pan().y
		};
	}
	
	SvgRenderer.prototype.renderedPosition = function(element){
		var self = this;
		
		return self.renderedPoint(element._private.position);
	};
	
	SvgRenderer.prototype.renderedDimensions = function(element){
		var self = this;
		
		if( element.isNode() ){
			return {
				height: element._private.style.height * self.zoom(),
				width: element._private.style.width * self.zoom(),
				size: element._private.style.size * self.zoom()
			};
		} else {
			return {
				width: element._private.style.width * self.zoom()
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
			// node
			var zoom = self.zoom();
			var x = element.renderedPosition().x;
			var y = element.renderedPosition().y;
			var w = element.renderedDimensions().width + element._private.style.borderWidth * zoom;
			var h = element.renderedDimensions().height + element._private.style.borderWidth * zoom;
			
			// selection square
			var x1 = selectionBounds.x1;
			var y1 = selectionBounds.y1;
			var x2 = selectionBounds.x2;
			var y2 = selectionBounds.y2;
			
			if( x1 <= x + w/2 && x - w/2 <= x2 &&
				y1 <= y + h/2 && y - h/2 <= y2 ){
				
				return true;
			} 
			
			return false;
		}
		
		function positionInside(position){
			var x = position.x;
			var y = position.y;
			
			// selection square
			var x1 = selectionBounds.x1;
			var y1 = selectionBounds.y1;
			var x2 = selectionBounds.x2;
			var y2 = selectionBounds.y2;
			
			if( x1 <= x && x <= x2 &&
				y1 <= y && y <= y2 ){
				
				return true;
			} 
			
			return false;
		}
		
		this.cy.elements().each(function(i, element){
			if( element.isNode() ){
				if( nodeInside(element) ){
					toSelect = toSelect.add(element);
				}
			} else {
				// if both node center points are inside, then the edge is inside
				if( positionInside( element.source()._private.position ) &&
					positionInside( element.target()._private.position ) ){
					
					toSelect = toSelect.add(element);
				}
				
				// edge isn't totally inside, so check for intersections
				else {
					var intersection = Intersection.intersectShapes(new Rectangle(svgSelectionShape), new Line(element._private.svg));
					if( intersection.points.length > 0 ){
						toSelect = toSelect.add(element);
					}
				}
			}
		});
		
		if( !self.shiftDown ){
			toUnselect = toUnselect.add(
				this.cy.elements().filter(function(i, e){
					return e.selected() && !toSelect.hasAll(e);
				})
			);
		}
		
		toUnselect.unselect();
		toSelect.select();
		
		self.selectedElements = self.selectedElements.not(toUnselect);
		self.selectedElements = self.selectedElements.add(toSelect);
		self.moveToFront(toSelect);
		
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
			self.svg.remove(element._private.svgGroup);
			self.makeSvgElement(element);
			self.updatePosition(collection.neighbors(false).edges());
		});
	};
	
	SvgRenderer.prototype.unselectAll = function(){
		this.unselectElements(this.cy.elements());
	};
	
	SvgRenderer.prototype.makeSvgNode = function(element){		
		var p = element._private.position;
		
		if( p.x == null || p.y == null ){
			$.cytoscapeweb("debug", "SVG renderer is ignoring creating of node `%s` with position (%o, %o)", element._private.data.id, p.x, p.y);
			return;
		}
		
		var svgDomElement;
		var style = this.calculateStyle(element);
		
		var svgDomGroup = this.svg.group(this.nodesGroup);
		element._private.svgGroup = svgDomGroup;
		
		svgDomElement = nodeShape(style.shape).svg(this.svg, svgDomGroup, element, p, style);
		
		this.transformTouchEvent(svgDomElement, "touchstart", "mousedown");
		this.transformTouchEvent(svgDomElement, "touchend", "mouseup");
		
		element._private.svg = svgDomElement;
		$.cytoscapeweb("debug", "SVG renderer made node `%s` with position (%i, %i)", element._private.data.id, p.x, p.y);
		
		this.makeSvgNodeInteractive(element);
		this.updateElementStyle(element, style);
		return svgDomElement;
	};
	
	SvgRenderer.prototype.makeSvgEdge = function(element){
		var source = this.cy.node( element._private.data.source );
		var target = this.cy.node( element._private.data.target );
					
		var ps = source._private.position;
		var pt = target._private.position;
		
		if( ps.x == null || ps.y == null || pt.x == null || pt.y == null ){
			$.cytoscapeweb("debug", "SVG renderer is ignoring creating of edge `%s` with position (%o, %o, %o, %o)", element._private.data.id, ps.x, ps.y, pt.x, pt.y);
			return;
		}

		var style = this.calculateStyle(element);
		
		var svgDomGroup = this.svg.group(this.edgesGroup);
		element._private.svgGroup = svgDomGroup;
		
		// notation: (x1, y1, x2, y2) = (source.x, source.y, target.x, target.y)
		// TODO curve edge based on index in element.neighbors().edges()
		var svgDomElement = this.svg.line(svgDomGroup, ps.x, ps.y, pt.x, pt.y);
				
		var targetMarkerId = "target_" + element._private.data.id;
		var targetMarker = this.svg.marker(this.defs, targetMarkerId, 0, 0, 5, 5, { orient: "auto", markerUnits: "strokeWidth", refX: 5, refY: 2.5, strokeWidth: 0 });
		element._private.targetSvg = this.svg.polygon(targetMarker, [[0, 0], [5, 2.5], [0, 5]], { fill: "red" });
		
		this.svg.change(svgDomElement, {
			markerEnd: "url(#" + targetMarkerId + ")"
		});
		
		element._private.svg = svgDomElement;
		$.cytoscapeweb("debug", "SVG renderer made edge `%s` with position (%i, %i, %i, %i)", element._private.data.id, ps.x, ps.y, pt.x, pt.y);
		
		this.makeSvgEdgeInteractive(element);
		this.updateElementStyle(element, style);
		return svgDomElement;
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
		if( element._private.svg != null ){
			return element._private.svg;
		} else {
			return this.makeSvgElement(element);
		}
	};
	
	SvgRenderer.prototype.updateSelection = function(collection){
		this.updateElementsStyle(collection);
	};
	
	SvgRenderer.prototype.updateData = function(collection){
		this.updateElementsStyle(collection);
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
		collection.nodes().neighbors().edges().not( collection.edges() ).each(function(i, element){
			self.updatePosition(element);
		});
	}
	
	SvgRenderer.prototype.updateStyle = function(style){
		var collection = this.cy.elements();
		var self = this;
		
		if( style !== undefined ){
			self.style = style;
		}
		
		this.updateElementsStyle(collection);
	};
	
	SvgRenderer.prototype.updateBypass = function(collection){
		collection = collection.collection();
		
		// update nodes
		collection.nodes().each(function(i, element){
			self.updateElementStyle(element);
		});
		
		// update connected edges
		collection.edges().add( collection.neighbors(false).edges() ).each(function(i, edge){
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
		element._private.style = newStyle != null ? newStyle : this.calculateStyle(element);
		var style = element._private.style;
		
		if( element._private.svg == null ){
			$.cytoscapeweb("error", "SVG renderer can not update style for node `%s` since it has no SVG element", element._private.data.id);
			return;
		}
		
		// TODO add more as more styles are added
		// generic styles go here
		this.svg.change(element._private.svg, {
			fill: color(style.fillColor),
			stroke: color(style.borderColor),
			strokeWidth: number(style.borderWidth),
			strokeDashArray: lineStyle(style.borderStyle).array,
			strokeOpacity: percent(style.borderOpacity),
			cursor: cursor(style.cursor)
		});
		
		// styles to the group
		this.svg.change(element._private.svgGroup, {
			fillOpacity: percent(style.fillOpacity)
		});
		
		nodeShape(style.shape).update(this.svg, this.nodesGroup, element, element._private.position, style);
		
		$.cytoscapeweb("debug", "SVG renderer collapsed mappers and updated style for node `%s` to %o", element._private.data.id, style);
	};
	
	SvgRenderer.prototype.updateEdgeStyle = function(element, newStyle){
		element._private.style = newStyle != null ? newStyle : this.calculateStyle(element);
		var style = element._private.style;
		
		if( element._private.svg == null ){
			$.cytoscapeweb("error", "SVG renderer can not update style for edge `%s` since it has no SVG element", element._private.data.id);
			return;
		}
		
		// TODO add more as more styles are added
		// generic edge styles go here
		this.svg.change(element._private.svg, {
			stroke: color(style.color),
			strokeWidth: number(style.width),
			strokeDashArray: lineStyle(style.style).array,
			"stroke-linecap": "round",
			opacity: percent(style.opacity),
			cursor: cursor(style.cursor)
		});
		
		this.svg.change(element._private.targetSvg, {
			fill: color("red")
		});
		
		$.cytoscapeweb("debug", "SVG renderer collapsed mappers and updated style for edge `%s` to %o", element._private.data.id, style);
	};
	
	SvgRenderer.prototype.addElements = function(collection){
		
		var self = this;
		
		collection.each(function(i, element){
			if( element.group() == "nodes" ){
				self.makeSvgElement(element);
			}
			
			else if( element.group() == "edges" ){
				self.makeSvgElement(element);
			}
		});

	};
	
	SvgRenderer.prototype.updatePosition = function(collection){
		
		$.cytoscapeweb("debug", "SVG renderer is updating node positions");
		
		collection = collection.collection();
		var container = $(this.options.selector);
		var svg = container.svg('get');
		var self = this;
		var cy = this.options.cytoscapeweb;
		
		// update nodes
		collection.nodes().each(function(i, element){
			var svgEle = self.getSvgElement(element);			
			var p = element._private.position;
			
			self.updateNodePositionFromShape(element);

			$.cytoscapeweb("debug", "SVG renderer is moving node `%s` to position (%o, %o)", element._private.data.id, p.x, p.y);
		});
		
		function updateEdges(edges){
			edges.each(function(i, edge){
				
				var svgEle = self.getSvgElement(edge);
				var target = cy.node( edge.data("target") );
				var source = cy.node( edge.data("source") );
				var ps = source._private.position;
				var pt = target._private.position;
				
				svg.change(svgEle, { x1: ps.x, y1: ps.y, x2: pt.x, y2: pt.y });
				
				var targetIntShape = nodeShape(target._private.style.shape).intersectionShape;
				var targetIntersection = Intersection.intersectShapes(new targetIntShape(target._private.svg), new Line(edge._private.svg));
				$.cytoscapeweb("debug", "Intersection for target edge %s at %o", target.data("id"), targetIntersection);
				if( targetIntersection.points.length > 0 ){
					self.svg.change(edge._private.svg, {
						x2: targetIntersection.points[0].x,
						y2: targetIntersection.points[0].y
					});
				}
				
				var sourceIntShape = nodeShape(source._private.style.shape).intersectionShape;
				var sourceIntersection = Intersection.intersectShapes(new sourceIntShape(source._private.svg), new Line(edge._private.svg));
				$.cytoscapeweb("debug", "Intersection for source edge %s at %o", source.data("id"), sourceIntersection);
				if( sourceIntersection.points.length > 0 ){
					self.svg.change(edge._private.svg, {
						x1: sourceIntersection.points[0].x,
						y1: sourceIntersection.points[0].y
					});
				}
				
				$.cytoscapeweb("debug", "SVG renderer is moving edge `%s` to position (%o, %o, %o, %o)", edge._private.data.id, ps.x, ps.y, pt.x, pt.y);
			});
		}
		
		// update connected edges
		updateEdges( collection.neighbors(false).edges() );
		
	};
	
	SvgRenderer.prototype.removeElements = function(collection){
		$.cytoscapeweb("debug", "SVG renderer is removing elements");
		
		var container = $(this.options.selector);
		var svg = container.svg('get');
		
		collection.each(function(i, element){
			if( element._private.svg != null ){
				svg.remove(element._private.svg);
				element._private.svg = null;
			} else {
				$.cytoscapeweb("debug", "Element with group `%s` and ID `%s` has no associated SVG element", element._private.group, element._private.data.id);
			}
		});
	};
	
	SvgRenderer.prototype.notify = function(params){
		var container = $(params.selector);
	
		$.cytoscapeweb("debug", "Notify SVG renderer with params (%o)", params);
		
		if( params.type == null ){
			$.cytoscapeweb("error", "The SVG renderer should be notified with a `type` field");
			return;
		}
		
		var self = this;
		switch( params.type ){
			case "load":
				self.init(function(){
					self.addElements( params.collection );
					container.trigger("rendered");
				});
				break;
		
			case "add":
				this.addElements( params.collection );
				break;
			
			case "remove":
				this.removeElements( params.collection );
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
				
			case "data":
				this.updateData( params.collection );
				break;
				
			case "select":
			case "unselect":
				this.updateSelection( params.collection );
				break;
			
			default:
				$.cytoscapeweb("debug", "The SVG renderer doesn't consider the `%s` event", params.type);
				break;
		}
	};
	
	function SvgExporter(options){
		this.options = options;
		this.cy = options.cytoscapeweb;
	}
	
	SvgExporter.prototype.run = function(){
		return $(this.options.selector).svg("get").toSVG();
	};
	
	$.cytoscapeweb("renderer", "svg", SvgRenderer);
	$.cytoscapeweb("exporter", "svg", SvgExporter);
	
});
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
			borderColor: "#333",
			borderWidth: 1,
			borderStyle: "solid",
			opacity: 1,
			size: 10,
			shape: "ellipse",
			cursor: "pointer"
		},
		edges: {
			color: "#bbb",
			opacity: 1,
			width: 1,
			style: "solid",
			cursor: "pointer"
		},
		global: {
			
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
				rx: style.width,
				ry: style.height
			});
		},
		
		// 2D shape in intersection lib
		intersectionShape: Ellipse
	});
	
	registerNodeShape({
		name: "rectangle",
		svg: function(svg, parent, node, position, style){
			return svg.rect(parent, position.x - style.size/2, position.y - style.size/2, style.width, style.height);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node._private.svg, {
				cx: position.x,
				cy: position.y,
				width: style.width,
				height: style.height
			});
		},
		
		intersectionShape: Rectangle
	});
	
	registerNodeShape({
		name: "roundrectangle",
		svg: function(svg, parent, node, position, style){
			return svg.rect(parent, position.x - style.size/2, position.y - style.size/2, style.width, style.height, style.width/4, style.height/4);
		},
		update: function(svg, parent, node, position, style){
			svg.change(node._private.svg, {
				cx: position.x,
				cy: position.y,
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
			container.svg({
				onLoad: function(s){
					
					self.transformTouchEvent(window, "touchmove", "mousemove");
					
					svg = s;
					self.svg = svg;
					self.edgesGroup = svg.group();
					self.nodesGroup = svg.group();
					
					$(self.edgesGroup).svgattr("class", "cw-edges");
					$(self.nodesGroup).svgattr("class", "cw-nodes");
					
					self.defs = self.svg.defs();
					
					callback();
				}
			});
		}
	};
	
	SvgRenderer.prototype.calculateStyle = function(element){
		var style = element._private.style = this.options.styleCalculator.calculate(element, this.style);
		
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
		var group = element._private.svgGroup;
		var position = element._private.position;
		
		nodeShape(style.shape).update(this.svg, group, element, position, style);
	};
	
	SvgRenderer.prototype.transformTouchEvent = function(domElement, fromEvent, toEvent){
		domElement.addEventListener(fromEvent, function(e){
			
			var evt = $.extend(true, {}, e);
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
			
			$(domElement).trigger(evt);
			
			e.preventDefault();
		});
	};
	
	SvgRenderer.prototype.makeSvgNodeInteractive = function(element){
		var svgDomElement = element._private.svg;
		var svgCanvas = $(svgDomElement).parents("svg:first")[0];
		var self = this;
		var draggedAfterMouseDown;
		
		// you need to prevent default event handling to 
		// prevent built-in browser drag-and-drop etc
		
		$(svgDomElement).bind("mousedown", function(mousedownEvent){
			mousedownEvent.preventDefault();
			draggedAfterMouseDown = false;
			
			element.trigger(mousedownEvent);
			
			if( element._private.grabbed ){
				return;
			}
			 
			element._private.grabbed = true;
			
			var originX = mousedownEvent.pageX;
			var originY = mousedownEvent.pageY;
			
			var justStartedDragging = true;
			var dragHandler = function(dragEvent){
				dragEvent.preventDefault();
				
				draggedAfterMouseDown = true;
				
				var dx = dragEvent.pageX - originX;
				var dy = dragEvent.pageY - originY;
				
				// new origin each event
				originX = dragEvent.pageX;
				originY = dragEvent.pageY;

				element._private.position.x += dx;
				element._private.position.y += dy;
				
				self.updatePosition( element );
				
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
				
				mouseupEvent.preventDefault();
				
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
		}).bind("mouseup", function(e){
			element.trigger($.extend({}, e));
			
			if( !draggedAfterMouseDown ){
				element.trigger($.extend({}, e, { type: "click" }));
			}
		});
		
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
		
		// notation: (x1, y1, x2, y2) = (source.x, source.y, target.x, target.y)
		// TODO curve edge based on index in element.firstNeighbors().edges()
		var svgDomElement = this.svg.line(this.edgesGroup, ps.x, ps.y, pt.x, pt.y);
				
		var targetMarkerId = "target_" + element._private.data.id;
		var targetMarker = this.svg.marker(this.defs, targetMarkerId, 0, 0, 5, 5, { orient: "auto", markerUnits: "strokeWidth", refX: 5, refY: 2.5, strokeWidth: 0 });
		element._private.targetSvg = this.svg.polygon(targetMarker, [[0, 0], [5, 2.5], [0, 5]], { fill: "red" });
		
		this.svg.change(svgDomElement, {
			markerEnd: "url(#" + targetMarkerId + ")"
		});
		
		element._private.svg = svgDomElement;
		$.cytoscapeweb("debug", "SVG renderer made edge `%s` with position (%i, %i, %i, %i)", element._private.data.id, ps.x, ps.y, pt.x, pt.y);
		
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
	
	SvgRenderer.prototype.updateElementStyle = function(element, newStyle){
		if( element._private.group == "nodes" ){
			this.updateNodeStyle(element, newStyle);
		} else if( element._private.group == "edges" ){
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
			fillOpacity: percent(style.fillOpacity),
			stroke: color(style.borderColor),
			strokeWidth: number(style.borderWidth),
			strokeDashArray: lineStyle(style.borderStyle).array,
			strokeOpacity: percent(style.borderOpacity),
			cursor: style.cursor
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
			opacity: percent(style.opacity)
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
		
		// update edges actually in the collection
		updateEdges( collection.edges() );
		
		// update connected edges
		collection.nodes().each(function(i, element){
			var edges = element.firstNeighbors().edges();
			updateEdges(edges);
		});
		
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
			case "bypass":
				// TODO update styles OR recreate svg element if necessary (e.g. shape change)
			case "data":
			case "select":
			case "unselect":
			case "lock":
			case "unlock":
			case "mouseover":
			case "mouseout":
				$.cytoscapeweb("error", "TODO svg::" + params.type); // TODO add these events
				break;
			
			default:
				$.cytoscapeweb("debug", "The SVG renderer doesn't consider the `%s` event", params.type);
				break;
		}
	};
	
	SvgRenderer.prototype.pan = function(params){
		$.cytoscapeweb("debug", "Pan SVG renderer with params (%o)", params);
	};
	
	$.cytoscapeweb("renderer", "svg", SvgRenderer);
	
});
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
	
	var defaults = {
		nodes: {
			color: "#888",
			borderColor: "#333",
			borderWidth: 1,
			size: 10
		},
		edges: {
			color: "#bbb",
			width: 1
		},
		global: {
			
		}
	};
	
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
					
					svg = s;
					self.svg = svg;
					self.edgesGroup = svg.group();
					self.nodesGroup = svg.group();
					
					$(self.edgesGroup).svgattr("class", "cw-edges");
					$(self.nodesGroup).svgattr("class", "cw-nodes");
					
					callback();
				}
			});
		}
	};
	
	SvgRenderer.prototype.makeSvgNode = function(element){		
		var p = element._private.position;
		
		if( p.x == null || p.y == null ){
			$.cytoscapeweb("debug", "SVG renderer is ignoring creating of node `%s` with position (%o, %o)", element._private.data.id, p.x, p.y);
			return;
		}
		
		var svgDomElement = this.svg.circle(this.nodesGroup, p.x, p.y, 10, { fill: 'black' });
		element._private.svg = svgDomElement;
		$.cytoscapeweb("debug", "SVG renderer made node `%s` with position (%i, %i)", element._private.data.id, p.x, p.y);
		
		this.updateElementStyle(element);
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
		
		var svgDomElement = this.svg.line(this.edgesGroup, ps.x, ps.y, pt.x, pt.y, { stroke: "grey", strokeWidth: 2 });
		element._private.svg = svgDomElement;
		$.cytoscapeweb("debug", "SVG renderer made edge `%s` with position (%i, %i, %i, %i)", element._private.data.id, ps.x, ps.y, pt.x, pt.y);
		
		this.updateElementStyle(element);
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
	
	SvgRenderer.prototype.updateElementStyle = function(element){
		if( element._private.group == "nodes" ){
			this.updateNodeStyle(element);
		} else if( element._private.group == "edges" ){
			this.updateEdgeStyle(element);
		}
	};
	
	SvgRenderer.prototype.updateNodeStyle = function(element){
		element._private.style = this.options.styleCalculator.calculate(element, this.style);
		var style = element._private.style;
		
		if( element._private.svg == null ){
			$.cytoscapeweb("error", "SVG renderer can not update style for node `%s` since it has no SVG element", element._private.data.id);
			return;
		}
		
		this.svg.change(element._private.svg, {
			fill: color(style.color),
			stroke: color(style.borderColor),
			strokeWidth: number(style.borderWidth),
			r: number(style.size)
		});
		
		$.cytoscapeweb("debug", "SVG renderer collapsed mappers and updated style for node `%s` to %o", element._private.data.id, style);
	};
	
	SvgRenderer.prototype.updateEdgeStyle = function(element){
		element._private.style = this.options.styleCalculator.calculate(element, this.style);
		var style = element._private.style;
		
		if( element._private.svg == null ){
			$.cytoscapeweb("error", "SVG renderer can not update style for edge `%s` since it has no SVG element", element._private.data.id);
			return;
		}
		
		this.svg.change(element._private.svg, {
			stroke: color(style.color),
			strokeWidth: number(style.width)
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
		
		var container = $(this.options.selector);
		var svg = container.svg('get');
		var self = this;
		var cy = this.options.cytoscapeweb;
		
		// update nodes
		collection.nodes().each(function(i, element){
			var svgEle = self.getSvgElement(element);			
			var p = element._private.position;
			
			svg.change(svgEle, { cx: p.x, cy: p.y });
			$.cytoscapeweb("debug", "SVG renderer is moving node `%s` to position (%o, %o)", element._private.data.id, p.x, p.y);
		});
		
		// update connected edges
		collection.nodes().each(function(i, element){
			var edges = element.firstNeighbors().edges();
			edges.each(function(i, edge){
				
				var svgEle = self.getSvgElement(edge);			
				var ps = cy.node( edge.data("source") )._private.position;
				var pt = cy.node( edge.data("target") )._private.position;
				
				svg.change(svgEle, { x1: ps.x, y1: ps.y, x2: pt.x, y2: pt.y });
				$.cytoscapeweb("debug", "SVG renderer is moving edge `%s` to position (%o, %o, %o, %o)", edge._private.data.id, ps.x, ps.y, pt.x, pt.y);
			});
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
			case "data":
			case "select":
			case "unselect":
			case "lock":
			case "unlock":
			case "mouseover":
			case "mouseout":
				$.cytoscapeweb("error", "TODO svg::" + params.type);
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
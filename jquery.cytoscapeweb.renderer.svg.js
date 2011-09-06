$(function(){
		
	function SvgRenderer(options){
		$.cytoscapeweb("debug", "Creating SVG renderer with options (%o)", options);
		this.options = options;
	}
	
	SvgRenderer.prototype.init = function(callback){
		var container = $(this.options.selector);
		var svg = container.svg('get'); 
		var self = this;
				
		if( svg != null ){
			svg.clear(true);	
		} else {		
			container.svg({
				onLoad: function(s){
					
					svg = s;
					self.svg = svg;
					self.edgesGroup = svg.group();
					self.nodesGroup = svg.group();
					
					callback();
				}
			});
		}
	};
	
	SvgRenderer.prototype.makeSvgElement = function(element){
		var container = $(this.options.selector);
		var svg = container.svg('get');
		var svgDomElement;
		var cy = this.options.cytoscapeweb;
		var nodesGroup = this.nodesGroup;
		var edgesGroup = this.edgesGroup;
		
		if( element.group() == "nodes" ){
			var p = element.position();
			svgDomElement = svg.circle(nodesGroup, p.x, p.y, 10, { fill: 'black' });
			$.cytoscapeweb("debug", "SVG renderer made node `" + element.data("id") + "` with position (%i, %i)", p.x, p.y);
		} else if( element.group() == "edges" ){
			var source = cy.node( element.data("source") );
			var target = cy.node( element.data("target") );
						
			var ps = source.position();
			var pt = target.position();
			
			svgDomElement = svg.line(edgesGroup, ps.x, ps.y, pt.x, pt.y, { stroke: "grey", strokeWidth: 2 });
			$.cytoscapeweb("debug", "SVG renderer made edge `" + element.data("id") + "` with position (%i, %i, %i, %i)", ps.x, ps.y, pt.x, pt.y);
		}
		
		element._private.svg = svgDomElement;
		
		return svgDomElement;
	};
	
	SvgRenderer.prototype.getSvgElement = function(element){
		if( element._private.svg != null ){
			return element._private.svg;
		} else {
			return this.makeSvgElement(element);
		}
	};
	
	SvgRenderer.prototype.addElements = function(collection){
		
		var container = $(this.options.selector);
		var svg = container.svg('get');
		var cy = this.options.cytoscapeweb;
		
		collection.each(function(i, element){
			if( element.group() == "nodes" ){
			
				var position = element.position();
				var x = position.x;
				var y = position.y;
				
				if( x == null || y == null ){
					$.cytoscapeweb("debug", "SVG renderer is ignoring rendering of node `" + element.data("id") + "` with position (%o, %o)", x, y);
					return;
				}
			
				$.cytoscapeweb("debug", "SVG renderer is adding node `" + element.data("id") + "` with position (%i, %i)", x, y);
				this.makeSvgElement(element);
			}
			
			else if( element.group() == "edges" ){
				
				var source = cy.node( element.data("source") );
				var target = cy.node( element.data("target") );
							
				var ps = source.position();
				var pt = target.position();
				
				if( ps.x == null || ps.y == null || pt.x == null || pt.y == null ){
					$.cytoscapeweb("debug", "SVG renderer is ignoring rendering of edge `" + element.data("id") + "` with position (%o, %o, %o, %o)", ps.x, ps.y, pt.x, pt.y);
					return;
				}
				
				$.cytoscapeweb("debug", "SVG renderer is adding edge `" + element.data("id") + "` with position (%i, %i, %i, %i)", ps.x, ps.y, pt.x, pt.y);
				this.makeSvgElement(element);
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
			var p = element.position();
			
			svg.change(svgEle, { cx: p.x, cy: p.y });
			$.cytoscapeweb("debug", "SVG renderer is moving node `" + element.data("id") + "` to position (%o, %o)", p.x, p.y);
		});
		
		// update connected edges
		collection.nodes().each(function(i, element){
			var edges = element.firstNeighbors().edges();
			edges.each(function(i, edge){
				
				var svgEle = self.getSvgElement(edge);			
				var ps = cy.node( edge.data("source") ).position();
				var pt = cy.node( edge.data("target") ).position();
				
				svg.change(svgEle, { x1: ps.x, y1: ps.y, x2: pt.x, y2: pt.y });
				$.cytoscapeweb("debug", "SVG renderer is moving edge `" + edge.data("id") + "` to position (%o, %o, %o, %o)", ps.x, ps.y, pt.x, pt.y);
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
				$.cytoscapeweb("debug", "Element with group `" + element.group() + "` and ID `" + element.data("id") + "` has no associated SVG element");
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
				$.cytoscapeweb("debug", "The SVG renderer doesn't consider the `" + params.type + "` event");
				break;
		}
	};
	
	SvgRenderer.prototype.pan = function(params){
		$.cytoscapeweb("debug", "Pan SVG renderer with params (%o)", params);
	};
	
	SvgRenderer.prototype.style = function(element){
		return {};
	};
	
	$.cytoscapeweb("renderer", "svg", SvgRenderer);
	
});
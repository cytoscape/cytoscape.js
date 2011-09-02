$(function(){
		
	function SvgRenderer(options){
		$.cytoscapeweb("debug", "Creating SVG renderer with options (%o)", options);
		this.options = options;
	}
	
	SvgRenderer.prototype.init = function(callback){
		var container = $(this.options.selector);
		var svg = container.svg('get');
				
		if( svg != null ){
			svg.clear(true);	
		} else {		
			container.svg({
				onLoad: function(s){
					callback();
				}
			});
		}
	};
	
	SvgRenderer.prototype.addElements = function(collection){
		
		var container = $(this.options.selector);
		var svg = container.svg('get');
		
		collection.each(function(i, element){
			if( element.group() == "nodes" ){
			
				var x = element.position().x;
				var y = element.position().y;
				
				if( x == null ){
					x = 0;
				}
				
				if( y == null ){
					y = 0;
				}
			
				var domNode = svg.circle(x, y, 10, { fill: 'black' });
				element._private.svg = domNode;
			}
		});

	};
	
	SvgRenderer.prototype.updatePosition = function(collection){
		
		$.cytoscapeweb("debug", "SVG renderer is updating node positions");
		
		var container = $(this.options.selector);
		var svg = container.svg('get');
		
		collection.each(function(i, element){
			if( element.group() == "nodes" ){
				svg.change(element._private.svg, { cx: element.position().x, cy: element.position().y });
			}
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
;(function($){
	
	var defaults = {
		knobSize: 10
	};
	
	$.fn.cytoscapewebEdgehandles = function( params ){
		return $(this).each(function(){
			var options = $.extend(true, {}, defaults, params);
			var $container = $(this);
			var svg, cy;
			var handle;
			var line;
			var mdownOnHandle = false;
			var hx, hy, hr;
			
			function svgIsInCy( svgDomElement ){
				var $ele = $(svgDomElement);
				var inside = false;
				
				$ele.parents().each(function(){
					if( this == $container[0] ){
						inside = true;
					}
				});
				
				return inside;
			}
			
			function safelyRemoveCySvgChild( svgDomElement ){
				if( svgDomElement != null && svgIsInCy( svgDomElement ) ){
					svg.remove( svgDomElement );
				}
			}
			
			function safelyRemoveAllSvgChildren(){
				safelyRemoveCySvgChild( handle );
				safelyRemoveCySvgChild( line );
			}
			
			$container.cytoscapeweb(function(e){
				cy = this;
				svg = $container.svg("get");
				
				cy.bind("zoom pan", function(){
					safelyRemoveAllSvgChildren();
				});
				
				cy.nodes().live("mouseover", function(){
					if( mdownOnHandle ){
						return; // don't override existing handle that's being dragged
					}
					
					var node = this;
					var p = node.renderedPosition();
					var d = node.renderedDimensions();
					
					// remove old handle
					safelyRemoveCySvgChild( handle );
					
					hx = p.x;
					hy = p.y - d.height/2;
					hr = options.knobSize/2;
					
					// add new handle
					handle = svg.circle(hx, hy, hr, {
						fill: "red"
					});
					
					var $handle = $(handle);				
					$handle.bind("mousedown", function(e){
						mdownOnHandle = true;
						
						e.preventDefault();
						node.unbind("mouseout", removeHandler);
						$handle.unbind("mouseout", removeHandler);
						
						function doneMoving(){
							var $this = $(this);
							
							safelyRemoveAllSvgChildren();
							
							mdownOnHandle = false;
							$(window).unbind("mousemove", moveHandler);
						}
						
						$(window).one("mouseup blur", doneMoving).bind("mousemove", moveHandler);
						cy.one("pan zoom", doneMoving);
					});
					
					function moveHandler(e){
						var x = e.pageX - $container.offset().left;
						var y = e.pageY - $container.offset().top;
						
						safelyRemoveCySvgChild( line );
						line = svg.line(hx, hy, x, y, {
							stroke: "red",
							strokeWidth: 1
						});
					}
					
					function removeHandler(e){
						var newTargetIsHandle = e.toElement == handle;
						var newTargetIsNode = e.toElement == node._private.renderer.svg;
						
						if( newTargetIsHandle || newTargetIsNode ){
							return; // don't consider mouseout
						}
						
						safelyRemoveAllSvgChildren();
						node.unbind("mouseout", removeHandler);
					}
					
					node.bind("mouseout", removeHandler);
					$handle.bind("mouseout", removeHandler);
				});
			});
			
		});
	};
	
})( jQuery );
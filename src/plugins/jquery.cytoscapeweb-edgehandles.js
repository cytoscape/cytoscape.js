;(function($){
	
	var defaults = {
		handleSize: 10,
		handleColor: "red",
		handleLineWidth: 1,
		lineType: "draw", // can be "straight" or "draw"
		edgeType: function( sourceNode, targetNode ){
			return "node"; // can return "flat" for flat edges between nodes or "node" for intermediate node between them
		},
		loopAllowed: function( node ){
			return false;
		},
		nodeParams: function( sourceNode, targetNode ){
			return {};
		},
		edgeParams: function( sourceNode, targetNode ){
			return {};
		}
	};
	
	$.fn.cytoscapewebEdgehandles = function( params ){
		var fn = params;
		
		var functions = {
			destroy: function(){
				var $container = $(this);
				var data = $container.data("cyedgehandles");
				
				if( data == null ){
					return;
				}
				
				data.unbind();
				$container.data("cyedgehandles", {});
				
				return $container;
			},
			
			option: function(name, value){
				var $container = $(this);
				var data = $container.data("cyedgehandles");
				
				if( data == null ){
					return;
				}
				
				var options = data.options;
				
				if( value === undefined ){
					if( typeof name == typeof {} ){
						var newOpts = name;
						options = $.extend(true, {}, defaults, newOpts);
						data.options = options;
					} else {
						return options[ name ];
					}
				} else {
					options[ name ] = value;
				}
				
				return $container;
			},
				
			init: function(){
				var options = $.extend(true, {}, defaults, params); console.log(options);
				var $container = $(this);
				var svg, cy;
				var handle;
				var line, linePoints;
				var mdownOnHandle = false;
				var grabbingNode = false;
				var hx, hy, hr;
				
				// write options to data
				var data = $container.data("cyedgehandles");
				if( data == null ){
					data = {};
				}
				data.options = options;
				
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
				
				function resetToDefaultState(){
					safelyRemoveCySvgChild( handle );
					safelyRemoveCySvgChild( line );
					
//					// console.log("def state");
//					console.trace();
					
					cy.nodes()
						.removeClass("ui-cytoscapeweb-edgehandles-hover")
						.removeClass("ui-cytoscapeweb-edgehandles-source")
						.removeClass("ui-cytoscapeweb-edgehandles-target")
					;

					linePoints = null;
					
					cy.zooming(true).panning(true);
				}
				
				function makePreview( source, target ){
					makeEdges( true );
				}
				
				function removePreview( source, target ){
					source.edgesWith(target).filter(".ui-cytoscapeweb-edgehandles-preview").remove();
					
					target
						.neighborhood("node.ui-cytoscapeweb-edgehandles-preview")
						.closedNeighborhood(".ui-cytoscapeweb-edgehandles-preview")
						.remove();
					
				}
				
				function makeEdges( preview ){
					
					// console.log("make edges");
					
					var source = cy.nodes(".ui-cytoscapeweb-edgehandles-source");
					var targets = cy.nodes(".ui-cytoscapeweb-edgehandles-target");
					var classes = preview ? "ui-cytoscapeweb-edgehandles-preview" : "";
					
					if( source.size() == 0 || targets.size() == 0 ){
						return; // nothing to do :(
					}
					
					// just remove preview class if we already have the edges
					if( !preview && options.preview ){
						cy.elements(".ui-cytoscapeweb-edgehandles-preview").removeClass("ui-cytoscapeweb-edgehandles-preview");
						return;
					} else {
						// remove old previews
						cy.elements(".ui-cytoscapeweb-edgehandles-preview").remove();
					}
					
					targets.each(function(i, target){
						switch( options.edgeType( source, target ) ){
						case "node":
							
							var p1 = source.position(false);
							var p2 = target.position(false);
							var p = {
								x: (p1.x + p2.x)/2,
								y: (p1.y + p2.y)/2
							};
												
							var interNode = cy.add($.extend( true, {
								group: "nodes",
								position: p
							}, options.nodeParams(source, target) )).addClass(classes);

							cy.add($.extend( true, {
								group: "edges",
								data: {
									source: source.id(),
									target: interNode.id()
								}
							}, options.edgeParams(source, target) )).addClass(classes);
							
							cy.add($.extend( true, {
								group: "edges",
								data: {
									source: interNode.id(),
									target: target.id()
								}
							}, options.edgeParams(source, target) )).addClass(classes);
							
							break;
							
						case "flat":
						default:
							cy.add($.extend( true, {
								group: "edges",
								data: {
									source: source.id(),
									target: target.id()
								}
							}, options.edgeParams(source, target) )).addClass(classes);
							break;
						}
					});
					
					
				}
				
				$container.cytoscapeweb(function(e){
					cy = this;
					svg = $container.svg("get");
					
					var transformHandler;
					cy.bind("zoom pan", transformHandler = function(){
						safelyRemoveCySvgChild( handle );
					});
					
					var startHandler, hoverHandler, leaveHandler, grabNodeHandler, freeNodeHandler;
					cy.nodes().live("mouseover", startHandler = function(e){
						if( mdownOnHandle || grabbingNode ){
							return; // don't override existing handle that's being dragged
							// also don't trigger when grabbing a node
						} 
						
						// console.log("node mover");
						
						var node = this;
						var source = this;
						var p = node.renderedPosition();
						var d = node.renderedDimensions();
						
						// remove old handle
						safelyRemoveCySvgChild( handle );
						
						hx = p.x;
						hy = p.y - d.height/2;
						hr = options.handleSize/2;
						
						// add new handle
						handle = svg.circle(hx, hy, hr, {
							fill: options.handleColor
						});
						var $handle = $(handle);
						
						function mdownHandler(e){
							if( e.button != 0 ){
								return; // sorry, no right clicks allowed 
							}
							
							mdownOnHandle = true;
							
							// console.log("handle mdown");
							
							e.preventDefault();
							node.unbind("mouseout", removeHandler);
							$handle.unbind("mouseout", removeHandler);
							
							node.addClass("ui-cytoscapeweb-edgehandles-source");
							
							function doneMoving(){
								var $this = $(this);
								mdownOnHandle = false;
								$(window).unbind("mousemove", moveHandler);
								
								makeEdges();
								resetToDefaultState();
							}
							
							$(window).one("mouseup blur", doneMoving).bind("mousemove", moveHandler);
							cy.zooming(false).panning(false);
						}
						
						function moveHandler(e){
							// console.log("move");
							
							var x = e.pageX - $container.offset().left;
							var y = e.pageY - $container.offset().top;
							
							safelyRemoveCySvgChild( line );
							
							var style = {
								stroke: options.handleColor,
								strokeWidth: options.handleLineWidth,
								fill: "none",
								"pointer-events": "none"
							};
							
							// draw line based on type
							switch( options.lineType ){
							case "straight":
								
								line = svg.line(hx, hy, x, y, style);
								
								break;
							case "draw":
							default:
								
								if( linePoints == null ){
									linePoints = [ [hx, hy], [x, y] ];
								} else {
									linePoints.push([ x, y ]);
								}
								
								line = svg.polyline(linePoints, style);
								
								break;
							}
							
							
						}
						
						function removeHandler(e){
							
							
							var newTargetIsHandle = e.toElement == handle;
							var newTargetIsNode = e.toElement == node._private.renderer.svg;
							
							if( newTargetIsHandle || newTargetIsNode ){
								return; // don't consider mouseout
							}
							
							// console.log("remove");
							
							resetToDefaultState();
							node.unbind("mouseout", removeHandler);
						}
						
						node.bind("mouseout", removeHandler);
						$handle.bind("mouseout", removeHandler);
						$handle.bind("mousedown", mdownHandler);
						
					}).live("mouseover", hoverHandler = function(){
						if( mdownOnHandle ){ // only handle mdown case
							var node = this;
							var target = this;
							var source = cy.nodes(".ui-cytoscapeweb-edgehandles-source");
							
							var isLoop = node.hasClass("ui-cytoscapeweb-edgehandles-source");
							var loopAllowed = options.loopAllowed( node );
							
							if( !isLoop || (isLoop && loopAllowed) ){
								this.addClass("ui-cytoscapeweb-edgehandles-hover");
								this.toggleClass("ui-cytoscapeweb-edgehandles-target");
								
								if( options.preview ){
									if( this.hasClass("ui-cytoscapeweb-edgehandles-target") ){
										makePreview( source, target );
									} else {
										removePreview( source, target );
									}
								}
							}
						}
					}).live("mouseout", leaveHandler = function(){
						this.removeClass("ui-cytoscapeweb-edgehandles-hover");
					}).live("grab", grabNodeHandler = function(){
						grabbingNode = true;
						resetToDefaultState();
					}).live("free", freeNodeHandler = function(){
						grabbingNode = false;
					});
					
					data.unbind = function(){
						cy.nodes()
							.die("mouseover", startHandler)
							.die("mouseover", hoverHandler)
							.die("mouseout", leaveHandler)
							.die("grab", grabNodeHandler)
							.die("free", freeNodeHandler)
						;
						
						cy.unbind("zoom pan", transformHandler);
					};
				});
				
				$container.data("cyedgehandles", data);
			}
		};
		
		if( functions[fn] ){
			return functions[fn].apply(this, Array.prototype.slice.call( arguments, 1 ));
		} else if( typeof fn == 'object' || !fn ) {
			return functions.init.apply( this, arguments );
		} else {
			$.error("No such function `"+ fn +"` for jquery.cytoscapewebEdgeHandles");
		}
		
		return $(this);
	};
	
})( jQuery );
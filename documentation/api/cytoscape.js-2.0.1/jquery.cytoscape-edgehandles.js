
/* jquery.cytoscape-edgehandles.js */

/**
 * This file is part of cytoscape.js 2.0.1.
 * 
 * Cytoscape.js is free software: you can redistribute it and/or modify it
 * under the terms of the GNU Lesser General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option) any
 * later version.
 * 
 * Cytoscape.js is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU Lesser General Public License along with
 * cytoscape.js. If not, see <http://www.gnu.org/licenses/>.
 */
 
;(function($){
	
	var defaults = {
		preview: true,
		handleSize: 10,
		handleColor: "#ff0000",
		handleLineWidth: 1,
		hoverDelay: 150,
		enabled: true,
		lineType: "draw", // can be "straight" or "draw"
		edgeType: function( sourceNode, targetNode ){
			return "node"; // can return "flat" for flat edges between nodes or "node" for intermediate node between them
			// returning null/undefined means an edge can't be added between the two nodes
		},
		loopAllowed: function( node ){
			return false;
		},
		nodeParams: function( sourceNode, targetNode ){
			return {};
		},
		edgeParams: function( sourceNode, targetNode ){
			return {};
		},
		start: function( sourceNode ){
			// fired when edgehandles interaction starts (drag on handle)
		},
		complete: function( sourceNode, targetNodes, addedEntities ){
			// fired when edgehandles is done and entities are added
		},
		stop: function( sourceNode ){
			// fired when edgehandles interaction is stopped (either complete with added edges or incomplete)
		}
	};
	
	$.fn.cytoscapeEdgehandles = function( params ){
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
				
				$container.data("cyedgehandles", data);

				return $container;
			},

			disable: function(){
				return functions.option.apply(this, ["enabled", false]);
			},

			enable: function(){
				return functions.option.apply(this, ["enabled", true]);
			},
				
			init: function(){
				var opts = $.extend(true, {}, defaults, params); 
				var $container = $(this);
				var cy;
				var $canvas = $('<canvas></canvas>');
				var handle;
				var line, linePoints;
				var mdownOnHandle = false;
				var grabbingNode = false;
				var inForceStart = false;
				var hx, hy, hr;
				var hoverTimeout;
				var drawsClear = true;

				$container.append( $canvas );

				function sizeCanvas(){
					$canvas
						.attr('height', $container.height())
						.attr('width', $container.width())
						.css({
							'position': 'absolute',
							'z-index': '999'
						})
					;
				}
				sizeCanvas();

				$(window).bind('resize', function(){
					sizeCanvas();
				});


				var ctx = $canvas[0].getContext("2d"); 
				
				// write options to data
				var data = $container.data("cyedgehandles");
				if( data == null ){
					data = {};
				}
				data.options = opts;
				
				function options(){
					return $container.data("cyedgehandles").options;
				}

				function enabled(){
					return options().enabled;
				}

				function disabled(){
					return !enabled();
				}
				
				function clearDraws(){ 

					if( drawsClear ){ return; } // break early to be efficient

					var w = $container.width();
					var h = $container.height();

					ctx.clearRect( 0, 0, w, h );
					drawsClear = true;
				}

				var lastPanningEnabled, lastZoomingEnabled, lastBoxSelectionEnabled;
				function disableGestures(){
					lastPanningEnabled = cy.panningEnabled();
					lastZoomingEnabled = cy.zoomingEnabled();
					lastBoxSelectionEnabled = cy.boxSelectionEnabled();

					cy
						.zoomingEnabled(false)
						.panningEnabled(false)
						.boxSelectionEnabled(false)
					;
				}

				function resetGestures(){
					cy
						.zoomingEnabled(lastZoomingEnabled)
						.panningEnabled(lastPanningEnabled)
						.boxSelectionEnabled(lastBoxSelectionEnabled)
					;
				}

				function resetToDefaultState(){
//					console.log("resetToDefaultState");

					clearDraws();
					
					//setTimeout(function(){
						cy.nodes()
							.removeClass("ui-cytoscape-edgehandles-hover")
							.removeClass("ui-cytoscape-edgehandles-source")
							.removeClass("ui-cytoscape-edgehandles-target")
						;
					//}, 1);
					

					linePoints = null;
					
					resetGestures();
				}
				
				function makePreview( source, target ){
					makeEdges( true );

					target.trigger('cyedgehandles.addpreview');
				}
				
				function removePreview( source, target ){
					source.edgesWith(target).filter(".ui-cytoscape-edgehandles-preview").remove();
					
					target
						.neighborhood("node.ui-cytoscape-edgehandles-preview")
						.closedNeighborhood(".ui-cytoscape-edgehandles-preview")
						.remove();

					target.trigger('cyedgehandles.removepreview');
					
				}
				
				function drawHandle(hx, hy, hr){
					ctx.fillStyle = options().handleColor;
					ctx.strokeStyle = options().handleColor;

					ctx.beginPath();
					ctx.arc(hx, hy, hr, 0 , 2*Math.PI);
					ctx.closePath();
					ctx.fill();

					drawsClear = false;
				}

				function drawLine(hx, hy, x, y){
					ctx.fillStyle = options().handleColor;
					ctx.strokeStyle = options().handleColor;
					ctx.lineWidth = options().handleLineWidth;

					// draw line based on type
					switch( options().lineType ){
					case "straight":

						ctx.beginPath();
						ctx.moveTo(hx, hy);
						ctx.lineTo(x, y);
						ctx.closePath();
						ctx.stroke();
						
						break;
					case "draw":
					default:
						
						if( linePoints == null ){
							linePoints = [ [x, y] ];
						} else {
							linePoints.push([ x, y ]);
						}

						ctx.beginPath();
						ctx.moveTo(hx, hy);

						for( var i = 0; i < linePoints.length; i++ ){
							var pt = linePoints[i];

							ctx.lineTo(pt[0], pt[1]);
						}

						ctx.stroke();

						break;
					}

					drawsClear = false;
				}

				function makeEdges( preview, src, tgt ){
					
					// console.log("make edges");
					
					var source = src ? src : cy.nodes(".ui-cytoscape-edgehandles-source");
					var targets = tgt ? tgt : cy.nodes(".ui-cytoscape-edgehandles-target");
					var classes = preview ? "ui-cytoscape-edgehandles-preview" : "";
					var added = cy.collection();
					
					if( source.size() === 0 || targets.size() === 0 ){
						return; // nothing to do :(
					}
					
					// just remove preview class if we already have the edges
					if( !src && !tgt ){
						if( !preview && options().preview ){
							added = cy.elements(".ui-cytoscape-edgehandles-preview").removeClass("ui-cytoscape-edgehandles-preview");
							
							options().complete( source, targets, added );
							source.trigger('cyedgehandles.complete');	
							return;
						} else {
							// remove old previews
							cy.elements(".ui-cytoscape-edgehandles-preview").remove();
						}
					}
					
					for( var i = 0; i < targets.length; i++ ){
						var target = targets[i];
						
						switch( options().edgeType( source, target ) ){
						case "node":
							
							var p1 = source.position();
							var p2 = target.position();
							var p = {
								x: (p1.x + p2.x)/2,
								y: (p1.y + p2.y)/2
							};
												
							var interNode = cy.add($.extend( true, {
								group: "nodes",
								position: p
							}, options().nodeParams(source, target) )).addClass(classes);

							var source2inter = cy.add($.extend( true, {
								group: "edges",
								data: {
									source: source.id(),
									target: interNode.id()
								}
							}, options().edgeParams(source, target) )).addClass(classes);
							
							var inter2target = cy.add($.extend( true, {
								group: "edges",
								data: {
									source: interNode.id(),
									target: target.id()
								}
							}, options().edgeParams(source, target) )).addClass(classes);
							
							added = added.add( interNode ).add( source2inter ).add( inter2target );
							
							break;
						
						case "flat":
							var edge = cy.add($.extend( true, {
								group: "edges",
								data: {
									source: source.id(),
									target: target.id()
								}
							}, options().edgeParams(source, target) )).addClass(classes);
						
							added = added.add( edge );
						
							break;

						default:
							target.removeClass("ui-cytoscape-edgehandles-target");
							break; // don't add anything
						}
					}
					
					if( !preview ){
						options().complete( source, targets, added );
						source.trigger('cyedgehandles.complete');	
					}
				}

				$container.cytoscape(function(e){
					cy = this;
					
					lastPanningEnabled = cy.panningEnabled();
					lastZoomingEnabled = cy.zoomingEnabled();
					lastBoxSelectionEnabled = cy.boxSelectionEnabled();

					// console.log('handles on ready')

					var lastActiveId;

					var transformHandler;
					cy.bind("zoom pan", transformHandler = function(){
						clearDraws();
					});
					
					var lastMdownHandler;

					var startHandler, hoverHandler, leaveHandler, grabNodeHandler, freeNodeHandler, dragNodeHandler, forceStartHandler, removeHandler;
					cy.on("mouseover", "node", startHandler = function(e){
						
						if( disabled() || mdownOnHandle || grabbingNode || this.hasClass("ui-cytoscape-edgehandles-preview") || inForceStart ){
							return; // don't override existing handle that's being dragged
							// also don't trigger when grabbing a node etc
						} 
						
						//console.log("mouseover startHandler %s %o", this.id(), this);
						
						if( lastMdownHandler ){
							$container[0].removeEventListener('mousedown', lastMdownHandler, true);
						}

						var node = this;
						var source = this;
						var p = node.renderedPosition();
						var h = node.renderedOuterHeight();
						
						lastActiveId = node.id();

						// remove old handle
						clearDraws();
						
						hr = options().handleSize/2 * cy.zoom();
						hx = p.x;
						hy = p.y - h/2 - hr/2;
						
						// add new handle
						drawHandle(hx, hy, hr);

						node.trigger('cyedgehandles.showhandle');
						

						function mdownHandler(e){
							$container[0].removeEventListener('mousedown', mdownHandler, true);

							var x = e.pageX - $container.offset().left;
							var y = e.pageY - $container.offset().top;

							if( e.button !== 0 ){
								return; // sorry, no right clicks allowed 
							}
							
							if( Math.abs(x - hx) > hr || Math.abs(y - hy) > hr ){
								return; // only consider this a proper mousedown if on the handle
							}

							if( inForceStart ){
								return; // we don't want this going off if we have the forced start to consider
							}

							// console.log("mdownHandler %s %o", node.id(), node);
							
							mdownOnHandle = true;
							
							e.preventDefault();
							e.stopPropagation();
							
							node.addClass("ui-cytoscape-edgehandles-source");
							node.trigger('cyedgehandles.start');
							
							function doneMoving(dmEvent){
								// console.log("doneMoving %s %o", node.id(), node);
								
								if( !mdownOnHandle || inForceStart ){
									return;
								}
								
								var $this = $(this);
								mdownOnHandle = false;
								$(window).unbind("mousemove", moveHandler);
								
								makeEdges();
								resetToDefaultState();
								
								options().stop( node );
								node.trigger('cyedgehandles.stop');
							}
							
							$(window).one("mouseup blur", doneMoving).bind("mousemove", moveHandler);
							disableGestures();
							
							options().start( node );

							return false;
						}
						
						function moveHandler(e){
							// console.log("mousemove moveHandler %s %o", node.id(), node);
							
							var x = e.pageX - $container.offset().left;
							var y = e.pageY - $container.offset().top;

							clearDraws();
							drawHandle(hx, hy, hr);
							drawLine(hx, hy, x, y);
							
							return false;
						}

						$container[0].addEventListener('mousedown', mdownHandler, true);
						lastMdownHandler = mdownHandler;

						
					}).on("mouseover touchover", "node", hoverHandler = function(){
						var node = this;
						var target = this;

// console.log('mouseover hoverHandler')

						if( disabled() || this.hasClass("ui-cytoscape-edgehandles-preview") ){
							return; // ignore preview nodes
						}
						
						if( mdownOnHandle ){ // only handle mdown case

							// console.log( 'mouseover hoverHandler %s $o', node.id(), node );

							clearTimeout( hoverTimeout );
							hoverTimeout = setTimeout(function(){
								var source = cy.nodes(".ui-cytoscape-edgehandles-source");
								
								var isLoop = node.hasClass("ui-cytoscape-edgehandles-source");
								var loopAllowed = options().loopAllowed( node );
								
								if( !isLoop || (isLoop && loopAllowed) ){
									node.addClass("ui-cytoscape-edgehandles-hover");
									node.toggleClass("ui-cytoscape-edgehandles-target");
									
									if( options().preview ){
										if( node.hasClass("ui-cytoscape-edgehandles-target") ){
											makePreview( source, target );
										} else {
											removePreview( source, target );
										}
									}
								}
							}, options().hoverDelay);

							return false;
						}

					}).on("mouseout", "node", leaveHandler = function(){
						if( this.hasClass("ui-cytoscape-edgehandles-hover") ){
							this.removeClass("ui-cytoscape-edgehandles-hover");
						}

						if( mdownOnHandle ){
							clearTimeout(hoverTimeout);
						}

					}).on("drag position", "node", dragNodeHandler = function(){
						setTimeout(clearDraws, 50);

					}).on("grab", "node", grabHandler = function(){
						grabbingNode = true;

						setTimeout(function(){
							clearDraws();
						}, 5);
						

					}).on("free", "node", freeNodeHandler = function(){
						grabbingNode = false;

					}).on("cyedgehandles.forcestart", "node", forceStartHandler = function(){
						inForceStart = true;
						clearDraws(); // clear just in case

						var node = this;
						var source = node;

						lastActiveId = node.id();

						node.trigger('cyedgehandles.start');
						node.addClass('ui-cytoscape-edgehandles-source');

						var p = node.renderedPosition();
						var h = node.renderedOuterHeight();
						var w = node.renderedOuterWidth();
												
						var hr = options().handleSize/2 * cy.zoom();
						var hx = p.x;
						var hy = p.y - h/2 - hr/2;

						drawHandle(hx, hy, hr);

						node.trigger('cyedgehandles.showhandle');

						// case: down and drag as normal
						var downHandler = function(e){
							
							$container[0].removeEventListener('mousedown', downHandler, true);
							$container[0].removeEventListener('touchstart', downHandler, true);

							var x = (e.pageX !== undefined ? e.pageX : e.originalEvent.touches[0].pageX) - $container.offset().left;
							var y = (e.pageY !== undefined ? e.pageY : e.originalEvent.touches[0].pageY) - $container.offset().top;
							var d = hr/2;
							var onNode = p.x - w/2 - d <= x && x <= p.x + w/2 + d
								&& p.y - h/2 - d <= y && y <= p.y + h/2 + d;

							if( onNode ){
								disableGestures();
								mdownOnHandle = true; // enable the regular logic for handling going over target nodes
								
								var moveHandler = function(me){
									var x = (me.pageX !== undefined ? me.pageX : me.originalEvent.touches[0].pageX) - $container.offset().left;
									var y = (me.pageY !== undefined ? me.pageY : me.originalEvent.touches[0].pageY) - $container.offset().top;

									clearDraws();
									drawHandle(hx, hy, hr);
									drawLine(hx, hy, x, y);
								}

								$container[0].addEventListener('mousemove', moveHandler, true);
								$container[0].addEventListener('touchmove', moveHandler, true);

								$(window).one("mouseup touchend blur", function(){
									$container[0].removeEventListener('mousemove', moveHandler, true);
									$container[0].removeEventListener('touchmove', moveHandler, true);

									inForceStart = false; // now we're done so reset the flag
									mdownOnHandle = false; // we're also no longer down on the node

									makeEdges();

									options().stop( node );
									node.trigger('cyedgehandles.stop');

									cy.off("tap", "node", tapHandler);
									node.off("remove", removeBeforeHandler);
									resetToDefaultState();
								});

								e.stopPropagation();
								e.preventDefault();
								return false;
							}
						};

						$container[0].addEventListener('mousedown', downHandler, true);
						$container[0].addEventListener('touchstart', downHandler, true);

						var removeBeforeHandler;
						node.one("remove", function(){
							$container[0].removeEventListener('mousedown', downHandler, true);
							$container[0].removeEventListener('touchstart', downHandler, true);
							cy.off("tap", "node", tapHandler);
						});

						// case: tap a target node
						var tapHandler;
						cy.one("tap", "node", tapHandler = function(){
							var target = this;

							var isLoop = source.id() === target.id();
							var loopAllowed = options().loopAllowed( target );
							
							if( !isLoop || (isLoop && loopAllowed) ){							
								makeEdges(false, source, target);

								//options().complete( node );
								//node.trigger('cyedgehandles.complete');	
							}

							inForceStart = false; // now we're done so reset the flag

							options().stop( node );
							node.trigger('cyedgehandles.stop');

							$container[0].removeEventListener('mousedown', downHandler, true);
							$container[0].removeEventListener('touchstart', downHandler, true);
							node.off("remove", removeBeforeHandler);
							resetToDefaultState();
						});
					

					}).on("remove", "node", removeHandler = function(){
						var id = this.id();

						if( id === lastActiveId ){
							setTimeout(function(){
								resetToDefaultState();
							}, 5);
						}
					});
				

					data.unbind = function(){
						cy
							.off("mouseover", "node", startHandler)
							.off("mouseover", "node", hoverHandler)
							.off("mouseout", "node", leaveHandler)
							.off("drag position", "node", dragNodeHandler)
							.off("grab", "node", grabNodeHandler)
							.off("free", "node", freeNodeHandler)
							.off("cyedgehandles.forcestart", "node", forceStartHandler)
							.off("remove", "node", removeHandler)
						;
						
						cy.unbind("zoom pan", transformHandler);
					};
				});
				
				$container.data("cyedgehandles", data);
			},

			start: function( id ){
				$container = $(this);

				$container.cytoscape(function(e){
					var cy = this;

					cy.$("#" + id).trigger('cyedgehandles.forcestart');
				});
			}
		};
		
		if( functions[fn] ){
			return functions[fn].apply(this, Array.prototype.slice.call( arguments, 1 ));
		} else if( typeof fn == 'object' || !fn ) {
			return functions.init.apply( this, arguments );
		} else {
			$.error("No such function `"+ fn +"` for jquery.cytoscapeEdgeHandles");
		}
		
		return $(this);
	};

	$.fn.cyEdgehandles = $.fn.cytoscapeEdgehandles;
	
})( jQuery );
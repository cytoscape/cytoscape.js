$(function(){

	$("#cytoscape").cy(function(){
		var cy = this;

		console.log('ready');

		console.log(cy);
		
		var tests = {}; // name => setup
		function test(options){
			$("#test-type-select").append('<option value="'+ options.name +'">'+ options.displayName +'</option>');
			
			tests[options.name] = $.extend({}, {
				setup: function(){},
				teardown: function(){},
				description: ""
			}, options);
		}
		test({
			name: "none",
			displayName: "None",
			description: "Not currently running any test"
		});
		
		var currentTest;
		for(var i in tests){
			currentTest = tests[i];
			break;
		}
		
		$("#test-type-select").change(function(){
			currentTest.teardown();
			
			var name = $("#test-type-select").val();
			currentTest = tests[name];
			
			$.gritter.add({
				title: currentTest.displayName,
				text: currentTest.description
			});
			currentTest.setup();
		});
		
		test({
			name: "edgehandlesstart",
			displayName: "Edgehandles force start",
			description: "Force starts the edgehandles plugin on n0",
			setup: function(){
				$('#cytoscape').cytoscapeEdgehandles('start', 'n0');
			},
			teardown: function(){
				
			}
		});

		test({
			name: "bypassOnClick",
			displayName: "Bypass on click",
			description: "Set nodes to red and edges to blue on click",
			setup: function(){
				cy.elements().bind("click", function(){
					this.css("background-color", "red");
					
					this.css({
						lineColor: "blue",
						targetArrowColor: "blue",
						sourceArrowColor: "blue"
					});
				});
			},
			teardown: function(){
				cy.elements().unbind("click").css("*", "");
			}
		});
		
		test({
			name: "shapeOnClick",
			displayName: "Squares on click",
			description: "Set nodes to squares and edge arrows to squares on click",
			setup: function(){
				cy.elements().bind("click", function(){
					this.css({
						shape: "rectangle",
						targetArrowShape: "square",
						sourceArrowShape: "square"
					});
				});
			},
			teardown: function(){
				cy.elements().unbind("click").css("*", "");
			}
		});
		
		test({
			name: "positionOnClick",
			displayName: "Random position on click",
			description: "Put node to random position on click",
			setup: function(){
				
				var $cy = $("#cytoscape");
				
				var w = $cy.width();
				var h = $cy.height();
								
				cy.nodes().bind("click", function(){
					var node = this;
					var padding = 50;
					
					var p2 = {
						x: Math.random() * (w - padding) + padding,
						y: Math.random() * (h - padding) + padding
					};
					
					node.animate({
						position: p2
					},
					{
						duration: 1000
					});
				});
			},
			teardown: function(){
				cy.elements().unbind("click");
			}
		});
		
		
		test({
			name: "labelOnClick",
			displayName: "Label on click",
			description: "Change label on click",
			setup: function(){
				cy.elements().bind("click", function(){
					this.css({
						content: "clicked"
					});
				});
			},
			teardown: function(){
				cy.elements().unbind("click").css("*", "");
			}
		});
		
		test({
			name: "labelWithWeight",
			displayName: "Labels with weight",
			description: "Show weight in node labels",
			setup: function(){
				cy.elements().css("content", "data(weight)");
			},
			teardown: function(){
				cy.elements().css("*" ,"");
			}
		});

		
		test({
			name: "hideOnClick",
			displayName: "Hide on click",
			description: "Hide nodes and edges when clicked",
			setup: function(){
				cy.elements().bind("click", function(){
					this.hide();
				});
			},
			teardown: function(){
				cy.elements().unbind("click").css("*", "");
			}
		});
		
		test({
			name: "growOnClick",
			displayName: "Coloured and sized",
			description: "Make nodes grow/shrink and change colour on click",
			setup: function(){
				cy.nodes().bind("click", function(){
					function rch(){
						return Math.round( Math.random() * 255 );
					}
					
					function rcolor(){
						return "rgb(" + rch() + "," + rch() + "," + rch() + ")"
					}
					
					function rsize(){
						return 5 + Math.round( Math.random() * 50 );
					}
					
					var size = rsize();
					
					this.stop().animate({
						css: {
							backgroundColor: rcolor(),
							height: size,
							width: size
						}
					}, {
						duration: 1000
					});
				});
			},
			teardown: function(){
				cy.elements().unbind("click").removeCss();
			}
		});
		
		test({
			name: "colourThenGrow",
			displayName: "Orange, delay, grow, reset",
			description: "Click nodes to trigger",
			setup: function(){
				cy.nodes().bind("click", function(){
					var self = this;
					self
						.stop(true)
						.animate({
							css: {
								backgroundColor: "orange"
							}
						},
						{
							duration: 1000
						})
						.delay(1000)
						.animate({
							css: {
								height: 50,
								width: 50
							}
						},
						{
							duration: 1000
						}).delay(1000, function(){
							self.removeCss();
						});
				});
				
				cy.edges().bind("click", function(){
					this
						.stop(true)
						.animate({
							bypass: {
								lineColor: "orange",
								targetArrowColor: "orange",
								sourceArrowColor: "orange"
							}
						},
						{
							duration: 1000
						})
						.delay(1000)
						.animate({
							css: {
								width: 7
							}
						},
						{
							duration: 1000
						});
				});
			},
			teardown: function(){
				cy.elements().unbind("click").removeCss();
			}
		});
		
		test({
			name: "redAndGrow",
			displayName: "Blue and grow in parallel",
			description: "Click nodes to trigger",
			setup: function(){
				cy.nodes().bind("click", function(){
					this
						.stop(true)
						.animate({
							css: {
								backgroundColor: "blue"
							}
						},
						{
							duration: 1000
						})
						.animate({
							css: {
								height: 50,
								width: 50
							}
						},
						{
							duration: 1000,
							queue: false
						});
				});
			},
			teardown: function(){
				cy.nodes().unbind("click").removeCss();
			}
		});
		
		test({
			name: "bigRedOnClick",
			displayName: "Big & red",
			description: "Click background to toggle",
			setup: function(){
				var on = false;
				
				cy.bind("click", function(){
				

					if( !on ){
						cy.nodes().stop().animate({
							css: {
								backgroundColor: "red",
								height: 50,
								width: 50
							}
						},
						{
							duration: 2000
						});
						
						on = true;
					} else {
						cy.nodes().stop().removeCss();
						on = false;
					}
					
				});
			},
			teardown: function(){
				cy.unbind("click");
				cy.nodes().removeCss();
			}
		});
		
		test({
			name: "fancyStyle",
			displayName: "Set a fancy visual style",
			description: "Change the visual style and make sure it takes effect",
			setup: function(){
				
				var length = cy.style().length;

				cy.style()
					.resetToDefault()
					.selector("node")
						.css({
							shape: "rectangle",
							backgroundColor: "lightblue",
							borderColor: "black",
							borderWidth: 1,
							width: "mapData(weight, 20, 100, 20, 100)",
							height: 20,
							labelFontWeight: "normal",
							labelFontSize: "0.75em",
							content: "data(weight)",
							textValign: "center",
							textHalign: "center"
						})
					.selector("edge")
						.css({
							lineColor: "mapData(weight, 0, 100, blue, red)",
							targetArrowShape: "triangle"
						})
					.selector("edge:selected")
						.css({
							width: 3
						})
					.selector("node:selected")
						.css({
							borderWidth: 3
						})
					.update()
				;
			},

			teardown: function(){
				var stylesheet = window.defaultSty;
				var style = cy.style();

				stylesheet.assignToStyle( style );
				style.update();
			}
		});
	});

});
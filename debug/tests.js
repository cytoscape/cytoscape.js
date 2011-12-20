$(function(){

	$("#cytoscapeweb").cy(function(e){
		var cy = e.cy;

		
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
			name: "bypassOnClick",
			displayName: "Bypass on click",
			description: "Set nodes to red and edges to blue on click",
			setup: function(){
				cy.elements().bind("click", function(){
					this.bypass("fillColor", "red");
					
					this.bypass({
						lineColor: "blue",
						targetArrowColor: "blue",
						sourceArrowColor: "blue"
					});
				});
			},
			teardown: function(){
				cy.elements().unbind("click").removeBypass();
			}
		});
		
		test({
			name: "shapeOnClick",
			displayName: "Squares on click",
			description: "Set nodes to squares and edge arrows to squares on click",
			setup: function(){
				cy.elements().bind("click", function(){
					this.bypass({
						shape: "rectangle",
						targetArrowShape: "square",
						sourceArrowShape: "square"
					});
				});
			},
			teardown: function(){
				cy.elements().unbind("click").removeBypass();
			}
		});
		
		test({
			name: "positionOnClick",
			displayName: "Random position on click",
			description: "Put node to random position on click",
			setup: function(){
				
				var $cy = $("#cytoscapeweb");
				
				var w = $cy.width();
				var h = $cy.height();
								
				cy.nodes().bind("click", function(){
					var node = this;
					
					var p1 = node.position();
					
					var padding = 50;
					
					var p2 = {
						x: Math.random() * (w - padding) + padding,
						y: Math.random() * (h - padding) + padding
					};
					
					var delta = {
						x: p2.x - p1.x,
						y: p2.y - p1.y
					};
						
					var d = Math.sqrt( delta.x*delta.x + delta.y*delta.y );
						
					var v = {
						x: delta.x/d,
						y: delta.y/d
					};
					
					var step = 10;
					var lastP = {
						x: p1.x,
						y: p1.y
					};
					var interval = setInterval(function(){
						
						d -= step;
						
						if(d < 0){
							step = step + d;
						}
						
						lastP = {
							x: lastP.x + step*v.x,
							y: lastP.y + step*v.y
						};
						node.position(lastP);
						
						if( d <= 0 ){
							clearInterval(interval);
						}
					}, 10);
				});
			},
			teardown: function(){
				cy.elements().unbind("click");
			}
		});
	});

});
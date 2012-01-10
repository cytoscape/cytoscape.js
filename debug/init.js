$(function(){
				
	$.cytoscapeweb("quiet", false);
	$.cytoscapeweb("debugging", false);
	
	var height, width;
	
	window.options = {
		renderer: {
			name: "svg"
		},
		layout: {
			name: "grid"
		},
		style: {
			selectors: {
				"edge": {
					targetArrowShape: "triangle",
					sourceArrowShape: "circle",
					width: {
						defaultValue: 1,
						continuousMapper: {
							attr: {
								name: "weight",
							},
							mapped: {
								min: 1,
								max: 4
							}
						}
					}
				},
				
				"edge:selected": {
					lineColor: "#666",
					targetArrowColor: "#666",
					sourceArrowColor: "#666"
				},
				
				"node": {
					labelText: {
						defaultValue: "",
						passthroughMapper: "id"
					},
					shape: "ellipse",
					height: {
						continuousMapper: {
							attr: {
								name: "weight",
							},
							mapped: {
								min: 10,
								max: 30
							}
						}
					},
					width: {
						continuousMapper: {
							attr: {
								name: "weight",
							},
							mapped: {
								min: 10,
								max: 30
							}
						}
					}
				},
				
				"node:selected": {
					fillColor: "#333"
				}
			}
		},
		elements: {
			nodes: [
			], 
			
			edges: [
			]
		},
		ready: function(cy){
			window.cy = cy;
		}
	};
	
	var numNodes = 4;
	var numEdges = 10;
	
	function randNodeId(){
		return "n" + Math.floor( Math.random() * numNodes );
	}
	
	for(var i = 0; i < numNodes; i++){
		options.elements.nodes.push({
			data: {
				id: "n" + i,
				weight: Math.random() * 100
			}
		});
	}
	
	for(var i = 0; i < numEdges; i++){
		options.elements.edges.push({
			data: {
				id: "e" + i,
				source: randNodeId(),
				target: randNodeId(),
				weight: Math.random() * 100
			}
		});
	}
	
	var $container = $("#cytoscapeweb");
	
	$container.cy(options).cy(function(){
		
		height = $("#cytoscapeweb").height();
		width = $("#cytoscapeweb").width();
		
		// enable this again later...
		
		$container.cytoscapewebPanzoom({
			
		});
		
		function number(group){
			var input = $("#" + group + "-number");
			var val = parseInt( input.val() );
			
			if( isNaN(val) ){
				return 0;
			}
			
			return val;
		}
		
		function time(callback){
			var start = new Date();
			callback();
			var end = new Date();
			
			$("#add-remove-time").html( (end - start) + " ms" );
		}
		
		$("#add-elements-button").click(function(){
			var n = number("nodes");
			var e = number("edges");
			
			var nodes = [];
			for(var i = 0; i < n; i++){
				nodes.push({
					group: "nodes",
					data: { id: "n" + (i + numNodes), weight: Math.random() * 100 },
					position: { x: Math.random() * width, y: Math.random() * height }
				});
			}
			numNodes += n;
			
			cy.add(nodes);
			
			var nodesCollection = cy.nodes();
			function nodeId(){
				var index = Math.round((nodesCollection.size() - 1) * Math.random());
				return nodesCollection.eq(index).data("id");
			}
			
			var edges = [];
			for(var i = 0; i < e; i++){
				edges.push({
					group: "edges",
					data: {
						id: "e" + (i + numEdges), 
						weight: Math.random() * 100,
						source: nodeId(),
						target: nodeId()
					},
				});
			}
			numEdges += e;
			
			time(function(){
				cy.add(edges);
			});
		});
		
		$("#remove-elements-button").click(function(){
			var n = number("nodes");
			var e = number("edges");
			
			time(function(){
				cy.nodes().slice(0, n).remove();
				cy.edges().slice(0, e).remove();
			});
			

		});
		
		$("#remove-selected-button").click(function(){
			cy.remove( cy.elements(":selected") );
		});
	});
	
	
});